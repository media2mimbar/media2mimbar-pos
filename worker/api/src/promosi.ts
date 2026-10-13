// Dashboard › Promosi: satu daftar untuk promo produk (potongan, bonus produk, bundling) dan promo total belanja.

import { hariIniWib } from "./aturan.js";
import { Promo } from "./promo.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, benar, bulat, Gagal, json, Obj, sekarang, tanggal, teks, ulid, wajibTeks } from "./util.js";

interface BarisPromo extends Omit<Promo, "kelipatan" | "auto" | "kasir_ubah" | "hari" | "syarat" | "bonus" | "paket"> {
  kelipatan: number; auto: number; kasir_ubah: number; hari: string; deskripsi: string | null;
}

export async function bacaPromo(db: D1Database, syarat = "1 = 1", ...nilai: unknown[]): Promise<(Promo & { deskripsi: string | null })[]> {
  const [p, pp] = await Promise.all([
    db.prepare(`SELECT * FROM promo WHERE ${syarat} ORDER BY nama`).bind(...nilai).all<BarisPromo>(),
    db.prepare("SELECT promo_id, produk_id, peran FROM promo_produk").all<{ promo_id: string; produk_id: string; peran: string }>(),
  ]);
  return p.results.map((r) => {
    const anak = pp.results.filter((x) => x.promo_id === r.id);
    return {
      ...r, kelipatan: r.kelipatan === 1, auto: r.auto === 1, kasir_ubah: r.kasir_ubah === 1, hari: JSON.parse(r.hari),
      syarat: anak.filter((x) => x.peran === "syarat").map((x) => x.produk_id),
      bonus: anak.filter((x) => x.peran === "bonus").map((x) => x.produk_id),
      paket: anak.filter((x) => x.peran === "paket").map((x) => x.produk_id),
    };
  });
}

// Status tampil: Aktif, Terjadwal (belum mulai), Berakhir (lewat tanggal), Tidak Aktif, Draf.
export function statusPromo(p: { status: string; mulai: string; selesai: string }, hari = hariIniWib()) {
  if (p.status !== "Aktif") return p.status;
  if (hari < p.mulai) return "Terjadwal";
  if (hari > p.selesai) return "Berakhir";
  return "Aktif";
}

export async function daftarPromo(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [promo, pakai, lokasi] = await Promise.all([
    bacaPromo(env.DB),
    env.DB.prepare("SELECT promo_id, COUNT(*) AS n, SUM(diskon) AS potongan FROM trx WHERE promo_id IS NOT NULL AND status = 'Lunas' GROUP BY promo_id").all<{ promo_id: string; n: number; potongan: number }>(),
    env.DB.prepare("SELECT id, nama FROM lokasi").all<{ id: string; nama: string }>(),
  ]);
  return json({
    promo: promo.map((p) => ({
      ...p, status_tampil: statusPromo(p), lokasi: p.lokasi_id ? lokasi.results.find((l) => l.id === p.lokasi_id)?.nama ?? "?" : "Semua lokasi",
      dipakai: pakai.results.find((x) => x.promo_id === p.id)?.n ?? 0, total_potongan: pakai.results.find((x) => x.promo_id === p.id)?.potongan ?? 0,
    })),
  });
}

export async function detailPromo(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [p] = await bacaPromo(env.DB, "id = ?", id);
  if (!p) throw new Gagal(404, "Promo tidak ditemukan");
  return json({ promo: p });
}

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Validasi saat simpan (PRD 5.8).
async function isiPromo(db: D1Database, b: Obj) {
  const status = teks(b, "status", "Status", { max: 12, wajib: false }) ?? "Aktif";
  if (!["Aktif", "Draf", "Tidak Aktif"].includes(status)) throw new Gagal(400, "Status tidak dikenal");
  const cakupan = wajibTeks(b, "cakupan", "Cakupan");
  if (cakupan !== "produk" && cakupan !== "total") throw new Gagal(400, "Cakupan tidak dikenal");
  const jenis = wajibTeks(b, "jenis", "Jenis bonus");
  if (!["persen", "nominal", "bonus", "bundling"].includes(jenis)) throw new Gagal(400, "Jenis bonus tidak dikenal");
  if (cakupan === "total" && (jenis === "bonus" || jenis === "bundling")) throw new Gagal(400, "Promo total belanja hanya potongan persen atau rupiah");
  const daftarId = (k: string) => (Array.isArray(b[k]) ? [...new Set((b[k] as unknown[]).filter((x) => typeof x === "string"))] as string[] : []);
  const syarat = daftarId("syarat"), bonus = daftarId("bonus"), paket = daftarId("paket");
  const mulai = tanggal(b, "mulai", "Tanggal mulai")!, selesai = tanggal(b, "selesai", "Tanggal selesai")!;
  const jamMulai = teks(b, "jam_mulai", "Jam mulai", { max: 5, wajib: false }) ?? "00:00", jamSelesai = teks(b, "jam_selesai", "Jam selesai", { max: 5, wajib: false }) ?? "23:59";
  if (!JAM.test(jamMulai) || !JAM.test(jamSelesai)) throw new Gagal(400, "Format jam HH:MM");
  if (selesai < mulai || (selesai === mulai && jamSelesai <= jamMulai)) throw new Gagal(400, "Tanggal dan jam selesai harus setelah mulai");
  const hari = Array.isArray(b.hari) ? [...new Set(b.hari as number[])].filter((h) => Number.isInteger(h) && h >= 0 && h <= 6).sort() : [0, 1, 2, 3, 4, 5, 6];
  if (!hari.length) throw new Gagal(400, "Pilih minimal satu hari");
  const p = {
    nama: wajibTeks(b, "nama", "Nama promo", { max: 80 }), deskripsi: teks(b, "deskripsi", "Deskripsi", { max: 300, wajib: false }), status, cakupan, jenis,
    besar: bulat(b, "besar", "Besaran potongan", { max: 100_000_000, wajib: false }) ?? 0,
    maks_potongan: bulat(b, "maks_potongan", "Maksimal potongan", { max: 100_000_000, wajib: false }) ?? 0,
    min_belanja: bulat(b, "min_belanja", "Minimal pembelian", { max: 1_000_000_000, wajib: false }) ?? 0,
    min_qty: bulat(b, "min_qty", "Minimal kuantitas", { max: 10_000, wajib: false }) ?? 0,
    kelipatan: benar(b, "kelipatan", false), auto: benar(b, "auto", false),
    kasir_ubah: benar(b, "kasir_ubah", false), kasir_maks_persen: bulat(b, "kasir_maks_persen", "Batas ubah kasir", { max: 100, wajib: false }) ?? 0,
    bonus_qty: bulat(b, "bonus_qty", "Jumlah bonus", { max: 1000, wajib: false }) ?? 0,
    harga_paket: bulat(b, "harga_paket", "Harga paket", { max: 100_000_000, wajib: false }) ?? 0,
    lokasi_id: teks(b, "lokasi_id", "Berlaku di", { max: 40, wajib: false }),
    mulai, selesai, jam_mulai: jamMulai, jam_selesai: jamSelesai, hari, syarat, bonus, paket,
  };
  if (p.jenis === "persen" || p.jenis === "nominal") {
    if (!p.besar) throw new Gagal(400, "Besaran potongan wajib diisi");
    if (p.jenis === "persen" && p.besar > 100) throw new Gagal(400, "Potongan persen maksimal 100%");
    if (p.cakupan === "produk" && !syarat.length) throw new Gagal(400, "Pilih produk promo");
    if (p.jenis === "nominal" && p.min_belanja && p.besar > p.min_belanja) throw new Gagal(400, "Potongan Rp tidak boleh lebih besar dari minimal pembelian");
    if (p.kasir_ubah && p.kasir_maks_persen < p.besar) throw new Gagal(400, "Batas ubah kasir tidak boleh lebih kecil dari potongan");
  }
  if (p.jenis === "bonus") {
    if (!syarat.length || !p.min_qty) throw new Gagal(400, "Bonus produk wajib punya produk yang dibeli dan minimal beli");
    if (bonus.length !== 1) throw new Gagal(400, "Bonus produk wajib punya tepat satu produk bonus");
    if (!p.bonus_qty) throw new Gagal(400, "Jumlah bonus wajib diisi");
  }
  if (p.jenis === "bundling") {
    if (paket.length < 2) throw new Gagal(400, "Bundling wajib berisi minimal dua produk");
    // Harga normal paket memakai varian termurah tiap produk.
    const { results } = await db.prepare(`SELECT produk_id, MIN(harga_jual) AS h FROM varian WHERE aktif = 1 AND produk_id IN (${paket.map(() => "?").join(",")}) GROUP BY produk_id`)
      .bind(...paket).all<{ h: number }>();
    const normal = results.reduce((a, r) => a + r.h, 0);
    if (!p.harga_paket || p.harga_paket >= normal) throw new Gagal(400, `Harga paket harus lebih murah dari Rp${normal.toLocaleString("id-ID")}`);
  }
  if (p.lokasi_id && !(await db.prepare("SELECT 1 FROM lokasi WHERE id = ? AND aktif = 1").bind(p.lokasi_id).first())) throw new Gagal(400, "Lokasi tidak ditemukan atau event sudah ditutup");
  const semua = [...new Set([...syarat, ...bonus, ...paket])];
  if (semua.length > 80) throw new Gagal(400, "Terlalu banyak produk");
  if (semua.length) {
    const ada = await db.prepare(`SELECT COUNT(*) AS n FROM produk WHERE id IN (${semua.map(() => "?").join(",")})`).bind(...semua).first<{ n: number }>();
    if (ada?.n !== semua.length) throw new Gagal(400, "Ada produk yang tidak ditemukan");
  }
  return p;
}

function tulisPromo(db: D1Database, id: string, p: Awaited<ReturnType<typeof isiPromo>>, baru: boolean, oleh: string) {
  const t = sekarang();
  const kolom = [p.nama, p.deskripsi, p.cakupan, p.jenis, p.besar, p.maks_potongan, p.min_belanja, p.min_qty, p.kelipatan ? 1 : 0, p.auto ? 1 : 0, p.kasir_ubah ? 1 : 0,
    p.kasir_maks_persen, p.bonus_qty, p.harga_paket, p.lokasi_id, p.mulai, p.selesai, p.jam_mulai, p.jam_selesai, JSON.stringify(p.hari), p.status];
  return [
    baru
      ? db.prepare(`INSERT INTO promo (nama, deskripsi, cakupan, jenis, besar, maks_potongan, min_belanja, min_qty, kelipatan, auto, kasir_ubah, kasir_maks_persen, bonus_qty,
          harga_paket, lokasi_id, mulai, selesai, jam_mulai, jam_selesai, hari, status, id, dibuat_pada, diubah_pada, dibuat_oleh) VALUES (${Array(25).fill("?").join(", ")})`).bind(...kolom, id, t, t, oleh)
      : db.prepare(`UPDATE promo SET nama = ?, deskripsi = ?, cakupan = ?, jenis = ?, besar = ?, maks_potongan = ?, min_belanja = ?, min_qty = ?, kelipatan = ?, auto = ?, kasir_ubah = ?,
          kasir_maks_persen = ?, bonus_qty = ?, harga_paket = ?, lokasi_id = ?, mulai = ?, selesai = ?, jam_mulai = ?, jam_selesai = ?, hari = ?, status = ?, diubah_pada = ? WHERE id = ?`).bind(...kolom, t, id),
    db.prepare("DELETE FROM promo_produk WHERE promo_id = ?").bind(id),
    ...([["syarat", p.syarat], ["bonus", p.bonus], ["paket", p.paket]] as const).flatMap(([peran, ids]) =>
      ids.map((pid) => db.prepare("INSERT INTO promo_produk (promo_id, produk_id, peran) VALUES (?, ?, ?)").bind(id, pid, peran))),
  ];
}

export async function tambahPromo(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = await isiPromo(env.DB, await bacaJson(req));
  const id = ulid();
  await env.DB.batch([...tulisPromo(env.DB, id, p, true, staff.id), logAktivitas(env.DB, staff, "Buat promo", { tabel: "promo", id, keterangan: p.nama })]);
  return json({ id }, 201);
}

export async function ubahPromo(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  if (!(await env.DB.prepare("SELECT 1 FROM promo WHERE id = ?").bind(id).first())) throw new Gagal(404, "Promo tidak ditemukan");
  const p = await isiPromo(env.DB, await bacaJson(req));
  await env.DB.batch([...tulisPromo(env.DB, id, p, false, staff.id), logAktivitas(env.DB, staff, "Ubah promo", { tabel: "promo", id, keterangan: p.nama })]);
  return json({ ok: true });
}

// Untuk HP: promo yang mungkin berlaku di tempat ini (belum berakhir). Saringan jam dan hari dilakukan di HP.
export async function promoUntukTempat(db: D1Database, lokasi: string) {
  return bacaPromo(db, "status = 'Aktif' AND selesai >= ? AND (lokasi_id IS NULL OR lokasi_id = ?)", hariIniWib(), lokasi);
}
