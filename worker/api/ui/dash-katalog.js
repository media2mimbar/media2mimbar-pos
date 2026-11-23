// Dashboard › Produk: Daftar Produk dan Kategori. Memakai fungsi bersama dari dashboard.html ($, esc, api, rp, ...).

let subProduk = "daftar";
let filterProduk = { cari: "", kategori: "" };

function halProduk(sub) {
  if (sub) subProduk = sub;
  ({ daftar: daftarProduk, kategori: halKategori })[subProduk]();
}

const kepalaProduk = () => `<div class="head"><div><h1>${judulMenu("produk", subProduk)}</h1></div>
  ${subProduk === "daftar" ? '<div style="display:flex;gap:8px"><button class="btn" id="hargaGudang">Harga Jual Langsung Gudang</button><button class="btn primary" id="tambahProduk">+ Tambah Produk</button></div>' : ""}</div>
  ${subtabs([["daftar", "Daftar Produk"], ["kategori", "Kategori"]], subProduk)}`;

const bukaProduk = new Set();
async function daftarProduk() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const [{ produk }, { kategori }] = await Promise.all([api("GET", "/api/produk"), api("GET", "/api/kategori")]);
  const gambar = () => {
    const q = filterProduk.cari.toLowerCase();
    const tampil = produk.filter((p) => (!q || (p.nama + " " + p.sku).toLowerCase().includes(q)) && (!filterProduk.kategori || p.kategori_id === filterProduk.kategori));
    $("#tbProduk").innerHTML = tampil.length ? tampil.map((p) => {
      const harga = p.harga_min === p.harga_maks ? rp(p.harga_min) : `${rp(p.harga_min)} – ${rp(p.harga_maks)}`;
      const margin = p.harga_min > 0 ? Math.round(((p.harga_min - p.hpp) / p.harga_min) * 100) : 0;
      const menipis = p.stok <= 0 ? '<span class="tag off">Habis</span>' : p.stok < p.stok_min ? '<span class="tag warn">Menipis</span>' : "";
      return `<tr class="klik" data-id="${p.id}">
        <td>${p.punya_varian ? `<button class="btn small" data-buka="${p.id}" title="Lihat varian" style="padding:0 6px;margin-right:6px">${bukaProduk.has(p.id) ? "▾" : "▸"}</button>` : ""}<b>${esc(p.nama)}</b><div class="small muted">${esc(p.sku)} · ${esc(p.kategori || "Tanpa kategori")}${p.punya_varian ? ` · ${p.varian.filter((v) => v.aktif).length} varian` : ""}</div></td>
        <td class="num">${rp(p.hpp)}</td><td class="num">${harga}</td>
        <td class="num">${margin}%</td>
        <td class="num">${p.stok}${p.transit ? `<div class="small muted">+${p.transit} di jalan</div>` : ""} ${menipis}</td>
        <td>${p.marketplace.map((m) => `<span class="tag ${m.toko_aktif ? "" : "off"}" title="${m.toko_aktif ? "" : "Toko nonaktif"}">${esc(m.nama)}</span>`).join("") || '<span class="muted">—</span>'}</td>
        <td><label style="margin:0" title="${p.tampil_pos ? "Tampil di POS" : "Disembunyikan dari POS"}"><input type="checkbox" class="sakelar" data-tampil="${p.id}" ${p.tampil_pos ? "checked" : ""} aria-label="Tampil di POS"></label></td>
        <td>${p.aktif ? '<span class="tag aktif">Aktif</span>' : '<span class="tag off">Nonaktif</span>'}</td>
        <td class="num"><button class="btn small" data-ubah="${p.id}">Ubah</button></td></tr>
        ${bukaProduk.has(p.id) ? p.varian.map((v) => `<tr class="small"><td style="padding-left:40px">${esc(v.nama || v.sku)} <span class="muted">${esc(v.sku)}${v.aktif ? "" : " · nonaktif"}</span></td><td></td>
          <td class="num">${rp(v.harga_jual)}</td><td></td><td class="num">${v.stok}</td><td colspan="4">${v.harga_marketplace.map((m) => `${esc(m.nama)} ${rp(m.harga)}`).join(" · ") || '<span class="muted">Tidak dijual di marketplace</span>'}</td></tr>`).join("") : ""}`;
    }).join("") : `<tr><td colspan="9" class="muted">${produk.length ? "Tidak ada produk yang cocok." : "Belum ada produk. Buat kategori dulu, lalu tambah produk."}</td></tr>`;
    $("#tbProduk").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest("[data-buka],[data-tampil],label")) formProduk(tr.dataset.id); }));
    $("#tbProduk").querySelectorAll("[data-ubah]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); formProduk(b.dataset.ubah); }));
    $("#tbProduk").querySelectorAll("[data-buka]").forEach((b) => (b.onclick = () => { bukaProduk.has(b.dataset.buka) ? bukaProduk.delete(b.dataset.buka) : bukaProduk.add(b.dataset.buka); gambar(); }));
    $("#tbProduk").querySelectorAll("[data-tampil]").forEach((c) => (c.onchange = async () => {
      try { await api("PATCH", `/api/produk/${c.dataset.tampil}/tampil`, { tampil_pos: c.checked }); produk.find((x) => x.id === c.dataset.tampil).tampil_pos = c.checked; gambar(); }
      catch (x) { c.checked = !c.checked; alert(x.message); }
    }));
  };
  $("#isi").innerHTML = `<main>${kepalaProduk()}
    <div class="filters">
      <input type="search" id="cariProduk" placeholder="Cari nama atau SKU" value="${esc(filterProduk.cari)}">
      <select id="katProduk"><option value="">Semua kategori</option>${kategori.map((k) => `<option value="${k.id}" ${k.id === filterProduk.kategori ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Produk</th><th class="num">HPP</th><th class="num">Harga jual</th><th class="num">Margin</th><th class="num">Stok</th><th>Marketplace</th><th>Tampil di POS</th><th>Status</th><th></th></tr></thead>
    <tbody id="tbProduk"></tbody></table></div></main>`;
  pasangSubtabs(halProduk);
  $("#tambahProduk").onclick = () => formProduk(null);
  $("#hargaGudang").onclick = formHargaGudang;
  $("#cariProduk").oninput = (e) => { filterProduk.cari = e.target.value; gambar(); };
  $("#katProduk").onchange = (e) => { filterProduk.kategori = e.target.value; gambar(); };
  gambar();
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
  let varian = p ? (p.punya_varian ? p.varian.map((v) => ({ ...v, lama: true, hm: hargaMpDari(v.sku) })) : [])
    : [{ nama: "S" }, { nama: "M" }, { nama: "L" }].map((v) => ({ ...v, sku: "", harga_jual: "", stok_awal: "", aktif: true, hm: {} }));
  // Produk tanpa varian: harga jual, stok awal, dan harga marketplace disimpan di sini supaya tidak hilang saat bagian harga digambar ulang.
  const tunggal = { harga_jual: p && !p.punya_varian ? p.varian[0].harga_jual : "", stok_awal: "", hm: p && !p.punya_varian ? hargaMpDari(p.varian[0].sku) : {} };
  let pakaiVarian = p ? p.punya_varian : false;

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
      <label>Deskripsi</label><textarea name="deskripsi">${esc(p?.deskripsi)}</textarea>
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
  const dijual = () => mp.filter((x) => x.dijual);
  const pilihMp = () => (mp.length ? `<label>Dijual di marketplace</label>
    <div class="checks">${mp.map((x) => `<label><input type="checkbox" class="sakelar" data-mp="${x.id}" ${x.dijual ? "checked" : ""}> ${esc(x.nama)}${x.toko_aktif ? "" : ' <span class="tag off">Toko nonaktif</span>'}</label>`).join("")}</div>
    <p class="small muted">Nyalakan marketplace tempat produk ini dijual, lalu isi harganya. Harga yang dikosongkan memakai harga jual.</p>` : "");
  const gambarHarga = () => {
    if (!pakaiVarian) {
      $("#bagianHarga").innerHTML = `${pilihMp()}<div class="grid2">
        <div><label>Harga jual</label><input type="number" name="harga_jual" min="0" value="${esc(tunggal.harga_jual)}" required></div>
        ${baru ? `<div><label>Stok awal di Gudang Pusat</label><input type="number" name="stok_awal" min="0" value="${esc(tunggal.stok_awal)}" placeholder="0"></div>` : ""}
        ${dijual().map((x) => `<div><label>Harga ${esc(x.nama)}</label><input type="number" min="0" data-harga="${x.id}" value="${esc(tunggal.hm[x.id] ?? "")}" placeholder="Ikut harga jual"></div>`).join("")}
      </div>${baru ? '<p class="small muted">Stok awal hanya bisa diisi sekarang. Setelah itu stok berubah lewat faktur, opname, atau kiriman.</p>' : ""}`;
      f.harga_jual.oninput = (e) => (tunggal.harga_jual = e.target.value);
      if (f.stok_awal) f.stok_awal.oninput = (e) => (tunggal.stok_awal = e.target.value);
      $("#bagianHarga").querySelectorAll("[data-harga]").forEach((el) => (el.oninput = () => (tunggal.hm[el.dataset.harga] = el.value)));
      pasangPilihMp();
      return;
    }
    const sku = (f.sku.value || "SKU").toUpperCase();
    const kolom = dijual();
    $("#bagianHarga").innerHTML = `${pilihMp()}<label>Varian</label>
      <div class="tablewrap"><table><thead><tr><th>Aktif</th><th>Nama varian</th><th>SKU</th><th class="num">Harga jual</th>${kolom.map((x) => `<th class="num">Harga ${esc(x.nama)}</th>`).join("")}${baru ? '<th class="num">Stok awal gudang</th>' : '<th class="num">Stok</th>'}<th></th></tr></thead>
      <tbody>${varian.map((v, i) => `<tr class="${v.aktif === false ? "redup" : ""}">
        <td><input type="checkbox" class="sakelar" data-i="${i}" data-k="aktif" ${v.aktif !== false ? "checked" : ""} aria-label="Varian ${esc(v.nama)} aktif"></td>
        <td><input type="text" data-i="${i}" data-k="nama" value="${esc(v.nama)}" required></td>
        <td style="white-space:nowrap">${v.lama ? `<b>${esc(v.sku)}</b>` : `<input type="text" data-i="${i}" data-k="sku" value="${esc(v.sku)}" placeholder="${esc(sku + "-" + (v.nama || "X")).toUpperCase().replace(/[^A-Z0-9-]+/g, "-")}">`}</td>
        <td><input type="number" min="0" data-i="${i}" data-k="harga_jual" value="${v.harga_jual ?? ""}" required></td>
        ${kolom.map((x) => `<td><input type="number" min="0" data-i="${i}" data-harga="${x.id}" ${v.lama ? `data-sku="${esc(v.sku)}"` : ""} value="${esc(v.hm[x.id] ?? "")}" placeholder="${v.harga_jual ? esc(v.harga_jual) : "Harga jual"}"></td>`).join("")}
        ${baru ? `<td><input type="number" min="0" data-i="${i}" data-k="stok_awal" value="${v.stok_awal ?? ""}" placeholder="0"></td>` : `<td class="num">${v.lama ? v.stok : "—"}</td>`}
        <td>${v.lama ? "" : `<button type="button" class="btn small danger" data-hapus="${i}">Hapus</button>`}</td></tr>`).join("")}
        <tr><td colspan="${6 + kolom.length}"><button type="button" class="btn small" id="tambahVarian">+ Varian</button></td></tr></tbody></table></div>
      <p class="small muted">Matikan Aktif untuk menyembunyikan varian dari POS dan pesanan baru. SKU yang dikosongkan dibuat otomatis dari SKU induk dan nama varian.${baru ? "" : " Varian lama tidak bisa dihapus karena mungkin sudah punya stok."}</p>`;
    $("#bagianHarga").querySelectorAll("[data-k]").forEach((el) => (el.oninput = el.onchange = () => {
      const v = varian[+el.dataset.i];
      v[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.k === "aktif") el.closest("tr").classList.toggle("redup", !el.checked);
    }));
    $("#bagianHarga").querySelectorAll("[data-harga]").forEach((el) => (el.oninput = () => (varian[+el.dataset.i].hm[el.dataset.harga] = el.value)));
    $("#bagianHarga").querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = () => { varian.splice(+b.dataset.hapus, 1); gambarHarga(); }));
    $("#tambahVarian").onclick = () => { varian.push({ nama: "", sku: "", harga_jual: "", stok_awal: "", aktif: true, hm: {} }); gambarHarga(); };
    pasangPilihMp();
  };
  const pasangPilihMp = () => $("#bagianHarga").querySelectorAll("[data-mp]").forEach((c) => (c.onchange = () => { mp.find((x) => x.id === c.dataset.mp).dijual = c.checked; gambarHarga(); }));
  gambarHarga();
  if (baru) {
    $("#pakaiVarian").onchange = (e) => { pakaiVarian = e.target.checked; gambarHarga(); };
    f.sku.oninput = () => pakaiVarian && $("#bagianHarga").querySelectorAll('[data-k="sku"]').forEach((el) => {
      el.placeholder = ((f.sku.value || "SKU") + "-" + (varian[+el.dataset.i].nama || "X")).toUpperCase().replace(/[^A-Z0-9-]+/g, "-");
    });
  }
  $("#kembali").onclick = $("#batal").onclick = () => halProduk("daftar");

  // Satu tombol Simpan: data produk, varian, dan harga marketplace dikirim bersama.
  formKirim(f, async (d) => {
    const hargaMp = (hm) => Object.fromEntries(dijual().map((x) => [x.id, angka(hm[x.id] ?? "")]));
    const body = {
      nama: d.nama, kategori_id: d.kategori_id, satuan: d.satuan, deskripsi: d.deskripsi,
      hpp: angka(d.hpp), stok_min: angka(d.stok_min) ?? 0, tampil_pos: f.tampil_pos.checked, aktif: f.aktif.checked,
      ...(mp.length ? { marketplace: dijual().map((x) => x.id) } : {}),
    };
    if (pakaiVarian) {
      body.varian = varian.map((v) => ({
        ...(v.lama || v.sku ? { sku: v.sku } : {}), nama: v.nama, harga_jual: angka(v.harga_jual), aktif: v.aktif !== false,
        harga_marketplace: hargaMp(v.hm), ...(baru ? { stok_awal: angka(v.stok_awal) ?? 0 } : {}),
      }));
    } else {
      body.harga_jual = angka(d.harga_jual);
      body.harga_marketplace = hargaMp(tunggal.hm);
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
