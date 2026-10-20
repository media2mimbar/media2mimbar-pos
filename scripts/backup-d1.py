#!/usr/bin/env python3
"""Backup database D1 `hikayat`: ekspor SQL lewat API Cloudflare, uji pulihkan ke SQLite, lalu kompres.

Setiap backup sekaligus menjadi uji pemulihan: file ekspor dijalankan ke database SQLite kosong,
lalu jumlah baris tabel penting dicocokkan dengan database asli. Kalau ada yang tidak cocok, skrip gagal.

Pakai:
  CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... python3 scripts/backup-d1.py backup/
  python3 scripts/backup-d1.py --uji backup/hikayat-20261013.sql.gz   # uji pulihkan file lama saja

Hasil: backup/hikayat-YYYYMMDD-HHMM.sql.gz dan ringkasan jumlah baris.
"""
import gzip
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

NAMA_DB = "hikayat-asia"
API = "https://api.cloudflare.com/client/v4"
TABEL_PENTING = ["staff", "perangkat", "produk", "varian", "stok", "stok_gerak", "faktur", "event", "shift", "trx", "trx_item",
                 "trx_bayar", "retur", "pesanan_online", "pelanggan", "biaya", "kerugian", "berkas"]


def req(method, path, body=None):
    akun = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    r = urllib.request.Request(f"{API}/accounts/{akun}{path}", method=method, data=json.dumps(body).encode() if body is not None else None)
    r.add_header("Content-Type", "application/json")
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        r.add_header("Authorization", "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"])
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Gagal {method} {path}: {e.code} {e.read().decode()[:300]}")
    if not out.get("success", True):
        sys.exit(f"Gagal {method} {path}: {out.get('errors')}")
    return out["result"]


def ekspor(db_id):
    # Ekspor berjalan di Cloudflare; kita menanyakan statusnya sampai tautan unduhan siap.
    hasil = req("POST", f"/d1/database/{db_id}/export", {"output_format": "polling"})
    batas = time.time() + 600
    while hasil.get("status") != "complete" or not hasil.get("result", {}).get("signed_url"):
        if hasil.get("status") == "error":
            sys.exit(f"Ekspor gagal: {hasil.get('error')}")
        if time.time() > batas:
            sys.exit("Ekspor terlalu lama (lebih dari 10 menit)")
        time.sleep(3)
        hasil = req("POST", f"/d1/database/{db_id}/export", {"output_format": "polling", "current_bookmark": hasil["at_bookmark"]})
    with urllib.request.urlopen(hasil["result"]["signed_url"], timeout=300) as res:
        return res.read().decode("utf-8")


def pulihkan(sql_teks):
    # Pulihkan ke SQLite di memori. D1 memakai SQLite, jadi file ekspornya bisa dijalankan apa adanya.
    db = sqlite3.connect(":memory:")
    db.executescript(sql_teks)
    ada = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    hilang = [t for t in TABEL_PENTING if t not in ada]
    if hilang:
        sys.exit(f"Uji pulihkan gagal: tabel tidak ada di backup: {', '.join(hilang)}")
    return {t: db.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t in TABEL_PENTING}


def hitung_asli(db_id):
    sql = "SELECT " + ", ".join(f'(SELECT COUNT(*) FROM "{t}") AS "{t}"' for t in TABEL_PENTING)
    return req("POST", f"/d1/database/{db_id}/query", {"sql": sql})[0]["results"][0]


def tulis_ringkasan(baris):
    teks = "\n".join(baris) + "\n"
    print(teks)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(teks)


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--uji":
        with gzip.open(sys.argv[2], "rt", encoding="utf-8") as f:
            jumlah = pulihkan(f.read())
        tulis_ringkasan([f"Uji pulihkan {sys.argv[2]}: berhasil", *[f"- {t}: {n}" for t, n in jumlah.items()]])
        return
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    os.makedirs(folder, exist_ok=True)
    dbs = req("GET", f"/d1/database?name={NAMA_DB}")
    db_id = next((d["uuid"] for d in dbs if d["name"] == NAMA_DB), None)
    if not db_id:
        sys.exit(f"Database {NAMA_DB} tidak ditemukan")

    sql_teks = ekspor(db_id)
    jumlah = pulihkan(sql_teks)
    asli = hitung_asli(db_id)
    # Data bisa bertambah selama ekspor berjalan, jadi backup boleh sedikit lebih sedikit, tidak boleh lebih banyak.
    selisih = {t: (jumlah[t], asli[t]) for t in TABEL_PENTING if jumlah[t] > asli[t] or asli[t] - jumlah[t] > max(5, asli[t] // 100)}
    if selisih:
        sys.exit("Uji pulihkan gagal, jumlah baris tidak cocok: " + ", ".join(f"{t} backup {a} asli {b}" for t, (a, b) in selisih.items()))

    wib = datetime.now(timezone.utc) + timedelta(hours=7)
    nama = os.path.join(folder, f"hikayat-{wib:%Y%m%d-%H%M}.sql.gz")
    with gzip.open(nama, "wt", encoding="utf-8") as f:
        f.write(sql_teks)
    ukuran = os.path.getsize(nama) / 1024
    tulis_ringkasan([
        f"Backup {nama} ({ukuran:.0f} KB terkompresi), uji pulihkan berhasil.",
        "", "| Tabel | Di backup | Di database |", "|---|---:|---:|",
        *[f"| {t} | {jumlah[t]} | {asli[t]} |" for t in TABEL_PENTING],
    ])


if __name__ == "__main__":
    main()
