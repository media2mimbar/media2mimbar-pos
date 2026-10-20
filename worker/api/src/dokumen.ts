// Penomoran dokumen yang dibuat server (faktur, mutasi, opname, biaya): AWALAN/yymmdd/0001, urutan berlanjut per jenis.

import { hariIniWib, noDokumen } from "./aturan.js";

const TABEL: Record<string, string> = { FA: "faktur", MT: "mutasi", SO: "opname", BY: "biaya" };

export async function nomorBerikut(db: D1Database, awalan: keyof typeof TABEL & string): Promise<string> {
  const tabel = TABEL[awalan];
  const r = await db.prepare(`SELECT MAX(CAST(substr(no, -4) AS INTEGER)) AS n FROM ${tabel} WHERE no LIKE ?`).bind(awalan + "/%").first<{ n: number | null }>();
  return noDokumen(awalan, hariIniWib(), (r?.n ?? 0) + 1);
}

// Menjalankan batch yang memakai nomor dokumen; kalau nomor bentrok dengan simpanan bersamaan, ambil nomor berikutnya.
export async function denganNomor<T>(db: D1Database, awalan: string, kerjakan: (no: string) => Promise<T>): Promise<T> {
  for (let coba = 0; ; coba++) {
    const no = await nomorBerikut(db, awalan);
    try {
      return await kerjakan(no);
    } catch (e) {
      const m = String((e as Error).message);
      if (coba >= 2 || !m.includes("UNIQUE") || !m.includes(".no")) throw e;
    }
  }
}
