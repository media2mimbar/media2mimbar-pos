# PRD Hikayat Merchandise: Dashboard dan POS Event

Versi prototipe v11 · Oktober 2026
Dokumen ini menjelaskan apa yang sudah dibangun di prototipe `dashboard.html` dan `pos.html`, cara keduanya terhubung, serta aturan bisnis yang dipakai. Semua yang tertulis di sini sudah berjalan di prototipe, kecuali bagian yang ditandai "simulasi" atau "belum ada".

---

## 1. Ringkasan

### Latar belakang

Hikayat adalah perusahaan media yang menjual merchandise (kaos, jersey, tumbler, totebag, kopi) lewat empat jalur. Hikayat tidak memproduksi sendiri; semua barang dibeli jadi dari pemasok.

1. Booth di event (offline), berpindah-pindah kota.
2. Shopee.
3. Tokopedia (sekarang satu seller center dengan TikTok Shop).
4. Penjualan langsung dari gudang/kantor.

Masalah yang ingin diselesaikan:

- Stok tersebar di gudang dan beberapa booth event, dan sulit diketahui posisinya.
- Uang tunai di booth sering selisih tanpa catatan.
- Penjualan marketplace dan offline dicatat terpisah, jadi laba sebenarnya tidak terlihat.
- Harga, promo, dan kasir di booth diatur manual.

### Tujuan produk

| Tujuan | Ukuran berhasil |
|---|---|
| Satu tempat untuk mengatur produk, harga, promo, kasir, dan event | Semua pengaturan POS diubah dari dashboard, tidak dari HP kasir |
| Stok per varian dan per lokasi selalu benar | Selisih stok opname di akhir event mendekati nol |
| Setoran kasir bisa dipertanggungjawabkan | Setiap shift punya angka "uang seharusnya", "uang dihitung", dan selisih |
| Laporan gabungan offline dan online | Laba kotor per event dan per saluran tersedia tanpa rekap manual |

### Isi prototipe

- `dashboard.html`: aplikasi admin untuk desktop.
- `pos.html`: aplikasi kasir untuk HP, dibangun dari prototipe kasir yang sudah ada.
- `demo.html`: menampilkan keduanya berdampingan.

Kedua aplikasi berbagi data lewat `localStorage` browser yang sama, sehingga transaksi di POS langsung muncul di dashboard.

### Di luar cakupan prototipe

- Server, akun login web, dan sinkronisasi antar perangkat.
- Integrasi API Shopee/Tokopedia (sekarang lewat impor file).
- Pembayaran QRIS sungguhan, printer Bluetooth, dan pengiriman WhatsApp sungguhan. PDF struk sudah dibuat di HP, tapi pengirimannya masih simulasi.
- Aplikasi POS untuk tablet atau desktop.

---

## 2. Pengguna dan peran

| Peran | Siapa | Kebutuhan utama |
|---|---|---|
| Owner | Pemilik/pimpinan bisnis merchandise | Melihat laporan, menyetujui void, berjualan di mana saja |
| Admin | Staf back-office | Mengatur produk, event, stok, promo, impor pesanan online |
| Kasir | Penjaga booth di event | Berjualan cepat di HP, menerima kiriman stok, tutup kasir |

### Hak akses di POS

| Kemampuan | Kasir | Admin | Owner |
|---|---|---|---|
| Masuk POS dengan PIN 6 angka (PIN sementara wajib diganti saat pertama masuk) | Ya | Ya | Ya |
| Ganti PIN sendiri (Menu › Ganti PIN) | Ya | Ya | Ya |
| Masuk dashboard (email + password) | Tidak | Ya | Ya |
| Mendaftarkan, mengubah, menonaktifkan karyawan, reset password/PIN | Tidak | Tidak | Ya (dashboard) |
| Event yang bisa dipilih | Event berlangsung tempat ia ditugaskan | Semua event berlangsung | Semua event yang belum ditutup, termasuk yang akan datang (pre-sale) dan yang perlu ditutup |
| Jual langsung dari Gudang Pusat | Tidak | Tidak | Ya |
| Ganti event/tempat jualan tanpa menutup kasir | Tidak | Tidak | Ya |
| Void transaksi | Perlu PIN Admin/Owner (jika diaktifkan) | Langsung | Langsung |
| Tutup kasir | PIN sendiri | PIN sendiri | PIN sendiri |
| Tutup event dari HP | Tidak | Tidak | Ya |
| Kunci layar otomatis | Ya, setelah 20 menit tidak dipakai (bisa diubah) | Ya | Ya |

**Akun karyawan.** Semua karyawan didaftarkan Owner di Dashboard › Karyawan. Admin dan Owner masuk dashboard dengan **email dan password**; semua karyawan masuk POS dengan **PIN 6 angka**. Password dan PIN dari Owner bersifat sementara: karyawan wajib menggantinya saat pertama kali masuk (dashboard: password baru; POS: PIN baru). Tidak ada verifikasi email. Lupa password atau PIN: Owner meresetnya, lalu karyawan menggantinya lagi saat masuk. Kasir tidak bisa masuk dashboard. Nama akun yang login dicatat otomatis sebagai pelaku aksi di dashboard (tandai refund, kirim stok, tutup event, stok opname, dll.) dan tidak bisa dipilih manual. Pojok kanan atas menampilkan nama dan role akun, dengan menu Ganti password dan Keluar. Di dashboard, tombol Tutup Event dipakai Admin atau Owner. Di POS, hanya Owner yang bisa menutup event.

---

## 3. Konsep inti

### Lokasi

Lokasi adalah tempat stok berada. Ada tiga jenis:

1. **Gudang Pusat.** Lokasi tetap. Stok awal, pembelian, dan pengiriman pesanan online berasal dari sini.
2. **Event.** Lokasi sementara yang punya tanggal mulai dan selesai, tempat, kasir yang bertugas, dan stok sendiri.
3. **Gudang Pusat sebagai tempat jualan.** Khusus Owner, untuk penjualan langsung di kantor atau gudang. Stok yang dipakai adalah stok Gudang Pusat.

Konsep ini menggantikan "Outlet" di prototipe v7. Dashboard tidak punya pemilih lokasi: semua halaman selalu mencakup semua lokasi. Rincian per lokasi dilihat di detail event, Laporan › Per Event, dan tombol 👁 di Daftar Stok.

### Status event

| Status | Kondisi |
|---|---|
| Akan Datang | Hari ini sebelum tanggal mulai |
| Berlangsung | Hari ini di antara tanggal mulai dan selesai |
| Perlu Ditutup | Tanggal selesai sudah lewat, tapi event belum ditutup |
| Selesai | Event sudah ditutup dan sisa stok sudah kembali ke gudang |

### Produk, varian, dan SKU

- Satu produk bisa punya varian (misalnya ukuran S/M/L/XL atau "M · Hitam").
- Stok dan harga jual dicatat per SKU varian. Produk tanpa varian memakai SKU induk.
- HPP (harga pokok) diisi per produk dan berlaku untuk semua variannya. HPP dipakai untuk menghitung laba kotor.
- Setiap produk punya sakelar "Tampil di POS" dan status Aktif/Nonaktif.

### Harga event

- Semua harga diatur dari dashboard. Kasir dan Owner tidak bisa mengubah harga dari HP, dan menu Custom Amount (harga bebas) disembunyikan dari POS.
- Setiap event bisa punya harga khusus per varian (misalnya harga festival).
- Penjualan langsung dari Gudang Pusat juga punya harga khusus sendiri ("Harga Jual Langsung Gudang" di Daftar Produk).
- Kalau harga event kosong, POS memakai harga normal produk.
- Promo tetap bisa dipakai di atas harga event.

### Pre-sale

Pre-sale adalah penjualan di event yang belum dimulai. Hanya Owner yang bisa berjualan di event berstatus Akan Datang.

Pre-sale bisa diaktifkan atau dinonaktifkan per event dari form event. Event baru dibuat dengan pre-sale nonaktif.
- **Nonaktif:** event belum bisa dijual sebelum tanggal mulai. Di POS, event tampil redup dengan tanda "Belum mulai · pre-sale nonaktif" dan tidak bisa dipilih. Kalau Owner sudah membuka kasir di event itu lalu pre-sale dimatikan dari dashboard, produk tidak bisa masuk keranjang dan pembayaran ditolak. Kasir tetap bisa ditutup.
- **Nonaktif setelah ada pesanan:** pesanan pre-sale yang sudah masuk tetap berlaku dan tetap bisa diserahkan saat event. Form event menampilkan jumlahnya.
- **Aktif:** pilih salah satu mode berikut.


| Mode | Saat transaksi | Saat event berlangsung |
|---|---|---|
| Pesanan diambil nanti (default) | Pelanggan dengan no HP wajib dipilih. Stok tidak berkurang. Transaksi diberi status pengambilan "Menunggu". Struk memuat QR pengambilan | Kasir membuka POS › Penjualan › Pre-sale, lalu menekan "Serahkan Barang". Stok event baru berkurang di sini |
| Kurangi stok saat transaksi | Stok event langsung berkurang, jadi stok harus sudah dikirim dan diterima | Tidak ada langkah tambahan |

Status pengambilan pesanan pre-sale:

| Status | Artinya | Berikutnya |
|---|---|---|
| Menunggu | Sudah dibayar, barang belum diserahkan | Diserahkan di booth. Setelah event ditutup, masih bisa diambil di Gudang Pusat selama 7 hari. Bisa juga dibatalkan dan di-refund dari dashboard |
| Diambil | Barang sudah diserahkan (di booth atau di Gudang Pusat), stok tempat pengambilan berkurang | Selesai |
| Perlu Refund | Lewat 7 hari setelah event ditutup dan barang belum diambil (dicek otomatis setiap dashboard atau POS dibuka) | Pembeli masih bisa mengambil di Gudang Pusat. Kalau tidak, Admin men-transfer kembali dan menandainya di dashboard dengan foto bukti |
| Refund | Uang sudah di-transfer kembali | Transaksi tidak dihitung lagi di penjualan |

Aturan pengambilan:

0. **Struk pre-sale dikirim sebagai PDF ke WhatsApp pembeli** secara otomatis setelah bayar, memakai no HP pelanggan yang wajib diisi. PDF berisi rincian transaksi dan QR pengambilan.
1. **Verifikasi utama: scan QR di struk.** QR saja sudah cukup, termasuk kalau yang datang adalah orang lain yang diutus pembeli. QR berisi ID transaksi. Kasir memindai dengan kamera HP (atau memotret QR kalau kamera langsung tidak tersedia). Kalau QR cocok, POS menampilkan pesanan dan tombol "Serahkan Barang".
2. **Struk hilang:** pembeli menyebutkan 4 digit terakhir no HP, lalu Admin/Owner memasukkan PIN. Pengambilan dicatat sebagai "verifikasi manual".
3. **Tempat pengambilan:** di booth event selama event berlangsung. Setelah event ditutup, pesanan yang belum di-refund bisa diambil di Gudang Pusat oleh Owner atau Admin lewat POS Gudang Pusat. Batasnya 7 hari; setelah itu status menjadi Perlu Refund, tapi barang tetap boleh diserahkan selama uang belum ditransfer. Status Perlu Refund berubah menjadi Diambil dan refund batal.
4. **Tidak ada tukar ukuran.** Barang diserahkan persis sesuai varian yang dibeli. Kalau stok varian itu tidak ada di tempat pengambilan, barang tidak bisa diserahkan sampai stok dikirim.
5. QR tidak bisa dipakai dua kali. Scan pesanan yang sudah diambil menampilkan kapan, di mana, dan oleh siapa barang diserahkan.

### Shift kasir (laci)

- Satu shift berarti satu laci uang di satu tempat jualan.
- Shift dibuka dengan modal awal dan ditutup dengan hitungan uang fisik.
- Satu tempat jualan hanya boleh punya satu shift terbuka. Kasir lain yang masuk ke tempat yang sama bergabung ke shift itu.
- Setiap transaksi tetap mencatat nama kasir yang melayani.

### Saluran penjualan

- Offline: per event, atau "Jual langsung · Gudang Pusat".
- Online: Shopee, Tokopedia, TikTok Shop, Lainnya.

---

## 4. Alur utama dari awal sampai akhir

```
Admin membuat event, memilih produk, mengisi jumlah kirim ─► mutasi "Dikirim"
        │
        ▼
Kasir di booth: masuk PIN ─► Terima Mutasi (stok masuk ke event) ─► Buka kasir (modal awal)
        │
        ▼
Jual: pilih produk/varian ─► promo ─► bayar (tunai/QRIS/transfer/pisah bayar) ─► struk
        │                                    │
        │                                    └─► stok event berkurang, transaksi masuk dashboard
        ▼
Kas masuk/keluar, void, stok opname bila perlu
        │
        ▼
Tutup kasir: hitung uang fisik ─► PIN ─► selisih tercatat
        │
        ▼
Admin menutup event ─► sisa stok kembali ke Gudang Pusat ─► laporan per event final
```

Penjualan online berjalan terpisah: admin mengimpor file pesanan dari Seller Center (atau input manual), lalu stok Gudang Pusat berkurang.

---

## 5. Dashboard

Dashboard ditujukan untuk desktop. Sidebar berisi Dashboard, Laporan (dengan submenu Per Saluran, Per Event, Per Kasir, Per Produk, Rekap Harian, Selisih & Kerugian), Keuangan (Laporan Keseluruhan, Laporan per Event, Biaya), Event, Pesanan Pre-sale, Penjualan Online, Produk, Inventori, Pelanggan, Promosi, dan Pengaturan POS. Harga Marketplace tidak lagi punya menu sendiri: harga diatur di form produk, sedangkan biaya marketplace ada di Penjualan Online › Biaya Marketplace. Menu Karyawan ada di bilah atas.

Aturan tampilan form:
- Semua form isian dibuka sebagai halaman penuh selebar 960px, tanpa sidebar, dengan "← Kembali" dan judul di atas kartu form. Ini berlaku untuk Buat/Ubah Event, Tambah Produk, Harga Event, Kirim Stok, Tarik ke Gudang, Tandai Refund, Tambah/Ubah Karyawan, Tambah Promosi, Input Pesanan Manual, dan semua alur impor.
- Klik di area kosong tidak menutup form. Form hanya tertutup lewat Kembali, Batal, Simpan, atau saat pindah menu dari bilah atas.
- Popup hanya dipakai untuk konfirmasi (hapus, simpan, void, tutup event, reset), pemilih produk di dalam form, dan tampilan detail seperti Detail Pesanan dan foto bukti transfer.

### 5.1 Dashboard penjualan

- Periode bisa Harian, Mingguan, atau Bulanan, dengan tombol maju/mundur.
- Ringkasan berisi total penjualan, jumlah transaksi, rata-rata per transaksi, produk terjual, dan laba kotor.
- Kartu metrik:
  - penjualan offline dan online
  - potongan marketplace
  - dana marketplace yang belum cair (pesanan berstatus Diproses)
- Grafik batang:
  - metode pembayaran POS
  - penjualan per saluran
  - penjualan per kategori
  - produk terlaris
  - penjualan per kasir
  - stok menipis (stok total ≤ batas minimum produk)
- Angka selalu mencakup semua lokasi (event, Gudang Pusat, dan online). Untuk satu event, buka detail event atau Laporan › Per Event.

Semua angka dihitung dari data transaksi, bukan angka contoh.

### 5.2 Laporan

- Laporan adalah grup di sidebar. Tiap jenis laporan punya submenu sendiri, dan tombol "Buka laporan lengkap" di Dashboard membuka Per Saluran.
- Periode dipilih dengan tab di atas tabel: Hari ini, 7 hari, Bulan ini, 30 hari, atau Semua. Di sebelahnya ada rentang tanggal **Dari ... s/d ...** yang selalu menampilkan periode aktif; mengubah salah satu tanggal mengaktifkan rentang khusus. Tanggal tidak bisa melewati hari ini, dan kalau "dari" diisi setelah "sampai", tanggal lainnya ikut menyesuaikan. Tombol ✕ menghapus rentang. Periode yang dipilih tetap berlaku saat pindah submenu laporan.
- Submenu:
  - **Per Saluran:** transaksi, qty, penjualan kotor, potongan, bersih, HPP, laba kotor, margin.
  - **Per Event:** penjualan per metode bayar (Tunai/QRIS/Transfer), laba kotor, dan selisih kas gabungan semua shift. Gudang Pusat ikut tampil kalau ada penjualan langsung.
  - **Per Kasir:** semua penjualan per orang, yaitu transaksi, qty, penjualan (offline dan online), tunai, QRIS + transfer, jumlah shift dan selisih kas, jumlah void, dan laba kotor. Di bawah nama tampil role dan tempat ia berjualan. Penjualan di event dan gudang dihitung atas nama kasir yang melayani. Pesanan online dihitung atas nama akun dashboard yang menginput atau mengimpornya.
  - **Per Produk:** qty di event, qty online, penjualan, HPP, laba, sisa stok.
  - **Rekap Harian.**
  - **Selisih & Kerugian** (lihat 5.2a). Retur barang cacat dilihat di Inventori › Stok Terbuang.
- Tombol "Unduh CSV" mengekspor laporan yang sedang dibuka.

### 5.2a Selisih & Kerugian

- Submenu Laporan › Selisih & Kerugian, terlihat oleh semua akun dashboard (Admin dan Owner).
- Ada tiga jenis kerugian, diperlakukan sama:
  - **Stok:** selisih kurang dari stok opname yang disetujui, baik di tengah event maupun saat Tutup Event.
  - **Kas laci:** uang laci yang kurang saat tutup kasir.
  - **Barang terbuang:** barang terbuang yang dicatat manual di Inventori › Stok Terbuang, senilai jumlah × HPP, atas nama penanggung jawab yang dipilih saat mencatat.
- KPI: total kerugian, belum diselesaikan, sudah diganti, dibebankan perusahaan.
- Tabel: tanggal dan nomor (opname atau laci), jenis, event dan siapa yang menyetujui/menutup, rincian (barang yang kurang atau jumlah kas kurang), penanggung jawab dan penjelasannya, kerugian dan sisa, status beserta riwayat lengkap.
- **Selesaikan** (halaman form):
  - Diganti penanggung jawab: jumlah (boleh dicicil) dan cara (tunai, transfer, potong gaji). Admin dan Owner boleh mencatat.
  - Dibebankan ke perusahaan: seluruh sisa kerugian. Hanya Owner.
  - "Ditandai oleh" terisi otomatis dari akun yang login.
- Status: Belum diselesaikan → Diganti sebagian → Diganti, atau Dibebankan perusahaan. Riwayat tidak pernah ditimpa, jadi setiap cicilan dan keputusan Owner tetap terlihat.

### 5.2b Retur barang cacat (di Stok Terbuang)

- Tidak lagi punya submenu sendiri. Retur dicatat dari POS (lihat 6.13) dan tampil di Inventori › Stok Terbuang dengan jenis "Barang cacat (retur)".
- Baris retur menampilkan kerusakan beserta foto, transaksi asal, dan penyelesaian (tukar barang sama, atau uang kembali tunai/transfer beserta nilainya). KPI Stok Terbuang menampilkan total uang yang dikembalikan.
- Pengaruh ke laporan penjualan: uang kembali mengurangi penjualan dan qty terjual pada tanggal retur. Barang cacat tetap dihitung sebagai HPP (rugi). Tukar barang tidak mengubah penjualan tapi menambah HPP sebesar barang pengganti.

### 5.2c Keuangan

Menu baru untuk laporan laba rugi dan pencatatan biaya. **Hanya Owner** yang melihat menu ini dan tombol Laporan Keuangan di detail event. Produk Hikayat adalah fashion retail (kaos, jersey, kemeja, aksesoris), jadi laporan juga menampilkan sell-through dan penjualan per ukuran.

**Biaya** (Keuangan › Biaya)
- Mencatat biaya di luar pembelian barang. Pembelian barang tetap lewat Faktur Pembelian.
- Form halaman penuh: Dibebankan ke* (Umum atau salah satu event, termasuk event yang sudah ditutup), Tanggal*, Kategori*, Keterangan*, Jumlah*, Cara bayar* (Transfer atau Tunai dari kas kantor), Bukti (foto, opsional).
- Kategori biaya event: Sewa booth, Transportasi & logistik, Honor kru, Konsumsi, Perlengkapan & display, Promosi event, Perizinan & retribusi, Potongan bank & MDR QRIS, Lainnya.
- Kategori biaya umum: Gaji karyawan tetap, Sewa gudang & kantor, Listrik, air & internet, Iklan online, Kemasan & label, Foto & konten produk, Potongan bank & MDR QRIS, Lainnya.
- Potongan MDR QRIS dan biaya bank tidak dihitung otomatis. Owner atau Admin mencatatnya manual sesuai mutasi rekening atau laporan aplikasi merchant.
- Hak akses: Admin bisa mencatat biaya baru untuk event lewat kartu "Biaya event" di detail event (tidak bisa memilih Umum). Mengubah dan menghapus biaya, mencatat biaya umum, dan membuka menu Keuangan hanya untuk Owner.
- Detail event menampilkan kartu "Biaya event" berisi semua biaya event itu, termasuk kas keluar laci.
- Kas keluar dari laci POS (misalnya beli air mineral dan lakban) ikut tampil otomatis dengan tanda "Laci POS" dan dihitung sebagai biaya event. Tidak bisa diubah dari sini.
- Daftar: filter Dibebankan ke, kategori, dan tanggal. KPI total, biaya event, biaya umum, kas keluar laci. Ubah dan Hapus (dengan konfirmasi). Unduh CSV.
- Tombol "+ Catat Biaya" juga ada di kedua laporan keuangan. Dari laporan event, isian Dibebankan ke langsung terisi event itu.

**Laporan per Event** (Keuangan › Laporan per Event, atau tombol "Laporan Keuangan" di detail event)
- Pilih event dari daftar. Ada sakelar **Bagi biaya umum ke event** (disimpan, berlaku untuk semua laporan). Kalau aktif, laba bersih event ikut menanggung biaya umum: biaya umum bulan itu × porsi penjualan bersih event di bulan itu. Kalau nonaktif, laba bersih event hanya dikurangi biaya event sendiri. Laba bersih keseluruhan tidak berubah.
- Event yang belum ditutup diberi catatan bahwa angkanya masih bisa berubah.
- KPI: penjualan bersih, laba kotor dan marginnya, biaya + kerugian, laba bersih dan marginnya, sell-through.
- Laba rugi event: penjualan, diskon & promo, pembulatan, retur uang kembali, penjualan bersih, HPP, laba kotor, biaya per kategori (termasuk kas keluar laci), kerugian (selisih opname, barang terbuang, kas kurang, barang kurang saat kiriman diterima), penggantian dari penanggung jawab, selisih kas lebih, laba bersih. Setiap baris menampilkan persentase dari penjualan bersih.
- Indikator penjualan: rata-rata nilai transaksi, rata-rata pcs per transaksi, persen diskon, barang diretur, titik impas (penjualan bersih minimum supaya biaya tertutup) dan apakah sudah lewat.
- Uang diterima per metode bayar, uang pre-sale yang barangnya belum diambil, dan setoran tunai dari laci.
- Per kategori dan per ukuran (komposisi S/M/L/XL untuk rencana produksi dan kirim stok berikutnya).
- Per produk: diterima di event, terjual, sell-through (merah kalau di bawah 30%), sisa atau kembali ke gudang, penjualan, laba kotor.
- Rincian biaya dan kerugian.
- Unduh CSV dan Cetak / PDF (sidebar dan tombol disembunyikan saat dicetak).

**Laporan Keseluruhan** (Keuangan › Laporan Keseluruhan)
- Periode: Bulan ini, Bulan lalu, 90 hari, Tahun ini, Semua, atau rentang tanggal.
- Mencakup semua event, jual langsung di Gudang Pusat, penjualan online, dan biaya umum.
- KPI: penjualan bersih, laba kotor, biaya + kerugian (event dan umum), laba bersih, arus kas bersih.
- Laba rugi: penjualan per saluran, diskon, retur, potongan marketplace, HPP, biaya event per kategori, biaya umum per kategori, kerugian, laba bersih.
- Arus kas: uang masuk (penjualan offline per metode, pencairan marketplace untuk pesanan selesai) dan uang keluar (bayar pemasok, biaya, kas keluar laci).
- Posisi per hari ini: nilai persediaan (stok × HPP) per lokasi dan dalam perjalanan, piutang marketplace, kerugian yang belum diselesaikan, utang pemasok, uang pre-sale yang barangnya belum diambil.
- Tabel per event (klik untuk membuka laporannya; kolom Bagian biaya umum muncul kalau sakelar pembagian aktif), tabel per bulan, per kategori, per ukuran, dan rincian biaya dan kerugian.
- Unduh CSV dan Cetak / PDF.

### 5.3 Event

**Daftar event**
- Di atas tabel, kartu "event berlangsung" (juga event yang perlu ditutup) menampilkan penjualan hari ini, total penjualan event, dan kasir yang sedang terbuka. Klik kartu membuka detail event. Kartu ini hanya ada di halaman Event, tidak di Dashboard.
- Tab status: Semua, Berlangsung, Akan Datang, Perlu Ditutup, Selesai.
- Kolom: kasir yang bertugas, jumlah transaksi, penjualan.

**Buat/ubah event**
- Isian: nama, tempat, tanggal mulai dan selesai, catatan, pre-sale aktif/nonaktif (mode pre-sale hanya muncul kalau aktif), produk yang dijual, dan kasir yang bertugas.
- **Produk yang Dijual:**
  - Tabel varian yang dijual (nama, varian, harga normal, stok Gudang Pusat, stok di event saat ubah, harga event) dengan tombol "+ Produk" untuk memilih varian.
  - Form event tidak mengirim stok. Pengiriman selalu lewat tombol Kirim Stok di detail event, supaya setiap kiriman tercatat siapa dan kapan.
  - Harga event hanya diatur di sini. Kosong artinya memakai harga normal. Tombol Harga Event di detail event dihapus.
  - Minimal satu varian harus dipilih.
  - Hanya produk yang dipilih yang tampil di katalog POS event itu. Event lama yang belum punya daftar produk menampilkan semua produk.
- Nama event harus unik dan tidak boleh "Gudang Pusat".
- Kalau nama event diganti, stok dan transaksi ikut pindah ke nama baru.

**Detail event**
- Keterangan mode pre-sale, dan peringatan kalau ada pesanan pre-sale yang belum diambil.
- Event yang belum punya stok menampilkan ajakan Kirim Stok.
- Kalau ada stok opname kasir yang menunggu persetujuan, muncul catatan dengan tombol "Buka di Stok Opname". Persetujuan hanya dilakukan di Inventori › Stok Opname.
- KPI: penjualan, transaksi, produk terjual, rata-rata per transaksi, laba kotor.
- Metode pembayaran.
- Stok di event per varian: dikirim, ditarik, terjual, sisa.
- Mutasi stok ke event: nomor, waktu kirim/terima, qty kirim vs qty terima. Kekurangan diberi tanda merah.
- Shift kasir dan setoran: modal awal, tunai masuk, kas masuk/keluar, seharusnya, uang dihitung, selisih, catatan.
- Daftar transaksi, termasuk yang di-void beserta alasannya.

**Kirim Stok**
- Tabel barang dengan "+ Produk" (hanya varian yang dijual di event itu). Admin mengisi jumlah per varian, atau memakai tombol isi otomatis 30% stok gudang.
- Stok keluar dari gudang sebagai mutasi berstatus "Dikirim" dan tercatat sebagai stok transit.
- Stok baru masuk ke event setelah kasir menerimanya di POS.

**Harga Jual Langsung Gudang** tetap diatur dari Daftar Produk. Harga event diatur di form event.

**Tarik ke Gudang**
- Memindahkan sisa stok dari event kembali ke gudang secara langsung.

**Tutup Event** (halaman stok opname akhir event)
- Tabel per varian: stok sistem, isian stok fisik hasil hitung di booth, selisih, HPP, dan kerugian (selisih kurang × HPP). Total kerugian dihitung langsung saat mengetik. Isian kosong berarti sama dengan sistem.
- Saat disimpan: selisih dicatat sebagai stok opname berjenis "Tutup Event" (muncul di Inventori › Stok Opname), stok event disesuaikan ke jumlah fisik, lalu stok fisik kembali ke Gudang Pusat.
- Kalau kasir sudah mengirim stok opname dari POS, halaman ini menampilkan kartu **Stok opname SO/... · Menunggu persetujuan**: siapa yang menghitung, kapan, hasil kurang/lebih, kerugian, dan catatan. Isian stok fisik terisi dari hasil itu. Kalau ada penjualan setelah opname, angkanya disesuaikan supaya selisihnya tetap. Penjelasan selisih terisi dari catatan kasir.
  - **Setujui opname & tutup event**: event ditutup memakai hasil itu. Opname kasir berstatus *Disetujui* (dengan nama penyetuju), dan catatan penutupan menyebut "Stok opname dihitung [kasir], disetujui [penyetuju]".
  - **Minta opname ulang**: wajib menulis alasan. Opname berstatus *Perlu opname ulang*, dan kasir melihat permintaan itu di POS.
  - Detail event yang belum ditutup juga menampilkan status opname terakhir (menunggu persetujuan atau menunggu opname ulang).
- Kalau ada barang kurang, **penanggung jawab** (pilih karyawan, default kasir pertama event) dan **penjelasan selisih** wajib diisi. Event tidak bisa ditutup tanpa keduanya.
- Detail event yang sudah ditutup menampilkan kolom Selisih di tabel stok, total kerugian di catatan penutupan, dan laba kotor setelah dikurangi kerugian.
- Tidak bisa dijalankan selama masih ada shift terbuka.
- Mutasi yang belum diterima dibatalkan dan barangnya kembali ke gudang.
- Kalau masih ada pesanan pre-sale yang belum diambil, muncul peringatan. Pesanan itu tetap Menunggu dan diberi batas ambil di Gudang Pusat 7 hari, lalu otomatis menjadi "Perlu Refund".
- Aturan ini sama persis dengan Tutup Event dari POS Owner, karena keduanya memakai fungsi yang sama.

### 5.4 Pesanan Pre-sale

Halaman ini berisi daftar semua pesanan pre-sale untuk verifikasi pengambilan dan refund.

- Ringkasan: jumlah dan nilai pesanan yang menunggu diambil, perlu transfer kembali, sudah diambil, dan sudah di-refund.
- Tab status (Menunggu Diambil, Perlu Refund, Sudah Diambil, Sudah Refund, Semua) dan filter per event.
- Kolom: nomor transaksi, waktu dan kasir, event, nama dan no HP pembeli, barang, total dan metode bayar, status.
- Aksi:
  - **Batalkan & refund** untuk pesanan yang masih menunggu (misalnya pembeli berhalangan).
  - **Tandai sudah ditransfer** untuk pesanan Perlu Refund. Isian: bank tujuan, no. rekening, atas nama, catatan, dan **foto bukti transfer (wajib)**. "Ditandai oleh" terisi otomatis dengan akun yang sedang login. Foto dikompres sebelum disimpan. Setelah disimpan, transaksi berstatus Refund dan keluar dari penjualan serta laporan.
  - **Lihat bukti transfer** untuk pesanan yang sudah di-refund.
- Untuk pesanan yang sudah diambil, daftar mencatat tempat, kasir, dan cara verifikasi (scan QR atau manual).
- Unduh CSV untuk dicek bersama tim.
- Detail event juga menampilkan peringatan dan tautan "Lihat daftar pembeli" kalau ada pre-sale yang belum diambil.

Verifikasi pengambilan memakai scan QR di struk (lihat bagian 3, aturan pengambilan).

### 5.5 Penjualan Online

- **Daftar Pesanan.** Tab per saluran (Shopee, Tokopedia, TikTok Shop, Lainnya), dengan ringkasan penjualan kotor, potongan, dan pendapatan bersih.
- **Impor CSV/Excel**, tiga langkah:
  1. Pilih saluran dan file.
  2. Cocokkan kolom. Kecocokan kolom disimpan sebagai preset per saluran.
  3. Pratinjau, termasuk deteksi pesanan duplikat dan batal, serta pemasangan SKU yang tidak dikenal.
- **Input manual.** Pilihan produk hanya berisi produk yang aktif di saluran itu (saluran Lainnya menampilkan semua). Harga terisi dari harga marketplace produk. Potongan bisa diisi dengan perkiraan dari Biaya Marketplace.
- Pesanan online mengurangi stok Gudang Pusat.
- **Riwayat Impor.**
- **Biaya Marketplace.** Daftar toko marketplace dengan status aktif/nonaktif dan biaya (biaya admin %, biaya layanan %, biaya per pesanan Rp). Biaya ini hanya dipakai sebagai perkiraan saat input manual. Pesanan hasil impor memakai potongan asli dari file. Harga per produk tidak diatur di sini.

### 5.6 Produk

- **Daftar Kategori.**
- **Harga Jual Langsung Gudang.** Tombol di Daftar Produk untuk mengisi harga khusus saat Owner berjualan langsung dari Gudang Pusat. Kosong berarti harga normal.
- **Daftar Produk.** Kolom: HPP, harga jual (rentang kalau bervarian), margin, stok (total semua lokasi), marketplace tempat produk dijual, sakelar Tampil di POS, dan status. Baris varian bisa dibuka dan menampilkan harga tiap marketplace.
- **Tambah/Ubah Produk:**
  - Isian: nama, deskripsi, kategori, SKU induk, HPP, harga jual, satuan, batas stok menipis, Tampil di POS, Aktif.
  - Varian diisi lewat tabel nama, SKU, dan harga. SKU yang kosong dibuat otomatis.
  - Stok awal di Gudang Pusat hanya bisa diisi saat membuat produk baru. Setelah itu stok berubah lewat faktur, opname, atau mutasi.
  - Produk baru langsung muncul di POS.
  - **Harga Marketplace:** satu sakelar per marketplace (Shopee, Tokopedia, TikTok Shop), karena tidak semua produk dijual di marketplace. Kalau sakelar aktif, muncul tabel harga per varian. Harga yang dikosongkan memakai harga jual. Kalau sakelar dimatikan, produk dihapus dari daftar marketplace itu. Marketplace yang tokonya nonaktif diberi tanda "Toko nonaktif".

### 5.7 Inventori

Menu: Faktur Pembelian, Daftar Pemasok, Kelola Stok (Daftar Stok, Stok Opname, Stok Terbuang).

**Faktur Pembelian**
- Barang dari pemasok selalu masuk **Gudang Pusat**. Ke event lewat Event › Kirim Stok.
- Form: No. Faktur (otomatis), Tanggal*, Pemasok* (dari Daftar Pemasok, ada tautan tambah pemasok baru), tabel barang dengan "+ Produk" (Jumlah dan Harga Beli wajib), Status Bayar* (Lunas sekarang, atau Bayar nanti dengan Jatuh Tempo* dan uang muka opsional), cara bayar, catatan.
- Simpan: stok Gudang Pusat bertambah dan HPP produk dihitung ulang (lihat aturan HPP di bagian 7).
- Daftar: tab Semua / Belum lunas / Lewat jatuh tempo / Lunas. KPI pembelian bulan ini, belum dibayar, lewat jatuh tempo, jatuh tempo 7 hari ke depan.
- Detail faktur: barang, perubahan HPP, riwayat pembayaran, dan **Catat pembayaran** (jumlah maksimal sisa tagihan; tombol isi sisa). Status otomatis Lunas saat sisa 0.
- **Batalkan faktur:** hanya bisa kalau semua barang faktur itu masih ada di Gudang Pusat (belum dikirim ke event, dijual, atau terbuang). Kalau sebagian sudah terpakai, dashboard menolak dan menyebut barang mana yang kurang. Wajib isi alasan. Stok gudang berkurang lagi, HPP dihitung mundur dari rata-rata tertimbang, faktur tetap tersimpan dengan status Dibatalkan dan tidak dihitung di pembelian atau utang. Kalau sudah ada pembayaran, nilainya dicatat sebagai uang yang perlu diminta kembali ke pemasok.

**Daftar Pemasok**
- Nama*, telepon*, alamat, barang yang dipasok, rekening, catatan. Nama tidak boleh dobel.
- Tabel menampilkan jumlah faktur, total pembelian, dan sisa yang belum dibayar per pemasok.

**Daftar Stok**
- Tab **Per lokasi**: kolom Gudang Pusat, setiap event yang berjalan, Dalam perjalanan, Total, Stok min, Status (Aman / Di bawah minimum / Habis), dan baris total. Filter cari, kategori, dan "hanya di bawah stok minimum".
- Tab **Pergerakan** dengan rentang tanggal: Masuk (pembelian), Dikirim ke event, Terjual (semua saluran, dikurangi retur uang kembali), Hilang & rusak, Stok sekarang.
- Unduh CSV.

**Stok Opname**
- Semua opname nyata: opname gudang dari dashboard, hitungan kasir di POS, dan opname Tutup Event. Filter lokasi, status, dan rentang tanggal.
- **+ Opname Gudang**: alurnya sama dengan POS. Semua barang gudang tampil dengan stok sistem dan isian stok fisik; selisih dan kerugian langsung terhitung. Catatan wajib kalau ada selisih. Hasilnya berstatus Menunggu persetujuan; stok belum berubah.
- Persetujuan oleh Owner/Admin. Orang yang menghitung tidak boleh menyetujui hitungannya sendiri, kecuali Owner. Saat disetujui, stok disesuaikan dan barang kurang masuk Selisih & Kerugian dengan penanggung jawab. Bisa juga diminta opname ulang dengan alasan.
- Opname kasir yang dipakai saat Tutup Event berstatus "Dipakai Tutup Event", supaya selisihnya tidak terhitung dua kali.

**Stok Terbuang**
- Semua barang yang keluar dari stok tanpa terjual, masing-masing dengan penjelasan: hilang di perjalanan (kiriman kurang saat diterima), selisih opname, barang cacat dari retur, dan yang dicatat manual.
- **+ Catat Barang Terbuang**: Lokasi*, Tanggal*, Alasan* (Rusak, Hilang, Cacat dari pemasok, Berjamur atau lembap, Lainnya), Penjelasan* (minimal 10 huruf), Penanggung Jawab* (terisi otomatis dengan penanggung jawab event kalau lokasinya event), barang lewat "+ Produk" (jumlah maksimal stok di lokasi itu), foto opsional. Stok lokasi langsung berkurang; catatan tidak bisa diubah. Kerugian (jumlah × HPP) masuk Laporan › Selisih & Kerugian atas nama penanggung jawab dan harus diselesaikan seperti kerugian lain.
- KPI total pcs, nilai HPP, per jenis. Filter jenis, lokasi, tanggal. Unduh CSV.

### 5.8 Pelanggan dan Promosi

**Pelanggan**
- Pelanggan yang ditambahkan dari POS ikut tersimpan.
- Setiap transaksi POS yang memakai pelanggan masuk ke riwayat transaksi pelanggan itu.

**Promo**
- Satu menu **Promosi** berisi semua promo dalam satu daftar, dengan kolom Jenis (Potongan produk, Bonus produk, Bundling, Total belanja), filter jenis dan status, serta tombol Ubah dan Duplikat. **+ Tambah Promosi** menanyakan jenisnya dulu: Promo produk atau Promo total belanja.
- Promo hanya berlaku di POS. Promo marketplace diatur di Seller Center, jadi isian Platform dihapus dari form.
- **Berlaku di:** Semua lokasi (default), Gudang Pusat, atau satu event yang belum ditutup.
- Sebuah promo tampil di POS kalau:
  - statusnya Aktif (bukan Draf atau Tidak Aktif)
  - hari ini masuk periode tanggal promo
  - hari ini termasuk hari yang dicentang, dan jam sekarang di antara jam mulai dan jam selesai
  - lokasinya sama dengan tempat kasir, atau Semua lokasi
- Jenis bonus promo per produk: Potongan (%), Potongan (Rp), **Bonus Produk**, dan **Bundling**. Promo per total pembelian: Potongan (%) dan Potongan (Rp). Harga Coret dan Unggah Banner dihapus; harga khusus per event memakai Harga Event.
- **Bonus Produk (beli X gratis Y):** produk yang dibeli, beli minimal (pcs), satu produk bonus, jumlah bonus (pcs), dan pilihan berlaku kelipatan (beli 4 dapat 2). Barang gratis tetap mengurangi stok.
- **Bundling:** dua produk atau lebih dengan satu harga paket, satu pcs per produk, ukuran apa saja. Form menampilkan harga normal paket (varian termurah) dan besar hematnya. Harga paket harus lebih murah dari harga normal. Bisa berlaku kelipatan (2 paket = 2 × harga paket).
- **Satu promo per pesanan.** Promo tidak bisa digabung.
- Syarat: minimal pembelian (Rp) atau minimal kuantitas. Potongan Rp untuk total pembelian bisa "Berlaku Kelipatan" (contoh: Rp 10.000 per kelipatan Rp 100.000).
- **Aktivasi Otomatis:** POS langsung memasang promo otomatis yang syaratnya terpenuhi dan potongannya paling besar. Kalau kasir memilih promo lain, pilihan kasir yang dipakai. Kalau kasir menghapus promo otomatis, promo itu tidak dipasang lagi sampai keranjang dikosongkan.
- **Aktivasi Manual:** kasir memilih dari Promo Tersedia atau Tab Promo.
- **Validasi saat simpan:** Bonus Produk wajib punya produk yang dibeli, minimal beli, dan tepat satu produk bonus. Bundling wajib berisi minimal dua produk dan harga paket di bawah harga normal. Untuk potongan: besaran wajib diisi, persen maksimal 100%, promo produk wajib punya produk, tanggal dan jam selesai harus setelah mulai, minimal satu hari, batas ubah kasir tidak lebih kecil dari potongan, potongan Rp tidak lebih besar dari minimal pembelian.
- **Simpan Draft** menyimpan promo dengan status Draf. Draf tidak dipakai POS sampai diubah dan diaktifkan.
- **Daftar promo:** kolom Berlaku di, Dipakai (jumlah transaksi dan total potongan dari POS), dan Status yang dihitung otomatis: Aktif, Terjadwal (belum mulai), Berakhir (lewat tanggal), Tidak Aktif, atau Draf.

### 5.9 Pengaturan POS

Semua pengaturan tersimpan otomatis dan langsung terbaca oleh POS:

- Metode pembayaran: Tunai (dengan tombol uang cepat), QRIS (nama merchant, NMID, dan **unggah gambar QRIS statis**), Transfer (daftar rekening). Gambar QRIS dikecilkan otomatis dan bisa diganti atau dihapus.
- Diskon manual kasir dan batas persennya.
- Pembulatan total: tanpa pembulatan, Rp 100, Rp 500, atau Rp 1.000. Dibulatkan ke bawah.
- PPN dan tarifnya.
- Keamanan: kunci layar otomatis (mati, 5, 10, 20, atau 30 menit; default 20), masuk POS dengan PIN, dan void yang perlu PIN atasan.
- Tampilan katalog dan sisa stok di kartu.
- Isi struk (nama, baris info, pesan penutup, tampilkan kasir, tampilkan event), dengan pratinjau.
- Tombol "Reset Data" untuk kembali ke data contoh.

### 5.10 Karyawan

- Hanya **Owner** yang bisa menambah, mengubah, menonaktifkan, dan mereset akun karyawan. Admin hanya melihat.
- Kolom: nama dan telepon, email dashboard (atau "POS saja" untuk Kasir), role, status akun (password sementara/sudah diganti, PIN sementara/sudah diganti), event tempat ia bertugas, terakhir di POS, status aktif.
- **Tambah karyawan:** nama*, telepon, role* (Owner/Admin/Kasir). Kalau role Admin atau Owner: email* (unik, tanpa verifikasi) dan password sementara* (minimal 8 karakter, huruf dan angka; ada tombol Buat acak). Semua karyawan: PIN sementara* (6 angka, unik, tidak boleh sama semua atau berurutan; terisi acak otomatis).
- Setelah disimpan, muncul ringkasan email, password sementara, dan PIN sementara untuk dicatat dan diberikan ke karyawan. Data sementara ini hanya tampil sekali.
- **Ubah karyawan:** password dan PIN tidak ditampilkan. Tombol **Reset password** dan **Reset PIN** membuat data sementara baru yang wajib diganti lagi oleh karyawan.
- Harus selalu ada minimal satu Owner aktif. Karyawan nonaktif tidak bisa masuk dashboard maupun POS.
- **Riwayat Masuk POS** di bawah daftar karyawan: waktu, karyawan, aktivitas (termasuk "Masuk dengan PIN sementara" dan "Ganti PIN"), tempat, dan perangkat, dengan filter per karyawan. Jumlah PIN salah hari ini ditandai merah di judul.

**Tab Bertugas Hari Ini** (Karyawan › Bertugas Hari Ini)
- Satu kartu per lokasi aktif hari ini: Gudang Pusat dan setiap event yang berlangsung atau perlu ditutup.
- Event: penanggung jawab, laci yang sedang terbuka (siapa, sejak jam berapa, jumlah transaksi, penjualan), dan daftar kasir yang ditugaskan dengan status hari ini: Membuka kasir sejak jam X, Bergabung ke laci, Masuk POS jam X, Sudah keluar, atau **Belum masuk POS hari ini** (merah). Orang yang tidak ditugaskan tapi ikut berjualan di sana juga tampil.
- Gudang Pusat tidak punya petugas tetap; kartunya menampilkan siapa yang memakai POS di gudang hari ini.
- KPI: lokasi aktif, laci terbuka, ditugaskan tapi belum masuk POS, dan karyawan yang ditugaskan di dua event berlangsung sekaligus.
- Status diambil dari Riwayat Masuk POS hari ini dan laci kasir yang terbuka. Tautan "Detail event" membuka halaman event.

**Login dashboard**
1. Isi email dan password. Pesan salahnya sama untuk email yang tidak ada dan password yang salah ("Email atau password salah"). Akun Kasir saja ditolak ("Akun ini hanya untuk POS"), akun nonaktif ditolak.
2. Kalau password masih sementara, layar **Buat password baru** muncul sebelum dashboard bisa dipakai: password baru (minimal 8 karakter, huruf dan angka, tidak sama dengan yang lama) dan ulangi password. Tombol Keluar membatalkan login.
3. Menu akun › **Ganti password** kapan saja: password sekarang, password baru, ulangi.

---

## 6. POS (HP)

Tampilannya mengikuti prototipe kasir yang sudah ada, dengan warna oranye Hikayat. Di desktop, POS tampil dalam bingkai HP. Di HP, POS tampil layar penuh.

### 6.1 Masuk dan buka kasir

1. **Pilih nama** dari daftar karyawan aktif.
2. **PIN 6 angka.** Kalau PIN masih sementara dari Owner, layar **Buat PIN Anda sendiri** muncul: ketik PIN baru lalu ulangi. PIN baru tidak boleh sama dengan yang lama, tidak boleh 6 angka sama atau berurutan, dan tidak boleh dipakai karyawan lain. Setelah itu login berlanjut seperti biasa.
3. Kalau kasir sudah punya shift terbuka di tempat yang aktif, POS langsung melanjutkan shift itu. Owner selalu diarahkan ke layar pilih tempat jualan.
4. **Pilih event/tempat jualan.** Tiap tempat diberi label status: Berlangsung, Pre-sale, Perlu ditutup, atau Jual langsung, serta "Kasir terbuka · nama" kalau sudah ada shift di sana.
   Khusus Owner, setiap event juga punya tautan "Tutup event".
   Admin juga mendapat pilihan Gudang Pusat dengan label "Serah terima pre-sale". Di sana Admin hanya bisa menyerahkan pesanan pre-sale; menambah produk ke keranjang ditolak. Jual langsung dari gudang tetap khusus Owner.
5. Kalau tempat itu sudah punya kasir terbuka, pengguna langsung bergabung. Kalau belum, pengguna mengisi modal awal lalu menekan "Buka Kasir".

Kalau halaman dimuat ulang, sesi, keranjang, promo, dan pelanggan yang dipilih tetap kembali.

### 6.2 Halaman kasir

- **Header:**
  - nama tempat, nama kasir, dan status online/offline
  - tombol mode tampilan, kunci layar, dan menu
- **Pill Event/Tempat Jualan.** Labelnya menyesuaikan: Event, Tempat Jualan, "Belum mulai" (pre-sale nonaktif), "Pre-sale · ambil nanti", atau "Pre-sale · stok langsung". Isinya info tempat dan sisa stok per varian. Kalau ada kiriman stok yang belum diterima, muncul pengingat. Owner juga mendapat tombol "Ganti tempat" dan "Tutup event".
- **Pill Pelanggan.** Untuk memilih atau menambah pelanggan.
- **Tab Penjualan dan Daftar Order.**
- **Katalog** hanya berisi produk yang dipilih untuk event tersebut di dashboard. Di Gudang Pusat semua produk tampil.
- **Kategori:** Semua, Terlaris (4 produk paling laku), Promo, lalu kategori produk.
- **Mode tampilan:**
  - Grid: satu kartu per produk, dengan label jumlah varian dan sisa stok.
  - SKU: daftar per varian, untuk scan barcode.
- **Varian.** Mengetuk produk bervarian membuka pilihan ukuran berisi harga dan sisa stok. Ketuk lagi untuk menambah jumlah.
- **Batas stok.** Jumlah di keranjang tidak bisa melebihi stok di tempat itu. Pengecualian: pre-sale dengan mode "ambil nanti", di mana kartu produk bertuliskan "Pre-sale · ambil saat event" dan tidak dibatasi stok.
- **Harga event.** Kartu dan daftar SKU memakai harga event dan diberi tanda "harga event".
- **Bar total.** Ketuk total belanja untuk membuka keranjang dan mengubah jumlah atau menghapus per barang. Tombol Bayar menuju pembayaran.
- **Aksi tambahan:**
  - ••• untuk Hapus Pesanan (Custom Amount disembunyikan karena semua harga diatur dari dashboard)
  - Promosi
  - Simpan (ke Daftar Order)

- **Pre-sale "ambil nanti".** Struk di layar sukses memuat QR pengambilan dan catatan "ukuran tidak bisa ditukar". Sebelum bayar, POS mewajibkan pelanggan yang punya no HP. Kalau belum ada, kasir menambah pelanggan baru dengan no HP. Nama dan no HP ikut tersimpan di transaksi.

### 6.3 Promo

- Satu promo per order, tidak bisa digabung. Promo otomatis langsung terpasang begitu syaratnya terpenuhi (muncul pesan "... otomatis dipakai"); promo manual dipilih kasir dari Promo Tersedia atau Tab Promo.
- Promo produk berlaku untuk semua varian produk yang dipilih di dashboard, dengan syarat jumlah minimum bila ada.
- Promo yang mengizinkan kasir mengubah persen dibatasi oleh batas yang diatur di dashboard.
- **Bonus Produk:** saat promo dipasang dan syarat beli terpenuhi, barang bonus langsung masuk keranjang. Kalau produk bonus punya beberapa ukuran, sheet varian terbuka dan kasir memilih ukurannya. Potongan = harga barang bonus (yang termurah dulu kalau ada beberapa), maksimal sebanyak hak bonus. Barang bonus ikut mengurangi stok. Struk dan detail transaksi menulis "🎁 Gratis [barang] ×n".
- **Bundling:** promo bisa dipakai kalau semua produk paket ada di keranjang. Potongan = harga normal barang dalam paket − harga paket. Kalau ada yang kurang, POS memberi tahu produk mana yang perlu ditambahkan.
- **Tombol Promosi** (di atas total belanja) langsung membuka **Promo Tersedia**: hanya promo yang berlaku untuk produk di keranjang (promo produk yang produknya ada di keranjang, dan promo total belanja). Promo yang syaratnya terpenuhi bisa dipilih dan menampilkan besar hematnya; yang belum terpenuhi menampilkan kekurangannya.
- Semua promo yang aktif dilihat di Tab Promo. Kupon dan Poin dihapus.
- **Tab Promo** di halaman kasir: setiap kartu menampilkan syarat (potongan, produk, minimal pcs/belanja), tanda Otomatis, dan tombol status. Mengetuk kartu langsung memasang promo kalau syarat terpenuhi ("Pakai"), atau memberi tahu kekurangannya (contoh: "Kurang 1 pcs Kaos Burtuqol lagi", "Kurang belanja Rp 50.000 lagi"). Promo yang sedang dipakai bertanda "✓ Dipakai".
- Bar ••• / Promosi / Simpan selalu berada tepat di atas bar Total Belanja, berapa pun tinggi bar total.
- "Diskon Manual Kasir" muncul kalau diaktifkan di Pengaturan POS, dengan batas persen dari dashboard.

### 6.4 Pembayaran

- **Ringkasan:** total tagihan, sisa tagihan, kembalian, rincian pesanan, promo, PPN, dan pembulatan.
- **Tunai:** tombol uang pas, dua nominal pembulatan ke atas, atau nominal lain.
- **QRIS:** kalau gambar QRIS statis sudah diunggah di dashboard, POS menampilkan gambar itu beserta nominal tagihan. Kasir mengisi **4 digit terakhir no. referensi** dari notifikasi dana masuk di aplikasi merchant (wajib, tombol "Dana Sudah Masuk" baru aktif setelah 4 angka terisi), lalu menekan "Dana Sudah Masuk". Semua kasir boleh mengonfirmasi tanpa PIN atasan. 4 digit itu tersimpan di transaksi (termasuk tiap bagian pisah bayar) dan tampil di struk, riwayat POS, dan daftar transaksi dashboard untuk dicocokkan dengan laporan aplikasi merchant. Saat ini hanya QRIS statis: pembeli mengetik nominal sendiri, tidak ada cek pembayaran otomatis. Kalau gambar belum diunggah, POS menampilkan contoh QR bertanda "CONTOH" dengan peringatan merah agar admin mengunggah gambar asli.
- **Transfer:** daftar rekening dengan tombol salin.
- Setelah lunas:
  - transaksi tersimpan
  - stok tempat jualan berkurang
  - layar sukses menampilkan struk (sesuai pengaturan), tombol Cetak (simulasi) dan PDF, serta kotak "Kirim struk PDF ke WhatsApp" dengan no HP pelanggan terisi otomatis. Setelah terkirim muncul "✓ Struk PDF terkirim ke WA ..." dengan tombol Lihat PDF dan Kirim ulang
  - untuk pre-sale, struk PDF langsung dikirim otomatis ke WA pembeli memakai no HP yang wajib diisi saat pre-sale
  - cadangan tanpa layanan API: tombol "Kirim dari WhatsApp HP ini" membagikan PDF lewat menu share HP (Android/iOS) ke WhatsApp. Kalau HP tidak mendukung, PDF diunduh dan chat WA pembeli dibuka supaya kasir melampirkannya
  - detail transaksi di riwayat juga punya kotak kirim struk WA yang sama
  - untuk pre-sale "ambil nanti", stok tidak berkurang dan struk diberi catatan "PRE-SALE · barang diambil di booth ... mulai tanggal ..."

### 6.5 Pisah Bayar

Pisah Bayar dipakai untuk DP atau pembayaran campuran, dan **hanya untuk sebagian tagihan**.

1. Pesanan disimpan dulu ke Daftar Order dengan nomor `PSN/yymmdd/nn`.
2. Kasir memilih salah satu cara:
   - **Pisah Jumlah:** nominal harus lebih dari 0 dan lebih kecil dari sisa tagihan.
   - **Pisah Produk:** total produk yang dipilih harus lebih kecil dari sisa tagihan. Tidak bisa dipakai untuk pesanan 1 barang, atau kalau barang termurah sudah menyamai sisa tagihan.
3. Setelah dibayar sebagian, pesanan berstatus "Bayar Sebagian" di Daftar Order.
4. Pelunasan dilakukan lewat pembayaran biasa atau tombol "Lunasi Tagihan".

Transaksi baru tercatat di dashboard saat lunas, dengan rincian semua pembayaran. Uang DP juga baru dihitung sebagai uang di laci setelah pesanan lunas (keputusan Owner). Kalau metodenya lebih dari satu, metode transaksi ditulis "Campuran".

### 6.6 Daftar Order

- Filter: Semua, Belum Bayar, Bayar Sebagian.
- Daftar Order disimpan di HP per shift, sehingga tidak hilang saat halaman dimuat ulang atau saat Owner pindah tempat.
- Pesanan yang dibuka dari Daftar Order lalu dikosongkan dari keranjang tetap kembali ke Daftar Order.

### 6.7 Menu utama

| Menu | Fungsi |
|---|---|
| Ganti Event / Tempat Jualan | Khusus Owner. Keranjang harus kosong. Kasir sebelumnya tetap terbuka |
| Penjualan | Riwayat transaksi shift ini atau semua di event. Detail, cetak ulang, dan void dengan alasan (Salah input, Pembeli batal, Salah metode bayar). Tombol "📷 Scan QR" di kanan atas. Tab "Pre-sale" (di event) atau "Ambil di kantor" (di Gudang Pusat) berisi pesanan yang bisa diambil di tempat itu. Detail pesanan menampilkan QR, nama dan no HP pembeli, tombol "Scan QR di Struk Pembeli", dan "Struk hilang? Verifikasi manual". Tombol "Serahkan Barang" baru muncul setelah QR cocok atau verifikasi manual disetujui |
| Laporan | Laporan kasir per shift, Kas Kasir, Produk Terjual |
| Riwayat Masuk | Pengganti Absensi. Mencatat setiap pemakaian PIN di POS: Masuk, Buka kasir, Gabung kasir, Buka kunci layar, Terkunci otomatis, Tutup kasir, Keluar, dan PIN salah (login, kunci layar, tutup kasir). Tiap catatan berisi nama, role, tempat, jam, dan kode perangkat HP. Filter Hari ini, 7 hari, Semua. Kasir hanya melihat riwayatnya sendiri; Admin dan Owner melihat semua |
| Inventori | Terima Mutasi Stok dan Stok Opname |
| Pengaturan | Ringkasan pengaturan dari dashboard (hanya baca) dan info perangkat |
| Tutup Kasir | Hitung uang laci dan setor |
| Kunci Layar | Kunci sementara. Dibuka dengan PIN kasir yang sedang bertugas. POS juga terkunci sendiri kalau tidak disentuh selama waktu di Pengaturan POS (default 20 menit), lalu kembali ke layar terakhir setelah dibuka |
| Keluar Kasir | Ganti pengguna, shift tetap terbuka |

### 6.8 Laporan di POS

- **Laporan kasir.** Daftar shift di event ini dengan saldo awal, saldo akhir, kasir, dan keterangan "Kas pas" atau "Kurang/Lebih Rp x". Ringkasan per shift dibagi menjadi Produk, Ekstra (custom amount), dan Pembayaran.
- **Kas Kasir.** Berisi pemasukan (modal + kas masuk), pengeluaran, total void, uang di laci, dan penjualan semua metode. Tombol "+ Transaksi" mencatat uang masuk/keluar beserta catatan.
- **Produk Terjual.** Periode: Hari Ini, Kemarin, 7 Hari Terakhir, Minggu Ini, Minggu Lalu, atau Selama Event. Filter tempat: event ini atau semua event. Daftar produk terjual dan produk void.

### 6.9 Inventori di POS

**Terima Mutasi Stok** (kiriman hanya dibuat dari dashboard)
1. POS tidak bisa membuat mutasi. Kiriman dibuat Admin/Owner di dashboard (Event › Kirim Stok), dari Gudang Pusat ke event.
2. Tab Mutasi Stok menampilkan "Menunggu diterima" (kiriman berstatus Dikirim untuk tempat ini, dengan pengirim, tanggal, dan isi) dan "Sudah diterima".
3. Mengetuk kiriman membuka halaman terima: jumlah diterima sudah terisi sesuai jumlah dikirim, tidak bisa lebih. Kekurangan per barang dan totalnya langsung tampil. Catatan wajib kalau ada yang kurang.
4. **Terima barang**: stok event bertambah sebesar jumlah diterima, kekurangan dicatat hilang di perjalanan, penerima tercatat.
5. Penerimaan bisa di-void selama barangnya belum terjual. Mutasi kembali berstatus "Dikirim".
6. Gudang Pusat tidak menerima kiriman di POS.
7. Khusus prototipe: tombol **Simulasi: kirim stok dari dashboard** membuat kiriman dari Gudang Pusat (3 barang event, maksimal 5 pcs) seolah dikirim Admin dari dashboard.

**Stok Opname** (tampilannya sama dengan Tutup Event)
1. Semua barang di event langsung tampil, masing-masing dengan stok sistem dan isian stok fisik. Kosong berarti sama dengan sistem. Tidak perlu memilih atau scan produk.
2. Selisih per barang dan total barang kurang/lebih langsung tampil. Kasir bisa menambah catatan.
3. **Kirim hasil opname**: tersimpan sebagai stok opname "Akhir Event" berstatus *Menunggu persetujuan*, atas nama kasir yang login. Stok belum berubah.
4. Mengirim opname baru menggantikan opname sebelumnya yang belum disetujui (status *Diganti*).
5. Kalau Owner/Admin meminta opname ulang, daftar Stok Opname di POS menampilkan alasannya, dan kasir menghitung ulang dari sana.
6. **Persetujuan di tengah event:** opname bisa disetujui kapan saja tanpa menutup event, dari dashboard (Inventori › Stok Opname) atau dari POS oleh Owner/Admin (daftar Stok Opname › kartu "menunggu persetujuan"). Layar persetujuan menampilkan barang yang selisih, penanggung jawab, dan penjelasan (wajib kalau ada barang kurang). Setelah disetujui, stok event langsung disesuaikan dengan hasil hitung (penjualan setelah opname tetap diperhitungkan), dan kerugiannya masuk ke Selisih & Kerugian. Event tetap berjalan. Kasir hanya melihat status "menunggu persetujuan".

Faktur Pembelian disembunyikan dari POS, karena pembelian dicatat di gudang.

### 6.10 Scan QR pengambilan pre-sale

1. Dibuka dari tombol Scan QR di Penjualan, dari detail pesanan, atau dari info event.
2. Kamera belakang aktif dengan bingkai pemindai. Kalau izin kamera ditolak, kasir memakai "Ambil foto QR".
3. QR yang terbaca langsung membuka pesanan dengan tanda "QR di struk cocok".
4. Kalau QR bukan struk Hikayat, pesanan untuk event lain, belum waktunya, sudah diambil, atau sudah di-refund, POS menampilkan alasannya dan barang tidak bisa diserahkan.
5. Kolom "cari nomor transaksi" tersedia untuk keadaan darurat, tapi tetap harus lewat verifikasi manual (4 digit no HP + PIN atasan).

Pembuat dan pembaca QR (qrcode-generator, jsQR) ditanam di dalam `pos.html`, jadi tetap jalan tanpa internet.

### 6.11 Tutup event dari HP (Owner)

1. Dibuka dari tautan "Tutup event" di layar Pilih Tempat Jualan, atau dari info event.
2. Kalau masih ada kasir terbuka, tombol Tutup Event mati. Setiap kasir yang terbuka mendapat tombol **"Tutup kasir [nama]"**, termasuk laci milik kasir lain dan laci yang sedang dipakai Owner. Owner menghitung uang laci dan menyetujui dengan PIN-nya. Setelah kasir ditutup, layar Tutup Event terbuka lagi otomatis supaya Owner bisa langsung menyetujui opname dan menutup event.
3. Kalau ada opname dari kasir yang menunggu persetujuan, tombol Tutup Event mati. Sheet memberi tombol **Periksa opname** yang membuka layar persetujuan di Inventori; setelah disetujui atau diminta ulang, layar Tutup Event terbuka lagi.
3. Sheet menampilkan kiriman stok yang akan dibatalkan, pesanan pre-sale yang belum diambil, dan daftar stok untuk dihitung. Kalau ada barang kurang, Owner wajib memilih penanggung jawab dan mengisi penjelasan. Owner mengisi stok fisik per barang; selisih dicatat sebagai kerugian dan stok fisik kembali ke Gudang Pusat, sama seperti di dashboard.
4. Setelah ditutup, event hilang dari pilihan POS dan berstatus Selesai di dashboard.

### 6.12 Tutup kasir

1. Layar ringkasan menampilkan transaksi, tunai, QRIS, transfer, total, dan void.
2. Bagian uang di laci menampilkan modal awal + penjualan tunai + kas masuk − kas keluar = **seharusnya**.
3. Kasir mengisi hitungan uang fisik. Selisih langsung tampil (pas, kurang, atau lebih). Catatan bersifat opsional.
4. **Kalau uang kurang**, muncul pilihan penanggung jawab (default pemilik laci) dan penjelasan yang wajib diisi. Kekurangan dicatat sebagai kerugian "Kas laci" di Selisih & Kerugian dan diselesaikan sama seperti kerugian stok.
5. Kasir memasukkan PIN, baik PIN sendiri atau PIN Admin/Owner. Owner boleh menutup laci kasir lain cukup dengan PIN Owner; nama pemilik laci tetap tercatat di shift dan dashboard menulis "ditutup [nama Owner]".
6. Shift tertutup dan muncul di dashboard. Kalau shift yang ditutup adalah shift yang sedang dipakai: Kasir/Admin kembali ke layar masuk, sedangkan **Owner tetap masuk** dan dibawa ke layar Pilih Tempat Jualan (tidak perlu membuka kasir lagi untuk menutup event).

### 6.13 Retur barang cacat

Retur hanya untuk barang cacat. Tidak ada retur karena salah ukuran atau berubah pikiran.

1. Dibuka dari Riwayat Penjualan › detail transaksi › **Retur barang cacat**. Tombol muncul untuk transaksi lunas yang barangnya sudah diserahkan dan masih punya barang yang belum diretur.
2. Kasir memilih barang dan jumlahnya. Jumlah dibatasi pembelian dikurangi retur sebelumnya.
3. Penyelesaian:
   - **Tukar barang yang sama:** barang pengganti diambil dari stok di tempat itu (dicek cukup).
   - **Uang kembali:** tunai dari laci atau transfer oleh Admin. Nilainya sesuai harga yang dibayar setelah promo. Tunai ditolak kalau uang di laci tidak cukup.
4. Kerusakan wajib ditulis. Foto barang cacat bisa diambil dari kamera.
5. Wajib PIN Admin/Owner, termasuk kalau yang login Admin/Owner sendiri.
6. Barang cacat tidak kembali ke stok jual dan dicatat sebagai **rusak** di stok lokasi itu. Tukar barang mengurangi stok sebanyak barang pengganti.
7. Uang kembali tunai mengurangi uang laci seharusnya (baris "− Retur uang kembali" di Tutup Kasir).
8. Transaksi yang sudah diretur tidak bisa di-void. Detail transaksi menampilkan semua retur beserta penyetujunya.

---

## 7. Aturan bisnis dan rumus

| Hal | Aturan |
|---|---|
| Penjualan bersih (Keuangan) | Penjualan (harga jual × qty) − diskon & promo − pembulatan − retur uang kembali − potongan marketplace. PPN tidak termasuk |
| Laba kotor (Keuangan) | Penjualan bersih − HPP barang terjual − HPP barang pengganti retur |
| Laba bersih | Laba kotor − biaya (dicatat + kas keluar laci) − kerugian + penggantian dari penanggung jawab + selisih kas lebih |
| Pre-sale di laporan keuangan | Masuk penjualan saat barang diserahkan. Sebelum itu tercatat sebagai uang diterima dan kewajiban ke pembeli |
| Sell-through event | Terjual ÷ barang yang diterima di event |
| Bagian biaya umum event | Kalau diaktifkan: untuk tiap bulan, biaya umum bulan itu × (penjualan bersih event bulan itu ÷ penjualan bersih semua saluran bulan itu) |
| Titik impas event | (Biaya + kerugian − penggantian) ÷ margin kotor event |
| Nilai persediaan | Σ stok × HPP per lokasi, termasuk barang dalam perjalanan |
| Penjualan kotor (offline) | Subtotal − diskon/promo. PPN dan pembulatan tidak dihitung sebagai penjualan |
| Penjualan kotor (online) | Σ qty × harga dari pesanan |
| Bersih | Kotor − potongan marketplace |
| Laba kotor | Bersih − HPP (qty × HPP produk) |
| Margin | Laba kotor ÷ bersih |
| HPP setelah pembelian | Rata-rata tertimbang per produk: (stok lama semua lokasi termasuk dalam perjalanan × HPP lama + jumlah beli × harga beli) ÷ (stok lama + jumlah beli) |
| HPP setelah faktur dibatalkan | (stok sekarang × HPP sekarang − jumlah faktur × harga beli) ÷ (stok sekarang − jumlah faktur). Kalau stok habis atau hasilnya tidak masuk akal, kembali ke HPP sebelum faktur itu |
| Status faktur | Dibatalkan kalau faktur dibatalkan; Lunas kalau sisa 0; Lewat jatuh tempo kalau belum lunas dan jatuh tempo sudah lewat; selain itu Belum lunas |
| PPN | (subtotal − diskon) × tarif, kalau PPN aktif |
| Pembulatan | Total dibulatkan ke bawah ke kelipatan yang dipilih |
| Uang di laci seharusnya | Modal awal + pembayaran tunai + kas masuk − kas keluar − retur uang kembali tunai |
| Kas laci kurang | Selisih negatif saat tutup kasir. Wajib penanggung jawab dan penjelasan, lalu masuk Selisih & Kerugian |
| Promo Bonus Produk | Hak bonus = (jumlah dibeli ÷ minimal beli, dibulatkan ke bawah; maksimal 1 kalau tidak kelipatan) × jumlah bonus. Kalau produk bonus sama dengan produk yang dibeli, satu set = minimal beli + jumlah bonus. Potongan = harga barang bonus termurah di keranjang sebanyak hak bonus |
| Promo Bundling | Jumlah paket = jumlah terkecil dari tiap produk paket (maksimal 1 kalau tidak kelipatan). Potongan = harga normal barang termahal di setiap produk sebanyak jumlah paket − jumlah paket × harga paket |
| Gabung promo | Tidak boleh. Satu pesanan satu promo |
| Retur barang cacat | Uang kembali = harga × qty × (total ÷ subtotal transaksi). Barang cacat dicatat rusak, tidak kembali ke stok jual |
| Opname disetujui di tengah event | Stok event = stok sekarang + (fisik − sistem saat dihitung). Kerugian = barang kurang × HPP |
| Selisih kas | Uang dihitung − seharusnya |
| Stok event | Masuk lewat mutasi diterima, keluar lewat penjualan, void mengembalikan, opname menyesuaikan |
| Stok total | Jumlah stok semua lokasi. Stok transit dicatat terpisah sampai mutasi diterima atau dibatalkan |
| Harga jual offline | Harga event kalau diisi, kalau tidak harga normal varian. Promo dihitung dari harga ini |
| Void | Status transaksi menjadi Void dan tidak dihitung di penjualan. Stok kembali ke tempat jualan, kecuali pre-sale yang barangnya belum diserahkan |
| Pre-sale "ambil nanti" | Wajib nama dan no HP pembeli. Stok berkurang saat barang diserahkan, bukan saat transaksi. Penjualan tetap dihitung pada tanggal transaksi |
| Verifikasi pengambilan | Scan QR di struk; cadangan: 4 digit no HP + PIN Admin/Owner |
| Pengambilan setelah event ditutup | Boleh di Gudang Pusat selama belum di-refund; stok Gudang Pusat yang berkurang |
| Tukar ukuran pre-sale | Tidak boleh |
| Pre-sale tidak diambil | Saat event ditutup, pesanan diberi batas ambil di Gudang Pusat 7 hari. Lewat batas, status menjadi Perlu Refund. Uang di-transfer kembali dari rekening perusahaan, lalu transaksi berstatus Refund dan tidak dihitung lagi di penjualan. Setoran kasir tidak berubah karena uangnya memang diterima saat itu |
| Sumber harga | Semua dari dashboard: harga normal produk, Harga Event, atau Harga Jual Langsung Gudang. POS tidak bisa mengubah harga |
| DP / pisah bayar | Dihitung sebagai penjualan dan uang di laci setelah pesanan lunas |
| Kunci otomatis | Terkunci setelah N menit tanpa sentuhan (N dari Pengaturan POS, 0 = mati) |
| Pesanan online batal | Tidak dihitung di ringkasan maupun laporan |
| Satu laci per tempat | Hanya satu shift terbuka per event/tempat jualan |
| Batas isian angka | Isian jumlah yang punya batas langsung diturunkan ke angka maksimal saat diketik, disertai pesan "Maksimal ...". Berlaku untuk: kirim stok di form event dan Kirim/Tarik Stok (stok tersedia), qty pesanan manual (stok lokasi yang dikurangi), barang diterima dari mutasi (jumlah dikirim), pisah bayar (sisa tagihan dikurangi Rp 1), uang keluar dari laci (uang di laci), dan penggantian kerugian (sisa kerugian). Varian yang stok gudangnya habis tidak bisa diisi |
| Pertanggungjawaban kerugian | Setiap kerugian punya penanggung jawab dan penjelasan. Sisa = kerugian − semua penggantian − beban perusahaan. Hanya Owner yang boleh membebankan ke perusahaan |
| Kerugian tutup event | (stok sistem − stok fisik) × HPP per varian, hanya untuk selisih kurang. Barang lebih tidak mengurangi kerugian |
| Nomor transaksi | `RTR-yymmdd-nn-k` untuk retur ke-k dari transaksi `HK-yymmdd-nn`, `HK-yymmdd-nn` untuk transaksi lunas, `PSN/yymmdd/nn` untuk pesanan tersimpan, `MT/yymmdd/nn` untuk mutasi, `SO/...` untuk stok opname |

---

## 8. Model data

Kedua aplikasi membaca kunci `localStorage` yang sama, dengan awalan `hk2:`. Daftar entitas utama:

| Kunci | Isi | Ditulis oleh |
|---|---|---|
| `produk` | nama, sku, kategori, satuan, modal (HPP), jual, status, tampilPos, stokMin, deskripsi, varian[sku, nama, jual] | Dashboard |
| `kategori` | nama, urutan, tampilMenu | Dashboard |
| `stok` | per SKU: nama, parent, awal, masuk, keluar, terjual, akhir, terbuang, rusak, transit, perOutlet[outlet, awal, masuk, keluar, terjual, akhir, terbuang, rusak] | Keduanya |
| `events` | id, nama, venue, mulai, selesai, kasir[], pj (penanggung jawab event), varian[] (SKU varian yang dijual), catatan, presaleAktif, presale (ambil/stok), produk[] (SKU induk yang dijual), harga{sku: harga}, ditutup, tutup{waktu, oleh, kembali{sku: qty fisik}, selisih{sku: qty}, kerugian} | Dashboard, POS (tutup event oleh Owner) |
| `mutasi` | no, dari, ke, eventId, tglKirim, tglTerima, oleh, penerima, status (Dikirim/Diterima/Batal), items[sku, nama, dikirim, diterima] | Keduanya |
| `trx` | id, no, noPesanan, eventId, lokasi, shiftId, kasir, waktu, items[sku, nama, qty, harga, hpp], subtotal, diskon, promo, pajak, pembulatan, total, metode, pembayaran[metode, jumlah, ref (4 digit terakhir referensi QRIS)], dibayar, kembalian, pelanggan{kode, nama, telepon}, status (Lunas/Void/Refund), void{oleh, alasan, waktu}, bonus[sku, nama, qty, harga] (barang gratis dari promo Bonus Produk), paket{nama, jumlah, harga}, retur[no, waktu, eventId, lokasi, shiftId, oleh, disetujui, items[sku, nama, qty, harga], cara (Tukar barang/Uang kembali), metode (Tunai/Transfer), nilai, alasan, foto], pengambilan{status (Menunggu/Diambil/Perlu Refund/Refund/Batal), waktu, oleh, catatan, batas (tanggal akhir ambil di Gudang Pusat)}, struk{wa, waktu, status (Terkirim/Dibagikan), via, ukuran}, refund{waktu, oleh, bank, norek, an, catatan, bukti (foto)}; pengambilan juga mencatat lokasi dan cara (QR/Manual) | POS, dashboard (refund) |
| `shift` | id, eventId, kasir, buka, modal, tutup, kasHitung, catatan, ditutupOleh, kasKurang{pj, alasan, status, riwayat[]}, kas[nama, jenis, jumlah, waktu, catatan] | POS, Dashboard (penyelesaian kas kurang) |
| `orders` | pesanan online: saluran, noPesanan, tanggal, pembeli, status, potongan, items, moves, oleh (akun dashboard yang menginput/mengimpor) | Dashboard |
| `channel` | nama, status, produk[] (SKU varian yang aktif di marketplace itu + hargaJual, diisi dari form produk), biayaAdmin, biayaLayanan, biayaPesanan | Dashboard |
| `pos` | pengaturan POS (keuAlokasi: bagi biaya umum ke event, metode, rekening, QRIS, struk, pajak, pembulatan, diskon, PIN, kunciMenit, tampilan) dan hargaGudang{sku: harga} | Dashboard |
| `staff` | nama, telp, role[], email, pw (hash), pwBaru (password masih sementara), pwDiganti, pin, pinBaru (PIN masih sementara), pinDiganti, aktif | Dashboard (Owner), POS (ganti PIN) |
| `pelanggan` | kode, nama, telepon, grup, kota, poin, transaksi[] | Keduanya |
| `promoProduk`, `promoTotal` | daftar promo beserta detail (lokasi, periode, jenis bonus (persen/rp/bonus-produk/bundling), besaran, maks potongan, minimal, bonusProduk[], jumlahBonus, hargaPaket, berlakuKelipatan) | Dashboard |
| `opname` | no, jenis (Akhir Event dari POS, Tutup Event saat penutupan), status (Menunggu persetujuan/Perlu opname ulang/Diganti/Disetujui), disetujui{oleh, waktu}, ulang{oleh, waktu, catatan}, eventId, lokasi, waktu, oleh, catatan, produk[sku, sistem, fisik/stok, selisih, hpp, kerugian], kerugian, tanggungJawab{pj, alasan, status, riwayat[jenis, jumlah, cara, catatan, oleh, waktu]} | POS, Dashboard |
| `faktur` | no, tanggal, pemasokId, items[sku, nama, qty, harga], total, jatuhTempo, catatan, oleh, waktu, bayar[tanggal, jumlah, cara, catatan, oleh], hpp, batal{alasan, oleh, waktu, hpp, kembali}[produk, lama, baru] | Dashboard |
| `pemasok` | id, nama, telp, alamat, barang, rekening, catatan | Dashboard |
| `biaya` | id, no (BY/yymmdd/nnnn), tanggal, eventId (null = umum), kategori, keterangan, jumlah, cara, foto, oleh, waktu, diubah{oleh, waktu} | Dashboard |
| `terbuang` | no, tanggal, waktu, lokasi, alasan, penjelasan, items[sku, nama, qty], oleh, foto, kerugian, tanggungJawab{pj, alasan, status, riwayat[]} | Dashboard |
| `masuk` | id, nama, role, aksi, tempat, waktu, perangkat (kode HP, disimpan sekali per perangkat). Maksimal 1.000 catatan terakhir | POS, Dashboard (Karyawan) |

Gudang Pusat sebagai tempat jualan memakai `eventId = "gudang"`.

Data yang hanya disimpan di HP kasir:
- `hk2pos:sesi2`: kasir yang masuk, shift, keranjang, promo, pelanggan.
- `hk2pos:held2`: Daftar Order per shift.

---

## 9. Cara mencoba prototipe

1. Simpan `dashboard.html`, `pos.html`, dan `demo.html` di satu folder, lalu buka `demo.html` di Chrome.
2. Akun demo (dashboard: email dan password; POS: PIN):
   - Rina Wijaya (Owner): rina@hikayat.id / hikayat123, PIN 111111
   - Dimas Pratama (Admin): dimas@hikayat.id / hikayat123, PIN 222222
   - Sari Handayani (Kasir): POS saja, PIN 333333
   - Budi Santoso (Admin, Kasir): budi@hikayat.id / hikayat123, PIN 444444
   - Laila Nur (Admin, Kasir), karyawan baru yang belum pernah masuk: laila@hikayat.id / sementara1, PIN sementara 582914. Keduanya diminta diganti saat pertama masuk.
3. Data contoh dibuat relatif terhadap tanggal hari ini:
   - **Pameran Buku Surabaya:** sudah selesai.
   - **Hikayat Fest Bandung:** sedang berlangsung. Budi sudah membuka kasir, dan ada kiriman restock yang belum diterima.
   - **Hikayat Fest Bandung** punya harga event: Totebag Rp 40.000 dan Kaos Polos Rp 35.000.
   - **Kajian Akbar Istiqlal:** akan datang, mode pre-sale "ambil nanti", dengan harga event Kaos Burtuqol Rp 115.000 (XL Rp 125.000). Sudah ada 2 pesanan pre-sale atas nama Fajar Ramadhan dan Umar Faruq.
   - Satu pesanan pre-sale dari Pameran Buku Surabaya (Nadia Putri) berstatus Perlu Refund.

Skenario uji yang disarankan:

| No | Skenario | Yang dicek |
|---|---|---|
| 1 | Sari masuk, jual 2 Kaos Burtuqol L + 1 Jersey dengan promo "Jersey Fest", bayar tunai | Stok varian berkurang, transaksi dan promo muncul di Dashboard › Event |
| 2 | Simpan pesanan, buka dari Daftar Order, lalu Hapus Pesanan | Pesanan kembali ke Daftar Order |
| 3 | Pisah Bayar Rp 100.000 tunai, lunasi sisanya dengan QRIS | Tidak bisa memisah seluruh tagihan; transaksi tercatat "Campuran" |
| 4 | Void transaksi sebagai Sari | Diminta PIN Admin/Owner; stok kembali |
| 5 | Inventori › Terima Mutasi, kurangi 1 barang | Dashboard menandai "kurang 1" |
| 6 | Kas Kasir: tambah uang keluar Rp 15.000, lalu Tutup Kasir dengan hitungan berbeda | Selisih muncul di POS dan di tabel setoran dashboard |
| 7 | Rina masuk, jual dari Gudang Pusat, lalu ganti ke Hikayat Fest | Bergabung ke laci Budi; Laporan › Per Event menampilkan Gudang Pusat |
| 8 | Ubah Pengaturan POS (matikan Transfer, aktifkan PPN 11%) di tab dashboard | POS langsung mengikuti tanpa dimuat ulang |
| 9 | Tutup event Bandung di dashboard | Ditolak selama ada shift terbuka; sesudahnya sisa stok kembali ke gudang |
| 10 | Rina buka kasir di Kajian Istiqlal, jual 2 Kaos Burtuqol S | Harga Rp 115.000, stok tidak berkurang, struk bertanda PRE-SALE, dashboard memberi peringatan pre-sale belum diambil |
| 11 | Ubah tanggal mulai Kajian ke hari ini, kirim dan terima stok, lalu Penjualan › Pre-sale › Serahkan Barang | Stok event berkurang saat barang diserahkan |
| 12 | Rina: Pilih Tempat Jualan › "Tutup event" pada event yang kasirnya masih terbuka | Tombol Tutup Event mati sampai kasir ditutup |
| 13 | Dashboard › Event Bandung › Harga Event, isi harga Jersey L | Kartu Jersey di POS menampilkan harga baru dan tanda "harga event" |
| 14 | Biarkan POS tidak disentuh 20 menit | Layar terkunci; setelah PIN, kembali ke layar terakhir |
| 15 | Rina jual pre-sale di Kajian tanpa memilih pelanggan | Ditolak; POS membuka daftar pelanggan |
| 16 | Dashboard › Pesanan Pre-sale › Perlu Refund › Tandai sudah ditransfer (Nadia Putri) | Status Refund, penjualan Surabaya berkurang Rp 175.000 |
| 17 | Tutup Kajian (tutup kasirnya dulu) | Pesanan pre-sale tetap Menunggu dengan keterangan "Ambil di Gudang Pusat sampai ..." (7 hari). Lewat tanggal itu, pindah ke tab Perlu Refund |
| 18 | Daftar Produk › Harga Jual Langsung Gudang, isi Totebag Rp 42.000, lalu Rina jual dari Gudang Pusat | POS memakai Rp 42.000 |
| 19 | Jual pre-sale di Kajian, foto QR di struk; ubah tanggal mulai Kajian ke hari ini, kirim stok, lalu Scan QR › Ambil foto QR | Pesanan terbuka dengan "QR cocok"; setelah diserahkan, scan ulang menolak |
| 20 | Pesanan Umar: Struk hilang › 4 digit salah, lalu 7766 + PIN 222222 | Digit salah ditolak; sesudahnya bisa diserahkan, tercatat "verifikasi manual" |
| 21 | Rina di Gudang Pusat › Penjualan › Ambil di kantor › pesanan Nadia (Surabaya) | Barang diserahkan dari gudang, status Perlu Refund berubah menjadi Diambil |
| 22 | Dashboard › Pesanan Pre-sale › Tandai sudah ditransfer tanpa foto | Ditolak sampai foto bukti diunggah |
| 23 | Buka dashboard, masuk sebagai Dimas (222222), lalu tandai refund | "Ditandai oleh" otomatis Dimas Pratama; Sari (Kasir) tidak muncul di pilihan login |
| 24 | Event › Buat Event, pilih Kaos Burtuqol dan Tumbler, kirim 10 Kaos L dan 6 Tumbler, harga Tumbler Rp 79.000 | Mutasi "Dikirim" 16 pcs; di POS event itu hanya 2 produk tampil, Tumbler Rp 79.000; stok masuk setelah Terima Mutasi |
| 25 | Rina buka kasir di Kajian, lalu di dashboard Ubah Event Kajian dan matikan pre-sale | Pilihan mode pre-sale hilang; POS menolak tambah produk dan pembayaran; Kajian tidak bisa dipilih di Pilih Tempat Jualan |
| 26 | Daftar Produk › Kaos Burtuqol › nyalakan Tokopedia, isi harga XL Rp 140.000, matikan Shopee, Simpan | Kolom Marketplace berubah jadi Tokopedia; Input Pesanan Manual Tokopedia menampilkan Kaos Burtuqol, Shopee tidak |
| 27 | Tutup Bandung di dashboard (tutup kasir Budi dulu), isi stok fisik Kaos Burtuqol S 2 lebih sedikit dari sistem | Kerugian Rp 110.000 tampil saat mengetik; setelah disimpan ada opname "Tutup Event", kolom Selisih -2 di detail event, stok fisik kembali ke gudang |
| 28 | Rina jual pre-sale di Kajian untuk Fajar | Toast "Struk PDF pre-sale dikirim ke WA +62 812 ..."; Lihat PDF mengunduh struk berisi QR yang bisa dipindai |
| 29 | Jual biasa tanpa pelanggan, isi no WA di kotak struk lalu Kirim | Tercatat terkirim; dashboard Pesanan Pre-sale menandai struk terkirim/belum |
| 30 | Dimas (Admin) masuk POS, pilih Gudang Pusat, coba tambah produk | Ditolak; tab "Ambil di kantor" tetap bisa dipakai untuk serah terima |
| 31 | Penjualan Online › Impor › Shopee › pakai data contoh | Peringatan Kemeja Flanel M dan Topi Bordir belum terdaftar di Shopee, tombol Impor terkunci; Daftarkan harga › Simpan langsung mendaftarkan harga dan mengimpor 2 pesanan |
| 32 | Tutup Bandung sebagai Dimas, isi stok fisik lebih kecil dan kosongkan penanggung jawab | Ditolak; setelah memilih Budi dan mengisi penjelasan, event tertutup dan kerugian muncul di Laporan › Selisih & Kerugian |
| 33 | Dimas: Selesaikan › Diganti Rp 100.000 potong gaji. Lalu masuk sebagai Rina: Selesaikan › Dibebankan ke perusahaan | Pilihan "Dibebankan" mati untuk Dimas; status Diganti sebagian lalu Dibebankan perusahaan, kedua langkah tercatat di riwayat |
| 34 | Setelah jual pre-sale, tekan "Kirim dari WhatsApp HP ini" | Menu share HP terbuka dengan PDF terlampir; di HP tanpa dukungan, PDF diunduh dan chat WA pembeli terbuka |
| 35 | Sari salah PIN sekali lalu masuk, kunci layar dan buka lagi, lalu buka Menu › Riwayat Masuk | Tercatat PIN salah, Masuk, Buka kunci layar; Sari hanya melihat riwayatnya sendiri. Dashboard › Karyawan menampilkan semua catatan dan tanda PIN salah hari ini |
| 36 | Laporan › Per Kasir › Semua, lalu Input Pesanan Manual sebagai Dimas | Sari, Budi, Rina, dan Dimas tampil dengan penjualan offline/online, selisih kas, dan void; pesanan baru menambah penjualan online Dimas |
| 37 | Ketik 9999 di kolom Kirim pada Kirim Stok, qty pesanan manual, nominal pisah bayar, dan uang keluar di Kas Kasir | Angka langsung turun ke batasnya (stok gudang, stok lokasi, sisa tagihan − 1, uang di laci) dengan pesan "Maksimal ..." |
| 38 | Laporan › Rekap Harian, isi Dari 2 Okt s/d 3 Okt, lalu pindah ke Per Kasir | Hanya 2 hari tampil dan total ikut berubah; Per Kasir memakai rentang yang sama |
| 39 | Rina di Hikayat Fest, masukkan 2 Jersey L (Rp 350.000) | "Belanja Rp300 ribu" otomatis terpasang; setelah dihapus kasir tidak terpasang lagi; memilih Jersey Fest manual tetap dipakai sampai bayar |
| 40 | Buat promo Potongan (Rp) di dashboard, atau promo yang harinya tidak termasuk hari ini | Promo Rp muncul di POS; promo di luar hari/jam tidak muncul |
| 41 | Dashboard › Promosi Per Produk | Kolom Dipakai menunjukkan Jersey Fest 1× setelah skenario 39; Promo Pameran Buku berstatus Berakhir; Simpan Draft menghasilkan status Draf |
| 42 | Tab Promo di POS: ketuk Jersey Fest dengan keranjang kosong, lalu dengan 1 Kaos Burtuqol, lalu setelah tambah Jersey L | Pesan syarat, lalu "Kurang 1 pcs Jersey Dewasa", lalu promo terpasang dan kartu bertanda Dipakai; bar Promosi tidak tertutup bar total |
| 43 | Keranjang berisi 1 Kaos Burtuqol L, tekan Promosi (langsung Promo Tersedia), lalu buka tab Promo | Promo Tersedia: Belanja Rp300 ribu (kurang Rp 175.000), Hemat Kaos (kurang 1 pcs), Diskon Manual Kasir (hemat Rp 6.250), tanpa Jersey Fest. Tab Promo menampilkan semua promo aktif |
| 44 | Sari: Inventori › Stok Opname, isi Kaos Burtuqol S 2 kurang, Kirim. Dashboard (Dimas): Tutup Event › Minta opname ulang. Sari hitung ulang (1 kurang). Rina di POS: Tutup event › Setujui | Opname pertama Diganti, kedua Disetujui; event tertutup dengan kerugian Rp 55.000; detail event menulis "dihitung Sari Handayani, disetujui Rina Wijaya" |
| 45 | Rina masuk ke kasir Hikayat Fest (gabung laci Budi), buka Tutup event › "Tutup kasir Budi Santoso · laci yang sedang dipakai", hitung laci, PIN 111111 | Rina tetap masuk, layar Tutup Event terbuka lagi tanpa peringatan kasir terbuka; Setujui & tutup event berhasil |
| 46 | Sari kirim opname (Kaos Burtuqol S kurang 2). Rina masuk ke Hikayat Fest › Inventori › Stok Opname › ketuk kartu "menunggu persetujuan", Setujui tanpa penjelasan, lalu isi penjelasan | Ditolak dulu, lalu disetujui; stok Kaos S turun 9 → 7, kerugian Rp 110.000 atas nama Sari di Selisih & Kerugian; event tetap berjalan dan Tutup Event menulis opname sudah disetujui |
| 47 | Opname baru dari Sari, lalu dashboard (Dimas): Inventori › Stok Opname › Periksa & setujui | Opname Disetujui oleh Dimas Pratama, stok disesuaikan, event tetap berjalan |
| 48 | Rina tutup laci Budi dari Tutup Event, isi uang 1.000 | Muncul penanggung jawab (Budi) dan penjelasan wajib; setelah PIN Rina, shift tercatat "ditutup Rina Wijaya", Selisih & Kerugian menampilkan baris Kas laci Budi Santoso; Selesaikan › Diganti mengubah status |
| 49 | Sari: 2 Jersey Dewasa, tab Promo › "Beli 2 Jersey gratis Topi" | Topi Bordir masuk keranjang otomatis, potongan Rp 35.000; struk menulis Gratis Topi Bordir ×1; stok Topi berkurang 1 |
| 50 | Tumbler, lalu "Paket Tumbler + Totebag" | Pesan "Tambahkan Totebag Hikayat"; setelah Totebag masuk, total Rp 110.000 (hemat Rp 15.000) |
| 51 | Dashboard › Promosi Per Produk › Tambah › Bundling Kaos Polos + Topi Rp 90.000 | Ditolak: harga paket harus lebih murah dari Rp 75.000. Bonus Produk tanpa produk bonus ditolak |
| 52 | Sari jual 3 Kaos Polos tunai, Riwayat › detail › Retur barang cacat › 1 pcs tukar, PIN Dimas; lalu 2 pcs uang kembali tunai, PIN Rina | Stok Kaos Polos turun 1 (pengganti), rusak 3; uang laci seharusnya turun Rp 70.000; tombol Void hilang; Laporan › Retur Barang Cacat menampilkan 3 pcs, Rp 70.000 |

Untuk kembali ke data awal, buka Dashboard › Pengaturan POS › Reset Data.

---

## 10. Keputusan yang sudah diambil

1. "Outlet" diganti dengan "Lokasi" (Gudang Pusat + event).
2. Kirim stok ke event memakai mutasi yang harus diterima kasir, supaya kekurangan barang di perjalanan terlihat.
3. Satu laci untuk satu tempat jualan, dipakai bersama oleh semua kasir di tempat itu.
4. PIN 6 angka untuk semua keperluan: masuk, kunci layar, tutup kasir, dan persetujuan void.
5. Jenis order Ojol/Marketplace dihapus dari POS, karena pesanan marketplace masuk lewat impor di dashboard.
6. Kategori Deposit dan Paket dihapus dari POS. Mode tampilan hanya Grid dan SKU.
7. Pisah Bayar hanya untuk sebagian tagihan. Pelunasan lewat pembayaran biasa.
8. Owner bisa berjualan di semua event yang belum ditutup (termasuk pre-sale) dan langsung dari Gudang Pusat.
9. Hikayat tidak memproduksi sendiri: data bahan baku dan tab Bahan Baku dihapus; Bahan Baku dan Produksi tidak dihidupkan.
10. DP masuk perhitungan uang di laci setelah pesanan lunas.
11. Pre-sale bisa diatur per event: "pesanan diambil nanti" atau "kurangi stok saat transaksi".
12. Owner boleh menutup event dari HP.
13. Harga bisa berbeda per event lewat Harga Event.
14. Kunci layar otomatis setelah 20 menit tidak dipakai, bisa diubah di Pengaturan POS.
15. Harga event (dan semua harga lain) wajib diatur dari dashboard. POS tidak punya pengaturan harga, dan Custom Amount disembunyikan.
16. Pengingat WhatsApp untuk pembeli pre-sale ditunda. Yang tersedia sekarang adalah daftar pembeli lengkap dengan no HP di dashboard.
17. Pesanan pre-sale yang tidak diambil sampai event ditutup di-transfer kembali ke pembeli.
18. Harga khusus juga berlaku untuk jual langsung dari Gudang Pusat, diatur dari dashboard.
19. Verifikasi pengambilan pre-sale memakai scan QR di struk.
20. Penandaan refund wajib disertai foto bukti transfer.
21. Pesanan pre-sale boleh diambil di Gudang Pusat setelah event ditutup, selama belum di-refund.
22. Pembeli pre-sale tidak boleh menukar ukuran saat pengambilan.
23. Menu yang belum relevan untuk versi pertama disembunyikan dari sidebar dashboard (Departemen, Retur, Bahan Baku, Produksi, Mutasi Antar Outlet, Pemasok, Grup Pelanggan). Kodenya masih ada.
24. Produk yang dijual di event dipilih dari form event di dashboard, sekaligus jumlah kirim dan harga event-nya.
25. Pre-sale bisa diaktifkan atau dinonaktifkan per event. Event baru defaultnya nonaktif.
26. Form isian di dashboard selalu berupa halaman penuh, bukan popup.
27. Harga marketplace diatur per produk dengan sakelar per marketplace. Menu Harga Marketplace di sidebar dihapus.
28. Struk dikirim sebagai PDF ke nomor WhatsApp pembeli. Untuk pre-sale dikirim otomatis.
29. Admin boleh menyerahkan pesanan pre-sale di Gudang Pusat. Jual langsung dari gudang tetap khusus Owner.
30. Pesanan pre-sale masih bisa diambil di Gudang Pusat 7 hari setelah event ditutup, lalu otomatis Perlu Refund.
31. QR saja cukup untuk pengambilan, termasuk oleh orang yang diutus pembeli.
32. Semua harga (normal, event, gudang, marketplace) bisa diubah kapan saja. Harga marketplace disimpan per SKU dan tidak ikut berubah otomatis saat harga jual berubah.
33. Event ditutup lewat stok opname akhir event. Selisih dihitung sebagai kerugian, lalu stok fisik kembali ke Gudang Pusat.
34. Pesanan impor berisi produk yang belum aktif di marketplace tujuan ditahan sampai harga marketplace-nya didaftarkan. Setelah didaftarkan, file langsung diimpor.
35. Pre-sale untuk event baru tetap nonaktif secara default.
36. Struk dikirim ke no HP yang dicatat saat pre-sale. Pengiriman otomatis memakai layanan WhatsApp API saat produksi. Selama belum ada layanan itu, kasir membagikan PDF dari WhatsApp di HP kasir.
37. Angka kerugian terlihat oleh semua akun dashboard. Setiap kerugian wajib punya penanggung jawab dan penjelasan, dan harus diselesaikan dengan riwayat yang tercatat.
38. Absensi dihapus dari POS dan diganti Riwayat Masuk POS yang mencatat setiap pemakaian PIN.
39. Laporan per kasir mencakup semua penjualan: offline atas nama kasir yang melayani, online atas nama akun yang menginput atau mengimpor pesanan.
40. Semua isian jumlah yang melebihi batas tidak bisa dimasukkan; nilainya langsung diturunkan ke batas saat diketik.
41. Laporan bisa difilter dengan rentang tanggal bebas (dari sampai tanggal), selain periode cepat.
42. Kartu event berlangsung hanya tampil di halaman Event.
43. Promo hanya untuk POS, jenis bonus potongan % dan Rp. Aturan hari, jam, minimal kuantitas, kelipatan, dan aktivasi otomatis benar-benar diterapkan di POS.
44. Stok opname akhir event dihitung kasir di POS lalu disetujui Owner/Admin saat Tutup Event, atau dikembalikan untuk opname ulang dengan alasan.
45. Owner yang menutup kasir tetap masuk ke POS, dan bisa menutup semua kasir yang terbuka langsung dari layar Tutup Event.
46. Promo Bonus Produk (beli X gratis Y) dan Bundling (harga paket) diatur dari dashboard. Barang gratis tetap mengurangi stok.
47. Stok opname bisa disetujui di tengah event tanpa menutup event, dari dashboard atau HP Owner/Admin. Selisihnya masuk Selisih & Kerugian.
48. Uang laci yang kurang diperlakukan sama dengan kerugian stok: penanggung jawab, penjelasan, dan penyelesaian.
49. Owner boleh menutup laci kasir lain cukup dengan PIN Owner. Nama pemilik laci tetap tercatat, beserta siapa yang menutupnya.
50. Satu pesanan hanya satu promo. Promo tidak digabung.
51. Retur penjualan hanya untuk barang cacat, dengan PIN Admin/Owner. Penyelesaian tukar barang sama atau uang kembali. Barang cacat dicatat rusak dan tidak kembali ke stok jual. Laporannya ada di Laporan › Retur Barang Cacat (menu Retur lama tetap disembunyikan).
52. Setiap event wajib punya satu penanggung jawab, dipilih di form event. Namanya jadi penanggung jawab awal untuk selisih stok saat opname dan Tutup Event (masih bisa diganti). Selisih kas laci tetap atas nama pemilik laci.
53. Semua tempat menambah produk di dashboard memakai model yang sama: tabel berisi barang terpilih dengan tombol "+ Produk" di baris terakhir, yang membuka halaman pilih produk (centang, cari, Batal/Simpan). Dipakai di form event (per varian), Kirim/Tarik Stok, Input Pesanan Manual, serta produk promo dan produk bonus (per produk). Jumlah, harga, dan isian lain diisi di tabel, bukan di halaman pilih.
54. Faktur pembelian selalu masuk Gudang Pusat, supaya alur barang terbaca: pemasok → gudang → event.
55. Pemasok dicatat di Daftar Pemasok, bukan diketik bebas.
56. Faktur mencatat pembayaran: lunas, belum lunas dengan jatuh tempo, uang muka, dan cicilan.
57. HPP memakai rata-rata tertimbang setiap ada pembelian. Cocok untuk merchandise yang harga belinya berubah per batch produksi dan dijual bercampur dari stok lama dan baru.
58. Stok opname Gudang Pusat wajib ada, alurnya sama dengan POS (hitung, kirim, disetujui orang lain).
59. Setiap barang terbuang harus punya penjelasan, baik yang tercatat otomatis maupun manual.
60. Daftar Stok menampilkan kolom per lokasi: Gudang Pusat, tiap event, Dalam perjalanan, dan Total.
61. Promo Per Produk dan Promo Per Total Pembelian digabung jadi satu menu Promosi (Dashboard).
62. Harga event hanya diatur di form event; tombol Harga Event di detail event dihapus (Dashboard).
63. Form event tidak mengirim stok; semua pengiriman lewat Kirim Stok (Dashboard).
64. Persetujuan stok opname hanya di Inventori › Stok Opname. Event tidak bisa ditutup selama ada opname yang menunggu persetujuan (Dashboard dan POS).
65. Submenu Laporan › Retur Barang Cacat digabung ke Inventori › Stok Terbuang (Dashboard).
66. Menu Promosi › List Promo dihapus; tombol Promosi langsung membuka Promo Tersedia, dan semua promo dilihat di Tab Promo (POS).
67. Semua karyawan didaftarkan Owner di dashboard. Hanya Owner yang bisa menambah, mengubah, menonaktifkan, dan mereset akun.
68. Dashboard memakai email dan password; POS memakai PIN 6 angka. Keduanya dibuat Owner sebagai data sementara dan wajib diganti karyawan saat pertama kali masuk. Tidak ada verifikasi email.
69. PIN sementara boleh dipakai untuk persetujuan atasan (void, tutup kasir, retur) selama pemiliknya Admin atau Owner yang aktif.
70. Siapa bertugas di mana dilihat di Karyawan › Bertugas Hari Ini, per lokasi, berdasarkan penugasan event dan aktivitas POS hari ini.
71. QRIS saat ini hanya statis. QR dinamis dan konfirmasi otomatis dipindah ke rencana berikutnya.
72. Faktur pembelian boleh dibatalkan selama barangnya belum terpakai. Stok gudang dan HPP dikembalikan.
73. Barang terbuang yang dicatat manual punya penanggung jawab dan masuk Selisih & Kerugian.
74. Konfirmasi QRIS statis wajib mencatat 4 digit terakhir no. referensi dari notifikasi aplikasi merchant.
75. Semua kasir boleh menekan "Dana Sudah Masuk" tanpa PIN atasan.
76. Orang yang menghitung stok opname tidak bisa menyetujui hitungannya sendiri, kecuali Owner.
77. Ada menu Keuangan dengan Laporan Keseluruhan, Laporan per Event, dan Biaya (Dashboard).
78. Biaya dicatat terpisah dari pembelian barang. Biaya event dibebankan ke satu event, biaya umum tidak terkait event. Kas keluar laci POS otomatis jadi biaya event.
79. Penjualan pre-sale baru diakui saat barang diserahkan ke pembeli.
80. Laporan keuangan untuk fashion retail menampilkan sell-through per produk dan komposisi penjualan per ukuran.
81. Menu Keuangan hanya untuk Owner.
82. Hanya Owner yang bisa mengubah dan menghapus biaya. Admin hanya bisa mencatat biaya event baru dari detail event.
83. Potongan MDR QRIS dan biaya bank dicatat manual sebagai biaya, tidak dihitung otomatis.
84. Pembagian biaya umum ke event bisa diaktifkan dan dimatikan Owner. Kalau aktif, dibagi sesuai porsi penjualan bersih per bulan.
85. Versi produksi memakai Cloudflare paket gratis: Pages (aplikasi), Workers (server), D1 (database), R2 (foto). Rincian di dokumen Arsitektur-Cloudflare.md.

## 11. Pertanyaan terbuka

Belum ada. Semua pertanyaan sebelumnya sudah dijawab dan masuk ke bagian 10.

## 12. Menuju versi produksi

Arsitektur produksi: **Cloudflare paket gratis** (Pages, Workers, D1, R2). Rincian komponen, tabel database, login, mode offline, backup, perkiraan kuota, dan urutan pembangunan ada di **Arsitektur-Cloudflare.md**.

| Area | Yang dibutuhkan |
|---|---|
| Server dan database | Mengganti `localStorage` dengan Workers + D1. Setiap HP kasir menyimpan antrean transaksi saat offline (IndexedDB), lalu mengirimnya saat online. Nomor dokumen dari POS memakai kode perangkat supaya tidak bentrok |
| Login | Dashboard: email + password (PBKDF2 + pepper). POS: HP didaftarkan Owner/Admin, lalu karyawan masuk dengan PIN. Hak akses dicek di server |
| Foto | R2 privat, foto diambil lewat Worker setelah cek hak akses |
| Backup | D1 Time Travel 7 hari + ekspor malam ke R2 lewat GitHub Actions, disimpan 30 hari |
| Marketplace | Integrasi API Shopee/Tokopedia/TikTok Shop, atau tetap impor file dengan jadwal rutin |
| Pembayaran | QRIS dinamis dari penyedia pembayaran, dengan konfirmasi otomatis |
| Perangkat | Printer struk Bluetooth, pemindai barcode lewat kamera |
| WhatsApp | Pengiriman otomatis PDF struk ke no HP pembeli lewat WhatsApp Business API (penyedia dipilih saat produksi), dengan status terkirim/dibaca dari webhook. Sebelum itu, kasir membagikan PDF dari WhatsApp di HP kasir |
| Audit | Riwayat perubahan harga, stok, dan pengaturan beserta pelakunya |
