// Akun dashboard: Owner pertama, masuk, keluar, ganti password.

import { cocokPassword, hashPassword, hashPin, hashTiruan, ITERASI_PBKDF2, samaPersis, sha256 } from "./sandi.js";
import { ambilRole, buatSesi, catatSalah, cekTerkunci, cookieHapus, cookieSesi, COOKIE, hapusSalah, logMasuk, sesiDashboard, Staff } from "./sesi.js";
import { bacaCookie, bacaJson, cekPassword, cekPinBaru, email, Gagal, json, sekarang, ulid, wajibTeks } from "./util.js";

const adaStaff = async (db: D1Database) => (await db.prepare("SELECT 1 AS ada FROM staff LIMIT 1").first()) !== null;

export const profil = (s: Staff) => ({
  id: s.id,
  nama: s.nama,
  email: s.email,
  role: s.role,
  wajib_ganti_password: s.pw_sementara === 1,
});

export async function statusSetup(_req: Request, env: Env) {
  return json({ perlu: !(await adaStaff(env.DB)) });
}

// Membuat Owner pertama. Hanya bisa sekali, saat tabel staff masih kosong, dan butuh kode setup.
export async function setup(req: Request, env: Env) {
  const b = await bacaJson(req);
  const kode = wajibTeks(b, "kode", "Kode setup");
  if (!env.SETUP_KODE || !samaPersis(await sha256(kode), await sha256(env.SETUP_KODE))) {
    throw new Gagal(403, "Kode setup salah");
  }
  if (await adaStaff(env.DB)) throw new Gagal(409, "Owner sudah ada. Masuk lewat halaman login");
  const nama = wajibTeks(b, "nama", "Nama", { max: 80 });
  const mail = email(b, "email", true)!;
  const pw = cekPassword(b.password);
  const pin = cekPinBaru(b.pin);
  const id = ulid();
  const t = sekarang();
  const h = await hashPassword(env.PEPPER, pw);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO staff (id, nama, email, pw_hash, pw_salt, pw_iterasi, pw_sementara, pin_hash, pin_sementara, aktif, dibuat_pada, diubah_pada)
       SELECT ?, ?, ?, ?, ?, ?, 0, ?, 0, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM staff)`,
    ).bind(id, nama, mail, h.hash, h.salt, h.iterasi, await hashPin(env.PEPPER, id, pin), t, t),
    env.DB.prepare("INSERT INTO staff_role (staff_id, role) SELECT ?, 'owner' WHERE EXISTS (SELECT 1 FROM staff WHERE id = ?)").bind(id, id),
  ]);
  return json({ ok: true }, 201);
}

export async function masuk(req: Request, env: Env) {
  const b = await bacaJson(req);
  const mail = email(b, "email", true)!;
  const pw = typeof b.password === "string" ? b.password : "";
  const kunci = `pw:${mail}`;
  await cekTerkunci(env.DB, kunci);

  const row = await env.DB
    .prepare("SELECT id, nama, email, pw_hash, pw_salt, pw_iterasi, pw_sementara, pin_sementara FROM staff WHERE email = ? AND aktif = 1")
    .bind(mail)
    .first<{ id: string; nama: string; email: string; pw_hash: string | null; pw_salt: string; pw_iterasi: number; pw_sementara: number; pin_sementara: number }>();
  const role = row ? await ambilRole(env.DB, row.id) : [];
  const bolehDashboard = role.includes("owner") || role.includes("admin");

  let cocok = false;
  if (row?.pw_hash && bolehDashboard) cocok = await cocokPassword(env.PEPPER, pw, row.pw_hash, row.pw_salt, row.pw_iterasi);
  else await hashTiruan(env.PEPPER);

  if (!row || !cocok) {
    const sisa = await catatSalah(env.DB, kunci);
    await logMasuk(env.DB, req, { staffId: row?.id, nama: row?.nama, aksi: "Password salah", tempat: "dashboard", keterangan: mail }).run();
    throw new Gagal(401, sisa > 0 ? `Email atau password salah. Sisa ${sisa} percobaan` : "Terlalu banyak percobaan salah. Coba lagi setelah 15 menit");
  }

  const tulis = [hapusSalah(env.DB, kunci), logMasuk(env.DB, req, { staffId: row.id, nama: row.nama, aksi: "Masuk", tempat: "dashboard" })];
  if (row.pw_iterasi < ITERASI_PBKDF2) {
    const h = await hashPassword(env.PEPPER, pw);
    tulis.push(env.DB.prepare("UPDATE staff SET pw_hash = ?, pw_salt = ?, pw_iterasi = ? WHERE id = ?").bind(h.hash, h.salt, h.iterasi, row.id));
  }
  await env.DB.batch(tulis);
  const token = await buatSesi(env.DB, req, "dashboard", row.id, null);
  return json({ staff: profil({ ...row, role }) }, 200, { "set-cookie": cookieSesi(token) });
}

export async function keluar(req: Request, env: Env) {
  const token = bacaCookie(req, COOKIE);
  if (token) {
    const s = await sesiDashboard(env.DB, req).catch(() => null);
    const tulis = [env.DB.prepare("DELETE FROM sesi WHERE id = ?").bind(await sha256(token))];
    if (s) tulis.push(logMasuk(env.DB, req, { staffId: s.staff.id, nama: s.staff.nama, aksi: "Keluar", tempat: "dashboard" }));
    await env.DB.batch(tulis);
  }
  return json({ ok: true }, 200, { "set-cookie": cookieHapus });
}

export async function saya(req: Request, env: Env) {
  const { staff } = await sesiDashboard(env.DB, req);
  return json({ staff: profil(staff) });
}

export async function gantiPassword(req: Request, env: Env) {
  const { staff, sesiId } = await sesiDashboard(env.DB, req);
  const b = await bacaJson(req);
  const lama = typeof b.lama === "string" ? b.lama : "";
  const baru = cekPassword(b.baru);
  if (lama === baru) throw new Gagal(400, "Password baru harus berbeda dari yang lama");
  const row = await env.DB.prepare("SELECT pw_hash, pw_salt, pw_iterasi FROM staff WHERE id = ?").bind(staff.id)
    .first<{ pw_hash: string; pw_salt: string; pw_iterasi: number }>();
  if (!row || !(await cocokPassword(env.PEPPER, lama, row.pw_hash, row.pw_salt, row.pw_iterasi))) {
    throw new Gagal(400, "Password lama salah");
  }
  const h = await hashPassword(env.PEPPER, baru);
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET pw_hash = ?, pw_salt = ?, pw_iterasi = ?, pw_sementara = 0, diubah_pada = ? WHERE id = ?")
      .bind(h.hash, h.salt, h.iterasi, sekarang(), staff.id),
    // Sesi lain milik akun ini ikut keluar.
    env.DB.prepare("DELETE FROM sesi WHERE staff_id = ? AND jenis = 'dashboard' AND id <> ?").bind(staff.id, sesiId),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Ganti password", tempat: "dashboard" }),
  ]);
  return json({ ok: true });
}
