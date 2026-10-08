// POS di HP: pilih nama, masuk dengan PIN 6 angka, ganti PIN sementara.

import { hashPin, samaPersis } from "./sandi.js";
import { ambilRole, buatSesi, catatSalah, cekTerkunci, hapusSalah, logMasuk, perangkatDari, sesiPos } from "./sesi.js";
import { bacaJson, cekPin, cekPinBaru, Gagal, json, sekarang, wajibTeks } from "./util.js";

export async function infoPerangkat(req: Request, env: Env) {
  return json({ perangkat: await perangkatDari(env.DB, req) });
}

export async function daftarKaryawan(req: Request, env: Env) {
  await perangkatDari(env.DB, req);
  // Tahap 4 nanti menyaring sesuai penugasan event. Untuk sekarang semua karyawan aktif.
  const { results } = await env.DB
    .prepare(`SELECT s.id, s.nama, (SELECT group_concat(role) FROM staff_role WHERE staff_id = s.id) AS role FROM staff s WHERE s.aktif = 1 ORDER BY s.nama`)
    .all<{ id: string; nama: string; role: string | null }>();
  return json({ karyawan: results.map((r) => ({ id: r.id, nama: r.nama, role: r.role ? r.role.split(",").sort() : [] })) });
}

export async function masuk(req: Request, env: Env) {
  const perangkat = await perangkatDari(env.DB, req);
  const b = await bacaJson(req);
  const staffId = wajibTeks(b, "staff_id", "Karyawan", { max: 40 });
  const pin = cekPin(b.pin);
  const kunci = `pin:${staffId}:${perangkat.id}`;
  await cekTerkunci(env.DB, kunci);

  const row = await env.DB.prepare("SELECT id, nama, pin_hash, pin_sementara FROM staff WHERE id = ? AND aktif = 1").bind(staffId)
    .first<{ id: string; nama: string; pin_hash: string; pin_sementara: number }>();
  if (!row) throw new Gagal(404, "Karyawan tidak ditemukan atau sudah nonaktif");
  if (!samaPersis(await hashPin(env.PEPPER, row.id, pin), row.pin_hash)) {
    const sisa = await catatSalah(env.DB, kunci);
    await logMasuk(env.DB, req, { staffId: row.id, nama: row.nama, aksi: "PIN salah", tempat: "pos", perangkatId: perangkat.id }).run();
    throw new Gagal(401, sisa > 0 ? `PIN salah. Sisa ${sisa} percobaan` : "Terlalu banyak PIN salah. Coba lagi setelah 15 menit");
  }
  await env.DB.batch([
    hapusSalah(env.DB, kunci),
    logMasuk(env.DB, req, { staffId: row.id, nama: row.nama, aksi: "Masuk", tempat: "pos", perangkatId: perangkat.id }),
  ]);
  const token = await buatSesi(env.DB, req, "pos", row.id, perangkat.id);
  return json({
    sesi: token,
    staff: { id: row.id, nama: row.nama, role: await ambilRole(env.DB, row.id), wajib_ganti_pin: row.pin_sementara === 1 },
    perangkat,
  });
}

export async function saya(req: Request, env: Env) {
  const { staff, perangkat } = await sesiPos(env.DB, req);
  return json({ staff: { id: staff.id, nama: staff.nama, role: staff.role, wajib_ganti_pin: staff.pin_sementara === 1 }, perangkat });
}

export async function gantiPin(req: Request, env: Env) {
  const { staff, perangkat } = await sesiPos(env.DB, req);
  const b = await bacaJson(req);
  const lama = cekPin(b.pin_lama);
  const baru = cekPinBaru(b.pin_baru);
  if (lama === baru) throw new Gagal(400, "PIN baru harus berbeda dari PIN lama");
  const row = await env.DB.prepare("SELECT pin_hash FROM staff WHERE id = ?").bind(staff.id).first<{ pin_hash: string }>();
  if (!row || !samaPersis(await hashPin(env.PEPPER, staff.id, lama), row.pin_hash)) throw new Gagal(400, "PIN lama salah");
  await env.DB.batch([
    env.DB.prepare("UPDATE staff SET pin_hash = ?, pin_sementara = 0, diubah_pada = ? WHERE id = ?").bind(await hashPin(env.PEPPER, staff.id, baru), sekarang(), staff.id),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Ganti PIN", tempat: "pos", perangkatId: perangkat.id }),
  ]);
  return json({ ok: true });
}

export async function keluar(req: Request, env: Env) {
  const { staff, perangkat, sesiId } = await sesiPos(env.DB, req);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sesi WHERE id = ?").bind(sesiId),
    logMasuk(env.DB, req, { staffId: staff.id, nama: staff.nama, aksi: "Keluar", tempat: "pos", perangkatId: perangkat.id }),
  ]);
  return json({ ok: true });
}
