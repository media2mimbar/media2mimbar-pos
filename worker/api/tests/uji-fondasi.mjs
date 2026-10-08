// Uji tahap 1: setup Owner, login dashboard, karyawan, pendaftaran HP, PIN POS.
// Jalankan: node build.mjs && node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../dist/index.js";
import { d1Lokal } from "./d1-lokal.mjs";

const env = { DB: d1Lokal(), PEPPER: "pepper-uji", SETUP_KODE: "KODE-SETUP-UJI" };

async function api(method, path, { body, cookie, headers = {}, ip = "10.0.0.1" } = {}) {
  const h = { "cf-connecting-ip": ip, ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie;
  const res = await worker.fetch(new Request("https://hikayat.test" + path, { method, headers: h, body: body && JSON.stringify(body) }), env);
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, data: await res.json(), cookie: setCookie?.split(";")[0], setCookie };
}

const owner = { nama: "Rina Wijaya", email: "rina@hikayat.id", password: "hikayat123", pin: "135790" };
let ownerCookie;

test("setup Owner pertama", async () => {
  assert.deepEqual((await api("GET", "/api/setup")).data, { perlu: true });
  assert.equal((await api("POST", "/api/setup", { body: { ...owner, kode: "salah" } })).status, 403);
  assert.equal((await api("POST", "/api/setup", { body: { ...owner, kode: env.SETUP_KODE, password: "pendek" } })).status, 400);
  assert.equal((await api("POST", "/api/setup", { body: { ...owner, kode: env.SETUP_KODE } })).status, 201);
  assert.equal((await api("POST", "/api/setup", { body: { ...owner, kode: env.SETUP_KODE } })).status, 409);
  assert.deepEqual((await api("GET", "/api/setup")).data, { perlu: false });
});

test("login dashboard dan cookie aman", async () => {
  assert.equal((await api("GET", "/api/saya")).status, 401);
  const salah = await api("POST", "/api/masuk", { body: { email: owner.email, password: "salah123" } });
  assert.equal(salah.status, 401);
  assert.match(salah.data.error, /Sisa 4/);
  const r = await api("POST", "/api/masuk", { body: { email: "RINA@hikayat.id", password: owner.password } });
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /Secure/);
  assert.match(r.setCookie, /SameSite=Strict/);
  ownerCookie = r.cookie;
  const s = await api("GET", "/api/saya", { cookie: ownerCookie });
  assert.deepEqual(s.data.staff.role, ["owner"]);
  // Token sesi tidak disimpan mentah di database.
  const token = ownerCookie.split("=")[1];
  assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM sesi WHERE id = ?").get(token).n, 0);
});

test("POST tanpa JSON ditolak (perlindungan CSRF dari form)", async () => {
  const res = await worker.fetch(
    new Request("https://hikayat.test/api/karyawan", { method: "POST", headers: { cookie: ownerCookie, "content-type": "application/x-www-form-urlencoded" }, body: "nama=x" }),
    env,
  );
  assert.equal(res.status, 415);
});

test("akun dikunci setelah 5 kali salah", async () => {
  for (let i = 0; i < 5; i++) await api("POST", "/api/masuk", { body: { email: "kunci@hikayat.id", password: "salah123" } });
  const r = await api("POST", "/api/masuk", { body: { email: "kunci@hikayat.id", password: "salah123" } });
  assert.equal(r.status, 429);
});

let dimas, sari;

test("Owner menambah karyawan, password dan PIN sementara", async () => {
  const a = await api("POST", "/api/karyawan", { cookie: ownerCookie, body: { nama: "Dimas Pratama", email: "dimas@hikayat.id", role: ["admin"] } });
  assert.equal(a.status, 201);
  assert.match(a.data.password_sementara, /^[a-z0-9]{10}$/);
  assert.match(a.data.pin_sementara, /^\d{6}$/);
  dimas = { id: a.data.id, pw: a.data.password_sementara, pin: a.data.pin_sementara };

  const k = await api("POST", "/api/karyawan", { cookie: ownerCookie, body: { nama: "Sari Handayani", role: ["kasir"], pin: "333333" } });
  assert.equal(k.status, 201);
  assert.equal(k.data.password_sementara, null);
  sari = { id: k.data.id, pin: "333333" };

  assert.equal((await api("POST", "/api/karyawan", { cookie: ownerCookie, body: { nama: "Tanpa Email", role: ["admin"] } })).status, 400);
  assert.equal((await api("POST", "/api/karyawan", { cookie: ownerCookie, body: { nama: "Dobel", email: "dimas@hikayat.id", role: ["admin"] } })).status, 409);

  const daftar = await api("GET", "/api/karyawan", { cookie: ownerCookie });
  assert.equal(daftar.data.karyawan.length, 3);
  assert.ok(!JSON.stringify(daftar.data).includes("pin_hash"));
});

let dimasCookie;

test("Admin wajib ganti password sementara, lalu hanya boleh ke perangkat", async () => {
  const r = await api("POST", "/api/masuk", { body: { email: "dimas@hikayat.id", password: dimas.pw } });
  assert.equal(r.status, 200);
  assert.equal(r.data.staff.wajib_ganti_password, true);
  dimasCookie = r.cookie;
  const blok = await api("GET", "/api/perangkat", { cookie: dimasCookie });
  assert.equal(blok.status, 403);
  assert.equal(blok.data.kode, "wajib_ganti_password");

  assert.equal((await api("POST", "/api/ganti-password", { cookie: dimasCookie, body: { lama: "salah", baru: "dimasbaru1" } })).status, 400);
  assert.equal((await api("POST", "/api/ganti-password", { cookie: dimasCookie, body: { lama: dimas.pw, baru: "dimasbaru1" } })).status, 200);
  assert.equal((await api("GET", "/api/perangkat", { cookie: dimasCookie })).status, 200);
  assert.equal((await api("GET", "/api/karyawan", { cookie: dimasCookie })).status, 403);
  assert.equal((await api("GET", "/api/riwayat-masuk", { cookie: dimasCookie })).status, 403);
});

test("Kasir tidak bisa masuk dashboard", async () => {
  // Kasir tidak punya email, jadi tidak ada cara masuk. Uji juga Admin yang diturunkan jadi Kasir.
  const ubah = await api("PATCH", `/api/karyawan/${dimas.id}`, { cookie: ownerCookie, body: { nama: "Dimas Pratama", email: "dimas@hikayat.id", role: ["kasir"] } });
  assert.equal(ubah.status, 200);
  assert.equal((await api("GET", "/api/perangkat", { cookie: dimasCookie })).status, 401);
  assert.equal((await api("POST", "/api/masuk", { body: { email: "dimas@hikayat.id", password: "dimasbaru1" } })).status, 401);
  await api("PATCH", `/api/karyawan/${dimas.id}`, { cookie: ownerCookie, body: { nama: "Dimas Pratama", email: "dimas@hikayat.id", role: ["admin"] } });
  env.DB.raw.exec("DELETE FROM percobaan_gagal");
  dimasCookie = (await api("POST", "/api/masuk", { body: { email: "dimas@hikayat.id", password: "dimasbaru1" } })).cookie;
});

test("Owner terakhir tidak bisa dihapus atau menonaktifkan diri", async () => {
  const saya = (await api("GET", "/api/saya", { cookie: ownerCookie })).data.staff;
  const r = await api("PATCH", `/api/karyawan/${saya.id}`, { cookie: ownerCookie, body: { nama: saya.nama, email: saya.email, role: ["admin"] } });
  assert.equal(r.status, 400);
  const r2 = await api("PATCH", `/api/karyawan/${saya.id}`, { cookie: ownerCookie, body: { nama: saya.nama, email: saya.email, role: ["owner"], aktif: false } });
  assert.equal(r2.status, 400);
});

let tokenHp;

test("pendaftaran HP dengan kode sekali pakai", async () => {
  const p = await api("POST", "/api/perangkat", { cookie: dimasCookie, body: { nama: "HP Booth 1" } });
  assert.equal(p.status, 201);
  assert.equal(p.data.kode, "A1");
  assert.match(p.data.kode_daftar, /^[A-Z2-9]{8}$/);

  assert.equal((await api("POST", "/api/pos/daftar", { body: { kode: "SALAH123" }, ip: "10.0.0.9" })).status, 400);
  const kodeKetik = p.data.kode_daftar.toLowerCase().replace(/(....)/, "$1-");
  const d = await api("POST", "/api/pos/daftar", { body: { kode: kodeKetik }, ip: "10.0.0.9" });
  assert.equal(d.status, 201);
  tokenHp = d.data.token;
  assert.equal(d.data.perangkat.kode, "A1");
  assert.equal((await api("POST", "/api/pos/daftar", { body: { kode: p.data.kode_daftar } })).status, 400);

  const p2 = await api("POST", "/api/perangkat", { cookie: ownerCookie, body: { nama: "HP Booth 2" } });
  assert.equal(p2.data.kode, "A2");
});

test("kode pendaftaran kedaluwarsa setelah 10 menit", async () => {
  const p = await api("POST", "/api/perangkat", { cookie: ownerCookie, body: { nama: "HP lama" } });
  env.DB.raw.prepare("UPDATE perangkat SET daftar_kadaluarsa = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), p.data.id);
  assert.equal((await api("POST", "/api/pos/daftar", { body: { kode: p.data.kode_daftar }, ip: "10.0.0.8" })).status, 400);
  const daftar = (await api("GET", "/api/perangkat", { cookie: ownerCookie })).data.perangkat;
  assert.equal(daftar.find((x) => x.id === p.data.id).status, "kode_kadaluarsa");
});

let sesiSari;

test("POS: pilih nama, PIN, wajib ganti PIN sementara", async () => {
  const hp = { "x-perangkat": tokenHp };
  assert.equal((await api("GET", "/api/pos/karyawan")).status, 401);
  const daftar = await api("GET", "/api/pos/karyawan", { headers: hp });
  assert.deepEqual(daftar.data.karyawan.map((k) => k.nama), ["Dimas Pratama", "Rina Wijaya", "Sari Handayani"]);
  assert.ok(daftar.data.karyawan.every((k) => k.petunjuk === ""));

  const salah = await api("POST", "/api/pos/masuk", { headers: hp, body: { staff_id: sari.id, pin: "000000" } });
  assert.equal(salah.status, 401);
  const r = await api("POST", "/api/pos/masuk", { headers: hp, body: { staff_id: sari.id, pin: sari.pin } });
  assert.equal(r.status, 200);
  assert.equal(r.data.staff.wajib_ganti_pin, true);
  sesiSari = r.data.sesi;
  const pos = { ...hp, "x-sesi": sesiSari };
  assert.equal((await api("POST", "/api/pos/ganti-pin", { headers: pos, body: { pin_lama: sari.pin, pin_baru: "123456" } })).status, 400);
  assert.equal((await api("POST", "/api/pos/ganti-pin", { headers: pos, body: { pin_lama: sari.pin, pin_baru: "482913" } })).status, 200);
  assert.equal((await api("GET", "/api/pos/saya", { headers: pos })).data.staff.wajib_ganti_pin, false);
  // Sesi POS terikat ke HP: token sesi tanpa token HP yang sama ditolak.
  assert.equal((await api("GET", "/api/pos/saya", { headers: { "x-sesi": sesiSari } })).status, 401);
});

test("nama sama di POS diberi petunjuk pembeda", async () => {
  const k = await api("POST", "/api/karyawan", { cookie: ownerCookie, body: { nama: "Sari Handayani", role: ["kasir"], telp: "081234567890" } });
  const daftar = (await api("GET", "/api/pos/karyawan", { headers: { "x-perangkat": tokenHp } })).data.karyawan;
  const sari2 = daftar.filter((x) => x.nama === "Sari Handayani");
  assert.equal(sari2.find((x) => x.id === k.data.id).petunjuk, "HP …7890");
  assert.equal((await api("GET", "/api/pos/karyawan", { headers: { "x-perangkat": tokenHp } })).data.karyawan.find((x) => x.nama === "Dimas Pratama").petunjuk, "");
  await api("PATCH", `/api/karyawan/${k.data.id}`, { cookie: ownerCookie, body: { nama: "Sari Handayani", role: ["kasir"], aktif: false } });
});

test("PIN dikunci 15 menit setelah 5 kali salah", async () => {
  const hp = { "x-perangkat": tokenHp };
  for (let i = 0; i < 5; i++) await api("POST", "/api/pos/masuk", { headers: hp, body: { staff_id: dimas.id, pin: "000001" } });
  const r = await api("POST", "/api/pos/masuk", { headers: hp, body: { staff_id: dimas.id, pin: dimas.pin } });
  assert.equal(r.status, 429);
  // Reset PIN oleh Owner membuka kunci.
  const baru = await api("POST", `/api/karyawan/${dimas.id}/reset-pin`, { cookie: ownerCookie, body: {} });
  assert.equal((await api("POST", "/api/pos/masuk", { headers: hp, body: { staff_id: dimas.id, pin: baru.data.pin_sementara } })).status, 200);
});

test("HP dinonaktifkan Owner langsung tidak bisa dipakai", async () => {
  const pos = { "x-perangkat": tokenHp, "x-sesi": sesiSari };
  const id = (await api("GET", "/api/pos/perangkat", { headers: pos })).data.perangkat.id;
  assert.equal((await api("POST", `/api/perangkat/${id}/nonaktifkan`, { cookie: dimasCookie, body: {} })).status, 403);
  assert.equal((await api("POST", `/api/perangkat/${id}/nonaktifkan`, { cookie: ownerCookie, body: {} })).status, 200);
  const r = await api("GET", "/api/pos/saya", { headers: pos });
  assert.equal(r.status, 401);
  assert.equal(r.data.kode, "perangkat_tidak_dikenal");
});

test("reset password dan riwayat masuk", async () => {
  const r = await api("POST", `/api/karyawan/${dimas.id}/reset-password`, { cookie: ownerCookie, body: {} });
  assert.equal(r.status, 200);
  assert.equal((await api("GET", "/api/saya", { cookie: dimasCookie })).status, 401);
  const masuk = await api("POST", "/api/masuk", { body: { email: "dimas@hikayat.id", password: r.data.password_sementara } });
  assert.equal(masuk.data.staff.wajib_ganti_password, true);

  const log = (await api("GET", "/api/riwayat-masuk", { cookie: ownerCookie })).data.riwayat;
  const aksi = new Set(log.map((l) => l.aksi));
  for (const a of ["Masuk", "Password salah", "PIN salah", "Ganti PIN", "Ganti password", "HP terdaftar", "Nonaktifkan HP", "Reset PIN", "Reset password", "Tambah karyawan"]) {
    assert.ok(aksi.has(a), `riwayat memuat "${a}"`);
  }
});

test("keluar menghapus sesi", async () => {
  const r = await api("POST", "/api/keluar", { cookie: ownerCookie });
  assert.match(r.setCookie, /Max-Age=0/);
  assert.equal((await api("GET", "/api/saya", { cookie: ownerCookie })).status, 401);
});

test("halaman dan alamat tidak dikenal", async () => {
  const res = await worker.fetch(new Request("https://hikayat.test/"), env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal((await worker.fetch(new Request("https://hikayat.test/pos"), env)).status, 200);
  assert.equal((await api("GET", "/api/tidak-ada")).status, 404);
  assert.equal((await api("DELETE", "/api/karyawan")).status, 405);
});
