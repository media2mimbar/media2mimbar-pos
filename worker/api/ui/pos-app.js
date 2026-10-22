// POS: tampilan dan alur kasir. Data dan sinkron ada di pos-data.js.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NAMA_ROLE = { owner: "Owner", admin: "Admin", kasir: "Kasir" };
const inisial = (n) => n.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

// A: keadaan aplikasi yang sedang berjalan.
// sesi (disimpan di kv "sesi"): { staff, sesi, offline, lokasi_id, shift_id }
const A = { sesi: null, umum: null, snap: null, stok: {}, keranjang: [], ord: { promo: null, dilepas: false, pelanggan: null, order: null }, orderDaftar: [], kategori: "semua", cari: "", layar: null, mode: null };
// mode tampilan katalog: "grid" atau "sku" (bawaan dari Pengaturan POS, bisa diganti kasir di header).

function toast(pesan) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = pesan;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function tampil(html, nama) {
  A.layar = nama;
  $("#app").innerHTML = html;
  tutupLembar();
  window.scrollTo(0, 0);
}
// Header halaman. Tombol Kembali tampil sebagai panah di kiri seperti prototipe; tombol lain tetap di kanan.
function bar(judul, sub, kanan = "") {
  let kiri = "";
  kanan = kanan.replace('<button id="kembali">Kembali</button>', () => { kiri = '<button id="kembali" class="kembali" aria-label="Kembali">←</button>'; return ""; });
  return `<div class="bar">${kiri}<div class="judul"><b>${judul}</b><span>${sub}</span></div>${kanan ? `<div class="kanan">${kanan}</div>` : ""}</div>`;
}
// Header layar masuk: logo HK, nama toko, status HP.
const barMerek = (sub, kanan = "") => `<div class="bar merek"><div class="logo">HK</div><div class="judul"><b>Hikayat Merchandise</b><span>${sub}</span></div>${kanan ? `<div class="kanan">${kanan}</div>` : ""}</div>`;

// Gambar produk: belum ada foto di katalog, jadi pakai ikon dan warna lembut yang tetap per produk.
const WARNA_THUMB = ["#DCE9FD", "#FDE8DC", "#FBDDE4", "#E1F0EA", "#EFE1D6", "#DDEEFB", "#ECE4F7", "#FFF0E5"];
function thumb(p = {}) {
  const n = ((p.nama ?? "") + " " + (A.snap?.kategori ?? []).find((k) => k.id === p.kategori_id)?.nama).toLowerCase();
  const ikon = /kaos|jersey|kemeja|hoodie|baju|jaket|polo|sweater|shirt|gamis|koko/.test(n) ? "👕" : /topi|cap\b|kupluk|peci|bucket/.test(n) ? "🧢"
    : /tas\b|totebag|tote|pouch|ransel|sling/.test(n) ? "👜" : /tumbler|botol|mug|gelas|cangkir|cup\b/.test(n) ? "🥤" : /buku|novel|komik|majalah|kitab/.test(n) ? "📖"
    : /stiker|sticker|gantungan|ganci|\bpin\b|bros|emblem/.test(n) ? "🏷️" : /kalung|gelang|cincin|tasbih/.test(n) ? "📿" : /masker|kerudung|hijab|syal|scarf/.test(n) ? "🧣" : "🛍️";
  let h = 0;
  for (const c of String(p.id ?? p.nama)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="thumb" style="background:${WARNA_THUMB[h % WARNA_THUMB.length]}">${ikon}</span>`;
}
const statusSinyal = () => `<span class="titik-on ${S.online ? "" : "off"}"></span>${S.online ? "Online" : "Offline"}`;
function bukaLembar(html) {
  $("#lembar").innerHTML = html;
  $("#lapis").hidden = false;
}
function tutupLembar() { $("#lapis").hidden = true; }
$("#lapis").addEventListener("click", (e) => { if (e.target.id === "lapis") tutupLembar(); });

async function simpanSesi() {
  await kv.set("sesi", A.sesi ? { ...A.sesi, keranjang: A.keranjang, ord: A.ord } : null);
}

// ---------- Mulai ----------

async function mulai() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/pos-sw.js", { scope: "/pos" }).catch(() => {});
  S.token = (await kv.get("token").catch(() => null)) || null;
  S.perangkat = (await kv.get("perangkat")) || null;
  if (!S.token) return layarDaftar();
  try {
    S.perangkat = (await api("GET", "/api/pos/perangkat")).perangkat;
    await kv.set("perangkat", S.perangkat);
  } catch (e) {
    if (!putus(e)) return;
  }
  A.umum = await kv.get("umum");
  A.sesi = await kv.get("sesi");
  if (A.sesi) {
    S.sesi = A.sesi.sesi;
    A.keranjang = A.sesi.keranjang ?? [];
    A.ord = A.sesi.ord ?? A.ord;
    if (A.sesi.lokasi_id && A.sesi.shift_id) return masukKasir();
    if (A.sesi.lokasi_id && A.sesi.serah_saja) return masukSerahGudang({ id: A.sesi.lokasi_id });
    return layarTempat();
  }
  layarPilihNama();
  sinkronSekarang();
}

// ---------- Daftarkan HP ----------

function layarDaftar() {
  tampil(`<div class="halaman-masuk">${barMerek("HP belum terdaftar")}
    <div class="wrap"><div class="card">
      <h1>Daftarkan HP ini</h1>
      <p class="muted small">Minta Owner atau Admin membuka Dashboard › Perangkat POS › Daftarkan HP, lalu ketik kode yang muncul.</p>
      <form id="fDaftar">
        <input class="kode" name="kode" placeholder="XXXX-XXXX" maxlength="9" autocomplete="off" autocapitalize="characters" required>
        <div class="err" hidden></div>
        <button class="btn primary">Daftarkan</button>
      </form>
    </div></div></div>`, "daftar");
  const f = $("#fDaftar");
  f.kode.addEventListener("input", (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    e.target.value = v.length > 4 ? v.slice(0, 4) + "-" + v.slice(4) : v;
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $(".err", f);
    err.hidden = true;
    try {
      const r = await api("POST", "/api/pos/daftar", { kode: f.kode.value });
      S.token = r.token;
      S.perangkat = r.perangkat;
      await kv.set("token", r.token);
      await kv.set("perangkat", r.perangkat);
      layarPilihNama();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  });
}

// ---------- Pilih nama dan PIN ----------

async function layarPilihNama(pesan) {
  tampil(`<div class="halaman-masuk">${barMerek(`Aplikasi kasir event · HP ${esc(S.perangkat?.kode)} · ${statusSinyal()}`)}
    <div class="wrap">${pesan ? `<div class="ok">${esc(pesan)}</div>` : ""}<div class="label-bagian">Siapa yang bertugas?</div><div class="daftar" id="orang"><p class="muted small">Memuat…</p></div>
      <div class="petunjuk">Kasir dan PIN diatur di Dashboard › Karyawan</div></div></div>`, "nama");
  let karyawan = await kv.get("karyawan");
  try {
    karyawan = (await api("GET", "/api/pos/karyawan")).karyawan;
    await kv.set("karyawan", karyawan);
  } catch (e) { if (!putus(e)) throw e; }
  if (A.layar !== "nama") return;
  $("#orang").innerHTML = (karyawan ?? []).map((k) => `<button data-id="${k.id}">
    <span class="av">${esc(inisial(k.nama))}</span><span class="isi"><b>${esc(k.nama)}</b><br><span class="small muted">${k.role.map((r) => NAMA_ROLE[r]).join(", ")}${k.petunjuk ? " · " + esc(k.petunjuk) : ""}</span></span><span class="panah">›</span></button>`).join("")
    || '<p class="muted small">Daftar karyawan belum ada di HP ini. Sambungkan ke internet sekali untuk memuatnya.</p>';
  $$("#orang button").forEach((b) => (b.onclick = () => masukPin(karyawan.find((k) => k.id === b.dataset.id))));
}

let pinAksi = null;
// Papan PIN bulat seperti prototipe: C menghapus semua, ⌫ menghapus satu angka.
const padPin = (id) => `<div class="pad" id="${id}">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => `<button class="${k === "C" || k === "⌫" ? "fungsi" : ""}" data-k="${k}">${k}</button>`).join("")}</div>`;
const titikPin = (n) => [0, 1, 2, 3, 4, 5].map((i) => `<span class="${i < n ? "isi" : ""}"></span>`).join("");
function mintaPin(o) {
  pinAksi = { ...o, isi: "" };
  tampil(`<div class="kunci-view">
      <h1>${esc(o.judul)}</h1><div class="sub">${esc(o.info)}</div>
      ${o.batal ? `<button class="tautan" id="pinBatal">${esc(o.tautan ?? "Batal")}</button>` : ""}
      ${o.av ? `<div class="av">${esc(o.av)}</div>` : `<div class="ilustrasi">${o.ikon ?? "🔐"}</div>`}
      <div class="titik" id="titik"></div>
      <div class="err" id="pinErr" hidden></div>
      ${padPin("pad")}
      <div class="kaki-kunci"><span>HP ${esc(S.perangkat?.kode ?? "")} · ${statusSinyal()}</span></div>
    </div>`, "pin");
  gambarTitik();
  $("#pad").onclick = padKlik;
  if (o.batal) $("#pinBatal").onclick = o.batal;
}
function gambarTitik() {
  $("#titik").innerHTML = titikPin(pinAksi.isi.length);
}
function salahPin(pesan) {
  const el = $("#pinErr");
  if (!el) return toast(pesan);
  el.textContent = pesan;
  el.hidden = false;
}
async function padKlik(e) {
  const k = e.target.closest("[data-k]")?.dataset.k;
  if (!k || !pinAksi) return;
  if (k === "⌫") pinAksi.isi = pinAksi.isi.slice(0, -1);
  else if (k === "C") pinAksi.isi = "";
  else if (pinAksi.isi.length < 6) pinAksi.isi += k;
  gambarTitik();
  if (pinAksi.isi.length === 6) {
    const pin = pinAksi.isi, aksi = pinAksi;
    pinAksi.isi = "";
    try { await aksi.selesai(pin); } catch (x) { salahPin(x.message); gambarTitik(); }
  }
}

function masukPin(k) {
  mintaPin({
    judul: "Halo, " + k.nama.split(/\s+/)[0], info: "Masukkan PIN 6 angka", tautan: "Bukan Anda? Ganti kasir", batal: () => layarPilihNama(),
    selesai: async (pin) => {
      try {
        const r = await api("POST", "/api/pos/masuk", { staff_id: k.id, pin });
        S.sesi = r.sesi;
        await simpanPinLokal(k.id, pin);
        A.sesi = { staff: r.staff, sesi: r.sesi, offline: false };
        await simpanSesi();
        if (r.staff.wajib_ganti_pin) return gantiPin(true);
        lanjutSetelahMasuk();
      } catch (e) {
        if (!putus(e)) throw e;
        // Tanpa sinyal: cocokkan dengan PIN yang tersimpan di HP ini.
        const cocok = await cekPinLokal(k.id, pin);
        if (cocok === null) throw new Error("Belum pernah masuk di HP ini. Butuh sinyal untuk masuk pertama kali");
        if (!cocok) { await catatLog(k.id, "PIN salah", "masuk offline"); throw new Error("PIN salah"); }
        A.sesi = { staff: { id: k.id, nama: k.nama, role: k.role, wajib_ganti_pin: false }, sesi: null, offline: true };
        S.sesi = null;
        await simpanSesi();
        await catatLog(k.id, "Masuk offline");
        toast("Masuk offline. Data dikirim saat ada sinyal");
        lanjutSetelahMasuk();
      }
    },
  });
}

function gantiPin(wajib) {
  const ulang = (pesan) => { gantiPin(wajib); salahPin(pesan); };
  const kembali = wajib ? null : () => masukKasir();
  mintaPin({
    judul: "Ganti PIN", info: (wajib ? "PIN Anda masih sementara. " : "") + "Masukkan PIN lama", batal: kembali, ikon: "🔑",
    selesai: async (lama) => mintaPin({
      judul: "Ganti PIN", info: "Masukkan PIN baru", batal: kembali, ikon: "🔑",
      selesai: async (baru) => mintaPin({
        judul: "Ganti PIN", info: "Ulangi PIN baru", batal: kembali, ikon: "🔑",
        selesai: async (lagi) => {
          if (lagi !== baru) return ulang("PIN baru tidak sama. Ulangi dari awal");
          try { await api("POST", "/api/pos/ganti-pin", { pin_lama: lama, pin_baru: baru }); } catch (x) { return ulang(x.message); }
          await simpanPinLokal(A.sesi.staff.id, baru);
          A.sesi.staff.wajib_ganti_pin = false;
          await simpanSesi();
          toast("PIN berhasil diganti");
          if (A.sesi.lokasi_id && A.sesi.shift_id) masukKasir(); else lanjutSetelahMasuk();
        },
      }),
    }),
  });
}

// Kasir yang punya shift terbuka di tempat yang dia pilih sebelumnya langsung lanjut. Owner selalu memilih tempat.
async function lanjutSetelahMasuk() {
  try { A.umum = await tarikUmum(); } catch (e) { if (!putus(e) && e.kode !== "perlu_masuk") throw e; A.umum = await kv.get("umum"); }
  const milik = (A.umum?.tempat ?? []).find((t) => t.shift_terbuka?.kasir_id === A.sesi.staff.id);
  if (milik && !A.sesi.staff.role.includes("owner")) return pilihTempat(milik);
  layarTempat();
}

async function keluar(pesan) {
  try { if (A.sesi?.sesi) await api("POST", "/api/pos/keluar", {}); } catch {}
  if (A.sesi) await catatLog(A.sesi.staff.id, "Keluar");
  A.sesi = null;
  S.sesi = null;
  A.keranjang = [];
  A.ord = { promo: null, dilepas: false, pelanggan: null, order: null };
  await simpanSesi();
  layarPilihNama(pesan);
}

// ---------- Pilih tempat dan buka kasir ----------

const tagTempat = (label) => (label === "Berlangsung" ? "ok" : label.startsWith("Pre-sale") ? "warn" : label.startsWith("Belum") ? "off" : "");
const ikonTempat = (t) => (t.jenis === "gudang" ? "🏬" : "📍");
function layarTempat() {
  const tempat = A.umum?.tempat ?? [];
  const owner = A.sesi.staff.role.includes("owner");
  tampil(`<div class="halaman-masuk">${barMerek(`${esc(A.sesi.staff.nama)} · ${statusSinyal()}`, '<button id="btnKeluar">Keluar</button>')}
    <div class="wrap">
      <h1>Pilih tempat jualan</h1><div class="muted small">${owner ? "Owner bisa berjualan di event mana pun atau langsung dari gudang." : "Pilih event, lalu hitung modal awal di laci."}</div>
      ${A.sesi.offline ? '<div class="warn">Masuk offline. Daftar tempat dari data terakhir di HP ini.</div>' : ""}
      ${tempat.length ? `<div class="label-bagian">${owner ? "Event dan tempat jualan" : "Event"}</div>` : ""}
      <div class="daftar">${tempat.map((t) => `<button data-id="${t.id}" ${t.boleh_jual ? "" : "disabled"}>
        <span class="ikon">${ikonTempat(t)}</span>
        <span class="isi"><b>${esc(t.nama)}</b><br><span class="tag ${tagTempat(t.label)}">${esc(t.label)}</span>${t.shift_terbuka ? ` <span class="small muted">Kasir terbuka · ${esc(t.shift_terbuka.kasir)}</span>` : ""}</span><span class="panah">›</span></button>`).join("")}</div>
      ${owner ? tempat.filter((t) => t.jenis === "event" && t.label !== "Akan Datang" && !t.label.startsWith("Pre-sale") && !t.label.startsWith("Belum")).map((t) => `<p class="small muted" style="margin:10px 0 0">Selesai di ${esc(t.nama)}? <a href="#" data-tutupev="${t.id}" style="color:var(--danger);font-weight:700">Tutup event</a></p>`).join("") : ""}
      ${tempat.length ? "" : `<div class="card kosong" style="margin-top:16px"><div class="ki">📍</div><b>Belum ada tempat jualan</b>${owner ? "Muat ulang saat ada sinyal." : "Anda belum ditugaskan di event yang sedang berlangsung. Minta Admin menambahkan Anda di form event."}</div>`}
    </div></div>`, "tempat");
  $("#btnKeluar").onclick = () => keluar();
  $$(".daftar button[data-id]").forEach((b) => (b.onclick = () => pilihTempat(tempat.find((t) => t.id === b.dataset.id))));
  $$("[data-tutupev]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); A.snap ??= { lokasi: { nama: "" } }; layarTutupEventPos(a.dataset.tutupev, layarTempat); }));
}

async function pilihTempat(t) {
  if (t.serah_saja) return masukSerahGudang(t);
  if (t.shift_terbuka) {
    A.sesi.lokasi_id = t.id;
    A.sesi.shift_id = t.shift_terbuka.id;
    A.sesi.shift = { ...t.shift_terbuka, lokasi_id: t.id };
    await simpanSesi();
    await catatLog(A.sesi.staff.id, "Gabung kasir", t.nama);
    return masukKasir();
  }
  tampil(`<div class="halaman-masuk">${barMerek(`${esc(A.sesi.staff.nama)} · ${statusSinyal()}`)}
    <div class="wrap"><form id="fBuka">
      <h1>Buka kasir</h1><div class="muted small">Satu tempat jualan punya satu laci. Hitung uang di laci sebelum mulai.</div>
      <div class="item-pilih"><span class="ikon">${ikonTempat(t)}</span><span class="isi"><b>${esc(t.nama)}</b><br><span class="tag ${tagTempat(t.label)}">${esc(t.label)}</span></span></div>
      <label>Modal awal di laci</label><input name="modal" type="number" inputmode="numeric" min="0" placeholder="0" required>
      <div class="chips" id="modalCepat" style="flex-wrap:wrap">${[0, 200000, 300000, 500000].map((v) => `<button type="button" data-modal="${v}">${v ? rp(v).replace("Rp ", "") : "Tanpa modal"}</button>`).join("")}</div>
      <button class="btn primary" style="margin-top:18px">Buka Kasir</button>
      <button type="button" class="btn hantu" id="batal">Kembali</button>
    </form></div></div>`, "buka");
  $("#modalCepat").onclick = (e) => {
    const b = e.target.closest("[data-modal]");
    if (!b) return;
    $("#fBuka").modal.value = b.dataset.modal;
    $$("#modalCepat button").forEach((x) => x.classList.toggle("on", x === b));
  };
  $("#batal").onclick = layarTempat;
  $("#fBuka").onsubmit = async (e) => {
    e.preventDefault();
    const modal = Number(e.target.modal.value || 0);
    const shift = { id: ulid(), lokasi_id: t.id, kasir_id: A.sesi.staff.id, buka: sekarang(), modal, offline: !S.online };
    await antrekan("shift_buka", shift);
    await catatLog(A.sesi.staff.id, "Buka kasir", t.nama);
    A.sesi.lokasi_id = t.id;
    A.sesi.shift_id = shift.id;
    A.sesi.shift = { ...shift, kasir: A.sesi.staff.nama };
    await simpanSesi();
    masukKasir();
  };
}

// ---------- Halaman kasir ----------

async function masukKasir() {
  A.snap = await kv.get("snap:" + A.sesi.lokasi_id);
  if (!A.snap) {
    try { A.snap = await tarikData(A.sesi.lokasi_id); } catch (e) {
      if (!putus(e)) { toast(e.message); return layarTempat(); }
      return tampil(`${bar("Hikayat POS", statusSinyal())}<div class="wrap"><div class="card">Katalog tempat ini belum pernah dimuat di HP ini. Sambungkan ke internet sekali.</div>
        <button class="btn" id="kembali">Kembali</button></div>`, "kosong"), ($("#kembali").onclick = layarTempat);
    }
  }
  A.umum = (await kv.get("umum")) ?? A.umum;
  A.stok = await stokTersedia(A.snap);
  A.orderDaftar = (await kv.get("order:" + A.sesi.shift_id)) ?? [];
  gambarKasir();
  segarkan();
}

// Tarik data baru di latar belakang tanpa mengganggu kasir.
async function segarkan() {
  if (!A.sesi?.lokasi_id || !S.online || !A.sesi.sesi) return;
  try {
    const adaLaris = !!(A.snap?.terlaris ?? []).length;
    A.snap = await tarikData(A.sesi.lokasi_id);
    A.umum = await kv.get("umum");
    A.stok = await stokTersedia(A.snap);
    // Chip Terlaris baru muncul setelah ada penjualan: gambar ulang header katalog kalau berubah.
    if (A.layar === "kasir") (adaLaris !== !!(A.snap.terlaris ?? []).length ? gambarKasir() : gambarKatalog());
  } catch (e) {
    if (e.kode === "perlu_masuk") toast("Sesi habis. Keluar lalu masuk lagi untuk memperbarui data");
  }
}
setInterval(segarkan, 120000);

const pengaturan = () => A.umum?.pengaturan ?? {};
const produkAktif = () => Object.values(A.snap.produk).filter((p) => p.aktif && p.tampil_pos);
const varianDari = (pid) => Object.values(A.snap.varian).filter((v) => v.produk_id === pid && v.aktif).sort((a, b) => a.urutan - b.urutan);
const diKeranjang = (sku) => A.keranjang.find((i) => i.sku === sku)?.qty ?? 0;
const namaBarang = (v) => { const p = A.snap.produk[v.produk_id]; return p.nama + (v.nama ? " · " + v.nama : ""); };
const namaProduk = (id) => A.snap.produk[id]?.nama ?? "produk";

// Pre-sale "ambil nanti": event belum mulai, pre-sale aktif mode ambil. Stok tidak dibatasi dan tidak berkurang saat transaksi.
function modePresale() {
  const e = A.snap?.lokasi?.event;
  return !!e && e.presale_aktif === 1 && e.presale_mode === "ambil" && hariIniWib() < e.mulai;
}

// Header oranye kasir, dipakai tab Penjualan dan tab Daftar Order.
function appbarKasir() {
  return `<div class="bar appbar">
    <div class="baris1"><span class="logo-kecil">HK</span>
      <div class="judul"><b>${esc(A.snap.lokasi.nama)}</b><span>${esc(A.sesi.staff.nama)} · <span id="sinyal">${statusSinyal()}</span> <span id="antre"></span></span></div>
      <button class="ikon-btn" id="btnMode" title="${modeKatalog() === "sku" ? "Tampilan grid" : "Mode SKU (scan barcode)"}">${modeKatalog() === "sku" ? "⊞" : "▦"}</button>
      <button class="ikon-btn" id="btnKunci" title="Kunci layar">🔒</button><button class="ikon-btn" id="btnMenu" title="Menu">☰</button></div>
    <div class="pills">${pillTempat()}<button id="pillPelanggan" class="pill"></button></div>
  </div>`;
}
const tabKasir = (aktif) => `<div class="tabs"><button id="${aktif === "jual" ? "tabJual" : "kembali"}" class="${aktif === "jual" ? "on" : ""}">Penjualan</button>
  <button id="btnOrder" class="${aktif === "order" ? "on" : ""}">Daftar Order <span class="lencana" id="nOrder">${(A.orderDaftar ?? []).length}</span></button></div>`;
function pasangAppbar() {
  $("#pillTempat").onclick = lembarTempat;
  $("#pillPelanggan").onclick = lembarPelanggan;
  $("#btnMenu").onclick = lembarMenu;
  $("#btnKunci").onclick = () => kunciLayar(false);
  $("#btnMode").onclick = () => { A.mode = modeKatalog() === "sku" ? "grid" : "sku"; gambarKasir(); };
  if ($("#infoKiriman")) $("#infoKiriman").onclick = lembarTempat;
  isiPillPelanggan();
  gambarAntrean();
}
function isiPillPelanggan() {
  const el = $("#pillPelanggan");
  if (!el) return;
  const pel = A.ord?.pelanggan;
  el.classList.toggle("set", !!pel);
  el.innerHTML = `<span class="pi">👤</span><span class="pt"><span class="l1">Pelanggan${modePresale() && !pel ? " · wajib" : ""}</span><span class="l2">${pel ? esc(pel.nama) : "+ Pelanggan"}</span></span><span class="caret">▼</span>`;
}

function gambarKasir() {
  const kat = (A.snap.kategori ?? []).filter((k) => k.tampil_menu);
  const adaPromo = promoBerlakuSekarang().length > 0;
  tampil(`<div class="kasir">
    ${appbarKasir()}
    <div class="isi-kasir">
      ${catatanTempat()}
      ${tabKasir("jual")}
      <div class="cari"><span>🔍</span><input type="search" id="cari" placeholder="${modeKatalog() === "sku" ? "Scan barcode atau ketik SKU, lalu Enter" : "Cari nama produk / SKU…"}" value="${esc(A.cari)}" enterkeyhint="go"></div>
      <div class="chips" id="chips"><button data-k="semua">▦ Semua</button>${(A.snap.terlaris ?? []).length ? '<button data-k="terlaris">🔥 Terlaris</button>' : ""}${adaPromo ? '<button data-k="promo">🏷️ Promo</button>' : ""}${kat.map((k) => `<button data-k="${k.id}">${esc(k.nama)}</button>`).join("")}</div>
      <div class="grid" id="grid"></div>
    </div>
    <div class="aksi" id="aksiMini"><button id="btnHapus">Hapus</button><button id="btnPromo">Promosi</button><button id="btnSimpan" class="aktif">Simpan</button></div>
    <div class="cartbar" id="cartbar"><button class="total" id="btnTotal"><span class="lencana-jml" id="jmlBadge">0</span><span class="tl"><small id="jmlBarang"></small><b id="totalBelanja"></b></span></button><button class="bayar" id="btnBayar">Bayar →</button></div>
  </div>`, "kasir");
  pasangAppbar();
  // Scan barcode: pemindai mengetik SKU lalu Enter. SKU yang cocok persis langsung masuk keranjang.
  $("#cari").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const kode = e.target.value.trim().toUpperCase();
    const v = Object.values(A.snap.varian).find((x) => x.aktif && x.sku.toUpperCase() === kode && A.snap.produk[x.produk_id]?.aktif && A.snap.produk[x.produk_id]?.tampil_pos);
    if (!v) return toast(kode ? `SKU ${kode} tidak ada di katalog tempat ini` : "Ketik atau scan SKU");
    tambah(v.sku);
    e.target.value = ""; A.cari = ""; gambarKatalog();
  };
  $("#chips").onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) { A.kategori = b.dataset.k; gambarKatalog(); } };
  $("#cari").oninput = (e) => { A.cari = e.target.value; gambarKatalog(); };
  $("#btnTotal").onclick = lembarKeranjang;
  $("#btnPromo").onclick = lembarPromo;
  $("#btnSimpan").onclick = () => simpanOrder();
  $("#btnOrder").onclick = () => layarOrder();
  $("#btnBayar").onclick = () => (A.keranjang.length ? layarBayar() : toast("Keranjang masih kosong"));
  $("#btnHapus").onclick = () => {
    if (!A.keranjang.length || !confirm("Hapus semua barang di keranjang?")) return;
    // Pesanan dari Daftar Order yang dikosongkan tetap ada di Daftar Order.
    kosongkanKeranjang();
    gambarKatalog();
  };
  gambarKatalog();
}

function kosongkanKeranjang() {
  A.keranjang = [];
  A.ord = { promo: null, dilepas: false, pelanggan: null, order: null };
  simpanSesi();
}

// Info tempat di atas katalog: label status, event, tanggal, dan pengingat kiriman yang belum diterima. Diketuk: sheet info dan stok per varian.
const modeKatalog = () => A.mode ?? (pengaturan().tampilan === "sku" ? "sku" : "grid");
function labelTempat() {
  const e = A.snap.lokasi.event;
  if (!e) return "Tempat Jualan";
  if (hariIniWib() < e.mulai) return e.presale_aktif !== 1 ? "Belum mulai" : e.presale_mode === "ambil" ? "Pre-sale · ambil nanti" : "Pre-sale · stok langsung";
  return "Event";
}
function pillTempat() {
  const stok = Object.values(A.snap.varian).filter((v) => v.aktif && A.snap.produk[v.produk_id]?.aktif).reduce((a, v) => a + Math.max(0, A.stok[v.sku] ?? 0), 0);
  return `<button id="pillTempat" class="pill"><span class="pi">${A.snap.lokasi.jenis === "gudang" ? "🏬" : "📍"}</span>
    <span class="pt"><span class="l1">${esc(labelTempat())}</span><span class="l2">${modePresale() ? "Stok tidak dibatasi" : `${stok} pcs stok`}</span></span><span class="caret">▼</span></button>`;
}
// Pengingat di bawah header: mode pre-sale dan kiriman stok yang belum diterima. Kiriman diketuk: sheet tempat untuk menerima.
function catatanTempat() {
  return `${modePresale() ? '<div class="catatan">Pre-sale · ambil nanti. Pembeli wajib punya no HP, stok berkurang saat barang diserahkan</div>' : ""}
    ${A.snap.kiriman_menunggu ? `<button class="catatan" id="infoKiriman">📦 ${A.snap.kiriman_menunggu} kiriman stok belum diterima. Ketuk untuk menerima</button>` : ""}`;
}
function lembarTempat() {
  const e = A.snap.lokasi.event, owner = A.sesi.staff.role.includes("owner");
  const varian = Object.values(A.snap.varian).filter((v) => v.aktif && A.snap.produk[v.produk_id]?.aktif).sort((a, b) => namaBarang(a).localeCompare(namaBarang(b)));
  bukaLembar(`<h2>${esc(e ? e.nama : A.snap.lokasi.nama)}</h2><div class="small muted">${esc(labelTempat())}${e ? ` · ${esc(e.venue ?? "")} · ${esc(e.mulai)} s/d ${esc(e.selesai)}` : ""}</div>
    ${A.snap.kiriman_menunggu ? `<button class="btn primary" id="keTerima">Terima ${A.snap.kiriman_menunggu} kiriman stok</button>` : ""}
    <h3 style="margin:14px 0 4px">Sisa stok</h3><table class="rinci">${varian.map((v) => `<tr><td>${esc(namaBarang(v))}<br><span class="small muted">${esc(v.sku)} · ${rp(v.harga)}</span></td><td>${A.stok[v.sku] ?? 0}</td></tr>`).join("")}</table>
    ${owner ? `<button class="btn" id="gantiTempat">Ganti tempat</button>${e ? '<button class="btn" id="tutupEvPill">Tutup event</button>' : ""}` : ""}`);
  if ($("#keTerima")) $("#keTerima").onclick = () => layarInventori("kiriman");
  if ($("#gantiTempat")) $("#gantiTempat").onclick = async () => {
    if (A.keranjang.length) return toast("Kosongkan keranjang dulu");
    A.sesi.lokasi_id = null; A.sesi.shift_id = null; await simpanSesi();
    try { A.umum = await tarikUmum(); } catch {}
    layarTempat();
  };
  if ($("#tutupEvPill")) $("#tutupEvPill").onclick = () => layarTutupEventPos();
}

function gambarKatalog() {
  if (A.layar !== "kasir") return;
  $$("#chips button").forEach((b) => b.classList.toggle("on", b.dataset.k === A.kategori));
  isiPillPelanggan();
  const t = tagihan();
  $("#btnPromo").textContent = t.promo_nama ? "✓ " + t.promo_nama : "Promosi";
  $("#btnPromo").classList.toggle("pakai", !!t.promo_nama);
  $("#nOrder").textContent = (A.orderDaftar ?? []).length;
  if (A.kategori === "promo") return gambarTabPromo();
  const q = A.cari.trim().toLowerCase();
  const tampilStok = pengaturan().tampil_stok !== false;
  const pre = modePresale();
  const laris = A.snap.terlaris ?? [];
  const tandaHarga = A.snap.lokasi.event ? "harga event" : "harga khusus";
  const daftar = produkAktif().filter((p) => (A.kategori === "semua" || (A.kategori === "terlaris" ? laris.includes(p.id) : p.kategori_id === A.kategori))
    && (!q || (p.nama + " " + p.sku + " " + varianDari(p.id).map((v) => v.sku).join(" ")).toLowerCase().includes(q)))
    .sort((a, b) => (A.kategori === "terlaris" ? laris.indexOf(a.id) - laris.indexOf(b.id) : a.nama.localeCompare(b.nama)));
  // Mode SKU: satu baris per varian, cocok untuk scan barcode.
  if (modeKatalog() === "sku") {
    const baris = daftar.flatMap((p) => varianDari(p.id).filter((v) => !q || (p.nama + " " + v.sku + " " + v.nama).toLowerCase().includes(q)));
    $("#grid").innerHTML = `<div class="sku-daftar">${baris.map((v) => { const s = A.stok[v.sku] ?? 0, n = diKeranjang(v.sku); return `<button data-sku="${esc(v.sku)}" ${s <= 0 && !pre ? 'style="opacity:.5"' : ""}>
      ${thumb(A.snap.produk[v.produk_id])}<span class="isi"><b>${esc(namaBarang(v))}</b><span class="kode">${esc(v.sku)}${pre ? " · pre-sale" : tampilStok ? ` · ${s > 0 ? "sisa " + s : "habis"}` : ""}${v.harga !== v.harga_normal ? ` · <span class="khusus">${tandaHarga}</span>` : ""}</span></span>
      <span class="kanan"><b>${rp(v.harga)}</b>${n ? `<span class="tag ok">${n}</span>` : ""}</span></button>`; }).join("") || '<div class="kosong-kat">Tidak ada produk.</div>'}</div>`;
    $$("#grid [data-sku]").forEach((b) => (b.onclick = () => tambah(b.dataset.sku)));
    return gambarTotal();
  }
  $("#grid").innerHTML = daftar.map((p) => {
    const v = varianDari(p.id);
    if (!v.length) return "";
    const stok = v.reduce((a, x) => a + Math.max(0, A.stok[x.sku] ?? 0), 0);
    const harga = v.map((x) => x.harga);
    const min = Math.min(...harga), maks = Math.max(...harga);
    const jml = v.reduce((a, x) => a + diKeranjang(x.sku), 0);
    const khusus = v.some((x) => x.harga !== x.harga_normal);
    const infoStok = pre ? "Pre-sale · ambil saat event" : tampilStok ? (stok > 0 ? `Sisa ${stok}` : "Stok habis") : "";
    return `<button class="kartu ${stok <= 0 && !pre ? "habis" : ""}" data-p="${p.id}">
      ${jml ? `<span class="jml">${jml}</span>` : ""}${p.punya_varian ? `<span class="nvar">${v.length} varian</span>` : ""}
      ${thumb(p)}<b>${esc(p.nama)}</b>
      <span class="harga">${min === maks ? rp(min) : `${rp(min)}+`}</span>
      <span class="stok ${!pre && tampilStok && stok > 0 && stok <= 3 ? "menipis" : ""}">${infoStok}${khusus ? `${infoStok ? " · " : ""}<span class="khusus">${tandaHarga}</span>` : ""}</span></button>`;
  }).join("") || '<div class="kosong-kat">Tidak ada produk.</div>';
  $$("#grid .kartu").forEach((b) => (b.onclick = () => ketukProduk(A.snap.produk[b.dataset.p])));
  gambarTotal();
}

function gambarTotal() {
  const t = tagihan();
  const n = t.items.reduce((a, i) => a + i.qty, 0);
  $("#jmlBadge").textContent = n;
  $("#jmlBarang").textContent = `${t.diskon ? "Hemat " + rp(t.diskon) : "Total belanja"} · ketuk untuk ubah`;
  $("#totalBelanja").textContent = rp(t.total);
  // Bar keranjang dan tombol kecil di atasnya baru muncul setelah ada barang, seperti prototipe.
  $("#cartbar").classList.toggle("show", n > 0);
  $("#aksiMini").classList.toggle("show", n > 0);
}

async function gambarAntrean() {
  const el = $("#antre");
  if (!el) return;
  const n = (await isiAntrean()).length;
  el.textContent = n ? `· ${n} belum terkirim` : "";
  const s = $("#sinyal");
  if (s) s.innerHTML = statusSinyal();
}
pendengarSinkron.push(async () => {
  // Katalog di HP ikut berubah setelah sinkron (stok yang sudah dikonfirmasi server).
  if (A.sesi?.lokasi_id) {
    A.snap = (await kv.get("snap:" + A.sesi.lokasi_id)) ?? A.snap;
    if (A.snap) A.stok = await stokTersedia(A.snap);
    if (A.layar === "kasir") gambarKatalog();
  }
  gambarAntrean();
});
pendengarOnline.push(gambarAntrean);

function tambah(sku, n = 1, diam = false) {
  const ada = diKeranjang(sku);
  const sisa = A.stok[sku] ?? 0;
  if (n > 0 && !modePresale() && ada + n > sisa) return toast(sisa > 0 ? `Stok tinggal ${sisa}` : "Stok habis di tempat ini");
  const i = A.keranjang.find((x) => x.sku === sku);
  if (i) i.qty += n; else A.keranjang.push({ sku, qty: n });
  A.keranjang = A.keranjang.filter((x) => x.qty > 0);
  cekPromoOtomatis(diam);
  simpanSesi();
  gambarKatalog();
}

function ketukProduk(p, judul) {
  const v = varianDari(p.id);
  if (!judul && !p.punya_varian && v.length === 1) return tambah(v[0].sku);
  const pre = modePresale();
  // Ukuran tampil sebagai kotak: ketuk untuk menambah, tombol − di pojok untuk mengurangi.
  const gambar = () => bukaLembar(`<h2>${esc(p.nama)}</h2><div class="sub">${esc(judul ?? "Pilih ukuran. Ketuk lagi untuk menambah jumlah.")}</div>
    <div class="vgrid">${v.map((x) => { const s = A.stok[x.sku] ?? 0, n = diKeranjang(x.sku); return `<div class="vsel ${n ? "on" : ""}">
      <button class="vbtn" data-k="+" data-sku="${esc(x.sku)}" ${!pre && s - n <= 0 ? "disabled" : ""}><b>${esc(x.nama || p.nama)}</b><small>${rp(x.harga).replace("Rp ", "")} · ${pre ? "pre-sale" : s - n > 0 ? "sisa " + (s - n) : "habis"}</small></button>
      ${n ? `<span class="vq">${n}</span><button class="vkurang" data-k="-" data-sku="${esc(x.sku)}" aria-label="Kurangi ${esc(x.nama || p.nama)}">−</button>` : ""}</div>`; }).join("")}</div>
    <button class="btn primary" id="selesaiVarian">Selesai</button>`);
  gambar();
  $("#lembar").onclick = (e) => {
    const b = e.target.closest("button[data-sku]");
    if (b) { tambah(b.dataset.sku, b.dataset.k === "+" ? 1 : -1); gambar(); }
    if (e.target.id === "selesaiVarian") tutupLembar();
  };
}

function barisKeranjang() {
  return A.keranjang.map((i) => { const v = A.snap.varian[i.sku]; return v ? { sku: i.sku, produk_id: v.produk_id, nama: namaBarang(v), qty: i.qty, harga: v.harga } : null; }).filter(Boolean);
}

// Tagihan lengkap: barang, promo (satu per pesanan), barang gratis, PPN, pembulatan, dan pembayaran sebagian dari Daftar Order.
function tagihan() {
  const items = barisKeranjang();
  const pr = A.ord?.promo;
  let diskon = 0, promo = null, nama = null;
  if (pr?.id === "manual") {
    const dk = pengaturan().diskon_kasir ?? {};
    const maks = dk.aktif ? dk.maks_persen ?? 0 : 0;
    const persen = Math.min(pr.persen ?? 0, maks);
    const sub = items.reduce((a, i) => a + i.qty * i.harga, 0);
    diskon = Math.round((sub * persen) / 100);
    nama = `Diskon manual kasir ${persen}%`;
  } else if (pr) {
    promo = promoBerlakuSekarang().find((p) => p.id === pr.id) ?? null;
    if (promo && HkPromo.memenuhi(promo, items)) { diskon = HkPromo.potongan(promo, items, pr.persen); nama = promo.nama; }
  }
  // Barang gratis dari promo Bonus Produk: tandai pcs termurah sebanyak hak bonus.
  const bonus = {};
  if (promo?.jenis === "bonus" && diskon) for (const u of HkPromo.infoBonus(promo, items).gratis) bonus[u.sku] = (bonus[u.sku] ?? 0) + 1;
  const isi = items.map((i) => ({ ...i, bonus: Math.min(bonus[i.sku] ?? 0, i.qty) }));
  const t = hitungTagihan(isi, pengaturan(), diskon);
  const order = A.ord?.order ? (A.orderDaftar ?? []).find((o) => o.id === A.ord.order) : null;
  const sudah = (order?.bayar ?? []).reduce((a, b) => a + b.jumlah, 0);
  return { ...t, items: isi, promo_id: diskon ? pr.id : null, promo_nama: diskon ? nama : null, promo_persen: pr?.persen, sudah_dibayar: sudah, sisa: Math.max(0, t.total - sudah), order };
}

function lembarKeranjang() {
  const gambar = () => {
    const t = tagihan();
    bukaLembar(`<h2>Keranjang${t.order ? " · " + esc(t.order.no) : ""}</h2><div class="sub">Ubah jumlah atau hapus barang. Jumlah 0 berarti dihapus.</div>
      ${t.items.length ? t.items.map((i) => { const v = A.snap.varian[i.sku], p = A.snap.produk[i.produk_id] ?? { nama: i.nama }; return `<div class="baris">${thumb(p)}
        <div class="isi"><b>${esc(p.nama)}${v?.nama ? ` <span>· ${esc(v.nama)}</span>` : ""}</b><div class="small muted">${rp(i.harga)}${i.qty > 1 ? ` × ${i.qty} = ${rp(i.harga * i.qty)}` : ""}${i.bonus ? ` · 🎁 gratis ${i.bonus}` : ""}</div></div>
        <div class="qty"><button data-k="-" data-sku="${esc(i.sku)}">−</button><span>${i.qty}</span><button data-k="+" data-sku="${esc(i.sku)}">+</button></div></div>`; }).join("") : '<div class="kosong">Keranjang kosong.</div>'}
      ${rincianTagihan(t)}
      <button class="btn primary" id="keBayar" ${t.items.length ? "" : "disabled"}>Bayar ${rp(t.sisa)}</button>`);
  };
  gambar();
  $("#lembar").onclick = (e) => {
    const b = e.target.closest("button[data-sku]");
    if (b) { tambah(b.dataset.sku, b.dataset.k === "+" ? 1 : -1); return A.keranjang.length ? gambar() : tutupLembar(); }
    if (e.target.id === "keBayar") layarBayar();
  };
}

function rincianTagihan(t) {
  return `<table class="rinci"><tr><td>Subtotal</td><td>${rp(t.subtotal)}</td></tr>
    ${t.diskon ? `<tr><td>${esc(t.promo_nama ?? t.promo ?? "Diskon")}</td><td>−${rp(t.diskon)}</td></tr>` : ""}
    ${(t.items ?? []).filter((i) => i.bonus).map((i) => `<tr><td class="small">🎁 Gratis ${esc(i.nama)} ×${i.bonus}</td><td></td></tr>`).join("")}
    ${t.pajak ? `<tr><td>PPN ${pengaturan().pajak?.persen ?? ""}%</td><td>${rp(t.pajak)}</td></tr>` : ""}
    ${t.pembulatan ? `<tr><td>Pembulatan</td><td>−${rp(t.pembulatan)}</td></tr>` : ""}
    <tr class="tebal"><td>Total</td><td>${rp(t.total)}</td></tr>
    ${t.sudah_dibayar ? `<tr><td>Sudah dibayar</td><td>−${rp(t.sudah_dibayar)}</td></tr><tr class="tebal"><td>Sisa tagihan</td><td>${rp(t.sisa)}</td></tr>` : ""}</table>`;
}

// ---------- Pembayaran ----------

// bagian: nominal pisah bayar (Daftar Order). Tanpa bagian = lunasi sisa tagihan.
function layarBayar(bagian) {
  const t = tagihan();
  if (!t.items.length) return;
  if (!modePresale()) for (const i of t.items) if (i.qty > (A.stok[i.sku] ?? 0)) return toast(`Stok ${i.nama} tinggal ${A.stok[i.sku] ?? 0}`);
  if (modePresale() && !A.ord?.pelanggan?.telp) { toast("Pre-sale wajib pelanggan dengan no HP"); return lembarPelanggan(); }
  const p = pengaturan();
  const tagih = bagian ?? t.sisa;
  const metode = ["tunai", "qris", "transfer"].filter((m) => p.metode?.[m] !== false);
  // tunai: uang diterima. ketik: isian "Nominal lain" (kosong kalau kasir memilih kotak nominal).
  let pilih = metode[0], tunai = 0, ketik = "", ref = "";
  const NAMA = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }, IKON = { tunai: "💵", qris: "🔳", transfer: "🏦" };
  const gambar = async () => {
    const qris = pilih === "qris" ? await kv.get("qris_gambar") : null;
    // Isian metode yang dipilih tampil tepat di bawah tombolnya, seperti prototipe.
    const panel = (m) => (m !== pilih ? "" : m === "tunai" ? `<div class="panel">
        <div class="panel-label">Nominal tunai diterima</div>
        <div class="cepat">${nominalCepat(tagih, p.nominal_cepat).map((n) => `<button data-n="${n}">${n === tagih ? `<small>Uang pas</small> ${rp(n)}` : rp(n)}</button>`).join("")}</div>
        <label for="uang">Nominal lain</label><input id="uang" type="number" inputmode="numeric" min="0" value="${esc(ketik)}" placeholder="Ketik jumlah uang">
        <div class="sisa-baris" id="kembalian"></div></div>`
      : m === "qris" ? `<div class="panel qris">
        ${qris ? `<img src="${URL.createObjectURL(qris.blob)}" alt="QRIS">` : '<span class="contoh"><img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27%3E%3Crect width=%27240%27 height=%27240%27 fill=%27%23eee%27/%3E%3C/svg%3E" alt=""></span><div class="err">Gambar QRIS belum diunggah. Minta Admin mengunggahnya di Dashboard › Pengaturan POS.</div>'}
        <div class="small" style="margin-top:6px"><b>${esc(p.qris?.nama ?? "")}</b>${p.qris?.nmid ? ` · NMID ${esc(p.qris.nmid)}` : ""}</div>
        <div class="nominal-besar">${rp(tagih)}</div><div class="small muted">Pembeli mengetik nominal ini sendiri di aplikasinya.</div>
        <label for="ref" style="text-align:left">4 digit terakhir no. referensi (dari notifikasi aplikasi merchant)</label>
        <input id="ref" inputmode="numeric" maxlength="4" value="${esc(ref)}" placeholder="0000"></div>`
      : `<div class="panel">
        ${(p.rekening ?? []).map((r) => `<div class="rek"><span><b>${esc(r.bank)} ${esc(r.no)}</b>a.n. ${esc(r.nama)}</span><button class="btn kecil" data-salin="${esc(r.no)}">Salin</button></div>`).join("") || '<div class="small muted">Rekening belum diisi di Dashboard › Pengaturan POS.</div>'}
        <div class="nominal-besar">${rp(tagih)}</div><div class="small muted center">Cek mutasi rekening sebelum menekan Dana Sudah Masuk.</div></div>`);
    tampil(`${bar(bagian ? "Pisah bayar" : "Pembayaran", `${esc(A.snap.lokasi.nama)} · ${esc(A.sesi.staff.nama)}`, '<button id="kembali">Kembali</button>')}
      <div class="wrap bayar-wrap">
        <div class="statbar"><div><small>Total tagihan</small><b>${rp(tagih)}</b></div><div class="sisa"><small>Sisa tagihan</small><b id="statSisa">${rp(tagih)}</b></div><div class="kemb"><small>Kembalian</small><b id="statKemb">Rp 0</b></div></div>
        <div class="nota"><span class="label">🧾 ${t.order ? esc(t.order.no) : "Order"}</span>${A.ord?.pelanggan ? ` <span class="small muted">Pelanggan: ${esc(A.ord.pelanggan.nama)}</span>` : ""}
          ${t.items.map((i) => `<div class="brs"><span>${esc(i.nama)} ×${i.qty}</span><b>${rp(i.harga * i.qty)}</b></div>`).join("")}</div>
        ${bagian ? `<div class="warn" style="margin:0 0 12px">Bayar sebagian: ${rp(bagian)}. Sisanya dilunasi nanti dari Daftar Order.</div>` : '<button class="aksi-bayar" id="pisah">↔️ Pisah Bayar</button>'}
        <div class="ringkas">${rincianTagihan(t)}</div>
        <h3>Metode pembayaran</h3>
        <div class="metode pm">${metode.map((m) => `<button data-m="${m}" class="${m === pilih ? "on" : ""}"><span class="ikon">${IKON[m]}</span>${NAMA[m]}<span class="cek">✓</span></button>${panel(m)}`).join("")}</div>
      </div>
      <div class="cta-bawah"><button class="btn primary" id="lunas">${pilih === "tunai" ? "Proses Bayar" : "Dana Sudah Masuk"}</button></div>`, "bayar");
    $("#kembali").onclick = () => { gambarKasir(); };
    if ($("#pisah")) $("#pisah").onclick = lembarPisahBayar;
    $$(".metode.pm > [data-m]").forEach((b) => (b.onclick = () => { if (pilih !== b.dataset.m) { pilih = b.dataset.m; gambar(); } }));
    const cta = $("#lunas");
    const uang = $("#uang");
    const cekTunai = () => {
      const kurang = tunai < tagih;
      $("#kembalian").className = "sisa-baris" + (kurang ? " kurang" : "");
      $("#kembalian").innerHTML = kurang ? `<span>Kurang bayar</span> <b>${rp(tagih - tunai)}</b>` : `<span>Kembalian</span> <b>${rp(tunai - tagih)}</b>`;
      $("#statSisa").textContent = rp(Math.max(0, tagih - tunai));
      $("#statKemb").textContent = rp(Math.max(0, tunai - tagih));
      $$(".cepat button").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) === tunai));
      cta.disabled = kurang;
      cta.textContent = kurang ? (tunai ? "Uang belum cukup" : "Pilih nominal tunai") : "Proses Bayar";
    };
    if (uang) {
      uang.oninput = () => { ketik = uang.value; tunai = Number(ketik || 0); cekTunai(); };
      $$(".cepat button").forEach((b) => (b.onclick = () => { ketik = ""; uang.value = ""; tunai = Number(b.dataset.n); cekTunai(); }));
      cekTunai();
    } else {
      $("#statSisa").textContent = "Rp 0";
    }
    const r = $("#ref");
    const cekRef = () => { cta.disabled = !/^\d{4}$/.test(ref); cta.textContent = cta.disabled ? "Isi 4 digit referensi" : "Dana Sudah Masuk"; };
    if (r) { r.oninput = () => { r.value = r.value.replace(/\D/g, "").slice(0, 4); ref = r.value; cekRef(); }; cekRef(); }
    $$("[data-salin]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.salin.replace(/\s/g, "")).then(() => toast("Nomor rekening disalin"))));
    cta.onclick = () => {
      const bayar = pilih === "tunai" ? { metode: "Tunai", jumlah: tunai } : pilih === "qris" ? { metode: "QRIS", jumlah: tagih, ref } : { metode: "Transfer", jumlah: tagih };
      if (bagian) return bayarSebagian(t, { ...bayar, jumlah: bagian, diterima: bayar.jumlah });
      selesaikan(t, bayar);
    };
  };
  gambar();
}

let sedangBayar = false;
async function selesaikan(t, bayarAkhir) {
  if (sedangBayar) return;
  sedangBayar = true;
  try {
    // Pembayaran sebagian dari Daftar Order ikut tercatat; kembalian hanya dari tunai terakhir.
    const pembayaran = [...(t.order?.bayar ?? []).map(({ metode, jumlah, ref }) => ({ metode, jumlah, ...(ref ? { ref } : {}) })), bayarAkhir];
    const dibayar = pembayaran.reduce((a, b) => a + b.jumlah, 0);
    const pel = A.ord?.pelanggan;
    const pre = modePresale();
    const trx = {
      id: ulid(), no: await nomorBaru(), shift_id: A.sesi.shift_id, lokasi_id: A.sesi.lokasi_id, kasir_id: A.sesi.staff.id, waktu: sekarang(),
      items: t.items.map(({ sku, nama, qty, harga, bonus }) => ({ sku, nama, qty, harga, bonus })),
      subtotal: t.subtotal, diskon: t.diskon, pajak: t.pajak, pembulatan: t.pembulatan, total: t.total,
      promo: t.promo_nama, promo_id: t.promo_id, ...(t.promo_id && t.promo_persen !== undefined ? { promo_persen: t.promo_persen } : {}),
      pembayaran, pelanggan_id: pel?.id ?? null, pelanggan_nama: pel?.nama ?? null, pelanggan_telp: pel?.telp ?? null,
      no_pesanan: t.order?.no ?? null, presale: pre, offline: !S.online,
    };
    await antrekan("trx", trx);
    const metodes = [...new Set(pembayaran.map((b) => b.metode))];
    const lokal = { ...trx, kasir_nama: A.sesi.staff.nama, lokasi_nama: A.snap.lokasi.nama, event: A.snap.lokasi.event ?? null, dibayar, kembalian: dibayar - t.total,
      metode: metodes.length > 1 ? "Campuran" : metodes[0], status: "Lunas", ambil: pre ? "Menunggu" : null, retur: [], terkirim: false };
    await tx("trx", "readwrite", (s) => s.put(lokal));
    if (t.order) await hapusOrder(t.order.id);
    kosongkanKeranjang();
    A.stok = await stokTersedia(A.snap);
    layarSukses(lokal);
  } finally {
    sedangBayar = false;
  }
}

// ---------- Struk ----------

const isiQr = (t) => `HKPS|${t.id}|${t.no}`;
function svgQr(teks, sel = 4) {
  const q = qrcode(0, "M");
  q.addData(teks);
  q.make();
  return q.createSvgTag(sel, 8);
}
const catatanPresale = (t) => {
  const e = t.event;
  const mulai = e?.mulai ? new Date(e.mulai + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `PRE-SALE · barang diambil di booth ${e?.nama ?? t.lokasi_nama}${mulai ? " mulai " + mulai : ""}. Tunjukkan QR ini. Ukuran tidak bisa ditukar.`;
};

function htmlStruk(t) {
  const st = pengaturan().struk ?? {};
  return `<div class="struk">
    <div class="tengah"><b>${esc(st.nama)}</b>${st.info ? `<div>${esc(st.info)}</div>` : ""}${st.tampil_event ? `<div>${esc(t.lokasi_nama)}</div>` : ""}</div>
    <table class="rinci" style="margin-top:8px"><tr><td>No. transaksi</td><td>${esc(t.no)}</td></tr><tr><td>Waktu</td><td>${tglJam(t.waktu)}</td></tr>${st.tampil_kasir ? `<tr><td>Kasir</td><td>${esc(t.kasir_nama)}</td></tr>` : ""}
      ${t.pelanggan_nama ? `<tr><td>Pembeli</td><td>${esc(t.pelanggan_nama)}</td></tr>` : ""}${t.status !== "Lunas" ? `<tr><td>Status</td><td><b>${esc(t.status)}</b></td></tr>` : ""}</table><hr>
    <table class="rinci">${t.items.map((i) => `<tr><td>${esc(i.nama)} ×${i.qty}</td><td>${rp(i.qty * i.harga)}</td></tr>`).join("")}</table><hr>
    ${rincianTagihan(t)}<hr>
    <table class="rinci">${t.pembayaran.map((b) => `<tr><td>${esc(b.metode)}${b.ref ? ` (ref ${esc(b.ref)})` : ""}</td><td>${rp(b.jumlah)}</td></tr>`).join("")}${t.kembalian ? `<tr><td>Kembalian</td><td>${rp(t.kembalian)}</td></tr>` : ""}</table>
    ${t.presale ? `<hr><div class="tengah"><b>PRE-SALE · QR PENGAMBILAN</b><div class="qr-struk">${svgQr(isiQr(t))}</div><div class="small">${esc(catatanPresale(t))}</div></div>` : ""}
    ${st.footer ? `<hr><div class="tengah">${esc(st.footer)}</div>` : ""}</div>`;
}

const pdfStruk = (t) => strukPdf({ ...t, qr: t.presale ? isiQr(t) : null, catatan_presale: t.presale ? catatanPresale(t) : null }, { nama: t.lokasi_nama }, pengaturan().struk ?? {});
const waNorm = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d.length >= 10 ? d : ""; };

// Belum ada layanan WhatsApp API: PDF dibagikan lewat menu share HP, atau diunduh lalu chat WA pembeli dibuka.
async function bagikanStruk(t, nomor) {
  const wa = waNorm(nomor);
  const blob = pdfStruk(t).output("blob");
  const file = new File([blob], `Struk-${t.no}.pdf`, { type: "application/pdf" });
  const pesan = `Struk ${pengaturan().struk?.nama ?? "Hikayat"} ${t.no}${t.presale ? ". Tunjukkan QR di PDF saat mengambil barang." : ""}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: pesan }); } catch {}
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(pesan)}`, "_blank");
  toast(wa ? "PDF diunduh. Lampirkan di chat WA yang terbuka" : "PDF diunduh");
}

function layarSukses(t) {
  tampil(`<div class="sukses">
      <div class="cincin"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6100" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg></div>
      <h1>Transaksi Berhasil</h1>
      <div class="sub"><b>Lunas ${rp(t.total)}</b>${t.kembalian ? `<br>Kembalian ${rp(t.kembalian)}` : ""}<br>Pesanan sudah tercatat. Struk siap dibagikan ke pelanggan.</div>
      ${t.offline ? '<div class="warn">Tersimpan di HP. Dikirim ke server saat ada sinyal.</div>' : ""}
      ${t.presale ? '<div class="warn">Pre-sale: kirim struk PDF berisi QR ke WhatsApp pembeli. QR ini dipakai saat mengambil barang.</div>' : ""}
      ${htmlStruk(t)}
      <div class="wabox"><div class="lbl">Kirim struk PDF ke WhatsApp</div>
        <div class="brs"><input id="wa" inputmode="tel" placeholder="08xx atau +62" value="${esc(t.pelanggan_telp ?? "")}"><button class="btn primary" id="kirimWa">Kirim</button></div></div>
      <button class="btn" id="unduh">📄 Unduh PDF</button>
      <button class="btn primary" id="baru">Transaksi baru</button>
    </div>`, "sukses");
  $("#kirimWa").onclick = () => bagikanStruk(t, $("#wa").value);
  $("#unduh").onclick = () => pdfStruk(t).save(`Struk-${t.no}.pdf`);
  $("#baru").onclick = () => gambarKasir();
}

// ---------- Menu ----------

function lembarMenu() {
  const owner = A.sesi.staff.role.includes("owner"), ev = A.snap.lokasi.jenis === "event";
  const item = (m, ikon, judul, ket, kelas = "") => `<button data-m="${m}" class="${kelas}"><span class="ikon">${ikon}</span><span><b>${judul}</b><small>${ket}</small></span></button>`;
  bukaLembar(`<h2>${esc(A.snap.lokasi.nama)}</h2><div class="sub">${esc(A.sesi.staff.nama)}${A.sesi.shift?.buka ? " · kasir dibuka " + jam(A.sesi.shift.buka) : ""}</div><div class="menu-daftar">
    ${item("kasir", "👤", "Kasir", "Halaman aktif saat ini", "aktif")}
    ${item("riwayat", "🧾", "Penjualan", "Transaksi shift ini, kirim ulang struk, void, retur")}
    ${item("pesanan", "🛍️", ev ? "Pesanan pre-sale" : "Ambil di kantor (pre-sale)", "Serahkan barang pre-sale dengan scan QR")}
    ${item("laporan", "📊", "Laporan", "Laporan kasir, kas, dan produk terjual")}
    ${item("kas", "💵", "Kas kasir", "Catat uang masuk dan keluar laci")}
    ${ev ? item("inventori", "📦", "Inventori", "Terima kiriman stok dan stok opname") : ""}
    ${item("sinkron", "🔄", "Status sinkron", "Data yang belum terkirim ke server")}
    ${item("riwayatmasuk", "🔐", "Riwayat masuk", "Siapa masuk ke POS, kapan, dan di HP mana")}
    ${item("pengaturan", "⚙️", "Pengaturan", "Info HP dan preferensi aplikasi")}
    ${owner ? item("tempat", "🏬", "Ganti tempat jualan", "Pindah ke event atau gudang lain") : ""}
    ${owner && ev ? item("tutupevent", "🏁", "Tutup event", "Tutup semua kasir dan kembalikan sisa stok ke gudang") : ""}
    ${item("pin", "🔑", "Ganti PIN", "Ubah PIN 6 angka Anda")}
    ${item("tutup", "🧮", "Tutup kasir", "Hitung uang laci dan setor")}
    ${item("keluar", "🚪", "Keluar kasir", "Laci tetap terbuka untuk dilanjutkan")}
  </div>`);
  $("#lembar").onclick = (e) => {
    const m = e.target.closest("[data-m]")?.dataset.m;
    if (!m) return;
    tutupLembar();
    ({
      kasir: () => {}, riwayat: layarRiwayat, pesanan: () => layarPesanan(gambarKasir), kas: layarKas, inventori: () => layarInventori(), sinkron: layarSinkron,
      laporan: () => layarLaporanPos(), riwayatmasuk: () => layarRiwayatMasuk(), pengaturan: layarPengaturanPos, tutupevent: () => layarTutupEventPos(),
      pin: () => (S.online ? gantiPin(false) : toast("Ganti PIN butuh sinyal")),
      tutup: layarTutupKasir, keluar: () => keluar(),
      tempat: async () => {
        if (A.keranjang.length) return toast("Kosongkan keranjang dulu");
        A.sesi.lokasi_id = null; A.sesi.shift_id = null; await simpanSesi();
        try { A.umum = await tarikUmum(); } catch {}
        layarTempat();
      },
    })[m]();
  };
}

// Riwayat: transaksi yang tersimpan di HP ini + yang sudah diterima server (dari HP lain yang bergabung di laci yang sama).
async function transaksiShift() {
  const lokal = await tx("trx", "readonly", (s) => s.index("shift").getAll(A.sesi.shift_id));
  const per = new Map(lokal.map((t) => [t.id, t]));
  if (S.online && A.sesi.sesi) {
    try {
      for (const t of (await api("GET", `/api/pos/penjualan?shift=${A.sesi.shift_id}`)).trx) {
        const l = per.get(t.id);
        // Data server lebih baru untuk status dan retur, kecuali ada perubahan di HP yang belum terkirim.
        if (!l) per.set(t.id, { ...t, kasir_nama: t.kasir, lokasi_nama: A.snap.lokasi.nama, event: A.snap.lokasi.event ?? null, terkirim: true, dariServer: true });
        else if (!l.ubahLokal) per.set(t.id, { ...l, status: t.status, retur: t.retur, ambil: t.ambil, terkirim: true });
      }
    } catch {}
  }
  return [...per.values()].sort((a, b) => b.waktu.localeCompare(a.waktu));
}

async function layarRiwayat() {
  tampil(`${bar("Penjualan shift ini", esc(A.snap.lokasi.nama), '<button id="cariTrx">Cari struk</button><button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Memuat…</p></div>`, "riwayat");
  $("#kembali").onclick = gambarKasir;
  $("#cariTrx").onclick = lembarCariTrx;
  const daftar = await transaksiShift();
  const total = daftar.filter((t) => t.status === "Lunas").reduce((a, t) => a + t.total, 0);
  $("#app .wrap").innerHTML = `<div class="card"><b>${daftar.length} transaksi · ${rp(total)}</b></div><div class="daftar">${daftar.map((t) => `<button data-id="${t.id}">
    <span class="isi"><b>${esc(t.no)}</b>${t.status !== "Lunas" ? ` <span class="tag off">${esc(t.status)}</span>` : ""}${t.presale ? ' <span class="tag warn">pre-sale</span>' : ""}<br><span class="small muted">${jam(t.waktu)} · ${esc(t.kasir_nama)} · ${esc(t.metode)}</span></span>
    <span><b>${rp(t.total)}</b><br>${t.ditolak ? '<span class="tag off">Ditolak server</span>' : t.terkirim ? '<span class="tag ok">Terkirim</span>' : '<span class="tag warn">Belum terkirim</span>'}</span></button>`).join("") || '<p class="muted">Belum ada transaksi.</p>'}</div>`;
  $$(".daftar button").forEach((b) => (b.onclick = () => lembarDetailTrx(daftar.find((x) => x.id === b.dataset.id))));
}

function lembarDetailTrx(t) {
  const sisaRetur = sisaBisaRetur(t);
  const bisaVoid = t.status === "Lunas" && !(t.retur ?? []).length && t.shift_id === A.sesi.shift_id;
  const bisaRetur = t.status === "Lunas" && sisaRetur.some((x) => x.maks > 0) && (!t.presale || t.ambil === "Diambil");
  bukaLembar(`${htmlStruk(t)}${t.ditolak ? `<div class="err">Ditolak server: ${esc(t.ditolak)}</div>` : ""}
    ${(t.retur ?? []).map((r) => `<div class="warn small">Retur ${esc(r.no ?? "")}: ${esc(r.cara)}${r.nilai ? " " + rp(r.nilai) : ""} · disetujui ${esc(r.disetujui ?? r.disetujui_nama ?? "")}</div>`).join("")}
    <button class="btn" id="kirimUlang">Kirim struk dari WhatsApp HP ini</button><button class="btn" id="unduhUlang">Unduh PDF</button>
    ${bisaRetur ? '<button class="btn" id="retur">Retur barang cacat</button>' : ""}
    ${bisaVoid ? '<button class="btn danger" id="void">Void transaksi</button>' : ""}`);
  $("#kirimUlang").onclick = () => bagikanStruk(t, t.pelanggan_telp);
  $("#unduhUlang").onclick = () => pdfStruk(t).save(`Struk-${t.no}.pdf`);
  if ($("#void")) $("#void").onclick = () => lembarVoid(t);
  if ($("#retur")) $("#retur").onclick = () => layarRetur(t);
}

// Kas masuk/keluar laci. Kas keluar nanti otomatis menjadi biaya event (tahap 7).
async function layarKas() {
  const kasLokal = (await kv.get("kas:" + A.sesi.shift_id)) ?? [];
  tampil(`${bar("Kas kasir", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}
    <div class="wrap">
      <form class="card" id="fKas">
        <h2>Catat uang masuk/keluar</h2>
        <div class="metode"><button type="button" data-j="masuk" class="on">Masuk</button><button type="button" data-j="keluar">Keluar</button></div>
        <label>Jumlah</label><input name="jumlah" type="number" inputmode="numeric" min="1" required>
        <label>Catatan</label><input name="catatan" placeholder="Misalnya: beli air minum" required maxlength="200">
        <button class="btn primary">Simpan</button>
      </form>
      <div id="ringkasKas"></div>
      <h2 style="margin-top:16px">Dicatat dari HP ini</h2>
      <div class="daftar">${kasLokal.map((k) => `<div class="card small"><b>${k.jenis === "masuk" ? "+" : "−"}${rp(k.jumlah)}</b> · ${esc(k.catatan)} <span class="muted">${jam(k.waktu)}</span></div>`).join("") || '<p class="muted">Belum ada.</p>'}</div>
    </div>`, "kas");
  $("#kembali").onclick = gambarKasir;
  // Uang di laci menurut HP ini (dipakai kalau tanpa sinyal); kas keluar tidak boleh melebihinya.
  const trxLokal = (await tx("trx", "readonly", (s) => s.index("shift").getAll(A.sesi.shift_id))).filter((t) => t.status === "Lunas");
  let laci = (A.sesi.shift?.modal ?? 0) + trxLokal.flatMap((t) => t.pembayaran).filter((b) => b.metode === "Tunai").reduce((a, b) => a + b.jumlah, 0)
    - trxLokal.reduce((a, t) => a + (t.kembalian ?? 0), 0) + kasLokal.reduce((a, k) => a + (k.jenis === "masuk" ? k.jumlah : -k.jumlah), 0) - ((await kv.get("rtunai:" + A.sesi.shift_id)) ?? 0);
  // Ringkasan laci dari server (semua HP yang memakai laci ini).
  if (S.online && A.sesi.sesi) api("GET", `/api/pos/shift/${A.sesi.shift_id}`).then(({ ringkasan: r }) => {
    if (A.layar !== "kas") return;
    laci = r.seharusnya;
    const modal = A.sesi.shift?.modal ?? 0;
    $("#ringkasKas").innerHTML = `<div class="card" style="margin-top:10px"><table class="rinci">
      <tr><td>Pemasukan (modal + kas masuk)</td><td>${rp(modal + r.kas_masuk)}</td></tr><tr><td>Pengeluaran</td><td>${rp(r.kas_keluar + (r.retur_tunai ?? 0))}</td></tr>
      <tr><td>Void (${r.void_n})</td><td>${rp(r.void_total)}</td></tr><tr class="tebal"><td>Uang di laci</td><td>${rp(r.seharusnya)}</td></tr>
      <tr><td>Penjualan tunai</td><td>${rp(r.tunai)}</td></tr><tr><td>Penjualan QRIS</td><td>${rp(r.qris)}</td></tr><tr><td>Penjualan transfer</td><td>${rp(r.transfer)}</td></tr></table></div>`;
  }).catch(() => {});
  let jenis = "masuk";
  $$("#fKas .metode button").forEach((b) => (b.onclick = () => { jenis = b.dataset.j; $$("#fKas .metode button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#fKas").jumlah.oninput = (e) => {
    if (jenis === "keluar" && Number(e.target.value) > Math.max(0, laci)) { e.target.value = Math.max(0, laci); toast(`Maksimal ${rp(Math.max(0, laci))} (uang di laci)`); }
  };
  $("#fKas").onsubmit = async (e) => {
    e.preventDefault();
    if (jenis === "keluar" && Number(e.target.jumlah.value) > laci) return toast(`Uang di laci hanya ${rp(Math.max(0, laci))}`);
    const k = { id: ulid(), shift_id: A.sesi.shift_id, jenis, jumlah: Number(e.target.jumlah.value), catatan: e.target.catatan.value.trim(), waktu: sekarang(), oleh: A.sesi.staff.id };
    await antrekan("kas", k);
    await kv.set("kas:" + A.sesi.shift_id, [...kasLokal, k]);
    toast("Tersimpan");
    layarKas();
  };
}

async function layarSinkron() {
  const antre = await isiAntrean();
  const ditolak = (await kv.get("ditolak")) ?? [];
  tampil(`${bar("Status sinkron", `HP ${esc(S.perangkat.kode)} · ${statusSinyal()}`, '<button id="kembali">Kembali</button>')}
    <div class="wrap">
      <div class="card"><b>${antre.length} dokumen belum terkirim</b><div class="small muted">${antre.map((d) => d.jenis).join(", ") || "Semua sudah terkirim."}</div>
        <button class="btn primary" id="kirim">Kirim sekarang</button></div>
      ${ditolak.length ? `<h2 style="margin-top:16px">Ditolak server</h2><p class="small muted">Data ini tersimpan di server untuk diperiksa Admin di Dashboard › Penjualan.</p>
        ${ditolak.slice().reverse().map((d) => `<div class="card small" style="margin-top:8px"><b>${esc(d.jenis)} ${esc(d.data.no ?? "")}</b><br>${esc(d.alasan)}</div>`).join("")}` : ""}
    </div>`, "sinkron");
  $("#kembali").onclick = gambarKasir;
  $("#kirim").onclick = async () => { await sinkronSekarang(); layarSinkron(); };
}

// ---------- Inventori di POS: terima kiriman, stok opname ----------

async function dataInventori() {
  const kunci = "inv:" + A.sesi.lokasi_id;
  let inv = await kv.get(kunci);
  if (S.online && A.sesi.sesi) {
    try { inv = await api("GET", `/api/pos/inventori?lokasi=${A.sesi.lokasi_id}`); await kv.set(kunci, inv); } catch {}
  }
  inv ??= { mutasi: [], opname: [] };
  // Kiriman yang sudah diterima di HP tapi belum terkirim ke server.
  const antre = await isiAntrean();
  for (const d of antre.filter((d) => d.jenis === "terima")) {
    const m = inv.mutasi.find((x) => x.id === d.data.id);
    if (m && m.status === "Dikirim") { m.status = "Diterima"; m.lokal = true; m.items.forEach((i) => (i.diterima = d.data.items.find((x) => x.sku === i.sku)?.diterima ?? i.dikirim)); }
  }
  inv.opname_lokal = antre.filter((d) => d.jenis === "opname").map((d) => d.data);
  return inv;
}

async function layarInventori(tab = "kiriman") {
  tampil(`${bar("Inventori", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Memuat…</p></div>`, "inventori");
  $("#kembali").onclick = gambarKasir;
  const inv = await dataInventori();
  const menunggu = inv.mutasi.filter((m) => m.status === "Dikirim"), sudah = inv.mutasi.filter((m) => m.status === "Diterima");
  const tgl = (iso) => (iso ? tglJam(iso) : "");
  const kartuMutasi = (m) => `<button data-mutasi="${m.id}" ${m.status === "Dikirim" ? "" : "disabled"}><span class="isi"><b>${esc(m.no)}</b>
    <br><span class="small muted">Dikirim ${esc(m.dikirim_oleh ?? "")} · ${tgl(m.dikirim_pada)} · ${m.items.reduce((a, i) => a + i.dikirim, 0)} pcs</span>
    ${m.status === "Diterima" ? `<br><span class="small">${m.lokal ? "Diterima di HP, menunggu terkirim" : `Diterima ${esc(m.diterima_oleh ?? "")} · ${tgl(m.diterima_pada)}`}${m.items.some((i) => i.diterima < i.dikirim) ? ` · <span class="tag off">kurang ${m.items.reduce((a, i) => a + i.dikirim - i.diterima, 0)}</span>` : ""}</span>` : ""}</span></button>
    ${m.status === "Diterima" && !m.lokal ? `<button class="btn kecil" style="align-self:flex-end;margin-top:-4px" data-batalterima="${m.id}">Batalkan penerimaan</button>` : ""}`;
  const STATUS = { "Menunggu persetujuan": "warn", "Perlu opname ulang": "off", Disetujui: "ok", Diganti: "" };
  $("#app .wrap").innerHTML = `
    <div class="metode"><button data-tab="kiriman" class="${tab === "kiriman" ? "on" : ""}">Terima kiriman</button><button data-tab="opname" class="${tab === "opname" ? "on" : ""}">Stok opname</button></div>
    ${tab === "kiriman" ? `
      <h2>Menunggu diterima</h2><div class="daftar">${menunggu.map(kartuMutasi).join("") || '<p class="muted">Tidak ada kiriman.</p>'}</div>
      <h2 style="margin-top:16px">Sudah diterima</h2><div class="daftar">${sudah.map(kartuMutasi).join("") || '<p class="muted">Belum ada.</p>'}</div>
      <p class="small muted">Kiriman dibuat Admin atau Owner dari dashboard (Event › Kirim Stok).</p>`
    : `
      ${inv.opname_lokal.length ? '<div class="warn">Hasil opname tersimpan di HP, menunggu terkirim.</div>' : ""}
      ${inv.opname.filter((o) => o.status !== "Diganti").slice(0, 5).map((o) => `<div class="card small" style="margin-top:8px"><b>${esc(o.no)}</b> <span class="tag ${STATUS[o.status]}">${esc(o.status)}</span>
        <br>Dihitung ${esc(o.dihitung_oleh)} · ${tgl(o.dihitung_pada)}${o.disetujui_oleh ? ` · disetujui ${esc(o.disetujui_oleh)}` : ""}
        ${o.status === "Perlu opname ulang" ? `<div class="err">Diminta hitung ulang: ${esc(o.ulang_alasan)}</div>` : ""}
        ${o.status === "Menunggu persetujuan" && (A.sesi.staff.role.includes("owner") || A.sesi.staff.role.includes("admin")) ? `<button class="btn kecil" style="margin-top:8px" data-periksa="${o.id}">Periksa dan setujui</button>` : ""}</div>`).join("")}
      <button class="btn primary" id="hitung">Hitung stok sekarang</button>`}`;
  $$("[data-tab]").forEach((b) => (b.onclick = () => layarInventori(b.dataset.tab)));
  $$("[data-mutasi]").forEach((b) => (b.onclick = () => layarTerima(inv.mutasi.find((m) => m.id === b.dataset.mutasi))));
  if ($("#hitung")) $("#hitung").onclick = layarOpname;
  $$("[data-batalterima]").forEach((b) => (b.onclick = () => batalTerima(inv.mutasi.find((m) => m.id === b.dataset.batalterima))));
  $$("[data-periksa]").forEach((b) => (b.onclick = () => layarSetujuiOpname(b.dataset.periksa)));
}

function layarTerima(m) {
  tampil(`${bar("Terima " + esc(m.no), esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}
    <div class="wrap"><form class="card" id="fTerima">
      <p class="muted small">Jumlah diterima sudah terisi sesuai yang dikirim. Ubah kalau ada yang kurang.</p>
      ${m.items.map((i) => `<div class="baris"><div class="isi"><b>${esc(i.nama)}</b><div class="small muted">Dikirim ${i.dikirim}</div></div>
        <input type="number" inputmode="numeric" min="0" max="${i.dikirim}" data-sku="${esc(i.sku)}" value="${i.dikirim}" style="width:90px"></div>`).join("")}
      <div id="kurangT"></div>
      <label>Catatan</label><textarea name="catatan" placeholder="Wajib diisi kalau ada barang kurang"></textarea>
      <div class="err" hidden></div>
      <button class="btn primary">Terima barang</button>
    </form></div>`, "terima");
  $("#kembali").onclick = () => layarInventori();
  const f = $("#fTerima");
  const hitung = () => {
    let kurang = 0;
    $$("[data-sku]", f).forEach((el) => {
      const maks = Number(el.max);
      if (Number(el.value) > maks) { el.value = maks; toast(`Maksimal ${maks}`); }
      kurang += maks - Number(el.value || 0);
    });
    $("#kurangT").innerHTML = kurang ? `<div class="err">Kurang ${kurang} pcs. Dicatat hilang di perjalanan.</div>` : '<div class="ok">Semua barang lengkap</div>';
    return kurang;
  };
  f.oninput = hitung;
  hitung();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const kurang = hitung();
    if (kurang && f.catatan.value.trim().length < 3) { $(".err", f).textContent = "Ada barang kurang: tulis catatan"; $(".err", f).hidden = false; return; }
    await antrekan("terima", { id: m.id, lokasi_id: A.sesi.lokasi_id, oleh: A.sesi.staff.id, waktu: sekarang(), catatan: f.catatan.value.trim() || null,
      items: $$("[data-sku]", f).map((el) => ({ sku: el.dataset.sku, diterima: Number(el.value || 0) })) });
    A.snap.kiriman_menunggu = Math.max(0, (A.snap.kiriman_menunggu ?? 1) - 1);
    await kv.set("snap:" + A.sesi.lokasi_id, A.snap);
    A.stok = await stokTersedia(A.snap);
    toast("Barang diterima. Stok event bertambah");
    layarInventori();
  };
}

function layarOpname() {
  const daftar = Object.values(A.snap.varian).filter((v) => A.snap.produk[v.produk_id]?.aktif && (v.aktif || (A.stok[v.sku] ?? 0) !== 0))
    .sort((a, b) => namaBarang(a).localeCompare(namaBarang(b)));
  tampil(`${bar("Stok opname", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}
    <div class="wrap"><form class="card" id="fOpname">
      <p class="muted small">Hitung barang di booth. Kosong berarti sama dengan sistem. Stok belum berubah sampai disetujui Owner atau Admin.</p>
      ${daftar.map((v) => `<div class="baris"><div class="isi"><b>${esc(namaBarang(v))}</b><div class="small muted">Sistem ${A.stok[v.sku] ?? 0} · <span data-sel="${esc(v.sku)}"></span></div></div>
        <input type="number" inputmode="numeric" min="0" data-sku="${esc(v.sku)}" placeholder="${A.stok[v.sku] ?? 0}" style="width:90px"></div>`).join("")}
      <div id="ringkasO"></div>
      <label>Catatan</label><textarea name="catatan"></textarea>
      <button class="btn primary">Kirim hasil opname</button>
    </form></div>`, "opname");
  $("#kembali").onclick = () => layarInventori("opname");
  const f = $("#fOpname");
  const baris = () => $$("[data-sku]", f).map((el) => { const sistem = A.stok[el.dataset.sku] ?? 0; return { sku: el.dataset.sku, sistem, fisik: el.value === "" ? Math.max(0, sistem) : Number(el.value) }; });
  f.oninput = () => {
    let kurang = 0, lebih = 0;
    for (const b of baris()) {
      const d = b.fisik - b.sistem;
      $(`[data-sel="${CSS.escape(b.sku)}"]`).textContent = d === 0 ? "" : d < 0 ? `kurang ${-d}` : `lebih ${d}`;
      if (d < 0) kurang -= d; else lebih += d;
    }
    $("#ringkasO").innerHTML = kurang || lebih ? `<div class="warn">Kurang ${kurang} · lebih ${lebih}</div>` : "";
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    await antrekan("opname", { id: ulid(), lokasi_id: A.sesi.lokasi_id, oleh: A.sesi.staff.id, waktu: sekarang(), catatan: f.catatan.value.trim() || null, items: baris() });
    toast("Hasil opname dikirim. Menunggu persetujuan");
    layarInventori("opname");
  };
}

// ---------- Tutup kasir ----------

// lain: laci kasir lain yang ditutup Owner dari HP ({ id, kasir_id, kasir, modal, kembali }). Butuh sinyal.
async function layarTutupKasir(lain) {
  const sid = lain?.id ?? A.sesi.shift_id;
  const modal = lain ? lain.modal : A.sesi.shift?.modal;
  tampil(`${bar(lain ? "Tutup kasir " + esc(lain.kasir) : "Tutup kasir", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Mengirim data dan menghitung…</p></div>`, "tutup");
  $("#kembali").onclick = lain ? lain.kembali : gambarKasir;
  const belum = lain ? [] : A.orderDaftar.filter((o) => o.bayar.length);
  if (belum.length) {
    $("#app .wrap").innerHTML = `<div class="err">Masih ada pesanan di Daftar Order yang sudah dibayar sebagian: ${belum.map((o) => esc(o.no)).join(", ")}. Lunasi dulu sebelum menutup kasir.</div>`;
    return;
  }
  await sinkronSekarang();
  const sisa = (await isiAntrean()).length;
  let r = null;
  if (S.online && A.sesi.sesi && !sisa) {
    try { r = (await api("GET", `/api/pos/shift/${sid}`)).ringkasan; } catch {}
  }
  if (!r && lain) { $("#app .wrap").innerHTML = '<div class="err">Menutup laci kasir lain butuh sinyal dan semua data HP ini sudah terkirim.</div>'; return; }
  // Tanpa sinyal: hitung dari data di HP ini saja (laci yang dipakai beberapa HP bisa belum lengkap).
  if (!r) {
    const trx = (await tx("trx", "readonly", (s) => s.index("shift").getAll(sid))).filter((t) => t.status === "Lunas");
    const kas = (await kv.get("kas:" + sid)) ?? [];
    const per = (m) => trx.flatMap((t) => t.pembayaran).filter((b) => b.metode === m).reduce((a, b) => a + b.jumlah, 0);
    const tunai = per("Tunai") - trx.reduce((a, t) => a + (t.kembalian ?? 0), 0);
    const km = kas.filter((k) => k.jenis === "masuk").reduce((a, k) => a + k.jumlah, 0), kk = kas.filter((k) => k.jenis === "keluar").reduce((a, k) => a + k.jumlah, 0);
    const rt = (await kv.get("rtunai:" + sid)) ?? 0;
    r = { transaksi: trx.length, total: trx.reduce((a, t) => a + t.total, 0), tunai, qris: per("QRIS"), transfer: per("Transfer"), kas_masuk: km, kas_keluar: kk, retur_tunai: rt,
      seharusnya: (modal ?? 0) + tunai + km - kk - rt, lokal: true };
  }
  const karyawan = (await kv.get("karyawan")) ?? [];
  const pemilik = lain?.kasir_id ?? A.sesi.shift?.kasir_id ?? A.sesi.staff.id;
  $("#app .wrap").innerHTML = `
    ${r.lokal ? `<div class="warn">${sisa ? `${sisa} dokumen belum terkirim. ` : ""}Angka dihitung dari data di HP ini saja.</div>` : ""}
    <div class="card"><table class="rinci">
      <tr><td>Transaksi</td><td>${r.transaksi}</td></tr><tr><td>Penjualan</td><td>${rp(r.total)}</td></tr>
      <tr><td>Tunai</td><td>${rp(r.tunai)}</td></tr><tr><td>QRIS</td><td>${rp(r.qris)}</td></tr><tr><td>Transfer</td><td>${rp(r.transfer)}</td></tr>
    </table></div>
    <div class="card" style="margin-top:10px"><h2>Uang di laci</h2><table class="rinci">
      <tr><td>Modal awal</td><td>${rp(modal ?? r.seharusnya - r.tunai - r.kas_masuk + r.kas_keluar + (r.retur_tunai ?? 0))}</td></tr>
      <tr><td>+ Penjualan tunai</td><td>${rp(r.tunai)}</td></tr><tr><td>+ Kas masuk</td><td>${rp(r.kas_masuk)}</td></tr><tr><td>− Kas keluar</td><td>${rp(r.kas_keluar)}</td></tr>${r.retur_tunai ? `<tr><td>− Uang kembali retur</td><td>${rp(r.retur_tunai)}</td></tr>` : ""}
      <tr class="tebal"><td>Seharusnya</td><td>${rp(r.seharusnya)}</td></tr></table>
      <form id="fTutup">
        <label>Uang dihitung</label><input name="hitung" type="number" inputmode="numeric" min="0" required>
        <div id="selisih"></div>
        <div id="kurang" hidden>
          <label>Penanggung jawab</label><select name="pj">${karyawan.map((k) => `<option value="${k.id}" ${k.id === pemilik ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
          <label>Penjelasan</label><textarea name="penjelasan" placeholder="Kenapa uang kurang?"></textarea>
        </div>
        <label>Catatan (opsional)</label><input name="catatan">
        <label>Disetujui dengan PIN</label><select name="setuju">${karyawan.filter((k) => k.id === A.sesi.staff.id || k.id === pemilik || k.role.includes("owner") || k.role.includes("admin"))
          .map((k) => `<option value="${k.id}" ${k.id === A.sesi.staff.id ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
        <div class="err" hidden></div>
        <button class="btn primary">Lanjut ke PIN</button>
      </form></div>`;
  const f = $("#fTutup");
  f.hitung.oninput = () => {
    const s = Number(f.hitung.value || 0) - r.seharusnya;
    $("#selisih").innerHTML = f.hitung.value === "" ? "" : s === 0 ? '<div class="ok">Kas pas</div>' : s < 0 ? `<div class="err">Kurang ${rp(-s)}</div>` : `<div class="warn">Lebih ${rp(s)}</div>`;
    $("#kurang").hidden = !(s < 0);
  };
  f.onsubmit = (e) => {
    e.preventDefault();
    const hitung = Number(f.hitung.value || 0), s = hitung - r.seharusnya;
    if (s < 0 && (f.penjelasan.value.trim().length < 5)) { $(".err", f).textContent = "Uang kurang: isi penjelasan"; $(".err", f).hidden = false; return; }
    const setuju = karyawan.find((k) => k.id === f.setuju.value);
    const data = { id: sid, tutup: sekarang(), kas_hitung: hitung, seharusnya: r.seharusnya, catatan: f.catatan.value.trim() || null,
      ditutup_oleh: A.sesi.staff.id, disetujui_oleh: setuju.id, pj_id: s < 0 ? f.pj.value : null, penjelasan: s < 0 ? f.penjelasan.value.trim() : null };
    mintaPin({
      judul: "Tutup kasir", info: `PIN ${setuju.nama}`, av: inisial(setuju.nama), batal: () => layarTutupKasir(lain),
      selesai: async (pin) => {
        try {
          const ok = await api("POST", "/api/pos/setujui", { staff_id: setuju.id, pin, aksi: "tutup_kasir" });
          data.persetujuan = ok.token;
        } catch (x) {
          if (!putus(x)) throw x;
          const cocok = await cekPinLokal(setuju.id, pin);
          if (!cocok) { await catatLog(setuju.id, "PIN salah", "tutup kasir"); throw new Error(cocok === null ? "PIN orang ini belum tersimpan di HP. Butuh sinyal" : "PIN salah"); }
          data.offline = true;
        }
        await antrekan("shift_tutup", data);
        if (lain) { await sinkronSekarang(); toast(`Kasir ${lain.kasir} ditutup`); return lain.kembali(); }
        await catatLog(A.sesi.staff.id, "Tutup kasir", A.snap.lokasi.nama);
        A.sesi.lokasi_id = null; A.sesi.shift_id = null; A.sesi.shift = null; A.keranjang = [];
        await simpanSesi();
        if (A.sesi.staff.role.includes("owner")) { try { A.umum = await tarikUmum(); } catch {} toast("Kasir ditutup"); return layarTempat(); }
        keluar("Kasir ditutup. Terima kasih!");
      },
    });
  };
}

// ---------- Kunci layar ----------

let terakhirSentuh = Date.now();
["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => (terakhirSentuh = Date.now()), { passive: true }));
setInterval(() => {
  const menit = pengaturan().kunci_menit ?? 20;
  if (!menit || !A.sesi?.shift_id || !$("#kunci").hidden) return;
  if (Date.now() - terakhirSentuh > menit * 60000) kunciLayar(true);
}, 15000);

function kunciLayar(otomatis) {
  const st = A.sesi.staff;
  if (otomatis) catatLog(st.id, "Terkunci otomatis");
  const el = $("#kunci");
  el.hidden = false;
  let isi = "";
  el.innerHTML = `<div class="kunci-view">
    <h1>Halo, ${esc(st.nama.split(/\s+/)[0])}</h1><div class="sub">Layar terkunci. Masukkan PIN untuk membuka</div>
    <button class="tautan" id="gantiOrang">Bukan Anda? Ganti kasir</button>
    <div class="ilustrasi">🔒</div>
    <div class="titik" id="titikK"></div><div class="err" id="errK" hidden></div>
    ${padPin("padK")}
    <div class="kaki-kunci"><span class="av">${esc(inisial(st.nama))}</span><span>${esc(A.snap?.lokasi?.nama ?? "")}</span></div></div>`;
  const titik = () => ($("#titikK").innerHTML = titikPin(isi.length));
  titik();
  $("#gantiOrang").onclick = () => { el.hidden = true; keluar(); };
  $("#padK").onclick = async (e) => {
    const k = e.target.closest("[data-k]")?.dataset.k;
    if (!k) return;
    isi = k === "⌫" ? isi.slice(0, -1) : k === "C" ? "" : (isi + k).slice(0, 6);
    titik();
    if (isi.length < 6) return;
    const pin = isi;
    isi = "";
    titik();
    const cocok = await cekPinLokal(st.id, pin);
    if (cocok) { el.hidden = true; terakhirSentuh = Date.now(); catatLog(st.id, "Buka kunci layar"); return; }
    catatLog(st.id, "PIN salah", "kunci layar");
    $("#errK").textContent = "PIN salah";
    $("#errK").hidden = false;
  };
}

mulai().catch((e) => {
  console.error(e);
  $("#app").innerHTML = `<div class="wrap"><div class="card">Terjadi kesalahan: ${esc(e.message)}. Muat ulang halaman.</div></div>`;
});
