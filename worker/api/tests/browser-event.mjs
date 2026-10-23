// Uji tampilan tahap 4: buat event dan kirim stok di dashboard, kasir menerima kiriman (kurang 1) dan opname di HP,
// Admin menyetujui opname, Owner menutup event, kerugian diselesaikan.
// Jalankan: node build.mjs && node tests/browser-event.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");
const PORT = 8796;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const { server, env } = await jalankan(PORT);
const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));

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
const kat = (await api("POST", "/api/kategori", { nama: "Kaos" })).id;
await api("POST", "/api/produk", { nama: "Kaos Burtuqol", sku: "KB", kategori_id: kat, hpp: 55000, varian: [{ nama: "S", harga_jual: 110000, stok_awal: 20 }, { nama: "M", harga_jual: 110000, stok_awal: 20 }] });
await api("POST", "/api/karyawan", { nama: "Sari Handayani", role: ["kasir"], pin: "333333" });
const kode = (await api("POST", "/api/perangkat", { nama: "HP Booth" })).kode_daftar;
const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

const browser = await chromium.launch();
const galat = [];
try {
  // ---------- Dashboard: buat event ----------
  const lap = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  lap.on("pageerror", (e) => galat.push("dashboard: " + e.message));
  lap.on("dialog", (d) => d.accept());
  await lap.context().addCookies([{ name: "hk_sesi", value: cookie.split("=")[1], url: ALAMAT }]);
  await lap.goto(ALAMAT);
  await lap.getByRole("button", { name: "Event", exact: true }).click();
  await lap.getByRole("button", { name: "+ Buat Event" }).click();
  const f = lap.locator("#fEv");
  await f.locator("[name=nama]").fill("Hikayat Fest Bandung");
  await f.locator("[name=venue]").fill("Sabuga ITB");
  await f.locator("[name=mulai]").fill(hari);
  await f.locator("[name=selesai]").fill(hari);
  await f.locator("[name=pj_id]").selectOption({ label: "Sari Handayani" });
  await f.locator("label", { hasText: "Sari Handayani" }).locator("input").check();
  await lap.getByRole("button", { name: "+ Produk" }).click();
  await lap.locator('#daftarPilih input[value="KB-S"]').check();
  await lap.locator('#daftarPilih input[value="KB-M"]').check();
  await lap.locator("#simpanPilih").click();
  // Isian di atas tetap ada setelah memilih produk.
  assert.equal(await f.locator("[name=nama]").inputValue(), "Hikayat Fest Bandung");
  await f.locator('[data-v="0"]').fill("99000");
  await lap.screenshot({ path: SHOTS + "e1-form-event.png", fullPage: true });
  await f.locator("button.primary").click();
  await lap.getByRole("heading", { name: "Hikayat Fest Bandung" }).waitFor();
  await lap.getByText("Event ini belum punya stok").waitFor();

  // Kirim stok, isi otomatis 30%.
  await lap.getByRole("button", { name: "Kirim Stok" }).click();
  await lap.getByRole("button", { name: "Isi otomatis 30% stok gudang" }).click();
  assert.equal(await lap.locator('#fKt [data-n="0"]').inputValue(), "6");
  await lap.locator('#fKt [data-n="0"]').fill("99");
  assert.equal(await lap.locator('#fKt [data-n="0"]').inputValue(), "20"); // diturunkan ke batas stok gudang
  await lap.locator('#fKt [data-n="0"]').fill("10");
  await lap.locator("#fKt button.primary").click();
  await lap.getByRole("heading", { name: "Mutasi stok" }).waitFor();
  assert.match(await lap.locator("table").nth(1).textContent(), /MT\/\d{6}\/0001.*Kirim.*16.*Dikirim/s);
  await lap.screenshot({ path: SHOTS + "e2-detail-event.png", fullPage: true });

  // ---------- HP: Sari menerima kiriman (KB-M kurang 1), jual, opname ----------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => galat.push("pos: " + e.message));
  const ketik = async (pin) => { for (const d of pin) await hp.locator(`#pad [data-k="${d}"]`).click(); };
  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar [name=kode]").fill(kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByRole("button", { name: /Sari Handayani/ }).click();
  await ketik("333333");
  // Ganti PIN sementara: lama, baru, ulangi.
  await hp.getByText("PIN Anda masih sementara").waitFor();
  await ketik("333333");
  await hp.getByText("Masukkan PIN baru").waitFor();
  await ketik("481526");
  await hp.getByText("Ulangi PIN baru").waitFor();
  await ketik("481526");
  await hp.getByRole("button", { name: /Hikayat Fest Bandung/ }).click();
  await hp.locator("#fBuka [name=modal]").fill("100000");
  await hp.getByRole("button", { name: "Buka Kasir" }).click();
  await hp.getByText("1 kiriman stok belum diterima").click();
  await hp.locator("#keTerima").click();
  await hp.locator("[data-mutasi]").first().click();
  await hp.locator('#fTerima [data-sku="KB-M"]').fill("5");
  await hp.getByText("Kurang 1 pcs").waitFor();
  await hp.locator("#fTerima button.primary").click();
  await hp.locator("#fTerima .err:not([hidden])").waitFor(); // catatan wajib
  await hp.locator("#fTerima [name=catatan]").fill("Satu kaos M tidak ada di kardus");
  await hp.screenshot({ path: SHOTS + "e3-terima.png", fullPage: true });
  await hp.locator("#fTerima button.primary").click();
  await hp.getByText("Sudah diterima").waitFor();
  await hp.locator("#kembali").click();
  const kartu = hp.locator(".kartu", { hasText: "Kaos Burtuqol" });
  assert.match(await kartu.textContent(), /Rp 99\.000\+.*Sisa 15.*harga event/s);
  await kartu.click();
  await hp.locator('#lembar button[data-k="+"][data-sku="KB-S"]').click();
  await hp.locator("#selesaiVarian").click();
  await hp.locator("#btnBayar").click();
  await hp.locator('.metode [data-m="tunai"]').click();
  await hp.locator("#lanjutPembayaran").click();
  await hp.getByRole("button", { name: "Uang pas" }).click();
  await hp.locator("#lunas").click();
  await hp.getByText("Lunas Rp 99.000").waitFor();
  await hp.getByRole("button", { name: "Transaksi baru" }).click();
  // Opname: KB-S fisik 8 (sistem 9).
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="inventori"]').click();
  await hp.locator('[data-tab="opname"]').click();
  await hp.locator("#hitung").click();
  await hp.locator('#fOpname [data-sku="KB-S"]').fill("8");
  await hp.getByText("Kurang 1 · lebih 0").waitFor();
  await hp.locator("#fOpname [name=catatan]").fill("Satu kaos S hilang");
  await hp.screenshot({ path: SHOTS + "e4-opname.png", fullPage: true });
  await hp.locator("#fOpname button.primary").click();
  await hp.getByText("Menunggu persetujuan").waitFor();
  for (let i = 0; i < 50 && !sql("SELECT 1 FROM opname").length; i++) await hp.waitForTimeout(100);
  // Tutup kasir.
  await hp.locator("#kembali").click();
  await hp.locator("#btnMenu").click();
  await hp.locator('[data-m="tutup"]').click();
  await hp.locator("#fTutup [name=hitung]").fill("199000");
  await hp.locator("#fTutup button.primary").click();
  await ketik("481526");
  await hp.getByText("Kasir ditutup").waitFor();
  for (let i = 0; i < 50 && sql("SELECT status FROM shift")[0]?.status !== "tutup"; i++) await hp.waitForTimeout(100);

  // ---------- Dashboard: Owner menutup event memakai opname kasir ----------
  await lap.reload();
  await lap.getByRole("button", { name: "Event", exact: true }).click();
  await lap.locator("tr[data-id]").first().click();
  await lap.getByText("Menunggu persetujuan").first().waitFor();
  await lap.getByRole("button", { name: "Tutup Event" }).click();
  await lap.getByText("Stok opname SO/").waitFor();
  assert.equal(await lap.locator('#fTutup [data-sku="KB-S"]').inputValue(), "8");
  assert.equal(await lap.locator("#totalRugi").textContent(), "Rp 55.000");
  // Penjelasan terisi dari catatan kasir; dikosongkan → ditolak.
  assert.equal(await lap.locator("#fTutup [name=penjelasan]").inputValue(), "Satu kaos S hilang");
  await lap.locator("#fTutup [name=penjelasan]").fill("");
  await lap.locator("#fTutup button.primary").click();
  await lap.locator("#fTutup .err:not([hidden])").waitFor();
  await lap.locator("#fTutup [name=penjelasan]").fill("Satu kaos S hilang di booth");
  await lap.screenshot({ path: SHOTS + "e5-tutup-event.png", fullPage: true });
  await lap.locator("#fTutup button.primary").click();
  await lap.getByText("Event ditutup").first().waitFor();
  assert.match(await lap.locator("#popupIsi").textContent(), /13 pcs kembali ke Gudang Pusat.*Rp 55\.000/s);
  await lap.locator("#tutupPopup").click();
  assert.deepEqual(sql("SELECT sku, qty FROM stok WHERE lokasi_id = 'gudang' ORDER BY sku"), [{ sku: "KB-M", qty: 20 - 6 + 5 }, { sku: "KB-S", qty: 20 - 10 + 8 }]);

  // ---------- Laporan › Selisih & Kerugian ----------
  await lap.getByRole("button", { name: "Laporan", exact: true }).click();
  await lap.locator('#nav [data-nav="laporan/kerugian"]').click();
  await lap.getByText("Kiriman kurang").waitFor();
  assert.match(await lap.locator(".kpis").textContent(), /Total kerugian\s*Rp 110\.000/);
  await lap.locator("tr", { hasText: "Kiriman kurang" }).locator("[data-selesai]").click();
  await lap.locator("#fSel [name=jumlah]").fill("2000");
  await lap.locator("#fSel button.primary").click();
  await lap.getByText("Diganti sebagian").waitFor();
  await lap.screenshot({ path: SHOTS + "e6-kerugian.png", fullPage: true });

  assert.deepEqual(galat, []);
  console.log("ok: alur event di browser berhasil. Tangkapan layar di shots/");
} finally {
  await browser.close();
  server.close();
}
