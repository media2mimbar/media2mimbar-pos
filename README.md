# Hikayat Merchandise: POS dan Dashboard

Sistem kasir (POS di HP) dan dashboard untuk penjualan merchandise Hikayat di event, Gudang Pusat, dan marketplace.

Status: **prototipe**. Data masih tersimpan di browser (`localStorage`), jadi HP kasir dan dashboard belum saling terhubung. Versi produksi akan memakai Cloudflare (lihat `docs/Arsitektur-Cloudflare.md`).

## Isi

| Folder | Isi |
|---|---|
| `docs/PRD-Hikayat-Merchandise.md` | Kebutuhan produk, alur, aturan bisnis, model data, dan keputusan yang sudah diambil |
| `docs/Arsitektur-Cloudflare.md` | Rancangan versi produksi di Cloudflare paket gratis (Pages, Workers, D1, R2) |
| `prototipe/out/` | Hasil build siap buka: `dashboard.html` (laptop) dan `pos.html` (HP) |
| `prototipe/src/` | Kode tambahan prototipe: `shared.js` (data dan aturan bersama), `addon.js`, `inventori.js`, `keuangan.js` (dashboard), `pos-bridge.js` (POS) |
| `prototipe/dashboard.html`, `prototipe/kasir-asli.html` | Kerangka tampilan awal yang ditempeli kode di `src/` saat build |
| `prototipe/vendor/` | qrcode-generator 2.0.4 (MIT) dan jsQR 1.4.0 (Apache-2.0) |
| `prototipe/tests/` | Uji Playwright per fitur |

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
