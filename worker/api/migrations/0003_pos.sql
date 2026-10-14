-- Tahap 3: POS inti. Shift (laci), kas masuk/keluar, transaksi, pembayaran, berkas (foto di D1),
-- harga khusus per saluran (mulai dari Gudang Pusat), persetujuan atasan, dokumen POS yang ditolak.

CREATE TABLE berkas (
  id          TEXT PRIMARY KEY,
  jenis       TEXT NOT NULL,                 -- 'qris', 'bukti_biaya', 'bukti_refund', 'retur', 'terbuang'
  mime        TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  ukuran      INTEGER NOT NULL,
  isi         BLOB NOT NULL,
  ref_tabel   TEXT,
  ref_id      TEXT,
  dibuat_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);

-- Harga khusus per saluran. 'gudang' = Harga Jual Langsung Gudang. Marketplace menyusul di tahap 6.
CREATE TABLE harga_saluran (
  sku         TEXT NOT NULL REFERENCES varian(sku),
  saluran     TEXT NOT NULL,
  harga       INTEGER NOT NULL CHECK (harga >= 0),
  diubah_pada TEXT NOT NULL,
  diubah_oleh TEXT,
  PRIMARY KEY (sku, saluran)
);

CREATE TABLE shift (
  id             TEXT PRIMARY KEY,            -- ULID dari HP
  lokasi_id      TEXT NOT NULL REFERENCES lokasi(id),
  perangkat_id   TEXT REFERENCES perangkat(id),
  kasir_id       TEXT NOT NULL REFERENCES staff(id),   -- pemilik laci (yang membuka)
  buka           TEXT NOT NULL,
  modal          INTEGER NOT NULL CHECK (modal >= 0),
  status         TEXT NOT NULL CHECK (status IN ('buka', 'tutup')),
  tutup          TEXT,
  seharusnya     INTEGER,
  kas_hitung     INTEGER,
  selisih        INTEGER,
  catatan        TEXT,
  ditutup_oleh   TEXT REFERENCES staff(id),
  disetujui_oleh TEXT REFERENCES staff(id),
  pj_id          TEXT REFERENCES staff(id),   -- penanggung jawab kalau kas kurang
  penjelasan     TEXT,
  offline        INTEGER NOT NULL DEFAULT 0,
  diterima_pada  TEXT NOT NULL,
  diubah_pada    TEXT NOT NULL
);
CREATE INDEX shift_lokasi ON shift (lokasi_id, status);

CREATE TABLE kas_laci (
  id           TEXT PRIMARY KEY,
  shift_id     TEXT NOT NULL REFERENCES shift(id),
  jenis        TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
  jumlah       INTEGER NOT NULL CHECK (jumlah > 0),
  catatan      TEXT NOT NULL,
  waktu        TEXT NOT NULL,
  oleh         TEXT REFERENCES staff(id),
  perangkat_id TEXT REFERENCES perangkat(id),
  diterima_pada TEXT NOT NULL
);
CREATE INDEX kas_laci_shift ON kas_laci (shift_id);

CREATE TABLE trx (
  id             TEXT PRIMARY KEY,            -- ULID dari HP; kiriman ganda ditolak lewat kunci ini
  no             TEXT NOT NULL UNIQUE,        -- HK-261008-B2-0012
  shift_id       TEXT NOT NULL REFERENCES shift(id),
  lokasi_id      TEXT NOT NULL REFERENCES lokasi(id),
  perangkat_id   TEXT REFERENCES perangkat(id),
  kasir_id       TEXT NOT NULL REFERENCES staff(id),
  waktu          TEXT NOT NULL,
  subtotal       INTEGER NOT NULL,
  diskon         INTEGER NOT NULL DEFAULT 0,
  promo          TEXT,
  pajak          INTEGER NOT NULL DEFAULT 0,
  pembulatan     INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  metode         TEXT NOT NULL,               -- Tunai, QRIS, Transfer, Campuran
  dibayar        INTEGER NOT NULL,
  kembalian      INTEGER NOT NULL DEFAULT 0,
  pelanggan_id   TEXT,
  pelanggan_nama TEXT,
  pelanggan_telp TEXT,
  status         TEXT NOT NULL DEFAULT 'Lunas' CHECK (status IN ('Lunas', 'Void', 'Refund')),
  catatan        TEXT,
  offline        INTEGER NOT NULL DEFAULT 0,
  diterima_pada  TEXT NOT NULL,
  diubah_pada    TEXT NOT NULL
);
CREATE INDEX trx_waktu ON trx (waktu);
CREATE INDEX trx_shift ON trx (shift_id);
CREATE INDEX trx_lokasi ON trx (lokasi_id, waktu);

CREATE TABLE trx_item (
  id     TEXT PRIMARY KEY,
  trx_id TEXT NOT NULL REFERENCES trx(id),
  sku    TEXT NOT NULL REFERENCES varian(sku),
  nama   TEXT NOT NULL,
  qty    INTEGER NOT NULL CHECK (qty > 0),
  harga  INTEGER NOT NULL CHECK (harga >= 0),
  hpp    INTEGER NOT NULL,                    -- HPP produk saat transaksi diterima server
  urutan INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX trx_item_trx ON trx_item (trx_id);
CREATE INDEX trx_item_sku ON trx_item (sku);

CREATE TABLE trx_bayar (
  id     TEXT PRIMARY KEY,
  trx_id TEXT NOT NULL REFERENCES trx(id),
  metode TEXT NOT NULL CHECK (metode IN ('Tunai', 'QRIS', 'Transfer')),
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  ref    TEXT,                                -- 4 digit terakhir no. referensi QRIS
  urutan INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX trx_bayar_trx ON trx_bayar (trx_id);

-- Token persetujuan atasan sekali pakai (tutup kasir, void, retur).
CREATE TABLE persetujuan (
  id          TEXT PRIMARY KEY,               -- SHA-256 dari token
  staff_id    TEXT NOT NULL REFERENCES staff(id),
  aksi        TEXT NOT NULL,
  perangkat_id TEXT REFERENCES perangkat(id),
  dibuat_pada TEXT NOT NULL,
  kadaluarsa  TEXT NOT NULL,
  dipakai     INTEGER NOT NULL DEFAULT 0
);

-- Kiriman POS yang tidak lolos pemeriksaan server. Disimpan utuh supaya tidak ada penjualan yang hilang.
CREATE TABLE dokumen_ditolak (
  id           TEXT PRIMARY KEY,
  perangkat_id TEXT,
  jenis        TEXT NOT NULL,
  dokumen_id   TEXT,
  alasan       TEXT NOT NULL,
  isi          TEXT NOT NULL,
  diterima_pada TEXT NOT NULL,
  selesai      INTEGER NOT NULL DEFAULT 0
);

INSERT INTO pengaturan (kunci, nilai, diubah_pada) VALUES ('pos', '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- HP menarik data yang berubah sejak tarik terakhir. Indeks ini menjaga jumlah baris yang dibaca D1 tetap kecil.
CREATE INDEX produk_diubah ON produk (diubah_pada);
CREATE INDEX varian_diubah ON varian (diubah_pada);
CREATE INDEX stok_lokasi_diubah ON stok (lokasi_id, diubah_pada);
