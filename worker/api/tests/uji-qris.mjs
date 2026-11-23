// Uji QRIS sesuai nominal (ui/pos-qris.js): QRIS statis diubah menjadi QR berisi nominal, CRC dihitung ulang.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const konteks = {};
vm.runInNewContext(readFileSync(new URL("../ui/pos-qris.js", import.meta.url), "utf8"), konteks);
const { HkQris } = konteks;

const tlv = (k, v) => k + String(v.length).padStart(2, "0") + v;
const denganCrc = (s) => s + "6304" + HkQris.crc16(s + "6304");
// QRIS statis contoh dengan susunan seperti QRIS dari bank (data karangan).
const statis = denganCrc("000201" + "010211"
  + tlv("26", tlv("00", "ID.CO.TELKOM.WWW") + tlv("01", "936008980000000001") + tlv("02", "000000000000001") + tlv("03", "UMI"))
  + tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1024309872942") + tlv("03", "UMI"))
  + tlv("52", "5999") + tlv("53", "360") + tlv("58", "ID") + tlv("59", "HIKAYAT MERCHANDISE") + tlv("60", "BANDUNG") + tlv("61", "40111")
  + tlv("62", tlv("07", "A01")));
const ambil = (teks, k) => HkQris.pecah(teks).find(([x]) => x === k)?.[1];

test("CRC-16/CCITT-FALSE sesuai nilai uji standar", () => {
  assert.equal(HkQris.crc16("123456789"), "29B1");
});

test("QRIS statis diubah menjadi QR berisi nominal", () => {
  assert.equal(HkQris.periksa(statis), null);
  const q = HkQris.buat(statis, 150000);
  assert.equal(HkQris.periksa(q), null); // CRC baru cocok
  assert.ok(q.startsWith("000201010212"));
  assert.ok(q.includes("53033605406150000"), "nominal tepat setelah mata uang");
  assert.equal(ambil(q, "54"), "150000");
  assert.equal(ambil(q, "59"), "HIKAYAT MERCHANDISE");
  assert.equal(ambil(q, "51"), ambil(statis, "51")); // NMID tidak berubah
  assert.equal(HkQris.pecah(q).at(-1)[0], "63");
});

test("nominal diganti kalau QR sudah berisi nominal, tip dibuang", () => {
  const berTip = denganCrc(statis.slice(0, -8).replace("5802ID", "550201" + "5802ID"));
  assert.equal(HkQris.periksa(berTip), null);
  const q1 = HkQris.buat(berTip, 99000);
  assert.equal(ambil(q1, "55"), undefined);
  const q2 = HkQris.buat(q1, 120500);
  assert.equal(ambil(q2, "54"), "120500");
  assert.equal(HkQris.pecah(q2).filter(([k]) => k === "54").length, 1);
});

test("QR rusak atau bukan QRIS ditolak", () => {
  const rusak = statis.slice(0, -1) + (statis.at(-1) === "0" ? "1" : "0");
  assert.match(HkQris.periksa(rusak), /pemeriksa/);
  assert.equal(HkQris.buat(rusak, 1000), null);
  assert.match(HkQris.periksa("https://contoh.id"), /Bukan kode QRIS/);
  assert.match(HkQris.periksa(denganCrc("000201010211" + tlv("53", "360") + tlv("58", "ID"))), /QRIS Indonesia/);
  assert.equal(HkQris.buat(statis, 0), null);
  assert.equal(HkQris.buat(statis, 1500.5), null);
});
