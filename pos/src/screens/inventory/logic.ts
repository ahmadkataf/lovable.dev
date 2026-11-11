// Pure inventory logic: filters, stock status, stock value, stock-take arithmetic. Tested in logic.test.ts.
import { isExpiring } from '../../db/types'
import type { CurrencySettings, Product, PurchaseFx } from '../../db/types'
import { round } from '../../lib/money'

export type StockStatus = 'untracked' | 'out' | 'low' | 'ok'
export type StockFilter = 'all' | 'low' | 'out' | 'untracked' | 'expiring'
export type StockSort = 'name' | 'lowest' | 'value'

export function stockStatus(p: Pick<Product, 'trackStock' | 'stock' | 'lowStock'>): StockStatus {
  if (!p.trackStock) return 'untracked'
  if (p.stock <= 0) return 'out'
  if (p.lowStock > 0 && p.stock <= p.lowStock) return 'low'
  return 'ok'
}

/** Search text the way people type it: trimmed, lower-case, Arabic letter variants folded. */
export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْ]/g, '')
}

export function matchesProduct(p: Pick<Product, 'name' | 'barcodes' | 'sku'>, q: string): boolean {
  const s = normalize(q)
  if (!s) return true
  return normalize(p.name).includes(s) || p.barcodes.some(b => b.startsWith(s)) || (p.sku ? normalize(p.sku).includes(s) : false)
}

export function stockCounts(products: Product[]): Record<StockFilter, number> {
  const c = { all: products.length, low: 0, out: 0, untracked: 0, expiring: 0 }
  for (const p of products) { const s = stockStatus(p); if (s !== 'ok') c[s]++; if (isExpiring(p)) c.expiring++ }
  return c
}

export function filterProducts(products: Product[], o: { q: string; filter: StockFilter; sort: StockSort; decimals?: number }): Product[] {
  const out = products.filter(p => (o.filter === 'all' || (o.filter === 'expiring' ? isExpiring(p) : stockStatus(p) === o.filter)) && matchesProduct(p, o.q))
  const d = o.decimals ?? 2
  if (o.sort === 'lowest') out.sort((a, b) => (a.trackStock === b.trackStock ? a.stock - b.stock : a.trackStock ? -1 : 1) || a.name.localeCompare(b.name))
  else if (o.sort === 'value') out.sort((a, b) => productValue(b, d) - productValue(a, d) || a.name.localeCompare(b.name))
  else out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/** cost × stock for a tracked product with stock on hand (negative stock counts as nothing). */
export function productValue(p: Pick<Product, 'trackStock' | 'stock' | 'cost'>, decimals = 2): number {
  if (!p.trackStock || p.stock <= 0) return 0
  return round(p.stock * p.cost, decimals)
}
export function stockValue(products: Product[], decimals = 2): number {
  return round(products.reduce((s, p) => s + productValue(p, decimals), 0), decimals)
}

/** A line of a stock-take: the product and what was counted; the system quantity is read live. */
export interface CountLine { productId: string; name: string; unit: string; allowFraction: boolean; counted: number }

export function countDiff(line: CountLine, system: number): number { return round(line.counted - system, 3) }

export function countSummary(lines: CountLine[], systemOf: (productId: string) => number): { items: number; withDiff: number; plus: number; minus: number } {
  let withDiff = 0, plus = 0, minus = 0
  for (const l of lines) {
    const d = countDiff(l, systemOf(l.productId))
    if (d === 0) continue
    withDiff++
    if (d > 0) plus = round(plus + d, 3); else minus = round(minus - d, 3)
  }
  return { items: lines.length, withDiff, plus, minus }
}

/** Adds a product to a stock-take: a new line, or +1 (a scan) on the existing one. */
export function addCountLine(lines: CountLine[], p: Pick<Product, 'id' | 'name' | 'unit' | 'allowFraction'>, counted: number, mode: 'set' | 'increment' = 'set'): CountLine[] {
  const i = lines.findIndex(l => l.productId === p.id)
  if (i >= 0) {
    const next = lines.slice()
    next[i] = { ...next[i], counted: round(mode === 'increment' ? next[i].counted + counted : counted, 3) }
    return next
  }
  return [{ productId: p.id, name: p.name, unit: p.unit, allowFraction: p.allowFraction, counted: round(counted, 3) }, ...lines]
}

/**
 * The lines of a purchase being typed. `cost` is the unit cost in the primary currency; `fxCost` the unit cost in the
 * second currency when the invoice is written in it (the form keeps whichever one the invoice is in as the source of
 * truth and derives the other at the invoice's rate, see lineCost / lineFxCost).
 */
export interface PurchaseLine { key: string; productId: string; name: string; unit: string; allowFraction: boolean; qty: number; cost: number; fxCost?: number }

/** The second currency of an invoice being typed: its rate and how many decimals it has (2 for dollars). */
export interface LineFx { rate: number; decimals?: number }

/**
 * Adds a product to the invoice, or +1 on its line. With `fx` (an invoice in the second currency) the line is seeded
 * with the product's `fxCost`, else with its primary cost converted at the invoice's rate.
 */
export function addPurchaseLine(lines: PurchaseLine[], p: Pick<Product, 'id' | 'name' | 'unit' | 'allowFraction' | 'cost'> & { fxCost?: number }, key: string, fx?: LineFx): PurchaseLine[] {
  const i = lines.findIndex(l => l.productId === p.id)
  if (i >= 0) {
    const next = lines.slice()
    next[i] = { ...next[i], qty: round(next[i].qty + 1, 3) }
    return next
  }
  const line: PurchaseLine = { key, productId: p.id, name: p.name, unit: p.unit, allowFraction: p.allowFraction, qty: 1, cost: p.cost }
  if (fx && fx.rate > 0) line.fxCost = typeof p.fxCost === 'number' ? p.fxCost : round(p.cost / fx.rate, fx.decimals ?? 2)
  return [...lines, line]
}

/** The unit cost of a line in the primary currency: typed directly, or derived from `fxCost` at the rate on a second-currency invoice. */
export function lineCost(l: Pick<PurchaseLine, 'cost' | 'fxCost'>, fx: boolean, rate: number, decimals: number): number {
  return fx ? round((l.fxCost ?? 0) * rate, decimals) : l.cost
}
/** The unit cost of a line in the second currency: `fxCost` when the invoice is in it, else `cost ÷ rate`. */
export function lineFxCost(l: Pick<PurchaseLine, 'cost' | 'fxCost'>, fx: boolean, rate: number, fxDecimals = 2): number {
  if (fx) return l.fxCost ?? 0
  return rate > 0 ? round(l.cost / rate, fxDecimals) : 0
}

/**
 * Re-expresses every line in the other currency at `rate` when the invoice switches between the primary currency and the
 * second one: to 'fx' sets `fxCost = cost ÷ rate`, to 'primary' sets `cost = fxCost × rate`. Lines keep both figures.
 */
export function convertLines(lines: PurchaseLine[], to: 'fx' | 'primary', rate: number, decimals: number, fxDecimals = 2): PurchaseLine[] {
  if (!(rate > 0)) return lines
  return lines.map(l => (to === 'fx'
    ? { ...l, fxCost: round(l.cost / rate, fxDecimals) }
    : { ...l, cost: round((l.fxCost ?? 0) * rate, decimals) }))
}

/** Totals of the invoice being typed in both currencies (the one it is written in is exact; the other derived at `rate`). */
export function purchaseTotals(lines: Pick<PurchaseLine, 'qty' | 'cost' | 'fxCost'>[], fx: boolean, rate: number, decimals: number, fxDecimals = 2): { total: number; fxTotal: number } {
  if (fx) {
    const fxTotal = round(lines.reduce((s, l) => s + round(l.qty * (l.fxCost ?? 0), fxDecimals), 0), fxDecimals)
    return { fxTotal, total: round(fxTotal * rate, decimals) }
  }
  const total = round(lines.reduce((s, l) => s + round(l.qty * l.cost, decimals), 0), decimals)
  return { total, fxTotal: rate > 0 ? round(total / rate, fxDecimals) : 0 }
}

/** The currency a stored second-currency invoice is written in, as formatMoney wants it. */
export function fxCurrency(fx: Pick<PurchaseFx, 'code' | 'symbol' | 'decimals' | 'symbolAfter'>): CurrencySettings {
  return { code: fx.code, symbol: fx.symbol, decimals: fx.decimals, symbolAfter: fx.symbolAfter }
}
/** What is still owed on a second-currency invoice, in that currency. */
export function fxRemaining(fx: Pick<PurchaseFx, 'total' | 'paid' | 'decimals'>): number {
  return round(fx.total - fx.paid, fx.decimals)
}

/** 2 → 2, 1.5 → "1.5" formatted for a signed display. */
export function signedQty(n: number): string {
  const abs = Number.isInteger(n) ? String(Math.abs(n)) : String(round(Math.abs(n), 3))
  return n > 0 ? `+${abs}` : n < 0 ? `-${abs}` : '0'
}
