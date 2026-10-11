// A D1Database stand-in over Node's built-in SQLite (node:sqlite), for tests of the code that runs queries.
// Covers what the Worker uses: prepare/bind/first/all/run and batch (one transaction, as D1 runs it).
import { DatabaseSync } from 'node:sqlite'

type Value = string | number | bigint | null | Uint8Array

class Stmt {
  constructor(private db: DatabaseSync, readonly sql: string, private args: Value[] = []) {}
  bind(...args: unknown[]): Stmt {
    return new Stmt(this.db, this.sql, args.map(a => (a === undefined ? null : typeof a === 'boolean' ? Number(a) : a) as Value))
  }
  private rows(): Record<string, unknown>[] {
    return this.db.prepare(this.sql).all(...this.args).map(r => ({ ...r }))
  }
  async first<T>(col?: string): Promise<T | null> {
    const r = this.rows()[0]
    return (r === undefined ? null : col ? r[col] : r) as T | null
  }
  async all<T>(): Promise<{ results: T[]; success: true; meta: object }> {
    return { results: this.rows() as T[], success: true, meta: {} }
  }
  async run(): Promise<{ results: unknown[]; success: true; meta: { changes: number } }> {
    if (/^\s*(select|with)\b/i.test(this.sql)) return { results: this.rows(), success: true, meta: { changes: 0 } }
    const r = this.db.prepare(this.sql).run(...this.args)
    return { results: [], success: true, meta: { changes: Number(r.changes) } }
  }
  /** Inside a batch: a SELECT gives its rows, anything else runs. */
  exec(): { results: unknown[]; success: true; meta: object } {
    if (/^\s*(select|with)\b/i.test(this.sql)) return { results: this.rows(), success: true, meta: {} }
    this.db.prepare(this.sql).run(...this.args)
    return { results: [], success: true, meta: {} }
  }
}

export function memoryD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec('BEGIN')
      try {
        const out = stmts.map(s => s.exec())
        db.exec('COMMIT')
        return out
      } catch (e) { db.exec('ROLLBACK'); throw e }
    },
    async exec(sql: string) { db.exec(sql); return { count: 0, duration: 0 } },
  }
  return d1 as unknown as D1Database
}
