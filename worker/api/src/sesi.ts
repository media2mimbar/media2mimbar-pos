// Sesi dashboard (cookie), sesi POS (token di HP), kunci setelah salah berulang, dan riwayat masuk.

import { sha256, tokenAcak } from "./sandi.js";
import { Gagal, Role, bacaCookie, ipDari, sekarang, tambahMenit, ulid } from "./util.js";

export const COOKIE = "hk_sesi";
const MENIT_TIDAK_AKTIF = 12 * 60;
const MENIT_SENTUH = 5; // terakhir_aktif hanya ditulis ulang setiap 5 menit, untuk hemat kuota tulis D1
const BATAS_SALAH = 5;
const MENIT_KUNCI = 15;

export interface Staff {
  id: string;
  nama: string;
  email: string | null;
  pw_sementara: number;
  pin_sementara: number;
  role: Role[];
}

export interface Perangkat {
  id: string;
  kode: string;
  nama: string;
}

export async function ambilRole(db: D1Database, staffId: string): Promise<Role[]> {
  const { results } = await db.prepare("SELECT role FROM staff_role WHERE staff_id = ? ORDER BY role").bind(staffId).all<{ role: Role }>();
  return results.map((r) => r.role);
}

export async function buatSesi(db: D1Database, req: Request, jenis: "dashboard" | "pos", staffId: string, perangkatId: string | null) {
  const token = tokenAcak();
  const t = sekarang();
  await db
    .prepare("INSERT INTO sesi (id, jenis, staff_id, perangkat_id, dibuat_pada, terakhir_aktif, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(await sha256(token), jenis, staffId, perangkatId, t, t, ipDari(req), (req.headers.get("user-agent") ?? "").slice(0, 200))
    .run();
  return token;
}

export function cookieSesi(token: string): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MENIT_TIDAK_AKTIF * 60}`;
}
export const cookieHapus = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

async function bacaSesi(db: D1Database, token: string | null, jenis: "dashboard" | "pos", perangkatId: string | null) {
  if (!token) return null;
  const id = await sha256(token);
  const row = await db
    .prepare(
      `SELECT s.id AS sesi_id, s.terakhir_aktif, s.perangkat_id, st.id, st.nama, st.email, st.pw_sementara, st.pin_sementara
       FROM sesi s JOIN staff st ON st.id = s.staff_id
       WHERE s.id = ? AND s.jenis = ? AND st.aktif = 1`,
    )
    .bind(id, jenis)
    .first<Omit<Staff, "role"> & { sesi_id: string; terakhir_aktif: string; perangkat_id: string | null }>();
  if (!row) return null;
  if (jenis === "pos" && row.perangkat_id !== perangkatId) return null;
  const t = sekarang();
  if (tambahMenit(row.terakhir_aktif, MENIT_TIDAK_AKTIF) < t) {
    await db.prepare("DELETE FROM sesi WHERE id = ?").bind(id).run();
    return null;
  }
  if (tambahMenit(row.terakhir_aktif, MENIT_SENTUH) < t) {
    await db.prepare("UPDATE sesi SET terakhir_aktif = ? WHERE id = ?").bind(t, id).run();
  }
  const staff: Staff = {
    id: row.id,
    nama: row.nama,
    email: row.email,
    pw_sementara: row.pw_sementara,
    pin_sementara: row.pin_sementara,
    role: await ambilRole(db, row.id),
  };
  return { sesiId: id, staff };
}

export async function sesiDashboard(db: D1Database, req: Request) {
  const s = await bacaSesi(db, bacaCookie(req, COOKIE), "dashboard", null);
  if (!s || !s.staff.role.some((r) => r === "owner" || r === "admin")) {
    throw new Gagal(401, "Silakan masuk dulu", "perlu_masuk");
  }
  return s;
}

export async function perangkatDari(db: D1Database, req: Request): Promise<Perangkat> {
  const token = req.headers.get("x-perangkat");
  if (!token) throw new Gagal(401, "HP ini belum didaftarkan", "perangkat_tidak_dikenal");
  const row = await db
    .prepare("SELECT id, kode, nama, status, terakhir_dipakai FROM perangkat WHERE token_hash = ?")
    .bind(await sha256(token))
    .first<Perangkat & { status: string; terakhir_dipakai: string | null }>();
  if (!row || row.status !== "aktif") {
    throw new Gagal(401, "HP ini sudah dinonaktifkan atau belum didaftarkan", "perangkat_tidak_dikenal");
  }
  const t = sekarang();
  if (!row.terakhir_dipakai || tambahMenit(row.terakhir_dipakai, MENIT_SENTUH) < t) {
    await db.prepare("UPDATE perangkat SET terakhir_dipakai = ? WHERE id = ?").bind(t, row.id).run();
  }
  return { id: row.id, kode: row.kode, nama: row.nama };
}

export async function sesiPos(db: D1Database, req: Request) {
  const perangkat = await perangkatDari(db, req);
  const s = await bacaSesi(db, req.headers.get("x-sesi"), "pos", perangkat.id);
  if (!s) throw new Gagal(401, "Silakan masuk dengan PIN", "perlu_masuk");
  return { ...s, perangkat };
}

export function wajibRole(staff: Staff, ...boleh: Role[]) {
  if (!staff.role.some((r) => boleh.includes(r))) throw new Gagal(403, "Akun ini tidak punya akses ke bagian ini");
}

// Kunci setelah 5 kali salah dalam 15 menit.

export async function cekTerkunci(db: D1Database, kunci: string) {
  const row = await db.prepare("SELECT kunci_sampai FROM percobaan_gagal WHERE kunci = ?").bind(kunci).first<{ kunci_sampai: string | null }>();
  if (row?.kunci_sampai && row.kunci_sampai > sekarang()) {
    throw new Gagal(429, "Terlalu banyak percobaan salah. Coba lagi setelah 15 menit", "terkunci");
  }
}

export async function catatSalah(db: D1Database, kunci: string): Promise<number> {
  const t = sekarang();
  const row = await db.prepare("SELECT jumlah, pertama FROM percobaan_gagal WHERE kunci = ?").bind(kunci).first<{ jumlah: number; pertama: string }>();
  const baru = !row || tambahMenit(row.pertama, MENIT_KUNCI) < t;
  const jumlah = baru ? 1 : row.jumlah + 1;
  const kunciSampai = jumlah >= BATAS_SALAH ? tambahMenit(t, MENIT_KUNCI) : null;
  await db
    .prepare(
      `INSERT INTO percobaan_gagal (kunci, jumlah, pertama, kunci_sampai) VALUES (?, ?, ?, ?)
       ON CONFLICT (kunci) DO UPDATE SET jumlah = excluded.jumlah, pertama = excluded.pertama, kunci_sampai = excluded.kunci_sampai`,
    )
    .bind(kunci, kunciSampai ? 0 : jumlah, baru || kunciSampai ? t : row.pertama, kunciSampai)
    .run();
  return BATAS_SALAH - jumlah;
}

export function hapusSalah(db: D1Database, kunci: string) {
  return db.prepare("DELETE FROM percobaan_gagal WHERE kunci = ?").bind(kunci);
}

export function logMasuk(
  db: D1Database,
  req: Request,
  d: { staffId?: string | null; nama?: string | null; aksi: string; tempat: "dashboard" | "pos"; perangkatId?: string | null; keterangan?: string },
) {
  return db
    .prepare("INSERT INTO log_masuk (id, waktu, staff_id, nama, aksi, tempat, perangkat_id, ip, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(ulid(), sekarang(), d.staffId ?? null, d.nama ?? null, d.aksi, d.tempat, d.perangkatId ?? null, ipDari(req), d.keterangan ?? null);
}

// Sesi dashboard yang sudah mengganti password sementara, dengan role tertentu.
export async function sesiSiap(db: D1Database, req: Request, ...boleh: Role[]) {
  const s = await sesiDashboard(db, req);
  if (s.staff.pw_sementara) throw new Gagal(403, "Ganti password sementara dulu", "wajib_ganti_password");
  if (boleh.length) wajibRole(s.staff, ...boleh);
  return s;
}

export function logAktivitas(db: D1Database, staff: Staff, aksi: string, ref: { tabel?: string; id?: string; keterangan?: string } = {}) {
  return db
    .prepare("INSERT INTO log_aktivitas (id, waktu, staff_id, nama, aksi, ref_tabel, ref_id, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(ulid(), sekarang(), staff.id, staff.nama, aksi, ref.tabel ?? null, ref.id ?? null, ref.keterangan ?? null);
}
