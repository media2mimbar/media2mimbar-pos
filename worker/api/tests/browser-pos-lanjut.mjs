// Uji tampilan tambahan POS di Chromium (mode HP): Laporan (kasir, kas, produk terjual), Riwayat masuk, Pengaturan,
// filter Daftar Order, batal terima kiriman, opname disetujui dari HP, tutup kasir lain dan tutup event oleh Owner.
// Jalankan: node build.mjs && node tests/browser-pos-lanjut.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { hariIniWib } from "../dist/aturan.js";
import { ulid } from "../dist/util.js";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8801;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);

let cookie = "";
async function api(method, path, body, headers) {
  const res = await fetch(ALAMAT + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(headers ?? { cookie }) }, body: body && JSON.stringify(body) });
  const c = res.headers.get("set-cookie");
  if (c && !headers) cookie = c.split(";")[0];
  const d = await res.json();
  assert.ok(res.ok, JSON.stringify(d));
  return d;
}
await api("POST", "/api/setup", { kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" });
await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
const owner = sql("SELECT id FROM staff")[0].id;
const kat = (await api("POST", "/api/kategori", { nama: "Kaos" })).id;
await api("POST", "/api/produk", { nama: "Kaos Burtuqol", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 20 }] });
const sari = (await api("POST", "/api/karyawan", { nama: "Sari", role: ["kasir"], pin: "333333" })).id;
const ev = (await api("POST", "/api/event", { nama: "Hikayat Fest", mulai: geser(-1), selesai: geser(1), pj_id: sari, kasir: [sari], varian: [{ sku: "KB-S" }] })).id;
await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 5 }] });
await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 5 }] });
const kode = (await api("POST", "/api/perangkat", { nama: "HP Booth" })).kode_daftar;
// HP kedua (laci Sari), lewat API.
const kode2 = (await api("POST", "/api/perangkat", { nama: "HP Sari" })).kode_daftar;
const hp2 = { "x-perangkat": (await api("POST", "/api/pos/daftar", { kode: kode2 }, {})).token };

const browser = await chromium.launch();
const galat = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => galat.push(e.message));
  hp.on("dialog", (d) => (d.type() === "prompt" ? d.accept("Salah hitung barang") : d.accept()));
  const ketik = async (pin) => { for (const d of pin) await hp.locator(`#pad [data-k="${d}"]`).click(); };
  const menu = async (m) => { await hp.locator("#btnMenu").click(); await hp.locator(`[data-m="${m}"]`).click(); };

  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar [name=kode]").fill(kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByRole("button", { name: /Rina Wijaya/ }).click();
  await ketik("135790");
  await hp.getByRole("button", { name: /Hikayat Fest/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("50000");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();

  // Terima dua kiriman, lalu batalkan penerimaan yang kedua.
  await menu("inventori");
  for (let i = 0; i < 2; i++) {
    await hp.locator("[data-mutasi]:not([disabled])").first().click();
    await hp.getByRole("button", { name: "Terima barang" }).click();
    await hp.getByText("Sudah diterima").waitFor();
  }
  // Tombol batal muncul setelah penerimaan terkirim ke server.
  for (let i = 0; i < 20 && (await hp.locator("[data-batalterima]").count()) < 2; i++) {
    await hp.waitForTimeout(500);
    await hp.locator('[data-tab="kiriman"]').click();
    await hp.getByText("Sudah diterima").waitFor();
  }
  await hp.locator("[data-batalterima]").first().click();
  await hp.getByText("Penerimaan dibatalkan").waitFor();
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'KB-S' AND lokasi_id = ?", ev)[0].qty, 5);
  assert.equal(await hp.locator("[data-mutasi]:not([disabled])").count(), 1);
  await hp.locator("#kembali").click();

  // Jual 2 pcs, simpan satu pesanan ke Daftar Order.
  const kartu = hp.locator(".kartu", { hasText: "Kaos Burtuqol" });
  const tambah = async (n) => { await kartu.click(); for (let i = 0; i < n; i++) await hp.locator('#lembar button[data-k="+"]').click(); await hp.locator("#selesaiVarian").click(); };
  await tambah(2);
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.getByRole("button", { name: "Uang pas" }).click();
  await hp.locator("#lunas").click();
  await hp.locator("#baru").click();
  await tambah(1);
  await hp.locator("#btnSimpan").click();
  await hp.locator("#btnOrder").click();
  await hp.locator('[data-saring="sebagian"]').click();
  await hp.getByText("Tidak ada pesanan.").waitFor();
  await hp.locator('[data-saring="belum"]').click();
  assert.equal(await hp.locator("[data-o]").count(), 1);
  await hp.locator("[data-o]").click();
  await hp.locator("#hapusO").click();
  await hp.locator("#kembali").click();

  // Laporan: laporan kasir, kas kasir, produk terjual.
  await hp.waitForFunction(() => document.querySelector("#antre")?.textContent === "");
  await menu("laporan");
  await hp.locator(".card", { hasText: "Rina Wijaya" }).waitFor();
  assert.match(await hp.locator("#isiLap").textContent(), /Saldo awal\s*Rp 50\.000.*Tunai\s*Rp 250\.000/s);
  await hp.locator('[data-tab="produk"]').click();
  await hp.getByText(/Terjual · 2 pcs · Rp 250\.000/).waitFor();
  await hp.locator('[data-per="event"]').click();
  await hp.getByText(/Terjual · 2 pcs/).waitFor();
  await hp.screenshot({ path: SHOTS + "pl1-laporan.png", fullPage: true });
  await hp.locator('[data-tab="kas"]').click();
  await hp.getByText(/Uang di laci\s*Rp 300\.000/).waitFor();
  await hp.locator("#kembali").click();

  // Riwayat masuk dan Pengaturan.
  await menu("riwayatmasuk");
  await hp.getByText("Buka kasir").first().waitFor();
  await hp.locator("#kembali").click();
  await menu("pengaturan");
  await hp.getByText(/Kode HP/).waitFor();
  await hp.locator("#kembali").click();

  // Katalog: kategori Terlaris, mode SKU dengan scan barcode (SKU + Enter), pill tempat berisi stok per varian.
  await hp.locator("#btnMenu").waitFor();
  await hp.evaluate(() => segarkan());
  await hp.locator('#chips [data-k="terlaris"]').waitFor();
  await hp.locator('#chips [data-k="terlaris"]').click();
  assert.equal(await hp.locator("#grid .kartu").count(), 1);
  await hp.locator("#btnMode").click();
  await hp.locator("#cari").fill("kb-s");
  await hp.locator("#cari").press("Enter");
  await hp.locator("#grid [data-sku='KB-S'] .tag.ok", { hasText: "1" }).waitFor();
  await hp.locator("#btnHapus").click();
  await hp.locator("#btnMode").click();
  await hp.locator("#pillTempat").click();
  assert.match(await hp.locator("#lembar").textContent(), /Event.*Sisa stok.*Kaos Burtuqol · S.*KB-S.*3/s);
  await hp.locator("#lapis").click({ position: { x: 5, y: 5 } });

  // Opname: dihitung (fisik 2 dari 3), lalu disetujui Owner dari HP.
  await menu("inventori");
  await hp.locator('[data-tab="opname"]').click();
  await hp.locator("#hitung").click();
  await hp.locator('#fOpname [data-sku="KB-S"]').fill("2");
  await hp.locator("#fOpname button.primary").click();
  await hp.waitForFunction(() => document.querySelector("#antre") === null || true);
  await hp.locator('[data-tab="kiriman"]').click();
  await hp.locator('[data-tab="opname"]').click();
  await hp.locator("[data-periksa]").first().waitFor({ timeout: 20000 });
  await hp.locator("[data-periksa]").first().click();
  await hp.getByText(/kurang 1/).waitFor();
  await hp.locator("#fSetujuO [name=penjelasan]").fill("Satu kaos hilang di booth");
  await hp.locator("#fSetujuO button.primary").click();
  await hp.getByText("Opname disetujui. Stok sudah disesuaikan").waitFor();
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'KB-S' AND lokasi_id = ?", ev)[0].qty, 2);
  await hp.locator("#kembali").click();

  // Laci Sari di HP lain masih terbuka. Owner menutupnya dari HP ini, lalu menutup event.
  const sesiSari = (await api("POST", "/api/pos/masuk", { staff_id: sari, pin: "333333" }, hp2)).sesi;
  await api("POST", "/api/pos/sinkron", { dokumen: [{ jenis: "shift_buka", data: { id: ulid(), lokasi_id: ev, kasir_id: sari, buka: new Date().toISOString(), modal: 0 } }] }, { ...hp2, "x-sesi": sesiSari });
  await menu("tutupevent");
  await hp.getByRole("button", { name: "Tutup kasir Sari" }).waitFor();
  assert.equal(await hp.locator("#fTutupEv button.primary").isDisabled(), true);
  await hp.screenshot({ path: SHOTS + "pl2-tutup-event.png", fullPage: true });
  await hp.getByRole("button", { name: "Tutup kasir Sari" }).click();
  await hp.locator("#fTutup [name=hitung]").fill("0");
  await hp.locator("#fTutup button.primary").click();
  await ketik("135790");
  await hp.getByRole("button", { name: "Tutup kasir Rina Wijaya" }).waitFor();
  await hp.getByRole("button", { name: "Tutup kasir Rina Wijaya" }).click();
  await hp.locator("#fTutup [name=hitung]").fill("300000");
  await hp.locator("#fTutup button.primary").click();
  await ketik("135790");
  await hp.getByText("Pilih tempat jualan").waitFor();
  await hp.locator("[data-tutupev]").click();
  await hp.locator("#fTutupEv button.primary:not([disabled])").waitFor();
  await hp.locator("#fTutupEv button.primary").click();
  await hp.getByText(/Event ditutup\. 2 pcs kembali ke Gudang Pusat/).waitFor();
  assert.deepEqual(sql("SELECT ditutup FROM event")[0], { ditutup: 1 });
  assert.deepEqual(sql("SELECT kasir_id, ditutup_oleh FROM shift WHERE kasir_id = ?", sari)[0], { kasir_id: sari, ditutup_oleh: owner });
  assert.equal(await hp.getByRole("button", { name: /Hikayat Fest/ }).count(), 0);

  assert.deepEqual(galat, []);
  console.log("browser-pos-lanjut: semua lolos");
} finally {
  await browser.close();
  server.close();
}
