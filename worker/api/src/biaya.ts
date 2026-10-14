// Keuangan › Biaya: biaya event dan biaya umum di luar pembelian barang. Kas keluar laci POS ikut tampil sebagai biaya event.
// Admin hanya bisa mencatat biaya event dan melihat biaya event. Ubah, hapus, dan biaya umum khusus Owner.

import { hariIniWib } from "./aturan.js";
import { denganNomor } from "./dokumen.js";
import { logAktivitas, sesiSiap, Staff } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang, tanggal, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

export const KATEGORI_EVENT = ["Sewa booth", "Transportasi & logistik", "Honor kru", "Konsumsi", "Perlengkapan & display", "Promosi event", "Perizinan & retribusi", "Potongan bank & MDR QRIS", "Lainnya"];
export const KATEGORI_UMUM = ["Gaji karyawan tetap", "Sewa gudang & kantor", "Listrik, air & internet", "Iklan online", "Kemasan & label", "Foto & konten produk", "Potongan bank & MDR QRIS", "Lainnya"];
export const KATEGORI_LACI = "Kas keluar laci";

const owner = (s: Staff) => s.role.includes("owner");

async function isian(db: D1Database, b: Obj, staff: Staff) {
  const lokasi = teks(b, "lokasi_id", "Dibebankan ke", { max: 40, wajib: false });
  if (!lokasi && !owner(staff)) throw new Gagal(403, "Biaya umum hanya bisa dicatat Owner");
  if (lokasi && !(await db.prepare("SELECT 1 FROM event WHERE id = ?").bind(lokasi).first())) throw new Gagal(400, "Event tidak ditemukan");
  const kategori = wajibTeks(b, "kategori", "Kategori", { max: 40 });
  if (!(lokasi ? KATEGORI_EVENT : KATEGORI_UMUM).includes(kategori)) throw new Gagal(400, `Kategori tidak cocok untuk biaya ${lokasi ? "event" : "umum"}`);
  const tgl = tanggal(b, "tanggal", "Tanggal")!;
  if (tgl > hariIniWib()) throw new Gagal(400, "Tanggal tidak boleh di masa depan");
  const cara = wajibTeks(b, "cara", "Cara bayar", { max: 10 });
  if (cara !== "Transfer" && cara !== "Tunai") throw new Gagal(400, "Cara bayar Transfer atau Tunai");
  const bukti = teks(b, "bukti", "Bukti", { max: 40, wajib: false });
  if (bukti && !(await db.prepare("SELECT 1 FROM berkas WHERE id = ? AND jenis = 'bukti_biaya'").bind(bukti).first())) throw new Gagal(400, "Foto bukti tidak ditemukan. Unggah ulang");
  return { lokasi, kategori, tanggal: tgl, cara, bukti, keterangan: wajibTeks(b, "keterangan", "Keterangan", { max: 200 }), jumlah: wajibBulat(b, "jumlah", "Jumlah", { min: 1, max: 10_000_000_000 }) };
}

export async function kategoriBiaya(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  return json({ event: KATEGORI_EVENT, umum: KATEGORI_UMUM });
}

// Daftar biaya + kas keluar laci. Admin hanya boleh meminta biaya satu event (?lokasi=).
export async function daftarBiaya(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  if (!owner(staff) && (!q.lokasi || q.lokasi === "umum")) throw new Gagal(403, "Menu Keuangan khusus Owner");
  const s1: string[] = ["b.dihapus_pada IS NULL"], v1: unknown[] = [], s2: string[] = ["k.jenis = 'keluar'"], v2: unknown[] = [];
  if (q.lokasi === "umum") { s1.push("b.lokasi_id IS NULL"); s2.push("0"); }
  else if (q.lokasi) { s1.push("b.lokasi_id = ?"); v1.push(q.lokasi); s2.push("s.lokasi_id = ?"); v2.push(q.lokasi); }
  if (q.dari) { s1.push("b.tanggal >= ?"); v1.push(q.dari); s2.push("k.waktu >= ?"); v2.push(new Date(Date.parse(q.dari) - 7 * 3600_000).toISOString()); }
  if (q.sampai) { s1.push("b.tanggal <= ?"); v1.push(q.sampai); s2.push("k.waktu < ?"); v2.push(new Date(Date.parse(q.sampai) + 17 * 3600_000).toISOString()); }
  if (q.kategori) { s1.push("b.kategori = ?"); v1.push(q.kategori); if (q.kategori !== KATEGORI_LACI) s2.push("0"); }
  const [biaya, laci] = await Promise.all([
    env.DB.prepare(
      `SELECT b.id, b.no, b.lokasi_id, l.nama AS lokasi, b.tanggal, b.kategori, b.keterangan, b.jumlah, b.cara, b.bukti, o.nama AS oleh, 'biaya' AS sumber
       FROM biaya b LEFT JOIN lokasi l ON l.id = b.lokasi_id JOIN staff o ON o.id = b.oleh WHERE ${s1.join(" AND ")} ORDER BY b.tanggal DESC, b.no DESC LIMIT 2000`,
    ).bind(...v1).all<Obj>(),
    q.kategori && q.kategori !== KATEGORI_LACI ? { results: [] as Obj[] } : env.DB.prepare(
      `SELECT k.id, NULL AS no, s.lokasi_id, l.nama AS lokasi, k.waktu, '${KATEGORI_LACI}' AS kategori, k.catatan AS keterangan, k.jumlah, 'Tunai' AS cara, NULL AS bukti, o.nama AS oleh, 'laci' AS sumber
       FROM kas_laci k JOIN shift s ON s.id = k.shift_id JOIN lokasi l ON l.id = s.lokasi_id LEFT JOIN staff o ON o.id = k.oleh WHERE ${s2.join(" AND ")} ORDER BY k.waktu DESC LIMIT 2000`,
    ).bind(...v2).all<Obj>(),
  ]);
  const wib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);
  const semua: Obj[] = [...biaya.results, ...laci.results.map(({ waktu, ...k }): Obj => ({ ...k, tanggal: wib(waktu as string) }))]
    .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  const jumlah = (f: (x: Obj) => boolean) => semua.filter(f).reduce((a, x) => a + (x.jumlah as number), 0);
  return json({
    biaya: semua,
    ringkasan: { total: jumlah(() => true), event: jumlah((x) => !!x.lokasi_id && x.sumber === "biaya"), umum: jumlah((x) => !x.lokasi_id), laci: jumlah((x) => x.sumber === "laci") },
  });
}

export async function tambahBiaya(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await isian(env.DB, await bacaJson(req), staff);
  const id = ulid(), t = sekarang();
  const no = await denganNomor(env.DB, "BY", async (no) => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO biaya (id, no, lokasi_id, tanggal, kategori, keterangan, jumlah, cara, bukti, oleh, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, no, b.lokasi, b.tanggal, b.kategori, b.keterangan, b.jumlah, b.cara, b.bukti, staff.id, t, t),
      ...(b.bukti ? [env.DB.prepare("UPDATE berkas SET ref_tabel = 'biaya', ref_id = ? WHERE id = ?").bind(id, b.bukti)] : []),
      logAktivitas(env.DB, staff, "Catat biaya", { tabel: "biaya", id, keterangan: `${no} ${b.kategori} ${b.jumlah}` }),
    ]);
    return no;
  });
  return json({ id, no }, 201);
}

export async function ubahBiaya(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const lama = await env.DB.prepare("SELECT no FROM biaya WHERE id = ? AND dihapus_pada IS NULL").bind(id).first<{ no: string }>();
  if (!lama) throw new Gagal(404, "Biaya tidak ditemukan");
  const b = await isian(env.DB, await bacaJson(req), staff);
  await env.DB.batch([
    env.DB.prepare("UPDATE biaya SET lokasi_id = ?, tanggal = ?, kategori = ?, keterangan = ?, jumlah = ?, cara = ?, bukti = ?, diubah_pada = ? WHERE id = ?")
      .bind(b.lokasi, b.tanggal, b.kategori, b.keterangan, b.jumlah, b.cara, b.bukti, sekarang(), id),
    logAktivitas(env.DB, staff, "Ubah biaya", { tabel: "biaya", id, keterangan: `${lama.no} ${b.kategori} ${b.jumlah}` }),
  ]);
  return json({ ok: true });
}

export async function hapusBiaya(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const lama = await env.DB.prepare("SELECT no, jumlah FROM biaya WHERE id = ? AND dihapus_pada IS NULL").bind(id).first<{ no: string; jumlah: number }>();
  if (!lama) throw new Gagal(404, "Biaya tidak ditemukan");
  await env.DB.batch([
    env.DB.prepare("UPDATE biaya SET dihapus_pada = ?, dihapus_oleh = ? WHERE id = ?").bind(sekarang(), staff.id, id),
    logAktivitas(env.DB, staff, "Hapus biaya", { tabel: "biaya", id, keterangan: `${lama.no} ${lama.jumlah}` }),
  ]);
  return json({ ok: true });
}
