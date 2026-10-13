// Dashboard › Event (daftar, form, detail, kirim stok, tarik, tutup event), Inventori › Stok Opname, Laporan › Selisih & Kerugian.

let tabEvent = "Semua";
const WARNA_EVENT = { Berlangsung: "aktif", "Akan Datang": "", "Perlu Ditutup": "warn", Selesai: "off" };
const tglPendek = (d) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const rentangTgl = (e) => (e.mulai === e.selesai ? tglPendek(e.mulai) : `${tglPendek(e.mulai)} – ${tglPendek(e.selesai)}`);

async function halEvent() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { event } = await api("GET", "/api/event");
  const aktif = event.filter((e) => e.status === "Berlangsung" || e.status === "Perlu Ditutup");
  const tabs = ["Semua", "Berlangsung", "Akan Datang", "Perlu Ditutup", "Selesai"];
  const tampil = event.filter((e) => tabEvent === "Semua" || e.status === tabEvent);
  $("#isi").innerHTML = `<main><div class="head"><div><h1>Event</h1></div><button class="btn primary" id="tambahEvent">+ Buat Event</button></div>
    ${aktif.length ? `<div class="kpis">${aktif.map((e) => `<div class="kpi klik" data-id="${e.id}" style="cursor:pointer">
      <span class="tag ${WARNA_EVENT[e.status]}">${e.status}</span><b>${esc(e.nama)}</b>
      <div class="small muted">Hari ini ${rp(e.penjualan_hari_ini)} · total ${rp(e.penjualan)}</div>
      <div class="small">${e.kasir_terbuka ? "Kasir terbuka: " + esc(e.kasir_terbuka) : '<span class="muted">Belum ada kasir terbuka</span>'}</div></div>`).join("")}</div>` : ""}
    <div class="filters">${tabs.map((t) => `<button class="btn small ${t === tabEvent ? "primary" : ""}" data-tabe="${t}">${t}</button>`).join("")}</div>
    <div class="tablewrap"><table><thead><tr><th>Event</th><th>Tanggal</th><th>Status</th><th>Kasir bertugas</th><th class="num">Transaksi</th><th class="num">Penjualan</th></tr></thead><tbody>
    ${tampil.length ? tampil.map((e) => `<tr class="klik" data-id="${e.id}"><td><b>${esc(e.nama)}</b><div class="small muted">${esc(e.venue || "")}</div></td><td>${rentangTgl(e)}</td>
      <td><span class="tag ${WARNA_EVENT[e.status]}">${e.status}</span>${e.presale_aktif ? ' <span class="tag">pre-sale</span>' : ""}</td><td>${esc(e.kasir || "—")}</td>
      <td class="num">${e.transaksi}</td><td class="num">${rp(e.penjualan)}</td></tr>`).join("") : '<tr><td colspan="6" class="muted">Belum ada event.</td></tr>'}
    </tbody></table></div></main>`;
  $("#tambahEvent").onclick = () => formEvent(null);
  $("#isi").querySelectorAll("[data-tabe]").forEach((b) => (b.onclick = () => { tabEvent = b.dataset.tabe; halEvent(); }));
  $("#isi").querySelectorAll("[data-id]").forEach((el) => (el.onclick = () => detailEvent(el.dataset.id)));
}

async function formEvent(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ produk }, { karyawan }, d] = await Promise.all([api("GET", "/api/produk"), api("GET", "/api/staf"), id ? api("GET", "/api/event/" + id) : null]);
  const staf = karyawan.length ? karyawan.filter((k) => k.aktif) : (d?.kasir ?? []);
  const e = d?.event;
  const skuList = produk.filter((p) => p.aktif).flatMap((p) => p.varian.filter((v) => v.aktif).map((v) => ({ sku: v.sku, nama: p.nama + (v.nama ? " · " + v.nama : ""), normal: v.harga_jual, aktif: true, hpp: p.hpp })));
  const stokGudang = Object.fromEntries((d?.varian ?? []).map((v) => [v.sku, v]));
  const f0 = { kasir: new Set((d?.kasir ?? []).map((k) => k.id)), varian: (d?.varian ?? []).map((v) => ({ sku: v.sku, harga: v.harga ?? "" })) };
  let presale = e?.presale_aktif ?? false;
  const gambar = () => {
    $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
      <h1>${e ? "Ubah event" : "Buat event"}</h1>
      <form class="card" id="fEv" style="margin-top:12px" autocomplete="off">
        <div class="grid2">
          <div><label>Nama event</label><input type="text" name="nama" value="${esc(e?.nama)}" required></div>
          <div><label>Tempat</label><input type="text" name="venue" value="${esc(e?.venue)}"></div>
          <div><label>Tanggal mulai</label><input type="date" name="mulai" value="${e?.mulai ?? ""}" required></div>
          <div><label>Tanggal selesai</label><input type="date" name="selesai" value="${e?.selesai ?? ""}" required></div>
          <div><label>Zona waktu</label><select name="zona">${["WIB", "WITA", "WIT"].map((z) => `<option ${e?.zona === z ? "selected" : ""}>${z}</option>`).join("")}</select></div>
          <div><label>Penanggung jawab event</label><select name="pj_id" required><option value="">Pilih karyawan</option>${staf.map((k) => `<option value="${k.id}" ${e?.pj_id === k.id ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div>
        </div>
        <label>Kasir yang bertugas</label>
        <div class="checks">${staf.map((k) => `<label><input type="checkbox" data-kasir="${k.id}" ${f0.kasir.has(k.id) ? "checked" : ""}> ${esc(k.nama)}</label>`).join("")}</div>
        <label>Catatan</label><textarea name="catatan">${esc(e?.catatan)}</textarea>
        <div class="checks" style="margin-top:14px"><label><input type="checkbox" id="presale" ${presale ? "checked" : ""}> Pre-sale aktif (bisa dijual sebelum tanggal mulai, khusus Owner)</label></div>
        ${presale ? `<label>Mode pre-sale</label><select name="presale_mode"><option value="ambil" ${e?.presale_mode !== "stok" ? "selected" : ""}>Pesanan diambil nanti (stok berkurang saat diserahkan)</option>
          <option value="stok" ${e?.presale_mode === "stok" ? "selected" : ""}>Kurangi stok saat transaksi</option></select>` : ""}
        <h2 class="section">Produk yang dijual</h2>
        <p class="small muted">Hanya varian ini yang tampil di POS event. Harga event kosong berarti harga normal. Stok dikirim lewat tombol Kirim Stok di detail event.</p>
        <div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">Harga normal</th><th class="num">Stok gudang</th>${e ? '<th class="num">Stok event</th>' : ""}<th class="num" style="width:170px">Harga event</th><th></th></tr></thead><tbody>
          ${f0.varian.map((v, i) => { const s = skuList.find((x) => x.sku === v.sku); return `<tr><td>${esc(s?.nama ?? v.sku)}<div class="small muted">${esc(v.sku)}</div></td>
            <td class="num">${rp(s?.normal)}</td><td class="num">${stokGudang[v.sku]?.stok_gudang ?? "—"}</td>${e ? `<td class="num">${stokGudang[v.sku]?.stok_event ?? 0}</td>` : ""}
            <td><input type="number" min="0" data-v="${i}" value="${v.harga}" placeholder="${s?.normal ?? ""}"></td><td><button type="button" class="btn small danger" data-hapusv="${i}">Hapus</button></td></tr>`; }).join("")}
          <tr><td colspan="6"><button type="button" class="btn small" id="tambahVarianEv">+ Produk</button></td></tr></tbody></table></div>
        <div class="err" hidden></div>
        <div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batal">Batal</button></div>
      </form></div>`;
    const f = $("#fEv");
    const simpanIsian = () => {
      for (const [k, v] of new FormData(f)) if (e) e[k] = v; else (f0.isi ??= {})[k] = v;
      f.querySelectorAll("[data-kasir]").forEach((c) => (c.checked ? f0.kasir.add(c.dataset.kasir) : f0.kasir.delete(c.dataset.kasir)));
    };
    if (f0.isi) for (const [k, v] of Object.entries(f0.isi)) if (f[k]) f[k].value = v;
    f.querySelectorAll("[data-v]").forEach((el) => (el.oninput = () => (f0.varian[+el.dataset.v].harga = el.value)));
    f.querySelectorAll("[data-hapusv]").forEach((b) => (b.onclick = () => { simpanIsian(); f0.varian.splice(+b.dataset.hapusv, 1); gambar(); }));
    $("#presale").onchange = (x) => { simpanIsian(); presale = x.target.checked; gambar(); };
    $("#tambahVarianEv").onclick = () => { simpanIsian(); pilihProduk(skuList, f0.varian.map((v) => v.sku), (dipilih) => {
      const ada = new Map(f0.varian.map((v) => [v.sku, v]));
      f0.varian = dipilih.map((sku) => ada.get(sku) ?? { sku, harga: "" });
      gambar();
    }); };
    $("#kembali").onclick = $("#batal").onclick = () => (e ? detailEvent(e.id) : halEvent());
    formKirim(f, async (x) => {
      const body = { nama: x.nama, venue: x.venue, mulai: x.mulai, selesai: x.selesai, zona: x.zona, pj_id: x.pj_id, catatan: x.catatan,
        presale_aktif: presale, presale_mode: x.presale_mode || "ambil",
        kasir: [...f.querySelectorAll("[data-kasir]:checked")].map((c) => c.dataset.kasir),
        varian: f0.varian.map((v) => ({ sku: v.sku, harga: v.harga === "" ? null : angka(v.harga) })) };
      const r = e ? await api("PATCH", "/api/event/" + e.id, body) : await api("POST", "/api/event", body);
      detailEvent(e ? e.id : r.id);
    });
  };
  gambar();
}

async function detailEvent(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const d = await api("GET", "/api/event/" + id);
  const e = d.event, r = d.ringkasan;
  const opMenunggu = d.opname.find((o) => o.status === "Menunggu persetujuan" || o.status === "Perlu opname ulang");
  $("#isi").innerHTML = `<main><button class="back" id="kembali">← Kembali</button>
    <div class="head"><div><h1>${esc(e.nama)}</h1><div class="muted">${esc(e.venue || "")} · ${rentangTgl(e)} · PJ ${esc(e.pj)} · kasir ${d.kasir.map((k) => esc(k.nama)).join(", ") || "—"}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="tag ${WARNA_EVENT[e.status]}">${e.status}</span>${e.ditutup ? "" : `<button class="btn" id="ubahEv">Ubah</button>
      <button class="btn" id="kirimEv">Kirim Stok</button><button class="btn" id="tarikEv">Tarik ke Gudang</button><button class="btn primary" id="tutupEv">Tutup Event</button>`}</div></div>
    ${e.presale_aktif ? `<div class="ok">Pre-sale aktif · ${e.presale_mode === "ambil" ? "pesanan diambil nanti" : "stok berkurang saat transaksi"}</div>` : ""}
    ${e.ditutup ? `<div class="ok">Ditutup ${waktu(e.tutup_pada)} oleh ${esc(e.tutup_oleh_nama)}. ${esc(e.tutup_catatan || "")}</div>` : ""}
    ${opMenunggu ? `<div class="err">Stok opname ${esc(opMenunggu.no)} dari ${esc(opMenunggu.dihitung_oleh)}: ${esc(opMenunggu.status)}. <a href="#" id="keOpname">Buka di Stok Opname</a></div>` : ""}
    ${!e.ditutup && !d.stok.some((s) => s.sisa || s.transit) ? '<div class="warn">Event ini belum punya stok. Klik Kirim Stok untuk mengirim barang dari Gudang Pusat.</div>' : ""}
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><span class="muted small">Penjualan</span><b>${rp(r.penjualan)}</b></div><div class="kpi"><span class="muted small">Transaksi</span><b>${r.transaksi}</b></div>
      <div class="kpi"><span class="muted small">Produk terjual</span><b>${r.produk_terjual} pcs</b></div>
      <div class="kpi"><span class="muted small">Rata-rata per transaksi</span><b>${rp(r.transaksi ? Math.round(r.penjualan / r.transaksi) : 0)}</b></div>
      <div class="kpi"><span class="muted small">Laba kotor</span><b>${rp(r.laba_kotor)}</b></div></div>
    <div class="small muted">Metode bayar: ${d.metode.map((m) => `${esc(m.metode)} ${rp(m.jumlah)}`).join(" · ") || "—"}</div>
    <h2 class="section">Stok di event</h2>
    <div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">Diterima</th><th class="num">Dalam perjalanan</th><th class="num">Ditarik</th><th class="num">Terjual</th>${d.stok.some((s) => s.selisih) ? '<th class="num">Selisih</th>' : ""}<th class="num">Sisa</th></tr></thead><tbody>
      ${d.stok.map((s) => `<tr><td>${esc(s.nama)}<div class="small muted">${esc(s.sku)}</div></td><td class="num">${s.diterima}</td><td class="num">${s.transit}</td><td class="num">${s.ditarik}</td>
        <td class="num">${s.terjual}</td>${d.stok.some((x) => x.selisih) ? `<td class="num" style="${s.selisih < 0 ? "color:var(--danger-text)" : ""}">${s.selisih}</td>` : ""}<td class="num"><b>${s.sisa}</b></td></tr>`).join("")}</tbody></table></div>
    <h2 class="section">Mutasi stok</h2>
    <div class="tablewrap"><table><thead><tr><th>No.</th><th>Jenis</th><th>Dikirim</th><th>Diterima</th><th class="num">Qty kirim</th><th class="num">Qty terima</th><th>Status</th><th></th></tr></thead><tbody>
      ${d.mutasi.map((m) => `<tr><td><b>${esc(m.no)}</b></td><td>${m.jenis === "kirim" ? "Kirim" : "Tarik ke gudang"}</td><td>${waktu(m.dikirim_pada)}<div class="small muted">${esc(m.dikirim_oleh)}</div></td>
        <td>${m.diterima_pada ? waktu(m.diterima_pada) + `<div class="small muted">${esc(m.diterima_oleh)}</div>` : "—"}</td><td class="num">${m.dikirim}</td>
        <td class="num" style="${m.diterima !== null && m.diterima < m.dikirim ? "color:var(--danger-text);font-weight:700" : ""}">${m.diterima ?? "—"}${m.diterima !== null && m.diterima < m.dikirim ? ` (kurang ${m.dikirim - m.diterima})` : ""}</td>
        <td>${esc(m.status)}</td><td>${m.status === "Dikirim" && !e.ditutup ? `<button class="btn small danger" data-batalm="${m.id}">Batalkan</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">Belum ada.</td></tr>'}</tbody></table></div>
    <h2 class="section">Shift kasir dan setoran</h2>
    <div class="tablewrap"><table><thead><tr><th>Buka</th><th>Kasir</th><th class="num">Modal</th><th class="num">Dihitung</th><th class="num">Selisih</th><th>Status</th></tr></thead><tbody>
      ${d.shift.map((s) => `<tr><td>${waktu(s.buka)}</td><td>${esc(s.kasir)}</td><td class="num">${rp(s.modal)}</td><td class="num">${s.kas_hitung === null ? "—" : rp(s.kas_hitung)}</td>
        <td class="num">${s.selisih === null ? "—" : rp(s.selisih)}</td><td>${s.status === "buka" ? '<span class="tag warn">Buka</span>' : "Tutup"}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Belum ada.</td></tr>'}</tbody></table></div>
    <h2 class="section">Transaksi</h2>
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>No.</th><th>Kasir</th><th>Metode</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
      ${d.transaksi.map((t) => `<tr class="klik" data-trx="${t.id}"><td>${waktu(t.waktu)}</td><td>${esc(t.no)}</td><td>${esc(t.kasir)}</td><td>${esc(t.metode)}</td><td class="num">${rp(t.total)}</td><td>${esc(t.status)}</td></tr>`).join("") || '<tr><td colspan="6" class="muted">Belum ada.</td></tr>'}</tbody></table></div>
    <div id="biayaEv"></div>
  </main>`;
  $("#kembali").onclick = halEvent;
  kartuBiayaEvent(id, $("#biayaEv"));
  if ($("#ubahEv")) {
    $("#ubahEv").onclick = () => formEvent(id);
    $("#kirimEv").onclick = () => formKirimTarik(d, "kirim");
    $("#tarikEv").onclick = () => formKirimTarik(d, "tarik");
    $("#tutupEv").onclick = () => formTutupEvent(id);
  }
  if ($("#keOpname")) $("#keOpname").onclick = (x) => { x.preventDefault(); bukaOpname(opMenunggu.id); };
  $("#isi").querySelectorAll("[data-trx]").forEach((tr) => (tr.onclick = () => detailTransaksi(tr.dataset.trx)));
  $("#isi").querySelectorAll("[data-batalm]").forEach((b) => (b.onclick = () => popupForm(`<h2>Batalkan kiriman?</h2><p class="muted">Barang kembali ke Gudang Pusat.</p><label>Alasan</label><input type="text" name="alasan" required minlength="5">`,
    "Batalkan kiriman", async (x) => { await api("POST", `/api/mutasi/${b.dataset.batalm}/batal`, { alasan: x.alasan }); detailEvent(id); })));
}

// Kirim stok (gudang → event, lewat transit) dan tarik ke gudang (event → gudang langsung).
function formKirimTarik(d, jenis) {
  const e = d.event;
  const sumber = jenis === "kirim" ? d.varian.map((v) => ({ sku: v.sku, nama: v.produk + (v.varian ? " · " + v.varian : ""), ada: v.stok_gudang, aktif: true }))
    : d.stok.filter((s) => s.sisa > 0).map((s) => ({ sku: s.sku, nama: s.nama, ada: s.sisa, aktif: true }));
  let item = [];
  const gambar = () => {
    $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
      <h1>${jenis === "kirim" ? "Kirim stok ke " : "Tarik ke gudang dari "}${esc(e.nama)}</h1>
      <p class="muted">${jenis === "kirim" ? "Barang keluar dari Gudang Pusat sebagai kiriman berstatus Dikirim, lalu masuk ke event setelah kasir menerimanya di POS." : "Sisa stok event langsung pindah ke Gudang Pusat."}</p>
      <form class="card" id="fKt" style="margin-top:12px">
        <div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">${jenis === "kirim" ? "Stok gudang" : "Stok event"}</th><th class="num" style="width:150px">Jumlah</th><th></th></tr></thead><tbody>
          ${item.map((i, n) => `<tr><td>${esc(i.nama)}<div class="small muted">${esc(i.sku)}</div></td><td class="num">${i.ada}</td>
            <td><input type="number" min="1" max="${i.ada}" data-n="${n}" value="${i.qty}" ${i.ada ? "" : "disabled"}></td><td><button type="button" class="btn small danger" data-hapus="${n}">Hapus</button></td></tr>`).join("")}
          <tr><td colspan="4"><button type="button" class="btn small" id="tambahKt">+ Produk</button> ${jenis === "kirim" ? '<button type="button" class="btn small" id="isi30">Isi otomatis 30% stok gudang</button>' : ""}</td></tr>
        </tbody></table></div>
        <label>Catatan</label><input type="text" name="catatan">
        <div class="err" hidden></div>
        <div class="actions"><button class="btn primary">${jenis === "kirim" ? "Kirim" : "Tarik ke gudang"}</button><button type="button" class="btn" id="batal">Batal</button></div>
      </form></div>`;
    $("#kembali").onclick = $("#batal").onclick = () => detailEvent(e.id);
    const f = $("#fKt");
    f.querySelectorAll("[data-n]").forEach((el) => (el.oninput = () => {
      const i = item[+el.dataset.n];
      if (Number(el.value) > i.ada) { el.value = i.ada; alert(`Maksimal ${i.ada}`); }
      i.qty = el.value;
    }));
    f.querySelectorAll("[data-hapus]").forEach((b) => (b.onclick = () => { item.splice(+b.dataset.hapus, 1); gambar(); }));
    $("#tambahKt").onclick = () => pilihProduk(sumber, item.map((i) => i.sku), (dipilih) => {
      const ada = new Map(item.map((i) => [i.sku, i]));
      item = dipilih.map((sku) => ada.get(sku) ?? { ...sumber.find((s) => s.sku === sku), qty: "" });
      gambar();
    });
    if ($("#isi30")) $("#isi30").onclick = () => { item = sumber.filter((s) => s.ada > 0).map((s) => ({ ...s, qty: String(Math.max(1, Math.floor(s.ada * 0.3))) })); gambar(); };
    formKirim(f, async (x) => {
      const isi = item.filter((i) => angka(i.qty) > 0).map((i) => ({ sku: i.sku, qty: angka(i.qty) }));
      if (!isi.length) throw new Error("Isi jumlah minimal satu barang");
      await api("POST", `/api/event/${e.id}/${jenis}`, { item: isi, catatan: x.catatan });
      detailEvent(e.id);
    });
  };
  gambar();
}

async function formTutupEvent(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [d, { karyawan }] = await Promise.all([api("GET", `/api/event/${id}/tutup`), api("GET", "/api/staf")]);
  const e = d.event, om = d.opname_menunggu;
  // Isian fisik dari opname kasir, disesuaikan dengan penjualan setelah opname (selisihnya tetap).
  const awal = {};
  if (om) for (const i of om.item) { const s = d.stok.find((x) => x.sku === i.sku); if (s) awal[i.sku] = Math.max(0, s.qty + (i.fisik - i.sistem)); }
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
    <h1>Tutup ${esc(e.nama)}</h1><p class="muted">Hitung stok fisik di booth. Selisih kurang menjadi kerugian, lalu stok fisik kembali ke Gudang Pusat.</p>
    ${d.shift_terbuka.length ? `<div class="err">Masih ada kasir terbuka: ${d.shift_terbuka.map((s) => esc(s.kasir)).join(", ")}. Tutup kasirnya dulu dari POS.</div>` : ""}
    ${d.kiriman.length ? `<div class="warn">${d.kiriman.length} kiriman belum diterima akan dibatalkan dan barangnya kembali ke gudang (${d.kiriman.map((k) => esc(k.no)).join(", ")}).</div>` : ""}
    ${om ? `<div class="card" style="margin-top:10px"><b>Stok opname ${esc(om.no)} · Menunggu persetujuan</b><div class="small muted">Dihitung ${esc(om.dihitung_oleh)} · ${waktu(om.dihitung_pada)}${om.catatan ? " · " + esc(om.catatan) : ""}</div>
      <p class="small">Isian stok fisik di bawah terisi dari hasil itu. <a href="#" id="mintaUlang">Minta opname ulang</a></p></div>` : ""}
    <form class="card" id="fTutup" style="margin-top:12px">
      <div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">Sistem</th><th class="num" style="width:130px">Fisik</th><th class="num">Selisih</th><th class="num">HPP</th><th class="num">Kerugian</th></tr></thead><tbody>
        ${d.stok.map((s) => `<tr><td>${esc(s.nama)}<div class="small muted">${esc(s.sku)}</div></td><td class="num">${s.qty}</td>
          <td><input type="number" min="0" data-sku="${esc(s.sku)}" value="${awal[s.sku] ?? ""}" placeholder="${Math.max(0, s.qty)}"></td><td class="num" data-sel="${esc(s.sku)}"></td>
          <td class="num">${rp(s.hpp)}</td><td class="num" data-rugi="${esc(s.sku)}"></td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="5">Total kerugian</td><td class="num" id="totalRugi"></td></tr></tfoot></table></div>
      <div id="bagianPj" hidden><div class="grid2"><div><label>Penanggung jawab</label><select name="pj_id">${karyawan.filter((k) => k.aktif).map((k) => `<option value="${k.id}" ${k.id === e.pj_id ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div></div>
        <label>Penjelasan selisih</label><textarea name="penjelasan">${esc(om?.catatan || "")}</textarea></div>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary" ${d.shift_terbuka.length ? "disabled" : ""}>${om ? "Setujui opname & tutup event" : "Tutup event"}</button><button type="button" class="btn" id="batal">Batal</button></div>
    </form></div>`;
  $("#kembali").onclick = $("#batal").onclick = () => detailEvent(id);
  const f = $("#fTutup");
  const hitung = () => {
    let total = 0;
    for (const s of d.stok) {
      const el = f.querySelector(`[data-sku="${CSS.escape(s.sku)}"]`);
      const fisik = el.value === "" ? Math.max(0, s.qty) : Number(el.value), sel = fisik - s.qty, rugi = Math.max(0, -sel) * s.hpp;
      total += rugi;
      f.querySelector(`[data-sel="${CSS.escape(s.sku)}"]`).textContent = sel || "";
      f.querySelector(`[data-rugi="${CSS.escape(s.sku)}"]`).textContent = rugi ? rp(rugi) : "";
    }
    $("#totalRugi").textContent = rp(total);
    $("#bagianPj").hidden = !total;
  };
  f.oninput = hitung;
  hitung();
  if ($("#mintaUlang")) $("#mintaUlang").onclick = (x) => { x.preventDefault(); mintaOpnameUlang(om.id, () => formTutupEvent(id)); };
  formKirim(f, async (x) => {
    const fisik = {};
    f.querySelectorAll("[data-sku]").forEach((el) => { if (el.value !== "") fisik[el.dataset.sku] = Number(el.value); });
    const r = await api("POST", `/api/event/${id}/tutup`, { fisik, pj_id: x.pj_id, penjelasan: x.penjelasan, opname_id: om?.id });
    await detailEvent(id);
    popup(`<h2>Event ditutup</h2><p>${r.kembali} pcs kembali ke Gudang Pusat.${r.kerugian ? ` Kerugian ${rp(r.kerugian)} tercatat di Laporan › Selisih & Kerugian.` : ""}</p>`);
  });
}

function mintaOpnameUlang(id, selesai) {
  popupForm(`<h2>Minta opname ulang</h2><p class="muted">Kasir melihat alasan ini di POS lalu menghitung ulang.</p><label>Alasan</label><textarea name="alasan" required minlength="5"></textarea>`,
    "Kirim permintaan", async (x) => { await api("POST", `/api/opname/${id}/ulang`, { alasan: x.alasan }); selesai(); });
}

// ---------- Inventori › Stok Opname ----------

async function daftarOpname() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { opname } = await api("GET", "/api/opname");
  const WARNA = { "Menunggu persetujuan": "warn", "Perlu opname ulang": "off", Disetujui: "aktif", Diganti: "" };
  const JENIS = { pos: "Hitungan kasir (POS)", gudang: "Opname gudang", tutup_event: "Tutup event" };
  $("#isi").innerHTML = `<main>${kepalaInv('<button class="btn primary" id="opGudang">+ Opname Gudang</button>')}
    <div class="tablewrap"><table><thead><tr><th>Dihitung</th><th>No.</th><th>Lokasi</th><th>Jenis</th><th class="num">Kurang</th><th class="num">Lebih</th><th class="num">Kerugian</th><th>Status</th></tr></thead><tbody>
    ${opname.length ? opname.map((o) => `<tr class="klik" data-id="${o.id}"><td>${waktu(o.dihitung_pada)}<div class="small muted">${esc(o.dihitung_oleh)}</div></td><td><b>${esc(o.no)}</b></td><td>${esc(o.lokasi)}</td>
      <td>${JENIS[o.jenis]}</td><td class="num">${o.kurang ?? 0}</td><td class="num">${o.lebih ?? 0}</td><td class="num">${o.kerugian ? rp(o.kerugian) : "—"}</td>
      <td><span class="tag ${WARNA[o.status]}">${esc(o.status)}</span>${o.disetujui_oleh ? `<div class="small muted">disetujui ${esc(o.disetujui_oleh)}</div>` : ""}</td></tr>`).join("")
      : '<tr><td colspan="8" class="muted">Belum ada stok opname.</td></tr>'}</tbody></table></div></main>`;
  pasangSubtabs(halInventori);
  $("#opGudang").onclick = formOpnameGudang;
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => bukaOpname(tr.dataset.id)));
}

async function bukaOpname(id) {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ opname: o, item, pj_bawaan }, { karyawan }] = await Promise.all([api("GET", "/api/opname/" + id), api("GET", "/api/staf")]);
  const kerugian = item.reduce((a, i) => a + i.kerugian, 0);
  const bisa = o.status === "Menunggu persetujuan";
  const sendiri = o.dihitung_oleh === saya.id && !saya.role.includes("owner");
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
    <h1>${esc(o.no)} · ${esc(o.lokasi)}</h1><div class="muted">Dihitung ${esc(o.dihitung_oleh_nama)} · ${waktu(o.dihitung_pada)} · <b>${esc(o.status)}</b>${o.disetujui_oleh_nama ? ` · disetujui ${esc(o.disetujui_oleh_nama)}` : ""}</div>
    ${o.catatan ? `<p>Catatan: ${esc(o.catatan)}</p>` : ""}${o.ulang_alasan ? `<div class="err">Diminta opname ulang: ${esc(o.ulang_alasan)}</div>` : ""}
    ${o.pj_nama ? `<p class="small">Penanggung jawab ${esc(o.pj_nama)}: ${esc(o.penjelasan)}</p>` : ""}
    <div class="tablewrap" style="margin-top:12px"><table><thead><tr><th>Barang</th><th class="num">Sistem saat dihitung</th><th class="num">Fisik</th><th class="num">Selisih</th><th class="num">Stok sekarang</th><th class="num">Kerugian</th></tr></thead><tbody>
      ${item.map((i) => `<tr style="${i.selisih ? "" : "color:var(--text-mut)"}"><td>${esc(i.nama)}</td><td class="num">${i.sistem}</td><td class="num">${i.fisik}</td><td class="num">${i.selisih}</td><td class="num">${i.sekarang}</td><td class="num">${i.kerugian ? rp(i.kerugian) : ""}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="5">Total kerugian</td><td class="num">${rp(kerugian)}</td></tr></tfoot></table></div>
    ${bisa ? `<form class="card" id="fSetuju" style="margin-top:14px">
      <p class="small muted">Saat disetujui: stok = stok sekarang + (fisik − sistem saat dihitung). Penjualan setelah opname tetap diperhitungkan.</p>
      ${sendiri ? '<div class="err">Anda yang menghitung opname ini. Minta Owner atau Admin lain untuk menyetujui.</div>' : ""}
      ${kerugian ? `<div class="grid2"><div><label>Penanggung jawab</label><select name="pj_id">${karyawan.filter((k) => k.aktif).map((k) => `<option value="${k.id}" ${k.id === (pj_bawaan ?? o.dihitung_oleh) ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select></div></div>
        <label>Penjelasan</label><textarea name="penjelasan">${esc(o.catatan || "")}</textarea>` : ""}
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary" ${sendiri ? "disabled" : ""}>Setujui</button><button type="button" class="btn" id="ulang">Minta opname ulang</button></div></form>` : ""}
  </div>`;
  $("#kembali").onclick = () => halInventori("opname");
  if (bisa) {
    $("#ulang").onclick = () => mintaOpnameUlang(id, () => bukaOpname(id));
    formKirim($("#fSetuju"), async (x) => { await api("POST", `/api/opname/${id}/setujui`, { pj_id: x.pj_id, penjelasan: x.penjelasan }); bukaOpname(id); });
  }
}

async function formOpnameGudang() {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const { stok } = await api("GET", "/api/stok");
  const baris = stok.filter((s) => s.varian_aktif || (s.per_lokasi.gudang ?? 0) !== 0);
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>Opname Gudang Pusat</h1>
    <p class="muted">Isi stok fisik hasil hitung. Kosong berarti sama dengan sistem. Hasilnya menunggu persetujuan orang lain, stok belum berubah.</p>
    <form class="card" id="fOg" style="margin-top:12px"><div class="tablewrap"><table><thead><tr><th>Barang</th><th class="num">Sistem</th><th class="num" style="width:130px">Fisik</th><th class="num">Selisih</th></tr></thead><tbody>
      ${baris.map((s) => `<tr><td>${esc(s.produk + (s.varian ? " · " + s.varian : ""))}<div class="small muted">${esc(s.sku)}</div></td><td class="num">${s.per_lokasi.gudang ?? 0}</td>
        <td><input type="number" min="0" data-sku="${esc(s.sku)}" placeholder="${Math.max(0, s.per_lokasi.gudang ?? 0)}"></td><td class="num" data-sel="${esc(s.sku)}"></td></tr>`).join("")}</tbody></table></div>
      <label>Catatan (wajib kalau ada selisih)</label><textarea name="catatan"></textarea>
      <div class="err" hidden></div><div class="actions"><button class="btn primary">Kirim hasil opname</button><button type="button" class="btn" id="batal">Batal</button></div></form></div>`;
  $("#kembali").onclick = $("#batal").onclick = () => halInventori("opname");
  const f = $("#fOg");
  f.oninput = () => f.querySelectorAll("[data-sku]").forEach((el) => {
    const s = baris.find((x) => x.sku === el.dataset.sku), sistem = s.per_lokasi.gudang ?? 0;
    f.querySelector(`[data-sel="${CSS.escape(el.dataset.sku)}"]`).textContent = el.value === "" ? "" : Number(el.value) - sistem || "";
  });
  formKirim(f, async (x) => {
    const fisik = {};
    f.querySelectorAll("[data-sku]").forEach((el) => { if (el.value !== "") fisik[el.dataset.sku] = Number(el.value); });
    await api("POST", "/api/opname/gudang", { fisik, catatan: x.catatan });
    halInventori("opname");
  });
}

// ---------- Laporan › Selisih & Kerugian ----------

let subLaporan = "saluran";

function halLaporan(sub) {
  if (sub) subLaporan = sub;
  ({ saluran: halLaporanSaluran, event: halLaporanEvent, kasir: halLaporanKasir, produk: halLaporanProduk, harian: halLaporanHarian, kerugian: halKerugian })[subLaporan]();
}

async function halKerugian() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { kerugian, ringkasan: r } = await api("GET", "/api/kerugian");
  const JENIS = { stok: "Stok (opname)", kas: "Kas laci", terbuang: "Barang terbuang", kiriman: "Kiriman kurang" };
  const WARNA = { "Belum diselesaikan": "off", "Diganti sebagian": "warn", Diganti: "aktif", "Dibebankan perusahaan": "" };
  $("#isi").innerHTML = `<main>${kepalaLaporan()}
    <div class="kpis"><div class="kpi"><span class="muted small">Total kerugian</span><b>${rp(r.total)}</b></div>
      <div class="kpi"><span class="muted small">Belum diselesaikan</span><b style="color:var(--danger-text)">${rp(r.belum)}</b></div>
      <div class="kpi"><span class="muted small">Sudah diganti</span><b>${rp(r.diganti)}</b></div><div class="kpi"><span class="muted small">Dibebankan perusahaan</span><b>${rp(r.dibebankan)}</b></div></div>
    <div class="tablewrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Lokasi</th><th>Rincian</th><th>Penanggung jawab</th><th class="num">Kerugian</th><th class="num">Sisa</th><th>Status</th><th></th></tr></thead><tbody>
    ${kerugian.length ? kerugian.map((k) => `<tr><td>${waktu(k.tanggal)}<div class="small muted">${esc(k.no_ref || "")}</div></td><td>${JENIS[k.jenis]}</td><td>${esc(k.lokasi || "—")}${k.disetujui ? `<div class="small muted">disetujui ${esc(k.disetujui)}</div>` : ""}</td>
      <td class="small">${esc(k.rincian)}</td><td>${esc(k.pj || "—")}<div class="small muted">${esc(k.penjelasan || "")}</div></td><td class="num">${rp(k.jumlah)}</td><td class="num">${rp(k.sisa)}</td>
      <td><span class="tag ${WARNA[k.status]}">${esc(k.status)}</span>${k.riwayat.length ? `<details><summary class="small">Riwayat</summary>${k.riwayat.map((x) => `<div class="small">${waktu(x.waktu)} · ${x.jenis === "beban" ? "Dibebankan perusahaan" : "Diganti " + esc(x.cara)} ${rp(x.jumlah)} · ${esc(x.oleh)}${x.catatan ? " · " + esc(x.catatan) : ""}</div>`).join("")}</details>` : ""}</td>
      <td>${k.sisa > 0 && k.status !== "Dibebankan perusahaan" ? `<button class="btn small" data-selesai="${k.id}">Selesaikan</button>` : ""}</td></tr>`).join("") : '<tr><td colspan="9" class="muted">Belum ada kerugian.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halLaporan);
  $("#isi").querySelectorAll("[data-selesai]").forEach((b) => (b.onclick = () => formSelesaikan(kerugian.find((k) => k.id === b.dataset.selesai))));
}

function formSelesaikan(k) {
  const owner = saya.role.includes("owner");
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button><h1>Selesaikan kerugian</h1>
    <p class="muted">${esc(k.rincian)} · penanggung jawab ${esc(k.pj || "—")} · sisa <b>${rp(k.sisa)}</b></p>
    <form class="card" id="fSel" style="margin-top:12px">
      <div class="checks"><label><input type="radio" name="jenis" value="ganti" checked> Diganti penanggung jawab</label>
        <label><input type="radio" name="jenis" value="beban" ${owner ? "" : "disabled"}> Dibebankan ke perusahaan ${owner ? "" : "(hanya Owner)"}</label></div>
      <div id="bagianGanti"><div class="grid2"><div><label>Jumlah</label><input type="number" name="jumlah" min="1" max="${k.sisa}"></div>
        <div><label>Cara</label><select name="cara"><option>Tunai</option><option>Transfer</option><option>Potong gaji</option></select></div></div></div>
      <label>Catatan</label><input type="text" name="catatan">
      <p class="small muted">Ditandai oleh ${esc(saya.nama)}.</p>
      <div class="err" hidden></div><div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batal">Batal</button></div></form></div>`;
  $("#kembali").onclick = $("#batal").onclick = halKerugian;
  const f = $("#fSel");
  f.onchange = () => ($("#bagianGanti").hidden = f.jenis.value === "beban");
  f.jumlah.oninput = () => { if (angka(f.jumlah.value) > k.sisa) f.jumlah.value = k.sisa; };
  formKirim(f, async (x) => {
    await api("POST", `/api/kerugian/${k.id}/selesaikan`, x.jenis === "beban" ? { jenis: "beban", catatan: x.catatan } : { jenis: "ganti", jumlah: angka(x.jumlah), cara: x.cara, catatan: x.catatan });
    halKerugian();
  });
}
