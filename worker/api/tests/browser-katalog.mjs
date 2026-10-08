// Uji tampilan tahap 2 di Chromium: kategori, produk bervarian, pemasok, faktur bayar nanti, pembayaran, batal, daftar stok.
// Jalankan: node build.mjs && node tests/browser-katalog.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8798;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const { server } = await jalankan(PORT);
const browser = await chromium.launch();
const galat = [];
try {
  const hal = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  hal.on("pageerror", (e) => galat.push(e.message));
  hal.on("dialog", (d) => d.accept());
  await hal.goto(ALAMAT);
  const setup = hal.locator("#fSetup");
  await setup.waitFor();
  for (const [k, v] of Object.entries({ kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" })) {
    await setup.locator(`[name=${k}]`).fill(v);
  }
  await setup.locator("button.primary").click();
  await hal.locator("#fMasuk [name=password]").fill("hikayat123");
  await hal.locator("#fMasuk button.primary").click();

  // Produk kosong: diarahkan membuat kategori dulu.
  await hal.getByRole("heading", { name: "Penjualan" }).waitFor();
  await hal.getByRole("button", { name: "Produk", exact: true }).click();
  await hal.getByRole("heading", { name: "Produk" }).waitFor();
  await hal.getByRole("button", { name: "+ Produk" }).click();
  await hal.getByText("Buat kategori dulu").waitFor();
  await hal.getByRole("button", { name: "Buka Kategori" }).click();
  await hal.locator("#fKat [name=nama]").fill("Kaos");
  await hal.locator("#fKat button.primary").click();
  await hal.locator("td", { hasText: "Kaos" }).first().waitFor();

  // Produk bervarian dengan stok awal.
  await hal.locator('[data-sub="daftar"]').click();
  await hal.getByRole("button", { name: "+ Produk" }).click();
  const fp = hal.locator("#fP");
  await fp.locator("[name=nama]").fill("Kaos Burtuqol");
  await fp.locator("[name=kategori_id]").selectOption({ label: "Kaos" });
  await fp.locator("[name=sku]").fill("KB");
  await fp.locator("[name=hpp]").fill("60000");
  await fp.locator("#pakaiVarian").check();
  const v = (i, k) => fp.locator(`[data-i="${i}"][data-k="${k}"]`);
  assert.equal(await v(0, "sku").getAttribute("placeholder"), "KB-S");
  for (const i of [0, 1, 2]) await v(i, "harga_jual").fill("110000");
  await v(0, "stok_awal").fill("9");
  await hal.screenshot({ path: SHOTS + "k1-form-produk.png", fullPage: true });
  await fp.locator("button.primary").click();
  await hal.locator("#tbProduk tr", { hasText: "Kaos Burtuqol" }).waitFor();
  assert.match(await hal.locator("#tbProduk").textContent(), /Rp 60\.000.*Rp 110\.000.*45%.*9/s);
  await hal.screenshot({ path: SHOTS + "k2-daftar-produk.png" });

  // Faktur: pemasok dibuat dari dalam form faktur, isian faktur tidak hilang.
  await hal.getByRole("button", { name: "Inventori" }).click();
  await hal.getByRole("button", { name: "+ Faktur" }).click();
  await hal.locator('#fF [value="nanti"]').check();
  await hal.locator("#pemasokBaru").click();
  await hal.locator("#fPm [name=nama]").fill("Konveksi Berkah");
  await hal.locator("#fPm [name=telp]").fill("08123456789");
  await hal.locator("#fPm button.primary").click();
  await hal.locator("#fF").waitFor();
  assert.equal(await hal.locator('#fF [value="nanti"]').isChecked(), true);
  assert.equal(await hal.locator("#fF [name=pemasok_id] option:checked").textContent(), "Konveksi Berkah");

  await hal.getByRole("button", { name: "+ Produk" }).click();
  await hal.locator("#cariPilih").fill("KB-");
  await hal.locator('#daftarPilih input[value="KB-S"]').check();
  await hal.locator('#daftarPilih input[value="KB-L"]').check();
  await hal.locator("#simpanPilih").click();
  await hal.locator('#fF [data-n="0"][data-k="qty"]').fill("1");
  await hal.locator('#fF [data-n="0"][data-k="harga"]').fill("70000");
  await hal.locator('#fF [data-n="1"][data-k="qty"]').fill("10");
  await hal.locator('#fF [data-n="1"][data-k="harga"]').fill("70000");
  assert.equal(await hal.locator("#totalF").textContent(), "Rp 770.000");
  await hal.locator("#fF [name=jatuh_tempo]").fill("2099-12-31");
  await hal.locator("#fF [name=uang_muka]").fill("200000");
  await hal.screenshot({ path: SHOTS + "k3-form-faktur.png", fullPage: true });
  await hal.locator("#fF button.primary").click();

  // Detail faktur: HPP (9 × 60.000 + 11 × 70.000) ÷ 20 = 65.500.
  await hal.getByRole("heading", { name: /^FA\// }).waitFor();
  assert.match(await hal.locator(".form").textContent(), /Kaos Burtuqol.*Faktur dicatat.*Rp 60\.000.*Rp 65\.500/s);
  assert.match(await hal.locator(".kpis").textContent(), /Sisa.*Rp 570\.000/s);
  await hal.getByRole("button", { name: "Catat pembayaran" }).click();
  await hal.locator("#fPopup [name=jumlah]").fill("999999");
  assert.equal(await hal.locator("#fPopup [name=jumlah]").inputValue(), "570000");
  await hal.locator("#fPopup button.primary").click();
  await hal.locator(".tag.aktif", { hasText: "Lunas" }).waitFor();
  await hal.screenshot({ path: SHOTS + "k4-detail-faktur.png", fullPage: true });

  // Batal faktur.
  await hal.getByRole("button", { name: "Batalkan faktur" }).click();
  await hal.locator("#fPopup [name=alasan]").fill("Salah pilih pemasok");
  await hal.locator("#fPopup button.primary").click();
  await hal.getByText(/Uang yang sudah dibayar Rp 770\.000 perlu diminta kembali/).waitFor();

  // Daftar stok: kembali ke stok awal 9.
  await hal.getByRole("button", { name: "← Kembali" }).click();
  await hal.locator('[data-sub="stok"]').click();
  await hal.locator("#tbStok tr", { hasText: "KB-S" }).waitFor();
  assert.match(await hal.locator("#tbStok tr", { hasText: "KB-S" }).textContent(), /9.*9.*Aman/s);
  assert.match(await hal.locator("#tbStok tr", { hasText: "KB-M" }).textContent(), /Habis/);
  await hal.screenshot({ path: SHOTS + "k5-daftar-stok.png" });
  await hal.locator('[data-tabs="gerak"]').click();
  await hal.locator("tr[data-sku='KB-S']").click();
  await hal.getByRole("heading", { name: "Rincian KB-S" }).waitFor();
  assert.match(await hal.locator("#rincianGerak").textContent(), /Batal faktur.*-1.*Faktur.*\+1.*Stok awal.*\+9/s);
  await hal.screenshot({ path: SHOTS + "k6-pergerakan.png", fullPage: true });

  assert.deepEqual(galat, []);
  console.log("ok: alur katalog dan inventori di browser berhasil. Tangkapan layar di shots/");
} finally {
  await browser.close();
  server.close();
}
