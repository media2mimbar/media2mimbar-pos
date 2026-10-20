// Dashboard › Pelanggan: daftar dengan ringkasan belanja, detail dengan riwayat transaksi POS, tambah dan ubah.

import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang, teks, ulid, wajibTeks } from "./util.js";

const telpRapi = (s: string | null) => (s ? s.replace(/[^\d+]/g, "") || null : null);

export async function daftarPelanggan(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = (new URL(req.url).searchParams.get("cari") ?? "").trim();
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.nama, p.telp, p.kota, p.grup, p.catatan, p.dibuat_pada,
      COUNT(t.id) AS transaksi, COALESCE(SUM(t.total), 0) AS belanja, MAX(t.waktu) AS terakhir
     FROM pelanggan p LEFT JOIN trx t ON t.pelanggan_id = p.id AND t.status = 'Lunas'
     ${q ? "WHERE p.nama LIKE ? OR p.telp LIKE ? OR p.kota LIKE ?" : ""}
     GROUP BY p.id ORDER BY COALESCE(MAX(t.waktu), p.dibuat_pada) DESC LIMIT 1000`,
  ).bind(...(q ? [`%${q}%`, `%${q.replace(/\D/g, "") || q}%`, `%${q}%`] : [])).all();
  return json({ pelanggan: results });
}

export async function detailPelanggan(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const p = await env.DB.prepare("SELECT p.*, s.nama AS dibuat_oleh_nama FROM pelanggan p LEFT JOIN staff s ON s.id = p.dibuat_oleh WHERE p.id = ?").bind(id).first();
  if (!p) throw new Gagal(404, "Pelanggan tidak ditemukan");
  const [trx, online] = await Promise.all([
    env.DB.prepare(
      `SELECT t.id, t.no, t.waktu, t.total, t.status, t.presale, t.ambil_status, l.nama AS lokasi,
        (SELECT group_concat(nama || ' ×' || qty, ', ') FROM trx_item WHERE trx_id = t.id) AS barang
       FROM trx t JOIN lokasi l ON l.id = t.lokasi_id WHERE t.pelanggan_id = ? ORDER BY t.waktu DESC LIMIT 300`,
    ).bind(id).all<{ total: number; status: string }>(),
    env.DB.prepare(
      `SELECT o.id, o.no_pesanan AS no, o.tanggal AS waktu, o.kotor - o.potongan AS total, o.status, s.nama AS lokasi,
        (SELECT group_concat(nama || ' ×' || qty, ', ') FROM pesanan_item WHERE pesanan_id = o.id) AS barang
       FROM pesanan_online o JOIN saluran s ON s.id = o.saluran_id WHERE o.pelanggan_id = ? ORDER BY o.tanggal DESC LIMIT 300`,
    ).bind(id).all(),
  ]);
  const lunas = trx.results.filter((t) => t.status === "Lunas");
  return json({ pelanggan: p, transaksi: trx.results, online: online.results, ringkasan: { transaksi: lunas.length, belanja: lunas.reduce((a, t) => a + t.total, 0) } });
}

function isian(b: Obj) {
  return {
    nama: wajibTeks(b, "nama", "Nama", { max: 80 }),
    telp: telpRapi(teks(b, "telp", "No HP", { max: 20, wajib: false })),
    kota: teks(b, "kota", "Kota", { max: 60, wajib: false }),
    grup: teks(b, "grup", "Grup", { max: 40, wajib: false }),
    catatan: teks(b, "catatan", "Catatan", { max: 300, wajib: false }),
  };
}

async function cekTelpDobel(db: D1Database, telp: string | null, kecuali = "") {
  if (!telp) return;
  const ada = await db.prepare("SELECT nama FROM pelanggan WHERE telp = ? AND id <> ?").bind(telp, kecuali).first<{ nama: string }>();
  if (ada) throw new Gagal(409, `No HP ${telp} sudah dipakai pelanggan ${ada.nama}`);
}

export async function tambahPelanggan(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = isian(await bacaJson(req));
  await cekTelpDobel(env.DB, p.telp);
  const id = ulid(), t = sekarang();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO pelanggan (id, nama, telp, kota, grup, catatan, dibuat_pada, diubah_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, p.nama, p.telp, p.kota, p.grup, p.catatan, t, t, staff.id),
    logAktivitas(env.DB, staff, "Tambah pelanggan", { tabel: "pelanggan", id, keterangan: p.nama }),
  ]);
  return json({ id }, 201);
}

export async function ubahPelanggan(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = isian(await bacaJson(req));
  await cekTelpDobel(env.DB, p.telp, id);
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE pelanggan SET nama = ?, telp = ?, kota = ?, grup = ?, catatan = ?, diubah_pada = ? WHERE id = ?").bind(p.nama, p.telp, p.kota, p.grup, p.catatan, sekarang(), id),
    logAktivitas(env.DB, staff, "Ubah pelanggan", { tabel: "pelanggan", id, keterangan: p.nama }),
  ]);
  if (r[0].meta.changes !== 1) throw new Gagal(404, "Pelanggan tidak ditemukan");
  return json({ ok: true });
}
