// Hash password, PIN, dan token. Semua lewat WebCrypto bawaan Workers.

import { acakDari } from "./util.js";

// Workers gratis dibatasi 10 ms CPU per permintaan. Angka ini diukur di Node
// (sekitar 4-5 ms). Hash lama otomatis diperbarui saat login kalau angka ini dinaikkan.
export const ITERASI_PBKDF2 = 8000;

const enc = new TextEncoder();

const keHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const keB64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const dariB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hmac(kunci: string, pesan: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", enc.encode(kunci), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(pesan));
}

export async function sha256(teks: string): Promise<string> {
  return keHex(await crypto.subtle.digest("SHA-256", enc.encode(teks)));
}

export function samaPersis(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

async function pbkdf2(pepper: string, password: string, salt: Uint8Array<ArrayBuffer>, iterasi: number): Promise<string> {
  // Pepper dicampur dulu lewat HMAC, jadi hash di database tidak bisa diuji tanpa pepper.
  const bahan = await crypto.subtle.importKey("raw", await hmac(pepper, password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iterasi }, bahan, 256);
  return keB64(bits);
}

export async function hashPassword(pepper: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await pbkdf2(pepper, password, salt, ITERASI_PBKDF2), salt: keB64(salt), iterasi: ITERASI_PBKDF2 };
}

export async function cocokPassword(pepper: string, password: string, hash: string, salt: string, iterasi: number) {
  return samaPersis(await pbkdf2(pepper, password, dariB64(salt), iterasi), hash);
}

// Dipakai saat email tidak ditemukan, supaya waktu jawab sama dan email terdaftar tidak bisa ditebak.
export async function hashTiruan(pepper: string) {
  await pbkdf2(pepper, "tiruan", new Uint8Array(16), ITERASI_PBKDF2);
}

export async function hashPin(pepper: string, staffId: string, pin: string): Promise<string> {
  return keHex(await hmac(pepper, `${staffId}:${pin}`));
}

export function tokenAcak(): string {
  return keB64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function passwordSementara(): string {
  // Pastikan ada huruf dan angka.
  for (;;) {
    const pw = acakDari("abcdefghjkmnpqrstuvwxyz23456789", 10);
    if (/[a-z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

export function pinSementara(): string {
  return acakDari("0123456789", 6);
}
