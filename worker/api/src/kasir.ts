// POS: tarik data untuk HP, terima antrean dokumen dari HP (shift, kas, transaksi), persetujuan atasan.
// HP bisa bekerja tanpa sinyal: semua dokumen punya ID tetap dari HP, jadi kiriman ulang tidak tercatat dua kali.

import { hariIniWib } from "./aturan.js";
import { bacaPengaturan } from "./pengaturan.js";
import { hashPin, samaPersis, sha256, tokenAcak } from "./sandi.js";
import { ambilRole, catatSalah, cekTerkunci, hapusSalah, logMasuk, Perangkat, perangkatDari, sesiPos, Staff } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, Role, sekarang, tambahMenit, ulid } from "./util.js";

// ---------- Tempat jualan ----------

export interface Tempat {
  id: string;
  jenis: "gudang" | "event";
  nama: string;
  label: string;
  boleh_jual: boolean;
  shift_terbuka: { id: string; kasir_id: string; kasir: string; buka: string; modal: number } | null;
}

// Tahap 3: hanya Owner yang bisa jual langsung dari Gudang Pusat. Event ditambahkan di tahap 4.
export async function daftarTempat(db: D1Database, role: Role[]): Promise<Tempat[]> {
  const { results } = await db
    .prepare(
      `SELECT l.id, l.jenis, l.nama, s.id AS shift_id, s.kasir_id, st.nama AS kasir, s.buka, s.modal
       FROM lokasi l LEFT JOIN shift s ON s.lokasi_id = l.id AND s.status = 'buka' LEFT JOIN staff st ON st.id = s.kasir_id
       WHERE l.aktif = 1 ORDER BY l.jenis, l.nama, s.buka`,
    )
    .all<{ id: string; jenis: "gudang" | "event"; nama: string; shift_id: string | null; kasir_id: string; kasir: string; buka: string; modal: number }>();
  const owner = role.includes("owner");
  const tempat = new Map<string, Tempat>();
  for (const r of results) {
    if (tempat.has(r.id)) continue; // satu laci per tempat: ambil shift terbuka yang paling awal
    if (r.jenis === "gudang" && !owner) continue;
    tempat.set(r.id, {
      id: r.id,
      jenis: r.jenis,
      nama: r.nama,
      label: r.jenis === "gudang" ? "Jual langsung" : "Berlangsung",
      boleh_jual: true,
      shift_terbuka: r.shift_id ? { id: r.shift_id, kasir_id: r.kasir_id, kasir: r.kasir, buka: r.buka, modal: r.modal } : null,
    });
  }
  return [...tempat.values()];
}

// Harga yang berlaku di satu tempat: harga khusus tempat itu kalau ada, kalau tidak harga normal.
function sqlHarga(lokasi: { id: string; jenis: string }) {
  if (lokasi.jenis === "gudang") {
    return { kolom: "COALESCE(h.harga, v.harga_jual)", join: "LEFT JOIN harga_saluran h ON h.sku = v.sku AND h.saluran = 'gudang'", nilai: [] as unknown[] };
  }
  return { kolom: "v.harga_jual", join: "", nilai: [] as unknown[] };
}

async function ambilLokasi(db: D1Database, id: string) {
  const l = await db.prepare("SELECT id, jenis, nama FROM lokasi WHERE id = ? AND aktif = 1").bind(id).first<{ id: string; jenis: string; nama: string }>();
  if (!l) throw new Gagal(404, "Tempat jualan tidak ditemukan");
  return l;
}

// GET /api/pos/tarik?lokasi=&sejak=  → perubahan sejak tarik terakhir (atau semua kalau sejak kosong).
export async function tarik(req: Request, env: Env) {
  const { staff, perangkat: p } = await sesiPos(env.DB, req);
  const url = new URL(req.url);
  const lokasiId = url.searchParams.get("lokasi");
  const sejak = url.searchParams.get("sejak") || "";
  const waktu = sekarang();
  const [pengaturan, tempat] = await Promise.all([bacaPengaturan(env.DB), daftarTempat(env.DB, staff.role)]);
  const hasil: Obj = { waktu, pengaturan, tempat };
  if (!lokasiId) return json(hasil);
  if (!tempat.some((t) => t.id === lokasiId)) throw new Gagal(403, "Anda tidak bisa berjualan di tempat ini");
  const lokasi = await ambilLokasi(env.DB, lokasiId);
  const h = sqlHarga(lokasi);
  const [kategori, produk, varian, stok] = await Promise.all([
    env.DB.prepare("SELECT id, nama, urutan, tampil_menu FROM kategori ORDER BY urutan, nama").all(),
    env.DB.prepare(`SELECT id, sku, nama, kategori_id, satuan, punya_varian, tampil_pos, aktif FROM produk ${sejak ? "WHERE diubah_pada > ?" : ""}`)
      .bind(...(sejak ? [sejak] : [])).all(),
    env.DB.prepare(
      `SELECT v.sku, v.produk_id, v.nama, v.urutan, v.aktif, v.harga_jual AS harga_normal, ${h.kolom} AS harga FROM varian v ${h.join}
       ${sejak ? "WHERE v.diubah_pada > ?" : ""}`,
    ).bind(...h.nilai, ...(sejak ? [sejak] : [])).all(),
    env.DB.prepare(`SELECT sku, qty FROM stok WHERE lokasi_id = ? ${sejak ? "AND diubah_pada > ?" : ""}`).bind(lokasiId, ...(sejak ? [sejak] : [])).all(),
  ]);
  // Nomor transaksi terakhir HP ini hari ini, supaya penomoran tetap lanjut walau data HP sempat terhapus.
  const awalan = `HK-${hariIniWib().slice(2).replace(/-/g, "")}-${p.kode}-`;
  const terakhir = await env.DB.prepare("SELECT MAX(no) AS no FROM trx WHERE perangkat_id = ? AND no LIKE ?").bind(p.id, awalan + "%").first<{ no: string | null }>();
  return json({ ...hasil, lokasi, penuh: !sejak, kategori: kategori.results, produk: produk.results, varian: varian.results, stok: stok.results,
    nomor_terakhir: terakhir?.no ? Number(terakhir.no.slice(awalan.length)) : 0 });
}

// ---------- Ringkasan shift (dipakai Tutup Kasir dan dashboard) ----------

export async function ringkasanShift(db: D1Database, shiftId: string) {
  const s = await db.prepare(
    `SELECT s.*, l.nama AS lokasi, a.nama AS kasir, b.nama AS ditutup_oleh_nama, c.nama AS pj_nama FROM shift s JOIN lokasi l ON l.id = s.lokasi_id
     JOIN staff a ON a.id = s.kasir_id LEFT JOIN staff b ON b.id = s.ditutup_oleh LEFT JOIN staff c ON c.id = s.pj_id WHERE s.id = ?`,
  ).bind(shiftId).first<Obj & { modal: number; kas_hitung: number | null; status: string }>();
  if (!s) throw new Gagal(404, "Shift tidak ditemukan");
  const [bayar, trx, kas] = await Promise.all([
    db.prepare(
      `SELECT b.metode, SUM(b.jumlah) AS jumlah FROM trx_bayar b JOIN trx t ON t.id = b.trx_id
       WHERE t.shift_id = ? AND t.status = 'Lunas' GROUP BY b.metode`,
    ).bind(shiftId).all<{ metode: string; jumlah: number }>(),
    db.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status = 'Lunas' THEN total END), 0) AS total, COALESCE(SUM(CASE WHEN status = 'Lunas' THEN kembalian END), 0) AS kembalian,
        COUNT(CASE WHEN status = 'Void' THEN 1 END) AS void_n, COALESCE(SUM(CASE WHEN status = 'Void' THEN total END), 0) AS void_total
       FROM trx WHERE shift_id = ?`,
    ).bind(shiftId).first<{ n: number; total: number; kembalian: number; void_n: number; void_total: number }>(),
    db.prepare("SELECT jenis, SUM(jumlah) AS jumlah FROM kas_laci WHERE shift_id = ? GROUP BY jenis").bind(shiftId).all<{ jenis: string; jumlah: number }>(),
  ]);
  const per = (m: string) => bayar.results.find((b) => b.metode === m)?.jumlah ?? 0;
  const kasJ = (j: string) => kas.results.find((k) => k.jenis === j)?.jumlah ?? 0;
  // Pembayaran tunai yang tercatat adalah uang yang diterima; kembalian keluar lagi dari laci.
  const tunai = per("Tunai") - (trx?.kembalian ?? 0);
  const seharusnya = s.modal + tunai + kasJ("masuk") - kasJ("keluar");
  return {
    shift: s,
    ringkasan: {
      transaksi: trx?.n ?? 0,
      total: trx?.total ?? 0,
      tunai,
      qris: per("QRIS"),
      transfer: per("Transfer"),
      void_n: trx?.void_n ?? 0,
      void_total: trx?.void_total ?? 0,
      kas_masuk: kasJ("masuk"),
      kas_keluar: kasJ("keluar"),
      seharusnya,
      selisih: s.kas_hitung === null ? null : s.kas_hitung - seharusnya,
    },
  };
}

export async function shiftPos(req: Request, env: Env, id: string) {
  await sesiPos(env.DB, req);
  return json(await ringkasanShift(env.DB, id));
}

// Riwayat penjualan yang sudah diterima server untuk satu shift (HP menggabungkan dengan antreannya sendiri).
export async function penjualanPos(req: Request, env: Env) {
  await sesiPos(env.DB, req);
  const shift = new URL(req.url).searchParams.get("shift");
  if (!shift) throw new Gagal(400, "Shift wajib diisi");
  const [t, i, b] = await Promise.all([
    env.DB.prepare(
      `SELECT t.id, t.no, t.waktu, t.subtotal, t.diskon, t.promo, t.pajak, t.pembulatan, t.total, t.metode, t.dibayar, t.kembalian,
        t.pelanggan_nama, t.pelanggan_telp, t.status, s.nama AS kasir FROM trx t JOIN staff s ON s.id = t.kasir_id WHERE t.shift_id = ? ORDER BY t.waktu DESC LIMIT 300`,
    ).bind(shift).all<{ id: string }>(),
    env.DB.prepare("SELECT i.trx_id, i.sku, i.nama, i.qty, i.harga FROM trx_item i JOIN trx t ON t.id = i.trx_id WHERE t.shift_id = ? ORDER BY i.urutan").bind(shift).all<{ trx_id: string }>(),
    env.DB.prepare("SELECT b.trx_id, b.metode, b.jumlah, b.ref FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.shift_id = ? ORDER BY b.urutan").bind(shift).all<{ trx_id: string }>(),
  ]);
  return json({
    trx: t.results.map((x) => ({ ...x, items: i.results.filter((y) => y.trx_id === x.id), pembayaran: b.results.filter((y) => y.trx_id === x.id) })),
  });
}

// ---------- Persetujuan atasan ----------

const AKSI_SETUJU = ["tutup_kasir", "void", "retur", "presale_manual", "opname"];

// POST /api/pos/setujui { staff_id, pin, aksi } → token sekali pakai, berlaku 10 menit.
export async function setujui(req: Request, env: Env) {
  const perangkat = await perangkatDari(env.DB, req);
  const b = await bacaJson(req);
  const staffId = typeof b.staff_id === "string" ? b.staff_id : "";
  const pin = typeof b.pin === "string" ? b.pin : "";
  const aksi = typeof b.aksi === "string" ? b.aksi : "";
  if (!AKSI_SETUJU.includes(aksi)) throw new Gagal(400, "Aksi tidak dikenal");
  const kunci = `pin:${staffId}:${perangkat.id}`;
  await cekTerkunci(env.DB, kunci);
  const s = await env.DB.prepare("SELECT id, nama, pin_hash FROM staff WHERE id = ? AND aktif = 1").bind(staffId).first<{ id: string; nama: string; pin_hash: string }>();
  if (!s || !samaPersis(await hashPin(env.PEPPER, s.id, pin), s.pin_hash)) {
    const sisa = await catatSalah(env.DB, kunci);
    await logMasuk(env.DB, req, { staffId: s?.id, nama: s?.nama, aksi: "PIN salah", tempat: "pos", perangkatId: perangkat.id, keterangan: `persetujuan ${aksi}` }).run();
    throw new Gagal(401, sisa > 0 ? `PIN salah. Sisa ${sisa} percobaan` : "Terlalu banyak PIN salah. Coba lagi setelah 15 menit");
  }
  const token = tokenAcak();
  const t = sekarang();
  await env.DB.batch([
    hapusSalah(env.DB, kunci),
    env.DB.prepare("INSERT INTO persetujuan (id, staff_id, aksi, perangkat_id, dibuat_pada, kadaluarsa) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(await sha256(token), s.id, aksi, perangkat.id, t, tambahMenit(t, 10)),
  ]);
  return json({ token, staff: { id: s.id, nama: s.nama, role: await ambilRole(env.DB, s.id) } });
}

// Memakai token persetujuan: harus cocok staff, aksi, dan perangkat, belum dipakai, belum kedaluwarsa.
export function pakaiPersetujuan(db: D1Database, idToken: string, staffId: string, aksi: string, perangkatId: string) {
  return db.prepare("UPDATE persetujuan SET dipakai = 1 WHERE id = ? AND staff_id = ? AND aksi = ? AND perangkat_id = ? AND dipakai = 0 AND kadaluarsa > ?")
    .bind(idToken, staffId, aksi, perangkatId, sekarang());
}

// ---------- Sinkron antrean dari HP ----------

class Tolak extends Error {}
type Hasil = { id: string; status: "ok" | "sudah" | "ditolak"; alasan?: string };

const ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const cekId = (v: unknown, label: string) => {
  if (typeof v !== "string" || !ID_RE.test(v)) throw new Tolak(`${label} bukan ULID`);
  return v;
};
const cekInt = (v: unknown, label: string, min = 0, max = 1_000_000_000) => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new Tolak(`${label} tidak valid`);
  return v;
};
const cekWaktu = (v: unknown, label: string) => {
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new Tolak(`${label} tidak valid`);
  // Jam HP bisa salah; waktu lebih dari 1 hari di depan server ditolak.
  if (Date.parse(v) > Date.now() + 86_400_000) throw new Tolak(`${label} di masa depan. Periksa jam HP`);
  return new Date(v).toISOString();
};
const cekTeks = (v: unknown, label: string, max: number, wajib = false) => {
  if (v === undefined || v === null || v === "") {
    if (wajib) throw new Tolak(`${label} wajib`);
    return null;
  }
  if (typeof v !== "string" || v.length > max) throw new Tolak(`${label} tidak valid`);
  return v.trim();
};

async function cekStaff(db: D1Database, id: unknown) {
  const s = await db.prepare("SELECT id, nama FROM staff WHERE id = ?").bind(cekId(id, "Karyawan")).first<{ id: string; nama: string }>();
  if (!s) throw new Tolak("Karyawan tidak dikenal");
  return s;
}

async function prosesShiftBuka(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "ID shift");
  if (await env.DB.prepare("SELECT 1 FROM shift WHERE id = ?").bind(id).first()) return "sudah";
  const kasir = await cekStaff(env.DB, d.kasir_id);
  const lokasi = await env.DB.prepare("SELECT id FROM lokasi WHERE id = ?").bind(typeof d.lokasi_id === "string" ? d.lokasi_id : "").first();
  if (!lokasi) throw new Tolak("Tempat jualan tidak dikenal");
  const buka = cekWaktu(d.buka, "Waktu buka");
  const modal = cekInt(d.modal, "Modal awal", 0, 100_000_000);
  const t = sekarang();
  await env.DB.prepare(
    `INSERT INTO shift (id, lokasi_id, perangkat_id, kasir_id, buka, modal, status, offline, diterima_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, 'buka', ?, ?, ?)`,
  ).bind(id, d.lokasi_id, p.id, kasir.id, buka, modal, d.offline ? 1 : 0, t, t).run();
  return "ok";
}

async function prosesKas(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "ID kas");
  if (await env.DB.prepare("SELECT 1 FROM kas_laci WHERE id = ?").bind(id).first()) return "sudah";
  const shiftId = cekId(d.shift_id, "Shift");
  if (!(await env.DB.prepare("SELECT 1 FROM shift WHERE id = ?").bind(shiftId).first())) throw new Tolak("Shift belum diterima server");
  if (d.jenis !== "masuk" && d.jenis !== "keluar") throw new Tolak("Jenis kas tidak dikenal");
  const oleh = await cekStaff(env.DB, d.oleh);
  await env.DB.prepare("INSERT INTO kas_laci (id, shift_id, jenis, jumlah, catatan, waktu, oleh, perangkat_id, diterima_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, shiftId, d.jenis, cekInt(d.jumlah, "Jumlah", 1, 100_000_000), cekTeks(d.catatan, "Catatan", 200, true), cekWaktu(d.waktu, "Waktu"), oleh.id, p.id, sekarang())
    .run();
  return "ok";
}

const NO_TRX = /^HK-\d{6}-[A-Z][1-9]-\d{4,}$/;
const METODE = ["Tunai", "QRIS", "Transfer"];

async function prosesTrx(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "ID transaksi");
  if (await env.DB.prepare("SELECT 1 FROM trx WHERE id = ?").bind(id).first()) return "sudah";
  const no = cekTeks(d.no, "Nomor", 40, true)!;
  if (!NO_TRX.test(no)) throw new Tolak("Format nomor transaksi tidak dikenal");
  const shift = await env.DB.prepare("SELECT id, lokasi_id FROM shift WHERE id = ?").bind(cekId(d.shift_id, "Shift")).first<{ id: string; lokasi_id: string }>();
  if (!shift) throw new Tolak("Shift belum diterima server");
  const kasir = await cekStaff(env.DB, d.kasir_id);
  const waktu = cekWaktu(d.waktu, "Waktu");

  if (!Array.isArray(d.items) || d.items.length === 0 || d.items.length > 80) throw new Tolak("Daftar barang tidak valid");
  const items = (d.items as Obj[]).map((x, i) => ({
    sku: cekTeks(x?.sku, `SKU baris ${i + 1}`, 40, true)!,
    nama: cekTeks(x?.nama, `Nama baris ${i + 1}`, 140, true)!,
    qty: cekInt(x?.qty, `Jumlah baris ${i + 1}`, 1, 10_000),
    harga: cekInt(x?.harga, `Harga baris ${i + 1}`, 0, 100_000_000),
  }));
  const skus = [...new Set(items.map((i) => i.sku))];
  const { results: kenal } = await env.DB
    .prepare(`SELECT v.sku, p.hpp FROM varian v JOIN produk p ON p.id = v.produk_id WHERE v.sku IN (${skus.map(() => "?").join(",")})`)
    .bind(...skus).all<{ sku: string; hpp: number }>();
  const hpp = new Map(kenal.map((k) => [k.sku, k.hpp]));
  for (const s of skus) if (!hpp.has(s)) throw new Tolak(`SKU ${s} tidak dikenal`);

  if (!Array.isArray(d.pembayaran) || d.pembayaran.length === 0 || d.pembayaran.length > 10) throw new Tolak("Pembayaran tidak valid");
  const bayar = (d.pembayaran as Obj[]).map((x, i) => {
    if (!METODE.includes(x?.metode as string)) throw new Tolak(`Metode bayar ${i + 1} tidak dikenal`);
    const ref = cekTeks(x.ref, "Referensi QRIS", 4);
    if (x.metode === "QRIS" && !/^\d{4}$/.test(ref ?? "")) throw new Tolak("QRIS wajib 4 digit referensi");
    return { metode: x.metode as string, jumlah: cekInt(x.jumlah, `Jumlah bayar ${i + 1}`, 1), ref };
  });

  // Angka diperiksa ulang di server: subtotal, total, dan pembayaran harus konsisten.
  const subtotal = items.reduce((a, i) => a + i.qty * i.harga, 0);
  if (cekInt(d.subtotal, "Subtotal") !== subtotal) throw new Tolak("Subtotal tidak cocok dengan barang");
  const diskon = cekInt(d.diskon ?? 0, "Diskon", 0, subtotal);
  const pajak = cekInt(d.pajak ?? 0, "Pajak");
  const pembulatan = cekInt(d.pembulatan ?? 0, "Pembulatan", 0, 999);
  const total = subtotal - diskon + pajak - pembulatan;
  if (cekInt(d.total, "Total") !== total) throw new Tolak("Total tidak cocok");
  const dibayar = bayar.reduce((a, b) => a + b.jumlah, 0);
  const tunai = bayar.filter((b) => b.metode === "Tunai").reduce((a, b) => a + b.jumlah, 0);
  if (dibayar < total) throw new Tolak("Pembayaran kurang dari total");
  const kembalian = dibayar - total;
  if (kembalian > tunai) throw new Tolak("Kembalian lebih besar dari uang tunai");
  const metodes = [...new Set(bayar.map((b) => b.metode))];

  const t = sekarang();
  const tulis = [
    env.DB.prepare(
      `INSERT INTO trx (id, no, shift_id, lokasi_id, perangkat_id, kasir_id, waktu, subtotal, diskon, promo, pajak, pembulatan, total, metode, dibayar, kembalian,
        pelanggan_nama, pelanggan_telp, catatan, offline, diterima_pada, diubah_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, no, shift.id, shift.lokasi_id, p.id, kasir.id, waktu, subtotal, diskon, cekTeks(d.promo, "Promo", 80), pajak, pembulatan, total,
      metodes.length > 1 ? "Campuran" : metodes[0], dibayar, kembalian, cekTeks(d.pelanggan_nama, "Nama pelanggan", 80), cekTeks(d.pelanggan_telp, "No HP pelanggan", 20),
      cekTeks(d.catatan, "Catatan", 300), d.offline ? 1 : 0, t, t),
    ...items.map((i, n) => env.DB.prepare("INSERT INTO trx_item (id, trx_id, sku, nama, qty, harga, hpp, urutan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(ulid(), id, i.sku, i.nama, i.qty, i.harga, hpp.get(i.sku), n)),
    ...bayar.map((b, n) => env.DB.prepare("INSERT INTO trx_bayar (id, trx_id, metode, jumlah, ref, urutan) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(ulid(), id, b.metode, b.jumlah, b.ref, n)),
    // Stok tempat jualan berkurang. Penjualan tetap dicatat walau stok jadi minus (arsitektur bagian 5).
    ...items.flatMap((i) => [
      env.DB.prepare(
        `INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, ?, ?, 0, ?)
         ON CONFLICT (sku, lokasi_id) DO UPDATE SET qty = qty + excluded.qty, diubah_pada = excluded.diubah_pada`,
      ).bind(i.sku, shift.lokasi_id, -i.qty, t),
      env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'jual', 'trx', ?, ?, ?)")
        .bind(ulid(), i.sku, shift.lokasi_id, -i.qty, id, waktu, kasir.id),
    ]),
  ];
  try {
    await env.DB.batch(tulis);
  } catch (e) {
    const m = String((e as Error).message);
    if (m.includes("UNIQUE") && m.includes("trx.no")) throw new Tolak(`Nomor ${no} sudah dipakai transaksi lain`);
    if (m.includes("UNIQUE") && m.includes("trx.id")) return "sudah";
    throw e;
  }
  return "ok";
}

async function prosesShiftTutup(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "Shift");
  const s = await env.DB.prepare("SELECT status FROM shift WHERE id = ?").bind(id).first<{ status: string }>();
  if (!s) throw new Tolak("Shift belum diterima server");
  if (s.status === "tutup") return "sudah";
  const oleh = await cekStaff(env.DB, d.ditutup_oleh);
  const setuju = await cekStaff(env.DB, d.disetujui_oleh);
  const kasHitung = cekInt(d.kas_hitung, "Uang dihitung", 0, 1_000_000_000);
  const seharusnya = cekInt(d.seharusnya, "Seharusnya", -1_000_000_000, 1_000_000_000);
  const selisih = kasHitung - seharusnya;
  const pj = d.pj_id ? (await cekStaff(env.DB, d.pj_id)).id : null;
  const penjelasan = cekTeks(d.penjelasan, "Penjelasan", 500);
  if (selisih < 0 && (!pj || !penjelasan)) throw new Tolak("Kas kurang wajib punya penanggung jawab dan penjelasan");

  // Online: token persetujuan dari /api/pos/setujui. Offline: PIN dicek di HP, ditandai offline.
  const tulis = [];
  if (typeof d.persetujuan === "string") {
    const r = await pakaiPersetujuan(env.DB, await sha256(d.persetujuan), setuju.id, "tutup_kasir", p.id).run();
    if (r.meta.changes !== 1) throw new Tolak("Persetujuan tutup kasir tidak sah atau kedaluwarsa");
  } else if (!d.offline) {
    throw new Tolak("Tutup kasir butuh persetujuan PIN");
  }
  const role = await ambilRole(env.DB, setuju.id);
  const kasir = await env.DB.prepare("SELECT kasir_id FROM shift WHERE id = ?").bind(id).first<{ kasir_id: string }>();
  if (setuju.id !== kasir?.kasir_id && !role.includes("owner") && !role.includes("admin")) {
    throw new Tolak("Tutup kasir harus disetujui pemilik laci, Admin, atau Owner");
  }
  const t = sekarang();
  tulis.push(env.DB.prepare(
    `UPDATE shift SET status = 'tutup', tutup = ?, kas_hitung = ?, seharusnya = ?, selisih = ?, catatan = ?, ditutup_oleh = ?, disetujui_oleh = ?,
      pj_id = ?, penjelasan = ?, offline = MAX(offline, ?), diubah_pada = ? WHERE id = ? AND status = 'buka'`,
  ).bind(cekWaktu(d.tutup, "Waktu tutup"), kasHitung, seharusnya, selisih, cekTeks(d.catatan, "Catatan", 300), oleh.id, setuju.id, pj, penjelasan,
    d.offline ? 1 : 0, t, id));
  await env.DB.batch(tulis);
  return "ok";
}

const AKSI_LOG = ["Masuk offline", "Buka kasir", "Gabung kasir", "Buka kunci layar", "Terkunci otomatis", "Tutup kasir", "Keluar", "PIN salah"];

async function prosesLog(env: Env, p: Perangkat, d: Obj, req: Request): Promise<Hasil["status"]> {
  const id = cekId(d.id, "ID log");
  const aksi = cekTeks(d.aksi, "Aksi", 40, true)!;
  if (!AKSI_LOG.includes(aksi)) throw new Tolak("Aksi log tidak dikenal");
  const s = d.staff_id ? await cekStaff(env.DB, d.staff_id) : null;
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO log_masuk (id, waktu, staff_id, nama, aksi, tempat, perangkat_id, ip, keterangan) VALUES (?, ?, ?, ?, ?, 'pos', ?, ?, ?)",
  ).bind(id, cekWaktu(d.waktu, "Waktu"), s?.id ?? null, s?.nama ?? null, aksi, p.id, req.headers.get("cf-connecting-ip") ?? "", cekTeks(d.keterangan, "Keterangan", 200)).run();
  return r.meta.changes ? "ok" : "sudah";
}

const PROSES: Record<string, (env: Env, p: Perangkat, d: Obj, req: Request) => Promise<Hasil["status"]>> = {
  shift_buka: prosesShiftBuka,
  kas: prosesKas,
  trx: prosesTrx,
  shift_tutup: prosesShiftTutup,
  log: prosesLog,
};

// POST /api/pos/sinkron { dokumen: [{ jenis, data }] } — diproses berurutan sesuai antrean HP.
// Cukup token perangkat: transaksi offline tetap diterima walau sesi kasir sudah habis.
export async function sinkron(req: Request, env: Env) {
  const p = await perangkatDari(env.DB, req);
  const b = await bacaJson(req);
  if (!Array.isArray(b.dokumen) || b.dokumen.length > 50) throw new Gagal(400, "Kirim maksimal 50 dokumen sekali sinkron");
  const hasil: Hasil[] = [];
  for (const dok of b.dokumen as Obj[]) {
    const jenis = String(dok?.jenis ?? "");
    const data = (dok?.data ?? {}) as Obj;
    const id = typeof data.id === "string" ? data.id : "";
    try {
      const f = PROSES[jenis];
      if (!f) throw new Tolak(`Jenis dokumen ${jenis} tidak dikenal`);
      hasil.push({ id, status: await f(env, p, data, req) });
    } catch (e) {
      if (!(e instanceof Tolak)) throw e; // gangguan server: HP mencoba lagi nanti, urutan tetap terjaga
      await env.DB.prepare("INSERT INTO dokumen_ditolak (id, perangkat_id, jenis, dokumen_id, alasan, isi, diterima_pada) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(ulid(), p.id, jenis, id, e.message, JSON.stringify(dok).slice(0, 50_000), sekarang()).run();
      hasil.push({ id, status: "ditolak", alasan: e.message });
    }
  }
  return json({ hasil, waktu: sekarang() });
}

export type { Staff };
