// Uji tampilan tahap 6 di Chromium: biaya marketplace, harga marketplace di form produk, input manual dengan perkiraan potongan,
// impor CSV 3 langkah (cocokkan kolom, SKU tidak dikenal, duplikat, batal), batal pesanan, halaman pelanggan.
// Jalankan: node build.mjs && node tests/browser-online.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { hariIniWib } from "../dist/aturan.js";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8799;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
const hari = hariIniWib();
const stok = (sku) => sql("SELECT qty FROM stok WHERE sku = ? AND lokasi_id = 'gudang'", sku)[0]?.qty ?? 0;

let cookie = "";
async function api(method, path, body) {
  const res = await fetch(ALAMAT + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), cookie }, body: body && JSON.stringify(body) });
  const c = res.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const d = await res.json();
  assert.ok(res.ok, JSON.stringify(d));
  return d;
}
await api("POST", "/api/setup", { kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" });
await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
const kat = (await api("POST", "/api/kategori", { nama: "Merchandise" })).id;
const kaos = (await api("POST", "/api/produk", { nama: "Kaos Burtuqol", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 10 }, { nama: "M", harga_jual: 125000, stok_awal: 10 }] })).id;
await api("POST", "/api/produk", { nama: "Topi Hikayat", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 5 });

const csv = [
  "No. Pesanan;Status Pesanan;Waktu Pesanan Dibuat;Username (Pembeli);Nama Produk;Nama Variasi;Nomor Referensi SKU;Harga Setelah Diskon;Jumlah;Biaya Administrasi",
  `MANUAL-1;Selesai;${hari} 08:00;andi;Kaos Burtuqol;S;KB-S;130.000;1;5.000`,
  `2610020D3E4F;Selesai;${hari} 14:40;salsa_01;Kaos Burtuqol;M;KB-M;125.000;2;10.800`,
  `2610020D3E4F;Selesai;${hari} 14:40;salsa_01;Topi;;TOPI-LAMA;35.000;1;10.800`,
  `2610020G5H6I;Batal;${hari} 19:05;andre.p;Kaos Burtuqol;S;KB-S;130.000;1;0`,
].join("\n");

const browser = await chromium.launch();
const galat = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const d = await ctx.newPage();
  d.on("pageerror", (e) => galat.push(e.message));
  d.on("dialog", (x) => x.accept());
  await d.goto(ALAMAT + "/");
  await d.locator("#fMasuk [name=email]").fill("rina@hikayat.id");
  await d.locator("#fMasuk [name=password]").fill("hikayat123");
  await d.locator("#fMasuk button.primary").click();

  // 1. Biaya marketplace Shopee.
  await d.locator('#nav [data-tab="online"]').click();
  await d.locator('[data-sub="biaya"]').click();
  await d.locator('[data-ubah="shopee"]').click();
  await d.locator("#fPopup [name=admin]").fill("6,5");
  await d.locator("#fPopup [name=layanan]").fill("2");
  await d.locator("#fPopup [name=pesanan]").fill("1250");
  await d.locator("#fPopup button.primary").click();
  await d.locator("td", { hasText: "6.5%" }).waitFor();

  // 2. Harga marketplace di form produk: Kaos S Rp130.000 di Shopee, M ikut harga jual.
  await d.locator('#nav [data-tab="produk"]').click();
  await d.locator("tr", { hasText: "Kaos Burtuqol" }).click();
  await d.locator('[data-mp="shopee"]').check();
  await d.locator('[data-harga="shopee"][data-sku="KB-S"]').fill("130000");
  await d.locator("#fMp button.primary").click();
  await d.getByText("Tersimpan").waitFor();
  assert.deepEqual(sql("SELECT sku, harga FROM saluran_varian ORDER BY sku"), [{ sku: "KB-M", harga: null }, { sku: "KB-S", harga: 130000 }]);
  await d.locator("#kembali").click();
  await d.locator("tr", { hasText: "Kaos Burtuqol" }).locator(".tag", { hasText: "Shopee" }).waitFor();

  // 3. Input manual Shopee: harga terisi dari harga marketplace, potongan dari perkiraan.
  await d.locator('#nav [data-tab="online"]').click();
  await d.locator('[data-sub="pesanan"]').click();
  await d.locator("#inputManual").click();
  await d.locator("#fOnline [name=no_pesanan]").fill("MANUAL-1");
  await d.locator('[data-k="sku"]').first().selectOption("KB-S");
  assert.equal(await d.locator('[data-k="harga"]').first().inputValue(), "130000");
  await d.locator('[data-k="qty"]').first().fill("2");
  await d.locator("#kotor", { hasText: "Rp 260.000" }).waitFor();
  // (6,5% + 2%) × 260.000 + 1.250 = 23.350
  assert.equal(await d.locator("#kira").textContent(), "Rp 23.350");
  await d.locator("#pakaiKira").click();
  await d.locator("#fOnline button.primary").click();
  await d.locator("tr", { hasText: "MANUAL-1" }).waitFor();
  assert.equal(stok("KB-S"), 8);
  assert.equal(sql("SELECT potongan FROM pesanan_online")[0].potongan, 23350);

  // 4. Impor CSV: kolom ditebak, SKU lama dipasangkan, duplikat dan batal dilewati.
  await d.locator("#imporFile").click();
  await d.locator("#fImpor1 [name=saluran]").selectOption("shopee");
  await d.locator("#fImpor1 [name=file]").setInputFiles({ name: "pesanan_shopee.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await d.locator("#fImpor1 button.primary").click();
  assert.equal(await d.locator("#fImpor2 [name=sku]").inputValue(), "Nomor Referensi SKU");
  assert.equal(await d.locator("#fImpor2 [name=potongan]").inputValue(), "Biaya Administrasi");
  await d.locator("#fImpor2 button.primary").click();
  await d.getByText("SKU tidak dikenal").waitFor();
  assert.match(await d.locator(".kpis").textContent(), /Siap diimpor\s*1.*Sudah pernah masuk\s*1.*Dibatalkan \(dilewati\)\s*1.*Bermasalah\s*0/s);
  await d.locator('[data-peta="TOPI-LAMA"]').selectOption("TP");
  await d.locator("#jalankanImpor", { hasText: "Impor 1 pesanan" }).waitFor();
  await d.screenshot({ path: SHOTS + "o1-pratinjau.png", fullPage: true });
  await d.locator("#jalankanImpor").click();
  await d.getByText("Impor selesai").waitFor();
  await d.locator("#tutupPopup").click();
  assert.equal(stok("KB-M"), 8);
  assert.equal(stok("TP"), 4);
  assert.deepEqual(sql("SELECT no_pesanan, potongan, sumber FROM pesanan_online ORDER BY no_pesanan"), [
    { no_pesanan: "2610020D3E4F", potongan: 10800, sumber: "Impor" }, { no_pesanan: "MANUAL-1", potongan: 23350, sumber: "Manual" }]);
  const sal = sql("SELECT preset_kolom, peta_sku FROM saluran WHERE id = 'shopee'")[0];
  assert.equal(JSON.parse(sal.peta_sku)["TOPI-LAMA"], "TP");
  assert.equal(JSON.parse(sal.preset_kolom).noPesanan, "No. Pesanan");
  // Ringkasan: kotor 260.000 + 285.000, potongan 34.150
  await d.locator(".kpi", { hasText: "Pendapatan bersih" }).locator("b", { hasText: "Rp 510.850" }).waitFor();
  await d.screenshot({ path: SHOTS + "o2-pesanan.png" });

  // Impor ulang file yang sama: semuanya sudah ada, pasangan SKU diingat.
  await d.locator("#imporFile").click();
  await d.locator("#fImpor1 [name=file]").setInputFiles({ name: "pesanan_shopee.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await d.locator("#fImpor1 button.primary").click();
  await d.locator("#fImpor2 button.primary").click();
  assert.match(await d.locator(".kpis").textContent(), /Siap diimpor\s*0.*Sudah pernah masuk\s*2/s);
  assert.equal(await d.locator('[data-peta="TOPI-LAMA"]').count(), 0);
  await d.locator("#kembali").click();
  await d.locator("#kembali").click();
  await d.locator("#kembali").click();

  // Impor Excel (.xlsx): tanggal sebagai angka seri Excel, angka tanpa titik ribuan.
  const xlsx = SHOTS + "pesanan_tiktok.xlsx";
  const seri = String(Math.floor((Date.parse(hari) / 86_400_000) + 25569) + 0.5); // hari ini pukul 12.00
  execFileSync("python3", [new URL("./buat-xlsx.py", import.meta.url).pathname, xlsx, "Order ID|Order Status|Created Time|Seller SKU|Quantity|Price|Buyer",
    `TT-777|Completed|#${seri}|KB-S|1|130000|budi`]);
  await d.locator("#imporFile").click();
  await d.locator("#fImpor1 [name=saluran]").selectOption("lainnya");
  await d.locator("#fImpor1 [name=file]").setInputFiles(xlsx);
  await d.locator("#fImpor1 button.primary").click();
  assert.equal(await d.locator("#fImpor2 [name=noPesanan]").inputValue(), "Order ID");
  await d.locator("#fImpor2 button.primary").click();
  await d.locator("#jalankanImpor", { hasText: "Impor 1 pesanan" }).waitFor();
  assert.match(await d.locator("tr", { hasText: "TT-777" }).textContent(), new RegExp(`${hari} 12:00.*budi.*KB-S ×1 @Rp 130\\.000.*Siap`, "s"));
  await d.locator("#jalankanImpor").click();
  await d.getByText("Impor selesai").waitFor();
  await d.locator("#tutupPopup").click();
  assert.deepEqual(sql("SELECT no_pesanan, saluran_id, kotor, status FROM pesanan_online WHERE no_pesanan = 'TT-777'"), [{ no_pesanan: "TT-777", saluran_id: "lainnya", kotor: 130000, status: "Selesai" }]);
  assert.equal(stok("KB-S"), 7);

  // 5. Batalkan pesanan impor: stok kembali.
  await d.locator("tr", { hasText: "2610020D3E4F" }).click();
  await d.locator('[data-st="Dibatalkan"]').click();
  await d.locator("tr", { hasText: "2610020D3E4F" }).locator(".tag", { hasText: "Dibatalkan" }).waitFor();
  assert.equal(stok("KB-M"), 10);
  await d.locator('[data-sub="impor"]').click();
  await d.locator("td", { hasText: "pesanan_shopee.csv" }).waitFor();

  // 6. Pelanggan: tambah, ubah, lihat riwayat.
  await d.locator('#nav [data-tab="pelanggan"]').click();
  await d.locator("#tambahPel").click();
  await d.locator("#fPopup [name=nama]").fill("Fajar Ramadhan");
  await d.locator("#fPopup [name=telp]").fill("081234567890");
  await d.locator("#fPopup button.primary").click();
  await d.locator("tr", { hasText: "Fajar Ramadhan" }).click();
  await d.locator("#ubahPel").click();
  await d.locator("#fPopup [name=grup]").fill("Reseller");
  await d.locator("#fPopup button.primary").click();
  await d.getByText(/Reseller/).first().waitFor();
  await d.screenshot({ path: SHOTS + "o3-pelanggan.png" });
  assert.equal(sql("SELECT grup FROM pelanggan")[0].grup, "Reseller");

  assert.deepEqual(galat, []);
  console.log("browser-online: semua lolos");
} finally {
  await browser.close();
  server.close();
}
