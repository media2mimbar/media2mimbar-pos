-- Tahap 1: akun, sesi, perangkat POS, riwayat masuk.
-- Waktu dalam UTC ISO 8601. ID memakai ULID.

CREATE TABLE staff (
  id            TEXT PRIMARY KEY,
  nama          TEXT NOT NULL,
  telp          TEXT,
  email         TEXT UNIQUE COLLATE NOCASE,   -- wajib untuk Owner/Admin, kosong untuk Kasir saja
  pw_hash       TEXT,
  pw_salt       TEXT,
  pw_iterasi    INTEGER,
  pw_sementara  INTEGER NOT NULL DEFAULT 1,
  pin_hash      TEXT NOT NULL,
  pin_sementara INTEGER NOT NULL DEFAULT 1,
  aktif         INTEGER NOT NULL DEFAULT 1,
  dibuat_pada   TEXT NOT NULL,
  diubah_pada   TEXT NOT NULL,
  dibuat_oleh   TEXT
);

CREATE TABLE staff_role (
  staff_id TEXT NOT NULL REFERENCES staff(id),
  role     TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'kasir')),
  PRIMARY KEY (staff_id, role)
);

CREATE TABLE perangkat (
  id                 TEXT PRIMARY KEY,
  kode               TEXT NOT NULL UNIQUE,   -- dua karakter, dipakai di nomor dokumen (HK-261007-B2-0012)
  nama               TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('menunggu', 'aktif', 'nonaktif')),
  token_hash         TEXT UNIQUE,
  daftar_kode_hash   TEXT,
  daftar_kadaluarsa  TEXT,
  terakhir_dipakai   TEXT,
  dibuat_pada        TEXT NOT NULL,
  diubah_pada        TEXT NOT NULL,
  dibuat_oleh        TEXT,
  dinonaktifkan_oleh TEXT
);

CREATE TABLE sesi (
  id             TEXT PRIMARY KEY,           -- SHA-256 dari token; token aslinya hanya ada di cookie/HP
  jenis          TEXT NOT NULL CHECK (jenis IN ('dashboard', 'pos')),
  staff_id       TEXT NOT NULL REFERENCES staff(id),
  perangkat_id   TEXT REFERENCES perangkat(id),
  dibuat_pada    TEXT NOT NULL,
  terakhir_aktif TEXT NOT NULL,
  ip             TEXT,
  ua             TEXT
);
CREATE INDEX sesi_staff ON sesi (staff_id);

CREATE TABLE log_masuk (
  id           TEXT PRIMARY KEY,
  waktu        TEXT NOT NULL,
  staff_id     TEXT,
  nama         TEXT,
  aksi         TEXT NOT NULL,
  tempat       TEXT NOT NULL,                -- 'dashboard' atau 'pos'
  perangkat_id TEXT,
  ip           TEXT,
  keterangan   TEXT
);
CREATE INDEX log_masuk_waktu ON log_masuk (waktu);

CREATE TABLE percobaan_gagal (
  kunci        TEXT PRIMARY KEY,             -- 'pw:<email>', 'pin:<staff>:<perangkat>', 'daftar:<ip>'
  jumlah       INTEGER NOT NULL,
  pertama      TEXT NOT NULL,
  kunci_sampai TEXT
);

CREATE TABLE pengaturan (
  kunci       TEXT PRIMARY KEY,
  nilai       TEXT NOT NULL,                 -- JSON
  diubah_pada TEXT NOT NULL,
  diubah_oleh TEXT
);
