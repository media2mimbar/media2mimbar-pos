-- Tahap 4: event, kirim/tarik stok (mutasi), stok opname, tutup event, selisih & kerugian.

CREATE TABLE event (
  id            TEXT PRIMARY KEY,             -- sama dengan lokasi.id
  nama          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  venue         TEXT,
  mulai         TEXT NOT NULL,                -- YYYY-MM-DD (WIB)
  selesai       TEXT NOT NULL,
  zona          TEXT NOT NULL DEFAULT 'WIB' CHECK (zona IN ('WIB', 'WITA', 'WIT')),
  catatan       TEXT,
  pj_id         TEXT NOT NULL REFERENCES staff(id),   -- penanggung jawab event
  presale_aktif INTEGER NOT NULL DEFAULT 0,
  presale_mode  TEXT NOT NULL DEFAULT 'ambil' CHECK (presale_mode IN ('ambil', 'stok')),
  ditutup       INTEGER NOT NULL DEFAULT 0,
  tutup_pada    TEXT,
  tutup_oleh    TEXT REFERENCES staff(id),
  tutup_catatan TEXT,
  dibuat_pada   TEXT NOT NULL,
  diubah_pada   TEXT NOT NULL,
  dibuat_oleh   TEXT
);

CREATE TABLE event_kasir (
  event_id TEXT NOT NULL REFERENCES event(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  PRIMARY KEY (event_id, staff_id)
);

-- Varian yang dijual di event beserta harga event (NULL = harga normal).
CREATE TABLE event_varian (
  event_id TEXT NOT NULL REFERENCES event(id),
  sku      TEXT NOT NULL REFERENCES varian(sku),
  harga    INTEGER CHECK (harga IS NULL OR harga >= 0),
  PRIMARY KEY (event_id, sku)
);

CREATE TABLE mutasi (
  id             TEXT PRIMARY KEY,
  no             TEXT NOT NULL UNIQUE,        -- MT/yymmdd/0001
  jenis          TEXT NOT NULL CHECK (jenis IN ('kirim', 'tarik')),
  dari           TEXT NOT NULL REFERENCES lokasi(id),
  ke             TEXT NOT NULL REFERENCES lokasi(id),
  status         TEXT NOT NULL CHECK (status IN ('Dikirim', 'Diterima', 'Batal')),
  dikirim_pada   TEXT NOT NULL,
  dikirim_oleh   TEXT REFERENCES staff(id),
  diterima_pada  TEXT,
  diterima_oleh  TEXT REFERENCES staff(id),
  perangkat_id   TEXT REFERENCES perangkat(id),
  catatan        TEXT,
  catatan_terima TEXT,
  batal_pada     TEXT,
  batal_oleh     TEXT REFERENCES staff(id),
  batal_alasan   TEXT,
  diubah_pada    TEXT NOT NULL
);
CREATE INDEX mutasi_ke ON mutasi (ke, status);

CREATE TABLE mutasi_item (
  id        TEXT PRIMARY KEY,
  mutasi_id TEXT NOT NULL REFERENCES mutasi(id),
  sku       TEXT NOT NULL REFERENCES varian(sku),
  dikirim   INTEGER NOT NULL CHECK (dikirim > 0),
  diterima  INTEGER CHECK (diterima IS NULL OR (diterima >= 0 AND diterima <= dikirim))
);
CREATE INDEX mutasi_item_mutasi ON mutasi_item (mutasi_id);

CREATE TABLE opname (
  id             TEXT PRIMARY KEY,
  no             TEXT NOT NULL UNIQUE,        -- SO/yymmdd/0001
  lokasi_id      TEXT NOT NULL REFERENCES lokasi(id),
  jenis          TEXT NOT NULL CHECK (jenis IN ('pos', 'gudang', 'tutup_event')),
  status         TEXT NOT NULL CHECK (status IN ('Menunggu persetujuan', 'Perlu opname ulang', 'Diganti', 'Disetujui')),
  dihitung_oleh  TEXT NOT NULL REFERENCES staff(id),
  dihitung_pada  TEXT NOT NULL,
  perangkat_id   TEXT REFERENCES perangkat(id),
  catatan        TEXT,
  disetujui_oleh TEXT REFERENCES staff(id),
  disetujui_pada TEXT,
  ulang_oleh     TEXT REFERENCES staff(id),
  ulang_pada     TEXT,
  ulang_alasan   TEXT,
  pj_id          TEXT REFERENCES staff(id),
  penjelasan     TEXT,
  kerugian       INTEGER NOT NULL DEFAULT 0,
  diterima_pada  TEXT NOT NULL,
  diubah_pada    TEXT NOT NULL
);
CREATE INDEX opname_lokasi ON opname (lokasi_id, status);

CREATE TABLE opname_item (
  id        TEXT PRIMARY KEY,
  opname_id TEXT NOT NULL REFERENCES opname(id),
  sku       TEXT NOT NULL REFERENCES varian(sku),
  sistem    INTEGER NOT NULL,                 -- stok sistem saat dihitung
  fisik     INTEGER NOT NULL CHECK (fisik >= 0),
  hpp       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX opname_item_opname ON opname_item (opname_id);

-- Selisih & Kerugian: stok (opname), kas laci kurang, barang terbuang, kiriman kurang.
CREATE TABLE kerugian (
  id          TEXT PRIMARY KEY,
  jenis       TEXT NOT NULL CHECK (jenis IN ('stok', 'kas', 'terbuang', 'kiriman')),
  ref_tabel   TEXT NOT NULL,
  ref_id      TEXT NOT NULL,
  lokasi_id   TEXT REFERENCES lokasi(id),
  tanggal     TEXT NOT NULL,                  -- waktu kejadian (ISO)
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  rincian     TEXT,                           -- ringkasan barang atau kas yang kurang
  pj_id       TEXT REFERENCES staff(id),
  penjelasan  TEXT,
  disetujui_oleh TEXT REFERENCES staff(id),
  dibuat_pada TEXT NOT NULL,
  UNIQUE (ref_tabel, ref_id, jenis)
);
CREATE INDEX kerugian_tanggal ON kerugian (tanggal);

CREATE TABLE kerugian_riwayat (
  id          TEXT PRIMARY KEY,
  kerugian_id TEXT NOT NULL REFERENCES kerugian(id),
  jenis       TEXT NOT NULL CHECK (jenis IN ('ganti', 'beban')),
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  cara        TEXT,                           -- Tunai, Transfer, Potong gaji
  catatan     TEXT,
  oleh        TEXT NOT NULL REFERENCES staff(id),
  waktu       TEXT NOT NULL
);
CREATE INDEX kerugian_riwayat_k ON kerugian_riwayat (kerugian_id);

CREATE INDEX trx_item_trx_sku ON trx_item (trx_id, sku);
