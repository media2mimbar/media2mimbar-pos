// Keuangan (khusus Owner): Laporan per Event dan Laporan Keseluruhan. Pre-sale dihitung saat barang diserahkan (mode "akui").

import { hariIniWib } from "./aturan.js";
import { KATEGORI_LACI } from "./biaya.js";
import { agregat, batasWib, lengkapi, rentangDari } from "./laporan.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang } from "./util.js";

const SEMUA = batasWib("2000-01-01", "2100-12-31");
const bulanWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 7);

export async function bacaKeuangan(db: D1Database): Promise<{ bagi_biaya_umum: boolean }> {
  const r = await db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'keuangan'").first<{ nilai: string }>();
  return { bagi_biaya_umum: false, ...(r ? JSON.parse(r.nilai) : {}) };
}

export async function simpanPengaturanKeuangan(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner");
  const b = await bacaJson(req);
  const nilai = { bagi_biaya_umum: b.bagi_biaya_umum === true };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO pengaturan (kunci, nilai, diubah_pada, diubah_oleh) VALUES ('keuangan', ?, ?, ?) ON CONFLICT (kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada, diubah_oleh = excluded.diubah_oleh")
      .bind(JSON.stringify(nilai), sekarang(), staff.id),
    logAktivitas(env.DB, staff, "Ubah pengaturan keuangan", { keterangan: nilai.bagi_biaya_umum ? "Bagi biaya umum ke event: aktif" : "Bagi biaya umum ke event: nonaktif" }),
  ]);
  return json({ ok: true });
}

// Biaya per kategori (biaya tercatat + kas keluar laci POS) untuk satu event, semua event, atau biaya umum, dalam rentang.
async function biayaPer(db: D1Database, r: { mulai: string; akhir: string; dari?: string; sampai?: string }, lokasi: string | null | "event") {
  const dari = r.dari ?? "2000-01-01", sampai = r.sampai ?? "2100-12-31";
  const syarat = lokasi === null ? "lokasi_id IS NULL" : lokasi === "event" ? "lokasi_id IS NOT NULL" : "lokasi_id = ?";
  const nilai = lokasi && lokasi !== "event" ? [lokasi] : [];
  const [biaya, laci] = await Promise.all([
    db.prepare(`SELECT lokasi_id, kategori, strftime('%Y-%m', tanggal) AS bulan, SUM(jumlah) AS jumlah FROM biaya WHERE dihapus_pada IS NULL AND ${syarat} AND tanggal >= ? AND tanggal <= ? GROUP BY 1, 2, 3`)
      .bind(...nilai, dari, sampai).all<{ lokasi_id: string | null; kategori: string; bulan: string; jumlah: number }>(),
    lokasi === null ? { results: [] as { lokasi_id: string; bulan: string; jumlah: number }[] } : db.prepare(
      `SELECT s.lokasi_id, strftime('%Y-%m', k.waktu, '+7 hours') AS bulan, SUM(k.jumlah) AS jumlah FROM kas_laci k JOIN shift s ON s.id = k.shift_id
       WHERE k.jenis = 'keluar' ${lokasi === "event" ? "" : "AND s.lokasi_id = ?"} AND k.waktu >= ? AND k.waktu < ? GROUP BY 1, 2`,
    ).bind(...nilai, r.mulai, r.akhir).all<{ lokasi_id: string; bulan: string; jumlah: number }>(),
  ]);
  return [...biaya.results, ...laci.results.map((x) => ({ ...x, kategori: KATEGORI_LACI }))];
}

const jumlahkan = <T extends { jumlah: number }>(x: T[]) => x.reduce((a, y) => a + y.jumlah, 0);
function perKategori(baris: { kategori: string; jumlah: number }[]) {
  const m = new Map<string, number>();
  for (const b of baris) m.set(b.kategori, (m.get(b.kategori) ?? 0) + b.jumlah);
  return [...m.entries()].map(([kategori, jumlah]) => ({ kategori, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
}

// Kerugian per jenis, penggantian dari penanggung jawab, dan sisa yang belum diselesaikan.
async function kerugianPer(db: D1Database, syarat: string, nilai: unknown[]) {
  const { results } = await db.prepare(
    `SELECT k.id, k.jenis, k.lokasi_id, k.tanggal, k.jumlah, k.rincian,
      COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id AND jenis = 'ganti'), 0) AS diganti,
      COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id AND jenis = 'beban'), 0) AS dibebankan
     FROM kerugian k WHERE ${syarat}`,
  ).bind(...nilai).all<{ id: string; jenis: string; lokasi_id: string | null; tanggal: string; jumlah: number; rincian: string; diganti: number; dibebankan: number }>();
  return results;
}

// Bagian biaya umum untuk satu tempat: Σ per bulan biaya umum × (bersih tempat ÷ bersih semua saluran) bulan itu.
async function bagianUmum(db: D1Database, bulanan: { bulan: string; bersih: number }[]) {
  let total = 0;
  for (const b of bulanan) {
    if (b.bersih <= 0) continue;
    const awal = b.bulan + "-01", akhir = new Date(Date.UTC(+b.bulan.slice(0, 4), +b.bulan.slice(5, 7), 0)).toISOString().slice(0, 10);
    const r = batasWib(awal, akhir);
    const [semua] = await agregat(db, r, ["1 AS x"], { mode: "akui" });
    const umum = jumlahkan(await biayaPer(db, { ...r, dari: awal, sampai: akhir }, null));
    if (semua?.bersih > 0) total += Math.round((umum * b.bersih) / semua.bersih);
  }
  return total;
}

const persen = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ---------- Laporan per Event ----------

export async function keuanganEvent(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner");
  const db = env.DB;
  const ev = await db.prepare("SELECT e.id, e.nama, e.venue, e.mulai, e.selesai, e.ditutup FROM event e WHERE e.id = ?").bind(id).first<Obj>();
  if (!ev) throw new Gagal(404, "Event tidak ditemukan");
  const pengaturan = await bacaKeuangan(db);
  const w = { where: "f.sumber = 'pos' AND f.tempat = ?", nilai: [id], mode: "akui" as const };
  const JOIN_V = "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id";
  const [[t], bulanan, kategori, ukuran, produk, biaya, kerugian, kas, metode, presale, gerak, retur] = await Promise.all([
    agregat(db, SEMUA, ["1 AS x"], w),
    agregat(db, SEMUA, ["strftime('%Y-%m', f.waktu, '+7 hours') AS bulan"], w),
    agregat(db, SEMUA, ["COALESCE(k.nama, 'Tanpa kategori') AS nama"], { ...w, join: JOIN_V + " LEFT JOIN kategori k ON k.id = p.kategori_id", urut: "kotor DESC" }),
    agregat(db, SEMUA, ["CASE WHEN p.punya_varian = 1 THEN v.nama ELSE 'Tanpa ukuran' END AS ukuran"], { ...w, join: JOIN_V, urut: "qty DESC" }),
    agregat(db, SEMUA, ["p.id AS produk_id", "p.nama AS nama"], { ...w, join: JOIN_V, urut: "kotor DESC" }),
    biayaPer(db, SEMUA, id),
    kerugianPer(db, "k.lokasi_id = ?", [id]),
    db.prepare("SELECT COUNT(*) AS shift, COALESCE(SUM(CASE WHEN selisih > 0 THEN selisih END), 0) AS lebih, COALESCE(SUM(CASE WHEN status = 'tutup' THEN kas_hitung - modal END), 0) AS setoran FROM shift WHERE lokasi_id = ?")
      .bind(id).first<{ shift: number; lebih: number; setoran: number }>(),
    db.prepare(
      `SELECT b.metode, SUM(b.jumlah) - CASE WHEN b.metode = 'Tunai' THEN (SELECT COALESCE(SUM(kembalian), 0) FROM trx WHERE lokasi_id = ?1 AND status = 'Lunas') ELSE 0 END AS jumlah
       FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.lokasi_id = ?1 AND t.status = 'Lunas' GROUP BY b.metode`,
    ).bind(id).all<{ metode: string; jumlah: number }>(),
    db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS nilai FROM trx WHERE lokasi_id = ? AND presale = 1 AND status = 'Lunas' AND COALESCE(ambil_status, 'Menunggu') = 'Menunggu'")
      .bind(id).first<{ n: number; nilai: number }>(),
    db.prepare(
      `SELECT v.produk_id, SUM(CASE WHEN g.jenis = 'kirim_masuk' THEN g.jumlah ELSE 0 END) AS diterima, SUM(CASE WHEN g.jenis = 'tarik' THEN -g.jumlah ELSE 0 END) AS kembali
       FROM stok_gerak g JOIN varian v ON v.sku = g.sku WHERE g.lokasi_id = ? GROUP BY v.produk_id`,
    ).bind(id).all<{ produk_id: string; diterima: number; kembali: number }>(),
    db.prepare("SELECT COALESCE(SUM(ri.qty), 0) AS qty FROM retur r JOIN retur_item ri ON ri.retur_id = r.id JOIN trx t ON t.id = r.trx_id WHERE t.lokasi_id = ?").bind(id).first<{ qty: number }>(),
  ]);
  const a = t ?? lengkapi({ transaksi: 0, qty: 0, kotor: 0, diskon: 0, bulat: 0, mp: 0, retur: 0, hpp: 0 });
  const sisaStok = await db.prepare("SELECT v.produk_id, SUM(s.qty) AS sisa FROM stok s JOIN varian v ON v.sku = s.sku WHERE s.lokasi_id = ? GROUP BY v.produk_id").bind(id).all<{ produk_id: string; sisa: number }>();
  const totalBiaya = jumlahkan(biaya);
  const totalKerugian = jumlahkan(kerugian);
  const diganti = kerugian.reduce((x, k) => x + k.diganti, 0);
  const umum = pengaturan.bagi_biaya_umum ? await bagianUmum(db, bulanan.map((b) => ({ bulan: b.bulan as string, bersih: b.bersih }))) : 0;
  const lababersih = a.laba - totalBiaya - totalKerugian + diganti + (kas?.lebih ?? 0) - umum;
  const rasio = a.bersih ? a.laba / a.bersih : 0;
  const beban = totalBiaya + totalKerugian - diganti - (kas?.lebih ?? 0) + umum;
  const impas = rasio > 0 ? Math.round(beban / rasio) : null;
  return json({
    event: { ...ev, ditutup: ev.ditutup === 1 },
    pengaturan,
    ringkasan: {
      ...a, biaya: totalBiaya, kerugian: totalKerugian, diganti, kas_lebih: kas?.lebih ?? 0, bagian_umum: umum, laba_bersih: lababersih,
      margin_bersih: persen(lababersih, a.bersih),
      sell_through: persen(a.qty, gerak.results.reduce((x, g) => x + g.diterima, 0)),
    },
    indikator: {
      rata_transaksi: a.transaksi ? Math.round(a.bersih / a.transaksi) : 0, pcs_per_transaksi: a.transaksi ? Math.round((a.qty / a.transaksi) * 10) / 10 : 0,
      persen_diskon: persen(a.diskon, a.kotor), barang_diretur: retur?.qty ?? 0, titik_impas: impas, lewat_impas: impas !== null && a.bersih >= impas,
    },
    uang: { metode: metode.results, presale_belum_diambil: presale, setoran_tunai: kas?.setoran ?? 0, shift: kas?.shift ?? 0 },
    biaya: perKategori(biaya), kerugian,
    kategori, ukuran,
    produk: produk.map((p) => {
      const g = gerak.results.find((x) => x.produk_id === p.produk_id);
      return { ...p, diterima: g?.diterima ?? 0, kembali: g?.kembali ?? 0, sisa: sisaStok.results.find((x) => x.produk_id === p.produk_id)?.sisa ?? 0, sell_through: persen(p.qty, g?.diterima ?? 0) };
    }),
  });
}

// ---------- Laporan Keseluruhan ----------

export async function keuanganKeseluruhan(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner");
  const db = env.DB;
  const q = Object.fromEntries(new URL(req.url).searchParams) as Obj;
  const r = q.semua ? { dari: "2000-01-01", sampai: hariIniWib(), ...batasWib("2000-01-01", hariIniWib()) } : rentangDari(q);
  const pengaturan = await bacaKeuangan(db);
  const NAMA = "LEFT JOIN lokasi l ON f.sumber = 'pos' AND l.id = f.tempat LEFT JOIN saluran s ON f.sumber = 'online' AND s.id = f.tempat";
  const JOIN_V = "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id";
  const [[t], saluran, bulanan, kategori, ukuran, bEvent, bUmum, kerugian, masuk, cair, bayarPemasok, posisi] = await Promise.all([
    agregat(db, r, ["1 AS x"], { mode: "akui" }),
    agregat(db, r, ["f.sumber", "f.tempat", "COALESCE(l.nama, s.nama) AS nama", "COALESCE(l.jenis, 'online') AS jenis"], { mode: "akui", join: NAMA, urut: "kotor DESC" }),
    agregat(db, r, ["strftime('%Y-%m', f.waktu, '+7 hours') AS bulan"], { mode: "akui", urut: "bulan" }),
    agregat(db, r, ["COALESCE(k.nama, 'Tanpa kategori') AS nama"], { mode: "akui", join: JOIN_V + " LEFT JOIN kategori k ON k.id = p.kategori_id", urut: "kotor DESC" }),
    agregat(db, r, ["CASE WHEN p.punya_varian = 1 THEN v.nama ELSE 'Tanpa ukuran' END AS ukuran"], { mode: "akui", join: JOIN_V, urut: "qty DESC" }),
    biayaPer(db, r, "event"),
    biayaPer(db, r, null),
    kerugianPer(db, "k.tanggal >= ? AND k.tanggal < ?", [r.mulai, r.akhir]),
    db.prepare(
      `SELECT b.metode, SUM(b.jumlah) AS jumlah FROM trx_bayar b JOIN trx t ON t.id = b.trx_id WHERE t.status IN ('Lunas', 'Refund') AND t.waktu >= ?1 AND t.waktu < ?2 GROUP BY b.metode`,
    ).bind(r.mulai, r.akhir).all<{ metode: string; jumlah: number }>(),
    db.prepare("SELECT COALESCE(SUM(kotor - potongan), 0) AS n FROM pesanan_online WHERE status = 'Selesai' AND tanggal >= ?1 AND tanggal < ?2").bind(r.mulai, r.akhir).first<{ n: number }>(),
    db.prepare("SELECT COALESCE(SUM(b.jumlah), 0) AS n FROM faktur_bayar b JOIN faktur f ON f.id = b.faktur_id WHERE f.batal = 0 AND b.tanggal >= ? AND b.tanggal <= ?").bind(r.dari, r.sampai).first<{ n: number }>(),
    Promise.all([
      db.prepare(
        `SELECT l.id, l.nama, l.jenis, COALESCE(SUM(s.qty * p.hpp), 0) AS nilai, COALESCE(SUM(s.transit * p.hpp), 0) AS transit FROM lokasi l
         LEFT JOIN stok s ON s.lokasi_id = l.id LEFT JOIN varian v ON v.sku = s.sku LEFT JOIN produk p ON p.id = v.produk_id WHERE l.aktif = 1 GROUP BY l.id ORDER BY l.jenis DESC, l.nama`,
      ).all<{ id: string; nama: string; nilai: number; transit: number }>(),
      db.prepare("SELECT COALESCE(SUM(kotor - potongan), 0) AS n FROM pesanan_online WHERE status = 'Diproses'").first<{ n: number }>(),
      db.prepare(
        `SELECT COALESCE(SUM(k.jumlah - COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id), 0)), 0) AS n FROM kerugian k`,
      ).first<{ n: number }>(),
      db.prepare("SELECT COALESCE(SUM(f.total - COALESCE((SELECT SUM(jumlah) FROM faktur_bayar WHERE faktur_id = f.id), 0)), 0) AS n FROM faktur f WHERE f.batal = 0").first<{ n: number }>(),
      db.prepare("SELECT COUNT(*) AS jumlah, COALESCE(SUM(total), 0) AS n FROM trx WHERE presale = 1 AND status = 'Lunas' AND COALESCE(ambil_status, 'Menunggu') = 'Menunggu'").first<{ jumlah: number; n: number }>(),
    ]),
  ]);
  const a = t ?? lengkapi({ transaksi: 0, qty: 0, kotor: 0, diskon: 0, bulat: 0, mp: 0, retur: 0, hpp: 0 });
  const kembalian = await db.prepare("SELECT COALESCE(SUM(kembalian), 0) AS n FROM trx WHERE status IN ('Lunas', 'Refund') AND waktu >= ?1 AND waktu < ?2").bind(r.mulai, r.akhir).first<{ n: number }>();
  const returUang = await db.prepare("SELECT COALESCE(SUM(nilai), 0) AS n FROM retur WHERE cara = 'Uang kembali' AND waktu >= ?1 AND waktu < ?2").bind(r.mulai, r.akhir).first<{ n: number }>();
  const refund = await db.prepare("SELECT COALESCE(SUM(total), 0) AS n FROM trx WHERE status = 'Refund' AND refund_pada >= ?1 AND refund_pada < ?2").bind(r.mulai, r.akhir).first<{ n: number }>();
  const kasLebih = await db.prepare("SELECT COALESCE(SUM(CASE WHEN selisih > 0 THEN selisih END), 0) AS n FROM shift WHERE tutup >= ?1 AND tutup < ?2").bind(r.mulai, r.akhir).first<{ n: number }>();
  const totalEvent = jumlahkan(bEvent), totalUmum = jumlahkan(bUmum);
  const totalKerugian = jumlahkan(kerugian), diganti = kerugian.reduce((x, k) => x + k.diganti, 0);
  const laba = a.laba - totalEvent - totalUmum - totalKerugian + diganti + (kasLebih?.n ?? 0);
  // Arus kas: uang masuk dari POS (setelah kembalian) dan pencairan marketplace; keluar untuk pemasok, biaya, laci, retur, dan refund pre-sale.
  const uangMasuk = masuk.results.reduce((x, m) => x + m.jumlah, 0) - (kembalian?.n ?? 0) + (cair?.n ?? 0);
  const biayaTunaiLaci = bEvent.filter((b) => b.kategori === KATEGORI_LACI).reduce((x, b) => x + b.jumlah, 0);
  const uangKeluar = (bayarPemasok?.n ?? 0) + totalEvent + totalUmum + (returUang?.n ?? 0) + (refund?.n ?? 0);
  const [stok, piutang, belumKerugian, utang, presale] = posisi;

  // Per event: laba kotor, biaya event, kerugian, bagian biaya umum (kalau aktif), laba bersih.
  const perEvent = [];
  for (const s of saluran.filter((x) => x.sumber === "pos")) {
    const biaya = bEvent.filter((b) => b.lokasi_id === s.tempat).reduce((x, b) => x + b.jumlah, 0);
    const rugi = kerugian.filter((k) => k.lokasi_id === s.tempat);
    const umum = pengaturan.bagi_biaya_umum && s.jenis === "event"
      ? await bagianUmum(db, (await agregat(db, r, ["strftime('%Y-%m', f.waktu, '+7 hours') AS bulan"], { mode: "akui", where: "f.sumber = 'pos' AND f.tempat = ?", nilai: [s.tempat] })).map((b) => ({ bulan: b.bulan as string, bersih: b.bersih })))
      : 0;
    const kerugianN = jumlahkan(rugi) - rugi.reduce((x, k) => x + k.diganti, 0);
    perEvent.push({ id: s.tempat, nama: s.nama, jenis: s.jenis, bersih: s.bersih, laba_kotor: s.laba, biaya, kerugian: kerugianN, bagian_umum: umum, laba_bersih: s.laba - biaya - kerugianN - umum });
  }
  return json({
    ...r, pengaturan,
    ringkasan: { ...a, biaya_event: totalEvent, biaya_umum: totalUmum, kerugian: totalKerugian, diganti, kas_lebih: kasLebih?.n ?? 0, laba_bersih: laba, margin_bersih: persen(laba, a.bersih), arus_kas: uangMasuk - uangKeluar },
    saluran, biaya_event: perKategori(bEvent), biaya_umum: perKategori(bUmum), kerugian,
    arus_kas: {
      masuk: [...masuk.results.map((m) => ({ nama: `POS ${m.metode}`, jumlah: m.metode === "Tunai" ? m.jumlah - (kembalian?.n ?? 0) : m.jumlah })), { nama: "Pencairan marketplace (pesanan selesai)", jumlah: cair?.n ?? 0 }],
      keluar: [{ nama: "Bayar pemasok", jumlah: bayarPemasok?.n ?? 0 }, { nama: "Biaya event (termasuk kas keluar laci)", jumlah: totalEvent }, { nama: "Biaya umum", jumlah: totalUmum },
        { nama: "Retur uang kembali", jumlah: returUang?.n ?? 0 }, { nama: "Refund pre-sale", jumlah: refund?.n ?? 0 }],
      masuk_total: uangMasuk, keluar_total: uangKeluar, kas_keluar_laci: biayaTunaiLaci,
    },
    posisi: {
      persediaan: stok.results, persediaan_total: stok.results.reduce((x, s) => x + s.nilai + s.transit, 0), piutang_marketplace: piutang?.n ?? 0,
      kerugian_belum: belumKerugian?.n ?? 0, utang_pemasok: utang?.n ?? 0, presale_belum_diambil: presale,
    },
    per_event: perEvent, per_bulan: bulanan.map((b) => ({ ...b, biaya: bEvent.concat(bUmum).filter((x) => x.bulan === b.bulan).reduce((x, y) => x + y.jumlah, 0) })),
    kategori, ukuran,
  });
}
