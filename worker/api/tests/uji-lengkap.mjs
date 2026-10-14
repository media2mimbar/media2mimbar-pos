// Uji tahap 5: rumus promo, kelola promo, promo di transaksi, pelanggan, pre-sale (serah, ambil di gudang, refund),
// void, retur barang cacat, stok terbuang.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib } from "../dist/aturan.js";
import { infoBonus, infoPaket, kurang, memenuhi, potongan, promoBerlaku, terbaikOtomatis } from "../dist/promo.js";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);

const dasarPromo = { cakupan: "produk", jenis: "persen", besar: 0, maks_potongan: 0, min_belanja: 0, min_qty: 0, kelipatan: false, auto: false, kasir_ubah: false,
  kasir_maks_persen: 0, bonus_qty: 0, harga_paket: 0, lokasi_id: null, mulai: "2026-01-01", selesai: "2026-12-31", jam_mulai: "00:00", jam_selesai: "23:59",
  hari: [0, 1, 2, 3, 4, 5, 6], status: "Aktif", syarat: [], bonus: [], paket: [] };
const P = (o) => ({ ...dasarPromo, id: "x", nama: "x", ...o });
const it = (produk_id, qty, harga, sku = produk_id) => ({ sku, produk_id, qty, harga });

test("rumus promo sama dengan skenario prototipe", () => {
  // Skenario 39: 2 Jersey L Rp175.000 → Belanja Rp300 ribu 10% maks Rp50.000 = Rp35.000
  const belanja = P({ cakupan: "total", jenis: "persen", besar: 10, maks_potongan: 50000, min_belanja: 300000, auto: true });
  assert.equal(potongan(belanja, [it("JER", 2, 175000)]), 35000);
  assert.equal(potongan(belanja, [it("JER", 1, 175000)]), 0);
  assert.equal(kurang(belanja, [it("KB", 1, 125000)], (x) => x), "Kurang belanja Rp 175.000");
  // Skenario 43: Hemat Kaos min 2 pcs → "Kurang 1 pcs Kaos Burtuqol"
  const hemat = P({ jenis: "persen", besar: 10, min_qty: 2, syarat: ["KB"] });
  assert.equal(kurang(hemat, [it("KB", 1, 125000)], () => "Kaos Burtuqol"), "Kurang 1 pcs Kaos Burtuqol");
  assert.equal(potongan(hemat, [it("KB", 2, 125000), it("TOT", 1, 45000)]), 25000);
  // Skenario 49: beli 2 Jersey gratis 1 Topi → potongan harga Topi Rp35.000
  const bonus = P({ jenis: "bonus", min_qty: 2, syarat: ["JER"], bonus: ["TOPI"], bonus_qty: 1, kelipatan: true });
  assert.equal(infoBonus(bonus, [it("JER", 2, 175000)]).perlu, 1);
  assert.equal(potongan(bonus, [it("JER", 2, 175000), it("TOPI", 1, 35000)]), 35000);
  assert.equal(potongan(bonus, [it("JER", 4, 175000), it("TOPI", 2, 35000)]), 70000); // kelipatan
  // Produk bonus sama dengan yang dibeli: beli 2 gratis 1, satu set = 3 pcs
  const sama = P({ jenis: "bonus", min_qty: 2, syarat: ["KP"], bonus: ["KP"], bonus_qty: 1 });
  assert.equal(potongan(sama, [it("KP", 3, 35000)]), 35000);
  assert.equal(potongan(sama, [it("KP", 2, 35000)]), 0);
  // Skenario 50: Tumbler + Totebag paket Rp110.000 → hemat Rp15.000
  const paket = P({ jenis: "bundling", paket: ["TUM", "TOT"], harga_paket: 110000 });
  assert.deepEqual(infoPaket(paket, [it("TUM", 1, 80000)]).kurang, ["TOT"]);
  assert.equal(potongan(paket, [it("TUM", 1, 80000), it("TOT", 1, 45000)]), 15000);
  assert.equal(potongan(paket, [it("TUM", 2, 80000), it("TOT", 2, 45000)]), 15000); // tanpa kelipatan: satu paket
  // Potongan Rp per kelipatan: Rp10.000 setiap Rp100.000
  const lipat = P({ cakupan: "total", jenis: "nominal", besar: 10000, min_belanja: 100000, kelipatan: true });
  assert.equal(potongan(lipat, [it("A", 1, 250000)]), 20000);
  // Kasir boleh ubah persen, dibatasi
  const ubah = P({ cakupan: "total", jenis: "persen", besar: 5, kasir_ubah: true, kasir_maks_persen: 15 });
  assert.equal(potongan(ubah, [it("A", 1, 100000)], 50), 15000);
  // Otomatis: potongan terbesar
  assert.equal(terbaikOtomatis([belanja, { ...hemat, auto: true }], [it("KB", 3, 125000)]).id, "x");
  assert.equal(memenuhi(hemat, []), false);
  // Berlaku: hari dan jam
  assert.equal(promoBerlaku(P({ hari: [1], jam_mulai: "10:00", jam_selesai: "12:00" }), "gudang", { tanggal: "2026-10-12", jam: "11:00", hari: 1 }), true);
  assert.equal(promoBerlaku(P({ hari: [1], jam_mulai: "10:00", jam_selesai: "12:00" }), "gudang", { tanggal: "2026-10-12", jam: "13:00", hari: 1 }), false);
  assert.equal(promoBerlaku(P({ lokasi_id: "ev1" }), "gudang", { tanggal: "2026-10-12", jam: "11:00", hari: 1 }), false);
});

let owner, admin, sari, hp, kode, sariPos, ownerPos, kaos, topi, ev, evPre;
const sinkron = (dokumen) => api("POST", "/api/pos/sinkron", { dokumen }, { headers: hp, cookie: null });
const stok = (sku, lok) => sql("SELECT qty FROM stok WHERE sku = ? AND lokasi_id = ?", sku, lok)[0]?.qty ?? 0;
const setujui = async (staff_id, pin, aksi) => ok(await api("POST", "/api/pos/setujui", { staff_id, pin, aksi }, { headers: hp, cookie: null })).token;
let nomor = 0;
const no = () => `HK-261013-${kode}-${String(++nomor).padStart(4, "0")}`;

test("persiapan: produk, event berlangsung dan event pre-sale", async () => {
  owner = await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Merch" }), 201).id;
  kaos = ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 30 }, { nama: "M", harga_jual: 125000, stok_awal: 30 }] }), 201).id;
  topi = ok(await api("POST", "/api/produk", { nama: "Topi", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 20 }), 201).id;
  admin = ok(await api("POST", "/api/karyawan", { nama: "Dimas", email: "dimas@hikayat.id", role: ["admin"], password: "dimas1234", pin: "222222" }), 201).id;
  sari = ok(await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" }), 201).id;
  ev = ok(await api("POST", "/api/event", { nama: "Fest", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S" }, { sku: "KB-M" }, { sku: "TP" }] }), 201).id;
  evPre = ok(await api("POST", "/api/event", { nama: "Kajian", mulai: geser(10), selesai: geser(10), pj_id: sari, kasir: [], presale_aktif: true, presale_mode: "ambil", varian: [{ sku: "KB-S", harga: 115000 }] }), 201).id;
  ok(await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 10 }, { sku: "TP", qty: 10 }] }), 201);
  const o = await siapkanHp(L, owner, "135790");
  hp = o.hp; ownerPos = o.pos; kode = o.perangkat.kode;
  const m = ok(await api("POST", "/api/pos/masuk", { staff_id: sari, pin: "333333" }, { headers: hp, cookie: null }));
  sariPos = { ...hp, "x-sesi": m.sesi };
  const mut = sql("SELECT id FROM mutasi")[0].id;
  ok(await sinkron([{ jenis: "terima", data: { id: mut, lokasi_id: ev, oleh: sari, waktu: new Date().toISOString() } }]));
  assert.equal(stok("KB-S", ev), 10);
});

let promoTopi;

test("kelola promo: validasi dan tampil di POS", async () => {
  const dasar = { nama: "Beli 2 Kaos gratis Topi", cakupan: "produk", jenis: "bonus", min_qty: 2, syarat: [kaos], bonus: [topi], bonus_qty: 1, mulai: geser(-1), selesai: geser(5) };
  assert.equal((await api("POST", "/api/promo", { ...dasar, bonus: [] })).status, 400);
  promoTopi = ok(await api("POST", "/api/promo", dasar), 201).id;
  assert.match((await api("POST", "/api/promo", { nama: "Paket", cakupan: "produk", jenis: "bundling", paket: [kaos, topi], harga_paket: 170000, mulai: geser(-1), selesai: geser(5) })).data.error, /lebih murah dari Rp160\.000/);
  ok(await api("POST", "/api/promo", { nama: "Paket", cakupan: "produk", jenis: "bundling", paket: [kaos, topi], harga_paket: 150000, mulai: geser(-1), selesai: geser(5) }), 201);
  assert.equal((await api("POST", "/api/promo", { nama: "Persen", cakupan: "total", jenis: "persen", besar: 120, mulai: geser(-1), selesai: geser(5) })).status, 400);
  ok(await api("POST", "/api/promo", { nama: "Draf", cakupan: "total", jenis: "nominal", besar: 5000, mulai: geser(-1), selesai: geser(5), status: "Draf" }), 201);
  ok(await api("POST", "/api/promo", { nama: "Terjadwal", cakupan: "total", jenis: "nominal", besar: 5000, mulai: geser(3), selesai: geser(5) }), 201);
  ok(await api("POST", "/api/promo", { nama: "Khusus Kajian", cakupan: "total", jenis: "nominal", besar: 5000, mulai: geser(-1), selesai: geser(20), lokasi_id: evPre }), 201);
  const d = ok(await api("GET", "/api/promo")).promo;
  assert.deepEqual(Object.fromEntries(d.map((p) => [p.nama, p.status_tampil])), { "Beli 2 Kaos gratis Topi": "Aktif", Paket: "Aktif", Draf: "Draf", Terjadwal: "Terjadwal", "Khusus Kajian": "Aktif" });
  const k = ok(await api("GET", `/api/pos/tarik?lokasi=${ev}`, undefined, { headers: sariPos, cookie: null }));
  assert.deepEqual(k.promo.map((p) => p.nama).sort(), ["Beli 2 Kaos gratis Topi", "Paket", "Terjadwal"]); // jadwal disaring di HP
});

let shift, trxPromo;

test("transaksi dengan promo dan pelanggan; potongan dicek ulang di server", async () => {
  shift = ulid();
  const pel = ulid();
  trxPromo = ulid();
  const items = [{ sku: "KB-S", nama: "Kaos S", qty: 2, harga: 125000 }, { sku: "TP", nama: "Topi", qty: 1, harga: 35000, bonus: 1 }];
  const r = ok(await sinkron([
    { jenis: "shift_buka", data: { id: shift, lokasi_id: ev, kasir_id: sari, buka: new Date().toISOString(), modal: 100000 } },
    { jenis: "pelanggan", data: { id: pel, nama: "Fajar", telp: "081234567890", oleh: sari } },
    { jenis: "trx", data: { id: trxPromo, no: no(), shift_id: shift, kasir_id: sari, waktu: new Date().toISOString(), items, subtotal: 285000, diskon: 35000, promo: "Beli 2 Kaos gratis Topi",
      promo_id: promoTopi, total: 250000, pembayaran: [{ metode: "Tunai", jumlah: 250000 }], pelanggan_id: pel, pelanggan_nama: "Fajar", pelanggan_telp: "081234567890" } },
    // Potongan tidak cocok dengan promo: tetap diterima, ditandai.
    { jenis: "trx", data: { id: ulid(), no: no(), shift_id: shift, kasir_id: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 125000 }],
      subtotal: 125000, diskon: 50000, promo_id: promoTopi, total: 75000, pembayaran: [{ metode: "Tunai", jumlah: 75000 }] } },
    // Diskon manual kasir melebihi batas 10%.
    { jenis: "trx", data: { id: ulid(), no: no(), shift_id: shift, kasir_id: sari, waktu: new Date().toISOString(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 125000 }],
      subtotal: 125000, diskon: 25000, promo_id: "manual", promo_persen: 20, total: 100000, pembayaran: [{ metode: "Tunai", jumlah: 100000 }] } },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok", "ok", "ok", "ok"]);
  assert.deepEqual(sql("SELECT potongan_cek FROM trx ORDER BY no").map((x) => x.potongan_cek), [null, 0, 12500]);
  assert.equal(sql("SELECT bonus FROM trx_item WHERE sku = 'TP'")[0].bonus, 1);
  assert.equal(stok("TP", ev), 9); // barang gratis tetap mengurangi stok
  const p = ok(await api("GET", "/api/pos/pelanggan?q=0812", undefined, { headers: sariPos, cookie: null })).pelanggan;
  assert.equal(p[0].nama, "Fajar");
  const d = ok(await api("GET", "/api/promo")).promo.find((x) => x.id === promoTopi);
  assert.equal(d.dipakai, 2);
});

test("void: kasir butuh PIN atasan, stok kembali", async () => {
  const t = sql("SELECT id FROM trx ORDER BY no")[2].id;
  const doc = { id: t, oleh: sari, waktu: new Date().toISOString(), alasan: "Salah input", disetujui_oleh: sari };
  assert.match(ok(await sinkron([{ jenis: "void", data: { ...doc, alasan: "Iseng" } }])).hasil[0].alasan, /Alasan void/);
  assert.match(ok(await sinkron([{ jenis: "void", data: doc }])).hasil[0].alasan, /persetujuan PIN/);
  const tokenSari = await setujui(sari, "333333", "void");
  assert.match(ok(await sinkron([{ jenis: "void", data: { ...doc, persetujuan: tokenSari } }])).hasil[0].alasan, /Admin atau Owner/);
  const token = await setujui(admin, "222222", "void");
  const sebelum = stok("KB-S", ev);
  assert.equal(ok(await sinkron([{ jenis: "void", data: { ...doc, disetujui_oleh: admin, persetujuan: token } }])).hasil[0].status, "ok");
  assert.equal(stok("KB-S", ev), sebelum + 1);
  assert.deepEqual(sql("SELECT status, void_alasan, void_disetujui FROM trx WHERE id = ?", t)[0], { status: "Void", void_alasan: "Salah input", void_disetujui: admin });
});

test("retur barang cacat: uang kembali tunai mengurangi laci, tukar barang mengurangi stok", async () => {
  const doc = { trx_id: trxPromo, lokasi_id: ev, shift_id: shift, oleh: sari, waktu: new Date().toISOString(), alasan: "Jahitan lepas", disetujui_oleh: admin };
  const t1 = await setujui(admin, "222222", "retur");
  assert.match(ok(await sinkron([{ jenis: "retur", data: { ...doc, id: ulid(), cara: "Uang kembali", metode: "Tunai", items: [{ sku: "KB-S", qty: 3 }], persetujuan: t1 } }])).hasil[0].alasan, /Jumlah KB-S/);
  const t2 = await setujui(admin, "222222", "retur");
  ok(await sinkron([{ jenis: "retur", data: { ...doc, id: ulid(), cara: "Uang kembali", metode: "Tunai", items: [{ sku: "KB-S", qty: 1 }], persetujuan: t2 } }]));
  // Nilai = 125.000 × (250.000 ÷ 285.000) = 109.649
  assert.equal(sql("SELECT nilai, no FROM retur")[0].nilai, 109649);
  assert.match(sql("SELECT no FROM retur")[0].no, /^RTR-261013-A1-0001-1$/);
  const r = ok(await api("GET", `/api/pos/shift/${shift}`, undefined, { headers: sariPos, cookie: null })).ringkasan;
  assert.equal(r.retur_tunai, 109649);
  assert.equal(r.seharusnya, 100000 + 250000 + 75000 - 109649);
  const sebelum = stok("KB-S", ev);
  const t3 = await setujui(admin, "222222", "retur");
  ok(await sinkron([{ jenis: "retur", data: { ...doc, id: ulid(), cara: "Tukar barang", items: [{ sku: "KB-S", qty: 1 }], persetujuan: t3 } }]));
  assert.equal(stok("KB-S", ev), sebelum - 1);
  // Sudah diretur: tidak bisa void, tidak bisa retur lebih dari dibeli.
  assert.match(ok(await sinkron([{ jenis: "void", data: { id: trxPromo, oleh: owner, waktu: new Date().toISOString(), alasan: "Salah input" } }])).hasil[0].alasan, /sudah diretur/);
  const t4 = await setujui(admin, "222222", "retur");
  assert.match(ok(await sinkron([{ jenis: "retur", data: { ...doc, id: ulid(), cara: "Tukar barang", items: [{ sku: "KB-S", qty: 1 }], persetujuan: t4 } }])).hasil[0].alasan, /Jumlah KB-S/);
  const p = ok(await api("GET", `/api/pos/penjualan?shift=${shift}`, undefined, { headers: sariPos, cookie: null })).trx.find((x) => x.id === trxPromo);
  assert.equal(p.retur.length, 2);
});

let pre1, pre2, pre3, shiftPre;

test("pre-sale ambil nanti: stok tidak berkurang, serah di booth", async () => {
  shiftPre = ulid();
  const isi = (id) => ({ id, no: no(), shift_id: shiftPre, kasir_id: owner, waktu: new Date().toISOString(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 115000 }],
    subtotal: 115000, total: 115000, pembayaran: [{ metode: "Transfer", jumlah: 115000 }], presale: true, pelanggan_nama: "Umar", pelanggan_telp: "087777667766" });
  pre1 = ulid(); pre2 = ulid(); pre3 = ulid();
  const r = ok(await sinkron([
    { jenis: "shift_buka", data: { id: shiftPre, lokasi_id: evPre, kasir_id: owner, buka: new Date().toISOString(), modal: 0 } },
    { jenis: "trx", data: isi(pre1) }, { jenis: "trx", data: isi(pre2) }, { jenis: "trx", data: isi(pre3) },
    { jenis: "trx", data: { ...isi(ulid()), pelanggan_telp: null } },
  ]));
  assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok", "ok", "ok", "ditolak"]);
  assert.equal(stok("KB-S", evPre), 0);
  const q = ok(await api("GET", `/api/pos/trx/${pre1}`, undefined, { headers: ownerPos, cookie: null })).trx;
  assert.equal(q.ambil, "Menunggu");
  // Event mulai, stok dikirim, barang diserahkan dengan QR.
  L.env.DB.raw.prepare("UPDATE event SET mulai = ? WHERE id = ?").run(hari, evPre);
  ok(await api("POST", `/api/event/${evPre}/kirim`, { item: [{ sku: "KB-S", qty: 2 }] }), 201);
  const mut = sql("SELECT id FROM mutasi WHERE ke = ?", evPre)[0].id;
  ok(await sinkron([{ jenis: "terima", data: { id: mut, lokasi_id: evPre, oleh: owner, waktu: new Date().toISOString() } }]));
  assert.match(ok(await sinkron([{ jenis: "serah", data: { id: pre1, lokasi_id: "gudang", oleh: owner, waktu: new Date().toISOString(), cara: "QR" } }])).hasil[0].alasan, /booth event/);
  ok(await sinkron([{ jenis: "serah", data: { id: pre1, lokasi_id: evPre, oleh: owner, waktu: new Date().toISOString(), cara: "QR" } }]));
  assert.equal(stok("KB-S", evPre), 1);
  assert.equal(ok(await sinkron([{ jenis: "serah", data: { id: pre1, lokasi_id: evPre, oleh: owner, waktu: new Date().toISOString(), cara: "QR" } }])).hasil[0].status, "sudah");
});

test("tutup event: pre-sale belum diambil diambil di gudang (verifikasi manual), lalu Perlu Refund", async () => {
  const s = await setujui(owner, "135790", "tutup_kasir");
  ok(await sinkron([{ jenis: "shift_tutup", data: { id: shiftPre, tutup: new Date().toISOString(), kas_hitung: 0, seharusnya: 0, ditutup_oleh: owner, disetujui_oleh: owner, persetujuan: s } }]));
  const siap = ok(await api("GET", `/api/event/${evPre}/tutup`));
  assert.equal(siap.presale_menunggu, 2);
  ok(await api("POST", `/api/event/${evPre}/tutup`, {}));
  assert.equal(sql("SELECT ambil_batas FROM trx WHERE id = ?", pre2)[0].ambil_batas, geser(7));
  const di = ok(await api("GET", "/api/pos/pesanan?lokasi=gudang", undefined, { headers: ownerPos, cookie: null })).pesanan;
  assert.deepEqual(di.map((p) => p.ambil).sort(), ["Diambil", "Menunggu", "Menunggu"]);
  // Struk hilang: verifikasi manual butuh PIN Admin/Owner.
  assert.match(ok(await sinkron([{ jenis: "serah", data: { id: pre2, lokasi_id: "gudang", oleh: owner, waktu: new Date().toISOString(), cara: "Manual", disetujui_oleh: sari } }])).hasil[0].alasan, /persetujuan PIN/);
  const tok = await setujui(admin, "222222", "presale_manual");
  ok(await sinkron([{ jenis: "serah", data: { id: pre2, lokasi_id: "gudang", oleh: owner, waktu: new Date().toISOString(), cara: "Manual", disetujui_oleh: admin, persetujuan: tok } }]));
  assert.deepEqual(sql("SELECT ambil_status, ambil_cara, ambil_lokasi FROM trx WHERE id = ?", pre2)[0], { ambil_status: "Diambil", ambil_cara: "Manual", ambil_lokasi: "gudang" });
  // Lewat batas: Perlu Refund, refund wajib foto bukti.
  L.env.DB.raw.prepare("UPDATE trx SET ambil_batas = ? WHERE id = ?").run(geser(-1), pre3);
  const daftar = ok(await api("GET", "/api/presale"));
  assert.equal(daftar.ringkasan.perlu_refund.jumlah, 1);
  assert.equal(daftar.ringkasan.diambil.jumlah, 2);
  const isi = { bank: "BCA", norek: "123", an: "Umar" };
  assert.equal((await api("POST", `/api/presale/${pre3}/refund`, isi)).status, 400);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  const bukti = ok(await api("POST", "/api/berkas?jenis=bukti_refund", png), 201).id;
  ok(await api("POST", `/api/presale/${pre3}/refund`, { ...isi, bukti }));
  assert.deepEqual(sql("SELECT status, ambil_status FROM trx WHERE id = ?", pre3)[0], { status: "Refund", ambil_status: "Refund" });
  assert.equal((await api("POST", `/api/presale/${pre3}/refund`, { ...isi, bukti })).status, 400);
});

test("stok terbuang: stok berkurang, kerugian tercatat, daftar gabungan", async () => {
  assert.equal((await api("POST", "/api/terbuang", { lokasi_id: "gudang", tanggal: hari, alasan: "Rusak", penjelasan: "pendek", pj_id: admin, item: [{ sku: "TP", qty: 1 }] })).status, 400);
  assert.match((await api("POST", "/api/terbuang", { lokasi_id: "gudang", tanggal: hari, alasan: "Rusak", penjelasan: "Kena air hujan di gudang", pj_id: admin, item: [{ sku: "TP", qty: 99 }] })).data.error, /maksimal 10/);
  const sebelum = stok("TP", "gudang");
  ok(await api("POST", "/api/terbuang", { lokasi_id: "gudang", tanggal: hari, alasan: "Berjamur atau lembap", penjelasan: "Kena air hujan di gudang", pj_id: admin, item: [{ sku: "TP", qty: 2 }] }), 201);
  assert.equal(stok("TP", "gudang"), sebelum - 2);
  assert.deepEqual(sql("SELECT jenis, jumlah FROM kerugian WHERE jenis = 'terbuang'"), [{ jenis: "terbuang", jumlah: 30000 }]);
  const d = ok(await api("GET", "/api/terbuang"));
  assert.deepEqual([...new Set(d.terbuang.map((x) => x.jenis))].sort(), ["manual", "retur"]);
  assert.equal(d.ringkasan.uang_kembali, 109649);
});

test("admin di gudang: hanya serah terima pre-sale, jual langsung khusus Owner", async () => {
  const t = new Date().toISOString();
  const r = ok(await sinkron([{ jenis: "shift_buka", data: { id: ulid(), lokasi_id: "gudang", kasir_id: admin, buka: t, modal: 0 } }]));
  assert.match(r.hasil[0].alasan, /khusus Owner/);
});
