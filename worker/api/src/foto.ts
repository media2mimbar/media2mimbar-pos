// Foto publik di R2: foto produk (tahap 9), lalu banner dan foto penilaian di tahap berikutnya.
// Dashboard mengecilkan foto di browser menjadi dua ukuran, besar (1200 px) dan kecil (400 px), lalu mengunggah keduanya
// dalam satu permintaan. Worker memeriksa isi dan ukuran file, menyimpannya ke R2, lalu mencatatnya di tabel foto.
// Pembeli membuka foto lewat /foto/<jenis>/<id>/<ukuran>. Alamat ini tidak membaca D1, dan isinya tidak pernah berubah,
// jadi browser boleh menyimpannya setahun. Bukti biaya, bukti refund, dan QRIS tetap di tabel berkas D1.

import { mimeDariIsi } from "./pengaturan.js";
import { sesiSiap } from "./sesi.js";
import { Gagal, json, sekarang, ulid } from "./util.js";

export const UKURAN_FOTO = ["besar", "kecil"] as const;
export type UkuranFoto = (typeof UKURAN_FOTO)[number];
const MAKS_BYTE: Record<UkuranFoto, number> = { besar: 1_500_000, kecil: 300_000 };
const LABEL_MAKS: Record<UkuranFoto, string> = { besar: "1,5 MB", kecil: "300 KB" };
const MAKS_PERMINTAAN = 2_000_000;
const MIME_FOTO = ["image/jpeg", "image/webp"];
// Jenis yang boleh dibuka publik. Banner dan penilaian ditambahkan di tahapnya masing-masing.
const JENIS_PUBLIK = ["produk"];
const POLA_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CACHE_FOTO = "public, max-age=31536000, immutable";
// Foto yang belum dipakai produk tetap disimpan selama ini, supaya form yang masih terbuka bisa disimpan.
const UMUR_YATIM_MS = 24 * 3600_000;

export const kunciFoto = (jenis: string, id: string, ukuran: UkuranFoto) => `${jenis}/${id}/${ukuran}`;
export const alamatFoto = (jenis: string, id: string, ukuran: UkuranFoto) => `/foto/${jenis}/${id}/${ukuran}`;
export const fotoProduk = (id: string) => ({ id, besar: alamatFoto("produk", id, "besar"), kecil: alamatFoto("produk", id, "kecil") });
export const idFotoSah = (id: string) => POLA_ID.test(id);

// POST /api/foto?jenis=produk, form multipart berisi file "besar" dan "kecil".
export async function unggahFoto(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const jenis = new URL(req.url).searchParams.get("jenis") ?? "";
  if (!JENIS_PUBLIK.includes(jenis)) throw new Gagal(400, "Jenis foto tidak dikenal");
  const r2 = env.FOTO;
  if (!r2) throw new Gagal(503, "Penyimpanan foto belum disiapkan. Deploy ulang dengan bucket R2");
  if (Number(req.headers.get("content-length") ?? 0) > MAKS_PERMINTAAN) throw new Gagal(413, "Foto terlalu besar. Kecilkan dulu");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new Gagal(400, "Kirim foto sebagai form multipart");
  }
  const isi = {} as Record<UkuranFoto, Uint8Array>;
  let mime = "";
  for (const u of UKURAN_FOTO) {
    const f = form.get(u);
    if (!f || typeof f === "string") throw new Gagal(400, `Foto ukuran ${u} tidak ada`);
    const b = new Uint8Array(await f.arrayBuffer());
    if (b.byteLength === 0) throw new Gagal(400, "File foto kosong");
    if (b.byteLength > MAKS_BYTE[u]) throw new Gagal(413, `Foto ${u} maksimal ${LABEL_MAKS[u]}. Kecilkan dulu`);
    const m = mimeDariIsi(b);
    if (!m || !MIME_FOTO.includes(m)) throw new Gagal(415, "Foto harus berformat JPEG atau WebP");
    if (mime && m !== mime) throw new Gagal(400, "Kedua ukuran foto harus berformat sama");
    mime = m;
    isi[u] = b;
  }

  const id = ulid();
  const kunci = UKURAN_FOTO.map((u) => kunciFoto(jenis, id, u));
  // R2 dulu, baru D1. Kalau salah satu gagal, file yang sudah masuk dihapus lagi supaya tidak ada sisa.
  try {
    await Promise.all(UKURAN_FOTO.map((u, i) => r2.put(kunci[i], isi[u], { httpMetadata: { contentType: mime, cacheControl: CACHE_FOTO } })));
    await env.DB.prepare("INSERT INTO foto (id, jenis, mime, ukuran, dibuat_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, jenis, mime, isi.besar.byteLength + isi.kecil.byteLength, sekarang(), staff.id).run();
  } catch (e) {
    await r2.delete(kunci).catch(() => {});
    throw e;
  }
  return json({ id, besar: alamatFoto(jenis, id, "besar"), kecil: alamatFoto(jenis, id, "kecil") }, 201);
}

// GET /foto/<jenis>/<id>/<ukuran>. Publik, tanpa sesi dan tanpa D1.
export async function ambilFotoPublik(req: Request, env: Env, path: string): Promise<Response> {
  const bagian = path.split("/");
  const [, , jenis, id, ukuran] = bagian;
  if (bagian.length !== 5 || !JENIS_PUBLIK.includes(jenis) || !POLA_ID.test(id) || !UKURAN_FOTO.includes(ukuran as UkuranFoto) || !env.FOTO) {
    return fotoTidakAda();
  }
  const o = await env.FOTO.get(kunciFoto(jenis, id, ukuran as UkuranFoto));
  if (!o) return fotoTidakAda();
  const headers = {
    "content-type": o.httpMetadata?.contentType ?? "image/jpeg",
    "cache-control": CACHE_FOTO,
    etag: o.httpEtag,
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
  };
  if (req.headers.get("if-none-match") === o.httpEtag) {
    await o.body.cancel().catch(() => {});
    return new Response(null, { status: 304, headers });
  }
  return new Response(o.body, { headers });
}

const fotoTidakAda = () => new Response("Foto tidak ditemukan", { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" } });

// Cron harian: hapus foto produk yang tidak dipakai lebih dari 24 jam, misalnya dari form yang dibatalkan atau foto
// yang dilepas dari produk. Baris D1 dihapus lebih dulu, jadi foto yang sedang dipilih di form lain ditolak dengan
// pesan unggah ulang, bukan tampil rusak.
export async function bersihkanFotoYatim(env: Env, sekarangMs = Date.now()) {
  if (!env.FOTO) return 0;
  const batas = new Date(sekarangMs - UMUR_YATIM_MS).toISOString();
  const { results } = await env.DB.prepare(
    `DELETE FROM foto WHERE id IN (
       SELECT f.id FROM foto f WHERE f.jenis = 'produk' AND f.dibuat_pada < ?
         AND NOT EXISTS (SELECT 1 FROM produk_foto pf WHERE pf.foto_id = f.id)
         AND NOT EXISTS (SELECT 1 FROM varian v WHERE v.foto_id = f.id)
       LIMIT 200)
     RETURNING id, jenis`,
  ).bind(batas).all<{ id: string; jenis: string }>();
  if (results.length) await env.FOTO.delete(results.flatMap((f) => UKURAN_FOTO.map((u) => kunciFoto(f.jenis, f.id, u))));
  return results.length;
}
