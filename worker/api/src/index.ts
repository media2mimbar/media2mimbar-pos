import * as akun from "./akun.js";
import * as inventori from "./inventori.js";
import * as katalog from "./katalog.js";
import { HALAMAN } from "./halaman.js";
import * as karyawan from "./karyawan.js";
import * as perangkat from "./perangkat.js";
import * as pos from "./pos.js";
import { Gagal, json } from "./util.js";

type Handler = (req: Request, env: Env, id: string) => Promise<Response>;

const RUTE: [string, string, Handler][] = [
  ["GET", "/api/setup", akun.statusSetup],
  ["POST", "/api/setup", akun.setup],
  ["POST", "/api/masuk", akun.masuk],
  ["POST", "/api/keluar", akun.keluar],
  ["GET", "/api/saya", akun.saya],
  ["POST", "/api/ganti-password", akun.gantiPassword],

  ["GET", "/api/karyawan", karyawan.daftar],
  ["POST", "/api/karyawan", karyawan.tambah],
  ["PATCH", "/api/karyawan/:id", karyawan.ubah],
  ["POST", "/api/karyawan/:id/reset-password", karyawan.resetPassword],
  ["POST", "/api/karyawan/:id/reset-pin", karyawan.resetPin],
  ["GET", "/api/riwayat-masuk", karyawan.riwayatMasuk],

  ["GET", "/api/perangkat", perangkat.daftar],
  ["POST", "/api/perangkat", perangkat.tambah],
  ["POST", "/api/perangkat/:id/kode-baru", perangkat.kodeBaru],
  ["POST", "/api/perangkat/:id/nonaktifkan", perangkat.nonaktifkan],

  ["GET", "/api/kategori", katalog.daftarKategori],
  ["POST", "/api/kategori", katalog.tambahKategori],
  ["PATCH", "/api/kategori/:id", katalog.ubahKategori],
  ["DELETE", "/api/kategori/:id", katalog.hapusKategori],
  ["GET", "/api/produk", katalog.daftarProduk],
  ["POST", "/api/produk", katalog.tambahProduk],
  ["GET", "/api/produk/:id", katalog.detailProduk],
  ["PATCH", "/api/produk/:id", katalog.ubahProduk],

  ["GET", "/api/pemasok", inventori.daftarPemasok],
  ["POST", "/api/pemasok", inventori.tambahPemasok],
  ["PATCH", "/api/pemasok/:id", inventori.ubahPemasok],
  ["GET", "/api/faktur", inventori.daftarFaktur],
  ["POST", "/api/faktur", inventori.tambahFaktur],
  ["GET", "/api/faktur/:id", inventori.detailFaktur],
  ["POST", "/api/faktur/:id/bayar", inventori.bayarFaktur],
  ["POST", "/api/faktur/:id/batal", inventori.batalFaktur],
  ["GET", "/api/stok", inventori.daftarStok],
  ["GET", "/api/stok/gerak", inventori.gerakStok],

  ["POST", "/api/pos/daftar", perangkat.sambungkan],
  ["GET", "/api/pos/perangkat", pos.infoPerangkat],
  ["GET", "/api/pos/karyawan", pos.daftarKaryawan],
  ["POST", "/api/pos/masuk", pos.masuk],
  ["GET", "/api/pos/saya", pos.saya],
  ["POST", "/api/pos/ganti-pin", pos.gantiPin],
  ["POST", "/api/pos/keluar", pos.keluar],
];

function cocokkan(method: string, path: string): { h: Handler; id: string } | "salah_metode" | null {
  let adaPath = false;
  for (const [m, pola, h] of RUTE) {
    const a = pola.split("/"), b = path.split("/");
    if (a.length !== b.length) continue;
    let id = "";
    let cocok = true;
    for (let i = 0; i < a.length && cocok; i++) {
      if (a[i] === ":id") {
        id = decodeURIComponent(b[i]);
        cocok = id !== "";
      } else cocok = a[i] === b[i];
    }
    if (!cocok) continue;
    adaPath = true;
    if (m === method) return { h, id };
  }
  return adaPath ? "salah_metode" : null;
}

const HEADER_HALAMAN = {
  "cache-control": "no-cache",
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (!path.startsWith("/api/")) {
      const html = HALAMAN[path as keyof typeof HALAMAN];
      const jenis = path.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
      if (req.method === "GET" && html) return new Response(html, { headers: { ...HEADER_HALAMAN, "content-type": jenis } });
      return new Response("Tidak ditemukan", { status: 404 });
    }

    if (!env.PEPPER) return json({ error: "Server belum selesai disiapkan" }, 503);
    try {
      const r = cocokkan(req.method, path);
      if (r === null) return json({ error: "Alamat API tidak dikenal" }, 404);
      if (r === "salah_metode") return json({ error: "Metode tidak didukung" }, 405);
      return await r.h(req, env, r.id);
    } catch (e) {
      if (e instanceof Gagal) return json({ error: e.message, kode: e.kode }, e.status);
      console.error(e);
      return json({ error: "Terjadi kesalahan di server" }, 500);
    }
  },
};
