// A D1Database look-alike over the MadarDB Durable Object (only the methods the routes use).
import type { QueryResult, RunMeta } from './do'
import type { Verdict } from './ratelimit'
import type { Env } from './types'

/** The subset of the MadarDB RPC surface the shim uses (typed by hand: the generated stub type is too strict). */
export interface DbStub {
  query(sql: string, params?: unknown[]): Promise<QueryResult>
  run(sql: string, params?: unknown[]): Promise<RunMeta>
  batch(stmts: { sql: string; params: unknown[] }[]): Promise<RunMeta[]>
  execScript(script: string): Promise<number>
  reset(): Promise<number>
  health(): Promise<Record<string, number>>
  loginAttempt(ip: string): Promise<Verdict>
  loginSucceeded(ip: string): Promise<void>
  adminAttempt(ip: string): Promise<Verdict>
}

/** A fresh stub of the one database object, or null when the Worker runs without the binding (tests use a fake D1). */
export const doStub = (env: Pick<Env, 'MADAR_DO'>): DbStub | null =>
  env.MADAR_DO ? (env.MADAR_DO.get(env.MADAR_DO.idFromName('main')) as unknown as DbStub) : null
type Stub = DbStub
interface Bound { __sql: string; __params: unknown[] }
const meta = (changes = 0, last_row_id = 0) => ({ changes, last_row_id, duration: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: changes > 0 })

export function doDatabase(stubLike: unknown): D1Database {
  const stub = stubLike as Stub
  const prep = (sql: string, params: unknown[] = []): D1PreparedStatement & Bound => {
    const s = {
      __sql: sql, __params: params,
      bind: (...p: unknown[]) => prep(sql, p),
      all: async () => ({ results: (await stub.query(sql, params)).results, success: true as const, meta: meta() }),
      first: async (col?: string) => { const row = (await stub.query(sql, params)).results[0] ?? null; return col ? (row as Record<string, unknown> | null)?.[col] ?? null : row },
      run: async () => { const m = await stub.run(sql, params); return { results: [], success: true as const, meta: meta(m.changes, m.last_row_id) } },
      raw: async () => (await stub.query(sql, params)).results.map((r: Record<string, unknown>) => Object.values(r)),
    }
    return s as unknown as D1PreparedStatement & Bound
  }
  const db = {
    prepare: prep,
    batch: async (stmts: D1PreparedStatement[]) => {
      const ms = await stub.batch(stmts.map(s => { const b = s as unknown as Bound; return { sql: b.__sql, params: b.__params } }))
      return ms.map(m => ({ results: [], success: true as const, meta: meta(m.changes, m.last_row_id) }))
    },
    exec: async (sql: string) => ({ count: await stub.execScript(sql), duration: 0 }),
    dump: async () => new ArrayBuffer(0),
    withSession: () => { throw new Error('not supported') },
  }
  return db as unknown as D1Database
}
