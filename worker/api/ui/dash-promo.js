// Dashboard › Promosi, Pesanan Pre-sale, dan Inventori › Stok Terbuang.

// ---------- Promosi ----------

const JENIS_PROMO = { persen: "Potongan %", nominal: "Potongan Rp", bonus: "Bonus produk", bundling: "Bundling" };
const WARNA_PROMO = { Aktif: "aktif", Terjadwal: "warn", Berakhir: "", Draf: "", "Tidak Aktif": "off" };
const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

let filterPromo = { jenis: "", status: "" };
const jenisTampil = (p) => (p.cakupan === "total" ? "Total belanja" : p.jenis === "bonus" ? "Bonus produk" : p.jenis === "bundling" ? "Bundling" : "Potongan produk");

async function halPromosi() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { promo: semua } = await api("GET", "/api/promo");
  const promo = semua.filter((p) => (!filterPromo.jenis || jenisTampil(p) === filterPromo.jenis) && (!filterPromo.status || p.status_tampil === filterPromo.status));
  $("#isi").innerHTML = `<main><div class="head"><div><h1>Promosi</h1><p class="muted small">Promo tampil di POS sesuai tanggal, hari, jam, dan lokasinya. Satu pesanan hanya memakai satu promo.</p></div>
      <button class="btn primary" id="tambahPromo">+ Tambah Promosi</button></div>
    <div class="filters"><select id="fJenisPromo"><option value="">Semua jenis</option>${["Potongan produk", "Bonus produk", "Bundling", "Total belanja"].map((j) => `<option ${filterPromo.jenis === j ? "selected" : ""}>${j}</option>`).join("")}</select>
      <select id="fStatusPromo"><option value="">Semua status</option>${["Aktif", "Terjadwal", "Berakhir", "Draf", "Tidak Aktif"].map((s) => `<option ${filterPromo.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
    <div class="tablewrap"><table><thead><tr><th>Nama</th><th>Jenis</th><th>Berlaku di</th><th>Periode</th><th>Status</th><th class="num">Dipakai</th><th class="num">Total potongan</th><th></th></tr></thead><tbody>
    ${promo.length ? promo.map((p) => `<tr><td><b>${esc(p.nama)}</b>${p.auto ? ' <span class="tag">otomatis</span>' : ""}</td>
      <td>${jenisTampil(p)}<div class="small muted">${JENIS_PROMO[p.jenis]}</div></td><td>${esc(p.lokasi)}</td>
      <td>${tgl(p.mulai)} – ${tgl(p.selesai)}${p.jam_mulai !== "00:00" || p.jam_selesai !== "23:59" ? `<div class="small muted">${p.jam_mulai}–${p.jam_selesai}</div>` : ""}</td>
      <td><span class="tag ${WARNA_PROMO[p.status_tampil] ?? ""}">${esc(p.status_tampil)}</span></td><td class="num">${p.dipakai}</td><td class="num">${rp(p.total_potongan)}</td>
      <td style="white-space:nowrap"><button class="btn small" data-ubahp="${p.id}">Ubah</button> <button class="btn small" data-salin="${p.id}">Duplikat</button></td></tr>`).join("")
      : `<tr><td colspan="8" class="muted">${semua.length ? "Tidak ada promo yang cocok." : "Belum ada promo."}</td></tr>`}
    </tbody></table></div></main>`;
  // Tambah promosi: tanyakan jenisnya dulu.
  $("#tambahPromo").onclick = () => popup(`<h2>Jenis promosi</h2><p class="muted small">Promo hanya berlaku di POS. Promo marketplace diatur di Seller Center.</p>
    <button class="btn" data-cak="produk" style="display:block;width:100%;margin-top:8px;text-align:left"><b>Promo produk</b><div class="small muted">Potongan untuk produk tertentu, bonus produk, atau bundling</div></button>
    <button class="btn" data-cak="total" style="display:block;width:100%;margin-top:8px;text-align:left"><b>Promo total belanja</b><div class="small muted">Potongan % atau Rp dari total belanja</div></button>`)
    || $("#popupIsi").querySelectorAll("[data-cak]").forEach((b) => (b.onclick = () => { $("#popup").hidden = true; formPromo(null, null, b.dataset.cak); }));
  $("#fJenisPromo").onchange = (e) => { filterPromo.jenis = e.target.value; halPromosi(); };
  $("#fStatusPromo").onchange = (e) => { filterPromo.status = e.target.value; halPromosi(); };
  $("#isi").querySelectorAll("[data-ubahp]").forEach((b) => (b.onclick = () => formPromo(b.dataset.ubahp)));
  $("#isi").querySelectorAll("[data-salin]").forEach((b) => (b.onclick = () => formPromo(null, b.dataset.salin)));
}

// id: ubah promo itu. salin: promo baru berisi salinan promo lain (status Draf). cakupan: promo baru dari pilihan jenis.
async function formPromo(id, salin, cakupan = "produk") {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ produk }, { event }, lama] = await Promise.all([api("GET", "/api/produk"), api("GET", "/api/event"), id || salin ? api("GET", "/api/promo/" + (id || salin)) : null]);
  if (salin && lama) lama.promo = { ...lama.promo, nama: lama.promo.nama + " (salinan)", status: "Draf" };
  const p = lama?.promo ?? { status: "Aktif", cakupan, jenis: cakupan === "total" ? "nominal" : "persen", mulai: hariIni(), selesai: hariIni(), jam_mulai: "00:00", jam_selesai: "23:59", hari: [0, 1, 2, 3, 4, 5, 6], syarat: [], bonus: [], paket: [] };
  const aktif = produk.filter((x) => x.aktif || [...p.syarat, ...p.bonus, ...p.paket].includes(x.id));
  const lokasi = [{ id: "gudang", nama: "Gudang Pusat" }, ...event.filter((e) => !e.ditutup || e.id === p.lokasi_id)];
  const daftarCentang = (nama, pilih) => `<div class="pilih" style="max-height:220px">${aktif.map((x) => `<label><input type="checkbox" name="${nama}" value="${x.id}" ${pilih.includes(x.id) ? "checked" : ""}>
    <span>${esc(x.nama)} <span class="small muted">${esc(x.sku)}</span></span></label>`).join("")}</div>`;
  $("#isi").innerHTML = `<div class="form"><h1>${id ? "Ubah promo" : salin ? "Duplikat promo" : cakupan === "total" ? "Promo total belanja baru" : "Promo produk baru"}</h1>
    <form class="card" id="fPromo" style="margin-top:12px">
      <div class="grid2"><div><label>Nama promo</label><input name="nama" required maxlength="80" value="${esc(p.nama ?? "")}"></div>
        <div><label>Status</label><select name="status">${["Aktif", "Draf", "Tidak Aktif"].map((s) => `<option ${s === p.status ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>
      <label>Deskripsi (opsional)</label><input name="deskripsi" maxlength="300" value="${esc(p.deskripsi ?? "")}">
      <div class="grid2"><div><label>Berlaku untuk</label><select name="cakupan"><option value="produk" ${p.cakupan === "produk" ? "selected" : ""}>Produk tertentu</option><option value="total" ${p.cakupan === "total" ? "selected" : ""}>Total belanja</option></select></div>
        <div><label>Jenis</label><select name="jenis">${Object.entries(JENIS_PROMO).map(([k, n]) => `<option value="${k}" ${k === p.jenis ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
      <div data-untuk="persen nominal">
        <div class="grid2"><div><label>Besaran potongan (<span id="satuan"></span>)</label><input name="besar" inputmode="numeric" value="${p.besar ?? ""}"></div>
          <div data-untuk="persen"><label>Maksimal potongan Rp (0 = tanpa batas)</label><input name="maks_potongan" inputmode="numeric" value="${p.maks_potongan ?? 0}"></div></div>
        <div class="grid2"><div><label>Minimal pembelian Rp</label><input name="min_belanja" inputmode="numeric" value="${p.min_belanja ?? 0}"></div>
          <div><label>Minimal kuantitas (pcs)</label><input name="min_qty" inputmode="numeric" value="${p.min_qty ?? 0}"></div></div>
        <div data-untuk="persen"><label><input type="checkbox" name="kasir_ubah" ${p.kasir_ubah ? "checked" : ""}> Kasir boleh mengubah persen, maksimal</label>
          <input name="kasir_maks_persen" inputmode="numeric" value="${p.kasir_maks_persen ?? 0}" style="width:120px"> %</div>
      </div>
      <div data-untuk="produk-syarat"><label>Produk yang dibeli</label>${daftarCentang("syarat", p.syarat)}</div>
      <div data-untuk="bonus">
        <div class="grid2"><div><label>Minimal beli (pcs)</label><input name="min_qty_bonus" inputmode="numeric" value="${p.min_qty ?? 1}"></div>
          <div><label>Jumlah bonus (pcs)</label><input name="bonus_qty" inputmode="numeric" value="${p.bonus_qty ?? 1}"></div></div>
        <label>Produk bonus (gratis)</label><select name="bonus"><option value="">Pilih produk</option>${aktif.map((x) => `<option value="${x.id}" ${p.bonus[0] === x.id ? "selected" : ""}>${esc(x.nama)}</option>`).join("")}</select>
      </div>
      <div data-untuk="bundling"><label>Isi paket (minimal 2 produk)</label>${daftarCentang("paket", p.paket)}
        <label>Harga paket Rp</label><input name="harga_paket" inputmode="numeric" value="${p.harga_paket ?? ""}">
        <p class="small" id="infoPaket"></p></div>
      <div data-untuk="nominal bonus bundling"><label><input type="checkbox" name="kelipatan" ${p.kelipatan ? "checked" : ""}> Berlaku kelipatan</label></div>
      <label><input type="checkbox" name="auto" ${p.auto ? "checked" : ""}> Aktif otomatis di POS saat syarat terpenuhi</label>
      <label>Berlaku di</label><select name="lokasi_id"><option value="">Semua lokasi</option>${lokasi.map((l) => `<option value="${l.id}" ${l.id === p.lokasi_id ? "selected" : ""}>${esc(l.nama)}</option>`).join("")}</select>
      <div class="grid2"><div><label>Tanggal mulai</label><input type="date" name="mulai" required value="${p.mulai}"></div><div><label>Tanggal selesai</label><input type="date" name="selesai" required value="${p.selesai}"></div></div>
      <div class="grid2"><div><label>Jam mulai</label><input type="time" name="jam_mulai" value="${p.jam_mulai}"></div><div><label>Jam selesai</label><input type="time" name="jam_selesai" value="${p.jam_selesai}"></div></div>
      <label>Hari</label><div class="filters">${NAMA_HARI.map((h, i) => `<label style="margin:0;font-weight:400"><input type="checkbox" name="hari" value="${i}" ${p.hari.includes(i) ? "checked" : ""} style="width:auto"> ${h}</label>`).join("")}</div>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary">${id ? "Simpan" : "Buat promo"}</button><button type="button" class="btn" id="simpanDraf">Simpan Draft</button><button type="button" class="btn" id="batalPromo">Batal</button></div>
    </form></div>`;
  const f = $("#fPromo");
  const atur = () => {
    const j = f.jenis.value, c = f.cakupan.value;
    if (c === "total" && (j === "bonus" || j === "bundling")) f.jenis.value = "persen";
    const jj = f.jenis.value;
    f.querySelectorAll("[data-untuk]").forEach((el) => {
      const u = el.dataset.untuk.split(" ");
      el.hidden = u.includes("produk-syarat") ? !(c === "produk" && jj !== "bundling") : !u.includes(jj);
    });
    $("#satuan").textContent = jj === "persen" ? "%" : "Rp";
    // Bundling: harga normal paket (varian termurah tiap produk) dan besar hematnya.
    const isi = [...f.querySelectorAll("[name=paket]:checked")].map((x) => aktif.find((y) => y.id === x.value)).filter(Boolean);
    const normal = isi.reduce((a, x) => a + x.harga_min, 0), paket = angka(f.harga_paket.value) ?? 0;
    $("#infoPaket").innerHTML = isi.length < 2 ? '<span class="muted">Pilih minimal dua produk.</span>'
      : `Harga normal paket ${rp(normal)}${paket ? paket < normal ? ` · hemat <b>${rp(normal - paket)}</b>` : ' · <span style="color:var(--danger-text)">harga paket harus lebih murah</span>' : ""}`;
  };
  f.harga_paket.oninput = atur;
  f.onchange = atur;
  atur();
  $("#batalPromo").onclick = halPromosi;
  let draf = false;
  $("#simpanDraf").onclick = () => { draf = true; f.requestSubmit(); };
  f.querySelector("button.primary").onclick = () => { draf = false; };
  formKirim(f, async () => {
    const centang = (n) => [...f.querySelectorAll(`[name=${n}]:checked`)].map((x) => x.value);
    const j = f.jenis.value;
    const b = {
      nama: f.nama.value, deskripsi: f.deskripsi.value || undefined, status: draf ? "Draf" : f.status.value, cakupan: f.cakupan.value, jenis: j,
      besar: angka(f.besar.value) ?? 0, maks_potongan: angka(f.maks_potongan.value) ?? 0, min_belanja: j === "bonus" || j === "bundling" ? 0 : angka(f.min_belanja.value) ?? 0,
      min_qty: j === "bonus" ? angka(f.min_qty_bonus.value) ?? 0 : j === "bundling" ? 0 : angka(f.min_qty.value) ?? 0,
      kelipatan: f.kelipatan.checked, auto: f.auto.checked, kasir_ubah: j === "persen" && f.kasir_ubah.checked, kasir_maks_persen: angka(f.kasir_maks_persen.value) ?? 0,
      bonus_qty: j === "bonus" ? angka(f.bonus_qty.value) ?? 0 : 0, harga_paket: j === "bundling" ? angka(f.harga_paket.value) ?? 0 : 0,
      lokasi_id: f.lokasi_id.value || undefined, mulai: f.mulai.value, selesai: f.selesai.value, jam_mulai: f.jam_mulai.value, jam_selesai: f.jam_selesai.value,
      hari: centang("hari").map(Number), syarat: f.cakupan.value === "produk" && j !== "bundling" ? centang("syarat") : [],
      bonus: j === "bonus" && f.bonus.value ? [f.bonus.value] : [], paket: j === "bundling" ? centang("paket") : [],
    };
    draf = false;
    if (id) await api("PATCH", "/api/promo/" + id, b); else await api("POST", "/api/promo", b);
    halPromosi();
  });
}

// ---------- Pesanan Pre-sale ----------

let tabPresale = "Menunggu";
let evPresale = "";

async function halPresale() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { pesanan, ringkasan: r } = await api("GET", "/api/presale");
  const event = [...new Map(pesanan.map((p) => [p.lokasi_id, p.lokasi])).entries()];
  const isi = pesanan.filter((p) => (tabPresale === "Semua" || p.ambil === tabPresale) && (!evPresale || p.lokasi_id === evPresale));
  const tag = { Menunggu: "warn", "Perlu Refund": "off", Diambil: "aktif", Refund: "" };
  $("#isi").innerHTML = `<main><div class="head"><div><h1>Pesanan Pre-sale</h1><p class="muted small">Pesanan "ambil nanti". Stok berkurang saat barang diserahkan di POS.</p></div>
      <button class="btn" id="unduhPre">Unduh daftar pembeli (CSV)</button></div>
    <div class="kpis"><div class="kpi"><span class="muted small">Menunggu diambil</span><b>${r.menunggu.jumlah} · ${rp(r.menunggu.nilai)}</b></div>
      <div class="kpi"><span class="muted small">Perlu refund</span><b>${r.perlu_refund.jumlah} · ${rp(r.perlu_refund.nilai)}</b></div>
      <div class="kpi"><span class="muted small">Sudah diambil</span><b>${r.diambil.jumlah}</b></div><div class="kpi"><span class="muted small">Sudah di-refund</span><b>${r.refund.jumlah} · ${rp(r.refund.nilai)}</b></div></div>
    ${subtabs([["Menunggu", "Menunggu"], ["Perlu Refund", "Perlu Refund"], ["Diambil", "Diambil"], ["Refund", "Refund"], ["Semua", "Semua"]], tabPresale)}
    <div class="filters"><select id="evPresale"><option value="">Semua event</option>${event.map(([id, n]) => `<option value="${id}" ${id === evPresale ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>No.</th><th>Event</th><th>Pembeli</th><th>Barang</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${isi.length ? isi.map((p) => `<tr><td>${waktu(p.waktu)}<div class="small muted">${esc(p.kasir)}</div></td><td><b>${esc(p.no)}</b></td><td>${esc(p.lokasi)}</td><td>${esc(p.pelanggan_nama)}<div class="small muted">${esc(p.pelanggan_telp)}</div></td>
      <td class="small">${p.items.map((i) => `${esc(i.nama)} ×${i.qty}`).join("<br>")}</td><td class="num">${rp(p.total)}<div class="small muted">${esc(p.metode)}</div></td>
      <td><span class="tag ${tag[p.ambil]}">${esc(p.ambil)}</span>${p.ambil === "Menunggu" && p.ambil_batas ? `<div class="small muted">Ambil di Gudang Pusat sampai ${tgl(p.ambil_batas)}</div>` : ""}
        ${p.ambil === "Diambil" ? `<div class="small muted">${waktu(p.ambil_pada)} · ${esc(p.ambil_oleh)} · ${esc(p.ambil_lokasi)} · ${p.ambil_cara === "Manual" ? "verifikasi manual" : "scan QR"}</div>` : ""}
        ${p.ambil === "Refund" ? `<div class="small muted">${waktu(p.refund_pada)} · ${esc(p.refund_oleh)} · ${esc(p.refund_bank)} ${esc(p.refund_norek)}</div>` : ""}</td>
      <td>${p.ambil === "Perlu Refund" ? `<button class="btn small primary" data-refund="${p.id}">Tandai sudah ditransfer</button>` : p.ambil === "Menunggu" ? `<button class="btn small" data-refund="${p.id}">Batalkan & refund</button>`
        : p.refund_bukti ? `<a href="/api/berkas/${p.refund_bukti}" target="_blank">Bukti</a>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Tidak ada pesanan.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs((s) => { tabPresale = s; halPresale(); });
  $("#evPresale").onchange = (e) => { evPresale = e.target.value; halPresale(); };
  $("#unduhPre").onclick = () => unduhCsv("pembeli-presale.csv", [["No", "Waktu", "Event", "Pembeli", "No HP", "Barang", "Total", "Status"],
    ...pesanan.map((p) => [p.no, p.waktu, p.lokasi, p.pelanggan_nama, p.pelanggan_telp, p.items.map((i) => `${i.nama} x${i.qty}`).join("; "), p.total, p.ambil])]);
  $("#isi").querySelectorAll("[data-refund]").forEach((b) => (b.onclick = () => formRefund(pesanan.find((p) => p.id === b.dataset.refund))));
}

function formRefund(p) {
  popupForm(`<h2>Refund ${esc(p.no)}</h2><p class="small muted">${esc(p.pelanggan_nama)} · ${esc(p.pelanggan_telp)} · ${rp(p.total)}. Transfer dari rekening perusahaan, lalu unggah bukti transfernya.</p>
    <div class="grid2"><div><label>Bank tujuan</label><input name="bank" required maxlength="40"></div><div><label>No. rekening</label><input name="norek" required maxlength="40"></div></div>
    <label>Atas nama</label><input name="an" required maxlength="80" value="${esc(p.pelanggan_nama ?? "")}">
    <label>Catatan (opsional)</label><input name="catatan" maxlength="300">
    <label>Foto bukti transfer</label><input type="file" name="bukti" accept="image/*" required>`, "Tandai sudah ditransfer", async (d, f) => {
    const file = f.bukti.files[0];
    if (!file) throw new Error("Unggah foto bukti transfer");
    const b = await unggah(await kecilkanGambar(file, 1600, "image/jpeg", 0.8), "bukti_refund");
    await api("POST", `/api/presale/${p.id}/refund`, { bank: d.bank, norek: d.norek, an: d.an, catatan: d.catatan || undefined, bukti: b.id });
    halPresale();
  });
}

// ---------- Stok Terbuang ----------

const ALASAN_TERBUANG = ["Rusak", "Hilang", "Cacat dari pemasok", "Berjamur atau lembap", "Lainnya"];
const JENIS_TERBUANG = { manual: "Catatan manual", retur: "Retur barang cacat", kiriman: "Kiriman kurang", opname: "Selisih opname" };

let filterTerbuang = { jenis: "", lokasi: "", dari: "", sampai: "" };

async function daftarTerbuang() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { terbuang } = await api("GET", "/api/terbuang");
  const f = filterTerbuang;
  const tglX = (x) => new Date(Date.parse(x.waktu.length > 10 ? x.waktu : x.waktu + "T00:00:00+07:00") + 7 * 3600_000).toISOString().slice(0, 10);
  const isi = terbuang.filter((x) => (!f.jenis || x.jenis === f.jenis) && (!f.lokasi || x.lokasi === f.lokasi) && (!f.dari || tglX(x) >= f.dari) && (!f.sampai || tglX(x) <= f.sampai));
  const pcs = (x) => x.items.reduce((a, i) => a + i.qty, 0);
  const lokasi = [...new Set(terbuang.map((x) => x.lokasi).filter(Boolean))];
  $("#isi").innerHTML = `<main>${kepalaInv('<div style="display:flex;gap:8px"><button class="btn" id="unduhTerbuang">Unduh CSV</button><button class="btn primary" id="catatTerbuang">+ Catat Barang Terbuang</button></div>')}
    <div class="kpis"><div class="kpi"><span class="muted small">Barang terbuang</span><b>${isi.reduce((a, x) => a + pcs(x), 0)} pcs</b></div>
      <div class="kpi"><span class="muted small">Nilai (HPP)</span><b>${rp(isi.reduce((a, x) => a + (x.kerugian ?? 0), 0))}</b></div>
      <div class="kpi"><span class="muted small">Uang kembali ke pembeli (retur)</span><b>${rp(isi.filter((x) => x.jenis === "retur").reduce((a, x) => a + (x.nilai ?? 0), 0))}</b></div></div>
    <div class="kpis">${Object.entries(JENIS_TERBUANG).map(([k, n]) => { const x = isi.filter((y) => y.jenis === k); return `<div class="kpi"><span class="muted small">${n}</span><b>${x.reduce((a, y) => a + pcs(y), 0)} pcs · ${rp(x.reduce((a, y) => a + (y.kerugian ?? 0), 0))}</b></div>`; }).join("")}</div>
    <form class="filters" id="fFilterTb"><select name="jenis"><option value="">Semua jenis</option>${Object.entries(JENIS_TERBUANG).map(([k, n]) => `<option value="${k}" ${f.jenis === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select name="lokasi"><option value="">Semua lokasi</option>${lokasi.map((l) => `<option ${f.lokasi === l ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <input type="date" name="dari" value="${f.dari}"><span>s/d</span><input type="date" name="sampai" value="${f.sampai}"><button class="btn small primary">Terapkan</button></form>
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Sumber</th><th>Lokasi</th><th>Barang</th><th>Alasan</th><th>Penanggung jawab</th><th class="num">Nilai</th><th></th></tr></thead><tbody>
    ${isi.length ? isi.map((x) => `<tr><td>${x.waktu.length > 10 ? waktu(x.waktu) : tgl(x.waktu)}</td><td>${JENIS_TERBUANG[x.jenis]}${x.no ? `<div class="small muted">${esc(x.no)} · ${esc(x.no_trx)}</div>` : ""}</td>
      <td>${esc(x.lokasi ?? "—")}</td><td class="small">${x.items.length ? x.items.map((i) => `${esc(i.nama)} ×${i.qty}`).join("<br>") : esc(x.rincian ?? "")}</td>
      <td>${esc(x.alasan)}<div class="small muted">${esc(x.penjelasan ?? "")}</div>${x.jenis === "retur" ? `<div class="small muted">${esc(x.cara)}${x.nilai ? " " + rp(x.nilai) : ""} · disetujui ${esc(x.disetujui)}</div>` : ""}</td>
      <td>${esc(x.pj ?? x.oleh ?? "—")}</td><td class="num">${rp(x.kerugian)}</td><td>${x.foto ? `<a href="/api/berkas/${x.foto}" target="_blank">Foto</a>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Tidak ada barang terbuang.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halInventori);
  $("#fFilterTb").onsubmit = (e) => { e.preventDefault(); filterTerbuang = Object.fromEntries(new FormData(e.target)); daftarTerbuang(); };
  $("#unduhTerbuang").onclick = () => unduhCsv("stok-terbuang.csv", [["Waktu", "Sumber", "Lokasi", "Barang", "Pcs", "Alasan", "Penjelasan", "Penanggung jawab", "Nilai HPP"],
    ...isi.map((x) => [x.waktu, JENIS_TERBUANG[x.jenis], x.lokasi, x.items.map((i) => `${i.nama} x${i.qty}`).join("; ") || x.rincian, pcs(x), x.alasan, x.penjelasan, x.pj ?? x.oleh, x.kerugian])]);
  $("#catatTerbuang").onclick = formTerbuang;
}

async function formTerbuang() {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ lokasi, stok }, { karyawan }, { event }] = await Promise.all([api("GET", "/api/stok"), api("GET", "/api/staf"), api("GET", "/api/event")]);
  const pjDi = (lok) => event.find((e) => e.id === lok)?.pj_id ?? saya.id;
  const baris = [];
  const isian = {};
  const gambar = (lok = "gudang") => {
    const lama = $("#fTerbuang");
    if (lama) for (const k of ["tanggal", "alasan", "pj_id", "penjelasan"]) isian[k] = lama[k].value;
    const ada = stok.filter((s) => (s.per_lokasi[lok] ?? 0) > 0);
    $("#isi").innerHTML = `<div class="form"><h1>Catat barang terbuang</h1>
      <form class="card" id="fTerbuang" style="margin-top:12px">
        <p class="small muted">Stok lokasi langsung berkurang. Nilainya (HPP) masuk Laporan › Selisih & Kerugian.</p>
        <div class="grid2"><div><label>Lokasi</label><select name="lokasi_id">${lokasi.map((l) => `<option value="${l.id}" ${l.id === lok ? "selected" : ""}>${esc(l.nama)}</option>`).join("")}</select></div>
          <div><label>Tanggal</label><input type="date" name="tanggal" value="${hariIni()}" max="${hariIni()}" required></div></div>
        <label>Barang</label>
        <table>${baris.map((b, i) => { const s = stok.find((x) => x.sku === b.sku); return `<tr><td>${esc(s.produk)} ${esc(s.varian ?? "")}<div class="small muted">${esc(b.sku)} · stok ${s.per_lokasi[lok] ?? 0}</div></td>
          <td style="width:120px"><input inputmode="numeric" data-qty="${i}" value="${b.qty}" placeholder="Jumlah"></td><td style="width:60px"><button type="button" class="btn small" data-hapus="${i}">Hapus</button></td></tr>`; }).join("")}</table>
        <select id="tambahSku"><option value="">+ Tambah barang</option>${ada.filter((s) => !baris.some((b) => b.sku === s.sku)).map((s) => `<option value="${esc(s.sku)}">${esc(s.produk)} ${esc(s.varian ?? "")} (${s.per_lokasi[lok]})</option>`).join("")}</select>
        <div class="grid2"><div><label>Alasan</label><select name="alasan">${ALASAN_TERBUANG.map((a) => `<option>${a}</option>`).join("")}</select></div>
          <div><label>Penanggung jawab</label><select name="pj_id">${karyawan.map((k) => `<option value="${k.id}" ${k.id === pjDi(lok) ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div></div>
        <label>Penjelasan (minimal 10 huruf)</label><textarea name="penjelasan" required minlength="10" maxlength="500"></textarea>
        <label>Foto (opsional)</label><input type="file" name="foto" accept="image/*">
        <div class="err" hidden></div>
        <div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batalTerbuang">Batal</button></div>
      </form></div>`;
    const f = $("#fTerbuang");
    for (const [k, v] of Object.entries(isian)) f[k].value = v;
    f.lokasi_id.onchange = () => { baris.length = 0; delete isian.pj_id; gambar(f.lokasi_id.value); };
    $("#tambahSku").onchange = (e) => { if (e.target.value) { baris.push({ sku: e.target.value, qty: "" }); gambar(lok); } };
    f.querySelectorAll("[data-qty]").forEach((el) => (el.oninput = () => (baris[el.dataset.qty].qty = el.value)));
    f.querySelectorAll("[data-hapus]").forEach((el) => (el.onclick = () => { baris.splice(Number(el.dataset.hapus), 1); gambar(lok); }));
    $("#batalTerbuang").onclick = () => halInventori("terbuang");
    formKirim(f, async (d) => {
      if (!baris.length) throw new Error("Tambahkan minimal satu barang");
      const file = f.foto.files[0];
      const foto = file ? (await unggah(await kecilkanGambar(file, 1600, "image/jpeg", 0.8), "terbuang")).id : undefined;
      await api("POST", "/api/terbuang", { lokasi_id: d.lokasi_id, tanggal: d.tanggal, alasan: d.alasan, pj_id: d.pj_id, penjelasan: d.penjelasan, foto,
        item: baris.map((b) => ({ sku: b.sku, qty: angka(b.qty) })) });
      halInventori("terbuang");
    });
  };
  gambar();
}
