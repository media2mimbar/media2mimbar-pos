// Rumus bisnis murni (tanpa database), dipindah dari prototipe/src/shared.js.
// Disimpan terpisah supaya bisa dipakai bersama POS dan dashboard nanti (packages/aturan).

// HPP rata-rata tertimbang setelah pembelian (PRD bagian 7):
// (stok lama semua lokasi termasuk transit × HPP lama + jumlah beli × harga beli) ÷ (stok lama + jumlah beli)
export function hppSetelahBeli(stokLama: number, hppLama: number, qty: number, nilai: number): number {
  const stok = Math.max(0, stokLama);
  return stok + qty > 0 ? Math.round((stok * hppLama + nilai) / (stok + qty)) : hppLama;
}

// HPP setelah faktur dibatalkan: (stok sekarang × HPP sekarang − jumlah faktur × harga beli) ÷ (stok sekarang − jumlah faktur).
// Kalau stok habis atau hasilnya tidak masuk akal, kembali ke HPP sebelum faktur itu.
export function hppSetelahBatal(stokSekarang: number, hppSekarang: number, qty: number, nilai: number, hppSebelum: number): number {
  const stok = Math.max(0, stokSekarang);
  const hitung = stok - qty > 0 ? Math.round((stok * hppSekarang - nilai) / (stok - qty)) : hppSebelum;
  return hitung > 0 ? hitung : hppSebelum;
}

export type StatusFaktur = "Dibatalkan" | "Lunas" | "Lewat jatuh tempo" | "Belum lunas";

export function statusFaktur(f: { batal: boolean; total: number; dibayar: number; jatuh_tempo: string | null }, hariIni: string): StatusFaktur {
  if (f.batal) return "Dibatalkan";
  if (f.total - f.dibayar <= 0) return "Lunas";
  if (f.jatuh_tempo && f.jatuh_tempo < hariIni) return "Lewat jatuh tempo";
  return "Belum lunas";
}

export function rapikanSku(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// SKU varian yang dikosongkan dibuat dari SKU induk + nama varian, sama dengan prototipe.
export function skuVarian(skuInduk: string, namaVarian: string): string {
  return rapikanSku(`${skuInduk}-${namaVarian}`);
}

// Tanggal hari ini dalam WIB (UTC+7), format YYYY-MM-DD. Dipakai untuk nomor dokumen dan jatuh tempo.
export function hariIniWib(sekarang = new Date()): string {
  return new Date(sekarang.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

// FA/261008/0001: awalan, tanggal yymmdd, urutan 4 digit.
export function noDokumen(awalan: string, tanggal: string, urutan: number): string {
  return `${awalan}/${tanggal.slice(2).replace(/-/g, "")}/${String(urutan).padStart(4, "0")}`;
}
