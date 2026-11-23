// QRIS sesuai nominal tanpa payment gateway: QRIS statis dari bank diubah menjadi QR yang sudah berisi nominal.
// Isi QRIS berformat EMVCo: [kode 2 digit][panjang 2 digit][isi]. Kode 01 diganti "12" (berisi nominal), nominal ditulis di kode 54,
// kode tip 55-57 dibuang, lalu kode pemeriksa (CRC, kode 63) dihitung ulang. Toko, rekening, dan NMID tidak berubah.
// Konfirmasi pembayaran tetap lewat notifikasi aplikasi merchant. Dipakai POS (window.HkQris) dan diuji di Node (globalThis.HkQris).
(function (g) {
  // CRC-16/CCITT-FALSE sesuai spesifikasi EMVCo, dihitung atas seluruh teks sampai "6304".
  function crc16(teks) {
    let c = 0xffff;
    for (let i = 0; i < teks.length; i++) {
      c ^= teks.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
    }
    return c.toString(16).toUpperCase().padStart(4, "0");
  }

  // Pecah teks QRIS menjadi daftar [kode, isi]. null kalau formatnya rusak.
  function pecah(teks) {
    const hasil = [];
    for (let i = 0; i < teks.length;) {
      const kode = teks.slice(i, i + 2), panjang = teks.slice(i + 2, i + 4);
      if (!/^\d{2}$/.test(kode) || !/^\d{2}$/.test(panjang) || i + 4 + Number(panjang) > teks.length) return null;
      hasil.push([kode, teks.slice(i + 4, i + 4 + Number(panjang))]);
      i += 4 + Number(panjang);
    }
    return hasil;
  }

  // null kalau teks QRIS bisa dipakai, atau alasan kenapa tidak bisa.
  function periksa(teks) {
    if (typeof teks !== "string" || !teks.startsWith("000201")) return "Bukan kode QRIS";
    const d = pecah(teks);
    if (!d || !d.length) return "Format QRIS rusak";
    const isi = (k) => d.find(([x]) => x === k)?.[1];
    if (d[d.length - 1][0] !== "63" || String(isi("63")).toUpperCase() !== crc16(teks.slice(0, -4))) return "Kode pemeriksa QRIS tidak cocok";
    if (!teks.includes("ID.CO.QRIS")) return "Bukan QRIS Indonesia";
    if (isi("53") !== "360") return "Mata uang QRIS bukan Rupiah";
    if (isi("01") !== "11" && isi("01") !== "12") return "Jenis QRIS tidak dikenal";
    return null;
  }

  const tlv = (k, v) => k + String(v.length).padStart(2, "0") + v;

  // Teks QRIS baru berisi nominal (rupiah bulat). null kalau teks asal tidak bisa dipakai.
  function buat(teks, nominal) {
    if (periksa(teks) || !Number.isInteger(nominal) || nominal <= 0) return null;
    const d = pecah(teks).filter(([k]) => !["54", "55", "56", "57", "63"].includes(k)).map(([k, v]) => [k, k === "01" ? "12" : v]);
    d.splice(d.findIndex(([k]) => k === "53") + 1, 0, ["54", String(nominal)]);
    const tanpaCrc = d.map(([k, v]) => tlv(k, v)).join("") + "6304";
    return tanpaCrc + crc16(tanpaCrc);
  }

  g.HkQris = { periksa, buat, crc16, pecah };
})(typeof window !== "undefined" ? window : globalThis);
