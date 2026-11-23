// Uji tampilan POS tahap 5 di Chromium (mode HP): promo bonus otomatis, pelanggan baru, Daftar Order dan pisah bayar,
// void, retur dengan foto dan PIN atasan, pre-sale (wajib pelanggan, struk ber-QR), serah barang lewat QR dan verifikasi manual.
// Jalankan: node build.mjs && node tests/browser-lengkap.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { hariIniWib } from "../dist/aturan.js";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8798;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);

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
const owner = sql("SELECT id FROM staff")[0].id;
const kat = (await api("POST", "/api/kategori", { nama: "Merchandise" })).id;
const tot = (await api("POST", "/api/produk", { nama: "Totebag Hikayat", sku: "TOT", kategori_id: kat, hpp: 20000, harga_jual: 45000, stok_awal: 20 })).id;
const topi = (await api("POST", "/api/produk", { nama: "Topi Hikayat", sku: "TP", kategori_id: kat, hpp: 15000, harga_jual: 35000, stok_awal: 10 })).id;
await api("POST", "/api/promo", { nama: "Beli 2 Totebag gratis Topi", cakupan: "produk", jenis: "bonus", min_qty: 2, syarat: [tot], bonus: [topi], bonus_qty: 1, auto: true, mulai: geser(-1), selesai: geser(5) });
const acara = { nama: "Kajian Akbar", mulai: geser(10), selesai: geser(10), pj_id: owner, kasir: [], presale_aktif: true, presale_mode: "ambil", varian: [{ sku: "TOT", harga: 40000 }] };
const kajian = (await api("POST", "/api/event", acara)).id;
const kode = (await api("POST", "/api/perangkat", { nama: "HP Booth" })).kode_daftar;

const browser = await chromium.launch();
const galat = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "allow", acceptDownloads: true });
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => galat.push(e.message));
  hp.on("dialog", (d) => d.accept());
  const ketik = async (pin) => { for (const d of pin) await hp.locator(`#pad [data-k="${d}"]`).click(); };
  const tunggu = (sel, isi) => hp.waitForFunction(([s, v]) => document.querySelector(s)?.textContent === v, [sel, isi]);
  const setujuiRina = async (judul) => {
    await hp.locator("#lembar button[data-id]", { hasText: "Rina Wijaya" }).click();
    await hp.getByRole("heading", { name: judul }).waitFor();
    await ketik("135790");
  };

  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar [name=kode]").fill(kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByRole("button", { name: /Rina Wijaya/ }).click();
  await ketik("135790");
  await hp.getByRole("button", { name: /Gudang Pusat/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("100000");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();

  // 1. Promo bonus otomatis: dua Totebag → Topi gratis masuk keranjang sendiri.
  const kartuTot = hp.locator(".kartu", { hasText: "Totebag" });
  await kartuTot.click();
  await kartuTot.click();
  await hp.locator(".kartu", { hasText: "Topi" }).locator(".jml").waitFor();
  assert.equal(await hp.locator("#btnPromo").textContent(), "✓ Beli 2 Totebag gratis Topi");
  assert.equal(await hp.locator("#totalBelanja").textContent(), "Rp 90.000");
  // Tab Promo di katalog
  await hp.locator('#chips [data-k="promo"]').click();
  assert.match(await hp.locator("#grid").textContent(), /dipakai.*Hemat Rp 35\.000/s);
  await hp.locator('#chips [data-k="semua"]').click();

  // 2. Pelanggan baru, lalu simpan ke Daftar Order.
  await hp.locator("#pillPelanggan").click();
  await hp.locator("#pelBaru").click();
  await hp.locator("#fPel [name=nama]").fill("Fajar Ramadhan");
  await hp.locator("#fPel [name=telp]").fill("081234567890");
  await hp.locator("#fPel button").click();
  await hp.locator("#pillPelanggan", { hasText: "Fajar Ramadhan" }).waitFor();
  await hp.locator("#btnSimpan").click();
  await tunggu("#totalBelanja", "Rp 0");
  assert.equal(await hp.locator("#nOrder").textContent(), "1");
  await hp.locator("#btnOrder").click();
  await hp.locator("[data-o]").click();
  await hp.locator("#bukaO").click();
  await tunggu("#totalBelanja", "Rp 90.000");

  // 3. Pisah bayar: Rp 50.000 tunai sekarang, sisa Rp 40.000 lewat transfer.
  await hp.locator("#btnBayar").click();
  await hp.locator("#pisah").click();
  await hp.locator("#nominalPisah").fill("50000");
  await hp.locator("#lanjutPisah").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.locator("#uang").fill("50000");
  await hp.locator("#lunas").click();
  await hp.getByText("Diterima Rp 50.000").waitFor();
  assert.match(await hp.locator(".rinci").textContent(), /Sisa tagihan\s*Rp 40\.000/);
  await hp.locator("#lanjutBayar").click();
  await hp.locator('.metode [data-m="transfer"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.locator("#lunas").click();
  await hp.getByText("Lunas Rp 90.000").waitFor();
  await hp.screenshot({ path: SHOTS + "l1-sukses-pisah.png" });
  await hp.locator("#baru").click();
  assert.equal(await hp.locator("#nOrder").textContent(), "0");

  // 4. Transaksi kedua untuk void.
  await hp.locator(".kartu", { hasText: "Totebag" }).click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.getByRole("button", { name: "Uang pas" }).click();
  await hp.locator("#lunas").click();
  await hp.locator("#baru").click();

  await hp.waitForFunction(() => document.querySelector("#antre")?.textContent === "");
  // Antrean bisa terlihat kosong sesaat sebelum transaksi kedua masuk antrean; tunggu sampai dua-duanya ada di server.
  for (let i = 0; i < 50 && sql("SELECT COUNT(*) AS n FROM trx")[0].n < 2; i++) await hp.waitForTimeout(200);
  const trx = sql("SELECT no, total, promo, pelanggan_nama, status FROM trx ORDER BY no");
  assert.deepEqual(trx.map((t) => [t.total, t.promo, t.pelanggan_nama]), [[90000, "Beli 2 Totebag gratis Topi", "Fajar Ramadhan"], [45000, null, null]]);
  assert.deepEqual(sql("SELECT metode, jumlah FROM trx_bayar ORDER BY trx_id, urutan").map((b) => [b.metode, b.jumlah]), [["Tunai", 50000], ["Transfer", 40000], ["Tunai", 45000]]);
  assert.equal(sql("SELECT COUNT(*) AS n FROM pelanggan")[0].n, 1);

  // 5. Void oleh Owner (tanpa PIN atasan): stok kembali.
  const stokTot = () => sql("SELECT qty FROM stok WHERE sku = 'TOT' AND lokasi_id = 'gudang'")[0].qty;
  assert.equal(stokTot(), 17);
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="riwayat"]').click();
  await hp.locator(".daftar button", { hasText: trx[1].no }).click();
  await hp.locator("#void").click();
  await hp.locator('[data-alasan="Pembeli batal"]').click();
  await hp.getByText("Void", { exact: true }).first().waitFor();
  await hp.waitForFunction(() => document.querySelector("#app")?.textContent.includes("Terkirim"));
  await hp.waitForTimeout(500);
  assert.equal(sql("SELECT status, void_alasan FROM trx WHERE no = ?", trx[1].no)[0].void_alasan, "Pembeli batal");
  assert.equal(stokTot(), 18);

  // 6. Retur 1 Totebag cacat dari transaksi pertama: foto + PIN Owner, uang kembali tunai.
  await hp.locator(".daftar button", { hasText: trx[0].no }).click();
  await hp.locator("#retur").click();
  await hp.locator('#fRetur button[data-k="+"][data-sku="TOT"]').click();
  await hp.locator("#fRetur [name=alasan]").fill("Jahitan tali lepas");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await hp.locator("#fRetur [name=foto]").setInputFiles({ name: "cacat.png", mimeType: "image/png", buffer: png });
  await hp.getByText(/Foto siap/).waitFor();
  await hp.locator('#fRetur [data-cara="Uang kembali"]').click();
  // 1 × 45.000 × (90.000 ÷ 125.000) = 32.400
  assert.match(await hp.locator("#fRetur .warn").textContent(), /Rp 32\.400/);
  await hp.locator("#fRetur button.primary").click();
  await setujuiRina("Setujui retur");
  await hp.getByText("Penjualan shift ini").waitFor();
  await hp.waitForFunction(() => document.querySelector("#app")?.textContent.includes("Terkirim"));
  await hp.waitForTimeout(800);
  const rt = sql("SELECT no, cara, metode, nilai, foto FROM retur");
  assert.equal(rt.length, 1);
  assert.deepEqual([rt[0].cara, rt[0].metode, rt[0].nilai], ["Uang kembali", "Tunai", 32400]);
  assert.ok(rt[0].foto, "foto retur tersimpan");
  assert.equal(sql("SELECT jenis FROM berkas WHERE id = ?", rt[0].foto)[0].jenis, "retur");
  await hp.screenshot({ path: SHOTS + "l2-riwayat.png" });
  await hp.locator("#kembali").click();

  // 7. Pre-sale di Kajian: wajib pelanggan dengan no HP, stok tidak dibatasi, struk ber-QR.
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="tempat"]').click();
  await hp.getByRole("button", { name: /Kajian Akbar/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("0");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();
  const kTot = hp.locator(".kartu", { hasText: "Totebag" });
  await kTot.waitFor();
  assert.match(await kTot.textContent(), /Pre-sale · ambil saat event/);
  for (let i = 0; i < 2; i++) await kTot.click();
  await hp.locator("#btnBayar").click();
  await hp.getByRole("heading", { name: "Pelanggan" }).waitFor(); // ditolak tanpa pelanggan
  await hp.locator("#cariPel").fill("Fajar");
  await hp.locator("[data-pel]").first().click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.getByRole("button", { name: "Uang pas" }).click();
  await hp.locator("#lunas").click();
  await hp.getByText("PRE-SALE · QR PENGAMBILAN").waitFor();
  const qrPng = await hp.locator(".qr-struk svg").screenshot();
  const unduh = hp.waitForEvent("download");
  await hp.locator("#unduh").click();
  const pdf = await (await unduh).createReadStream();
  let isiPdf = "";
  for await (const c of pdf) isiPdf += c.toString("latin1");
  assert.match(isiPdf, /PRE-SALE - QR PENGAMBILAN/);
  assert.match(isiPdf, / re f/);
  await hp.screenshot({ path: SHOTS + "l3-presale.png", fullPage: true });
  await hp.locator("#baru").click();

  // Pesanan kedua untuk verifikasi manual.
  await hp.locator("#pillPelanggan").click();
  await hp.locator("#pelBaru").click();
  await hp.locator("#fPel [name=nama]").fill("Umar Faruq");
  await hp.locator("#fPel [name=telp]").fill("085711112222");
  await hp.locator("#fPel button").click();
  await kTot.click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.getByRole("button", { name: "Uang pas" }).click();
  await hp.locator("#lunas").click();
  await hp.locator("#baru").click();
  await hp.waitForFunction(() => document.querySelector("#antre")?.textContent === "");
  assert.equal(sql("SELECT COUNT(*) AS n FROM trx WHERE presale = 1 AND ambil_status = 'Menunggu'")[0].n, 2);
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'TOT' AND lokasi_id = ?", kajian)[0]?.qty ?? 0, 0);

  // 8. Event dimulai hari ini, stok dikirim dan diterima, lalu barang diserahkan.
  await api("PATCH", `/api/event/${kajian}`, { ...acara, mulai: hari, selesai: hari });
  await api("POST", `/api/event/${kajian}/kirim`, { item: [{ sku: "TOT", qty: 5 }] });
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="tempat"]').click();
  await hp.getByRole("button", { name: /Kajian Akbar/ }).click();
  await hp.locator("#pillTempat").click();
  await hp.locator("#keTerima").click();
  await hp.locator("[data-mutasi]").first().click();
  await hp.getByRole("button", { name: "Terima barang" }).click();
  await hp.getByText("Sudah diterima").waitFor();
  await hp.locator("#kembali").click();

  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="pesanan"]').click();
  await hp.getByText("Fajar Ramadhan").waitFor();
  // Scan QR dari foto struk pembeli.
  await hp.locator("#scan").click();
  await hp.locator("#fotoQr").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qrPng });
  await hp.getByText("QR cocok").waitFor();
  await hp.locator("#serahkan").click();
  await hp.getByText("Barang diserahkan").waitFor();
  // Struk hilang: 4 digit terakhir no HP + PIN Owner.
  await hp.locator('[data-st="Menunggu"]').click();
  await hp.locator("#hasilPsn [data-t]", { hasText: "Umar Faruq" }).click();
  await hp.locator("#manual").click();
  await hp.locator("#empat").fill("1111");
  await hp.locator("#cekEmpat").click();
  await hp.getByText("4 digit tidak cocok").waitFor();
  await hp.locator("#empat").fill("2222");
  await hp.locator("#cekEmpat").click();
  await setujuiRina("Setujui serah tanpa QR");
  await hp.getByText("Barang diserahkan").waitFor();
  await hp.waitForFunction(() => document.querySelector("#app")?.textContent.includes("Diambil (2)"));
  await hp.screenshot({ path: SHOTS + "l4-pesanan.png" });
  await hp.waitForTimeout(1500);
  assert.deepEqual(sql("SELECT pelanggan_nama, ambil_status, ambil_cara FROM trx WHERE presale = 1 ORDER BY no").map((t) => [t.pelanggan_nama, t.ambil_status, t.ambil_cara]),
    [["Fajar Ramadhan", "Diambil", "QR"], ["Umar Faruq", "Diambil", "Manual"]]);
  assert.equal(sql("SELECT qty FROM stok WHERE sku = 'TOT' AND lokasi_id = ?", kajian)[0].qty, 2); // 5 diterima − 3 diserahkan
  assert.deepEqual(sql("SELECT COUNT(*) AS n FROM dokumen_ditolak")[0].n, 0);

  // 9. Dashboard: Promosi, Pesanan Pre-sale, Stok Terbuang, detail transaksi dengan retur.
  const dash = await ctx.newPage();
  dash.on("pageerror", (e) => galat.push("dashboard: " + e.message));
  dash.on("dialog", (d) => d.accept());
  await dash.setViewportSize({ width: 1280, height: 900 });
  await dash.goto(ALAMAT + "/");
  await dash.locator("#fMasuk [name=email]").fill("rina@hikayat.id");
  await dash.locator("#fMasuk [name=password]").fill("hikayat123");
  await dash.locator("#fMasuk button.primary").click();
  await dash.locator('#nav [data-tab="promosi"]').click();
  await dash.getByText("Beli 2 Totebag gratis Topi").waitFor();
  assert.match(await dash.locator("tr", { hasText: "Beli 2 Totebag" }).textContent(), /Aktif.*1.*Rp 35\.000/s);
  await dash.locator("#tambahPromo").click();
  await dash.locator('[data-cak="total"]').click();
  await dash.locator("#fPromo [name=nama]").fill("Belanja 100 ribu potong 10 ribu");
  await dash.locator("#fPromo [name=cakupan]").selectOption("total");
  await dash.locator("#fPromo [name=jenis]").selectOption("nominal");
  await dash.locator("#fPromo [name=besar]").fill("10000");
  await dash.locator("#fPromo [name=min_belanja]").fill("100000");
  await dash.locator("#fPromo [name=selesai]").fill(geser(3));
  await dash.locator("#fPromo button.primary").click();
  await dash.getByText("Belanja 100 ribu potong 10 ribu").waitFor();
  assert.equal(sql("SELECT besar, min_belanja, cakupan FROM promo WHERE nama LIKE 'Belanja%'")[0].besar, 10000);

  await dash.locator('#nav [data-tab="presale"]').click();
  await dash.locator('[data-sub="Diambil"]').click();
  await dash.getByText("Umar Faruq").waitFor();
  assert.match(await dash.locator("tr", { hasText: "Umar Faruq" }).textContent(), /verifikasi manual/);
  await dash.screenshot({ path: SHOTS + "l5-dash-presale.png" });

  await dash.locator('#nav [data-tab="inventori"]').click();
  await dash.locator('#nav [data-nav="inventori/terbuang"]').click();
  await dash.getByRole("cell", { name: /Retur barang cacat/ }).waitFor();
  await dash.locator("#catatTerbuang").click();
  await dash.locator("#tambahSku").selectOption("TP");
  await dash.locator("[data-qty]").fill("1");
  await dash.locator("#fTerbuang [name=alasan]").selectOption("Rusak");
  await dash.locator("#fTerbuang [name=penjelasan]").fill("Topi sobek terkena paku rak");
  await dash.locator("#fTerbuang button.primary").click();
  await dash.getByText("Topi sobek terkena paku rak").waitFor();
  assert.equal(sql("SELECT kerugian FROM terbuang")[0].kerugian, 15000);
  await dash.screenshot({ path: SHOTS + "l6-dash-terbuang.png" });

  await dash.locator('#nav [data-tab="penjualan"]').click();
  await dash.locator("tr", { hasText: trx[0].no }).click();
  await dash.getByText(/Retur RTR-/).waitFor();
  await dash.screenshot({ path: SHOTS + "l7-dash-detail.png" });

  assert.deepEqual(galat, []);
  console.log("browser-lengkap: semua lolos");
} finally {
  await browser.close();
  server.close();
}
