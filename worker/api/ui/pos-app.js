// POS: tampilan dan alur kasir. Data dan sinkron ada di pos-data.js.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NAMA_ROLE = { owner: "Owner", admin: "Admin", kasir: "Kasir" };
const inisial = (n) => n.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

// A: keadaan aplikasi yang sedang berjalan.
// sesi (disimpan di kv "sesi"): { staff, sesi, offline, lokasi_id, shift_id }
const A = { sesi: null, umum: null, snap: null, stok: {}, keranjang: [], kategori: "semua", cari: "", layar: null };

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
function bar(judul, sub, kanan = "") {
  return `<div class="bar"><div class="judul"><b>${judul}</b><span>${sub}</span></div>${kanan}</div>`;
}
const statusSinyal = () => `<span class="titik-on ${S.online ? "" : "off"}"></span>${S.online ? "Online" : "Offline"}`;
function bukaLembar(html) {
  $("#lembar").innerHTML = html;
  $("#lapis").hidden = false;
}
function tutupLembar() { $("#lapis").hidden = true; }
$("#lapis").addEventListener("click", (e) => { if (e.target.id === "lapis") tutupLembar(); });

async function simpanSesi() {
  await kv.set("sesi", A.sesi ? { ...A.sesi, keranjang: A.keranjang } : null);
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
    if (A.sesi.lokasi_id && A.sesi.shift_id) return masukKasir();
    return layarTempat();
  }
  layarPilihNama();
  sinkronSekarang();
}

// ---------- Daftarkan HP ----------

function layarDaftar() {
  tampil(`${bar("Hikayat POS", "HP belum terdaftar")}
    <div class="wrap"><div class="card">
      <h1>Daftarkan HP ini</h1>
      <p class="muted">Minta Owner atau Admin membuka Dashboard › Perangkat POS › Daftarkan HP, lalu ketik kode yang muncul.</p>
      <form id="fDaftar">
        <input class="kode" name="kode" placeholder="XXXX-XXXX" maxlength="9" autocomplete="off" autocapitalize="characters" required>
        <div class="err" hidden></div>
        <button class="btn primary">Daftarkan</button>
      </form>
    </div></div>`, "daftar");
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
  tampil(`${bar("Hikayat POS", `HP ${esc(S.perangkat?.kode)} · ${statusSinyal()}`)}
    <div class="wrap"><h1>Siapa yang bertugas?</h1>${pesan ? `<div class="ok">${esc(pesan)}</div>` : ""}<div class="daftar" id="orang"><p class="muted">Memuat…</p></div></div>`, "nama");
  let karyawan = await kv.get("karyawan");
  try {
    karyawan = (await api("GET", "/api/pos/karyawan")).karyawan;
    await kv.set("karyawan", karyawan);
  } catch (e) { if (!putus(e)) throw e; }
  if (A.layar !== "nama") return;
  $("#orang").innerHTML = (karyawan ?? []).map((k) => `<button data-id="${k.id}">
    <span class="av">${esc(inisial(k.nama))}</span><span><b>${esc(k.nama)}</b><br><span class="small muted">${k.role.map((r) => NAMA_ROLE[r]).join(", ")}${k.petunjuk ? " · " + esc(k.petunjuk) : ""}</span></span></button>`).join("")
    || '<p class="muted">Daftar karyawan belum ada di HP ini. Sambungkan ke internet sekali untuk memuatnya.</p>';
  $$("#orang button").forEach((b) => (b.onclick = () => masukPin(karyawan.find((k) => k.id === b.dataset.id))));
}

let pinAksi = null;
function mintaPin(o) {
  pinAksi = { ...o, isi: "" };
  tampil(`${bar("Hikayat POS", `HP ${esc(S.perangkat?.kode)} · ${statusSinyal()}`)}
    <div class="wrap center">
      ${o.av ? `<div class="av" style="margin:8px auto;width:56px;height:56px;font-size:20px">${esc(o.av)}</div>` : ""}
      <h1>${esc(o.judul)}</h1><div class="muted">${esc(o.info)}</div>
      <div class="titik" id="titik"></div>
      <div class="err" id="pinErr" hidden></div>
      <div class="pad" id="pad">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => `<button class="${k ? "" : "kosong"}" data-k="${k}">${k}</button>`).join("")}</div>
      ${o.batal ? '<button class="btn" id="pinBatal">Kembali</button>' : ""}
    </div>`, "pin");
  gambarTitik();
  $("#pad").onclick = padKlik;
  if (o.batal) $("#pinBatal").onclick = o.batal;
}
function gambarTitik() {
  $("#titik").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<span class="${i < pinAksi.isi.length ? "isi" : ""}"></span>`).join("");
}
function salahPin(pesan) {
  const el = $("#pinErr");
  if (!el) return toast(pesan);
  el.textContent = pesan;
  el.hidden = false;
}
async function padKlik(e) {
  const k = e.target.dataset?.k;
  if (k === undefined || k === "" || !pinAksi) return;
  if (k === "⌫") pinAksi.isi = pinAksi.isi.slice(0, -1);
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
    judul: k.nama, info: "Masukkan PIN 6 angka", av: inisial(k.nama), batal: () => layarPilihNama(),
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
    judul: "Ganti PIN", info: (wajib ? "PIN Anda masih sementara. " : "") + "Masukkan PIN lama", batal: kembali,
    selesai: async (lama) => mintaPin({
      judul: "Ganti PIN", info: "Masukkan PIN baru", batal: kembali,
      selesai: async (baru) => mintaPin({
        judul: "Ganti PIN", info: "Ulangi PIN baru", batal: kembali,
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
  await simpanSesi();
  layarPilihNama(pesan);
}

// ---------- Pilih tempat dan buka kasir ----------

function layarTempat() {
  const tempat = A.umum?.tempat ?? [];
  const owner = A.sesi.staff.role.includes("owner");
  tampil(`${bar("Pilih tempat jualan", `${esc(A.sesi.staff.nama)} · ${statusSinyal()}`, '<button id="btnKeluar">Keluar</button>')}
    <div class="wrap">
      ${A.sesi.offline ? '<div class="warn">Masuk offline. Daftar tempat dari data terakhir di HP ini.</div>' : ""}
      <div class="daftar">${tempat.map((t) => `<button data-id="${t.id}" ${t.boleh_jual ? "" : "disabled"}>
        <span class="av">${t.jenis === "gudang" ? "G" : "E"}</span>
        <span><b>${esc(t.nama)}</b><br><span class="small muted">${esc(t.label)}${t.shift_terbuka ? ` · Kasir terbuka · ${esc(t.shift_terbuka.kasir)}` : ""}</span></span></button>`).join("")}</div>
      ${tempat.length ? "" : `<div class="card" style="margin-top:12px"><b>Belum ada tempat jualan</b><p class="muted small">${owner ? "Muat ulang saat ada sinyal." : "Anda belum ditugaskan di event yang sedang berlangsung. Minta Admin menambahkan Anda di form event."}</p></div>`}
    </div>`, "tempat");
  $("#btnKeluar").onclick = () => keluar();
  $$(".daftar button[data-id]").forEach((b) => (b.onclick = () => pilihTempat(tempat.find((t) => t.id === b.dataset.id))));
}

async function pilihTempat(t) {
  if (t.shift_terbuka) {
    A.sesi.lokasi_id = t.id;
    A.sesi.shift_id = t.shift_terbuka.id;
    A.sesi.shift = { ...t.shift_terbuka, lokasi_id: t.id };
    await simpanSesi();
    await catatLog(A.sesi.staff.id, "Gabung kasir", t.nama);
    return masukKasir();
  }
  tampil(`${bar("Buka kasir", esc(t.nama))}
    <div class="wrap"><form class="card" id="fBuka">
      <h1>Buka kasir</h1><p class="muted">Satu tempat jualan punya satu laci. Hitung uang di laci sebelum mulai.</p>
      <label>Modal awal (uang di laci)</label><input name="modal" type="number" inputmode="numeric" min="0" placeholder="0" required>
      <button class="btn primary">Buka Kasir</button>
      <button type="button" class="btn" id="batal">Kembali</button>
    </form></div>`, "buka");
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
  gambarKasir();
  segarkan();
}

// Tarik data baru di latar belakang tanpa mengganggu kasir.
async function segarkan() {
  if (!A.sesi?.lokasi_id || !S.online || !A.sesi.sesi) return;
  try {
    A.snap = await tarikData(A.sesi.lokasi_id);
    A.umum = await kv.get("umum");
    A.stok = await stokTersedia(A.snap);
    if (A.layar === "kasir") gambarKatalog();
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

function gambarKasir() {
  const t = A.sesi;
  const kat = (A.snap.kategori ?? []).filter((k) => k.tampil_menu);
  tampil(`<div class="kasir">
    ${bar(esc(A.snap.lokasi.nama), `${esc(t.staff.nama)} · <span id="sinyal">${statusSinyal()}</span> <span id="antre"></span>`, '<button id="btnKunci">Kunci</button><button id="btnMenu">Menu</button>')}
    <div class="atas">
      <input type="search" id="cari" placeholder="Cari produk atau SKU" value="${esc(A.cari)}">
      <div class="chips" id="chips"><button data-k="semua">Semua</button>${kat.map((k) => `<button data-k="${k.id}">${esc(k.nama)}</button>`).join("")}</div>
    </div>
    <div class="grid" id="grid"></div>
    <div class="aksi"><button id="btnHapus">••• Hapus pesanan</button></div>
    <div class="bawah"><button class="total" id="btnTotal"><small id="jmlBarang"></small><b id="totalBelanja"></b></button><button class="btn primary" id="btnBayar">Bayar</button></div>
  </div>`, "kasir");
  $("#chips").onclick = (e) => { if (e.target.dataset.k) { A.kategori = e.target.dataset.k; gambarKatalog(); } };
  $("#cari").oninput = (e) => { A.cari = e.target.value; gambarKatalog(); };
  $("#btnMenu").onclick = lembarMenu;
  $("#btnKunci").onclick = () => kunciLayar(false);
  $("#btnTotal").onclick = lembarKeranjang;
  $("#btnBayar").onclick = () => (A.keranjang.length ? layarBayar() : toast("Keranjang masih kosong"));
  $("#btnHapus").onclick = () => { if (A.keranjang.length && confirm("Hapus semua barang di keranjang?")) { A.keranjang = []; simpanSesi(); gambarKatalog(); } };
  gambarKatalog();
  gambarAntrean();
}

function gambarKatalog() {
  if (A.layar !== "kasir") return;
  $$("#chips button").forEach((b) => b.classList.toggle("on", b.dataset.k === A.kategori));
  const q = A.cari.trim().toLowerCase();
  const tampilStok = pengaturan().tampil_stok !== false;
  const daftar = produkAktif().filter((p) => (A.kategori === "semua" || p.kategori_id === A.kategori)
    && (!q || (p.nama + " " + p.sku + " " + varianDari(p.id).map((v) => v.sku).join(" ")).toLowerCase().includes(q)))
    .sort((a, b) => a.nama.localeCompare(b.nama));
  $("#grid").innerHTML = daftar.map((p) => {
    const v = varianDari(p.id);
    if (!v.length) return "";
    const stok = v.reduce((a, x) => a + Math.max(0, A.stok[x.sku] ?? 0), 0);
    const harga = v.map((x) => x.harga);
    const min = Math.min(...harga), maks = Math.max(...harga);
    const jml = v.reduce((a, x) => a + diKeranjang(x.sku), 0);
    const khusus = v.some((x) => x.harga !== x.harga_normal);
    return `<button class="kartu ${stok <= 0 ? "habis" : ""}" data-p="${p.id}">
      ${jml ? `<span class="jml">${jml}</span>` : ""}
      <b>${esc(p.nama)}</b>
      <span class="stok">${p.punya_varian ? `${v.length} varian · ` : ""}${tampilStok ? (stok > 0 ? `sisa ${stok}` : "Habis") : ""}</span>
      <span class="harga">${min === maks ? rp(min) : `${rp(min)}+`}${khusus ? ' <span class="tag warn">harga khusus</span>' : ""}</span></button>`;
  }).join("") || '<p class="muted" style="grid-column:1/-1">Tidak ada produk.</p>';
  $$("#grid .kartu").forEach((b) => (b.onclick = () => ketukProduk(A.snap.produk[b.dataset.p])));
  gambarTotal();
}

function gambarTotal() {
  const items = barisKeranjang();
  const t = hitungTagihan(items, pengaturan());
  const n = items.reduce((a, i) => a + i.qty, 0);
  $("#jmlBarang").textContent = n ? `${n} barang · ketuk untuk lihat` : "Keranjang kosong";
  $("#totalBelanja").textContent = rp(t.total);
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

function tambah(sku, n = 1) {
  const ada = diKeranjang(sku);
  const sisa = A.stok[sku] ?? 0;
  if (ada + n > sisa) return toast(sisa > 0 ? `Stok tinggal ${sisa}` : "Stok habis di tempat ini");
  const i = A.keranjang.find((x) => x.sku === sku);
  if (i) i.qty += n; else A.keranjang.push({ sku, qty: n });
  A.keranjang = A.keranjang.filter((x) => x.qty > 0);
  simpanSesi();
  gambarKatalog();
}

function ketukProduk(p) {
  const v = varianDari(p.id);
  if (!p.punya_varian && v.length === 1) return tambah(v[0].sku);
  const gambar = () => bukaLembar(`<h2>${esc(p.nama)}</h2><div class="muted small">Ketuk ukuran untuk menambah. Ketuk lagi untuk menambah jumlah.</div>
    ${v.map((x) => { const s = A.stok[x.sku] ?? 0; return `<div class="baris"><div class="isi"><b>${esc(x.nama)}</b><div class="small muted">${rp(x.harga)} · ${s > 0 ? "sisa " + s : "habis"}</div></div>
      <div class="qty"><button data-k="-" data-sku="${esc(x.sku)}">−</button><span>${diKeranjang(x.sku)}</span><button data-k="+" data-sku="${esc(x.sku)}" ${s - diKeranjang(x.sku) <= 0 ? "disabled" : ""}>+</button></div></div>`; }).join("")}
    <button class="btn primary" id="selesaiVarian">Selesai</button>`);
  gambar();
  $("#lembar").onclick = (e) => {
    const b = e.target.closest("button[data-sku]");
    if (b) { tambah(b.dataset.sku, b.dataset.k === "+" ? 1 : -1); gambar(); }
    if (e.target.id === "selesaiVarian") tutupLembar();
  };
}

function barisKeranjang() {
  return A.keranjang.map((i) => { const v = A.snap.varian[i.sku]; return v ? { sku: i.sku, nama: namaBarang(v), qty: i.qty, harga: v.harga } : null; }).filter(Boolean);
}

function lembarKeranjang() {
  const gambar = () => {
    const items = barisKeranjang();
    const t = hitungTagihan(items, pengaturan());
    bukaLembar(`<h2>Keranjang</h2>
      ${items.length ? items.map((i) => `<div class="baris"><div class="isi"><b>${esc(i.nama)}</b><div class="small muted">${rp(i.harga)} × ${i.qty} = ${rp(i.harga * i.qty)}</div></div>
        <div class="qty"><button data-k="-" data-sku="${esc(i.sku)}">−</button><span>${i.qty}</span><button data-k="+" data-sku="${esc(i.sku)}">+</button></div></div>`).join("") : '<p class="muted">Keranjang kosong.</p>'}
      ${rincianTagihan(t)}
      <button class="btn primary" id="keBayar" ${items.length ? "" : "disabled"}>Bayar ${rp(t.total)}</button>`);
  };
  gambar();
  $("#lembar").onclick = (e) => {
    const b = e.target.closest("button[data-sku]");
    if (b) { tambah(b.dataset.sku, b.dataset.k === "+" ? 1 : -1); gambar(); }
    if (e.target.id === "keBayar") layarBayar();
  };
}

function rincianTagihan(t) {
  return `<table class="rinci"><tr><td>Subtotal</td><td>${rp(t.subtotal)}</td></tr>
    ${t.diskon ? `<tr><td>Diskon</td><td>−${rp(t.diskon)}</td></tr>` : ""}
    ${t.pajak ? `<tr><td>PPN ${pengaturan().pajak.persen}%</td><td>${rp(t.pajak)}</td></tr>` : ""}
    ${t.pembulatan ? `<tr><td>Pembulatan</td><td>−${rp(t.pembulatan)}</td></tr>` : ""}
    <tr class="tebal"><td>Total</td><td>${rp(t.total)}</td></tr></table>`;
}

// ---------- Pembayaran ----------

function layarBayar() {
  const items = barisKeranjang();
  if (!items.length) return;
  for (const i of items) if (i.qty > (A.stok[i.sku] ?? 0)) return toast(`Stok ${i.nama} tinggal ${A.stok[i.sku] ?? 0}`);
  const p = pengaturan();
  const t = hitungTagihan(items, p);
  const metode = ["tunai", "qris", "transfer"].filter((m) => p.metode?.[m] !== false);
  let pilih = metode[0], tunai = 0, ref = "";
  const gambar = async () => {
    const qris = pilih === "qris" ? await kv.get("qris_gambar") : null;
    tampil(`${bar("Pembayaran", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}
      <div class="wrap">
        <div class="card">${rincianTagihan(t)}</div>
        <div class="metode">${metode.map((m) => `<button data-m="${m}" class="${m === pilih ? "on" : ""}">${{ tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }[m]}</button>`).join("")}</div>
        <div class="card" id="isiBayar">${pilih === "tunai" ? `
          <label>Uang diterima</label><input id="uang" type="number" inputmode="numeric" min="0" value="${tunai || ""}" placeholder="0">
          <div class="cepat">${nominalCepat(t.total, p.nominal_cepat).map((n) => `<button data-n="${n}">${n === t.total ? "Uang pas" : rp(n)}</button>`).join("")}</div>
          <div class="ok" id="kembalian" hidden></div>
          <button class="btn primary" id="lunas" disabled>Selesaikan</button>`
        : pilih === "qris" ? `
          <div class="qris">${qris ? `<img src="${URL.createObjectURL(qris.blob)}" alt="QRIS">` : '<span class="contoh"><img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27240%27 height=%27240%27%3E%3Crect width=%27240%27 height=%27240%27 fill=%27%23eee%27/%3E%3C/svg%3E" alt=""></span><div class="err">Gambar QRIS belum diunggah. Minta Admin mengunggahnya di Dashboard › Pengaturan POS.</div>'}
            <div><b>${esc(p.qris?.nama ?? "")}</b>${p.qris?.nmid ? ` · NMID ${esc(p.qris.nmid)}` : ""}</div>
            <h1 style="margin-top:8px">${rp(t.total)}</h1><p class="muted small">Pembeli mengetik nominal ini sendiri di aplikasinya.</p></div>
          <label>4 digit terakhir no. referensi (dari notifikasi aplikasi merchant)</label>
          <input id="ref" inputmode="numeric" maxlength="4" value="${esc(ref)}" placeholder="0000">
          <button class="btn primary" id="lunas" ${/^\d{4}$/.test(ref) ? "" : "disabled"}>Dana Sudah Masuk</button>`
        : `
          ${(p.rekening ?? []).map((r) => `<div class="baris"><div class="isi"><b>${esc(r.bank)} ${esc(r.no)}</b><div class="small muted">a.n. ${esc(r.nama)}</div></div><button class="btn kecil" data-salin="${esc(r.no)}">Salin</button></div>`).join("")}
          <h1 style="margin-top:12px">${rp(t.total)}</h1>
          <button class="btn primary" id="lunas">Dana Sudah Masuk</button>`}
        </div>
      </div>`, "bayar");
    $("#kembali").onclick = () => { gambarKasir(); };
    $$(".metode button").forEach((b) => (b.onclick = () => { pilih = b.dataset.m; gambar(); }));
    const uang = $("#uang");
    const cekTunai = () => {
      tunai = Number(uang.value || 0);
      const kb = tunai - t.total;
      $("#kembalian").hidden = tunai < t.total;
      $("#kembalian").textContent = `Kembalian ${rp(kb)}`;
      $("#lunas").disabled = tunai < t.total;
    };
    if (uang) {
      uang.oninput = cekTunai;
      $$(".cepat button").forEach((b) => (b.onclick = () => { uang.value = b.dataset.n; cekTunai(); }));
      cekTunai();
    }
    const r = $("#ref");
    if (r) r.oninput = () => { r.value = r.value.replace(/\D/g, "").slice(0, 4); ref = r.value; $("#lunas").disabled = !/^\d{4}$/.test(ref); };
    $$("[data-salin]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.salin.replace(/\s/g, "")).then(() => toast("Nomor rekening disalin"))));
    $("#lunas").onclick = () => selesaikan(items, t, pilih === "tunai"
      ? [{ metode: "Tunai", jumlah: tunai }]
      : pilih === "qris" ? [{ metode: "QRIS", jumlah: t.total, ref }] : [{ metode: "Transfer", jumlah: t.total }]);
  };
  gambar();
}

let sedangBayar = false;
async function selesaikan(items, t, pembayaran) {
  if (sedangBayar) return;
  sedangBayar = true;
  try {
    const dibayar = pembayaran.reduce((a, b) => a + b.jumlah, 0);
    const trx = {
      id: ulid(), no: await nomorBaru(), shift_id: A.sesi.shift_id, lokasi_id: A.sesi.lokasi_id, kasir_id: A.sesi.staff.id, waktu: sekarang(),
      items, ...t, pembayaran, offline: !S.online,
    };
    await antrekan("trx", trx);
    const lokal = { ...trx, kasir_nama: A.sesi.staff.nama, lokasi_nama: A.snap.lokasi.nama, dibayar, kembalian: dibayar - t.total, metode: pembayaran[0].metode, status: "Lunas", terkirim: false };
    await tx("trx", "readwrite", (s) => s.put(lokal));
    A.keranjang = [];
    await simpanSesi();
    A.stok = await stokTersedia(A.snap);
    layarSukses(lokal);
  } finally {
    sedangBayar = false;
  }
}

// ---------- Struk ----------

function htmlStruk(t) {
  const st = pengaturan().struk ?? {};
  return `<div class="struk">
    <div class="tengah"><b>${esc(st.nama)}</b>${st.info ? `<div>${esc(st.info)}</div>` : ""}${st.tampil_event ? `<div>${esc(t.lokasi_nama)}</div>` : ""}</div>
    <table class="rinci"><tr><td>No.</td><td>${esc(t.no)}</td></tr><tr><td>Waktu</td><td>${tglJam(t.waktu)}</td></tr>${st.tampil_kasir ? `<tr><td>Kasir</td><td>${esc(t.kasir_nama)}</td></tr>` : ""}</table>
    <table class="rinci">${t.items.map((i) => `<tr><td>${esc(i.nama)}<br><span class="muted">${i.qty} × ${rp(i.harga)}</span></td><td>${rp(i.qty * i.harga)}</td></tr>`).join("")}</table>
    ${rincianTagihan(t)}
    <table class="rinci">${t.pembayaran.map((b) => `<tr><td>${esc(b.metode)}${b.ref ? ` (ref ${esc(b.ref)})` : ""}</td><td>${rp(b.jumlah)}</td></tr>`).join("")}${t.kembalian ? `<tr><td>Kembalian</td><td>${rp(t.kembalian)}</td></tr>` : ""}</table>
    ${st.footer ? `<div class="tengah muted" style="margin-top:8px">${esc(st.footer)}</div>` : ""}</div>`;
}

const pdfStruk = (t) => strukPdf(t, { nama: t.lokasi_nama }, pengaturan().struk ?? {});
const waNorm = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d.length >= 10 ? d : ""; };

// Belum ada layanan WhatsApp API: PDF dibagikan lewat menu share HP, atau diunduh lalu chat WA pembeli dibuka.
async function bagikanStruk(t, nomor) {
  const wa = waNorm(nomor);
  const blob = pdfStruk(t).output("blob");
  const file = new File([blob], `Struk-${t.no}.pdf`, { type: "application/pdf" });
  const pesan = `Struk ${pengaturan().struk?.nama ?? "Hikayat"} ${t.no}`;
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
  tampil(`${bar("Pembayaran berhasil", esc(t.no))}
    <div class="wrap">
      <div class="ok center"><b>Lunas ${rp(t.total)}</b>${t.kembalian ? `<br>Kembalian ${rp(t.kembalian)}` : ""}</div>
      ${t.offline ? '<div class="warn">Tersimpan di HP. Dikirim ke server saat ada sinyal.</div>' : ""}
      <div style="margin-top:12px">${htmlStruk(t)}</div>
      <label>Kirim struk PDF ke WhatsApp</label>
      <input id="wa" inputmode="tel" placeholder="08xx atau +62" value="${esc(t.pelanggan_telp ?? "")}">
      <button class="btn" id="kirimWa">Kirim dari WhatsApp HP ini</button>
      <button class="btn" id="unduh">Unduh PDF</button>
      <button class="btn primary" id="baru">Transaksi baru</button>
    </div>`, "sukses");
  $("#kirimWa").onclick = () => bagikanStruk(t, $("#wa").value);
  $("#unduh").onclick = () => pdfStruk(t).save(`Struk-${t.no}.pdf`);
  $("#baru").onclick = () => gambarKasir();
}

// ---------- Menu ----------

function lembarMenu() {
  const owner = A.sesi.staff.role.includes("owner");
  bukaLembar(`<h2>Menu</h2><div class="daftar">
    <button data-m="riwayat">Penjualan shift ini</button>
    <button data-m="kas">Kas kasir</button>
    <button data-m="sinkron">Status sinkron</button>
    ${owner ? '<button data-m="tempat">Ganti tempat jualan</button>' : ""}
    <button data-m="pin">Ganti PIN</button>
    <button data-m="tutup">Tutup kasir</button>
    <button data-m="keluar">Keluar kasir (laci tetap terbuka)</button>
  </div>`);
  $("#lembar").onclick = (e) => {
    const m = e.target.closest("[data-m]")?.dataset.m;
    if (!m) return;
    tutupLembar();
    ({
      riwayat: layarRiwayat, kas: layarKas, sinkron: layarSinkron, pin: () => (S.online ? gantiPin(false) : toast("Ganti PIN butuh sinyal")),
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
        if (!per.has(t.id)) per.set(t.id, { ...t, kasir_nama: t.kasir, lokasi_nama: A.snap.lokasi.nama, terkirim: true, dariServer: true });
      }
    } catch {}
  }
  return [...per.values()].sort((a, b) => b.waktu.localeCompare(a.waktu));
}

async function layarRiwayat() {
  tampil(`${bar("Penjualan shift ini", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Memuat…</p></div>`, "riwayat");
  $("#kembali").onclick = gambarKasir;
  const daftar = await transaksiShift();
  const total = daftar.filter((t) => t.status === "Lunas").reduce((a, t) => a + t.total, 0);
  $("#app .wrap").innerHTML = `<div class="card"><b>${daftar.length} transaksi · ${rp(total)}</b></div><div class="daftar">${daftar.map((t) => `<button data-id="${t.id}">
    <span class="isi"><b>${esc(t.no)}</b><br><span class="small muted">${jam(t.waktu)} · ${esc(t.kasir_nama)} · ${esc(t.metode)}</span></span>
    <span><b>${rp(t.total)}</b><br>${t.ditolak ? '<span class="tag off">Ditolak server</span>' : t.terkirim ? '<span class="tag ok">Terkirim</span>' : '<span class="tag warn">Belum terkirim</span>'}</span></button>`).join("") || '<p class="muted">Belum ada transaksi.</p>'}</div>`;
  $$(".daftar button").forEach((b) => (b.onclick = () => {
    const t = daftar.find((x) => x.id === b.dataset.id);
    bukaLembar(`${htmlStruk(t)}${t.ditolak ? `<div class="err">Ditolak server: ${esc(t.ditolak)}</div>` : ""}
      <button class="btn" id="kirimUlang">Kirim struk dari WhatsApp HP ini</button><button class="btn" id="unduhUlang">Unduh PDF</button>`);
    $("#kirimUlang").onclick = () => bagikanStruk(t, t.pelanggan_telp);
    $("#unduhUlang").onclick = () => pdfStruk(t).save(`Struk-${t.no}.pdf`);
  }));
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
      <h2 style="margin-top:16px">Dicatat dari HP ini</h2>
      <div class="daftar">${kasLokal.map((k) => `<div class="card small"><b>${k.jenis === "masuk" ? "+" : "−"}${rp(k.jumlah)}</b> · ${esc(k.catatan)} <span class="muted">${jam(k.waktu)}</span></div>`).join("") || '<p class="muted">Belum ada.</p>'}</div>
    </div>`, "kas");
  $("#kembali").onclick = gambarKasir;
  let jenis = "masuk";
  $$("#fKas .metode button").forEach((b) => (b.onclick = () => { jenis = b.dataset.j; $$("#fKas .metode button").forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#fKas").onsubmit = async (e) => {
    e.preventDefault();
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

// ---------- Tutup kasir ----------

async function layarTutupKasir() {
  tampil(`${bar("Tutup kasir", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Mengirim data dan menghitung…</p></div>`, "tutup");
  $("#kembali").onclick = gambarKasir;
  await sinkronSekarang();
  const sisa = (await isiAntrean()).length;
  let r = null;
  if (S.online && A.sesi.sesi && !sisa) {
    try { r = (await api("GET", `/api/pos/shift/${A.sesi.shift_id}`)).ringkasan; } catch {}
  }
  // Tanpa sinyal: hitung dari data di HP ini saja (laci yang dipakai beberapa HP bisa belum lengkap).
  if (!r) {
    const trx = (await tx("trx", "readonly", (s) => s.index("shift").getAll(A.sesi.shift_id))).filter((t) => t.status === "Lunas");
    const kas = (await kv.get("kas:" + A.sesi.shift_id)) ?? [];
    const per = (m) => trx.flatMap((t) => t.pembayaran).filter((b) => b.metode === m).reduce((a, b) => a + b.jumlah, 0);
    const tunai = per("Tunai") - trx.reduce((a, t) => a + (t.kembalian ?? 0), 0);
    const km = kas.filter((k) => k.jenis === "masuk").reduce((a, k) => a + k.jumlah, 0), kk = kas.filter((k) => k.jenis === "keluar").reduce((a, k) => a + k.jumlah, 0);
    r = { transaksi: trx.length, total: trx.reduce((a, t) => a + t.total, 0), tunai, qris: per("QRIS"), transfer: per("Transfer"), kas_masuk: km, kas_keluar: kk,
      seharusnya: (A.sesi.shift?.modal ?? 0) + tunai + km - kk, lokal: true };
  }
  const karyawan = (await kv.get("karyawan")) ?? [];
  const pemilik = A.sesi.shift?.kasir_id ?? A.sesi.staff.id;
  $("#app .wrap").innerHTML = `
    ${r.lokal ? `<div class="warn">${sisa ? `${sisa} dokumen belum terkirim. ` : ""}Angka dihitung dari data di HP ini saja.</div>` : ""}
    <div class="card"><table class="rinci">
      <tr><td>Transaksi</td><td>${r.transaksi}</td></tr><tr><td>Penjualan</td><td>${rp(r.total)}</td></tr>
      <tr><td>Tunai</td><td>${rp(r.tunai)}</td></tr><tr><td>QRIS</td><td>${rp(r.qris)}</td></tr><tr><td>Transfer</td><td>${rp(r.transfer)}</td></tr>
    </table></div>
    <div class="card" style="margin-top:10px"><h2>Uang di laci</h2><table class="rinci">
      <tr><td>Modal awal</td><td>${rp(A.sesi.shift?.modal ?? r.seharusnya - r.tunai - r.kas_masuk + r.kas_keluar)}</td></tr>
      <tr><td>+ Penjualan tunai</td><td>${rp(r.tunai)}</td></tr><tr><td>+ Kas masuk</td><td>${rp(r.kas_masuk)}</td></tr><tr><td>− Kas keluar</td><td>${rp(r.kas_keluar)}</td></tr>
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
    const data = { id: A.sesi.shift_id, tutup: sekarang(), kas_hitung: hitung, seharusnya: r.seharusnya, catatan: f.catatan.value.trim() || null,
      ditutup_oleh: A.sesi.staff.id, disetujui_oleh: setuju.id, pj_id: s < 0 ? f.pj.value : null, penjelasan: s < 0 ? f.penjelasan.value.trim() : null };
    mintaPin({
      judul: "Tutup kasir", info: `PIN ${setuju.nama}`, av: inisial(setuju.nama), batal: layarTutupKasir,
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
  el.innerHTML = `${bar("Layar terkunci", esc(A.snap?.lokasi?.nama ?? ""))}<div class="wrap center">
    <div class="av" style="margin:8px auto;width:56px;height:56px;font-size:20px">${esc(inisial(st.nama))}</div>
    <h1>${esc(st.nama)}</h1><div class="muted">Masukkan PIN untuk membuka</div>
    <div class="titik" id="titikK"></div><div class="err" id="errK" hidden></div>
    <div class="pad" id="padK">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => `<button class="${k ? "" : "kosong"}" data-k="${k}">${k}</button>`).join("")}</div>
    <button class="btn" id="gantiOrang">Ganti kasir</button></div>`;
  const titik = () => ($("#titikK").innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<span class="${i < isi.length ? "isi" : ""}"></span>`).join(""));
  titik();
  $("#gantiOrang").onclick = () => { el.hidden = true; keluar(); };
  $("#padK").onclick = async (e) => {
    const k = e.target.dataset?.k;
    if (k === undefined || k === "") return;
    isi = k === "⌫" ? isi.slice(0, -1) : (isi + k).slice(0, 6);
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
