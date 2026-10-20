// Uji tahap 4: event, tempat jualan per role, harga event, kirim/terima/tarik stok, opname, tutup event, kerugian.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib } from "../dist/aturan.js";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);
let owner, admin, adminPos, sari, sariPos, hp, ev, evDatang, kode;
const posOwner = {};

const sinkron = (dokumen) => api("POST", "/api/pos/sinkron", { dokumen }, { headers: hp, cookie: null });
const tarikSebagai = (h, lokasi = "") => api("GET", `/api/pos/tarik${lokasi ? "?lokasi=" + lokasi : ""}`, undefined, { headers: h, cookie: null });
const stok = (sku, lokasi) => sql("SELECT qty, transit FROM stok WHERE sku = ? AND lokasi_id = ?", sku, lokasi)[0] ?? { qty: 0, transit: 0 };

test("persiapan", async () => {
  owner = await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Kaos" }), 201).id;
  ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 50000, varian: [{ nama: "S", harga_jual: 110000, stok_awal: 20 }, { nama: "M", harga_jual: 110000, stok_awal: 10 }] }), 201);
  ok(await api("POST", "/api/produk", { nama: "Topi", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 5 }), 201);
  admin = ok(await api("POST", "/api/karyawan", { nama: "Dimas", email: "dimas@hikayat.id", role: ["admin", "kasir"], password: "dimas1234", pin: "222222" }), 201).id;
  sari = ok(await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" }), 201).id;
  const o = await siapkanHp(L, owner, "135790");
  hp = o.hp; Object.assign(posOwner, o.pos); kode = o.perangkat.kode;
  const m1 = ok(await api("POST", "/api/pos/masuk", { staff_id: admin, pin: "222222" }, { headers: hp, cookie: null }));
  adminPos = { ...hp, "x-sesi": m1.sesi };
  const m2 = ok(await api("POST", "/api/pos/masuk", { staff_id: sari, pin: "333333" }, { headers: hp, cookie: null }));
  sariPos = { ...hp, "x-sesi": m2.sesi };
});

test("buat event: validasi dan harga event", async () => {
  const dasar = { nama: "Hikayat Fest Bandung", venue: "Sabuga", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S", harga: 99000 }, { sku: "KB-M" }] };
  assert.equal((await api("POST", "/api/event", { ...dasar, varian: [] })).status, 400);
  assert.equal((await api("POST", "/api/event", { ...dasar, nama: "gudang pusat" })).status, 400);
  assert.equal((await api("POST", "/api/event", { ...dasar, selesai: geser(-5) })).status, 400);
  ev = ok(await api("POST", "/api/event", dasar), 201).id;
  assert.equal((await api("POST", "/api/event", dasar)).status, 409);
  evDatang = ok(await api("POST", "/api/event", { ...dasar, nama: "Kajian Akbar", mulai: geser(10), selesai: geser(10), presale_aktif: true, presale_mode: "stok", kasir: [] }), 201).id;
  ok(await api("POST", "/api/event", { ...dasar, nama: "Event Tutup Rapat", mulai: geser(5), selesai: geser(5), kasir: [] }), 201);
  const d = ok(await api("GET", "/api/event")).event;
  assert.deepEqual(d.map((e) => [e.nama, e.status]).sort(), [["Event Tutup Rapat", "Akan Datang"], ["Hikayat Fest Bandung", "Berlangsung"], ["Kajian Akbar", "Akan Datang"]]);
});

test("tempat jualan per role", async () => {
  const nama = async (h) => ok(await tarikSebagai(h)).tempat.map((t) => [t.nama, t.label, t.boleh_jual]);
  assert.deepEqual(await nama(sariPos), [["Hikayat Fest Bandung", "Berlangsung", true]]);
  // Admin mendapat Gudang Pusat hanya untuk serah terima pre-sale.
  assert.deepEqual(await nama(adminPos), [["Gudang Pusat", "Serah terima pre-sale", true], ["Hikayat Fest Bandung", "Berlangsung", true]]);
  assert.deepEqual(await nama(posOwner), [
    ["Gudang Pusat", "Jual langsung", true], ["Hikayat Fest Bandung", "Berlangsung", true], ["Event Tutup Rapat", "Belum mulai · pre-sale nonaktif", false], ["Kajian Akbar", "Pre-sale · stok langsung", true],
  ]);
  // Kasir yang tidak ditugaskan tidak melihat event.
  ok(await api("PATCH", `/api/event/${ev}`, { nama: "Hikayat Fest Bandung", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [admin], varian: [{ sku: "KB-S", harga: 99000 }, { sku: "KB-M" }] }));
  assert.deepEqual(await nama(sariPos), []);
  ok(await api("PATCH", `/api/event/${ev}`, { nama: "Hikayat Fest Bandung", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S", harga: 99000 }, { sku: "KB-M" }] }));
});

test("katalog event: hanya varian yang dipilih, harga event", async () => {
  const k = ok(await tarikSebagai(sariPos, ev));
  assert.deepEqual(k.varian.map((v) => [v.sku, v.harga, v.harga_normal]).sort(), [["KB-M", 110000, 110000], ["KB-S", 99000, 110000]]);
  assert.equal(k.lokasi.event.nama, "Hikayat Fest Bandung");
  // Mengubah form event membuat tarik berikutnya membawa katalog lengkap.
  ok(await api("PATCH", `/api/event/${ev}`, { nama: "Hikayat Fest Bandung", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S", harga: 95000 }, { sku: "KB-M" }, { sku: "TP" }] }));
  const lagi = ok(await api("GET", `/api/pos/tarik?lokasi=${ev}&sejak=${encodeURIComponent(k.waktu)}`, undefined, { headers: sariPos, cookie: null }));
  assert.equal(lagi.penuh, true);
  assert.equal(lagi.varian.find((v) => v.sku === "KB-S").harga, 95000);
  assert.equal((await tarikSebagai(sariPos, evDatang)).status, 403);
});

let mutasi;

test("kirim stok: gudang berkurang, barang dalam perjalanan", async () => {
  assert.equal((await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 99 }] })).status, 400);
  const r = ok(await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 10 }, { sku: "TP", qty: 4 }] }), 201);
  mutasi = r.id;
  assert.match(r.no, /^MT\/\d{6}\/0001$/);
  assert.deepEqual(stok("KB-S", "gudang"), { qty: 10, transit: 0 });
  assert.deepEqual(stok("KB-S", ev), { qty: 0, transit: 10 });
  assert.equal(ok(await tarikSebagai(sariPos, ev)).kiriman_menunggu, 1);
  const inv = ok(await api("GET", `/api/pos/inventori?lokasi=${ev}`, undefined, { headers: sariPos, cookie: null }));
  assert.equal(inv.mutasi[0].items.length, 2);
  assert.equal((await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-X", qty: 1 }] })).status, 400);
});

test("terima kiriman di POS: kurang dicatat sebagai kerugian kiriman", async () => {
  const doc = { id: mutasi, oleh: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", diterima: 10 }, { sku: "TP", diterima: 3 }] };
  assert.match(ok(await sinkron([{ jenis: "terima", data: doc }])).hasil[0].alasan, /catatan wajib/);
  assert.match(ok(await sinkron([{ jenis: "terima", data: { ...doc, items: [{ sku: "TP", diterima: 5 }], catatan: "x" } }])).hasil[0].alasan, /Diterima TP/);
  assert.equal(ok(await sinkron([{ jenis: "terima", data: { ...doc, catatan: "Satu topi tidak ada di kardus" } }])).hasil[0].status, "ok");
  assert.equal(ok(await sinkron([{ jenis: "terima", data: { ...doc, catatan: "lagi" } }])).hasil[0].status, "sudah");
  assert.deepEqual(stok("KB-S", ev), { qty: 10, transit: 0 });
  assert.deepEqual(stok("TP", ev), { qty: 3, transit: 0 });
  const k = sql("SELECT jenis, jumlah, pj_id FROM kerugian");
  assert.deepEqual(k, [{ jenis: "kiriman", jumlah: 15000, pj_id: sari }]);
});

let shift;

test("jual di event lalu tutup kasir dengan kas kurang", async () => {
  shift = ulid();
  const r = ok(await sinkron([
    { jenis: "shift_buka", data: { id: shift, lokasi_id: ev, kasir_id: sari, buka: new Date().toISOString(), modal: 100000 } },
    { jenis: "trx", data: { id: ulid(), no: `HK-261008-${kode}-0001`, shift_id: shift, kasir_id: sari, waktu: new Date().toISOString(),
      items: [{ sku: "KB-S", nama: "Kaos S", qty: 2, harga: 95000 }], subtotal: 190000, total: 190000, pembayaran: [{ metode: "Tunai", jumlah: 190000 }] } },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok"]);
  assert.equal(stok("KB-S", ev).qty, 8);
  assert.equal((await api("POST", `/api/event/${ev}/tutup`, {})).status, 400); // masih ada kasir terbuka
  const s = ok(await api("POST", "/api/pos/setujui", { staff_id: sari, pin: "333333", aksi: "tutup_kasir" }, { headers: hp, cookie: null }));
  const t = ok(await sinkron([{ jenis: "shift_tutup", data: { id: shift, tutup: new Date().toISOString(), kas_hitung: 280000, seharusnya: 290000,
    ditutup_oleh: sari, disetujui_oleh: sari, pj_id: sari, penjelasan: "Uang receh hilang", persetujuan: s.token } }]));
  assert.equal(t.hasil[0].status, "ok");
  assert.deepEqual(sql("SELECT jenis, jumlah FROM kerugian WHERE jenis = 'kas'"), [{ jenis: "kas", jumlah: 10000 }]);
});

let opPos;

test("opname dari POS, penghitung tidak bisa menyetujui sendiri, penjualan setelah opname tetap dihitung", async () => {
  opPos = ulid();
  // Sari menghitung: KB-S fisik 7 (sistem 8), TP 3 (sistem 3).
  ok(await sinkron([{ jenis: "opname", data: { id: opPos, lokasi_id: ev, oleh: sari, waktu: new Date().toISOString(), catatan: "Hitung sore",
    items: [{ sku: "KB-S", sistem: 8, fisik: 7 }, { sku: "TP", sistem: 3, fisik: 3 }] } }]));
  const daftar = ok(await api("GET", `/api/opname?lokasi=${ev}`)).opname;
  assert.equal(daftar[0].status, "Menunggu persetujuan");
  assert.equal(daftar[0].kurang, 1);
  // Opname kedua dari kasir menggantikan yang pertama.
  const opPos2 = ulid();
  ok(await sinkron([{ jenis: "opname", data: { id: opPos2, lokasi_id: ev, oleh: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", sistem: 8, fisik: 6 }, { sku: "TP", sistem: 3, fisik: 3 }] } }]));
  assert.equal(sql("SELECT status FROM opname WHERE id = ?", opPos)[0].status, "Diganti");
  opPos = opPos2;
  // Admin minta ulang, kasir kirim lagi, lalu disetujui.
  assert.equal((await api("POST", `/api/opname/${opPos}/ulang`, { alasan: "x" })).status, 400);
  ok(await api("POST", `/api/opname/${opPos}/ulang`, { alasan: "Kardus belakang belum dihitung" }));
  const opPos3 = ulid();
  ok(await sinkron([{ jenis: "opname", data: { id: opPos3, lokasi_id: ev, oleh: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", sistem: 8, fisik: 7 }, { sku: "TP", sistem: 3, fisik: 3 }] } }]));
  opPos = opPos3;
  // Ada penjualan 1 KB-S setelah opname dihitung.
  env().prepare("UPDATE stok SET qty = 7 WHERE sku = 'KB-S' AND lokasi_id = ?").run(ev);
  env().prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, waktu) VALUES (?, 'KB-S', ?, -1, 'jual', ?)").run(ulid(), ev, new Date().toISOString());
  assert.equal((await api("POST", `/api/opname/${opPos}/setujui`, {})).status, 400); // ada kurang: wajib pj + penjelasan
  ok(await api("POST", `/api/opname/${opPos}/setujui`, { pj_id: sari, penjelasan: "Satu kaos dicoba pembeli lalu hilang" }));
  assert.equal(stok("KB-S", ev).qty, 6); // 7 sekarang + (7 − 8)
  assert.equal(sql("SELECT jumlah FROM kerugian WHERE jenis = 'stok'")[0].jumlah, 50000);
});
const env = () => L.env.DB.raw;

test("Admin tidak bisa menyetujui opname hitungannya sendiri", async () => {
  const r = await api("POST", "/api/masuk", { email: "dimas@hikayat.id", password: "dimas1234" }, { cookie: null });
  const dimas = r.cookie;
  ok(await api("POST", "/api/ganti-password", { lama: "dimas1234", baru: "dimasbaru1" }, { cookie: dimas }));
  const id = ulid();
  ok(await sinkron([{ jenis: "opname", data: { id, lokasi_id: ev, oleh: admin, waktu: new Date().toISOString(), items: [{ sku: "TP", sistem: 3, fisik: 3 }] } }]));
  assert.equal((await api("POST", `/api/opname/${id}/setujui`, {}, { cookie: dimas })).status, 403);
  ok(await api("POST", `/api/opname/${id}/setujui`, {}));
});

test("tarik ke gudang", async () => {
  assert.equal((await api("POST", `/api/event/${ev}/tarik`, { item: [{ sku: "TP", qty: 9 }] })).status, 400);
  ok(await api("POST", `/api/event/${ev}/tarik`, { item: [{ sku: "TP", qty: 1 }] }), 201);
  assert.equal(stok("TP", ev).qty, 2);
  assert.equal(stok("TP", "gudang").qty, 2);
});

test("tutup event: opname akhir, kerugian, kiriman batal, sisa ke gudang", async () => {
  ok(await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-M", qty: 3 }] }), 201); // belum diterima
  const siap = ok(await api("GET", `/api/event/${ev}/tutup`));
  assert.equal(siap.kiriman.length, 1);
  assert.equal(siap.shift_terbuka.length, 0);
  const pendingId = ulid();
  ok(await sinkron([{ jenis: "opname", data: { id: pendingId, lokasi_id: ev, oleh: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", sistem: 6, fisik: 6 }] } }]));
  assert.match((await api("POST", `/api/event/${ev}/tutup`, {})).data.error, /menunggu persetujuan/);
  // KB-S fisik 4 (sistem 6): kerugian 2 × 50.000 wajib penanggung jawab.
  assert.equal((await api("POST", `/api/event/${ev}/tutup`, { opname_id: pendingId, fisik: { "KB-S": 4 } })).status, 400);
  const r = ok(await api("POST", `/api/event/${ev}/tutup`, { opname_id: pendingId, fisik: { "KB-S": 4 }, pj_id: sari, penjelasan: "Hilang saat bongkar booth" }));
  assert.equal(r.kerugian, 100000);
  assert.equal(r.kembali, 6);
  assert.deepEqual(stok("KB-S", ev), { qty: 0, transit: 0 });
  assert.deepEqual(stok("KB-M", ev), { qty: 0, transit: 0 });
  assert.equal(stok("KB-S", "gudang").qty, 14);
  assert.equal(stok("KB-M", "gudang").qty, 10);
  assert.equal(stok("TP", "gudang").qty, 4);
  assert.equal(sql("SELECT status FROM opname WHERE id = ?", pendingId)[0].status, "Disetujui");
  const d = ok(await api("GET", `/api/event/${ev}`));
  assert.equal(d.event.status, "Selesai");
  assert.match(d.event.tutup_catatan, /dihitung Sari, disetujui Rina Wijaya.*Kerugian Rp100\.000/);
  assert.equal(d.ringkasan.penjualan, 190000);
  // Event tertutup hilang dari POS.
  assert.ok(!ok(await tarikSebagai(posOwner)).tempat.some((t) => t.id === ev));
  assert.equal((await api("POST", `/api/event/${ev}/tutup`, {})).status, 400);
  // Buku besar tetap cocok dengan ringkasan stok di semua lokasi.
  const beda = sql(`SELECT s.sku, s.lokasi_id, s.qty, COALESCE((SELECT SUM(jumlah) FROM stok_gerak g WHERE g.sku = s.sku AND g.lokasi_id = s.lokasi_id), 0) AS gerak FROM stok s`).filter((x) => x.qty !== x.gerak);
  assert.deepEqual(beda, []);
});

test("Selisih & Kerugian: cicil, dibebankan hanya Owner", async () => {
  const d = ok(await api("GET", "/api/kerugian"));
  assert.deepEqual(d.kerugian.map((k) => k.jenis).sort(), ["kas", "kiriman", "stok", "stok"]);
  assert.equal(d.ringkasan.total, 15000 + 10000 + 50000 + 100000);
  const kas = d.kerugian.find((k) => k.jenis === "kas");
  assert.equal((await api("POST", `/api/kerugian/${kas.id}/selesaikan`, { jenis: "ganti", jumlah: 20000, cara: "Tunai" })).status, 400);
  ok(await api("POST", `/api/kerugian/${kas.id}/selesaikan`, { jenis: "ganti", jumlah: 4000, cara: "Potong gaji" }));
  const dimas = (await api("POST", "/api/masuk", { email: "dimas@hikayat.id", password: "dimasbaru1" }, { cookie: null })).cookie;
  assert.equal((await api("POST", `/api/kerugian/${kas.id}/selesaikan`, { jenis: "beban" }, { cookie: dimas })).status, 403);
  ok(await api("POST", `/api/kerugian/${kas.id}/selesaikan`, { jenis: "beban" }));
  const k = ok(await api("GET", "/api/kerugian")).kerugian.find((x) => x.id === kas.id);
  assert.equal(k.status, "Dibebankan perusahaan");
  assert.equal(k.sisa, 0);
  assert.deepEqual(k.riwayat.map((r) => [r.jenis, r.jumlah]), [["ganti", 4000], ["beban", 6000]]);
  assert.equal((await api("POST", `/api/kerugian/${kas.id}/selesaikan`, { jenis: "ganti", jumlah: 1, cara: "Tunai" })).status, 400);
});
