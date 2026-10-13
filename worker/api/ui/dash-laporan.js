// Dashboard ringkasan, Laporan (Per Saluran, Per Event, Per Kasir, Per Produk, Rekap Harian), Keuangan (Keseluruhan, Per Event, Biaya),
// dan kartu Biaya event di detail event.

// ---------- Grafik batang (satu seri, satu warna; nilai di ujung batang, tooltip saat disentuh) ----------

function grafikBatang(judul, baris, opsi = {}) {
  const nilai = opsi.nilai ?? ((b) => b.nilai);
  const format = opsi.format ?? rp;
  const isi = baris.filter((b) => nilai(b) > 0);
  const maks = Math.max(1, ...isi.map(nilai));
  return `<div class="card grafik"><h3>${esc(judul)}</h3>${isi.length ? isi.map((b) => `<div class="gb-baris" tabindex="0" data-tip="${esc(b.label)}: ${esc(format(nilai(b)))}${b.catatan ? " · " + esc(b.catatan) : ""}">
      <span class="gb-label">${esc(b.label)}</span><span class="gb-jalur"><span class="gb-batang" style="width:${Math.max(1, (nilai(b) / maks) * 100)}%"></span></span><span class="gb-nilai">${esc(format(nilai(b)))}</span></div>`).join("")
    : '<p class="muted small">Belum ada data.</p>'}</div>`;
}

// ---------- Periode bersama untuk laporan ----------

let periodeLap = { tab: "hari", dari: "", sampai: "" };
function hitungPeriode(tab) {
  const h = hariIni(), g = (n) => new Date(Date.parse(h) - n * 86_400_000).toISOString().slice(0, 10);
  return { hari: [h, h], "7hari": [g(6), h], bulan: [h.slice(0, 8) + "01", h], "30hari": [g(29), h], semua: ["2024-01-01", h] }[tab];
}
function pastikanPeriode() {
  if (!periodeLap.dari) [periodeLap.dari, periodeLap.sampai] = hitungPeriode(periodeLap.tab);
}
function pilihPeriode(ulang) {
  return `<div class="filters" id="periodeLap">${[["hari", "Hari ini"], ["7hari", "7 hari"], ["bulan", "Bulan ini"], ["30hari", "30 hari"], ["semua", "Semua"]]
    .map(([k, n]) => `<button type="button" class="btn small ${periodeLap.tab === k ? "primary" : ""}" data-per="${k}">${n}</button>`).join("")}
    <label style="margin:0">Dari</label><input type="date" id="perDari" value="${periodeLap.dari}" max="${hariIni()}"><label style="margin:0">s/d</label><input type="date" id="perSampai" value="${periodeLap.sampai}" max="${hariIni()}">
    ${periodeLap.tab === "khusus" ? '<button type="button" class="btn small" id="perHapus" title="Hapus rentang">✕</button>' : ""}</div>`;
}
function pasangPeriode(ulang) {
  const el = $("#periodeLap");
  if (!el) return;
  el.querySelectorAll("[data-per]").forEach((b) => (b.onclick = () => { periodeLap.tab = b.dataset.per; [periodeLap.dari, periodeLap.sampai] = hitungPeriode(b.dataset.per); ulang(); }));
  const ubah = (yang) => {
    let d = $("#perDari").value || periodeLap.dari, s = $("#perSampai").value || periodeLap.sampai;
    if (d > s) { if (yang === "dari") s = d; else d = s; }
    periodeLap = { tab: "khusus", dari: d, sampai: s };
    ulang();
  };
  $("#perDari").onchange = () => ubah("dari");
  $("#perSampai").onchange = () => ubah("sampai");
  if ($("#perHapus")) $("#perHapus").onclick = () => { periodeLap = { tab: "hari", dari: "", sampai: "" }; pastikanPeriode(); ulang(); };
}

// ---------- Dashboard ----------

let dashPer = { periode: "harian", tanggal: "" };

async function halDashboard() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  if (!dashPer.tanggal) dashPer.tanggal = hariIni();
  const d = await api("GET", `/api/ringkasan?periode=${dashPer.periode}&tanggal=${dashPer.tanggal}`);
  const r = d.ringkasan, g = d.grafik;
  const label = d.periode.dari === d.periode.sampai ? tgl(d.periode.dari) : `${tgl(d.periode.dari)} – ${tgl(d.periode.sampai)}`;
  $("#isi").innerHTML = `<main><div class="head"><div><h1>Dashboard</h1><p class="muted small">Semua lokasi: event, Gudang Pusat, dan online. Penjualan bersih setelah diskon, retur, dan potongan marketplace.</p></div>
      <button class="btn" id="keLaporan">Buka laporan lengkap</button></div>
    <div class="filters">${[["harian", "Harian"], ["mingguan", "Mingguan"], ["bulanan", "Bulanan"]].map(([k, n]) => `<button class="btn small ${dashPer.periode === k ? "primary" : ""}" data-p="${k}">${n}</button>`).join("")}
      <button class="btn small" id="mundur" aria-label="Periode sebelumnya">‹</button><b>${label}</b><button class="btn small" id="maju" aria-label="Periode berikutnya" ${d.periode.sampai >= hariIni() ? "disabled" : ""}>›</button></div>
    <div class="kpis"><div class="kpi"><span class="muted small">Total penjualan</span><b>${rp(r.bersih)}</b></div><div class="kpi"><span class="muted small">Transaksi</span><b>${r.transaksi}</b></div>
      <div class="kpi"><span class="muted small">Rata-rata per transaksi</span><b>${rp(r.rata)}</b></div><div class="kpi"><span class="muted small">Produk terjual</span><b>${r.qty} pcs</b></div>
      <div class="kpi"><span class="muted small">Laba kotor</span><b>${rp(r.laba)}</b></div></div>
    <div class="kpis"><div class="kpi"><span class="muted small">Penjualan offline</span><b>${rp(r.offline)}</b></div><div class="kpi"><span class="muted small">Penjualan online</span><b>${rp(r.online)}</b></div>
      <div class="kpi"><span class="muted small">Potongan marketplace</span><b>${rp(r.mp)}</b></div>
      <div class="kpi"><span class="muted small">Dana marketplace belum cair</span><b>${rp(r.belum_cair.nilai)}</b><span class="small muted">${r.belum_cair.n} pesanan Diproses</span></div></div>
    <div class="grafik-grid">
      ${grafikBatang("Metode pembayaran POS", g.metode.map((m) => ({ label: m.metode, nilai: m.jumlah })))}
      ${grafikBatang("Penjualan per saluran", g.saluran.map((s) => ({ label: s.nama, nilai: s.bersih, catatan: `${s.transaksi} transaksi` })))}
      ${grafikBatang("Penjualan per kategori", g.kategori.map((k) => ({ label: k.nama, nilai: k.bersih })))}
      ${grafikBatang("Produk terlaris", g.produk.map((p) => ({ label: p.nama, nilai: p.qty, catatan: rp(p.bersih) })), { format: (n) => n + " pcs" })}
      ${grafikBatang("Penjualan per kasir", g.kasir.map((k) => ({ label: k.nama, nilai: k.bersih })))}
      <div class="card grafik"><h3>Stok menipis</h3>${g.menipis.length ? `<table>${g.menipis.map((p) => `<tr><td>${esc(p.nama)}</td><td class="num">${p.stok} <span class="muted small">/ min ${p.stok_min}</span></td></tr>`).join("")}</table>` : '<p class="muted small">Semua stok aman.</p>'}</div>
    </div></main>`;
  $("#isi").querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { dashPer.periode = b.dataset.p; halDashboard(); }));
  const geser = (arah) => {
    const t = Date.parse(arah < 0 ? d.periode.dari : d.periode.sampai) + arah * 86_400_000;
    dashPer.tanggal = new Date(t).toISOString().slice(0, 10);
    halDashboard();
  };
  $("#mundur").onclick = () => geser(-1);
  $("#maju").onclick = () => geser(1);
  $("#keLaporan").onclick = () => { subLaporan = "saluran"; buka("laporan"); };
}

// ---------- Laporan ----------

const kepalaLaporan = (tombol = "") => `<div class="head"><div><h1>Laporan</h1></div>${tombol}</div>
  ${subtabs([["saluran", "Per Saluran"], ["event", "Per Event"], ["kasir", "Per Kasir"], ["produk", "Per Produk"], ["harian", "Rekap Harian"], ["kerugian", "Selisih & Kerugian"]], subLaporan)}`;

function tabelLaporan(kolom, baris, total) {
  return `<div class="tablewrap"><table><thead><tr>${kolom.map((k) => `<th class="${k.num ? "num" : ""}">${k.judul}</th>`).join("")}</tr></thead><tbody>
    ${baris.length ? baris.map((b) => `<tr ${b._klik ? `class="klik" data-klik="${esc(b._klik)}"` : ""}>${kolom.map((k) => `<td class="${k.num ? "num" : ""}">${k.isi(b)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${kolom.length}" class="muted">Belum ada data di periode ini.</td></tr>`}
    ${total && baris.length ? `<tr class="total">${kolom.map((k, i) => `<td class="${k.num ? "num" : ""}"><b>${i === 0 ? "Total" : k.total ? k.total(baris) : ""}</b></td>`).join("")}</tr>` : ""}
    </tbody></table></div>`;
}
const jml = (k, f) => (b) => (f ?? rp)(b.reduce((a, x) => a + (x[k] ?? 0), 0)); // rp dibaca saat dipakai: skrip ini dimuat sebelum rp didefinisikan
const marginTotal = (b) => { const be = b.reduce((a, x) => a + x.bersih, 0), la = b.reduce((a, x) => a + x.laba, 0); return be ? (Math.round((la / be) * 1000) / 10) + "%" : "—"; };

async function laporanUmum(jenis, judulCsv, kolom, siapkan = (x) => x) {
  pastikanPeriode();
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const d = await api("GET", `/api/laporan/${jenis}?dari=${periodeLap.dari}&sampai=${periodeLap.sampai}`);
  const baris = siapkan(d.baris);
  $("#isi").innerHTML = `<main>${kepalaLaporan('<button class="btn" id="unduhLap">Unduh CSV</button>')}${pilihPeriode()}
    ${jenis === "harian" ? `<p class="small muted">Hari sebelumnya diambil dari rekap yang dihitung tiap malam pukul 00.10 WIB. Hari ini dihitung langsung.${saya.role.includes("owner") ? ' <a href="#" id="hitungRekap">Hitung ulang rekap periode ini</a>' : ""}</p>` : ""}
    ${tabelLaporan(kolom, baris, true)}</main>`;
  pasangSubtabs(halLaporan);
  pasangPeriode(() => halLaporan());
  $("#unduhLap").onclick = () => unduhCsv(`laporan-${judulCsv}-${periodeLap.dari}-${periodeLap.sampai}.csv`, [kolom.map((k) => k.judul), ...baris.map((b) => kolom.map((k) => (k.csv ? k.csv(b) : String(k.isi(b)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())))]);
  if ($("#hitungRekap")) $("#hitungRekap").onclick = async (e) => { e.preventDefault(); await api("POST", "/api/laporan/rekap", { dari: periodeLap.dari, sampai: periodeLap.sampai }); halLaporan(); };
  return baris;
}

const K = {
  transaksi: { judul: "Transaksi", num: true, isi: (b) => b.transaksi, total: jml("transaksi", String), csv: (b) => b.transaksi },
  qty: { judul: "Qty", num: true, isi: (b) => b.qty, total: jml("qty", String), csv: (b) => b.qty },
  kotor: { judul: "Penjualan kotor", num: true, isi: (b) => rp(b.kotor), total: jml("kotor"), csv: (b) => b.kotor },
  potongan: { judul: "Potongan", num: true, isi: (b) => rp(b.diskon + b.bulat + b.mp), total: (x) => rp(x.reduce((a, b) => a + b.diskon + b.bulat + b.mp, 0)), csv: (b) => b.diskon + b.bulat + b.mp },
  retur: { judul: "Retur", num: true, isi: (b) => rp(b.retur), total: jml("retur"), csv: (b) => b.retur },
  bersih: { judul: "Bersih", num: true, isi: (b) => `<b>${rp(b.bersih)}</b>`, total: jml("bersih"), csv: (b) => b.bersih },
  hpp: { judul: "HPP", num: true, isi: (b) => rp(b.hpp), total: jml("hpp"), csv: (b) => b.hpp },
  laba: { judul: "Laba kotor", num: true, isi: (b) => rp(b.laba), total: jml("laba"), csv: (b) => b.laba },
  margin: { judul: "Margin", num: true, isi: (b) => b.margin + "%", total: marginTotal, csv: (b) => b.margin },
};

function halLaporanSaluran() {
  return laporanUmum("saluran", "saluran", [{ judul: "Saluran", isi: (b) => `${esc(b.nama)} <span class="small muted">${b.jenis === "online" ? "online" : b.jenis === "gudang" ? "jual langsung" : "event"}</span>`, csv: (b) => b.nama },
    K.transaksi, K.qty, K.kotor, K.potongan, K.retur, K.bersih, K.hpp, K.laba, K.margin]);
}
function halLaporanEvent() {
  return laporanUmum("event", "event", [{ judul: "Event / tempat", isi: (b) => esc(b.nama), csv: (b) => b.nama }, K.transaksi, K.bersih,
    { judul: "Tunai", num: true, isi: (b) => rp(b.tunai), total: jml("tunai"), csv: (b) => b.tunai }, { judul: "QRIS", num: true, isi: (b) => rp(b.qris), total: jml("qris"), csv: (b) => b.qris },
    { judul: "Transfer", num: true, isi: (b) => rp(b.transfer), total: jml("transfer"), csv: (b) => b.transfer }, K.laba,
    { judul: "Shift", num: true, isi: (b) => b.shift, total: jml("shift", String), csv: (b) => b.shift },
    { judul: "Selisih kas", num: true, isi: (b) => `<span style="${b.selisih_kas < 0 ? "color:var(--danger-text)" : ""}">${rp(b.selisih_kas)}</span>`, total: jml("selisih_kas"), csv: (b) => b.selisih_kas }]);
}
function halLaporanKasir() {
  return laporanUmum("kasir", "kasir", [{ judul: "Nama", isi: (b) => `<b>${esc(b.nama)}</b><div class="small muted">${b.role.map((r) => NAMA_ROLE[r]).join(", ")}${b.tempat ? " · " + esc(b.tempat) : ""}</div>`, csv: (b) => b.nama },
    K.transaksi, K.qty, { judul: "Offline", num: true, isi: (b) => rp(b.offline), total: jml("offline"), csv: (b) => b.offline }, { judul: "Online", num: true, isi: (b) => rp(b.online), total: jml("online"), csv: (b) => b.online },
    { judul: "Tunai", num: true, isi: (b) => rp(b.tunai), total: jml("tunai"), csv: (b) => b.tunai }, { judul: "QRIS + transfer", num: true, isi: (b) => rp(b.nontunai), total: jml("nontunai"), csv: (b) => b.nontunai },
    { judul: "Shift", num: true, isi: (b) => b.shift, csv: (b) => b.shift }, { judul: "Selisih kas", num: true, isi: (b) => rp(b.selisih_kas), total: jml("selisih_kas"), csv: (b) => b.selisih_kas },
    { judul: "Void", num: true, isi: (b) => b.void, total: jml("void", String), csv: (b) => b.void }, K.laba]);
}
function halLaporanProduk() {
  return laporanUmum("produk", "produk", [{ judul: "Produk", isi: (b) => `${esc(b.nama)} <span class="small muted">${esc(b.sku_induk)}</span>`, csv: (b) => b.nama },
    { judul: "Qty event", num: true, isi: (b) => b.qty_event, total: jml("qty_event", String), csv: (b) => b.qty_event }, { judul: "Qty online", num: true, isi: (b) => b.qty_online, total: jml("qty_online", String), csv: (b) => b.qty_online },
    K.bersih, K.hpp, K.laba, K.margin, { judul: "Sisa stok", num: true, isi: (b) => b.sisa, csv: (b) => b.sisa }]);
}
function halLaporanHarian() {
  return laporanUmum("harian", "harian", [{ judul: "Tanggal", isi: (b) => tgl(b.tanggal) + (b.langsung ? ' <span class="tag warn">hari ini</span>' : ""), csv: (b) => b.tanggal },
    K.transaksi, K.qty, K.kotor, { judul: "Potongan", num: true, isi: (b) => rp(b.potongan), total: jml("potongan"), csv: (b) => b.potongan }, K.retur,
    { judul: "Offline", num: true, isi: (b) => rp(b.offline), total: jml("offline"), csv: (b) => b.offline }, { judul: "Online", num: true, isi: (b) => rp(b.online), total: jml("online"), csv: (b) => b.online },
    K.bersih, K.hpp, K.laba]);
}

// ---------- Keuangan (khusus Owner) ----------

let subKeu = "keseluruhan";
let evKeu = "";
function halKeuangan(sub) {
  if (sub) subKeu = sub;
  ({ keseluruhan: keuKeseluruhan, event: keuEvent, biaya: daftarBiaya })[subKeu]();
}
const kepalaKeu = (tombol = "") => `<div class="head ku-noprint"><div><h1>Keuangan</h1></div>${tombol}</div>
  <div class="ku-noprint">${subtabs([["keseluruhan", "Laporan Keseluruhan"], ["event", "Laporan per Event"], ["biaya", "Biaya"]], subKeu)}</div>`;
const pct = (a, b) => (!a ? "0%" : b ? (Math.round((a / b) * 1000) / 10).toLocaleString("id-ID") + "%" : "—");
const barisLR = (label, n, dasar, opsi = {}) => `<tr class="${opsi.tebal ? "total" : ""}"><td style="padding-left:${opsi.indent ? 24 : 8}px">${opsi.tebal ? `<b>${label}</b>` : label}</td>
  <td class="num">${opsi.tebal ? `<b>${rp(n)}</b>` : rp(n)}</td><td class="num muted small">${pct(n, dasar)}</td></tr>`;
const tombolKeu = (lokasi) => `<div class="ku-noprint" style="display:flex;gap:8px"><button class="btn" id="catatBiayaKeu" data-lokasi="${lokasi ?? ""}">+ Catat Biaya</button><button class="btn" id="unduhKeu">Unduh CSV</button><button class="btn" id="cetakKeu">Cetak / PDF</button></div>`;
function pasangTombolKeu(csv, kembali) {
  $("#cetakKeu").onclick = () => window.print();
  $("#unduhKeu").onclick = () => unduhCsv(csv.nama, csv.baris);
  $("#catatBiayaKeu").onclick = (e) => formBiaya(null, e.target.dataset.lokasi || null, kembali);
}
async function sakelarBagi(nilai) {
  await api("PUT", "/api/pengaturan/keuangan", { bagi_biaya_umum: nilai });
  halKeuangan();
}

let periodeKeu = { tab: "bulan", dari: "", sampai: "" };
function hitungPeriodeKeu(tab) {
  const h = hariIni(), awal = h.slice(0, 8) + "01";
  const bl = new Date(Date.parse(awal) - 86_400_000).toISOString().slice(0, 10);
  return { bulan: [awal, h], lalu: [bl.slice(0, 8) + "01", bl], "90hari": [new Date(Date.parse(h) - 89 * 86_400_000).toISOString().slice(0, 10), h], tahun: [h.slice(0, 4) + "-01-01", h], semua: ["2024-01-01", h] }[tab];
}

async function keuKeseluruhan() {
  if (!periodeKeu.dari) [periodeKeu.dari, periodeKeu.sampai] = hitungPeriodeKeu(periodeKeu.tab);
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const k = await api("GET", `/api/keuangan?dari=${periodeKeu.dari}&sampai=${periodeKeu.sampai}`);
  const r = k.ringkasan, B = r.bersih;
  const saluran = k.saluran;
  const csv = [["Bagian", "Nama", "Jumlah"], ...saluran.map((s) => ["Penjualan", s.nama, s.kotor]), ["", "Diskon & promo", -r.diskon], ["", "Pembulatan", -r.bulat], ["", "Retur uang kembali", -r.retur],
    ["", "Potongan marketplace", -r.mp], ["", "Penjualan bersih", B], ["", "HPP", -r.hpp], ["", "Laba kotor", r.laba], ...k.biaya_event.map((b) => ["Biaya event", b.kategori, -b.jumlah]),
    ...k.biaya_umum.map((b) => ["Biaya umum", b.kategori, -b.jumlah]), ["", "Kerugian", -r.kerugian], ["", "Penggantian penanggung jawab", r.diganti], ["", "Selisih kas lebih", r.kas_lebih], ["", "Laba bersih", r.laba_bersih]];
  $("#isi").innerHTML = `<main>${kepalaKeu(tombolKeu(null))}
    <div class="filters ku-noprint">${[["bulan", "Bulan ini"], ["lalu", "Bulan lalu"], ["90hari", "90 hari"], ["tahun", "Tahun ini"], ["semua", "Semua"]].map(([x, n]) => `<button class="btn small ${periodeKeu.tab === x ? "primary" : ""}" data-pk="${x}">${n}</button>`).join("")}
      <input type="date" id="pkDari" value="${periodeKeu.dari}" max="${hariIni()}"><span>s/d</span><input type="date" id="pkSampai" value="${periodeKeu.sampai}" max="${hariIni()}">
      <label style="margin:0 0 0 12px;font-weight:400"><input type="checkbox" id="bagiUmum" ${k.pengaturan.bagi_biaya_umum ? "checked" : ""} style="width:auto"> Bagi biaya umum ke event</label></div>
    <p class="small muted">${tgl(k.dari)} – ${tgl(k.sampai)} · semua event, jual langsung Gudang Pusat, online, dan biaya umum. Pre-sale dihitung saat barang diserahkan.</p>
    <div class="kpis"><div class="kpi"><span class="muted small">Penjualan bersih</span><b>${rp(B)}</b></div><div class="kpi"><span class="muted small">Laba kotor</span><b>${rp(r.laba)}</b><span class="small muted">${pct(r.laba, B)}</span></div>
      <div class="kpi"><span class="muted small">Biaya + kerugian</span><b>${rp(r.biaya_event + r.biaya_umum + r.kerugian)}</b></div>
      <div class="kpi"><span class="muted small">Laba bersih</span><b style="${r.laba_bersih < 0 ? "color:var(--danger-text)" : ""}">${rp(r.laba_bersih)}</b><span class="small muted">${pct(r.laba_bersih, B)}</span></div>
      <div class="kpi"><span class="muted small">Arus kas bersih</span><b>${rp(r.arus_kas)}</b></div></div>
    <div class="grid2">
      <div class="card"><h2>Laba rugi</h2><table>
        ${saluran.map((s) => barisLR(`Penjualan ${esc(s.nama)}`, s.kotor, B, { indent: true })).join("")}
        ${barisLR("Penjualan kotor", r.kotor, B, { tebal: true })}${barisLR("Diskon & promo", -r.diskon, B, { indent: true })}${barisLR("Pembulatan", -r.bulat, B, { indent: true })}
        ${barisLR("Retur uang kembali", -r.retur, B, { indent: true })}${barisLR("Potongan marketplace", -r.mp, B, { indent: true })}${barisLR("Penjualan bersih", B, B, { tebal: true })}
        ${barisLR("HPP", -r.hpp, B, { indent: true })}${barisLR("Laba kotor", r.laba, B, { tebal: true })}
        ${k.biaya_event.map((b) => barisLR("Biaya event · " + esc(b.kategori), -b.jumlah, B, { indent: true })).join("")}
        ${k.biaya_umum.map((b) => barisLR("Biaya umum · " + esc(b.kategori), -b.jumlah, B, { indent: true })).join("")}
        ${barisLR("Kerugian", -r.kerugian, B, { indent: true })}${barisLR("Penggantian dari penanggung jawab", r.diganti, B, { indent: true })}${barisLR("Selisih kas lebih", r.kas_lebih, B, { indent: true })}
        ${barisLR("Laba bersih", r.laba_bersih, B, { tebal: true })}</table></div>
      <div><div class="card"><h2>Arus kas</h2><table>${k.arus_kas.masuk.map((m) => `<tr><td>${esc(m.nama)}</td><td class="num">${rp(m.jumlah)}</td></tr>`).join("")}
          <tr class="total"><td><b>Uang masuk</b></td><td class="num"><b>${rp(k.arus_kas.masuk_total)}</b></td></tr>
          ${k.arus_kas.keluar.map((m) => `<tr><td>${esc(m.nama)}</td><td class="num">−${rp(m.jumlah)}</td></tr>`).join("")}
          <tr class="total"><td><b>Uang keluar</b></td><td class="num"><b>−${rp(k.arus_kas.keluar_total)}</b></td></tr><tr class="total"><td><b>Arus kas bersih</b></td><td class="num"><b>${rp(r.arus_kas)}</b></td></tr></table></div>
        <div class="card" style="margin-top:14px"><h2>Posisi hari ini</h2><table>
          ${k.posisi.persediaan.map((p) => `<tr><td>Persediaan · ${esc(p.nama)}</td><td class="num">${rp(p.nilai)}</td></tr>`).join("")}
          <tr><td>Persediaan dalam perjalanan</td><td class="num">${rp(k.posisi.persediaan.reduce((a, p) => a + p.transit, 0))}</td></tr>
          <tr><td>Piutang marketplace (pesanan Diproses)</td><td class="num">${rp(k.posisi.piutang_marketplace)}</td></tr>
          <tr><td>Kerugian belum diselesaikan</td><td class="num">${rp(k.posisi.kerugian_belum)}</td></tr><tr><td>Utang pemasok</td><td class="num">${rp(k.posisi.utang_pemasok)}</td></tr>
          <tr><td>Uang pre-sale, barang belum diambil (${k.posisi.presale_belum_diambil.jumlah})</td><td class="num">${rp(k.posisi.presale_belum_diambil.n)}</td></tr></table></div></div>
    </div>
    <h2 class="section">Per event dan tempat</h2>${tabelLaporan([{ judul: "Tempat", isi: (b) => esc(b.nama) }, { judul: "Penjualan bersih", num: true, isi: (b) => rp(b.bersih), total: jml("bersih") },
      { judul: "Laba kotor", num: true, isi: (b) => rp(b.laba_kotor), total: jml("laba_kotor") }, { judul: "Biaya", num: true, isi: (b) => rp(b.biaya), total: jml("biaya") },
      { judul: "Kerugian", num: true, isi: (b) => rp(b.kerugian), total: jml("kerugian") },
      ...(k.pengaturan.bagi_biaya_umum ? [{ judul: "Bagian biaya umum", num: true, isi: (b) => rp(b.bagian_umum), total: jml("bagian_umum") }] : []),
      { judul: "Laba bersih", num: true, isi: (b) => `<b>${rp(b.laba_bersih)}</b>`, total: jml("laba_bersih") }], k.per_event.map((e) => ({ ...e, _klik: e.jenis === "event" ? e.id : "" })), true)}
    <h2 class="section">Per bulan</h2>${tabelLaporan([{ judul: "Bulan", isi: (b) => b.bulan }, K.bersih, K.laba, { judul: "Biaya", num: true, isi: (b) => rp(b.biaya), total: jml("biaya") }], k.per_bulan, true)}
    <div class="grid2"><div><h2 class="section">Per kategori</h2>${tabelLaporan([{ judul: "Kategori", isi: (b) => esc(b.nama) }, K.qty, K.bersih, K.laba], k.kategori, true)}</div>
      <div><h2 class="section">Per ukuran</h2>${tabelLaporan([{ judul: "Ukuran", isi: (b) => esc(b.ukuran) }, K.qty, { judul: "Porsi qty", num: true, isi: (b) => pct(b.qty, k.ukuran.reduce((a, x) => a + x.qty, 0)) }, K.bersih], k.ukuran, true)}</div></div>
    <h2 class="section">Kerugian</h2>${tabelLaporan([{ judul: "Tanggal", isi: (b) => waktu(b.tanggal) }, { judul: "Jenis", isi: (b) => esc(b.jenis) }, { judul: "Rincian", isi: (b) => esc(b.rincian ?? "") },
      { judul: "Jumlah", num: true, isi: (b) => rp(b.jumlah), total: jml("jumlah") }, { judul: "Diganti", num: true, isi: (b) => rp(b.diganti), total: jml("diganti") }], k.kerugian, true)}
  </main>`;
  pasangSubtabs(halKeuangan);
  pasangTombolKeu({ nama: `keuangan-${k.dari}-${k.sampai}.csv`, baris: csv }, () => halKeuangan("keseluruhan"));
  $("#isi").querySelectorAll("[data-pk]").forEach((b) => (b.onclick = () => { periodeKeu.tab = b.dataset.pk; [periodeKeu.dari, periodeKeu.sampai] = hitungPeriodeKeu(b.dataset.pk); keuKeseluruhan(); }));
  const ubah = () => { periodeKeu = { tab: "khusus", dari: $("#pkDari").value, sampai: $("#pkSampai").value }; if (periodeKeu.dari > periodeKeu.sampai) periodeKeu.sampai = periodeKeu.dari; keuKeseluruhan(); };
  $("#pkDari").onchange = $("#pkSampai").onchange = ubah;
  $("#bagiUmum").onchange = (e) => sakelarBagi(e.target.checked);
  $("#isi").querySelectorAll("[data-klik]").forEach((tr) => (tr.onclick = () => { if (!tr.dataset.klik) return; evKeu = tr.dataset.klik; halKeuangan("event"); }));
}

async function keuEvent() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { event } = await api("GET", "/api/event");
  if (!evKeu) evKeu = event[0]?.id ?? "";
  if (!evKeu) { $("#isi").innerHTML = `<main>${kepalaKeu()}<p class="muted">Belum ada event.</p></main>`; pasangSubtabs(halKeuangan); return; }
  const k = await api("GET", "/api/keuangan/event/" + evKeu);
  const r = k.ringkasan, B = r.bersih, ind = k.indikator, e = k.event;
  const csv = [["Bagian", "Nama", "Jumlah"], ["", "Penjualan", r.kotor], ["", "Diskon & promo", -r.diskon], ["", "Pembulatan", -r.bulat], ["", "Retur uang kembali", -r.retur], ["", "Penjualan bersih", B], ["", "HPP", -r.hpp],
    ["", "Laba kotor", r.laba], ...k.biaya.map((b) => ["Biaya", b.kategori, -b.jumlah]), ["", "Kerugian", -r.kerugian], ["", "Penggantian", r.diganti], ["", "Selisih kas lebih", r.kas_lebih],
    ...(r.bagian_umum ? [["", "Bagian biaya umum", -r.bagian_umum]] : []), ["", "Laba bersih", r.laba_bersih], ...k.produk.map((p) => ["Produk", p.nama, p.bersih])];
  const rugi = (j) => k.kerugian.filter((x) => x.jenis === j).reduce((a, x) => a + x.jumlah, 0);
  $("#isi").innerHTML = `<main>${kepalaKeu(tombolKeu(evKeu))}
    <div class="filters ku-noprint"><select id="pilihEv">${event.map((x) => `<option value="${x.id}" ${x.id === evKeu ? "selected" : ""}>${esc(x.nama)}${x.ditutup ? " (ditutup)" : ""}</option>`).join("")}</select>
      <label style="margin:0;font-weight:400"><input type="checkbox" id="bagiUmum" ${k.pengaturan.bagi_biaya_umum ? "checked" : ""} style="width:auto"> Bagi biaya umum ke event</label></div>
    <h2>${esc(e.nama)} <span class="small muted">${tgl(e.mulai)}${e.selesai !== e.mulai ? " – " + tgl(e.selesai) : ""}${e.venue ? " · " + esc(e.venue) : ""}</span></h2>
    ${e.ditutup ? "" : '<div class="warn">Event belum ditutup. Angka masih bisa berubah.</div>'}
    <div class="kpis" style="margin-top:12px"><div class="kpi"><span class="muted small">Penjualan bersih</span><b>${rp(B)}</b></div><div class="kpi"><span class="muted small">Laba kotor</span><b>${rp(r.laba)}</b><span class="small muted">${pct(r.laba, B)}</span></div>
      <div class="kpi"><span class="muted small">Biaya + kerugian</span><b>${rp(r.biaya + r.kerugian)}</b></div>
      <div class="kpi"><span class="muted small">Laba bersih</span><b style="${r.laba_bersih < 0 ? "color:var(--danger-text)" : ""}">${rp(r.laba_bersih)}</b><span class="small muted">${pct(r.laba_bersih, B)}</span></div>
      <div class="kpi"><span class="muted small">Sell-through</span><b>${String(r.sell_through).replace(".", ",")}%</b></div></div>
    <div class="grid2">
      <div class="card"><h2>Laba rugi event</h2><table>
        ${barisLR("Penjualan", r.kotor, B)}${barisLR("Diskon & promo", -r.diskon, B, { indent: true })}${barisLR("Pembulatan", -r.bulat, B, { indent: true })}${barisLR("Retur uang kembali", -r.retur, B, { indent: true })}
        ${barisLR("Penjualan bersih", B, B, { tebal: true })}${barisLR("HPP", -r.hpp, B, { indent: true })}${barisLR("Laba kotor", r.laba, B, { tebal: true })}
        ${k.biaya.map((b) => barisLR("Biaya · " + esc(b.kategori), -b.jumlah, B, { indent: true })).join("")}
        ${barisLR("Kerugian selisih opname", -rugi("stok"), B, { indent: true })}${barisLR("Kerugian barang terbuang", -rugi("terbuang"), B, { indent: true })}
        ${barisLR("Kerugian kas kurang", -rugi("kas"), B, { indent: true })}${barisLR("Kerugian kiriman kurang", -rugi("kiriman"), B, { indent: true })}
        ${barisLR("Penggantian dari penanggung jawab", r.diganti, B, { indent: true })}${barisLR("Selisih kas lebih", r.kas_lebih, B, { indent: true })}
        ${k.pengaturan.bagi_biaya_umum ? barisLR("Bagian biaya umum", -r.bagian_umum, B, { indent: true }) : ""}${barisLR("Laba bersih", r.laba_bersih, B, { tebal: true })}</table></div>
      <div><div class="card"><h2>Indikator</h2><table>
          <tr><td>Rata-rata nilai transaksi</td><td class="num">${rp(ind.rata_transaksi)}</td></tr><tr><td>Rata-rata pcs per transaksi</td><td class="num">${String(ind.pcs_per_transaksi).replace(".", ",")}</td></tr>
          <tr><td>Persen diskon</td><td class="num">${String(ind.persen_diskon).replace(".", ",")}%</td></tr><tr><td>Barang diretur</td><td class="num">${ind.barang_diretur} pcs</td></tr>
          <tr><td>Titik impas (penjualan bersih minimum)</td><td class="num">${ind.titik_impas === null ? "—" : rp(ind.titik_impas)} ${ind.titik_impas === null ? "" : ind.lewat_impas ? '<span class="tag aktif">sudah lewat</span>' : '<span class="tag off">belum</span>'}</td></tr></table></div>
        <div class="card" style="margin-top:14px"><h2>Uang diterima</h2><table>${k.uang.metode.map((m) => `<tr><td>${esc(m.metode)}</td><td class="num">${rp(m.jumlah)}</td></tr>`).join("") || '<tr><td class="muted">Belum ada.</td></tr>'}
          <tr><td>Uang pre-sale, barang belum diambil (${k.uang.presale_belum_diambil.n})</td><td class="num">${rp(k.uang.presale_belum_diambil.nilai)}</td></tr>
          <tr><td>Setoran tunai dari laci (${k.uang.shift} shift)</td><td class="num">${rp(k.uang.setoran_tunai)}</td></tr></table></div></div>
    </div>
    <div class="grid2"><div><h2 class="section">Per kategori</h2>${tabelLaporan([{ judul: "Kategori", isi: (b) => esc(b.nama) }, K.qty, K.bersih, K.laba], k.kategori, true)}</div>
      <div><h2 class="section">Per ukuran</h2>${tabelLaporan([{ judul: "Ukuran", isi: (b) => esc(b.ukuran) }, K.qty, { judul: "Porsi qty", num: true, isi: (b) => pct(b.qty, k.ukuran.reduce((a, x) => a + x.qty, 0)) }], k.ukuran, true)}</div></div>
    <h2 class="section">Per produk</h2>${tabelLaporan([{ judul: "Produk", isi: (b) => esc(b.nama) }, { judul: "Diterima", num: true, isi: (b) => b.diterima, total: jml("diterima", String) },
      { judul: "Terjual", num: true, isi: (b) => b.qty, total: jml("qty", String) }, { judul: "Sell-through", num: true, isi: (b) => `<span style="${b.sell_through < 30 ? "color:var(--danger-text);font-weight:700" : ""}">${String(b.sell_through).replace(".", ",")}%</span>` },
      { judul: e.ditutup ? "Kembali ke gudang" : "Sisa di event", num: true, isi: (b) => (e.ditutup ? b.kembali : b.sisa) }, K.bersih, K.laba], k.produk, true)}
    <h2 class="section">Rincian biaya dan kerugian</h2>${tabelLaporan([{ judul: "Jenis", isi: (b) => esc(b.jenis) }, { judul: "Rincian", isi: (b) => esc(b.rincian) }, { judul: "Jumlah", num: true, isi: (b) => rp(b.jumlah), total: jml("jumlah") }],
      [...k.biaya.map((b) => ({ jenis: "Biaya", rincian: b.kategori, jumlah: b.jumlah })), ...k.kerugian.map((x) => ({ jenis: "Kerugian " + x.jenis, rincian: x.rincian ?? "", jumlah: x.jumlah }))], true)}
  </main>`;
  pasangSubtabs(halKeuangan);
  pasangTombolKeu({ nama: `keuangan-${e.nama}.csv`, baris: csv }, () => halKeuangan("event"));
  $("#pilihEv").onchange = (x) => { evKeu = x.target.value; keuEvent(); };
  $("#bagiUmum").onchange = (x) => sakelarBagi(x.target.checked);
}

// ---------- Biaya ----------

let filterBiaya = { lokasi: "", kategori: "", dari: "", sampai: "" };
let kategoriBiaya = null;

async function daftarBiaya() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const q = new URLSearchParams(Object.entries(filterBiaya).filter(([, v]) => v));
  const [d, { event }, kat] = await Promise.all([api("GET", "/api/biaya?" + q), api("GET", "/api/event"), kategoriBiaya ?? api("GET", "/api/biaya/kategori")]);
  kategoriBiaya = kat;
  const semuaKat = [...new Set([...kat.event, ...kat.umum, "Kas keluar laci"])];
  $("#isi").innerHTML = `<main>${kepalaKeu('<div style="display:flex;gap:8px"><button class="btn" id="unduhBiaya">Unduh CSV</button><button class="btn primary" id="tambahBiaya">+ Catat Biaya</button></div>')}
    <form class="filters" id="fFilterBiaya"><select name="lokasi"><option value="">Semua</option><option value="umum" ${filterBiaya.lokasi === "umum" ? "selected" : ""}>Umum</option>${event.map((e) => `<option value="${e.id}" ${filterBiaya.lokasi === e.id ? "selected" : ""}>${esc(e.nama)}</option>`).join("")}</select>
      <select name="kategori"><option value="">Semua kategori</option>${semuaKat.map((k) => `<option ${filterBiaya.kategori === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>
      <input type="date" name="dari" value="${filterBiaya.dari}"><span>s/d</span><input type="date" name="sampai" value="${filterBiaya.sampai}"><button class="btn small primary">Terapkan</button></form>
    <div class="kpis"><div class="kpi"><span class="muted small">Total</span><b>${rp(d.ringkasan.total)}</b></div><div class="kpi"><span class="muted small">Biaya event</span><b>${rp(d.ringkasan.event)}</b></div>
      <div class="kpi"><span class="muted small">Biaya umum</span><b>${rp(d.ringkasan.umum)}</b></div><div class="kpi"><span class="muted small">Kas keluar laci</span><b>${rp(d.ringkasan.laci)}</b></div></div>
    ${tabelBiaya(d.biaya, true)}</main>`;
  pasangSubtabs(halKeuangan);
  $("#fFilterBiaya").onsubmit = (e) => { e.preventDefault(); filterBiaya = Object.fromEntries(new FormData(e.target)); daftarBiaya(); };
  $("#tambahBiaya").onclick = () => formBiaya(null, null, () => halKeuangan("biaya"));
  $("#unduhBiaya").onclick = () => unduhCsv("biaya.csv", [["No", "Tanggal", "Dibebankan ke", "Kategori", "Keterangan", "Cara", "Jumlah", "Oleh"],
    ...d.biaya.map((b) => [b.no ?? "Laci POS", b.tanggal, b.lokasi ?? "Umum", b.kategori, b.keterangan, b.cara, b.jumlah, b.oleh])]);
  pasangAksiBiaya(d.biaya, () => halKeuangan("biaya"));
}

function tabelBiaya(biaya, bolehUbah) {
  return `<div class="tablewrap"><table><thead><tr><th>Tanggal</th><th>No.</th><th>Dibebankan ke</th><th>Kategori</th><th>Keterangan</th><th>Cara</th><th class="num">Jumlah</th><th></th></tr></thead><tbody>
    ${biaya.length ? biaya.map((b) => `<tr><td>${tgl(b.tanggal)}</td><td>${b.sumber === "laci" ? '<span class="tag">Laci POS</span>' : esc(b.no)}</td><td>${esc(b.lokasi ?? "Umum")}</td><td>${esc(b.kategori)}</td>
      <td>${esc(b.keterangan)}<div class="small muted">${esc(b.oleh ?? "")}</div></td><td>${esc(b.cara)}</td><td class="num">${rp(b.jumlah)}</td>
      <td style="white-space:nowrap">${b.bukti ? `<a href="/api/berkas/${b.bukti}" target="_blank">Bukti</a> ` : ""}${bolehUbah && b.sumber === "biaya" ? `<button class="btn small" data-ubahb="${b.id}">Ubah</button> <button class="btn small danger" data-hapusb="${b.id}">Hapus</button>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Belum ada biaya.</td></tr>'}</tbody></table></div>`;
}
function pasangAksiBiaya(biaya, kembali) {
  $("#isi").querySelectorAll("[data-ubahb]").forEach((b) => (b.onclick = () => formBiaya(biaya.find((x) => x.id === b.dataset.ubahb), null, kembali)));
  $("#isi").querySelectorAll("[data-hapusb]").forEach((b) => (b.onclick = async () => {
    const x = biaya.find((y) => y.id === b.dataset.hapusb);
    if (!confirm(`Hapus biaya ${x.no} ${rp(x.jumlah)}?`)) return;
    await api("DELETE", "/api/biaya/" + x.id);
    kembali();
  }));
}

// Form biaya halaman penuh. lokasiTetap: dari detail event (Admin tidak bisa memilih Umum).
async function formBiaya(lama, lokasiTetap, kembali) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ event }, kat] = await Promise.all([api("GET", "/api/event"), kategoriBiaya ?? api("GET", "/api/biaya/kategori")]);
  kategoriBiaya = kat;
  const owner = saya.role.includes("owner");
  let lokasi = lama ? lama.lokasi_id ?? "" : lokasiTetap ?? (owner ? "" : event[0]?.id ?? "");
  const gambar = () => {
    const daftar = lokasi ? kat.event : kat.umum;
    $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>${lama ? "Ubah biaya " + esc(lama.no) : "Catat biaya"}</h1>
      <form class="card" id="fBiaya" style="margin-top:12px">
        <div class="grid2"><div><label>Dibebankan ke</label><select name="lokasi_id" ${lokasiTetap && !owner ? "disabled" : ""}>${owner ? `<option value="" ${!lokasi ? "selected" : ""}>Umum</option>` : ""}
          ${event.map((e) => `<option value="${e.id}" ${e.id === lokasi ? "selected" : ""}>${esc(e.nama)}${e.ditutup ? " (ditutup)" : ""}</option>`).join("")}</select></div>
          <div><label>Tanggal</label><input type="date" name="tanggal" required max="${hariIni()}" value="${lama?.tanggal ?? hariIni()}"></div>
          <div><label>Kategori</label><select name="kategori" required>${daftar.map((k) => `<option ${lama?.kategori === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
          <div><label>Jumlah (Rp)</label><input name="jumlah" inputmode="numeric" required value="${lama?.jumlah ?? ""}"></div>
          <div><label>Cara bayar</label><select name="cara"><option ${lama?.cara === "Transfer" ? "selected" : ""}>Transfer</option><option value="Tunai" ${lama?.cara === "Tunai" ? "selected" : ""}>Tunai dari kas kantor</option></select></div>
          <div><label>Bukti (foto, opsional)</label><input type="file" name="bukti" accept="image/*">${lama?.bukti ? '<p class="small muted">Sudah ada bukti. Pilih file baru untuk mengganti.</p>' : ""}</div></div>
        <label>Keterangan</label><input name="keterangan" required maxlength="200" value="${esc(lama?.keterangan ?? "")}">
        <p class="small muted">Potongan MDR QRIS dan biaya bank dicatat manual sesuai mutasi rekening atau laporan aplikasi merchant.</p>
        <div class="err" hidden></div><div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batal">Batal</button></div></form></div>`;
    const f = $("#fBiaya");
    f.lokasi_id.onchange = () => { lokasi = f.lokasi_id.value; gambar(); };
    $("#kembali").onclick = $("#batal").onclick = kembali;
    formKirim(f, async (d) => {
      const file = f.bukti.files[0];
      const bukti = file ? (await unggah(file, "bukti_biaya")).id : lama?.bukti ?? undefined;
      const b = { lokasi_id: lokasi || undefined, tanggal: d.tanggal, kategori: d.kategori, jumlah: angka(d.jumlah), cara: d.cara, keterangan: d.keterangan, bukti };
      if (lama) await api("PATCH", "/api/biaya/" + lama.id, b); else await api("POST", "/api/biaya", b);
      kembali();
    });
  };
  gambar();
}

// Kartu "Biaya event" di detail event: biaya tercatat + kas keluar laci. Owner juga mendapat tombol Laporan Keuangan.
async function kartuBiayaEvent(id, el) {
  const d = await api("GET", `/api/biaya?lokasi=${id}`);
  const owner = saya.role.includes("owner");
  el.innerHTML = `<div class="head" style="margin-top:22px"><h2 style="margin:0">Biaya event · ${rp(d.ringkasan.total)}</h2><div style="display:flex;gap:8px">
      ${owner ? '<button class="btn" id="keKeuEv">Laporan Keuangan</button>' : ""}<button class="btn" id="catatBiayaEv">+ Catat Biaya</button></div></div>${tabelBiaya(d.biaya, owner)}`;
  $("#catatBiayaEv").onclick = () => formBiaya(null, id, () => detailEvent(id));
  if ($("#keKeuEv")) $("#keKeuEv").onclick = () => { evKeu = id; subKeu = "event"; buka("keuangan"); };
  pasangAksiBiaya(d.biaya, () => detailEvent(id));
}
