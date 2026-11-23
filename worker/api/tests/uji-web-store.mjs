// Uji tahap 9: foto publik di R2, foto produk, sakelar Toko web, berat dan foto per varian, harga toko web.
import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../dist/index.js";
import { lingkungan, siapkanHp, siapkanOwner } from "./bantu.mjs";

const L = lingkungan();
const { api, ok, sql, env } = L;
let ownerId, kaos;

// Isi file palsu yang lolos pemeriksaan jenis: Worker hanya membaca beberapa byte pertama.
const jpeg = (n = 2000, isi = 7) => { const b = new Uint8Array(n).fill(isi); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };
const webp = (n = 2000) => { const b = new Uint8Array(n); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b; };
const png = (n = 2000) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47]); return b; };

async function unggah(file = { besar: jpeg(5000, 1), kecil: jpeg(1200, 2) }, opsi = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(file)) form.append(k, new Blob([v]), k + ".jpg");
  const h = { "cf-connecting-ip": "10.0.0.1" };
  const cookie = opsi.cookie === undefined ? L.c.cookie : opsi.cookie;
  if (cookie) h.cookie = cookie;
  const res = await worker.fetch(new Request(`https://hikayat.test/api/foto?jenis=${opsi.jenis ?? "produk"}`, { method: "POST", headers: h, body: form }), opsi.env ?? env);
  return { status: res.status, data: await res.json() };
}
const fotoBaru = async () => ok(await unggah(), 201).id;
const buka = (path, headers = {}, e = env) => worker.fetch(new Request("https://hikayat.test" + path, { headers }), e);
const gagal = async (r, status, pola) => {
  assert.equal(r.status, status, JSON.stringify(r.data));
  if (pola) assert.match(r.data.error, pola);
};

test("migrasi 0008 menambah tabel foto dan kolom web store", async () => {
  ownerId = await siapkanOwner(L);
  const kolom = (t) => sql(`PRAGMA table_info(${t})`).map((c) => c.name);
  assert.ok(kolom("produk").includes("toko_web"));
  assert.ok(kolom("varian").includes("berat_gram") && kolom("varian").includes("foto_id"));
  assert.deepEqual(kolom("produk_foto"), ["foto_id", "produk_id", "urutan"]);
  assert.ok(kolom("foto").includes("jenis"));
  kaos = ok(await api("POST", "/api/kategori", { nama: "Kaos", urutan: 1 }), 201).id;
});

test("unggah foto produk: dua ukuran masuk R2, isi dan ukuran diperiksa", async () => {
  await gagal(await unggah(undefined, { cookie: null }), 401);
  await gagal(await unggah(undefined, { jenis: "bukti_biaya" }), 400, /Jenis foto/);
  await gagal(await unggah({ besar: jpeg() }), 400, /ukuran kecil/);
  await gagal(await unggah({ besar: png(), kecil: png() }), 415, /JPEG atau WebP/);
  await gagal(await unggah({ besar: jpeg(1_600_000), kecil: jpeg() }), 413, /besar maksimal 1,5 MB/);
  await gagal(await unggah({ besar: jpeg(), kecil: jpeg(400_000) }), 413, /kecil maksimal 300 KB/);
  await gagal(await unggah({ besar: jpeg(), kecil: webp() }), 400, /format sama/);
  await gagal(await unggah({ besar: jpeg(), kecil: new Uint8Array(0) }), 400, /kosong/);
  assert.equal(sql("SELECT COUNT(*) AS n FROM foto")[0].n, 0);
  assert.equal(env.FOTO.isi.size, 0);

  const r = ok(await unggah(), 201);
  assert.equal(r.besar, `/foto/produk/${r.id}/besar`);
  assert.equal(r.kecil, `/foto/produk/${r.id}/kecil`);
  assert.deepEqual([...env.FOTO.isi.keys()].sort(), [`produk/${r.id}/besar`, `produk/${r.id}/kecil`]);
  assert.equal(env.FOTO.isi.get(`produk/${r.id}/besar`).httpMetadata.contentType, "image/jpeg");
  const [baris] = sql("SELECT jenis, mime, ukuran, dibuat_oleh FROM foto WHERE id = ?", r.id);
  assert.deepEqual(baris, { jenis: "produk", mime: "image/jpeg", ukuran: 6200, dibuat_oleh: ownerId });

  // Worker tanpa binding R2 menolak dengan pesan yang jelas.
  await gagal(await unggah(undefined, { env: { ...env, FOTO: undefined } }), 503, /bucket R2/);
});

test("foto publik dibuka tanpa login dan tanpa D1, dengan cache panjang", async () => {
  const id = await fotoBaru();
  // D1 sengaja dibuat rusak: alamat foto publik tidak boleh menyentuh database.
  const tanpaDb = { ...env, DB: { prepare() { throw new Error("D1 tidak boleh dibaca"); } } };
  const res = await buka(`/foto/produk/${id}/kecil`, {}, tanpaDb);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
  assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), jpeg(1200, 2));
  const etag = res.headers.get("etag");
  assert.ok(etag);
  assert.equal((await buka(`/foto/produk/${id}/kecil`, { "if-none-match": etag })).status, 304);

  assert.equal((await buka(`/foto/produk/01J00000000000000000000000/besar`)).status, 404);
  assert.equal((await buka(`/foto/produk/${id}/sedang`)).status, 404);
  assert.equal((await buka(`/foto/bukti_biaya/${id}/besar`)).status, 404);
  assert.equal((await buka(`/foto/produk/../${id}/besar`)).status, 404);
  assert.equal((await worker.fetch(new Request(`https://hikayat.test/foto/produk/${id}/besar`, { method: "POST" }), env)).status, 405);
});

let f1, f2, f3, kaosId;

test("produk bervarian dengan foto, toko web, berat, foto varian, dan harga toko web", async () => {
  [f1, f2, f3] = [await fotoBaru(), await fotoBaru(), await fotoBaru()];
  const r = ok(await api("POST", "/api/produk", {
    nama: "Kaos Hikayat", sku: "KH", kategori_id: kaos, hpp: 60000, deskripsi: "Katun combed 30s.\nTabel ukuran di foto terakhir.",
    foto: [f1, f2, f3], toko_web: true,
    varian: [
      { nama: "S", harga_jual: 135000, berat_gram: 220, foto_id: f1, harga_toko_web: 130000 },
      { nama: "M", harga_jual: 135000, berat_gram: 230, foto_id: f2 },
      { nama: "L", harga_jual: 135000, aktif: false }, // varian nonaktif tidak wajib punya berat
    ],
  }), 201);
  kaosId = r.id;
  const p = ok(await api("GET", "/api/produk/" + kaosId)).produk;
  assert.equal(p.toko_web, true);
  assert.equal(p.deskripsi, "Katun combed 30s.\nTabel ukuran di foto terakhir.");
  assert.deepEqual(p.foto.map((f) => f.id), [f1, f2, f3]);
  assert.equal(p.foto[0].kecil, `/foto/produk/${f1}/kecil`);
  const v = Object.fromEntries(p.varian.map((x) => [x.nama, x]));
  assert.deepEqual([v.S.berat_gram, v.S.foto_id, v.S.harga_toko_web], [220, f1, 130000]);
  assert.deepEqual([v.M.berat_gram, v.M.foto_id, v.M.harga_toko_web], [230, f2, null]);
  assert.deepEqual([v.L.berat_gram, v.L.aktif], [null, false]);
  assert.deepEqual(sql("SELECT sku, harga FROM harga_saluran WHERE saluran = 'toko_web'"), [{ sku: "KH-S", harga: 130000 }]);

  const d = ok(await api("GET", "/api/produk")).produk.find((x) => x.id === kaosId);
  assert.equal(d.toko_web, true);
  assert.equal(d.foto[0].id, f1);
  assert.equal(d.varian.find((x) => x.sku === "KH-S").harga_toko_web, 130000);
});

test("sakelar toko web butuh foto dan berat setiap varian aktif", async () => {
  const dasar = { nama: "Hoodie", kategori_id: kaos, hpp: 100000 };
  await gagal(await api("POST", "/api/produk", { ...dasar, sku: "HD1", toko_web: true, varian: [{ nama: "M", harga_jual: 250000, berat_gram: 500 }] }), 400, /minimal satu foto/);
  const f = await fotoBaru();
  await gagal(await api("POST", "/api/produk", {
    ...dasar, sku: "HD2", toko_web: true, foto: [f],
    varian: [{ nama: "M", harga_jual: 250000, berat_gram: 500 }, { nama: "L", harga_jual: 250000 }],
  }), 400, /Isi berat varian L/);
  await gagal(await api("POST", "/api/produk", { ...dasar, sku: "HD3", toko_web: true, foto: [f], harga_jual: 250000 }), 400, /Isi berat produk/);
  assert.equal(sql("SELECT COUNT(*) AS n FROM produk WHERE sku LIKE 'HD%'")[0].n, 0);

  // Sakelar mati: foto dan berat boleh kosong, sama seperti produk lama.
  ok(await api("POST", "/api/produk", { ...dasar, sku: "HD4", harga_jual: 250000 }), 201);
  // Saat toko web menyala, foto terakhir tidak bisa dilepas dan berat tidak bisa dikosongkan.
  await gagal(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), foto: [] }), 400, /minimal satu foto/);
  await gagal(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), varian: formKaos().varian.map((v) => (v.sku === "KH-M" ? { ...v, berat_gram: null } : v)) }), 400, /Isi berat varian M/);
});

test("foto harus diunggah, unik, paling banyak 9, dan milik produk sendiri", async () => {
  const dasar = { nama: "Topi", sku: "TP", kategori_id: kaos, hpp: 20000, harga_jual: 55000 };
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: [f1] }), 409, /dipakai produk lain/);
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: ["01J00000000000000000000000"] }), 400, /Unggah ulang/);
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: ["bukan-id"] }), 400, /Daftar foto tidak valid/);
  const f = await fotoBaru();
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: [f, f] }), 400, /dobel/);
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: Array.from({ length: 10 }, () => f) }), 400, /maksimal 9/);
  await gagal(await api("POST", "/api/produk", {
    ...dasar, foto: [f], varian: [{ nama: "Navy", harga_jual: 55000, foto_id: f1 }],
  }), 400, /Foto varian Navy harus dipilih dari foto produk/);
  // Bukti biaya di tabel berkas D1 bukan foto produk, jadi tidak bisa dipasang ke produk.
  const bukti = ok(await api("POST", "/api/berkas?jenis=bukti_biaya", jpeg()), 201).id;
  await gagal(await api("POST", "/api/produk", { ...dasar, foto: [bukti] }), 400, /Unggah ulang/);
  assert.equal(sql("SELECT COUNT(*) AS n FROM produk WHERE sku = 'TP'")[0].n, 0);
});

// Isi form produk Kaos Hikayat seperti yang dikirim dashboard lama, tanpa isian web store.
function formKaos() {
  return {
    nama: "Kaos Hikayat", kategori_id: kaos, hpp: 60000, deskripsi: "Katun combed 30s.\nTabel ukuran di foto terakhir.", tampil_pos: true, aktif: true,
    varian: [
      { sku: "KH-S", nama: "S", harga_jual: 135000, aktif: true },
      { sku: "KH-M", nama: "M", harga_jual: 135000, aktif: true },
      { sku: "KH-L", nama: "L", harga_jual: 135000, aktif: false },
    ],
  };
}

test("dashboard lama yang tidak mengirim isian web store tidak menghapusnya", async () => {
  ok(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), nama: "Kaos Hikayat Premium" }));
  const p = ok(await api("GET", "/api/produk/" + kaosId)).produk;
  assert.equal(p.nama, "Kaos Hikayat Premium");
  assert.equal(p.toko_web, true);
  assert.deepEqual(p.foto.map((f) => f.id), [f1, f2, f3]);
  const v = Object.fromEntries(p.varian.map((x) => [x.nama, x]));
  assert.deepEqual([v.S.berat_gram, v.S.foto_id, v.S.harga_toko_web, v.M.berat_gram, v.M.foto_id], [220, f1, 130000, 230, f2]);
});

test("urutan foto diubah, foto yang dilepas mengosongkan foto varian", async () => {
  ok(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), foto: [f3, f1] }));
  const p = ok(await api("GET", "/api/produk/" + kaosId)).produk;
  assert.deepEqual(p.foto.map((f) => f.id), [f3, f1]);
  assert.deepEqual(sql("SELECT foto_id, urutan FROM produk_foto WHERE produk_id = ? ORDER BY urutan", kaosId), [{ foto_id: f3, urutan: 0 }, { foto_id: f1, urutan: 1 }]);
  const v = Object.fromEntries(p.varian.map((x) => [x.nama, x]));
  assert.equal(v.S.foto_id, f1);
  assert.equal(v.M.foto_id, null);
  // Foto yang dilepas boleh dipakai produk lain.
  ok(await api("POST", "/api/produk", { nama: "Kaos Polos", sku: "KP", kategori_id: kaos, hpp: 40000, harga_jual: 90000, foto: [f2] }), 201);
});

test("berat, foto varian, dan harga toko web bisa diubah dan dikosongkan", async () => {
  const varian = formKaos().varian.map((v) => ({
    ...v,
    ...(v.sku === "KH-S" ? { harga_toko_web: null, foto_id: f3 } : {}),
    ...(v.sku === "KH-M" ? { harga_toko_web: 129000, berat_gram: 240 } : {}),
  }));
  varian.push({ nama: "XL", harga_jual: 140000, berat_gram: 260, foto_id: f1, harga_toko_web: 138000 });
  ok(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), varian }));
  const v = Object.fromEntries(ok(await api("GET", "/api/produk/" + kaosId)).produk.varian.map((x) => [x.nama, x]));
  assert.deepEqual([v.S.harga_toko_web, v.S.foto_id], [null, f3]);
  assert.deepEqual([v.M.harga_toko_web, v.M.berat_gram], [129000, 240]);
  assert.deepEqual([v.XL.sku, v.XL.berat_gram, v.XL.foto_id, v.XL.harga_toko_web], ["KH-XL", 260, f1, 138000]);
  assert.deepEqual(sql("SELECT sku, harga FROM harga_saluran WHERE saluran = 'toko_web' ORDER BY sku"), [{ sku: "KH-M", harga: 129000 }, { sku: "KH-XL", harga: 138000 }]);
  await gagal(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), varian: [{ sku: "KH-S", nama: "S", harga_jual: 1, berat_gram: 0 }] }), 400, /Berat varian 1 minimal 1/);
  await gagal(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), varian: [{ sku: "KH-S", nama: "S", harga_jual: 1, berat_gram: 60000 }] }), 400, /maksimal 50000/);

  // Sakelar dimatikan: foto dan berat tetap tersimpan.
  ok(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), toko_web: false }));
  const p = ok(await api("GET", "/api/produk/" + kaosId)).produk;
  assert.equal(p.toko_web, false);
  assert.equal(p.foto.length, 2);
  assert.match(sql("SELECT keterangan FROM log_aktivitas WHERE ref_id = ? ORDER BY waktu DESC, id DESC LIMIT 1", kaosId)[0].keterangan, /toko web dimatikan/);
});

test("produk tanpa varian: berat dan harga toko web di produk", async () => {
  const f = await fotoBaru();
  const r = ok(await api("POST", "/api/produk", {
    nama: "Tote Bag", sku: "TB", kategori_id: kaos, hpp: 30000, harga_jual: 75000, foto: [f], toko_web: true, berat_gram: 150, harga_toko_web: 72000,
  }), 201);
  let p = ok(await api("GET", "/api/produk/" + r.id)).produk;
  assert.deepEqual([p.toko_web, p.varian[0].berat_gram, p.varian[0].harga_toko_web], [true, 150, 72000]);
  const ubah = { nama: "Tote Bag", kategori_id: kaos, hpp: 30000, harga_jual: 75000 };
  await gagal(await api("PATCH", "/api/produk/" + r.id, { ...ubah, berat_gram: null }), 400, /Isi berat produk/);
  ok(await api("PATCH", "/api/produk/" + r.id, { ...ubah, berat_gram: 160, harga_toko_web: null }));
  p = ok(await api("GET", "/api/produk/" + r.id)).produk;
  assert.deepEqual([p.varian[0].berat_gram, p.varian[0].harga_toko_web], [160, null]);
});

test("harga toko web tidak ikut ke POS", async () => {
  ok(await api("PATCH", "/api/produk/" + kaosId, { ...formKaos(), varian: formKaos().varian.map((v) => (v.sku === "KH-S" ? { ...v, harga_toko_web: 99000 } : v)) }));
  const { pos } = await siapkanHp(L, ownerId, "135790");
  const k = ok(await api("GET", "/api/pos/tarik?lokasi=gudang", undefined, { headers: pos, cookie: null }));
  const s = k.varian.find((v) => v.sku === "KH-S");
  assert.equal(s.harga, 135000);
  assert.equal(s.harga_toko_web, undefined);
});

test("cron menghapus foto yang tidak dipakai lebih dari 24 jam", async () => {
  const lama = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const yatim = await fotoBaru();
  const segar = await fotoBaru();
  sql("UPDATE foto SET dibuat_pada = ? WHERE id IN (?, ?, ?)", lama, yatim, f1, f3);
  const sebelum = sql("SELECT COUNT(*) AS n FROM foto")[0].n;
  const janji = [];
  await worker.scheduled({}, env, { waitUntil: (p) => janji.push(p) });
  await Promise.all(janji);
  const sisa = sql("SELECT id FROM foto").map((x) => x.id);
  assert.ok(!sisa.includes(yatim), "foto yatim lama terhapus");
  assert.ok(sisa.includes(segar), "foto yang baru diunggah tetap ada");
  assert.ok(sisa.includes(f1) && sisa.includes(f3), "foto yang dipakai produk tetap ada");
  assert.equal(env.FOTO.isi.has(`produk/${yatim}/besar`), false);
  assert.equal(env.FOTO.isi.has(`produk/${yatim}/kecil`), false);
  assert.equal(env.FOTO.isi.has(`produk/${f1}/besar`), true);
  assert.ok(sebelum - sisa.length >= 1);
  assert.equal((await buka(`/foto/produk/${yatim}/besar`)).status, 404);
  // Foto yang sudah dihapus tidak bisa dipasang lagi ke produk.
  await gagal(await api("POST", "/api/produk", { nama: "Mug", sku: "MG", kategori_id: kaos, hpp: 18000, harga_jual: 45000, foto: [yatim] }), 400, /Unggah ulang/);
});
