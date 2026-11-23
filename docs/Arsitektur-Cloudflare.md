# Arsitektur Hikayat Merchandise di Cloudflare

Dokumen ini untuk developer yang membangun versi produksi dari prototipe (`dashboard.html`, `pos.html`) dan PRD. Semua layanan memakai paket gratis Cloudflare.

Per Oktober 2026.

---

## 1. Komponen

| Bagian | Layanan Cloudflare | Kuota gratis | Dipakai untuk |
|---|---|---|---|
| File aplikasi | Pages | Bandwidth tidak dibatasi, 500 build per bulan, boleh untuk usaha | Dashboard (laptop) dan POS (HP, PWA) |
| Server | Workers | 100.000 permintaan per hari, 10 ms CPU per permintaan | Login, cek PIN, semua aturan bisnis, laporan |
| Database | D1 (SQLite) | 5 GB, 5 juta baris dibaca dan 100.000 baris ditulis per hari | Semua data |
| Foto | D1 (tabel `berkas`) | Ikut kuota D1 di atas | Bukti biaya, foto barang terbuang dan retur, gambar QRIS |
| Pemulihan data | D1 Time Travel | Kembali ke menit mana pun dalam 7 hari terakhir | Salah hapus atau salah impor |
| Jadwal | Workers Cron Triggers | Termasuk paket gratis | Rekap harian, bersih-bersih sesi |
| Backup jangka panjang | GitHub Actions (artifact) | Kuota menit dan penyimpanan GitHub | Salinan database setiap malam, disimpan 30 hari |

Biaya: Rp0 per bulan. Opsional: domain sendiri sekitar Rp150 ribu sampai Rp200 ribu per tahun. Tanpa domain, alamatnya `nama.pages.dev`.

```
 HP kasir (PWA POS)                       Laptop (Dashboard)
 ├─ IndexedDB: katalog, stok, promo        │
 └─ Antrean transaksi offline              │
          │ HTTPS                          │ HTTPS
          └──────────────┬─────────────────┘
                         ▼
            Cloudflare Pages (file aplikasi)
                         ▼
            Cloudflare Workers (API /api/*)
              ├─ D1  (database + foto)
              └─ Cron (rekap harian)
                         ▼
            GitHub Actions: ekspor D1 tiap malam → artifact privat
```

---

## 2. Teknologi yang disarankan

| Bagian | Pilihan | Alasan |
|---|---|---|
| Bahasa | TypeScript di semua bagian | Aturan bisnis bisa dipakai bersama oleh POS, dashboard, dan server |
| Tampilan | React + Vite (atau Svelte kalau developer lebih nyaman) | Build statis, cocok untuk Pages |
| PWA dan offline | vite-plugin-pwa (Workbox), Dexie untuk IndexedDB | POS bisa dibuka tanpa sinyal |
| API di Workers | Hono | Ringan, routing dan middleware sederhana |
| Database | Drizzle ORM + migrasi Drizzle Kit | Skema tertulis di kode, migrasi tercatat |
| Validasi | Zod | Data dari HP dicek ulang di server |
| PDF struk | Dibuat di HP (seperti prototipe) | Tidak memakai CPU server |

Struktur folder (satu repositori):

```
apps/dashboard     tampilan laptop
apps/pos           PWA untuk HP kasir
worker/api         Cloudflare Worker (Hono) + migrasi D1
packages/aturan    rumus bersama: harga event, promo, HPP rata-rata,
                   laba rugi, sell-through (dipindah dari shared.js prototipe)
```

---

## 3. Database (D1)

### Aturan umum
- Uang disimpan sebagai bilangan bulat rupiah. Tidak ada desimal.
- Waktu disimpan dalam UTC (ISO 8601). Tampilan memakai zona waktu lokasi: event menyimpan `zona` (WIB, WITA, atau WIT).
- ID dibuat di perangkat (ULID). Transaksi yang dibuat offline sudah punya ID tetap sebelum dikirim, jadi server bisa menolak kiriman ganda.
- Setiap tabel punya `dibuat_pada`, `diubah_pada`, `dibuat_oleh`. POS mengambil data baru berdasarkan `diubah_pada`.
- Data penting tidak dihapus permanen. Pakai kolom status (misalnya Void, Dibatalkan) supaya riwayat tetap ada.

### Stok: buku besar
Stok tidak disimpan sebagai angka yang ditimpa-timpa. Setiap perubahan dicatat sebagai satu baris di `stok_gerak`, dan `stok` hanya ringkasan yang diperbarui bersamaan.

```
stok_gerak: id, sku, lokasi_id, jumlah (+/−), jenis, ref_tabel, ref_id, waktu, oleh
  jenis: awal, faktur, batal_faktur, kirim_keluar, kirim_masuk, transit, jual, void,
         retur_tukar, rusak, opname, terbuang, tarik, presale_serah
stok: sku, lokasi_id, qty, transit, diubah_pada     (ringkasan, bisa dihitung ulang dari stok_gerak)
```

D1 menjalankan `db.batch([...])` sebagai satu transaksi. Contohnya transaksi jual, baris barangnya, baris pembayaran, gerak stok, dan pembaruan ringkasan stok, semuanya masuk dalam satu batch. Kalau satu gagal, semuanya batal.

### Daftar tabel
Dipetakan dari bagian 8 PRD.

| Kelompok | Tabel |
|---|---|
| Akun | `staff`, `staff_role`, `sesi`, `perangkat`, `log_masuk`, `percobaan_gagal` |
| Katalog | `kategori`, `produk`, `varian` (SKU), `harga_saluran` |
| Lokasi dan event | `lokasi` (Gudang Pusat dan setiap event), `event`, `event_kasir`, `event_varian`, `event_harga` |
| Stok | `stok`, `stok_gerak`, `mutasi`, `mutasi_item`, `opname`, `opname_item`, `terbuang`, `terbuang_item` |
| Pembelian | `pemasok`, `faktur`, `faktur_item`, `faktur_bayar`, `hpp_riwayat` |
| Penjualan POS | `shift`, `kas_laci`, `trx`, `trx_item`, `trx_bayar` (`ref` untuk 4 digit QRIS lama, sekarang boleh kosong), `retur`, `retur_item`, `pengambilan` (pre-sale) |
| Online | `saluran`, `pesanan_online`, `pesanan_item`, `impor_batch` |
| Pelanggan dan promo | `pelanggan`, `promo`, `promo_lokasi`, `promo_produk`, `promo_bonus` |
| Keuangan | `biaya`, `kerugian_tanggungjawab`, `kerugian_riwayat` |
| Pengaturan | `pengaturan` (kunci, nilai JSON), termasuk pengaturan POS dan `keuAlokasi` |
| Laporan | `rekap_harian` (per tanggal, lokasi, SKU: qty, penjualan, diskon, HPP), diisi Cron |

### Penomoran dokumen saat offline
Nomor seperti `HK-261007-0012` bisa bentrok kalau dua HP membuat nomor saat offline. Solusinya, setiap HP punya kode perangkat dua huruf yang ditetapkan saat didaftarkan:

```
HK-261007-B2-0012     (transaksi dari HP B2)
RT-261007-B2-0003     (retur)
SO-261007-B2-0001     (opname dari POS)
```

Dokumen yang dibuat di dashboard (faktur, mutasi, biaya) tetap diberi nomor oleh server.

---

## 4. Login dan hak akses

### Dashboard: email dan password
- Owner membuat akun karyawan dengan password sementara. Karyawan wajib menggantinya saat pertama masuk (`pw_sementara = 1`). Tidak ada verifikasi email.
- Penyimpanan password: PBKDF2-SHA256 dengan salt per akun **ditambah pepper**, yaitu kunci rahasia yang disimpan sebagai Worker secret dan tidak ada di database. Kalau database bocor, hash tidak bisa dibongkar tanpa pepper.
- Batasan paket gratis: Workers gratis hanya punya 10 ms CPU per permintaan, jadi jumlah iterasi PBKDF2 harus lebih kecil dari anjuran OWASP (600.000). Cara menutupnya:
  - pepper (lihat di atas);
  - aturan password minimal 8 karakter, berisi huruf dan angka (sudah ada di prototipe);
  - akun dikunci 15 menit setelah 5 kali salah;
  - jumlah iterasi diukur saat pengembangan, ambil angka tertinggi yang masih di bawah 10 ms.
  
  Kalau nanti naik ke Workers berbayar (sekitar US$5 per bulan), iterasi bisa dinaikkan dan hash lama diperbarui otomatis saat pengguna berhasil masuk.
- Sesi disimpan di cookie `HttpOnly; Secure; SameSite=Strict`, berisi token acak. Di database, token itu juga disimpan dalam bentuk hash. Sesi habis setelah 12 jam tidak aktif.

### POS: perangkat terdaftar + PIN 6 angka
1. Owner atau Admin mendaftarkan HP dari dashboard. Dashboard menampilkan kode sekali pakai (berlaku 10 menit). Kode itu diketik di HP, lalu HP menerima token perangkat yang tersimpan di IndexedDB.
2. Setiap permintaan POS membawa token perangkat. Kalau HP hilang, Owner menonaktifkan perangkat itu dari dashboard.
3. Karyawan memilih nama dan mengetik PIN. Server mencocokkan HMAC-SHA256(pepper, staff_id + PIN), yang cepat dan aman selama pepper tidak bocor. Setelah 5 kali salah, karyawan itu dikunci 15 menit di perangkat tersebut.
4. PIN sementara wajib diganti saat pertama masuk, sama seperti di prototipe.
5. Persetujuan atasan (void, retur, tutup kasir) memakai endpoint yang sama. Server mengembalikan token persetujuan sekali pakai yang menempel pada aksi itu.

### Masuk saat offline
Supaya kasir tetap bisa berganti saat sinyal hilang, HP menyimpan hash PIN versi perangkat: PBKDF2(PIN, salt perangkat). Isinya hanya untuk karyawan yang ditugaskan di event itu. Masuk offline dicatat sebagai "Masuk offline" dan dikirim ke `log_masuk` saat online. Hash di HP lebih lemah daripada di server, jadi perlindungannya ada pada pendaftaran perangkat dan penonaktifan HP yang hilang.

### Hak akses dicek di server
Setiap endpoint memeriksa role dari sesi, bukan dari tampilan.

| Area | Owner | Admin | Kasir |
|---|---|---|---|
| Keuangan (laporan, biaya umum, ubah dan hapus biaya, sakelar pembagian) | Ya | Tidak | Tidak |
| Catat biaya event baru | Ya | Ya | Tidak |
| Karyawan dan perangkat | Ya | Daftar perangkat saja | Tidak |
| Faktur, pemasok, kirim stok, event, promo | Ya | Ya | Tidak |
| POS: jual, shift, opname, terima kiriman | Ya | Ya | Ya |
| Persetujuan atasan | Ya | Ya | Tidak |
| Menyetujui opname hasil hitungan sendiri | Ya | Tidak | Tidak |

---

## 5. POS offline

### Data yang disimpan di HP (Dexie / IndexedDB)
- Katalog, harga event, promo aktif, pelanggan, stok lokasi event, pengaturan POS, gambar QRIS.
- `antrean`: transaksi, shift, kas laci, retur, opname, dan terima kiriman yang belum terkirim.

### Alur kirim
1. Kasir menekan bayar. Transaksi langsung tersimpan di `antrean` dengan ULID dan nomor berkode perangkat, dan struk bisa langsung dibagikan.
2. Service worker mengirim antrean ke `POST /api/pos/sinkron` setiap ada sinyal, berurutan sesuai waktu.
3. Server memproses setiap dokumen dalam satu `db.batch`. Kalau ID sudah ada, server membalas "sudah diterima" tanpa memproses ulang.
4. HP menghapus dokumen dari antrean setelah server mengonfirmasi.

### Alur ambil data
`GET /api/pos/tarik?sejak=<waktu>` mengembalikan perubahan katalog, harga, promo, stok, dan pengaturan sejak sinkron terakhir. Dipanggil saat aplikasi dibuka dan setiap 2 menit selama online.

### Bentrok stok
Kalau server menerima penjualan offline padahal stok di server sudah 0, penjualan tetap dicatat dan stok menjadi minus. Dashboard menandai lokasi itu dengan peringatan "Stok minus". Selisihnya diselesaikan lewat opname. Penjualan yang sudah terjadi tidak ditolak.

### Batas harian D1
Kalau kuota harian D1 habis, server menolak tulis sampai pukul 00.00 UTC (07.00 WIB). POS tetap jalan karena transaksi masuk antrean dan terkirim setelah kuota pulih. Dashboard menampilkan pesan "Server mencapai batas harian, data akan masuk otomatis".

---

## 6. Foto di D1

R2 tidak dipakai (keputusan Oktober 2026). Foto disimpan di D1 sebagai BLOB di tabel `berkas`: id, jenis, mime, ukuran, isi, ref_tabel, ref_id, dibuat_pada, dibuat_oleh.


- Foto dikecilkan di perangkat sebelum diunggah: sisi terpanjang 1280 px, JPEG kualitas 0,7, rata-rata 100 KB sampai 200 KB.
- Unggah lewat Worker: `POST /api/berkas`. Worker memeriksa sesi, jenis file (JPEG, PNG, WebP), dan ukuran maksimal 1 MB.
- Foto tidak punya alamat publik. Foto diambil lewat `GET /api/berkas/:id`, dan Worker mengecek hak akses dulu. Bukti transfer dan foto nota termasuk data sensitif.
- Batas D1: satu baris maksimal 2 MB, jadi batas unggah 1 MB aman.
- Daftar dan laporan tidak pernah memilih kolom `isi`. Isi foto hanya dibaca oleh `GET /api/berkas/:id`.
- Foto ikut masuk ekspor malam, jadi ukuran backup bertambah seiring jumlah foto.
- Kalau database mendekati 5 GB, pindahkan foto ke R2. Kolom `id` tetap, jadi alamat `/api/berkas/:id` tidak berubah.

---

## 7. Laporan

- Laporan dihitung di Worker dengan SQL agregat (`SUM`, `GROUP BY`), bukan dengan mengirim semua transaksi ke browser.
- Cron setiap malam pukul 00.30 WIB mengisi `rekap_harian` untuk hari sebelumnya. Laporan bulanan dan tahunan membaca rekap ini, sehingga jumlah baris yang dibaca tetap kecil. Laporan hari ini dihitung langsung dari transaksi.
- Rumus laba rugi, sell-through, titik impas, dan pembagian biaya umum dipindah dari `keuangan.js` prototipe ke `packages/aturan`, dan diuji dengan angka contoh dari prototipe.

---

## 8. Backup dan pemulihan

| Lapisan | Cara | Jangka |
|---|---|---|
| D1 Time Travel | Otomatis, selalu aktif | 7 hari ke belakang, bisa kembali ke menit tertentu |
| Ekspor malam | GitHub Actions menjalankan `wrangler d1 export` lalu menyimpan file sebagai artifact di repositori privat | Disimpan 30 hari (`retention-days: 30`), file lama dihapus otomatis |
| Foto | Ikut ekspor malam karena ada di D1 | Sama dengan database |
| Uji pemulihan | Sebulan sekali, impor ekspor terbaru ke database uji dan cocokkan jumlah transaksi | Wajib |

Token API Cloudflare untuk GitHub Actions hanya diberi izin D1 baca.

---

## 9. Perkiraan pemakaian

Dengan asumsi 2 event berjalan bersamaan, 300 transaksi per hari, 5 akun dashboard aktif:

| Kuota | Perkiraan | Batas gratis |
|---|---|---|
| Permintaan Worker | ~5.000 per hari (POS tarik data tiap 2 menit + transaksi + dashboard) | 100.000 per hari |
| Baris ditulis D1 | ~3.000 per hari (sekitar 10 baris per transaksi) | 100.000 per hari |
| Baris dibaca D1 | ~200.000 per hari (laporan memakai rekap) | 5 juta per hari |
| Ukuran database | ~1 KB sampai 2 KB per transaksi lengkap, jadi 5 GB cukup untuk jutaan transaksi | 5 GB |
| Foto | ~150 KB per foto, berbagi 5 GB dengan data lain. 2 GB foto sekitar 13.000 foto | Ikut 5 GB D1 |

Ini angka perkiraan. Setelah 2 minggu berjalan, cek angka sebenarnya di halaman Analytics Cloudflare.

---

## 10. Daftar keamanan

Diperiksa Oktober 2026 (tahap 8).

- [x] Semua endpoint memeriksa sesi dan role di server. Diperiksa otomatis: semua rute di `src/index.ts` memanggil `sesiSiap`, `sesiPos`, atau `perangkatDari`, kecuali empat yang memang terbuka: status setup, setup Owner pertama (butuh kode setup dan hanya selama belum ada akun), login, dan pendaftaran HP (butuh kode sekali pakai, dikunci setelah 5 kali salah).
- [x] Pepper dan token API disimpan sebagai Worker secret atau secret GitHub, tidak di kode atau repositori.
- [x] Password (PBKDF2 + pepper) dan PIN (HMAC + pepper) hanya disimpan sebagai hash. Token sesi dan token perangkat juga disimpan sebagai hash.
- [x] Akun, PIN, dan kode pendaftaran HP dikunci 15 menit setelah 5 kali salah.
- [x] Cookie sesi `HttpOnly`, `Secure`, `SameSite=Strict`.
- [x] Input divalidasi di server, termasuk jumlah, harga, stok, dan angka transaksi dari HP. Memakai fungsi validasi sendiri (`src/util.ts`), belum Zod.
- [x] Query D1 memakai parameter (`.bind()`). Teks yang disambung ke SQL hanya tanda tanya placeholder dan nama kolom tetap.
- [x] Foto hanya dilayani lewat Worker setelah cek sesi dashboard atau token HP, dengan `content-security-policy: default-src 'none'`.
- [x] Perangkat POS bisa dinonaktifkan dari dashboard; HP itu langsung ditolak di semua endpoint POS.
- [x] Log aktivitas penting: login dan semua aksi akun/HP (`log_masuk`), ubah harga, faktur, batal faktur, opname, biaya, promo, impor, kerugian (`log_aktivitas`). Void dan retur tercatat di transaksi beserta siapa yang melakukan dan menyetujui.
- [x] Backup malam (`.github/workflows/backup-d1.yml`) menguji pemulihan setiap kali berjalan. Repositori publik, jadi file backup dienkripsi AES-256. Butuh tiga secret GitHub sebelum aktif; lihat `docs/Panduan-Siap-Pakai.md`.
- [ ] Uji lapangan di satu event kecil (daftar periksa di `docs/Panduan-Siap-Pakai.md`).

---

## 11. Urutan pembangunan

| Tahap | Isi | Hasil yang bisa dicoba |
|---|---|---|
| 1. Fondasi | Repositori, D1 + migrasi, Worker + Hono, login dashboard, karyawan, perangkat | Owner masuk, membuat akun, mendaftarkan HP |
| 2. Katalog dan stok | Produk, varian, kategori, lokasi, buku besar stok, faktur, pemasok | Barang masuk Gudang Pusat lewat faktur, HPP terhitung |
| 3. POS inti | PWA, PIN, shift, jual, pembayaran (tunai, QRIS statis + 4 digit, transfer), struk PDF, antrean offline | Jualan di event tanpa sinyal, data masuk saat online |
| 4. Event | Event, kirim dan terima stok, opname, tutup event, harga event | Satu event berjalan dari awal sampai ditutup |
| 5. Lengkapi POS | Promo, pre-sale, retur, void, pisah bayar, daftar order, ganti PIN | Semua alur POS di prototipe |
| 6. Online dan pelanggan | Impor marketplace, pesanan online, pelanggan | Penjualan online tercatat |
| 7. Keuangan | Biaya, kerugian, laporan per event dan keseluruhan, rekap harian, CSV dan cetak | Laporan laba rugi |
| 8. Siap pakai | Backup malam, uji pemulihan, uji lapangan di satu event kecil | Dipakai sungguhan |

Saran: jalankan tahap 3 di satu event kecil sebelum tahap 4 sampai 7 selesai. Masalah offline dan sinyal paling cepat ketahuan di lapangan.

### Catatan pembangunan (Oktober 2026)

Tahap 1 sampai 8 sudah dibangun di `worker/api` dan berjalan di `https://hikayat-api.media2mimbar.workers.dev`. Beberapa hal berbeda dari rancangan di atas karena lingkungan pengembangan saat itu tidak bisa mengunduh paket npm:

| Rancangan | Yang dipakai sekarang | Rencana |
|---|---|---|
| Hono | Router kecil di `src/index.ts` | Bisa diganti Hono tanpa mengubah fungsi tiap rute |
| Drizzle ORM + Drizzle Kit | SQL biasa dengan `.bind()`, migrasi di `migrations/*.sql`, dicatat di tabel `_migrasi` | Tetap SQL biasa atau pindah ke Drizzle saat skema membesar |
| Zod | Fungsi validasi di `src/util.ts` | Ganti Zod saat paket bisa dipasang |
| Dashboard dan POS di Pages (React + Vite) | Halaman HTML sederhana di `ui/`, dilayani Worker yang sama (`/` dan `/pos`) | Dipindah ke Pages saat tahap 3 (PWA) |
| `wrangler deploy` | `deploy.py` memanggil API Cloudflare langsung | Tetap bisa memakai wrangler kapan saja |

Tahap 2 menambah migrasi `0002_katalog_stok.sql`: `kategori`, `produk`, `varian`, `lokasi` (berisi Gudang Pusat), `stok`, `stok_gerak`, `pemasok`, `faktur`, `faktur_item`, `faktur_bayar`, `hpp_riwayat`, dan `log_aktivitas`. Rumus HPP dan status faktur ada di `src/aturan.ts` (calon `packages/aturan`) dan diuji dengan angka dari prototipe. Pemeriksaan stok saat batal faktur dan sisa tagihan saat bayar dijalankan di dalam `db.batch` yang sama dengan penulisannya, jadi dua orang yang menyimpan bersamaan tidak bisa membuat stok gudang atau sisa tagihan jadi salah.

Tahap 3 menambah migrasi `0003_pos.sql`: `shift`, `kas_laci`, `trx`, `trx_item`, `trx_bayar`, `harga_saluran`, `berkas` (foto di D1), `persetujuan`, dan `dokumen_ditolak`. POS di HP:
- File aplikasi disimpan service worker (`/pos-sw.js`, cakupan `/pos`), jadi POS tetap terbuka tanpa sinyal.
- Katalog, stok, pengaturan, dan gambar QRIS disimpan di IndexedDB. Tarik data memakai `sejak` dan indeks `diubah_pada` supaya baris yang dibaca D1 tetap kecil.
- Setiap aksi kasir (buka shift, kas, transaksi, tutup kasir, riwayat masuk) masuk antrean dengan ULID, lalu dikirim berurutan ke `POST /api/pos/sinkron`. Server memeriksa ulang angka (subtotal, total, pembayaran). Kiriman yang tidak lolos disimpan di `dokumen_ditolak` dan tampil di Dashboard › Penjualan › Kiriman Ditolak.
- Masuk offline memakai PBKDF2(PIN, salt HP) yang disimpan saat karyawan pernah masuk online di HP itu.
- Tutup kasir online memakai token persetujuan sekali pakai dari `POST /api/pos/setujui`. Tutup kasir offline ditandai `offline = 1`.
- Setoran kasir di dashboard menghitung ulang "seharusnya" dari transaksi yang sudah masuk server, jadi tetap benar walau ada HP yang mengirim belakangan.

Tahap 4 menambah migrasi `0004_event.sql`: `event`, `event_kasir`, `event_varian` (produk yang dijual + harga event), `mutasi`, `mutasi_item`, `opname`, `opname_item`, `kerugian`, `kerugian_riwayat`. Setiap event juga punya baris `lokasi` dengan ID yang sama, jadi stok dan transaksi menempel ke ID dan ikut "pindah" saat nama event diganti. Kirim stok mengurangi gudang dan menambah `transit` di event; diterima di POS lewat dokumen antrean `terima`. Opname dari POS lewat dokumen `opname`. Tutup event membatalkan kiriman yang belum diterima, menyesuaikan stok ke hitungan fisik, mencatat kerugian, lalu memindahkan sisa ke gudang dalam satu `db.batch`. Kerugian kas laci dicatat otomatis saat tutup kasir kurang.

Tahap 5 menambah migrasi `0005_pos_lengkap.sql`: `promo`, `pelanggan`, `retur`, `retur_item`, `terbuang`, `terbuang_item`, dan kolom pre-sale, void, dan refund di `trx`. Rumus promo ada di `src/promo.ts` dan dipakai server dan HP (dikompilasi menjadi `/pos-promo.js`), jadi potongan di HP dan di server selalu sama. Dokumen antrean baru: `pelanggan`, `void`, `retur`, `serah`. Foto retur diunggah ke `berkas` (D1); kalau HP offline, foto disimpan di IndexedDB dan diunggah saat sinkron. Daftar Order dan pisah bayar hanya disimpan di HP sampai lunas, jadi tutup kasir ditolak selama masih ada pesanan yang dibayar sebagian.

Tahap 6 menambah migrasi `0006_online.sql`: `saluran` (Shopee, Tokopedia, TikTok Shop, Lainnya, beserta biaya), `saluran_varian` (harga marketplace per SKU), `pesanan_online`, `pesanan_item`, `impor_batch`. File CSV dibaca di browser; server memeriksa ulang dan menyimpan per kiriman maksimal 100 pesanan dalam satu `db.batch`. File .xls lama perlu disimpan ulang sebagai .xlsx atau CSV.

Tahap 7 menambah migrasi `0007_keuangan.sql`: `biaya` (dihapus = ditandai, bukan dibuang), `rekap_harian`, dan pengaturan `keuangan`. Semua laporan memakai satu sumber angka, `sqlFakta` di `src/laporan.ts`: baris jual per barang dari POS, retur, dan pesanan online, dengan diskon dan potongan marketplace dibagi rata ke barang menurut nilainya. Laporan penjualan menghitung pre-sale pada tanggal transaksi; laporan keuangan menghitungnya saat barang diserahkan. Cron `10 17 * * *` (00.10 WIB) menghitung ulang rekap harian 7 hari terakhir, jadi transaksi dari HP yang lama offline tetap masuk. Laporan lain masih dihitung langsung dari tabel transaksi karena datanya masih kecil.

Pelengkap POS sesudah tahap 8 (`src/pos-lanjut.ts`, `ui/pos-tambahan.js`): menu Laporan di HP (laporan kasir per shift, kas kasir, produk terjual), Riwayat Masuk (kasir hanya melihat miliknya), Pengaturan baca saja, filter Daftar Order, persetujuan opname oleh Owner/Admin dari HP, batal penerimaan kiriman selama barangnya masih utuh, serta tutup kasir lain dan tutup event dari HP oleh Owner. Fungsi persetujuan opname dan tutup event dipakai bersama dashboard dan POS (`setujuiOpnameInti`, `tutupEventInti`). Retur uang kembali tunai ditolak kalau uang di laci tidak cukup. Impor pesanan online sekarang juga membaca .xlsx langsung di browser (zip dibuka dengan `DecompressionStream`).

Pelengkap dari PRD (sesudah itu):
- **POS:**
  - chip Terlaris (4 produk terlaris 30 hari);
  - tampilan Grid atau Daftar SKU, diatur di Pengaturan POS;
  - Enter di kolom cari langsung menambah SKU yang cocok persis;
  - tanda "harga event" dan "harga khusus";
  - info tempat yang bisa diketuk (sisa stok per varian, terima kiriman, ganti tempat);
  - kas keluar dan retur tunai dibatasi isi laci;
  - nominal pisah bayar dibatasi sisa tagihan.
- **Karyawan:**
  - Admin bisa melihat daftar (tanpa mengubah);
  - kolom Bertugas di dan Terakhir di POS;
  - subtab Bertugas Hari Ini (`GET /api/karyawan/bertugas`);
  - riwayat masuk POS di halaman yang sama dengan hitungan PIN salah hari ini.
- **Event:**
  - setoran per shift di detail event;
  - peringatan pre-sale yang belum diambil sebelum tutup event;
  - filter opname.
- **Promosi:**
  - filter;
  - Duplikat;
  - pilih cakupan (per produk atau total belanja) sebelum form;
  - info harga paket;
  - Simpan sebagai draf.
- **Pre-sale:** tab Semua dan filter per event.
- **Barang terbuang:**
  - filter;
  - ringkasan per jenis;
  - unduh CSV;
  - PJ diisi otomatis dari event.
- **Pesanan online:** stok Gudang Pusat diperiksa di dalam `db.batch` yang sama.
- **Katalog:**
  - baris varian bisa dibuka;
  - harga marketplace per varian, diisi di form produk yang sama sejak produk dibuat (`marketplace` dan `harga_marketplace` di `POST`/`PATCH /api/produk`, satu `db.batch`);
  - sakelar Aktif per varian, juga saat produk dibuat;
  - tombol Ubah di ujung setiap baris Daftar Produk;
  - sakelar tampil di POS (`PATCH /api/produk/:id/tampil`).
- **Pengaturan POS:** tersimpan otomatis dan ada pratinjau struk.
- **Foto:** dikecilkan di browser (maksimal 1600 px, JPEG) sebelum disimpan ke D1.

Tampilan dashboard disamakan dengan prototipe (`prototipe/dashboard.html`): bilah atas putih dengan pilihan Penjualan/Karyawan, menu samping oranye 300px dengan submenu (Laporan, Keuangan, Penjualan Online, Penjualan POS, Produk, Inventori), ikon menu disalin dari prototipe (`ui/dash-ikon.js`), font Inter, kotak oranye Total Penjualan di Dashboard, tab berbentuk pil, dan sakelar untuk pilihan aktif/nonaktif. Submenu di menu samping menggantikan tab di dalam halaman; fungsi `subtabs()` mengenali grup yang punya submenu dan tidak menggambar tabnya lagi. Karyawan, Perangkat POS, dan Riwayat Masuk menjadi satu halaman di area Karyawan. Font Inter dimuat dari Google Fonts, jadi CSP halaman mengizinkan `fonts.googleapis.com` (style) dan `fonts.gstatic.com` (font); tanpa internet ke Google, halaman memakai font sistem.

Lokasi database (20 Oktober 2026): database pertama `hikayat` dibuat lewat API dari server pengembangan, sehingga Cloudflare menaruhnya di Amerika Utara bagian timur (ENAM). Dari Indonesia, setiap query D1 harus bolak-balik ke Virginia, dan satu halaman dashboard bisa butuh beberapa kali. Isinya sudah dipindah ke `hikayat-asia` yang dibuat dengan `primary_location_hint: "apac"`. `deploy.py` dan `scripts/backup-d1.py` memakai nama baru ini. Database lama masih ada sebagai cadangan dan boleh dihapus setelah aplikasi berjalan normal. Cek sesi juga dirampingkan: peran staf dibaca di query yang sama dengan sesi, dan di POS cek HP serta sesi berjalan bersamaan.

Lokasi eksekusi Worker (20 Oktober 2026): statistik Cloudflare menunjukkan permintaan dari pengguna di Indonesia kadang masuk lewat Eropa (Madrid, Paris), bukan Singapura. Ini jalur penyedia internet ke Cloudflare dan tidak bisa diatur dari kode. Agar query ke D1 tidak ikut menyeberang, `deploy.py` memasang `placement.region = "aws:ap-northeast-3"` (Osaka, tempat `hikayat-asia` dilayani). Akibatnya Worker selalu berjalan di dekat database, dan perjalanan jauhnya cukup sekali per permintaan. Skrip dashboard juga ditanam ke halaman `/` saat build, jadi muat pertama cukup satu permintaan. Cara mengecek: GraphQL `workersInvocationsAdaptive` (wallTime per coloCode) dan `d1AnalyticsAdaptiveGroups`.

Dashboard terasa cepat walau jaringannya jauh: `ui/dash-sw.js` menyimpan halaman `/` di browser (tampil seketika, versi baru diambil di belakang dan dipakai pada kunjungan berikutnya). `api()` di dashboard menyimpan hasil GET di memori. Menu yang pernah dibuka langsung tampil, data terbaru diambil di belakang, dan halaman digambar ulang kalau datanya berubah dan pengguna belum mengklik atau mengetik. Data yang baru disegarkan tidak disegarkan lagi sampai pengguna mengklik atau mengetik lagi, supaya gambar ulang tidak memicu penyegaran berulang. Setiap POST/PATCH/DELETE mengosongkan simpanan. Setelah masuk, data menu utama diambil sekaligus (`ambilDulu`), dan data Dashboard diminta bersamaan dengan cek login. Diukur dengan jeda buatan 300 ms per permintaan: buka menu 850 ms menjadi sekitar 50 ms, muat ulang 1,8 detik menjadi 0,7 detik.

Tampilan POS (`ui/pos.html`) disamakan dengan prototipe (`prototipe/out/pos.html`), dengan warna utama biru tua `#02194F` menggantikan oranye prototipe (header, tombol, harga, bar keranjang, ikon aplikasi). Dashboard memakai warna yang sama: menu samping, kotak Total Penjualan, tombol, dan grafik. Isinya: font Inter, layar masuk dengan logo HK, papan PIN bulat (C dan ⌫), header kasir oranye dengan pil Tempat dan Pelanggan, tab Penjualan dan Daftar Order, kartu produk dengan gambar ikon dan jumlah varian, pilihan ukuran berbentuk kotak, bar keranjang gelap yang muncul setelah ada barang, halaman bayar dengan ringkasan Total/Sisa/Kembalian dan isian tunai di bawah metode yang dipilih, serta layar Transaksi Berhasil dengan struk. Katalog belum punya foto produk, jadi kartu memakai ikon yang dipilih dari nama produk atau kategori dengan warna lembut yang tetap per produk. Service worker POS ikut menyimpan file font dari Google Fonts, jadi tampilan tetap sama saat tanpa sinyal.

QRIS sesuai nominal (23 Oktober 2026), tanpa payment gateway. POS membaca isi gambar QRIS statis yang diunggah di Pengaturan POS, lalu `ui/pos-qris.js` membuat QR baru berisi nominal transaksi: kode 01 menjadi `12`, nominal ditulis di kode 54, kode tip 55 sampai 57 dibuang, dan kode pemeriksa (CRC-16, kode 63) dihitung ulang. Data merchant dan NMID tidak berubah, jadi uang tetap masuk ke akun yang sama. Semua dihitung di HP, jadi tetap jalan saat offline. Isian 4 digit referensi dihapus. Kasir menekan "Dana Sudah Masuk" setelah melihat notifikasi di aplikasi merchant, karena tanpa payment gateway tidak ada konfirmasi otomatis. Kalau gambar QRIS tidak bisa dibaca atau bukan QRIS asli, POS kembali menampilkan QR statis dan pembeli mengetik nominal sendiri. Dashboard › Pengaturan POS memeriksa gambar QRIS dan menyediakan "Coba QRIS" untuk membuat QR dengan nominal kecil tanpa mencatat penjualan. Server masih menerima `ref` 4 digit dari HP yang belum diperbarui. Layar QRIS di POS memenuhi layar dan mengikuti tampilan QRIS di aplikasi merchant: kartu nama merchant, kota (dari QR), dan NMID, logo QRIS, nominal besar, QR dalam bingkai dengan aksen sudut merah QRIS (#FF0000), lalu tombol Ganti metode dan Dana Sudah Masuk berdampingan di bawah.

Yang sengaja tidak dibuat:
- **Reset Data:** terlalu berisiko untuk database produksi.
- **Nomor transaksi dengan kode HP:** tetap seperti sekarang supaya bisa dibuat saat offline.
- **Kirim otomatis lewat WhatsApp API:** ditunda di PRD.

Batas yang perlu diingat: satu query D1 maksimal 100 parameter, jadi satu faktur dibatasi 90 baris barang dan satu produk 40 varian.

Jumlah iterasi PBKDF2 ditetapkan 8.000 (sekitar 4 sampai 5 ms CPU di Node). Ganti password menjalankan dua hash, jadi angka ini sengaja tidak dinaikkan. Cek waktu CPU sebenarnya di Cloudflare › Workers › hikayat-api › Observability setelah dipakai.

---

## 12. Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Kuota harian D1 habis | Tulis ditolak sampai 07.00 WIB | Antrean offline POS, rekap harian, pantau Analytics |
| Batas CPU 10 ms | Hash password lebih lemah dari anjuran | Pepper, kunci akun, aturan password. Naik ke Workers berbayar kalau perlu |
| HP kasir hilang | Data offline di HP bisa dibaca | Nonaktifkan perangkat, kunci layar HP, data di HP hanya untuk event itu |
| Aturan paket gratis berubah | Biaya muncul tiba-tiba | Cek halaman harga Cloudflare tiap 3 bulan. Jalur naik kelas: Workers Paid sekitar US$5 per bulan |
| Tidak ada bantuan teknis di paket gratis | Gangguan harus ditunggu | POS offline tetap jalan, backup harian |

---

Sumber:
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits)
- [Password hashing di Cloudflare Workers (Flavio Copes)](https://flaviocopes.com/native-email-password-authentication-cloudflare-workers/)
