// Pendaftaran HP kasir. Owner/Admin membuat kode sekali pakai di dashboard, kode diketik di HP.

import { sha256, tokenAcak } from "./sandi.js";
import { catatSalah, cekTerkunci, hapusSalah, logMasuk, sesiSiap } from "./sesi.js";
import { acakDari, bacaJson, Gagal, ipDari, json, sekarang, tambahMenit, ulid, wajibTeks } from "./util.js";

const MENIT_KODE = 10;
const HURUF_KODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa 0/O dan 1/I/L supaya tidak salah ketik

const kodeDaftar = () => acakDari(HURUF_KODE, 8);
const rapikanKode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Kode perangkat dua karakter: huruf + angka (A1, A2, ... Z9). Tidak dipakai ulang supaya nomor dokumen tetap unik.
async function kodePerangkatBaru(db: D1Database): Promise<string> {
  const { results } = await db.prepare("SELECT kode FROM perangkat").all<{ kode: string }>();
  const terpakai = new Set(results.map((r) => r.kode));
  for (const h of "ABCDEFGHJKLMNPQRSTUVWXYZ") for (const a of "123456789") if (!terpakai.has(h + a)) return h + a;
  throw new Gagal(409, "Kode perangkat sudah habis");
}

export async function daftar(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB
    .prepare(
      `SELECT p.id, p.kode, p.nama, p.status, p.daftar_kadaluarsa, p.terakhir_dipakai, p.dibuat_pada, a.nama AS dibuat_oleh
       FROM perangkat p LEFT JOIN staff a ON a.id = p.dibuat_oleh
       ORDER BY CASE p.status WHEN 'aktif' THEN 0 WHEN 'menunggu' THEN 1 ELSE 2 END, p.kode`,
    )
    .all<{ status: string; daftar_kadaluarsa: string | null }>();
  const t = sekarang();
  return json({
    perangkat: results.map((p) => ({
      ...p,
      status: p.status === "menunggu" && (!p.daftar_kadaluarsa || p.daftar_kadaluarsa < t) ? "kode_kadaluarsa" : p.status,
    })),
  });
}

export async function tambah(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const nama = wajibTeks(b, "nama", "Nama HP", { max: 60 });
  const id = ulid();
  const kode = await kodePerangkatBaru(env.DB);
  const daftarKode = kodeDaftar();
  const t = sekarang();
  const kadaluarsa = tambahMenit(t, MENIT_KODE);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO perangkat (id, kode, nama, status, daftar_kode_hash, daftar_kadaluarsa, dibuat_pada, diubah_pada, dibuat_oleh)
       VALUES (?, ?, ?, 'menunggu', ?, ?, ?, ?, ?)`,
    ).bind(id, kode, nama, await sha256(daftarKode), kadaluarsa, t, t, staff.id),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Buat kode HP", tempat: "dashboard", perangkatId: id, keterangan: `${kode} ${nama}` }),
  ]);
  return json({ id, kode, kode_daftar: daftarKode, berlaku_sampai: kadaluarsa }, 201);
}

export async function kodeBaru(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = await env.DB.prepare("SELECT kode, nama, status FROM perangkat WHERE id = ?").bind(id).first<{ kode: string; nama: string; status: string }>();
  if (!p) throw new Gagal(404, "Perangkat tidak ditemukan");
  if (p.status !== "menunggu") throw new Gagal(400, "Kode baru hanya untuk HP yang belum selesai didaftarkan");
  const daftarKode = kodeDaftar();
  const kadaluarsa = tambahMenit(sekarang(), MENIT_KODE);
  await env.DB.batch([
    env.DB.prepare("UPDATE perangkat SET daftar_kode_hash = ?, daftar_kadaluarsa = ?, diubah_pada = ? WHERE id = ?")
      .bind(await sha256(daftarKode), kadaluarsa, sekarang(), id),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Buat kode HP", tempat: "dashboard", perangkatId: id, keterangan: `${p.kode} ${p.nama}` }),
  ]);
  return json({ kode: p.kode, kode_daftar: daftarKode, berlaku_sampai: kadaluarsa });
}

export async function nonaktifkan(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const p = await env.DB.prepare("SELECT kode, nama, status FROM perangkat WHERE id = ?").bind(id).first<{ kode: string; nama: string; status: string }>();
  if (!p) throw new Gagal(404, "Perangkat tidak ditemukan");
  if (p.status === "nonaktif") return json({ ok: true });
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE perangkat SET status = 'nonaktif', token_hash = NULL, daftar_kode_hash = NULL, dinonaktifkan_oleh = ?, diubah_pada = ? WHERE id = ?",
    ).bind(staff.id, sekarang(), id),
    env.DB.prepare("DELETE FROM sesi WHERE perangkat_id = ?").bind(id),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Nonaktifkan HP", tempat: "dashboard", perangkatId: id, keterangan: `${p.kode} ${p.nama}` }),
  ]);
  return json({ ok: true });
}

// Dipanggil HP: tukar kode sekali pakai dengan token perangkat.
export async function sambungkan(req: Request, env: Env) {
  const kunci = `daftar:${ipDari(req)}`;
  await cekTerkunci(env.DB, kunci);
  const b = await bacaJson(req);
  const kode = rapikanKode(wajibTeks(b, "kode", "Kode pendaftaran", { max: 20 }));
  const t = sekarang();
  const p = await env.DB
    .prepare("SELECT id, kode, nama FROM perangkat WHERE daftar_kode_hash = ? AND status = 'menunggu' AND daftar_kadaluarsa > ?")
    .bind(await sha256(kode), t)
    .first<{ id: string; kode: string; nama: string }>();
  if (!p) {
    await catatSalah(env.DB, kunci);
    throw new Gagal(400, "Kode salah atau sudah kedaluwarsa. Minta kode baru dari dashboard");
  }
  const token = tokenAcak();
  const r = await env.DB.batch([
    env.DB.prepare(
      `UPDATE perangkat SET status = 'aktif', token_hash = ?, daftar_kode_hash = NULL, daftar_kadaluarsa = NULL, terakhir_dipakai = ?, diubah_pada = ?
       WHERE id = ? AND status = 'menunggu'`,
    ).bind(await sha256(token), t, t, p.id),
    hapusSalah(env.DB, kunci),
    logMasuk(env.DB, req, { aksi: "HP terdaftar", tempat: "pos", perangkatId: p.id, keterangan: `${p.kode} ${p.nama}` }),
  ]);
  if (r[0].meta.changes !== 1) throw new Gagal(409, "Kode ini baru saja dipakai HP lain");
  return json({ token, perangkat: p }, 201);
}
