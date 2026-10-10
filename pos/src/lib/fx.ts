// USD-anchored pricing with a daily exchange rate (a lira shop whose suppliers quote in dollars).
//
// The model is materialized, not computed on read: `Product.price / cost / wholesalePrice / packs[].price` stay in the
// primary currency and remain what every reader uses. A product may carry anchors in the second currency
// (`fxPrice`, `fxCost`, `fxWholesalePrice`, `packs[].fxPrice`); when the rate changes, `repriceAll()` rewrites the primary
// figures from the anchors in one Dexie transaction. The one invariant: anchored primary fields are written only
// through `derivePrices()` — always from the anchor, never from the old primary figure, so nothing drifts.
//
// One rate (`settings.currency2.rate`, primary units per 1 unit of the second currency) serves pricing and cash in the
// second currency. Every rate write goes through `setExchangeRate()`: reprice → settings → kv 'fx.history' → audit row.
import { db, saveSettings } from '../db'
import type { CurrencySettings, Expense, Product, RateHistoryEntry, Refund, Sale, SecondCurrency, Settings, User } from '../db/types'
import { CURRENCIES, hasFxAnchor } from '../db/types'
import { formatNumber, round, roundToStep } from './money'
import { startOfDay } from './format'
import { logAudit } from './audit'

/** db.kv key: `RateHistoryEntry[]`, newest first, at most FX_HISTORY_CAP rows. */
export const FX_HISTORY_KEY = 'fx.history'
/** db.kv key: 'YYYY-MM-DD' of the day the morning prompt was last shown (or dismissed). */
export const FX_PROMPTED_KEY = 'fx.promptedDay'
export const FX_HISTORY_CAP = 400

/** One amount in the second currency → primary. Selling prices are step-rounded, costs never. */
export function fxToPrimary(fx: number, c2: Pick<SecondCurrency, 'rate' | 'roundTo' | 'roundMode'>, d: number, kind: 'price' | 'cost'): number {
  if (!(c2.rate > 0) || !Number.isFinite(fx)) return 0
  return kind === 'cost' ? round(fx * c2.rate, d) : roundToStep(fx * c2.rate, c2.roundTo, c2.roundMode, d)
}

/**
 * The primary fields a product needs rewritten so they match its anchors at the given rate: `price` from `fxPrice`,
 * `wholesalePrice` from `fxWholesalePrice`, `cost` from `fxCost`, `packs[i].price` from `packs[i].fxPrice` (packs
 * without an anchor are left as they are). Returns only the changed fields plus `repricedAt`, or null when nothing
 * changes (or there is no usable rate). `updatedAt` is never part of it.
 */
export function derivePrices(p: Product, c2: Pick<SecondCurrency, 'rate' | 'roundTo' | 'roundMode'>, d: number, at = Date.now()): Partial<Product> | null {
  if (!(c2.rate > 0)) return null
  const patch: Partial<Product> = {}
  if (typeof p.fxPrice === 'number') {
    const price = fxToPrimary(p.fxPrice, c2, d, 'price')
    if (price !== p.price) patch.price = price
  }
  if (typeof p.fxWholesalePrice === 'number') {
    const w = fxToPrimary(p.fxWholesalePrice, c2, d, 'price')
    if (w !== p.wholesalePrice) patch.wholesalePrice = w
  }
  if (typeof p.fxCost === 'number') {
    const cost = fxToPrimary(p.fxCost, c2, d, 'cost')
    if (cost !== p.cost) patch.cost = cost
  }
  if (p.packs?.some(k => typeof k.fxPrice === 'number')) {
    let changed = false
    const packs = p.packs.map(k => {
      if (typeof k.fxPrice !== 'number') return k
      const price = fxToPrimary(k.fxPrice, c2, d, 'price')
      if (price === k.price) return k
      changed = true
      return { ...k, price }
    })
    if (changed) patch.packs = packs
  }
  if (!Object.keys(patch).length) return null
  patch.repricedAt = at
  return patch
}

/**
 * Rewrites every anchored product's primary prices at the given rate (bulkPut of the changed rows only).
 * Safe inside a caller's transaction that covers db.products; idempotent.
 */
export async function repriceAll(c2: Pick<SecondCurrency, 'rate' | 'roundTo' | 'roundMode'>, d: number, at = Date.now()): Promise<{ anchored: number; changed: number }> {
  const anchored = await db.products.filter(p => hasFxAnchor(p)).toArray()
  const rows: Product[] = []
  for (const p of anchored) {
    const patch = derivePrices(p, c2, d, at)
    if (patch) rows.push({ ...p, ...patch })
  }
  if (rows.length) await db.products.bulkPut(rows)
  return { anchored: anchored.length, changed: rows.length }
}

/** How old the rate is, in local calendar days (Infinity when it was never set). */
export function rateAge(c2: Pick<SecondCurrency, 'rateUpdatedAt'>, now = Date.now()): { days: number; updatedToday: boolean } {
  if (!c2.rateUpdatedAt) return { days: Number.POSITIVE_INFINITY, updatedToday: false }
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(c2.rateUpdatedAt)) / 86400000))
  return { days, updatedToday: days === 0 }
}
/** Too old to trust for pricing (only when products are priced in the second currency). */
export const isRateStale = (c2: Pick<SecondCurrency, 'pricing' | 'staleAfterDays' | 'rateUpdatedAt'>, now = Date.now()): boolean =>
  c2.pricing && c2.staleAfterDays > 0 && rateAge(c2, now).days >= c2.staleAfterDays

/** The rate in force at a moment: the newest history entry at or before it, else the oldest one; undefined without history. */
export function rateAt(history: RateHistoryEntry[], ms: number): number | undefined {
  if (!history.length) return undefined
  const sorted = history.slice().sort((a, b) => b.at - a.at)
  const hit = sorted.find(h => h.at <= ms)
  return (hit ?? sorted[sorted.length - 1]).rate
}

/** The stored rate history, newest first (empty when there is none). */
export async function loadRateHistory(): Promise<RateHistoryEntry[]> {
  const row = await db.kv.get(FX_HISTORY_KEY)
  const v = row?.value
  return Array.isArray(v) ? (v as RateHistoryEntry[]).filter(h => h && typeof h.at === 'number' && typeof h.rate === 'number') : []
}

export interface FxRowsInput { sales: Sale[]; refunds: Refund[]; expenses: Expense[]; extra: Sale[] }
export interface FxRowsRate { rateAt: (ms: number) => number | undefined; current: number; decimals: number }

/**
 * The same rows valued in the second currency: every money field divided by the row's OWN rate (`sale.rate`;
 * `refund.rate`, else its sale's; `expense.rate`). Rows without one use `rateAt(createdAt)`, then `current`, and are
 * counted in `estimated`. Rows for which no rate exists at all are left as they are (and counted). Pure; nothing is written.
 */
export function toFxRows(raw: FxRowsInput, fx: FxRowsRate): { rows: FxRowsInput; estimated: number } {
  const d = fx.decimals
  let estimated = 0
  const fallback = (ms: number): number | undefined => {
    estimated++
    const r = fx.rateAt(ms) ?? fx.current
    return r > 0 ? r : undefined
  }
  const conv = (n: number, rate: number) => round(n / rate, d)
  const convSale = (s: Sale): Sale => {
    const rate = s.rate && s.rate > 0 ? s.rate : fallback(s.createdAt)
    if (!rate) return s
    return {
      ...s,
      subtotal: conv(s.subtotal, rate), discount: conv(s.discount, rate), tax: conv(s.tax, rate), total: conv(s.total, rate),
      cost: conv(s.cost, rate), paid: conv(s.paid, rate), change: conv(s.change, rate), credit: conv(s.credit, rate), refunded: conv(s.refunded, rate),
      payments: s.payments.map(p => ({ ...p, amount: conv(p.amount, rate) })),
      items: s.items.map(i => ({
        ...i, price: conv(i.price, rate), originalPrice: conv(i.originalPrice, rate), cost: conv(i.cost, rate),
        discount: conv(i.discount, rate), tax: conv(i.tax, rate), total: conv(i.total, rate),
      })),
    }
  }
  const sales = raw.sales.map(convSale)
  const extra = raw.extra.map(convSale)
  const parentRate = new Map<string, number | undefined>()
  for (const s of [...raw.sales, ...raw.extra]) parentRate.set(s.id, s.rate && s.rate > 0 ? s.rate : undefined)
  const refunds = raw.refunds.map(f => {
    const rate = f.rate && f.rate > 0 ? f.rate : parentRate.get(f.saleId) ?? fallback(f.createdAt)
    if (!rate) return f
    return { ...f, total: conv(f.total, rate), items: f.items.map(i => ({ ...i, price: conv(i.price, rate), total: conv(i.total, rate) })) }
  })
  const expenses = raw.expenses.map(e => {
    const rate = e.rate && e.rate > 0 ? e.rate : fallback(e.createdAt)
    if (!rate) return e
    return { ...e, amount: conv(e.amount, rate) }
  })
  return { rows: { sales, refunds, expenses, extra }, estimated }
}

/** What the stock is worth in the second currency: Σ stock × (fxCost, else cost ÷ rate) over tracked products in stock. */
export function stockValueFx(products: Pick<Product, 'trackStock' | 'stock' | 'cost' | 'fxCost'>[], c2: Pick<SecondCurrency, 'rate'>): number {
  let sum = 0
  for (const p of products) {
    if (!p.trackStock || !(p.stock > 0)) continue
    const unit = typeof p.fxCost === 'number' ? p.fxCost : c2.rate > 0 ? p.cost / c2.rate : 0
    sum += p.stock * unit
  }
  return round(sum, 2)
}

/** The currency a stored `rateCode` refers to: the configured second currency when the code matches, else the catalog. */
export function currencyForCode(code: string | undefined, settings: Pick<Settings, 'currency2'>): CurrencySettings {
  const c2 = settings.currency2
  if (!code || code === c2.code) return { code: c2.code, symbol: c2.symbol, decimals: c2.decimals, symbolAfter: c2.symbolAfter }
  return CURRENCIES.find(c => c.code === code) ?? { code, symbol: code, decimals: 2, symbolAfter: false }
}

/** The rate as people write it: 13,000 or 1.0825 (4 decimals when the primary currency has decimals). */
export function formatRate(rate: number, settings: Pick<Settings, 'currency'>): string {
  return formatNumber(rate, settings.currency.decimals > 0 ? 4 : 0, { trim: true })
}

/**
 * THE way the exchange rate changes. Rounds the rate (4 decimals when the primary currency has decimals, else 2),
 * refuses anything that is not > 0 (`Error('fx.err.rate')`), then in ONE transaction over products + kv: reprices every
 * anchored product (only while currency2 is enabled and pricing is on), saves the settings with the new rate and who set
 * it, and prepends a history entry. After the commit an audit row 'rate.change' is written. Re-entering the same rate
 * writes no products but still refreshes `rateUpdatedAt` (confirms the rate, clears staleness) and the history.
 */
export async function setExchangeRate(o: { rate: number; settings: Settings; user: User | null; source: RateHistoryEntry['source'] }): Promise<{ settings: Settings; repriced: number; prev: number }> {
  const { settings, user, source } = o
  const rate = round(o.rate, settings.currency.decimals > 0 ? 4 : 2)
  if (!(rate > 0)) throw new Error('fx.err.rate')
  const c2 = settings.currency2
  const prev = c2.rate
  const at = Date.now()
  const next: Settings = { ...settings, currency2: { ...c2, rate, rateUpdatedAt: at, rateUpdatedBy: user?.name } }
  let repriced = 0
  await db.transaction('rw', db.products, db.kv, async () => {
    if (c2.enabled && c2.pricing) repriced = (await repriceAll(next.currency2, settings.currency.decimals, at)).changed
    await saveSettings(next)
    const history = await loadRateHistory()
    const entry: RateHistoryEntry = { at, rate, prev, repriced, userId: user?.id, userName: user?.name, source }
    await db.kv.put({ key: FX_HISTORY_KEY, value: [entry, ...history].slice(0, FX_HISTORY_CAP) })
  })
  const pct = prev > 0 ? round(((rate - prev) / prev) * 100, 1) : 0
  const fmt = (n: number) => formatRate(n, settings)
  await logAudit({ kind: 'rate.change', detail: `${c2.code}: ${fmt(prev)} → ${fmt(rate)} (${pct > 0 ? '+' : ''}${pct}%) · ${repriced}`, amount: rate, user: user ? { id: user.id, name: user.name } : null })
  return { settings: next, repriced, prev }
}
