// SUFIX API — runs on Cloudflare Workers (D1) and, through server/node.mjs, on any Node host.
import type { CartItem, Category, Customer, LedgerEntry, Order, OrderStatus, Product, RepairTicket, SiteSettings, TicketStatus } from '../shared/types'
import { ORDER_FLOW, TICKET_FLOW } from '../shared/types'
import { DJI_DRONES } from '../shared/dji'
import type { Database } from './db'
import * as db from './db'
import { checkSession, createSession, destroySession, hasPassword, setPassword, verifyPassword } from './auth'
import { dashboard, reports } from './reports'

export interface Env { DB: Database; ASSETS?: { fetch(req: Request): Promise<Response> } }

class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
const bad = (msg: string) => new HttpError(400, msg)

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })

type Ctx = { req: Request; url: URL; db: Database; params: Record<string, string>; body: () => Promise<any> }
type Handler = (c: Ctx) => Promise<Response | unknown>
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler; admin: boolean }[] = []
function route(method: string, path: string, handler: Handler, admin = false) {
  const keys: string[] = []
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  routes.push({ method, pattern, keys, handler, admin })
}
const pub = (m: string, p: string, h: Handler) => route(m, p, h)
const adm = (m: string, p: string, h: Handler) => route(m, p, h, true)

export async function handleApi(req: Request, database: Database): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    await db.ensureReady(database)
    for (const r of routes) {
      if (r.method !== req.method) continue
      const m = url.pathname.match(r.pattern)
      if (!m) continue
      if (r.admin && !(await checkSession(database, req))) return json({ error: 'unauthorized' }, 401, cors)
      const params: Record<string, string> = {}
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
      let cached: unknown
      const body = async () => (cached ??= await req.json().catch(() => { throw bad('invalid json') }))
      const out = await r.handler({ req, url, db: database, params, body })
      if (out instanceof Response) return out
      return json(out, 200, cors)
    }
    return json({ error: 'not found' }, 404, cors)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, cors)
    console.error(e)
    return json({ error: 'server error', detail: String((e as Error)?.message || e) }, 500, cors)
  }
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }

// ───────────── helpers ─────────────
const now = () => Date.now()
const uid = () => crypto.randomUUID()
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown, def = 0) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : def)
const bool = (v: unknown, def = false) => (typeof v === 'boolean' ? v : def)
const arr = <T,>(v: unknown, map: (x: any) => T | null): T[] => (Array.isArray(v) ? v.map(map).filter((x): x is T => x !== null) : [])

function customer(v: any): Customer {
  const c = { name: str(v?.name, 80), phone: str(v?.phone, 30), city: str(v?.city, 60), address: str(v?.address, 300), notes: str(v?.notes, 500) }
  if (c.name.length < 2) throw bad('الاسم مطلوب')
  if (db.normalizePhone(c.phone).length < 7) throw bad('رقم الهاتف غير صحيح')
  return c
}

function sanitizeProduct(v: any, existing?: Product): Product {
  const t = now()
  const name = str(v.name, 160)
  if (!name) throw bad('اسم المنتج مطلوب')
  return {
    id: existing?.id ?? uid(), name, slug: str(v.slug, 120) || undefined, brand: str(v.brand, 60) || 'DJI', category: str(v.category, 60),
    compatible: arr(v.compatible, x => (typeof x === 'string' ? x : null)), price: Math.max(0, num(v.price)), oldPrice: num(v.oldPrice) > 0 ? num(v.oldPrice) : undefined,
    stock: Math.max(0, Math.floor(num(v.stock))), sku: str(v.sku, 60) || undefined, short: str(v.short, 300), description: str(v.description, 5000),
    specs: arr(v.specs, s => (s && typeof s.label === 'string' ? { label: str(s.label, 60), value: str(s.value, 200) } : null)),
    images: arr(v.images, x => (typeof x === 'string' && x.length < 2000 ? x : null)).slice(0, 8),
    illustration: str(v.illustration, 30) as Product['illustration'] || 'box', featured: bool(v.featured), active: bool(v.active, true),
    tags: arr(v.tags, x => (typeof x === 'string' ? str(x, 30) : null)), demo: existing?.demo ?? false, createdAt: existing?.createdAt ?? t, updatedAt: t,
  }
}

const publicOrder = (o: Order) => ({ ...o, adminNotes: undefined })
const publicTicket = (t: RepairTicket) => ({ ...t, partsCost: undefined, technicianNotes: undefined })

/** Keeps the stock in step with the order's status: taken when the order is confirmed, given back when it is cancelled. */
async function applyStock(database: Database, order: Order & { stockApplied?: boolean }, next: OrderStatus) {
  const counted = ['confirmed', 'processing', 'shipped', 'delivered'].includes(next)
  if (counted && !order.stockApplied) {
    for (const it of order.items) {
      const p = await db.getProduct(database, it.productId)
      if (p) { p.stock = Math.max(0, p.stock - it.qty); p.updatedAt = now(); await db.productInsert(database, p).run() }
    }
    order.stockApplied = true
  } else if (next === 'cancelled' && order.stockApplied) {
    for (const it of order.items) {
      const p = await db.getProduct(database, it.productId)
      if (p) { p.stock += it.qty; p.updatedAt = now(); await db.productInsert(database, p).run() }
    }
    order.stockApplied = false
  }
}

async function ledgerFor(database: Database, ref: LedgerEntry['ref'], type: LedgerEntry['type'], amount: number, category: string, note: string, currency: string) {
  if (!ref || amount <= 0) return
  const existing = await database.prepare('SELECT id FROM ledger WHERE data LIKE ? AND type = ?').bind(`%"id":"${ref.id}"%`, type).first()
  if (existing) return
  const t = now()
  await db.ledgerInsert(database, { id: uid(), type, amount, currency, category, note, date: new Date(t).toISOString().slice(0, 10), ref, createdAt: t }).run()
}

// ───────────── public ─────────────
pub('GET', '/api/bootstrap', async c => {
  const [settings, categories, products] = await Promise.all([db.getSettings(c.db), db.listCategories(c.db), db.listProducts(c.db, true)])
  return { settings, categories, products, drones: DJI_DRONES }
})
pub('GET', '/api/health', async () => ({ ok: true, time: now() }))
pub('GET', '/api/products/:id', async c => {
  const p = await db.getProduct(c.db, c.params.id)
  if (!p || !p.active) throw new HttpError(404, 'not found')
  return p
})

pub('POST', '/api/orders', async c => {
  const v = await c.body()
  const cust = customer(v.customer)
  const settings = await db.getSettings(c.db)
  const items: CartItem[] = []
  for (const it of arr(v.items, x => x)) {
    const p = await db.getProduct(c.db, str(it.productId, 80))
    if (!p || !p.active) continue
    const qty = Math.min(50, Math.max(1, Math.floor(num(it.qty, 1))))
    items.push({ productId: p.id, name: p.name, price: p.price, qty, image: p.images[0], illustration: p.illustration })
  }
  if (!items.length) throw bad('السلة فارغة')
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
  const zone = settings.shipping.zones.find(z => z.name === str(v.zone, 60))
  const shipping = settings.shipping.freeAbove && subtotal >= settings.shipping.freeAbove ? 0 : zone?.fee ?? 0
  const t = now()
  const order: Order = {
    id: uid(), number: await db.nextNumber(c.db, 'orders', 1001), customer: cust, items, subtotal, shipping, total: subtotal + shipping,
    currency: settings.currency.code, status: 'new', whatsappSent: false, history: [{ status: 'new', at: t }], demo: false, createdAt: t, updatedAt: t,
  }
  await db.orderInsert(c.db, order).run()
  return publicOrder(order)
})
pub('POST', '/api/orders/:id/whatsapp', async c => {
  const o = await db.getOrder(c.db, c.params.id)
  if (!o) throw new HttpError(404, 'not found')
  o.whatsappSent = true; o.updatedAt = now()
  await db.orderInsert(c.db, o).run()
  return { ok: true }
})

pub('POST', '/api/tickets', async c => {
  const v = await c.body()
  const cust = customer(v.customer)
  const t = now()
  const ticket: RepairTicket = {
    id: uid(), number: await db.nextNumber(c.db, 'tickets', 501), customer: cust, deviceType: str(v.deviceType, 40) || 'جهاز آخر', brand: str(v.brand, 40),
    model: str(v.model, 80), issue: str(v.issue, 2000), accessories: str(v.accessories, 300), photos: arr(v.photos, x => (typeof x === 'string' && x.length < 2000 ? x : null)).slice(0, 4),
    status: 'received', whatsappSent: false, history: [{ status: 'received', at: t }], demo: false, createdAt: t, updatedAt: t,
  }
  if (ticket.issue.length < 5) throw bad('صف العطل بشكل أوضح')
  await db.ticketInsert(c.db, ticket).run()
  return publicTicket(ticket)
})
pub('POST', '/api/tickets/:id/whatsapp', async c => {
  const t = await db.getTicket(c.db, c.params.id)
  if (!t) throw new HttpError(404, 'not found')
  t.whatsappSent = true; t.updatedAt = now()
  await db.ticketInsert(c.db, t).run()
  return { ok: true }
})

pub('GET', '/api/track', async c => {
  const number = parseInt(c.url.searchParams.get('number') || '', 10)
  const phone = db.normalizePhone(c.url.searchParams.get('phone') || '')
  if (!number || phone.length < 7) throw bad('أدخل رقم الطلب ورقم الهاتف')
  const o = await c.db.prepare('SELECT data FROM orders WHERE number = ? AND phone = ?').bind(number, phone).first<{ data: string }>()
  if (o) return { kind: 'order', order: publicOrder(JSON.parse(o.data)) }
  const t = await c.db.prepare('SELECT data FROM tickets WHERE number = ? AND phone = ?').bind(number, phone).first<{ data: string }>()
  if (t) return { kind: 'ticket', ticket: publicTicket(JSON.parse(t.data)) }
  throw new HttpError(404, 'لم نجد طلباً بهذا الرقم والهاتف')
})

pub('POST', '/api/images', async c => uploadImage(c)) // customers attach photos to repair requests
pub('GET', '/api/images/:id', async c => {
  const row = await c.db.prepare('SELECT mime, data FROM images WHERE id = ?').bind(c.params.id).first<{ mime: string; data: string }>()
  if (!row) return new Response('not found', { status: 404 })
  const bin = Uint8Array.from(atob(row.data), ch => ch.charCodeAt(0))
  return new Response(bin, { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable' } })
})

async function uploadImage(c: Ctx) {
  const v = await c.body()
  const m = /^data:(image\/(?:jpeg|png|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(str(v.data, 2_000_000))
  if (!m) throw bad('صيغة الصورة غير مدعومة')
  if (m[2].length > 1_400_000) throw bad('الصورة كبيرة جداً (الحد 1 ميغابايت)')
  const id = uid()
  await c.db.prepare('INSERT INTO images (id, mime, data, created_at) VALUES (?, ?, ?, ?)').bind(id, m[1], m[2], now()).run()
  return { url: `/api/images/${id}` }
}

// ───────────── admin: auth ─────────────
pub('GET', '/api/admin/status', async c => ({ setup: !(await hasPassword(c.db)), authed: await checkSession(c.db, c.req) }))
pub('POST', '/api/admin/setup', async c => {
  if (await hasPassword(c.db)) throw new HttpError(403, 'كلمة المرور معيّنة مسبقاً')
  const { password } = await c.body()
  if (str(password, 200).length < 6) throw bad('كلمة المرور 6 أحرف على الأقل')
  await setPassword(c.db, password)
  return { token: await createSession(c.db) }
})
pub('POST', '/api/admin/login', async c => {
  const { password } = await c.body()
  if (!(await verifyPassword(c.db, str(password, 200)))) { await new Promise(r => setTimeout(r, 400)); throw new HttpError(401, 'كلمة المرور غير صحيحة') }
  return { token: await createSession(c.db) }
})
adm('POST', '/api/admin/logout', async c => { await destroySession(c.db, c.req); return { ok: true } })
adm('POST', '/api/admin/password', async c => {
  const { current, password } = await c.body()
  if (!(await verifyPassword(c.db, str(current, 200)))) throw new HttpError(401, 'كلمة المرور الحالية غير صحيحة')
  if (str(password, 200).length < 6) throw bad('كلمة المرور 6 أحرف على الأقل')
  await setPassword(c.db, password)
  return { ok: true }
})

// ───────────── admin: data ─────────────
adm('GET', '/api/admin/dashboard', async c => dashboard(c.db))
adm('GET', '/api/admin/reports', async c => {
  const to = c.url.searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const from = c.url.searchParams.get('from') || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
  return reports(c.db, from, to)
})

adm('GET', '/api/admin/products', async c => db.listProducts(c.db, false))
adm('POST', '/api/admin/products', async c => { const p = sanitizeProduct(await c.body()); await db.productInsert(c.db, p).run(); return p })
adm('PUT', '/api/admin/products/:id', async c => {
  const existing = await db.getProduct(c.db, c.params.id)
  if (!existing) throw new HttpError(404, 'not found')
  const p = sanitizeProduct(await c.body(), existing)
  await db.productInsert(c.db, p).run()
  return p
})
adm('DELETE', '/api/admin/products/:id', async c => { await c.db.prepare('DELETE FROM products WHERE id = ?').bind(c.params.id).run(); return { ok: true } })

adm('GET', '/api/admin/categories', async c => db.listCategories(c.db))
adm('PUT', '/api/admin/categories', async c => {
  const list = arr(await c.body(), (x: any): Category | null => (x && typeof x.name === 'string' ? { id: str(x.id, 60) || uid(), name: str(x.name, 80), description: str(x.description, 200), icon: (str(x.icon, 30) || 'box') as Category['icon'], parent: str(x.parent, 60) || undefined, sort: num(x.sort), demo: bool(x.demo) } : null))
  await c.db.prepare('DELETE FROM categories').run()
  if (list.length) await c.db.batch(list.map((cat, i) => c.db.prepare('INSERT INTO categories (id, data, demo, sort) VALUES (?, ?, ?, ?)').bind(cat.id, JSON.stringify({ ...cat, sort: i }), cat.demo ? 1 : 0, i)))
  return list.map((cat, i) => ({ ...cat, sort: i }))
})

adm('GET', '/api/admin/orders', async c => db.listOrders(c.db, { status: c.url.searchParams.get('status') || undefined, q: c.url.searchParams.get('q') || undefined }))
adm('GET', '/api/admin/orders/:id', async c => { const o = await db.getOrder(c.db, c.params.id); if (!o) throw new HttpError(404, 'not found'); return o })
adm('PATCH', '/api/admin/orders/:id', async c => {
  const o = await db.getOrder(c.db, c.params.id)
  if (!o) throw new HttpError(404, 'not found')
  const v = await c.body()
  const settings = await db.getSettings(c.db)
  if (typeof v.status === 'string' && v.status !== o.status) {
    const next = v.status as OrderStatus
    if (![...ORDER_FLOW, 'cancelled'].includes(next)) throw bad('حالة غير معروفة')
    await applyStock(c.db, o, next)
    o.status = next
    o.history.push({ status: next, at: now(), note: str(v.note, 300) || undefined })
    if (next === 'delivered') await ledgerFor(c.db, { kind: 'order', id: o.id, number: o.number }, 'income', o.total, 'مبيعات', `طلب #${o.number} — ${o.customer.name}`, settings.currency.code)
  }
  if (typeof v.adminNotes === 'string') o.adminNotes = str(v.adminNotes, 2000)
  if (v.customer && typeof v.customer === 'object') o.customer = { ...o.customer, ...customer({ ...o.customer, ...v.customer }) }
  if (typeof v.shipping === 'number') { o.shipping = Math.max(0, v.shipping); o.total = o.subtotal + o.shipping }
  o.updatedAt = now()
  await db.orderInsert(c.db, o).run()
  return o
})
adm('DELETE', '/api/admin/orders/:id', async c => { await c.db.prepare('DELETE FROM orders WHERE id = ?').bind(c.params.id).run(); return { ok: true } })

adm('GET', '/api/admin/tickets', async c => db.listTickets(c.db, { status: c.url.searchParams.get('status') || undefined, q: c.url.searchParams.get('q') || undefined }))
adm('GET', '/api/admin/tickets/:id', async c => { const t = await db.getTicket(c.db, c.params.id); if (!t) throw new HttpError(404, 'not found'); return t })
adm('POST', '/api/admin/tickets', async c => {
  // a walk-in customer, registered by the admin
  const v = await c.body()
  const t = now()
  const ticket: RepairTicket = {
    id: uid(), number: await db.nextNumber(c.db, 'tickets', 501), customer: customer(v.customer), deviceType: str(v.deviceType, 40) || 'جهاز آخر', brand: str(v.brand, 40),
    model: str(v.model, 80), issue: str(v.issue, 2000), accessories: str(v.accessories, 300), photos: [], status: 'received', estimate: num(v.estimate) || undefined,
    whatsappSent: false, history: [{ status: 'received', at: t }], demo: false, createdAt: t, updatedAt: t,
  }
  await db.ticketInsert(c.db, ticket).run()
  return ticket
})
adm('PATCH', '/api/admin/tickets/:id', async c => {
  const t = await db.getTicket(c.db, c.params.id)
  if (!t) throw new HttpError(404, 'not found')
  const v = await c.body()
  const settings = await db.getSettings(c.db)
  if (v.estimate !== undefined) t.estimate = num(v.estimate) || undefined
  if (v.finalCost !== undefined) t.finalCost = num(v.finalCost) || undefined
  if (v.partsCost !== undefined) t.partsCost = num(v.partsCost) || undefined
  if (typeof v.technicianNotes === 'string') t.technicianNotes = str(v.technicianNotes, 3000)
  if (v.customer && typeof v.customer === 'object') t.customer = customer({ ...t.customer, ...v.customer })
  for (const k of ['deviceType', 'brand', 'model', 'issue', 'accessories'] as const) if (typeof v[k] === 'string') t[k] = str(v[k], 2000)
  if (typeof v.status === 'string' && v.status !== t.status) {
    const next = v.status as TicketStatus
    if (![...TICKET_FLOW, 'cancelled'].includes(next)) throw bad('حالة غير معروفة')
    t.status = next
    t.history.push({ status: next, at: now(), note: str(v.note, 300) || undefined })
  }
  if (t.status === 'delivered') {
    const ref = { kind: 'ticket' as const, id: t.id, number: t.number }
    if (t.finalCost) await ledgerFor(c.db, ref, 'income', t.finalCost, 'صيانة', `صيانة #${t.number} — ${t.brand} ${t.model}`, settings.currency.code)
    if (t.partsCost) await ledgerFor(c.db, ref, 'expense', t.partsCost, 'قطع غيار', `قطع لصيانة #${t.number}`, settings.currency.code)
  }
  t.updatedAt = now()
  await db.ticketInsert(c.db, t).run()
  return t
})
adm('DELETE', '/api/admin/tickets/:id', async c => { await c.db.prepare('DELETE FROM tickets WHERE id = ?').bind(c.params.id).run(); return { ok: true } })

adm('GET', '/api/admin/ledger', async c => db.listLedger(c.db, { from: c.url.searchParams.get('from') || undefined, to: c.url.searchParams.get('to') || undefined, type: c.url.searchParams.get('type') || undefined }))
function sanitizeLedger(v: any, existing?: LedgerEntry, currency = 'USD'): LedgerEntry {
  const type = v.type === 'expense' ? 'expense' : 'income'
  const amount = num(v.amount)
  if (amount <= 0) throw bad('المبلغ مطلوب')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(v.date, 10)) ? str(v.date, 10) : new Date().toISOString().slice(0, 10)
  return { id: existing?.id ?? uid(), type, amount, currency: str(v.currency, 10) || existing?.currency || currency, category: str(v.category, 60) || 'أخرى', note: str(v.note, 500), date, ref: existing?.ref, demo: existing?.demo ?? false, createdAt: existing?.createdAt ?? now() }
}
adm('POST', '/api/admin/ledger', async c => { const s = await db.getSettings(c.db); const l = sanitizeLedger(await c.body(), undefined, s.currency.code); await db.ledgerInsert(c.db, l).run(); return l })
adm('PUT', '/api/admin/ledger/:id', async c => {
  const row = await c.db.prepare('SELECT data FROM ledger WHERE id = ?').bind(c.params.id).first<{ data: string }>()
  if (!row) throw new HttpError(404, 'not found')
  const l = sanitizeLedger(await c.body(), JSON.parse(row.data))
  await db.ledgerInsert(c.db, l).run()
  return l
})
adm('DELETE', '/api/admin/ledger/:id', async c => { await c.db.prepare('DELETE FROM ledger WHERE id = ?').bind(c.params.id).run(); return { ok: true } })

adm('GET', '/api/admin/settings', async c => db.getSettings(c.db))
adm('PUT', '/api/admin/settings', async c => {
  const v = await c.body()
  if (!v || typeof v !== 'object') throw bad('invalid')
  const current = await db.getSettings(c.db)
  const merged = db.mergeSettings({ ...current, ...v, demoCleared: current.demoCleared }) as SiteSettings
  merged.whatsapp = merged.whatsapp.replace(/\D/g, '')
  await db.saveSettings(c.db, merged)
  return merged
})

adm('POST', '/api/admin/images', async c => uploadImage(c))
adm('POST', '/api/admin/demo/clear', async c => { await db.clearDemo(c.db); return { ok: true } })
adm('POST', '/api/admin/demo/restore', async c => { await db.restoreDemo(c.db); return { ok: true } })

adm('GET', '/api/admin/export', async c => {
  const [settings, categories, products, orders, tickets, ledger] = await Promise.all([db.getSettings(c.db), db.listCategories(c.db), db.listProducts(c.db, false), db.listOrders(c.db, { limit: 100000 }), db.listTickets(c.db, { limit: 100000 }), db.listLedger(c.db)])
  return json({ version: 1, exportedAt: now(), settings, categories, products, orders, tickets, ledger }, 200, { ...cors, 'content-disposition': `attachment; filename="sufix-backup-${new Date().toISOString().slice(0, 10)}.json"` })
})
adm('POST', '/api/admin/import', async c => {
  const v = await c.body()
  if (!v || v.version !== 1) throw bad('ملف النسخة الاحتياطية غير صالح')
  const stmts: db.Statement[] = []
  for (const p of arr(v.products, x => x as Product)) stmts.push(db.productInsert(c.db, p))
  for (const o of arr(v.orders, x => x as Order)) stmts.push(db.orderInsert(c.db, o))
  for (const t of arr(v.tickets, x => x as RepairTicket)) stmts.push(db.ticketInsert(c.db, t))
  for (const l of arr(v.ledger, x => x as LedgerEntry)) stmts.push(db.ledgerInsert(c.db, l))
  for (const cat of arr(v.categories, x => x as Category)) stmts.push(c.db.prepare('INSERT OR REPLACE INTO categories (id, data, demo, sort) VALUES (?, ?, ?, ?)').bind(cat.id, JSON.stringify(cat), cat.demo ? 1 : 0, cat.sort))
  for (let i = 0; i < stmts.length; i += 60) await c.db.batch(stmts.slice(i, i + 60))
  if (v.settings) await db.saveSettings(c.db, db.mergeSettings(v.settings))
  return { ok: true, imported: stmts.length }
})

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return handleApi(req, env.DB)
    if (env.ASSETS) return env.ASSETS.fetch(req)
    return new Response('not found', { status: 404 })
  },
}
