// Event: daftar, form, detail, kirim stok, tarik ke gudang, batal kiriman, tutup event.

import { hariIniWib } from "./aturan.js";
import { denganNomor } from "./dokumen.js";
import { kenaPenjaga, penjaga } from "./inventori.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, benar, bulat, daftar, Gagal, json, Obj, sekarang, tanggal, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

export type StatusEvent = "Akan Datang" | "Berlangsung" | "Perlu Ditutup" | "Selesai";

export function statusEvent(e: { mulai: string; selesai: string; ditutup: number }, hari = hariIniWib()): StatusEvent {
  if (e.ditutup) return "Selesai";
  if (hari < e.mulai) return "Akan Datang";
  if (hari <= e.selesai) return "Berlangsung";
  return "Perlu Ditutup";
}

interface BarisEvent {
  id: string;
  nama: string;
  venue: string | null;
  mulai: string;
  selesai: string;
  zona: string;
  catatan: string | null;
  pj_id: string;
  pj: string;
  presale_aktif: number;
  presale_mode: string;
  ditutup: number;
  tutup_pada: string | null;
  tutup_catatan: string | null;
  tutup_oleh: string | null;
}

const SELECT_EVENT = `SELECT e.*, p.nama AS pj, t.nama AS tutup_oleh_nama FROM event e JOIN staff p ON p.id = e.pj_id LEFT JOIN staff t ON t.id = e.tutup_oleh`;

export async function ambilEvent(db: D1Database, id: string) {
  const e = await db.prepare(`${SELECT_EVENT} WHERE e.id = ?`).bind(id).first<BarisEvent>();
  if (!e) throw new Gagal(404, "Event tidak ditemukan");
  return e;
}

async function stokDi(db: D1Database, lokasi: string) {
  const { results } = await db.prepare("SELECT sku, qty, transit FROM stok WHERE lokasi_id = ?").bind(lokasi).all<{ sku: string; qty: number; transit: number }>();
  return new Map(results.map((r) => [r.sku, r]));
}

// ---------- Daftar ----------

export async function daftarEvent(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const hari = hariIniWib();
  const mulaiHari = new Date(Date.parse(hari) - 7 * 3600_000).toISOString();
  const { results } = await env.DB.prepare(
    `${SELECT_EVENT.replace("SELECT e.*", `SELECT e.*,
      (SELECT group_concat(s.nama, ', ') FROM event_kasir k JOIN staff s ON s.id = k.staff_id WHERE k.event_id = e.id) AS kasir,
      (SELECT COUNT(*) FROM trx WHERE lokasi_id = e.id AND status = 'Lunas') AS transaksi,
      (SELECT COALESCE(SUM(total), 0) FROM trx WHERE lokasi_id = e.id AND status = 'Lunas') AS penjualan,
      (SELECT COALESCE(SUM(total), 0) FROM trx WHERE lokasi_id = e.id AND status = 'Lunas' AND waktu >= ?) AS penjualan_hari_ini,
      (SELECT group_concat(s.nama, ', ') FROM shift h JOIN staff s ON s.id = h.kasir_id WHERE h.lokasi_id = e.id AND h.status = 'buka') AS kasir_terbuka`)}
     ORDER BY e.ditutup, e.mulai DESC`,
  ).bind(mulaiHari).all<BarisEvent>();
  return json({ event: results.map((e) => ({ ...e, status: statusEvent(e, hari), presale_aktif: e.presale_aktif === 1, ditutup: e.ditutup === 1 })) });
}

// ---------- Form ----------

function isiEvent(b: Obj) {
  const mulai = tanggal(b, "mulai", "Tanggal mulai")!;
  const selesai = tanggal(b, "selesai", "Tanggal selesai")!;
  if (selesai < mulai) throw new Gagal(400, "Tanggal selesai tidak boleh sebelum tanggal mulai");
  const zona = teks(b, "zona", "Zona waktu", { max: 4, wajib: false }) ?? "WIB";
  if (!["WIB", "WITA", "WIT"].includes(zona)) throw new Gagal(400, "Zona waktu tidak dikenal");
  const mode = teks(b, "presale_mode", "Mode pre-sale", { max: 5, wajib: false }) ?? "ambil";
  if (mode !== "ambil" && mode !== "stok") throw new Gagal(400, "Mode pre-sale tidak dikenal");
  const kasir = Array.isArray(b.kasir) ? [...new Set(b.kasir as unknown[])] : [];
  if (kasir.some((k) => typeof k !== "string") || kasir.length > 50) throw new Gagal(400, "Daftar kasir tidak valid");
  const varian = daftar(b, "varian", "Produk yang dijual").map((v, i) => ({
    sku: wajibTeks(v, "sku", `SKU baris ${i + 1}`, { max: 40 }),
    harga: bulat(v, "harga", `Harga event baris ${i + 1}`, { max: 100_000_000, wajib: false }),
  }));
  if (!varian.length) throw new Gagal(400, "Pilih minimal satu varian yang dijual");
  if (varian.length > 300) throw new Gagal(400, "Maksimal 300 varian per event");
  if (new Set(varian.map((v) => v.sku)).size !== varian.length) throw new Gagal(400, "Ada varian yang dobel");
  const nama = wajibTeks(b, "nama", "Nama event", { max: 100 });
  if (nama.toLowerCase() === "gudang pusat") throw new Gagal(400, "Nama event tidak boleh Gudang Pusat");
  return {
    nama, venue: teks(b, "venue", "Tempat", { max: 200, wajib: false }), mulai, selesai, zona,
    catatan: teks(b, "catatan", "Catatan", { max: 1000, wajib: false }),
    pj_id: wajibTeks(b, "pj_id", "Penanggung jawab", { max: 40 }),
    presale_aktif: benar(b, "presale_aktif", false), presale_mode: mode, kasir: kasir as string[], varian,
  };
}

async function cekIsiEvent(db: D1Database, e: ReturnType<typeof isiEvent>, id: string) {
  if (await db.prepare("SELECT 1 FROM event WHERE nama = ? AND id <> ?").bind(e.nama, id).first()) throw new Gagal(409, "Nama event sudah dipakai");
  const orang = [...new Set([e.pj_id, ...e.kasir])];
  const { results } = await db.prepare(`SELECT id FROM staff WHERE aktif = 1 AND id IN (${orang.map(() => "?").join(",")})`).bind(...orang).all<{ id: string }>();
  if (results.length !== orang.length) throw new Gagal(400, "Ada karyawan yang tidak ditemukan atau nonaktif");
  for (let i = 0; i < e.varian.length; i += 90) {
    const bagian = e.varian.slice(i, i + 90).map((v) => v.sku);
    const ada = await db.prepare(`SELECT COUNT(*) AS n FROM varian WHERE sku IN (${bagian.map(() => "?").join(",")})`).bind(...bagian).first<{ n: number }>();
    if (ada?.n !== bagian.length) throw new Gagal(400, "Ada SKU yang tidak ditemukan");
  }
}

function tulisIsiEvent(db: D1Database, id: string, e: ReturnType<typeof isiEvent>) {
  return [
    db.prepare("DELETE FROM event_kasir WHERE event_id = ?").bind(id),
    ...e.kasir.map((k) => db.prepare("INSERT INTO event_kasir (event_id, staff_id) VALUES (?, ?)").bind(id, k)),
    db.prepare("DELETE FROM event_varian WHERE event_id = ?").bind(id),
    ...e.varian.map((v) => db.prepare("INSERT INTO event_varian (event_id, sku, harga) VALUES (?, ?, ?)").bind(id, v.sku, v.harga)),
  ];
}

export async function tambahEvent(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const e = isiEvent(await bacaJson(req));
  const id = ulid();
  await cekIsiEvent(env.DB, e, id);
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO lokasi (id, jenis, nama, aktif, dibuat_pada, diubah_pada) VALUES (?, 'event', ?, 1, ?, ?)").bind(id, e.nama, t, t),
    env.DB.prepare(
      `INSERT INTO event (id, nama, venue, mulai, selesai, zona, catatan, pj_id, presale_aktif, presale_mode, dibuat_pada, diubah_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, e.nama, e.venue, e.mulai, e.selesai, e.zona, e.catatan, e.pj_id, e.presale_aktif ? 1 : 0, e.presale_mode, t, t, staff.id),
    ...tulisIsiEvent(env.DB, id, e),
    logAktivitas(env.DB, staff, "Buat event", { tabel: "event", id, keterangan: e.nama }),
  ]);
  return json({ id }, 201);
}

export async function ubahEvent(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const lama = await ambilEvent(env.DB, id);
  if (lama.ditutup) throw new Gagal(400, "Event sudah ditutup");
  const e = isiEvent(await bacaJson(req));
  await cekIsiEvent(env.DB, e, id);
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE event SET nama = ?, venue = ?, mulai = ?, selesai = ?, zona = ?, catatan = ?, pj_id = ?, presale_aktif = ?, presale_mode = ?, diubah_pada = ? WHERE id = ?`,
    ).bind(e.nama, e.venue, e.mulai, e.selesai, e.zona, e.catatan, e.pj_id, e.presale_aktif ? 1 : 0, e.presale_mode, t, id),
    // Nama lokasi ikut berubah; stok dan transaksi menempel ke ID, jadi ikut "pindah" otomatis.
    env.DB.prepare("UPDATE lokasi SET nama = ?, diubah_pada = ? WHERE id = ?").bind(e.nama, t, id),
    ...tulisIsiEvent(env.DB, id, e),
    logAktivitas(env.DB, staff, "Ubah event", { tabel: "event", id, keterangan: e.nama }),
  ]);
  return json({ ok: true });
}

// ---------- Detail ----------

export async function detailEvent(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const e = await ambilEvent(env.DB, id);
  const db = env.DB;
  const [kasir, varian, stokEv, stokGd, gerak, terjual, bayar, ringkas, mutasi, shift, trx, opname] = await Promise.all([
    db.prepare("SELECT s.id, s.nama FROM event_kasir k JOIN staff s ON s.id = k.staff_id WHERE k.event_id = ? ORDER BY s.nama").bind(id).all(),
    db.prepare(
      `SELECT ev.sku, ev.harga, v.nama AS varian, v.harga_jual, p.nama AS produk, p.id AS produk_id, p.hpp FROM event_varian ev
       JOIN varian v ON v.sku = ev.sku JOIN produk p ON p.id = v.produk_id WHERE ev.event_id = ? ORDER BY p.nama, v.urutan`,
    ).bind(id).all<{ sku: string; hpp: number }>(),
    stokDi(db, id),
    stokDi(db, "gudang"),
    db.prepare(
      `SELECT sku, SUM(CASE WHEN jenis = 'kirim_masuk' THEN jumlah ELSE 0 END) AS diterima, SUM(CASE WHEN jenis = 'tarik' THEN -jumlah ELSE 0 END) AS ditarik,
        SUM(CASE WHEN jenis = 'opname' THEN jumlah ELSE 0 END) AS selisih FROM stok_gerak WHERE lokasi_id = ? GROUP BY sku`,
    ).bind(id).all<{ sku: string; diterima: number; ditarik: number; selisih: number }>(),
    db.prepare(
      `SELECT i.sku, SUM(i.qty) AS qty, SUM(i.qty * i.harga) AS nilai, SUM(i.qty * i.hpp) AS hpp FROM trx_item i JOIN trx t ON t.id = i.trx_id
       WHERE t.lokasi_id = ? AND t.status = 'Lunas' GROUP BY i.sku`,
    ).bind(id).all<{ sku: string; qty: number; nilai: number; hpp: number }>(),
    db.prepare(`SELECT b.metode, SUM(b.jumlah) AS jumlah FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.lokasi_id = ? AND t.status = 'Lunas' GROUP BY b.metode`).bind(id).all(),
    db.prepare(
      `SELECT COUNT(*) AS transaksi, COALESCE(SUM(total), 0) AS penjualan, COALESCE(SUM(kembalian), 0) AS kembalian,
        COALESCE(SUM(diskon), 0) AS diskon FROM trx WHERE lokasi_id = ? AND status = 'Lunas'`,
    ).bind(id).first<{ transaksi: number; penjualan: number; kembalian: number }>(),
    db.prepare(
      `SELECT m.id, m.no, m.jenis, m.status, m.dikirim_pada, m.diterima_pada, a.nama AS dikirim_oleh, b.nama AS diterima_oleh, m.catatan_terima,
        (SELECT SUM(dikirim) FROM mutasi_item WHERE mutasi_id = m.id) AS dikirim, (SELECT SUM(diterima) FROM mutasi_item WHERE mutasi_id = m.id) AS diterima
       FROM mutasi m LEFT JOIN staff a ON a.id = m.dikirim_oleh LEFT JOIN staff b ON b.id = m.diterima_oleh WHERE m.ke = ? OR m.dari = ? ORDER BY m.dikirim_pada DESC`,
    ).bind(id, id).all(),
    db.prepare(
      `SELECT s.id, s.buka, s.tutup, s.status, s.modal, s.kas_hitung, s.selisih, s.catatan, a.nama AS kasir FROM shift s JOIN staff a ON a.id = s.kasir_id
       WHERE s.lokasi_id = ? ORDER BY s.buka DESC`,
    ).bind(id).all(),
    db.prepare(
      `SELECT t.id, t.no, t.waktu, t.total, t.metode, t.status, s.nama AS kasir FROM trx t JOIN staff s ON s.id = t.kasir_id WHERE t.lokasi_id = ? ORDER BY t.waktu DESC LIMIT 300`,
    ).bind(id).all(),
    db.prepare(
      `SELECT o.id, o.no, o.jenis, o.status, o.dihitung_pada, a.nama AS dihitung_oleh, b.nama AS disetujui_oleh, o.ulang_alasan, o.kerugian FROM opname o
       JOIN staff a ON a.id = o.dihitung_oleh LEFT JOIN staff b ON b.id = o.disetujui_oleh WHERE o.lokasi_id = ? ORDER BY o.dihitung_pada DESC`,
    ).bind(id).all(),
  ]);
  const g = new Map(gerak.results.map((x) => [x.sku, x]));
  const j = new Map(terjual.results.map((x) => [x.sku, x]));
  const skuSemua = [...new Set([...varian.results.map((v) => v.sku), ...stokEv.keys()])];
  const info = new Map(varian.results.map((v) => [v.sku, v]));
  const hppTerjual = terjual.results.reduce((a, x) => a + x.hpp, 0);
  return json({
    event: { ...e, status: statusEvent(e), presale_aktif: e.presale_aktif === 1, ditutup: e.ditutup === 1 },
    kasir: kasir.results,
    varian: varian.results.map((v) => ({ ...v, stok_gudang: stokGd.get(v.sku)?.qty ?? 0, stok_event: stokEv.get(v.sku)?.qty ?? 0, transit: stokEv.get(v.sku)?.transit ?? 0 })),
    stok: skuSemua.map((sku) => ({
      sku, nama: info.get(sku) ? `${(info.get(sku) as Obj).produk}${(info.get(sku) as Obj).varian ? " · " + (info.get(sku) as Obj).varian : ""}` : sku,
      diterima: g.get(sku)?.diterima ?? 0, ditarik: g.get(sku)?.ditarik ?? 0, selisih: g.get(sku)?.selisih ?? 0,
      terjual: j.get(sku)?.qty ?? 0, sisa: stokEv.get(sku)?.qty ?? 0, transit: stokEv.get(sku)?.transit ?? 0,
    })),
    ringkasan: { ...ringkas, laba_kotor: (ringkas?.penjualan ?? 0) - hppTerjual, produk_terjual: terjual.results.reduce((a, x) => a + x.qty, 0) },
    metode: bayar.results,
    mutasi: mutasi.results,
    shift: shift.results,
    transaksi: trx.results,
    opname: opname.results,
  });
}

// ---------- Kirim stok, batal kirim, tarik ke gudang ----------

const isiBarang = (b: Obj) => {
  const item = daftar(b, "item", "Barang").map((x, i) => ({
    sku: wajibTeks(x, "sku", `SKU baris ${i + 1}`, { max: 40 }),
    qty: wajibBulat(x, "qty", `Jumlah baris ${i + 1}`, { min: 1, max: 100_000 }),
  }));
  if (!item.length) throw new Gagal(400, "Isi minimal satu barang");
  if (item.length > 90) throw new Gagal(400, "Maksimal 90 baris sekali kirim");
  if (new Set(item.map((i) => i.sku)).size !== item.length) throw new Gagal(400, "Ada barang yang dobel");
  return item;
};

export async function kirimStok(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const e = await ambilEvent(env.DB, id);
  if (e.ditutup) throw new Gagal(400, "Event sudah ditutup");
  const b = await bacaJson(req);
  const item = isiBarang(b);
  const catatan = teks(b, "catatan", "Catatan", { max: 300, wajib: false });
  const { results: dijual } = await env.DB.prepare("SELECT sku FROM event_varian WHERE event_id = ?").bind(id).all<{ sku: string }>();
  const boleh = new Set(dijual.map((x) => x.sku));
  for (const i of item) if (!boleh.has(i.sku)) throw new Gagal(400, `${i.sku} tidak dijual di event ini. Tambahkan dulu di form event`);
  const gudang = await stokDi(env.DB, "gudang");
  const kurang = item.filter((i) => (gudang.get(i.sku)?.qty ?? 0) < i.qty);
  if (kurang.length) throw new Gagal(400, `Stok gudang tidak cukup: ${kurang.map((k) => `${k.sku} (ada ${gudang.get(k.sku)?.qty ?? 0})`).join(", ")}`);
  const mid = ulid(), t = sekarang();
  try {
    const no = await denganNomor(env.DB, "MT", async (no) => {
      await env.DB.batch([
        ...item.map((i) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = 'gudang'), 0) >= ?", i.sku, i.qty)),
        env.DB.prepare("INSERT INTO mutasi (id, no, jenis, dari, ke, status, dikirim_pada, dikirim_oleh, catatan, diubah_pada) VALUES (?, ?, 'kirim', 'gudang', ?, 'Dikirim', ?, ?, ?, ?)")
          .bind(mid, no, id, t, staff.id, catatan, t),
        ...item.flatMap((i) => [
          env.DB.prepare("INSERT INTO mutasi_item (id, mutasi_id, sku, dikirim) VALUES (?, ?, ?, ?)").bind(ulid(), mid, i.sku, i.qty),
          env.DB.prepare("UPDATE stok SET qty = qty - ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = 'gudang'").bind(i.qty, t, i.sku),
          env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, 'gudang', ?, 'kirim_keluar', 'mutasi', ?, ?, ?)")
            .bind(ulid(), i.sku, -i.qty, mid, t, staff.id),
          // Barang dalam perjalanan dicatat sebagai transit di event sampai diterima kasir.
          env.DB.prepare(
            `INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, ?, 0, ?, ?)
             ON CONFLICT (sku, lokasi_id) DO UPDATE SET transit = transit + excluded.transit, diubah_pada = excluded.diubah_pada`,
          ).bind(i.sku, id, i.qty, t),
        ]),
        logAktivitas(env.DB, staff, "Kirim stok", { tabel: "mutasi", id: mid, keterangan: `${no} ke ${e.nama}` }),
      ]);
      return no;
    });
    return json({ id: mid, no }, 201);
  } catch (x) {
    if (kenaPenjaga(x)) throw new Gagal(409, "Stok gudang baru saja berubah. Muat ulang lalu coba lagi");
    throw x;
  }
}

// Kembalikan kiriman yang belum diterima ke gudang (dipakai Batal dan Tutup Event).
async function tulisBatalKiriman(db: D1Database, mutasiId: string, olehId: string, alasan: string, t: string) {
  const m = await db.prepare("SELECT id, ke FROM mutasi WHERE id = ? AND status = 'Dikirim'").bind(mutasiId).first<{ id: string; ke: string }>();
  if (!m) return [];
  const { results: item } = await db.prepare("SELECT sku, dikirim FROM mutasi_item WHERE mutasi_id = ?").bind(mutasiId).all<{ sku: string; dikirim: number }>();
  return [
    db.prepare("UPDATE mutasi SET status = 'Batal', batal_pada = ?, batal_oleh = ?, batal_alasan = ?, diubah_pada = ? WHERE id = ? AND status = 'Dikirim'").bind(t, olehId, alasan, t, mutasiId),
    ...item.flatMap((i) => [
      db.prepare("UPDATE stok SET transit = transit - ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = ?").bind(i.dikirim, t, i.sku, m.ke),
      db.prepare("UPDATE stok SET qty = qty + ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = 'gudang'").bind(i.dikirim, t, i.sku),
      db.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, 'gudang', ?, 'kirim_keluar', 'mutasi', ?, ?, ?)")
        .bind(ulid(), i.sku, i.dikirim, mutasiId, t, olehId),
    ]),
  ];
}

export async function batalKiriman(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const alasan = wajibTeks(b, "alasan", "Alasan", { min: 5, max: 300 });
  const t = sekarang();
  const tulis = await tulisBatalKiriman(env.DB, id, staff.id, alasan, t);
  if (!tulis.length) throw new Gagal(400, "Kiriman tidak ditemukan atau sudah diterima");
  await env.DB.batch([...tulis, logAktivitas(env.DB, staff, "Batal kiriman", { tabel: "mutasi", id, keterangan: alasan })]);
  return json({ ok: true });
}

// Tarik sisa stok event langsung ke gudang (tanpa transit).
function tulisTarik(db: D1Database, eventId: string, mid: string, no: string, item: { sku: string; qty: number }[], olehId: string, t: string, catatan: string | null) {
  return [
    db.prepare(
      `INSERT INTO mutasi (id, no, jenis, dari, ke, status, dikirim_pada, dikirim_oleh, diterima_pada, diterima_oleh, catatan, diubah_pada)
       VALUES (?, ?, 'tarik', ?, 'gudang', 'Diterima', ?, ?, ?, ?, ?, ?)`,
    ).bind(mid, no, eventId, t, olehId, t, olehId, catatan, t),
    ...item.flatMap((i) => [
      db.prepare("INSERT INTO mutasi_item (id, mutasi_id, sku, dikirim, diterima) VALUES (?, ?, ?, ?, ?)").bind(ulid(), mid, i.sku, i.qty, i.qty),
      db.prepare("UPDATE stok SET qty = qty - ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = ?").bind(i.qty, t, i.sku, eventId),
      db.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'tarik', 'mutasi', ?, ?, ?)")
        .bind(ulid(), i.sku, eventId, -i.qty, mid, t, olehId),
      db.prepare(
        `INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, 'gudang', ?, 0, ?)
         ON CONFLICT (sku, lokasi_id) DO UPDATE SET qty = qty + excluded.qty, diubah_pada = excluded.diubah_pada`,
      ).bind(i.sku, i.qty, t),
      db.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, 'gudang', ?, 'tarik', 'mutasi', ?, ?, ?)")
        .bind(ulid(), i.sku, i.qty, mid, t, olehId),
    ]),
  ];
}

export async function tarikStok(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const e = await ambilEvent(env.DB, id);
  if (e.ditutup) throw new Gagal(400, "Event sudah ditutup");
  const b = await bacaJson(req);
  const item = isiBarang(b);
  const stok = await stokDi(env.DB, id);
  const kurang = item.filter((i) => (stok.get(i.sku)?.qty ?? 0) < i.qty);
  if (kurang.length) throw new Gagal(400, `Stok event tidak cukup: ${kurang.map((k) => `${k.sku} (ada ${stok.get(k.sku)?.qty ?? 0})`).join(", ")}`);
  const mid = ulid(), t = sekarang();
  try {
    const no = await denganNomor(env.DB, "MT", async (no) => {
      await env.DB.batch([
        ...item.map((i) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = ?), 0) >= ?", i.sku, id, i.qty)),
        ...tulisTarik(env.DB, id, mid, no, item, staff.id, t, teks(b, "catatan", "Catatan", { max: 300, wajib: false })),
        logAktivitas(env.DB, staff, "Tarik stok ke gudang", { tabel: "mutasi", id: mid, keterangan: `${no} dari ${e.nama}` }),
      ]);
      return no;
    });
    return json({ id: mid, no }, 201);
  } catch (x) {
    if (kenaPenjaga(x)) throw new Gagal(409, "Stok event baru saja berubah (ada penjualan). Muat ulang lalu coba lagi");
    throw x;
  }
}

// ---------- Tutup event ----------

// Data untuk halaman Tutup Event: stok sistem per varian, opname kasir yang menunggu, kiriman yang akan dibatalkan, shift terbuka.
export async function siapTutup(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const e = await ambilEvent(env.DB, id);
  return json(await dataTutup(env.DB, e));
}

async function dataTutup(db: D1Database, e: BarisEvent) {
  const [stok, shift, kiriman, opname] = await Promise.all([
    db.prepare(
      `SELECT s.sku, s.qty, TRIM(p.nama || ' ' || v.nama) AS nama, p.hpp FROM stok s JOIN varian v ON v.sku = s.sku JOIN produk p ON p.id = v.produk_id
       WHERE s.lokasi_id = ? AND (s.qty <> 0 OR s.sku IN (SELECT sku FROM event_varian WHERE event_id = ?)) ORDER BY p.nama, v.urutan`,
    ).bind(e.id, e.id).all<{ sku: string; qty: number; nama: string; hpp: number }>(),
    db.prepare("SELECT s.id, a.nama AS kasir, s.buka FROM shift s JOIN staff a ON a.id = s.kasir_id WHERE s.lokasi_id = ? AND s.status = 'buka'").bind(e.id).all(),
    db.prepare("SELECT m.id, m.no, (SELECT SUM(dikirim) FROM mutasi_item WHERE mutasi_id = m.id) AS jumlah FROM mutasi m WHERE m.ke = ? AND m.status = 'Dikirim'").bind(e.id).all(),
    db.prepare(
      `SELECT o.id, o.no, o.dihitung_pada, o.catatan, a.nama AS dihitung_oleh FROM opname o JOIN staff a ON a.id = o.dihitung_oleh
       WHERE o.lokasi_id = ? AND o.status = 'Menunggu persetujuan' ORDER BY o.dihitung_pada DESC LIMIT 1`,
    ).bind(e.id).first<{ id: string }>(),
  ]);
  let opnameItem: { sku: string; sistem: number; fisik: number }[] = [];
  if (opname) opnameItem = (await db.prepare("SELECT sku, sistem, fisik FROM opname_item WHERE opname_id = ?").bind(opname.id).all<{ sku: string; sistem: number; fisik: number }>()).results;
  const presale = await db.prepare("SELECT COUNT(*) AS n FROM trx WHERE lokasi_id = ? AND presale = 1 AND ambil_status = 'Menunggu' AND status = 'Lunas'").bind(e.id).first<{ n: number }>();
  return { event: { ...e, status: statusEvent(e) }, stok: stok.results, shift_terbuka: shift.results, kiriman: kiriman.results, opname_menunggu: opname ? { ...opname, item: opnameItem } : null,
    presale_menunggu: presale?.n ?? 0 };
}

// POST /api/event/:id/tutup { fisik: {SKU: n}, pj_id, penjelasan, opname_id? }
export async function tutupEvent(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const e = await ambilEvent(env.DB, id);
  if (e.ditutup) throw new Gagal(400, "Event sudah ditutup");
  const d = await dataTutup(env.DB, e);
  if (d.shift_terbuka.length) throw new Gagal(400, "Masih ada kasir terbuka. Tutup kasirnya dulu");
  const b = await bacaJson(req);
  const opnameId = teks(b, "opname_id", "Opname", { max: 40, wajib: false });
  if (d.opname_menunggu && opnameId !== d.opname_menunggu.id) throw new Gagal(400, "Ada stok opname kasir yang menunggu persetujuan. Setujui atau minta opname ulang dulu");
  const fisik = (b.fisik ?? {}) as Obj;
  if (typeof fisik !== "object" || Array.isArray(fisik)) throw new Gagal(400, "Stok fisik tidak valid");

  // Isian kosong = sama dengan sistem.
  const baris = d.stok.map((s) => {
    const f = bulat(fisik, s.sku, `Stok fisik ${s.nama}`, { max: 1_000_000, wajib: false }) ?? Math.max(0, s.qty);
    return { ...s, fisik: f, selisih: f - s.qty };
  });
  const kerugian = baris.reduce((a, x) => a + Math.max(0, -x.selisih) * x.hpp, 0);
  const pj = teks(b, "pj_id", "Penanggung jawab", { max: 40, wajib: false });
  const penjelasan = teks(b, "penjelasan", "Penjelasan selisih", { max: 1000, wajib: false });
  if (kerugian > 0 && (!pj || !penjelasan || penjelasan.length < 5)) throw new Gagal(400, "Ada barang kurang: pilih penanggung jawab dan isi penjelasan selisih");
  if (pj && !(await env.DB.prepare("SELECT 1 FROM staff WHERE id = ?").bind(pj).first())) throw new Gagal(400, "Penanggung jawab tidak ditemukan");

  const t = sekarang();
  const tulis = [];
  // 1. Kiriman yang belum diterima dibatalkan, barangnya kembali ke gudang.
  for (const k of d.kiriman as { id: string }[]) tulis.push(...(await tulisBatalKiriman(env.DB, k.id, staff.id, "Event ditutup sebelum kiriman diterima", t)));

  // 2. Opname tutup event: stok event disesuaikan ke fisik.
  const oid = opnameId ?? ulid();
  const noOpname = await denganNomor(env.DB, "SO", async (no) => no);
  if (opnameId) {
    tulis.push(env.DB.prepare(
      "UPDATE opname SET status = 'Disetujui', disetujui_oleh = ?, disetujui_pada = ?, pj_id = ?, penjelasan = ?, kerugian = ?, diubah_pada = ? WHERE id = ? AND status = 'Menunggu persetujuan'",
    ).bind(staff.id, t, pj, penjelasan, kerugian, t, opnameId));
  } else {
    tulis.push(env.DB.prepare(
      `INSERT INTO opname (id, no, lokasi_id, jenis, status, dihitung_oleh, dihitung_pada, disetujui_oleh, disetujui_pada, pj_id, penjelasan, kerugian, diterima_pada, diubah_pada)
       VALUES (?, ?, ?, 'tutup_event', 'Disetujui', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(oid, noOpname, id, staff.id, t, staff.id, t, pj, penjelasan, kerugian, t, t));
    tulis.push(...baris.map((x) => env.DB.prepare("INSERT INTO opname_item (id, opname_id, sku, sistem, fisik, hpp) VALUES (?, ?, ?, ?, ?, ?)").bind(ulid(), oid, x.sku, x.qty, x.fisik, x.hpp)));
  }
  for (const x of baris.filter((x) => x.selisih !== 0)) {
    tulis.push(
      env.DB.prepare("UPDATE stok SET qty = ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = ?").bind(x.fisik, t, x.sku, id),
      env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'opname', 'opname', ?, ?, ?)")
        .bind(ulid(), x.sku, id, x.selisih, oid, t, staff.id),
    );
  }
  if (kerugian > 0) {
    const rincian = baris.filter((x) => x.selisih < 0).map((x) => `${x.nama} kurang ${-x.selisih}`).join(", ");
    tulis.push(env.DB.prepare(
      "INSERT INTO kerugian (id, jenis, ref_tabel, ref_id, lokasi_id, tanggal, jumlah, rincian, pj_id, penjelasan, disetujui_oleh, dibuat_pada) VALUES (?, 'stok', 'opname', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(ulid(), oid, id, t, kerugian, rincian, pj, penjelasan, staff.id, t));
  }

  // 3. Stok fisik kembali ke Gudang Pusat.
  const kembali = baris.filter((x) => x.fisik > 0).map((x) => ({ sku: x.sku, qty: x.fisik }));
  const mid = ulid();
  const noTarik = await denganNomor(env.DB, "MT", async (no) => no);
  if (kembali.length) tulis.push(...tulisTarik(env.DB, id, mid, noTarik, kembali, staff.id, t, "Sisa stok saat event ditutup"));

  // 4. Event ditutup dan tidak lagi tampil di POS.
  const om = d.opname_menunggu as Obj | null;
  const oleh = opnameId ? `Stok opname ${om?.no} dihitung ${om?.dihitung_oleh}, disetujui ${staff.nama}.` : `Stok dihitung dan disetujui ${staff.nama}.`;
  tulis.push(
    env.DB.prepare("UPDATE event SET ditutup = 1, tutup_pada = ?, tutup_oleh = ?, tutup_catatan = ?, diubah_pada = ? WHERE id = ? AND ditutup = 0")
      .bind(t, staff.id, `${oleh}${kerugian ? ` Kerugian Rp${kerugian.toLocaleString("id-ID")}.` : ""}`, t, id),
    env.DB.prepare("UPDATE lokasi SET aktif = 0, diubah_pada = ? WHERE id = ?").bind(t, id),
    // Pre-sale yang belum diambil boleh diambil di Gudang Pusat 7 hari, lalu menjadi Perlu Refund.
    env.DB.prepare("UPDATE trx SET ambil_batas = ?, diubah_pada = ? WHERE lokasi_id = ? AND presale = 1 AND ambil_status = 'Menunggu' AND status = 'Lunas'")
      .bind(new Date(Date.parse(hariIniWib()) + 7 * 86_400_000).toISOString().slice(0, 10), t, id),
    logAktivitas(env.DB, staff, "Tutup event", { tabel: "event", id, keterangan: `${e.nama}, kerugian ${kerugian}` }),
  );
  await env.DB.batch(tulis);
  return json({ ok: true, kerugian, kembali: kembali.reduce((a, x) => a + x.qty, 0) });
}
