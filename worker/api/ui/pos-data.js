// POS: penyimpanan di HP (IndexedDB), panggilan API, antrean offline, sinkron, dan hitungan bersama.
// Semua yang ditulis kasir masuk antrean dulu, lalu dikirim ke server saat ada sinyal.

const DB_NAMA = "hikayat-pos";

const bukaDb = () => new Promise((ok, gagal) => {
  const r = indexedDB.open(DB_NAMA, 2);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    if (!db.objectStoreNames.contains("antrean")) db.createObjectStore("antrean", { keyPath: "urut", autoIncrement: true });
    if (!db.objectStoreNames.contains("trx")) db.createObjectStore("trx", { keyPath: "id" }).createIndex("shift", "shift_id");
  };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => gagal(r.error);
});
let _db = null;
async function tx(store, mode, fn) {
  _db ??= await bukaDb();
  return new Promise((ok, gagal) => {
    const t = _db.transaction(store, mode);
    const hasil = fn(t.objectStore(store));
    t.oncomplete = () => ok(hasil && "result" in hasil ? hasil.result : hasil);
    t.onerror = () => gagal(t.error);
  });
}
const kv = {
  get: (k) => tx("kv", "readonly", (s) => s.get(k)),
  set: (k, v) => tx("kv", "readwrite", (s) => (v === null || v === undefined ? s.delete(k) : s.put(v, k))),
};

// ---------- ULID (sama formatnya dengan server) ----------
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid() {
  let t = Date.now(), w = "";
  for (let i = 0; i < 10; i++) { w = CROCKFORD[t % 32] + w; t = Math.floor(t / 32); }
  for (const b of crypto.getRandomValues(new Uint8Array(16))) w += CROCKFORD[b % 32];
  return w;
}
const sekarang = () => new Date().toISOString();
const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// ---------- API ----------
const S = { token: null, sesi: null, online: navigator.onLine, perangkat: null };

class GagalApi extends Error {
  constructor(pesan, status, kode) { super(pesan); this.status = status; this.kode = kode; }
}
const putus = (e) => e instanceof GagalApi && e.status === 0;

async function api(method, path, body, opsi = {}) {
  const h = {};
  if (S.token) h["x-perangkat"] = S.token;
  if (S.sesi && !opsi.tanpaSesi) h["x-sesi"] = S.sesi;
  if (body !== undefined) h["content-type"] = "application/json";
  let res;
  try {
    res = await fetch(path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(opsi.batas ?? 15000) });
  } catch {
    aturOnline(false);
    throw new GagalApi("Tidak ada sinyal. Data disimpan di HP dan dikirim nanti", 0);
  }
  aturOnline(true);
  if (opsi.mentah) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.kode === "perangkat_tidak_dikenal") {
    await kv.set("token", null);
    S.token = null;
    location.reload();
  }
  if (!res.ok) throw new GagalApi(data.error || "Server menolak permintaan", res.status, data.kode);
  return data;
}

const pendengarOnline = [];
function aturOnline(v) {
  if (S.online === v) return;
  S.online = v;
  pendengarOnline.forEach((f) => f(v));
}
addEventListener("online", () => { aturOnline(true); sinkronSekarang(); });
addEventListener("offline", () => aturOnline(false));

// ---------- Antrean ----------
async function antrekan(jenis, data) {
  await tx("antrean", "readwrite", (s) => s.add({ jenis, data, dibuat: sekarang() }));
  setTimeout(sinkronSekarang, 50);
}
const isiAntrean = () => tx("antrean", "readonly", (s) => s.getAll());
const hapusAntrean = (urut) => tx("antrean", "readwrite", (s) => urut.forEach((u) => s.delete(u)));

let sedangSinkron = null;
const pendengarSinkron = [];
// Kirim antrean berurutan, 20 dokumen sekali kirim. Gagal jaringan: berhenti dan coba lagi nanti.
function sinkronSekarang() {
  if (sedangSinkron || !S.token) return sedangSinkron;
  sedangSinkron = (async () => {
    try {
      for (;;) {
        const semua = await isiAntrean();
        if (!semua.length) break;
        const kirim = semua.slice(0, 20);
        const r = await api("POST", "/api/pos/sinkron", { dokumen: kirim.map(({ jenis, data }) => ({ jenis, data })) }, { tanpaSesi: true, batas: 30000 });
        const ditolak = [];
        r.hasil.forEach((h, i) => {
          if (h.status === "ditolak") ditolak.push({ ...kirim[i], alasan: h.alasan, waktu: sekarang() });
        });
        for (const [i, d] of kirim.entries()) {
          if (d.jenis !== "trx") continue;
          const t = await tx("trx", "readonly", (s) => s.get(d.data.id));
          if (t) await tx("trx", "readwrite", (s) => s.put({ ...t, terkirim: r.hasil[i].status !== "ditolak", ditolak: r.hasil[i].alasan ?? null }));
          // Server sudah mengurangi stoknya. Kurangi juga stok di katalog HP kalau katalog itu ditarik sebelum transaksi ini masuk.
          const snap = r.hasil[i].status !== "ditolak" && (await kv.get("snap:" + d.data.lokasi_id));
          if (snap && snap.waktu < r.waktu) {
            for (const it of d.data.items) snap.stok[it.sku] = (snap.stok[it.sku] ?? 0) - it.qty;
            await kv.set("snap:" + d.data.lokasi_id, snap);
          }
        }
        if (ditolak.length) await kv.set("ditolak", [...((await kv.get("ditolak")) ?? []), ...ditolak].slice(-100));
        await hapusAntrean(kirim.map((d) => d.urut));
      }
    } catch (e) {
      if (!putus(e)) console.warn("sinkron", e);
    } finally {
      sedangSinkron = null;
      pendengarSinkron.forEach((f) => f());
    }
  })();
  return sedangSinkron;
}
setInterval(() => { if (navigator.onLine) sinkronSekarang(); }, 15000);

// ---------- Data katalog per tempat ----------
// snapshot: { waktu, lokasi, kategori[], produk{id}, varian{sku}, stok{sku}, nomor_terakhir }
async function tarikData(lokasiId) {
  const kunci = "snap:" + lokasiId;
  const lama = await kv.get(kunci);
  const sejak = lama?.waktu ? "&sejak=" + encodeURIComponent(lama.waktu) : "";
  const r = await api("GET", `/api/pos/tarik?lokasi=${encodeURIComponent(lokasiId)}${sejak}`);
  const snap = r.penuh || !lama ? { produk: {}, varian: {}, stok: {} } : lama;
  snap.waktu = r.waktu;
  snap.lokasi = r.lokasi;
  snap.kategori = r.kategori;
  for (const p of r.produk) snap.produk[p.id] = p;
  for (const v of r.varian) snap.varian[v.sku] = v;
  for (const s of r.stok) snap.stok[s.sku] = s.qty;
  await kv.set(kunci, snap);
  await simpanUmum(r);
  const n = (await kv.get("nomor:" + hariIniWib())) ?? 0;
  if (r.nomor_terakhir > n) await kv.set("nomor:" + hariIniWib(), r.nomor_terakhir);
  return snap;
}
async function simpanUmum(r) {
  await kv.set("umum", { waktu: r.waktu, pengaturan: r.pengaturan, tempat: r.tempat });
  if (r.pengaturan?.qris?.berkas_id) simpanGambarQris(r.pengaturan.qris.berkas_id);
}
async function tarikUmum() {
  const r = await api("GET", "/api/pos/tarik");
  await simpanUmum(r);
  return r;
}

// Gambar QRIS disimpan di HP supaya tetap tampil tanpa sinyal.
async function simpanGambarQris(id) {
  const ada = await kv.get("qris_gambar");
  if (ada?.id === id) return;
  try {
    const res = await api("GET", "/api/pos/berkas/" + id, undefined, { mentah: true });
    if (res.ok) await kv.set("qris_gambar", { id, blob: await res.blob() });
  } catch {}
}

// Stok yang tampil = stok server − penjualan di antrean yang belum terkirim.
async function stokTersedia(snap) {
  const kurang = {};
  for (const d of await isiAntrean()) {
    if (d.jenis !== "trx" || d.data.lokasi_id !== snap.lokasi.id) continue;
    for (const i of d.data.items) kurang[i.sku] = (kurang[i.sku] ?? 0) + i.qty;
  }
  const hasil = {};
  for (const sku of Object.keys(snap.varian)) hasil[sku] = (snap.stok[sku] ?? 0) - (kurang[sku] ?? 0);
  return hasil;
}

// Nomor transaksi berkode HP: HK-yymmdd-A1-0001. Urutan disimpan per hari di HP.
async function nomorBaru() {
  const hari = hariIniWib();
  const n = ((await kv.get("nomor:" + hari)) ?? 0) + 1;
  await kv.set("nomor:" + hari, n);
  return `HK-${hari.slice(2).replace(/-/g, "")}-${S.perangkat.kode}-${String(n).padStart(4, "0")}`;
}

// ---------- PIN offline ----------
// HP menyimpan PBKDF2(PIN, salt acak HP) untuk karyawan yang pernah masuk online di HP ini.
async function hashPinLokal(pin, salt) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 60000 }, k, 256);
  return btoa(String.fromCharCode(...new Uint8Array(b)));
}
async function simpanPinLokal(staffId, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await kv.set("pin:" + staffId, { salt, hash: await hashPinLokal(pin, salt) });
}
async function cekPinLokal(staffId, pin) {
  const v = await kv.get("pin:" + staffId);
  if (!v) return null; // belum pernah masuk online di HP ini
  return (await hashPinLokal(pin, v.salt)) === v.hash;
}

// Catatan riwayat masuk dari HP (masuk offline, buka kasir, kunci layar, dll.) ikut antrean.
const catatLog = (staffId, aksi, keterangan) => antrekan("log", { id: ulid(), staff_id: staffId, aksi, waktu: sekarang(), keterangan });

// ---------- Hitungan keranjang (PRD bagian 7) ----------
function hitungTagihan(items, pengaturan, diskon = 0) {
  const subtotal = items.reduce((a, i) => a + i.qty * i.harga, 0);
  const dasar = subtotal - diskon;
  const pajak = pengaturan.pajak?.aktif ? Math.round((dasar * pengaturan.pajak.persen) / 100) : 0;
  const sebelum = dasar + pajak;
  const pembulatan = pengaturan.pembulatan ? sebelum % pengaturan.pembulatan : 0;
  return { subtotal, diskon, pajak, pembulatan, total: sebelum - pembulatan };
}

// Tombol uang cepat: uang pas, dua pembulatan ke atas, lalu nominal dari pengaturan yang lebih besar.
function nominalCepat(total, daftar) {
  const pilihan = new Set([total]);
  for (const k of [10000, 50000, 100000]) {
    const n = Math.ceil(total / k) * k;
    if (n > total && pilihan.size < 3) pilihan.add(n);
  }
  for (const n of daftar ?? []) if (n > total) pilihan.add(n);
  return [...pilihan].sort((a, b) => a - b).slice(0, 6);
}

const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const tglJam = (iso) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
