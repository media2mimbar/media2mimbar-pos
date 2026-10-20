// Uji tahap 3: pengaturan POS, foto QRIS di D1, harga gudang, tarik data, sinkron shift/kas/transaksi, tutup kasir.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
let owner, hp, pos, kode;

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test("persiapan: owner, produk, HP", async () => {
  owner = await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Kaos" }), 201).id;
  ok(await api("POST", "/api/produk", { nama: "Totebag", sku: "TOT", kategori_id: kat, hpp: 20000, harga_jual: 45000, stok_awal: 10 }), 201);
  ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 110000, stok_awal: 5 }, { nama: "M", harga_jual: 110000 }] }), 201);
  ({ hp, pos, perangkat: { kode } } = await siapkanHp(L, owner, "135790"));
  assert.equal(kode, "A1");
});

test("pengaturan POS dan gambar QRIS", async () => {
  const awal = ok(await api("GET", "/api/pengaturan/pos")).pengaturan;
  assert.equal(awal.kunci_menit, 20);
  assert.equal((await api("POST", "/api/berkas?jenis=qris", new Uint8Array([1, 2, 3]))).status, 415);
  const b = ok(await api("POST", "/api/berkas?jenis=qris", png), 201);
  const baru = { ...awal, qris: { nama: "HIKAYAT", nmid: "ID123", berkas_id: b.id }, rekening: [{ bank: "BCA", no: "123", nama: "PT Hikayat" }], pembulatan: 500, pajak: { aktif: true, persen: 11 } };
  delete baru.diubah_pada;
  ok(await api("PUT", "/api/pengaturan/pos", baru));
  assert.equal((await api("PUT", "/api/pengaturan/pos", { ...baru, pembulatan: 250 })).status, 400);
  assert.equal((await api("PUT", "/api/pengaturan/pos", { ...baru, rekening: [] })).status, 400);
  // HP mengambil gambar QRIS dengan token perangkat; tanpa token ditolak.
  const g = await api("GET", `/api/pos/berkas/${b.id}`, undefined, { headers: hp, cookie: null });
  assert.equal(g.status, 200);
  assert.equal(g.headers.get("content-type"), "image/png");
  assert.deepEqual([...g.data], [...png]);
  assert.equal((await api("GET", `/api/pos/berkas/${b.id}`, undefined, { cookie: null })).status, 401);
});

test("harga jual langsung gudang dan tarik data POS", async () => {
  ok(await api("PUT", "/api/harga-saluran/gudang", { harga: { TOT: 42000 } }));
  assert.deepEqual(ok(await api("GET", "/api/harga-saluran/gudang")).harga, { TOT: 42000 });
  const t = ok(await api("GET", "/api/pos/tarik", undefined, { headers: pos, cookie: null }));
  assert.deepEqual(t.tempat.map((x) => [x.id, x.label, x.shift_terbuka]), [["gudang", "Jual langsung", null]]);
  assert.equal(t.pengaturan.pembulatan, 500);
  const k = ok(await api("GET", "/api/pos/tarik?lokasi=gudang", undefined, { headers: pos, cookie: null }));
  assert.equal(k.penuh, true);
  assert.equal(k.varian.find((v) => v.sku === "TOT").harga, 42000);
  assert.equal(k.varian.find((v) => v.sku === "KB-S").harga, 110000);
  assert.deepEqual(Object.fromEntries(k.stok.map((s) => [s.sku, s.qty])), { TOT: 10, "KB-S": 5 });
  // Tarik berikutnya hanya membawa yang berubah.
  const lagi = ok(await api("GET", `/api/pos/tarik?lokasi=gudang&sejak=${encodeURIComponent(k.waktu)}`, undefined, { headers: pos, cookie: null }));
  assert.deepEqual([lagi.produk.length, lagi.varian.length, lagi.stok.length], [0, 0, 0]);
});

test("Kasir tidak bisa jual di Gudang Pusat", async () => {
  const k = ok(await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" }), 201);
  const m = ok(await api("POST", "/api/pos/masuk", { staff_id: k.id, pin: "333333" }, { headers: hp, cookie: null }));
  const s = { ...hp, "x-sesi": m.sesi };
  assert.deepEqual(ok(await api("GET", "/api/pos/tarik", undefined, { headers: s, cookie: null })).tempat, []);
  assert.equal((await api("GET", "/api/pos/tarik?lokasi=gudang", undefined, { headers: s, cookie: null })).status, 403);
});

const shiftId = ulid();
const trxId = ulid();
const sinkron = (dokumen, headers = hp) => api("POST", "/api/pos/sinkron", { dokumen }, { headers, cookie: null });

const trxContoh = (o = {}) => ({
  id: trxId, no: `HK-261008-${kode}-0001`, shift_id: shiftId, kasir_id: owner, waktu: new Date().toISOString(),
  items: [{ sku: "TOT", nama: "Totebag", qty: 2, harga: 42000 }, { sku: "KB-S", nama: "Kaos · S", qty: 1, harga: 110000 }],
  subtotal: 194000, diskon: 0, pajak: 21340, pembulatan: 340, total: 215000,
  pembayaran: [{ metode: "QRIS", jumlah: 100000, ref: "4821" }, { metode: "Tunai", jumlah: 120000 }],
  ...o,
});

test("sinkron: buka shift, kas keluar, transaksi campuran", async () => {
  const r = ok(await sinkron([
    { jenis: "shift_buka", data: { id: shiftId, lokasi_id: "gudang", kasir_id: owner, buka: new Date().toISOString(), modal: 200000 } },
    { jenis: "kas", data: { id: ulid(), shift_id: shiftId, jenis: "keluar", jumlah: 15000, catatan: "Beli air", waktu: new Date().toISOString(), oleh: owner } },
    { jenis: "trx", data: trxContoh() },
    { jenis: "log", data: { id: ulid(), staff_id: owner, aksi: "Buka kasir", waktu: new Date().toISOString() } },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok", "ok", "ok"]);
  assert.deepEqual(sql("SELECT sku, qty FROM stok WHERE lokasi_id = 'gudang' ORDER BY sku"), [{ sku: "KB-S", qty: 4 }, { sku: "TOT", qty: 8 }]);
  const t = sql("SELECT metode, dibayar, kembalian, total FROM trx WHERE id = ?", trxId)[0];
  assert.deepEqual(t, { metode: "Campuran", dibayar: 220000, kembalian: 5000, total: 215000 });
  assert.equal(sql("SELECT hpp FROM trx_item WHERE sku = 'TOT'")[0].hpp, 20000);
  // Tempat sekarang punya kasir terbuka.
  const tempat = ok(await api("GET", "/api/pos/tarik", undefined, { headers: pos, cookie: null })).tempat;
  assert.equal(tempat[0].shift_terbuka.id, shiftId);
});

test("sinkron: kiriman ganda tidak tercatat dua kali", async () => {
  const r = ok(await sinkron([{ jenis: "trx", data: trxContoh() }]));
  assert.equal(r.hasil[0].status, "sudah");
  assert.equal(sql("SELECT COUNT(*) AS n FROM trx")[0].n, 1);
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'TOT'")[0].qty, 8);
});

test("sinkron: dokumen tidak wajar ditolak dan disimpan untuk diperiksa", async () => {
  const r = ok(await sinkron([
    { jenis: "trx", data: trxContoh({ id: ulid(), no: `HK-261008-${kode}-0002`, total: 1 }) },
    { jenis: "trx", data: trxContoh({ id: ulid(), no: `HK-261008-${kode}-0003`, pembayaran: [{ metode: "QRIS", jumlah: 215000 }] }) },
    { jenis: "trx", data: trxContoh({ id: ulid(), no: `HK-261008-${kode}-0001` }) },
    { jenis: "trx", data: trxContoh({ id: ulid(), no: `HK-261008-${kode}-0004`, items: [{ sku: "TIDAK-ADA", nama: "x", qty: 1, harga: 194000 }] }) },
    { jenis: "hapus_semua", data: {} },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ditolak", "ditolak", "ditolak", "ditolak", "ditolak"]);
  assert.match(r.hasil[0].alasan, /Total tidak cocok/);
  assert.match(r.hasil[1].alasan, /4 digit/);
  assert.match(r.hasil[2].alasan, /sudah dipakai/);
  const d = ok(await api("GET", "/api/dokumen-ditolak")).ditolak;
  assert.equal(d.length, 5);
  ok(await api("POST", `/api/dokumen-ditolak/${d[0].id}/selesai`, {}));
  assert.equal(ok(await api("GET", "/api/dokumen-ditolak")).ditolak.length, 4);
  // Stok tidak berubah oleh kiriman yang ditolak.
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'TOT'")[0].qty, 8);
});

test("ringkasan shift dan tutup kasir dengan persetujuan PIN", async () => {
  const r = ok(await api("GET", `/api/pos/shift/${shiftId}`, undefined, { headers: pos, cookie: null })).ringkasan;
  // Seharusnya = modal 200.000 + tunai (120.000 − kembalian 5.000) − kas keluar 15.000
  assert.equal(r.seharusnya, 300000);
  assert.equal(r.qris, 100000);
  assert.equal(r.total, 215000);

  const tutup = { id: shiftId, tutup: new Date().toISOString(), kas_hitung: 290000, seharusnya: 300000, ditutup_oleh: owner, disetujui_oleh: owner };
  let h = ok(await sinkron([{ jenis: "shift_tutup", data: tutup }]));
  assert.match(h.hasil[0].alasan, /penanggung jawab/);
  h = ok(await sinkron([{ jenis: "shift_tutup", data: { ...tutup, pj_id: owner, penjelasan: "Uang kembalian salah hitung" } }]));
  assert.match(h.hasil[0].alasan, /persetujuan PIN/);

  assert.equal((await api("POST", "/api/pos/setujui", { staff_id: owner, pin: "000000", aksi: "tutup_kasir" }, { headers: hp, cookie: null })).status, 401);
  const s = ok(await api("POST", "/api/pos/setujui", { staff_id: owner, pin: "135790", aksi: "tutup_kasir" }, { headers: hp, cookie: null }));
  const isi = { ...tutup, pj_id: owner, penjelasan: "Uang kembalian salah hitung", persetujuan: s.token };
  assert.equal(ok(await sinkron([{ jenis: "shift_tutup", data: isi }])).hasil[0].status, "ok");
  assert.equal(ok(await sinkron([{ jenis: "shift_tutup", data: isi }])).hasil[0].status, "sudah");

  const daftar = ok(await api("GET", "/api/shift")).shift;
  assert.equal(daftar[0].status, "tutup");
  assert.equal(daftar[0].seharusnya, 300000);
  assert.equal(daftar[0].selisih, -10000);
  assert.equal(daftar[0].pj, "Rina Wijaya");
  // Token tidak bisa dipakai lagi.
  const shift2 = ulid();
  ok(await sinkron([{ jenis: "shift_buka", data: { id: shift2, lokasi_id: "gudang", kasir_id: owner, buka: new Date().toISOString(), modal: 0 } }]));
  const ulang = ok(await sinkron([{ jenis: "shift_tutup", data: { ...isi, id: shift2, kas_hitung: 0, seharusnya: 0 } }]));
  assert.match(ulang.hasil[0].alasan, /tidak sah/);
  // Tutup offline (PIN dicek di HP) diterima dan ditandai.
  assert.equal(ok(await sinkron([{ jenis: "shift_tutup", data: { ...tutup, id: shift2, kas_hitung: 0, seharusnya: 0, offline: true } }])).hasil[0].status, "ok");
  assert.equal(sql("SELECT offline FROM shift WHERE id = ?", shift2)[0].offline, 1);
});

test("dashboard: daftar dan detail transaksi", async () => {
  const d = ok(await api("GET", "/api/transaksi"));
  assert.equal(d.ringkasan.jumlah, 1);
  assert.equal(d.transaksi[0].ref_qris, "4821");
  assert.equal(d.transaksi[0].perangkat, "A1");
  const t = ok(await api("GET", `/api/transaksi/${trxId}`));
  assert.equal(t.items.length, 2);
  assert.equal(t.pembayaran[0].ref, "4821");
  const p = ok(await api("GET", `/api/pos/penjualan?shift=${shiftId}`, undefined, { headers: pos, cookie: null })).trx;
  assert.equal(p[0].items.length, 2);
});
