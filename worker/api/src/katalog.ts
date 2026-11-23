// Katalog: kategori, produk, varian (SKU). Diatur Owner dan Admin dari dashboard.

import { rapikanSku, skuVarian } from "./aturan.js";
import { fotoProduk, idFotoSah } from "./foto.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, benar, bulat, daftar, Gagal, json, Obj, sekarang, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

export const SATUAN = ["Pcs", "Pack", "Set", "Box"];
const MAKS_HARGA = 100_000_000;
const MAKS_FOTO = 9;
const MAKS_BERAT = 50_000;

// ---------- Kategori ----------

export async function daftarKategori(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB
    .prepare(
      `SELECT k.id, k.nama, k.urutan, k.tampil_menu, (SELECT count(*) FROM produk p WHERE p.kategori_id = k.id) AS jumlah_produk
       FROM kategori k ORDER BY k.urutan, k.nama`,
    )
    .all<{ tampil_menu: number }>();
  return json({ kategori: results.map((k) => ({ ...k, tampil_menu: k.tampil_menu === 1 })) });
}

function isiKategori(b: Obj) {
  return {
    nama: wajibTeks(b, "nama", "Nama kategori", { max: 40 }),
    urutan: bulat(b, "urutan", "Urutan", { max: 999, wajib: false }) ?? 0,
    tampil: benar(b, "tampil_menu", true) ? 1 : 0,
  };
}

async function namaKategoriDipakai(db: D1Database, nama: string, kecuali: string) {
  if (await db.prepare("SELECT 1 FROM kategori WHERE nama = ? AND id <> ?").bind(nama, kecuali).first()) {
    throw new Gagal(409, "Nama kategori sudah ada");
  }
}

export async function tambahKategori(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const k = isiKategori(await bacaJson(req));
  const id = ulid(), t = sekarang();
  await namaKategoriDipakai(env.DB, k.nama, id);
  await env.DB.prepare("INSERT INTO kategori (id, nama, urutan, tampil_menu, dibuat_pada, diubah_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, k.nama, k.urutan, k.tampil, t, t, staff.id).run();
  return json({ id }, 201);
}

export async function ubahKategori(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const k = isiKategori(await bacaJson(req));
  await namaKategoriDipakai(env.DB, k.nama, id);
  const r = await env.DB.prepare("UPDATE kategori SET nama = ?, urutan = ?, tampil_menu = ?, diubah_pada = ? WHERE id = ?")
    .bind(k.nama, k.urutan, k.tampil, sekarang(), id).run();
  if (r.meta.changes === 0) throw new Gagal(404, "Kategori tidak ditemukan");
  return json({ ok: true });
}

export async function hapusKategori(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  if (await env.DB.prepare("SELECT 1 FROM produk WHERE kategori_id = ?").bind(id).first()) {
    throw new Gagal(400, "Kategori masih dipakai produk. Pindahkan produknya dulu");
  }
  await env.DB.prepare("DELETE FROM kategori WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// ---------- Produk ----------

interface BarisProduk {
  id: string;
  sku: string;
  nama: string;
  deskripsi: string | null;
  kategori_id: string | null;
  kategori: string | null;
  satuan: string;
  hpp: number;
  stok_min: number;
  punya_varian: number;
  tampil_pos: number;
  aktif: number;
  toko_web: number;
}

interface BarisVarian {
  sku: string;
  produk_id: string;
  nama: string;
  harga_jual: number;
  aktif: number;
  berat_gram: number | null;
  foto_id: string | null;
  harga_toko_web: number | null;
  stok: number;
  transit: number;
}

interface BarisFoto {
  produk_id: string;
  foto_id: string;
}

const SELECT_PRODUK = `SELECT p.id, p.sku, p.nama, p.deskripsi, p.kategori_id, k.nama AS kategori, p.satuan, p.hpp, p.stok_min,
  p.punya_varian, p.tampil_pos, p.aktif, p.toko_web FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id`;

// Harga toko web ada di harga_saluran (saluran 'toko_web'). Kosong berarti ikut harga jual.
const SELECT_VARIAN = `SELECT v.sku, v.produk_id, v.nama, v.harga_jual, v.aktif, v.berat_gram, v.foto_id, tw.harga AS harga_toko_web,
  COALESCE((SELECT SUM(qty) FROM stok s WHERE s.sku = v.sku), 0) AS stok,
  COALESCE((SELECT SUM(transit) FROM stok s WHERE s.sku = v.sku), 0) AS transit
  FROM varian v LEFT JOIN harga_saluran tw ON tw.sku = v.sku AND tw.saluran = 'toko_web'`;

const SELECT_FOTO = "SELECT produk_id, foto_id FROM produk_foto";

function bentukProduk(p: BarisProduk, varian: BarisVarian[], foto: BarisFoto[]) {
  const v = varian.filter((x) => x.produk_id === p.id);
  const aktif = v.filter((x) => x.aktif === 1);
  const harga = (aktif.length ? aktif : v).map((x) => x.harga_jual);
  return {
    id: p.id,
    sku: p.sku,
    nama: p.nama,
    deskripsi: p.deskripsi,
    kategori_id: p.kategori_id,
    kategori: p.kategori,
    satuan: p.satuan,
    hpp: p.hpp,
    stok_min: p.stok_min,
    punya_varian: p.punya_varian === 1,
    tampil_pos: p.tampil_pos === 1,
    aktif: p.aktif === 1,
    toko_web: p.toko_web === 1,
    // Urutan foto mengikuti hasil query (ORDER BY urutan). Foto pertama adalah foto utama.
    foto: foto.filter((f) => f.produk_id === p.id).map((f) => fotoProduk(f.foto_id)),
    harga_min: harga.length ? Math.min(...harga) : 0,
    harga_maks: harga.length ? Math.max(...harga) : 0,
    stok: v.reduce((a, x) => a + x.stok, 0),
    transit: v.reduce((a, x) => a + x.transit, 0),
    varian: v.map((x) => ({
      sku: x.sku, nama: x.nama, harga_jual: x.harga_jual, aktif: x.aktif === 1, stok: x.stok, transit: x.transit,
      berat_gram: x.berat_gram, foto_id: x.foto_id, harga_toko_web: x.harga_toko_web,
    })),
  };
}

export async function daftarProduk(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [p, v, mp, f] = await Promise.all([
    env.DB.prepare(`${SELECT_PRODUK} ORDER BY p.aktif DESC, k.urutan, p.nama`).all<BarisProduk>(),
    env.DB.prepare(`${SELECT_VARIAN} ORDER BY v.produk_id, v.aktif DESC, v.urutan`).all<BarisVarian>(),
    env.DB.prepare("SELECT v.produk_id, x.sku, s.nama, s.aktif, COALESCE(x.harga, v.harga_jual) AS harga FROM saluran_varian x JOIN varian v ON v.sku = x.sku JOIN saluran s ON s.id = x.saluran_id ORDER BY s.urutan")
      .all<{ produk_id: string; sku: string; nama: string; aktif: number; harga: number }>(),
    env.DB.prepare(`${SELECT_FOTO} ORDER BY produk_id, urutan`).all<BarisFoto>(),
  ]);
  // Marketplace tempat produk dijual, untuk kolom di Daftar Produk.
  return json({
    produk: p.results.map((x) => {
      const b = bentukProduk(x, v.results, f.results);
      const milik = mp.results.filter((m) => m.produk_id === x.id);
      return {
        ...b,
        marketplace: [...new Map(milik.map((m) => [m.nama, { nama: m.nama, toko_aktif: m.aktif === 1 }])).values()],
        varian: b.varian.map((vv) => ({ ...vv, harga_marketplace: milik.filter((m) => m.sku === vv.sku).map((m) => ({ nama: m.nama, harga: m.harga })) })),
      };
    }),
  });
}

// Sakelar Tampil di POS dari Daftar Produk.
export async function ubahTampilPos(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const tampil = (await bacaJson(req)).tampil_pos === true;
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE produk SET tampil_pos = ?, diubah_pada = ? WHERE id = ?").bind(tampil ? 1 : 0, sekarang(), id),
    logAktivitas(env.DB, staff, tampil ? "Tampilkan produk di POS" : "Sembunyikan produk dari POS", { tabel: "produk", id }),
  ]);
  if (r[0].meta.changes !== 1) throw new Gagal(404, "Produk tidak ditemukan");
  return json({ ok: true });
}

export async function ambilProduk(db: D1Database, id: string) {
  const p = await db.prepare(`${SELECT_PRODUK} WHERE p.id = ?`).bind(id).first<BarisProduk>();
  if (!p) throw new Gagal(404, "Produk tidak ditemukan");
  const [v, f] = await Promise.all([
    db.prepare(`${SELECT_VARIAN} WHERE v.produk_id = ? ORDER BY v.aktif DESC, v.urutan`).bind(id).all<BarisVarian>(),
    db.prepare(`${SELECT_FOTO} WHERE produk_id = ? ORDER BY urutan`).bind(id).all<BarisFoto>(),
  ]);
  return bentukProduk(p, v.results, f.results);
}

export async function detailProduk(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const produk = await ambilProduk(env.DB, id);
  const [stok, hpp, marketplace] = await Promise.all([
    env.DB.prepare(
      `SELECT s.sku, s.lokasi_id, l.nama AS lokasi, s.qty, s.transit FROM stok s JOIN lokasi l ON l.id = s.lokasi_id
       JOIN varian v ON v.sku = s.sku WHERE v.produk_id = ? ORDER BY l.jenis DESC, l.nama`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT h.waktu, h.lama, h.baru, h.sebab, f.no AS faktur, a.nama AS oleh FROM hpp_riwayat h
       LEFT JOIN faktur f ON h.ref_tabel = 'faktur' AND f.id = h.ref_id LEFT JOIN staff a ON a.id = h.oleh
       WHERE h.produk_id = ? ORDER BY h.waktu DESC LIMIT 50`,
    ).bind(id).all(),
    marketplaceProduk(env.DB, id),
  ]);
  return json({ produk, stok_lokasi: stok.results, hpp_riwayat: hpp.results, marketplace });
}

interface IsiVarian {
  sku: string | null;
  nama: string;
  harga_jual: number;
  aktif: boolean;
  stok_awal: number;
  harga_marketplace: HargaMp;
  // Isian web store: undefined berarti tidak dikirim dan tidak diubah, null berarti dikosongkan.
  // Dashboard lama yang masih tersimpan di browser tidak mengirim isian ini, jadi isiannya tidak boleh ikut terhapus.
  berat_gram: number | null | undefined;
  harga_toko_web: number | null | undefined;
  foto_id: string | null | undefined;
}

const beratDari = (o: Obj, label: string) =>
  o.berat_gram === undefined ? undefined : bulat(o, "berat_gram", label, { min: 1, max: MAKS_BERAT, wajib: false });
const hargaTokoWebDari = (o: Obj, label: string) =>
  o.harga_toko_web === undefined ? undefined : bulat(o, "harga_toko_web", label, { max: MAKS_HARGA, wajib: false });

// ---------- Harga marketplace per varian ----------
// Produk dijual di marketplace kalau punya baris saluran_varian di sana. Harga null berarti ikut harga jual.

export type HargaMp = Record<string, number | null>;

function isiHargaMp(o: unknown, label: string): HargaMp {
  if (o === undefined || o === null) return {};
  if (typeof o !== "object" || Array.isArray(o)) throw new Gagal(400, `${label} tidak valid`);
  return Object.fromEntries(Object.keys(o).map((k) => [k, bulat(o as Obj, k, `${label} ${k}`, { max: MAKS_HARGA, wajib: false })]));
}

export async function marketplaceProduk(db: D1Database, id: string) {
  const [saluran, harga] = await Promise.all([
    db.prepare("SELECT id, nama, aktif FROM saluran WHERE marketplace = 1 ORDER BY urutan").all<{ id: string; nama: string; aktif: number }>(),
    db.prepare("SELECT x.saluran_id, x.sku, x.harga FROM saluran_varian x JOIN varian v ON v.sku = x.sku WHERE v.produk_id = ?").bind(id).all<{ saluran_id: string; sku: string; harga: number | null }>(),
  ]);
  return saluran.results.map((s) => {
    const h = harga.results.filter((x) => x.saluran_id === s.id);
    return { id: s.id, nama: s.nama, toko_aktif: s.aktif === 1, dijual: h.length > 0, harga: Object.fromEntries(h.map((x) => [x.sku, x.harga])) };
  });
}

// Tulis ulang harga satu produk di marketplace yang disebut. Satu INSERT memuat 24 baris karena D1 membatasi 100 parameter per query.
export function tulisHargaMp(db: D1Database, produkId: string, saluran: { id: string; dijual: boolean }[], baris: { sku: string; harga: HargaMp }[], t: string) {
  if (!saluran.length) return [];
  const tulis = [db.prepare(`DELETE FROM saluran_varian WHERE saluran_id IN (${saluran.map(() => "?").join(",")}) AND sku IN (SELECT sku FROM varian WHERE produk_id = ?)`)
    .bind(...saluran.map((x) => x.id), produkId)];
  const isi = saluran.filter((x) => x.dijual).flatMap((x) => baris.map((b) => [x.id, b.sku, b.harga[x.id] ?? null, t]));
  for (let i = 0; i < isi.length; i += 24) {
    const potong = isi.slice(i, i + 24);
    tulis.push(db.prepare(`INSERT INTO saluran_varian (saluran_id, sku, harga, diubah_pada) VALUES ${potong.map(() => "(?, ?, ?, ?)").join(", ")}`).bind(...potong.flat()));
  }
  return tulis;
}

async function idMarketplace(db: D1Database, dipilih: string[]) {
  const { results } = await db.prepare("SELECT id FROM saluran WHERE marketplace = 1").all<{ id: string }>();
  const ada = results.map((x) => x.id);
  for (const id of dipilih) if (!ada.includes(id)) throw new Gagal(400, `Marketplace ${id} tidak dikenal`);
  return ada;
}

function isiProduk(b: Obj) {
  const satuan = teks(b, "satuan", "Satuan", { max: 10, wajib: false }) ?? "Pcs";
  if (!SATUAN.includes(satuan)) throw new Gagal(400, "Satuan tidak dikenal");
  const varian: IsiVarian[] = b.varian === undefined || b.varian === null ? [] : daftar(b, "varian", "Varian").map((v, i) => ({
    sku: teks(v, "sku", `SKU varian ${i + 1}`, { max: 40, wajib: false }),
    nama: wajibTeks(v, "nama", `Nama varian ${i + 1}`, { max: 40 }),
    harga_jual: wajibBulat(v, "harga_jual", `Harga varian ${i + 1}`, { max: MAKS_HARGA }),
    aktif: benar(v, "aktif", true),
    stok_awal: bulat(v, "stok_awal", `Stok awal varian ${i + 1}`, { max: 1_000_000, wajib: false }) ?? 0,
    harga_marketplace: isiHargaMp(v.harga_marketplace, `Harga marketplace varian ${i + 1}`),
    berat_gram: beratDari(v, `Berat varian ${i + 1}`),
    harga_toko_web: hargaTokoWebDari(v, `Harga toko web varian ${i + 1}`),
    foto_id: v.foto_id === undefined ? undefined : teks(v, "foto_id", `Foto varian ${i + 1}`, { max: 40, wajib: false }),
  }));
  // marketplace: daftar id marketplace tempat produk dijual. Tidak dikirim berarti harga marketplace tidak diubah.
  let marketplace: string[] | null = null;
  if (b.marketplace !== undefined && b.marketplace !== null) {
    if (!Array.isArray(b.marketplace) || b.marketplace.some((x) => typeof x !== "string")) throw new Gagal(400, "Daftar marketplace tidak valid");
    marketplace = [...new Set(b.marketplace as string[])];
  }
  // foto: id foto produk berurutan, foto pertama jadi foto utama. Tidak dikirim berarti foto tidak diubah.
  let foto: string[] | null = null;
  if (b.foto !== undefined && b.foto !== null) {
    if (!Array.isArray(b.foto) || b.foto.some((x) => typeof x !== "string" || !idFotoSah(x))) throw new Gagal(400, "Daftar foto tidak valid");
    if (b.foto.length > MAKS_FOTO) throw new Gagal(400, `Foto produk maksimal ${MAKS_FOTO}`);
    if (new Set(b.foto).size !== b.foto.length) throw new Gagal(400, "Ada foto produk yang dobel");
    foto = b.foto as string[];
  }
  // D1 membatasi 100 parameter per query; skuDipakai() memakai dua parameter per SKU.
  if (varian.length > 40) throw new Gagal(400, "Satu produk maksimal 40 varian");
  const nama = new Set<string>();
  for (const v of varian) {
    if (nama.has(v.nama.toLowerCase())) throw new Gagal(400, `Nama varian "${v.nama}" dobel`);
    nama.add(v.nama.toLowerCase());
  }
  return {
    nama: wajibTeks(b, "nama", "Nama produk", { max: 100 }),
    deskripsi: teks(b, "deskripsi", "Deskripsi", { max: 1000, wajib: false }),
    kategori_id: wajibTeks(b, "kategori_id", "Kategori", { max: 40 }),
    satuan,
    hpp: wajibBulat(b, "hpp", "HPP", { max: MAKS_HARGA }),
    stok_min: bulat(b, "stok_min", "Batas stok menipis", { max: 100_000, wajib: false }) ?? 0,
    tampil_pos: benar(b, "tampil_pos", true),
    aktif: benar(b, "aktif", true),
    harga_jual: bulat(b, "harga_jual", "Harga jual", { max: MAKS_HARGA, wajib: varian.length === 0 }),
    stok_awal: bulat(b, "stok_awal", "Stok awal", { max: 1_000_000, wajib: false }) ?? 0,
    harga_marketplace: isiHargaMp(b.harga_marketplace, "Harga marketplace"),
    marketplace,
    foto,
    // Sakelar Toko web 2Mimbar. null berarti tidak dikirim dan tidak diubah.
    toko_web: b.toko_web === undefined || b.toko_web === null ? null : b.toko_web === true,
    // Berat dan harga toko web untuk produk tanpa varian.
    berat_gram: beratDari(b, "Berat"),
    harga_toko_web: hargaTokoWebDari(b, "Harga toko web"),
    varian,
  };
}

// ---------- Foto, berat, dan harga toko web ----------

// Foto harus sudah diunggah sebagai foto produk dan belum dipakai produk lain.
async function cekFotoProduk(db: D1Database, ids: string[], produkId: string | null) {
  if (!ids.length) return;
  const { results } = await db.prepare(
    `SELECT f.id, pf.produk_id FROM foto f LEFT JOIN produk_foto pf ON pf.foto_id = f.id
     WHERE f.jenis = 'produk' AND f.id IN (${ids.map(() => "?").join(",")})`,
  ).bind(...ids).all<{ id: string; produk_id: string | null }>();
  for (const id of ids) {
    const r = results.find((x) => x.id === id);
    if (!r) throw new Gagal(400, "Ada foto yang tidak ditemukan. Unggah ulang fotonya");
    if (r.produk_id && r.produk_id !== produkId) throw new Gagal(409, "Ada foto yang sudah dipakai produk lain");
  }
}

function cekFotoVarian(v: { nama: string; foto_id: string | null | undefined }, foto: string[]) {
  if (v.foto_id && !foto.includes(v.foto_id)) throw new Gagal(400, `Foto varian ${v.nama || "produk"} harus dipilih dari foto produk`);
}

// Toko web butuh foto untuk ditampilkan dan berat setiap varian aktif untuk menghitung ongkir.
function cekSyaratTokoWeb(jumlahFoto: number, varian: { nama: string; aktif: boolean; berat_gram: number | null }[]) {
  if (!jumlahFoto) throw new Gagal(400, "Tambahkan minimal satu foto produk sebelum menyalakan Toko web");
  const kurang = varian.find((v) => v.aktif && !v.berat_gram);
  if (kurang) throw new Gagal(400, kurang.nama ? `Isi berat varian ${kurang.nama} sebelum menyalakan Toko web` : "Isi berat produk sebelum menyalakan Toko web");
}

// Tulis ulang foto satu produk. Baris lama dihapus dulu supaya urutan baru tidak bentrok dengan indeks unik.
function tulisFotoProduk(db: D1Database, produkId: string, foto: string[]) {
  const tulis = [db.prepare("DELETE FROM produk_foto WHERE produk_id = ?").bind(produkId)];
  if (foto.length) {
    tulis.push(db.prepare(`INSERT INTO produk_foto (foto_id, produk_id, urutan) VALUES ${foto.map(() => "(?, ?, ?)").join(", ")}`)
      .bind(...foto.flatMap((f, i) => [f, produkId, i])));
  }
  return tulis;
}

// Harga toko web per SKU di harga_saluran. null menghapus barisnya, jadi harganya kembali ikut harga jual.
// Satu INSERT memuat 24 baris karena D1 membatasi 100 parameter per query.
function tulisHargaTokoWeb(db: D1Database, harga: { sku: string; harga: number | null }[], staffId: string, t: string) {
  const tulis: D1PreparedStatement[] = [];
  const hapus = harga.filter((x) => x.harga === null).map((x) => x.sku);
  if (hapus.length) tulis.push(db.prepare(`DELETE FROM harga_saluran WHERE saluran = 'toko_web' AND sku IN (${hapus.map(() => "?").join(",")})`).bind(...hapus));
  const isi = harga.filter((x) => x.harga !== null);
  for (let i = 0; i < isi.length; i += 24) {
    const potong = isi.slice(i, i + 24);
    tulis.push(db.prepare(
      `INSERT INTO harga_saluran (sku, saluran, harga, diubah_pada, diubah_oleh) VALUES ${potong.map(() => "(?, 'toko_web', ?, ?, ?)").join(", ")}
       ON CONFLICT (sku, saluran) DO UPDATE SET harga = excluded.harga, diubah_pada = excluded.diubah_pada, diubah_oleh = excluded.diubah_oleh`,
    ).bind(...potong.flatMap((x) => [x.sku, x.harga, t, staffId])));
  }
  return tulis;
}

async function cekKategori(db: D1Database, id: string) {
  if (!(await db.prepare("SELECT 1 FROM kategori WHERE id = ?").bind(id).first())) throw new Gagal(400, "Kategori tidak ditemukan");
}

async function skuDipakai(db: D1Database, skus: string[]) {
  const tanda = skus.map(() => "?").join(",");
  const ada = await db.prepare(`SELECT sku FROM varian WHERE sku IN (${tanda}) UNION SELECT sku FROM produk WHERE sku IN (${tanda})`)
    .bind(...skus, ...skus).first<{ sku: string }>();
  if (ada) throw new Gagal(409, `SKU ${ada.sku} sudah dipakai`);
}

export async function tambahProduk(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const p = isiProduk(b);
  const sku = rapikanSku(wajibTeks(b, "sku", "SKU induk", { max: 40 }));
  if (!sku) throw new Gagal(400, "SKU induk tidak valid");
  await cekKategori(env.DB, p.kategori_id);

  const varian = p.varian.length
    ? p.varian.map((v) => ({ ...v, sku: v.sku ? rapikanSku(v.sku) : skuVarian(sku, v.nama) }))
    : [{ sku, nama: "", harga_jual: p.harga_jual!, aktif: true, stok_awal: p.stok_awal, harga_marketplace: p.harga_marketplace,
        berat_gram: p.berat_gram, harga_toko_web: p.harga_toko_web, foto_id: undefined }];
  const semua = [...new Set([sku, ...varian.map((v) => v.sku)])];
  if (semua.length !== (p.varian.length ? varian.length + 1 : 1)) throw new Gagal(400, "SKU varian tidak boleh sama dengan SKU lain di produk ini");
  await skuDipakai(env.DB, semua);
  if (p.marketplace?.length) await idMarketplace(env.DB, p.marketplace);
  const foto = p.foto ?? [];
  await cekFotoProduk(env.DB, foto, null);
  for (const v of varian) cekFotoVarian(v, foto);
  const tokoWeb = p.toko_web ?? false;
  if (tokoWeb) cekSyaratTokoWeb(foto.length, varian.map((v) => ({ nama: v.nama, aktif: v.aktif, berat_gram: v.berat_gram ?? null })));

  const id = ulid(), t = sekarang();
  const tulis = [
    env.DB.prepare(
      `INSERT INTO produk (id, sku, nama, deskripsi, kategori_id, satuan, hpp, stok_min, punya_varian, tampil_pos, aktif, toko_web, dibuat_pada, diubah_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, sku, p.nama, p.deskripsi, p.kategori_id, p.satuan, p.hpp, p.stok_min, p.varian.length ? 1 : 0, p.tampil_pos ? 1 : 0, p.aktif ? 1 : 0, tokoWeb ? 1 : 0, t, t, staff.id),
    ...varian.map((v, i) =>
      env.DB.prepare("INSERT INTO varian (sku, produk_id, nama, harga_jual, urutan, aktif, berat_gram, foto_id, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(v.sku, id, v.nama, v.harga_jual, i, v.aktif ? 1 : 0, v.berat_gram ?? null, v.foto_id ?? null, t, t),
    ),
    ...(foto.length ? tulisFotoProduk(env.DB, id, foto) : []),
    env.DB.prepare("INSERT INTO hpp_riwayat (id, produk_id, lama, baru, sebab, waktu, oleh) VALUES (?, ?, 0, ?, 'awal', ?, ?)").bind(ulid(), id, p.hpp, t, staff.id),
  ];
  // Stok awal hanya bisa diisi saat produk dibuat, dan selalu masuk Gudang Pusat.
  for (const v of varian.filter((x) => x.stok_awal > 0)) {
    tulis.push(
      env.DB.prepare("INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, 'gudang', ?, 0, ?)").bind(v.sku, v.stok_awal, t),
      env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, 'gudang', ?, 'awal', 'produk', ?, ?, ?)")
        .bind(ulid(), v.sku, v.stok_awal, id, t, staff.id),
    );
  }
  // Harga marketplace ikut tersimpan bersama produk, dalam batch yang sama.
  tulis.push(...tulisHargaMp(env.DB, id, (p.marketplace ?? []).map((x) => ({ id: x, dijual: true })), varian.map((v) => ({ sku: v.sku, harga: v.harga_marketplace })), t));
  tulis.push(...tulisHargaTokoWeb(env.DB, varian.filter((v) => v.harga_toko_web != null).map((v) => ({ sku: v.sku, harga: v.harga_toko_web! })), staff.id, t));
  tulis.push(logAktivitas(env.DB, staff, "Tambah produk", { tabel: "produk", id, keterangan: `${sku} ${p.nama}${tokoWeb ? " · dijual di toko web" : ""}` }));
  await env.DB.batch(tulis);
  return json({ id, sku, varian: varian.map((v) => v.sku) }, 201);
}

// Varian yang dihapus dari form dinonaktifkan, tidak dihapus, karena SKU-nya mungkin sudah punya stok atau riwayat.
export async function ubahProduk(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const lama = await ambilProduk(env.DB, id);
  const p = isiProduk(await bacaJson(req));
  await cekKategori(env.DB, p.kategori_id);
  if (lama.punya_varian !== p.varian.length > 0) {
    throw new Gagal(400, lama.punya_varian ? "Produk bervarian harus punya minimal satu varian" : "Produk tanpa varian tidak bisa diubah jadi bervarian. Buat produk baru");
  }
  // Foto dan sakelar toko web yang tidak dikirim memakai isi lama.
  const foto = p.foto ?? lama.foto.map((f) => f.id);
  if (p.foto) await cekFotoProduk(env.DB, p.foto, id);
  const tokoWeb = p.toko_web ?? lama.toko_web;
  const t = sekarang();
  const tulis = [
    env.DB.prepare(
      `UPDATE produk SET nama = ?, deskripsi = ?, kategori_id = ?, satuan = ?, hpp = ?, stok_min = ?, tampil_pos = ?, aktif = ?, toko_web = ?, diubah_pada = ? WHERE id = ?`,
    ).bind(p.nama, p.deskripsi, p.kategori_id, p.satuan, p.hpp, p.stok_min, p.tampil_pos ? 1 : 0, p.aktif ? 1 : 0, tokoWeb ? 1 : 0, t, id),
  ];
  if (p.hpp !== lama.hpp) {
    tulis.push(env.DB.prepare("INSERT INTO hpp_riwayat (id, produk_id, lama, baru, sebab, waktu, oleh) VALUES (?, ?, ?, ?, 'ubah_manual', ?, ?)")
      .bind(ulid(), id, lama.hpp, p.hpp, t, staff.id));
  }

  // SKU dan harga marketplace setiap varian di form, untuk ditulis ulang kalau marketplace ikut dikirim.
  const barisMp: { sku: string; harga: HargaMp }[] = [];
  // Harga toko web yang dikirim, dan keadaan akhir varian untuk memeriksa syarat toko web.
  const hargaTw: { sku: string; harga: number | null }[] = [];
  const akhir: { nama: string; aktif: boolean; berat_gram: number | null }[] = [];
  if (!lama.punya_varian) {
    const l = lama.varian.find((x) => x.sku === lama.sku) ?? lama.varian[0];
    const berat = p.berat_gram !== undefined ? p.berat_gram : l.berat_gram;
    tulis.push(env.DB.prepare("UPDATE varian SET harga_jual = ?, berat_gram = ?, diubah_pada = ? WHERE sku = ?").bind(p.harga_jual, berat, t, lama.sku));
    barisMp.push({ sku: lama.sku, harga: p.harga_marketplace });
    if (p.harga_toko_web !== undefined) hargaTw.push({ sku: lama.sku, harga: p.harga_toko_web });
    akhir.push({ nama: "", aktif: true, berat_gram: berat });
  } else {
    const adaSku = new Set(lama.varian.map((v) => v.sku));
    const dipakai = new Set<string>();
    const baru: { sku: string; v: IsiVarian; urutan: number }[] = [];
    p.varian.forEach((v, i) => {
      cekFotoVarian(v, foto);
      if (v.sku && adaSku.has(v.sku)) {
        if (dipakai.has(v.sku)) throw new Gagal(400, `SKU ${v.sku} dobel`);
        dipakai.add(v.sku);
        const l = lama.varian.find((x) => x.sku === v.sku)!;
        const berat = v.berat_gram !== undefined ? v.berat_gram : l.berat_gram;
        const fotoId = v.foto_id !== undefined ? v.foto_id : l.foto_id;
        tulis.push(env.DB.prepare("UPDATE varian SET nama = ?, harga_jual = ?, urutan = ?, aktif = ?, berat_gram = ?, foto_id = ?, diubah_pada = ? WHERE sku = ? AND produk_id = ?")
          .bind(v.nama, v.harga_jual, i, v.aktif ? 1 : 0, berat, fotoId, t, v.sku, id));
        barisMp.push({ sku: v.sku, harga: v.harga_marketplace });
        if (v.harga_toko_web !== undefined) hargaTw.push({ sku: v.sku, harga: v.harga_toko_web });
        akhir.push({ nama: v.nama, aktif: v.aktif, berat_gram: berat });
      } else {
        const sku = v.sku ? rapikanSku(v.sku) : skuVarian(lama.sku, v.nama);
        baru.push({ sku, v, urutan: i });
        barisMp.push({ sku, harga: v.harga_marketplace });
        if (v.harga_toko_web != null) hargaTw.push({ sku, harga: v.harga_toko_web });
        akhir.push({ nama: v.nama, aktif: v.aktif, berat_gram: v.berat_gram ?? null });
      }
    });
    if (new Set(baru.map((x) => x.sku)).size !== baru.length) throw new Gagal(400, "Ada SKU varian baru yang dobel");
    if (baru.length) await skuDipakai(env.DB, baru.map((x) => x.sku));
    for (const x of baru) {
      tulis.push(env.DB.prepare("INSERT INTO varian (sku, produk_id, nama, harga_jual, urutan, aktif, berat_gram, foto_id, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(x.sku, id, x.v.nama, x.v.harga_jual, x.urutan, x.v.aktif ? 1 : 0, x.v.berat_gram ?? null, x.v.foto_id ?? null, t, t));
    }
    for (const sku of adaSku) {
      if (!dipakai.has(sku)) tulis.push(env.DB.prepare("UPDATE varian SET aktif = 0, diubah_pada = ? WHERE sku = ?").bind(t, sku));
    }
  }
  if (tokoWeb) cekSyaratTokoWeb(foto.length, akhir);
  if (p.foto) {
    tulis.push(...tulisFotoProduk(env.DB, id, p.foto));
    // Foto varian yang fotonya dilepas dari produk ikut dikosongkan.
    tulis.push(env.DB.prepare(
      `UPDATE varian SET foto_id = NULL, diubah_pada = ? WHERE produk_id = ? AND foto_id IS NOT NULL
       AND foto_id NOT IN (SELECT foto_id FROM produk_foto WHERE produk_id = ?)`,
    ).bind(t, id, id));
  }
  tulis.push(...tulisHargaTokoWeb(env.DB, hargaTw, staff.id, t));
  if (p.marketplace) {
    const semuaMp = await idMarketplace(env.DB, p.marketplace);
    tulis.push(...tulisHargaMp(env.DB, id, semuaMp.map((x) => ({ id: x, dijual: p.marketplace!.includes(x) })), barisMp, t));
  }
  const hargaBerubah = !lama.punya_varian ? lama.varian[0]?.harga_jual !== p.harga_jual
    : p.varian.some((v) => { const l = lama.varian.find((x) => x.sku === v.sku); return !l || l.harga_jual !== v.harga_jual; });
  const catatanTw = tokoWeb === lama.toko_web ? "" : tokoWeb ? " · toko web dinyalakan" : " · toko web dimatikan";
  tulis.push(logAktivitas(env.DB, staff, hargaBerubah ? "Ubah produk dan harga" : "Ubah produk", { tabel: "produk", id, keterangan: `${lama.sku} ${p.nama}${catatanTw}` }));
  await env.DB.batch(tulis);
  return json({ ok: true });
}

// ---------- Harga khusus per saluran (sekarang: Harga Jual Langsung Gudang) ----------

const SALURAN_HARGA = ["gudang"];

export async function ambilHargaSaluran(req: Request, env: Env, saluran: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  if (!SALURAN_HARGA.includes(saluran)) throw new Gagal(404, "Saluran tidak dikenal");
  const { results } = await env.DB.prepare("SELECT sku, harga FROM harga_saluran WHERE saluran = ?").bind(saluran).all<{ sku: string; harga: number }>();
  return json({ harga: Object.fromEntries(results.map((r) => [r.sku, r.harga])) });
}

// Isi { harga: { SKU: angka | null } }. null atau kosong berarti kembali ke harga normal.
export async function simpanHargaSaluran(req: Request, env: Env, saluran: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  if (!SALURAN_HARGA.includes(saluran)) throw new Gagal(404, "Saluran tidak dikenal");
  const b = await bacaJson(req);
  const h = b.harga as Obj;
  if (!h || typeof h !== "object" || Array.isArray(h)) throw new Gagal(400, "Harga tidak valid");
  const entri = Object.entries(h);
  if (entri.length > 500) throw new Gagal(400, "Terlalu banyak SKU sekaligus");
  const t = sekarang();
  const tulis = [];
  for (const [sku, v] of entri) {
    if (v === null || v === "") {
      tulis.push(env.DB.prepare("DELETE FROM harga_saluran WHERE sku = ? AND saluran = ?").bind(sku, saluran));
      continue;
    }
    const harga = wajibBulat({ v }, "v", `Harga ${sku}`, { max: MAKS_HARGA });
    tulis.push(env.DB.prepare(
      `INSERT INTO harga_saluran (sku, saluran, harga, diubah_pada, diubah_oleh) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM varian WHERE sku = ?)
       ON CONFLICT (sku, saluran) DO UPDATE SET harga = excluded.harga, diubah_pada = excluded.diubah_pada, diubah_oleh = excluded.diubah_oleh`,
    ).bind(sku, saluran, harga, t, staff.id, sku));
  }
  // Varian ikut ditandai berubah supaya HP mengambil harga baru saat tarik data berikutnya.
  for (const [sku] of entri) tulis.push(env.DB.prepare("UPDATE varian SET diubah_pada = ? WHERE sku = ?").bind(t, sku));
  tulis.push(logAktivitas(env.DB, staff, "Ubah harga jual langsung gudang", { tabel: "harga_saluran", id: saluran, keterangan: `${entri.length} SKU` }));
  for (let i = 0; i < tulis.length; i += 90) await env.DB.batch(tulis.slice(i, i + 90));
  return json({ ok: true });
}
