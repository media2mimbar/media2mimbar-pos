// POS: Laporan (laporan kasir, kas kasir, produk terjual), Riwayat Masuk, Pengaturan (baca saja), persetujuan opname oleh
// Owner/Admin, batal terima kiriman, dan Tutup Event dari HP (Owner). Semua yang mengubah data di sini butuh sinyal.

const butuhSinyal = () => { if (S.online && A.sesi.sesi) return true; toast("Bagian ini butuh sinyal"); return false; };

// ---------- Laporan ----------

async function layarLaporanPos(tab = "kasir", periode = "hari", semua = false) {
  tampil(`${bar("Laporan", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap">
    <div class="metode">${[["kasir", "Laporan kasir"], ["kas", "Kas kasir"], ["produk", "Produk terjual"]].map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${n}</button>`).join("")}</div>
    <div id="isiLap"><p class="muted">Memuat…</p></div></div>`, "laporan");
  $("#kembali").onclick = gambarKasir;
  $$("[data-tab]").forEach((b) => (b.onclick = () => layarLaporanPos(b.dataset.tab, periode, semua)));
  if (tab === "kas") return layarKas();
  if (!butuhSinyal()) { $("#isiLap").innerHTML = '<p class="muted">Laporan butuh sinyal.</p>'; return; }
  let d;
  try { d = await api("GET", `/api/pos/laporan?lokasi=${encodeURIComponent(A.sesi.lokasi_id)}&periode=${periode}${semua ? "&semua=1" : ""}`); } catch (x) { $("#isiLap").innerHTML = `<div class="err">${esc(x.message)}</div>`; return; }
  if (A.layar !== "laporan") return;
  if (tab === "kasir") {
    $("#isiLap").innerHTML = d.shift.map((s) => {
      const sel = s.selisih === null ? '<span class="tag warn">Masih buka</span>' : s.selisih === 0 ? '<span class="tag ok">Kas pas</span>' : s.selisih < 0 ? `<span class="tag off">Kurang ${rp(-s.selisih)}</span>` : `<span class="tag warn">Lebih ${rp(s.selisih)}</span>`;
      return `<div class="card" style="margin-top:8px"><b>${esc(s.kasir)}</b> ${sel}<div class="small muted">${tglJam(s.buka)}${s.tutup ? " – " + jam(s.tutup) : ""}${s.ditutup_oleh && s.ditutup_oleh !== s.kasir ? " · ditutup " + esc(s.ditutup_oleh) : ""}</div>
        <table class="rinci"><tr><td>Saldo awal</td><td>${rp(s.modal)}</td></tr><tr><td>Saldo akhir${s.kas_hitung === null ? " (seharusnya)" : ""}</td><td>${rp(s.kas_hitung ?? s.seharusnya)}</td></tr>
          <tr class="tebal"><td>Produk (${s.transaksi} transaksi)</td><td>${rp(s.total - s.ekstra.pajak + s.ekstra.diskon + s.ekstra.bulat)}</td></tr>
          ${s.ekstra.diskon ? `<tr><td>Diskon & promo</td><td>−${rp(s.ekstra.diskon)}</td></tr>` : ""}${s.ekstra.pajak ? `<tr><td>Ekstra: PPN</td><td>${rp(s.ekstra.pajak)}</td></tr>` : ""}${s.ekstra.bulat ? `<tr><td>Ekstra: pembulatan</td><td>−${rp(s.ekstra.bulat)}</td></tr>` : ""}
          <tr class="tebal"><td>Pembayaran</td><td>${rp(s.total)}</td></tr><tr><td>Tunai</td><td>${rp(s.tunai)}</td></tr><tr><td>QRIS</td><td>${rp(s.qris)}</td></tr><tr><td>Transfer</td><td>${rp(s.transfer)}</td></tr>
          ${s.void_n ? `<tr><td>Void (${s.void_n})</td><td>${rp(s.void_total)}</td></tr>` : ""}</table></div>`;
    }).join("") || '<p class="muted">Belum ada shift di tempat ini.</p>';
    return;
  }
  const PER = [["hari", "Hari ini"], ["kemarin", "Kemarin"], ["7hari", "7 hari terakhir"], ["minggu", "Minggu ini"], ["minggu_lalu", "Minggu lalu"], ...(A.snap.lokasi.event ? [["event", "Selama event"]] : [])];
  $("#isiLap").innerHTML = `<div class="chips">${PER.map(([k, n]) => `<button data-per="${k}" class="${k === periode ? "on" : ""}">${n}</button>`).join("")}</div>
    ${A.snap.lokasi.jenis === "event" ? `<div class="metode"><button data-semua="0" class="${semua ? "" : "on"}">Event ini</button><button data-semua="1" class="${semua ? "on" : ""}">Semua event</button></div>` : ""}
    <div class="small muted">${d.periode.dari === d.periode.sampai ? esc(d.periode.dari) : esc(d.periode.dari) + " s/d " + esc(d.periode.sampai)}</div>
    <div class="card" style="margin-top:8px"><b>Terjual · ${d.produk.reduce((a, p) => a + p.qty, 0)} pcs · ${rp(d.produk.reduce((a, p) => a + p.bersih, 0))}</b>
      <table class="rinci">${d.produk.map((p) => `<tr><td>${esc(p.nama)}<br><span class="small muted">${esc(p.sku)}</span></td><td>${p.qty} pcs<br><span class="small muted">${rp(p.bersih)}</span></td></tr>`).join("") || '<tr><td class="muted">Belum ada.</td></tr>'}</table></div>
    ${d.void.length ? `<div class="card" style="margin-top:8px"><b>Di-void</b><table class="rinci">${d.void.map((v) => `<tr><td>${esc(v.nama)}</td><td>${v.qty} pcs · ${rp(v.nilai)}</td></tr>`).join("")}</table></div>` : ""}`;
  $$("[data-per]").forEach((b) => (b.onclick = () => layarLaporanPos("produk", b.dataset.per, semua)));
  $$("[data-semua]").forEach((b) => (b.onclick = () => layarLaporanPos("produk", periode, b.dataset.semua === "1")));
}

// ---------- Riwayat Masuk ----------

async function layarRiwayatMasuk(periode = "hari") {
  tampil(`${bar("Riwayat masuk", `HP ${esc(S.perangkat.kode)}`, '<button id="kembali">Kembali</button>')}<div class="wrap">
    <div class="chips">${[["hari", "Hari ini"], ["7hari", "7 hari"], ["semua", "Semua"]].map(([k, n]) => `<button data-per="${k}" class="${k === periode ? "on" : ""}">${n}</button>`).join("")}</div>
    <div id="isiRiwayat"><p class="muted">Memuat…</p></div></div>`, "riwayatmasuk");
  $("#kembali").onclick = gambarKasir;
  $$("[data-per]").forEach((b) => (b.onclick = () => layarRiwayatMasuk(b.dataset.per)));
  if (!butuhSinyal()) { $("#isiRiwayat").innerHTML = '<p class="muted">Riwayat butuh sinyal. Catatan dari HP ini tetap dikirim saat ada sinyal.</p>'; return; }
  const d = await api("GET", `/api/pos/riwayat?periode=${periode}`);
  $("#isiRiwayat").innerHTML = `${d.sendiri ? '<p class="small muted">Menampilkan riwayat Anda sendiri.</p>' : ""}<div class="daftar">${d.riwayat.map((x) => `<div class="card small">
    <b>${esc(x.aksi)}</b> · ${esc(x.nama ?? "—")} <span class="muted">${(x.role ?? "").split(",").filter(Boolean).map((r) => NAMA_ROLE[r]).join(", ")}</span>
    <div class="muted">${tglJam(x.waktu)} · HP ${esc(x.perangkat ?? "—")}${x.keterangan ? " · " + esc(x.keterangan) : ""}</div></div>`).join("") || '<p class="muted">Belum ada.</p>'}</div>`;
}

// ---------- Pengaturan (baca saja) ----------

function layarPengaturanPos() {
  const p = pengaturan();
  const ya = (v) => (v ? "Ya" : "Tidak");
  tampil(`${bar("Pengaturan", "Diubah dari dashboard", '<button id="kembali">Kembali</button>')}<div class="wrap">
    <div class="card"><h2>Perangkat</h2><table class="rinci"><tr><td>Kode HP</td><td>${esc(S.perangkat.kode)}</td></tr><tr><td>Nama</td><td>${esc(S.perangkat.nama)}</td></tr>
      <tr><td>Tempat</td><td>${esc(A.snap.lokasi.nama)}</td></tr><tr><td>Sinyal</td><td>${statusSinyal()}</td></tr></table></div>
    <div class="card" style="margin-top:10px"><h2>Penjualan</h2><table class="rinci">
      <tr><td>Metode bayar</td><td>${["tunai", "qris", "transfer"].filter((m) => p.metode?.[m] !== false).map((m) => ({ tunai: "Tunai", qris: "QRIS", transfer: "Transfer" })[m]).join(", ")}</td></tr>
      <tr><td>PPN</td><td>${p.pajak?.aktif ? p.pajak.persen + "%" : "Tidak"}</td></tr><tr><td>Pembulatan</td><td>${p.pembulatan ? rp(p.pembulatan) : "Tidak"}</td></tr>
      <tr><td>Diskon manual kasir</td><td>${p.diskon_kasir?.aktif ? "maks " + p.diskon_kasir.maks_persen + "%" : "Tidak"}</td></tr>
      <tr><td>Void perlu PIN atasan</td><td>${ya(p.void_pin !== false)}</td></tr><tr><td>Tampilkan stok</td><td>${ya(p.tampil_stok !== false)}</td></tr>
      <tr><td>Kunci layar otomatis</td><td>${p.kunci_menit ? p.kunci_menit + " menit" : "Mati"}</td></tr></table></div>
    <div class="card" style="margin-top:10px"><h2>Struk</h2><table class="rinci"><tr><td>Nama toko</td><td>${esc(p.struk?.nama ?? "")}</td></tr><tr><td>Info</td><td>${esc(p.struk?.info ?? "")}</td></tr>
      <tr><td>Catatan bawah</td><td>${esc(p.struk?.footer ?? "")}</td></tr></table></div></div>`, "pengaturan");
  $("#kembali").onclick = gambarKasir;
}

// ---------- Persetujuan opname (Owner/Admin) ----------

async function layarSetujuiOpname(id, kembali = () => layarInventori("opname")) {
  if (!butuhSinyal()) return;
  tampil(`${bar("Periksa opname", esc(A.snap.lokasi.nama), '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Memuat…</p></div>`, "setujuopname");
  $("#kembali").onclick = kembali;
  let d;
  try { d = await api("GET", "/api/pos/opname/" + id); } catch (x) { toast(x.message); return kembali(); }
  const o = d.opname, beda = d.item.filter((i) => i.fisik !== i.sistem);
  const rugi = d.item.reduce((a, i) => a + Math.max(0, i.sistem - i.fisik) * i.hpp, 0);
  const karyawan = (await kv.get("karyawan")) ?? [];
  $("#app .wrap").innerHTML = `<div class="card"><b>${esc(o.no)}</b><div class="small muted">Dihitung ${esc(o.dihitung_nama ?? o.dihitung_oleh_nama ?? "")} · ${tglJam(o.dihitung_pada)}</div>
      ${o.catatan ? `<p class="small">${esc(o.catatan)}</p>` : ""}
      <table class="rinci">${beda.map((i) => `<tr><td>${esc(i.nama)}<br><span class="small muted">sistem ${i.sistem} · fisik ${i.fisik}</span></td><td>${i.fisik < i.sistem ? `<span style="color:var(--danger)">kurang ${i.sistem - i.fisik}</span>` : `lebih ${i.fisik - i.sistem}`}</td></tr>`).join("") || '<tr><td>Semua barang sesuai sistem.</td></tr>'}
      ${rugi ? `<tr class="tebal"><td>Kerugian</td><td>${rp(rugi)}</td></tr>` : ""}</table></div>
    <form class="card" id="fSetujuO" style="margin-top:10px">
      ${rugi ? `<label>Penanggung jawab</label><select name="pj">${karyawan.map((k) => `<option value="${k.id}" ${k.id === d.pj_bawaan ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
        <label>Penjelasan (wajib)</label><textarea name="penjelasan" required minlength="5"></textarea>` : ""}
      <div class="err" hidden></div>
      <button class="btn primary">Setujui. Stok disesuaikan</button>
      <button type="button" class="btn" id="mintaUlang">Minta hitung ulang</button></form>`;
  const f = $("#fSetujuO");
  const salah = (m) => { $(".err", f).textContent = m; $(".err", f).hidden = false; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("POST", `/api/pos/opname/${id}/setujui`, rugi ? { pj_id: f.pj.value, penjelasan: f.penjelasan.value.trim() } : {});
      A.snap = await tarikData(A.sesi.lokasi_id); A.stok = await stokTersedia(A.snap);
      toast("Opname disetujui. Stok sudah disesuaikan");
      kembali();
    } catch (x) { salah(x.message); }
  };
  $("#mintaUlang").onclick = async () => {
    const alasan = prompt("Alasan minta hitung ulang");
    if (!alasan) return;
    try { await api("POST", `/api/pos/opname/${id}/ulang`, { alasan }); toast("Kasir diminta menghitung ulang"); kembali(); } catch (x) { salah(x.message); }
  };
}

// ---------- Batal terima kiriman ----------

async function batalTerima(m) {
  if (!butuhSinyal()) return;
  const alasan = prompt(`Batalkan penerimaan ${m.no}? Stok event berkurang dan kiriman kembali menunggu diterima. Tulis alasannya:`);
  if (!alasan) return;
  try {
    await api("POST", `/api/pos/mutasi/${m.id}/batal-terima`, { alasan });
    A.snap = await tarikData(A.sesi.lokasi_id); A.stok = await stokTersedia(A.snap);
    toast("Penerimaan dibatalkan");
  } catch (x) { toast(x.message); }
  layarInventori("kiriman");
}

// ---------- Tutup event dari HP (Owner) ----------

async function layarTutupEventPos(id = A.sesi.lokasi_id, kembali = gambarKasir) {
  if (!butuhSinyal()) return;
  const ulang = () => layarTutupEventPos(id, kembali);
  tampil(`${bar("Tutup event", "", '<button id="kembali">Kembali</button>')}<div class="wrap"><p class="muted">Mengirim data dan memuat…</p></div>`, "tutupevent");
  $("#kembali").onclick = kembali;
  await sinkronSekarang();
  let d;
  try { d = await api("GET", `/api/pos/event/${id}/tutup`); } catch (x) { toast(x.message); return kembali(); }
  const e = d.event, karyawan = (await kv.get("karyawan")) ?? [];
  const blokir = d.shift_terbuka.length || d.opname_menunggu;
  $(".bar .judul span").textContent = e.nama;
  $("#app .wrap").innerHTML = `
    ${d.shift_terbuka.length ? `<div class="card"><b>Kasir masih terbuka</b><div class="small muted">Tutup semua laci dulu. Hitung uangnya lalu setujui dengan PIN.</div>
      ${d.shift_terbuka.map((s) => `<button class="btn" data-tutupshift="${s.id}">Tutup kasir ${esc(s.kasir)}</button>`).join("")}</div>` : ""}
    ${d.opname_menunggu ? `<div class="card" style="margin-top:10px"><b>Opname ${esc(d.opname_menunggu.no)} menunggu persetujuan</b><div class="small muted">Dihitung ${esc(d.opname_menunggu.dihitung_oleh)}</div>
      <button class="btn" id="periksaOp">Periksa opname</button></div>` : ""}
    ${d.kiriman.length ? `<div class="warn">${d.kiriman.length} kiriman belum diterima akan dibatalkan dan kembali ke Gudang Pusat.</div>` : ""}
    ${d.presale_menunggu ? `<div class="warn">${d.presale_menunggu} pesanan pre-sale belum diambil. Setelah event ditutup, pesanan bisa diambil di Gudang Pusat selama 7 hari.</div>` : ""}
    <form class="card" id="fTutupEv" style="margin-top:10px">
      <p class="small muted">Hitung stok fisik. Kosong berarti sama dengan sistem. Sisa barang kembali ke Gudang Pusat.</p>
      ${d.stok.map((s) => `<div class="baris"><div class="isi"><b>${esc(s.nama)}</b><div class="small muted">Sistem ${s.qty}<span data-sel="${esc(s.sku)}"></span></div></div>
        <input type="number" inputmode="numeric" min="0" data-sku="${esc(s.sku)}" placeholder="${Math.max(0, s.qty)}" style="width:90px"></div>`).join("")}
      <div id="kurangEv" hidden><label>Penanggung jawab</label><select name="pj">${karyawan.map((k) => `<option value="${k.id}" ${k.id === e.pj_id ? "selected" : ""}>${esc(k.nama)}</option>`).join("")}</select>
        <label>Penjelasan selisih</label><textarea name="penjelasan"></textarea></div>
      <div class="err" hidden></div>
      <button class="btn primary" ${blokir ? "disabled" : ""}>Tutup Event</button></form>`;
  $$("[data-tutupshift]").forEach((b) => (b.onclick = () => {
    const s = d.shift_terbuka.find((x) => x.id === b.dataset.tutupshift);
    if (s.id === A.sesi.shift_id) return layarTutupKasir();
    layarTutupKasir({ id: s.id, kasir_id: s.kasir_id, kasir: s.kasir, modal: s.modal, kembali: ulang });
  }));
  if ($("#periksaOp")) $("#periksaOp").onclick = () => layarSetujuiOpname(d.opname_menunggu.id, ulang);
  const f = $("#fTutupEv");
  const baris = () => d.stok.map((s) => { const el = $(`[data-sku="${CSS.escape(s.sku)}"]`, f); return { ...s, fisik: el.value === "" ? Math.max(0, s.qty) : Number(el.value) }; });
  f.oninput = () => {
    let rugi = 0;
    for (const b of baris()) {
      const sel = b.fisik - b.qty;
      $(`[data-sel="${CSS.escape(b.sku)}"]`, f).textContent = sel === 0 ? "" : sel < 0 ? ` · kurang ${-sel}` : ` · lebih ${sel}`;
      if (sel < 0) rugi += -sel * b.hpp;
    }
    $("#kurangEv").hidden = !rugi;
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!confirm(`Tutup ${e.nama}? Event tidak bisa dipakai jualan lagi.`)) return;
    const fisik = Object.fromEntries(baris().map((b) => [b.sku, b.fisik]));
    try {
      const r = await api("POST", `/api/pos/event/${id}/tutup`, { fisik, pj_id: $("#kurangEv").hidden ? undefined : f.pj.value, penjelasan: $("#kurangEv").hidden ? undefined : f.penjelasan.value.trim() });
      toast(`Event ditutup. ${r.kembali} pcs kembali ke Gudang Pusat${r.kerugian ? `, kerugian ${rp(r.kerugian)}` : ""}`);
      if (A.sesi.lokasi_id === id) { A.sesi.lokasi_id = null; A.sesi.shift_id = null; A.sesi.shift = null; await simpanSesi(); }
      try { A.umum = await tarikUmum(); } catch {}
      layarTempat();
    } catch (x) { $(".err", f).textContent = x.message; $(".err", f).hidden = false; }
  };
}
