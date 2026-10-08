// Uji tampilan di Chromium: setup Owner, tambah kasir, daftarkan HP, kasir masuk POS dan ganti PIN.
// Butuh Playwright (terpasang global). Jalankan: node build.mjs && node tests/browser-fondasi.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8799;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const { server } = await jalankan(PORT);
const browser = await chromium.launch();
const galat = [];
try {
  // ---------- Laptop: dashboard ----------
  const laptop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  laptop.on("pageerror", (e) => galat.push("dashboard: " + e.message));
  await laptop.goto(ALAMAT);
  await laptop.locator("#fSetup").waitFor();
  const setup = laptop.locator("#fSetup");
  await setup.locator("[name=kode]").fill("SETUP-LOKAL");
  await setup.locator("[name=nama]").fill("Rina Wijaya");
  await setup.locator("[name=email]").fill("rina@hikayat.id");
  await setup.locator("[name=password]").fill("hikayat123");
  await setup.locator("[name=pin]").fill("135790");
  await setup.locator("button.primary").click();

  await laptop.locator("#fMasuk").waitFor();
  await laptop.locator("#fMasuk [name=password]").fill("salah1234");
  await laptop.locator("#fMasuk button.primary").click();
  await laptop.locator("#fMasuk .err:not([hidden])").waitFor();
  assert.match(await laptop.locator("#fMasuk .err").textContent(), /Sisa 4/);
  await laptop.locator("#fMasuk [name=password]").fill("hikayat123");
  await laptop.locator("#fMasuk button.primary").click();
  await laptop.getByRole("heading", { name: "Penjualan" }).waitFor();
  await laptop.getByRole("button", { name: "Karyawan" }).click();
  await laptop.getByRole("heading", { name: "Karyawan" }).waitFor();

  await laptop.getByRole("button", { name: "+ Karyawan" }).click();
  await laptop.locator("#fK [name=nama]").fill("Sari Handayani");
  await laptop.locator("#fK [value=kasir]").check();
  await laptop.locator("#fK [name=pin]").fill("333333");
  await laptop.locator("#fK button.primary").click();
  await laptop.locator("#popup:not([hidden])").waitFor();
  assert.match(await laptop.locator("#popupIsi").textContent(), /PIN sementara: 333333/);
  await laptop.screenshot({ path: SHOTS + "1-karyawan-baru.png" });
  await laptop.locator("#tutupPopup").click();
  assert.match(await laptop.locator("table").textContent(), /Sari Handayani.*Kasir.*POS saja.*PIN sementara/s);
  await laptop.screenshot({ path: SHOTS + "2-daftar-karyawan.png" });

  await laptop.getByRole("button", { name: "Perangkat POS" }).click();
  await laptop.getByRole("button", { name: "+ Daftarkan HP" }).click();
  await laptop.locator("#fHp [name=nama]").fill("HP Booth 1");
  await laptop.locator("#fHp button.primary").click();
  await laptop.locator("#popup:not([hidden]) .kode").waitFor();
  const kode = (await laptop.locator(".kode").textContent()).trim();
  assert.match(kode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await laptop.screenshot({ path: SHOTS + "3-kode-hp.png" });
  await laptop.locator("#tutupPopup").click();

  // ---------- HP: POS ----------
  const hp = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  hp.on("pageerror", (e) => galat.push("pos: " + e.message));
  await hp.goto(ALAMAT + "/pos");
  await hp.locator("#fDaftar").waitFor();
  await hp.locator("#fDaftar [name=kode]").pressSequentially(kode.replace("-", "").toLowerCase());
  assert.equal(await hp.locator("#fDaftar [name=kode]").inputValue(), kode);
  await hp.locator("#fDaftar button").click();
  await hp.getByText("Siapa yang bertugas?").waitFor();
  assert.match(await hp.locator(".bar").textContent(), /HP A1/);
  await hp.screenshot({ path: SHOTS + "4-pos-pilih-nama.png" });

  const ketik = async (pin) => { for (const d of pin) await hp.locator(`#pad [data-k="${d}"]`).click(); };
  await hp.getByRole("button", { name: /Sari Handayani/ }).click();
  await ketik("000000");
  await hp.locator("#pinErr:not([hidden])").waitFor();
  assert.match(await hp.locator("#pinErr").textContent(), /PIN salah/);
  await ketik("333333");
  await hp.getByText("PIN Anda masih sementara").waitFor();
  await hp.screenshot({ path: SHOTS + "5-pos-ganti-pin.png" });
  await ketik("333333");
  await ketik("482913");
  await ketik("482913");
  // Kasir belum ditugaskan di event mana pun (event menyusul di tahap 4).
  await hp.getByText("Belum ada tempat jualan").waitFor();
  assert.match(await hp.locator(".bar").textContent(), /Sari Handayani/);
  await hp.screenshot({ path: SHOTS + "6-pos-masuk.png" });

  // Muat ulang: HP tetap terdaftar, kasir tetap masuk.
  await hp.reload();
  await hp.getByText("Belum ada tempat jualan").waitFor();

  // ---------- Owner menonaktifkan HP ----------
  await laptop.getByRole("button", { name: "Perangkat POS" }).click();
  await laptop.locator("td .tag.aktif").waitFor();
  laptop.once("dialog", (d) => d.accept());
  await laptop.getByRole("button", { name: "Nonaktifkan" }).click();
  await laptop.locator("td .tag.off").waitFor();
  await laptop.screenshot({ path: SHOTS + "7-hp-nonaktif.png" });

  await hp.reload();
  await hp.locator("#fDaftar").waitFor();

  await laptop.getByRole("button", { name: "Riwayat Masuk" }).click();
  const riwayat = await laptop.locator("table").textContent();
  for (const a of ["Password salah", "PIN salah", "Ganti PIN", "HP terdaftar", "Nonaktifkan HP"]) assert.ok(riwayat.includes(a), a);
  await laptop.screenshot({ path: SHOTS + "8-riwayat.png" });

  assert.deepEqual(galat, []);
  console.log("ok: alur dashboard dan POS di browser berhasil. Tangkapan layar di shots/");
} finally {
  await browser.close();
  server.close();
}
