-- Tahap 5: promo, pelanggan, pre-sale (pengambilan dan refund), void, retur barang cacat, stok terbuang.

CREATE TABLE promo (
  id                TEXT PRIMARY KEY,
  nama              TEXT NOT NULL,
  deskripsi         TEXT,
  cakupan           TEXT NOT NULL CHECK (cakupan IN ('produk', 'total')),
  jenis             TEXT NOT NULL CHECK (jenis IN ('persen', 'nominal', 'bonus', 'bundling')),
  besar             INTEGER NOT NULL DEFAULT 0,      -- persen (0-100) atau rupiah
  maks_potongan     INTEGER NOT NULL DEFAULT 0,      -- 0 = tanpa batas (persen)
  min_belanja       INTEGER NOT NULL DEFAULT 0,
  min_qty           INTEGER NOT NULL DEFAULT 0,
  kelipatan         INTEGER NOT NULL DEFAULT 0,
  auto              INTEGER NOT NULL DEFAULT 0,
  kasir_ubah        INTEGER NOT NULL DEFAULT 0,      -- kasir boleh mengubah persen
  kasir_maks_persen INTEGER NOT NULL DEFAULT 0,
  bonus_qty         INTEGER NOT NULL DEFAULT 0,
  harga_paket       INTEGER NOT NULL DEFAULT 0,
  lokasi_id         TEXT REFERENCES lokasi(id),      -- NULL = semua lokasi
  mulai             TEXT NOT NULL,                   -- YYYY-MM-DD
  selesai           TEXT NOT NULL,
  jam_mulai         TEXT NOT NULL DEFAULT '00:00',
  jam_selesai       TEXT NOT NULL DEFAULT '23:59',
  hari              TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',   -- 0 = Minggu
  status            TEXT NOT NULL CHECK (status IN ('Aktif', 'Draf', 'Tidak Aktif')),
  dibuat_pada       TEXT NOT NULL,
  diubah_pada       TEXT NOT NULL,
  dibuat_oleh       TEXT
);
CREATE INDEX promo_diubah ON promo (diubah_pada);

-- syarat: produk yang dibeli; bonus: produk gratis; paket: isi bundling.
CREATE TABLE promo_produk (
  promo_id  TEXT NOT NULL REFERENCES promo(id),
  produk_id TEXT NOT NULL REFERENCES produk(id),
  peran     TEXT NOT NULL CHECK (peran IN ('syarat', 'bonus', 'paket')),
  PRIMARY KEY (promo_id, produk_id, peran)
);

CREATE TABLE pelanggan (
  id          TEXT PRIMARY KEY,                -- ULID dari HP atau dashboard
  nama        TEXT NOT NULL,
  telp        TEXT,
  kota        TEXT,
  grup        TEXT,
  catatan     TEXT,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);
CREATE INDEX pelanggan_telp ON pelanggan (telp);
CREATE INDEX pelanggan_diubah ON pelanggan (diubah_pada);

ALTER TABLE trx ADD COLUMN promo_id TEXT;
ALTER TABLE trx ADD COLUMN no_pesanan TEXT;                -- PSN/yymmdd/nn dari Daftar Order di HP
ALTER TABLE trx ADD COLUMN void_pada TEXT;
ALTER TABLE trx ADD COLUMN void_oleh TEXT;
ALTER TABLE trx ADD COLUMN void_disetujui TEXT;
ALTER TABLE trx ADD COLUMN void_alasan TEXT;
-- Pre-sale "ambil nanti": stok berkurang saat barang diserahkan.
ALTER TABLE trx ADD COLUMN presale INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trx ADD COLUMN ambil_status TEXT;              -- Menunggu, Diambil, Refund (Perlu Refund dihitung dari ambil_batas)
ALTER TABLE trx ADD COLUMN ambil_pada TEXT;
ALTER TABLE trx ADD COLUMN ambil_oleh TEXT;
ALTER TABLE trx ADD COLUMN ambil_lokasi TEXT;
ALTER TABLE trx ADD COLUMN ambil_cara TEXT;                -- QR atau Manual
ALTER TABLE trx ADD COLUMN ambil_disetujui TEXT;
ALTER TABLE trx ADD COLUMN ambil_batas TEXT;               -- YYYY-MM-DD, diisi saat event ditutup
ALTER TABLE trx ADD COLUMN refund_pada TEXT;
ALTER TABLE trx ADD COLUMN refund_oleh TEXT;
ALTER TABLE trx ADD COLUMN refund_bank TEXT;
ALTER TABLE trx ADD COLUMN refund_norek TEXT;
ALTER TABLE trx ADD COLUMN refund_an TEXT;
ALTER TABLE trx ADD COLUMN refund_catatan TEXT;
ALTER TABLE trx ADD COLUMN refund_bukti TEXT;              -- berkas.id
ALTER TABLE trx ADD COLUMN potongan_cek INTEGER;           -- potongan menurut promo di server, kalau berbeda dengan HP
CREATE INDEX trx_presale ON trx (presale, ambil_status);
CREATE INDEX trx_pelanggan ON trx (pelanggan_id);

ALTER TABLE trx_item ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0;   -- jumlah pcs di baris ini yang gratis dari promo

CREATE TABLE retur (
  id             TEXT PRIMARY KEY,
  no             TEXT NOT NULL UNIQUE,                -- RTR-<no trx>-k
  trx_id         TEXT NOT NULL REFERENCES trx(id),
  lokasi_id      TEXT NOT NULL REFERENCES lokasi(id),
  shift_id       TEXT REFERENCES shift(id),
  waktu          TEXT NOT NULL,
  oleh           TEXT NOT NULL REFERENCES staff(id),
  disetujui_oleh TEXT NOT NULL REFERENCES staff(id),
  cara           TEXT NOT NULL CHECK (cara IN ('Tukar barang', 'Uang kembali')),
  metode         TEXT CHECK (metode IN ('Tunai', 'Transfer')),
  nilai          INTEGER NOT NULL DEFAULT 0,
  alasan         TEXT NOT NULL,
  foto           TEXT,
  perangkat_id   TEXT REFERENCES perangkat(id),
  offline        INTEGER NOT NULL DEFAULT 0,
  diterima_pada  TEXT NOT NULL
);
CREATE INDEX retur_trx ON retur (trx_id);
CREATE INDEX retur_shift ON retur (shift_id);

CREATE TABLE retur_item (
  id       TEXT PRIMARY KEY,
  retur_id TEXT NOT NULL REFERENCES retur(id),
  sku      TEXT NOT NULL REFERENCES varian(sku),
  qty      INTEGER NOT NULL CHECK (qty > 0),
  harga    INTEGER NOT NULL,
  hpp      INTEGER NOT NULL
);
CREATE INDEX retur_item_retur ON retur_item (retur_id);

CREATE TABLE terbuang (
  id          TEXT PRIMARY KEY,
  lokasi_id   TEXT NOT NULL REFERENCES lokasi(id),
  tanggal     TEXT NOT NULL,
  alasan      TEXT NOT NULL CHECK (alasan IN ('Rusak', 'Hilang', 'Cacat dari pemasok', 'Berjamur atau lembap', 'Lainnya')),
  penjelasan  TEXT NOT NULL,
  pj_id       TEXT NOT NULL REFERENCES staff(id),
  foto        TEXT,
  kerugian    INTEGER NOT NULL,
  oleh        TEXT NOT NULL REFERENCES staff(id),
  waktu       TEXT NOT NULL
);
CREATE TABLE terbuang_item (
  id          TEXT PRIMARY KEY,
  terbuang_id TEXT NOT NULL REFERENCES terbuang(id),
  sku         TEXT NOT NULL REFERENCES varian(sku),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  hpp         INTEGER NOT NULL
);
CREATE INDEX terbuang_item_t ON terbuang_item (terbuang_id);
