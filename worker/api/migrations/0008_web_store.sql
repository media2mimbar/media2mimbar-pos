-- Tahap 9: fondasi web store. Foto publik di R2, foto produk, sakelar toko web, berat dan foto per varian.
-- Harga toko web memakai harga_saluran dengan saluran 'toko_web', polanya sama dengan 'gudang', jadi tabelnya tidak berubah.

-- Foto publik (produk, lalu banner dan penilaian di tahap berikutnya). Isi file ada di bucket R2 binding FOTO,
-- dua ukuran per foto: <jenis>/<id>/besar (sisi terpanjang 1200 px) dan <jenis>/<id>/kecil (400 px).
-- Bukti biaya, bukti refund, dan gambar QRIS tetap di tabel berkas D1 karena tidak boleh dibuka publik.
CREATE TABLE foto (
  id          TEXT PRIMARY KEY,
  jenis       TEXT NOT NULL CHECK (jenis IN ('produk', 'banner', 'penilaian')),
  mime        TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/webp')),
  ukuran      INTEGER NOT NULL,                  -- byte, besar + kecil
  dibuat_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);
CREATE INDEX foto_jenis ON foto (jenis, dibuat_pada);

-- Paling banyak 9 foto per produk. Urutan 0 adalah foto utama. Satu foto hanya milik satu produk.
CREATE TABLE produk_foto (
  foto_id   TEXT PRIMARY KEY REFERENCES foto(id),
  produk_id TEXT NOT NULL REFERENCES produk(id),
  urutan    INTEGER NOT NULL CHECK (urutan BETWEEN 0 AND 8)
);
CREATE UNIQUE INDEX produk_foto_urutan ON produk_foto (produk_id, urutan);

-- Sakelar Toko web 2Mimbar di form produk. Hanya bisa menyala kalau produk punya foto dan semua varian aktif punya berat.
ALTER TABLE produk ADD COLUMN toko_web INTEGER NOT NULL DEFAULT 0;

-- Berat termasuk kemasan, untuk ongkir Biteship. Foto varian dipilih dari foto produknya sendiri.
ALTER TABLE varian ADD COLUMN berat_gram INTEGER CHECK (berat_gram IS NULL OR berat_gram BETWEEN 1 AND 50000);
ALTER TABLE varian ADD COLUMN foto_id TEXT REFERENCES foto(id);
