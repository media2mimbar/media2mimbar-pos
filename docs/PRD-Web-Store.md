# PRD Web Store 2 Mimbar Merchandise

23 Nov 2026. Salinan dari dokumen PRD di Claude. Untuk pembangunan, file ini yang dipakai dan diperbarui.

Dokumen terkait: `docs/PRD-Hikayat-Merchandise.md` untuk POS dan dashboard yang sudah ada, `docs/Arsitektur-Cloudflare.md` untuk aturan D1 dan tahap 1 sampai 8, dan gambar alur di `docs/gambar/web-store/`.

## Ringkasan

Web store 2 Mimbar Merchandise di 2mimbar.store menambah dua jalur jual online di atas Hikayat POS. Kedua jalur memakai produk, stok, promo, dan laporan yang sama dengan POS dan dashboard, jadi tidak ada data yang diketik ulang atau diimpor.

### Latar belakang

Saat ini penjualan berjalan lewat POS di booth event, jual langsung di Gudang Pusat, dan marketplace yang diimpor dari file. Penjualan sebelum event memakai pre-sale yang hanya bisa dilakukan Owner di POS. Belum ada toko milik sendiri yang bisa dibuka pembeli kapan saja.

### Dua jalur

|  | Toko umum | Link event |
| --- | --- | --- |
| Alamat | 2mimbar.store | 2mimbar.store/e/nama-event |
| Akun pembeli | Wajib, lewat Google atau email dan password | Tidak perlu, cukup nama dan no HP |
| Stok yang dipakai | Gudang Pusat | Stok event |
| Barang sampai ke pembeli | Dikirim kurir lewat Biteship, paket diantar admin ke agen | Diambil di booth, atau di kantor setelah event ditutup |
| Waktu bayar QRIS | 15 menit | 5 menit |
| Bukti untuk pembeli | Email dan halaman Pesanan Saya | Struk belanja digital dengan QR dan kode pengambilan |
| Voucher | Bisa | Bisa |
| Subsidi ongkir | Bisa | Tidak ada ongkir |
| Penilaian | Bintang, teks, dan foto | Tidak ada |

Tampilan toko umum mengikuti pola belanja Shopee dengan warna navy #02194F, sama dengan Hikayat POS. Pembayaran di kedua jalur hanya QRIS lewat Midtrans.

### Tujuan

- Pembeli bisa berbelanja kapan saja tanpa marketplace, jadi potongan yang tersisa hanya biaya QRIS.
- Antrean di booth berkurang karena pembeli membayar lebih dulu dan tinggal mengambil barang.
- Semua penjualan web langsung masuk ke dashboard dan laporan yang sama.
- Pekerjaan admin dipusatkan di dashboard. Resi, pelacakan paket, email, dan biaya Midtrans berjalan otomatis.

### Cakupan versi pertama

Toko umum, link event, perubahan POS dan dashboard, pembayaran QRIS Midtrans dengan refund, pengiriman Biteship, email transaksional, voucher, subsidi ongkir, penilaian, dan halaman kebijakan.

### Di luar cakupan

- Metode bayar selain QRIS, misalnya virtual account, kartu, atau COD.
- Email promosi dan broadcast. Layanan email Cloudflare hanya mengizinkan email transaksional.
- Aplikasi Android dan iOS. Toko berjalan di browser.
- Pengiriman pesanan link event dan penjemputan paket oleh kurir.
- Pengiriman dari tempat selain Gudang Pusat.
- Integrasi API Shopee, Tokopedia, dan TikTok Shop. Impor file tetap seperti sekarang.
- Pengajuan retur lewat web. Klaim retur masuk lewat WA admin.
- Poin, member, dan program loyalitas.

## Hubungan dengan sistem lama

Web store dibangun di repo media2mimbar-pos, di Worker dan database D1 `hikayat` yang sama dengan POS dan dashboard. Acuannya commit 5094d68 tanggal 20 Okt 2026, dokumen PRD-Hikayat-Merchandise.md, dan Arsitektur-Cloudflare.md.

Halaman toko disimpan di `ui/toko/` dan dilayani Worker yang sama lewat domain 2mimbar.store. API pembeli memakai awalan `/api/toko/` dan `/api/e/`, terpisah dari API karyawan, supaya pemeriksaan hak akses tidak tercampur. Aturan bersama seperti `src/aturan.ts` dan `src/promo.ts` dipakai ulang, jadi potongan dan stok di web, POS, dan server selalu sama. Dashboard dan POS tetap di alamat yang sekarang.

| Bagian lama | Nasib | Perubahan |
| --- | --- | --- |
| Produk, varian, SKU, HPP | Tetap | Ditambah foto produk sampai 9, deskripsi, foto per varian, dan berat per varian |
| Harga per saluran `harga_saluran` | Tetap | Saluran baru `toko_web`, polanya sama dengan `gudang`. Harga kosong berarti harga jual |
| Stok dan buku besar `stok_gerak` | Tetap | Jenis gerak baru untuk pesanan web, dan tabel tahan stok untuk QRIS yang sedang dibayar |
| Event, `event_varian`, Kirim Stok, Tutup Event | Berubah | Pre-sale diganti bagian Link Web Order. Harga event berlaku di POS dan di link. Tutup event memperhitungkan barang pesanan web yang belum diambil |
| Pre-sale: `presale.ts`, kolom pre-sale di `event` dan `trx`, POS › Penjualan › Pre-sale, scan QR pengambilan | Dihapus | Diganti link event. Pesanan pre-sale lama diselesaikan dulu sebelum fitur dimatikan |
| Menu Pesanan Pre-sale di dashboard | Berubah | Menjadi Web Order dengan anak menu Pesanan Toko, Pesanan Event, dan Penilaian |
| Promo `promo`, `promo_produk` | Tetap, ditambah | Jenis baru Voucher dan Subsidi ongkir, dengan pengaturan tempat berlaku |
| Pelanggan | Tetap | Pembeli link event dan POS dikenali dari no HP. Akun toko web disimpan terpisah dan ditautkan lewat no HP |
| Penjualan Online untuk marketplace | Tetap | Toko web tidak masuk menu ini karena punya Pesanan Toko sendiri |
| Laporan dan `sqlFakta` | Berubah | Ditambah sumber baris dari toko web dan link event |
| Keuangan › Biaya | Tetap, ditambah | Baris biaya Midtrans dibuat otomatis |
| Login karyawan | Tetap | Akun pembeli terpisah dari `staff` dan tidak bisa masuk dashboard atau POS |
| Foto di D1 tabel `berkas` | Perlu diputuskan | Foto produk dibuka publik dan sering, lihat Yang perlu dicek |
| Paket Cloudflare gratis | Berubah | Perlu Workers Paid untuk email dan beban webhook |
| Rencana WA Business API resmi | Berubah | Versi pertama memakai gateway WA tidak resmi, hanya untuk pemberitahuan refund event batal |
| QRIS statis di POS | Tetap | POS tetap memakai gambar QRIS di `berkas`. QRIS dinamis Midtrans hanya untuk web |

## Pengguna dan peran

Web store menambah dua jenis pembeli. Peran karyawan tetap Kasir, Admin, dan Owner seperti di PRD lama, ditambah tugas penanggung jawab event untuk refund.

| Peran | Masuk dengan | Yang dilakukan di web store |
| --- | --- | --- |
| Pembeli toko umum | Akun Google, atau email dan password yang diverifikasi lewat kode OTP | Belanja, bayar, melacak paket, menekan Pesanan Diterima, memberi penilaian, mengatur alamat |
| Pembeli link event | Tanpa akun. Nama dan no HP diisi di checkout | Memesan, membayar, menyimpan struk, mengambil barang |
| Kasir | PIN di POS | Menyerahkan pesanan link event di tab Web Order, menawarkan ganti barang atau refund saat bentrok stok, memakai voucher di POS |
| Penanggung jawab event | PIN di POS | Menyetujui refund bentrok stok dengan PIN sendiri. Orang ini dipilih di form event |
| Admin | Email dan password di dashboard | Produk, event dan link, Pesanan Toko, Pesanan Event, voucher, subsidi ongkir, penilaian, refund manual, tampilan beranda, halaman kebijakan |
| Owner | Email dan password di dashboard | Semua yang bisa dilakukan Admin, ditambah halaman Sambungan |

### Hak akses tambahan

| Kemampuan | Kasir | Admin | Owner |
| --- | --- | --- | --- |
| Tab Web Order di POS dan tombol geser Serahkan Barang | Ya | Ya | Ya |
| Mengajukan refund bentrok stok dari POS | Ya | Ya | Ya |
| Menyetujui refund bentrok stok | Hanya penanggung jawab event | Hanya penanggung jawab event | Hanya penanggung jawab event |
| Kemas dan buat resi, cetak label, batalkan pesanan toko | Tidak | Ya | Ya |
| Batalkan event dan kirim WA refund | Tidak | Ya | Ya |
| Tandai refund manual sudah ditransfer dengan bukti | Tidak | Ya | Ya |
| Atur tampilan penilaian | Tidak | Ya | Ya |
| Info Toko, Tampilan Beranda, Email, Halaman Kebijakan | Tidak | Ya | Ya |
| Sambungan: Midtrans, Biteship, gateway WA, email | Tidak | Tidak | Ya |

### Akun pembeli toko umum

- Pembeli boleh melihat-lihat tanpa akun. Akun baru diminta saat menekan Masukkan Keranjang atau Beli Sekarang.
- Daftar dengan email wajib memasukkan kode OTP dari email. Akun Google dianggap sudah terverifikasi.
- Satu akun menyimpan paling banyak 5 alamat, satu di antaranya alamat utama untuk menghitung ongkir di halaman produk.
- Pembeli bisa mengganti password, mengganti email dengan OTP ke email baru, dan menghapus akun. Riwayat pesanan tetap disimpan untuk laporan, tapi nama dan kontaknya disamarkan.
- Akun pembeli tidak pernah bisa masuk dashboard atau POS.

## Toko umum

Pembeli toko umum berbelanja dengan akun, membayar QRIS dalam 15 menit, lalu menerima paket lewat kurir pilihannya. Stok yang dijual adalah stok Gudang Pusat untuk produk yang sakelar Toko web-nya menyala.

### Alur pembeli

1. **Beranda.** Kolom cari dan keranjang di atas, banner geser, ikon kategori, lalu grid produk dua kolom. Produk yang punya subsidi ongkir diberi label Subsidi ongkir.
2. **Kategori.** Daftar nama kategori dari kategori produk di dashboard beserta jumlah produknya. Hasilnya bisa diurutkan menurut Terkait, Terbaru, Terlaris, dan Harga.
3. **Halaman produk.** Foto bisa digeser, pilihan warna di bawah foto, ongkir ke alamat utama yang sudah dipotong subsidi, deskripsi, dan penilaian dengan foto.
4. **Pilih variasi.** Lembar dari bawah berisi foto, harga, stok, warna, ukuran, dan jumlah. Ukuran yang habis tampil abu-abu.
5. **Masuk.** Muncul kalau pembeli belum masuk saat menekan Masukkan Keranjang atau Beli Sekarang.
6. **Keranjang.** Barang dicentang satu per satu, dan hemat ongkir dihitung dari barang yang dicentang. Keranjang tidak mengunci stok, jadi barang yang habis dipindah ke bagian Produk tidak tersedia dan tidak ikut checkout.
7. **Checkout.** Urutannya alamat, barang, kurir dan ongkir dari Biteship, voucher atau subsidi ongkir, lalu rincian bayar. Metode bayar tidak dipilih karena hanya ada QRIS. Stok dicek ulang saat pembeli menekan Buat Pesanan.
8. **Bayar QRIS.** QR digambar web sendiri dari data QRIS Midtrans, dengan hitung mundur 15 menit dan tombol Simpan QR untuk pembeli yang membayar dari HP yang sama. Selama hitung mundur, stok ditahan.
9. **Pembayaran berhasil.** Muncul setelah notifikasi lunas dari Midtrans masuk. Stok Gudang Pusat baru berkurang di titik ini, lalu bukti bayar dikirim ke email.
10. **Pesanan Saya.** Tab Belum Bayar, Dikemas, Dikirim, Selesai, dan Dibatalkan.
11. **Rincian pesanan.** Jejak paket dari Biteship, alamat, rincian bayar, dan tombol Pesanan Diterima setelah paket sampai.
12. **Pesanan selesai.** Tombol Beri Penilaian dan Beli Lagi muncul. Beli Lagi memasukkan barang yang sama ke keranjang.
13. **Beri penilaian.** Bintang 1 sampai 5 wajib diisi. Teks dan 1 sampai 3 foto boleh ditambahkan. Nama pembeli tampil disamarkan.

### Tab Pesanan Saya dan status di dashboard

| Tab pembeli | Status di dashboard | Artinya |
| --- | --- | --- |
| Belum Bayar | Belum Bayar | QR aktif 15 menit dan stok ditahan |
| Dikemas | Perlu Dikemas, Siap Diantar | Sudah lunas. Admin mengemas dan membuat resi, lalu mengantar paket ke agen |
| Dikirim | Dikirim, Terkirim | Agen sudah memindai label. Jejak paket masuk dari Biteship |
| Selesai | Selesai | Pembeli menekan Pesanan Diterima, atau otomatis 3 hari setelah Terkirim |
| Dibatalkan | Dibatalkan | Tidak dibayar dalam 15 menit, atau dibatalkan admin sebelum Dikirim |

### Keadaan khusus

- **Batal otomatis.** QRIS yang tidak dibayar dalam 15 menit membatalkan pesanan, melepas stok yang ditahan, mengembalikan kuota voucher, dan mengirim email pemberitahuan.
- **Dibatalkan admin.** Hanya sebelum status Dikirim. Uang kembali penuh lewat Midtrans, stok dan kuota voucher kembali, dan pesan admin tampil di Pesanan Saya.
- **Belum ada alamat.** Pembeli diminta mengisi alamat sebelum ongkir dan checkout bisa dihitung.
- **Retur.** Klaim dikirim lewat WA admin paling lambat 2 x 24 jam setelah paket diterima, disertai video saat membuka paket. Hanya untuk barang salah kirim, cacat, atau rusak. Penyelesaiannya dicatat admin di rincian pesanan.

## Link event

Link event menggantikan pre-sale. Pembeli memesan tanpa akun, membayar QRIS dalam 5 menit, lalu mengambil barang di booth dengan struk belanja digital. Stok yang dijual adalah stok event, dipakai bersama POS booth.

### Alur pembeli

1. **Halaman event.** Langsung menampilkan produk event tanpa beranda, kategori, atau login. Bar atas sama dengan toko umum dengan pencarian di produk event, keranjang, dan struk. Nama, tanggal, dan lokasi event ada di bawahnya. Kartu produk menampilkan sisa stok gabungan booth dan link.
2. **Pilih variasi.** Lembar variasi sama dengan toko umum. Tidak ada batas beli, jumlah hanya dibatasi sisa stok.
3. **Checkout.** Pola sama dengan toko umum. Alamat diganti lokasi booth, pembeli cukup mengisi nama dan no HP, dan baris Voucher tersedia. Tidak ada ongkir.
4. **Bayar QRIS.** Tampilan sama dengan toko umum dengan hitung mundur 5 menit. Stok ditahan selama hitung mundur dan baru berkurang setelah lunas.
5. **Struk belanja digital.** Urutannya nama event di atas logo toko, waktu lunas, lokasi, QR, kode pengambilan, daftar barang, no pesanan, metode bayar, dan cara mengambil. Nama dan no HP pemesan tidak dicetak.
6. **Struk Saya.** Tab Belum Diambil dan Daftar Transaksi, tersimpan di browser tanpa akun. Halaman Temukan struk membantu pembeli yang berganti browser atau menghapus data browser, dengan no HP dan kode pengambilan.
7. **Setelah diambil.** Begitu petugas menggeser Serahkan Barang di POS, QR mendapat cap SUDAH DIPAKAI dan kodenya tidak bisa dipakai lagi.

Setiap struk punya alamat sendiri, misalnya 2mimbar.store/s/8kq2vz7m. Token alamat ini acak dan menjadi isi QR, jadi QR tidak memuat ID transaksi atau no HP.

### Status link

| Status | Kapan | Yang dilihat pembeli |
| --- | --- | --- |
| Terjadwal | Sebelum jam buka | Produk dan jadwal buka terlihat, tapi belum bisa dipesan. Admin bisa menekan Buka sekarang |
| Dibuka | Antara jam buka dan jam tutup | Pembeli bisa memesan dari stok event yang masih bisa dijual. Admin bisa menutup lebih awal lalu membukanya lagi selama jam tutup belum lewat |
| Ditutup | Otomatis saat jam tutup atau saat event ditutup | Pesanan baru ditolak server. Struk lunas tetap bisa dibuka dan barangnya tetap bisa diambil |
| Event dibatalkan | Saat admin menekan Batalkan Event | Link langsung ditutup dan semua pesanan lunas menjadi Perlu Refund |

### Pengambilan barang

- Selama event berlangsung, barang diambil di booth. Petugas memverifikasi lewat QR di struk, atau lewat no HP dan nama pemesan kalau HP pembeli mati.
- Setelah event ditutup, pesanan yang belum diambil pindah ke tab Web Order di POS Gudang Pusat dan diambil di kantor. Tidak ada batas waktu dan tidak ada refund untuk barang yang tidak diambil. Struk menampilkan alamat dan jam buka kantor.
- Tidak ada tukar ukuran saat pengambilan. Penggantian barang hanya terjadi saat bentrok stok, dengan barang seharga sama.

### Event dibatalkan

1. Admin menekan Batalkan Event dan menulis alasan yang tampil di struk.
2. Semua pesanan lunas berstatus Perlu Refund. Struk menampilkan pemberitahuan pembatalan dan form rekening pengembalian.
3. Pembeli membuka form setelah memasukkan no HP yang dipakai saat memesan. Kalau nama pemilik rekening berbeda dengan nama pemesan, admin menghubungi pembeli lewat WA sebelum transfer.
4. Dashboard mengirim WA ke semua pembeli lewat gateway WA. Pesan pertama tanpa link, dan link form rekening baru dikirim setelah pembeli membalas YA.
5. Admin mentransfer dari rekening perusahaan, mengunggah bukti, lalu struk berubah dari Menunggu Transfer menjadi Uang Sudah Dikembalikan.

## POS

POS mendapat tab Web Order untuk menyerahkan pesanan link event, stok yang mendahulukan pembeli web, penanganan bentrok stok, dan kolom voucher. Menu Penjualan › Pre-sale dan scan QR pengambilan pre-sale dihapus, dan event berstatus Akan Datang tidak bisa lagi dipakai berjualan di POS.

### Tab Web Order

- Tab ketiga setelah Penjualan dan Daftar Order, dengan header kasir yang sama. Isinya hanya pesanan link event yang sudah lunas di event yang sedang dibuka. Nama dan no HP pemesan tidak ditampilkan di daftar.
- Petugas mengetik kode pengambilan dan daftar langsung tersaring, atau menekan Scan untuk memindai QR tanpa mengetik.
- **Jalur A, QR.** QR yang cocok sudah cukup sebagai bukti, termasuk kalau yang datang orang lain yang diutus pembeli. Nama pemesan baru tampil setelah QR cocok.
- **Jalur B, HP mati.** Petugas mengetik no HP yang disebut pembeli, dan server yang mencocokkan. Nomor asli tidak pernah tampil di layar. Kalau tidak cocok, POS hanya memberi tahu nomornya salah tanpa petunjuk angka mana. Setelah cocok, petugas mencentang kotak nama pemesan.
- **Tombol geser Serahkan Barang.** Ketukan biasa tidak melakukan apa-apa. Barang baru tercatat diserahkan setelah jempol digeser sampai ujung. Di jalur B tombol ini aktif setelah kotak nama dicentang.
- Pesanan yang diserahkan pindah ke Sudah diambil dengan nama petugas, waktu, dan cara verifikasi. Struk di HP pembeli ikut berubah.
- Layar khusus untuk kode tidak ditemukan, pesanan sudah diambil, dan pesanan sudah di-refund. Screenshot struk lama berhenti di layar Sudah diambil.
- POS Gudang Pusat menampilkan pesanan web dari event yang sudah ditutup, untuk pengambilan di kantor.

### Stok yang mendahulukan web

- Begitu QR tampil di HP pembeli web, stok di katalog kasir langsung berkurang sejumlah barang yang sedang dibayar. Kartu produk diberi label ditahan web.
- Ukuran yang seluruh stoknya ditahan tidak bisa dipilih, dan kasir melihat sampai jam berapa stok itu ditahan.
- Info stok per varian, dibuka dari pill Event, menampilkan stok fisik, ditahan web, sudah dipesan web dan menunggu diambil, serta yang masih bisa dijual.
- Barang pesanan web lunas masih ada di booth sampai diserahkan, tapi tidak bisa dijual lagi di POS.

### Saat offline

- Tab Penjualan tetap jalan. Tab Web Order mengunci penyerahan barang supaya satu pesanan tidak diserahkan dua kali dari dua HP.
- Karena kasir tidak tahu ada pembayaran web, beberapa unit terakhir tiap varian dikunci di kasir. Jumlahnya mengikuti batas aman stok offline di form event, bawaannya 2 pcs.
- Voucher tidak bisa dipakai saat offline. Promo otomatis tetap jalan karena dihitung di HP.

### Bentrok stok

1. Setelah POS online lagi dan penjualan offline terkirim, server mendeteksi pesanan web lunas yang barangnya sudah terjual di booth. Pesanan itu diberi label Bentrok stok di tab Web Order dan di dashboard.
2. Saat pembeli datang, kasir melihat barang mana yang tidak tersedia dan menawarkan ganti barang atau refund seluruh pesanan.
3. **Ganti barang.** Hanya dengan barang seharga sama. Stok pengganti langsung dipotong, struk berubah, lalu barang diserahkan lewat verifikasi dan tombol geser seperti biasa.
4. **Refund.** Kasir melihat ringkasan barang, nominal, tujuan uang, dan alasan, lalu menggeser tombol merah sampai ujung. Setelah konfirmasi Ya, sudah benar, penanggung jawab event memasukkan PIN-nya sendiri di HP kasir. Langkah ini butuh sinyal.
5. POS mengirim refund penuh ke Midtrans. Pengaju, penyetuju, dan alasan tercatat, dan hasil akhirnya tampil di dashboard dan di struk pembeli.

### Voucher di POS

- Kasir membuka tombol Promosi seperti biasa. Lembar Promo tersedia mendapat kartu Kode voucher.
- Kalau voucher dibatasi per pembeli, kasir wajib memilih atau menambah pelanggan dengan no HP lebih dulu. No HP yang sudah memakai voucher itu mendapat pesan penolakan, dan pembeli tetap bisa membayar tanpa voucher.
- POS memanggil server untuk mengecek dan mengunci kuota voucher, sama seperti cek stok. Kalau koneksi putus sebelum bayar selesai, voucher dilepas dan kuotanya tidak terpakai.
- Struk POS menampilkan potongan voucher.

## Dashboard

Dashboard mendapat menu Web Order dan Pengaturan Toko Web, serta perubahan di Event, Produk, Promosi, dan Keuangan. Menu lain tetap.

### Event

| Bagian | Perubahan |
| --- | --- |
| Penanggung jawab event | Tetap, dengan keterangan bahwa PIN orang ini yang menyetujui refund bentrok stok di POS |
| Pre-sale | Dihapus bersama pilihan modenya |
| Sakelar Link Web Order | Baru. Kalau mati, event hanya berjualan di POS dan semua isian link disembunyikan |
| Jadwal buka dan tutup | Baru. Tanggal dan jam mengikuti zona waktu event. Server menolak pesanan di luar jadwal walaupun halaman pembeli masih terbuka |
| Alamat link | Baru. Terisi dari nama event, bisa diubah, harus unik, dan terkunci setelah link dibuka |
| Batas aman stok offline | Baru. Bawaan 2 pcs per varian. Angka 0 berarti tidak ada stok yang dikunci |
| Pengingat kirim stok | Baru. Muncul di form dan detail event sampai stok terkirim, karena tanpa stok semua produk di link tampil Habis |
| Produk yang dijual | Tabel tetap. Harga event berlaku di POS dan link. Varian yang sudah punya pesanan web lunas tidak bisa dihapus dari daftar |
| Detail event | Kartu Link Web Order, tombol Buka sekarang dan Tutup link sekarang, tombol Batalkan Event, popup Poster QR, dan kolom stok Diterima, Terjual POS, Web lunas, Ditahan web, Bisa dijual |

### Web Order

Menu Pesanan Pre-sale diganti Web Order dengan tiga anak menu.

- **Pesanan Toko.** Ringkasan Perlu Dikemas, Siap Diantar, Dikirim, dan Menunggu bayar. Pesanan yang menunggu lebih dari 24 jam ditandai merah. Admin mencentang beberapa pesanan lalu menekan Kemas dan buat resi, mencetak label A6 sekaligus, dan mencetak daftar kemas. Rincian pesanan memuat pembeli, alamat, catatan, rincian bayar, kartu Pengiriman, jejak Biteship, dan riwayat status. Pembatalan hanya sebelum Dikirim, dengan pesan yang tampil di Pesanan Saya.
- **Pesanan Event.** Daftar pesanan link event per event dengan status Siap diambil, Sudah diambil, Bentrok stok, Perlu Refund, dan Sudah di-refund. Di sini admin menyelesaikan bentrok stok, mengirim WA refund saat event batal, memeriksa rekening, dan menandai transfer dengan foto bukti. Daftar pembeli bisa diunduh sebagai CSV.
- **Penilaian.** Rata-rata bintang, jumlah penilaian, jumlah dengan foto, dan filter bintang rendah. Tombol Atur tampilan memilih bagian ulasan yang ditampilkan per penilaian. Bintang selalu tampil dan selalu dihitung. Teks dan setiap foto bisa disembunyikan dengan alasan yang tercatat.

### Produk

- Foto produk sampai 9, foto pertama menjadi foto utama, urutan diatur dengan seret, JPG atau PNG paling besar 5 MB.
- Deskripsi produk untuk halaman produk.
- Sakelar tempat jual di tabel varian, termasuk Toko web 2Mimbar dengan kolom harga sendiri. Harga kosong memakai harga jual.
- Kolom Foto varian, dipilih dari foto produk, dan Berat dalam gram untuk ongkir.
- Varian yang dimatikan hilang dari POS, toko web, dan pesanan baru.

### Promosi

- Daftar promosi mendapat kolom Berlaku di, misalnya Toko web, Link event, atau POS dengan nama lokasinya.
- Jenis promosi menjadi Promo produk, Promo total belanja, Voucher, dan Subsidi ongkir. Aturannya ada di bagian Aturan bisnis.

### Pengaturan Toko Web

| Halaman | Isi |
| --- | --- |
| Info Toko | Nama toko, deskripsi singkat, alamat kantor, WA admin, email kontak, waktu bayar QRIS, dan aturan selesai otomatis. Alamat kantor dan WA admin wajib diisi sebelum toko web bisa dibuka. Alamat kantor juga menjadi alamat asal pengiriman Biteship dan tempat ambil pesanan event |
| Tampilan Beranda | Paling banyak 5 banner 1200 x 500 px yang bergeser tiap 5 detik, masing-masing dengan tujuan dan masa tampil, serta satu baris pengumuman |
| Email | Domain pengirim, daftar alamat email, kebutuhan email dengan pilihan alamat pengirim, dan isi pembuka tiap email |
| Halaman Kebijakan | Kebijakan Privasi, Syarat dan Ketentuan, Kebijakan Pengembalian, Tentang Kami, dan Kontak, masing-masing Draf atau Terbit. Semua harus terbit sebelum verifikasi Midtrans |
| Sambungan | Midtrans, gateway WA, Biteship dengan saldo, biaya Midtrans otomatis, dan layanan email. Hanya Owner |

### Keuangan dan laporan

- Keuangan › Biaya menampilkan baris biaya Midtrans otomatis per hari. Labelnya Perkiraan sampai laporan payout Midtrans masuk, lalu berubah menjadi Laporan Midtrans dengan angka asli.
- Laporan penjualan menampilkan saluran Toko web dan Link event. Laporan per event memasukkan pesanan link event yang lunas.
- Halaman Dashboard menampilkan jumlah pesanan Perlu Dikemas dan peringatan saldo Biteship rendah.

## Pembayaran dan refund

Semua pembayaran web memakai QRIS dinamis dari Midtrans Core API, dan status lunas hanya diambil dari notifikasi Midtrans yang sudah diperiksa server. Refund otomatis lewat Midtrans dipakai untuk pembatalan toko dan bentrok stok, sedangkan event batal memakai transfer manual.

### Alur bayar

1. Saat pembeli menekan Buat Pesanan atau Bayar, server mengecek stok dan voucher, menahan stok, lalu membuat transaksi QRIS di Midtrans dengan batas waktu 15 menit untuk toko atau 5 menit untuk event.
2. Halaman bayar menggambar QR dari data QRIS yang dikirim Midtrans dan menanyakan status ke server setiap beberapa detik.
3. Midtrans mengirim notifikasi ke Worker. Server memeriksa tanda tangan notifikasi dengan server key, lalu menanyakan ulang status transaksi ke Midtrans sebelum mengubah apa pun.
4. Status settlement membuat pesanan lunas, mengurangi stok, dan melepas tahanan stok. Status expire, cancel, dan deny membatalkan pesanan dan melepas tahanan.
5. Notifikasi yang sama bisa datang lebih dari sekali, jadi setiap langkah aman diulang dan tidak pernah mengurangi stok dua kali.
6. Kalau notifikasi tidak datang, jadwal otomatis menanyakan status transaksi yang sudah lewat batas waktu, lalu melepas stoknya kalau memang tidak dibayar.

Nomor pesanan toko memakai pola WS-261105-0137. Pesanan event memakai pola yang sama dengan awalan sendiri. Kode pengambilan event terpisah dari nomor pesanan.

### Refund

| Penyebab | Cara | Siapa | Uang kembali ke |
| --- | --- | --- | --- |
| Admin membatalkan pesanan toko sebelum Dikirim | Refund API Midtrans, penuh | Admin di dashboard | Aplikasi yang dipakai pembeli saat membayar QRIS |
| Bentrok stok di link event, pembeli memilih refund | Refund API Midtrans, penuh | Kasir mengajukan, penanggung jawab event menyetujui dengan PIN | Aplikasi yang dipakai pembeli saat membayar QRIS |
| Event dibatalkan | Transfer manual dari rekening perusahaan | Admin, dengan WA refund dan form rekening | Rekening yang diisi pembeli |
| Midtrans menolak refund | Pindah ke Perlu Refund, lalu transfer manual | Admin | Rekening yang diisi pembeli lewat link WA |

Midtrans bisa menolak refund kalau batas waktu refund QRIS sudah lewat, yaitu 7 hari untuk pembeli yang membayar dengan aplikasi dari penyedia lain, kalau fitur refund belum aktif, atau kalau saldo Midtrans tidak cukup. Semua refund selalu penuh untuk seluruh pesanan. Barang yang di-refund kembali ke stok.

### Biaya Midtrans

- Pencairan dana dari Midtrans ke rekening perusahaan berjalan otomatis setiap hari.
- Setiap kali dana dicairkan, Midtrans mengirim laporan payout ke laporan@2mimbar.store. Email Routing Cloudflare meneruskannya ke Worker, lalu Worker membaca biaya MDR dan biaya transaksi per transaksi.
- Sebelum laporan datang, sistem memakai perkiraan dari aturan Bank Indonesia yang berlaku sejak 1 Oktober 2026. Untuk usaha kecil, menengah, dan besar, transaksi sampai Rp100.000 kena 0% dan di atasnya 0,7%. Untuk usaha mikro, 0% sampai Rp500.000 dan 0,3% di atasnya.
- Perkiraan diganti otomatis dengan angka asli saat laporan masuk. Admin tidak mengisi angka apa pun.
- Biaya dicatat per hari sebagai satu baris di Keuangan › Biaya, terpisah untuk toko web dan link event.

## Pengiriman

Pengiriman toko umum memakai Biteship dengan cara serah drop-off. Pembeli memilih kurir dan ongkir di checkout, resi terbit saat admin menekan Kemas dan buat resi, lalu admin membawa paket ke agen kurir terdekat. Status paket masuk sendiri dari Biteship.

### Alur

1. **Checkout.** Server memanggil API tarif Biteship dengan alamat kantor sebagai asal, alamat pembeli sebagai tujuan, dan berat dari berat varian. Kurir yang tampil hanya kurir yang menerima drop-off. Tarif untuk alamat dan berat yang sama disimpan sebentar supaya tidak dipanggil berulang.
2. **Kemas dan buat resi.** Admin mencentang satu atau beberapa pesanan Perlu Dikemas. Popup konfirmasi menampilkan total ongkir yang dipotong dari saldo Biteship dan saldo sesudahnya. Server membuat order Biteship dengan cara serah drop\_off dan resi langsung terbit.
3. **Cetak label.** Label A6 atau stiker 10 x 15 cm dengan barcode resi dan tanda DROP-OFF. Beberapa label bisa dicetak sekaligus.
4. **Siap Diantar.** Paket menunggu dibawa ke agen. Pesanan masih bisa dibatalkan, dan order Biteship ikut dibatalkan.
5. **Dikirim.** Mulai saat agen memindai label. Pembeli menerima email Pesanan dikirim. Sejak titik ini pesanan tidak bisa dibatalkan.
6. **Terkirim.** Biteship mencatat paket sampai, dan pembeli menerima email Paket sudah sampai.
7. **Selesai.** Pembeli menekan Pesanan Diterima, atau otomatis 3 hari setelah Terkirim. Kalau status Terkirim tidak pernah datang, pesanan selesai otomatis 7 hari setelah resi terbit.

### Status dari Biteship

- Biteship mengirim perubahan status ke webhook 2mimbar.store/api/biteship/webhook. Server memeriksa bahwa order itu memang milik toko sebelum mencatatnya.
- Jadwal otomatis menanyakan status order yang lama tidak berubah, sebagai cadangan kalau webhook terlewat.
- Status gagal kirim, paket kembali, atau ditahan kurir ditandai Masalah pengiriman di Pesanan Toko supaya admin bisa menghubungi kurir dan pembeli.

### Saldo Biteship

- Biteship memakai Bitepoints yang diisi di muka, 1 Bitepoint sama dengan Rp1. Saldo dipakai untuk ongkir dan untuk biaya panggilan API tarif, order, dan pelacakan.
- Kartu Sambungan menampilkan saldo, pemakaian bulan ini, dan jumlah resi. Isi saldo dilakukan di dashboard Biteship.
- Kalau saldo di bawah Rp200.000, peringatan tampil di dashboard dan dikirim ke email admin. Kalau saldo tidak cukup, Kemas dan buat resi ditolak dengan pesan yang jelas.

### Siapa membayar ongkir

- Pembeli membayar ongkir di dalam total QRIS. Toko membayar Biteship dari saldo.
- Subsidi ongkir ditanggung toko dan mengurangi ongkir yang dibayar pembeli. Aturannya ada di bagian Aturan bisnis.

## Email

Semua email ke pembeli toko umum dikirim otomatis dari domain 2mimbar.store lewat Cloudflare Email Service. Email OTP dan email pesanan memakai alamat pengirim berbeda, dan semua kebutuhan email terdaftar di dashboard dengan kegunaannya. Tidak ada email promosi atau broadcast.

### Domain dan alamat

Domain 2mimbar.store dikelola di Cloudflare dengan catatan SPF, DKIM, dan DMARC supaya email tidak masuk spam. Pengiriman memakai binding `send_email` di Worker, dan email masuk diatur Email Routing.

| Alamat | Dipakai untuk | Email masuk |
| --- | --- | --- |
| kode@2mimbar.store | OTP, verifikasi, dan keamanan akun | Tidak menerima balasan |
| pesanan@2mimbar.store | Email pesanan ke pembeli | Diteruskan ke halo@ |
| halo@2mimbar.store | Email kontak di toko dan halaman kebijakan | Diteruskan ke email pribadi admin yang diatur di dashboard |
| laporan@2mimbar.store | Tujuan laporan payout Midtrans | Dibaca Worker untuk biaya Midtrans |

### Kebutuhan email

Setiap kebutuhan punya pilihan Dikirim dari, yang bisa diganti dengan alamat lain dari daftar di atas.

| Kelompok | Email | Dikirim dari | Dikirim saat |
| --- | --- | --- | --- |
| OTP dan verifikasi | Verifikasi akun baru | kode@ | Pembeli mendaftar dengan email |
| OTP dan verifikasi | Lupa password | kode@ | Pembeli meminta reset password |
| OTP dan verifikasi | Ganti email | kode@ | Pembeli mengganti email, dikirim ke email baru |
| OTP dan verifikasi | Hapus akun | kode@ | Pembeli meminta akunnya dihapus |
| Keamanan akun | Password diubah | kode@ | Password berhasil diganti |
| Keamanan akun | Masuk dari perangkat baru | kode@ | Akun dibuka dari browser yang belum pernah dipakai |
| Pesanan | Bukti bayar | pesanan@ | Notifikasi lunas dari Midtrans masuk |
| Pesanan | Pesanan dikemas | pesanan@ | Resi terbit |
| Pesanan | Pesanan dikirim | pesanan@ | Agen memindai label |
| Pesanan | Paket sudah sampai | pesanan@ | Biteship mencatat Terkirim |
| Pesanan | Pesanan dibatalkan | pesanan@ | Batal otomatis atau dibatalkan admin, dengan keterangan refund |
| Pesanan | Pengingat penilaian | pesanan@ | Sekali, sehari setelah Selesai kalau belum dinilai |

### Isi dan pengiriman

- Admin mengubah isi pembuka tiap email dengan isian otomatis seperti {nama} dan {no\_pesanan}. Daftar barang, total, dan tombol Lihat pesanan selalu ditambahkan sistem di bawahnya.
- Halaman Ubah isi email menampilkan pratinjau, dan tombol Kirim email uji ke saya mengirim contoh ke email admin.
- Kode OTP terdiri dari 6 angka, berlaku 10 menit, paling banyak 5 kali salah, dan bisa diminta ulang setelah 60 detik.
- Email yang gagal terkirim dicoba ulang oleh jadwal otomatis dan dicatat di log email.
- Pembeli link event tidak menerima email karena tidak mengisi email. Struk digital menjadi satu-satunya bukti.
- Peringatan saldo Biteship rendah dikirim ke email admin, bukan ke pembeli.

## Aturan bisnis

Stok berkurang saat lunas, bukan saat masuk keranjang. Satu pesanan memakai paling banyak satu promo atau voucher. Semua pemeriksaan stok dan kuota dijalankan di server dalam satu `db.batch` dengan penulisannya, sama seperti aturan stok yang sudah ada.

### Stok

- Toko umum memakai stok Gudang Pusat. Link event memakai stok event.
- Stok yang bisa dijual sama dengan stok tercatat dikurangi stok yang sedang ditahan. Saat POS offline, batas aman offline juga dikurangkan di kasir.
- Tahanan stok dibuat saat QR dibuat dan berakhir saat lunas, saat Midtrans mengabarkan expire, cancel, atau deny, atau saat jadwal otomatis memastikan transaksi tidak dibayar.
- Saat lunas, buku besar mencatat gerak `web_jual` di lokasi asal. Untuk pesanan event, barang masih ada di booth sampai diserahkan, dan penyerahan tidak mengubah stok lagi.
- Pesanan yang dibatalkan atau di-refund mencatat gerak `web_batal` atau `web_refund` yang mengembalikan stok. Kalau event sudah ditutup, stok kembali ke Gudang Pusat.
- **Bentrok stok** terdeteksi saat penjualan offline yang masuk membuat stok sebuah varian di bawah nol, sementara ada pesanan web lunas yang belum diambil untuk varian itu. Pesanan yang lunas paling akhir ditandai lebih dulu, sebanyak kekurangannya.
- Ganti barang saat bentrok mencatat gerak `web_ganti`, yaitu stok varian asal dikembalikan dan stok pengganti dikurangi.
- **Tutup event.** Hitungan fisik di booth masih memuat barang pesanan web yang belum diambil. Sistem mengurangkannya sebelum membandingkan dengan stok tercatat, lalu barang itu dibawa ke Gudang Pusat sebagai titipan yang tidak dihitung sebagai stok gudang.

### Voucher

| Aturan | Isi |
| --- | --- |
| Kode | Huruf besar dan angka, 4 sampai 15 karakter, tidak boleh sama dengan voucher lain |
| Berlaku di | Toko web, link event untuk semua event atau event tertentu, dan POS untuk lokasi yang dipilih. Bisa lebih dari satu |
| Cara pembeli mendapatkan | Tampil di daftar voucher saat checkout, atau hanya lewat kode yang dibagikan sendiri |
| Potongan | Persen dengan batas maksimal, atau nominal rupiah. Dihitung dari subtotal barang dan tidak memotong ongkir |
| Syarat | Minimal belanja dan masa berlaku |
| Kuota total | Dipakai bersama oleh semua tempat yang dicentang |
| Batas per pembeli | Toko web mengenali pembeli dari akun. Link event dan POS mengenalinya dari no HP |
| Hanya untuk pembeli baru | Toko web berarti akun yang belum pernah punya pesanan lunas. Link event dan POS berarti no HP yang belum pernah ada di transaksi lunas mana pun |
| Kuota dikunci | Saat Buat Pesanan, Bayar, atau Bayar di POS. Dilepas kalau pembayaran batal, dan dikembalikan kalau pesanan dibatalkan atau di-refund |
| Laporan | Kolom Dipakai dan Total potongan di daftar Promosi menggabungkan pemakaian dari semua tempat |

### Subsidi ongkir

- Hanya berlaku di toko web, untuk produk yang dipilih. Produk itu mendapat label Subsidi ongkir.
- Besarnya per pcs dengan batas per pesanan, misalnya Rp10.000 per pcs dan paling banyak Rp30.000 per pesanan.
- Subsidi tidak pernah melebihi ongkir kurir yang dipilih pembeli.
- Di checkout pembeli memakai salah satu, subsidi ongkir atau voucher.

### Status pesanan event

| Status | Artinya | Berikutnya |
| --- | --- | --- |
| Belum Bayar | QR aktif 5 menit dan stok ditahan. Tidak tampil di POS | Lunas, atau batal saat waktu habis |
| Siap Diambil | Sudah lunas dan stok event sudah berkurang | Diserahkan di booth atau di kantor |
| Bentrok Stok | Sebagian barang terjual di booth saat POS offline | Ganti barang, atau refund penuh |
| Sudah Diambil | Barang sudah diserahkan | Selesai |
| Perlu Refund | Event dibatalkan, atau Midtrans menolak refund | Transfer manual dengan bukti |
| Sudah Di-refund | Uang sudah kembali lewat Midtrans atau transfer | Selesai |

### Kode pengambilan

- Dua huruf dan tiga angka, misalnya KH-472, dibuat acak dan unik di dalam satu event.
- Huruf I dan O tidak dipakai supaya tidak tertukar dengan angka saat diucapkan.
- Kode dipakai bersama QR dan tidak bisa dipakai lagi setelah barang diserahkan.

### Penilaian

- Hanya untuk pesanan toko yang sudah Selesai, satu penilaian per barang per pesanan.
- Bintang wajib. Teks dan 1 sampai 3 foto boleh diisi.
- Admin bisa menyembunyikan teks atau foto, tapi tidak bisa menyembunyikan bintang. Rata-rata bintang selalu menghitung semua penilaian.

### Laporan

- Penjualan toko web dan link event dihitung pada tanggal lunas, dengan HPP saat lunas.
- Ongkir yang dibayar pembeli tidak masuk omzet barang. Subsidi ongkir dan biaya Midtrans tercatat sebagai pengurang laba.

## Model data

Perubahan masuk lewat migrasi baru mulai `0008_web_store.sql` dan mengikuti aturan D1 yang sudah ada. Rupiah disimpan sebagai bilangan bulat, waktu dalam ISO UTC, ID berupa ULID, dan setiap perubahan stok tercatat di `stok_gerak`.

### Tabel baru

| Tabel | Isi | Kolom utama |
| --- | --- | --- |
| `akun_pembeli` | Akun toko umum | email unik, nama, telp, hash password atau ID Google, waktu verifikasi email, waktu dihapus |
| `sesi_pembeli` | Sesi masuk pembeli | hash token, akun, perangkat, kedaluwarsa |
| `kode_otp` | OTP email | email, tujuan, hash kode, kedaluwarsa, jumlah percobaan |
| `alamat_pembeli` | Paling banyak 5 per akun | penerima, telp, alamat, area Biteship, kode pos, label, utama |
| `keranjang` | Keranjang toko umum | akun, sku, qty. Keranjang link event disimpan di browser |
| `pesanan_web` | Pesanan toko dan event | no unik, jalur toko atau event, akun atau nama dan telp, event, lokasi stok, status, subtotal, potongan, promo, ongkir, subsidi ongkir, total, salinan alamat, kode pengambilan, token struk, waktu lunas, diambil oleh dan cara verifikasi, alasan batal |
| `pesanan_web_item` | Barang per pesanan | sku, nama, qty, harga, hpp |
| `stok_tahan` | Stok yang sedang dibayar | pesanan, sku, lokasi, qty, sampai |
| `bayar_web` | Transaksi Midtrans | order id Midtrans, transaction id, status, nominal, biaya perkiraan, biaya asli, waktu payout, isi notifikasi terakhir |
| `refund_web` | Refund otomatis dan manual | pesanan, cara, alasan, nominal, status, pengaju, penyetuju, bank, nomor rekening, nama pemilik, bukti di `berkas` |
| `kiriman` | Order Biteship | pesanan, order id Biteship, kurir, layanan, resi, berat, ongkir, status, waktu resi terbit |
| `kiriman_jejak` | Riwayat status paket | kiriman, status, catatan, waktu |
| `penilaian` | Penilaian toko umum | pesanan, sku, akun, bintang, teks, foto, bagian yang tampil, diatur oleh, alasan |
| `promo_tempat` | Tempat berlaku voucher | promo, jenis tempat, event atau lokasi |
| `promo_pakai` | Pemakaian dan kunci kuota voucher | promo, sumber pesanan web atau trx, akun atau telp, status dikunci, terpakai, atau dilepas |
| `email_alamat` | Alamat di domain toko | alamat, nama tampilan, kegunaan, tujuan terusan |
| `email_kebutuhan` | Kebutuhan email | kode, alamat pengirim, subjek, isi pembuka |
| `email_log` | Riwayat kirim | kebutuhan, tujuan, status, percobaan, galat terakhir |
| `halaman_toko` | Halaman kebijakan | slug, judul, isi, Draf atau Terbit, diterbitkan oleh |
| `banner` | Banner beranda | gambar, judul, tujuan, mulai, selesai, urutan |
| `wa_kirim` | Antrean WA refund event batal | event, pesanan, status, waktu kirim, waktu balas |
| `laporan_payout` | Laporan payout Midtrans | berkas, diterima, jumlah baris terbaca, galat |

### Perubahan tabel lama

| Tabel | Perubahan |
| --- | --- |
| `event` | Tambah `web_aktif`, `web_slug` unik, `web_buka`, `web_tutup`, `batas_offline` bawaan 2, `batal_pada`, `batal_oleh`, `batal_alasan`. Hapus `presale_aktif` dan `presale_mode` setelah pesanan pre-sale lama selesai |
| `produk` | Tambah `deskripsi` dan sakelar `toko_web` |
| `produk_foto`, tabel baru | produk, berkas, urutan, paling banyak 9 |
| `varian` | Tambah `berat_gram` dan `foto_id` |
| `harga_saluran` | Baris dengan saluran `toko_web` untuk harga toko web |
| `stok_gerak` | Jenis baru `web_jual`, `web_batal`, `web_refund`, `web_ganti` |
| `promo` | Jenis baru `voucher` dan `subsidi_ongkir`. Tambah `kode` unik, `kuota`, `batas_per_pembeli`, `hanya_baru`, `tampil_di_daftar`, `subsidi_per_pcs`, `subsidi_maks` |
| `trx` | Kolom pre-sale tidak dipakai lagi untuk transaksi baru. Data lama tetap untuk riwayat |
| `berkas` | Jenis baru `produk`, `banner`, `penilaian`, `payout` |
| `pengaturan` | Kunci baru `toko_web` untuk Info Toko, pengumuman, dan batas saldo Biteship |

## API, webhook, dan jadwal

Semua berjalan di Worker yang sudah ada dengan router buatan sendiri tanpa paket npm. API pembeli dipisah dari API karyawan, webhook selalu diperiksa keasliannya, dan pekerjaan berkala memakai cron Worker.

### API

| Kelompok | Awalan | Isi |
| --- | --- | --- |
| Toko umum, publik | `/api/toko/` | Beranda, kategori, produk, penilaian produk, halaman kebijakan |
| Toko umum, perlu masuk | `/api/toko/` | Daftar, masuk, masuk dengan Google, OTP, lupa password, alamat, keranjang, tarif ongkir, checkout, status bayar, pesanan, Pesanan Diterima, penilaian |
| Link event | `/api/e/` | Halaman event, cek stok, pesan dan bayar, status bayar |
| Struk | `/api/s/` | Struk lewat token, temukan struk dengan no HP dan kode, form rekening refund |
| POS | `/api/` yang ada | Daftar Web Order ikut tarik data berkala, serahkan barang, ganti barang, ajukan dan setujui refund, cek dan kunci voucher. Semua yang mengubah status pesanan web hanya jalan saat online |
| Dashboard | `/api/` yang ada | Pesanan Toko, Kemas dan buat resi berkelompok, label, batal, Pesanan Event, refund manual, WA refund, penilaian, Pengaturan Toko Web |

### Webhook dan email masuk

| Sumber | Alamat atau pintu | Pemeriksaan |
| --- | --- | --- |
| Midtrans | `/api/midtrans/notifikasi` | Tanda tangan dengan server key, lalu tanya ulang status ke Midtrans. Aman diulang |
| Biteship | `/api/biteship/webhook` | Order harus ada di tabel `kiriman`, lalu status dicek ulang ke API Biteship kalau ada keraguan |
| Gateway WA | `/api/wa/masuk` | Rahasia bersama di header. Balasan YA dari nomor pembeli memicu kirim link form rekening |
| Email ke laporan@ | Penangan `email` di Worker lewat Email Routing | Pengirim harus dari domain Midtrans. Lampiran disimpan di `berkas` lalu dibaca |

### Jadwal otomatis

| Jadwal | Waktu | Pekerjaan |
| --- | --- | --- |
| Rekap harian, sudah ada | `10 17 * * *`, 00.10 WIB | Menghitung ulang rekap 7 hari, ditambah baris toko web dan link event |
| Pembayaran | Setiap 5 menit | Menanyakan status QRIS yang lewat batas waktu tanpa notifikasi, lalu melepas stok dan kuota voucher |
| Pengiriman | Setiap 30 menit | Menanyakan status kiriman yang lama tidak berubah ke Biteship |
| Pesanan | Setiap jam | Selesai otomatis, pengingat penilaian, coba ulang email gagal, cek saldo Biteship, buka dan tutup link event sesuai jadwal |
| WA refund | Setiap menit, 08.00 sampai 20.00 WIB | Mengirim satu pesan dari antrean kalau jeda acak 30 sampai 90 detik sudah lewat dan jatah 50 pesan hari itu belum habis |

Server tidak bergantung pada jadwal untuk keamanan. Jam buka dan tutup link, batas waktu bayar, dan kuota voucher selalu dicek saat permintaan masuk.

### Rahasia dan binding baru

`deploy.py` ditambah binding `send_email`, penangan email masuk, jadwal baru, dan secret `MIDTRANS_SERVER_KEY`, `BITESHIP_API_KEY`, `WA_GATEWAY_KEY`, `WA_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, dan `GOOGLE_CLIENT_SECRET`. Nilai secret tidak pernah dicetak, sama seperti `PEPPER`.

## Keamanan dan privasi

Server menjadi satu-satunya penentu harga, stok, status bayar, dan penyerahan barang. Data pribadi pembeli hanya ditampilkan kepada orang yang membutuhkannya, dan tidak pernah di layar kasir.

### Akun dan sesi

- Password pembeli disimpan dengan PBKDF2 dan `PEPPER`, sama dengan password karyawan.
- Sesi memakai cookie HttpOnly, Secure, dan SameSite Lax. Token sesi disimpan sebagai hash. API yang mengubah data juga memeriksa asal permintaan.
- Masuk, OTP, lupa password, temukan struk, form rekening, dan cek no HP di POS dibatasi jumlah percobaannya memakai tabel `percobaan_gagal` yang sudah ada.
- Daftar akun dan Temukan struk memakai Cloudflare Turnstile untuk menahan bot.

### Pesanan dan pembayaran

- Harga, potongan, ongkir, dan total selalu dihitung ulang di server. Angka dari browser hanya dipakai untuk tampilan.
- Status lunas hanya dari notifikasi Midtrans yang tanda tangannya cocok dan statusnya sudah ditanyakan ulang.
- Barang event baru boleh diserahkan dengan QR yang cocok, atau dengan no HP yang cocok ditambah nama yang dicek petugas. Kode pengambilan saja tidak cukup.
- Token struk acak dan panjang. QR tidak memuat ID transaksi, nama, atau no HP.
- Refund bentrok stok butuh PIN penanggung jawab event dan sinyal, supaya persetujuannya bisa dibuktikan ke server.
- Semua refund, ganti barang, pembatalan, penyerahan, dan perubahan tampilan penilaian tercatat di `log_aktivitas` dengan pelakunya.

### Privasi pembeli

- Layar POS tidak pernah menampilkan no HP. Nama pemesan baru tampil setelah QR atau no HP cocok.
- Struk digital tidak mencetak nama dan no HP pemesan.
- Nama pembeli di penilaian tampil disamarkan, misalnya Wulan S.
- Foto penilaian dibersihkan dari metadata lokasi sebelum disimpan.
- Pesan WA pertama tidak berisi link, dan selalu menyebut bahwa toko tidak pernah meminta PIN atau kode OTP.
- Nama, no HP, dan alamat dikirim ke Midtrans dan Biteship hanya sebatas yang dibutuhkan untuk bayar dan kirim. Kebijakan Privasi menyebut kedua layanan ini.
- Akun yang dihapus disamarkan, sedangkan angka penjualannya tetap untuk laporan.
- Email pribadi admin hanya tampil tersamar di dashboard, misalnya a•••••@gmail.com.

### Sambungan

- Halaman Sambungan hanya untuk Owner. Kunci API disimpan sebagai secret Worker dan tidak pernah ditampilkan lagi setelah disimpan.
- Webhook Midtrans, Biteship, dan gateway WA diperiksa keasliannya sebelum diproses. Email laporan hanya diterima dari pengirim Midtrans.

## Biaya dan kuota

Web store mengubah prinsip paket gratis Rp0 di Arsitektur-Cloudflare.md. Biaya tetap terkecil adalah Workers Paid 5 dolar AS per bulan dan domain 2mimbar.store per tahun. Sisanya mengikuti pemakaian.

| Layanan | Biaya | Yang sudah termasuk | Catatan |
| --- | --- | --- | --- |
| Cloudflare Workers Paid | 5 dolar AS per bulan | 10 juta permintaan dan 30 juta milidetik CPU per bulan | Wajib untuk Email Service. Batas CPU per permintaan jauh lebih longgar dari paket gratis, penting untuk webhook dan membaca laporan payout |
| Cloudflare D1 di Workers Paid | Ikut paket | 25 miliar baris dibaca, 50 juta baris ditulis, dan 5 GB per bulan | Kelebihan penyimpanan 0,75 dolar AS per GB per bulan |
| Cloudflare Email Service | Ikut paket | 3.000 email keluar per bulan, lalu 0,35 dolar AS per 1.000 email | Email masuk lewat Email Routing tidak dibatasi. Fitur kirim masih beta |
| Domain 2mimbar.store | Sekitar 42 dolar AS per tahun untuk perpanjangan |  | Cloudflare Registrar menjual sesuai harga registry tanpa tambahan. Harga pasti dicek saat membeli |
| Midtrans QRIS | 0% sampai Rp100.000 dan 0,7% di atasnya per transaksi, atau 0% sampai Rp500.000 dan 0,3% di atasnya untuk usaha mikro |  | Tanpa biaya bulanan. Angka asli dibaca dari laporan payout |
| Biteship | Ongkir sesuai tarif kurir, ditambah biaya panggilan API seperti Rp5 per cek tarif |  | Dibayar dari saldo Bitepoints yang diisi di muka |
| Gateway WA tidak resmi | Sesuai paket penyedia |  | Hanya untuk WA refund event batal |
| Google Sign-In | Gratis |  | Butuh proyek Google Cloud dan layar persetujuan OAuth |
| Cloudflare Turnstile | Gratis |  |  |

Sumber harga Cloudflare: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [perkiraan harga .store di Cloudflare](https://domainoffer.net/tld/store/cloudflare). Diperiksa 23 Nov 2026.

### Perkiraan pemakaian

- **Email.** Satu pesanan toko memakai sekitar 5 email, yaitu bukti bayar, dikemas, dikirim, sampai, dan pengingat penilaian. Jatah 3.000 email cukup untuk sekitar 500 pesanan toko per bulan ditambah OTP.
- **Permintaan Worker.** Arsitektur lama memperkirakan sekitar 5.000 permintaan per hari dari POS dan dashboard. Satu pembeli web yang melihat-lihat sampai membayar diperkirakan memakai puluhan permintaan, ditambah tanya status bayar setiap beberapa detik. Event besar dengan ribuan pengunjung link tetap jauh di bawah 10 juta per bulan.
- **Foto produk.** Foto dibuka jauh lebih sering daripada bukti biaya. Kalau tetap di D1, setiap foto harus disimpan di cache Cloudflare supaya tidak dibaca dari database setiap kali tampil.
- **Bitepoints.** Biaya cek tarif dipotong setiap pembeli membuka ongkir, jadi tarif disimpan sebentar per alamat dan berat.

## Daftar gambar

Sebelas papan PNG menjadi acuan tampilan. Kalau gambar dan dokumen ini berbeda, dokumen ini yang berlaku. Semua gambar ada di `docs/gambar/web-store/` dalam format WebP.

| File | Isi | Perlu disesuaikan |
| --- | --- | --- |
| [alur-toko-umum](gambar/web-store/alur-toko-umum.webp) | Toko umum dari beranda sampai penilaian, kategori, akun, alamat, keranjang habis, batal otomatis | Layar 12 belum punya kolom teks ulasan. Keterangan layar 9 masih menyebut jadwal jemput, padahal paket diantar ke agen |
| [alur-pembeli-link-event](gambar/web-store/alur-pembeli-link-event.webp) | Link event dari halaman event sampai struk diambil, link belum dibuka, waktu bayar habis, temukan struk, ambil di kantor | Keterangan layar 3 masih menyebut tidak ada voucher. Kolom voucher ada di alur-voucher-event-pos |
| [alur-web-order-pos-1](gambar/web-store/alur-web-order-pos-1.webp) | Tab Web Order di POS, jalur QR dan jalur no HP, tombol geser, kode tidak ditemukan, sudah diambil, offline |  |
| [alur-web-order-pos-2](gambar/web-store/alur-web-order-pos-2.webp) | Stok yang mendahulukan web, saat offline, bentrok stok, ganti barang, refund dengan PIN penanggung jawab |  |
| [alur-refund-event-batal](gambar/web-store/alur-refund-event-batal.webp) | Batalkan event, WA refund, form rekening, transfer manual, hasil refund Midtrans |  |
| [alur-form-event](gambar/web-store/alur-form-event.webp) | Form event dengan Link Web Order, event terjadwal dengan stok kosong, event dibuka, poster QR, status link |  |
| [alur-dashboard-web-1](gambar/web-store/alur-dashboard-web-1.webp) | Form produk dengan foto, berat, dan harga toko web, daftar produk, Pesanan Toko, rincian, batal |  |
| [alur-dashboard-web-2](gambar/web-store/alur-dashboard-web-2.webp) | Daftar promosi, jenis promosi, form voucher, penilaian, atur tampilan penilaian |  |
| [alur-pengaturan-toko](gambar/web-store/alur-pengaturan-toko.webp) | Info Toko, Tampilan Beranda, Email, Ubah isi email, Halaman Kebijakan, Sambungan, biaya Midtrans otomatis |  |
| [alur-pengiriman](gambar/web-store/alur-pengiriman.webp) | Kemas dan buat resi, konfirmasi saldo, label A6, Siap Diantar, Dikirim, subsidi ongkir, Sambungan Biteship |  |
| [alur-voucher-event-pos](gambar/web-store/alur-voucher-event-pos.webp) | Voucher di checkout link event dan di POS, termasuk saat offline |  |

Nama orang, nomor, resi, dan angka di semua gambar hanya contoh.

## Keputusan yang sudah diambil

Keputusan berikut sudah disepakati selama pembahasan gambar di November 2026 dan menjadi dasar pembangunan.

| No | Topik | Keputusan |
| --- | --- | --- |
| 1 | Jalur jual | Toko umum wajib akun. Link event tanpa login, cukup nama dan no HP |
| 2 | Tampilan | Pola Shopee dengan navy #02194F, logo dan nama Hikayat sendiri |
| 3 | Akun | Masuk dengan Google, atau email dan password dengan OTP |
| 4 | Pembayaran | Hanya QRIS Midtrans. Waktu bayar 15 menit untuk toko dan 5 menit untuk event. Layar QR buatan sendiri |
| 5 | Stok | Keranjang tidak mengunci stok. Stok ditahan selama bayar dan baru berkurang saat lunas |
| 6 | Pre-sale | Dihapus dan diganti link event |
| 7 | Struk event | Struk belanja digital meniru MTIX dan TIX ID, dengan QR dan kode 2 huruf 3 angka, tanpa nama dan no HP |
| 8 | Verifikasi di booth | QR cocok sudah cukup. Tanpa QR, no HP dicocokkan server dan nama dicek petugas. Penyerahan memakai tombol geser |
| 9 | Barang event tidak diambil | Diambil di kantor tanpa batas waktu, tanpa refund |
| 10 | Offline | Penyerahan dikunci. Unit terakhir tiap varian dikunci sesuai batas aman event, bawaan 2 pcs |
| 11 | Bentrok stok | Ganti barang seharga sama, atau refund penuh lewat Midtrans dengan PIN penanggung jawab event |
| 12 | Event batal | Transfer manual. Pemberitahuan lewat gateway WA tidak resmi, link rekening dikirim setelah pembeli membalas YA |
| 13 | Pengiriman | Biteship dengan cara serah drop-off. Resi terbit saat admin menekan Kemas dan buat resi |
| 14 | Selesai otomatis | 3 hari setelah Terkirim, cadangan 7 hari setelah resi terbit |
| 15 | Domain | 2mimbar.store |
| 16 | Email | Semua email ke pembeli otomatis lewat Cloudflare Email Service. Alamat OTP dan alamat pesanan berbeda, semua terdaftar di dashboard dengan kegunaannya |
| 17 | Promosi lewat email | Tidak ada |
| 18 | Biaya Midtrans | Otomatis dari laporan payout, dengan perkiraan aturan BI sebelum laporan datang |
| 19 | Voucher | Punya pengaturan sendiri tentang tempat berlakunya, yaitu toko web, link event, dan POS. Satu pesanan satu promo atau voucher |
| 20 | Subsidi ongkir | Per pcs untuk produk terpilih dengan batas per pesanan, hanya di toko web. Pembeli memakai subsidi atau voucher |
| 21 | Penilaian | Bintang selalu tampil. Admin memilih apakah teks dan foto ikut tampil |
| 22 | Info toko | Alamat kantor dan WA admin diisi di dashboard dan wajib sebelum toko web dibuka |

## Yang perlu dicek dan risiko

Enam belas hal perlu dicek atau diputuskan sebelum pembangunan berjalan jauh. Yang paling menentukan adalah Workers Paid, tempat foto produk, dan akun Midtrans yang sudah terverifikasi dengan fitur refund aktif.

### Perlu dicek atau diputuskan

- [ ] Setujui pindah ke Workers Paid, yang mengubah prinsip paket gratis Rp0.
- [ ] Putuskan tempat foto produk. Usulannya bucket R2 publik untuk foto produk, banner, dan foto penilaian, sementara bukti biaya dan bukti refund tetap di `berkas` D1. Pilihan lain adalah tetap di D1 dengan cache Cloudflare.
- [ ] Beli domain 2mimbar.store di Cloudflare, lalu aktifkan Email Routing, Email Sending, SPF, DKIM, dan DMARC.
- [ ] Daftarkan akun Midtrans dan selesaikan verifikasi setelah halaman kebijakan terbit. Pastikan kategori usaha, karena usaha mikro mendapat biaya QRIS yang berbeda.
- [ ] Aktifkan fitur refund QRIS di Midtrans dan pastikan cara refund serta batas waktunya untuk akun Anda.
- [ ] Arahkan email laporan payout Midtrans ke laporan@2mimbar.store, lalu uji format laporannya dari akun asli. Formatnya bisa CSV atau XLSX dan mungkin memakai password.
- [ ] Buat akun Biteship, isi saldo awal, cek kurir yang menerima drop-off dari alamat kantor, dan catat nama status webhook yang persis.
- [ ] Pilih penyedia gateway WA dan siapkan nomor khusus, bukan nomor WA utama. Uji webhook balasan YA.
- [ ] Buat proyek Google Cloud untuk masuk dengan Google.
- [ ] Isi alamat kantor dan WA admin di Info Toko.
- [ ] Lengkapi data penjual untuk Kebijakan Privasi, Syarat dan Ketentuan, dan Kebijakan Pengembalian.
- [ ] Setujui kebijakan retur, yaitu klaim lewat WA paling lambat 2 x 24 jam dengan video membuka paket, hanya untuk salah kirim, cacat, atau rusak.
- [ ] Setujui arti pembeli baru di tiap jalur seperti di bagian Aturan bisnis.
- [ ] Selesaikan semua pesanan pre-sale lama sebelum fitur pre-sale dihapus.
- [ ] Push perubahan repo setelah 20 Okt 2026 kalau ada, supaya migrasi baru tidak bentrok.
- [ ] Perbarui keterangan dua gambar seperti di Daftar gambar.

### Risiko

| Risiko | Akibat | Penanganan |
| --- | --- | --- |
| Nomor gateway WA tidak resmi diblokir WhatsApp | Pemberitahuan refund event batal berhenti | Nomor khusus, paling banyak 50 pesan per hari, jeda acak, pesan pertama tanpa link. Cadangannya daftar pembeli CSV untuk dihubungi manual |
| Email Sending Cloudflare masih beta | Fitur, harga, atau kuota harian awal bisa berubah | Log email dan coba ulang. Pembeli tetap bisa melihat status di Pesanan Saya. Pengiriman dibungkus satu fungsi supaya mudah diganti penyedia lain |
| Format laporan payout Midtrans berubah | Biaya asli tidak terbaca | Perkiraan tetap tercatat, dan dashboard menandai laporan yang gagal dibaca |
| Webhook Midtrans atau Biteship terlewat | Status pesanan tertunda | Jadwal otomatis menanyakan ulang status |
| Refund QRIS ditolak Midtrans | Uang pembeli belum kembali | Otomatis pindah ke refund manual |
| Bentrok stok karena POS offline | Pembeli tidak mendapat barang yang dibayar | Batas aman offline dan penanganan langsung di booth |
| Sinyal lemah di lokasi event | Penyerahan pesanan web tertahan karena butuh online | Siapkan sinyal cadangan di booth. Tab Penjualan tetap jalan offline |
| Saldo Biteship habis | Resi tidak bisa dibuat | Peringatan saat saldo di bawah Rp200.000 |
| Lonjakan pengunjung link saat event | Halaman lambat | Halaman event ringan, data produk disimpan di cache, stok dicek saat bayar |
| Penipu mengaku dari toko saat event batal | Pembeli tertipu | Form rekening hanya terbuka dengan no HP pemesan, pesan WA menyebut toko tidak meminta PIN atau OTP, dan nama rekening dicek admin |

## Urutan pembangunan

Pembangunan melanjutkan tahap 1 sampai 8 di Arsitektur-Cloudflare.md. Link event dibangun lebih dulu karena menggantikan pre-sale dan bisa diuji di satu event kecil sebelum toko umum dibuka.

1. **Tahap 9, fondasi.** Workers Paid, domain 2mimbar.store diarahkan ke Worker, migrasi `0008_web_store.sql`, tempat foto produk, perubahan form produk, Info Toko, dan Halaman Kebijakan. Halaman kebijakan dibuat di sini supaya verifikasi Midtrans berjalan sambil membangun tahap berikutnya.
   - Selesai kalau produk bisa diisi foto, berat, dan harga toko web, dan halaman kebijakan sudah terbit.
2. **Tahap 10, link event dan Midtrans.** Bagian Link Web Order di form event, halaman event, checkout, QRIS Midtrans dengan notifikasi, tahanan stok, struk digital, Struk Saya, Temukan struk, dan Pesanan Event di dashboard.
   - Selesai kalau pesanan di sandbox Midtrans bisa lunas, batal karena waktu habis, dan stoknya benar di dashboard.
3. **Tahap 11, POS Web Order.** Tab Web Order, jalur QR dan no HP, tombol geser, stok yang mendahulukan web, batas aman offline, bentrok stok dengan ganti barang dan refund ber-PIN, serta pengambilan di POS Gudang Pusat.
   - Selesai kalau sudah dicoba di satu event kecil, termasuk saat POS offline.
4. **Tahap 12, event batal.** Batalkan Event, gateway WA dengan antrean dan balasan YA, form rekening, dan transfer manual dengan bukti.
   - Selesai kalau satu event uji bisa dibatalkan sampai semua struk berubah menjadi Uang Sudah Dikembalikan.
5. **Tahap 13, email.** Email Routing dan Email Sending, empat alamat, kebutuhan email, isi pembuka, log, dan email uji.
   - Selesai kalau OTP dan email pesanan sampai ke kotak masuk, bukan spam.
6. **Tahap 14, toko umum.** Akun dan OTP, masuk dengan Google, alamat, beranda, kategori, halaman produk, keranjang, checkout, bayar, dan Pesanan Saya.
   - Selesai kalau pembeli uji bisa berbelanja sampai lunas dan menerima bukti bayar.
7. **Tahap 15, pengiriman.** Tarif Biteship di checkout, Kemas dan buat resi, label A6, webhook dan cek berkala, saldo, dan selesai otomatis.
   - Selesai kalau satu paket uji sampai ke alamat dengan status dan email yang benar.
8. **Tahap 16, promosi dan penilaian.** Voucher di toko web, link event, dan POS, subsidi ongkir, penilaian dengan Atur tampilan, dan Tampilan Beranda.
   - Selesai kalau kuota dan batas per pembeli tetap benar saat voucher dipakai bersamaan dari beberapa tempat.
9. **Tahap 17, keuangan dan peluncuran.** Biaya Midtrans otomatis dari laporan payout, baris toko web dan link event di laporan, pemeriksaan keamanan, lalu pre-sale dihapus dari kode dan database.
   - Selesai kalau laporan payout asli terbaca dan Midtrans sudah memakai kunci production.
