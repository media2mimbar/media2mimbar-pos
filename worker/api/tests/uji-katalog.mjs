// Uji tahap 2: kategori, produk dan varian, pemasok, faktur pembelian, HPP rata-rata tertimbang, stok.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hariIniWib, hppSetelahBatal, hppSetelahBeli, skuVarian, statusFaktur } from "../dist/aturan.js";
import worker from "../dist/index.js";
import { d1Lokal } from "./d1-lokal.mjs";

const env = { DB: d1Lokal(), PEPPER: "pepper-uji", SETUP_KODE: "KODE" };
let cookie;

async function api(method, path, body, c = cookie) {
  const h = { "cf-connecting-ip": "10.0.0.1" };
  if (body !== undefined) h["content-type"] = "application/json";
  if (c) h.cookie = c;
  const res = await worker.fetch(new Request("https://hikayat.test" + path, { method, headers: h, body: body && JSON.stringify(body) }), env);
  return { status: res.status, data: await res.json(), cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
const ok = (r, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.data));
  return r.data;
};
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p);

test("rumus HPP sama dengan prototipe", () => {
  assert.equal(hppSetelahBeli(10, 50000, 10, 600000), 55000);
  assert.equal(hppSetelahBeli(0, 0, 5, 250000), 50000);
  assert.equal(hppSetelahBeli(-3, 50000, 10, 600000), 60000); // stok minus dianggap 0
  assert.equal(hppSetelahBatal(20, 55000, 10, 600000, 50000), 50000);
  assert.equal(hppSetelahBatal(10, 55000, 10, 600000, 50000), 50000); // stok habis: kembali ke HPP sebelum faktur
  assert.equal(hppSetelahBatal(12, 10000, 10, 600000, 48000), 48000); // hasil negatif: kembali ke HPP sebelum faktur
  assert.equal(skuVarian("KB", "M · Hitam"), "KB-M-HITAM");
  assert.equal(statusFaktur({ batal: false, total: 100, dibayar: 40, jatuh_tempo: "2026-01-01" }, "2026-02-01"), "Lewat jatuh tempo");
  assert.equal(statusFaktur({ batal: false, total: 100, dibayar: 100, jatuh_tempo: "2026-01-01" }, "2026-02-01"), "Lunas");
  assert.equal(statusFaktur({ batal: true, total: 100, dibayar: 0, jatuh_tempo: null }, "2026-02-01"), "Dibatalkan");
  assert.equal(hariIniWib(new Date("2026-10-08T18:00:00Z")), "2026-10-09");
});

test("Owner masuk, Kasir tidak bisa membuka katalog", async () => {
  ok(await api("POST", "/api/setup", { kode: "KODE", nama: "Rina", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" }), 201);
  const r = await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
  ok(r);
  cookie = r.cookie;
  assert.equal((await api("GET", "/api/produk", undefined, null)).status, 401);
});

let kaos, polos;

test("kategori", async () => {
  kaos = ok(await api("POST", "/api/kategori", { nama: "Kaos", urutan: 1 }), 201).id;
  ok(await api("POST", "/api/kategori", { nama: "Aksesoris", urutan: 2 }), 201);
  assert.equal((await api("POST", "/api/kategori", { nama: "kaos" })).status, 409);
  const daftar = ok(await api("GET", "/api/kategori")).kategori;
  assert.deepEqual(daftar.map((k) => k.nama), ["Kaos", "Aksesoris"]);
  ok(await api("PATCH", `/api/kategori/${kaos}`, { nama: "Kaos & Jersey", urutan: 1, tampil_menu: true }));
});

test("produk tanpa varian dengan stok awal", async () => {
  const r = ok(await api("POST", "/api/produk", {
    nama: "Kaos Polos", sku: "kp 01", kategori_id: kaos, hpp: 50000, harga_jual: 75000, stok_min: 5, stok_awal: 10,
  }), 201);
  polos = r.id;
  assert.equal(r.sku, "KP-01");
  const p = ok(await api("GET", `/api/produk/${polos}`));
  assert.equal(p.produk.stok, 10);
  assert.equal(p.produk.varian.length, 1);
  assert.equal(p.produk.varian[0].sku, "KP-01");
  assert.equal(p.stok_lokasi[0].lokasi, "Gudang Pusat");
  assert.deepEqual(sql("SELECT jenis, jumlah FROM stok_gerak WHERE sku = 'KP-01'").map((x) => ({ ...x })), [{ jenis: "awal", jumlah: 10 }]);
  assert.equal(p.hpp_riwayat[0].sebab, "awal");
  assert.equal((await api("POST", "/api/produk", { nama: "Lain", sku: "KP-01", kategori_id: kaos, hpp: 1, harga_jual: 2 })).status, 409);
  assert.equal((await api("POST", "/api/produk", { nama: "Tanpa harga", sku: "X1", kategori_id: kaos, hpp: 1 })).status, 400);
});

let burtuqol;

test("produk bervarian, SKU otomatis, ubah varian", async () => {
  const r = ok(await api("POST", "/api/produk", {
    nama: "Kaos Burtuqol", sku: "KB", kategori_id: kaos, hpp: 60000,
    varian: [{ nama: "S", harga_jual: 110000, stok_awal: 9 }, { nama: "M", harga_jual: 110000 }, { nama: "XL", sku: "kb-xxl", harga_jual: 120000 }],
  }), 201);
  burtuqol = r.id;
  assert.deepEqual(r.varian, ["KB-S", "KB-M", "KB-XXL"]);
  assert.equal((await api("POST", "/api/produk", { nama: "Dobel", sku: "KB2", kategori_id: kaos, hpp: 1, varian: [{ nama: "S", harga_jual: 1 }, { nama: "s", harga_jual: 1 }] })).status, 400);

  const daftar = ok(await api("GET", "/api/produk")).produk.find((p) => p.id === burtuqol);
  assert.equal(daftar.harga_min, 110000);
  assert.equal(daftar.harga_maks, 120000);
  assert.equal(daftar.stok, 9);

  // Hapus M dari form (jadi nonaktif), tambah L, ubah harga XL, ubah HPP manual.
  ok(await api("PATCH", `/api/produk/${burtuqol}`, {
    nama: "Kaos Burtuqol", kategori_id: kaos, hpp: 62000,
    varian: [{ sku: "KB-S", nama: "S", harga_jual: 110000 }, { nama: "L", harga_jual: 115000 }, { sku: "KB-XXL", nama: "XL", harga_jual: 125000 }],
  }));
  const p = ok(await api("GET", `/api/produk/${burtuqol}`)).produk;
  assert.deepEqual(p.varian.map((v) => v.sku), ["KB-S", "KB-L", "KB-XXL", "KB-M"]);
  assert.equal(p.varian.find((v) => v.sku === "KB-XXL").harga_jual, 125000);
  assert.equal(p.varian.find((v) => v.sku === "KB-M").aktif, false);
  assert.equal(p.varian.find((v) => v.sku === "KB-L").harga_jual, 115000);
  assert.equal(p.hpp, 62000);
  const riwayat = ok(await api("GET", `/api/produk/${burtuqol}`)).hpp_riwayat;
  assert.equal(riwayat[0].sebab, "ubah_manual");
  assert.equal((await api("PATCH", `/api/produk/${polos}`, { nama: "Kaos Polos", kategori_id: kaos, hpp: 50000, varian: [{ nama: "S", harga_jual: 1 }] })).status, 400);
  assert.equal((await api("DELETE", `/api/kategori/${kaos}`)).status, 400);
});

let pemasok;

test("pemasok", async () => {
  pemasok = ok(await api("POST", "/api/pemasok", { nama: "Konveksi Berkah", telp: "08123" }), 201).id;
  assert.equal((await api("POST", "/api/pemasok", { nama: "konveksi berkah", telp: "1" })).status, 409);
  assert.equal((await api("POST", "/api/pemasok", { nama: "Tanpa telp" })).status, 400);
});

let fLunas, fNanti;

test("faktur lunas: stok gudang bertambah, HPP rata-rata tertimbang", async () => {
  const tgl = hariIniWib();
  const r = ok(await api("POST", "/api/faktur", {
    tanggal: tgl, pemasok_id: pemasok, status_bayar: "lunas", cara: "Transfer",
    item: [{ sku: "KP-01", qty: 6, harga: 60000 }, { sku: "KP-01", qty: 4, harga: 60000 }],
  }), 201);
  fLunas = r.id;
  assert.equal(r.no, `FA/${tgl.slice(2).replace(/-/g, "")}/0001`);
  assert.equal(r.total, 600000);
  const p = ok(await api("GET", `/api/produk/${polos}`)).produk;
  assert.equal(p.stok, 20);
  assert.equal(p.hpp, 55000); // (10 × 50.000 + 10 × 60.000) ÷ 20
  const d = ok(await api("GET", `/api/faktur/${fLunas}`));
  assert.equal(d.faktur.status, "Lunas");
  assert.deepEqual(d.hpp.map((h) => [h.lama, h.baru]), [[50000, 55000]]);
});

test("faktur bayar nanti, uang muka, cicilan, lewat jatuh tempo", async () => {
  const tgl = hariIniWib();
  assert.equal((await api("POST", "/api/faktur", { tanggal: tgl, pemasok_id: pemasok, status_bayar: "nanti", item: [{ sku: "KB-S", qty: 1, harga: 1 }] })).status, 400);
  assert.equal((await api("POST", "/api/faktur", { tanggal: tgl, pemasok_id: pemasok, status_bayar: "nanti", jatuh_tempo: tgl, uang_muka: 500, item: [{ sku: "KB-S", qty: 1, harga: 500 }] })).status, 400);
  const r = ok(await api("POST", "/api/faktur", {
    tanggal: tgl, pemasok_id: pemasok, status_bayar: "nanti", jatuh_tempo: tgl, uang_muka: 200000,
    item: [{ sku: "KB-S", qty: 1, harga: 70000 }, { sku: "KB-L", qty: 10, harga: 70000 }],
  }), 201);
  fNanti = r.id;
  assert.match(r.no, /\/0002$/);
  // HPP Burtuqol: stok lama 9 (S) × 62.000 + 11 × 70.000 = 1.328.000 ÷ 20 = 66.400
  assert.equal(ok(await api("GET", `/api/produk/${burtuqol}`)).produk.hpp, 66400);

  let d = ok(await api("GET", `/api/faktur/${fNanti}`)).faktur;
  assert.equal(d.status, "Belum lunas");
  assert.equal(d.sisa, 570000);
  assert.equal((await api("POST", `/api/faktur/${fNanti}/bayar`, { tanggal: tgl, jumlah: 570001 })).status, 400);
  ok(await api("POST", `/api/faktur/${fNanti}/bayar`, { tanggal: tgl, jumlah: 270000, cara: "Tunai" }));

  env.DB.raw.prepare("UPDATE faktur SET jatuh_tempo = '2020-01-01' WHERE id = ?").run(fNanti);
  const daftar = ok(await api("GET", "/api/faktur"));
  assert.equal(daftar.faktur.find((f) => f.id === fNanti).status, "Lewat jatuh tempo");
  assert.equal(daftar.ringkasan.belum_dibayar, 300000);
  assert.equal(daftar.ringkasan.lewat_jatuh_tempo, 300000);
  assert.equal(daftar.ringkasan.beli_bulan_ini, 600000 + 770000);

  ok(await api("POST", `/api/faktur/${fNanti}/bayar`, { tanggal: tgl, jumlah: 300000 }));
  d = ok(await api("GET", `/api/faktur/${fNanti}`));
  assert.equal(d.faktur.status, "Lunas");
  assert.equal(d.bayar.length, 3);
  assert.equal((await api("POST", `/api/faktur/${fNanti}/bayar`, { tanggal: tgl, jumlah: 1 })).status, 400);

  const pm = ok(await api("GET", "/api/pemasok")).pemasok[0];
  assert.equal(pm.jumlah_faktur, 2);
  assert.equal(pm.total_beli, 1370000);
  assert.equal(pm.sisa, 0);
});

test("batal faktur ditolak kalau barangnya sudah terpakai", async () => {
  // Tiruan: 15 Kaos Polos sudah keluar dari gudang (nanti lewat kirim ke event atau jual).
  env.DB.raw.prepare("UPDATE stok SET qty = 5 WHERE sku = 'KP-01' AND lokasi_id = 'gudang'").run();
  const r = await api("POST", `/api/faktur/${fLunas}/batal`, { alasan: "Salah input" });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Kaos Polos \(ada 5, butuh 10\)/);
  env.DB.raw.prepare("UPDATE stok SET qty = 20 WHERE sku = 'KP-01' AND lokasi_id = 'gudang'").run();
  assert.equal((await api("POST", `/api/faktur/${fLunas}/batal`, { alasan: "x" })).status, 400);
});

test("batal faktur: stok kembali, HPP dihitung mundur, uang perlu diminta kembali", async () => {
  const r = ok(await api("POST", `/api/faktur/${fLunas}/batal`, { alasan: "Barang dikembalikan ke pemasok" }));
  assert.equal(r.minta_kembali, 600000);
  const p = ok(await api("GET", `/api/produk/${polos}`)).produk;
  assert.equal(p.stok, 10);
  assert.equal(p.hpp, 50000);
  const d = ok(await api("GET", `/api/faktur/${fLunas}`)).faktur;
  assert.equal(d.status, "Dibatalkan");
  assert.equal(d.sisa, 0);
  assert.equal((await api("POST", `/api/faktur/${fLunas}/batal`, { alasan: "lagi lagi" })).status, 400);
  assert.equal((await api("POST", `/api/faktur/${fLunas}/bayar`, { tanggal: hariIniWib(), jumlah: 1 })).status, 400);
  const daftar = ok(await api("GET", "/api/faktur"));
  assert.equal(daftar.ringkasan.beli_bulan_ini, 770000);
  // Buku besar cocok dengan ringkasan stok.
  const [{ jumlah }] = sql("SELECT SUM(jumlah) AS jumlah FROM stok_gerak WHERE sku = 'KP-01'");
  assert.equal(jumlah, 10);
});

test("daftar stok dan pergerakan", async () => {
  const s = ok(await api("GET", "/api/stok"));
  assert.deepEqual(s.lokasi.map((l) => l.nama), ["Gudang Pusat"]);
  const kp = s.stok.find((x) => x.sku === "KP-01");
  assert.equal(kp.per_lokasi.gudang, 10);
  assert.equal(kp.status, "Aman");
  assert.equal(kp.nilai, 10 * 50000);
  assert.equal(s.stok.find((x) => x.sku === "KB-XXL").status, "Habis");

  const g = ok(await api("GET", `/api/stok/gerak?sku=KP-01`));
  const ringkas = g.ringkas.find((x) => x.sku === "KP-01");
  assert.equal(ringkas.masuk, 10);
  assert.deepEqual(g.rincian.map((x) => x.jenis).sort(), ["awal", "batal_faktur", "faktur", "faktur"]);
  assert.equal((await api("GET", "/api/stok/gerak?dari=kemarin")).status, 400);
});

test("log aktivitas mencatat faktur dan harga", async () => {
  const aksi = sql("SELECT aksi FROM log_aktivitas").map((x) => x.aksi);
  for (const a of ["Tambah produk", "Ubah produk dan harga", "Catat faktur", "Bayar faktur", "Batal faktur"]) assert.ok(aksi.includes(a), a);
});
