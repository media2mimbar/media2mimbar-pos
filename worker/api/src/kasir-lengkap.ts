// Dokumen antrean POS tahap 5: pelanggan baru, void, retur barang cacat, serah barang pre-sale.
// Ditambah endpoint POS untuk cari pelanggan, daftar pesanan pre-sale, dan cari transaksi (scan QR).

import { hariIniWib } from "./aturan.js";
import { cekId, cekInt, cekStaff, cekTeks, cekWaktu, gerakStok, Hasil, pakaiPersetujuan, ringkasanShift, Tolak } from "./kasir.js";
import { bacaPengaturan } from "./pengaturan.js";
import { sha256 } from "./sandi.js";
import { ambilRole, Perangkat, sesiPos } from "./sesi.js";
import { Gagal, json, Obj, sekarang, ulid } from "./util.js";

// Persetujuan atasan: token online dari /api/pos/setujui, atau PIN dicek di HP saat offline (ditandai offline).
async function persetujuan(env: Env, p: Perangkat, d: Obj, aksi: string, wajibAtasan: boolean) {
  const setuju = await cekStaff(env.DB, d.disetujui_oleh);
  if (typeof d.persetujuan === "string") {
    const r = await pakaiPersetujuan(env.DB, await sha256(d.persetujuan), setuju.id, aksi, p.id).run();
    if (r.meta.changes !== 1) throw new Tolak("Persetujuan PIN tidak sah atau kedaluwarsa");
  } else if (!d.offline) throw new Tolak("Butuh persetujuan PIN");
  if (wajibAtasan) {
    const role = await ambilRole(env.DB, setuju.id);
    if (!role.includes("owner") && !role.includes("admin")) throw new Tolak("Harus disetujui Admin atau Owner");
  }
  return setuju;
}

// Status pengambilan pre-sale. "Perlu Refund" = lewat 7 hari setelah event ditutup dan belum diambil.
export function statusAmbil(t: { status: string; ambil_status: string | null; ambil_batas: string | null }, hari = hariIniWib()) {
  if (t.status === "Refund" || t.ambil_status === "Refund") return "Refund";
  if (t.ambil_status === "Diambil") return "Diambil";
  if (t.status === "Void") return "Batal";
  if (t.ambil_batas && hari > t.ambil_batas) return "Perlu Refund";
  return "Menunggu";
}

// ---------- Pelanggan ----------

export async function prosesPelanggan(env: Env, _p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "Pelanggan");
  const oleh = d.oleh ? (await cekStaff(env.DB, d.oleh)).id : null;
  const t = sekarang();
  const r = await env.DB.prepare("INSERT OR IGNORE INTO pelanggan (id, nama, telp, kota, catatan, dibuat_pada, diubah_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, cekTeks(d.nama, "Nama", 80, true), cekTeks(d.telp, "No HP", 20), cekTeks(d.kota, "Kota", 60), cekTeks(d.catatan, "Catatan", 200), t, t, oleh).run();
  return r.meta.changes ? "ok" : "sudah";
}

export async function cariPelangganPos(req: Request, env: Env) {
  await sesiPos(env.DB, req);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const { results } = await env.DB.prepare(
    `SELECT id, nama, telp, kota FROM pelanggan ${q ? "WHERE nama LIKE ? OR telp LIKE ?" : ""} ORDER BY diubah_pada DESC LIMIT 30`,
  ).bind(...(q ? [`%${q}%`, `%${q.replace(/\D/g, "") || q}%`] : [])).all();
  return json({ pelanggan: results });
}

// ---------- Void ----------

const ALASAN_VOID = ["Salah input", "Pembeli batal", "Salah metode bayar"];

export async function prosesVoid(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "Transaksi");
  const t = await env.DB.prepare(
    "SELECT t.id, t.status, t.lokasi_id, t.presale, t.ambil_status, t.ambil_lokasi, s.status AS shift FROM trx t JOIN shift s ON s.id = t.shift_id WHERE t.id = ?",
  ).bind(id).first<{ id: string; status: string; lokasi_id: string; presale: number; ambil_status: string | null; ambil_lokasi: string | null; shift: string }>();
  if (!t) throw new Tolak("Transaksi belum diterima server");
  if (t.status === "Void") return "sudah";
  if (t.status !== "Lunas") throw new Tolak(`Transaksi berstatus ${t.status}`);
  if (t.shift !== "buka") throw new Tolak("Kasir transaksi ini sudah ditutup. Void tidak bisa lagi");
  if (await env.DB.prepare("SELECT 1 FROM retur WHERE trx_id = ?").bind(id).first()) throw new Tolak("Transaksi yang sudah diretur tidak bisa di-void");
  const alasan = cekTeks(d.alasan, "Alasan", 40, true)!;
  if (!ALASAN_VOID.includes(alasan)) throw new Tolak("Alasan void tidak dikenal");
  const oleh = await cekStaff(env.DB, d.oleh);
  const waktu = cekWaktu(d.waktu, "Waktu");
  // Kasir butuh PIN Admin/Owner kalau "Void perlu PIN atasan" aktif. Admin dan Owner langsung.
  const roleOleh = await ambilRole(env.DB, oleh.id);
  const atasan = roleOleh.includes("owner") || roleOleh.includes("admin");
  const pengaturan = await bacaPengaturan(env.DB);
  const setuju = atasan || !pengaturan.void_pin ? oleh : await persetujuan(env, p, d, "void", true);
  const tulis = [
    env.DB.prepare("UPDATE trx SET status = 'Void', void_pada = ?, void_oleh = ?, void_disetujui = ?, void_alasan = ?, diubah_pada = ? WHERE id = ? AND status = 'Lunas'")
      .bind(waktu, oleh.id, setuju.id, alasan, sekarang(), id),
  ];
  // Stok kembali ke tempat jualan. Pre-sale yang barangnya belum diserahkan tidak pernah mengurangi stok.
  const kembaliKe = t.presale ? (t.ambil_status === "Diambil" ? t.ambil_lokasi : null) : t.lokasi_id;
  if (kembaliKe) {
    const { results } = await env.DB.prepare("SELECT sku, qty FROM trx_item WHERE trx_id = ?").bind(id).all<{ sku: string; qty: number }>();
    for (const i of results) tulis.push(...gerakStok(env.DB, i.sku, kembaliKe, i.qty, "void", "trx", id, waktu, oleh.id));
  }
  await env.DB.batch(tulis);
  return "ok";
}

// ---------- Retur barang cacat ----------

export async function prosesRetur(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "Retur");
  if (await env.DB.prepare("SELECT 1 FROM retur WHERE id = ?").bind(id).first()) return "sudah";
  const t = await env.DB.prepare("SELECT id, no, status, presale, ambil_status, subtotal, total FROM trx WHERE id = ?").bind(cekId(d.trx_id, "Transaksi"))
    .first<{ id: string; no: string; status: string; presale: number; ambil_status: string | null; subtotal: number; total: number }>();
  if (!t) throw new Tolak("Transaksi belum diterima server");
  if (t.status !== "Lunas") throw new Tolak(`Transaksi berstatus ${t.status}`);
  if (t.presale && t.ambil_status !== "Diambil") throw new Tolak("Barang pre-sale belum diserahkan");
  const oleh = await cekStaff(env.DB, d.oleh);
  const waktu = cekWaktu(d.waktu, "Waktu");
  const setuju = await persetujuan(env, p, d, "retur", true); // wajib PIN Admin/Owner, termasuk kalau yang login Admin/Owner
  const lokasi = await env.DB.prepare("SELECT id FROM lokasi WHERE id = ?").bind(typeof d.lokasi_id === "string" ? d.lokasi_id : "").first<{ id: string }>();
  if (!lokasi) throw new Tolak("Lokasi retur tidak dikenal");
  const cara = d.cara === "Tukar barang" || d.cara === "Uang kembali" ? d.cara : null;
  if (!cara) throw new Tolak("Cara penyelesaian tidak dikenal");
  const metode = cara === "Uang kembali" ? (d.metode === "Tunai" || d.metode === "Transfer" ? d.metode : null) : null;
  if (cara === "Uang kembali" && !metode) throw new Tolak("Metode uang kembali tidak dikenal");
  const shiftId = d.shift_id ? cekId(d.shift_id, "Shift") : null;
  if (metode === "Tunai") {
    const s = await env.DB.prepare("SELECT status FROM shift WHERE id = ?").bind(shiftId ?? "").first<{ status: string }>();
    if (!s || s.status !== "buka") throw new Tolak("Uang kembali tunai butuh kasir yang sedang terbuka");
  }
  const alasan = cekTeks(d.alasan, "Kerusakan", 300, true)!;

  // Jumlah dibatasi pembelian dikurangi retur sebelumnya.
  const { results: beli } = await env.DB.prepare("SELECT sku, SUM(qty) AS qty, MAX(harga) AS harga, MAX(hpp) AS hpp FROM trx_item WHERE trx_id = ? GROUP BY sku").bind(t.id)
    .all<{ sku: string; qty: number; harga: number; hpp: number }>();
  const { results: lalu } = await env.DB.prepare("SELECT ri.sku, SUM(ri.qty) AS qty FROM retur_item ri JOIN retur r ON r.id = ri.retur_id WHERE r.trx_id = ? GROUP BY ri.sku").bind(t.id)
    .all<{ sku: string; qty: number }>();
  if (!Array.isArray(d.items) || !d.items.length) throw new Tolak("Pilih barang yang diretur");
  const items = (d.items as Obj[]).map((x, i) => {
    const b = beli.find((y) => y.sku === x?.sku);
    if (!b) throw new Tolak(`Barang ${i + 1} tidak ada di transaksi ini`);
    const maks = b.qty - (lalu.find((y) => y.sku === b.sku)?.qty ?? 0);
    return { sku: b.sku, qty: cekInt(x.qty, `Jumlah ${b.sku}`, 1, maks), harga: b.harga, hpp: b.hpp };
  });
  // Nilai uang kembali = harga × qty × (total ÷ subtotal), yaitu harga yang dibayar setelah promo.
  const nilai = cara === "Uang kembali" ? Math.round(items.reduce((a, i) => a + i.harga * i.qty, 0) * (t.subtotal ? t.total / t.subtotal : 1)) : 0;
  // Uang kembali tunai diambil dari laci: tolak kalau uang di laci (menurut catatan) tidak cukup.
  if (metode === "Tunai" && (await ringkasanShift(env.DB, shiftId!)).ringkasan.seharusnya < nilai) throw new Tolak("Uang di laci tidak cukup untuk uang kembali tunai. Pakai transfer");
  const ke = (await env.DB.prepare("SELECT COUNT(*) AS n FROM retur WHERE trx_id = ?").bind(t.id).first<{ n: number }>())?.n ?? 0;
  const no = `RTR-${t.no.slice(3)}-${ke + 1}`;
  const tulis = [
    env.DB.prepare(
      `INSERT INTO retur (id, no, trx_id, lokasi_id, shift_id, waktu, oleh, disetujui_oleh, cara, metode, nilai, alasan, foto, perangkat_id, offline, diterima_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, no, t.id, lokasi.id, shiftId, waktu, oleh.id, setuju.id, cara, metode, nilai, alasan, cekTeks(d.foto, "Foto", 40), p.id, d.offline ? 1 : 0, sekarang()),
    ...items.map((i) => env.DB.prepare("INSERT INTO retur_item (id, retur_id, sku, qty, harga, hpp) VALUES (?, ?, ?, ?, ?, ?)").bind(ulid(), id, i.sku, i.qty, i.harga, i.hpp)),
    // Barang cacat tidak kembali ke stok jual. Tukar barang mengurangi stok sebanyak barang pengganti.
    ...(cara === "Tukar barang" ? items.flatMap((i) => gerakStok(env.DB, i.sku, lokasi.id, -i.qty, "retur_tukar", "retur", id, waktu, oleh.id)) : []),
  ];
  try {
    await env.DB.batch(tulis);
  } catch (e) {
    if (String((e as Error).message).includes("retur.no")) throw new Tolak("Nomor retur bentrok, kirim ulang");
    throw e;
  }
  return "ok";
}

// ---------- Serah barang pre-sale ----------

export async function prosesSerah(env: Env, p: Perangkat, d: Obj): Promise<Hasil["status"]> {
  const id = cekId(d.id, "Transaksi");
  const t = await env.DB.prepare("SELECT t.*, e.ditutup FROM trx t LEFT JOIN event e ON e.id = t.lokasi_id WHERE t.id = ?").bind(id)
    .first<{ id: string; status: string; presale: number; ambil_status: string | null; ambil_batas: string | null; lokasi_id: string; ditutup: number | null }>();
  if (!t || !t.presale) throw new Tolak("Bukan pesanan pre-sale");
  const st = statusAmbil(t);
  if (st === "Diambil") return "sudah";
  if (st === "Refund" || st === "Batal") throw new Tolak(`Pesanan berstatus ${st}`);
  const lokasi = typeof d.lokasi_id === "string" ? d.lokasi_id : "";
  // Di booth event selama event belum ditutup; setelah ditutup di Gudang Pusat.
  if (t.ditutup ? lokasi !== "gudang" : lokasi !== t.lokasi_id) throw new Tolak(t.ditutup ? "Event sudah ditutup: ambil di Gudang Pusat" : "Pesanan ini diambil di booth event");
  const oleh = await cekStaff(env.DB, d.oleh);
  const waktu = cekWaktu(d.waktu, "Waktu");
  const cara = d.cara === "Manual" ? "Manual" : "QR";
  // Struk hilang: verifikasi 4 digit no HP + PIN Admin/Owner.
  const setuju = cara === "Manual" ? await persetujuan(env, p, d, "presale_manual", true) : null;
  const { results } = await env.DB.prepare("SELECT sku, qty FROM trx_item WHERE trx_id = ?").bind(id).all<{ sku: string; qty: number }>();
  await env.DB.batch([
    env.DB.prepare("UPDATE trx SET ambil_status = 'Diambil', ambil_pada = ?, ambil_oleh = ?, ambil_lokasi = ?, ambil_cara = ?, ambil_disetujui = ?, diubah_pada = ? WHERE id = ? AND ambil_status = 'Menunggu'")
      .bind(waktu, oleh.id, lokasi, cara, setuju?.id ?? null, sekarang(), id),
    ...results.flatMap((i) => gerakStok(env.DB, i.sku, lokasi, -i.qty, "presale_serah", "trx", id, waktu, oleh.id)),
  ]);
  return "ok";
}

// ---------- Endpoint POS: pesanan pre-sale dan cari transaksi ----------

const SELECT_TRX = `SELECT t.id, t.no, t.waktu, t.lokasi_id, l.nama AS lokasi, t.total, t.subtotal, t.diskon, t.promo, t.pajak, t.pembulatan, t.metode, t.dibayar, t.kembalian, t.status,
  t.pelanggan_nama, t.pelanggan_telp, t.presale, t.ambil_status, t.ambil_batas, t.ambil_pada, t.ambil_cara, a.nama AS ambil_oleh, la.nama AS ambil_lokasi, s.nama AS kasir,
  t.void_alasan, t.shift_id, e.mulai AS event_mulai, e.ditutup AS event_ditutup
  FROM trx t JOIN lokasi l ON l.id = t.lokasi_id JOIN staff s ON s.id = t.kasir_id LEFT JOIN staff a ON a.id = t.ambil_oleh LEFT JOIN lokasi la ON la.id = t.ambil_lokasi
  LEFT JOIN event e ON e.id = t.lokasi_id`;

export async function lengkapiTrx(db: D1Database, daftar: Obj[]): Promise<Obj[]> {
  if (!daftar.length) return [];
  const ids = daftar.map((t) => t.id as string);
  const isi = async (sql: string) => {
    const hasil: Obj[] = [];
    for (let i = 0; i < ids.length; i += 90) {
      const b = ids.slice(i, i + 90);
      hasil.push(...(await db.prepare(sql.replace("(?)", `(${b.map(() => "?").join(",")})`)).bind(...b).all<Obj>()).results);
    }
    return hasil;
  };
  const [item, bayar, retur] = await Promise.all([
    isi("SELECT trx_id, sku, nama, qty, harga, bonus FROM trx_item WHERE trx_id IN (?) ORDER BY urutan"),
    isi("SELECT trx_id, metode, jumlah, ref FROM trx_bayar WHERE trx_id IN (?) ORDER BY urutan"),
    isi(`SELECT r.trx_id, r.no, r.waktu, r.cara, r.metode, r.nilai, r.alasan, s.nama AS disetujui, (SELECT group_concat(sku || ' x' || qty) FROM retur_item WHERE retur_id = r.id) AS barang,
      (SELECT json_group_array(json_object('sku', sku, 'qty', qty)) FROM retur_item WHERE retur_id = r.id) AS items FROM retur r JOIN staff s ON s.id = r.disetujui_oleh WHERE r.trx_id IN (?)`),
  ]);
  return daftar.map((t) => ({
    ...t, ambil: t.presale ? statusAmbil(t as never) : null,
    items: item.filter((x) => x.trx_id === t.id), pembayaran: bayar.filter((x) => x.trx_id === t.id),
    retur: retur.filter((x) => x.trx_id === t.id).map((r) => ({ ...r, items: JSON.parse(r.items as string) })),
  }));
}

// Pesanan pre-sale yang bisa diserahkan di tempat ini: di booth event, atau di Gudang Pusat setelah event ditutup.
export async function pesananPos(req: Request, env: Env) {
  await sesiPos(env.DB, req);
  const lokasi = new URL(req.url).searchParams.get("lokasi") ?? "";
  const syarat = lokasi === "gudang" ? "e.ditutup = 1" : "t.lokasi_id = ?";
  const { results } = await env.DB.prepare(`${SELECT_TRX} WHERE t.presale = 1 AND t.status = 'Lunas' AND ${syarat} ORDER BY t.waktu DESC LIMIT 300`)
    .bind(...(lokasi === "gudang" ? [] : [lokasi])).all<Obj>();
  return json({ pesanan: await lengkapiTrx(env.DB, results) });
}

// Cari transaksi dari isi QR (ID) atau nomor transaksi.
export async function cariTrxPos(req: Request, env: Env, kunci: string) {
  await sesiPos(env.DB, req);
  const t = await env.DB.prepare(`${SELECT_TRX} WHERE t.id = ? OR t.no = ?`).bind(kunci, kunci).first<Obj>();
  if (!t) throw new Gagal(404, "Transaksi tidak ditemukan");
  return json({ trx: (await lengkapiTrx(env.DB, [t]))[0] });
}
