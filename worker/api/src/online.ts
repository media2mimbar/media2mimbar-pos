// Dashboard › Penjualan Online: saluran marketplace dan biayanya, harga marketplace per SKU, pesanan online (input manual dan impor file),
// riwayat impor. Pesanan online mengurangi stok Gudang Pusat; pesanan yang dibatalkan mengembalikannya.

import { kenaPenjaga, penjaga } from "./inventori.js";
import { gerakStok } from "./kasir.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, bulat, daftar, Gagal, json, Obj, sekarang, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

interface Saluran { id: string; nama: string; marketplace: number; aktif: number; biaya_admin_bp: number; biaya_layanan_bp: number; biaya_pesanan: number }

async function ambilSaluran(db: D1Database, id: string) {
  const s = await db.prepare("SELECT * FROM saluran WHERE id = ?").bind(id).first<Saluran & { preset_kolom: string | null; peta_sku: string | null }>();
  if (!s) throw new Gagal(404, "Saluran tidak dikenal");
  return s;
}

// "2026-10-01" atau "2026-10-01T09:12" (jam WIB) → ISO UTC.
export function waktuWibKeIso(s: unknown, label: string): string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) throw new Gagal(400, `${label} tidak valid`);
  const t = Date.parse((s.length === 10 ? s + "T00:00" : s) + ":00+07:00");
  if (Number.isNaN(t)) throw new Gagal(400, `${label} tidak valid`);
  if (t > Date.now() + 86_400_000) throw new Gagal(400, `${label} tidak boleh di masa depan`);
  return new Date(t).toISOString();
}

// ---------- Saluran dan biaya marketplace ----------

export async function daftarSaluran(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.nama, s.marketplace, s.aktif, s.biaya_admin_bp, s.biaya_layanan_bp, s.biaya_pesanan, s.preset_kolom, s.peta_sku,
      (SELECT COUNT(*) FROM saluran_varian x WHERE x.saluran_id = s.id) AS jumlah_sku
     FROM saluran s ORDER BY s.urutan`,
  ).all<Obj>();
  return json({
    saluran: results.map((s) => ({
      ...s, aktif: s.aktif === 1, marketplace: s.marketplace === 1,
      preset_kolom: s.preset_kolom ? JSON.parse(s.preset_kolom as string) : null, peta_sku: s.peta_sku ? JSON.parse(s.peta_sku as string) : {},
    })),
  });
}

const persenKeBp = (o: Obj, k: string, label: string) => {
  const v = o[k];
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100) throw new Gagal(400, `${label} harus 0 sampai 100`);
  return Math.round(n * 100);
};

export async function ubahSaluran(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const s = await ambilSaluran(env.DB, id);
  const b = await bacaJson(req);
  const aktif = b.aktif === undefined ? s.aktif === 1 : b.aktif === true;
  const admin = persenKeBp(b, "biaya_admin_persen", "Biaya admin"), layanan = persenKeBp(b, "biaya_layanan_persen", "Biaya layanan");
  const perPesanan = bulat(b, "biaya_pesanan", "Biaya per pesanan", { max: 10_000_000, wajib: false }) ?? 0;
  await env.DB.batch([
    env.DB.prepare("UPDATE saluran SET aktif = ?, biaya_admin_bp = ?, biaya_layanan_bp = ?, biaya_pesanan = ?, diubah_pada = ? WHERE id = ?")
      .bind(aktif ? 1 : 0, admin, layanan, perPesanan, sekarang(), id),
    logAktivitas(env.DB, staff, "Ubah biaya marketplace", { tabel: "saluran", id, keterangan: `${s.nama}: admin ${admin / 100}%, layanan ${layanan / 100}%, per pesanan ${perPesanan}` }),
  ]);
  return json({ ok: true });
}

// Perkiraan potongan untuk input manual: (admin% + layanan%) × kotor + biaya per pesanan.
export const perkiraanPotongan = (s: Pick<Saluran, "biaya_admin_bp" | "biaya_layanan_bp" | "biaya_pesanan">, kotor: number) =>
  kotor > 0 ? Math.round((kotor * (s.biaya_admin_bp + s.biaya_layanan_bp)) / 10000) + s.biaya_pesanan : 0;

// ---------- Harga marketplace per produk ----------

export async function hargaMarketplaceProduk(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [saluran, varian, harga] = await Promise.all([
    env.DB.prepare("SELECT id, nama, aktif FROM saluran WHERE marketplace = 1 ORDER BY urutan").all<{ id: string; nama: string; aktif: number }>(),
    env.DB.prepare("SELECT sku, nama, harga_jual, aktif FROM varian WHERE produk_id = ? ORDER BY urutan").bind(id).all<{ sku: string }>(),
    env.DB.prepare("SELECT x.saluran_id, x.sku, x.harga FROM saluran_varian x JOIN varian v ON v.sku = x.sku WHERE v.produk_id = ?").bind(id).all<{ saluran_id: string; sku: string; harga: number | null }>(),
  ]);
  if (!varian.results.length) throw new Gagal(404, "Produk tidak ditemukan");
  return json({
    varian: varian.results,
    saluran: saluran.results.map((s) => {
      const h = harga.results.filter((x) => x.saluran_id === s.id);
      return { id: s.id, nama: s.nama, toko_aktif: s.aktif === 1, dijual: h.length > 0, harga: Object.fromEntries(h.map((x) => [x.sku, x.harga])) };
    }),
  });
}

// { saluran: { shopee: { dijual: true, harga: { SKU: 125000 | null } } } }. Dimatikan = produk dihapus dari daftar marketplace itu.
export async function simpanHargaMarketplace(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const isi = (b.saluran ?? {}) as Record<string, Obj>;
  if (typeof isi !== "object" || Array.isArray(isi)) throw new Gagal(400, "Data harga tidak valid");
  const [{ results: saluran }, { results: varian }] = await Promise.all([
    env.DB.prepare("SELECT id, nama FROM saluran WHERE marketplace = 1").all<{ id: string; nama: string }>(),
    env.DB.prepare("SELECT sku FROM varian WHERE produk_id = ?").bind(id).all<{ sku: string }>(),
  ]);
  if (!varian.length) throw new Gagal(404, "Produk tidak ditemukan");
  const t = sekarang();
  const tulis: D1PreparedStatement[] = [];
  const ringkas: string[] = [];
  for (const [sid, v] of Object.entries(isi)) {
    const s = saluran.find((x) => x.id === sid);
    if (!s) throw new Gagal(400, `Saluran ${sid} tidak dikenal`);
    tulis.push(env.DB.prepare("DELETE FROM saluran_varian WHERE saluran_id = ? AND sku IN (SELECT sku FROM varian WHERE produk_id = ?)").bind(sid, id));
    if (v?.dijual !== true) { ringkas.push(`${s.nama} mati`); continue; }
    const harga = (v.harga ?? {}) as Obj;
    for (const { sku } of varian) {
      const h = bulat(harga, sku, `Harga ${s.nama} ${sku}`, { max: 100_000_000, wajib: false });
      tulis.push(env.DB.prepare("INSERT INTO saluran_varian (saluran_id, sku, harga, diubah_pada) VALUES (?, ?, ?, ?)").bind(sid, sku, h, t));
    }
    ringkas.push(`${s.nama} aktif`);
  }
  if (!tulis.length) return json({ ok: true });
  tulis.push(env.DB.prepare("UPDATE produk SET diubah_pada = ? WHERE id = ?").bind(t, id));
  tulis.push(logAktivitas(env.DB, staff, "Ubah harga marketplace", { tabel: "produk", id, keterangan: ringkas.join(", ") }));
  await env.DB.batch(tulis);
  return json({ ok: true });
}

// Pilihan barang untuk input manual: marketplace hanya varian yang aktif di sana, "Lainnya" semua varian aktif.
export async function katalogSaluran(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const s = await ambilSaluran(env.DB, id);
  const { results } = await env.DB.prepare(
    `SELECT v.sku, TRIM(p.nama || ' ' || v.nama) AS nama, ${s.marketplace ? "COALESCE(x.harga, v.harga_jual)" : "v.harga_jual"} AS harga,
      COALESCE((SELECT qty FROM stok WHERE sku = v.sku AND lokasi_id = 'gudang'), 0) AS stok_gudang
     FROM varian v JOIN produk p ON p.id = v.produk_id ${s.marketplace ? "JOIN saluran_varian x ON x.sku = v.sku AND x.saluran_id = ?" : ""}
     WHERE v.aktif = 1 AND p.aktif = 1 ORDER BY p.nama, v.urutan`,
  ).bind(...(s.marketplace ? [id] : [])).all();
  return json({ saluran: { ...s, preset_kolom: undefined, peta_sku: undefined }, varian: results, perkiraan: { admin_bp: s.biaya_admin_bp, layanan_bp: s.biaya_layanan_bp, per_pesanan: s.biaya_pesanan } });
}

// ---------- Pesanan online ----------

interface Baris { sku: string; nama: string; qty: number; harga: number }
interface Pesanan { no_pesanan: string; tanggal: string; pembeli: string | null; pelanggan_id: string | null; status: string; potongan: number; catatan: string | null; items: Baris[] }

function cekPesanan(o: Obj, urut: string): Pesanan {
  const status = o.status === undefined ? "Selesai" : o.status;
  if (status !== "Selesai" && status !== "Diproses") throw new Gagal(400, `${urut}: status harus Selesai atau Diproses`);
  const items = daftar(o, "items", `${urut}: barang`).map((x, i) => ({
    sku: wajibTeks(x, "sku", `${urut} baris ${i + 1}: SKU`, { max: 40 }),
    nama: teks(x, "nama", "Nama", { max: 140, wajib: false }) ?? "",
    qty: wajibBulat(x, "qty", `${urut} baris ${i + 1}: jumlah`, { min: 1, max: 10_000 }),
    harga: wajibBulat(x, "harga", `${urut} baris ${i + 1}: harga`, { max: 100_000_000 }),
  }));
  if (!items.length || items.length > 30) throw new Gagal(400, `${urut}: isi 1 sampai 30 barang`);
  return {
    no_pesanan: wajibTeks(o, "no_pesanan", `${urut}: no. pesanan`, { max: 60 }),
    tanggal: waktuWibKeIso(o.tanggal, `${urut}: tanggal`),
    pembeli: teks(o, "pembeli", "Pembeli", { max: 80, wajib: false }),
    pelanggan_id: teks(o, "pelanggan_id", "Pelanggan", { max: 40, wajib: false }),
    status: status as string,
    potongan: bulat(o, "potongan", `${urut}: potongan`, { max: 100_000_000, wajib: false }) ?? 0,
    catatan: teks(o, "catatan", "Catatan", { max: 300, wajib: false }),
    items,
  };
}

// Pernyataan tulis satu pesanan: baris pesanan, barang (dengan HPP saat itu), dan stok gudang berkurang.
function tulisPesanan(db: D1Database, s: Saluran, p: Pesanan, info: Map<string, { nama: string; hpp: number }>, sumber: "Manual" | "Impor", imporId: string | null, oleh: string) {
  const id = ulid(), t = sekarang();
  const kotor = p.items.reduce((a, i) => a + i.qty * i.harga, 0);
  return [
    db.prepare(
      `INSERT INTO pesanan_online (id, saluran_id, no_pesanan, tanggal, pembeli, pelanggan_id, status, kotor, potongan, sumber, impor_id, catatan, oleh, dibuat_pada, diubah_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, s.id, p.no_pesanan, p.tanggal, p.pembeli, p.pelanggan_id, p.status, kotor, Math.min(p.potongan, kotor), sumber, imporId, p.catatan, oleh, t, t),
    ...p.items.flatMap((i, k) => [
      db.prepare("INSERT INTO pesanan_item (id, pesanan_id, sku, nama, qty, harga, hpp, urutan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(ulid(), id, i.sku, i.nama || info.get(i.sku)!.nama, i.qty, i.harga, info.get(i.sku)!.hpp, k),
      ...gerakStok(db, i.sku, "gudang", -i.qty, "jual", "pesanan_online", id, p.tanggal, oleh),
    ]),
  ];
}

async function infoSku(db: D1Database, skus: string[]) {
  const info = new Map<string, { nama: string; hpp: number }>();
  const unik = [...new Set(skus)];
  for (let i = 0; i < unik.length; i += 90) {
    const b = unik.slice(i, i + 90);
    const { results } = await db.prepare(`SELECT v.sku, TRIM(p.nama || ' ' || v.nama) AS nama, p.hpp FROM varian v JOIN produk p ON p.id = v.produk_id WHERE v.sku IN (${b.map(() => "?").join(",")})`)
      .bind(...b).all<{ sku: string; nama: string; hpp: number }>();
    for (const r of results) info.set(r.sku, r);
  }
  return info;
}

async function noSudahAda(db: D1Database, saluranId: string, nomor: string[]) {
  const ada = new Set<string>();
  for (let i = 0; i < nomor.length; i += 90) {
    const b = nomor.slice(i, i + 90);
    const { results } = await db.prepare(`SELECT no_pesanan FROM pesanan_online WHERE saluran_id = ? AND no_pesanan IN (${b.map(() => "?").join(",")})`)
      .bind(saluranId, ...b).all<{ no_pesanan: string }>();
    for (const r of results) ada.add(r.no_pesanan);
  }
  return ada;
}

const bentrok = (e: unknown) => String((e as Error).message).includes("UNIQUE") && String((e as Error).message).includes("pesanan_online");

export async function tambahPesanan(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const s = await ambilSaluran(env.DB, wajibTeks(b, "saluran_id", "Saluran", { max: 20 }));
  const p = cekPesanan(b, "Pesanan");
  const info = await infoSku(env.DB, p.items.map((i) => i.sku));
  for (const i of p.items) if (!info.has(i.sku)) throw new Gagal(400, `SKU ${i.sku} tidak ditemukan`);
  // Input manual hanya untuk produk yang aktif di marketplace itu.
  if (s.marketplace) {
    const skus = [...new Set(p.items.map((i) => i.sku))];
    const { results } = await env.DB.prepare(`SELECT sku FROM saluran_varian WHERE saluran_id = ? AND sku IN (${skus.map(() => "?").join(",")})`).bind(s.id, ...skus).all<{ sku: string }>();
    const ada = new Set(results.map((r) => r.sku));
    const belum = skus.filter((x) => !ada.has(x));
    if (belum.length) throw new Gagal(400, `${belum.join(", ")} belum aktif di ${s.nama}. Aktifkan di form produk › Harga Marketplace`);
  }
  if (p.pelanggan_id && !(await env.DB.prepare("SELECT 1 FROM pelanggan WHERE id = ?").bind(p.pelanggan_id).first())) throw new Gagal(400, "Pelanggan tidak ditemukan");
  if ((await noSudahAda(env.DB, s.id, [p.no_pesanan])).size) throw new Gagal(409, `No. pesanan ${p.no_pesanan} sudah tercatat di ${s.nama}`);
  // Input manual tidak boleh melebihi stok Gudang Pusat (impor file tetap diterima karena pesanannya sudah terjadi).
  const perSku = new Map<string, number>();
  for (const i of p.items) perSku.set(i.sku, (perSku.get(i.sku) ?? 0) + i.qty);
  const tulis = [
    ...[...perSku].map(([sku, qty]) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = 'gudang'), 0) >= ?", sku, qty)),
    ...tulisPesanan(env.DB, s, p, info, "Manual", null, staff.id),
  ];
  try {
    await env.DB.batch([...tulis, logAktivitas(env.DB, staff, "Input pesanan online", { tabel: "pesanan_online", keterangan: `${s.nama} ${p.no_pesanan}` })]);
  } catch (e) {
    if (bentrok(e)) throw new Gagal(409, `No. pesanan ${p.no_pesanan} sudah tercatat di ${s.nama}`);
    if (kenaPenjaga(e)) throw new Gagal(400, `Stok Gudang Pusat tidak cukup: ${[...perSku].map(([sku, q]) => `${sku} ${q} pcs`).join(", ")}`);
    throw e;
  }
  return json({ ok: true }, 201);
}

// Impor dari file: HP dashboard membaca file dan mencocokkan kolom, server memeriksa ulang dan menyimpan per kiriman (maks 100 pesanan).
// Pesanan yang no-nya sudah ada dilewati (duplikat). Batch dengan id yang sama menambah hitungan riwayat impor.
export async function imporPesanan(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const s = await ambilSaluran(env.DB, wajibTeks(b, "saluran_id", "Saluran", { max: 20 }));
  const batchId = wajibTeks(b, "batch_id", "ID impor", { max: 40 });
  const namaFile = wajibTeks(b, "nama_file", "Nama file", { max: 120 });
  const mentah = daftar(b, "pesanan", "Pesanan");
  if (mentah.length > 100) throw new Gagal(400, "Kirim maksimal 100 pesanan sekali impor");
  const batal = bulat(b, "batal", "Jumlah batal", { max: 100_000, wajib: false }) ?? 0;
  const gagalFile = bulat(b, "gagal", "Jumlah gagal", { max: 100_000, wajib: false }) ?? 0;
  const pesanan = mentah.map((o, i) => cekPesanan(o, `Pesanan ${i + 1} (${String(o.no_pesanan ?? "")})`));
  const info = await infoSku(env.DB, pesanan.flatMap((p) => p.items.map((i) => i.sku)));
  for (const p of pesanan) for (const i of p.items) if (!info.has(i.sku)) throw new Gagal(400, `${p.no_pesanan}: SKU ${i.sku} tidak ditemukan. Pasangkan dulu`);
  const nomor = pesanan.map((p) => p.no_pesanan);
  if (new Set(nomor).size !== nomor.length) throw new Gagal(400, "Ada no. pesanan yang dobel di kiriman ini");
  const ada = await noSudahAda(env.DB, s.id, nomor);
  const baru = pesanan.filter((p) => !ada.has(p.no_pesanan));
  const lama = await env.DB.prepare("SELECT oleh FROM impor_batch WHERE id = ?").bind(batchId).first<{ oleh: string }>();
  if (lama && lama.oleh !== staff.id) throw new Gagal(400, "ID impor tidak valid");
  const tulis: D1PreparedStatement[] = [
    env.DB.prepare("INSERT OR IGNORE INTO impor_batch (id, saluran_id, nama_file, waktu, oleh) VALUES (?, ?, ?, ?, ?)").bind(batchId, s.id, namaFile, sekarang(), staff.id),
    env.DB.prepare("UPDATE impor_batch SET masuk = masuk + ?, duplikat = duplikat + ?, batal = batal + ?, gagal = gagal + ? WHERE id = ?")
      .bind(baru.length, pesanan.length - baru.length, batal, gagalFile, batchId),
    ...baru.flatMap((p) => tulisPesanan(env.DB, s, p, info, "Impor", batchId, staff.id)),
  ];
  // Kecocokan kolom dan pasangan SKU disimpan sebagai preset saluran.
  if (b.preset_kolom && typeof b.preset_kolom === "object") {
    const peta = b.peta_sku && typeof b.peta_sku === "object" ? b.peta_sku : {};
    tulis.push(env.DB.prepare("UPDATE saluran SET preset_kolom = ?, peta_sku = ? WHERE id = ?").bind(JSON.stringify(b.preset_kolom).slice(0, 4000), JSON.stringify(peta).slice(0, 8000), s.id));
  }
  if (!lama) tulis.push(logAktivitas(env.DB, staff, "Impor pesanan online", { tabel: "impor_batch", id: batchId, keterangan: `${s.nama} ${namaFile}` }));
  try {
    await env.DB.batch(tulis);
  } catch (e) {
    if (bentrok(e)) throw new Gagal(409, "Pesanan yang sama baru saja disimpan dari tempat lain. Ulangi impor; yang sudah masuk akan dilewati");
    throw e;
  }
  return json({ masuk: baru.length, duplikat: pesanan.length - baru.length, dilewati: [...ada] });
}

// Pratinjau impor: no. pesanan yang sudah pernah masuk.
export async function cekImpor(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const s = await ambilSaluran(env.DB, wajibTeks(b, "saluran_id", "Saluran", { max: 20 }));
  const no = Array.isArray(b.no) ? (b.no as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5000) : [];
  return json({ ada: [...(await noSudahAda(env.DB, s.id, no))] });
}

export async function riwayatImpor(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB.prepare(
    "SELECT b.*, s.nama AS saluran, o.nama AS oleh_nama FROM impor_batch b JOIN saluran s ON s.id = b.saluran_id JOIN staff o ON o.id = b.oleh ORDER BY b.waktu DESC LIMIT 200",
  ).all();
  return json({ impor: results });
}

export async function daftarPesanan(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const syarat: string[] = [], nilai: unknown[] = [];
  if (q.dari) { syarat.push("o.tanggal >= ?"); nilai.push(waktuWibKeIso(q.dari, "Dari tanggal")); }
  if (q.sampai) { syarat.push("o.tanggal < ?"); nilai.push(new Date(Date.parse(waktuWibKeIso(q.sampai, "Sampai tanggal")) + 86_400_000).toISOString()); }
  if (q.saluran) { syarat.push("o.saluran_id = ?"); nilai.push(q.saluran); }
  if (q.cari) { syarat.push("(o.no_pesanan LIKE ? OR o.pembeli LIKE ? OR EXISTS (SELECT 1 FROM pesanan_item i WHERE i.pesanan_id = o.id AND (i.sku LIKE ? OR i.nama LIKE ?)))"); nilai.push(...Array(4).fill(`%${q.cari}%`)); }
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.saluran_id, s.nama AS saluran, o.no_pesanan, o.tanggal, o.pembeli, o.status, o.kotor, o.potongan, o.sumber, o.catatan, st.nama AS oleh,
      (SELECT json_group_array(json_object('sku', i.sku, 'nama', i.nama, 'qty', i.qty, 'harga', i.harga)) FROM pesanan_item i WHERE i.pesanan_id = o.id) AS items
     FROM pesanan_online o JOIN saluran s ON s.id = o.saluran_id JOIN staff st ON st.id = o.oleh
     ${syarat.length ? "WHERE " + syarat.join(" AND ") : ""} ORDER BY o.tanggal DESC LIMIT 1000`,
  ).bind(...nilai).all<Obj>();
  const pesanan = results.map((o): Obj & { bersih: number } => ({ ...o, items: JSON.parse(o.items as string), bersih: (o.kotor as number) - (o.potongan as number) }));
  const aktif = pesanan.filter((o) => o.status !== "Dibatalkan");
  const per: Record<string, { jumlah: number; kotor: number; potongan: number; bersih: number }> = {};
  for (const o of aktif) {
    const x = (per[o.saluran_id as string] ??= { jumlah: 0, kotor: 0, potongan: 0, bersih: 0 });
    x.jumlah++; x.kotor += o.kotor as number; x.potongan += o.potongan as number; x.bersih += o.bersih;
  }
  const total = Object.values(per).reduce((a, x) => ({ jumlah: a.jumlah + x.jumlah, kotor: a.kotor + x.kotor, potongan: a.potongan + x.potongan, bersih: a.bersih + x.bersih }), { jumlah: 0, kotor: 0, potongan: 0, bersih: 0 });
  return json({ pesanan, ringkasan: { total, per_saluran: per } });
}

export async function detailPesanan(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const o = await env.DB.prepare(
    `SELECT o.*, s.nama AS saluran, st.nama AS oleh_nama, b.nama AS batal_oleh_nama, p.nama AS pelanggan, i.nama_file
     FROM pesanan_online o JOIN saluran s ON s.id = o.saluran_id JOIN staff st ON st.id = o.oleh LEFT JOIN staff b ON b.id = o.batal_oleh
     LEFT JOIN pelanggan p ON p.id = o.pelanggan_id LEFT JOIN impor_batch i ON i.id = o.impor_id WHERE o.id = ?`,
  ).bind(id).first();
  if (!o) throw new Gagal(404, "Pesanan tidak ditemukan");
  const items = await env.DB.prepare("SELECT sku, nama, qty, harga, hpp FROM pesanan_item WHERE pesanan_id = ? ORDER BY urutan").bind(id).all();
  return json({ pesanan: o, items: items.results });
}

// Ubah status. Dibatalkan mengembalikan stok ke Gudang Pusat dan tidak bisa diaktifkan lagi (input ulang kalau perlu).
export async function ubahStatusPesanan(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const status = wajibTeks(b, "status", "Status", { max: 12 });
  if (!["Selesai", "Diproses", "Dibatalkan"].includes(status)) throw new Gagal(400, "Status tidak dikenal");
  const o = await env.DB.prepare("SELECT id, no_pesanan, status FROM pesanan_online WHERE id = ?").bind(id).first<{ id: string; no_pesanan: string; status: string }>();
  if (!o) throw new Gagal(404, "Pesanan tidak ditemukan");
  if (o.status === "Dibatalkan") throw new Gagal(400, "Pesanan sudah dibatalkan");
  if (o.status === status) return json({ ok: true });
  const t = sekarang();
  const tulis = [
    penjaga(env.DB, "(SELECT status FROM pesanan_online WHERE id = ?) = ?", id, o.status),
    env.DB.prepare(`UPDATE pesanan_online SET status = ?, diubah_pada = ?${status === "Dibatalkan" ? ", batal_pada = ?, batal_oleh = ?" : ""} WHERE id = ? AND status <> 'Dibatalkan'`)
      .bind(...(status === "Dibatalkan" ? [status, t, t, staff.id, id] : [status, t, id])),
    logAktivitas(env.DB, staff, status === "Dibatalkan" ? "Batalkan pesanan online" : "Ubah status pesanan online", { tabel: "pesanan_online", id, keterangan: `${o.no_pesanan}: ${status}` }),
  ];
  if (status === "Dibatalkan") {
    const { results } = await env.DB.prepare("SELECT sku, qty FROM pesanan_item WHERE pesanan_id = ?").bind(id).all<{ sku: string; qty: number }>();
    for (const i of results) tulis.push(...gerakStok(env.DB, i.sku, "gudang", i.qty, "void", "pesanan_online", id, t, staff.id));
  }
  try {
    await env.DB.batch(tulis);
  } catch (e) {
    if (kenaPenjaga(e)) throw new Gagal(409, "Pesanan baru saja berubah. Muat ulang");
    throw e;
  }
  return json({ ok: true });
}
