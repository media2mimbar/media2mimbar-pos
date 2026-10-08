export class Gagal extends Error {
  constructor(public status: number, message: string, public kode?: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export const sekarang = () => new Date().toISOString();
export const tambahMenit = (iso: string, menit: number) => new Date(Date.parse(iso) + menit * 60_000).toISOString();

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulid(): string {
  let t = Date.now();
  let waktu = "";
  for (let i = 0; i < 10; i++) {
    waktu = CROCKFORD[t % 32] + waktu;
    t = Math.floor(t / 32);
  }
  const acak = crypto.getRandomValues(new Uint8Array(16));
  let sisa = "";
  for (let i = 0; i < 16; i++) sisa += CROCKFORD[acak[i] % 32];
  return waktu + sisa;
}

export function acakDari(huruf: string, panjang: number): string {
  // Ambil ulang byte yang menimbulkan bias modulo.
  const batas = 256 - (256 % huruf.length);
  let hasil = "";
  while (hasil.length < panjang) {
    for (const b of crypto.getRandomValues(new Uint8Array(panjang * 2))) {
      if (b < batas && hasil.length < panjang) hasil += huruf[b % huruf.length];
    }
  }
  return hasil;
}

export function ipDari(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "";
}

export function bacaCookie(req: Request, nama: string): string | null {
  for (const bagian of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = bagian.trim().split("=");
    if (k === nama) return v.join("=");
  }
  return null;
}

// Validasi input sederhana (pengganti Zod).

type Obj = Record<string, unknown>;

export async function bacaJson(req: Request): Promise<Obj> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    throw new Gagal(415, "Kirim data sebagai JSON");
  }
  try {
    const data = await req.json();
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Obj;
  } catch {}
  throw new Gagal(400, "Data tidak bisa dibaca");
}

export function teks(o: Obj, k: string, label: string, opsi: { min?: number; max?: number; wajib?: boolean } = {}): string | null {
  const v = o[k];
  if (v === undefined || v === null || v === "") {
    if (opsi.wajib === false) return null;
    throw new Gagal(400, `${label} wajib diisi`);
  }
  if (typeof v !== "string") throw new Gagal(400, `${label} tidak valid`);
  const s = v.trim();
  if (s.length < (opsi.min ?? 1)) throw new Gagal(400, `${label} minimal ${opsi.min} karakter`);
  if (s.length > (opsi.max ?? 200)) throw new Gagal(400, `${label} maksimal ${opsi.max ?? 200} karakter`);
  return s;
}

export function wajibTeks(o: Obj, k: string, label: string, opsi: { min?: number; max?: number } = {}): string {
  return teks(o, k, label, { ...opsi, wajib: true }) as string;
}

export function email(o: Obj, k: string, wajib: boolean): string | null {
  const s = teks(o, k, "Email", { max: 120, wajib });
  if (s === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Gagal(400, "Format email tidak valid");
  return s.toLowerCase();
}

export function cekPassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 8 || pw.length > 128 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw new Gagal(400, "Password minimal 8 karakter, berisi huruf dan angka");
  }
  return pw;
}

export function cekPin(pin: unknown): string {
  if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) throw new Gagal(400, "PIN harus 6 angka");
  return pin;
}

export function cekPinBaru(pin: unknown): string {
  const p = cekPin(pin);
  const naik = "0123456789012345", turun = "9876543210987654";
  if (/^(\d)\1{5}$/.test(p) || naik.includes(p) || turun.includes(p)) {
    throw new Gagal(400, "PIN terlalu mudah ditebak. Hindari angka sama atau berurutan");
  }
  return p;
}

export const ROLE = ["owner", "admin", "kasir"] as const;
export type Role = (typeof ROLE)[number];

export function daftarRole(o: Obj, k: string): Role[] {
  const v = o[k];
  if (!Array.isArray(v) || v.length === 0) throw new Gagal(400, "Pilih minimal satu role");
  const hasil = [...new Set(v)];
  for (const r of hasil) if (!ROLE.includes(r as Role)) throw new Gagal(400, `Role tidak dikenal: ${String(r)}`);
  return hasil as Role[];
}
