// Inventori: pemasok, faktur pembelian (barang selalu masuk Gudang Pusat), daftar stok, buku besar.

import { hariIniWib, hppSetelahBatal, hppSetelahBeli, noDokumen, statusFaktur } from "./aturan.js";
import { logAktivitas, sesiSiap } from "./sesi.js";
import { bacaJson, bulat, daftar, Gagal, json, sekarang, tanggal, teks, ulid, wajibBulat, wajibTeks } from "./util.js";

const GUDANG = "gudang";
const CARA_BAYAR = ["Transfer", "Tunai", "Lainnya"];

// Pernyataan penjaga: membatalkan seluruh batch kalau syarat tidak terpenuhi saat batch dijalankan.
// SQLite tidak punya RAISE di luar trigger, jadi dipakai json() yang gagal dengan pesan bertanda.
function penjaga(db: D1Database, syarat: string, ...nilai: unknown[]) {
  return db.prepare(`SELECT CASE WHEN ${syarat} THEN 1 ELSE json('penjaga') END`).bind(...nilai);
}
const kenaPenjaga = (e: unknown) => String((e as Error)?.message ?? e).includes("malformed JSON");

// ---------- Pemasok ----------

export async function daftarPemasok(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { results } = await env.DB
    .prepare(
      `SELECT p.*,
        (SELECT count(*) FROM faktur f WHERE f.pemasok_id = p.id AND f.batal = 0) AS jumlah_faktur,
        (SELECT COALESCE(SUM(f.total), 0) FROM faktur f WHERE f.pemasok_id = p.id AND f.batal = 0) AS total_beli,
        (SELECT COALESCE(SUM(f.total - (SELECT COALESCE(SUM(b.jumlah), 0) FROM faktur_bayar b WHERE b.faktur_id = f.id)), 0)
           FROM faktur f WHERE f.pemasok_id = p.id AND f.batal = 0) AS sisa
       FROM pemasok p ORDER BY p.nama`,
    )
    .all();
  return json({ pemasok: results });
}

function isiPemasok(b: Record<string, unknown>) {
  return {
    nama: wajibTeks(b, "nama", "Nama pemasok", { max: 80 }),
    telp: wajibTeks(b, "telp", "Telepon", { max: 20 }),
    alamat: teks(b, "alamat", "Alamat", { max: 300, wajib: false }),
    barang: teks(b, "barang", "Barang yang dipasok", { max: 300, wajib: false }),
    rekening: teks(b, "rekening", "Rekening", { max: 120, wajib: false }),
    catatan: teks(b, "catatan", "Catatan", { max: 500, wajib: false }),
  };
}

async function namaPemasokDipakai(db: D1Database, nama: string, kecuali: string) {
  if (await db.prepare("SELECT 1 FROM pemasok WHERE nama = ? AND id <> ?").bind(nama, kecuali).first()) {
    throw new Gagal(409, "Nama pemasok sudah ada");
  }
}

export async function tambahPemasok(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = isiPemasok(await bacaJson(req));
  const id = ulid(), t = sekarang();
  await namaPemasokDipakai(env.DB, p.nama, id);
  await env.DB.prepare(
    "INSERT INTO pemasok (id, nama, telp, alamat, barang, rekening, catatan, dibuat_pada, diubah_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, p.nama, p.telp, p.alamat, p.barang, p.rekening, p.catatan, t, t, staff.id).run();
  return json({ id }, 201);
}

export async function ubahPemasok(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const p = isiPemasok(await bacaJson(req));
  await namaPemasokDipakai(env.DB, p.nama, id);
  const r = await env.DB.prepare("UPDATE pemasok SET nama = ?, telp = ?, alamat = ?, barang = ?, rekening = ?, catatan = ?, diubah_pada = ? WHERE id = ?")
    .bind(p.nama, p.telp, p.alamat, p.barang, p.rekening, p.catatan, sekarang(), id).run();
  if (r.meta.changes === 0) throw new Gagal(404, "Pemasok tidak ditemukan");
  return json({ ok: true });
}

// ---------- Faktur ----------

interface BarisFaktur {
  id: string;
  no: string;
  tanggal: string;
  pemasok_id: string;
  pemasok: string;
  total: number;
  dibayar: number;
  jatuh_tempo: string | null;
  batal: number;
  jumlah_barang: number;
}

const SELECT_FAKTUR = `SELECT f.id, f.no, f.tanggal, f.pemasok_id, p.nama AS pemasok, f.total, f.jatuh_tempo, f.batal, f.catatan,
  f.batal_alasan, f.batal_pada, f.dibuat_pada, a.nama AS dibuat_oleh, b.nama AS batal_oleh,
  (SELECT COALESCE(SUM(jumlah), 0) FROM faktur_bayar WHERE faktur_id = f.id) AS dibayar,
  (SELECT COALESCE(SUM(qty), 0) FROM faktur_item WHERE faktur_id = f.id) AS jumlah_barang
  FROM faktur f JOIN pemasok p ON p.id = f.pemasok_id LEFT JOIN staff a ON a.id = f.dibuat_oleh LEFT JOIN staff b ON b.id = f.batal_oleh`;

function bentukFaktur(f: BarisFaktur, hariIni: string) {
  const batal = f.batal === 1;
  return {
    ...f,
    batal,
    sisa: batal ? 0 : Math.max(0, f.total - f.dibayar),
    status: statusFaktur({ batal, total: f.total, dibayar: f.dibayar, jatuh_tempo: f.jatuh_tempo }, hariIni),
  };
}

export async function daftarFaktur(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const hariIni = hariIniWib();
  const { results } = await env.DB.prepare(`${SELECT_FAKTUR} ORDER BY f.tanggal DESC, f.no DESC LIMIT 500`).all<BarisFaktur>();
  const faktur = results.map((f) => bentukFaktur(f, hariIni));
  const bulanIni = hariIni.slice(0, 7);
  const tujuhHari = new Date(Date.parse(hariIni) + 7 * 86_400_000).toISOString().slice(0, 10);
  const aktif = faktur.filter((f) => !f.batal);
  return json({
    faktur,
    ringkasan: {
      beli_bulan_ini: aktif.filter((f) => f.tanggal.startsWith(bulanIni)).reduce((a, f) => a + f.total, 0),
      belum_dibayar: aktif.reduce((a, f) => a + f.sisa, 0),
      lewat_jatuh_tempo: aktif.filter((f) => f.status === "Lewat jatuh tempo").reduce((a, f) => a + f.sisa, 0),
      jatuh_tempo_7_hari: aktif.filter((f) => f.sisa > 0 && f.jatuh_tempo && f.jatuh_tempo >= hariIni && f.jatuh_tempo <= tujuhHari).reduce((a, f) => a + f.sisa, 0),
    },
  });
}

export async function detailFaktur(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const f = await env.DB.prepare(`${SELECT_FAKTUR} WHERE f.id = ?`).bind(id).first<BarisFaktur>();
  if (!f) throw new Gagal(404, "Faktur tidak ditemukan");
  const [item, bayar, hpp] = await Promise.all([
    env.DB.prepare(
      `SELECT i.sku, i.qty, i.harga, p.nama AS produk, v.nama AS varian, p.satuan FROM faktur_item i
       JOIN varian v ON v.sku = i.sku JOIN produk p ON p.id = v.produk_id WHERE i.faktur_id = ? ORDER BY i.urutan`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT b.tanggal, b.jumlah, b.cara, b.catatan, a.nama AS oleh, b.dibuat_pada FROM faktur_bayar b
       LEFT JOIN staff a ON a.id = b.dibuat_oleh WHERE b.faktur_id = ? ORDER BY b.dibuat_pada`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT h.lama, h.baru, h.sebab, p.nama AS produk FROM hpp_riwayat h JOIN produk p ON p.id = h.produk_id
       WHERE h.ref_tabel = 'faktur' AND h.ref_id = ? ORDER BY h.waktu`,
    ).bind(id).all(),
  ]);
  return json({ faktur: bentukFaktur(f, hariIniWib()), item: item.results, bayar: bayar.results, hpp: hpp.results });
}

interface ItemFaktur {
  sku: string;
  qty: number;
  harga: number;
}

// Kelompokkan barang per produk, lalu ambil HPP dan stok total produk (semua lokasi + transit).
async function perProduk(db: D1Database, item: ItemFaktur[]) {
  const skus = [...new Set(item.map((i) => i.sku))];
  const { results } = await db
    .prepare(
      `SELECT v.sku, v.produk_id, p.nama, p.hpp,
        (SELECT COALESCE(SUM(s.qty + s.transit), 0) FROM stok s JOIN varian v2 ON v2.sku = s.sku WHERE v2.produk_id = v.produk_id) AS stok_produk
       FROM varian v JOIN produk p ON p.id = v.produk_id WHERE v.sku IN (${skus.map(() => "?").join(",")})`,
    )
    .bind(...skus)
    .all<{ sku: string; produk_id: string; nama: string; hpp: number; stok_produk: number }>();
  const kenal = new Map(results.map((r) => [r.sku, r]));
  for (const s of skus) if (!kenal.has(s)) throw new Gagal(400, `SKU ${s} tidak ditemukan`);
  const grup = new Map<string, { produk_id: string; nama: string; hpp: number; stok: number; qty: number; nilai: number }>();
  for (const i of item) {
    const r = kenal.get(i.sku)!;
    const g = grup.get(r.produk_id) ?? { produk_id: r.produk_id, nama: r.nama, hpp: r.hpp, stok: Math.max(0, r.stok_produk), qty: 0, nilai: 0 };
    g.qty += i.qty;
    g.nilai += i.qty * i.harga;
    grup.set(r.produk_id, g);
  }
  return [...grup.values()];
}

async function noFakturBerikut(db: D1Database, tgl: string) {
  const r = await db.prepare("SELECT MAX(CAST(substr(no, -4) AS INTEGER)) AS n FROM faktur").first<{ n: number | null }>();
  return noDokumen("FA", tgl, (r?.n ?? 0) + 1);
}

export async function tambahFaktur(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const tgl = tanggal(b, "tanggal", "Tanggal")!;
  const pemasokId = wajibTeks(b, "pemasok_id", "Pemasok", { max: 40 });
  if (!(await env.DB.prepare("SELECT 1 FROM pemasok WHERE id = ?").bind(pemasokId).first())) throw new Gagal(400, "Pemasok tidak ditemukan");
  const item: ItemFaktur[] = daftar(b, "item", "Barang").map((x, i) => ({
    sku: wajibTeks(x, "sku", `SKU baris ${i + 1}`, { max: 40 }),
    qty: wajibBulat(x, "qty", `Jumlah baris ${i + 1}`, { min: 1, max: 1_000_000 }),
    harga: wajibBulat(x, "harga", `Harga beli baris ${i + 1}`, { max: 100_000_000 }),
  }));
  if (!item.length) throw new Gagal(400, "Tambahkan minimal satu barang");
  // D1 membatasi 100 parameter per query; daftar SKU di perProduk() memakai satu parameter per SKU.
  if (item.length > 90) throw new Gagal(400, "Satu faktur maksimal 90 baris barang. Pecah jadi dua faktur");
  const total = item.reduce((a, i) => a + i.qty * i.harga, 0);

  const statusBayar = wajibTeks(b, "status_bayar", "Status bayar");
  if (statusBayar !== "lunas" && statusBayar !== "nanti") throw new Gagal(400, "Status bayar tidak dikenal");
  const cara = teks(b, "cara", "Cara bayar", { max: 20, wajib: false }) ?? "Transfer";
  if (!CARA_BAYAR.includes(cara)) throw new Gagal(400, "Cara bayar tidak dikenal");
  const jatuhTempo = statusBayar === "nanti" ? tanggal(b, "jatuh_tempo", "Jatuh tempo")! : null;
  if (jatuhTempo && jatuhTempo < tgl) throw new Gagal(400, "Jatuh tempo tidak boleh sebelum tanggal faktur");
  const uangMuka = statusBayar === "nanti" ? (bulat(b, "uang_muka", "Uang muka", { wajib: false }) ?? 0) : 0;
  if (uangMuka >= total && total > 0) throw new Gagal(400, "Uang muka harus lebih kecil dari total. Pilih Lunas kalau dibayar penuh");
  const catatan = teks(b, "catatan", "Catatan", { max: 500, wajib: false });

  const grup = await perProduk(env.DB, item);
  const t = sekarang();
  const id = ulid();

  for (let coba = 0; coba < 3; coba++) {
    const no = await noFakturBerikut(env.DB, hariIniWib());
    const tulis = [
      env.DB.prepare(
        `INSERT INTO faktur (id, no, tanggal, pemasok_id, total, jatuh_tempo, catatan, dibuat_pada, diubah_pada, dibuat_oleh)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, no, tgl, pemasokId, total, jatuhTempo, catatan, t, t, staff.id),
      ...item.map((i, n) => env.DB.prepare("INSERT INTO faktur_item (id, faktur_id, sku, qty, harga, urutan) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(ulid(), id, i.sku, i.qty, i.harga, n)),
      // HPP dihitung sebelum stok bertambah, dari stok lama.
      ...grup.flatMap((g) => {
        const baru = hppSetelahBeli(g.stok, g.hpp, g.qty, g.nilai);
        return [
          env.DB.prepare("UPDATE produk SET hpp = ?, diubah_pada = ? WHERE id = ?").bind(baru, t, g.produk_id),
          env.DB.prepare("INSERT INTO hpp_riwayat (id, produk_id, lama, baru, sebab, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'faktur', 'faktur', ?, ?, ?)")
            .bind(ulid(), g.produk_id, g.hpp, baru, id, t, staff.id),
        ];
      }),
      ...item.flatMap((i) => [
        env.DB.prepare(
          `INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, ?, ?, 0, ?)
           ON CONFLICT (sku, lokasi_id) DO UPDATE SET qty = qty + excluded.qty, diubah_pada = excluded.diubah_pada`,
        ).bind(i.sku, GUDANG, i.qty, t),
        env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'faktur', 'faktur', ?, ?, ?)")
          .bind(ulid(), i.sku, GUDANG, i.qty, id, t, staff.id),
      ]),
    ];
    const bayar = statusBayar === "lunas" ? total : uangMuka;
    if (bayar > 0) {
      tulis.push(env.DB.prepare("INSERT INTO faktur_bayar (id, faktur_id, tanggal, jumlah, cara, catatan, dibuat_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(ulid(), id, tgl, bayar, cara, statusBayar === "lunas" ? "Lunas saat faktur dicatat" : "Uang muka", t, staff.id));
    }
    tulis.push(logAktivitas(env.DB, staff, "Catat faktur", { tabel: "faktur", id, keterangan: `${no} Rp${total}` }));
    try {
      await env.DB.batch(tulis);
      return json({ id, no, total }, 201);
    } catch (e) {
      // Nomor faktur bentrok dengan faktur lain yang disimpan bersamaan: ambil nomor berikutnya.
      if (!String((e as Error).message).includes("UNIQUE") || !String((e as Error).message).includes("faktur.no")) throw e;
    }
  }
  throw new Gagal(409, "Nomor faktur bentrok. Coba simpan lagi");
}

export async function bayarFaktur(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const f = await env.DB.prepare(`${SELECT_FAKTUR} WHERE f.id = ?`).bind(id).first<BarisFaktur>();
  if (!f) throw new Gagal(404, "Faktur tidak ditemukan");
  if (f.batal) throw new Gagal(400, "Faktur sudah dibatalkan");
  const sisa = f.total - f.dibayar;
  if (sisa <= 0) throw new Gagal(400, "Faktur sudah lunas");
  const jumlah = wajibBulat(b, "jumlah", "Jumlah", { min: 1 });
  if (jumlah > sisa) throw new Gagal(400, `Maksimal Rp${sisa.toLocaleString("id-ID")} (sisa tagihan)`);
  const tgl = tanggal(b, "tanggal", "Tanggal bayar")!;
  const cara = teks(b, "cara", "Cara bayar", { max: 20, wajib: false }) ?? "Transfer";
  if (!CARA_BAYAR.includes(cara)) throw new Gagal(400, "Cara bayar tidak dikenal");
  const catatan = teks(b, "catatan", "Catatan", { max: 300, wajib: false });
  try {
    await env.DB.batch([
      penjaga(env.DB, "(SELECT total - (SELECT COALESCE(SUM(jumlah), 0) FROM faktur_bayar WHERE faktur_id = ?) FROM faktur WHERE id = ? AND batal = 0) >= ?", id, id, jumlah),
      env.DB.prepare("INSERT INTO faktur_bayar (id, faktur_id, tanggal, jumlah, cara, catatan, dibuat_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(ulid(), id, tgl, jumlah, cara, catatan, sekarang(), staff.id),
      env.DB.prepare("UPDATE faktur SET diubah_pada = ? WHERE id = ?").bind(sekarang(), id),
      logAktivitas(env.DB, staff, "Bayar faktur", { tabel: "faktur", id, keterangan: `${f.no} Rp${jumlah}` }),
    ]);
  } catch (e) {
    if (kenaPenjaga(e)) throw new Gagal(409, "Sisa tagihan baru saja berubah. Muat ulang lalu coba lagi");
    throw e;
  }
  return json({ ok: true, sisa: sisa - jumlah });
}

// Batal faktur: hanya kalau semua barangnya masih ada di Gudang Pusat (belum dikirim, dijual, atau terbuang).
export async function batalFaktur(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const alasan = wajibTeks(b, "alasan", "Alasan", { min: 5, max: 300 });
  const f = await env.DB.prepare(`${SELECT_FAKTUR} WHERE f.id = ?`).bind(id).first<BarisFaktur>();
  if (!f) throw new Gagal(404, "Faktur tidak ditemukan");
  if (f.batal) throw new Gagal(400, "Faktur sudah dibatalkan");

  const { results: item } = await env.DB.prepare("SELECT sku, qty, harga FROM faktur_item WHERE faktur_id = ?").bind(id).all<ItemFaktur>();
  const perSku = new Map<string, number>();
  for (const i of item) perSku.set(i.sku, (perSku.get(i.sku) ?? 0) + i.qty);
  const skus = [...perSku.keys()];
  const { results: ada } = await env.DB
    .prepare(
      `SELECT v.sku, TRIM(p.nama || ' ' || v.nama) AS nama, COALESCE(s.qty, 0) AS qty FROM varian v JOIN produk p ON p.id = v.produk_id
       LEFT JOIN stok s ON s.sku = v.sku AND s.lokasi_id = ? WHERE v.sku IN (${skus.map(() => "?").join(",")})`,
    )
    .bind(GUDANG, ...skus)
    .all<{ sku: string; nama: string; qty: number }>();
  const kurang = ada.filter((s) => s.qty < (perSku.get(s.sku) ?? 0)).map((s) => ({ sku: s.sku, nama: s.nama, ada: s.qty, butuh: perSku.get(s.sku)! }));
  if (kurang.length) {
    return json({ error: `Barang faktur ini sudah terpakai: ${kurang.map((k) => `${k.nama} (ada ${k.ada}, butuh ${k.butuh})`).join(", ")}`, kurang }, 400);
  }

  // HPP dihitung mundur. Stok total di sini masih termasuk barang faktur ini.
  const grup = await perProduk(env.DB, item);
  const sebelum = await env.DB
    .prepare("SELECT produk_id, lama FROM hpp_riwayat WHERE ref_tabel = 'faktur' AND ref_id = ? AND sebab = 'faktur'")
    .bind(id).all<{ produk_id: string; lama: number }>();
  const t = sekarang();
  const tulis = [
    ...skus.map((sku) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = ?), 0) >= ?", sku, GUDANG, perSku.get(sku))),
    env.DB.prepare("UPDATE faktur SET batal = 1, batal_alasan = ?, batal_oleh = ?, batal_pada = ?, diubah_pada = ? WHERE id = ? AND batal = 0")
      .bind(alasan, staff.id, t, t, id),
    ...grup.flatMap((g) => {
      const awal = sebelum.results.find((s) => s.produk_id === g.produk_id)?.lama ?? g.hpp;
      const baru = hppSetelahBatal(g.stok, g.hpp, g.qty, g.nilai, awal);
      return [
        env.DB.prepare("UPDATE produk SET hpp = ?, diubah_pada = ? WHERE id = ?").bind(baru, t, g.produk_id),
        env.DB.prepare("INSERT INTO hpp_riwayat (id, produk_id, lama, baru, sebab, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'batal_faktur', 'faktur', ?, ?, ?)")
          .bind(ulid(), g.produk_id, g.hpp, baru, id, t, staff.id),
      ];
    }),
    ...skus.flatMap((sku) => [
      env.DB.prepare("UPDATE stok SET qty = qty - ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = ?").bind(perSku.get(sku), t, sku, GUDANG),
      env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'batal_faktur', 'faktur', ?, ?, ?)")
        .bind(ulid(), sku, GUDANG, -perSku.get(sku)!, id, t, staff.id),
    ]),
    logAktivitas(env.DB, staff, "Batal faktur", { tabel: "faktur", id, keterangan: `${f.no}: ${alasan}` }),
  ];
  try {
    await env.DB.batch(tulis);
  } catch (e) {
    if (kenaPenjaga(e)) throw new Gagal(409, "Stok gudang baru saja berubah. Muat ulang lalu coba lagi");
    throw e;
  }
  // Uang yang sudah dibayar perlu diminta kembali ke pemasok.
  return json({ ok: true, minta_kembali: f.dibayar });
}

// ---------- Stok ----------

export async function daftarStok(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const [lokasi, baris, stok] = await Promise.all([
    env.DB.prepare("SELECT id, jenis, nama FROM lokasi WHERE aktif = 1 ORDER BY CASE jenis WHEN 'gudang' THEN 0 ELSE 1 END, nama").all<{ id: string }>(),
    env.DB.prepare(
      `SELECT v.sku, v.nama AS varian, v.aktif AS varian_aktif, p.id AS produk_id, p.nama AS produk, p.stok_min, p.hpp, p.aktif, k.nama AS kategori, k.id AS kategori_id
       FROM varian v JOIN produk p ON p.id = v.produk_id LEFT JOIN kategori k ON k.id = p.kategori_id
       ORDER BY k.urutan, p.nama, v.urutan`,
    ).all<{ sku: string; stok_min: number; hpp: number }>(),
    env.DB.prepare("SELECT sku, lokasi_id, qty, transit FROM stok").all<{ sku: string; lokasi_id: string; qty: number; transit: number }>(),
  ]);
  const per = new Map<string, { lokasi: Record<string, number>; transit: number }>();
  for (const s of stok.results) {
    const x = per.get(s.sku) ?? { lokasi: {}, transit: 0 };
    x.lokasi[s.lokasi_id] = s.qty;
    x.transit += s.transit;
    per.set(s.sku, x);
  }
  return json({
    lokasi: lokasi.results,
    stok: baris.results.map((b) => {
      const x = per.get(b.sku) ?? { lokasi: {}, transit: 0 };
      const total = Object.values(x.lokasi).reduce((a, q) => a + q, 0) + x.transit;
      return {
        ...b,
        per_lokasi: x.lokasi,
        transit: x.transit,
        total,
        nilai: total * b.hpp,
        status: total <= 0 ? "Habis" : total < b.stok_min ? "Di bawah minimum" : "Aman",
      };
    }),
  });
}

// Pergerakan stok dalam rentang tanggal (WIB), dikelompokkan per jenis seperti tab Pergerakan di prototipe.
export async function gerakStok(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams);
  const dari = tanggal(q, "dari", "Dari tanggal", false) ?? hariIniWib().slice(0, 8) + "01";
  const sampai = tanggal(q, "sampai", "Sampai tanggal", false) ?? hariIniWib();
  // Batas hari WIB dalam UTC: 00.00 WIB = 17.00 UTC hari sebelumnya.
  const mulai = new Date(Date.parse(dari) - 7 * 3600_000).toISOString();
  const akhir = new Date(Date.parse(sampai) + 17 * 3600_000).toISOString();
  const sku = q.sku ? String(q.sku) : null;

  const { results: ringkas } = await env.DB
    .prepare(
      `SELECT g.sku, TRIM(p.nama || ' ' || v.nama) AS nama,
        SUM(CASE WHEN g.jenis IN ('awal', 'faktur', 'batal_faktur') THEN g.jumlah ELSE 0 END) AS masuk,
        SUM(CASE WHEN g.jenis = 'kirim_keluar' THEN -g.jumlah ELSE 0 END) AS dikirim,
        SUM(CASE WHEN g.jenis IN ('jual', 'void', 'presale_serah') THEN -g.jumlah ELSE 0 END) AS terjual,
        SUM(CASE WHEN g.jenis IN ('rusak', 'terbuang', 'opname') THEN -g.jumlah ELSE 0 END) AS hilang_rusak
       FROM stok_gerak g JOIN varian v ON v.sku = g.sku JOIN produk p ON p.id = v.produk_id
       WHERE g.waktu >= ? AND g.waktu < ? GROUP BY g.sku ORDER BY p.nama, v.urutan`,
    )
    .bind(mulai, akhir)
    .all();
  const rincian = sku
    ? (await env.DB
        .prepare(
          `SELECT g.waktu, g.jumlah, g.jenis, l.nama AS lokasi, a.nama AS oleh, f.no AS faktur FROM stok_gerak g
           JOIN lokasi l ON l.id = g.lokasi_id LEFT JOIN staff a ON a.id = g.oleh
           LEFT JOIN faktur f ON g.ref_tabel = 'faktur' AND f.id = g.ref_id
           WHERE g.sku = ? AND g.waktu >= ? AND g.waktu < ? ORDER BY g.waktu DESC LIMIT 500`,
        )
        .bind(sku, mulai, akhir)
        .all()).results
    : null;
  return json({ dari, sampai, ringkas, rincian });
}
