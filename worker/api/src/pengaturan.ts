// Pengaturan POS (satu baris JSON di tabel pengaturan) dan berkas gambar yang disimpan di D1.

import { logAktivitas, perangkatDari, sesiDashboard, sesiSiap } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang, ulid } from "./util.js";

export interface PengaturanPos {
  metode: { tunai: boolean; qris: boolean; transfer: boolean };
  nominal_cepat: number[];
  qris: { nama: string; nmid: string; berkas_id: string | null };
  rekening: { bank: string; no: string; nama: string }[];
  pembulatan: 0 | 100 | 500 | 1000;
  pajak: { aktif: boolean; persen: number };
  diskon_kasir: { aktif: boolean; maks_persen: number };
  kunci_menit: 0 | 5 | 10 | 20 | 30;
  void_pin: boolean;
  tampil_stok: boolean;
  struk: { nama: string; info: string; footer: string; tampil_kasir: boolean; tampil_event: boolean };
}

// Nilai awal sama dengan prototipe (shared.js).
export const BAWAAN: PengaturanPos = {
  metode: { tunai: true, qris: true, transfer: true },
  nominal_cepat: [50000, 100000, 200000],
  qris: { nama: "HIKAYAT MERCHANDISE", nmid: "", berkas_id: null },
  rekening: [],
  pembulatan: 0,
  pajak: { aktif: false, persen: 11 },
  diskon_kasir: { aktif: true, maks_persen: 10 },
  kunci_menit: 20,
  void_pin: true,
  tampil_stok: true,
  struk: { nama: "Hikayat Merchandise", info: "", footer: "Terima kasih sudah mendukung Hikayat!", tampil_kasir: true, tampil_event: true },
};

export async function bacaPengaturan(db: D1Database): Promise<PengaturanPos & { diubah_pada: string | null }> {
  const r = await db.prepare("SELECT nilai, diubah_pada FROM pengaturan WHERE kunci = 'pos'").first<{ nilai: string; diubah_pada: string }>();
  const simpan = r ? (JSON.parse(r.nilai) as Partial<PengaturanPos>) : {};
  return { ...BAWAAN, ...simpan, struk: { ...BAWAAN.struk, ...(simpan.struk ?? {}) }, diubah_pada: r?.diubah_pada ?? null };
}

const bool = (v: unknown, label: string) => {
  if (typeof v !== "boolean") throw new Gagal(400, `${label} tidak valid`);
  return v;
};
const str = (v: unknown, label: string, max: number) => {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string" || v.length > max) throw new Gagal(400, `${label} tidak valid (maksimal ${max} karakter)`);
  return v.trim();
};
const int = (v: unknown, label: string, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new Gagal(400, `${label} harus angka ${min} sampai ${max}`);
  return v;
};

function periksa(b: Obj): PengaturanPos {
  const m = (b.metode ?? {}) as Obj, q = (b.qris ?? {}) as Obj, p = (b.pajak ?? {}) as Obj, d = (b.diskon_kasir ?? {}) as Obj, s = (b.struk ?? {}) as Obj;
  const metode = { tunai: bool(m.tunai, "Tunai"), qris: bool(m.qris, "QRIS"), transfer: bool(m.transfer, "Transfer") };
  if (!metode.tunai && !metode.qris && !metode.transfer) throw new Gagal(400, "Aktifkan minimal satu metode pembayaran");
  if (!Array.isArray(b.nominal_cepat) || b.nominal_cepat.length > 6) throw new Gagal(400, "Nominal cepat maksimal 6");
  if (!Array.isArray(b.rekening) || b.rekening.length > 10) throw new Gagal(400, "Rekening maksimal 10");
  const pembulatan = b.pembulatan as PengaturanPos["pembulatan"];
  if (![0, 100, 500, 1000].includes(pembulatan)) throw new Gagal(400, "Pembulatan tidak dikenal");
  const kunci = b.kunci_menit as PengaturanPos["kunci_menit"];
  if (![0, 5, 10, 20, 30].includes(kunci)) throw new Gagal(400, "Waktu kunci layar tidak dikenal");
  const rekening = (b.rekening as Obj[]).map((r, i) => ({
    bank: str(r?.bank, `Bank rekening ${i + 1}`, 30),
    no: str(r?.no, `Nomor rekening ${i + 1}`, 40),
    nama: str(r?.nama, `Atas nama rekening ${i + 1}`, 80),
  }));
  if (rekening.some((r) => !r.bank || !r.no || !r.nama)) throw new Gagal(400, "Lengkapi bank, nomor, dan atas nama setiap rekening");
  if (metode.transfer && !rekening.length) throw new Gagal(400, "Transfer aktif butuh minimal satu rekening");
  return {
    metode,
    nominal_cepat: (b.nominal_cepat as unknown[]).map((n, i) => int(n, `Nominal cepat ${i + 1}`, 1000, 10_000_000)),
    qris: { nama: str(q.nama, "Nama merchant QRIS", 60), nmid: str(q.nmid, "NMID", 40), berkas_id: q.berkas_id ? str(q.berkas_id, "Gambar QRIS", 40) : null },
    rekening,
    pembulatan,
    pajak: { aktif: bool(p.aktif, "PPN"), persen: int(p.persen, "Tarif PPN", 0, 100) },
    diskon_kasir: { aktif: bool(d.aktif, "Diskon manual kasir"), maks_persen: int(d.maks_persen, "Batas diskon kasir", 0, 100) },
    kunci_menit: kunci,
    void_pin: bool(b.void_pin, "Void perlu PIN atasan"),
    tampil_stok: bool(b.tampil_stok, "Tampilkan sisa stok"),
    struk: {
      nama: str(s.nama, "Nama di struk", 60) || BAWAAN.struk.nama,
      info: str(s.info, "Baris info struk", 120),
      footer: str(s.footer, "Pesan penutup struk", 200),
      tampil_kasir: bool(s.tampil_kasir, "Tampilkan kasir"),
      tampil_event: bool(s.tampil_event, "Tampilkan event"),
    },
  };
}

export async function ambilPengaturanPos(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  return json({ pengaturan: await bacaPengaturan(env.DB) });
}

export async function simpanPengaturanPos(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const p = periksa(await bacaJson(req));
  if (p.qris.berkas_id && !(await env.DB.prepare("SELECT 1 FROM berkas WHERE id = ? AND jenis = 'qris'").bind(p.qris.berkas_id).first())) {
    throw new Gagal(400, "Gambar QRIS tidak ditemukan. Unggah ulang");
  }
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare("UPDATE pengaturan SET nilai = ?, diubah_pada = ?, diubah_oleh = ? WHERE kunci = 'pos'").bind(JSON.stringify(p), t, staff.id),
    logAktivitas(env.DB, staff, "Ubah pengaturan POS", { tabel: "pengaturan", id: "pos" }),
  ]);
  return json({ ok: true, pengaturan: { ...p, diubah_pada: t } });
}

// ---------- Berkas (foto) di D1 ----------

const JENIS_BERKAS = ["qris", "bukti_biaya", "bukti_refund", "retur", "terbuang"];
const MIME = ["image/jpeg", "image/png", "image/webp"];
const MAKS_BYTE = 1024 * 1024;

// Cek isi file, bukan hanya header Content-Type.
function mimeDariIsi(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export async function simpanBerkas(db: D1Database, isi: Uint8Array, jenis: string, oleh: string | null) {
  if (!JENIS_BERKAS.includes(jenis)) throw new Gagal(400, "Jenis berkas tidak dikenal");
  if (isi.byteLength === 0) throw new Gagal(400, "File kosong");
  if (isi.byteLength > MAKS_BYTE) throw new Gagal(413, "Foto maksimal 1 MB. Kecilkan dulu");
  const mime = mimeDariIsi(isi);
  if (!mime || !MIME.includes(mime)) throw new Gagal(415, "Hanya JPEG, PNG, atau WebP");
  const id = ulid();
  await db.prepare("INSERT INTO berkas (id, jenis, mime, ukuran, isi, dibuat_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, jenis, mime, isi.byteLength, isi, sekarang(), oleh).run();
  return { id, mime, ukuran: isi.byteLength };
}

export async function unggahBerkas(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const jenis = new URL(req.url).searchParams.get("jenis") ?? "";
  const panjang = Number(req.headers.get("content-length") ?? 0);
  if (panjang > MAKS_BYTE) throw new Gagal(413, "Foto maksimal 1 MB. Kecilkan dulu");
  const isi = new Uint8Array(await req.arrayBuffer());
  return json(await simpanBerkas(env.DB, isi, jenis, staff.id), 201);
}

function kirimBerkas(r: { mime: string; isi: ArrayBuffer | Uint8Array | number[] }) {
  // D1 mengembalikan BLOB sebagai array angka; SQLite lokal sebagai Uint8Array.
  const isi = new Uint8Array(r.isi instanceof ArrayBuffer ? r.isi : (r.isi as ArrayLike<number>));
  return new Response(isi, {
    headers: { "content-type": r.mime, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" },
  });
}

// Foto bukan publik: dashboard butuh sesi, HP butuh token perangkat.
export async function ambilBerkas(req: Request, env: Env, id: string) {
  await sesiDashboard(env.DB, req);
  const r = await env.DB.prepare("SELECT mime, isi FROM berkas WHERE id = ?").bind(id).first<{ mime: string; isi: ArrayBuffer }>();
  if (!r) throw new Gagal(404, "Berkas tidak ditemukan");
  return kirimBerkas(r);
}

export async function ambilBerkasPos(req: Request, env: Env, id: string) {
  await perangkatDari(env.DB, req);
  // HP hanya boleh mengambil gambar yang memang dipakai POS.
  const r = await env.DB.prepare("SELECT mime, isi FROM berkas WHERE id = ? AND jenis = 'qris'").bind(id).first<{ mime: string; isi: ArrayBuffer }>();
  if (!r) throw new Gagal(404, "Berkas tidak ditemukan");
  return kirimBerkas(r);
}
