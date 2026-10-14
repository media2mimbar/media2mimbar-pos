// Uji tambahan POS (PRD 6.7–6.13): laporan di POS, riwayat masuk, opname disetujui dari HP, batal terima kiriman,
// retur tunai ditolak kalau laci kurang, tutup kasir lain dan tutup event dari HP oleh Owner.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib } from "../dist/aturan.js";
import { periodePos } from "../dist/pos-lanjut.js";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);
const kini = () => new Date().toISOString();
let owner, admin, sari, hp, kode, ev, ownerPos, sariPos, adminPos, mut, shift;
const sinkron = (dokumen) => api("POST", "/api/pos/sinkron", { dokumen }, { headers: hp, cookie: null });
const pos = (method, path, body, h) => api(method, path, body, { headers: h, cookie: null });
const setujui = async (staff_id, pin, aksi) => ok(await pos("POST", "/api/pos/setujui", { staff_id, pin, aksi }, hp)).token;
const stok = (sku, lok) => sql("SELECT qty, transit FROM stok WHERE sku = ? AND lokasi_id = ?", sku, lok)[0];
let nomor = 0;
const no = () => `HK-${hari.slice(2).replace(/-/g, "")}-${kode}-${String(++nomor).padStart(4, "0")}`;

test("periode Produk Terjual di POS", () => {
  assert.deepEqual(periodePos("kemarin", null, "2026-10-14"), { dari: "2026-10-13", sampai: "2026-10-13" });
  assert.deepEqual(periodePos("minggu", null, "2026-10-14"), { dari: "2026-10-12", sampai: "2026-10-14" });
  assert.deepEqual(periodePos("minggu_lalu", null, "2026-10-14"), { dari: "2026-10-05", sampai: "2026-10-11" });
  assert.deepEqual(periodePos("event", "2026-10-10", "2026-10-14"), { dari: "2026-10-10", sampai: "2026-10-14" });
});

test("persiapan", async () => {
  owner = await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Kaos" }), 201).id;
  ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 20 }] }), 201);
  admin = ok(await api("POST", "/api/karyawan", { nama: "Dimas", email: "dimas@hikayat.id", role: ["admin"], password: "dimas1234", pin: "222222" }), 201).id;
  sari = ok(await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" }), 201).id;
  ev = ok(await api("POST", "/api/event", { nama: "Fest", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S" }] }), 201).id;
  ok(await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 10 }] }), 201);
  mut = sql("SELECT id FROM mutasi")[0].id;
  const o = await siapkanHp(L, owner, "135790");
  hp = o.hp; ownerPos = o.pos; kode = o.perangkat.kode;
  sariPos = { ...hp, "x-sesi": ok(await pos("POST", "/api/pos/masuk", { staff_id: sari, pin: "333333" }, hp)).sesi };
  adminPos = { ...hp, "x-sesi": ok(await pos("POST", "/api/pos/masuk", { staff_id: admin, pin: "222222" }, hp)).sesi };
});

test("batal terima kiriman: stok kembali ke perjalanan, kerugian kiriman dihapus; ditolak kalau sudah terjual", async () => {
  ok(await sinkron([{ jenis: "terima", data: { id: mut, lokasi_id: ev, oleh: sari, waktu: kini(), catatan: "Kurang 2", items: [{ sku: "KB-S", diterima: 8 }] } }]));
  assert.deepEqual(stok("KB-S", ev), { qty: 8, transit: 0 });
  assert.equal(sql("SELECT COUNT(*) AS n FROM kerugian WHERE jenis = 'kiriman'")[0].n, 1);
  ok(await pos("POST", `/api/pos/mutasi/${mut}/batal-terima`, { alasan: "Salah hitung" }, sariPos));
  assert.deepEqual(stok("KB-S", ev), { qty: 0, transit: 10 });
  assert.equal(sql("SELECT COUNT(*) AS n FROM kerugian")[0].n, 0);
  assert.equal(sql("SELECT status FROM mutasi")[0].status, "Dikirim");
  ok(await sinkron([{ jenis: "terima", data: { id: mut, lokasi_id: ev, oleh: sari, waktu: kini() } }]));
  assert.deepEqual(stok("KB-S", ev), { qty: 10, transit: 0 });
  shift = ulid();
  ok(await sinkron([
    { jenis: "shift_buka", data: { id: shift, lokasi_id: ev, kasir_id: sari, buka: kini(), modal: 0 } },
    { jenis: "trx", data: { id: ulid(), no: no(), shift_id: shift, kasir_id: sari, waktu: kini(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 2, harga: 125000 }], subtotal: 250000, total: 250000, pembayaran: [{ metode: "QRIS", jumlah: 250000, ref: "1111" }] } },
  ]));
  assert.equal((await pos("POST", `/api/pos/mutasi/${mut}/batal-terima`, { alasan: "Coba lagi" }, sariPos)).status, 409);
});

test("retur uang kembali tunai ditolak kalau uang di laci tidak cukup", async () => {
  const t = sql("SELECT id FROM trx")[0].id;
  const tok = await setujui(admin, "222222", "retur");
  const r = ok(await sinkron([{ jenis: "retur", data: { id: ulid(), trx_id: t, lokasi_id: ev, shift_id: shift, oleh: sari, waktu: kini(), disetujui_oleh: admin, persetujuan: tok,
    cara: "Uang kembali", metode: "Tunai", alasan: "Sobek", items: [{ sku: "KB-S", qty: 1 }] } }]));
  assert.match(r.hasil[0].alasan, /Uang di laci tidak cukup/);
});

test("laporan di POS: laporan kasir per shift, produk terjual dan yang di-void", async () => {
  const tv = ulid();
  ok(await sinkron([
    { jenis: "trx", data: { id: tv, no: no(), shift_id: shift, kasir_id: sari, waktu: kini(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 125000 }], subtotal: 125000, total: 125000, pembayaran: [{ metode: "Tunai", jumlah: 125000 }] } },
    { jenis: "void", data: { id: tv, alasan: "Pembeli batal", oleh: owner, waktu: kini() } },
  ]));
  const d = ok(await pos("GET", `/api/pos/laporan?lokasi=${ev}&periode=hari`, undefined, sariPos));
  assert.deepEqual([d.shift.length, d.shift[0].kasir, d.shift[0].qris, d.shift[0].void_n], [1, "Sari", 250000, 1]);
  assert.deepEqual(d.produk.map((p) => [p.sku, p.qty, p.bersih]), [["KB-S", 2, 250000]]);
  assert.deepEqual(d.void.map((v) => [v.sku, v.qty]), [["KB-S", 1]]);
});

test("riwayat masuk di POS: kasir hanya miliknya, atasan semua", async () => {
  ok(await sinkron([{ jenis: "log", data: { id: ulid(), staff_id: sari, aksi: "Buka kasir", waktu: kini(), keterangan: "Fest" } }, { jenis: "log", data: { id: ulid(), staff_id: owner, aksi: "Keluar", waktu: kini() } }]));
  const s = ok(await pos("GET", "/api/pos/riwayat?periode=hari", undefined, sariPos));
  assert.equal(s.sendiri, true);
  assert.ok(s.riwayat.length && s.riwayat.every((x) => x.nama === "Sari"));
  const o = ok(await pos("GET", "/api/pos/riwayat?periode=7hari", undefined, ownerPos));
  assert.ok(o.riwayat.some((x) => x.nama === "Rina Wijaya") && o.riwayat.some((x) => x.nama === "Sari"));
});

test("opname disetujui dari HP oleh Admin; kasir ditolak", async () => {
  const oid = ulid();
  ok(await sinkron([{ jenis: "opname", data: { id: oid, lokasi_id: ev, oleh: sari, waktu: kini(), items: [{ sku: "KB-S", sistem: 8, fisik: 7 }] } }]));
  assert.equal((await pos("GET", "/api/pos/opname/" + oid, undefined, sariPos)).status, 403);
  const d = ok(await pos("GET", "/api/pos/opname/" + oid, undefined, adminPos));
  assert.deepEqual([d.opname.status, d.item[0].fisik, d.pj_bawaan], ["Menunggu persetujuan", 7, sari]);
  assert.match((await pos("POST", `/api/pos/opname/${oid}/setujui`, {}, adminPos)).data.error, /penanggung jawab/);
  const r = ok(await pos("POST", `/api/pos/opname/${oid}/setujui`, { pj_id: sari, penjelasan: "Hilang di booth" }, adminPos));
  assert.equal(r.kerugian, 60000);
  assert.equal(stok("KB-S", ev).qty, 7);
});

test("tutup event dari HP: khusus Owner, tutup kasir lain dulu, lalu event ditutup", async () => {
  assert.equal((await pos("GET", `/api/pos/event/${ev}/tutup`, undefined, adminPos)).status, 403);
  let d = ok(await pos("GET", `/api/pos/event/${ev}/tutup`, undefined, ownerPos));
  assert.deepEqual(d.shift_terbuka.map((s) => [s.kasir, s.kasir_id]), [["Sari", sari]]);
  assert.match((await pos("POST", `/api/pos/event/${ev}/tutup`, {}, ownerPos)).data.error, /kasir terbuka/);
  // Owner menutup laci Sari dengan PIN Owner.
  const tt = await setujui(owner, "135790", "tutup_kasir");
  ok(await sinkron([{ jenis: "shift_tutup", data: { id: shift, tutup: kini(), kas_hitung: 0, seharusnya: 0, ditutup_oleh: owner, disetujui_oleh: owner, persetujuan: tt } }]));
  assert.deepEqual(sql("SELECT status, kasir_id, ditutup_oleh FROM shift")[0], { status: "tutup", kasir_id: sari, ditutup_oleh: owner });
  d = ok(await pos("GET", `/api/pos/event/${ev}/tutup`, undefined, ownerPos));
  assert.equal(d.shift_terbuka.length, 0);
  const r = ok(await pos("POST", `/api/pos/event/${ev}/tutup`, { fisik: { "KB-S": 7 } }, ownerPos));
  assert.deepEqual([r.kerugian, r.kembali], [0, 7]);
  assert.equal(sql("SELECT ditutup FROM event")[0].ditutup, 1);
});
