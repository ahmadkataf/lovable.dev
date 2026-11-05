// The pilot database lives in one SQLite-backed Durable Object (the API token used for deployment has no D1
// permission; a Durable Object with SQLite storage offers the same SQL and needs only Workers permissions).
// The worker talks to it through a small D1-shaped shim (see dbshim.ts), so the routes stay D1-style code.
import { DurableObject } from 'cloudflare:workers'
import { ADMIN_WINDOW, LOGIN_WINDOW, ensureAttemptsTable, recordAttempt, type Verdict, type Window } from './ratelimit'

export interface RunMeta { changes: number; last_row_id: number }
export interface QueryResult { results: Record<string, unknown>[] }

/** Split an SQL script into statements: a statement ends with ';' at the end of a line; '--' comment lines are dropped. */
export function splitSql(script: string): string[] {
  const lines = script.split('\n').filter(l => !/^\s*--/.test(l))
  const out: string[] = []
  let buf: string[] = []
  for (const line of lines) {
    buf.push(line)
    if (/;\s*$/.test(line)) { const s = buf.join('\n').trim(); if (s.replace(/;$/, '').trim()) out.push(s); buf = [] }
  }
  const rest = buf.join('\n').trim()
  if (rest) out.push(rest)
  return out
}

export class MadarDB extends DurableObject {
  private attemptsReady = false   // the login_attempts table is created lazily, on the first rate-limit check

  private hit(key: string, win: Window): Verdict {
    if (!this.attemptsReady) { ensureAttemptsTable(this.ctx.storage.sql); this.attemptsReady = true }
    return recordAttempt(this.ctx.storage.sql, key, win)
  }
  /** Durable login limiter: 20 attempts per 10 minutes per IP, shared by every isolate. */
  loginAttempt(ip: string): Verdict { return this.hit(`login:${ip}`, LOGIN_WINDOW) }
  /** Durable limiter for /api/admin/*: 10 calls per minute per IP. */
  adminAttempt(ip: string): Verdict { return this.hit(`admin:${ip}`, ADMIN_WINDOW) }

  private norm(params: unknown[]) {
    return params.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)) as (string | number | null | ArrayBuffer)[]
  }
  query(sql: string, params: unknown[] = []): QueryResult {
    const cur = this.ctx.storage.sql.exec(sql, ...this.norm(params))
    return { results: cur.toArray() as Record<string, unknown>[] }
  }
  run(sql: string, params: unknown[] = []): RunMeta {
    this.ctx.storage.sql.exec(sql, ...this.norm(params)).toArray()
    const m = this.ctx.storage.sql.exec('SELECT last_insert_rowid() AS id, changes() AS changes').one() as { id: number; changes: number }
    return { changes: Number(m.changes), last_row_id: Number(m.id) }
  }
  batch(stmts: { sql: string; params: unknown[] }[]): RunMeta[] {
    return this.ctx.storage.transactionSync(() => stmts.map(s => this.run(s.sql, s.params)))
  }
  /** Run a whole SQL script (schema or seed) in one transaction; returns the number of statements. */
  execScript(script: string): number {
    const stmts = splitSql(script)
    this.ctx.storage.transactionSync(() => { for (const s of stmts) this.ctx.storage.sql.exec(s).toArray() })
    return stmts.length
  }
  /** Drop every table so the demo can be re-seeded with today's dates. */
  reset(): number {
    const tables = (this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").toArray() as { name: string }[]).map(r => r.name)
    this.ctx.storage.transactionSync(() => { for (const t of tables) this.ctx.storage.sql.exec(`DROP TABLE IF EXISTS "${t}"`).toArray() })
    this.attemptsReady = false   // login_attempts went with the rest; recreate it on the next check
    return tables.length
  }
  /** Row counts of the main tables, for health checks. */
  health(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const t of ['schools', 'users', 'sections', 'students', 'timetable', 'homework', 'attendance', 'absences', 'substitutions', 'notifications']) {
      try { out[t] = Number((this.ctx.storage.sql.exec(`SELECT count(*) AS n FROM ${t}`).one() as { n: number }).n) } catch { out[t] = -1 }
    }
    return out
  }
}
