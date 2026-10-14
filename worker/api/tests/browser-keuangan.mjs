// Uji tampilan tahap 7 di Chromium: Dashboard (grafik), Laporan (semua submenu, periode, CSV), Keuangan (keseluruhan, per event,
// bagi biaya umum, biaya dengan bukti), kartu Biaya event di detail event, hak akses Admin.
// Jalankan: node build.mjs && node tests/browser-keuangan.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { hariIniWib } from "../dist/aturan.js";
import { ulid } from "../dist/util.js";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8800;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
const hari = hariIniWib();
const geser = (n) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);
const kini = () => new Date().toISOString();

let cookie = "";
async function api(method, path, body, headers = {}) {
  const res = await fetch(ALAMAT + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(headers["x-perangkat"] ? {} : { cookie }), ...headers }, body: body && JSON.stringify(body) });
  const c = res.headers.get("set-cookie");
  if (c && !headers["x-perangkat"]) cookie = c.split(";")[0];
  const d = await res.json();
  assert.ok(res.ok, JSON.stringify(d));
  return d;
}
await api("POST", "/api/setup", { kode: "SETUP-LOKAL", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" });
await api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
const owner = sql("SELECT id FROM staff")[0].id;
const kat = (await api("POST", "/api/kategori", { nama: "Kaos" })).id;
await api("POST", "/api/produk", { nama: "Kaos Burtuqol", sku: "KB", kategori_id: kat, hpp: 60000, varian: [{ nama: "S", harga_jual: 125000, stok_awal: 20 }, { nama: "M", harga_jual: 125000, stok_awal: 20 }] });
await api("POST", "/api/karyawan", { nama: "Dimas", email: "dimas@hikayat.id", role: ["admin"], password: "dimas1234", pin: "222222" });
const ev = (await api("POST", "/api/event", { nama: "Hikayat Fest", mulai: geser(-1), selesai: geser(1), pj_id: owner, kasir: [], varian: [{ sku: "KB-S" }, { sku: "KB-M" }] })).id;
await api("POST", `/api/event/${ev}/kirim`, { item: [{ sku: "KB-S", qty: 10 }] });
// Penjualan POS lewat dokumen sinkron HP.
const kode = (await api("POST", "/api/perangkat", { nama: "HP" })).kode_daftar;
const daftar = await api("POST", "/api/pos/daftar", { kode }, { "x-perangkat": "-" });
const hp = { "x-perangkat": daftar.token };
const pk = daftar.perangkat.kode;
const shift = ulid(), mut = sql("SELECT id FROM mutasi")[0].id;
const no = (n) => `HK-${hari.slice(2).replace(/-/g, "")}-${pk}-000${n}`;
const r = await api("POST", "/api/pos/sinkron", { dokumen: [
  { jenis: "terima", data: { id: mut, lokasi_id: ev, oleh: owner, waktu: kini() } },
  { jenis: "shift_buka", data: { id: shift, lokasi_id: ev, kasir_id: owner, buka: kini(), modal: 100000 } },
  { jenis: "trx", data: { id: ulid(), no: no(1), shift_id: shift, kasir_id: owner, waktu: kini(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 2, harga: 125000 }], subtotal: 250000, total: 250000, pembayaran: [{ metode: "Tunai", jumlah: 250000 }] } },
  { jenis: "trx", data: { id: ulid(), no: no(2), shift_id: shift, kasir_id: owner, waktu: kini(), items: [{ sku: "KB-S", nama: "Kaos S", qty: 1, harga: 125000 }], subtotal: 125000, total: 125000, pembayaran: [{ metode: "QRIS", jumlah: 125000, ref: "4321" }] } },
  { jenis: "kas", data: { id: ulid(), shift_id: shift, jenis: "keluar", jumlah: 15000, catatan: "Lakban", waktu: kini(), oleh: owner } },
] }, hp);
assert.deepEqual(r.hasil.map((h) => h.status), ["ok", "ok", "ok", "ok", "ok"]);
await api("POST", "/api/online", { saluran_id: "lainnya", no_pesanan: "WA-1", tanggal: hari, items: [{ sku: "KB-M", qty: 1, harga: 125000 }] });

const browser = await chromium.launch();
const galat = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const d = await ctx.newPage();
  d.on("pageerror", (e) => galat.push(e.message));
  d.on("dialog", (x) => x.accept());
  await d.goto(ALAMAT + "/");
  await d.locator("#fMasuk [name=email]").fill("rina@hikayat.id");
  await d.locator("#fMasuk [name=password]").fill("hikayat123");
  await d.locator("#fMasuk button.primary").click();

  // 1. Dashboard: penjualan hari ini 500.000 (POS 375.000 + online 125.000), grafik terisi.
  await d.getByRole("heading", { name: "Dashboard Penjualan" }).waitFor();
  assert.match(await d.locator(".banner-total").textContent(), /Rp 500\.000/);
  assert.match(await d.locator(".banner-mini > div", { hasText: "Laba Kotor" }).textContent(), /Rp 260\.000/);
  assert.equal(await d.locator(".grafik", { hasText: "Metode Pembayaran (POS)" }).locator(".gb-baris").count(), 2);
  assert.match(await d.locator(".grafik", { hasText: "Penjualan per Saluran" }).textContent(), /Hikayat Fest.*Rp 375\.000.*Lainnya.*Rp 125\.000/s);
  await d.locator(".grafik", { hasText: "Penjualan per Saluran" }).locator(".gb-baris").first().hover();
  await d.screenshot({ path: SHOTS + "k1-dashboard.png", fullPage: true });
  await d.locator("#mundur").click();
  assert.match(await d.locator(".banner-total").textContent(), /Rp 0/);
  await d.locator('[data-p="bulanan"]').click();
  assert.match(await d.locator(".banner-total").textContent(), /Rp 500\.000/);

  // 2. Laporan: semua submenu, CSV.
  await d.locator("#keLaporan").click();
  await d.locator("tr", { hasText: "Hikayat Fest" }).waitFor();
  assert.match(await d.locator("tr.total").textContent(), /Total.*Rp 500\.000/s);
  const unduh = d.waitForEvent("download");
  await d.locator("#unduhLap").click();
  const csv = await (await unduh).createReadStream();
  let isi = "";
  for await (const c of csv) isi += c;
  assert.match(isi, /"Hikayat Fest","2","3","375000"/);
  for (const [sub, teks] of [["event", "Rp 250.000"], ["kasir", "Rina Wijaya"], ["produk", "Kaos Burtuqol"], ["harian", "hari ini"], ["kerugian", "Total kerugian"]]) {
    await d.locator(`#nav [data-nav="laporan/${sub}"]`).click();
    await d.getByText(teks).first().waitFor();
  }
  await d.locator('#nav [data-nav="laporan/saluran"]').click();
  await d.locator('[data-per="7hari"]').click();
  assert.equal(await d.locator("#perDari").inputValue(), geser(-6));

  // 3. Biaya: biaya event dengan bukti foto, biaya umum.
  await d.locator('#nav [data-tab="keuangan"]').click();
  await d.locator('#nav [data-nav="keuangan/biaya"]').click();
  await d.locator("#tambahBiaya").click();
  await d.locator("#fBiaya [name=lokasi_id]").selectOption(ev);
  await d.locator("#fBiaya [name=kategori]").selectOption("Sewa booth");
  await d.locator("#fBiaya [name=jumlah]").fill("300000");
  await d.locator("#fBiaya [name=keterangan]").fill("Booth A1");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await d.locator("#fBiaya [name=bukti]").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: png });
  await d.locator("#fBiaya button.primary").click();
  await d.locator("td", { hasText: "Booth A1" }).waitFor();
  await d.locator("#tambahBiaya").click();
  await d.locator("#fBiaya [name=kategori]").selectOption("Iklan online");
  await d.locator("#fBiaya [name=jumlah]").fill("100000");
  await d.locator("#fBiaya [name=keterangan]").fill("Iklan Instagram");
  await d.locator("#fBiaya button.primary").click();
  await d.locator("td", { hasText: "Iklan Instagram" }).waitFor();
  assert.match(await d.locator(".kpi", { hasText: "Kas keluar laci" }).textContent(), /Rp 15\.000/);
  assert.match(await d.locator(".kpi", { hasText: "Total" }).first().textContent(), /Rp 415\.000/);
  assert.ok(sql("SELECT bukti FROM biaya WHERE keterangan = 'Booth A1'")[0].bukti);

  // 4. Keuangan keseluruhan: laba bersih 260.000 − 315.000 − 100.000 = −155.000.
  await d.locator('#nav [data-nav="keuangan/keseluruhan"]').click();
  await d.locator(".kpi", { hasText: "Laba bersih" }).locator("b", { hasText: "Rp -155.000" }).waitFor();
  await d.screenshot({ path: SHOTS + "k2-keuangan.png", fullPage: true });
  // Bagi biaya umum: Hikayat Fest menanggung 100.000 × 375/500 = 75.000.
  await d.locator("#bagiUmum").check();
  await d.locator("th", { hasText: "Bagian biaya umum" }).waitFor();
  assert.match(await d.locator("tr", { hasText: "Hikayat Fest" }).last().textContent(), /Rp 75\.000/);
  await d.locator("tr.klik", { hasText: "Hikayat Fest" }).click();
  await d.getByText("Laba rugi event").waitFor();
  // Event: laba kotor 195.000 − biaya 315.000 − bagian umum 75.000 = −195.000
  await d.locator(".kpi", { hasText: "Laba bersih" }).locator("b", { hasText: "Rp -195.000" }).waitFor();
  assert.match(await d.locator(".warn").textContent(), /belum ditutup/);
  assert.match(await d.locator("tr", { hasText: "Kaos Burtuqol" }).last().textContent(), /10.*3.*30%/s);
  await d.screenshot({ path: SHOTS + "k3-keuangan-event.png", fullPage: true });

  // 5. Detail event: kartu Biaya event.
  await d.locator('#nav [data-tab="event"]').click();
  await d.locator("tr", { hasText: "Hikayat Fest" }).click();
  await d.getByText(/Biaya event · Rp 315\.000/).waitFor();
  await d.locator("#keKeuEv").click();
  await d.getByText("Laba rugi event").waitFor();

  // 6. Admin: tidak ada menu Keuangan, bisa mencatat biaya event dari detail event.
  const a = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 } });
  const ad = await a.newPage();
  ad.on("pageerror", (e) => galat.push("admin: " + e.message));
  await ad.goto(ALAMAT + "/");
  await ad.locator("#fMasuk [name=email]").fill("dimas@hikayat.id");
  await ad.locator("#fMasuk [name=password]").fill("dimas1234");
  await ad.locator("#fMasuk button.primary").click();
  await ad.locator("#fGantiPw [name=lama]").fill("dimas1234");
  await ad.locator("#fGantiPw [name=baru]").fill("dimasbaru99");
  await ad.locator("#fGantiPw [name=ulang]").fill("dimasbaru99");
  await ad.locator("#fGantiPw button.primary").click();
  await ad.getByRole("heading", { name: "Dashboard Penjualan" }).waitFor();
  assert.equal(await ad.locator('#nav [data-tab="keuangan"]').count(), 0);
  await ad.locator('#nav [data-tab="event"]').click();
  await ad.locator("tr", { hasText: "Hikayat Fest" }).click();
  await ad.getByText(/Biaya event · /).waitFor();
  assert.equal(await ad.locator("#keKeuEv").count(), 0);
  await ad.locator("#catatBiayaEv").click();
  assert.equal(await ad.locator("#fBiaya [name=lokasi_id] option", { hasText: "Umum" }).count(), 0);
  await ad.locator("#fBiaya [name=kategori]").selectOption("Konsumsi");
  await ad.locator("#fBiaya [name=jumlah]").fill("50000");
  await ad.locator("#fBiaya [name=keterangan]").fill("Makan kru");
  await ad.locator("#fBiaya button.primary").click();
  await ad.getByText(/Biaya event · Rp 365\.000/).waitFor();
  assert.equal(await ad.locator("[data-ubahb]").count(), 0);

  assert.deepEqual(galat, []);
  console.log("browser-keuangan: semua lolos");
} finally {
  await browser.close();
  server.close();
}
