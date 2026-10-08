// D1 tiruan di atas node:sqlite, untuk menguji Worker tanpa Cloudflare.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

class Stmt {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...v) {
    return new Stmt(this.db, this.sql, v.map((x) => (x === undefined ? null : typeof x === "boolean" ? Number(x) : x)));
  }
  async first() {
    const r = this.db.prepare(this.sql).get(...this.params);
    return r ? { ...r } : null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })), meta: { changes: 0 } };
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
