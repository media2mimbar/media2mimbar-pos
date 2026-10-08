// Uji tampilan POS tahap 3 di Chromium (mode HP): buka kasir, jual tunai, jual QRIS saat offline,
// aplikasi tetap terbuka tanpa sinyal (service worker), sinkron otomatis, kunci layar, tutup kasir.
// Jalankan: node build.mjs && node tests/browser-pos.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8797;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));

// Data awal lewat API dashboard.
let cookie = "";
async function api(method, path, body) {
  const res = await fetch(ALAMAT + path, {
    method, headers: { ...(body instanceof Uint8Array ? { "content-type": "image/png" } : body ? { "content-type": "application/json" } : {}), cookie },
    body: body instanceof Uint8Array ? body : body && JSON.stringify(body),
  });
  const c = res.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const d = await res.json();
  assert.ok(res.ok, JSON.stringify(d));
  return d;
}
await api("POST", "/api/setup", { kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" });
await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
const kat = (await api("POST", "/api/kategori", { nama: "Merchandise" })).id;
await api("POST", "/api/produk", { nama: "Totebag Hikayat", sku: "TOT", kategori_id: kat, hpp: 20000, harga_jual: 45000, stok_awal: 10 });
await api("POST", "/api/produk", { nama: "Kaos Burtuqol", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 110000, stok_awal: 2 }, { nama: "M", harga_jual: 110000 }] });
await api("PUT", "/api/harga-saluran/gudang", { harga: { TOT: 42000 } });
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 227, 85, 242, 156, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
const qris = await api("POST", "/api/berkas?jenis=qris", png);
const p = (await api("GET", "/api/pengaturan/pos")).pengaturan;
delete p.diubah_pada;
await api("PUT", "/api/pengaturan/pos", { ...p, pembulatan: 500, qris: { nama: "HIKAYAT", nmid: "ID1", berkas_id: qris.id }, rekening: [{ bank: "BCA", no: "123 456", nama: "PT Hikayat" }] });
const kode = (await api("POST", "/api/perangkat", { nama: "HP Booth" })).kode_daftar;

const browser = await chromium.launch();
const galat = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => galat.push(e.message));
  hp.on("dialog", (d) => d.accept());
  const ketik = async (pin) => { for (const d of pin) await hp.locator(`#pad [data-k="${d}"]`).click(); };

  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar [name=kode]").fill(kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByRole("button", { name: /Rina Wijaya/ }).click();
  await ketik("135790");
  await hp.getByRole("button", { name: /Gudang Pusat/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("200000");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();

  // Katalog Gudang Pusat memakai harga gudang.
  const kartuTot = hp.locator(".kartu", { hasText: "Totebag" });
  await kartuTot.waitFor();
  assert.match(await kartuTot.textContent(), /sisa 10.*Rp 42\.000.*harga khusus/s);
  await kartuTot.click();
  await kartuTot.click();
  await hp.locator(".kartu", { hasText: "Kaos Burtuqol" }).click();
  await hp.locator('#lembar button[data-k="+"][data-sku="KB-S"]').click();
  await hp.locator('#lembar button[data-k="+"][data-sku="KB-S"]').click();
  assert.equal(await hp.locator('#lembar button[data-k="+"][data-sku="KB-S"]').isDisabled(), true); // stok S tinggal 2
  assert.equal(await hp.locator('#lembar button[data-k="+"][data-sku="KB-M"]').isDisabled(), true); // M habis
  await hp.locator("#selesaiVarian").click();
  // 2 × 42.000 + 2 × 110.000 = 304.000 (pembulatan Rp 500 tidak mengubah)
  assert.equal(await hp.locator("#totalBelanja").textContent(), "Rp 304.000");
  await hp.screenshot({ path: SHOTS + "p1-kasir.png" });

  await hp.locator("#btnBayar").click();
  await hp.getByRole("button", { name: "Rp 310.000" }).click();
  assert.equal(await hp.locator("#kembalian").textContent(), "Kembalian Rp 6.000");
  await hp.screenshot({ path: SHOTS + "p2-bayar.png" });
  await hp.locator("#lunas").click();
  await hp.getByText("Lunas Rp 304.000").waitFor();
  await hp.screenshot({ path: SHOTS + "p3-sukses.png", fullPage: true });
  // Terkirim ke server.
  for (let i = 0; i < 50 && !sql("SELECT 1 FROM trx").length; i++) await hp.waitForTimeout(100);
  assert.deepEqual(sql("SELECT no, total, kembalian, metode FROM trx"), [{ no: `HK-${new Date(Date.now() + 7 * 3600_000).toISOString().slice(2, 10).replace(/-/g, "")}-A1-0001`, total: 304000, kembalian: 6000, metode: "Tunai" }]);
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'TOT'")[0].qty, 8);

  // Offline: jual 1 Totebag dengan QRIS. Tersimpan di HP, stok di layar ikut berkurang.
  await hp.getByRole("button", { name: "Transaksi baru" }).click();
  await ctx.setOffline(true);
  await kartuTot.click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode button[data-m="qris"]').click();
  await hp.locator(".qris img").waitFor();
  assert.equal(await hp.locator("#lunas").isDisabled(), true);
  await hp.locator("#ref").fill("4821");
  await hp.screenshot({ path: SHOTS + "p4-qris.png", fullPage: true });
  await hp.locator("#lunas").click();
  await hp.getByText("Tersimpan di HP").waitFor();
  await hp.getByRole("button", { name: "Transaksi baru" }).click();
  assert.match(await kartuTot.textContent(), /sisa 7/);
  await hp.getByText("1 belum terkirim").waitFor();
  assert.match(await hp.locator(".bar").textContent(), /Offline/);

  // Aplikasi tetap terbuka saat dimuat ulang tanpa sinyal.
  await hp.reload();
  await kartuTot.waitFor();
  assert.match(await kartuTot.textContent(), /sisa 7/);
  assert.equal(sql("SELECT COUNT(*) AS n FROM trx")[0].n, 1);

  // Sinyal kembali: antrean terkirim sendiri.
  await ctx.setOffline(false);
  await hp.evaluate(() => dispatchEvent(new Event("online")));
  for (let i = 0; i < 80 && sql("SELECT COUNT(*) AS n FROM trx")[0].n < 2; i++) await hp.waitForTimeout(100);
  const q = sql("SELECT t.offline, b.ref FROM trx t JOIN trx_bayar b ON b.trx_id = t.id WHERE b.metode = 'QRIS'");
  assert.deepEqual(q, [{ offline: 1, ref: "4821" }]);

  // Kunci layar manual, buka dengan PIN.
  await hp.locator("#btnKunci").click();
  for (const d of "000000") await hp.locator(`#padK [data-k="${d}"]`).click();
  await hp.locator("#errK:not([hidden])").waitFor();
  for (const d of "135790") await hp.locator(`#padK [data-k="${d}"]`).click();
  await hp.locator("#kunci").waitFor({ state: "hidden" });

  // Kas keluar lalu tutup kasir: seharusnya = 200.000 + 304.000 − 15.000 = 489.000
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="kas"]').click();
  await hp.locator('#fKas [data-j="keluar"]').click();
  await hp.locator("#fKas [name=jumlah]").fill("15000");
  await hp.locator("#fKas [name=catatan]").fill("Beli air minum");
  await hp.locator("#fKas button.primary").click();
  await hp.getByText("Beli air minum").waitFor();
  await hp.locator("#kembali").click();
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="tutup"]').click();
  await hp.locator("#fTutup").waitFor();
  assert.match(await hp.locator("#app .wrap").textContent(), /Seharusnya\s*Rp 489\.000/);
  await hp.locator("#fTutup [name=hitung]").fill("480000");
  await hp.getByText("Kurang Rp 9.000").waitFor();
  await hp.locator("#fTutup [name=penjelasan]").fill("Salah memberi kembalian");
  await hp.screenshot({ path: SHOTS + "p5-tutup-kasir.png", fullPage: true });
  await hp.locator("#fTutup button.primary").click();
  await ketik("135790");
  await hp.getByText("Pilih tempat jualan").waitFor();
  for (let i = 0; i < 50 && sql("SELECT status FROM shift")[0]?.status !== "tutup"; i++) await hp.waitForTimeout(100);
  const s = sql("SELECT status, seharusnya, kas_hitung, selisih, penjelasan, offline FROM shift")[0];
  assert.deepEqual(s, { status: "tutup", seharusnya: 489000, kas_hitung: 480000, selisih: -9000, penjelasan: "Salah memberi kembalian", offline: 0 });
  assert.ok(sql("SELECT aksi FROM log_masuk WHERE tempat = 'pos'").map((x) => x.aksi).includes("Tutup kasir"));
  assert.deepEqual(sql("SELECT COUNT(*) AS n FROM dokumen_ditolak"), [{ n: 0 }]);

  assert.deepEqual(galat, []);
  console.log("ok: alur POS di browser berhasil (online, offline, sinkron, tutup kasir). Tangkapan layar di shots/");
} finally {
  await browser.close();
  server.close();
}
