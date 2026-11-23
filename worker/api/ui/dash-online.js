// Dashboard › Online (Daftar Pesanan, Impor, Riwayat Impor, Biaya Marketplace), Pelanggan, dan bagian Harga Marketplace di form produk.

let subOnline = "pesanan";
let filterOnline = { saluran: "", dari: "", sampai: "", cari: "" };
const jamWib = (iso) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 16);

function halOnline(sub) {
  if (sub) subOnline = sub;
  ({ pesanan: daftarPesananOnline, impor: riwayatImporOnline, biaya: biayaMarketplace })[subOnline]();
}
const kepalaOnline = (tombol = "") => `<div class="head"><div><h1>${judulMenu("online", subOnline)}</h1><p class="muted small">Pesanan Shopee, Tokopedia, TikTok Shop, dan lainnya. Pesanan mengurangi stok Gudang Pusat.</p></div>${tombol}</div>
  ${subtabs([["pesanan", "Daftar Pesanan"], ["impor", "Riwayat Impor"], ["biaya", "Biaya Marketplace"]], subOnline)}`;

// ---------- Daftar pesanan ----------

async function daftarPesananOnline() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  if (!filterOnline.dari) {
    const awal = new Date(Date.now() + 7 * 3600_000);
    awal.setUTCDate(1);
    filterOnline = { ...filterOnline, dari: awal.toISOString().slice(0, 10), sampai: hariIni() };
  }
  const q = new URLSearchParams(Object.entries(filterOnline).filter(([, v]) => v));
  const [{ saluran }, d] = await Promise.all([api("GET", "/api/saluran"), api("GET", "/api/online?" + q)]);
  const r = d.ringkasan.total;
  $("#isi").innerHTML = `<main>${kepalaOnline('<div style="display:flex;gap:8px"><button class="btn" id="imporFile">Impor CSV/Excel</button><button class="btn primary" id="inputManual">+ Input Manual</button></div>')}
    ${pil([["", "Semua"], ...saluran.map((s) => [s.id, esc(s.nama)])], filterOnline.saluran, "sal")}
    <form class="filters" id="fFilterOnline"><label style="margin:0">Dari</label><input type="date" name="dari" value="${filterOnline.dari}"><label style="margin:0">Sampai</label><input type="date" name="sampai" value="${filterOnline.sampai}">
      <input type="search" name="cari" placeholder="No. pesanan, pembeli, SKU" value="${esc(filterOnline.cari)}"><button class="btn small primary">Terapkan</button></form>
    <div class="kpis"><div class="kpi"><span class="muted small">Pesanan</span><b>${r.jumlah}</b></div><div class="kpi"><span class="muted small">Penjualan kotor</span><b>${rp(r.kotor)}</b></div>
      <div class="kpi"><span class="muted small">Potongan marketplace</span><b>${rp(r.potongan)}</b></div><div class="kpi"><span class="muted small">Pendapatan bersih</span><b>${rp(r.bersih)}</b></div></div>
    <div class="tablewrap"><table><thead><tr><th>Tanggal</th><th>No. pesanan</th><th>Saluran</th><th>Barang</th><th class="num">Kotor</th><th class="num">Potongan</th><th class="num">Bersih</th><th>Status</th></tr></thead><tbody>
    ${d.pesanan.length ? d.pesanan.map((o) => `<tr class="klik" data-id="${o.id}"><td>${waktu(o.tanggal)}</td><td><b>${esc(o.no_pesanan)}</b>${o.pembeli ? `<div class="small muted">${esc(o.pembeli)}</div>` : ""}</td>
      <td>${esc(o.saluran)}</td><td class="small">${esc(o.items[0]?.nama ?? "")}${o.items.length > 1 ? ` <span class="muted">+${o.items.length - 1} lainnya</span>` : ""}</td>
      <td class="num">${rp(o.kotor)}</td><td class="num">${rp(o.potongan)}</td><td class="num"><b>${rp(o.bersih)}</b></td>
      <td><span class="tag ${o.status === "Selesai" ? "aktif" : o.status === "Diproses" ? "warn" : "off"}">${esc(o.status)}</span><div class="small muted">${esc(o.sumber)}</div></td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Belum ada pesanan di rentang ini.</td></tr>'}
    </tbody></table></div><p class="small muted">Pesanan yang dibatalkan tidak dihitung di ringkasan.</p></main>`;
  pasangSubtabs(halOnline);
  $("#isi").querySelectorAll("[data-sal]").forEach((b) => (b.onclick = () => { filterOnline.saluran = b.dataset.sal; daftarPesananOnline(); }));
  const f = $("#fFilterOnline");
  f.onsubmit = (e) => { e.preventDefault(); filterOnline = { ...filterOnline, dari: f.dari.value, sampai: f.sampai.value, cari: f.cari.value.trim() }; daftarPesananOnline(); };
  $("#inputManual").onclick = () => formPesananOnline();
  $("#imporFile").onclick = () => imporLangkah1();
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => detailPesananOnline(tr.dataset.id)));
}

async function detailPesananOnline(id) {
  const { pesanan: o, items } = await api("GET", "/api/online/" + id);
  $("#popupIsi").innerHTML = `<h2>${esc(o.saluran)} · ${esc(o.no_pesanan)}</h2>
    <div class="muted small">${waktu(o.tanggal)}${o.pembeli ? " · " + esc(o.pembeli) : ""}${o.pelanggan ? " · pelanggan " + esc(o.pelanggan) : ""} · ${esc(o.sumber)}${o.nama_file ? " (" + esc(o.nama_file) + ")" : ""} oleh ${esc(o.oleh_nama)}</div>
    <table style="margin-top:10px">${items.map((i) => `<tr><td>${esc(i.nama)}<div class="small muted">${esc(i.sku)} · ${i.qty} × ${rp(i.harga)} · HPP ${rp(i.hpp)}</div></td><td class="num">${rp(i.qty * i.harga)}</td></tr>`).join("")}
      <tr><td>Kotor</td><td class="num">${rp(o.kotor)}</td></tr><tr><td>Potongan marketplace</td><td class="num">−${rp(o.potongan)}</td></tr>
      <tr><td><b>Bersih</b></td><td class="num"><b>${rp(o.kotor - o.potongan)}</b></td></tr></table>
    ${o.catatan ? `<p class="small">${esc(o.catatan)}</p>` : ""}
    ${o.status === "Dibatalkan" ? `<p class="small" style="color:var(--danger-text)">Dibatalkan ${waktu(o.batal_pada)} oleh ${esc(o.batal_oleh_nama)}. Stok sudah kembali ke Gudang Pusat.</p>` : ""}
    <div class="err" hidden></div>
    <div class="actions">${o.status === "Dibatalkan" ? "" : `<button class="btn" data-st="${o.status === "Selesai" ? "Diproses" : "Selesai"}">Tandai ${o.status === "Selesai" ? "Diproses" : "Selesai"}</button>
      <button class="btn danger" data-st="Dibatalkan">Batalkan pesanan</button>`}<button class="btn primary" id="tutupPopup">Tutup</button></div>`;
  $("#popup").hidden = false;
  $("#tutupPopup").onclick = () => { $("#popup").hidden = true; };
  $("#popupIsi").querySelectorAll("[data-st]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.st === "Dibatalkan" && !confirm("Batalkan pesanan ini? Stok kembali ke Gudang Pusat.")) return;
    try { await api("POST", `/api/online/${id}/status`, { status: b.dataset.st }); $("#popup").hidden = true; daftarPesananOnline(); }
    catch (x) { const e = $("#popupIsi .err"); e.textContent = x.message; e.hidden = false; }
  }));
}

// ---------- Input manual ----------

async function formPesananOnline(salId) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const { saluran } = await api("GET", "/api/saluran");
  const pilihan = saluran.filter((s) => s.aktif || !s.marketplace);
  const sid = salId ?? pilihan[0].id;
  const [{ varian, perkiraan }, { pelanggan }] = await Promise.all([api("GET", `/api/saluran/${sid}/katalog`), api("GET", "/api/pelanggan")]);
  const baris = [{ sku: "", qty: 1, harga: "" }];
  const kotor = () => baris.reduce((a, b) => a + (angka(b.qty) ?? 0) * (angka(b.harga) ?? 0), 0);
  const kira = () => (kotor() ? Math.round((kotor() * (perkiraan.admin_bp + perkiraan.layanan_bp)) / 10000) + perkiraan.per_pesanan : 0);
  const isian = { tanggal: jamWib(new Date().toISOString()) };
  const gambar = () => {
    const lama = $("#fOnline");
    if (lama) for (const k of ["no_pesanan", "tanggal", "pembeli", "pelanggan_id", "status", "potongan", "catatan"]) isian[k] = lama[k].value;
    $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>Input pesanan online</h1>
      <form class="card" id="fOnline" style="margin-top:12px">
        <div class="grid2"><div><label>Saluran</label><select name="saluran_id">${pilihan.map((s) => `<option value="${s.id}" ${s.id === sid ? "selected" : ""}>${esc(s.nama)}</option>`).join("")}</select></div>
          <div><label>No. pesanan</label><input name="no_pesanan" required maxlength="60"></div>
          <div><label>Tanggal dan jam pesanan</label><input type="datetime-local" name="tanggal" required></div>
          <div><label>Status</label><select name="status"><option>Selesai</option><option>Diproses</option></select></div>
          <div><label>Nama pembeli (opsional)</label><input name="pembeli" maxlength="80"></div>
          <div><label>Pelanggan (opsional)</label><select name="pelanggan_id"><option value="">—</option>${pelanggan.map((p) => `<option value="${p.id}">${esc(p.nama)}${p.telp ? " · " + esc(p.telp) : ""}</option>`).join("")}</select></div></div>
        <div class="bagian">Barang</div>
        ${varian.length ? "" : `<div class="warn small" style="margin:0 0 10px">Belum ada produk yang aktif di saluran ini. Aktifkan di Produk › form produk › Harga Marketplace.</div>`}
        <div class="tablewrap"><table><thead><tr><th>Produk</th><th class="num" style="width:110px">Jumlah</th><th class="num" style="width:170px">Harga satuan</th><th class="num" style="width:140px">Subtotal</th><th style="width:48px"></th></tr></thead><tbody>
          ${baris.map((b, i) => `<tr><td><select data-i="${i}" data-k="sku"><option value="">Pilih produk</option>${varian.map((v) => `<option value="${esc(v.sku)}" ${v.sku === b.sku ? "selected" : ""}>${esc(v.nama)} · stok gudang ${v.stok_gudang}</option>`).join("")}</select></td>
          <td><input inputmode="numeric" data-i="${i}" data-k="qty" value="${b.qty}" style="text-align:right"></td><td><input inputmode="numeric" data-i="${i}" data-k="harga" value="${b.harga}" placeholder="0" style="text-align:right"></td>
          <td class="num" data-subtotal="${i}">${rp((angka(b.qty) ?? 0) * (angka(b.harga) ?? 0))}</td>
          <td>${baris.length > 1 ? `<button type="button" class="ikon-hapus" data-hapus="${i}" title="Hapus barang" aria-label="Hapus barang">✕</button>` : ""}</td></tr>`).join("")}
          <tr><td colspan="5"><button type="button" class="btn small garis-putus" id="tambahBaris">+ Barang</button></td></tr></tbody></table></div>
        <div class="grid2" style="margin-top:6px;align-items:start"><div><label>Potongan marketplace (Rp)</label><input inputmode="numeric" name="potongan" value="0">
          <p class="small muted" style="margin:6px 0 0">Perkiraan dari Biaya Marketplace: <b id="kira">${rp(kira())}</b> <button type="button" class="btn small" id="pakaiKira">Pakai</button></p></div>
          <div class="ringkas"><div><span>Kotor</span><b id="kotor">${rp(kotor())}</b></div><div><span>Potongan</span><span id="potTampil">−${rp(0)}</span></div><div class="besar"><span>Bersih</span><b id="bersih">${rp(kotor())}</b></div></div></div>
        <label>Catatan</label><input name="catatan" maxlength="300" placeholder="Opsional">
        <div class="err" hidden></div>
        <div class="actions"><button class="btn primary">Simpan pesanan</button><button type="button" class="btn batal" id="batal">Batal</button></div>
      </form></div>`;
    const f = $("#fOnline");
    for (const [k, v] of Object.entries(isian)) if (v !== undefined) f[k].value = v;
    f.saluran_id.onchange = () => formPesananOnline(f.saluran_id.value);
    const segar = () => {
      const pot = angka(f.potongan.value) ?? 0;
      baris.forEach((b, i) => { const el = f.querySelector(`[data-subtotal="${i}"]`); if (el) el.textContent = rp((angka(b.qty) ?? 0) * (angka(b.harga) ?? 0)); });
      $("#kotor").textContent = rp(kotor()); $("#kira").textContent = rp(kira());
      $("#potTampil").textContent = "−" + rp(pot); $("#bersih").textContent = rp(kotor() - pot);
    };
    f.potongan.oninput = segar;
    segar();
    f.querySelectorAll("[data-k]").forEach((el) => (el.oninput = el.onchange = () => {
      const b = baris[el.dataset.i];
      if (el.dataset.k === "qty" && b.sku) {
        const ada = varian.find((v) => v.sku === b.sku)?.stok_gudang ?? 0;
        if (Number(el.value) > ada) { el.value = ada; pesanMaks(el, `${ada} (stok gudang)`); }
      }
      b[el.dataset.k] = el.value;
      if (el.dataset.k === "sku") { b.harga = String(varian.find((v) => v.sku === el.value)?.harga ?? ""); gambar(); return; }
      segar();
    }));
    f.querySelectorAll("[data-hapus]").forEach((el) => (el.onclick = () => { baris.splice(+el.dataset.hapus, 1); gambar(); }));
    $("#tambahBaris").onclick = () => { baris.push({ sku: "", qty: 1, harga: "" }); gambar(); };
    $("#pakaiKira").onclick = () => { f.potongan.value = kira(); segar(); };
    $("#kembali").onclick = $("#batal").onclick = () => halOnline("pesanan");
    formKirim(f, async (d) => {
      const items = baris.filter((b) => b.sku).map((b) => ({ sku: b.sku, qty: angka(b.qty), harga: angka(b.harga) }));
      if (!items.length) throw new Error("Pilih minimal satu barang");
      await api("POST", "/api/online", { saluran_id: d.saluran_id, no_pesanan: d.no_pesanan.trim(), tanggal: d.tanggal, status: d.status, pembeli: d.pembeli || undefined,
        pelanggan_id: d.pelanggan_id || undefined, potongan: angka(d.potongan) ?? 0, catatan: d.catatan || undefined, items });
      halOnline("pesanan");
    });
  };
  gambar();
}

// ---------- Impor CSV (3 langkah) ----------

const KOLOM_IMPOR = [
  { k: "noPesanan", label: "No. Pesanan", wajib: true, syn: ["no. pesanan", "no pesanan", "nomor pesanan", "nomor invoice", "no. invoice", "invoice", "order id", "order sn"] },
  { k: "tanggal", label: "Tanggal Pesanan", wajib: true, syn: ["waktu pesanan dibuat", "tanggal pembayaran", "tanggal pesanan", "created time", "payment date", "order date", "tanggal", "waktu"] },
  { k: "sku", label: "SKU", wajib: true, syn: ["nomor referensi sku", "nomor sku", "seller sku", "sku induk", "sku"] },
  { k: "nama", label: "Nama Produk", syn: ["nama produk", "product name", "produk"] },
  { k: "variasi", label: "Variasi", syn: ["nama variasi", "variasi", "variation"] },
  { k: "jumlah", label: "Jumlah", wajib: true, syn: ["jumlah produk dibeli", "jumlah", "quantity", "qty"] },
  { k: "harga", label: "Harga Satuan", syn: ["harga setelah diskon", "harga jual (idr)", "harga jual", "harga satuan", "price"] },
  { k: "subtotal", label: "Subtotal Produk", syn: ["total harga produk", "subtotal", "total harga"] },
  { k: "potongan", label: "Potongan Marketplace", syn: ["biaya administrasi", "biaya layanan", "biaya admin", "komisi", "potongan", "fee"] },
  { k: "status", label: "Status Pesanan", syn: ["status pesanan", "status terakhir", "order status", "status"] },
  { k: "pembeli", label: "Nama Pembeli", syn: ["username (pembeli)", "nama pembeli", "pembeli", "buyer"] },
];
let imp = null;
const normal = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function bacaCsv(teks) {
  teks = teks.replace(/^﻿/, "");
  const pertama = teks.split(/\r?\n/)[0] ?? "";
  const pemisah = pertama.split(";").length > pertama.split(",").length ? ";" : pertama.split("\t").length > pertama.split(",").length ? "\t" : ",";
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (q) { if (c === '"') { if (teks[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === pemisah) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && teks[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const bersih = rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
  return { judul: bersih[0] ?? [], data: bersih.slice(1) };
}
function bacaAngka(v) {
  let s = String(v ?? "").replace(/rp/gi, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return Number(s);
}
// Tanggal dari file (jam WIB) → "YYYY-MM-DDTHH:MM".
function bacaTanggal(v) {
  const s = String(v ?? "").trim(), p = (n) => String(n).padStart(2, "0");
  // Tanggal Excel yang tersimpan sebagai angka seri (hari sejak 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86_400_000));
    return d.toISOString().slice(0, 16);
  }
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2})[:.](\d{2}))?/);
  if (m) return `${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4] ?? 0)}:${m[5] ?? "00"}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ ,]+(\d{1,2})[:.](\d{2}))?/);
  if (m) return `${m[3]}-${p(m[2])}-${p(m[1])}T${p(m[4] ?? 0)}:${m[5] ?? "00"}`;
  return "";
}
// Pembaca .xlsx tanpa pustaka: file xlsx adalah zip berisi XML. Lembar pertama yang dibaca.
async function bacaXlsx(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("File Excel tidak terbaca. Simpan sebagai CSV lalu coba lagi");
  const isi = {};
  let p = dv.getUint32(eocd + 16, true);
  for (let n = dv.getUint16(eocd + 10, true); n > 0; n--) {
    const metode = dv.getUint16(p + 10, true), ukuran = dv.getUint32(p + 20, true), lnama = dv.getUint16(p + 28, true);
    const lext = dv.getUint16(p + 30, true), lkom = dv.getUint16(p + 32, true), lokal = dv.getUint32(p + 42, true);
    const nama = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + lnama));
    isi[nama] = { metode, ukuran, lokal };
    p += 46 + lnama + lext + lkom;
  }
  const baca = async (nama) => {
    const f = isi[nama];
    if (!f) return null;
    const mulai = f.lokal + 30 + dv.getUint16(f.lokal + 26, true) + dv.getUint16(f.lokal + 28, true);
    const data = buf.subarray(mulai, mulai + f.ukuran);
    if (f.metode === 0) return new TextDecoder().decode(data);
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(s).text();
  };
  const xml = (t) => new DOMParser().parseFromString(t, "application/xml");
  const strings = [...xml((await baca("xl/sharedStrings.xml")) ?? "<sst/>").getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join(""));
  // Lembar pertama menurut workbook.xml; kalau tidak ketemu, sheet1.xml.
  let jalur = "xl/worksheets/sheet1.xml";
  const wb = await baca("xl/workbook.xml"), rel = await baca("xl/_rels/workbook.xml.rels");
  if (wb && rel) {
    const rid = xml(wb).getElementsByTagName("sheet")[0]?.getAttribute("r:id");
    const t = [...xml(rel).getElementsByTagName("Relationship")].find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (t) jalur = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
  }
  const lembar = await baca(jalur);
  if (!lembar) throw new Error("Lembar pertama file Excel tidak ditemukan");
  const kolom = (r) => [...r.replace(/\d+/g, "")].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const baris = [];
  for (const row of xml(lembar).getElementsByTagName("row")) {
    const b = [];
    for (const c of row.getElementsByTagName("c")) {
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      b[kolom(c.getAttribute("r") ?? "A")] = t === "s" ? strings[Number(v)] ?? "" : t === "inlineStr" ? [...c.getElementsByTagName("t")].map((x) => x.textContent).join("") : v;
    }
    baris.push(Array.from(b, (x) => (x ?? "").trim()));
  }
  const bersih = baris.filter((r) => r.some((c) => c));
  const lebar = Math.max(0, ...bersih.map((r) => r.length));
  const rata = bersih.map((r) => [...r, ...Array(lebar - r.length).fill("")]);
  return { judul: rata[0] ?? [], data: rata.slice(1) };
}

function tebakKolom(judul, preset) {
  if (preset && Object.values(preset).every((h) => !h || judul.includes(h))) return { ...preset };
  const peta = {}, dipakai = new Set(), J = judul.map(normal);
  const lewat = (kolom, cocok) => kolom.forEach((f) => {
    if (peta[f.k]) return;
    for (const s of f.syn) { const i = J.findIndex((h, x) => !dipakai.has(x) && cocok(h, s)); if (i > -1) { dipakai.add(i); peta[f.k] = judul[i]; return; } }
  });
  lewat(KOLOM_IMPOR, (h, s) => h === s);
  lewat(KOLOM_IMPOR.filter((f) => f.wajib), (h, s) => h.includes(s));
  lewat(KOLOM_IMPOR.filter((f) => !f.wajib), (h, s) => h.includes(s));
  return peta;
}

async function imporLangkah1() {
  const { saluran } = await api("GET", "/api/saluran");
  imp = { saluranDaftar: saluran };
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>Impor pesanan · 1. Pilih file</h1>
    <form class="card" id="fImpor1" style="margin-top:12px">
      <label>Saluran</label><select name="saluran">${saluran.filter((s) => s.aktif || !s.marketplace).map((s) => `<option value="${s.id}">${esc(s.nama)}</option>`).join("")}</select>
      <label>File CSV atau Excel (.xlsx) hasil ekspor Seller Center</label><input type="file" name="file" accept=".csv,.txt,.xlsx,text/csv" required>
      <p class="small muted">Untuk Excel, lembar pertama yang dibaca. File .xls lama: simpan ulang sebagai .xlsx atau CSV.</p>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary">Lanjut</button></div></form></div>`;
  $("#kembali").onclick = () => halOnline("pesanan");
  formKirim($("#fImpor1"), async () => {
    const f = $("#fImpor1"), file = f.file.files[0];
    if (!file) throw new Error("Pilih file");
    if (/\.xls$/i.test(file.name)) throw new Error("File .xls lama belum bisa dibaca. Simpan ulang sebagai .xlsx atau CSV");
    const { judul, data } = /\.xlsx$/i.test(file.name) ? await bacaXlsx(file) : bacaCsv(await file.text());
    if (!judul.length || !data.length) throw new Error("File kosong atau tidak terbaca");
    const s = saluran.find((x) => x.id === f.saluran.value);
    imp = { ...imp, saluran: s, namaFile: file.name, judul, data, peta: tebakKolom(judul, s.preset_kolom), petaSku: { ...(s.peta_sku ?? {}) } };
    imporLangkah2();
  });
}

function imporLangkah2() {
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>Impor ${esc(imp.saluran.nama)} · 2. Cocokkan kolom</h1>
    <form class="card" id="fImpor2" style="margin-top:12px"><p class="small muted">${esc(imp.namaFile)} · ${imp.data.length} baris. Kecocokan kolom disimpan untuk impor ${esc(imp.saluran.nama)} berikutnya.</p>
      <div class="grid2">${KOLOM_IMPOR.map((f) => `<div><label>${f.label}${f.wajib ? " *" : ""}</label><select name="${f.k}"><option value="">— tidak ada —</option>
        ${imp.judul.map((h) => `<option ${imp.peta[f.k] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></div>`).join("")}</div>
      <p class="small muted">Harga Satuan atau Subtotal Produk harus dipilih salah satu.</p>
      <div class="err" hidden></div><div class="actions"><button class="btn primary">Lanjut ke pratinjau</button></div></form></div>`;
  $("#kembali").onclick = imporLangkah1;
  formKirim($("#fImpor2"), async (d) => {
    for (const f of KOLOM_IMPOR) if (f.wajib && !d[f.k]) throw new Error(`Pilih kolom ${f.label}`);
    if (!d.harga && !d.subtotal) throw new Error("Pilih kolom Harga Satuan atau Subtotal Produk");
    imp.peta = Object.fromEntries(KOLOM_IMPOR.map((f) => [f.k, d[f.k] || ""]));
    await imporSiapkan();
    imporLangkah3();
  });
}

// Baris file → kandidat pesanan (dikelompokkan per no. pesanan), lalu cek duplikat ke server.
async function imporSiapkan() {
  const kol = (k) => (imp.peta[k] ? imp.judul.indexOf(imp.peta[k]) : -1);
  const ambil = (row, k) => { const i = kol(k); return i > -1 ? row[i] ?? "" : ""; };
  const grup = new Map();
  imp.data.forEach((row, ri) => {
    const no = ambil(row, "noPesanan");
    const qty = bacaAngka(ambil(row, "jumlah"));
    let harga = bacaAngka(ambil(row, "harga"));
    const sub = bacaAngka(ambil(row, "subtotal"));
    if (Number.isNaN(harga) && !Number.isNaN(sub) && qty > 0) harga = Math.round(sub / qty);
    const salah = [];
    if (!no) salah.push("No. pesanan kosong");
    if (!ambil(row, "sku")) salah.push("SKU kosong");
    if (!(qty > 0) || !Number.isInteger(qty)) salah.push("Jumlah tidak valid");
    if (Number.isNaN(harga)) salah.push("Harga tidak terbaca");
    const kunci = no || `__baris${ri}`;
    if (!grup.has(kunci)) grup.set(kunci, { no, tanggal: bacaTanggal(ambil(row, "tanggal")), pembeli: ambil(row, "pembeli"), statusMentah: ambil(row, "status"), potongan: Math.max(0, Math.round(bacaAngka(ambil(row, "potongan")) || 0)), baris: [] });
    grup.get(kunci).baris.push({ rowNo: ri + 2, sku: ambil(row, "sku").trim(), nama: [ambil(row, "nama"), ambil(row, "variasi")].filter(Boolean).join(" · "), qty, harga: Math.round(harga), salah });
  });
  const [{ varian }, { varian: diSaluran }, cek] = await Promise.all([
    api("GET", "/api/saluran/lainnya/katalog"), api("GET", `/api/saluran/${imp.saluran.id}/katalog`),
    api("POST", "/api/online/impor/cek", { saluran_id: imp.saluran.id, no: [...grup.values()].map((g) => g.no).filter(Boolean) }),
  ]);
  imp.katalog = varian;
  imp.diSaluran = new Set(diSaluran.map((v) => v.sku));
  const ada = new Set(cek.ada);
  imp.pesanan = [...grup.values()].map((g) => ({ ...g, batal: /batal|cancel|gagal|dikembalikan|refund|return/i.test(g.statusMentah), duplikat: !!g.no && ada.has(g.no),
    status: /selesai|completed|delivered|diterima|terkirim/i.test(g.statusMentah) || !g.statusMentah ? "Selesai" : "Diproses" }));
  const kenal = new Set(varian.map((v) => v.sku.toUpperCase()));
  imp.tidakKenal = [...new Set(imp.pesanan.filter((o) => !o.batal && !o.duplikat).flatMap((o) => o.baris.filter((b) => !b.salah.length && !kenal.has(b.sku.toUpperCase())).map((b) => b.sku)))];
  for (const s of imp.tidakKenal) imp.petaSku[s] ??= "";
}
function skuAkhir(sku) {
  const k = imp.katalog.find((v) => v.sku.toUpperCase() === sku.toUpperCase());
  return k ? k.sku : imp.petaSku[sku] || null;
}
function barisSiap(o) {
  return o.baris.filter((b) => !b.salah.length && skuAkhir(b.sku)).map((b) => ({ sku: skuAkhir(b.sku), nama: b.nama || undefined, qty: b.qty, harga: b.harga }));
}
function nilaiPesanan(o) {
  if (!o.no) return ["off", "Tanpa no. pesanan"];
  if (!o.tanggal) return ["off", "Tanggal tidak terbaca"];
  if (o.duplikat) return ["", "Sudah pernah masuk"];
  if (o.batal) return ["", "Dibatalkan"];
  const ok = barisSiap(o).length;
  if (!ok) return ["off", o.baris.some((b) => b.salah.length) ? "Tidak ada baris valid" : "SKU belum dipasangkan"];
  if (ok < o.baris.length) return ["warn", `${o.baris.length - ok} baris dilewati`];
  return ["aktif", "Siap"];
}

function imporLangkah3() {
  const hit = { siap: 0, duplikat: 0, batal: 0, gagal: 0 };
  for (const o of imp.pesanan) {
    const [w] = nilaiPesanan(o);
    if (o.duplikat) hit.duplikat++; else if (o.batal) hit.batal++; else if (w === "off") hit.gagal++; else hit.siap++;
  }
  const belumAktif = imp.saluran.marketplace ? [...new Set(imp.pesanan.filter((o) => nilaiPesanan(o)[0] !== "off" && !o.duplikat && !o.batal).flatMap((o) => barisSiap(o).map((b) => b.sku)))].filter((s) => !imp.diSaluran.has(s)) : [];
  $("#isi").innerHTML = `<div class="form" style="max-width:1100px"><button class="back" id="kembali">← Kembali</button><h1>Impor ${esc(imp.saluran.nama)} · 3. Pratinjau</h1>
    <div class="kpis" style="margin-top:12px"><div class="kpi"><span class="muted small">Siap diimpor</span><b>${hit.siap}</b></div><div class="kpi"><span class="muted small">Sudah pernah masuk</span><b>${hit.duplikat}</b></div>
      <div class="kpi"><span class="muted small">Dibatalkan (dilewati)</span><b>${hit.batal}</b></div><div class="kpi"><span class="muted small">Bermasalah</span><b>${hit.gagal}</b></div></div>
    ${imp.tidakKenal.length ? `<div class="card" style="margin-bottom:12px"><h2>SKU tidak dikenal</h2><p class="small muted">Pasangkan SKU di file dengan produk di katalog. Pasangan ini diingat untuk impor berikutnya.</p>
      <table>${imp.tidakKenal.map((s) => `<tr><td><b>${esc(s)}</b></td><td><select data-peta="${esc(s)}"><option value="">— lewati —</option>${imp.katalog.map((v) => `<option value="${esc(v.sku)}" ${imp.petaSku[s] === v.sku ? "selected" : ""}>${esc(v.nama)} (${esc(v.sku)})</option>`).join("")}</select></td></tr>`).join("")}</table></div>` : ""}
    ${belumAktif.length ? `<div class="warn small" style="margin-bottom:12px">${belumAktif.length} SKU belum diaktifkan di ${esc(imp.saluran.nama)} (${belumAktif.map(esc).join(", ")}). Pesanan tetap diimpor; aktifkan harganya di form produk supaya bisa dipakai input manual.</div>` : ""}
    <div class="tablewrap"><table><thead><tr><th>No. pesanan</th><th>Tanggal</th><th>Pembeli</th><th>Barang</th><th class="num">Potongan</th><th>Status file</th><th>Hasil</th></tr></thead><tbody>
    ${imp.pesanan.map((o) => { const [w, t] = nilaiPesanan(o); return `<tr><td><b>${esc(o.no || "—")}</b></td><td>${esc(o.tanggal.replace("T", " "))}</td><td>${esc(o.pembeli)}</td>
      <td class="small">${o.baris.map((b) => `${esc(b.sku)} ×${b.qty} @${rp(b.harga)}${b.salah.length ? ` <span style="color:var(--danger-text)">(baris ${b.rowNo}: ${esc(b.salah.join(", "))})</span>` : !skuAkhir(b.sku) ? ' <span class="muted">(belum dipasangkan)</span>' : ""}`).join("<br>")}</td>
      <td class="num">${rp(o.potongan)}</td><td class="small">${esc(o.statusMentah)}</td><td><span class="tag ${w}">${esc(t)}</span></td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="err" id="errImpor" hidden></div>
    <div class="actions"><button class="btn primary" id="jalankanImpor" ${hit.siap ? "" : "disabled"}>Impor ${hit.siap} pesanan</button></div></div>`;
  $("#kembali").onclick = imporLangkah2;
  $("#isi").querySelectorAll("[data-peta]").forEach((el) => (el.onchange = () => { imp.petaSku[el.dataset.peta] = el.value; imporLangkah3(); }));
  $("#jalankanImpor").onclick = async (e) => {
    e.target.disabled = true;
    const siap = imp.pesanan.filter((o) => !o.duplikat && !o.batal && nilaiPesanan(o)[0] !== "off").map((o) => ({ no_pesanan: o.no, tanggal: o.tanggal, pembeli: o.pembeli || undefined, status: o.status, potongan: o.potongan, items: barisSiap(o) }));
    const batchId = crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
    const peta = Object.fromEntries(Object.entries(imp.petaSku).filter(([, v]) => v));
    let masuk = 0, dup = 0;
    try {
      for (let i = 0; i < siap.length; i += 100) {
        const r = await api("POST", "/api/online/impor", { saluran_id: imp.saluran.id, batch_id: batchId, nama_file: imp.namaFile, preset_kolom: imp.peta, peta_sku: peta,
          batal: i === 0 ? hit.batal : 0, gagal: i === 0 ? hit.gagal : 0, pesanan: siap.slice(i, i + 100) });
        masuk += r.masuk; dup += r.duplikat;
      }
    } catch (x) {
      const el = $("#errImpor");
      el.textContent = `${masuk ? masuk + " pesanan sudah masuk. " : ""}${x.message}`;
      el.hidden = false;
      e.target.disabled = false;
      return;
    }
    imp = null;
    popup(`<h2>Impor selesai</h2><p>${masuk} pesanan masuk${dup ? `, ${dup} sudah pernah masuk dan dilewati` : ""}. Stok Gudang Pusat sudah berkurang.</p>`);
    halOnline("pesanan");
  };
}

async function riwayatImporOnline() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { impor } = await api("GET", "/api/online/impor");
  $("#isi").innerHTML = `<main>${kepalaOnline('<button class="btn primary" id="imporFile">Impor CSV</button>')}
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Saluran</th><th>File</th><th>Oleh</th><th class="num">Masuk</th><th class="num">Sudah ada</th><th class="num">Batal</th><th class="num">Bermasalah</th></tr></thead><tbody>
    ${impor.length ? impor.map((b) => `<tr><td>${waktu(b.waktu)}</td><td>${esc(b.saluran)}</td><td>${esc(b.nama_file)}</td><td>${esc(b.oleh_nama)}</td>
      <td class="num">${b.masuk}</td><td class="num">${b.duplikat}</td><td class="num">${b.batal}</td><td class="num">${b.gagal}</td></tr>`).join("") : '<tr><td colspan="8" class="muted">Belum ada impor.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halOnline);
  $("#imporFile").onclick = () => imporLangkah1();
}

// ---------- Biaya marketplace ----------

async function biayaMarketplace() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { saluran } = await api("GET", "/api/saluran");
  const mp = saluran.filter((s) => s.marketplace);
  $("#isi").innerHTML = `<main>${kepalaOnline()}
    <p class="muted small">Biaya ini hanya dipakai sebagai perkiraan potongan saat input manual. Pesanan hasil impor memakai potongan asli dari file.</p>
    <div class="tablewrap"><table><thead><tr><th>Toko</th><th>Status</th><th class="num">Biaya admin</th><th class="num">Biaya layanan</th><th class="num">Per pesanan</th><th class="num">SKU aktif</th><th></th></tr></thead><tbody>
    ${mp.map((s) => `<tr><td><b>${esc(s.nama)}</b></td><td>${s.aktif ? '<span class="tag aktif">Aktif</span>' : '<span class="tag off">Nonaktif</span>'}</td>
      <td class="num">${s.biaya_admin_bp / 100}%</td><td class="num">${s.biaya_layanan_bp / 100}%</td><td class="num">${rp(s.biaya_pesanan)}</td><td class="num">${s.jumlah_sku}</td>
      <td><button class="btn small" data-ubah="${s.id}">Ubah</button></td></tr>`).join("")}
    </tbody></table></div></main>`;
  pasangSubtabs(halOnline);
  $("#isi").querySelectorAll("[data-ubah]").forEach((b) => (b.onclick = () => {
    const s = mp.find((x) => x.id === b.dataset.ubah);
    popupForm(`<h2>${esc(s.nama)}</h2>
      <label class="checks"><label><input type="checkbox" class="sakelar" name="aktif" ${s.aktif ? "checked" : ""}> Toko aktif</label></label>
      <div class="grid2"><div><label>Biaya admin (%)</label><input name="admin" inputmode="decimal" value="${s.biaya_admin_bp / 100}"></div>
        <div><label>Biaya layanan (%)</label><input name="layanan" inputmode="decimal" value="${s.biaya_layanan_bp / 100}"></div></div>
      <label>Biaya per pesanan (Rp)</label><input name="pesanan" inputmode="numeric" value="${s.biaya_pesanan}">`, "Simpan", async (d, f) => {
      await api("PATCH", "/api/saluran/" + s.id, { aktif: f.aktif.checked, biaya_admin_persen: d.admin, biaya_layanan_persen: d.layanan, biaya_pesanan: angka(d.pesanan) ?? 0 });
      biayaMarketplace();
    });
  }));
}

// ---------- Pelanggan ----------

let cariPelanggan = "";

async function halPelanggan() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { pelanggan } = await api("GET", "/api/pelanggan?cari=" + encodeURIComponent(cariPelanggan));
  $("#isi").innerHTML = `<main><div class="head"><div><h1>Pelanggan</h1><p class="muted small">Pelanggan dari POS dan dashboard. Belanja dihitung dari transaksi POS yang lunas.</p></div>
      <div style="display:flex;gap:8px"><button class="btn" id="unduhPel">Unduh CSV</button><button class="btn primary" id="tambahPel">+ Pelanggan</button></div></div>
    <form class="filters" id="fCariPel"><input type="search" name="cari" placeholder="Cari nama, no HP, kota" value="${esc(cariPelanggan)}"><button class="btn small primary">Cari</button></form>
    <div class="tablewrap"><table><thead><tr><th>Nama</th><th>No HP</th><th>Kota</th><th>Grup</th><th class="num">Transaksi</th><th class="num">Total belanja</th><th>Terakhir</th></tr></thead><tbody>
    ${pelanggan.length ? pelanggan.map((p) => `<tr class="klik" data-id="${p.id}"><td><b>${esc(p.nama)}</b></td><td>${esc(p.telp ?? "—")}</td><td>${esc(p.kota ?? "")}</td><td>${esc(p.grup ?? "")}</td>
      <td class="num">${p.transaksi}</td><td class="num">${rp(p.belanja)}</td><td>${p.terakhir ? waktu(p.terakhir) : "—"}</td></tr>`).join("") : '<tr><td colspan="7" class="muted">Belum ada pelanggan.</td></tr>'}
    </tbody></table></div></main>`;
  $("#fCariPel").onsubmit = (e) => { e.preventDefault(); cariPelanggan = e.target.cari.value.trim(); halPelanggan(); };
  $("#tambahPel").onclick = () => formPelangganDash(null);
  $("#unduhPel").onclick = () => unduhCsv("pelanggan.csv", [["Nama", "No HP", "Kota", "Grup", "Transaksi", "Total belanja"], ...pelanggan.map((p) => [p.nama, p.telp, p.kota, p.grup, p.transaksi, p.belanja])]);
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => detailPelangganDash(tr.dataset.id)));
}

function formPelangganDash(p) {
  popupForm(`<h2>${p ? "Ubah pelanggan" : "Pelanggan baru"}</h2>
    <label>Nama</label><input name="nama" required maxlength="80" value="${esc(p?.nama ?? "")}">
    <div class="grid2"><div><label>No HP</label><input name="telp" inputmode="tel" maxlength="20" value="${esc(p?.telp ?? "")}"></div><div><label>Kota</label><input name="kota" maxlength="60" value="${esc(p?.kota ?? "")}"></div></div>
    <label>Grup (misalnya Reseller)</label><input name="grup" maxlength="40" value="${esc(p?.grup ?? "")}">
    <label>Catatan</label><input name="catatan" maxlength="300" value="${esc(p?.catatan ?? "")}">`, "Simpan", async (d) => {
    const b = { nama: d.nama, telp: d.telp || undefined, kota: d.kota || undefined, grup: d.grup || undefined, catatan: d.catatan || undefined };
    if (p) { await api("PATCH", "/api/pelanggan/" + p.id, b); detailPelangganDash(p.id); } else { await api("POST", "/api/pelanggan", b); halPelanggan(); }
  });
}

async function detailPelangganDash(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const { pelanggan: p, transaksi, online, ringkasan } = await api("GET", "/api/pelanggan/" + id);
  const semua = [...transaksi.map((t) => ({ ...t, sumber: "POS" })), ...online.map((o) => ({ ...o, sumber: "Online" }))].sort((a, b) => b.waktu.localeCompare(a.waktu));
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
    <div class="head"><div><h1>${esc(p.nama)}</h1><p class="muted small">${esc(p.telp ?? "tanpa no HP")}${p.kota ? " · " + esc(p.kota) : ""}${p.grup ? " · " + esc(p.grup) : ""} · ditambahkan ${waktu(p.dibuat_pada)}${p.dibuat_oleh_nama ? " oleh " + esc(p.dibuat_oleh_nama) : ""}</p>
      ${p.catatan ? `<p class="small">${esc(p.catatan)}</p>` : ""}</div><button class="btn" id="ubahPel">Ubah</button></div>
    <div class="kpis"><div class="kpi"><span class="muted small">Transaksi POS lunas</span><b>${ringkasan.transaksi}</b></div><div class="kpi"><span class="muted small">Total belanja POS</span><b>${rp(ringkasan.belanja)}</b></div>
      <div class="kpi"><span class="muted small">Pesanan online</span><b>${online.length}</b></div></div>
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Sumber</th><th>No.</th><th>Tempat</th><th>Barang</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
    ${semua.length ? semua.map((t) => `<tr><td>${waktu(t.waktu)}</td><td>${t.sumber}</td><td><b>${esc(t.no)}</b></td><td>${esc(t.lokasi)}</td><td class="small">${esc(t.barang ?? "")}</td>
      <td class="num">${rp(t.total)}</td><td>${esc(t.status)}${t.presale ? ` <span class="tag warn">pre-sale · ${esc(t.ambil_status ?? "")}</span>` : ""}</td></tr>`).join("") : '<tr><td colspan="7" class="muted">Belum ada transaksi.</td></tr>'}
    </tbody></table></div></div>`;
  $("#kembali").onclick = halPelanggan;
  $("#ubahPel").onclick = () => formPelangganDash(p);
}
