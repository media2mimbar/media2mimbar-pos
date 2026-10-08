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
| Penjualan POS | `shift`, `kas_laci`, `trx`, `trx_item`, `trx_bayar` (termasuk `ref` 4 digit QRIS), `retur`, `retur_item`, `pengambilan` (pre-sale) |
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

- [ ] Semua endpoint memeriksa sesi dan role di server.
- [ ] Pepper, kunci HMAC, dan token API disimpan sebagai Worker secret, tidak di kode atau repositori.
- [ ] Password dan PIN hanya disimpan sebagai hash.
- [ ] Akun dan PIN dikunci setelah 5 kali salah.
- [ ] Cookie sesi `HttpOnly`, `Secure`, `SameSite=Strict`.
- [ ] Input divalidasi dengan Zod di server, termasuk jumlah, harga, dan stok.
- [ ] Query D1 memakai parameter (`.bind()`), tidak pernah menyambung teks.
- [ ] Foto hanya dilayani lewat Worker setelah cek hak akses.
- [ ] Perangkat POS bisa dinonaktifkan dari dashboard.
- [ ] Log aktivitas penting: login, ubah harga, void, retur, hapus biaya, batal faktur, persetujuan opname.
- [ ] Backup malam berjalan dan pemulihannya sudah diuji.

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

### Catatan tahap 1 dan 2 (Oktober 2026)

Tahap 1 dan 2 sudah dibangun di `worker/api` dan berjalan di `https://hikayat-api.media2mimbar.workers.dev`. Beberapa hal berbeda dari rancangan di atas karena lingkungan pengembangan saat itu tidak bisa mengunduh paket npm:

| Rancangan | Yang dipakai sekarang | Rencana |
|---|---|---|
| Hono | Router kecil di `src/index.ts` | Bisa diganti Hono tanpa mengubah fungsi tiap rute |
| Drizzle ORM + Drizzle Kit | SQL biasa dengan `.bind()`, migrasi di `migrations/*.sql`, dicatat di tabel `_migrasi` | Tetap SQL biasa atau pindah ke Drizzle saat skema membesar |
| Zod | Fungsi validasi di `src/util.ts` | Ganti Zod saat paket bisa dipasang |
| Dashboard dan POS di Pages (React + Vite) | Halaman HTML sederhana di `ui/`, dilayani Worker yang sama (`/` dan `/pos`) | Dipindah ke Pages saat tahap 3 (PWA) |
| `wrangler deploy` | `deploy.py` memanggil API Cloudflare langsung | Tetap bisa memakai wrangler kapan saja |

Tahap 2 menambah migrasi `0002_katalog_stok.sql`: `kategori`, `produk`, `varian`, `lokasi` (berisi Gudang Pusat), `stok`, `stok_gerak`, `pemasok`, `faktur`, `faktur_item`, `faktur_bayar`, `hpp_riwayat`, dan `log_aktivitas`. Rumus HPP dan status faktur ada di `src/aturan.ts` (calon `packages/aturan`) dan diuji dengan angka dari prototipe. Pemeriksaan stok saat batal faktur dan sisa tagihan saat bayar dijalankan di dalam `db.batch` yang sama dengan penulisannya, jadi dua orang yang menyimpan bersamaan tidak bisa membuat stok gudang atau sisa tagihan jadi salah.

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
