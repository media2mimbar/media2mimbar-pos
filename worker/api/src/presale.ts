// Dashboard › Pesanan Pre-sale (verifikasi pengambilan dan refund) dan Inventori › Stok Terbuang.

import { hariIniWib } from "./aturan.js";
import { kenaPenjaga, penjaga } from "./inventori.js";
import { gerakStok } from "./kasir.js";
import { lengkapiTrx, statusAmbil } from "./kasir-lengkap.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, daftar, Gagal, json, Obj, sekarang, tanggal, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

// ---------- Pesanan Pre-sale ----------

export async function daftarPresale(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.no, t.waktu, t.lokasi_id, l.nama AS lokasi, t.total, t.metode, t.status, t.pelanggan_nama, t.pelanggan_telp, t.presale, t.ambil_status, t.ambil_batas,
      t.ambil_pada, t.ambil_cara, a.nama AS ambil_oleh, la.nama AS ambil_lokasi, s.nama AS kasir, t.refund_pada, r.nama AS refund_oleh, t.refund_bank, t.refund_norek,
      t.refund_an, t.refund_catatan, t.refund_bukti
     FROM trx t JOIN lokasi l ON l.id = t.lokasi_id JOIN staff s ON s.id = t.kasir_id LEFT JOIN staff a ON a.id = t.ambil_oleh
     LEFT JOIN lokasi la ON la.id = t.ambil_lokasi LEFT JOIN staff r ON r.id = t.refund_oleh
     WHERE t.presale = 1 AND t.status <> 'Void' ORDER BY t.waktu DESC LIMIT 1000`,
  ).all<Obj>();
  const pesanan = await lengkapiTrx(env.DB, results);
  const hitung = (st: string) => {
    const x = pesanan.filter((p) => p.ambil === st);
    return { jumlah: x.length, nilai: x.reduce((a, p) => a + (p.total as number), 0) };
  };
  return json({ pesanan, ringkasan: { menunggu: hitung("Menunggu"), perlu_refund: hitung("Perlu Refund"), diambil: hitung("Diambil"), refund: hitung("Refund") } });
}

// Tandai sudah ditransfer (Perlu Refund) atau batalkan & refund (masih Menunggu). Foto bukti transfer wajib.
export async function refundPresale(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const t = await env.DB.prepare("SELECT id, no, status, presale, ambil_status, ambil_batas FROM trx WHERE id = ?").bind(id)
    .first<{ id: string; no: string; status: string; presale: number; ambil_status: string | null; ambil_batas: string | null }>();
  if (!t || !t.presale) throw new Gagal(404, "Pesanan pre-sale tidak ditemukan");
  const st = statusAmbil(t);
  if (st !== "Menunggu" && st !== "Perlu Refund") throw new Gagal(400, `Pesanan berstatus ${st}`);
  const b = await bacaJson(req);
  const bukti = wajibTeks(b, "bukti", "Foto bukti transfer", { max: 40 });
  if (!(await env.DB.prepare("SELECT 1 FROM berkas WHERE id = ? AND jenis = 'bukti_refund'").bind(bukti).first())) throw new Gagal(400, "Foto bukti transfer tidak ditemukan. Unggah ulang");
  const t2 = sekarang();
  const r = await env.DB.batch([
    env.DB.prepare(
      `UPDATE trx SET status = 'Refund', ambil_status = 'Refund', refund_pada = ?, refund_oleh = ?, refund_bank = ?, refund_norek = ?, refund_an = ?, refund_catatan = ?, refund_bukti = ?,
        diubah_pada = ? WHERE id = ? AND status = 'Lunas' AND ambil_status = 'Menunggu'`,
    ).bind(t2, staff.id, wajibTeks(b, "bank", "Bank tujuan", { max: 40 }), wajibTeks(b, "norek", "No. rekening", { max: 40 }), wajibTeks(b, "an", "Atas nama", { max: 80 }),
      teks(b, "catatan", "Catatan", { max: 300, wajib: false }), bukti, t2, id),
    env.DB.prepare("UPDATE berkas SET ref_tabel = 'trx', ref_id = ? WHERE id = ?").bind(id, bukti),
    logAktivitas(env.DB, staff, st === "Menunggu" ? "Batalkan & refund pre-sale" : "Tandai refund pre-sale", { tabel: "trx", id, keterangan: t.no }),
  ]);
  if (r[0].meta.changes !== 1) throw new Gagal(409, "Pesanan baru saja berubah. Muat ulang");
  return json({ ok: true });
}

// ---------- Stok Terbuang ----------

const ALASAN = ["Rusak", "Hilang", "Cacat dari pemasok", "Berjamur atau lembap", "Lainnya"];

// Semua barang yang keluar tanpa terjual: catatan manual, barang cacat dari retur, kiriman kurang, selisih opname.
export async function daftarTerbuang(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [manual, retur, kiriman, opname] = await Promise.all([
    env.DB.prepare(
      `SELECT t.id, 'manual' AS jenis, t.waktu, l.nama AS lokasi, t.alasan, t.penjelasan, p.nama AS pj, t.foto, t.kerugian, o.nama AS oleh,
        (SELECT json_group_array(json_object('sku', i.sku, 'qty', i.qty, 'hpp', i.hpp, 'nama', TRIM(pr.nama || ' ' || v.nama))) FROM terbuang_item i JOIN varian v ON v.sku = i.sku JOIN produk pr ON pr.id = v.produk_id WHERE i.terbuang_id = t.id) AS items
       FROM terbuang t JOIN lokasi l ON l.id = t.lokasi_id JOIN staff p ON p.id = t.pj_id JOIN staff o ON o.id = t.oleh`,
    ).all<Obj>(),
    env.DB.prepare(
      `SELECT r.id, 'retur' AS jenis, r.waktu, l.nama AS lokasi, 'Barang cacat (retur)' AS alasan, r.alasan AS penjelasan, NULL AS pj, r.foto, o.nama AS oleh,
        r.no, t.no AS no_trx, r.cara, r.metode, r.nilai, s.nama AS disetujui,
        (SELECT SUM(qty * hpp) FROM retur_item WHERE retur_id = r.id) AS kerugian,
        (SELECT json_group_array(json_object('sku', i.sku, 'qty', i.qty, 'hpp', i.hpp, 'nama', TRIM(pr.nama || ' ' || v.nama))) FROM retur_item i JOIN varian v ON v.sku = i.sku JOIN produk pr ON pr.id = v.produk_id WHERE i.retur_id = r.id) AS items
       FROM retur r JOIN trx t ON t.id = r.trx_id JOIN lokasi l ON l.id = r.lokasi_id JOIN staff o ON o.id = r.oleh JOIN staff s ON s.id = r.disetujui_oleh`,
    ).all<Obj>(),
    env.DB.prepare(
      `SELECT k.id, 'kiriman' AS jenis, k.tanggal AS waktu, l.nama AS lokasi, 'Hilang di perjalanan' AS alasan, k.penjelasan, p.nama AS pj, NULL AS foto, k.jumlah AS kerugian, k.rincian
       FROM kerugian k LEFT JOIN lokasi l ON l.id = k.lokasi_id LEFT JOIN staff p ON p.id = k.pj_id WHERE k.jenis = 'kiriman'`,
    ).all<Obj>(),
    env.DB.prepare(
      `SELECT k.id, 'opname' AS jenis, k.tanggal AS waktu, l.nama AS lokasi, 'Selisih opname' AS alasan, k.penjelasan, p.nama AS pj, NULL AS foto, k.jumlah AS kerugian, k.rincian
       FROM kerugian k LEFT JOIN lokasi l ON l.id = k.lokasi_id LEFT JOIN staff p ON p.id = k.pj_id WHERE k.jenis = 'stok'`,
    ).all<Obj>(),
  ]);
  const semua = [...manual.results, ...retur.results, ...kiriman.results, ...opname.results]
    .map((x): Obj => ({ ...x, items: x.items ? JSON.parse(x.items as string) : [] }))
    .sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)));
  const pcs = (x: Obj) => (x.items as { qty: number }[]).reduce((a, i) => a + i.qty, 0);
  return json({
    terbuang: semua,
    ringkasan: {
      pcs: semua.reduce((a, x) => a + pcs(x), 0),
      nilai: semua.reduce((a, x) => a + ((x.kerugian as number) ?? 0), 0),
      uang_kembali: retur.results.reduce((a, r) => a + ((r.nilai as number) ?? 0), 0),
    },
  });
}

// + Catat Barang Terbuang: stok lokasi langsung berkurang, kerugian masuk Selisih & Kerugian.
export async function catatTerbuang(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const lokasi = wajibTeks(b, "lokasi_id", "Lokasi", { max: 40 });
  if (!(await env.DB.prepare("SELECT 1 FROM lokasi WHERE id = ? AND aktif = 1").bind(lokasi).first())) throw new Gagal(400, "Lokasi tidak ditemukan atau event sudah ditutup");
  const tgl = tanggal(b, "tanggal", "Tanggal")!;
  if (tgl > hariIniWib()) throw new Gagal(400, "Tanggal tidak boleh di masa depan");
  const alasan = wajibTeks(b, "alasan", "Alasan", { max: 30 });
  if (!ALASAN.includes(alasan)) throw new Gagal(400, "Alasan tidak dikenal");
  const penjelasan = wajibTeks(b, "penjelasan", "Penjelasan", { min: 10, max: 500 });
  const pj = wajibTeks(b, "pj_id", "Penanggung jawab", { max: 40 });
  if (!(await env.DB.prepare("SELECT 1 FROM staff WHERE id = ?").bind(pj).first())) throw new Gagal(400, "Penanggung jawab tidak ditemukan");
  const foto = teks(b, "foto", "Foto", { max: 40, wajib: false });
  const item = daftar(b, "item", "Barang").map((x, i) => ({ sku: wajibTeks(x, "sku", `SKU baris ${i + 1}`, { max: 40 }), qty: wajibBulat(x, "qty", `Jumlah baris ${i + 1}`, { min: 1, max: 100_000 }) }));
  if (!item.length || item.length > 80) throw new Gagal(400, "Isi 1 sampai 80 barang");
  const skus = item.map((i) => i.sku);
  const { results: info } = await env.DB.prepare(
    `SELECT v.sku, p.hpp, TRIM(p.nama || ' ' || v.nama) AS nama, COALESCE(s.qty, 0) AS qty FROM varian v JOIN produk p ON p.id = v.produk_id
     LEFT JOIN stok s ON s.sku = v.sku AND s.lokasi_id = ? WHERE v.sku IN (${skus.map(() => "?").join(",")})`,
  ).bind(lokasi, ...skus).all<{ sku: string; hpp: number; nama: string; qty: number }>();
  for (const i of item) {
    const s = info.find((x) => x.sku === i.sku);
    if (!s) throw new Gagal(400, `SKU ${i.sku} tidak ditemukan`);
    if (i.qty > s.qty) throw new Gagal(400, `${s.nama}: maksimal ${s.qty} (stok di lokasi ini)`);
  }
  const hpp = new Map(info.map((x) => [x.sku, x]));
  const kerugian = item.reduce((a, i) => a + i.qty * hpp.get(i.sku)!.hpp, 0);
  const id = ulid(), t = sekarang();
  try {
    await env.DB.batch([
      ...item.map((i) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = ?), 0) >= ?", i.sku, lokasi, i.qty)),
      env.DB.prepare("INSERT INTO terbuang (id, lokasi_id, tanggal, alasan, penjelasan, pj_id, foto, kerugian, oleh, waktu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, lokasi, tgl, alasan, penjelasan, pj, foto, kerugian, staff.id, t),
      ...item.flatMap((i) => [
        env.DB.prepare("INSERT INTO terbuang_item (id, terbuang_id, sku, qty, hpp) VALUES (?, ?, ?, ?, ?)").bind(ulid(), id, i.sku, i.qty, hpp.get(i.sku)!.hpp),
        ...gerakStok(env.DB, i.sku, lokasi, -i.qty, "terbuang", "terbuang", id, t, staff.id),
      ]),
      ...(kerugian > 0 ? [env.DB.prepare(
        "INSERT INTO kerugian (id, jenis, ref_tabel, ref_id, lokasi_id, tanggal, jumlah, rincian, pj_id, penjelasan, disetujui_oleh, dibuat_pada) VALUES (?, 'terbuang', 'terbuang', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(ulid(), id, lokasi, t, kerugian, `${alasan}: ` + item.map((i) => `${hpp.get(i.sku)!.nama} ${i.qty}`).join(", "), pj, penjelasan, staff.id, t)] : []),
      ...(foto ? [env.DB.prepare("UPDATE berkas SET ref_tabel = 'terbuang', ref_id = ? WHERE id = ?").bind(id, foto)] : []),
      logAktivitas(env.DB, staff, "Catat barang terbuang", { tabel: "terbuang", id, keterangan: `${alasan}, kerugian ${kerugian}` }),
    ]);
  } catch (e) {
    if (kenaPenjaga(e)) throw new Gagal(409, "Stok lokasi baru saja berubah. Muat ulang lalu coba lagi");
    throw e;
  }
  return json({ id, kerugian }, 201);
}
