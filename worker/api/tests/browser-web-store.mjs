// Uji tampilan tahap 9 di Chromium: foto produk (unggah, urutan, lepas), sakelar Toko web 2Mimbar, foto varian,
// harga toko web, berat, dan daftar produk dengan foto utama serta filter.
// Jalankan: node build.mjs && node tests/browser-web-store.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import { jalankan } from "./server-lokal.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright");

const PORT = 8803;
const ALAMAT = `http://localhost:${PORT}`;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

// PNG RGBA sederhana tanpa paket npm. warna = [r, g, b, a]; acak = isi acak supaya file besar dan sulit dikompres.
function png(lebar, tinggi, warna, acak = false) {
  const baris = Buffer.alloc((lebar * 4 + 1) * tinggi);
  for (let y = 0; y < tinggi; y++) {
    const o = y * (lebar * 4 + 1);
    for (let x = 0; x < lebar; x++) {
      const i = o + 1 + x * 4;
      if (acak) for (let k = 0; k < 4; k++) baris[i + k] = Math.random() * 256;
      // Kotak putih di tengah, supaya tiap foto mudah dibedakan di tangkapan layar.
      else if (Math.abs(x - lebar / 2) < lebar / 6 && Math.abs(y - tinggi / 2) < tinggi / 6 && warna[3] === 255) baris.set([250, 250, 250, 255], i);
      else baris.set(warna, i);
    }
  }
  const potong = (jenis, data) => {
    const panjang = Buffer.alloc(4);
    panjang.writeUInt32BE(data.length);
    const isi = Buffer.concat([Buffer.from(jenis), data]);
    const cek = Buffer.alloc(4);
    cek.writeUInt32BE(crc32(isi));
    return Buffer.concat([panjang, isi, cek]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lebar, 0);
  ihdr.writeUInt32BE(tinggi, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), potong("IHDR", ihdr), potong("IDAT", deflateSync(baris)), potong("IEND", Buffer.alloc(0))]);
}
const file = (name, buffer, mimeType = "image/png") => ({ name, mimeType, buffer });

const { server, env } = await jalankan(PORT);
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
  await hal.getByRole("heading", { name: "Dashboard Penjualan" }).waitFor();

  // Kategori dan satu produk lama tanpa foto, lewat API dari halaman yang sudah masuk.
  await hal.evaluate(async () => {
    const kirim = async (path, body) => {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };
    const { id } = await kirim("/api/kategori", { nama: "Kaos", urutan: 1 });
    await kirim("/api/produk", { nama: "Stiker Pack Hikayat", sku: "STK", kategori_id: id, hpp: 4000, harga_jual: 15000 });
  });
  await hal.reload();
  await hal.getByRole("button", { name: "Produk", exact: true }).click();
  await hal.locator("#tbProduk tr", { hasText: "Stiker Pack Hikayat" }).waitFor();
  assert.match(await hal.locator("#tbProduk tr", { hasText: "Stiker Pack Hikayat" }).textContent(), /belum ada foto/);

  // Produk baru bervarian.
  await hal.getByRole("button", { name: "+ Tambah Produk" }).click();
  const fp = hal.locator("#fP");
  await fp.locator("[name=nama]").fill("Kaos Hikayat Premium");
  await fp.locator("[name=kategori_id]").selectOption({ label: "Kaos" });
  await fp.locator("[name=sku]").fill("KHP");
  await fp.locator("[name=hpp]").fill("62000");
  await fp.locator("[name=deskripsi]").fill("Kaos katun combed 30s yang adem.\nTabel ukuran ada di foto terakhir.");
  assert.equal(await hal.locator("#fotoProduk .fp-tambah").textContent(), "+Tambah foto0 / 9");

  // File yang salah ditolak di browser sebelum diunggah.
  await hal.locator("#fileFoto").setInputFiles([file("catatan.txt", Buffer.from("bukan foto"), "text/plain"), file("besar.png", png(1300, 1300, null, true))]);
  await hal.locator("#pesanFoto").waitFor();
  assert.match(await hal.locator("#pesanFoto").textContent(), /catatan\.txt bukan JPG atau PNG.*besar\.png lebih dari 5 MB/);
  assert.equal(await hal.locator("#fotoProduk [data-fi]").count(), 0);

  // Tiga foto: navy 1600x1200, krem, dan PNG transparan.
  await hal.locator("#fileFoto").setInputFiles([
    file("hitam.png", png(1600, 1200, [2, 25, 79, 255])),
    file("krem.png", png(800, 800, [232, 220, 196, 255])),
    file("transparan.png", png(500, 500, [0, 0, 0, 0])),
  ]);
  await hal.locator("#fotoProduk [data-fi]").nth(2).waitFor();
  await hal.locator("#fotoProduk .fp-muat").waitFor({ state: "detached" });
  assert.equal(await hal.locator("#pesanFoto").isHidden(), true);
  assert.match(await hal.locator("#fotoProduk .fp-tambah").textContent(), /3 \/ 9/);
  const srcFoto = () => hal.locator("#fotoProduk [data-fi] img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  const [navy, krem, transparan] = await srcFoto();
  assert.match(navy, /^\/foto\/produk\/[0-9A-Z]{26}\/kecil$/);
  assert.equal(await hal.locator('[data-fi="0"] .fp-utama').textContent(), "Foto utama");

  // Ukuran hasil kecil di browser: besar 1200 px, kecil 400 px, dan bagian transparan menjadi putih.
  const ukuran = await hal.evaluate(async ([a, b]) => {
    const bmp = async (src) => createImageBitmap(await (await fetch(src)).blob());
    const besar = await bmp(a.replace("/kecil", "/besar")), kecil = await bmp(a);
    const t = await bmp(b);
    const c = new OffscreenCanvas(t.width, t.height), g = c.getContext("2d");
    g.drawImage(t, 0, 0);
    return { besar: [besar.width, besar.height], kecil: [kecil.width, kecil.height], piksel: [...g.getImageData(10, 10, 1, 1).data] };
  }, [navy, transparan]);
  assert.deepEqual(ukuran.besar, [1200, 900]);
  assert.deepEqual(ukuran.kecil, [400, 300]);
  assert.ok(ukuran.piksel.slice(0, 3).every((n) => n > 245), `piksel transparan harus putih: ${ukuran.piksel}`);

  // Seret foto ketiga ke depan: foto itu menjadi foto utama.
  await hal.locator('#fotoProduk [data-fi="2"]').dragTo(hal.locator('#fotoProduk [data-fi="0"]'));
  assert.deepEqual(await srcFoto(), [transparan, navy, krem]);
  assert.equal(await hal.locator('[data-fi="0"] img').getAttribute("src"), transparan);
  // Lepas foto transparan lagi, urutan kembali navy lalu krem.
  await hal.getByRole("button", { name: "Lepas foto 1" }).click();
  assert.deepEqual(await srcFoto(), [navy, krem]);

  // Varian, sakelar Toko web, harga toko web, berat, dan foto varian.
  await fp.locator("#pakaiVarian").check();
  const v = (i, k) => fp.locator(`[data-i="${i}"][data-k="${k}"]`);
  assert.equal(await v(0, "htw").count(), 0, "kolom harga toko web muncul setelah sakelar dinyalakan");
  await fp.locator("#tokoWeb").check();
  await v(0, "htw").waitFor();
  for (const i of [0, 1, 2]) await v(i, "harga_jual").fill("135000");
  await v(0, "htw").fill("130000");
  await v(0, "berat_gram").fill("220");
  await v(1, "berat_gram").fill("230");
  await v(0, "stok_awal").fill("26");
  await fp.locator('[data-fv="1"]').click();
  await fp.locator(`[data-fvset="1"][data-foto="${krem.split("/")[3]}"]`).click();
  assert.equal(await fp.locator('[data-fv="1"] img').getAttribute("src"), krem);
  // Varian L belum punya berat: server menolak, isian form tidak hilang.
  await fp.locator("button.primary").click();
  await fp.locator(".err").waitFor();
  assert.equal(await fp.locator(".err").textContent(), "Isi berat varian L sebelum menyalakan Toko web");
  assert.equal(await v(0, "htw").inputValue(), "130000");
  await v(2, "berat_gram").fill("240");
  await fp.locator('[data-fv="0"]').click();
  await fp.locator(`[data-fvset="0"][data-foto="${navy.split("/")[3]}"]`).click();
  await hal.screenshot({ path: SHOTS + "w1-form-produk.png", fullPage: true });
  await fp.locator("button.primary").click();

  // Daftar produk: foto utama, tag Toko web, dan filter.
  const baris = hal.locator("#tbProduk tr", { hasText: "Kaos Hikayat Premium" });
  await baris.waitFor();
  assert.equal(await baris.locator("img.thumb").getAttribute("src"), navy);
  assert.match(await baris.textContent(), /Toko web/);
  assert.doesNotMatch(await baris.textContent(), /belum ada foto/);
  assert.match(await hal.locator('[data-tampilp="toko_web"]').textContent(), /Dijual di toko web\s*1/);
  assert.match(await hal.locator('[data-tampilp="tanpa_foto"]').textContent(), /Belum ada foto\s*1/);
  await hal.locator('[data-tampilp="tanpa_foto"]').click();
  assert.equal(await hal.locator("#tbProduk tr[data-id]").count(), 1);
  assert.match(await hal.locator("#tbProduk").textContent(), /Stiker Pack Hikayat/);
  await hal.locator('[data-tampilp="toko_web"]').click();
  assert.equal(await hal.locator("#tbProduk tr[data-id]").count(), 1);
  await baris.locator("[data-buka]").click();
  assert.match(await hal.locator("#tbProduk").textContent(), /KHP-S · 220 g.*Toko web Rp 130\.000/s);
  await hal.screenshot({ path: SHOTS + "w2-daftar-produk.png" });

  // Data tersimpan di server, foto terbuka tanpa login.
  const p = (await (await hal.request.get(`${ALAMAT}/api/produk`)).json()).produk.find((x) => x.sku === "KHP");
  assert.equal(p.toko_web, true);
  assert.equal(p.deskripsi, "Kaos katun combed 30s yang adem.\nTabel ukuran ada di foto terakhir.");
  assert.deepEqual(p.foto.map((x) => x.kecil), [navy, krem]);
  const vs = Object.fromEntries(p.varian.map((x) => [x.nama, x]));
  assert.deepEqual([vs.S.berat_gram, vs.S.harga_toko_web, vs.S.foto_id, vs.M.foto_id, vs.L.berat_gram], [220, 130000, navy.split("/")[3], krem.split("/")[3], 240]);
  const publik = await fetch(ALAMAT + navy.replace("/kecil", "/besar"));
  assert.equal(publik.status, 200);
  assert.equal(publik.headers.get("cache-control"), "public, max-age=31536000, immutable");
  // Foto transparan yang dilepas sebelum disimpan tidak terpasang ke produk mana pun.
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM produk_foto").get().n, 2);

  // Buka lagi: isian tampil kembali. Lepas foto krem, foto varian M ikut kosong.
  await hal.locator('[data-tampilp="semua"]').click();
  await baris.locator("[data-ubah]").click();
  await fp.waitFor();
  assert.deepEqual(await srcFoto(), [navy, krem]);
  assert.equal(await fp.locator("#tokoWeb").isChecked(), true);
  assert.equal(await v(0, "htw").inputValue(), "130000");
  assert.equal(await v(2, "berat_gram").inputValue(), "240");
  assert.equal(await fp.locator('[data-fv="1"] img').getAttribute("src"), krem);
  await hal.getByRole("button", { name: "Lepas foto 2" }).click();
  assert.equal(await fp.locator('[data-fv="1"] img').count(), 0);
  // Pilihan foto varian tertutup saat mengeklik di luar.
  await fp.locator('[data-fv="0"]').click();
  await fp.locator(".fv-menu").waitFor();
  await fp.locator("[name=nama]").click();
  assert.equal(await fp.locator(".fv-menu").count(), 0);
  await fp.locator("button.primary").click();
  await baris.waitFor();
  const p2 = (await (await hal.request.get(`${ALAMAT}/api/produk`)).json()).produk.find((x) => x.sku === "KHP");
  assert.deepEqual(p2.foto.map((x) => x.kecil), [navy]);
  assert.equal(p2.varian.find((x) => x.nama === "M").foto_id, null);

  // Produk tanpa varian: berat dan harga toko web di form utama.
  await hal.locator("#tbProduk tr", { hasText: "Stiker Pack Hikayat" }).locator("[data-ubah]").click();
  await fp.waitFor();
  await fp.locator("#tokoWeb").check();
  await fp.locator("#hargaTw").fill("14000");
  await fp.locator("#beratTunggal").fill("20");
  await fp.locator("button.primary").click();
  await fp.locator(".err").waitFor();
  assert.equal(await fp.locator(".err").textContent(), "Tambahkan minimal satu foto produk sebelum menyalakan Toko web");
  await hal.locator("#fileFoto").setInputFiles([file("stiker.png", png(600, 600, [200, 60, 60, 255]))]);
  await hal.locator("#fotoProduk [data-fi]").first().waitFor();
  await fp.locator("button.primary").click();
  await hal.locator("#tbProduk tr", { hasText: "Stiker Pack Hikayat" }).locator("img.thumb").waitFor();
  assert.match(await hal.locator('[data-tampilp="tanpa_foto"]').textContent(), /Belum ada foto\s*0/);

  // Layar sempit: kotak foto dan tabel varian tetap bisa dipakai.
  await hal.setViewportSize({ width: 390, height: 844 });
  await baris.locator("[data-ubah]").click();
  await fp.waitFor();
  await hal.screenshot({ path: SHOTS + "w3-form-produk-hp.png", fullPage: true });

  assert.deepEqual(galat, []);
  console.log("ok: foto produk, toko web, berat, dan foto varian di browser berhasil. Tangkapan layar di shots/");
} finally {
  await browser.close();
  server.close();
}
