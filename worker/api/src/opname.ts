// Stok opname (dari POS dan Gudang Pusat) dan Selisih & Kerugian.

import { denganNomor } from "./dokumen.js";
import { logAktivitas, sesiSiap, Staff } from "./sesi.js";
import { bacaJson, Gagal, json, Obj, sekarang, teks, ulid, wajibBulat, wajibTeks } from "./util.js";
import { rentang } from "./penjualan.js";

// ---------- Opname ----------

export async function daftarOpname(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const syarat = ["1 = 1"], nilai: unknown[] = [];
  if (q.lokasi) { syarat.push("o.lokasi_id = ?"); nilai.push(q.lokasi); }
  if (q.status) { syarat.push("o.status = ?"); nilai.push(q.status); }
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.no, o.jenis, o.status, o.lokasi_id, l.nama AS lokasi, o.dihitung_pada, a.nama AS dihitung_oleh, b.nama AS disetujui_oleh, o.disetujui_pada,
      o.kerugian, o.catatan, o.ulang_alasan,
      (SELECT SUM(CASE WHEN fisik < sistem THEN sistem - fisik ELSE 0 END) FROM opname_item WHERE opname_id = o.id) AS kurang,
      (SELECT SUM(CASE WHEN fisik > sistem THEN fisik - sistem ELSE 0 END) FROM opname_item WHERE opname_id = o.id) AS lebih
     FROM opname o JOIN lokasi l ON l.id = o.lokasi_id JOIN staff a ON a.id = o.dihitung_oleh LEFT JOIN staff b ON b.id = o.disetujui_oleh
     WHERE ${syarat.join(" AND ")} ORDER BY o.dihitung_pada DESC LIMIT 300`,
  ).bind(...nilai).all();
  return json({ opname: results });
}

export async function ambilOpname(db: D1Database, id: string) {
  const o = await db.prepare(
    `SELECT o.*, l.nama AS lokasi, l.jenis AS jenis_lokasi, a.nama AS dihitung_oleh_nama, b.nama AS disetujui_oleh_nama, c.nama AS pj_nama
     FROM opname o JOIN lokasi l ON l.id = o.lokasi_id JOIN staff a ON a.id = o.dihitung_oleh LEFT JOIN staff b ON b.id = o.disetujui_oleh LEFT JOIN staff c ON c.id = o.pj_id WHERE o.id = ?`,
  ).bind(id).first<Obj & { id: string; lokasi_id: string; status: string; dihitung_oleh: string; dihitung_pada: string; no: string }>();
  if (!o) throw new Gagal(404, "Opname tidak ditemukan");
  const { results: item } = await db.prepare(
    `SELECT i.sku, i.sistem, i.fisik, p.hpp, TRIM(p.nama || ' ' || v.nama) AS nama, COALESCE(s.qty, 0) AS sekarang FROM opname_item i
     JOIN varian v ON v.sku = i.sku JOIN produk p ON p.id = v.produk_id LEFT JOIN stok s ON s.sku = i.sku AND s.lokasi_id = ? WHERE i.opname_id = ? ORDER BY p.nama, v.urutan`,
  ).bind(o.lokasi_id, id).all<{ sku: string; sistem: number; fisik: number; hpp: number; nama: string; sekarang: number }>();
  return { o, item };
}

export async function detailOpname(req: Request, env: Env, id: string) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const { o, item } = await ambilOpname(env.DB, id);
  const pj = o.lokasi_id === "gudang" ? null : await env.DB.prepare("SELECT pj_id FROM event WHERE id = ?").bind(o.lokasi_id).first<{ pj_id: string }>();
  return json({
    opname: o,
    item: item.map((i) => ({ ...i, selisih: i.fisik - i.sistem, kerugian: Math.max(0, i.sistem - i.fisik) * i.hpp })),
    pj_bawaan: pj?.pj_id ?? null,
  });
}

// Opname baru dari HP atau Gudang Pusat: menggantikan opname lain di lokasi itu yang belum disetujui.
export function tulisOpnameBaru(db: D1Database, d: { id: string; no: string; lokasi_id: string; jenis: string; oleh: string; waktu: string; perangkat_id: string | null; catatan: string | null;
  item: { sku: string; sistem: number; fisik: number; hpp: number }[] }) {
  const t = sekarang();
  return [
    db.prepare("UPDATE opname SET status = 'Diganti', diubah_pada = ? WHERE lokasi_id = ? AND status IN ('Menunggu persetujuan', 'Perlu opname ulang')").bind(t, d.lokasi_id),
    db.prepare(
      `INSERT INTO opname (id, no, lokasi_id, jenis, status, dihitung_oleh, dihitung_pada, perangkat_id, catatan, diterima_pada, diubah_pada)
       VALUES (?, ?, ?, ?, 'Menunggu persetujuan', ?, ?, ?, ?, ?, ?)`,
    ).bind(d.id, d.no, d.lokasi_id, d.jenis, d.oleh, d.waktu, d.perangkat_id, d.catatan, t, t),
    ...d.item.map((i) => db.prepare("INSERT INTO opname_item (id, opname_id, sku, sistem, fisik, hpp) VALUES (?, ?, ?, ?, ?, ?)").bind(ulid(), d.id, i.sku, i.sistem, i.fisik, i.hpp)),
  ];
}

// + Opname Gudang dari dashboard. Sistem diambil dari stok gudang saat ini.
export async function opnameGudang(req: Request, env: Env) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const b = await bacaJson(req);
  const fisik = (b.fisik ?? {}) as Obj;
  const { results: stok } = await env.DB.prepare(
    `SELECT v.sku, COALESCE(s.qty, 0) AS qty, p.hpp FROM varian v JOIN produk p ON p.id = v.produk_id LEFT JOIN stok s ON s.sku = v.sku AND s.lokasi_id = 'gudang'
     WHERE v.aktif = 1 OR COALESCE(s.qty, 0) <> 0`,
  ).all<{ sku: string; qty: number; hpp: number }>();
  const item = stok.map((s) => ({ sku: s.sku, sistem: s.qty, hpp: s.hpp, fisik: fisik[s.sku] === undefined || fisik[s.sku] === "" || fisik[s.sku] === null ? Math.max(0, s.qty) : wajibBulat(fisik, s.sku, `Fisik ${s.sku}`, { max: 1_000_000 }) }));
  const catatan = teks(b, "catatan", "Catatan", { max: 500, wajib: false });
  if (item.some((i) => i.fisik !== i.sistem) && !catatan) throw new Gagal(400, "Ada selisih: isi catatan");
  const id = ulid();
  const no = await denganNomor(env.DB, "SO", async (no) => {
    await env.DB.batch([...tulisOpnameBaru(env.DB, { id, no, lokasi_id: "gudang", jenis: "gudang", oleh: staff.id, waktu: sekarang(), perangkat_id: null, catatan, item }),
      logAktivitas(env.DB, staff, "Opname gudang", { tabel: "opname", id, keterangan: no })]);
    return no;
  });
  return json({ id, no }, 201);
}

// Setujui: stok = stok sekarang + (fisik − sistem saat dihitung). Penjualan setelah opname tetap diperhitungkan.
export async function setujuiOpname(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  return json(await setujuiOpnameInti(env, staff, id, await bacaJson(req)));
}

// Dipakai dashboard dan POS (Owner/Admin di HP).
export async function setujuiOpnameInti(env: Env, staff: Staff, id: string, b: Obj) {
  const { o, item } = await ambilOpname(env.DB, id);
  if (o.status !== "Menunggu persetujuan") throw new Gagal(400, `Opname berstatus ${o.status}`);
  if (o.dihitung_oleh === staff.id && !staff.role.includes("owner")) throw new Gagal(403, "Orang yang menghitung tidak bisa menyetujui hitungannya sendiri. Minta Owner atau Admin lain");
  const kerugian = item.reduce((a, i) => a + Math.max(0, i.sistem - i.fisik) * i.hpp, 0);
  const pj = teks(b, "pj_id", "Penanggung jawab", { max: 40, wajib: false });
  const penjelasan = teks(b, "penjelasan", "Penjelasan", { max: 1000, wajib: false });
  if (kerugian > 0 && (!pj || !penjelasan || penjelasan.length < 5)) throw new Gagal(400, "Ada barang kurang: pilih penanggung jawab dan isi penjelasan");
  const t = sekarang();
  const tulis = [
    env.DB.prepare("UPDATE opname SET status = 'Disetujui', disetujui_oleh = ?, disetujui_pada = ?, pj_id = ?, penjelasan = ?, kerugian = ?, diubah_pada = ? WHERE id = ? AND status = 'Menunggu persetujuan'")
      .bind(staff.id, t, pj, penjelasan, kerugian, t, id),
  ];
  for (const i of item.filter((i) => i.fisik !== i.sistem)) {
    tulis.push(
      env.DB.prepare(
        `INSERT INTO stok (sku, lokasi_id, qty, transit, diubah_pada) VALUES (?, ?, ?, 0, ?)
         ON CONFLICT (sku, lokasi_id) DO UPDATE SET qty = qty + excluded.qty, diubah_pada = excluded.diubah_pada`,
      ).bind(i.sku, o.lokasi_id, i.fisik - i.sistem, t),
      env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'opname', 'opname', ?, ?, ?)")
        .bind(ulid(), i.sku, o.lokasi_id, i.fisik - i.sistem, id, t, staff.id),
    );
  }
  if (kerugian > 0) {
    tulis.push(env.DB.prepare(
      "INSERT INTO kerugian (id, jenis, ref_tabel, ref_id, lokasi_id, tanggal, jumlah, rincian, pj_id, penjelasan, disetujui_oleh, dibuat_pada) VALUES (?, 'stok', 'opname', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(ulid(), id, o.lokasi_id, o.dihitung_pada, kerugian, item.filter((i) => i.fisik < i.sistem).map((i) => `${i.nama} kurang ${i.sistem - i.fisik}`).join(", "), pj, penjelasan, staff.id, t));
  }
  tulis.push(logAktivitas(env.DB, staff, "Setujui opname", { tabel: "opname", id, keterangan: `${o.no}, kerugian ${kerugian}` }));
  await env.DB.batch(tulis);
  return { ok: true, kerugian };
}

export async function ulangOpname(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  return json(await ulangOpnameInti(env, staff, id, await bacaJson(req)));
}

export async function ulangOpnameInti(env: Env, staff: Staff, id: string, b: Obj) {
  const { o } = await ambilOpname(env.DB, id);
  if (o.status !== "Menunggu persetujuan") throw new Gagal(400, `Opname berstatus ${o.status}`);
  const alasan = wajibTeks(b, "alasan", "Alasan", { min: 5, max: 500 });
  const t = sekarang();
  await env.DB.batch([
    env.DB.prepare("UPDATE opname SET status = 'Perlu opname ulang', ulang_oleh = ?, ulang_pada = ?, ulang_alasan = ?, diubah_pada = ? WHERE id = ?").bind(staff.id, t, alasan, t, id),
    logAktivitas(env.DB, staff, "Minta opname ulang", { tabel: "opname", id, keterangan: alasan }),
  ]);
  return { ok: true };
}

// ---------- Selisih & Kerugian ----------

export function statusKerugian(jumlah: number, ganti: number, beban: number) {
  if (beban > 0) return "Dibebankan perusahaan";
  if (ganti >= jumlah) return "Diganti";
  if (ganti > 0) return "Diganti sebagian";
  return "Belum diselesaikan";
}

export async function daftarKerugian(req: Request, env: Env) {
  await sesiSiap(env.DB, req, "owner", "admin");
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const r = q.dari || q.sampai ? rentang(q) : null;
  const { results } = await env.DB.prepare(
    `SELECT k.*, l.nama AS lokasi, p.nama AS pj, s.nama AS disetujui,
      COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id AND jenis = 'ganti'), 0) AS diganti,
      COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id AND jenis = 'beban'), 0) AS dibebankan,
      COALESCE((SELECT no FROM opname WHERE id = k.ref_id), (SELECT no FROM mutasi WHERE id = k.ref_id)) AS no_ref
     FROM kerugian k LEFT JOIN lokasi l ON l.id = k.lokasi_id LEFT JOIN staff p ON p.id = k.pj_id LEFT JOIN staff s ON s.id = k.disetujui_oleh
     ${r ? "WHERE k.tanggal >= ? AND k.tanggal < ?" : ""} ORDER BY k.tanggal DESC LIMIT 500`,
  ).bind(...(r ? [r.mulai, r.akhir] : [])).all<{ id: string; jumlah: number; diganti: number; dibebankan: number }>();
  const { results: riwayat } = await env.DB.prepare(
    `SELECT r.kerugian_id, r.jenis, r.jumlah, r.cara, r.catatan, r.waktu, s.nama AS oleh FROM kerugian_riwayat r JOIN staff s ON s.id = r.oleh ORDER BY r.waktu`,
  ).all<{ kerugian_id: string }>();
  const kerugian = results.map((k) => ({
    ...k, sisa: Math.max(0, k.jumlah - k.diganti - k.dibebankan), status: statusKerugian(k.jumlah, k.diganti, k.dibebankan),
    riwayat: riwayat.filter((x) => x.kerugian_id === k.id),
  }));
  return json({
    kerugian,
    ringkasan: {
      total: kerugian.reduce((a, k) => a + k.jumlah, 0),
      belum: kerugian.reduce((a, k) => a + k.sisa, 0),
      diganti: kerugian.reduce((a, k) => a + k.diganti, 0),
      dibebankan: kerugian.reduce((a, k) => a + k.dibebankan, 0),
    },
  });
}

// Selesaikan: diganti penanggung jawab (boleh dicicil, Admin/Owner) atau dibebankan ke perusahaan (seluruh sisa, hanya Owner).
export async function selesaikanKerugian(req: Request, env: Env, id: string) {
  const { staff } = await sesiSiap(env.DB, req, "owner", "admin");
  const k = await env.DB.prepare(
    `SELECT k.id, k.jumlah, COALESCE((SELECT SUM(jumlah) FROM kerugian_riwayat WHERE kerugian_id = k.id), 0) AS selesai,
      (SELECT COUNT(*) FROM kerugian_riwayat WHERE kerugian_id = k.id AND jenis = 'beban') AS beban FROM kerugian k WHERE k.id = ?`,
  ).bind(id).first<{ id: string; jumlah: number; selesai: number; beban: number }>();
  if (!k) throw new Gagal(404, "Kerugian tidak ditemukan");
  const sisa = k.jumlah - k.selesai;
  if (sisa <= 0 || k.beban) throw new Gagal(400, "Kerugian ini sudah selesai");
  const b = await bacaJson(req);
  const jenis = wajibTeks(b, "jenis", "Penyelesaian");
  let jumlah: number, cara: string | null = null;
  if (jenis === "beban") {
    if (!staff.role.includes("owner")) throw new Gagal(403, "Hanya Owner yang bisa membebankan kerugian ke perusahaan");
    jumlah = sisa;
  } else if (jenis === "ganti") {
    jumlah = wajibBulat(b, "jumlah", "Jumlah", { min: 1 });
    if (jumlah > sisa) throw new Gagal(400, `Maksimal Rp${sisa.toLocaleString("id-ID")} (sisa kerugian)`);
    cara = wajibTeks(b, "cara", "Cara", { max: 20 });
    if (!["Tunai", "Transfer", "Potong gaji"].includes(cara)) throw new Gagal(400, "Cara tidak dikenal");
  } else throw new Gagal(400, "Penyelesaian tidak dikenal");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO kerugian_riwayat (id, kerugian_id, jenis, jumlah, cara, catatan, oleh, waktu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(ulid(), id, jenis, jumlah, cara, teks(b, "catatan", "Catatan", { max: 300, wajib: false }), staff.id, sekarang()),
    logAktivitas(env.DB, staff, jenis === "beban" ? "Bebankan kerugian ke perusahaan" : "Catat penggantian kerugian", { tabel: "kerugian", id, keterangan: `Rp${jumlah}` }),
  ]);
  return json({ ok: true, sisa: sisa - jumlah });
}

