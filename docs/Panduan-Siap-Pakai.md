# Panduan Siap Pakai Hikayat POS

Panduan ini untuk Owner. Isinya cara menyalakan backup, cara memulihkan data, persiapan sebelum event pertama, dan hal-hal yang perlu dicek rutin.

Alamat:
- Dashboard: https://hikayat-api.media2mimbar.workers.dev
- POS di HP kasir: https://hikayat-api.media2mimbar.workers.dev/pos

---

## 1. Menyalakan backup malam (sekali saja)

Backup berjalan otomatis setiap pukul 01.00 WIB lewat GitHub Actions (`.github/workflows/backup-d1.yml`). Setiap backup langsung diuji: isinya dipulihkan ke database kosong, lalu jumlah baris dicocokkan dengan database asli. Kalau tidak cocok, backup dianggap gagal dan GitHub mengirim email.

Repositori ini **publik**, jadi file backup dienkripsi dengan kata sandi sebelum disimpan. Tanpa kata sandi itu, file backup tidak bisa dibuka siapa pun.

Langkah:

1. **Buat token Cloudflare.** Buka dash.cloudflare.com › My Profile › API Tokens › Create Token › Custom token.
   - Permissions: `Account` › `D1` › `Edit`. Ekspor database butuh izin ini.
   - Account Resources: hanya akun Media 2 Mimbar.
   - Simpan tokennya. Token hanya tampil sekali.
2. **Buat kata sandi backup.** Minimal 20 karakter, acak. Simpan di tempat aman (password manager). **Kalau kata sandi ini hilang, semua backup tidak bisa dibuka.**
3. **Isi secret di GitHub.** Buka github.com/media2mimbar/media2mimbar-pos › Settings › Secrets and variables › Actions › New repository secret. Isi tiga secret:

   | Nama | Isi |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | token dari langkah 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | `57c35ec35dbddeda79829d4b7a4846c6` |
   | `BACKUP_KUNCI` | kata sandi dari langkah 2 |

4. **Coba sekali.** Buka tab Actions › Backup D1 › Run workflow. Setelah selesai (sekitar 1 menit), buka hasilnya. Di bagian Summary ada tabel jumlah baris, dan di bagian Artifacts ada file `backup-hikayat-…`.

Workflow hanya berjalan dari cabang utama (`main`). Jadi backup otomatis baru aktif setelah pull request digabung ke `main`.

File backup disimpan 30 hari, lalu dihapus otomatis.

---

## 2. Memulihkan data

Ada dua cara. Pilih sesuai kejadiannya.

### a. Salah hapus atau salah ubah dalam 7 hari terakhir: Time Travel

D1 menyimpan riwayat perubahan 7 hari, sampai ke menit tertentu. Ini cara tercepat dan tidak butuh file backup.

1. Tentukan jam sebelum kejadian, misalnya `2026-10-20 14:00 WIB` = `2026-10-20T07:00:00Z`.
2. Dari komputer yang sudah memasang wrangler:
   ```
   npx wrangler d1 time-travel info hikayat --timestamp=2026-10-20T07:00:00Z
   npx wrangler d1 time-travel restore hikayat --timestamp=2026-10-20T07:00:00Z
   ```
3. Semua perubahan setelah jam itu ikut hilang, termasuk transaksi yang benar. Catat dulu transaksi penting setelah jam itu, atau minta kasir mengirim ulang dari HP (antrean HP tetap aman selama belum terkirim).

### b. Lebih dari 7 hari, atau database rusak: dari file backup

1. Unduh artifact dari GitHub › Actions › Backup D1 › pilih tanggal › Artifacts, lalu ekstrak zip-nya.
2. Buka enkripsi dan kompresi:
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in hikayat-20261020-0100.sql.gz.enc -out hikayat.sql.gz -pass pass:'KATA_SANDI_BACKUP'
   gunzip hikayat.sql.gz
   ```
3. Periksa dulu isinya tanpa menyentuh database asli:
   ```
   gzip hikayat.sql && python3 scripts/backup-d1.py --uji hikayat.sql.gz
   ```
4. Pulihkan ke database **baru**, jangan menimpa yang lama:
   ```
   npx wrangler d1 create hikayat-pulih
   npx wrangler d1 execute hikayat-pulih --remote --file=hikayat.sql
   ```
5. Setelah datanya dicek benar, arahkan Worker ke database baru: ubah `NAMA_DB` di `worker/api/deploy.py` menjadi `"hikayat-pulih"`, lalu jalankan `python3 deploy.py` dari folder `worker/api`. Ubah juga `NAMA_DB` di `scripts/backup-d1.py` supaya backup malam mengikuti database baru.

---

## 3. Uji pemulihan bulanan

Setiap backup malam sudah memulihkan isinya ke database kosong dan mencocokkan jumlah barisnya. Sebulan sekali, cukup:
1. Buka Actions › Backup D1, pastikan 30 hari terakhir hijau semua.
2. Unduh satu backup, jalankan langkah 2b nomor 2 dan 3 di komputer sendiri. Ini memastikan kata sandi backup yang tersimpan masih benar.

---

## 4. Sebelum event pertama (uji lapangan)

Coba di satu event kecil dulu, dengan 1 HP kasir.

**H-3**
- [ ] Owner dan Admin bisa masuk dashboard. Password sementara sudah diganti.
- [ ] Semua produk, varian, HPP, dan stok Gudang Pusat sudah benar (Inventori › Daftar Stok).
- [ ] Pengaturan POS: metode bayar, gambar QRIS, rekening transfer, pajak, pembulatan, struk.
- [ ] Event dibuat: tanggal, produk yang dijual, harga event, kasir yang bertugas.
- [ ] HP kasir didaftarkan (Perangkat POS › Daftarkan HP). POS dipasang ke layar utama HP (menu browser › Tambahkan ke layar utama).
- [ ] Setiap kasir sudah masuk sekali di HP itu **dengan sinyal**, dan sudah mengganti PIN sementara. Tanpa ini, kasir tidak bisa masuk saat offline.

**H-1**
- [ ] Kirim stok dari dashboard (Event › Kirim Stok).
- [ ] Buka POS di HP selagi ada sinyal, supaya katalog dan harga event tersimpan di HP.
- [ ] Coba mode pesawat: buka POS, lakukan satu transaksi uji, matikan mode pesawat, pastikan terkirim. Void transaksi uji itu.

**Hari H**
- [ ] Terima kiriman di POS (Inventori › Terima kiriman), cocokkan dengan barang fisik.
- [ ] Buka kasir dengan modal awal yang dihitung.
- [ ] Sesekali cek di HP: Menu › Status sinkron. Angka "belum terkirim" harus turun ke 0 saat ada sinyal.
- [ ] Tutup kasir di akhir hari: hitung uang laci, isi di POS.

**Sesudah event**
- [ ] Stok opname, lalu Tutup Event dari dashboard.
- [ ] Cek Penjualan › Kiriman Ditolak. Harusnya kosong. Kalau ada, periksa alasannya.
- [ ] Buka Keuangan › Laporan per Event, catat biaya event yang belum masuk.

---

## 5. Kalau ada masalah

| Kejadian | Yang dilakukan |
|---|---|
| HP kasir hilang | Dashboard › Perangkat POS › Nonaktifkan. HP itu langsung tidak bisa mengirim atau menarik data. Transaksi yang belum terkirim dari HP itu hilang. |
| Sinyal mati di event | Tetap jualan. Semua transaksi tersimpan di HP dan terkirim sendiri saat sinyal kembali. Jangan hapus data browser HP. |
| Kasir lupa PIN | Owner: Karyawan › Reset PIN. Kasir harus masuk sekali dengan sinyal. |
| Kiriman ditolak server | Penjualan › Kiriman Ditolak menampilkan alasannya, misalnya stok kurang atau shift belum diterima. Perbaiki datanya, lalu tandai sudah ditangani. |
| Angka laporan hari kemarin terasa kurang | Biasanya ada HP yang baru mengirim belakangan. Rekap dihitung ulang tiap malam untuk 7 hari terakhir, atau Owner bisa klik "Hitung ulang rekap" di Laporan › Rekap Harian. |
| Kuota Cloudflare | Cek Cloudflare › Workers & Pages › Analytics dan D1 › Metrics setelah 2 minggu. Batas gratis: 100.000 permintaan per hari, 100.000 baris ditulis per hari, 5 juta baris dibaca per hari, 5 GB data. |

---

## 6. Cek rutin

| Kapan | Apa |
|---|---|
| Setiap hari setelah event | Kiriman Ditolak kosong, semua kasir sudah ditutup |
| Setiap minggu | Laporan › Selisih & Kerugian: selesaikan yang belum |
| Setiap bulan | Uji pemulihan (bagian 3), cek pemakaian kuota Cloudflare |
| Setiap 3 bulan | Cek halaman harga Cloudflare, ganti kata sandi akun Owner |
