import * as akun from "./akun.js";
import * as biaya from "./biaya.js";
import * as keuangan from "./keuangan.js";
import * as laporan from "./laporan.js";
import * as event from "./event.js";
import * as lengkap from "./kasir-lengkap.js";
import * as presale from "./presale.js";
import * as promosi from "./promosi.js";
import * as online from "./online.js";
import * as opname from "./opname.js";
import * as pelanggan from "./pelanggan.js";
import * as inventori from "./inventori.js";
import * as katalog from "./katalog.js";
import { ETAG, HALAMAN } from "./halaman.js";
import * as karyawan from "./karyawan.js";
import * as kasir from "./kasir.js";
import * as pengaturan from "./pengaturan.js";
import * as penjualan from "./penjualan.js";
import * as perangkat from "./perangkat.js";
import * as pos from "./pos.js";
import * as posLanjut from "./pos-lanjut.js";
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
  ["GET", "/api/karyawan/bertugas", karyawan.bertugasHariIni],
  ["GET", "/api/staf", karyawan.daftarRingkas],

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

  ["GET", "/api/harga-saluran/:id", katalog.ambilHargaSaluran],
  ["PUT", "/api/harga-saluran/:id", katalog.simpanHargaSaluran],
  ["GET", "/api/pengaturan/pos", pengaturan.ambilPengaturanPos],
  ["PUT", "/api/pengaturan/pos", pengaturan.simpanPengaturanPos],
  ["POST", "/api/berkas", pengaturan.unggahBerkas],
  ["GET", "/api/berkas/:id", pengaturan.ambilBerkas],
  ["GET", "/api/transaksi", penjualan.daftarTransaksi],
  ["GET", "/api/transaksi/:id", penjualan.detailTransaksi],
  ["GET", "/api/shift", penjualan.daftarShift],
  ["GET", "/api/shift/:id", penjualan.detailShift],
  ["GET", "/api/event", event.daftarEvent],
  ["POST", "/api/event", event.tambahEvent],
  ["GET", "/api/event/:id", event.detailEvent],
  ["PATCH", "/api/event/:id", event.ubahEvent],
  ["POST", "/api/event/:id/kirim", event.kirimStok],
  ["POST", "/api/event/:id/tarik", event.tarikStok],
  ["GET", "/api/event/:id/tutup", event.siapTutup],
  ["POST", "/api/event/:id/tutup", event.tutupEvent],
  ["POST", "/api/mutasi/:id/batal", event.batalKiriman],
  ["GET", "/api/opname", opname.daftarOpname],
  ["POST", "/api/opname/gudang", opname.opnameGudang],
  ["GET", "/api/opname/:id", opname.detailOpname],
  ["POST", "/api/opname/:id/setujui", opname.setujuiOpname],
  ["POST", "/api/opname/:id/ulang", opname.ulangOpname],
  ["GET", "/api/kerugian", opname.daftarKerugian],
  ["POST", "/api/kerugian/:id/selesaikan", opname.selesaikanKerugian],
  ["GET", "/api/promo", promosi.daftarPromo],
  ["POST", "/api/promo", promosi.tambahPromo],
  ["GET", "/api/promo/:id", promosi.detailPromo],
  ["PATCH", "/api/promo/:id", promosi.ubahPromo],
  ["GET", "/api/presale", presale.daftarPresale],
  ["POST", "/api/presale/:id/refund", presale.refundPresale],
  ["GET", "/api/terbuang", presale.daftarTerbuang],
  ["POST", "/api/terbuang", presale.catatTerbuang],
  ["GET", "/api/saluran", online.daftarSaluran],
  ["PATCH", "/api/saluran/:id", online.ubahSaluran],
  ["GET", "/api/saluran/:id/katalog", online.katalogSaluran],
  ["GET", "/api/produk/:id/saluran", online.hargaMarketplaceProduk],
  ["PATCH", "/api/produk/:id/tampil", katalog.ubahTampilPos],
  ["PUT", "/api/produk/:id/saluran", online.simpanHargaMarketplace],
  ["GET", "/api/online", online.daftarPesanan],
  ["POST", "/api/online", online.tambahPesanan],
  ["GET", "/api/online/impor", online.riwayatImpor],
  ["POST", "/api/online/impor", online.imporPesanan],
  ["POST", "/api/online/impor/cek", online.cekImpor],
  ["GET", "/api/online/:id", online.detailPesanan],
  ["POST", "/api/online/:id/status", online.ubahStatusPesanan],
  ["GET", "/api/pelanggan", pelanggan.daftarPelanggan],
  ["POST", "/api/pelanggan", pelanggan.tambahPelanggan],
  ["GET", "/api/pelanggan/:id", pelanggan.detailPelanggan],
  ["PATCH", "/api/pelanggan/:id", pelanggan.ubahPelanggan],
  ["GET", "/api/biaya", biaya.daftarBiaya],
  ["GET", "/api/biaya/kategori", biaya.kategoriBiaya],
  ["POST", "/api/biaya", biaya.tambahBiaya],
  ["PATCH", "/api/biaya/:id", biaya.ubahBiaya],
  ["DELETE", "/api/biaya/:id", biaya.hapusBiaya],
  ["GET", "/api/ringkasan", laporan.ringkasan],
  ["GET", "/api/laporan/saluran", laporan.laporanSaluran],
  ["GET", "/api/laporan/event", laporan.laporanEvent],
  ["GET", "/api/laporan/kasir", laporan.laporanKasir],
  ["GET", "/api/laporan/produk", laporan.laporanProduk],
  ["GET", "/api/laporan/harian", laporan.laporanHarian],
  ["POST", "/api/laporan/rekap", laporan.hitungUlangRekap],
  ["GET", "/api/keuangan", keuangan.keuanganKeseluruhan],
  ["GET", "/api/keuangan/event/:id", keuangan.keuanganEvent],
  ["PUT", "/api/pengaturan/keuangan", keuangan.simpanPengaturanKeuangan],
  ["GET", "/api/dokumen-ditolak", penjualan.daftarDitolak],
  ["POST", "/api/dokumen-ditolak/:id/selesai", penjualan.selesaiDitolak],

  ["POST", "/api/pos/daftar", perangkat.sambungkan],
  ["GET", "/api/pos/tarik", kasir.tarik],
  ["POST", "/api/pos/sinkron", kasir.sinkron],
  ["POST", "/api/pos/setujui", kasir.setujui],
  ["GET", "/api/pos/shift/:id", kasir.shiftPos],
  ["GET", "/api/pos/penjualan", kasir.penjualanPos],
  ["GET", "/api/pos/inventori", kasir.inventoriPos],
  ["GET", "/api/pos/pelanggan", lengkap.cariPelangganPos],
  ["GET", "/api/pos/pesanan", lengkap.pesananPos],
  ["GET", "/api/pos/trx/:id", lengkap.cariTrxPos],
  ["GET", "/api/pos/laporan", posLanjut.laporanPos],
  ["GET", "/api/pos/riwayat", posLanjut.riwayatPos],
  ["GET", "/api/pos/opname/:id", posLanjut.detailOpnamePos],
  ["POST", "/api/pos/opname/:id/setujui", posLanjut.setujuiOpnamePos],
  ["POST", "/api/pos/opname/:id/ulang", posLanjut.ulangOpnamePos],
  ["POST", "/api/pos/mutasi/:id/batal-terima", posLanjut.batalTerimaPos],
  ["GET", "/api/pos/event/:id/tutup", posLanjut.siapTutupPos],
  ["POST", "/api/pos/event/:id/tutup", posLanjut.tutupEventPos],
  ["GET", "/api/pos/berkas/:id", pengaturan.ambilBerkasPos],
  ["POST", "/api/pos/berkas", pengaturan.unggahBerkasPos],
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
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (!path.startsWith("/api/")) {
      const html = HALAMAN[path];
      const jenis = path.endsWith(".js") ? "text/javascript; charset=utf-8"
        : path.endsWith(".webmanifest") ? "application/manifest+json"
        : path.endsWith(".svg") ? "image/svg+xml" : "text/html; charset=utf-8";
      if (req.method === "GET" && html) {
        const tag = ETAG[path];
        if (tag && req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers: { ...HEADER_HALAMAN, etag: tag } });
        return new Response(html, { headers: { ...HEADER_HALAMAN, "content-type": jenis, ...(tag ? { etag: tag } : {}) } });
      }
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

  // Cron 00:10 WIB: hitung ulang rekap harian 7 hari terakhir.
  async scheduled(_c: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(laporan.cronRekap(env));
  },
};
