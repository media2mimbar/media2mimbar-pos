// Rumus promo POS (PRD 5.8, 6.3, bagian 7). Tanpa import supaya file ini juga dipakai di HP:
// build.mjs mengubah dist/promo.js menjadi /pos-promo.js (window.HkPromo).

export interface Promo {
  id: string;
  nama: string;
  cakupan: "produk" | "total";
  jenis: "persen" | "nominal" | "bonus" | "bundling";
  besar: number;
  maks_potongan: number;
  min_belanja: number;
  min_qty: number;
  kelipatan: boolean;
  auto: boolean;
  kasir_ubah: boolean;
  kasir_maks_persen: number;
  bonus_qty: number;
  harga_paket: number;
  lokasi_id: string | null;
  mulai: string;
  selesai: string;
  jam_mulai: string;
  jam_selesai: string;
  hari: number[];
  status: string;
  syarat: string[]; // produk_id yang dibeli
  bonus: string[]; // produk_id yang gratis
  paket: string[]; // produk_id isi bundling
}

export interface ItemPromo {
  sku: string;
  produk_id: string;
  qty: number;
  harga: number;
}

export interface Waktu {
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:MM
  hari: number; // 0 = Minggu
}

// Waktu WIB sekarang (atau dari ISO), untuk menyaring promo per tanggal, hari, dan jam.
export function waktuWib(iso?: string): Waktu {
  const d = new Date((iso ? Date.parse(iso) : Date.now()) + 7 * 3600_000);
  const s = d.toISOString();
  return { tanggal: s.slice(0, 10), jam: s.slice(11, 16), hari: d.getUTCDay() };
}

// Promo yang tampil di POS: Aktif, dalam periode, hari dan jamnya cocok, lokasinya sama atau semua lokasi.
export function promoBerlaku(p: Promo, lokasi: string, w: Waktu): boolean {
  if (p.status !== "Aktif") return false;
  if (p.lokasi_id && p.lokasi_id !== lokasi) return false;
  if (w.tanggal < p.mulai || w.tanggal > p.selesai) return false;
  if (p.hari.length && !p.hari.includes(w.hari)) return false;
  return w.jam >= p.jam_mulai && w.jam <= p.jam_selesai;
}

const kena = (p: Promo, i: ItemPromo) => p.cakupan === "total" || p.syarat.includes(i.produk_id);

function dasar(p: Promo, items: ItemPromo[]) {
  const ikut = items.filter((i) => kena(p, i));
  return { nilai: ikut.reduce((a, i) => a + i.qty * i.harga, 0), qty: ikut.reduce((a, i) => a + i.qty, 0) };
}

// Daftar harga per pcs untuk produk tertentu, diurutkan (naik = termurah dulu).
function unit(items: ItemPromo[], produk: string[], naik: boolean) {
  const u: { sku: string; harga: number }[] = [];
  for (const i of items) if (produk.includes(i.produk_id)) for (let k = 0; k < i.qty; k++) u.push({ sku: i.sku, harga: i.harga });
  return u.sort((a, b) => (naik ? a.harga - b.harga : b.harga - a.harga));
}

// Bonus produk (beli X gratis Y). Kalau produk bonus sama dengan yang dibeli, satu set = minimal beli + jumlah bonus.
export function infoBonus(p: Promo, items: ItemPromo[]) {
  const sama = p.syarat.some((id) => p.bonus.includes(id));
  const qSyarat = items.filter((i) => p.syarat.includes(i.produk_id)).reduce((a, i) => a + i.qty, 0);
  const minBeli = Math.max(1, p.min_qty);
  let set = Math.floor(qSyarat / (sama ? minBeli + p.bonus_qty : minBeli));
  if (!p.kelipatan) set = Math.min(set, 1);
  const hak = set * p.bonus_qty;
  const gratis = unit(items, p.bonus, true).slice(0, hak);
  const perlu = qSyarat < minBeli ? 0 : sama ? (hak ? 0 : p.bonus_qty) : Math.max(0, (p.kelipatan ? hak : p.bonus_qty) - gratis.length);
  return { qSyarat, hak, gratis, perlu, potongan: gratis.reduce((a, u) => a + u.harga, 0) };
}

// Bundling: jumlah paket = jumlah terkecil dari tiap produk paket; potongan = harga normal termahal − harga paket.
export function infoPaket(p: Promo, items: ItemPromo[]) {
  const g = p.paket.map((id) => ({ id, u: unit(items, [id], false) }));
  let n = g.length ? Math.min(...g.map((x) => x.u.length)) : 0;
  if (!p.kelipatan) n = Math.min(n, 1);
  const normal = g.reduce((a, x) => a + x.u.slice(0, n).reduce((b, u) => b + u.harga, 0), 0);
  return { n, kurang: g.filter((x) => !x.u.length).map((x) => x.id), normal, potongan: Math.max(0, normal - n * p.harga_paket) };
}

export function memenuhi(p: Promo, items: ItemPromo[]): boolean {
  if (!items.length) return false;
  if (p.jenis === "bonus") return infoBonus(p, items).qSyarat >= Math.max(1, p.min_qty);
  if (p.jenis === "bundling") return infoPaket(p, items).n > 0;
  const d = dasar(p, items);
  if (p.cakupan === "produk" && d.qty === 0) return false;
  return d.nilai >= p.min_belanja && d.qty >= p.min_qty;
}

// Potongan rupiah. persenKasir dipakai kalau promo mengizinkan kasir mengubah persen (dibatasi kasir_maks_persen).
export function potongan(p: Promo, items: ItemPromo[], persenKasir?: number): number {
  if (!memenuhi(p, items)) return 0;
  const subtotal = items.reduce((a, i) => a + i.qty * i.harga, 0);
  let hasil = 0;
  if (p.jenis === "bonus") hasil = infoBonus(p, items).potongan;
  else if (p.jenis === "bundling") hasil = infoPaket(p, items).potongan;
  else {
    const d = dasar(p, items);
    if (p.jenis === "persen") {
      const persen = p.kasir_ubah && persenKasir !== undefined ? Math.min(Math.max(0, persenKasir), p.kasir_maks_persen || 100) : p.besar;
      hasil = Math.round((d.nilai * persen) / 100);
      if (p.maks_potongan > 0) hasil = Math.min(hasil, p.maks_potongan);
    } else {
      hasil = p.kelipatan && p.min_belanja > 0 ? Math.floor(d.nilai / p.min_belanja) * p.besar : p.besar;
    }
    hasil = Math.min(hasil, d.nilai);
  }
  return Math.min(hasil, subtotal);
}

// Kekurangan syarat untuk pesan di POS ("Kurang 1 pcs Kaos Burtuqol", "Kurang belanja Rp 50.000").
export function kurang(p: Promo, items: ItemPromo[], namaProduk: (id: string) => string): string {
  const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const nama = (ids: string[]) => ids.map(namaProduk).join("/");
  if (p.jenis === "bonus") {
    const b = infoBonus(p, items), min = Math.max(1, p.min_qty);
    return b.qSyarat < min ? `Kurang ${min - b.qSyarat} pcs ${nama(p.syarat)}` : "";
  }
  if (p.jenis === "bundling") {
    const k = infoPaket(p, items);
    return k.n ? "" : `Tambahkan ${nama(k.kurang)}`;
  }
  const d = dasar(p, items);
  if (p.cakupan === "produk" && d.qty === 0) return `Masukkan ${nama(p.syarat)}`;
  if (d.qty < p.min_qty) return `Kurang ${p.min_qty - d.qty} pcs ${p.cakupan === "produk" ? nama(p.syarat) : ""}`.trim();
  if (d.nilai < p.min_belanja) return `Kurang belanja ${rp(p.min_belanja - d.nilai)}`;
  return "";
}

// Ringkasan syarat untuk kartu promo.
export function syarat(p: Promo, namaProduk: (id: string) => string): string {
  const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");
  const nama = (ids: string[]) => ids.map(namaProduk).join(", ");
  if (p.jenis === "bonus") return `Beli ${Math.max(1, p.min_qty)} ${nama(p.syarat)} gratis ${p.bonus_qty} ${nama(p.bonus)}${p.kelipatan ? " (berlaku kelipatan)" : ""}`;
  if (p.jenis === "bundling") return `Paket ${nama(p.paket)} ${rp(p.harga_paket)}${p.kelipatan ? " (berlaku kelipatan)" : ""}`;
  const besar = p.jenis === "persen" ? `${p.besar}%${p.maks_potongan ? ` maks ${rp(p.maks_potongan)}` : ""}` : `${rp(p.besar)}${p.kelipatan && p.min_belanja ? ` per kelipatan ${rp(p.min_belanja)}` : ""}`;
  const s = [p.cakupan === "produk" ? `Potongan ${besar} untuk ${nama(p.syarat)}` : `Potongan ${besar}`];
  if (p.min_qty) s.push(`min ${p.min_qty} pcs`);
  if (p.min_belanja && !(p.jenis === "nominal" && p.kelipatan)) s.push(`min belanja ${rp(p.min_belanja)}`);
  return s.join(" · ");
}

// Aktivasi otomatis: promo otomatis yang syaratnya terpenuhi dan potongannya paling besar.
export function terbaikOtomatis(daftar: Promo[], items: ItemPromo[]): Promo | null {
  let terbaik: Promo | null = null, nilai = 0;
  for (const p of daftar) {
    if (!p.auto) continue;
    const d = potongan(p, items);
    if (d > nilai) { terbaik = p; nilai = d; }
  }
  return terbaik;
}
