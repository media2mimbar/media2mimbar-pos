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

interface Env {
  DB: D1Database;
  PEPPER: string;
  SETUP_KODE: string;
}
