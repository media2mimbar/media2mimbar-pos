-- Tahap 7: biaya (event dan umum), rekap harian penjualan (diisi Cron tiap malam), pengaturan keuangan.

CREATE TABLE biaya (
  id          TEXT PRIMARY KEY,
  no          TEXT NOT NULL UNIQUE,              -- BY/yymmdd/0001
  lokasi_id   TEXT REFERENCES lokasi(id),        -- NULL = biaya umum; selain itu event
  tanggal     TEXT NOT NULL,                     -- YYYY-MM-DD (WIB)
  kategori    TEXT NOT NULL,
  keterangan  TEXT NOT NULL,
  jumlah      INTEGER NOT NULL CHECK (jumlah > 0),
  cara        TEXT NOT NULL CHECK (cara IN ('Transfer', 'Tunai')),
  bukti       TEXT REFERENCES berkas(id),
  oleh        TEXT NOT NULL REFERENCES staff(id),
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dihapus_pada TEXT,                             -- dihapus tetap disimpan untuk jejak
  dihapus_oleh TEXT REFERENCES staff(id)
);
CREATE INDEX biaya_tanggal ON biaya (tanggal);
CREATE INDEX biaya_lokasi ON biaya (lokasi_id);

-- Rekap per hari WIB, per tempat (lokasi POS atau saluran online), per SKU. Dihitung ulang dari transaksi, jadi aman diisi berkali-kali.
CREATE TABLE rekap_harian (
  tanggal   TEXT NOT NULL,
  sumber    TEXT NOT NULL CHECK (sumber IN ('pos', 'online')),
  tempat    TEXT NOT NULL,                       -- lokasi_id atau saluran_id
  sku       TEXT NOT NULL,
  qty       INTEGER NOT NULL,
  kotor     INTEGER NOT NULL,                    -- harga × qty
  potongan  INTEGER NOT NULL,                    -- diskon, promo, pembulatan, atau potongan marketplace
  retur     INTEGER NOT NULL,                    -- uang kembali retur
  hpp       INTEGER NOT NULL,
  transaksi INTEGER NOT NULL,
  dihitung_pada TEXT NOT NULL,
  PRIMARY KEY (tanggal, sumber, tempat, sku)
);

CREATE INDEX retur_waktu ON retur (waktu);
CREATE INDEX kas_laci_waktu ON kas_laci (waktu);
CREATE INDEX faktur_bayar_tanggal ON faktur_bayar (tanggal);

INSERT INTO pengaturan (kunci, nilai, diubah_pada) VALUES ('keuangan', '{"bagi_biaya_umum":false}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
