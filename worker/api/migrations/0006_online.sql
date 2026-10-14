-- Tahap 6: saluran marketplace, harga per SKU di marketplace, pesanan online (impor dan input manual), riwayat impor.

-- Toko marketplace. Biaya hanya dipakai sebagai perkiraan potongan saat input manual.
-- Persen disimpan dalam basis poin (1% = 100) supaya tetap bilangan bulat.
CREATE TABLE saluran (
  id               TEXT PRIMARY KEY,               -- shopee, tokopedia, tiktok, lainnya
  nama             TEXT NOT NULL,
  marketplace      INTEGER NOT NULL DEFAULT 1,     -- 0 untuk "Lainnya" (semua produk, tanpa harga khusus)
  aktif            INTEGER NOT NULL DEFAULT 1,
  biaya_admin_bp   INTEGER NOT NULL DEFAULT 0 CHECK (biaya_admin_bp BETWEEN 0 AND 10000),
  biaya_layanan_bp INTEGER NOT NULL DEFAULT 0 CHECK (biaya_layanan_bp BETWEEN 0 AND 10000),
  biaya_pesanan    INTEGER NOT NULL DEFAULT 0 CHECK (biaya_pesanan >= 0),
  preset_kolom     TEXT,                           -- JSON { field: judul kolom }, dari impor terakhir
  peta_sku         TEXT,                           -- JSON { sku di file: sku katalog }
  urutan           INTEGER NOT NULL DEFAULT 0,
  diubah_pada      TEXT NOT NULL
);
INSERT INTO saluran (id, nama, marketplace, urutan, diubah_pada) VALUES
  ('shopee', 'Shopee', 1, 1, '2026-10-13T00:00:00.000Z'),
  ('tokopedia', 'Tokopedia', 1, 2, '2026-10-13T00:00:00.000Z'),
  ('tiktok', 'TikTok Shop', 1, 3, '2026-10-13T00:00:00.000Z'),
  ('lainnya', 'Lainnya', 0, 4, '2026-10-13T00:00:00.000Z');

-- Varian yang dijual di marketplace. Harga kosong = harga jual normal.
CREATE TABLE saluran_varian (
  saluran_id  TEXT NOT NULL REFERENCES saluran(id),
  sku         TEXT NOT NULL REFERENCES varian(sku),
  harga       INTEGER CHECK (harga IS NULL OR harga >= 0),
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (saluran_id, sku)
);

CREATE TABLE impor_batch (
  id         TEXT PRIMARY KEY,
  saluran_id TEXT NOT NULL REFERENCES saluran(id),
  nama_file  TEXT NOT NULL,
  waktu      TEXT NOT NULL,
  oleh       TEXT NOT NULL REFERENCES staff(id),
  masuk      INTEGER NOT NULL DEFAULT 0,
  duplikat   INTEGER NOT NULL DEFAULT 0,
  batal      INTEGER NOT NULL DEFAULT 0,
  gagal      INTEGER NOT NULL DEFAULT 0
);

-- Pesanan online mengurangi stok Gudang Pusat. Kunci anti-dobel: saluran + no pesanan.
CREATE TABLE pesanan_online (
  id           TEXT PRIMARY KEY,
  saluran_id   TEXT NOT NULL REFERENCES saluran(id),
  no_pesanan   TEXT NOT NULL,
  tanggal      TEXT NOT NULL,                      -- ISO UTC
  pembeli      TEXT,
  pelanggan_id TEXT REFERENCES pelanggan(id),
  status       TEXT NOT NULL CHECK (status IN ('Selesai', 'Diproses', 'Dibatalkan')),
  kotor        INTEGER NOT NULL,                   -- Σ qty × harga
  potongan     INTEGER NOT NULL DEFAULT 0 CHECK (potongan >= 0),
  sumber       TEXT NOT NULL CHECK (sumber IN ('Manual', 'Impor')),
  impor_id     TEXT REFERENCES impor_batch(id),
  catatan      TEXT,
  oleh         TEXT NOT NULL REFERENCES staff(id),
  batal_pada   TEXT,
  batal_oleh   TEXT REFERENCES staff(id),
  dibuat_pada  TEXT NOT NULL,
  diubah_pada  TEXT NOT NULL,
  UNIQUE (saluran_id, no_pesanan)
);
CREATE INDEX pesanan_online_tanggal ON pesanan_online (tanggal);

CREATE TABLE pesanan_item (
  id         TEXT PRIMARY KEY,
  pesanan_id TEXT NOT NULL REFERENCES pesanan_online(id),
  sku        TEXT NOT NULL REFERENCES varian(sku),
  nama       TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  harga      INTEGER NOT NULL CHECK (harga >= 0),
  hpp        INTEGER NOT NULL DEFAULT 0,
  urutan     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pesanan_item_pesanan ON pesanan_item (pesanan_id);
