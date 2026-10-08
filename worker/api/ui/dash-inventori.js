// Dashboard › Inventori: Faktur Pembelian, Daftar Pemasok, Daftar Stok.

let subInv = "faktur";
let tabFaktur = "Semua";
let draftFaktur = null; // isian faktur yang sedang dibuat, supaya tidak hilang saat menambah pemasok baru
let filterStok = { cari: "", kategori: "", minimum: false, tab: "lokasi", dari: "", sampai: "" };

function halInventori(sub) {
  if (sub) subInv = sub;
  ({ faktur: daftarFaktur, pemasok: daftarPemasok, stok: daftarStok })[subInv]();
}

const kepalaInv = (tombol = "") => `<div class="head"><div><h1>Inventori</h1></div>${tombol}</div>
  ${subtabs([["faktur", "Faktur Pembelian"], ["pemasok", "Daftar Pemasok"], ["stok", "Daftar Stok"]], subInv)}`;

const WARNA_STATUS = { Lunas: "aktif", "Belum lunas": "warn", "Lewat jatuh tempo": "off", Dibatalkan: "" };
const tagStatus = (s) => `<span class="tag ${WARNA_STATUS[s]}">${esc(s)}</span>`;

// ---------- Faktur ----------

async function daftarFaktur() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { faktur, ringkasan } = await api("GET", "/api/faktur");
  const tabs = ["Semua", "Belum lunas", "Lewat jatuh tempo", "Lunas", "Dibatalkan"];
  const tampil = faktur.filter((f) => tabFaktur === "Semua" || f.status === tabFaktur || (tabFaktur === "Belum lunas" && f.status === "Lewat jatuh tempo"));
  $("#isi").innerHTML = `<main>${kepalaInv('<button class="btn primary" id="tambahFaktur">+ Faktur</button>')}
    <div class="kpis">
      <div class="kpi"><span class="muted small">Pembelian bulan ini</span><b>${rp(ringkasan.beli_bulan_ini)}</b></div>
      <div class="kpi"><span class="muted small">Belum dibayar</span><b>${rp(ringkasan.belum_dibayar)}</b></div>
      <div class="kpi"><span class="muted small">Lewat jatuh tempo</span><b style="color:var(--danger-text)">${rp(ringkasan.lewat_jatuh_tempo)}</b></div>
      <div class="kpi"><span class="muted small">Jatuh tempo 7 hari ke depan</span><b>${rp(ringkasan.jatuh_tempo_7_hari)}</b></div>
    </div>
    <div class="filters">${tabs.map((t) => `<button class="btn small ${t === tabFaktur ? "primary" : ""}" data-tabf="${t}">${t}</button>`).join("")}</div>
    <div class="tablewrap"><table><thead><tr><th>Tanggal</th><th>No. Faktur</th><th>Pemasok</th><th class="num">Barang</th><th class="num">Total</th><th class="num">Sisa bayar</th><th>Jatuh tempo</th><th>Status</th></tr></thead><tbody>
    ${tampil.length ? tampil.map((f) => `<tr class="klik" data-id="${f.id}"><td>${tgl(f.tanggal)}</td><td><b>${esc(f.no)}</b></td><td>${esc(f.pemasok)}</td>
      <td class="num">${f.jumlah_barang} pcs</td><td class="num">${rp(f.total)}</td><td class="num">${f.sisa ? rp(f.sisa) : "—"}</td>
      <td>${f.jatuh_tempo ? tgl(f.jatuh_tempo) : "—"}</td><td>${tagStatus(f.status)}</td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Belum ada faktur di tab ini.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halInventori);
  $("#isi").querySelectorAll("[data-tabf]").forEach((b) => (b.onclick = () => { tabFaktur = b.dataset.tabf; daftarFaktur(); }));
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => detailFaktur(tr.dataset.id)));
  $("#tambahFaktur").onclick = () => { draftFaktur = null; formFaktur(); };
}

async function formFaktur() {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ pemasok }, { produk }] = await Promise.all([api("GET", "/api/pemasok"), api("GET", "/api/produk")]);
  const skuList = produk.flatMap((p) => p.varian.filter((v) => v.aktif || !p.punya_varian).map((v) => ({
    sku: v.sku, nama: p.nama + (v.nama ? " · " + v.nama : ""), hpp: p.hpp, satuan: p.satuan, aktif: p.aktif,
  })));
  const d = (draftFaktur ??= { tanggal: hariIni(), pemasok_id: "", item: [], status_bayar: "lunas", cara: "Transfer", jatuh_tempo: "", uang_muka: "", catatan: "" });

  const gambar = () => {
    const total = d.item.reduce((a, i) => a + (angka(i.qty) || 0) * (angka(i.harga) || 0), 0);
    $("#isi").innerHTML = `<div class="form">
      <button class="back" id="kembali">← Kembali</button>
      <h1>Faktur pembelian baru</h1>
      <p class="muted">Barang dari pemasok selalu masuk Gudang Pusat. Nomor faktur dibuat otomatis saat disimpan.</p>
      <form class="card" id="fF" style="margin-top:12px" autocomplete="off">
        <div class="grid2">
          <div><label>Tanggal</label><input type="date" name="tanggal" value="${esc(d.tanggal)}" required></div>
          <div><label>Pemasok</label><select name="pemasok_id" required><option value="">Pilih pemasok</option>
            ${pemasok.map((p) => `<option value="${p.id}" ${p.id === d.pemasok_id ? "selected" : ""}>${esc(p.nama)}</option>`).join("")}</select>
            <p class="small"><a href="#" id="pemasokBaru">+ Tambah pemasok baru</a></p></div>
        </div>
        <label>Barang</label>
        <div class="tablewrap"><table><thead><tr><th>Produk</th><th class="num" style="width:120px">Jumlah</th><th class="num" style="width:170px">Harga beli</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>
          ${d.item.map((i, n) => { const s = skuList.find((x) => x.sku === i.sku); return `<tr>
            <td><b>${esc(s?.nama ?? i.sku)}</b><div class="small muted">${esc(i.sku)} · HPP sekarang ${rp(s?.hpp)}</div></td>
            <td><input type="number" min="1" data-n="${n}" data-k="qty" value="${esc(i.qty)}" required></td>
            <td><input type="number" min="0" data-n="${n}" data-k="harga" value="${esc(i.harga)}" required></td>
            <td class="num" data-subtotal="${n}">${rp((angka(i.qty) || 0) * (angka(i.harga) || 0))}</td>
            <td><button type="button" class="btn small danger" data-hapus="${n}">Hapus</button></td></tr>`; }).join("")}
          <tr><td colspan="5"><button type="button" class="btn small" id="tambahBarang">+ Produk</button></td></tr>
        </tbody><tfoot><tr><td colspan="3">Total</td><td class="num" id="totalF">${rp(total)}</td><td></td></tr></tfoot></table></div>
        <label>Status bayar</label>
        <div class="checks">
          <label><input type="radio" name="status_bayar" value="lunas" ${d.status_bayar === "lunas" ? "checked" : ""}> Lunas sekarang</label>
          <label><input type="radio" name="status_bayar" value="nanti" ${d.status_bayar === "nanti" ? "checked" : ""}> Bayar nanti</label>
        </div>
        <div class="grid2">
          <div><label>Cara bayar</label><select name="cara">${["Transfer", "Tunai", "Lainnya"].map((c) => `<option ${c === d.cara ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          ${d.status_bayar === "nanti" ? `<div><label>Jatuh tempo</label><input type="date" name="jatuh_tempo" value="${esc(d.jatuh_tempo)}" required></div>
            <div><label>Uang muka (opsional)</label><input type="number" min="0" name="uang_muka" value="${esc(d.uang_muka)}"></div>` : ""}
        </div>
        <label>Catatan</label><textarea name="catatan">${esc(d.catatan)}</textarea>
        <div class="err" hidden></div>
        <div class="actions"><button class="btn primary">Simpan faktur</button><button type="button" class="btn" id="batal">Batal</button></div>
      </form></div>`;
    const f = $("#fF");
    // Simpan isian ke draft setiap berubah, supaya tetap ada saat form digambar ulang.
    f.oninput = f.onchange = (e) => {
      const el = e.target;
      if (el.dataset.k) {
        d.item[+el.dataset.n][el.dataset.k] = el.value;
        const i = d.item[+el.dataset.n];
        $(`[data-subtotal="${el.dataset.n}"]`).textContent = rp((angka(i.qty) || 0) * (angka(i.harga) || 0));
        $("#totalF").textContent = rp(d.item.reduce((a, x) => a + (angka(x.qty) || 0) * (angka(x.harga) || 0), 0));
      } else if (el.name) {
        d[el.name] = el.value;
        if (el.name === "status_bayar") gambar();
      }
    };
    $("#isi").querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = () => { d.item.splice(+b.dataset.hapus, 1); gambar(); }));
    $("#tambahBarang").onclick = () => pilihProduk(skuList, d.item.map((i) => i.sku), (dipilih) => {
      const ada = new Map(d.item.map((i) => [i.sku, i]));
      d.item = dipilih.map((sku) => ada.get(sku) ?? { sku, qty: "", harga: String(skuList.find((x) => x.sku === sku)?.hpp || "") });
      gambar();
    });
    $("#pemasokBaru").onclick = (e) => { e.preventDefault(); formPemasok(null, formFaktur); };
    $("#kembali").onclick = $("#batal").onclick = () => { draftFaktur = null; halInventori("faktur"); };
    formKirim(f, async () => {
      if (!d.item.length) throw new Error("Tambahkan minimal satu barang");
      const r = await api("POST", "/api/faktur", {
        tanggal: d.tanggal, pemasok_id: d.pemasok_id, status_bayar: d.status_bayar, cara: d.cara,
        jatuh_tempo: d.status_bayar === "nanti" ? d.jatuh_tempo : undefined,
        uang_muka: d.status_bayar === "nanti" ? angka(d.uang_muka) ?? 0 : undefined,
        catatan: d.catatan, item: d.item.map((i) => ({ sku: i.sku, qty: angka(i.qty), harga: angka(i.harga) })),
      });
      draftFaktur = null;
      detailFaktur(r.id);
    });
  };
  gambar();
}

// Halaman pilih produk: centang, cari, Batal/Simpan (PRD keputusan 53).
function pilihProduk(daftar, terpilih, simpan) {
  const pilih = new Set(terpilih);
  $("#isi").innerHTML = `<div class="form"><h1>Pilih produk</h1>
    <div class="card" style="margin-top:12px">
      <input type="search" id="cariPilih" placeholder="Cari nama atau SKU">
      <div class="pilih" id="daftarPilih"></div>
      <div class="actions"><button class="btn primary" id="simpanPilih">Simpan</button><button class="btn" id="batalPilih">Batal</button><span class="muted" id="jumlahPilih"></span></div>
    </div></div>`;
  const gambar = () => {
    const q = $("#cariPilih").value.toLowerCase();
    $("#daftarPilih").innerHTML = daftar.filter((x) => !q || (x.nama + " " + x.sku).toLowerCase().includes(q)).map((x) => `<label>
      <input type="checkbox" value="${esc(x.sku)}" ${pilih.has(x.sku) ? "checked" : ""}><span><b>${esc(x.nama)}</b> <span class="small muted">${esc(x.sku)}${x.aktif ? "" : " · produk nonaktif"}</span></span></label>`).join("")
      || '<p class="muted" style="padding:12px">Tidak ada produk. Tambahkan dulu di menu Produk.</p>';
    $("#jumlahPilih").textContent = `${pilih.size} dipilih`;
  };
  $("#daftarPilih").onchange = (e) => { e.target.checked ? pilih.add(e.target.value) : pilih.delete(e.target.value); $("#jumlahPilih").textContent = `${pilih.size} dipilih`; };
  $("#cariPilih").oninput = gambar;
  $("#batalPilih").onclick = () => simpan(terpilih);
  // Urutan: yang sudah ada tetap di atas, yang baru dipilih menyusul sesuai urutan daftar.
  $("#simpanPilih").onclick = () => simpan([...terpilih.filter((s) => pilih.has(s)), ...daftar.map((x) => x.sku).filter((s) => pilih.has(s) && !terpilih.includes(s))]);
  gambar();
}

async function detailFaktur(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const { faktur: f, item, bayar, hpp } = await api("GET", "/api/faktur/" + id);
  $("#isi").innerHTML = `<div class="form">
    <button class="back" id="kembali">← Kembali</button>
    <div class="head"><div><h1>${esc(f.no)}</h1><div class="muted">${tgl(f.tanggal)} · ${esc(f.pemasok)} · dicatat ${esc(f.dibuat_oleh)}</div></div>${tagStatus(f.status)}</div>
    ${f.batal ? `<div class="err">Dibatalkan ${waktu(f.batal_pada)} oleh ${esc(f.batal_oleh)}: ${esc(f.batal_alasan)}${f.dibayar ? `<br>Uang yang sudah dibayar ${rp(f.dibayar)} perlu diminta kembali ke pemasok.` : ""}</div>` : ""}
    <div class="kpis" style="margin-top:16px">
      <div class="kpi"><span class="muted small">Total</span><b>${rp(f.total)}</b></div>
      <div class="kpi"><span class="muted small">Sudah dibayar</span><b>${rp(f.dibayar)}</b></div>
      <div class="kpi"><span class="muted small">Sisa</span><b>${rp(f.sisa)}</b></div>
      <div class="kpi"><span class="muted small">Jatuh tempo</span><b>${f.jatuh_tempo ? tgl(f.jatuh_tempo) : "—"}</b></div>
    </div>
    <h2>Barang (masuk Gudang Pusat)</h2>
    <div class="tablewrap"><table><thead><tr><th>Produk</th><th>SKU</th><th class="num">Jumlah</th><th class="num">Harga beli</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${item.map((i) => `<tr><td>${esc(i.produk)}${i.varian ? " · " + esc(i.varian) : ""}</td><td>${esc(i.sku)}</td><td class="num">${i.qty} ${esc(i.satuan)}</td><td class="num">${rp(i.harga)}</td><td class="num">${rp(i.qty * i.harga)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="section"><h2>Perubahan HPP</h2><div class="tablewrap"><table><thead><tr><th>Produk</th><th></th><th class="num">Sebelum</th><th class="num">Sesudah</th></tr></thead><tbody>
      ${hpp.map((h) => `<tr><td>${esc(h.produk)}</td><td>${h.sebab === "faktur" ? "Faktur dicatat" : "Faktur dibatalkan"}</td><td class="num">${rp(h.lama)}</td><td class="num">${rp(h.baru)}</td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="section"><h2>Riwayat pembayaran</h2><div class="tablewrap"><table><thead><tr><th>Tanggal</th><th class="num">Jumlah</th><th>Cara</th><th>Catatan</th><th>Oleh</th></tr></thead><tbody>
      ${bayar.length ? bayar.map((b) => `<tr><td>${tgl(b.tanggal)}</td><td class="num">${rp(b.jumlah)}</td><td>${esc(b.cara)}</td><td>${esc(b.catatan)}</td><td>${esc(b.oleh)}</td></tr>`).join("") : '<tr><td colspan="5" class="muted">Belum ada pembayaran.</td></tr>'}
    </tbody></table></div></div>
    ${f.batal ? "" : `<div class="actions">${f.sisa > 0 ? '<button class="btn primary" id="catatBayar">Catat pembayaran</button>' : ""}<button class="btn danger" id="batalkan">Batalkan faktur</button></div>`}
  </div>`;
  $("#kembali").onclick = () => halInventori("faktur");
  if ($("#catatBayar")) $("#catatBayar").onclick = () => {
    popupForm(`<h2>Catat pembayaran</h2><p class="muted">Sisa tagihan ${rp(f.sisa)}</p>
      <label>Jumlah</label><div style="display:flex;gap:8px"><input type="number" name="jumlah" min="1" max="${f.sisa}" required><button type="button" class="btn" id="isiSisa">Isi sisa</button></div>
      <label>Tanggal</label><input type="date" name="tanggal" value="${hariIni()}" required>
      <label>Cara bayar</label><select name="cara"><option>Transfer</option><option>Tunai</option><option>Lainnya</option></select>
      <label>Catatan</label><input type="text" name="catatan">`, "Simpan", async (d) => {
      await api("POST", `/api/faktur/${id}/bayar`, { ...d, jumlah: angka(d.jumlah) });
      detailFaktur(id);
    });
    const j = $("#fPopup").jumlah;
    $("#isiSisa").onclick = () => { j.value = f.sisa; };
    j.oninput = () => { if (angka(j.value) > f.sisa) j.value = f.sisa; };
  };
  if ($("#batalkan")) $("#batalkan").onclick = () => popupForm(`<h2>Batalkan ${esc(f.no)}?</h2>
    <p class="muted">Stok Gudang Pusat dikurangi lagi dan HPP dihitung mundur. Hanya bisa kalau semua barangnya masih ada di gudang.${f.dibayar ? ` Uang ${rp(f.dibayar)} yang sudah dibayar perlu diminta kembali ke pemasok.` : ""}</p>
    <label>Alasan</label><textarea name="alasan" required minlength="5"></textarea>`, "Batalkan faktur", async (d) => {
    await api("POST", `/api/faktur/${id}/batal`, { alasan: d.alasan });
    detailFaktur(id);
  });
}

// ---------- Pemasok ----------

async function daftarPemasok() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { pemasok } = await api("GET", "/api/pemasok");
  $("#isi").innerHTML = `<main>${kepalaInv('<button class="btn primary" id="tambahPemasok">+ Pemasok</button>')}
    <div class="tablewrap"><table><thead><tr><th>Nama</th><th>Telepon</th><th>Barang</th><th class="num">Faktur</th><th class="num">Total pembelian</th><th class="num">Belum dibayar</th></tr></thead><tbody>
    ${pemasok.length ? pemasok.map((p) => `<tr class="klik" data-id="${p.id}"><td><b>${esc(p.nama)}</b></td><td>${esc(p.telp)}</td><td>${esc(p.barang) || "—"}</td>
      <td class="num">${p.jumlah_faktur}</td><td class="num">${rp(p.total_beli)}</td><td class="num">${p.sisa ? rp(p.sisa) : "—"}</td></tr>`).join("")
      : '<tr><td colspan="6" class="muted">Belum ada pemasok.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halInventori);
  $("#tambahPemasok").onclick = () => formPemasok(null, daftarPemasok);
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => formPemasok(pemasok.find((p) => p.id === tr.dataset.id), daftarPemasok)));
}

function formPemasok(p, selesai) {
  $("#isi").innerHTML = `<div class="form">
    <button class="back" id="kembali">← Kembali</button>
    <h1>${p ? "Ubah pemasok" : "Tambah pemasok"}</h1>
    <form class="card" id="fPm" style="margin-top:12px" autocomplete="off">
      <div class="grid2">
        <div><label>Nama</label><input type="text" name="nama" value="${esc(p?.nama)}" required></div>
        <div><label>Telepon</label><input type="tel" name="telp" value="${esc(p?.telp)}" required></div>
      </div>
      <label>Alamat</label><textarea name="alamat">${esc(p?.alamat)}</textarea>
      <div class="grid2">
        <div><label>Barang yang dipasok</label><input type="text" name="barang" value="${esc(p?.barang)}" placeholder="Misalnya kaos, totebag"></div>
        <div><label>Rekening</label><input type="text" name="rekening" value="${esc(p?.rekening)}" placeholder="Bank, nomor, atas nama"></div>
      </div>
      <label>Catatan</label><textarea name="catatan">${esc(p?.catatan)}</textarea>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batal">Batal</button></div>
    </form></div>`;
  $("#kembali").onclick = $("#batal").onclick = () => selesai();
  formKirim($("#fPm"), async (d) => {
    const r = p ? await api("PATCH", "/api/pemasok/" + p.id, d) : await api("POST", "/api/pemasok", d);
    if (!p && draftFaktur && selesai === formFaktur) draftFaktur.pemasok_id = r.id;
    selesai();
  });
}

// ---------- Daftar Stok ----------

async function daftarStok() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const [{ lokasi, stok }, { kategori }] = await Promise.all([api("GET", "/api/stok"), api("GET", "/api/kategori")]);
  $("#isi").innerHTML = `<main>${kepalaInv('<button class="btn" id="unduhStok">Unduh CSV</button>')}
    <div class="filters">
      <button class="btn small ${filterStok.tab === "lokasi" ? "primary" : ""}" data-tabs="lokasi">Per lokasi</button>
      <button class="btn small ${filterStok.tab === "gerak" ? "primary" : ""}" data-tabs="gerak">Pergerakan</button>
    </div>
    <div id="isiStok"></div></main>`;
  pasangSubtabs(halInventori);
  $("#isi").querySelectorAll("[data-tabs]").forEach((b) => (b.onclick = () => { filterStok.tab = b.dataset.tabs; daftarStok(); }));
  const namaBaris = (s) => s.produk + (s.varian ? " · " + s.varian : "");

  if (filterStok.tab === "gerak") return pergerakanStok(stok, namaBaris);

  const saring = () => {
    const q = filterStok.cari.toLowerCase();
    return stok.filter((s) => (s.aktif || s.total) && (!q || (namaBaris(s) + " " + s.sku).toLowerCase().includes(q))
      && (!filterStok.kategori || s.kategori_id === filterStok.kategori) && (!filterStok.minimum || s.status !== "Aman"));
  };
  const gambar = () => {
    const rows = saring();
    const jumlah = (f) => rows.reduce((a, s) => a + f(s), 0);
    $("#tbStok").innerHTML = rows.length ? rows.map((s) => `<tr><td><b>${esc(namaBaris(s))}</b><div class="small muted">${esc(s.sku)} · ${esc(s.kategori || "")}</div></td>
      ${lokasi.map((l) => `<td class="num">${s.per_lokasi[l.id] ?? 0}</td>`).join("")}<td class="num">${s.transit}</td><td class="num"><b>${s.total}</b></td>
      <td class="num">${s.stok_min}</td><td>${s.status === "Aman" ? '<span class="tag aktif">Aman</span>' : s.status === "Habis" ? '<span class="tag off">Habis</span>' : '<span class="tag warn">Di bawah minimum</span>'}</td></tr>`).join("")
      : `<tr><td colspan="${lokasi.length + 5}" class="muted">Tidak ada barang.</td></tr>`;
    $("#tfStok").innerHTML = `<tr><td>Total</td>${lokasi.map((l) => `<td class="num">${jumlah((s) => s.per_lokasi[l.id] ?? 0)}</td>`).join("")}
      <td class="num">${jumlah((s) => s.transit)}</td><td class="num">${jumlah((s) => s.total)}</td><td colspan="2" class="num">Nilai ${rp(jumlah((s) => s.nilai))}</td></tr>`;
  };
  $("#isiStok").innerHTML = `<div class="filters">
      <input type="search" id="cariStok" placeholder="Cari nama atau SKU" value="${esc(filterStok.cari)}">
      <select id="katStok"><option value="">Semua kategori</option>${kategori.map((k) => `<option value="${k.id}" ${k.id === filterStok.kategori ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
      <label class="checks" style="margin:0"><label><input type="checkbox" id="minStok" ${filterStok.minimum ? "checked" : ""}> Hanya di bawah stok minimum</label></label>
    </div>
    <div class="tablewrap"><table><thead><tr><th>Barang</th>${lokasi.map((l) => `<th class="num">${esc(l.nama)}</th>`).join("")}<th class="num">Dalam perjalanan</th><th class="num">Total</th><th class="num">Stok min</th><th>Status</th></tr></thead>
    <tbody id="tbStok"></tbody><tfoot id="tfStok"></tfoot></table></div>`;
  $("#cariStok").oninput = (e) => { filterStok.cari = e.target.value; gambar(); };
  $("#katStok").onchange = (e) => { filterStok.kategori = e.target.value; gambar(); };
  $("#minStok").onchange = (e) => { filterStok.minimum = e.target.checked; gambar(); };
  $("#unduhStok").onclick = () => unduhCsv(`stok-${hariIni()}.csv`, [
    ["SKU", "Barang", "Kategori", ...lokasi.map((l) => l.nama), "Dalam perjalanan", "Total", "Stok min", "Status", "HPP", "Nilai"],
    ...saring().map((s) => [s.sku, namaBaris(s), s.kategori, ...lokasi.map((l) => s.per_lokasi[l.id] ?? 0), s.transit, s.total, s.stok_min, s.status, s.hpp, s.nilai]),
  ]);
  gambar();
}

async function pergerakanStok(stok, namaBaris) {
  if (!filterStok.dari) { filterStok.dari = hariIni().slice(0, 8) + "01"; filterStok.sampai = hariIni(); }
  const g = await api("GET", `/api/stok/gerak?dari=${filterStok.dari}&sampai=${filterStok.sampai}`);
  const total = new Map(stok.map((s) => [s.sku, s.total]));
  const JENIS = { awal: "Stok awal", faktur: "Faktur", batal_faktur: "Batal faktur", kirim_keluar: "Dikirim", kirim_masuk: "Diterima", jual: "Terjual", void: "Void",
    retur_tukar: "Retur tukar", rusak: "Rusak", opname: "Opname", terbuang: "Terbuang", tarik: "Ditarik", presale_serah: "Pre-sale diserahkan", transit: "Transit" };
  $("#isiStok").innerHTML = `<form class="filters" id="fGerak">
      <label style="margin:0">Dari</label><input type="date" name="dari" value="${filterStok.dari}">
      <label style="margin:0">Sampai</label><input type="date" name="sampai" value="${filterStok.sampai}">
      <button class="btn small primary">Terapkan</button>
    </form>
    <div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">Masuk (pembelian)</th><th class="num">Dikirim ke event</th><th class="num">Terjual</th><th class="num">Hilang & rusak</th><th class="num">Stok sekarang</th></tr></thead><tbody>
    ${g.ringkas.length ? g.ringkas.map((r) => `<tr class="klik" data-sku="${esc(r.sku)}"><td><b>${esc(r.nama)}</b><div class="small muted">${esc(r.sku)}</div></td>
      <td class="num">${r.masuk}</td><td class="num">${r.dikirim}</td><td class="num">${r.terjual}</td><td class="num">${r.hilang_rusak}</td><td class="num">${total.get(r.sku) ?? 0}</td></tr>`).join("")
      : '<tr><td colspan="6" class="muted">Tidak ada pergerakan di rentang ini.</td></tr>'}
    </tbody></table></div><div id="rincianGerak"></div>`;
  $("#fGerak").onsubmit = (e) => { e.preventDefault(); filterStok.dari = e.target.dari.value; filterStok.sampai = e.target.sampai.value; daftarStok(); };
  $("#unduhStok").onclick = () => unduhCsv(`pergerakan-${filterStok.dari}-${filterStok.sampai}.csv`, [
    ["SKU", "Barang", "Masuk", "Dikirim", "Terjual", "Hilang & rusak", "Stok sekarang"],
    ...g.ringkas.map((r) => [r.sku, r.nama, r.masuk, r.dikirim, r.terjual, r.hilang_rusak, total.get(r.sku) ?? 0]),
  ]);
  $("#isiStok").querySelectorAll("tr[data-sku]").forEach((tr) => (tr.onclick = async () => {
    const r = await api("GET", `/api/stok/gerak?dari=${filterStok.dari}&sampai=${filterStok.sampai}&sku=${encodeURIComponent(tr.dataset.sku)}`);
    $("#rincianGerak").innerHTML = `<div class="section"><h2>Rincian ${esc(tr.dataset.sku)}</h2><div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Jenis</th><th>Lokasi</th><th class="num">Jumlah</th><th>Dokumen</th><th>Oleh</th></tr></thead><tbody>
      ${r.rincian.map((x) => `<tr><td>${waktu(x.waktu)}</td><td>${JENIS[x.jenis] ?? esc(x.jenis)}</td><td>${esc(x.lokasi)}</td><td class="num">${x.jumlah > 0 ? "+" : ""}${x.jumlah}</td><td>${esc(x.faktur) || "—"}</td><td>${esc(x.oleh)}</td></tr>`).join("")}
    </tbody></table></div></div>`;
    $("#rincianGerak").scrollIntoView({ behavior: "smooth" });
  }));
}
