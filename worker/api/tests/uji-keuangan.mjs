// Uji tahap 7: biaya (hak akses, kas keluar laci), laporan penjualan (dashboard, per saluran, event, kasir, produk, rekap harian),
// laporan keuangan per event dan keseluruhan (termasuk bagi biaya umum, arus kas, posisi).
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib } from "../dist/aturan.js";
import { periode } from "../dist/laporan.js";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);
let owner, admin, sari, hp, kode, ev, adminCookie;
const sinkron = (dokumen) => api("POST", "/api/pos/sinkron", { dokumen }, { headers: hp, cookie: null });
const setujui = async (staff_id, pin, aksi) => ok(await api("POST", "/api/pos/setujui", { staff_id, pin, aksi }, { headers: hp, cookie: null })).token;
let nomor = 0;
const no = () => `HK-${hari.slice(2).replace(/-/g, "")}-${kode}-${String(++nomor).padStart(4, "0")}`;
const sekarang = () => new Date().toISOString();

test("periode dashboard: harian, mingguan Senin–Minggu, bulanan", () => {
  assert.deepEqual(periode("harian", "2026-10-14"), { dari: "2026-10-14", sampai: "2026-10-14" });
  assert.deepEqual(periode("mingguan", "2026-10-14"), { dari: "2026-10-12", sampai: "2026-10-18" });
  assert.deepEqual(periode("mingguan", "2026-10-18"), { dari: "2026-10-12", sampai: "2026-10-18" });
  assert.deepEqual(periode("bulanan", "2026-02-14"), { dari: "2026-02-01", sampai: "2026-02-28" });
});

test("persiapan: event, penjualan POS, retur, kas laci, tutup kasir kurang, pesanan online", async () => {
  owner = await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Kaos" }), 201).id;
  ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 20 }, { nama: "M", harga_jual: 125000, stok_awal: 20 }] }), 201);
  admin = ok(await api("POST", "/api/karyawan", { nama: "Dimas", email: "dimas@hikayat.id", role: ["admin"], password: "dimas1234", pin: "222222" }), 201).id;
  sari = ok(await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" }), 201).id;
  ev = ok(await api("POST", "/api/event", { nama: "Fest", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S" }, { sku: "KB-M" }] }), 201).id;
  ok(await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 10 }] }), 201);
  const o = await siapkanHp(L, owner, "135790");
  hp = o.hp; kode = o.perangkat.kode;
  const mut = sql("SELECT id FROM mutasi")[0].id;
  const shift = ulid(), t1 = ulid();
  const r = ok(await sinkron([
    { jenis: "terima", data: { id: mut, lokasi_id: ev, oleh: sari, waktu: sekarang() } },
    { jenis: "shift_buka", data: { id: shift, lokasi_id: ev, kasir_id: sari, buka: sekarang(), modal: 100000 } },
    { jenis: "trx", data: { id: t1, no: no(), shift_id: shift, kasir_id: sari, waktu: sekarang(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 2, harga: 125000 }],
      subtotal: 250000, diskon: 25000, promo: "Diskon manual kasir 10%", promo_id: "manual", promo_persen: 10, total: 225000, pembayaran: [{ metode: "Tunai", jumlah: 230000 }] } },
    { jenis: "trx", data: { id: ulid(), no: no(), shift_id: shift, kasir_id: sari, waktu: sekarang(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 125000 }],
      subtotal: 125000, total: 125000, pembayaran: [{ metode: "QRIS", jumlah: 125000, ref: "1234" }] } },
    { jenis: "kas", data: { id: ulid(), shift_id: shift, jenis: "keluar", jumlah: 20000, catatan: "Air mineral", waktu: sekarang(), oleh: sari } },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok", "ok", "ok", "ok"]);
  const tok = await setujui(admin, "222222", "retur");
  ok(await sinkron([{ jenis: "retur", data: { id: ulid(), trx_id: t1, lokasi_id: ev, shift_id: shift, oleh: sari, waktu: sekarang(), disetujui_oleh: admin, persetujuan: tok,
    cara: "Uang kembali", metode: "Tunai", alasan: "Jahitan lepas", items: [{ sku: "KB-S", qty: 1 }] } }]));
  assert.equal(sql("SELECT nilai FROM retur")[0].nilai, 112500);
  // Seharusnya = 100.000 + 225.000 − 20.000 − 112.500 = 192.500; dihitung 190.000 → kurang 2.500.
  const tt = await setujui(sari, "333333", "tutup_kasir");
  ok(await sinkron([{ jenis: "shift_tutup", data: { id: shift, tutup: sekarang(), kas_hitung: 190000, seharusnya: 192500, ditutup_oleh: sari, disetujui_oleh: sari, persetujuan: tt, pj_id: sari, penjelasan: "Salah kembalian" } }]));
  assert.equal(sql("SELECT jumlah FROM kerugian WHERE jenis = 'kas'")[0].jumlah, 2500);
  ok(await api("POST", "/api/online", { saluran_id: "lainnya", no_pesanan: "WA-1", tanggal: hari, items: [{ sku: "KB-M", qty: 1, harga: 125000 }] }), 201);
  ok(await api("POST", "/api/online", { saluran_id: "lainnya", no_pesanan: "WA-2", tanggal: hari, status: "Diproses", items: [{ sku: "KB-M", qty: 1, harga: 125000 }] }), 201);
});

test("biaya: kategori sesuai jenis, admin hanya biaya event, kas keluar laci ikut tampil", async () => {
  assert.match((await api("POST", "/api/biaya", { lokasi_id: ev, tanggal: hari, kategori: "Iklan online", keterangan: "x", jumlah: 1, cara: "Tunai" })).data.error, /Kategori tidak cocok/);
  assert.equal((await api("POST", "/api/biaya", { lokasi_id: ev, tanggal: geser(1), kategori: "Sewa booth", keterangan: "x", jumlah: 1, cara: "Tunai" })).status, 400);
  const b = ok(await api("POST", "/api/biaya", { lokasi_id: ev, tanggal: hari, kategori: "Sewa booth", keterangan: "Booth A1", jumlah: 300000, cara: "Transfer" }), 201);
  assert.match(b.no, /^BY\/\d{6}\/0001$/);
  ok(await api("POST", "/api/biaya", { tanggal: hari, kategori: "Iklan online", keterangan: "Iklan IG", jumlah: 100000, cara: "Transfer" }), 201);
  const salah = ok(await api("POST", "/api/biaya", { tanggal: hari, kategori: "Lainnya", keterangan: "Salah catat", jumlah: 5000, cara: "Tunai" }), 201);
  ok(await api("DELETE", "/api/biaya/" + salah.id));
  // Admin
  const m = await api("POST", "/api/masuk", { email: "dimas@hikayat.id", password: "dimas1234" }, { cookie: null });
  adminCookie = m.cookie;
  ok(await api("POST", "/api/ganti-password", { lama: "dimas1234", baru: "dimasbaru99" }, { cookie: adminCookie }));
  assert.equal((await api("POST", "/api/biaya", { tanggal: hari, kategori: "Iklan online", keterangan: "x", jumlah: 1, cara: "Tunai" }, { cookie: adminCookie })).status, 403);
  assert.equal((await api("GET", "/api/biaya", undefined, { cookie: adminCookie })).status, 403);
  assert.equal((await api("PATCH", "/api/biaya/" + b.id, { lokasi_id: ev, tanggal: hari, kategori: "Sewa booth", keterangan: "x", jumlah: 1, cara: "Tunai" }, { cookie: adminCookie })).status, 403);
  const e = ok(await api("GET", `/api/biaya?lokasi=${ev}`, undefined, { cookie: adminCookie }));
  assert.deepEqual(e.biaya.map((x) => [x.kategori, x.jumlah, x.sumber]).sort(), [["Kas keluar laci", 20000, "laci"], ["Sewa booth", 300000, "biaya"]]);
  const d = ok(await api("GET", "/api/biaya"));
  assert.deepEqual(d.ringkasan, { total: 420000, event: 300000, umum: 100000, laci: 20000 });
});

test("laporan penjualan: dashboard, saluran, event, kasir, produk", async () => {
  // POS: kotor 375.000, diskon 25.000, retur 112.500 → bersih 237.500, HPP 180.000. Online: 250.000, HPP 120.000.
  const d = ok(await api("GET", "/api/ringkasan?periode=harian"));
  assert.deepEqual([d.ringkasan.bersih, d.ringkasan.transaksi, d.ringkasan.qty, d.ringkasan.laba, d.ringkasan.offline, d.ringkasan.online], [487500, 4, 4, 187500, 237500, 250000]);
  assert.deepEqual(d.ringkasan.belum_cair, { n: 1, nilai: 125000 });
  assert.deepEqual(d.grafik.metode.map((m) => [m.metode, m.jumlah]), [["Tunai", 225000], ["QRIS", 125000]]);
  assert.equal(d.grafik.produk[0].nama, "Kaos");
  const s = ok(await api("GET", `/api/laporan/saluran?dari=${hari}&sampai=${hari}`)).baris;
  assert.deepEqual(s.map((x) => [x.nama, x.transaksi, x.qty, x.kotor, x.diskon, x.retur, x.bersih, x.hpp, x.laba]),
    [["Fest", 2, 2, 375000, 25000, 112500, 237500, 180000, 57500], ["Lainnya", 2, 2, 250000, 0, 0, 250000, 120000, 130000]]);
  const e = ok(await api("GET", `/api/laporan/event?dari=${hari}&sampai=${hari}`)).baris[0];
  assert.deepEqual([e.nama, e.tunai, e.qris, e.shift, e.selisih_kas], ["Fest", 225000, 125000, 1, -2500]);
  const k = ok(await api("GET", `/api/laporan/kasir?dari=${hari}&sampai=${hari}`)).baris;
  assert.deepEqual(k.map((x) => [x.nama, x.offline, x.online, x.tunai, x.nontunai, x.shift, x.selisih_kas]).sort(), [["Rina Wijaya", 0, 250000, 0, 0, 0, 0], ["Sari", 237500, 0, 225000, 125000, 1, -2500]]);
  const p = ok(await api("GET", `/api/laporan/produk?dari=${hari}&sampai=${hari}`)).baris[0];
  assert.deepEqual([p.qty_event, p.qty_online, p.bersih, p.sisa], [2, 2, 487500, 40 - 3 - 2]);
  assert.equal((await api("GET", `/api/laporan/saluran?dari=${hari}&sampai=${geser(-1)}`)).status, 400);
});

test("rekap harian: Cron mengisi tabel, hari ini dihitung langsung", async () => {
  assert.equal((await api("POST", "/api/laporan/rekap", { dari: hari, sampai: hari }, { cookie: adminCookie })).status, 403);
  ok(await api("POST", "/api/laporan/rekap", { dari: geser(-3), sampai: hari }));
  const t = sql("SELECT SUM(kotor) AS kotor, SUM(potongan) AS potongan, SUM(retur) AS retur, SUM(hpp) AS hpp, SUM(qty) AS qty FROM rekap_harian WHERE tanggal = ?", hari)[0];
  assert.deepEqual(t, { kotor: 625000, potongan: 25000, retur: 112500, hpp: 300000, qty: 4 });
  // Diulang tidak dobel.
  ok(await api("POST", "/api/laporan/rekap", { dari: hari, sampai: hari }));
  assert.equal(sql("SELECT SUM(kotor) AS k FROM rekap_harian")[0].k, 625000);
  const h = ok(await api("GET", `/api/laporan/harian?dari=${geser(-6)}&sampai=${hari}`)).baris;
  assert.deepEqual(h.map((x) => [x.tanggal, x.bersih, x.laba, x.offline, x.online, !!x.langsung]), [[hari, 487500, 187500, 237500, 250000, true]]);
});

test("keuangan per event: laba bersih, impas, uang diterima, per produk; bagi biaya umum", async () => {
  assert.equal((await api("GET", "/api/keuangan/event/" + ev, undefined, { cookie: adminCookie })).status, 403);
  let k = ok(await api("GET", "/api/keuangan/event/" + ev));
  // Laba kotor 57.500 − biaya 320.000 − kerugian 2.500 = −265.000
  assert.deepEqual([k.ringkasan.bersih, k.ringkasan.laba, k.ringkasan.biaya, k.ringkasan.kerugian, k.ringkasan.laba_bersih], [237500, 57500, 320000, 2500, -265000]);
  assert.deepEqual(k.biaya, [{ kategori: "Sewa booth", jumlah: 300000 }, { kategori: "Kas keluar laci", jumlah: 20000 }]);
  assert.equal(k.uang.setoran_tunai, 90000);
  assert.equal(k.indikator.barang_diretur, 1);
  assert.equal(k.indikator.lewat_impas, false);
  assert.equal(k.ringkasan.sell_through, 20); // 2 terjual bersih dari 10 diterima
  assert.deepEqual(k.produk.map((p) => [p.nama, p.diterima, p.qty, p.sisa]), [["Kaos", 10, 2, 7]]);
  assert.deepEqual(k.ukuran.map((u) => [u.ukuran, u.qty]), [["S", 2]]);
  ok(await api("PUT", "/api/pengaturan/keuangan", { bagi_biaya_umum: true }));
  k = ok(await api("GET", "/api/keuangan/event/" + ev));
  // 100.000 × 237.500 ÷ 487.500 = 48.718
  assert.equal(k.ringkasan.bagian_umum, 48718);
  assert.equal(k.ringkasan.laba_bersih, -265000 - 48718);
});

test("keuangan keseluruhan: laba rugi, arus kas, posisi", async () => {
  const k = ok(await api("GET", `/api/keuangan?dari=${hari}&sampai=${hari}`));
  assert.deepEqual([k.ringkasan.bersih, k.ringkasan.biaya_event, k.ringkasan.biaya_umum, k.ringkasan.kerugian, k.ringkasan.laba_bersih], [487500, 320000, 100000, 2500, -235000]);
  assert.deepEqual([k.arus_kas.masuk_total, k.arus_kas.keluar_total, k.ringkasan.arus_kas], [475000, 532500, -57500]);
  assert.equal(k.posisi.piutang_marketplace, 125000);
  assert.equal(k.posisi.kerugian_belum, 2500);
  // Persediaan: gudang (40 − 10 − 2) × 60.000, event 7 × 60.000
  assert.equal(k.posisi.persediaan_total, (28 + 7) * 60000);
  const fest = k.per_event.find((x) => x.nama === "Fest");
  assert.deepEqual([fest.laba_kotor, fest.biaya, fest.kerugian, fest.bagian_umum, fest.laba_bersih], [57500, 320000, 2500, 48718, -313718]);
  assert.equal(k.per_bulan.length, 1);
});
