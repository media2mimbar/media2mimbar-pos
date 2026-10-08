// Karyawan: hanya Owner yang bisa menambah, mengubah, menonaktifkan, dan mereset akun.

import { hashPassword, hashPin, passwordSementara, pinSementara } from "./sandi.js";
import { logMasuk, sesiSiap } from "./sesi.js";
import { bacaJson, cekPassword, cekPin, daftarRole, email, Gagal, json, Role, sekarang, teks, ulid, wajibTeks } from "./util.js";

interface BarisStaff {
  id: string;
  nama: string;
  telp: string | null;
  email: string | null;
  aktif: number;
  pw_sementara: number;
  pin_sementara: number;
  role: string | null;
  dibuat_pada: string;
}

const tampil = (r: BarisStaff) => ({
  id: r.id,
  nama: r.nama,
  telp: r.telp,
  email: r.email,
  aktif: r.aktif === 1,
  role: r.role ? r.role.split(",").sort() : [],
  password_sementara: r.email ? r.pw_sementara === 1 : null,
  pin_sementara: r.pin_sementara === 1,
  dibuat_pada: r.dibuat_pada,
});

const SELECT = `SELECT s.id, s.nama, s.telp, s.email, s.aktif, s.pw_sementara, s.pin_sementara, s.dibuat_pada,
  (SELECT group_concat(role) FROM staff_role WHERE staff_id = s.id) AS role FROM staff s`;

function cekRoleEmail(role: Role[], mail: string | null) {
  if ((role.includes("owner") || role.includes("admin")) && !mail) {
    throw new Gagal(400, "Owner dan Admin wajib punya email untuk masuk dashboard");
  }
}

async function emailDipakai(db: D1Database, mail: string | null, kecuali: string) {
  if (!mail) return;
  const ada = await db.prepare("SELECT 1 FROM staff WHERE email = ? AND id <> ?").bind(mail, kecuali).first();
  if (ada) throw new Gagal(409, "Email sudah dipakai karyawan lain");
}

export async function daftar(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner");
  const { results } = await env.DB.prepare(`${SELECT} ORDER BY s.aktif DESC, s.nama`).all<BarisStaff>();
  return json({ karyawan: results.map(tampil) });
}

export async function tambah(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const b = await bacaJson(req);
  const nama = wajibTeks(b, "nama", "Nama", { max: 80 });
  const telp = teks(b, "telp", "No HP", { max: 20, wajib: false });
  const role = daftarRole(b, "role");
  const mail = email(b, "email", false);
  cekRoleEmail(role, mail);
  const id = ulid();
  await emailDipakai(env.DB, mail, id);

  // Password dan PIN sementara boleh diisi Owner, kalau kosong dibuatkan otomatis.
  const pw = mail ? (b.password ? cekPassword(b.password) : passwordSementara()) : null;
  const pin = b.pin ? cekPin(b.pin) : pinSementara();
  const h = pw ? await hashPassword(env.PEPPER, pw) : null;
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO staff (id, nama, telp, email, pw_hash, pw_salt, pw_iterasi, pw_sementara, pin_hash, pin_sementara, aktif, dibuat_pada, diubah_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, 1, ?, ?, ?)`,
    ).bind(id, nama, telp, mail, h?.hash ?? null, h?.salt ?? null, h?.iterasi ?? null, await hashPin(env.PEPPER, id, pin), t, t, staff.id),
    ...role.map((r) => env.DB.prepare("INSERT INTO staff_role (staff_id, role) VALUES (?, ?)").bind(id, r)),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Tambah karyawan", tempat: "dashboard", keterangan: nama }),
  ]);
  // Password dan PIN sementara hanya ditampilkan sekali ini.
  return json({ id, password_sementara: pw, pin_sementara: pin }, 201);
}

async function ambil(db: D1Database, id: string) {
  const row = await db.prepare(`${SELECT} WHERE s.id = ?`).bind(id).first<BarisStaff>();
  if (!row) throw new Gagal(404, "Karyawan tidak ditemukan");
  return row;
}

async function adaOwnerLain(db: D1Database, kecuali: string) {
  const row = await db
    .prepare("SELECT 1 FROM staff s JOIN staff_role r ON r.staff_id = s.id WHERE r.role = 'owner' AND s.aktif = 1 AND s.id <> ?")
    .bind(kecuali)
    .first();
  return row !== null;
}

export async function ubah(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const lama = await ambil(env.DB, id);
  const b = await bacaJson(req);
  const nama = wajibTeks(b, "nama", "Nama", { max: 80 });
  const telp = teks(b, "telp", "No HP", { max: 20, wajib: false });
  const role = daftarRole(b, "role");
  const mail = email(b, "email", false);
  const aktif = b.aktif === undefined ? lama.aktif === 1 : b.aktif === true;
  cekRoleEmail(role, mail);
  await emailDipakai(env.DB, mail, id);

  if (id === staff.id && !aktif) throw new Gagal(400, "Tidak bisa menonaktifkan akun sendiri");
  const ownerLama = tampil(lama).role.includes("owner");
  if (ownerLama && (!role.includes("owner") || !aktif) && !(await adaOwnerLain(env.DB, id))) {
    throw new Gagal(400, "Harus ada minimal satu Owner aktif");
  }

  const tulis = [
    env.DB.prepare("UPDATE staff SET nama = ?, telp = ?, email = ?, aktif = ?, diubah_pada = ? WHERE id = ?")
      .bind(nama, telp, mail, aktif ? 1 : 0, sekarang(), id),
    env.DB.prepare("DELETE FROM staff_role WHERE staff_id = ?").bind(id),
    ...role.map((r) => env.DB.prepare("INSERT INTO staff_role (staff_id, role) VALUES (?, ?)").bind(id, r)),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: aktif ? "Ubah karyawan" : "Nonaktifkan karyawan", tempat: "dashboard", keterangan: nama }),
  ];
  // Email baru tanpa password: buatkan password sementara.
  let pw: string | null = null;
  if (mail && !lama.email) {
    pw = passwordSementara();
    const h = await hashPassword(env.PEPPER, pw);
    tulis.push(env.DB.prepare("UPDATE staff SET pw_hash = ?, pw_salt = ?, pw_iterasi = ?, pw_sementara = 1 WHERE id = ?").bind(h.hash, h.salt, h.iterasi, id));
  }
  if (!aktif) tulis.push(env.DB.prepare("DELETE FROM sesi WHERE staff_id = ?").bind(id));
  await env.DB.batch(tulis);
  return json({ ok: true, password_sementara: pw });
}

export async function resetPassword(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const row = await ambil(env.DB, id);
  if (!row.email) throw new Gagal(400, "Karyawan ini tidak punya email, jadi tidak memakai password");
  const pw = passwordSementara();
  const h = await hashPassword(env.PEPPER, pw);
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET pw_hash = ?, pw_salt = ?, pw_iterasi = ?, pw_sementara = 1, diubah_pada = ? WHERE id = ?")
      .bind(h.hash, h.salt, h.iterasi, sekarang(), id),
    env.DB.prepare("DELETE FROM sesi WHERE staff_id = ? AND jenis = 'dashboard'").bind(id),
    env.DB.prepare("DELETE FROM percobaan_gagal WHERE kunci = ?").bind(`pw:${row.email}`),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Reset password", tempat: "dashboard", keterangan: row.nama }),
  ]);
  return json({ password_sementara: pw });
}

export async function resetPin(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const row = await ambil(env.DB, id);
  const pin = pinSementara();
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET pin_hash = ?, pin_sementara = 1, diubah_pada = ? WHERE id = ?").bind(await hashPin(env.PEPPER, id, pin), sekarang(), id),
    env.DB.prepare("DELETE FROM sesi WHERE staff_id = ? AND jenis = 'pos'").bind(id),
    env.DB.prepare("DELETE FROM percobaan_gagal WHERE kunci LIKE ?").bind(`pin:${id}:%`),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Reset PIN", tempat: "dashboard", keterangan: row.nama }),
  ]);
  return json({ pin_sementara: pin });
}

export async function riwayatMasuk(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner");
  const { results } = await env.DB
    .prepare(
      `SELECT l.waktu, l.nama, l.aksi, l.tempat, l.ip, l.keterangan, p.kode AS perangkat
       FROM log_masuk l LEFT JOIN perangkat p ON p.id = l.perangkat_id ORDER BY l.waktu DESC LIMIT 200`,
    )
    .all();
  return json({ riwayat: results });
}
