// Karyawan: hanya Owner yang bisa menambah, mengubah, menonaktifkan, dan mereset akun.

import { hashPassword, hashPin, passwordSementara, pinSementara } from "./sandi.js";
import { logMasuk, sesiSiap } from "./sesi.js";
import { hariIniWib } from "./aturan.js";
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
  bertugas: string | null;
  terakhir_pos: string | null;
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
  bertugas: r.bertugas ? r.bertugas.split("\u001f") : [],
  terakhir_pos: r.terakhir_pos,
});

const SELECT = `SELECT s.id, s.nama, s.telp, s.email, s.aktif, s.pw_sementara, s.pin_sementara, s.dibuat_pada,
  (SELECT group_concat(role) FROM staff_role WHERE staff_id = s.id) AS role,
  (SELECT group_concat(e.nama, char(31)) FROM event_kasir k JOIN event e ON e.id = k.event_id WHERE k.staff_id = s.id AND e.ditutup = 0) AS bertugas,
  (SELECT MAX(waktu) FROM log_masuk WHERE staff_id = s.id AND tempat = 'pos') AS terakhir_pos FROM staff s`;

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

// Owner mengelola; Admin hanya melihat.
export async function daftar(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
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

// ?staff= (per karyawan), ?tempat=pos|dashboard. Admin hanya melihat riwayat POS.
export async function riwayatMasuk(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const q = new URL(req.url).searchParams;
  const tempat = staff.role.includes("owner") ? q.get("tempat") : "pos";
  const syarat: string[] = [], nilai: unknown[] = [];
  if (q.get("staff")) { syarat.push("l.staff_id = ?"); nilai.push(q.get("staff")); }
  if (tempat === "pos" || tempat === "dashboard") { syarat.push("l.tempat = ?"); nilai.push(tempat); }
  const hari = hariIniWib();
  const [daftar, salah] = await Promise.all([
    env.DB.prepare(
      `SELECT l.waktu, l.nama, l.aksi, l.tempat, l.ip, l.keterangan, p.kode AS perangkat
       FROM log_masuk l LEFT JOIN perangkat p ON p.id = l.perangkat_id ${syarat.length ? "WHERE " + syarat.join(" AND ") : ""} ORDER BY l.waktu DESC LIMIT 300`,
    ).bind(...nilai).all(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM log_masuk WHERE aksi IN ('PIN salah', 'Password salah') AND waktu >= ?")
      .bind(new Date(Date.parse(hari) - 7 * 3600_000).toISOString()).first<{ n: number }>(),
  ]);
  return json({ riwayat: daftar.results, salah_hari_ini: salah?.n ?? 0 });
}

// Karyawan › Bertugas Hari Ini: satu kartu per lokasi aktif, laci terbuka, dan status kasir yang ditugaskan dari riwayat masuk hari ini.
export async function bertugasHariIni(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const hari = hariIniWib();
  const mulai = new Date(Date.parse(hari) - 7 * 3600_000).toISOString();
  const [lokasi, tugas, shift, log, jual] = await Promise.all([
    env.DB.prepare(
      `SELECT l.id, l.nama, l.jenis, e.mulai, e.selesai, e.pj_id, p.nama AS pj FROM lokasi l LEFT JOIN event e ON e.id = l.id LEFT JOIN staff p ON p.id = e.pj_id
       WHERE l.aktif = 1 AND (l.jenis = 'gudang' OR (e.ditutup = 0 AND e.mulai <= ?)) ORDER BY l.jenis DESC, l.nama`,
    ).bind(hari).all<{ id: string; nama: string; jenis: string; pj: string | null }>(),
    env.DB.prepare("SELECT k.event_id, k.staff_id, s.nama FROM event_kasir k JOIN staff s ON s.id = k.staff_id JOIN event e ON e.id = k.event_id WHERE e.ditutup = 0 AND e.mulai <= ? AND s.aktif = 1")
      .bind(hari).all<{ event_id: string; staff_id: string; nama: string }>(),
    env.DB.prepare(
      `SELECT s.id, s.lokasi_id, s.kasir_id, a.nama AS kasir, s.buka,
        (SELECT COUNT(*) FROM trx WHERE shift_id = s.id AND status = 'Lunas') AS transaksi, (SELECT COALESCE(SUM(total), 0) FROM trx WHERE shift_id = s.id AND status = 'Lunas') AS penjualan
       FROM shift s JOIN staff a ON a.id = s.kasir_id WHERE s.status = 'buka'`,
    ).all<{ id: string; lokasi_id: string; kasir_id: string; kasir: string; buka: string }>(),
    env.DB.prepare("SELECT staff_id, nama, aksi, waktu, keterangan FROM log_masuk WHERE tempat = 'pos' AND waktu >= ? AND staff_id IS NOT NULL ORDER BY waktu")
      .bind(mulai).all<{ staff_id: string; nama: string; aksi: string; waktu: string; keterangan: string | null }>(),
    env.DB.prepare("SELECT DISTINCT t.lokasi_id, t.kasir_id, s.nama FROM trx t JOIN staff s ON s.id = t.kasir_id WHERE t.waktu >= ?").bind(mulai)
      .all<{ lokasi_id: string; kasir_id: string; nama: string }>(),
  ]);
  const statusOrang = (id: string, l: { id: string; nama: string }) => {
    const laci = shift.results.find((s) => s.kasir_id === id && s.lokasi_id === l.id);
    if (laci) return { status: "buka", teks: `Membuka kasir sejak ${laci.buka}`, waktu: laci.buka };
    const milik = log.results.filter((x) => x.staff_id === id);
    const gabung = milik.filter((x) => x.aksi === "Gabung kasir" && x.keterangan === l.nama).pop();
    const akhir = milik.at(-1);
    if (akhir?.aksi === "Keluar") return { status: "keluar", teks: "Sudah keluar", waktu: akhir.waktu };
    if (gabung) return { status: "gabung", teks: "Bergabung ke laci", waktu: gabung.waktu };
    const masuk = milik.find((x) => x.aksi === "Masuk" || x.aksi === "Masuk offline");
    if (masuk) return { status: "masuk", teks: "Masuk POS", waktu: masuk.waktu };
    return { status: "belum", teks: "Belum masuk POS hari ini", waktu: null };
  };
  const kartu = lokasi.results.map((l) => {
    const ditugaskan = tugas.results.filter((t) => t.event_id === l.id);
    const lain = jual.results.filter((j) => j.lokasi_id === l.id && !ditugaskan.some((t) => t.staff_id === j.kasir_id))
      .concat(shift.results.filter((s) => s.lokasi_id === l.id && !ditugaskan.some((t) => t.staff_id === s.kasir_id)).map((s) => ({ lokasi_id: l.id, kasir_id: s.kasir_id, nama: s.kasir })));
    const unik = [...new Map(lain.map((x) => [x.kasir_id, x])).values()];
    return {
      ...l,
      laci: shift.results.filter((s) => s.lokasi_id === l.id),
      orang: [...ditugaskan.map((t) => ({ id: t.staff_id, nama: t.nama, ditugaskan: true, ...statusOrang(t.staff_id, l) })),
        ...unik.map((x) => ({ id: x.kasir_id, nama: x.nama, ditugaskan: false, ...statusOrang(x.kasir_id, l) }))],
    };
  });
  const ganda = new Map<string, { nama: string; n: number }>();
  for (const t of tugas.results) ganda.set(t.staff_id, { nama: t.nama, n: (ganda.get(t.staff_id)?.n ?? 0) + 1 });
  return json({
    kartu,
    ringkasan: {
      lokasi: kartu.length, laci: shift.results.length,
      belum_masuk: kartu.reduce((a, k) => a + k.orang.filter((o) => o.ditugaskan && o.status === "belum").length, 0),
      ganda: [...ganda.values()].filter((g) => g.n > 1).map((g) => g.nama),
    },
  });
}

// Daftar nama karyawan aktif untuk pilihan di form (kasir event, penanggung jawab). Owner dan Admin.
export async function daftarRingkas(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.nama, (SELECT group_concat(role) FROM staff_role WHERE staff_id = s.id) AS role FROM staff s WHERE s.aktif = 1 ORDER BY s.nama`,
  ).all<{ id: string; nama: string; role: string | null }>();
  return json({ karyawan: results.map((r) => ({ id: r.id, nama: r.nama, role: r.role ? r.role.split(",").sort() : [], aktif: true })) });
}
