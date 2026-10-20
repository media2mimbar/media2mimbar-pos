// Alat bantu uji: Worker + D1 tiruan, pemanggil API, dan data awal yang sering dipakai.
import assert from "node:assert/strict";
import worker from "../dist/index.js";
import { d1Lokal } from "./d1-lokal.mjs";

export function lingkungan() {
  const env = { DB: d1Lokal(), PEPPER: "pepper-uji", SETUP_KODE: "KODE" };
  const c = { cookie: null };
  async function api(method, path, body, opsi = {}) {
    const h = { "cf-connecting-ip": "10.0.0.1", ...(opsi.headers ?? {}) };
    let isi;
    if (body instanceof Uint8Array) {
      isi = body;
      h["content-type"] = "application/octet-stream";
    } else if (body !== undefined) {
      isi = JSON.stringify(body);
      h["content-type"] = "application/json";
    }
    const cookie = opsi.cookie === undefined ? c.cookie : opsi.cookie;
    if (cookie) h.cookie = cookie;
    const res = await worker.fetch(new Request("https://hikayat.test" + path, { method, headers: h, body: isi }), env);
    const jenis = res.headers.get("content-type") ?? "";
    const data = jenis.includes("json") ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers, cookie: res.headers.get("set-cookie")?.split(";")[0] };
  }
  const ok = (r, status = 200) => {
    assert.equal(r.status, status, JSON.stringify(r.data));
    return r.data;
  };
  const sql = (q, ...p) => env.DB.raw.prepare(q).all(...p).map((x) => ({ ...x }));
  return { env, api, ok, sql, c };
}

// Owner masuk dashboard. Mengembalikan id Owner.
export async function siapkanOwner(L) {
  L.ok(await L.api("POST", "/api/setup", { kode: "KODE", nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" }), 201);
  const r = await L.api("POST", "/api/masuk", { email: "rina@hikayat.id", password: "hikayat123" });
  L.ok(r);
  L.c.cookie = r.cookie;
  return r.data.staff.id;
}

// Daftarkan satu HP dan masukkan karyawan lewat PIN. Mengembalikan header untuk permintaan POS.
export async function siapkanHp(L, staffId, pin, nama = "HP Booth 1") {
  const p = L.ok(await L.api("POST", "/api/perangkat", { nama }), 201);
  const d = L.ok(await L.api("POST", "/api/pos/daftar", { kode: p.kode_daftar }, { cookie: null }), 201);
  const hp = { "x-perangkat": d.token };
  const m = L.ok(await L.api("POST", "/api/pos/masuk", { staff_id: staffId, pin }, { headers: hp, cookie: null }));
  return { hp, pos: { ...hp, "x-sesi": m.sesi }, perangkat: d.perangkat };
}
