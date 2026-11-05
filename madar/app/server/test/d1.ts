// A small D1Database look-alike over node:sqlite (built into Node 22) so route handlers run in vitest without workerd.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

type Row = Record<string, unknown>

export interface FakeD1 { prepare(sql: string): D1PreparedStatement; batch<T>(stmts: D1PreparedStatement[]): Promise<D1Result<T>[]>; raw: DatabaseSync }

export function fakeD1(sqlFiles: string[] = []): FakeD1 & D1Database {
  const db = new DatabaseSync(':memory:')
  for (const f of sqlFiles) db.exec(readFileSync(f, 'utf8'))
  const normalise = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v) as null | number | string | bigint | Uint8Array
  const prep = (sql: string, params: unknown[] = []): D1PreparedStatement => {
    const stmt = () => db.prepare(sql)
    const args = () => params.map(normalise)
    const meta = (changes = 0, lastRowId = 0) => ({ changes, last_row_id: lastRowId, duration: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: changes > 0 })
    const s = {
      bind: (...p: unknown[]) => prep(sql, p),
      // node:sqlite rows have a null prototype; copy them into plain objects like D1 returns.
      first: async (col?: string) => { const raw = stmt().get(...args()) as Row | undefined; const row = raw ? { ...raw } : null; return col ? row?.[col] ?? null : row },
      all: async () => ({ results: (stmt().all(...args()) as Row[]).map(r => ({ ...r })), success: true as const, meta: meta() }),
      run: async () => {
        const r = stmt().run(...args())
        return { results: [], success: true as const, meta: meta(Number(r.changes), Number(r.lastInsertRowid)) }
      },
      raw: async () => (stmt().all(...args()) as Row[]).map(r => Object.values(r)),
    }
    return s as unknown as D1PreparedStatement
  }
  const d1 = {
    raw: db,
    prepare: prep,
    batch: async (stmts: D1PreparedStatement[]) => { const out = []; for (const s of stmts) out.push(await s.run()); return out },
    exec: async (sql: string) => { db.exec(sql); return { count: 1, duration: 0 } },
    dump: async () => new ArrayBuffer(0),
    withSession: () => { throw new Error('not supported') },
  }
  return d1 as unknown as FakeD1 & D1Database
}
