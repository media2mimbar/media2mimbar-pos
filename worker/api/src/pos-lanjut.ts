// Endpoint POS tambahan (PRD 6.7–6.11): laporan di POS, riwayat masuk, persetujuan opname oleh Owner/Admin di HP,
// batal penerimaan kiriman, dan tutup event dari HP oleh Owner. Semua butuh sinyal.

import { hariIniWib } from "./aturan.js";
import { ambilEvent, dataTutup, tutupEventInti } from "./event.js";
import { kenaPenjaga, penjaga } from "./inventori.js";
import { ringkasanShift } from "./kasir.js";
import { agregat, batasWib } from "./laporan.js";
import { ambilOpname, setujuiOpnameInti, ulangOpnameInti } from "./opname.js";
import { logAktivitas, sesiPos, Staff, wajibRole } from "./sesi.js";
import { bacaJson, Gagal, json, sekarang, teks, ulid } from "./util.js";

const atasan = (s: Staff) => s.role.includes("owner") || s.role.includes("admin");

// Periode Produk Terjual (PRD 6.8). "event" = sejak event mulai.
export function periodePos(jenis: string, mulaiEvent: string | null, hari = hariIniWib()) {
  const geser = (n: number) => new Date(Date.parse(hari) + n * 86_400_000).toISOString().slice(0, 10);
  const senin = geser(-((new Date(hari + "T00:00:00Z").getUTCDay() + 6) % 7));
  switch (jenis) {
    case "kemarin": return { dari: geser(-1), sampai: geser(-1) };
    case "7hari": return { dari: geser(-6), sampai: hari };
    case "minggu": return { dari: senin, sampai: hari };
    case "minggu_lalu": { const s = new Date(Date.parse(senin) - 7 * 86_400_000).toISOString().slice(0, 10); return { dari: s, sampai: new Date(Date.parse(senin) - 86_400_000).toISOString().slice(0, 10) }; }
    case "event": return { dari: mulaiEvent && mulaiEvent < hari ? mulaiEvent : hari, sampai: hari };
    default: return { dari: hari, sampai: hari };
  }
}

// GET /api/pos/laporan?lokasi=&periode=&semua=1 → shift di tempat ini (laporan kasir) dan produk terjual (termasuk yang di-void).
export async function laporanPos(req: Request, env: Env) {
  await sesiPos(env.DB, req);
  const q = new URL(req.url).searchParams;
  const lokasi = q.get("lokasi") ?? "";
  const semua = q.get("semua") === "1";
  const ev = await env.DB.prepare("SELECT mulai FROM event WHERE id = ?").bind(lokasi).first<{ mulai: string }>();
  const p = periodePos(q.get("periode") ?? "hari", ev?.mulai ?? null);
  const r = batasWib(p.dari, p.sampai);
  const tempat = semua ? "f.sumber = 'pos'" : "f.sumber = 'pos' AND f.tempat = ?";
  const { results: shift } = await env.DB.prepare("SELECT id FROM shift WHERE lokasi_id = ? ORDER BY buka DESC LIMIT 20").bind(lokasi).all<{ id: string }>();
  const [produk, voidp, ringkas] = await Promise.all([
    agregat(env.DB, r, ["f.sku", "TRIM(p.nama || ' ' || v.nama) AS nama"], { join: "JOIN varian v ON v.sku = f.sku JOIN produk p ON p.id = v.produk_id", where: tempat, nilai: semua ? [] : [lokasi], urut: "qty DESC" }),
    env.DB.prepare(
      `SELECT i.sku, i.nama, SUM(i.qty) AS qty, SUM(i.qty * i.harga) AS nilai FROM trx t JOIN trx_item i ON i.trx_id = t.id
       WHERE t.status = 'Void' AND t.waktu >= ? AND t.waktu < ? ${semua ? "" : "AND t.lokasi_id = ?"} GROUP BY i.sku ORDER BY qty DESC`,
    ).bind(r.mulai, r.akhir, ...(semua ? [] : [lokasi])).all(),
    Promise.all(shift.map((s) => ringkasanShift(env.DB, s.id))),
  ]);
  const ekstra = await env.DB.prepare(
    `SELECT t.shift_id, SUM(t.pajak) AS pajak, SUM(t.diskon) AS diskon, SUM(t.pembulatan) AS bulat FROM trx t WHERE t.lokasi_id = ? AND t.status = 'Lunas' GROUP BY t.shift_id`,
  ).bind(lokasi).all<{ shift_id: string; pajak: number; diskon: number; bulat: number }>();
  return json({
    periode: p,
    shift: ringkas.map((x) => ({
      id: x.shift.id, kasir: x.shift.kasir, buka: x.shift.buka, tutup: x.shift.tutup, status: x.shift.status, modal: x.shift.modal, kas_hitung: x.shift.kas_hitung,
      ditutup_oleh: x.shift.ditutup_oleh_nama, ...x.ringkasan, ekstra: ekstra.results.find((e) => e.shift_id === x.shift.id) ?? { pajak: 0, diskon: 0, bulat: 0 },
    })),
    produk, void: voidp.results,
  });
}

// GET /api/pos/riwayat?periode=hari|7hari|semua → riwayat masuk POS. Kasir hanya melihat miliknya.
export async function riwayatPos(req: Request, env: Env) {
  const { staff } = await sesiPos(env.DB, req);
  const per = new URL(req.url).searchParams.get("periode") ?? "hari";
  const hari = hariIniWib();
  const dari = per === "semua" ? "2000-01-01" : per === "7hari" ? new Date(Date.parse(hari) - 6 * 86_400_000).toISOString().slice(0, 10) : hari;
  const r = batasWib(dari, hari);
  const sendiri = !atasan(staff);
  const { results } = await env.DB.prepare(
    `SELECT l.waktu, l.nama, l.aksi, l.keterangan, p.kode AS perangkat, (SELECT group_concat(role) FROM staff_role WHERE staff_id = l.staff_id) AS role
     FROM log_masuk l LEFT JOIN perangkat p ON p.id = l.perangkat_id WHERE l.tempat = 'pos' AND l.waktu >= ? AND l.waktu < ? ${sendiri ? "AND l.staff_id = ?" : ""}
     ORDER BY l.waktu DESC LIMIT 300`,
  ).bind(r.mulai, r.akhir, ...(sendiri ? [staff.id] : [])).all();
  return json({ riwayat: results, sendiri });
}

// ---------- Persetujuan opname di HP (Owner/Admin) ----------

export async function detailOpnamePos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  wajibRole(staff, "owner", "admin");
  const { o, item } = await ambilOpname(env.DB, id);
  const pj = o.lokasi_id === "gudang" ? null : await env.DB.prepare("SELECT pj_id FROM event WHERE id = ?").bind(o.lokasi_id).first<{ pj_id: string }>();
  return json({ opname: o, item, pj_bawaan: pj?.pj_id ?? o.dihitung_oleh });
}
export async function setujuiOpnamePos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  wajibRole(staff, "owner", "admin");
  return json(await setujuiOpnameInti(env, staff, id, await bacaJson(req)));
}
export async function ulangOpnamePos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  wajibRole(staff, "owner", "admin");
  return json(await ulangOpnameInti(env, staff, id, await bacaJson(req)));
}

// ---------- Batal penerimaan kiriman (selama barangnya belum terjual) ----------

export async function batalTerimaPos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  const alasan = teks(await bacaJson(req), "alasan", "Alasan", { min: 3, max: 300 })!;
  const m = await env.DB.prepare("SELECT m.id, m.no, m.ke, m.status, e.ditutup FROM mutasi m JOIN event e ON e.id = m.ke WHERE m.id = ? AND m.jenis = 'kirim'").bind(id)
    .first<{ id: string; no: string; ke: string; status: string; ditutup: number }>();
  if (!m) throw new Gagal(404, "Kiriman tidak ditemukan");
  if (m.status !== "Diterima") throw new Gagal(400, `Kiriman berstatus ${m.status}`);
  if (m.ditutup) throw new Gagal(400, "Event sudah ditutup");
  const rugi = await env.DB.prepare("SELECT k.id, (SELECT COUNT(*) FROM kerugian_riwayat WHERE kerugian_id = k.id) AS n FROM kerugian k WHERE k.ref_tabel = 'mutasi' AND k.ref_id = ? AND k.jenis = 'kiriman'")
    .bind(id).first<{ id: string; n: number }>();
  if (rugi?.n) throw new Gagal(400, "Kekurangan kiriman ini sudah mulai diselesaikan di Selisih & Kerugian. Batal terima tidak bisa lagi");
  const { results: item } = await env.DB.prepare("SELECT id, sku, dikirim, diterima FROM mutasi_item WHERE mutasi_id = ?").bind(id).all<{ id: string; sku: string; dikirim: number; diterima: number }>();
  const t = sekarang();
  try {
    await env.DB.batch([
      // Barang yang diterima harus masih utuh di event (belum terjual atau dipakai).
      ...item.filter((i) => i.diterima > 0).map((i) => penjaga(env.DB, "COALESCE((SELECT qty FROM stok WHERE sku = ? AND lokasi_id = ?), 0) >= ?", i.sku, m.ke, i.diterima)),
      env.DB.prepare("UPDATE mutasi SET status = 'Dikirim', diterima_pada = NULL, diterima_oleh = NULL, catatan_terima = NULL, diubah_pada = ? WHERE id = ? AND status = 'Diterima'").bind(t, id),
      ...item.flatMap((i) => [
        env.DB.prepare("UPDATE mutasi_item SET diterima = NULL WHERE id = ?").bind(i.id),
        env.DB.prepare("UPDATE stok SET qty = qty - ?, transit = transit + ?, diubah_pada = ? WHERE sku = ? AND lokasi_id = ?").bind(i.diterima, i.dikirim, t, i.sku, m.ke),
        ...(i.diterima > 0 ? [env.DB.prepare("INSERT INTO stok_gerak (id, sku, lokasi_id, jumlah, jenis, ref_tabel, ref_id, waktu, oleh) VALUES (?, ?, ?, ?, 'kirim_masuk', 'mutasi', ?, ?, ?)")
          .bind(ulid(), i.sku, m.ke, -i.diterima, id, t, staff.id)] : []),
      ]),
      ...(rugi ? [env.DB.prepare("DELETE FROM kerugian WHERE id = ?").bind(rugi.id)] : []),
      logAktivitas(env.DB, staff, "Batal terima kiriman", { tabel: "mutasi", id, keterangan: `${m.no}: ${alasan}` }),
    ]);
  } catch (e) {
    if (kenaPenjaga(e)) throw new Gagal(409, "Sebagian barang kiriman ini sudah terjual atau berpindah. Batal terima tidak bisa");
    throw e;
  }
  return json({ ok: true });
}

// ---------- Tutup event dari HP (Owner) ----------

export async function siapTutupPos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  wajibRole(staff, "owner");
  return json(await dataTutup(env.DB, await ambilEvent(env.DB, id)));
}
export async function tutupEventPos(req: Request, env: Env, id: string) {
  const { staff } = await sesiPos(env.DB, req);
  wajibRole(staff, "owner");
  return json(await tutupEventInti(env, staff, id, await bacaJson(req)));
}
