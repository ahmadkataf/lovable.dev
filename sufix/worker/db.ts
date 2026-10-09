// The storage layer: a thin wrapper over D1's prepared statements (the Node runtime in server/node.mjs offers the same API).
import type { Category, LedgerEntry, Order, Product, RepairTicket, SiteSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/defaults'
import { buildDemo } from '../shared/demo'

export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}
export interface Database {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<unknown>
}

export const SCHEMA: string[] = [
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, category TEXT, brand TEXT, active INTEGER DEFAULT 1, demo INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, data TEXT NOT NULL, demo INTEGER DEFAULT 0, sort INTEGER DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number INTEGER NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, phone TEXT, total REAL DEFAULT 0, demo INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, number INTEGER NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, phone TEXT, demo INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, data TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, demo INTEGER DEFAULT 0, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS orders_status ON orders(status)',
  'CREATE INDEX IF NOT EXISTS orders_phone ON orders(phone)',
  'CREATE INDEX IF NOT EXISTS tickets_phone ON tickets(phone)',
  'CREATE INDEX IF NOT EXISTS ledger_date ON ledger(date)',
]

let ready: Promise<void> | null = null

/** Creates the tables the first time and seeds the demo copy of the store. */
export function ensureReady(db: Database): Promise<void> {
  if (!ready) ready = migrate(db).catch(e => { ready = null; throw e })
  return ready
}

async function migrate(db: Database) {
  await db.batch(SCHEMA.map(s => db.prepare(s)))
  const seeded = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('seeded').first<{ value: string }>()
  if (!seeded) {
    await seedDemo(db)
    await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('seeded', '1').run()
  }
}

export async function seedDemo(db: Database) {
  const demo = buildDemo()
  const stmts: Statement[] = []
  for (const c of demo.categories) stmts.push(db.prepare('INSERT OR REPLACE INTO categories (id, data, demo, sort) VALUES (?, ?, 1, ?)').bind(c.id, JSON.stringify(c), c.sort))
  for (const p of demo.products) stmts.push(productInsert(db, p))
  for (const o of demo.orders) stmts.push(orderInsert(db, o))
  for (const t of demo.tickets) stmts.push(ticketInsert(db, t))
  for (const l of demo.ledger) stmts.push(ledgerInsert(db, l))
  // D1 batches are limited in size, so insert in slices
  for (let i = 0; i < stmts.length; i += 60) await db.batch(stmts.slice(i, i + 60))
}

export async function clearDemo(db: Database) {
  await db.batch(['products', 'categories', 'orders', 'tickets', 'ledger'].map(t => db.prepare(`DELETE FROM ${t} WHERE demo = 1`)))
  const s = await getSettings(db)
  await saveSettings(db, { ...s, demoCleared: true })
}

export async function restoreDemo(db: Database) {
  await seedDemo(db)
  const s = await getSettings(db)
  await saveSettings(db, { ...s, demoCleared: false })
}

export function productInsert(db: Database, p: Product) {
  return db.prepare('INSERT OR REPLACE INTO products (id, data, category, brand, active, demo, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
    .bind(p.id, JSON.stringify(p), p.category, p.brand, p.active ? 1 : 0, p.demo ? 1 : 0, p.createdAt, p.updatedAt)
}
export function orderInsert(db: Database, o: Order) {
  return db.prepare('INSERT OR REPLACE INTO orders (id, number, data, status, phone, total, demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(o.id, o.number, JSON.stringify(o), o.status, normalizePhone(o.customer.phone), o.total, o.demo ? 1 : 0, o.createdAt, o.updatedAt)
}
export function ticketInsert(db: Database, t: RepairTicket) {
  return db.prepare('INSERT OR REPLACE INTO tickets (id, number, data, status, phone, demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(t.id, t.number, JSON.stringify(t), t.status, normalizePhone(t.customer.phone), t.demo ? 1 : 0, t.createdAt, t.updatedAt)
}
export function ledgerInsert(db: Database, l: LedgerEntry) {
  return db.prepare('INSERT OR REPLACE INTO ledger (id, data, type, amount, date, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(l.id, JSON.stringify(l), l.type, l.amount, l.date, l.demo ? 1 : 0, l.createdAt)
}

export function normalizePhone(phone: string) {
  const digits = (phone || '').replace(/\D/g, '')
  // 0912345678 / 963912345678 / +963 912 345 678 → 912345678
  return digits.replace(/^(00)?963/, '').replace(/^0/, '')
}

const parse = <T,>(rows: { data: string }[]): T[] => rows.map(r => JSON.parse(r.data) as T)

export async function getSettings(db: Database): Promise<SiteSettings> {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('site').first<{ value: string }>()
  const stored = row ? (JSON.parse(row.value) as Partial<SiteSettings>) : {}
  return mergeSettings(stored)
}

export function mergeSettings(stored: Partial<SiteSettings>): SiteSettings {
  // every nested object falls back to the defaults, so settings saved by an older version still load
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const [k, v] of Object.entries(stored)) {
    const d = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k]
    out[k] = d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object' && !Array.isArray(v) ? { ...d, ...(v as object) } : v
  }
  return out as unknown as SiteSettings
}

export function saveSettings(db: Database, s: SiteSettings) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind('site', JSON.stringify(s)).run()
}

export async function getKV(db: Database, key: string) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>()
  return row?.value ?? null
}
export function setKV(db: Database, key: string, value: string) {
  return db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, value).run()
}

export async function listCategories(db: Database): Promise<Category[]> {
  const { results } = await db.prepare('SELECT data FROM categories ORDER BY sort').all<{ data: string }>()
  return parse<Category>(results)
}
export async function listProducts(db: Database, onlyActive: boolean): Promise<Product[]> {
  const { results } = await db.prepare(`SELECT data FROM products ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY created_at DESC`).all<{ data: string }>()
  return parse<Product>(results)
}
export async function getProduct(db: Database, id: string): Promise<Product | null> {
  const row = await db.prepare('SELECT data FROM products WHERE id = ?').bind(id).first<{ data: string }>()
  return row ? JSON.parse(row.data) : null
}
export async function getOrder(db: Database, id: string): Promise<Order | null> {
  const row = await db.prepare('SELECT data FROM orders WHERE id = ?').bind(id).first<{ data: string }>()
  return row ? JSON.parse(row.data) : null
}
export async function getTicket(db: Database, id: string): Promise<RepairTicket | null> {
  const row = await db.prepare('SELECT data FROM tickets WHERE id = ?').bind(id).first<{ data: string }>()
  return row ? JSON.parse(row.data) : null
}
export async function listOrders(db: Database, opts: { status?: string; q?: string; limit?: number } = {}): Promise<Order[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (opts.status) { where.push('status = ?'); args.push(opts.status) }
  if (opts.q) {
    const q = opts.q.trim()
    where.push('(phone LIKE ? OR CAST(number AS TEXT) LIKE ? OR data LIKE ?)')
    args.push(`%${normalizePhone(q)}%`, `%${q.replace(/\D/g, '')}%`, `%${q}%`)
  }
  const sql = `SELECT data FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${opts.limit ?? 500}`
  const { results } = await db.prepare(sql).bind(...args).all<{ data: string }>()
  return parse<Order>(results)
}
export async function listTickets(db: Database, opts: { status?: string; q?: string; limit?: number } = {}): Promise<RepairTicket[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (opts.status) { where.push('status = ?'); args.push(opts.status) }
  if (opts.q) {
    const q = opts.q.trim()
    where.push('(phone LIKE ? OR CAST(number AS TEXT) LIKE ? OR data LIKE ?)')
    args.push(`%${normalizePhone(q)}%`, `%${q.replace(/\D/g, '')}%`, `%${q}%`)
  }
  const sql = `SELECT data FROM tickets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${opts.limit ?? 500}`
  const { results } = await db.prepare(sql).bind(...args).all<{ data: string }>()
  return parse<RepairTicket>(results)
}
export async function listLedger(db: Database, opts: { from?: string; to?: string; type?: string } = {}): Promise<LedgerEntry[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (opts.from) { where.push('date >= ?'); args.push(opts.from) }
  if (opts.to) { where.push('date <= ?'); args.push(opts.to) }
  if (opts.type) { where.push('type = ?'); args.push(opts.type) }
  const sql = `SELECT data FROM ledger ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC, created_at DESC LIMIT 2000`
  const { results } = await db.prepare(sql).bind(...args).all<{ data: string }>()
  return parse<LedgerEntry>(results)
}
export async function nextNumber(db: Database, table: 'orders' | 'tickets', start: number) {
  const row = await db.prepare(`SELECT MAX(number) AS m FROM ${table}`).first<{ m: number | null }>()
  return Math.max(start, (row?.m ?? 0) + 1)
}
