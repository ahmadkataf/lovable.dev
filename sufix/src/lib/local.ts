// The offline preview: the same features backed by localStorage, used when no API is reachable (a static host).
import type { Category, LedgerEntry, Order, Product, RepairTicket, SiteSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { DJI_DRONES } from '@shared/dji'
import { buildDemo } from '@shared/demo'
import { computeDashboard, computeReports, dayOf } from '@shared/stats'
import type { Backend, Backup } from './backend'

type Db = { settings: SiteSettings; categories: Category[]; products: Product[]; orders: Order[]; tickets: RepairTicket[]; ledger: LedgerEntry[]; password?: string; authed: boolean; images: Record<string, string> }
const KEY = 'sufix_local_db'
let cache: Db | null = null

function load(): Db {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return (cache = JSON.parse(raw))
  } catch { /* fall through */ }
  const demo = buildDemo()
  cache = { settings: DEFAULT_SETTINGS, ...demo, authed: false, images: {} }
  save()
  return cache
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* quota */ } }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const normPhone = (p: string) => p.replace(/\D/g, '').replace(/^(00)?963/, '').replace(/^0/, '')
const fail = (m: string) => { throw new Error(m) }
const auth = () => { if (!load().authed) fail('unauthorized') }

function ledgerFor(db: Db, ref: LedgerEntry['ref'], type: LedgerEntry['type'], amount: number, category: string, note: string) {
  if (!ref || amount <= 0 || db.ledger.some(l => l.ref?.id === ref.id && l.type === type)) return
  db.ledger.push({ id: uid(), type, amount, currency: db.settings.currency.code, category, note, date: dayOf(Date.now()), ref, createdAt: Date.now() })
}

export const local: Backend = {
  async bootstrap() { const db = load(); return clone({ settings: db.settings, categories: db.categories, products: db.products.filter(p => p.active), drones: DJI_DRONES }) },
  async product(id) { const p = load().products.find(p => p.id === id && p.active); return p ? clone(p) : fail('not found') },
  async createOrder(o) {
    const db = load()
    const items = o.items.map(it => { const p = db.products.find(p => p.id === it.productId); return p ? { productId: p.id, name: p.name, price: p.price, qty: Math.max(1, it.qty), image: p.images[0], illustration: p.illustration } : null }).filter((x): x is NonNullable<typeof x> => !!x)
    if (!items.length) fail('السلة فارغة')
    if (normPhone(o.customer.phone).length < 7) fail('رقم الهاتف غير صحيح')
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const zone = db.settings.shipping.zones.find(z => z.name === o.zone)
    const shipping = db.settings.shipping.freeAbove && subtotal >= db.settings.shipping.freeAbove ? 0 : zone?.fee ?? 0
    const t = Date.now()
    const order: Order = { id: uid(), number: Math.max(1001, ...db.orders.map(x => x.number + 1)), customer: o.customer, items, subtotal, shipping, total: subtotal + shipping, currency: db.settings.currency.code, status: 'new', whatsappSent: false, history: [{ status: 'new', at: t }], createdAt: t, updatedAt: t }
    db.orders.push(order); save()
    return clone(order)
  },
  async orderWhatsapp(id) { const o = load().orders.find(o => o.id === id); if (o) { o.whatsappSent = true; save() } },
  async createTicket(tk) {
    const db = load()
    if (normPhone(tk.customer.phone).length < 7) fail('رقم الهاتف غير صحيح')
    const t = Date.now()
    const ticket: RepairTicket = { id: uid(), number: Math.max(501, ...db.tickets.map(x => x.number + 1)), customer: tk.customer, deviceType: tk.deviceType, brand: tk.brand, model: tk.model, issue: tk.issue, accessories: tk.accessories, photos: tk.photos ?? [], status: 'received', estimate: tk.estimate, whatsappSent: false, history: [{ status: 'received', at: t }], createdAt: t, updatedAt: t }
    db.tickets.push(ticket); save()
    return clone(ticket)
  },
  async ticketWhatsapp(id) { const t = load().tickets.find(t => t.id === id); if (t) { t.whatsappSent = true; save() } },
  async track(number, phone) {
    const db = load(), n = parseInt(number, 10), p = normPhone(phone)
    const o = db.orders.find(o => o.number === n && normPhone(o.customer.phone) === p)
    if (o) return { kind: 'order', order: clone(o) }
    const t = db.tickets.find(t => t.number === n && normPhone(t.customer.phone) === p)
    if (t) return { kind: 'ticket', ticket: clone(t) }
    return fail('لم نجد طلباً بهذا الرقم والهاتف')
  },
  async uploadImage(dataUrl) { return dataUrl },
  admin: {
    async status() { const db = load(); return { setup: !db.password, authed: db.authed } },
    async setup(password) { const db = load(); if (db.password) fail('معيّنة مسبقاً'); if (password.length < 6) fail('كلمة المرور 6 أحرف على الأقل'); db.password = password; db.authed = true; save() },
    async login(password) { const db = load(); if (db.password !== password) fail('كلمة المرور غير صحيحة'); db.authed = true; save() },
    async logout() { load().authed = false; save() },
    async changePassword(current, password) { const db = load(); if (db.password !== current) fail('كلمة المرور الحالية غير صحيحة'); db.password = password; save() },
    async dashboard() { auth(); const db = load(); return clone(computeDashboard(db.orders, db.tickets, db.products, db.ledger)) },
    async reports(from, to) { auth(); const db = load(); return clone(computeReports(db.orders, db.tickets, db.ledger, from, to)) },
    async products() { auth(); return clone([...load().products].sort((a, b) => b.createdAt - a.createdAt)) },
    async saveProduct(p) {
      auth(); const db = load(); const t = Date.now()
      const i = db.products.findIndex(x => x.id === p.id)
      const base: Product = i >= 0 ? db.products[i] : { id: uid(), name: '', brand: 'DJI', category: '', compatible: [], price: 0, stock: 0, short: '', description: '', specs: [], images: [], illustration: 'box', featured: false, active: true, tags: [], createdAt: t, updatedAt: t }
      const next = { ...base, ...p, id: base.id, demo: base.demo, createdAt: base.createdAt, updatedAt: t } as Product
      if (i >= 0) db.products[i] = next; else db.products.unshift(next)
      save(); return clone(next)
    },
    async deleteProduct(id) { auth(); const db = load(); db.products = db.products.filter(p => p.id !== id); save() },
    async categories() { auth(); return clone(load().categories) },
    async saveCategories(list) { auth(); const db = load(); db.categories = list.map((c, i) => ({ ...c, id: c.id || uid(), sort: i })); save(); return clone(db.categories) },
    async orders(q, status) {
      auth(); let list = [...load().orders].sort((a, b) => b.createdAt - a.createdAt)
      if (status) list = list.filter(o => o.status === status)
      if (q) { const s = q.trim(), d = normPhone(s); list = list.filter(o => o.customer.name.includes(s) || String(o.number).includes(s.replace(/\D/g, '')) || (d && normPhone(o.customer.phone).includes(d))) }
      return clone(list)
    },
    async updateOrder(id, patch) {
      auth(); const db = load(); const o = db.orders.find(o => o.id === id) as (Order & { stockApplied?: boolean }) | undefined
      if (!o) fail('not found')
      const ord = o!
      if (typeof patch.status === 'string' && patch.status !== ord.status) {
        const next = patch.status as Order['status']
        const counted = ['confirmed', 'processing', 'shipped', 'delivered'].includes(next)
        if (counted && !ord.stockApplied) { for (const it of ord.items) { const p = db.products.find(p => p.id === it.productId); if (p) p.stock = Math.max(0, p.stock - it.qty) } ord.stockApplied = true }
        else if (next === 'cancelled' && ord.stockApplied) { for (const it of ord.items) { const p = db.products.find(p => p.id === it.productId); if (p) p.stock += it.qty } ord.stockApplied = false }
        ord.status = next; ord.history.push({ status: next, at: Date.now(), note: (patch.note as string) || undefined })
        if (next === 'delivered') ledgerFor(db, { kind: 'order', id: ord.id, number: ord.number }, 'income', ord.total, 'مبيعات', `طلب #${ord.number} — ${ord.customer.name}`)
      }
      if (typeof patch.adminNotes === 'string') ord.adminNotes = patch.adminNotes
      if (patch.customer && typeof patch.customer === 'object') ord.customer = { ...ord.customer, ...(patch.customer as object) }
      if (typeof patch.shipping === 'number') { ord.shipping = patch.shipping; ord.total = ord.subtotal + ord.shipping }
      ord.updatedAt = Date.now(); save(); return clone(ord)
    },
    async deleteOrder(id) { auth(); const db = load(); db.orders = db.orders.filter(o => o.id !== id); save() },
    async tickets(q, status) {
      auth(); let list = [...load().tickets].sort((a, b) => b.createdAt - a.createdAt)
      if (status) list = list.filter(t => t.status === status)
      if (q) { const s = q.trim(), d = normPhone(s); list = list.filter(t => t.customer.name.includes(s) || t.model.includes(s) || String(t.number).includes(s.replace(/\D/g, '')) || (d && normPhone(t.customer.phone).includes(d))) }
      return clone(list)
    },
    async createTicket(tk) { auth(); return local.createTicket(tk) },
    async updateTicket(id, patch) {
      auth(); const db = load(); const t = db.tickets.find(t => t.id === id)
      if (!t) fail('not found')
      const tk = t!
      for (const k of ['estimate', 'finalCost', 'partsCost'] as const) if (patch[k] !== undefined) tk[k] = Number(patch[k]) || undefined
      if (typeof patch.technicianNotes === 'string') tk.technicianNotes = patch.technicianNotes
      if (patch.customer && typeof patch.customer === 'object') tk.customer = { ...tk.customer, ...(patch.customer as object) }
      for (const k of ['deviceType', 'brand', 'model', 'issue', 'accessories'] as const) if (typeof patch[k] === 'string') tk[k] = patch[k] as string
      if (typeof patch.status === 'string' && patch.status !== tk.status) { tk.status = patch.status as RepairTicket['status']; tk.history.push({ status: tk.status, at: Date.now(), note: (patch.note as string) || undefined }) }
      if (tk.status === 'delivered') {
        const ref = { kind: 'ticket' as const, id: tk.id, number: tk.number }
        if (tk.finalCost) ledgerFor(db, ref, 'income', tk.finalCost, 'صيانة', `صيانة #${tk.number} — ${tk.brand} ${tk.model}`)
        if (tk.partsCost) ledgerFor(db, ref, 'expense', tk.partsCost, 'قطع غيار', `قطع لصيانة #${tk.number}`)
      }
      tk.updatedAt = Date.now(); save(); return clone(tk)
    },
    async deleteTicket(id) { auth(); const db = load(); db.tickets = db.tickets.filter(t => t.id !== id); save() },
    async ledger(from, to, type) {
      auth(); let list = [...load().ledger].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      if (from) list = list.filter(l => l.date >= from)
      if (to) list = list.filter(l => l.date <= to)
      if (type) list = list.filter(l => l.type === type)
      return clone(list)
    },
    async saveLedger(e) {
      auth(); const db = load(); const i = db.ledger.findIndex(l => l.id === e.id)
      const base: LedgerEntry = i >= 0 ? db.ledger[i] : { id: uid(), type: 'income', amount: 0, currency: db.settings.currency.code, category: 'أخرى', note: '', date: dayOf(Date.now()), createdAt: Date.now() }
      const next = { ...base, ...e, id: base.id, ref: base.ref, demo: base.demo, createdAt: base.createdAt } as LedgerEntry
      if (!(next.amount > 0)) fail('المبلغ مطلوب')
      if (i >= 0) db.ledger[i] = next; else db.ledger.push(next)
      save(); return clone(next)
    },
    async deleteLedger(id) { auth(); const db = load(); db.ledger = db.ledger.filter(l => l.id !== id); save() },
    async settings() { auth(); return clone(load().settings) },
    async saveSettings(s) { auth(); const db = load(); db.settings = { ...db.settings, ...s, demoCleared: db.settings.demoCleared }; save(); return clone(db.settings) },
    async clearDemo() {
      auth(); const db = load()
      db.products = db.products.filter(p => !p.demo); db.categories = db.categories.filter(c => !c.demo); db.orders = db.orders.filter(o => !o.demo); db.tickets = db.tickets.filter(t => !t.demo); db.ledger = db.ledger.filter(l => !l.demo)
      db.settings.demoCleared = true; save()
    },
    async restoreDemo() {
      auth(); const db = load(); const demo = buildDemo()
      const merge = <T extends { id: string }>(cur: T[], add: T[]) => [...cur.filter(x => !add.some(a => a.id === x.id)), ...add]
      db.products = merge(db.products, demo.products); db.categories = merge(db.categories, demo.categories); db.orders = merge(db.orders, demo.orders); db.tickets = merge(db.tickets, demo.tickets); db.ledger = merge(db.ledger, demo.ledger)
      db.settings.demoCleared = false; save()
    },
    async exportAll() { auth(); const db = load(); return clone({ version: 1 as const, exportedAt: Date.now(), settings: db.settings, categories: db.categories, products: db.products, orders: db.orders, tickets: db.tickets, ledger: db.ledger }) },
    async importAll(b: Backup) {
      auth(); const db = load()
      const merge = <T extends { id: string }>(cur: T[], add: T[] = []) => [...cur.filter(x => !add.some(a => a.id === x.id)), ...add]
      db.products = merge(db.products, b.products); db.categories = merge(db.categories, b.categories); db.orders = merge(db.orders, b.orders); db.tickets = merge(db.tickets, b.tickets); db.ledger = merge(db.ledger, b.ledger)
      if (b.settings) db.settings = { ...db.settings, ...b.settings }
      save()
    },
  },
}
