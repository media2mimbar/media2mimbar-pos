#!/usr/bin/env python3
"""Deploy Worker hikayat-api ke Cloudflare lewat API, tanpa wrangler.

Pakai (dari folder worker/api):  node build.mjs && python3 deploy.py
Butuh CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN di environment.

Langkah:
1. Buat database D1 `hikayat` kalau belum ada.
2. Jalankan file migrations/*.sql yang belum pernah dijalankan (dicatat di tabel _migrasi).
3. Unggah semua modul dist/*.js sebagai Worker, dengan binding DB.
4. Buat secret PEPPER kalau belum ada (nilainya tidak pernah dicetak), dan SETUP_KODE
   selama belum ada akun sama sekali.
5. Nyalakan alamat <nama>.<subdomain>.workers.dev.
"""
import json, os, secrets, sys, urllib.error, urllib.request, uuid

API = "https://api.cloudflare.com/client/v4"
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
NAMA_WORKER = "hikayat-api"
NAMA_DB = "hikayat"
TANGGAL_KOMPAT = "2026-09-01"
DIR = os.path.dirname(os.path.abspath(__file__))


def req(method, path, body=None, ctype="application/json"):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOKEN}")
    if data is not None:
        r.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(r) as res:
            out = json.loads(res.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"Gagal {method} {path}: {e.code} {e.read().decode()[:500]}")
    if not out.get("success", True):
        sys.exit(f"Gagal {method} {path}: {out.get('errors')}")
    return out.get("result")


def sql(db_id, query, params=None):
    body = {"sql": query}
    if params:
        body["params"] = params
    return req("POST", f"/accounts/{ACCOUNT}/d1/database/{db_id}/query", body)


def siapkan_db():
    ada = [d for d in req("GET", f"/accounts/{ACCOUNT}/d1/database?name={NAMA_DB}") if d["name"] == NAMA_DB]
    if ada:
        db_id = ada[0]["uuid"]
    else:
        db_id = req("POST", f"/accounts/{ACCOUNT}/d1/database", {"name": NAMA_DB})["uuid"]
        print(f"Database D1 '{NAMA_DB}' dibuat")
    sql(db_id, "CREATE TABLE IF NOT EXISTS _migrasi (nama TEXT PRIMARY KEY, dijalankan_pada TEXT NOT NULL)")
    sudah = {r["nama"] for r in sql(db_id, "SELECT nama FROM _migrasi")[0]["results"]}
    folder = os.path.join(DIR, "migrations")
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".sql") or f in sudah:
            continue
        isi = open(os.path.join(folder, f)).read()
        sql(db_id, isi + f"\nINSERT INTO _migrasi (nama, dijalankan_pada) VALUES ('{f}', datetime('now'));")
        print(f"Migrasi {f} dijalankan")
    return db_id


def unggah_worker(db_id):
    dist = os.path.join(DIR, "dist")
    modul = sorted(f for f in os.listdir(dist) if f.endswith(".js"))
    if "index.js" not in modul:
        sys.exit("dist/index.js tidak ada. Jalankan dulu: node build.mjs")
    meta = {
        "main_module": "index.js",
        "compatibility_date": TANGGAL_KOMPAT,
        "bindings": [{"type": "d1", "name": "DB", "id": db_id}],
        "keep_bindings": ["secret_text"],
        "observability": {"enabled": True},
    }
    b = uuid.uuid4().hex
    bagian = [f'--{b}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n'.encode()]
    for f in modul:
        isi = open(os.path.join(dist, f), "rb").read()
        bagian.append(f'--{b}\r\nContent-Disposition: form-data; name="{f}"; filename="{f}"\r\nContent-Type: application/javascript+module\r\n\r\n'.encode() + isi + b"\r\n")
    bagian.append(f"--{b}--\r\n".encode())
    req("PUT", f"/accounts/{ACCOUNT}/workers/scripts/{NAMA_WORKER}", b"".join(bagian), f"multipart/form-data; boundary={b}")
    print(f"Worker {NAMA_WORKER} diunggah ({len(modul)} modul)")


def siapkan_secret(db_id):
    ada = {s["name"] for s in req("GET", f"/accounts/{ACCOUNT}/workers/scripts/{NAMA_WORKER}/secrets")}
    if "PEPPER" not in ada:
        req("PUT", f"/accounts/{ACCOUNT}/workers/scripts/{NAMA_WORKER}/secrets",
            {"name": "PEPPER", "text": secrets.token_urlsafe(32), "type": "secret_text"})
        print("Secret PEPPER dibuat")
    belum_ada_akun = sql(db_id, "SELECT count(*) AS n FROM staff")[0]["results"][0]["n"] == 0
    if "SETUP_KODE" not in ada and belum_ada_akun:
        kode = secrets.token_hex(4).upper()
        req("PUT", f"/accounts/{ACCOUNT}/workers/scripts/{NAMA_WORKER}/secrets",
            {"name": "SETUP_KODE", "text": kode, "type": "secret_text"})
        print(f"Kode setup Owner pertama: {kode}")


def nyalakan_alamat():
    req("POST", f"/accounts/{ACCOUNT}/workers/scripts/{NAMA_WORKER}/subdomain", {"enabled": True, "previews_enabled": False})
    sub = req("GET", f"/accounts/{ACCOUNT}/workers/subdomain")["subdomain"]
    print(f"Alamat: https://{NAMA_WORKER}.{sub}.workers.dev")


if __name__ == "__main__":
    db_id = siapkan_db()
    unggah_worker(db_id)
    siapkan_secret(db_id)
    nyalakan_alamat()
