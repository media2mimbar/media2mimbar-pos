# Hikayat Merchandise: catatan untuk Claude Code

POS di HP, dashboard, dan web store 2 Mimbar Merchandise di atas Cloudflare Workers dan D1. Versi produksi ada di `worker/api/` dan berjalan di https://hikayat-api.media2mimbar.workers.dev.

## Baca dulu

| File | Kapan dibaca |
| --- | --- |
| `docs/PRD-Web-Store.md` | Semua pekerjaan web store. Bagian Urutan pembangunan menentukan tahap berikutnya |
| `docs/gambar/web-store/*.webp` | Acuan tampilan web store. Kalau gambar dan PRD berbeda, PRD yang berlaku |
| `docs/PRD-Hikayat-Merchandise.md` | Aturan POS dan dashboard yang sudah ada |
| `docs/Arsitektur-Cloudflare.md` | Aturan D1, login, offline, keamanan, dan catatan tahap 1 sampai 8 |

Tahap 1 sampai 8 sudah dibangun. Web store dimulai dari tahap 9 di `docs/PRD-Web-Store.md`.

## Perintah

```
cd worker/api
npm test                         # build + uji API dengan database tiruan (Node 22, node:sqlite)
node tests/server-lokal.mjs      # server lokal di http://localhost:8787, kode setup SETUP-LOKAL
node tests/browser-*.mjs         # uji tampilan per tahap, butuh Playwright dan Chromium
python3 deploy.py                # deploy, butuh CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN
```

Jangan deploy tanpa diminta.

## Aturan kode

- Tanpa dependensi npm. Router kecil di `src/index.ts`, validasi di `src/util.ts`, SQL biasa dengan `.bind()`.
- Migrasi baru di `worker/api/migrations/` dengan nomor berikutnya, dicatat di tabel `_migrasi`. Migrasi yang sudah jalan tidak diubah.
- Rupiah disimpan sebagai bilangan bulat, waktu dalam ISO UTC, ID berupa ULID, persen dalam basis poin.
- Setiap perubahan stok ditulis ke `stok_gerak`. Pemeriksaan stok, kuota, dan saldo dijalankan di dalam `db.batch` yang sama dengan penulisannya.
- Aturan yang dipakai server dan HP ada di `src/aturan.ts` dan `src/promo.ts`, supaya hasilnya selalu sama.
- Hak akses selalu dicek di server. API pembeli web store dipisah dari API karyawan.
- Halaman ada di `ui/` dan dilayani Worker yang sama.
- Foto yang dibuka publik (produk, lalu banner dan penilaian) disimpan di R2 lewat `src/foto.ts`. Bukti biaya, bukti refund, QRIS, dan dokumen sensitif lain tetap di tabel `berkas` D1.
- Setiap fitur baru mendapat uji di `tests/uji-*.mjs`, dan uji tampilan kalau ada layar baru.

## Gaya tulisan

Teks di layar dan dokumen memakai bahasa Indonesia yang lugas dan aktif dengan sapaan "Anda". Judul memakai huruf kapital hanya di awal. Hindari tanda pisah panjang, dan pakai tanda kurung serta titik dua seperlunya.
