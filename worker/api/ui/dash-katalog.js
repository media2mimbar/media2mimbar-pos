// Dashboard › Produk: Daftar Produk dan Kategori. Memakai fungsi bersama dari dashboard.html ($, esc, api, rp, ...).

let subProduk = "daftar";
let filterProduk = { cari: "", kategori: "", tampil: "semua" };

function halProduk(sub) {
  if (sub) subProduk = sub;
  ({ daftar: daftarProduk, kategori: halKategori })[subProduk]();
}

const kepalaProduk = () => `<div class="head"><div><h1>${judulMenu("produk", subProduk)}</h1></div>
  ${subProduk === "daftar" ? '<div style="display:flex;gap:8px"><button class="btn" id="hargaGudang">Harga Jual Langsung Gudang</button><button class="btn primary" id="tambahProduk">+ Tambah Produk</button></div>' : ""}</div>
  ${subtabs([["daftar", "Daftar Produk"], ["kategori", "Kategori"]], subProduk)}`;

// Foto utama di kiri nama produk, atau kotak kosong kalau belum ada foto.
const thumbProduk = (p) => (p.foto.length ? `<img class="thumb" src="${esc(p.foto[0].kecil)}" alt="" loading="lazy">` : '<span class="thumb kosong" aria-hidden="true"></span>');
// Tempat produk dijual. Toko web selalu di depan.
const dijualDi = (p) => [p.toko_web ? '<span class="tag peran">Toko web</span>' : "",
  ...p.marketplace.map((m) => `<span class="tag ${m.toko_aktif ? "" : "off"}" title="${m.toko_aktif ? "" : "Toko nonaktif"}">${esc(m.nama)}</span>`)].join("") || '<span class="muted">—</span>';

const bukaProduk = new Set();
async function daftarProduk() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const [{ produk }, { kategori }] = await Promise.all([api("GET", "/api/produk"), api("GET", "/api/kategori")]);
  const gambar = () => {
    const q = filterProduk.cari.toLowerCase();
    const tampil = produk.filter((p) => (!q || (p.nama + " " + p.sku).toLowerCase().includes(q)) && (!filterProduk.kategori || p.kategori_id === filterProduk.kategori)
      && (filterProduk.tampil === "toko_web" ? p.toko_web : filterProduk.tampil === "tanpa_foto" ? !p.foto.length : true));
    $("#tbProduk").innerHTML = tampil.length ? tampil.map((p) => {
      const harga = p.harga_min === p.harga_maks ? rp(p.harga_min) : `${rp(p.harga_min)} – ${rp(p.harga_maks)}`;
      const margin = p.harga_min > 0 ? Math.round(((p.harga_min - p.hpp) / p.harga_min) * 100) : 0;
      const menipis = p.stok <= 0 ? '<span class="tag off">Habis</span>' : p.stok < p.stok_min ? '<span class="tag warn">Menipis</span>' : "";
      return `<tr class="klik" data-id="${p.id}">
        <td><div class="produk-sel">${p.punya_varian ? `<button class="btn small" data-buka="${p.id}" title="Lihat varian" style="padding:0 6px">${bukaProduk.has(p.id) ? "▾" : "▸"}</button>` : ""}${thumbProduk(p)}
          <div><b>${esc(p.nama)}</b><div class="small muted">${esc(p.sku)} · ${esc(p.kategori || "Tanpa kategori")}${p.punya_varian ? ` · ${p.varian.filter((v) => v.aktif).length} varian` : ""}${p.foto.length ? "" : ' · <span class="teks-warn">belum ada foto</span>'}</div></div></div></td>
        <td class="num">${rp(p.hpp)}</td><td class="num">${harga}</td>
        <td class="num">${margin}%</td>
        <td class="num">${p.stok}${p.transit ? `<div class="small muted">+${p.transit} di jalan</div>` : ""} ${menipis}</td>
        <td>${dijualDi(p)}</td>
        <td><label style="margin:0" title="${p.tampil_pos ? "Tampil di POS" : "Disembunyikan dari POS"}"><input type="checkbox" class="sakelar" data-tampil="${p.id}" ${p.tampil_pos ? "checked" : ""} aria-label="Tampil di POS"></label></td>
        <td>${p.aktif ? '<span class="tag aktif">Aktif</span>' : '<span class="tag off">Nonaktif</span>'}</td>
        <td class="num"><button class="btn small" data-ubah="${p.id}">Ubah</button></td></tr>
        ${bukaProduk.has(p.id) ? p.varian.map((v) => {
          const tempat = [p.toko_web ? `Toko web ${rp(v.harga_toko_web ?? v.harga_jual)}` : "", ...v.harga_marketplace.map((m) => `${esc(m.nama)} ${rp(m.harga)}`)].filter(Boolean);
          return `<tr class="small"><td style="padding-left:40px">${esc(v.nama || v.sku)} <span class="muted">${esc(v.sku)}${v.berat_gram ? ` · ${v.berat_gram} g` : ""}${v.aktif ? "" : " · nonaktif"}</span></td><td></td>
          <td class="num">${rp(v.harga_jual)}</td><td></td><td class="num">${v.stok}</td><td colspan="4">${tempat.join(" · ") || '<span class="muted">Tidak dijual di toko web atau marketplace</span>'}</td></tr>`;
        }).join("") : ""}`;
    }).join("") : `<tr><td colspan="9" class="muted">${produk.length ? "Tidak ada produk yang cocok." : "Belum ada produk. Buat kategori dulu, lalu tambah produk."}</td></tr>`;
    $("#tbProduk").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest("[data-buka],[data-tampil],label")) formProduk(tr.dataset.id); }));
    $("#tbProduk").querySelectorAll("[data-ubah]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); formProduk(b.dataset.ubah); }));
    $("#tbProduk").querySelectorAll("[data-buka]").forEach((b) => (b.onclick = () => { bukaProduk.has(b.dataset.buka) ? bukaProduk.delete(b.dataset.buka) : bukaProduk.add(b.dataset.buka); gambar(); }));
    $("#tbProduk").querySelectorAll("[data-tampil]").forEach((c) => (c.onchange = async () => {
      try { await api("PATCH", `/api/produk/${c.dataset.tampil}/tampil`, { tampil_pos: c.checked }); produk.find((x) => x.id === c.dataset.tampil).tampil_pos = c.checked; gambar(); }
      catch (x) { c.checked = !c.checked; alert(x.message); }
    }));
  };
  const hitung = (n) => ` <span class="hitung">${n}</span>`;
  $("#isi").innerHTML = `<main>${kepalaProduk()}
    <div class="filters">
      <input type="search" id="cariProduk" placeholder="Cari nama atau SKU" value="${esc(filterProduk.cari)}">
      <select id="katProduk"><option value="">Semua kategori</option>${kategori.map((k) => `<option value="${k.id}" ${k.id === filterProduk.kategori ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
      ${pil([["semua", "Semua"], ["toko_web", "Dijual di toko web" + hitung(produk.filter((p) => p.toko_web).length)], ["tanpa_foto", "Belum ada foto" + hitung(produk.filter((p) => !p.foto.length).length)]], filterProduk.tampil, "tampilp")}
    </div>
    <div class="tablewrap"><table><thead><tr><th>Produk</th><th class="num">HPP</th><th class="num">Harga jual</th><th class="num">Margin</th><th class="num">Stok</th><th>Dijual di</th><th>Tampil di POS</th><th>Status</th><th></th></tr></thead>
    <tbody id="tbProduk"></tbody></table></div></main>`;
  pasangSubtabs(halProduk);
  $("#tambahProduk").onclick = () => formProduk(null);
  $("#hargaGudang").onclick = formHargaGudang;
  $("#cariProduk").oninput = (e) => { filterProduk.cari = e.target.value; gambar(); };
  $("#katProduk").onchange = (e) => { filterProduk.kategori = e.target.value; gambar(); };
  $("#isi").querySelectorAll("[data-tampilp]").forEach((b) => (b.onclick = () => {
    filterProduk.tampil = b.dataset.tampilp;
    $("#isi").querySelectorAll("[data-tampilp]").forEach((x) => x.classList.toggle("on", x === b));
    gambar();
  }));
  gambar();
}

// ---------- Foto produk ----------
// Foto dikecilkan di browser menjadi dua JPEG (besar 1200 px untuk halaman produk, kecil 400 px untuk daftar dan grid),
// lalu keduanya diunggah sekaligus ke R2. Foto baru terpasang ke produk setelah form disimpan.

const MAKS_FOTO_PRODUK = 9;

async function kecilkanFoto(file, maks, mutu) {
  const img = await createImageBitmap(file);
  const skala = Math.min(1, maks / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * skala));
  c.height = Math.max(1, Math.round(img.height * skala));
  const g = c.getContext("2d");
  // Latar putih supaya bagian transparan di PNG tidak menjadi hitam setelah diubah ke JPEG.
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, gagal) => c.toBlob((b) => (b ? ok(b) : gagal(new Error("Foto tidak bisa diproses"))), "image/jpeg", mutu));
}

async function unggahFotoProduk(file) {
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error(`${file.name} bukan JPG atau PNG`);
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} lebih dari 5 MB`);
  let besar, kecil;
  try { [besar, kecil] = await Promise.all([kecilkanFoto(file, 1200, 0.82), kecilkanFoto(file, 400, 0.8)]); }
  catch { throw new Error(`${file.name} tidak bisa dibuka sebagai gambar`); }
  const form = new FormData();
  form.append("besar", besar, "besar.jpg");
  form.append("kecil", kecil, "kecil.jpg");
  const res = await fetch("/api/foto?jenis=produk", { method: "POST", body: form, credentials: "same-origin" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Gagal mengunggah foto");
  return d;
}

async function formProduk(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ kategori }, detail, daftarSaluran] = await Promise.all([api("GET", "/api/kategori"), id ? api("GET", "/api/produk/" + id) : null, id ? null : api("GET", "/api/saluran")]);
  if (!kategori.length) {
    $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><div class="card"><h2>Buat kategori dulu</h2>
      <p class="muted">Setiap produk harus masuk satu kategori, misalnya Kaos, Jersey, atau Aksesoris.</p>
      <button class="btn primary" id="keKategori">Buka Kategori</button></div></div>`;
    $("#kembali").onclick = () => halProduk("daftar");
    $("#keKategori").onclick = () => halProduk("kategori");
    return;
  }
  const p = detail?.produk;
  const baru = !p;
  // Marketplace tempat produk dijual. Harga per varian ada di form yang sama; kosong berarti ikut harga jual.
  const mp = p ? detail.marketplace.map((x) => ({ ...x }))
    : daftarSaluran.saluran.filter((x) => x.marketplace).map((x) => ({ id: x.id, nama: x.nama, toko_aktif: x.aktif, dijual: false, harga: {} }));
  const hargaMpDari = (sku) => Object.fromEntries(mp.map((x) => [x.id, x.harga[sku] ?? ""]));
  // Baris varian di form. Varian lama membawa sku-nya; varian baru tanpa sku (dibuat otomatis kalau dikosongkan).
  // htw = harga toko web; kosong berarti ikut harga jual.
  let varian = p ? (p.punya_varian ? p.varian.map((v) => ({ ...v, lama: true, hm: hargaMpDari(v.sku), berat_gram: v.berat_gram ?? "", htw: v.harga_toko_web ?? "" })) : [])
    : [{ nama: "S" }, { nama: "M" }, { nama: "L" }].map((v) => ({ ...v, sku: "", harga_jual: "", stok_awal: "", aktif: true, hm: {}, berat_gram: "", foto_id: null, htw: "" }));
  // Produk tanpa varian: isian harga dan berat disimpan di sini supaya tidak hilang saat bagian harga digambar ulang.
  const v0 = p && !p.punya_varian ? p.varian[0] : null;
  const tunggal = { harga_jual: v0?.harga_jual ?? "", stok_awal: "", hm: v0 ? hargaMpDari(v0.sku) : {}, berat_gram: v0?.berat_gram ?? "", htw: v0?.harga_toko_web ?? "" };
  let pakaiVarian = p ? p.punya_varian : false;
  // Foto produk berurutan (foto pertama = foto utama) dan sakelar Toko web. Ikut tersimpan saat Simpan ditekan.
  const foto = p ? p.foto.map((x) => ({ ...x })) : [];
  let tokoWeb = p ? p.toko_web : false;
  let sedangUnggah = 0;
  let fvBuka = null; // nomor baris varian yang pilihan fotonya sedang terbuka

  $("#isi").innerHTML = `<div class="form">
    <button class="back" id="kembali">← Kembali</button>
    <h1>${baru ? "Tambah produk" : esc(p.nama)}</h1>
    <form class="card" id="fP" style="margin-top:12px" autocomplete="off">
      <div class="grid2">
        <div><label>Nama produk</label><input type="text" name="nama" value="${esc(p?.nama)}" required></div>
        <div><label>Kategori</label><select name="kategori_id" required><option value="">Pilih kategori</option>
          ${kategori.map((k) => `<option value="${k.id}" ${p?.kategori_id === k.id ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div>
        <div><label>SKU induk</label><input type="text" name="sku" value="${esc(p?.sku)}" ${baru ? "required" : "disabled"} placeholder="Misalnya KB">
          ${baru ? "" : '<p class="small muted">SKU tidak bisa diubah setelah produk dibuat.</p>'}</div>
        <div><label>Satuan</label><select name="satuan">${["Pcs", "Pack", "Set", "Box"].map((x) => `<option ${p?.satuan === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div><label>HPP (harga pokok) per ${esc(p?.satuan || "pcs")}</label><input type="number" name="hpp" min="0" value="${p?.hpp ?? ""}" required>
          <p class="small muted">Berlaku untuk semua varian. Dihitung ulang otomatis setiap ada faktur pembelian.</p></div>
        <div><label>Batas stok menipis</label><input type="number" name="stok_min" min="0" value="${p?.stok_min ?? 5}"></div>
      </div>
      <label>Foto produk</label>
      <div class="foto-produk" id="fotoProduk"></div>
      <div class="pesan-foto" id="pesanFoto" hidden></div>
      <p class="small muted">Foto pertama jadi foto utama di toko web dan link event. Seret untuk mengubah urutan. JPG atau PNG, paling besar 5 MB, sebaiknya persegi.</p>
      <label>Deskripsi</label><textarea name="deskripsi" maxlength="1000">${esc(p?.deskripsi)}</textarea>
      <p class="small muted">Tampil di halaman produk toko web. Baris baru ikut ditampilkan.</p>
      <div class="checks" style="margin-top:16px">
        <label><input type="checkbox" class="sakelar" name="tampil_pos" ${p ? (p.tampil_pos ? "checked" : "") : "checked"}> Tampil di POS</label>
        <label><input type="checkbox" class="sakelar" name="aktif" ${p ? (p.aktif ? "checked" : "") : "checked"}> Aktif</label>
        ${baru ? '<label><input type="checkbox" class="sakelar" id="pakaiVarian"> Punya varian (ukuran, warna)</label>' : ""}
      </div>
      <div id="bagianHarga"></div>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn batal" id="batal">Batal</button></div>
    </form>
    ${p ? `<div class="section"><h2>Stok per lokasi</h2><div class="tablewrap"><table><thead><tr><th>SKU</th><th>Lokasi</th><th class="num">Stok</th><th class="num">Dalam perjalanan</th></tr></thead><tbody>
      ${detail.stok_lokasi.length ? detail.stok_lokasi.map((s) => `<tr><td>${esc(s.sku)}</td><td>${esc(s.lokasi)}</td><td class="num">${s.qty}</td><td class="num">${s.transit}</td></tr>`).join("") : '<tr><td colspan="4" class="muted">Belum ada stok.</td></tr>'}
      </tbody></table></div></div>
      <div class="section"><h2>Riwayat HPP</h2><div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Sebab</th><th class="num">Lama</th><th class="num">Baru</th><th>Oleh</th></tr></thead><tbody>
      ${detail.hpp_riwayat.map((h) => `<tr><td>${waktu(h.waktu)}</td><td>${{ awal: "HPP awal", ubah_manual: "Diubah manual", faktur: "Faktur " + esc(h.faktur), batal_faktur: "Batal faktur " + esc(h.faktur) }[h.sebab]}</td>
        <td class="num">${rp(h.lama)}</td><td class="num">${rp(h.baru)}</td><td>${esc(h.oleh)}</td></tr>`).join("")}
      </tbody></table></div></div>` : ""}
  </div>`;

  const f = $("#fP");

  // Kotak foto produk: foto utama di depan, seret untuk mengubah urutan, × untuk melepas, + untuk menambah.
  const gambarFoto = () => {
    const sisa = MAKS_FOTO_PRODUK - foto.length - sedangUnggah;
    $("#fotoProduk").innerHTML = foto.map((x, i) => `<div class="fp-kotak" draggable="true" data-fi="${i}" title="Seret untuk mengubah urutan">
        <img src="${esc(x.kecil)}" alt="Foto produk ${i + 1}" draggable="false">
        <button type="button" class="fp-hapus" data-hapusfoto="${i}" aria-label="Lepas foto ${i + 1}">×</button>
        ${i === 0 ? '<span class="fp-utama">Foto utama</span>' : ""}</div>`).join("")
      + Array.from({ length: sedangUnggah }, () => '<div class="fp-kotak fp-muat">Mengunggah…</div>').join("")
      + (sisa > 0 ? `<label class="fp-kotak fp-tambah"><input type="file" id="fileFoto" accept="image/jpeg,image/png" multiple hidden><b>+</b>Tambah foto<span>${foto.length} / ${MAKS_FOTO_PRODUK}</span></label>` : "");
    let seret = null;
    $("#fotoProduk").querySelectorAll("[data-fi]").forEach((el) => {
      el.ondragstart = (e) => { seret = +el.dataset.fi; el.classList.add("seret"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", el.dataset.fi); };
      el.ondragend = () => el.classList.remove("seret");
      el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
      el.ondrop = (e) => {
        e.preventDefault();
        const dari = seret ?? Number(e.dataTransfer.getData("text/plain")), ke = +el.dataset.fi;
        if (Number.isNaN(dari) || dari === ke) return;
        foto.splice(ke, 0, foto.splice(dari, 1)[0]);
        gambarFoto();
      };
    });
    $("#fotoProduk").querySelectorAll("[data-hapusfoto]").forEach((b) => (b.onclick = () => {
      const [x] = foto.splice(+b.dataset.hapusfoto, 1);
      for (const v of varian) if (v.foto_id === x.id) v.foto_id = null;
      gambarFoto();
      gambarHarga();
    }));
    const pilihFile = $("#fileFoto");
    if (pilihFile) pilihFile.onchange = async () => {
      const files = [...pilihFile.files].slice(0, sisa);
      const pesan = $("#pesanFoto"), galat = [];
      const awal = foto.length;
      pesan.hidden = true;
      if (pilihFile.files.length > sisa) galat.push(`Hanya ${sisa} foto lagi yang bisa ditambahkan`);
      sedangUnggah += files.length;
      gambarFoto();
      // Satu per satu supaya urutan foto sama dengan urutan file yang dipilih.
      for (const file of files) {
        try { foto.push(await unggahFotoProduk(file)); } catch (x) { galat.push(x.message); }
        sedangUnggah--;
        gambarFoto();
      }
      if (galat.length) { pesan.textContent = galat.join(". "); pesan.hidden = false; }
      if (!awal && foto.length) gambarHarga(); // pilihan foto varian baru bisa dibuka setelah ada foto
    };
  };

  const dijual = () => mp.filter((x) => x.dijual);
  const pilihTempat = () => `<label>Dijual di toko web dan marketplace</label>
    <div class="checks"><label><input type="checkbox" class="sakelar" id="tokoWeb" ${tokoWeb ? "checked" : ""}> <b>Toko web 2Mimbar</b></label>
    ${mp.map((x) => `<label><input type="checkbox" class="sakelar" data-mp="${x.id}" ${x.dijual ? "checked" : ""}> ${esc(x.nama)}${x.toko_aktif ? "" : ' <span class="tag off">Toko nonaktif</span>'}</label>`).join("")}</div>
    <p class="small muted">Nyalakan tempat produk ini dijual, lalu isi harganya. Harga yang dikosongkan memakai harga jual. Toko web memakai stok Gudang Pusat, dan butuh minimal satu foto serta berat setiap varian aktif.</p>`;
  const pilihFotoVarian = (v, i) => {
    const x = foto.find((y) => y.id === v.foto_id);
    return `<td class="fv"><button type="button" class="fv-pilih" data-fv="${i}" aria-label="Foto varian ${esc(v.nama)}" ${foto.length ? "" : 'disabled title="Tambah foto produk dulu"'}>
      ${x ? `<img src="${esc(x.kecil)}" alt="">` : '<span class="fv-kosong"></span>'}<span aria-hidden="true">▾</span></button>
      ${fvBuka === i ? `<div class="fv-menu"><button type="button" class="tanpa ${v.foto_id ? "" : "on"}" data-fvset="${i}" data-foto="">Tanpa foto</button>
        ${foto.map((y, j) => `<button type="button" data-fvset="${i}" data-foto="${y.id}" class="${y.id === v.foto_id ? "on" : ""}" aria-label="Foto ${j + 1}"><img src="${esc(y.kecil)}" alt=""></button>`).join("")}</div>` : ""}</td>`;
  };
  const gambarHarga = () => {
    if (!pakaiVarian) {
      $("#bagianHarga").innerHTML = `${pilihTempat()}<div class="grid2">
        <div><label>Harga jual</label><input type="number" name="harga_jual" min="0" value="${esc(tunggal.harga_jual)}" required></div>
        ${baru ? `<div><label>Stok awal di Gudang Pusat</label><input type="number" name="stok_awal" min="0" value="${esc(tunggal.stok_awal)}" placeholder="0"></div>` : ""}
        ${tokoWeb ? `<div><label>Harga toko web</label><input type="number" min="0" id="hargaTw" value="${esc(tunggal.htw)}" placeholder="Ikut harga jual"></div>` : ""}
        ${dijual().map((x) => `<div><label>Harga ${esc(x.nama)}</label><input type="number" min="0" data-harga="${x.id}" value="${esc(tunggal.hm[x.id] ?? "")}" placeholder="Ikut harga jual"></div>`).join("")}
        <div><label>Berat (gram)</label><input type="number" min="1" max="50000" id="beratTunggal" value="${esc(tunggal.berat_gram)}" placeholder="Termasuk kemasan"></div>
      </div>${baru ? '<p class="small muted">Stok awal hanya bisa diisi sekarang. Setelah itu stok berubah lewat faktur, opname, atau kiriman.</p>' : ""}`;
      f.harga_jual.oninput = (e) => (tunggal.harga_jual = e.target.value);
      if (f.stok_awal) f.stok_awal.oninput = (e) => (tunggal.stok_awal = e.target.value);
      if ($("#hargaTw")) $("#hargaTw").oninput = (e) => (tunggal.htw = e.target.value);
      $("#beratTunggal").oninput = (e) => (tunggal.berat_gram = e.target.value);
      $("#bagianHarga").querySelectorAll("[data-harga]").forEach((el) => (el.oninput = () => (tunggal.hm[el.dataset.harga] = el.value)));
      pasangTempat();
      return;
    }
    const sku = (f.sku.value || "SKU").toUpperCase();
    const kolom = dijual();
    $("#bagianHarga").innerHTML = `${pilihTempat()}<label>Varian</label>
      <div class="tablewrap"><table class="tabel-varian"><thead><tr><th>Aktif</th><th>Foto</th><th>Nama varian</th><th>SKU</th><th class="num">Harga jual</th>${tokoWeb ? '<th class="num">Harga toko web</th>' : ""}${kolom.map((x) => `<th class="num">Harga ${esc(x.nama)}</th>`).join("")}<th class="num">Berat (gram)</th>${baru ? '<th class="num">Stok awal gudang</th>' : '<th class="num">Stok</th>'}<th></th></tr></thead>
      <tbody>${varian.map((v, i) => `<tr class="${v.aktif === false ? "redup" : ""}">
        <td><input type="checkbox" class="sakelar" data-i="${i}" data-k="aktif" ${v.aktif !== false ? "checked" : ""} aria-label="Varian ${esc(v.nama)} aktif"></td>
        ${pilihFotoVarian(v, i)}
        <td><input type="text" data-i="${i}" data-k="nama" value="${esc(v.nama)}" required></td>
        <td style="white-space:nowrap">${v.lama ? `<b>${esc(v.sku)}</b>` : `<input type="text" data-i="${i}" data-k="sku" value="${esc(v.sku)}" placeholder="${esc(sku + "-" + (v.nama || "X")).toUpperCase().replace(/[^A-Z0-9-]+/g, "-")}">`}</td>
        <td><input type="number" min="0" data-i="${i}" data-k="harga_jual" value="${v.harga_jual ?? ""}" required></td>
        ${tokoWeb ? `<td><input type="number" min="0" data-i="${i}" data-k="htw" value="${esc(v.htw)}" placeholder="${v.harga_jual ? esc(v.harga_jual) : "Harga jual"}" aria-label="Harga toko web ${esc(v.nama)}"></td>` : ""}
        ${kolom.map((x) => `<td><input type="number" min="0" data-i="${i}" data-harga="${x.id}" ${v.lama ? `data-sku="${esc(v.sku)}"` : ""} value="${esc(v.hm[x.id] ?? "")}" placeholder="${v.harga_jual ? esc(v.harga_jual) : "Harga jual"}"></td>`).join("")}
        <td><input type="number" min="1" max="50000" data-i="${i}" data-k="berat_gram" value="${esc(v.berat_gram)}" placeholder="gram" aria-label="Berat ${esc(v.nama)}"></td>
        ${baru ? `<td><input type="number" min="0" data-i="${i}" data-k="stok_awal" value="${v.stok_awal ?? ""}" placeholder="0"></td>` : `<td class="num">${v.lama ? v.stok : "—"}</td>`}
        <td>${v.lama ? "" : `<button type="button" class="btn small danger" data-hapus="${i}">Hapus</button>`}</td></tr>`).join("")}
        <tr><td colspan="${9 + kolom.length + (tokoWeb ? 1 : 0)}"><button type="button" class="btn small" id="tambahVarian">+ Varian</button></td></tr></tbody></table></div>
      <p class="small muted">Matikan Aktif untuk menyembunyikan varian dari POS, toko web, dan pesanan baru. Foto varian dipilih dari foto produk di atas. Berat termasuk kemasan, untuk menghitung ongkir. SKU yang dikosongkan dibuat otomatis dari SKU induk dan nama varian.${baru ? "" : " Varian lama tidak bisa dihapus karena mungkin sudah punya stok."}</p>`;
    $("#bagianHarga").querySelectorAll("[data-k]").forEach((el) => (el.oninput = el.onchange = () => {
      const v = varian[+el.dataset.i];
      v[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.k === "aktif") el.closest("tr").classList.toggle("redup", !el.checked);
    }));
    $("#bagianHarga").querySelectorAll("[data-harga]").forEach((el) => (el.oninput = () => (varian[+el.dataset.i].hm[el.dataset.harga] = el.value)));
    $("#bagianHarga").querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = () => { varian.splice(+b.dataset.hapus, 1); fvBuka = null; gambarHarga(); }));
    $("#bagianHarga").querySelectorAll("[data-fv]").forEach((b) => (b.onclick = () => { fvBuka = fvBuka === +b.dataset.fv ? null : +b.dataset.fv; gambarHarga(); }));
    $("#bagianHarga").querySelectorAll("[data-fvset]").forEach((b) => (b.onclick = () => { varian[+b.dataset.fvset].foto_id = b.dataset.foto || null; fvBuka = null; gambarHarga(); }));
    $("#tambahVarian").onclick = () => { varian.push({ nama: "", sku: "", harga_jual: "", stok_awal: "", aktif: true, hm: {}, berat_gram: "", foto_id: null, htw: "" }); gambarHarga(); };
    pasangTempat();
  };
  const pasangTempat = () => {
    $("#tokoWeb").onchange = (e) => { tokoWeb = e.target.checked; gambarHarga(); };
    $("#bagianHarga").querySelectorAll("[data-mp]").forEach((c) => (c.onchange = () => { mp.find((x) => x.id === c.dataset.mp).dijual = c.checked; gambarHarga(); }));
  };
  // Pilihan foto varian tertutup kalau pengguna mengeklik di luar pilihan itu.
  const tutupFv = (e) => {
    if (!document.body.contains(f)) return document.removeEventListener("click", tutupFv, true);
    if (fvBuka !== null && !e.target.closest(".fv")) { fvBuka = null; $(".fv-menu")?.remove(); }
  };
  document.addEventListener("click", tutupFv, true);
  gambarFoto();
  gambarHarga();
  if (baru) {
    $("#pakaiVarian").onchange = (e) => { pakaiVarian = e.target.checked; gambarHarga(); };
    f.sku.oninput = () => pakaiVarian && $("#bagianHarga").querySelectorAll('[data-k="sku"]').forEach((el) => {
      el.placeholder = ((f.sku.value || "SKU") + "-" + (varian[+el.dataset.i].nama || "X")).toUpperCase().replace(/[^A-Z0-9-]+/g, "-");
    });
  }
  $("#kembali").onclick = $("#batal").onclick = () => halProduk("daftar");

  // Satu tombol Simpan: data produk, foto, varian, harga toko web, dan harga marketplace dikirim bersama.
  formKirim(f, async (d) => {
    if (sedangUnggah) throw new Error("Tunggu foto selesai diunggah");
    const hargaMp = (hm) => Object.fromEntries(dijual().map((x) => [x.id, angka(hm[x.id] ?? "")]));
    const body = {
      nama: d.nama, kategori_id: d.kategori_id, satuan: d.satuan, deskripsi: d.deskripsi,
      hpp: angka(d.hpp), stok_min: angka(d.stok_min) ?? 0, tampil_pos: f.tampil_pos.checked, aktif: f.aktif.checked,
      foto: foto.map((x) => x.id), toko_web: tokoWeb,
      ...(mp.length ? { marketplace: dijual().map((x) => x.id) } : {}),
    };
    // Harga toko web hanya dikirim saat sakelarnya menyala. Kalau mati, harga yang tersimpan dibiarkan.
    if (pakaiVarian) {
      body.varian = varian.map((v) => ({
        ...(v.lama || v.sku ? { sku: v.sku } : {}), nama: v.nama, harga_jual: angka(v.harga_jual), aktif: v.aktif !== false,
        harga_marketplace: hargaMp(v.hm), berat_gram: angka(v.berat_gram), foto_id: v.foto_id || null,
        ...(tokoWeb ? { harga_toko_web: angka(v.htw) } : {}), ...(baru ? { stok_awal: angka(v.stok_awal) ?? 0 } : {}),
      }));
    } else {
      body.harga_jual = angka(d.harga_jual);
      body.harga_marketplace = hargaMp(tunggal.hm);
      body.berat_gram = angka(tunggal.berat_gram);
      if (tokoWeb) body.harga_toko_web = angka(tunggal.htw);
      if (baru) body.stok_awal = angka(d.stok_awal) ?? 0;
    }
    if (baru) {
      body.sku = d.sku;
      await api("POST", "/api/produk", body);
    } else {
      await api("PATCH", "/api/produk/" + p.id, body);
    }
    halProduk("daftar");
  });
}

// ---------- Kategori ----------

async function halKategori() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { kategori } = await api("GET", "/api/kategori");
  $("#isi").innerHTML = `<main>${kepalaProduk()}
    <form class="card" id="fKat" style="margin-bottom:16px;padding:16px">
      <div class="filters" style="margin:0">
        <input type="text" name="nama" placeholder="Nama kategori baru" required style="min-width:240px">
        <input type="number" name="urutan" placeholder="Urutan" min="0" style="width:110px">
        <label class="checks" style="margin:0"><label><input type="checkbox" class="sakelar" name="tampil_menu" checked> Tampil sebagai menu di POS</label></label>
        <button class="btn primary">Tambah</button>
      </div>
      <div class="err" hidden></div>
    </form>
    <div class="tablewrap"><table><thead><tr><th>Urutan</th><th>Nama</th><th>Menu di POS</th><th class="num">Produk</th><th></th></tr></thead><tbody>
    ${kategori.length ? kategori.map((k) => `<tr><td>${k.urutan}</td><td><b>${esc(k.nama)}</b></td><td>${k.tampil_menu ? "Ya" : '<span class="muted">Tidak</span>'}</td>
      <td class="num">${k.jumlah_produk}</td>
      <td class="num"><button class="btn small" data-ubah="${k.id}">Ubah</button> ${k.jumlah_produk ? "" : `<button class="btn small danger" data-hapus="${k.id}">Hapus</button>`}</td></tr>`).join("")
      : '<tr><td colspan="5" class="muted">Belum ada kategori.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halProduk);
  const f = $("#fKat");
  formKirim(f, async (d) => {
    await api("POST", "/api/kategori", { nama: d.nama, urutan: angka(d.urutan) ?? 0, tampil_menu: f.tampil_menu.checked });
    halKategori();
  });
  $("#isi").querySelectorAll("[data-ubah]").forEach((b) => (b.onclick = () => ubahKategori(kategori.find((k) => k.id === b.dataset.ubah))));
  $("#isi").querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = async () => {
    if (!confirm("Hapus kategori ini?")) return;
    await api("DELETE", "/api/kategori/" + b.dataset.hapus).catch((e) => alert(e.message));
    halKategori();
  }));
}

function ubahKategori(k) {
  popupForm(`<h2>Ubah kategori</h2>
    <label>Nama</label><input type="text" name="nama" value="${esc(k.nama)}" required>
    <label>Urutan</label><input type="number" name="urutan" min="0" value="${k.urutan}">
    <div class="checks" style="margin-top:14px"><label><input type="checkbox" class="sakelar" name="tampil_menu" ${k.tampil_menu ? "checked" : ""}> Tampil sebagai menu di POS</label></div>`,
    "Simpan", async (d, f) => {
      await api("PATCH", "/api/kategori/" + k.id, { nama: d.nama, urutan: angka(d.urutan) ?? 0, tampil_menu: f.tampil_menu.checked });
      halKategori();
    });
}

// Popup berisi form kecil (konfirmasi dengan isian). Tertutup lewat Batal atau setelah berhasil.
function popupForm(html, tombol, aksi) {
  $("#popupIsi").innerHTML = `<form id="fPopup">${html}<div class="err" hidden></div>
    <div class="actions"><button class="btn primary">${esc(tombol)}</button><button type="button" class="btn batal" id="batalPopup">Batal</button></div></form>`;
  $("#popup").hidden = false;
  const f = $("#fPopup");
  $("#batalPopup").onclick = () => { $("#popup").hidden = true; };
  formKirim(f, async (d) => { await aksi(d, f); $("#popup").hidden = true; });
}
