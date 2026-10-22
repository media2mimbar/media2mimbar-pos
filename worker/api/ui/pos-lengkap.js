// POS tahap 5: promo, pelanggan, Daftar Order dan pisah bayar, void, retur barang cacat, serah barang pre-sale.
// Dimuat sebelum pos-app.js; fungsi di sini memakai A, tampil, bukaLembar, dll. dari pos-app.js saat dipanggil.

// ---------- Persetujuan atasan ----------

// Pilih orang yang menyetujui lalu minta PIN-nya. Online: token sekali pakai dari server. Offline: PIN dicek di HP.
// Hasil: { disetujui_oleh, persetujuan } atau { disetujui_oleh, offline: true }. null kalau dibatalkan.
function pilihAtasan(aksi, judul, kembali, wajibAtasan = true) {
  return new Promise(async (selesai) => {
    const karyawan = ((await kv.get("karyawan")) ?? []).filter((k) => !wajibAtasan || k.role.includes("owner") || k.role.includes("admin"));
    if (!karyawan.length) { toast("Daftar Admin/Owner belum ada di HP ini. Butuh sinyal"); return selesai(null); }
    bukaLembar(`<h2>${esc(judul)}</h2><div class="muted small">Pilih ${wajibAtasan ? "Admin atau Owner" : "orang"} yang menyetujui, lalu dia memasukkan PIN.</div>
      <div class="daftar">${karyawan.map((k) => `<button data-id="${k.id}"><span class="av">${esc(inisial(k.nama))}</span><span><b>${esc(k.nama)}</b><br><span class="small muted">${k.role.map((r) => NAMA_ROLE[r]).join(", ")}</span></span></button>`).join("")}</div>
      <button class="btn" id="batalSetuju">Batal</button>`);
    $("#lembar").onclick = (e) => {
      if (e.target.id === "batalSetuju") { tutupLembar(); return selesai(null); }
      const b = e.target.closest("button[data-id]");
      if (!b) return;
      const k = karyawan.find((x) => x.id === b.dataset.id);
      mintaPin({
        judul, info: `PIN ${k.nama}`, av: inisial(k.nama), batal: () => { kembali(); selesai(null); },
        selesai: async (pin) => {
          try {
            const r = await api("POST", "/api/pos/setujui", { staff_id: k.id, pin, aksi });
            return selesai({ disetujui_oleh: k.id, persetujuan: r.token });
          } catch (x) {
            if (!putus(x)) throw x;
            const cocok = await cekPinLokal(k.id, pin);
            if (!cocok) { await catatLog(k.id, "PIN salah", "persetujuan " + aksi); throw new Error(cocok === null ? "PIN orang ini belum tersimpan di HP. Butuh sinyal" : "PIN salah"); }
            return selesai({ disetujui_oleh: k.id, offline: true });
          }
        },
      });
    };
  });
}

const atasan = () => A.sesi.staff.role.includes("owner") || A.sesi.staff.role.includes("admin");

// ---------- Promo ----------

function promoBerlakuSekarang() {
  if (!A.snap) return [];
  const w = HkPromo.waktuWib();
  return (A.snap.promo ?? []).filter((p) => HkPromo.promoBerlaku(p, A.sesi.lokasi_id, w));
}

let sedangCekPromo = false;
// Dipanggil setiap isi keranjang berubah. Promo otomatis dengan potongan terbesar dipasang, kecuali kasir sudah melepasnya.
// Promo Bonus Produk dengan satu pilihan barang bonus: barang bonus langsung masuk keranjang.
function cekPromoOtomatis(diam) {
  if (sedangCekPromo) return;
  sedangCekPromo = true;
  try {
    const items = barisKeranjang();
    if (!items.length) { A.ord.promo = null; A.ord.dilepas = false; return; }
    const pr = A.ord.promo;
    if (pr && !pr.otomatis) return; // pilihan kasir tidak diganggu
    const daftar = promoBerlakuSekarang();
    const kini = pr ? daftar.find((p) => p.id === pr.id) : null;
    if (kini && !HkPromo.memenuhi(kini, items)) A.ord.promo = null;
    if (A.ord.dilepas) return;
    // Promo bonus yang barang bonusnya belum di keranjang belum memberi potongan, tapi tetap dipasang (bonusnya lalu ditambahkan).
    const terbaik = HkPromo.terbaikOtomatis(daftar, items) ?? daftar.find((p) => p.auto && p.jenis === "bonus" && HkPromo.memenuhi(p, items)) ?? null;
    if (terbaik && terbaik.id !== A.ord.promo?.id) {
      A.ord.promo = { id: terbaik.id, otomatis: true };
      if (!diam) toast(`Promo ${terbaik.nama} dipakai`);
      if (terbaik.jenis === "bonus") tambahBonus(terbaik, true);
    }
  } finally {
    sedangCekPromo = false;
  }
}

// Masukkan barang bonus yang masih kurang. Hanya otomatis kalau pilihannya cuma satu varian.
function tambahBonus(p, otomatis) {
  const b = HkPromo.infoBonus(p, barisKeranjang());
  if (!b.perlu) return false;
  const pilihan = p.bonus.flatMap((id) => (A.snap.produk[id] ? varianDari(id) : [])).filter((v) => modePresale() || (A.stok[v.sku] ?? 0) - diKeranjang(v.sku) > 0);
  if (!pilihan.length) { if (!otomatis) toast("Stok barang bonus habis"); return false; }
  if (pilihan.length === 1) {
    const v = pilihan[0], i = A.keranjang.find((x) => x.sku === v.sku);
    const n = Math.min(b.perlu, modePresale() ? b.perlu : (A.stok[v.sku] ?? 0) - diKeranjang(v.sku));
    if (i) i.qty += n; else A.keranjang.push({ sku: v.sku, qty: n });
    if (!otomatis) toast(`Bonus ${namaBarang(v)} masuk keranjang`);
    return true;
  }
  if (!otomatis) ketukProduk(A.snap.produk[pilihan[0].produk_id], `Pilih ${b.perlu} barang bonus (gratis)`);
  return false;
}

function pakaiPromo(id, persen) {
  A.ord.promo = { id, ...(persen !== undefined ? { persen } : {}) };
  A.ord.dilepas = false;
  const p = promoBerlakuSekarang().find((x) => x.id === id);
  if (p?.jenis === "bonus") tambahBonus(p, false);
  simpanSesi();
  gambarKatalog();
}
function lepasPromo() {
  A.ord.promo = null;
  A.ord.dilepas = true;
  simpanSesi();
  gambarKatalog();
}

function kartuPromo(p, items) {
  const pakai = A.ord.promo?.id === p.id;
  const ok = HkPromo.memenuhi(p, items);
  const pot = ok ? HkPromo.potongan(p, items, pakai ? A.ord.promo.persen : undefined) : 0;
  const kurang = items.length ? HkPromo.kurang(p, items, namaProduk) : "";
  const bonus = p.jenis === "bonus" && ok ? HkPromo.infoBonus(p, items) : null;
  return `<div class="card" style="margin-top:8px">
    <b>${esc(p.nama)}</b> ${p.auto ? '<span class="tag">otomatis</span>' : ""} ${pakai ? '<span class="tag ok">dipakai</span>' : ""}
    <div class="small muted">${esc(HkPromo.syarat(p, namaProduk))}${p.selesai ? " · sampai " + esc(p.selesai) : ""}</div>
    ${pot ? `<div class="ok small" style="margin-top:6px;padding:6px 10px">Hemat ${rp(pot)}</div>` : kurang ? `<div class="warn small" style="margin-top:6px;padding:6px 10px">${esc(kurang)}</div>` : ""}
    ${bonus?.perlu ? `<button class="btn kecil" style="margin-top:8px" data-bonus="${p.id}">Tambah barang bonus (${bonus.perlu})</button>` : ""}
    ${pakai && p.jenis === "persen" && p.kasir_ubah ? `<label>Persen diskon (maks ${p.kasir_maks_persen || 100}%)</label><input type="number" min="0" max="${p.kasir_maks_persen || 100}" value="${A.ord.promo.persen ?? p.besar}" data-persen="${p.id}">` : ""}
    <div style="margin-top:8px">${pakai ? `<button class="btn kecil" data-lepas="${p.id}">Lepas promo</button>` : `<button class="btn kecil" data-pakai="${p.id}" ${ok ? "" : "disabled"}>Pakai</button>`}</div></div>`;
}

function aksiPromo(e, gambarUlang) {
  const t = e.target;
  if (t.dataset.pakai) { pakaiPromo(t.dataset.pakai); gambarUlang(); }
  if (t.dataset.lepas) { lepasPromo(); gambarUlang(); }
  if (t.dataset.bonus) { const p = promoBerlakuSekarang().find((x) => x.id === t.dataset.bonus); if (p && tambahBonus(p, false)) { simpanSesi(); gambarKatalog(); gambarUlang(); } }
  if (t.id === "pakaiManual") {
    const maks = pengaturan().diskon_kasir?.maks_persen ?? 0;
    const n = Math.round(Number($("#persenManual").value || 0));
    if (n <= 0 || n > maks) return toast(`Diskon manual 1–${maks}%`);
    pakaiPromo("manual", n);
    gambarUlang();
  }
}

function lembarPromo() {
  const gambar = () => {
    const items = barisKeranjang();
    const daftar = promoBerlakuSekarang();
    const dk = pengaturan().diskon_kasir ?? {};
    const manual = A.ord.promo?.id === "manual";
    bukaLembar(`<h2>Promo tersedia</h2><div class="small muted">Satu pesanan hanya bisa memakai satu promo.</div>
      ${daftar.map((p) => kartuPromo(p, items)).join("") || '<p class="muted">Tidak ada promo yang berlaku di tempat ini sekarang.</p>'}
      ${dk.aktif && dk.maks_persen ? `<div class="card" style="margin-top:8px"><b>Diskon manual kasir</b> ${manual ? '<span class="tag ok">dipakai</span>' : ""}
        <div class="small muted">Maksimal ${dk.maks_persen}% dari subtotal</div>
        <div style="display:flex;gap:8px;margin-top:8px"><input id="persenManual" type="number" inputmode="numeric" min="1" max="${dk.maks_persen}" placeholder="%" value="${manual ? A.ord.promo.persen : ""}" style="width:90px">
        <button class="btn kecil" id="pakaiManual" ${items.length ? "" : "disabled"}>Pakai</button>${manual ? '<button class="btn kecil" data-lepas="manual">Lepas</button>' : ""}</div></div>` : ""}
      <button class="btn primary" id="tutupPromo">Selesai</button>`);
  };
  gambar();
  $("#lembar").onclick = (e) => { if (e.target.id === "tutupPromo") return tutupLembar(); aksiPromo(e, gambar); };
  $("#lembar").onchange = (e) => {
    const id = e.target.dataset.persen;
    if (!id) return;
    const p = promoBerlakuSekarang().find((x) => x.id === id);
    const n = Math.min(Math.max(0, Math.round(Number(e.target.value || 0))), p?.kasir_maks_persen || 100);
    A.ord.promo = { id, persen: n };
    simpanSesi();
    gambarKatalog();
    gambar();
  };
}

// Tab "Promo" di katalog: kartu promo menggantikan kartu produk.
function gambarTabPromo() {
  const items = barisKeranjang();
  const daftar = promoBerlakuSekarang();
  $("#grid").innerHTML = `<div style="grid-column:1/-1">${daftar.map((p) => kartuPromo(p, items)).join("") || '<p class="muted">Tidak ada promo yang berlaku sekarang.</p>'}</div>`;
  $("#grid").onclick = (e) => aksiPromo(e, () => A.kategori === "promo" && gambarTabPromo());
  gambarTotal();
}

// ---------- Pelanggan ----------

async function cariPelanggan(q) {
  const lokal = (await kv.get("pelanggan")) ?? [];
  if (S.online && A.sesi.sesi) {
    try {
      const r = (await api("GET", "/api/pos/pelanggan?q=" + encodeURIComponent(q))).pelanggan;
      const gabung = new Map([...lokal, ...r].map((p) => [p.id, p]));
      await kv.set("pelanggan", [...gabung.values()].slice(-500));
      return r;
    } catch {}
  }
  const k = q.toLowerCase(), d = q.replace(/\D/g, "");
  return lokal.filter((p) => !q || p.nama.toLowerCase().includes(k) || (d && (p.telp ?? "").includes(d))).slice(0, 30);
}

function lembarPelanggan() {
  const pre = modePresale();
  const gambar = async (q = "") => {
    const pel = A.ord.pelanggan;
    bukaLembar(`<div class="kepala-sheet"><div><h2>Pelanggan</h2><div class="sub">Cari pelanggan lama atau tambah yang baru.</div></div><button class="btn kecil" id="pelBaru">+ Baru</button></div>
      ${pre ? '<div class="warn small" style="margin:0 0 10px">Pre-sale wajib pelanggan dengan no HP.</div>' : ""}
      ${pel ? `<div class="item-pilih" style="margin:0 0 10px"><span class="av">${esc(inisial(pel.nama))}</span><span class="isi"><b>${esc(pel.nama)}</b><br><span class="small muted">Dipilih${pel.telp ? " · " + esc(pel.telp) : ""}</span></span><button class="btn kecil" id="lepasPel">Hapus</button></div>` : ""}
      <div class="cari" style="margin-top:0"><span>🔍</span><input type="search" id="cariPel" placeholder="Cari nama atau no HP" value="${esc(q)}"></div>
      <div class="daftar" id="hasilPel"><p class="muted small">Mencari…</p></div>`);
    const isi = async () => {
      const hasil = await cariPelanggan($("#cariPel")?.value.trim() ?? "");
      const el = $("#hasilPel");
      if (!el) return;
      el.innerHTML = hasil.map((p) => `<button data-pel="${p.id}"><span class="av">${esc(inisial(p.nama))}</span><span class="isi"><b>${esc(p.nama)}</b><br><span class="small muted">${esc(p.telp ?? "tanpa no HP")}${p.kota ? " · " + esc(p.kota) : ""}</span></span></button>`).join("")
        || '<div class="kosong">Tidak ditemukan. Ketuk <b style="display:inline">+ Baru</b> untuk menambah pelanggan.</div>';
      $$("[data-pel]", el).forEach((b) => (b.onclick = () => {
        const p = hasil.find((x) => x.id === b.dataset.pel);
        if (pre && !p.telp) return toast("Pelanggan ini belum punya no HP. Buat pelanggan baru dengan no HP");
        A.ord.pelanggan = { id: p.id, nama: p.nama, telp: p.telp ?? null };
        simpanSesi(); tutupLembar(); gambarKatalog();
      }));
    };
    let tunda;
    $("#cariPel").oninput = () => { clearTimeout(tunda); tunda = setTimeout(isi, 300); };
    if ($("#lepasPel")) $("#lepasPel").onclick = () => { A.ord.pelanggan = null; simpanSesi(); tutupLembar(); gambarKatalog(); };
    $("#pelBaru").onclick = formPelanggan;
    isi();
  };
  gambar();
}

function formPelanggan() {
  bukaLembar(`<h2>Pelanggan baru</h2><form id="fPel">
    <label>Nama</label><input name="nama" required maxlength="80">
    <label>No HP${modePresale() ? "" : " (opsional)"}</label><input name="telp" inputmode="tel" maxlength="20" placeholder="08xx" ${modePresale() ? "required" : ""}>
    <label>Kota (opsional)</label><input name="kota" maxlength="60">
    <div class="err" hidden></div>
    <button class="btn primary">Simpan dan pilih</button></form>`);
  $("#lembar").onclick = null;
  $("#fPel").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const telp = f.telp.value.replace(/[^\d+]/g, "");
    if (telp && telp.replace(/\D/g, "").length < 9) { $(".err", f).textContent = "No HP terlalu pendek"; $(".err", f).hidden = false; return; }
    const p = { id: ulid(), nama: f.nama.value.trim(), telp: telp || null, kota: f.kota.value.trim() || null, oleh: A.sesi.staff.id };
    await antrekan("pelanggan", p);
    await kv.set("pelanggan", [...((await kv.get("pelanggan")) ?? []), p].slice(-500));
    A.ord.pelanggan = { id: p.id, nama: p.nama, telp: p.telp };
    simpanSesi(); tutupLembar(); gambarKatalog();
    toast("Pelanggan ditambahkan");
  };
}

// ---------- Daftar Order (pesanan disimpan dulu, dibayar nanti) ----------
// Disimpan di HP per shift: kv "order:<shift>" = [{ id, no, waktu, keranjang, ord, bayar: [] }]

const kunciOrder = () => "order:" + A.sesi.shift_id;
async function simpanDaftarOrder() { await kv.set(kunciOrder(), A.orderDaftar); }

async function nomorOrder() {
  const hari = hariIniWib();
  const n = ((await kv.get("psn:" + hari)) ?? 0) + 1;
  await kv.set("psn:" + hari, n);
  return `PSN/${hari.slice(2).replace(/-/g, "")}/${String(n).padStart(2, "0")}`;
}

// Simpan keranjang ke Daftar Order (pesanan baru, atau perbarui pesanan yang sedang dibuka).
async function simpanOrder(diam) {
  if (!A.keranjang.length) return toast("Keranjang masih kosong");
  let o = A.ord.order ? A.orderDaftar.find((x) => x.id === A.ord.order) : null;
  const { order, ...ord } = A.ord;
  if (o) Object.assign(o, { keranjang: A.keranjang, ord });
  else {
    o = { id: ulid(), no: await nomorOrder(), waktu: sekarang(), keranjang: A.keranjang, ord, bayar: [] };
    A.orderDaftar.push(o);
  }
  await simpanDaftarOrder();
  if (diam) return o;
  kosongkanKeranjang();
  toast(`Disimpan ke Daftar Order ${o.no}`);
  gambarKasir();
  return o;
}

async function hapusOrder(id) {
  A.orderDaftar = A.orderDaftar.filter((o) => o.id !== id);
  await simpanDaftarOrder();
}

function nilaiOrder(o) {
  const items = o.keranjang.map((i) => A.snap.varian[i.sku]).filter(Boolean);
  const sub = o.keranjang.reduce((a, i) => a + (A.snap.varian[i.sku]?.harga ?? 0) * i.qty, 0);
  return { n: o.keranjang.reduce((a, i) => a + i.qty, 0), sub, jenis: items.length, sudah: o.bayar.reduce((a, b) => a + b.jumlah, 0) };
}

// Daftar Order tampil sebagai tab di halaman kasir, seperti prototipe. Tab Penjualan (#kembali) kembali ke katalog.
function layarOrder(saring = "semua") {
  const daftar = A.orderDaftar.filter((o) => saring === "semua" || (saring === "belum" ? !o.bayar.length : o.bayar.length > 0));
  tampil(`<div class="kasir">${appbarKasir()}
    <div class="isi-kasir">${catatanTempat()}${tabKasir("order")}
      <div class="chips">${[["semua", "Semua"], ["belum", "Belum Bayar"], ["sebagian", "Bayar Sebagian"]].map(([k, n]) => `<button data-saring="${k}" class="${k === saring ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="order-daftar">${daftar.map((o) => { const v = nilaiOrder(o); const isi = o.keranjang.map((i) => { const x = A.snap.varian[i.sku]; return x ? `${namaBarang(x)} ×${i.qty}` : null; }).filter(Boolean).join(", ");
        return `<button data-o="${o.id}"><span class="od-atas"><span><span class="od-no">${esc(o.no)}</span><span class="od-jenis">${v.n} barang${o.ord?.pelanggan ? " · " + esc(o.ord.pelanggan.nama) : ""}</span></span>
          ${A.ord.order === o.id ? '<span class="lencana-status dibuka">Dibuka</span>' : v.sudah ? `<span class="lencana-status sebagian">Dibayar ${rp(v.sudah)}</span>` : '<span class="lencana-status">Belum Bayar</span>'}</span>
          <span class="od-isi">${esc(isi)}</span><span class="od-bawah"><span>${jam(o.waktu)}</span><b>${rp(v.sub)}</b></span></button>`; }).join("")
        || '<div class="kosong"><div class="ki">🧾</div><b>Tidak ada pesanan.</b>Pesanan yang disimpan untuk dibayar nanti muncul di sini. Hanya ada di HP ini sampai dibayar.</div>'}</div>
    </div></div>`, "order");
  pasangAppbar();
  $("#kembali").onclick = gambarKasir;
  $$("[data-saring]").forEach((b) => (b.onclick = () => layarOrder(b.dataset.saring)));
  $$("[data-o]").forEach((b) => (b.onclick = () => {
    const o = A.orderDaftar.find((x) => x.id === b.dataset.o);
    if (o.bayar.length) return bukaOrder(o);
    bukaLembar(`<h2>${esc(o.no)}</h2><div class="sub">${jam(o.waktu)} · ${nilaiOrder(o).n} barang · ${rp(nilaiOrder(o).sub)}</div><button class="btn primary" id="bukaO">Buka di keranjang</button><button class="btn danger" id="hapusO">Hapus pesanan</button>`);
    $("#lembar").onclick = async (e) => {
      if (e.target.id === "bukaO") bukaOrder(o);
      if (e.target.id === "hapusO" && confirm(`Hapus pesanan ${o.no}?`)) {
        await hapusOrder(o.id);
        if (A.ord.order === o.id) kosongkanKeranjang();
        layarOrder();
      }
    };
  }));
}

async function bukaOrder(o) {
  if (A.ord.order === o.id) return gambarKasir();
  if (A.keranjang.length) {
    if (!confirm("Keranjang sekarang disimpan dulu ke Daftar Order. Lanjut?")) return;
    await simpanOrder(true);
  }
  A.keranjang = o.keranjang.map((i) => ({ ...i }));
  A.ord = { promo: null, dilepas: false, pelanggan: null, ...o.ord, order: o.id };
  await simpanSesi();
  gambarKasir();
  if (o.bayar.length) toast(`${o.no}: sudah dibayar ${rp(o.bayar.reduce((a, b) => a + b.jumlah, 0))}, sisa ${rp(tagihan().sisa)}`);
}

// Pisah bayar: nominal bebas, atau sebagian barang (nilainya ikut promo dan pajak secara proporsional).
function lembarPisahBayar() {
  const t = tagihan();
  const pilih = {};
  const faktor = t.subtotal ? t.total / t.subtotal : 1;
  // Pisah per barang tidak bisa untuk pesanan 1 barang, atau kalau barang termurah sudah menyamai sisa tagihan.
  const nBarang = t.items.reduce((a, i) => a + i.qty, 0);
  const termurah = Math.min(...t.items.map((i) => Math.round(i.harga * faktor)));
  const bolehBarang = nBarang > 1 && termurah < t.sisa;
  if (t.sisa <= 1) return toast("Sisa tagihan terlalu kecil untuk dipisah");
  const gambar = (mode = "nominal") => {
    if (!bolehBarang) mode = "nominal";
    const nilaiBarang = () => Math.round(t.items.reduce((a, i) => a + (pilih[i.sku] ?? 0) * i.harga, 0) * (t.subtotal ? t.total / t.subtotal : 1));
    bukaLembar(`<h2>Pisah bayar</h2><div class="small muted">Sisa tagihan ${rp(t.sisa)}. Sisanya tetap di Daftar Order sampai lunas.</div>
      <div class="metode"><button data-mode="nominal" class="${mode === "nominal" ? "on" : ""}">Jumlah uang</button>${bolehBarang ? `<button data-mode="barang" class="${mode === "barang" ? "on" : ""}">Per barang</button>` : ""}</div>
      ${mode === "nominal" ? `<label>Jumlah dibayar sekarang</label><input id="nominalPisah" type="number" inputmode="numeric" min="1" max="${t.sisa - 1}">`
      : `${t.items.map((i) => `<div class="baris"><div class="isi"><b>${esc(i.nama)}</b><div class="small muted">${rp(i.harga)} · di keranjang ${i.qty}</div></div>
          <div class="qty"><button data-k="-" data-sku="${esc(i.sku)}">−</button><span>${pilih[i.sku] ?? 0}</span><button data-k="+" data-sku="${esc(i.sku)}">+</button></div></div>`).join("")}
        <div class="ok" id="nilaiPisah">Bayar ${rp(Math.min(nilaiBarang(), t.sisa))}</div>`}
      <button class="btn primary" id="lanjutPisah">Lanjut bayar</button>`);
    if ($("#nominalPisah")) batasiAngka($("#nominalPisah"), t.sisa - 1, rp);
    $("#lembar").onclick = (e) => {
      const m = e.target.dataset.mode;
      if (m) return gambar(m);
      const b = e.target.closest("button[data-sku]");
      if (b) {
        const i = t.items.find((x) => x.sku === b.dataset.sku);
        pilih[i.sku] = Math.min(i.qty, Math.max(0, (pilih[i.sku] ?? 0) + (b.dataset.k === "+" ? 1 : -1)));
        return gambar("barang");
      }
      if (e.target.id !== "lanjutPisah") return;
      const n = mode === "nominal" ? Math.round(Number($("#nominalPisah").value || 0)) : Math.min(nilaiBarang(), t.sisa);
      if (n <= 0) return toast(mode === "barang" ? "Pilih barang yang dibayar sekarang" : "Isi jumlah yang dibayar");
      if (mode === "nominal" && n >= t.sisa) return toast(`Maksimal ${rp(t.sisa - 1)}. Untuk melunasi, pakai Bayar biasa`);
      if (n >= t.sisa) { tutupLembar(); return layarBayar(); }
      tutupLembar();
      layarBayar(n);
    };
  };
  gambar();
}

// Pembayaran sebagian dicatat di pesanan Daftar Order. Transaksi baru dikirim ke server saat lunas.
async function bayarSebagian(t, bayar) {
  const o = await simpanOrder(true);
  A.ord.order = o.id;
  o.bayar.push({ metode: bayar.metode, jumlah: bayar.jumlah, ...(bayar.ref ? { ref: bayar.ref } : {}), waktu: sekarang(), oleh: A.sesi.staff.id });
  await simpanDaftarOrder();
  await simpanSesi();
  const kembali = bayar.metode === "Tunai" ? bayar.diterima - bayar.jumlah : 0;
  tampil(`<div class="sukses">
      <div class="cincin"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6100" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg></div>
      <h1>Pembayaran sebagian</h1>
      <div class="sub"><b>Diterima ${rp(bayar.jumlah)}</b>${kembali > 0 ? `<br>Kembalian ${rp(kembali)}` : ""}<br>Sisanya tetap di Daftar Order ${esc(o.no)} sampai lunas.</div>
      <div class="card" style="align-self:stretch;text-align:left;margin-top:10px">${rincianTagihan(tagihan())}</div>
      <button class="btn primary" id="lanjutBayar">Bayar sisa sekarang</button>
      <button class="btn" id="keKasir">Simpan, bayar nanti</button></div>`, "sebagian");
  $("#lanjutBayar").onclick = () => layarBayar();
  $("#keKasir").onclick = () => { kosongkanKeranjang(); gambarKasir(); };
}

// ---------- Void ----------

function lembarVoid(t) {
  bukaLembar(`<h2>Void ${esc(t.no)}</h2><div class="small muted">Transaksi dibatalkan dan tidak dihitung di penjualan. ${t.presale && t.ambil !== "Diambil" ? "" : "Stok kembali ke tempat ini."} Uang dikembalikan ke pembeli dari laci.</div>
    <label>Alasan</label><div class="daftar">${["Salah input", "Pembeli batal", "Salah metode bayar"].map((a) => `<button data-alasan="${a}">${a}</button>`).join("")}</div>`);
  $("#lembar").onclick = async (e) => {
    const alasan = e.target.closest("[data-alasan]")?.dataset.alasan;
    if (!alasan) return;
    tutupLembar();
    const data = { id: t.id, alasan, oleh: A.sesi.staff.id, waktu: sekarang(), lokasi_id: t.lokasi_id ?? A.sesi.lokasi_id,
      items: t.items.map(({ sku, qty }) => ({ sku, qty })), stok_kembali: !t.presale };
    if (pengaturan().void_pin !== false && !atasan()) {
      const ok = await pilihAtasan("void", "Setujui void", layarRiwayat);
      if (!ok) return;
      Object.assign(data, ok);
    } else data.disetujui_oleh = A.sesi.staff.id;
    await antrekan("void", data);
    await ubahTrxLokal(t, { status: "Void", void_alasan: alasan });
    A.stok = await stokTersedia(A.snap);
    toast("Transaksi di-void");
    layarRiwayat();
  };
}

// Simpan perubahan transaksi (void/retur/serah) di HP sampai terkirim, supaya tidak tertimpa data server yang lebih lama.
async function ubahTrxLokal(t, ubah) {
  const lama = (await tx("trx", "readonly", (s) => s.get(t.id))) ?? t;
  const { dariServer, ...isi } = { ...lama, ...ubah, ubahLokal: true };
  await tx("trx", "readwrite", (s) => s.put(isi));
}

// ---------- Retur barang cacat ----------

function sisaBisaRetur(t) {
  const sudah = {};
  for (const r of t.retur ?? []) for (const i of r.items ?? []) sudah[i.sku] = (sudah[i.sku] ?? 0) + i.qty;
  const per = {};
  for (const i of t.items) {
    per[i.sku] ??= { sku: i.sku, nama: i.nama, harga: i.harga, qty: 0 };
    per[i.sku].qty += i.qty;
  }
  return Object.values(per).map((x) => ({ ...x, maks: x.qty - (sudah[x.sku] ?? 0) }));
}

// Foto dikecilkan di HP (maks 1280 px, JPEG) supaya di bawah 1 MB.
async function kecilkanFoto(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.8, 0.6, 0.45]) {
    const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
    if (b && b.size < 1_000_000) return b;
  }
  throw new Error("Foto terlalu besar");
}

function layarRetur(t) {
  const sisa = sisaBisaRetur(t).filter((x) => x.maks > 0);
  const jml = {};
  let foto = null, cara = "Tukar barang", metode = "Tunai";
  const faktor = t.subtotal ? t.total / t.subtotal : 1;
  const nilai = () => Math.round(sisa.reduce((a, x) => a + (jml[x.sku] ?? 0) * x.harga, 0) * faktor);
  const gambar = () => {
    tampil(`${bar("Retur barang cacat", esc(t.no), '<button id="kembali">Kembali</button>')}
      <div class="wrap"><form class="card" id="fRetur">
        <p class="small muted">Barang cacat dicatat sebagai stok terbuang dan tidak kembali ke stok jual. Wajib disetujui Admin atau Owner.</p>
        ${sisa.map((x) => `<div class="baris"><div class="isi"><b>${esc(x.nama)}</b><div class="small muted">${rp(x.harga)} · bisa diretur ${x.maks}</div></div>
          <div class="qty"><button type="button" data-k="-" data-sku="${esc(x.sku)}">−</button><span>${jml[x.sku] ?? 0}</span><button type="button" data-k="+" data-sku="${esc(x.sku)}">+</button></div></div>`).join("")}
        <label>Kerusakan</label><textarea name="alasan" required maxlength="300" placeholder="Misalnya: jahitan lepas di bahu"></textarea>
        <label>Foto barang cacat</label><input type="file" accept="image/*" capture="environment" name="foto">
        <div class="small muted" id="infoFoto">${foto ? "Foto siap" : ""}</div>
        <label>Penyelesaian</label>
        <div class="metode"><button type="button" data-cara="Tukar barang" class="${cara === "Tukar barang" ? "on" : ""}">Tukar barang sama</button><button type="button" data-cara="Uang kembali" class="${cara === "Uang kembali" ? "on" : ""}">Uang kembali</button></div>
        ${cara === "Uang kembali" ? `<div class="metode"><button type="button" data-metode="Tunai" class="${metode === "Tunai" ? "on" : ""}">Tunai dari laci</button><button type="button" data-metode="Transfer" class="${metode === "Transfer" ? "on" : ""}">Transfer</button></div>
          <div class="warn">Uang kembali ${rp(nilai())} (harga setelah promo)</div>` : '<div class="small muted">Pembeli menerima barang yang sama dari stok tempat ini.</div>'}
        <div class="err" hidden></div>
        <button class="btn primary">Lanjut ke persetujuan</button>
      </form></div>`, "retur");
    $("#kembali").onclick = layarRiwayat;
    const f = $("#fRetur");
    f.onclick = (e) => {
      const b = e.target.closest("button[data-sku]");
      const simpanAlasan = f.alasan.value;
      if (b) {
        const x = sisa.find((y) => y.sku === b.dataset.sku);
        const n = Math.min(x.maks, Math.max(0, (jml[x.sku] ?? 0) + (b.dataset.k === "+" ? 1 : -1)));
        if (cara === "Tukar barang" && n > (jml[x.sku] ?? 0) && n > (A.stok[x.sku] ?? 0)) return toast(`Stok pengganti ${x.nama} tinggal ${A.stok[x.sku] ?? 0}`);
        jml[x.sku] = n;
      } else if (e.target.dataset.cara) cara = e.target.dataset.cara;
      else if (e.target.dataset.metode) metode = e.target.dataset.metode;
      else return;
      gambar();
      $("#fRetur").alasan.value = simpanAlasan;
    };
    f.foto.onchange = async () => {
      try { foto = await kecilkanFoto(f.foto.files[0]); $("#infoFoto").textContent = `Foto siap (${Math.round(foto.size / 1024)} KB)`; } catch (x) { toast(x.message); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $(".err", f);
      const items = sisa.filter((x) => jml[x.sku]).map((x) => ({ sku: x.sku, qty: jml[x.sku] }));
      const pesan = !items.length ? "Pilih barang yang diretur" : f.alasan.value.trim().length < 3 ? "Tulis kerusakannya" : !foto ? "Ambil foto barang cacat" : "";
      if (pesan) { err.textContent = pesan; err.hidden = false; return; }
      const alasan = f.alasan.value.trim();
      // Uang kembali tunai diambil dari laci: cek dulu uangnya cukup (server memeriksa lagi saat menerima).
      if (cara === "Uang kembali" && metode === "Tunai" && S.online && A.sesi.sesi) {
        try {
          const r = (await api("GET", `/api/pos/shift/${A.sesi.shift_id}`)).ringkasan;
          if (r.seharusnya < nilai()) { err.textContent = `Uang di laci ${rp(r.seharusnya)}, tidak cukup untuk ${rp(nilai())}. Pakai transfer`; err.hidden = false; return; }
        } catch {}
      }
      const ok = await pilihAtasan("retur", "Setujui retur", () => layarRetur(t));
      if (!ok) return;
      const data = { id: ulid(), trx_id: t.id, lokasi_id: A.sesi.lokasi_id, shift_id: A.sesi.shift_id, oleh: A.sesi.staff.id, waktu: sekarang(),
        cara, metode: cara === "Uang kembali" ? metode : null, alasan, items, ...ok };
      // Foto diunggah sekarang kalau ada sinyal; kalau tidak, disimpan di HP dan diunggah saat sinkron.
      try { data.foto = await unggahFoto(foto); } catch { await kv.set("foto:" + data.id, foto); data.foto_lokal = true; }
      await antrekan("retur", data);
      const n = nilai();
      const r = { no: "", cara, metode: data.metode, nilai: cara === "Uang kembali" ? n : 0, items, disetujui_nama: ((await kv.get("karyawan")) ?? []).find((k) => k.id === ok.disetujui_oleh)?.nama };
      await ubahTrxLokal(t, { retur: [...(t.retur ?? []), r] });
      if (cara === "Uang kembali" && metode === "Tunai") await kv.set("rtunai:" + A.sesi.shift_id, ((await kv.get("rtunai:" + A.sesi.shift_id)) ?? 0) + n);
      A.stok = await stokTersedia(A.snap);
      toast(cara === "Uang kembali" ? `Retur dicatat. Kembalikan ${rp(n)} ke pembeli` : "Retur dicatat. Serahkan barang pengganti");
      layarRiwayat();
    };
  };
  gambar();
}

async function unggahFoto(blob) {
  if (!S.online) throw new Error("offline");
  const h = { "content-type": blob.type || "image/jpeg" };
  if (S.token) h["x-perangkat"] = S.token;
  const res = await fetch("/api/pos/berkas", { method: "POST", headers: h, body: blob, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Gagal mengunggah foto");
  return (await res.json()).id;
}

// Dipanggil sinkron sebelum mengirim dokumen retur yang fotonya masih di HP.
async function unggahFotoAntrean(d) {
  const blob = await kv.get("foto:" + d.data.id);
  if (!blob) { delete d.data.foto_lokal; return true; }
  d.data.foto = await unggahFoto(blob);
  delete d.data.foto_lokal;
  await kv.set("foto:" + d.data.id, null);
  return true;
}

// ---------- Cari transaksi lama (struk) ----------

function lembarCariTrx() {
  bukaLembar(`<h2>Cari transaksi</h2><div class="small muted">Untuk retur transaksi dari shift lain. Butuh sinyal.</div>
    <input id="noCari" placeholder="HK-yymmdd-A1-0001" autocapitalize="characters" style="margin-top:10px">
    <button class="btn primary" id="cariNo">Cari</button><button class="btn" id="scanNo">📷 Scan QR di struk</button>`);
  $("#lembar").onclick = async (e) => {
    if (e.target.id === "scanNo") { const isi = await scanQr(); if (isi) bukaTrxServer(isiQrKe(isi)); return; }
    if (e.target.id === "cariNo") bukaTrxServer($("#noCari").value.trim().toUpperCase());
  };
}
const isiQrKe = (isi) => (isi.startsWith("HKPS|") ? isi.split("|")[1] : isi.trim());

async function bukaTrxServer(kunci) {
  if (!kunci) return;
  try {
    const t = (await api("GET", "/api/pos/trx/" + encodeURIComponent(kunci))).trx;
    const lokal = await tx("trx", "readonly", (s) => s.get(t.id));
    lembarDetailTrx(lokal?.ubahLokal ? lokal : { ...t, kasir_nama: t.kasir, lokasi_nama: t.lokasi, terkirim: true, dariServer: true });
  } catch (x) { toast(putus(x) ? "Butuh sinyal untuk mencari transaksi" : x.message); }
}

// ---------- Scan QR ----------

// Kamera belakang; BarcodeDetector kalau ada, kalau tidak jsQR (dimuat saat dibutuhkan). Bisa juga dari foto.
function muatJsQr() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((ok, gagal) => { const s = document.createElement("script"); s.src = "/pos-jsqr.js"; s.onload = ok; s.onerror = () => gagal(new Error("Pemindai QR belum termuat")); document.head.appendChild(s); });
}
async function bacaQrDari(sumber, w, h) {
  if ("BarcodeDetector" in window) {
    try { const r = await new BarcodeDetector({ formats: ["qr_code"] }).detect(sumber); if (r[0]) return r[0].rawValue; return null; } catch {}
  }
  await muatJsQr();
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(sumber, 0, 0, w, h);
  return jsQR(g.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
}

function scanQr() {
  return new Promise((selesai) => {
    let aliran = null, jalan = true;
    const berhenti = (isi) => { jalan = false; aliran?.getTracks().forEach((t) => t.stop()); tutupLembar(); selesai(isi); };
    bukaLembar(`<h2>Scan QR</h2><div class="small muted">Arahkan kamera ke QR di struk pembeli.</div>
      <video id="vidQr" playsinline muted style="width:100%;border-radius:12px;background:#000;margin-top:8px"></video>
      <label>Atau pilih foto QR</label><input type="file" accept="image/*" id="fotoQr">
      <button class="btn" id="batalQr">Batal</button>`);
    $("#lembar").onclick = (e) => { if (e.target.id === "batalQr") berhenti(null); };
    $("#lapis").addEventListener("click", function tutup(e) { if (e.target.id === "lapis") { $("#lapis").removeEventListener("click", tutup); berhenti(null); } });
    $("#fotoQr").onchange = async (e) => {
      try {
        const img = await createImageBitmap(e.target.files[0]);
        const s = Math.min(1, 1200 / Math.max(img.width, img.height));
        const isi = await bacaQrDari(img, Math.round(img.width * s), Math.round(img.height * s));
        if (isi) berhenti(isi); else toast("QR tidak terbaca. Coba foto lebih dekat");
      } catch (x) { toast(x.message); }
    };
    const v = $("#vidQr");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } }).then(async (s) => {
      if (!jalan) return s.getTracks().forEach((t) => t.stop());
      aliran = s;
      v.srcObject = s;
      await v.play();
      const ulang = async () => {
        if (!jalan) return;
        if (v.videoWidth) { const isi = await bacaQrDari(v, v.videoWidth, v.videoHeight).catch(() => null); if (isi) return berhenti(isi); }
        setTimeout(ulang, 300);
      };
      ulang();
    }).catch(() => { v.hidden = true; });
  });
}

// ---------- Pesanan pre-sale: serah barang ----------

async function dataPesanan() {
  const kunci = "pesanan:" + A.sesi.lokasi_id;
  let daftar = (await kv.get(kunci)) ?? [];
  if (S.online && A.sesi.sesi) {
    try { daftar = (await api("GET", `/api/pos/pesanan?lokasi=${encodeURIComponent(A.sesi.lokasi_id)}`)).pesanan; await kv.set(kunci, daftar); } catch {}
  }
  const per = new Map(daftar.map((t) => [t.id, t]));
  // Pesanan pre-sale dari HP ini yang belum terkirim, dan serah barang yang belum terkirim.
  const lokal = (await tx("trx", "readonly", (s) => s.getAll())).filter((t) => t.presale && t.lokasi_id === A.sesi.lokasi_id);
  for (const t of lokal) if (!per.has(t.id) || t.ubahLokal) per.set(t.id, { ...per.get(t.id), ...t, kasir: t.kasir_nama });
  for (const d of await isiAntrean()) if (d.jenis === "serah" && per.has(d.data.id)) per.get(d.data.id).ambil = "Diambil";
  return [...per.values()].sort((a, b) => b.waktu.localeCompare(a.waktu));
}

async function layarPesanan(kembali, tab = "Menunggu") {
  const gudang = A.sesi.lokasi_id === "gudang";
  tampil(`${bar(gudang ? "Ambil di kantor" : "Pesanan pre-sale", esc(A.snap?.lokasi?.nama ?? "Gudang Pusat"), '<button id="scan">📷 Scan QR</button><button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Memuat…</p></div>`, "pesanan");
  $("#kembali").onclick = kembali;
  const daftar = await dataPesanan();
  $("#scan").onclick = async () => {
    const isi = await scanQr();
    if (!isi) return;
    if (!isi.startsWith("HKPS|")) return toast("Bukan QR pengambilan pre-sale");
    const t = daftar.find((x) => x.id === isi.split("|")[1]);
    if (!t) return toast(gudang ? "Pesanan tidak ditemukan. Event-nya mungkin belum ditutup" : "Pesanan ini bukan untuk tempat ini");
    detailPesanan(t, kembali, true);
  };
  const STATUS = ["Menunggu", "Diambil", "Perlu Refund", "Refund"];
  const tampilkan = (q = "") => {
    const k = q.toLowerCase();
    const isi = daftar.filter((t) => (t.ambil ?? "Menunggu") === tab && (!q || `${t.no} ${t.pelanggan_nama} ${t.pelanggan_telp}`.toLowerCase().includes(k)));
    $("#hasilPsn").innerHTML = isi.map((t) => `<button data-t="${t.id}"><span class="isi"><b>${esc(t.pelanggan_nama ?? "-")}</b><br><span class="small muted">${esc(t.no)} · ${esc(t.pelanggan_telp ?? "")}</span>
      <br><span class="small">${t.items.map((i) => `${esc(i.nama)} ×${i.qty}`).join(", ")}</span>${t.ambil_batas && tab === "Menunggu" ? `<br><span class="small muted">Ambil sampai ${esc(t.ambil_batas)}</span>` : ""}</span>
      <span>${rp(t.total)}${t.terkirim === false ? '<br><span class="tag warn">belum terkirim</span>' : ""}</span></button>`).join("") || '<p class="muted">Tidak ada pesanan.</p>';
    $$("#hasilPsn [data-t]").forEach((b) => (b.onclick = () => detailPesanan(daftar.find((x) => x.id === b.dataset.t), kembali, false)));
  };
  $("#app .wrap").innerHTML = `${S.online ? "" : '<div class="warn">Offline: daftar dari data terakhir di HP ini.</div>'}
    <div class="chips">${STATUS.map((s) => `<button data-st="${s}" class="${s === tab ? "on" : ""}">${s} (${daftar.filter((t) => (t.ambil ?? "Menunggu") === s).length})</button>`).join("")}</div>
    <input type="search" id="cariPsn" placeholder="Cari nama, no HP, atau no transaksi">
    <div class="daftar" id="hasilPsn"></div>`;
  $$("[data-st]").forEach((b) => (b.onclick = () => layarPesanan(kembali, b.dataset.st)));
  $("#cariPsn").oninput = (e) => tampilkan(e.target.value.trim());
  tampilkan();
}

// QR cocok, atau verifikasi manual (4 digit terakhir no HP + PIN Admin/Owner), baru tombol Serahkan Barang muncul.
function detailPesanan(t, kembali, qrCocok) {
  const st = t.ambil ?? "Menunggu";
  bukaLembar(`<h2>${esc(t.pelanggan_nama ?? "Pesanan")}</h2>
    <div class="small muted">${esc(t.no)} · ${tglJam(t.waktu)} · ${esc(t.pelanggan_telp ?? "")}</div>
    <div class="tengah" style="text-align:center;margin:10px 0">${svgQr(isiQr(t), 3)}</div>
    <table class="rinci">${t.items.map((i) => `<tr><td>${esc(i.nama)}</td><td>×${i.qty}</td></tr>`).join("")}<tr class="tebal"><td>Total</td><td>${rp(t.total)}</td></tr></table>
    ${st !== "Menunggu" ? `<div class="warn">Status: ${esc(st)}${t.ambil_pada ? " · " + tglJam(t.ambil_pada) : ""}${t.ambil_oleh ? " oleh " + esc(t.ambil_oleh) : ""}</div>`
    : qrCocok ? `<div class="ok">QR cocok</div><button class="btn primary" id="serahkan">Serahkan Barang</button>`
    : `<button class="btn primary" id="scanIni">📷 Scan QR di Struk Pembeli</button><button class="btn" id="manual">Struk hilang? Verifikasi manual</button>`}`);
  if (st !== "Menunggu") return;
  $("#lembar").onclick = async (e) => {
    if (e.target.id === "scanIni") {
      const isi = await scanQr();
      if (!isi) return;
      if (isi !== isiQr(t) && isiQrKe(isi) !== t.id) { toast("QR tidak cocok dengan pesanan ini"); return detailPesanan(t, kembali, false); }
      return detailPesanan(t, kembali, true);
    }
    if (e.target.id === "manual") return verifikasiManual(t, kembali);
    if (e.target.id === "serahkan") serahkan(t, kembali, { cara: "QR" });
  };
}

function verifikasiManual(t, kembali) {
  bukaLembar(`<h2>Verifikasi manual</h2><div class="small muted">Tanyakan 4 digit terakhir no HP pembeli, lalu minta persetujuan PIN Admin atau Owner.</div>
    <input id="empat" inputmode="numeric" maxlength="4" placeholder="0000" style="margin-top:10px">
    <div class="err" hidden></div><button class="btn primary" id="cekEmpat">Lanjut</button>`);
  $("#lembar").onclick = async (e) => {
    if (e.target.id !== "cekEmpat") return;
    const v = $("#empat").value.replace(/\D/g, "");
    if (v.length !== 4 || !(t.pelanggan_telp ?? "").replace(/\D/g, "").endsWith(v)) { $("#lembar .err").textContent = "4 digit tidak cocok"; $("#lembar .err").hidden = false; return; }
    const ok = await pilihAtasan("presale_manual", "Setujui serah tanpa QR", () => layarPesanan(kembali));
    if (!ok) return;
    serahkan(t, kembali, { cara: "Manual", ...ok });
  };
}

async function serahkan(t, kembali, info) {
  tutupLembar();
  if (A.snap && A.sesi.lokasi_id !== "gudang") {
    for (const i of t.items) if ((A.stok[i.sku] ?? 0) < i.qty) { toast(`Stok ${i.nama} di sini tinggal ${A.stok[i.sku] ?? 0}. Terima kiriman stok dulu`); return; }
  }
  await antrekan("serah", { id: t.id, lokasi_id: A.sesi.lokasi_id, oleh: A.sesi.staff.id, waktu: sekarang(), items: t.items.map(({ sku, qty }) => ({ sku, qty })), ...info });
  const lokal = await tx("trx", "readonly", (s) => s.get(t.id));
  if (lokal) await ubahTrxLokal(lokal, { ambil: "Diambil" });
  if (A.snap) A.stok = await stokTersedia(A.snap);
  toast("Barang diserahkan");
  layarPesanan(kembali, "Diambil");
}

// Admin di Gudang Pusat: hanya serah terima pre-sale, tanpa membuka laci.
async function masukSerahGudang(t) {
  A.sesi.lokasi_id = t.id;
  A.sesi.shift_id = null;
  A.sesi.serah_saja = true;
  await simpanSesi();
  A.snap = null;
  try { A.snap = await tarikData(t.id); } catch { A.snap = await kv.get("snap:" + t.id); }
  if (A.snap) A.stok = await stokTersedia(A.snap);
  layarPesanan(async () => { A.sesi.lokasi_id = null; A.sesi.serah_saja = false; await simpanSesi(); layarTempat(); });
}
