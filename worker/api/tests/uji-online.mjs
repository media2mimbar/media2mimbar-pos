// Uji tahap 6: biaya marketplace, harga marketplace per SKU, pesanan online manual dan impor (duplikat, stok gudang), batal, pelanggan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib } from "../dist/aturan.js";
import { perkiraanPotongan, waktuWibKeIso } from "../dist/online.js";
import { ulid } from "../dist/util.js";
import { lingkungan, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql } = L;
const hari = hariIniWib();
const stok = (sku) => sql("SELECT qty FROM stok WHERE sku = ? AND lokasi_id = 'gudang'", sku)[0]?.qty ?? 0;
let kaos, topi;

test("rumus: waktu WIB ke UTC dan perkiraan potongan", () => {
  assert.equal(waktuWibKeIso("2026-10-01T09:12", "x"), "2026-10-01T02:12:00.000Z");
  assert.equal(waktuWibKeIso("2026-10-01", "x"), "2026-09-30T17:00:00.000Z");
  assert.throws(() => waktuWibKeIso("01-10-2026", "Tanggal"), /Tanggal tidak valid/);
  // Shopee: admin 6,5% + layanan 2% + Rp 1.250 per pesanan dari Rp 200.000
  assert.equal(perkiraanPotongan({ biaya_admin_bp: 650, biaya_layanan_bp: 200, biaya_pesanan: 1250 }, 200000), 18250);
  assert.equal(perkiraanPotongan({ biaya_admin_bp: 650, biaya_layanan_bp: 200, biaya_pesanan: 1250 }, 0), 0);
});

test("persiapan dan biaya marketplace", async () => {
  await siapkanOwner(L);
  const kat = ok(await api("POST", "/api/kategori", { nama: "Merch" }), 201).id;
  kaos = ok(await api("POST", "/api/produk", { nama: "Kaos", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 10 }, { nama: "M", harga_jual: 125000, stok_awal: 10 }] }), 201).id;
  topi = ok(await api("POST", "/api/produk", { nama: "Topi", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 5 }), 201).id;
  const s = ok(await api("GET", "/api/saluran")).saluran;
  assert.deepEqual(s.map((x) => x.nama), ["Shopee", "Tokopedia", "TikTok Shop", "Lainnya"]);
  assert.equal((await api("PATCH", "/api/saluran/shopee", { biaya_admin_persen: 120 })).status, 400);
  ok(await api("PATCH", "/api/saluran/shopee", { biaya_admin_persen: "6,5", biaya_layanan_persen: 2, biaya_pesanan: 1250 }));
  ok(await api("PATCH", "/api/saluran/tiktok", { aktif: false }));
  const lagi = ok(await api("GET", "/api/saluran")).saluran;
  assert.deepEqual([lagi[0].biaya_admin_bp, lagi[0].biaya_layanan_bp, lagi[0].biaya_pesanan, lagi[2].aktif], [650, 200, 1250, false]);
});

test("harga marketplace per varian; kosong = harga jual", async () => {
  ok(await api("PUT", `/api/produk/${kaos}/saluran`, { saluran: { shopee: { dijual: true, harga: { "KB-S": 130000, "KB-M": "" } }, tokopedia: { dijual: false } } }));
  const h = ok(await api("GET", `/api/produk/${kaos}/saluran`));
  assert.deepEqual(h.saluran.map((s) => [s.id, s.dijual]), [["shopee", true], ["tokopedia", false], ["tiktok", false]]);
  assert.deepEqual(h.saluran[0].harga, { "KB-S": 130000, "KB-M": null });
  const k = ok(await api("GET", "/api/saluran/shopee/katalog")).varian;
  assert.deepEqual(k.map((v) => [v.sku, v.harga, v.stok_gudang]), [["KB-S", 130000, 10], ["KB-M", 125000, 10]]);
  assert.equal(ok(await api("GET", "/api/saluran/lainnya/katalog")).varian.length, 3);
  const p = ok(await api("GET", "/api/produk")).produk;
  assert.deepEqual(p.find((x) => x.id === kaos).marketplace, [{ nama: "Shopee", toko_aktif: true }]);
});

test("input manual: hanya produk aktif di marketplace, stok gudang berkurang, no pesanan tidak boleh dobel", async () => {
  const dasar = { saluran_id: "shopee", no_pesanan: "2610010A1B2C", tanggal: `${hari}T09:12`, pembeli: "rizky.h", potongan: 12000 };
  assert.match((await api("POST", "/api/online", { ...dasar, items: [{ sku: "TP", qty: 1, harga: 35000 }] })).data.error, /belum aktif di Shopee/);
  ok(await api("POST", "/api/online", { ...dasar, items: [{ sku: "KB-S", qty: 2, harga: 130000 }] }), 201);
  assert.equal(stok("KB-S"), 8);
  assert.equal((await api("POST", "/api/online", { ...dasar, items: [{ sku: "KB-S", qty: 1, harga: 130000 }] })).status, 409);
  // Saluran Lainnya: semua produk.
  ok(await api("POST", "/api/online", { saluran_id: "lainnya", no_pesanan: "WA-001", tanggal: hari, items: [{ sku: "TP", qty: 1, harga: 35000 }], status: "Diproses" }), 201);
  assert.equal(stok("TP"), 4);
  assert.deepEqual(sql("SELECT jenis, jumlah FROM stok_gerak WHERE sku = 'TP' AND ref_tabel = 'pesanan_online'"), [{ jenis: "jual", jumlah: -1 }]);
});

let batchId;

test("impor file: pesanan baru masuk, duplikat dilewati, preset kolom tersimpan", async () => {
  batchId = ulid();
  const cek = ok(await api("POST", "/api/online/impor/cek", { saluran_id: "shopee", no: ["2610010A1B2C", "2610020D3E4F"] }));
  assert.deepEqual(cek.ada, ["2610010A1B2C"]);
  const isi = {
    saluran_id: "shopee", batch_id: batchId, nama_file: "pesanan_shopee.csv", batal: 1, gagal: 0,
    preset_kolom: { noPesanan: "No. Pesanan", sku: "Nomor Referensi SKU" }, peta_sku: { "KB-S-LAMA": "KB-S" },
    pesanan: [
      { no_pesanan: "2610010A1B2C", tanggal: `${hari}T09:12`, items: [{ sku: "KB-S", qty: 2, harga: 130000 }] },
      { no_pesanan: "2610020D3E4F", tanggal: `${hari}T14:40`, pembeli: "salsa_01", potongan: 10800, items: [{ sku: "KB-M", nama: "Kaos M", qty: 3, harga: 125000 }, { sku: "TP", qty: 1, harga: 35000 }] },
    ],
  };
  assert.match((await api("POST", "/api/online/impor", { ...isi, pesanan: [{ ...isi.pesanan[1], items: [{ sku: "XX", qty: 1, harga: 1 }] }] })).data.error, /SKU XX tidak ditemukan/);
  const r = ok(await api("POST", "/api/online/impor", isi));
  assert.deepEqual([r.masuk, r.duplikat], [1, 1]);
  assert.equal(stok("KB-M"), 7);
  assert.equal(stok("KB-S"), 8); // duplikat tidak mengurangi stok lagi
  // Kiriman kedua dengan batch yang sama menambah hitungan riwayat.
  ok(await api("POST", "/api/online/impor", { ...isi, batal: 0, pesanan: [{ no_pesanan: "2610030J7K8L", tanggal: hari, items: [{ sku: "KB-M", qty: 1, harga: 125000 }] }] }));
  const riwayat = ok(await api("GET", "/api/online/impor")).impor;
  assert.deepEqual([riwayat.length, riwayat[0].masuk, riwayat[0].duplikat, riwayat[0].batal], [1, 2, 1, 1]);
  const s = ok(await api("GET", "/api/saluran")).saluran[0];
  assert.deepEqual(s.preset_kolom, { noPesanan: "No. Pesanan", sku: "Nomor Referensi SKU" });
  assert.deepEqual(s.peta_sku, { "KB-S-LAMA": "KB-S" });
});

test("daftar pesanan: ringkasan kotor, potongan, bersih per saluran; batal mengembalikan stok", async () => {
  let d = ok(await api("GET", `/api/online?dari=${hari}&sampai=${hari}`));
  assert.equal(d.pesanan.length, 4);
  assert.deepEqual(d.ringkasan.per_saluran.shopee, { jumlah: 3, kotor: 260000 + 410000 + 125000, potongan: 12000 + 10800, bersih: 795000 - 22800 });
  const id = d.pesanan.find((o) => o.no_pesanan === "2610020D3E4F").id;
  const det = ok(await api("GET", "/api/online/" + id));
  assert.deepEqual(det.items.map((i) => [i.sku, i.hpp]), [["KB-M", 60000], ["TP", 15000]]);
  assert.equal(det.pesanan.nama_file, "pesanan_shopee.csv");
  ok(await api("POST", `/api/online/${id}/status`, { status: "Dibatalkan" }));
  assert.equal(stok("KB-M"), 9);
  assert.equal(stok("TP"), 4);
  assert.equal((await api("POST", `/api/online/${id}/status`, { status: "Selesai" })).status, 400);
  d = ok(await api("GET", `/api/online?saluran=shopee&cari=salsa`));
  assert.equal(d.pesanan[0].status, "Dibatalkan");
  assert.equal(d.ringkasan.total.jumlah, 0);
});

test("pelanggan: tambah, no HP tidak dobel, riwayat transaksi", async () => {
  const id = ok(await api("POST", "/api/pelanggan", { nama: "Fajar Ramadhan", telp: "0812-3456-7890", kota: "Bandung" }), 201).id;
  assert.equal((await api("POST", "/api/pelanggan", { nama: "Fajar lagi", telp: "081234567890" })).status, 409);
  ok(await api("PATCH", "/api/pelanggan/" + id, { nama: "Fajar R.", telp: "081234567890", grup: "Reseller" }));
  ok(await api("POST", "/api/online", { saluran_id: "lainnya", no_pesanan: "WA-002", tanggal: hari, pelanggan_id: id, items: [{ sku: "KB-S", qty: 1, harga: 125000 }] }), 201);
  const d = ok(await api("GET", "/api/pelanggan/" + id));
  assert.equal(d.pelanggan.grup, "Reseller");
  assert.equal(d.online[0].no, "WA-002");
  const l = ok(await api("GET", "/api/pelanggan?cari=0812")).pelanggan;
  assert.equal(l[0].nama, "Fajar R.");
});
