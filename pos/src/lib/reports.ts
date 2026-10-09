// Report aggregation for the reports screen. Pure, single-pass functions over the sales, refunds and
// expenses of a period (the screen loads them once), so 50k receipts stay fast: Map lookups only, no DB.
//
// Profit, the way the owner reads it:
//   gross profit = Σ (sale.total − sale.cost) − Σ over refunds (refund.total − cost of the refunded units)
//   The cost of the refunded units is the sale's item cost × refunded qty: the sale is found by refund.saleId
//   among the period's sales, then in `opts.salesById` (sales the screen fetched because the refund belongs to
//   an older receipt). When the sale cannot be found the whole refund counts against profit.
//   net profit = gross profit − expenses
// Revenue per product / category / cashier is each line's share of what the customer paid (item.total scaled
// by sale.total / sale.subtotal), so the per-product numbers add up to the gross sales tile.
import type { Sale, SaleItem, Refund, Expense, Product, Category, PaymentMethod } from '../db/types'
import { round } from './money'
import { startOfDay, startOfMonth, addDays, addMonths, daysBetween } from './format'

export const METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'credit']

export interface ReportOptions {
  decimals?: number
  /** Sales outside the period that refunds of the period point to (for the refunded-cost estimate). */
  salesById?: Map<string, Sale>
}

export interface ReportSummary {
  gross: number          // Σ sale.total
  count: number
  avg: number            // gross / count
  items: number          // Σ qty sold
  discount: number       // Σ sale-level discounts
  tax: number
  refunds: number        // Σ refund.total
  refundCount: number
  net: number            // gross − refunds
  cost: number           // Σ sale.cost
  profit: number         // see the header
  expenses: number
  expenseCount: number
  netProfit: number      // profit − expenses
  credit: number         // Σ sale.credit (new debt)
}

/** The sale line a refunded item came from: same product, name and pack size; then same product and name; then the same product. */
export function matchSaleItem(sale: Sale, ri: Refund['items'][number]): SaleItem | undefined {
  const pid = ri.productId ?? ''
  const units = ri.unitsPerQty ?? 1
  const sameUnits = (x: SaleItem) => (x.unitsPerQty ?? 1) === units
  return sale.items.find(x => (x.productId ?? '') === pid && x.name === ri.name && sameUnits(x))
    ?? sale.items.find(x => (x.productId ?? '') === pid && x.name === ri.name)
    ?? (ri.productId ? sale.items.find(x => x.productId === ri.productId && sameUnits(x)) ?? sale.items.find(x => x.productId === ri.productId) : undefined)
}

/** What the refunded units had cost us (the sale line's cost per base unit × refunded base units); 0 when the sale is unknown. */
export function refundCost(refund: Refund, sale: Sale | undefined, decimals = 2): number {
  if (!sale) return 0
  let cost = 0
  for (const ri of refund.items) {
    const it = matchSaleItem(sale, ri)
    if (it) cost += (it.cost / (it.unitsPerQty ?? 1)) * ri.qty * (ri.unitsPerQty ?? 1)
  }
  return round(cost, decimals)
}

function saleFinder(sales: Sale[], opts: ReportOptions): (id: string) => Sale | undefined {
  const byId = new Map<string, Sale>()
  for (const s of sales) byId.set(s.id, s)
  return id => byId.get(id) ?? opts.salesById?.get(id)
}

/** The tile numbers of a period. */
export function summarize(sales: Sale[], refunds: Refund[], expenses: Expense[], opts: ReportOptions = {}): ReportSummary {
  const d = opts.decimals ?? 2
  const r = (n: number) => round(n, d)
  const byId = new Map<string, Sale>()
  let gross = 0, cost = 0, credit = 0, discount = 0, tax = 0, items = 0
  for (const s of sales) {
    byId.set(s.id, s)
    gross += s.total; cost += s.cost; credit += s.credit; discount += s.discount; tax += s.tax
    for (const it of s.items) items += it.qty * (it.unitsPerQty ?? 1)
  }
  let refundTotal = 0, refundMargin = 0
  for (const f of refunds) {
    refundTotal += f.total
    refundMargin += f.total - refundCost(f, byId.get(f.saleId) ?? opts.salesById?.get(f.saleId), d)
  }
  let exp = 0
  for (const e of expenses) exp += e.amount
  const profit = r(gross - cost - refundMargin)
  return {
    gross: r(gross), count: sales.length, avg: sales.length ? r(gross / sales.length) : 0, items: round(items, 3),
    discount: r(discount), tax: r(tax),
    refunds: r(refundTotal), refundCount: refunds.length, net: r(gross - refundTotal),
    cost: r(cost), profit,
    expenses: r(exp), expenseCount: expenses.length, netProfit: r(profit - exp),
    credit: r(credit),
  }
}

/* ---------- time buckets ---------- */

export interface DayBucket { day: number; total: number; count: number; refunds: number }
export interface MonthBucket { month: number; total: number; count: number; refunds: number }
export interface HourBucket { hour: number; total: number; count: number; refunds: number }

const MAX_BUCKETS = 5000

/** One entry per local calendar day from `from` to `to` (inclusive), in order. Rows outside the range are ignored. */
export function bucketByDay(sales: Sale[], refunds: Refund[], from: number, to: number, decimals = 2): DayBucket[] {
  const out: DayBucket[] = []
  const idx = new Map<number, number>()
  const end = startOfDay(to)
  for (let day = startOfDay(from); day <= end && out.length < MAX_BUCKETS; day = addDays(day, 1)) { idx.set(day, out.length); out.push({ day, total: 0, count: 0, refunds: 0 }) }
  for (const s of sales) { const i = idx.get(startOfDay(s.createdAt)); if (i !== undefined) { out[i].total += s.total; out[i].count++ } }
  for (const f of refunds) { const i = idx.get(startOfDay(f.createdAt)); if (i !== undefined) out[i].refunds += f.total }
  for (const b of out) { b.total = round(b.total, decimals); b.refunds = round(b.refunds, decimals) }
  return out
}

/** One entry per calendar month touching the range, in order (for long periods, where days would be too many). */
export function bucketByMonth(sales: Sale[], refunds: Refund[], from: number, to: number, decimals = 2): MonthBucket[] {
  const out: MonthBucket[] = []
  const idx = new Map<number, number>()
  const end = startOfMonth(to)
  for (let m = startOfMonth(from); m <= end && out.length < MAX_BUCKETS; m = addMonths(m, 1)) { idx.set(m, out.length); out.push({ month: m, total: 0, count: 0, refunds: 0 }) }
  for (const s of sales) { const i = idx.get(startOfMonth(s.createdAt)); if (i !== undefined) { out[i].total += s.total; out[i].count++ } }
  for (const f of refunds) { const i = idx.get(startOfMonth(f.createdAt)); if (i !== undefined) out[i].refunds += f.total }
  for (const b of out) { b.total = round(b.total, decimals); b.refunds = round(b.refunds, decimals) }
  return out
}

/** 24 entries, hour 0..23 of the local day. */
export function bucketByHour(sales: Sale[], refunds: Refund[] = [], decimals = 2): HourBucket[] {
  const out: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, count: 0, refunds: 0 }))
  for (const s of sales) { const b = out[new Date(s.createdAt).getHours()]; b.total += s.total; b.count++ }
  for (const f of refunds) out[new Date(f.createdAt).getHours()].refunds += f.total
  for (const b of out) { b.total = round(b.total, decimals); b.refunds = round(b.refunds, decimals) }
  return out
}

/* ---------- breakdowns ---------- */

export interface ProductStat {
  productId?: string
  name: string
  qty: number
  revenue: number
  cost: number
  profit: number        // revenue − cost − (refunded − cost of the refunded units)
  refundedQty: number
  refunded: number
  share: number         // of the period's revenue, 0..1
}

const productKey = (productId: string | undefined, name: string): string => productId ?? 'name:' + name

/** Best sellers by revenue. Custom (typed) lines are grouped by name. */
export function topProducts(sales: Sale[], refunds: Refund[], n = 20, opts: ReportOptions = {}): ProductStat[] {
  const d = opts.decimals ?? 2
  type Acc = { productId?: string; name: string; qty: number; revenue: number; cost: number; refundedQty: number; refunded: number; refundedCost: number }
  const acc = new Map<string, Acc>()
  const get = (productId: string | undefined, name: string): Acc => {
    const key = productKey(productId, name)
    let a = acc.get(key)
    if (!a) { a = { productId, name, qty: 0, revenue: 0, cost: 0, refundedQty: 0, refunded: 0, refundedCost: 0 }; acc.set(key, a) }
    return a
  }
  const find = saleFinder(sales, opts)
  for (const s of sales) {
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1
    for (const it of s.items) {
      const a = get(it.productId, it.name)
      a.qty += it.qty * (it.unitsPerQty ?? 1); a.revenue += it.total * ratio; a.cost += it.cost * it.qty
      if (it.productId) a.name = it.name   // the latest name wins
    }
  }
  for (const f of refunds) {
    const sale = find(f.saleId)
    for (const ri of f.items) {
      const a = get(ri.productId, ri.name)
      const units = ri.unitsPerQty ?? 1
      a.refundedQty += ri.qty * units; a.refunded += ri.total
      const it = sale ? matchSaleItem(sale, ri) : undefined
      const unitCost = it ? it.cost / (it.unitsPerQty ?? 1) : a.qty > 0 ? a.cost / a.qty : 0
      a.refundedCost += unitCost * ri.qty * units
    }
  }
  let sum = 0
  for (const a of acc.values()) sum += a.revenue
  const list: ProductStat[] = []
  for (const a of acc.values()) {
    list.push({
      productId: a.productId, name: a.name, qty: round(a.qty, 3), revenue: round(a.revenue, d), cost: round(a.cost, d),
      profit: round(a.revenue - a.cost - (a.refunded - a.refundedCost), d), refundedQty: round(a.refundedQty, 3), refunded: round(a.refunded, d),
      share: sum > 0 ? a.revenue / sum : 0,
    })
  }
  list.sort((x, y) => y.revenue - x.revenue || y.qty - x.qty || x.name.localeCompare(y.name))
  return list.slice(0, n)
}

export interface CategoryStat { categoryId?: string; name: string; color?: string; qty: number; revenue: number; cost: number; profit: number; share: number }

/** Sales by product category. Lines without a product, or whose product has no category, land in the unnamed group (name ''). */
export function byCategory(sales: Sale[], products: Pick<Product, 'id' | 'categoryId'>[], categories: Pick<Category, 'id' | 'name' | 'color'>[], opts: ReportOptions = {}): CategoryStat[] {
  const d = opts.decimals ?? 2
  const productCat = new Map<string, string | undefined>()
  for (const p of products) productCat.set(p.id, p.categoryId)
  const cats = new Map<string, Pick<Category, 'id' | 'name' | 'color'>>()
  for (const c of categories) cats.set(c.id, c)
  type Acc = { categoryId?: string; qty: number; revenue: number; cost: number }
  const acc = new Map<string, Acc>()
  for (const s of sales) {
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1
    for (const it of s.items) {
      const cid = it.productId ? productCat.get(it.productId) : undefined
      const key = cid && cats.has(cid) ? cid : ''
      let a = acc.get(key)
      if (!a) { a = { categoryId: key || undefined, qty: 0, revenue: 0, cost: 0 }; acc.set(key, a) }
      a.qty += it.qty * (it.unitsPerQty ?? 1); a.revenue += it.total * ratio; a.cost += it.cost * it.qty
    }
  }
  let sum = 0
  for (const a of acc.values()) sum += a.revenue
  const list: CategoryStat[] = []
  for (const a of acc.values()) {
    const c = a.categoryId ? cats.get(a.categoryId) : undefined
    list.push({ categoryId: a.categoryId, name: c?.name ?? '', color: c?.color, qty: round(a.qty, 3), revenue: round(a.revenue, d), cost: round(a.cost, d), profit: round(a.revenue - a.cost, d), share: sum > 0 ? a.revenue / sum : 0 })
  }
  return list.sort((x, y) => y.revenue - x.revenue || x.name.localeCompare(y.name))
}

export interface CashierStat { userId: string; name: string; count: number; total: number; avg: number; refundCount: number; refunds: number; net: number; share: number }

/** Receipts and refunds per user (the refund counts for whoever processed it). */
export function byCashier(sales: Sale[], refunds: Refund[], opts: ReportOptions = {}): CashierStat[] {
  const d = opts.decimals ?? 2
  type Acc = { userId: string; name: string; count: number; total: number; refundCount: number; refunds: number }
  const acc = new Map<string, Acc>()
  const get = (userId: string, name: string): Acc => {
    let a = acc.get(userId)
    if (!a) { a = { userId, name, count: 0, total: 0, refundCount: 0, refunds: 0 }; acc.set(userId, a) }
    if (name) a.name = name
    return a
  }
  let sum = 0
  for (const s of sales) { const a = get(s.userId, s.userName); a.count++; a.total += s.total; sum += s.total }
  for (const f of refunds) { const a = get(f.userId, f.userName); a.refundCount++; a.refunds += f.total }
  return [...acc.values()]
    .map(a => ({ userId: a.userId, name: a.name, count: a.count, total: round(a.total, d), avg: a.count ? round(a.total / a.count, d) : 0, refundCount: a.refundCount, refunds: round(a.refunds, d), net: round(a.total - a.refunds, d), share: sum > 0 ? a.total / sum : 0 }))
    .sort((x, y) => y.total - x.total || y.count - x.count || x.name.localeCompare(y.name))
}

export interface MethodStat { method: PaymentMethod; amount: number; count: number; refunds: number; refundCount: number; net: number; share: number }

/** What came in per payment method (always the four methods, in a fixed order). `count` = receipts that used the method. */
export function byMethod(sales: Sale[], refunds: Refund[], opts: ReportOptions = {}): MethodStat[] {
  const d = opts.decimals ?? 2
  const amount: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 }
  const count: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 }
  const refAmount: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 }
  const refCount: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 }
  for (const s of sales) {
    let creditSeen = false
    const used = new Set<PaymentMethod>()
    for (const p of s.payments) {
      if (!(p.amount > 0) || !(p.method in amount)) continue
      amount[p.method] += p.amount
      used.add(p.method)
      if (p.method === 'credit') creditSeen = true
    }
    if (s.credit > 0 && !creditSeen) { amount.credit += s.credit; used.add('credit') }
    for (const m of used) count[m]++
  }
  for (const f of refunds) { if (f.method in refAmount) { refAmount[f.method] += f.total; refCount[f.method]++ } }
  const sum = METHODS.reduce((s, m) => s + amount[m], 0)
  return METHODS.map(m => ({ method: m, amount: round(amount[m], d), count: count[m], refunds: round(refAmount[m], d), refundCount: refCount[m], net: round(amount[m] - refAmount[m], d), share: sum > 0 ? amount[m] / sum : 0 }))
}

export interface CustomerStat { customerId: string; name: string; count: number; total: number; credit: number; avg: number; share: number }

/** Receipts with a customer on them, best customer first. */
export function byCustomer(sales: Sale[], opts: ReportOptions = {}): CustomerStat[] {
  const d = opts.decimals ?? 2
  type Acc = { customerId: string; name: string; count: number; total: number; credit: number }
  const acc = new Map<string, Acc>()
  let sum = 0
  for (const s of sales) {
    if (!s.customerId) continue
    let a = acc.get(s.customerId)
    if (!a) { a = { customerId: s.customerId, name: s.customerName ?? '', count: 0, total: 0, credit: 0 }; acc.set(s.customerId, a) }
    if (s.customerName) a.name = s.customerName
    a.count++; a.total += s.total; a.credit += s.credit; sum += s.total
  }
  return [...acc.values()]
    .map(a => ({ customerId: a.customerId, name: a.name, count: a.count, total: round(a.total, d), credit: round(a.credit, d), avg: a.count ? round(a.total / a.count, d) : 0, share: sum > 0 ? a.total / sum : 0 }))
    .sort((x, y) => y.total - x.total || y.count - x.count || x.name.localeCompare(y.name))
}

export type PeakMetric = 'count' | 'total'
/** A 7 × 24 matrix: rows are weekdays as Date.getDay() (0 = Sunday), columns are hours; receipts or money. */
export function peakHours(sales: Sale[], metric: PeakMetric = 'count', decimals = 2): number[][] {
  const m: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const s of sales) {
    const dt = new Date(s.createdAt)
    m[dt.getDay()][dt.getHours()] += metric === 'count' ? 1 : s.total
  }
  if (metric === 'total') for (const row of m) for (let h = 0; h < 24; h++) row[h] = round(row[h], decimals)
  return m
}

export interface ExpenseCategoryStat { category: string; total: number; count: number; share: number }

/** Expenses per category, largest first. The category is the stored key or text ('' becomes 'other'). */
export function expensesByCategory(expenses: Expense[], decimals = 2): ExpenseCategoryStat[] {
  const acc = new Map<string, { total: number; count: number }>()
  let sum = 0
  for (const e of expenses) {
    const key = e.category.trim() || 'other'
    const a = acc.get(key) ?? { total: 0, count: 0 }
    a.total += e.amount; a.count++; sum += e.amount
    acc.set(key, a)
  }
  return [...acc.entries()]
    .map(([category, a]) => ({ category, total: round(a.total, decimals), count: a.count, share: sum > 0 ? a.total / sum : 0 }))
    .sort((x, y) => y.total - x.total || x.category.localeCompare(y.category))
}

/** Active, stock-tracked products that ran out or fell to their low-stock level; the emptiest first. */
export function lowStockProducts<P extends Pick<Product, 'active' | 'trackStock' | 'stock' | 'lowStock'>>(products: P[]): P[] {
  return products
    .filter(p => p.active && p.trackStock && (p.stock <= 0 || (p.lowStock > 0 && p.stock <= p.lowStock)))
    .sort((a, b) => a.stock - b.stock || b.lowStock - a.lowStock)
}

/* ---------- small helpers for the screen ---------- */

/** 1234 → "1.2k", 12345 → "12.3k", 123456 → "123k", 1234567 → "1.2M", 999 → "999". */
export function shortNumber(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const scaled = (v: number, suffix: string) => sign + String(v < 100 ? round(v, 1) : Math.round(v)) + suffix
  if (abs < 1000) {
    const v = abs < 10 ? round(abs, 1) : Math.round(abs)
    if (v < 1000) return sign + String(v)
  }
  if (abs < 1e6) return scaled(abs / 1e3, 'k')
  if (abs < 1e9) return scaled(abs / 1e6, 'M')
  return scaled(abs / 1e9, 'B')
}

/** A round gridline step so `steps` lines cover `max` without much headroom (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ). */
export function niceStep(max: number, steps = 4): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1
  const raw = max / steps
  const mag = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    const step = round(m * mag, 6)
    if (step >= raw) return step
  }
  return round(10 * mag, 6)
}

export interface Range { from: number; to: number }
/** The same number of whole days, right before the range. */
export function previousPeriod(r: Range): Range {
  const days = daysBetween(r.from, r.to) + 1
  const start = startOfDay(r.from)
  return { from: addDays(start, -days), to: start - 1 }
}

export interface Delta { diff: number; pct: number | null }
/** The change from the previous period; pct is null when there was nothing to compare with. */
export function delta(cur: number, prev: number, decimals = 2): Delta {
  const diff = round(cur - prev, decimals)
  return { diff, pct: prev !== 0 ? (cur - prev) / Math.abs(prev) : null }
}

/** The payment methods used on a receipt, in order, without repeats. */
export function saleMethods(sale: Sale): PaymentMethod[] {
  const out: PaymentMethod[] = []
  for (const p of sale.payments) if (p.amount > 0 && !out.includes(p.method)) out.push(p.method)
  if (sale.credit > 0 && !out.includes('credit')) out.push('credit')
  if (!out.length) out.push('cash')
  return out
}
