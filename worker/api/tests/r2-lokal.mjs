// R2 tiruan di memori, untuk menguji foto publik tanpa Cloudflare. Hanya put, get, dan delete yang dipakai Worker.
import { createHash } from "node:crypto";

export function r2Lokal() {
  const isi = new Map(); // kunci -> { data: Uint8Array, httpMetadata, httpEtag }
  return {
    isi,
    async put(key, value, opsi = {}) {
      const data = new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      const httpEtag = `"${createHash("md5").update(data).digest("hex")}"`;
      isi.set(key, { data, httpMetadata: { ...(opsi.httpMetadata ?? {}) }, httpEtag });
      return { key, size: data.byteLength, httpEtag, httpMetadata: opsi.httpMetadata };
    },
    async get(key) {
      const o = isi.get(key);
      if (!o) return null;
      return { key, size: o.data.byteLength, httpEtag: o.httpEtag, httpMetadata: o.httpMetadata, body: new Blob([o.data]).stream() };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) isi.delete(k);
    },
  };
}
