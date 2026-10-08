// Katalog: kategori, produk, varian (SKU). Diatur Owner dan Admin dari dashboard.

import { rapikanSku, skuVarian } from "./aturan.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, benar, bulat, daftar, Gagal, json, Obj, sekarang, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

export const SATUAN = ["Pcs", "Pack", "Set", "Box"];
const MAKS_HARGA = 100_000_000;

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
}

interface BarisVarian {
  sku: string;
  produk_id: string;
  nama: string;
  harga_jual: number;
  aktif: number;
  stok: number;
  transit: number;
}

const SELECT_PRODUK = `SELECT p.id, p.sku, p.nama, p.deskripsi, p.kategori_id, k.nama AS kategori, p.satuan, p.hpp, p.stok_min,
  p.punya_varian, p.tampil_pos, p.aktif FROM produk p LEFT JOIN kategori k ON k.id = p.kategori_id`;

const SELECT_VARIAN = `SELECT v.sku, v.produk_id, v.nama, v.harga_jual, v.aktif,
  COALESCE((SELECT SUM(qty) FROM stok s WHERE s.sku = v.sku), 0) AS stok,
  COALESCE((SELECT SUM(transit) FROM stok s WHERE s.sku = v.sku), 0) AS transit
  FROM varian v`;

function bentukProduk(p: BarisProduk, varian: BarisVarian[]) {
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
    harga_min: harga.length ? Math.min(...harga) : 0,
    harga_maks: harga.length ? Math.max(...harga) : 0,
    stok: v.reduce((a, x) => a + x.stok, 0),
    transit: v.reduce((a, x) => a + x.transit, 0),
    varian: v.map((x) => ({ sku: x.sku, nama: x.nama, harga_jual: x.harga_jual, aktif: x.aktif === 1, stok: x.stok, transit: x.transit })),
  };
}

export async function daftarProduk(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [p, v] = await Promise.all([
    env.DB.prepare(`${SELECT_PRODUK} ORDER BY p.aktif DESC, k.urutan, p.nama`).all<BarisProduk>(),
    env.DB.prepare(`${SELECT_VARIAN} ORDER BY v.produk_id, v.aktif DESC, v.urutan`).all<BarisVarian>(),
  ]);
  return json({ produk: p.results.map((x) => bentukProduk(x, v.results)) });
}

export async function ambilProduk(db: D1Database, id: string) {
  const p = await db.prepare(`${SELECT_PRODUK} WHERE p.id = ?`).bind(id).first<BarisProduk>();
  if (!p) throw new Gagal(404, "Produk tidak ditemukan");
  const v = await db.prepare(`${SELECT_VARIAN} WHERE v.produk_id = ? ORDER BY v.aktif DESC, v.urutan`).bind(id).all<BarisVarian>();
  return bentukProduk(p, v.results);
}

export async function detailProduk(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const produk = await ambilProduk(env.DB, id);
  const [stok, hpp] = await Promise.all([
    env.DB.prepare(
      `SELECT s.sku, s.lokasi_id, l.nama AS lokasi, s.qty, s.transit FROM stok s JOIN lokasi l ON l.id = s.lokasi_id
       JOIN varian v ON v.sku = s.sku WHERE v.produk_id = ? ORDER BY l.jenis DESC, l.nama`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT h.waktu, h.lama, h.baru, h.sebab, f.no AS faktur, a.nama AS oleh FROM hpp_riwayat h
       LEFT JOIN faktur f ON h.ref_tabel = 'faktur' AND f.id = h.ref_id LEFT JOIN staff a ON a.id = h.oleh
       WHERE h.produk_id = ? ORDER BY h.waktu DESC LIMIT 50`,
    ).bind(id).all(),
  ]);
  return json({ produk, stok_lokasi: stok.results, hpp_riwayat: hpp.results });
}

interface IsiVarian {
  sku: string | null;
  nama: string;
  harga_jual: number;
  aktif: boolean;
  stok_awal: number;
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
  }));
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
    varian,
  };
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
    : [{ sku, nama: "", harga_jual: p.harga_jual!, aktif: true, stok_awal: p.stok_awal }];
  const semua = [...new Set([sku, ...varian.map((v) => v.sku)])];
  if (semua.length !== (p.varian.length ? varian.length + 1 : 1)) throw new Gagal(400, "SKU varian tidak boleh sama dengan SKU lain di produk ini");
  await skuDipakai(env.DB, semua);

  const id = ulid(), t = sekarang();
  const tulis = [
    env.DB.prepare(
      `INSERT INTO produk (id, sku, nama, deskripsi, kategori_id, satuan, hpp, stok_min, punya_varian, tampil_pos, aktif, dibuat_pada, diubah_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, sku, p.nama, p.deskripsi, p.kategori_id, p.satuan, p.hpp, p.stok_min, p.varian.length ? 1 : 0, p.tampil_pos ? 1 : 0, p.aktif ? 1 : 0, t, t, staff.id),
    ...varian.map((v, i) =>
      env.DB.prepare("INSERT INTO varian (sku, produk_id, nama, harga_jual, urutan, aktif, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(v.sku, id, v.nama, v.harga_jual, i, v.aktif ? 1 : 0, t, t),
    ),
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
  tulis.push(logAktivitas(env.DB, staff, "Tambah produk", { tabel: "produk", id, keterangan: `${sku} ${p.nama}` }));
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
  const t = sekarang();
  const tulis = [
    env.DB.prepare(
      `UPDATE produk SET nama = ?, deskripsi = ?, kategori_id = ?, satuan = ?, hpp = ?, stok_min = ?, tampil_pos = ?, aktif = ?, diubah_pada = ? WHERE id = ?`,
    ).bind(p.nama, p.deskripsi, p.kategori_id, p.satuan, p.hpp, p.stok_min, p.tampil_pos ? 1 : 0, p.aktif ? 1 : 0, t, id),
  ];
  if (p.hpp !== lama.hpp) {
    tulis.push(env.DB.prepare("INSERT INTO hpp_riwayat (id, produk_id, lama, baru, sebab, waktu, oleh) VALUES (?, ?, ?, ?, 'ubah_manual', ?, ?)")
      .bind(ulid(), id, lama.hpp, p.hpp, t, staff.id));
  }

  if (!lama.punya_varian) {
    tulis.push(env.DB.prepare("UPDATE varian SET harga_jual = ?, diubah_pada = ? WHERE sku = ?").bind(p.harga_jual, t, lama.sku));
  } else {
    const adaSku = new Set(lama.varian.map((v) => v.sku));
    const dipakai = new Set<string>();
    const baru: { sku: string; v: IsiVarian; urutan: number }[] = [];
    p.varian.forEach((v, i) => {
      if (v.sku && adaSku.has(v.sku)) {
        if (dipakai.has(v.sku)) throw new Gagal(400, `SKU ${v.sku} dobel`);
        dipakai.add(v.sku);
        tulis.push(env.DB.prepare("UPDATE varian SET nama = ?, harga_jual = ?, urutan = ?, aktif = ?, diubah_pada = ? WHERE sku = ? AND produk_id = ?")
          .bind(v.nama, v.harga_jual, i, v.aktif ? 1 : 0, t, v.sku, id));
      } else {
        baru.push({ sku: v.sku ? rapikanSku(v.sku) : skuVarian(lama.sku, v.nama), v, urutan: i });
      }
    });
    if (new Set(baru.map((x) => x.sku)).size !== baru.length) throw new Gagal(400, "Ada SKU varian baru yang dobel");
    if (baru.length) await skuDipakai(env.DB, baru.map((x) => x.sku));
    for (const x of baru) {
      tulis.push(env.DB.prepare("INSERT INTO varian (sku, produk_id, nama, harga_jual, urutan, aktif, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(x.sku, id, x.v.nama, x.v.harga_jual, x.urutan, x.v.aktif ? 1 : 0, t, t));
    }
    for (const sku of adaSku) {
      if (!dipakai.has(sku)) tulis.push(env.DB.prepare("UPDATE varian SET aktif = 0, diubah_pada = ? WHERE sku = ?").bind(t, sku));
    }
  }
  const hargaBerubah = !lama.punya_varian ? lama.varian[0]?.harga_jual !== p.harga_jual
    : p.varian.some((v) => { const l = lama.varian.find((x) => x.sku === v.sku); return !l || l.harga_jual !== v.harga_jual; });
  tulis.push(logAktivitas(env.DB, staff, hargaBerubah ? "Ubah produk dan harga" : "Ubah produk", { tabel: "produk", id, keterangan: `${lama.sku} ${p.nama}` }));
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
