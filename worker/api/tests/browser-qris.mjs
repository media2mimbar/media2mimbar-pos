// Uji QRIS sesuai nominal di Chromium (mode HP): gambar QRIS statis diunggah, POS membuat QR berisi nominal transaksi,
// QR di layar dipindai balik dan isinya diperiksa, lalu transaksi QRIS tersimpan tanpa 4 digit referensi.
// Jalankan: node build.mjs && node tests/browser-qris.mjs
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8802;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
const k = {};
vm.runInNewContext(readFileSync(new URL("../ui/pos-qris.js", import.meta.url), "utf8"), k);
const { HkQris } = k;

let cookie = "";
async function api(method, path, body) {
  const png = body instanceof Uint8Array;
  const res = await fetch(ALAMAT + path, { method, headers: { ...(png ? { "content-type": "image/png" } : body ? { "content-type": "application/json" } : {}), cookie }, body: png ? body : body && JSON.stringify(body) });
  const c = res.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const d = await res.json();
  assert.ok(res.ok, JSON.stringify(d));
  return d;
}

// QRIS statis contoh (data karangan) dengan susunan seperti QRIS dari bank.
const tlv = (a, v) => a + String(v.length).padStart(2, "0") + v;
const awal = "000201" + "010211" + tlv("26", tlv("00", "ID.CO.TELKOM.WWW") + tlv("01", "936008980000000001") + tlv("02", "000000000000001") + tlv("03", "UMI"))
  + tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1024309872942") + tlv("03", "UMI")) + tlv("52", "5999") + tlv("53", "360") + tlv("58", "ID")
  + tlv("59", "HIKAYAT MERCHANDISE") + tlv("60", "BANDUNG") + tlv("61", "40111") + "6304";
const statis = awal + HkQris.crc16(awal);

await api("POST", "/api/setup", { kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" });
await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
const kat = (await api("POST", "/api/kategori", { nama: "Aksesoris" })).id;
await api("POST", "/api/produk", { nama: "Topi Bordir", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 10 });
const kode = (await api("POST", "/api/perangkat", { nama: "HP Booth" })).kode_daftar;

const browser = await chromium.launch();
const galat = [];
try {
  // Gambar QRIS statis dibuat di browser (pos-qrcode.js), seperti file QRIS yang diunduh dari aplikasi merchant.
  const alat = await browser.newPage();
  await alat.setContent("<!doctype html><title>QRIS</title>");
  await alat.addScriptTag({ content: readFileSync(new URL("../ui/pos-qrcode.js", import.meta.url), "utf8") });
  const pngQris = await alat.evaluate(async (teks) => {
    const q = qrcode(0, "M");
    q.addData(teks);
    q.make();
    const img = new Image();
    img.src = q.createDataURL(8, 32);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c.toDataURL("image/png").split(",")[1];
  }, statis);
  await alat.close();
  const berkas = await api("POST", "/api/berkas?jenis=qris", new Uint8Array(Buffer.from(pngQris, "base64")));
  const p = (await api("GET", "/api/pengaturan/pos")).pengaturan;
  delete p.diubah_pada;
  await api("PUT", "/api/pengaturan/pos", { ...p, qris: { nama: "HIKAYAT MERCHANDISE", nmid: "ID1024309872942", berkas_id: berkas.id }, rekening: [{ bank: "BCA", no: "123 456", nama: "PT Hikayat" }] });

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => galat.push(e.message));
  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar [name=kode]").fill(kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByRole("button", { name: /Rina Wijaya/ }).click();
  for (const d of "135790") await hp.locator(`#pad [data-k="${d}"]`).click();
  await hp.getByRole("button", { name: /Gudang Pusat/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("0");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();
  await hp.locator(".kartu", { hasText: "Topi" }).click();
  await hp.locator(".kartu", { hasText: "Topi" }).click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="qris"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.locator("#qrNominal svg").waitFor();
  assert.equal(await hp.locator("#ref").count(), 0); // tidak ada isian 4 digit
  assert.equal(await hp.locator("#lunas").isDisabled(), false);
  await hp.screenshot({ path: SHOTS + "q1-qris-nominal.png" });

  // Pindai balik QR di layar: isinya QRIS yang sama dengan nominal Rp 70.000.
  const isi = await hp.evaluate(async () => {
    await muatJsQr();
    const svg = document.querySelector("#qrNominal svg");
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" }));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 600; c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 600);
    g.drawImage(img, 0, 0, 600, 600);
    return jsQR(g.getImageData(0, 0, 600, 600).data, 600, 600)?.data ?? null;
  });
  assert.ok(isi, "QR di layar terbaca");
  assert.equal(HkQris.periksa(isi), null);
  const ambil = (kd) => HkQris.pecah(isi).find(([x]) => x === kd)?.[1];
  assert.equal(ambil("01"), "12");
  assert.equal(ambil("54"), "70000");
  assert.equal(ambil("51"), HkQris.pecah(statis).find(([x]) => x === "51")[1]);
  assert.equal(ambil("59"), "HIKAYAT MERCHANDISE");

  await hp.locator("#lunas").click();
  await hp.getByText("Lunas Rp 70.000").waitFor();
  for (let i = 0; i < 50 && !sql("SELECT 1 FROM trx_bayar").length; i++) await hp.waitForTimeout(100);
  assert.deepEqual(sql("SELECT metode, jumlah, ref FROM trx_bayar"), [{ metode: "QRIS", jumlah: 70000, ref: null }]);

  // Dashboard › Pengaturan POS: gambar QRIS diperiksa, lalu QR coba Rp 1.000 dibuat tanpa mencatat penjualan atau menyimpan pengaturan.
  const d = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  d.on("pageerror", (e) => galat.push(e.message));
  await d.goto(ALAMAT + "/");
  await d.locator("#fMasuk [name=email]").fill("rina@hikayat.id");
  await d.locator("#fMasuk [name=password]").fill("hikayat123");
  await d.locator("#fMasuk button.primary").click();
  await d.locator('[data-tab="pengaturan"]').click();
  await d.getByText("QR bisa dibuat sesuai nominal").waitFor();
  const diubah = (await api("GET", "/api/pengaturan/pos")).pengaturan.diubah_pada;
  await d.locator("#cobaNominal").fill("2500");
  await d.locator("#cobaNominal").press("Enter");
  await d.locator("#hasilCoba svg").waitFor();
  await d.screenshot({ path: SHOTS + "q2-coba-qris.png", fullPage: true });
  const coba = await d.evaluate(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([document.querySelector("#hasilCoba svg").outerHTML], { type: "image/svg+xml" }));
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 600; c.height = 600;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 600, 600);
    g.drawImage(img, 0, 0, 600, 600);
    return jsQR(g.getImageData(0, 0, 600, 600).data, 600, 600)?.data ?? null;
  });
  assert.equal(HkQris.periksa(coba), null);
  assert.equal(HkQris.pecah(coba).find(([x]) => x === "54")[1], "2500");
  await d.waitForTimeout(1200); // lewati jeda simpan otomatis
  assert.equal((await api("GET", "/api/pengaturan/pos")).pengaturan.diubah_pada, diubah);
  assert.equal(sql("SELECT COUNT(*) n FROM trx_bayar")[0].n, 1);
  assert.deepEqual(galat, []);
  console.log("browser-qris: semua lolos");
} finally {
  await browser.close();
  server.close();
}
