// The D1 database: the schema (created by the Worker itself, once per isolate) and every query the Worker runs.
// Rows are mapped to the shapes of types.ts here, so nothing else knows the column names.
import { b64url } from './http'
import { DEFAULT_SETTINGS, type AuditEntry, type Licence, type LicenceStatus, type Plan, type ResetCode, type SiteSettings, type Stats } from './types'

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS licences (
    id TEXT PRIMARY KEY, device TEXT NOT NULL, plan TEXT NOT NULL, until TEXT, code TEXT NOT NULL,
    customer TEXT NOT NULL DEFAULT '', clinic TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL, search TEXT NOT NULL DEFAULT '')`,
  'CREATE INDEX IF NOT EXISTS licences_created ON licences (created_at)',
  'CREATE INDEX IF NOT EXISTS licences_device ON licences (device)',
  `CREATE TABLE IF NOT EXISTS resets (
    id TEXT PRIMARY KEY, device TEXT NOT NULL, code TEXT NOT NULL, day TEXT NOT NULL, last_day TEXT NOT NULL,
    customer TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS resets_created ON resets (created_at)',
  // One row per day and platform: the counts stay small however many downloads there are.
  `CREATE TABLE IF NOT EXISTS downloads (
    day TEXT NOT NULL, platform TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, platform))`,
  'CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts (ip, at)',
  'CREATE INDEX IF NOT EXISTS login_attempts_at ON login_attempts (at)',
  // Logged-out sessions until their tokens expire (auth.ts revokeSession).
  'CREATE TABLE IF NOT EXISTS revoked_sessions (sid TEXT PRIMARY KEY, exp INTEGER NOT NULL)',
  // Who was already counted today (a salted hash of the address, never the address): one download per visitor a day.
  `CREATE TABLE IF NOT EXISTS download_seen (
    day TEXT NOT NULL, platform TEXT NOT NULL, who TEXT NOT NULL, PRIMARY KEY (day, platform, who))`,
  `CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '')`,
]

// Keyed by the database object: one Worker isolate has one DB binding, tests create several.
const ready = new WeakMap<D1Database, Promise<void>>()
/** Creates the tables on the first request of an isolate; a failure is retried by the next request. */
export function ensureSchema(db: D1Database): Promise<void> {
  let p = ready.get(db)
  if (!p) {
    p = db.batch(SCHEMA.map(s => db.prepare(s))).then(() => undefined, e => { ready.delete(db); throw e })
    ready.set(db, p)
  }
  return p
}

const nowIso = () => new Date().toISOString()
/** 'YYYY-MM-DD' (UTC) of a time. */
export const dayOf = (t: number | Date = Date.now()) => new Date(t).toISOString().slice(0, 10)

// ---- settings ----------------------------------------------------------------------------------------------------
export async function getValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row ? row.value : null
}
/** The value of a key, stored first if the key has none yet (two isolates racing to store one agree on the winner). */
export async function getOrInitValue(db: D1Database, key: string, make: () => string): Promise<string> {
  const v = await getValue(db, key)
  if (v !== null) return v
  await db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, make()).run()
  return (await getValue(db, key)) as string
}

// Per isolate: the salt never changes once stored.
const salts = new WeakMap<D1Database, Promise<string>>()
/** This deployment's random salt (made and stored on first use): keys the cookies and hashes the download counter's addresses. */
export function deploymentSalt(db: D1Database): Promise<string> {
  let p = salts.get(db)
  if (!p) {
    p = getOrInitValue(db, 'session_salt', () => b64url(crypto.getRandomValues(new Uint8Array(16))))
    p.catch(() => salts.delete(db))
    salts.set(db, p)
  }
  return p
}

/** The stored settings over the defaults; a stored value of the wrong type is ignored. */
export function mergeSettings(stored: unknown): SiteSettings {
  const out: SiteSettings = { ...DEFAULT_SETTINGS }
  if (stored && typeof stored === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
      const v = (stored as Record<string, unknown>)[k]
      if (typeof v === typeof DEFAULT_SETTINGS[k]) (out as unknown as Record<string, unknown>)[k] = v
    }
  }
  return out
}
export async function getSettings(db: D1Database): Promise<SiteSettings> {
  const raw = await getValue(db, 'site')
  let stored: unknown = null
  try { stored = raw ? JSON.parse(raw) : null } catch { /* a damaged row falls back to the defaults */ }
  return mergeSettings(stored)
}
export async function saveSettings(db: D1Database, s: SiteSettings): Promise<void> {
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value')
    .bind('site', JSON.stringify(s)).run()
  memo = { db, at: Date.now(), value: s }
}

// Public pages read the settings at most every 30 s per isolate: D1 answers from one region and the visitor may be
// far from it. A save writes through, so the isolate that saved shows the change at once (others within 30 s).
const SETTINGS_TTL = 30_000
let memo: { db: D1Database; at: number; value: SiteSettings } | null = null
export async function getSettingsCached(db: D1Database, now = Date.now()): Promise<SiteSettings> {
  if (memo && memo.db === db && now - memo.at < SETTINGS_TTL) return memo.value
  const value = await getSettings(db)
  memo = { db, at: now, value }
  return value
}

// ---- audit -------------------------------------------------------------------------------------------------------
export async function audit(db: D1Database, action: string, detail: string, ip: string): Promise<void> {
  await db.prepare('INSERT INTO audit (at, action, detail, ip) VALUES (?, ?, ?, ?)').bind(nowIso(), action, detail.slice(0, 500), ip).run()
}
interface AuditRow { id: number; at: string; action: string; detail: string; ip: string }
export async function listAudit(db: D1Database, limit: number): Promise<AuditEntry[]> {
  const { results } = await db.prepare('SELECT id, at, action, detail, ip FROM audit ORDER BY id DESC LIMIT ?').bind(limit).all<AuditRow>()
  return results.map(r => ({ id: r.id, at: r.at, action: r.action, detail: r.detail, ip: r.ip }))
}

// ---- licences ----------------------------------------------------------------------------------------------------
interface LicenceRow {
  id: string; device: string; plan: string; until: string | null; code: string; customer: string; clinic: string
  phone: string; price: number; note: string; status: string; created_at: string
}
const LICENCE_COLS = 'id, device, plan, until, code, customer, clinic, phone, price, note, status, created_at'
function toLicence(r: LicenceRow): Licence {
  return {
    id: r.id, device: r.device, plan: r.plan as Plan, until: r.until, code: r.code, customer: r.customer, clinic: r.clinic,
    phone: r.phone, price: Number(r.price), note: r.note, status: r.status as LicenceStatus, createdAt: r.created_at,
  }
}
/** What the licence list searches: the device with and without its dash, the names, the phone as typed and as digits only. Lower case, as the query is. */
export function searchText(l: Pick<Licence, 'device' | 'customer' | 'clinic' | 'phone'>): string {
  return [l.device, l.device.replace(/-/g, ''), l.customer, l.clinic, l.phone, l.phone.replace(/\D/g, '')].join('\n').toLowerCase()
}
/** A LIKE pattern matching `s` anywhere, with LIKE's own wildcards taken literally (ESCAPE '\'). */
export const likeAny = (s: string) => `%${s.replace(/[\\%_]/g, c => `\\${c}`)}%`

export async function insertLicence(db: D1Database, l: Licence): Promise<void> {
  await db.prepare(`INSERT INTO licences (${LICENCE_COLS}, search) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(l.id, l.device, l.plan, l.until, l.code, l.customer, l.clinic, l.phone, l.price, l.note, l.status, l.createdAt, searchText(l))
    .run()
}
export async function getLicence(db: D1Database, id: string): Promise<Licence | null> {
  const r = await db.prepare(`SELECT ${LICENCE_COLS} FROM licences WHERE id = ?`).bind(id).first<LicenceRow>()
  return r ? toLicence(r) : null
}
export async function updateLicence(db: D1Database, l: Licence): Promise<void> {
  await db.prepare('UPDATE licences SET customer = ?, clinic = ?, phone = ?, price = ?, note = ?, status = ?, search = ? WHERE id = ?')
    .bind(l.customer, l.clinic, l.phone, l.price, l.note, l.status, searchText(l), l.id).run()
}

export interface LicenceQuery { q: string; status: LicenceStatus | ''; limit: number; offset: number }
export async function listLicences(db: D1Database, f: LicenceQuery): Promise<{ items: Licence[]; total: number }> {
  const where: string[] = [], args: unknown[] = []
  const q = f.q.trim().toLowerCase()
  if (q) {
    // The query as typed; for a phone number also its digits alone, and without a leading 0 (a local number typed
    // as 0996… finds the licence saved as +963 996…).
    const alt = new Set([q])
    const digits = q.replace(/[\s\-+().]/g, '')
    if (/^\d{3,}$/.test(digits)) { alt.add(digits); if (/^0+\d{6,}$/.test(digits)) alt.add(digits.replace(/^0+/, '')) }
    where.push(`(${[...alt].map(() => "search LIKE ? ESCAPE '\\'").join(' OR ')})`)
    args.push(...[...alt].map(likeAny))
  }
  if (f.status) { where.push('status = ?'); args.push(f.status) }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [rows, count] = await db.batch([
    db.prepare(`SELECT ${LICENCE_COLS} FROM licences ${w} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`).bind(...args, f.limit, f.offset),
    db.prepare(`SELECT COUNT(*) AS n FROM licences ${w}`).bind(...args),
  ])
  return {
    items: (rows.results as LicenceRow[]).map(toLicence),
    total: Number((count.results[0] as { n: number } | undefined)?.n ?? 0),
  }
}
export async function allLicences(db: D1Database): Promise<Licence[]> {
  const { results } = await db.prepare(`SELECT ${LICENCE_COLS} FROM licences ORDER BY created_at DESC, rowid DESC`).all<LicenceRow>()
  return results.map(toLicence)
}
/** The other active licences of a device, newest first. */
export async function activeLicencesOf(db: D1Database, device: string, exceptId: string): Promise<Licence[]> {
  const { results } = await db.prepare(`SELECT ${LICENCE_COLS} FROM licences WHERE device = ? AND status = 'active' AND id != ? ORDER BY created_at DESC, rowid DESC LIMIT 20`)
    .bind(device, exceptId).all<LicenceRow>()
  return results.map(toLicence)
}

// ---- PIN reset codes ---------------------------------------------------------------------------------------------
interface ResetRow { id: string; device: string; code: string; day: string; last_day: string; customer: string; phone: string; note: string; created_at: string }
function toReset(r: ResetRow): ResetCode {
  return { id: r.id, device: r.device, code: r.code, day: r.day, lastDay: r.last_day, customer: r.customer, phone: r.phone, note: r.note, createdAt: r.created_at }
}
export async function insertReset(db: D1Database, r: ResetCode): Promise<void> {
  await db.prepare('INSERT INTO resets (id, device, code, day, last_day, customer, phone, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(r.id, r.device, r.code, r.day, r.lastDay, r.customer, r.phone, r.note, r.createdAt).run()
}
export async function listResets(db: D1Database, limit: number): Promise<ResetCode[]> {
  const { results } = await db.prepare('SELECT id, device, code, day, last_day, customer, phone, note, created_at FROM resets ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .bind(limit).all<ResetRow>()
  return results.map(toReset)
}

// ---- downloads ---------------------------------------------------------------------------------------------------
export type Platform = 'android' | 'windows'
/**
 * Counts a download unless this visitor (`who`, a salted hash of the address) was already counted for this platform
 * today: reloading or scripting the link does not inflate the numbers, and a repeat costs no D1 write. Answers
 * whether it counted.
 */
export async function countDownload(db: D1Database, platform: Platform, who: string, now = Date.now()): Promise<boolean> {
  const day = dayOf(now)
  const seen = await db.prepare('INSERT OR IGNORE INTO download_seen (day, platform, who) VALUES (?, ?, ?) RETURNING who').bind(day, platform, who).all()
  if (!seen.results.length) return false
  await db.batch([
    db.prepare('INSERT INTO downloads (day, platform, count) VALUES (?, ?, 1) ON CONFLICT (day, platform) DO UPDATE SET count = count + 1').bind(day, platform),
    db.prepare('DELETE FROM download_seen WHERE day < ?').bind(dayOf(now - 86_400_000)),
  ])
  return true
}

// ---- stats -------------------------------------------------------------------------------------------------------
/**
 * The dashboard's numbers. Licences: total/month count every code handed out except void ones (a refunded code
 * still opens the app, since codes work offline); revenue counts active licences only. "month" = since the 1st of
 * the current month (UTC); downloads "30" = the last 30 days including today.
 */
export async function stats(db: D1Database, now = new Date()): Promise<Stats> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const since30 = dayOf(now.getTime() - 29 * 86_400_000)
  const [lic, res, dl, recent] = await db.batch([
    db.prepare(`SELECT
        COUNT(*) AS total,
        COALESCE(SUM(created_at >= ?1), 0) AS month,
        COALESCE(SUM(CASE WHEN status = 'active' THEN price END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'active' AND created_at >= ?1 THEN price END), 0) AS revenue_month
      FROM licences WHERE status != 'void'`).bind(monthStart),
    db.prepare('SELECT COUNT(*) AS total FROM resets'),
    db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN platform = 'android' THEN count END), 0) AS android,
        COALESCE(SUM(CASE WHEN platform = 'windows' THEN count END), 0) AS windows,
        COALESCE(SUM(CASE WHEN platform = 'android' AND day >= ?1 THEN count END), 0) AS android30,
        COALESCE(SUM(CASE WHEN platform = 'windows' AND day >= ?1 THEN count END), 0) AS windows30
      FROM downloads`).bind(since30),
    db.prepare('SELECT id, at, action, detail, ip FROM audit ORDER BY id DESC LIMIT 10'),
  ])
  const l = lic.results[0] as Record<string, number>, d = dl.results[0] as Record<string, number>
  const money = (v: unknown) => Math.round(Number(v || 0) * 100) / 100
  return {
    licences: { total: Number(l.total), month: Number(l.month), revenue: money(l.revenue), revenueMonth: money(l.revenue_month) },
    resets: { total: Number((res.results[0] as { total: number }).total) },
    downloads: { android: Number(d.android), windows: Number(d.windows), android30: Number(d.android30), windows30: Number(d.windows30) },
    recent: (recent.results as AuditRow[]).map(r => ({ id: r.id, at: r.at, action: r.action, detail: r.detail, ip: r.ip })),
  }
}
