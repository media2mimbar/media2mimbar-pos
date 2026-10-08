// Dashboard › Penjualan: daftar transaksi dari POS, setoran kasir per shift, kiriman POS yang ditolak.

import { hariIniWib } from "./aturan.js";
import { ringkasanShift } from "./kasir.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { Gagal, json, Obj, sekarang, tanggal } from "./util.js";

// Rentang tanggal WIB → batas UTC.
export function rentang(q: Obj) {
  const hari = hariIniWib();
  const dari = tanggal(q, "dari", "Dari tanggal", false) ?? hari;
  const sampai = tanggal(q, "sampai", "Sampai tanggal", false) ?? hari;
  if (sampai < dari) throw new Gagal(400, "Tanggal sampai tidak boleh sebelum tanggal dari");
  return {
    dari,
    sampai,
    mulai: new Date(Date.parse(dari) - 7 * 3600_000).toISOString(),
    akhir: new Date(Date.parse(sampai) + 17 * 3600_000).toISOString(),
  };
}

export async function daftarTransaksi(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const r = rentang(q);
  const syarat = ["t.waktu >= ?", "t.waktu < ?"];
  const nilai: unknown[] = [r.mulai, r.akhir];
  if (q.lokasi) { syarat.push("t.lokasi_id = ?"); nilai.push(q.lokasi); }
  if (q.shift) { syarat.push("t.shift_id = ?"); nilai.push(q.shift); }
  if (q.cari) { syarat.push("(t.no LIKE ? OR t.pelanggan_nama LIKE ?)"); nilai.push(`%${q.cari}%`, `%${q.cari}%`); }
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.no, t.waktu, t.total, t.diskon, t.metode, t.status, t.offline, t.pelanggan_nama, l.nama AS lokasi, s.nama AS kasir, p.kode AS perangkat,
      (SELECT SUM(qty) FROM trx_item WHERE trx_id = t.id) AS jumlah_barang,
      (SELECT group_concat(ref) FROM trx_bayar WHERE trx_id = t.id AND ref IS NOT NULL) AS ref_qris
     FROM trx t JOIN lokasi l ON l.id = t.lokasi_id JOIN staff s ON s.id = t.kasir_id LEFT JOIN perangkat p ON p.id = t.perangkat_id
     WHERE ${syarat.join(" AND ")} ORDER BY t.waktu DESC LIMIT 1000`,
  ).bind(...nilai).all<{ total: number; status: string }>();
  const lunas = results.filter((t) => t.status === "Lunas");
  return json({
    ...r,
    transaksi: results,
    ringkasan: { jumlah: lunas.length, total: lunas.reduce((a, t) => a + t.total, 0), void: results.length - lunas.length },
  });
}

export async function detailTransaksi(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const t = await env.DB.prepare(
    `SELECT t.*, l.nama AS lokasi, s.nama AS kasir, p.kode AS perangkat FROM trx t JOIN lokasi l ON l.id = t.lokasi_id
     JOIN staff s ON s.id = t.kasir_id LEFT JOIN perangkat p ON p.id = t.perangkat_id WHERE t.id = ?`,
  ).bind(id).first();
  if (!t) throw new Gagal(404, "Transaksi tidak ditemukan");
  const [items, bayar] = await Promise.all([
    env.DB.prepare("SELECT sku, nama, qty, harga, hpp FROM trx_item WHERE trx_id = ? ORDER BY urutan").bind(id).all(),
    env.DB.prepare("SELECT metode, jumlah, ref FROM trx_bayar WHERE trx_id = ? ORDER BY urutan").bind(id).all(),
  ]);
  return json({ transaksi: t, items: items.results, pembayaran: bayar.results });
}

// Setoran kasir: semua shift dalam rentang, seharusnya dihitung ulang dari transaksi yang sudah masuk.
export async function daftarShift(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const r = rentang(q);
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.lokasi_id, l.nama AS lokasi, a.nama AS kasir, s.buka, s.tutup, s.status, s.modal, s.kas_hitung, s.offline, b.nama AS ditutup_oleh,
      c.nama AS pj, s.penjelasan,
      COALESCE((SELECT SUM(y.jumlah) FROM trx_bayar y JOIN trx t ON t.id = y.trx_id WHERE t.shift_id = s.id AND t.status = 'Lunas' AND y.metode = 'Tunai'), 0)
        - COALESCE((SELECT SUM(kembalian) FROM trx WHERE shift_id = s.id AND status = 'Lunas'), 0) AS tunai,
      COALESCE((SELECT SUM(total) FROM trx WHERE shift_id = s.id AND status = 'Lunas'), 0) AS penjualan,
      (SELECT COUNT(*) FROM trx WHERE shift_id = s.id AND status = 'Lunas') AS transaksi,
      COALESCE((SELECT SUM(jumlah) FROM kas_laci WHERE shift_id = s.id AND jenis = 'masuk'), 0) AS kas_masuk,
      COALESCE((SELECT SUM(jumlah) FROM kas_laci WHERE shift_id = s.id AND jenis = 'keluar'), 0) AS kas_keluar
     FROM shift s JOIN lokasi l ON l.id = s.lokasi_id JOIN staff a ON a.id = s.kasir_id LEFT JOIN staff b ON b.id = s.ditutup_oleh LEFT JOIN staff c ON c.id = s.pj_id
     WHERE (s.status = 'buka' OR (s.buka >= ? AND s.buka < ?)) ORDER BY s.buka DESC LIMIT 500`,
  ).bind(r.mulai, r.akhir).all<{ modal: number; tunai: number; kas_masuk: number; kas_keluar: number; kas_hitung: number | null }>();
  return json({
    ...r,
    shift: results.map((s) => {
      const seharusnya = s.modal + s.tunai + s.kas_masuk - s.kas_keluar;
      return { ...s, seharusnya, selisih: s.kas_hitung === null ? null : s.kas_hitung - seharusnya };
    }),
  });
}

export async function detailShift(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = await ringkasanShift(env.DB, id);
  const kas = await env.DB.prepare("SELECT k.jenis, k.jumlah, k.catatan, k.waktu, s.nama AS oleh FROM kas_laci k LEFT JOIN staff s ON s.id = k.oleh WHERE k.shift_id = ? ORDER BY k.waktu").bind(id).all();
  return json({ ...r, kas: kas.results });
}

export async function daftarDitolak(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.jenis, d.dokumen_id, d.alasan, d.isi, d.diterima_pada, p.kode AS perangkat, p.nama AS nama_perangkat
     FROM dokumen_ditolak d LEFT JOIN perangkat p ON p.id = d.perangkat_id WHERE d.selesai = 0 ORDER BY d.diterima_pada DESC LIMIT 200`,
  ).all();
  return json({ ditolak: results });
}

export async function selesaiDitolak(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  await env.DB.batch([
    env.DB.prepare("UPDATE dokumen_ditolak SET selesai = 1 WHERE id = ?").bind(id),
    logAktivitas(env.DB, staff, "Tandai kiriman POS ditolak sudah ditangani", { tabel: "dokumen_ditolak", id, keterangan: sekarang() }),
  ]);
  return json({ ok: true });
}
