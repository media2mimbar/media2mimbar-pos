// Tipe minimal untuk D1. Pengganti @cloudflare/workers-types yang belum bisa dipasang.

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

// Tipe minimal untuk R2, hanya bagian yang dipakai foto publik.

interface R2HttpMetadata {
  contentType?: string;
  cacheControl?: string;
}

interface R2Object {
  key: string;
  size: number;
  httpEtag: string;
  httpMetadata?: R2HttpMetadata;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array, opsi?: { httpMetadata?: R2HttpMetadata }): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

interface Env {
  DB: D1Database;
  PEPPER: string;
  SETUP_KODE: string;
  // Bucket hikayat-foto. Kosong kalau Worker di-deploy tanpa binding, dan unggah foto menolak dengan pesan yang jelas.
  FOTO?: R2Bucket;
}
