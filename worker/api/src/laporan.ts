// Laporan penjualan (Dashboard, Per Saluran, Per Event, Per Kasir, Per Produk, Rekap Harian) dari satu sumber angka:
// baris jual per barang dari POS, retur, dan pesanan online. Rekap harian diisi Cron tiap malam (lihat isiRekap).

import { hariIniWib } from "./aturan.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang, tanggal } from "./util.js";

// Batas UTC untuk rentang tanggal WIB [dari, sampai].
export function batasWib(dari: string, sampai: string) {
  return { mulai: new Date(Date.parse(dari) - 7 * 3600_000).toISOString(), akhir: new Date(Date.parse(sampai) + 17 * 3600_000).toISOString() };
}

// Baris jual. ?1 = mulai, ?2 = akhir (ISO UTC).
// mode "jual": penjualan dihitung pada tanggal transaksi (laporan penjualan, PRD bagian 7).
// mode "akui": pre-sale baru dihitung saat barang diserahkan (laporan keuangan).
// Kolom uang: kotor (harga × qty), diskon (promo), bulat (pembulatan), mp (potongan marketplace), retur (uang kembali), hpp.
// Bersih = kotor − diskon − bulat − mp − retur. PPN tidak termasuk.
export function sqlFakta(mode: "jual" | "akui" = "jual") {
  const w = mode === "akui" ? "CASE WHEN t.presale = 1 THEN t.ambil_pada ELSE t.waktu END" : "t.waktu";
  const syaratPre = mode === "akui" ? "AND (t.presale = 0 OR t.ambil_status = 'Diambil')" : "";
  const bagi = (kolom: string) => `CASE WHEN t.subtotal > 0 THEN i.qty * i.harga * 1.0 * t.${kolom} / t.subtotal ELSE 0 END`;
  return `fakta AS (
    SELECT 'pos' AS sumber, t.lokasi_id AS tempat, t.kasir_id AS oleh, t.id AS ref, i.sku, i.qty, i.qty * i.harga AS kotor,
      ${bagi("diskon")} AS diskon, ${bagi("pembulatan")} AS bulat, 0 AS mp, 0 AS retur, i.qty * i.hpp AS hpp, ${w} AS waktu
    FROM trx t JOIN trx_item i ON i.trx_id = t.id
    WHERE t.status = 'Lunas' ${syaratPre} AND ${w} >= ?1 AND ${w} < ?2
    UNION ALL
    SELECT 'pos', t.lokasi_id, r.oleh, t.id, ri.sku,
      CASE WHEN r.cara = 'Uang kembali' THEN -ri.qty ELSE 0 END, 0, 0, 0, 0,
      CASE WHEN r.cara = 'Uang kembali' THEN (CASE WHEN t.subtotal > 0 THEN ri.qty * ri.harga * 1.0 * (t.subtotal - t.diskon - t.pembulatan) / t.subtotal ELSE 0 END) ELSE 0 END,
      CASE WHEN r.cara = 'Tukar barang' THEN ri.qty * ri.hpp ELSE 0 END, r.waktu
    FROM retur r JOIN retur_item ri ON ri.retur_id = r.id JOIN trx t ON t.id = r.trx_id
    WHERE r.waktu >= ?1 AND r.waktu < ?2
    UNION ALL
    SELECT 'online', o.saluran_id, o.oleh, o.id, i.sku, i.qty, i.qty * i.harga, 0, 0,
      CASE WHEN o.kotor > 0 THEN i.qty * i.harga * 1.0 * o.potongan / o.kotor ELSE 0 END, 0, i.qty * i.hpp, o.tanggal
    FROM pesanan_online o JOIN pesanan_item i ON i.pesanan_id = o.id
    WHERE o.status <> 'Dibatalkan' AND o.tanggal >= ?1 AND o.tanggal < ?2
  )`;
}

// Kolom agregat standar.
const AGREGAT = `COUNT(DISTINCT CASE WHEN f.retur = 0 AND f.qty > 0 THEN f.sumber || f.ref END) AS transaksi, COALESCE(SUM(f.qty), 0) AS qty,
  ROUND(COALESCE(SUM(f.kotor), 0)) AS kotor, ROUND(COALESCE(SUM(f.diskon), 0)) AS diskon, ROUND(COALESCE(SUM(f.bulat), 0)) AS bulat,
  ROUND(COALESCE(SUM(f.mp), 0)) AS mp, ROUND(COALESCE(SUM(f.retur), 0)) AS retur, ROUND(COALESCE(SUM(f.hpp), 0)) AS hpp`;

export interface Angka { transaksi: number; qty: number; kotor: number; diskon: number; bulat: number; mp: number; retur: number; hpp: number }
export function lengkapi<T extends Angka>(r: T) {
  const bersih = r.kotor - r.diskon - r.bulat - r.mp - r.retur;
  const laba = bersih - r.hpp;
  return { ...r, bersih, laba, margin: bersih ? Math.round((laba / bersih) * 1000) / 10 : 0 };
}

export async function agregat(db: D1Database, rentang: { mulai: string; akhir: string }, kolom: string[], opsi: { mode?: "jual" | "akui"; join?: string; where?: string; nilai?: unknown[]; urut?: string } = {}) {
  const { results } = await db.prepare(
    `WITH ${sqlFakta(opsi.mode)} SELECT ${kolom.join(", ")}, ${AGREGAT} FROM fakta f ${opsi.join ?? ""} ${opsi.where ? "WHERE " + opsi.where : ""}
     GROUP BY ${kolom.map((_, i) => i + 1).join(", ")} ${opsi.urut ? "ORDER BY " + opsi.urut : ""}`,
  ).bind(rentang.mulai, rentang.akhir, ...(opsi.nilai ?? [])).all<Angka & Obj>();
  return results.map(lengkapi);
}

export function rentangDari(q: Obj) {
  const hari = hariIniWib();
  const dari = tanggal(q, "dari", "Dari tanggal", false) ?? hari;
  const sampai = tanggal(q, "sampai", "Sampai tanggal", false) ?? hari;
  if (sampai < dari) throw new Gagal(400, "Tanggal sampai tidak boleh sebelum tanggal dari");
  return { dari, sampai, ...batasWib(dari, sampai) };
}
const param = (req: Request) => Object.fromEntries(new URL(req.url).searchParams) as Obj;
const NAMA_TEMPAT = "LEFT JOIN lokasi l ON f.sumber = 'pos' AND l.id = f.tempat LEFT JOIN saluran s ON f.sumber = 'online' AND s.id = f.tempat";

// ---------- Dashboard ----------

// Periode harian/mingguan (Senin–Minggu)/bulanan yang memuat tanggal acuan.
export function periode(jenis: string, acuan: string) {
  const d = new Date(acuan + "T00:00:00Z");
  if (jenis === "mingguan") {
    const geser = (d.getUTCDay() + 6) % 7;
    const awal = new Date(d.getTime() - geser * 86_400_000);
    return { dari: awal.toISOString().slice(0, 10), sampai: new Date(awal.getTime() + 6 * 86_400_000).toISOString().slice(0, 10) };
  }
  if (jenis === "bulanan") {
    const awal = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const akhir = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { dari: awal.toISOString().slice(0, 10), sampai: akhir.toISOString().slice(0, 10) };
  }
  return { dari: acuan, sampai: acuan };
}

export async function ringkasan(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = param(req);
  const jenis = ["harian", "mingguan", "bulanan"].includes(q.periode as string) ? (q.periode as string) : "harian";
  const acuan = tanggal(q, "tanggal", "Tanggal", false) ?? hariIniWib();
  const p = periode(jenis, acuan);
  const r = batasWib(p.dari, p.sampai);
  const db = env.DB;
  const [total, sumber, saluran, kategori, produk, kasir, metode, belumCair, menipis] = await Promise.all([
    agregat(db, r, ["1 AS semua"]),
    agregat(db, r, ["f.sumber"]),
    agregat(db, r, ["f.sumber", "f.tempat", "COALESCE(l.nama, s.nama) AS nama"], { join: NAMA_TEMPAT, urut: "kotor DESC" }),
    agregat(db, r, ["COALESCE(k.nama, 'Tanpa kategori') AS nama"], { join: "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id LEFT JOIN kategori k ON k.id = p.kategori_id", urut: "kotor DESC" }),
    agregat(db, r, ["p.id AS produk_id", "p.nama AS nama"], { join: "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id", urut: "qty DESC LIMIT 10" }),
    agregat(db, r, ["f.oleh", "st.nama AS nama"], { join: "JOIN staff st ON st.id = f.oleh", urut: "kotor DESC" }),
    db.prepare(
      `SELECT b.metode, SUM(b.jumlah) - CASE WHEN b.metode = 'Tunai' THEN COALESCE((SELECT SUM(kembalian) FROM trx WHERE status = 'Lunas' AND waktu >= ?1 AND waktu < ?2), 0) ELSE 0 END AS jumlah
       FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.status = 'Lunas' AND t.waktu >= ?1 AND t.waktu < ?2 GROUP BY b.metode ORDER BY jumlah DESC`,
    ).bind(r.mulai, r.akhir).all(),
    db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(kotor - potongan), 0) AS nilai FROM pesanan_online WHERE status = 'Diproses'").first<{ n: number; nilai: number }>(),
    db.prepare(
      `SELECT p.id, p.nama, p.stok_min, COALESCE(SUM(s.qty + s.transit), 0) AS stok FROM produk p JOIN varian v ON v.produk_id = p.id LEFT JOIN stok s ON s.sku = v.sku
       WHERE p.aktif = 1 GROUP BY p.id HAVING stok <= p.stok_min ORDER BY stok LIMIT 20`,
    ).all(),
  ]);
  const t = total[0] ?? lengkapi({ transaksi: 0, qty: 0, kotor: 0, diskon: 0, bulat: 0, mp: 0, retur: 0, hpp: 0 });
  const per = (s: string) => sumber.find((x) => x.sumber === s)?.bersih ?? 0;
  return json({
    periode: { jenis, ...p },
    ringkasan: { ...t, rata: t.transaksi ? Math.round(t.bersih / t.transaksi) : 0, offline: per("pos"), online: per("online"), belum_cair: belumCair },
    grafik: { metode: metode.results, saluran, kategori, produk, kasir, menipis: menipis.results },
  });
}

// ---------- Laporan ----------

export async function laporanSaluran(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = rentangDari(param(req));
  const baris = await agregat(env.DB, r, ["f.sumber", "f.tempat", "COALESCE(l.nama, s.nama) AS nama", "COALESCE(l.jenis, 'online') AS jenis"], { join: NAMA_TEMPAT, urut: "sumber DESC, kotor DESC" });
  return json({ ...r, baris });
}

// Per event (dan Gudang Pusat): penjualan per metode bayar dan selisih kas gabungan semua shift.
export async function laporanEvent(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = rentangDari(param(req));
  const [baris, metode, kas] = await Promise.all([
    agregat(env.DB, r, ["f.tempat", "l.nama AS nama", "l.jenis"], { join: "JOIN lokasi l ON l.id = f.tempat", where: "f.sumber = 'pos'", urut: "kotor DESC" }),
    env.DB.prepare(
      `SELECT t.lokasi_id, b.metode, SUM(b.jumlah) AS jumlah FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.status = 'Lunas' AND t.waktu >= ?1 AND t.waktu < ?2 GROUP BY t.lokasi_id, b.metode`,
    ).bind(r.mulai, r.akhir).all<{ lokasi_id: string; metode: string; jumlah: number }>(),
    env.DB.prepare(
      `SELECT lokasi_id, COUNT(*) AS shift, COALESCE(SUM(selisih), 0) AS selisih,
        (SELECT COALESCE(SUM(kembalian), 0) FROM trx t WHERE t.lokasi_id = s.lokasi_id AND t.status = 'Lunas' AND t.waktu >= ?1 AND t.waktu < ?2) AS kembalian
       FROM shift s WHERE s.buka >= ?1 AND s.buka < ?2 GROUP BY lokasi_id`,
    ).bind(r.mulai, r.akhir).all<{ lokasi_id: string; shift: number; selisih: number; kembalian: number }>(),
  ]);
  return json({
    ...r,
    baris: baris.map((b) => {
      const m = (x: string) => metode.results.filter((y) => y.lokasi_id === b.tempat && y.metode === x).reduce((a, y) => a + y.jumlah, 0);
      const k = kas.results.find((x) => x.lokasi_id === b.tempat);
      return { ...b, tunai: m("Tunai") - (k?.kembalian ?? 0), qris: m("QRIS"), transfer: m("Transfer"), shift: k?.shift ?? 0, selisih_kas: k?.selisih ?? 0 };
    }),
  });
}

// Per kasir: penjualan di event dan gudang atas nama kasir yang melayani, pesanan online atas nama akun yang menginput atau mengimpor.
export async function laporanKasir(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = rentangDari(param(req));
  const [baris, bayar, shift, voidn, role, tempat] = await Promise.all([
    agregat(env.DB, r, ["f.oleh", "st.nama AS nama"], { join: "JOIN staff st ON st.id = f.oleh", urut: "kotor DESC" }),
    env.DB.prepare(
      `SELECT t.kasir_id, SUM(CASE WHEN b.metode = 'Tunai' THEN b.jumlah ELSE 0 END) AS tunai, SUM(CASE WHEN b.metode <> 'Tunai' THEN b.jumlah ELSE 0 END) AS nontunai
       FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.status = 'Lunas' AND t.waktu >= ?1 AND t.waktu < ?2 GROUP BY t.kasir_id`,
    ).bind(r.mulai, r.akhir).all<{ kasir_id: string; tunai: number; nontunai: number }>(),
    env.DB.prepare("SELECT kasir_id, COUNT(*) AS n, COALESCE(SUM(selisih), 0) AS selisih FROM shift WHERE buka >= ?1 AND buka < ?2 GROUP BY kasir_id").bind(r.mulai, r.akhir).all<{ kasir_id: string; n: number; selisih: number }>(),
    env.DB.prepare("SELECT kasir_id, COUNT(*) AS n FROM trx WHERE status = 'Void' AND waktu >= ?1 AND waktu < ?2 GROUP BY kasir_id").bind(r.mulai, r.akhir).all<{ kasir_id: string; n: number }>(),
    env.DB.prepare("SELECT staff_id, group_concat(role) AS role FROM staff_role GROUP BY staff_id").all<{ staff_id: string; role: string }>(),
    env.DB.prepare("SELECT t.kasir_id, group_concat(DISTINCT l.nama) AS tempat FROM trx t JOIN lokasi l ON l.id = t.lokasi_id WHERE t.waktu >= ?1 AND t.waktu < ?2 GROUP BY t.kasir_id")
      .bind(r.mulai, r.akhir).all<{ kasir_id: string; tempat: string }>(),
  ]);
  const kembalian = await env.DB.prepare("SELECT kasir_id, SUM(kembalian) AS n FROM trx WHERE status = 'Lunas' AND waktu >= ?1 AND waktu < ?2 GROUP BY kasir_id").bind(r.mulai, r.akhir).all<{ kasir_id: string; n: number }>();
  const online = await agregat(env.DB, r, ["f.oleh"], { where: "f.sumber = 'online'" });
  return json({
    ...r,
    baris: baris.map((b) => {
      const id = b.oleh as string;
      const by = bayar.results.find((x) => x.kasir_id === id), sh = shift.results.find((x) => x.kasir_id === id);
      return { ...b, role: role.results.find((x) => x.staff_id === id)?.role.split(",") ?? [], tempat: tempat.results.find((x) => x.kasir_id === id)?.tempat ?? "",
        online: online.find((x) => x.oleh === id)?.bersih ?? 0, offline: b.bersih - (online.find((x) => x.oleh === id)?.bersih ?? 0),
        tunai: (by?.tunai ?? 0) - (kembalian.results.find((x) => x.kasir_id === id)?.n ?? 0), nontunai: by?.nontunai ?? 0,
        shift: sh?.n ?? 0, selisih_kas: sh?.selisih ?? 0, void: voidn.results.find((x) => x.kasir_id === id)?.n ?? 0 };
    }),
  });
}

export async function laporanProduk(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = rentangDari(param(req));
  const [baris, pos, stok] = await Promise.all([
    agregat(env.DB, r, ["p.id AS produk_id", "p.nama AS nama", "p.sku AS sku_induk"], { join: "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id", urut: "kotor DESC" }),
    agregat(env.DB, r, ["v.produk_id"], { join: "JOIN varian v ON v.sku = f.sku", where: "f.sumber = 'pos'" }),
    env.DB.prepare("SELECT v.produk_id, COALESCE(SUM(s.qty + s.transit), 0) AS sisa FROM varian v LEFT JOIN stok s ON s.sku = v.sku GROUP BY v.produk_id").all<{ produk_id: string; sisa: number }>(),
  ]);
  return json({
    ...r,
    baris: baris.map((b) => {
      const qp = pos.find((x) => x.produk_id === b.produk_id)?.qty ?? 0;
      return { ...b, qty_event: qp, qty_online: b.qty - qp, sisa: stok.results.find((x) => x.produk_id === b.produk_id)?.sisa ?? 0 };
    }),
  });
}

// ---------- Rekap harian ----------

// Hitung ulang rekap untuk rentang tanggal WIB. Aman diulang: baris lama dihapus lalu diisi dari transaksi.
export async function isiRekap(db: D1Database, dari: string, sampai: string) {
  const r = batasWib(dari, sampai);
  await db.batch([
    db.prepare("DELETE FROM rekap_harian WHERE tanggal >= ? AND tanggal <= ?").bind(dari, sampai),
    db.prepare(
      `INSERT INTO rekap_harian (tanggal, sumber, tempat, sku, qty, kotor, potongan, retur, hpp, transaksi, dihitung_pada)
       WITH ${sqlFakta("jual")}
       SELECT date(f.waktu, '+7 hours'), f.sumber, f.tempat, f.sku, SUM(f.qty), ROUND(SUM(f.kotor)), ROUND(SUM(f.diskon + f.bulat + f.mp)), ROUND(SUM(f.retur)), ROUND(SUM(f.hpp)),
         COUNT(DISTINCT CASE WHEN f.retur = 0 AND f.qty > 0 THEN f.ref END), ?3
       FROM fakta f GROUP BY 1, 2, 3, 4`,
    ).bind(r.mulai, r.akhir, sekarang()),
  ]);
}

// Cron tiap malam: 7 hari terakhir, supaya transaksi dari HP yang lama offline tetap masuk rekap.
export async function cronRekap(env: Env) {
  const hari = hariIniWib();
  const dari = new Date(Date.parse(hari) - 7 * 86_400_000).toISOString().slice(0, 10);
  await isiRekap(env.DB, dari, hari);
}

export async function hitungUlangRekap(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const b = await bacaJson(req);
  const dari = tanggal(b, "dari", "Dari tanggal")!, sampai = tanggal(b, "sampai", "Sampai tanggal")!;
  if (sampai < dari) throw new Gagal(400, "Tanggal sampai tidak boleh sebelum tanggal dari");
  if (Date.parse(sampai) - Date.parse(dari) > 400 * 86_400_000) throw new Gagal(400, "Maksimal 400 hari sekali hitung");
  await isiRekap(env.DB, dari, sampai);
  await logAktivitas(env.DB, staff, "Hitung ulang rekap harian", { tabel: "rekap_harian", keterangan: `${dari} s/d ${sampai}` }).run();
  return json({ ok: true });
}

// Rekap per tanggal: hari sebelum hari ini dari rekap_harian, hari ini dihitung langsung.
export async function laporanHarian(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const r = rentangDari(param(req));
  const hari = hariIniWib();
  const lalu = r.dari < hari ? (await env.DB.prepare(
    `SELECT tanggal, SUM(transaksi) AS transaksi, SUM(qty) AS qty, SUM(kotor) AS kotor, SUM(potongan) AS potongan, SUM(retur) AS retur, SUM(hpp) AS hpp,
      SUM(CASE WHEN sumber = 'online' THEN kotor - potongan ELSE 0 END) AS online, MAX(dihitung_pada) AS dihitung_pada
     FROM rekap_harian WHERE tanggal >= ? AND tanggal <= ? AND tanggal < ? GROUP BY tanggal`,
  ).bind(r.dari, r.sampai, hari).all<Obj & { kotor: number; potongan: number; retur: number; hpp: number }>()).results : [];
  let kini: Obj[] = [];
  if (r.sampai >= hari) {
    const t = batasWib(hari, hari);
    const [semua] = await agregat(env.DB, t, ["1 AS x"]);
    const [onl] = await agregat(env.DB, t, ["1 AS x"], { where: "f.sumber = 'online'" });
    if (semua?.transaksi || semua?.qty) kini = [{ tanggal: hari, transaksi: semua.transaksi, qty: semua.qty, kotor: semua.kotor, potongan: semua.diskon + semua.bulat + semua.mp, retur: semua.retur, hpp: semua.hpp, online: onl?.bersih ?? 0, langsung: true }];
  }
  const baris = [...lalu, ...kini].map((x): Obj => {
    const bersih = (x.kotor as number) - (x.potongan as number) - (x.retur as number);
    return { ...x, bersih, offline: bersih - (x.online as number), laba: bersih - (x.hpp as number) };
  }).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  return json({ ...r, baris });
}
