// Dashboard › Penjualan (transaksi POS, setoran kasir, kiriman ditolak) dan Pengaturan POS.

let subJual = "transaksi";
let rentangJual = { dari: "", sampai: "" };

function halPenjualan(sub) {
  if (sub) subJual = sub;
  if (!rentangJual.dari) rentangJual = { dari: hariIni(), sampai: hariIni() };
  ({ transaksi: daftarTransaksi, setoran: daftarSetoran, ditolak: daftarDitolak })[subJual]();
}

const kepalaJual = () => `<div class="head"><div><h1>Penjualan</h1></div></div>
  ${subtabs([["transaksi", "Transaksi POS"], ["setoran", "Setoran Kasir"], ["ditolak", "Kiriman Ditolak"]], subJual)}
  ${subJual === "ditolak" ? "" : `<form class="filters" id="fRentang"><label style="margin:0">Dari</label><input type="date" name="dari" value="${rentangJual.dari}">
    <label style="margin:0">Sampai</label><input type="date" name="sampai" value="${rentangJual.sampai}"><button class="btn small primary">Terapkan</button></form>`}`;

function pasangRentang() {
  pasangSubtabs(halPenjualan);
  const f = $("#fRentang");
  if (f) f.onsubmit = (e) => { e.preventDefault(); rentangJual = { dari: f.dari.value, sampai: f.sampai.value }; halPenjualan(); };
}

async function daftarTransaksi() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const d = await api("GET", `/api/transaksi?dari=${rentangJual.dari}&sampai=${rentangJual.sampai}`);
  $("#isi").innerHTML = `<main>${kepalaJual()}
    <div class="kpis"><div class="kpi"><span class="muted small">Transaksi lunas</span><b>${d.ringkasan.jumlah}</b></div>
      <div class="kpi"><span class="muted small">Total penjualan</span><b>${rp(d.ringkasan.total)}</b></div>
      <div class="kpi"><span class="muted small">Void</span><b>${d.ringkasan.void}</b></div></div>
    <div class="tablewrap"><table><thead><tr><th>Waktu</th><th>No.</th><th>Tempat</th><th>Kasir</th><th class="num">Barang</th><th>Metode</th><th>Ref QRIS</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>
    ${d.transaksi.length ? d.transaksi.map((t) => `<tr class="klik" data-id="${t.id}"><td>${waktu(t.waktu)}</td><td><b>${esc(t.no)}</b>${t.offline ? ' <span class="tag warn">offline</span>' : ""}</td>
      <td>${esc(t.lokasi)}</td><td>${esc(t.kasir)}</td><td class="num">${t.jumlah_barang}</td><td>${esc(t.metode)}</td><td>${esc(t.ref_qris) || "—"}</td>
      <td class="num">${rp(t.total)}</td><td>${t.status === "Lunas" ? '<span class="tag aktif">Lunas</span>' : `<span class="tag off">${esc(t.status)}</span>`}</td></tr>`).join("")
      : '<tr><td colspan="9" class="muted">Belum ada transaksi di rentang ini.</td></tr>'}
    </tbody></table></div></main>`;
  pasangRentang();
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => detailTransaksi(tr.dataset.id)));
}

async function detailTransaksi(id) {
  const { transaksi: t, items, pembayaran } = await api("GET", "/api/transaksi/" + id);
  popup(`<h2>${esc(t.no)}</h2><div class="muted small">${waktu(t.waktu)} · ${esc(t.lokasi)} · ${esc(t.kasir)} · HP ${esc(t.perangkat || "—")}</div>
    <table style="margin-top:10px">${items.map((i) => `<tr><td>${esc(i.nama)}<div class="small muted">${i.qty} × ${rp(i.harga)} · HPP ${rp(i.hpp)}</div></td><td class="num">${rp(i.qty * i.harga)}</td></tr>`).join("")}
      <tr><td>Subtotal</td><td class="num">${rp(t.subtotal)}</td></tr>${t.diskon ? `<tr><td>${esc(t.promo || "Diskon")}</td><td class="num">−${rp(t.diskon)}</td></tr>` : ""}
      ${t.pajak ? `<tr><td>PPN</td><td class="num">${rp(t.pajak)}</td></tr>` : ""}${t.pembulatan ? `<tr><td>Pembulatan</td><td class="num">−${rp(t.pembulatan)}</td></tr>` : ""}
      <tr><td><b>Total</b></td><td class="num"><b>${rp(t.total)}</b></td></tr>
      ${pembayaran.map((b) => `<tr><td>${esc(b.metode)}${b.ref ? ` · ref ${esc(b.ref)}` : ""}</td><td class="num">${rp(b.jumlah)}</td></tr>`).join("")}
      ${t.kembalian ? `<tr><td>Kembalian</td><td class="num">${rp(t.kembalian)}</td></tr>` : ""}</table>
    ${t.offline ? '<p class="small muted">Dibuat saat HP offline, diterima server ' + waktu(t.diterima_pada) + ".</p>" : ""}`);
}

async function daftarSetoran() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const d = await api("GET", `/api/shift?dari=${rentangJual.dari}&sampai=${rentangJual.sampai}`);
  const selisih = (s) => s.selisih === null ? '<span class="tag warn">Masih buka</span>' : s.selisih === 0 ? '<span class="tag aktif">Kas pas</span>'
    : s.selisih < 0 ? `<span class="tag off">Kurang ${rp(-s.selisih)}</span>` : `<span class="tag warn">Lebih ${rp(s.selisih)}</span>`;
  $("#isi").innerHTML = `<main>${kepalaJual()}
    <p class="muted small">Seharusnya = modal + penjualan tunai + kas masuk − kas keluar, dihitung ulang dari transaksi yang sudah masuk server.</p>
    <div class="tablewrap"><table><thead><tr><th>Buka</th><th>Tempat</th><th>Kasir</th><th class="num">Transaksi</th><th class="num">Penjualan</th><th class="num">Modal</th><th class="num">Seharusnya</th><th class="num">Dihitung</th><th>Selisih</th></tr></thead><tbody>
    ${d.shift.length ? d.shift.map((s) => `<tr class="klik" data-id="${s.id}"><td>${waktu(s.buka)}${s.tutup ? `<div class="small muted">tutup ${waktu(s.tutup)}</div>` : ""}</td><td>${esc(s.lokasi)}</td>
      <td>${esc(s.kasir)}${s.ditutup_oleh && s.ditutup_oleh !== s.kasir ? `<div class="small muted">ditutup ${esc(s.ditutup_oleh)}</div>` : ""}</td><td class="num">${s.transaksi}</td><td class="num">${rp(s.penjualan)}</td>
      <td class="num">${rp(s.modal)}</td><td class="num">${rp(s.seharusnya)}</td><td class="num">${s.kas_hitung === null ? "—" : rp(s.kas_hitung)}</td><td>${selisih(s)}</td></tr>`).join("")
      : '<tr><td colspan="9" class="muted">Belum ada shift di rentang ini.</td></tr>'}
    </tbody></table></div></main>`;
  pasangRentang();
  $("#isi").querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => detailSetoran(tr.dataset.id)));
}

async function detailSetoran(id) {
  const { shift: s, ringkasan: r, kas } = await api("GET", "/api/shift/" + id);
  popup(`<h2>${esc(s.lokasi)} · ${esc(s.kasir)}</h2><div class="muted small">Buka ${waktu(s.buka)}${s.tutup ? ` · tutup ${waktu(s.tutup)} oleh ${esc(s.ditutup_oleh_nama)}` : ""}</div>
    <table style="margin-top:10px"><tr><td>Transaksi</td><td class="num">${r.transaksi} · ${rp(r.total)}</td></tr>
      <tr><td>Tunai / QRIS / Transfer</td><td class="num">${rp(r.tunai)} / ${rp(r.qris)} / ${rp(r.transfer)}</td></tr>
      <tr><td>Modal</td><td class="num">${rp(s.modal)}</td></tr><tr><td>Kas masuk / keluar</td><td class="num">${rp(r.kas_masuk)} / ${rp(r.kas_keluar)}</td></tr>
      <tr><td><b>Seharusnya</b></td><td class="num"><b>${rp(r.seharusnya)}</b></td></tr>
      <tr><td>Dihitung</td><td class="num">${s.kas_hitung === null ? "—" : rp(s.kas_hitung)}</td></tr>
      ${r.selisih !== null ? `<tr><td>Selisih</td><td class="num">${rp(r.selisih)}</td></tr>` : ""}</table>
    ${s.pj_nama ? `<p class="small">Penanggung jawab: <b>${esc(s.pj_nama)}</b><br>${esc(s.penjelasan)}</p>` : ""}
    ${kas.length ? `<h2 style="margin-top:12px">Kas laci</h2><table>${kas.map((k) => `<tr><td>${waktu(k.waktu)} · ${esc(k.oleh)}<div class="small muted">${esc(k.catatan)}</div></td><td class="num">${k.jenis === "masuk" ? "+" : "−"}${rp(k.jumlah)}</td></tr>`).join("")}</table>` : ""}`);
}

async function daftarDitolak() {
  $("#isi").innerHTML = '<main><p class="muted">Memuat…</p></main>';
  const { ditolak } = await api("GET", "/api/dokumen-ditolak");
  $("#isi").innerHTML = `<main>${kepalaJual()}
    <p class="muted small">Kiriman dari HP kasir yang tidak lolos pemeriksaan server. Isinya disimpan utuh supaya tidak ada penjualan yang hilang. Cocokkan dengan kasir, catat manual kalau perlu, lalu tandai sudah ditangani.</p>
    <div class="tablewrap"><table><thead><tr><th>Diterima</th><th>HP</th><th>Jenis</th><th>Alasan</th><th>Isi</th><th></th></tr></thead><tbody>
    ${ditolak.length ? ditolak.map((d) => `<tr><td>${waktu(d.diterima_pada)}</td><td>${esc(d.perangkat)} ${esc(d.nama_perangkat)}</td><td>${esc(d.jenis)}</td><td>${esc(d.alasan)}</td>
      <td><details><summary class="small">Lihat</summary><pre class="small" style="white-space:pre-wrap;max-width:420px">${esc(JSON.stringify(JSON.parse(d.isi), null, 1))}</pre></details></td>
      <td><button class="btn small" data-selesai="${d.id}">Sudah ditangani</button></td></tr>`).join("") : '<tr><td colspan="6" class="muted">Tidak ada kiriman yang ditolak.</td></tr>'}
    </tbody></table></div></main>`;
  pasangSubtabs(halPenjualan);
  $("#isi").querySelectorAll("[data-selesai]").forEach((b) => (b.onclick = async () => { await api("POST", `/api/dokumen-ditolak/${b.dataset.selesai}/selesai`, {}); daftarDitolak(); }));
}

// ---------- Pengaturan POS ----------

// Gambar dikecilkan di browser sebelum diunggah (sisi terpanjang maksimal 1000 px).
async function kecilkanGambar(file, maks = 1000, jenis = "image/png", mutu = 0.85) {
  const img = await createImageBitmap(file);
  const skala = Math.min(1, maks / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * skala);
  c.height = Math.round(img.height * skala);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, jenis, mutu));
}

async function unggah(blob, jenis) {
  const res = await fetch(`/api/berkas?jenis=${jenis}`, { method: "POST", body: blob, credentials: "same-origin", headers: { "content-type": blob.type } });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Gagal mengunggah");
  return d;
}

async function halPengaturan() {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const { pengaturan: p } = await api("GET", "/api/pengaturan/pos");
  const rek = [...p.rekening];
  let qrisId = p.qris.berkas_id;
  const gambar = () => {
    $("#isi").innerHTML = `<div class="form"><h1>Pengaturan POS</h1><p class="muted">Tersimpan di server dan terbaca HP kasir saat tarik data berikutnya (paling lama 2 menit saat online).</p>
    <form class="card" id="fPos" style="margin-top:12px">
      <h2>Metode pembayaran</h2>
      <div class="checks">${["tunai", "qris", "transfer"].map((m) => `<label><input type="checkbox" name="m_${m}" ${p.metode[m] ? "checked" : ""}> ${{ tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }[m]}</label>`).join("")}</div>
      <label>Nominal uang cepat (pisahkan dengan koma)</label><input type="text" name="nominal" value="${p.nominal_cepat.join(", ")}">
      <h2 class="section">QRIS statis</h2>
      <div class="grid2"><div><label>Nama merchant</label><input type="text" name="q_nama" value="${esc(p.qris.nama)}"></div>
        <div><label>NMID</label><input type="text" name="q_nmid" value="${esc(p.qris.nmid)}"></div></div>
      <label>Gambar QRIS</label>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        ${qrisId ? `<img src="/api/berkas/${qrisId}" alt="QRIS" style="width:140px;border:1px solid var(--border);border-radius:8px">` : '<span class="tag off">Belum diunggah</span>'}
        <input type="file" id="fileQris" accept="image/png,image/jpeg,image/webp" style="width:auto">
        ${qrisId ? '<button type="button" class="btn small danger" id="hapusQris">Hapus gambar</button>' : ""}
      </div>
      <h2 class="section">Rekening transfer</h2>
      <div class="tablewrap"><table><thead><tr><th>Bank</th><th>Nomor</th><th>Atas nama</th><th></th></tr></thead><tbody>
        ${rek.map((r, i) => `<tr><td><input type="text" data-r="${i}" data-k="bank" value="${esc(r.bank)}"></td><td><input type="text" data-r="${i}" data-k="no" value="${esc(r.no)}"></td>
          <td><input type="text" data-r="${i}" data-k="nama" value="${esc(r.nama)}"></td><td><button type="button" class="btn small danger" data-hapusrek="${i}">Hapus</button></td></tr>`).join("")}
        <tr><td colspan="4"><button type="button" class="btn small" id="tambahRek">+ Rekening</button></td></tr></tbody></table></div>
      <h2 class="section">Total dan pajak</h2>
      <div class="grid2">
        <div><label>Pembulatan total (ke bawah)</label><select name="pembulatan">${[0, 100, 500, 1000].map((n) => `<option value="${n}" ${p.pembulatan === n ? "selected" : ""}>${n ? "Rp " + n.toLocaleString("id-ID") : "Tanpa pembulatan"}</option>`).join("")}</select></div>
        <div><label>Tarif PPN (%)</label><input type="number" name="pajak_persen" min="0" max="100" value="${p.pajak.persen}"></div>
      </div>
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" name="pajak_aktif" ${p.pajak.aktif ? "checked" : ""}> PPN aktif</label>
        <label><input type="checkbox" name="diskon_aktif" ${p.diskon_kasir.aktif ? "checked" : ""}> Diskon manual kasir</label></div>
      <label>Batas diskon manual kasir (%)</label><input type="number" name="diskon_maks" min="0" max="100" value="${p.diskon_kasir.maks_persen}" style="max-width:200px">
      <h2 class="section">Keamanan dan tampilan</h2>
      <div class="grid2"><div><label>Kunci layar otomatis</label><select name="kunci">${[0, 5, 10, 20, 30].map((n) => `<option value="${n}" ${p.kunci_menit === n ? "selected" : ""}>${n ? n + " menit" : "Mati"}</option>`).join("")}</select></div></div>
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" name="void_pin" ${p.void_pin ? "checked" : ""}> Void perlu PIN atasan</label>
        <label><input type="checkbox" name="tampil_stok" ${p.tampil_stok ? "checked" : ""}> Tampilkan sisa stok di kartu produk</label></div>
      <h2 class="section">Struk</h2>
      <div class="grid2"><div><label>Nama</label><input type="text" name="s_nama" value="${esc(p.struk.nama)}"></div><div><label>Baris info</label><input type="text" name="s_info" value="${esc(p.struk.info)}" placeholder="IG, WA, alamat"></div></div>
      <label>Pesan penutup</label><input type="text" name="s_footer" value="${esc(p.struk.footer)}">
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" name="s_kasir" ${p.struk.tampil_kasir ? "checked" : ""}> Tampilkan nama kasir</label>
        <label><input type="checkbox" name="s_event" ${p.struk.tampil_event ? "checked" : ""}> Tampilkan nama tempat/event</label></div>
      <div class="err" hidden></div><div class="ok" id="tersimpan" hidden>Tersimpan.</div>
      <div class="actions"><button class="btn primary">Simpan pengaturan</button></div>
    </form></div>`;
    const f = $("#fPos");
    f.querySelectorAll("[data-r]").forEach((el) => (el.oninput = () => { rek[+el.dataset.r][el.dataset.k] = el.value; }));
    f.querySelectorAll("[data-hapusrek]").forEach((b) => (b.onclick = () => { rek.splice(+b.dataset.hapusrek, 1); gambar(); }));
    $("#tambahRek").onclick = () => { rek.push({ bank: "", no: "", nama: "" }); gambar(); };
    if ($("#hapusQris")) $("#hapusQris").onclick = () => { qrisId = null; gambar(); };
    $("#fileQris").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { qrisId = (await unggah(await kecilkanGambar(file), "qris")).id; gambar(); } catch (x) { alert(x.message); }
    };
    formKirim(f, async (d) => {
      const nilai = {
        metode: { tunai: f.m_tunai.checked, qris: f.m_qris.checked, transfer: f.m_transfer.checked },
        nominal_cepat: d.nominal.split(",").map((x) => angka(x.trim())).filter((x) => x),
        qris: { nama: d.q_nama, nmid: d.q_nmid, berkas_id: qrisId },
        rekening: rek,
        pembulatan: Number(d.pembulatan),
        pajak: { aktif: f.pajak_aktif.checked, persen: Number(d.pajak_persen) },
        diskon_kasir: { aktif: f.diskon_aktif.checked, maks_persen: Number(d.diskon_maks) },
        kunci_menit: Number(d.kunci), void_pin: f.void_pin.checked, tampil_stok: f.tampil_stok.checked,
        struk: { nama: d.s_nama, info: d.s_info, footer: d.s_footer, tampil_kasir: f.s_kasir.checked, tampil_event: f.s_event.checked },
      };
      const r = await api("PUT", "/api/pengaturan/pos", nilai);
      Object.assign(p, r.pengaturan);
      $("#tersimpan").hidden = false;
    });
  };
  gambar();
}

// ---------- Harga Jual Langsung Gudang (dari Daftar Produk) ----------

async function formHargaGudang() {
  $("#isi").innerHTML = '<div class="form"><p class="muted">Memuat…</p></div>';
  const [{ produk }, { harga }] = await Promise.all([api("GET", "/api/produk"), api("GET", "/api/harga-saluran/gudang")]);
  const baris = produk.filter((p) => p.aktif).flatMap((p) => p.varian.filter((v) => v.aktif).map((v) => ({ sku: v.sku, nama: p.nama + (v.nama ? " · " + v.nama : ""), normal: v.harga_jual })));
  $("#isi").innerHTML = `<div class="form"><button class="back" id="kembali">← Kembali</button>
    <h1>Harga Jual Langsung Gudang</h1><p class="muted">Dipakai saat Owner berjualan langsung dari Gudang Pusat. Kosong berarti harga normal.</p>
    <form class="card" id="fHg" style="margin-top:12px">
      <div class="tablewrap"><table><thead><tr><th>Barang</th><th>SKU</th><th class="num">Harga normal</th><th class="num" style="width:200px">Harga gudang</th></tr></thead><tbody>
      ${baris.map((b) => `<tr><td>${esc(b.nama)}</td><td>${esc(b.sku)}</td><td class="num">${rp(b.normal)}</td><td><input type="number" min="0" name="${esc(b.sku)}" value="${harga[b.sku] ?? ""}" placeholder="${b.normal}"></td></tr>`).join("")}
      </tbody></table></div>
      <div class="err" hidden></div>
      <div class="actions"><button class="btn primary">Simpan</button><button type="button" class="btn" id="batal">Batal</button></div>
    </form></div>`;
  $("#kembali").onclick = $("#batal").onclick = () => halProduk("daftar");
  formKirim($("#fHg"), async (d) => {
    const ubah = {};
    for (const b of baris) {
      const baru = d[b.sku] === "" ? null : angka(d[b.sku]);
      if ((harga[b.sku] ?? null) !== baru) ubah[b.sku] = baru;
    }
    if (Object.keys(ubah).length) await api("PUT", "/api/harga-saluran/gudang", { harga: ubah });
    halProduk("daftar");
  });
}
