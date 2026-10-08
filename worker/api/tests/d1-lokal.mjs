// D1 tiruan di atas node:sqlite, untuk menguji Worker tanpa Cloudflare.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// D1 mengembalikan BLOB sebagai array angka (Array.from), bukan Uint8Array.
const baris = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Uint8Array ? Array.from(v) : v]));

class Stmt {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...v) {
    // Sama dengan D1: undefined ditolak (D1_TYPE_ERROR), boolean jadi 0/1.
    if (v.some((x) => x === undefined)) throw new TypeError(`D1_TYPE_ERROR: undefined di parameter ${v.findIndex((x) => x === undefined) + 1} untuk: ${this.sql.slice(0, 80)}`);
    return new Stmt(this.db, this.sql, v.map((x) => (typeof x === "boolean" ? Number(x) : x)));
  }
  async first() {
    const r = this.db.prepare(this.sql).get(...this.params);
    return r ? baris(r) : null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params).map(baris), meta: { changes: 0 } };
  }
  async run() {
    return this._run();
  }
  _run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { results: [], meta: { changes: Number(r.changes) } };
  }
}

export function d1Lokal() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s._run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
