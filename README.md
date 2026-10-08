# Hikayat Merchandise: POS dan Dashboard

Sistem kasir (POS di HP) dan dashboard untuk penjualan merchandise Hikayat di event, Gudang Pusat, dan marketplace.

Status:
- **Prototipe** (`prototipe/`): data tersimpan di browser (`localStorage`), jadi HP kasir dan dashboard belum saling terhubung. Demo: https://hikayat-pos-demo.pages.dev/dashboard dan https://hikayat-pos-demo.pages.dev/pos
- **Versi produksi** (`worker/api/`): tahap 1 dan 2 dari `docs/Arsitektur-Cloudflare.md` sudah jalan di https://hikayat-api.media2mimbar.workers.dev (login dashboard, karyawan, pendaftaran HP, masuk POS dengan PIN, produk dan varian, kategori, pemasok, faktur pembelian ke Gudang Pusat, HPP rata-rata tertimbang, daftar stok).

## Isi

| Folder | Isi |
|---|---|
| `docs/PRD-Hikayat-Merchandise.md` | Kebutuhan produk, alur, aturan bisnis, model data, dan keputusan yang sudah diambil |
| `docs/Arsitektur-Cloudflare.md` | Rancangan versi produksi di Cloudflare paket gratis (Pages, Workers, D1) |
| `prototipe/out/` | Hasil build siap buka: `dashboard.html` (laptop) dan `pos.html` (HP) |
| `prototipe/src/` | Kode tambahan prototipe: `shared.js` (data dan aturan bersama), `addon.js`, `inventori.js`, `keuangan.js` (dashboard), `pos-bridge.js` (POS) |
| `prototipe/dashboard.html`, `prototipe/kasir-asli.html` | Kerangka tampilan awal yang ditempeli kode di `src/` saat build |
| `prototipe/vendor/` | qrcode-generator 2.0.4 (MIT) dan jsQR 1.4.0 (Apache-2.0) |
| `prototipe/tests/` | Uji Playwright per fitur |
| `worker/api/` | Versi produksi: Worker (API + halaman), migrasi D1, uji |
| `scripts/deploy-pages.py` | Deploy folder statis ke Cloudflare Pages lewat API (dipakai untuk demo prototipe) |

## Mencoba prototipe

Buka `prototipe/out/dashboard.html` di laptop dan `prototipe/out/pos.html` di HP atau mode HP di browser. Akun contoh ada di bagian 9 PRD. Contoh: Owner `rina@hikayat.id` / `hikayat123`, PIN POS 111111.

## Build ulang

```
cd prototipe
python3 build.py          # menulis out/dashboard.html dan out/pos.html
```

## Menjalankan uji

Butuh Node.js dan Playwright dengan Chromium.

```
cd prototipe
mkdir -p shots
node tests/test-keu.js    # satu uji
for f in tests/test-*.js; do node "$f"; done
```

`tests/test-pos.js` dan `tests/test-dash.js` adalah uji lama yang sudah diketahui gagal (alur lama dan font dari internet).

## Versi produksi (worker/api)

Tanpa dependensi npm. Butuh Node.js 22 (untuk `node:sqlite` di uji) dan TypeScript (`tsc`).

```
cd worker/api
npm test                           # build + uji API dengan database tiruan
node tests/browser-fondasi.mjs     # uji tampilan tahap 1 di Chromium (butuh Playwright)
node tests/browser-katalog.mjs     # uji tampilan tahap 2 di Chromium
node tests/server-lokal.mjs        # jalan di http://localhost:8787, kode setup SETUP-LOKAL
python3 deploy.py                  # deploy ke Cloudflare (butuh CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN)
```

Deploy ulang demo prototipe:

```
mkdir -p /tmp/demo && cp prototipe/out/*.html /tmp/demo/
python3 scripts/deploy-pages.py hikayat-pos-demo /tmp/demo
```
