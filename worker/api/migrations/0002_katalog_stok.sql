-- Tahap 2: katalog, lokasi, buku besar stok, pemasok, faktur pembelian, riwayat HPP.
-- Uang dalam rupiah bulat. Waktu dalam UTC ISO 8601. Tanggal dokumen (faktur, jatuh tempo) YYYY-MM-DD.

CREATE TABLE kategori (
  id          TEXT PRIMARY KEY,
  nama        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  urutan      INTEGER NOT NULL DEFAULT 0,
  tampil_menu INTEGER NOT NULL DEFAULT 1,     -- tampil sebagai tab kategori di POS
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);

CREATE TABLE produk (
  id           TEXT PRIMARY KEY,
  sku          TEXT NOT NULL UNIQUE,          -- SKU induk
  nama         TEXT NOT NULL,
  deskripsi    TEXT,
  kategori_id  TEXT REFERENCES kategori(id),
  satuan       TEXT NOT NULL DEFAULT 'Pcs',
  hpp          INTEGER NOT NULL DEFAULT 0,    -- satu HPP untuk semua varian (rata-rata tertimbang)
  stok_min     INTEGER NOT NULL DEFAULT 0,
  punya_varian INTEGER NOT NULL DEFAULT 0,
  tampil_pos   INTEGER NOT NULL DEFAULT 1,
  aktif        INTEGER NOT NULL DEFAULT 1,
  dibuat_pada  TEXT NOT NULL,
  diubah_pada  TEXT NOT NULL,
  dibuat_oleh  TEXT
);

-- Stok dan harga dicatat per SKU varian. Produk tanpa varian punya satu baris dengan sku = sku induk dan nama kosong.
CREATE TABLE varian (
  sku         TEXT PRIMARY KEY,
  produk_id   TEXT NOT NULL REFERENCES produk(id),
  nama        TEXT NOT NULL DEFAULT '',
  harga_jual  INTEGER NOT NULL,
  urutan      INTEGER NOT NULL DEFAULT 0,
  aktif       INTEGER NOT NULL DEFAULT 1,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);
CREATE INDEX varian_produk ON varian (produk_id);

CREATE TABLE lokasi (
  id          TEXT PRIMARY KEY,               -- 'gudang' untuk Gudang Pusat, ID event untuk event
  jenis       TEXT NOT NULL CHECK (jenis IN ('gudang', 'event')),
  nama        TEXT NOT NULL,
  aktif       INTEGER NOT NULL DEFAULT 1,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);
INSERT INTO lokasi (id, jenis, nama, dibuat_pada, diubah_pada)
VALUES ('gudang', 'gudang', 'Gudang Pusat', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Ringkasan stok. Bisa dihitung ulang dari stok_gerak.
CREATE TABLE stok (
  sku         TEXT NOT NULL REFERENCES varian(sku),
  lokasi_id   TEXT NOT NULL REFERENCES lokasi(id),
  qty         INTEGER NOT NULL DEFAULT 0,
  transit     INTEGER NOT NULL DEFAULT 0,
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (sku, lokasi_id)
);

-- Buku besar: setiap perubahan stok satu baris, tidak pernah diubah atau dihapus.
CREATE TABLE stok_gerak (
  id        TEXT PRIMARY KEY,
  sku       TEXT NOT NULL REFERENCES varian(sku),
  lokasi_id TEXT NOT NULL REFERENCES lokasi(id),
  jumlah    INTEGER NOT NULL,                 -- + masuk, − keluar
  jenis     TEXT NOT NULL CHECK (jenis IN ('awal', 'faktur', 'batal_faktur', 'kirim_keluar', 'kirim_masuk', 'transit',
            'jual', 'void', 'retur_tukar', 'rusak', 'opname', 'terbuang', 'tarik', 'presale_serah')),
  ref_tabel TEXT,
  ref_id    TEXT,
  waktu     TEXT NOT NULL,
  oleh      TEXT
);
CREATE INDEX stok_gerak_sku ON stok_gerak (sku, lokasi_id, waktu);
CREATE INDEX stok_gerak_waktu ON stok_gerak (waktu);
CREATE INDEX stok_gerak_ref ON stok_gerak (ref_tabel, ref_id);

CREATE TABLE pemasok (
  id          TEXT PRIMARY KEY,
  nama        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telp        TEXT NOT NULL,
  alamat      TEXT,
  barang      TEXT,
  rekening    TEXT,
  catatan     TEXT,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);

CREATE TABLE faktur (
  id           TEXT PRIMARY KEY,
  no           TEXT NOT NULL UNIQUE,          -- FA/yymmdd/0001
  tanggal      TEXT NOT NULL,
  pemasok_id   TEXT NOT NULL REFERENCES pemasok(id),
  total        INTEGER NOT NULL,
  jatuh_tempo  TEXT,
  catatan      TEXT,
  batal        INTEGER NOT NULL DEFAULT 0,
  batal_alasan TEXT,
  batal_oleh   TEXT,
  batal_pada   TEXT,
  dibuat_pada  TEXT NOT NULL,
  diubah_pada  TEXT NOT NULL,
  dibuat_oleh  TEXT
);
CREATE INDEX faktur_tanggal ON faktur (tanggal);
CREATE INDEX faktur_pemasok ON faktur (pemasok_id);

CREATE TABLE faktur_item (
  id        TEXT PRIMARY KEY,
  faktur_id TEXT NOT NULL REFERENCES faktur(id),
  sku       TEXT NOT NULL REFERENCES varian(sku),
  qty       INTEGER NOT NULL CHECK (qty > 0),
  harga     INTEGER NOT NULL CHECK (harga >= 0),
  urutan    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX faktur_item_faktur ON faktur_item (faktur_id);

CREATE TABLE faktur_bayar (
  id          TEXT PRIMARY KEY,
  faktur_id   TEXT NOT NULL REFERENCES faktur(id),
  tanggal     TEXT NOT NULL,
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  cara        TEXT NOT NULL,
  catatan     TEXT,
  dibuat_pada TEXT NOT NULL,
  dibuat_oleh TEXT
);
CREATE INDEX faktur_bayar_faktur ON faktur_bayar (faktur_id);

CREATE TABLE hpp_riwayat (
  id        TEXT PRIMARY KEY,
  produk_id TEXT NOT NULL REFERENCES produk(id),
  lama      INTEGER NOT NULL,
  baru      INTEGER NOT NULL,
  sebab     TEXT NOT NULL CHECK (sebab IN ('awal', 'ubah_manual', 'faktur', 'batal_faktur')),
  ref_tabel TEXT,
  ref_id    TEXT,
  waktu     TEXT NOT NULL,
  oleh      TEXT
);
CREATE INDEX hpp_riwayat_produk ON hpp_riwayat (produk_id, waktu);

-- Log aktivitas penting selain masuk/keluar (ubah harga, faktur, batal faktur, dan nanti void, retur, opname).
CREATE TABLE log_aktivitas (
  id         TEXT PRIMARY KEY,
  waktu      TEXT NOT NULL,
  staff_id   TEXT,
  nama       TEXT,
  aksi       TEXT NOT NULL,
  ref_tabel  TEXT,
  ref_id     TEXT,
  keterangan TEXT
);
CREATE INDEX log_aktivitas_waktu ON log_aktivitas (waktu);
CREATE INDEX log_aktivitas_ref ON log_aktivitas (ref_tabel, ref_id);
