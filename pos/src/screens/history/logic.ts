// Pure helpers for the receipts list: filters, the day groups, the summary line, CSV rows. Tested.
import type { PaymentMethod, Sale } from '../../db/types'
import { round } from '../../lib/money'
import { startOfDay } from '../../lib/format'
import { normalizeText } from '../../lib/customers'

export type StatusFilter = 'all' | 'completed' | 'anyRefund' | 'refunded' | 'partial'
export interface HistoryFilters {
  userId?: string
  method?: PaymentMethod | ''
  status?: StatusFilter
  customer?: string
}

/** The payment methods on a receipt, in order, without repeats (credit counts when money went on the account). */
export function saleMethods(sale: Sale): PaymentMethod[] {
  const out: PaymentMethod[] = []
  for (const p of sale.payments) if (p.amount > 0 && !out.includes(p.method)) out.push(p.method)
  if (sale.credit > 0 && !out.includes('credit')) out.push('credit')
  if (!out.length && sale.total === 0) out.push('cash')
  return out
}

export function matchesFilters(s: Sale, f: HistoryFilters): boolean {
  if (f.userId && s.userId !== f.userId) return false
  if (f.method && !saleMethods(s).includes(f.method)) return false
  if (f.status && f.status !== 'all') {
    if (f.status === 'anyRefund' ? s.status === 'completed' : s.status !== f.status) return false
  }
  if (f.customer?.trim()) {
    const q = normalizeText(f.customer)
    if (!normalizeText(s.customerName ?? '').includes(q)) return false
  }
  return true
}
export const filterSales = (sales: Sale[], f: HistoryFilters): Sale[] => sales.filter(s => matchesFilters(s, f))

export interface DayGroup { day: number; count: number; total: number; refunded: number; items: Sale[] }
/** Groups receipts (already sorted newest first) by calendar day, keeping the order. */
export function groupSalesByDay(sales: Sale[], decimals: number): DayGroup[] {
  const out: DayGroup[] = []
  for (const s of sales) {
    const day = startOfDay(s.createdAt)
    let g = out[out.length - 1]
    if (!g || g.day !== day) { g = { day, count: 0, total: 0, refunded: 0, items: [] }; out.push(g) }
    g.items.push(s); g.count++; g.total += s.total; g.refunded += s.refunded
  }
  for (const g of out) { g.total = round(g.total, decimals); g.refunded = round(g.refunded, decimals) }
  return out
}

export interface SalesSummary { count: number; total: number; refunded: number; net: number }
export function summarizeSales(sales: Sale[], decimals: number): SalesSummary {
  let total = 0, refunded = 0
  for (const s of sales) { total += s.total; refunded += s.refunded }
  return { count: sales.length, total: round(total, decimals), refunded: round(refunded, decimals), net: round(total - refunded, decimals) }
}

/** The number of distinct lines on a receipt. */
export const lineCount = (s: Sale): number => s.items.length

/** "#123", "123", "١٢٣" → 123; anything that is not a receipt number → null. */
export function parseReceiptNumber(s: string): number | null {
  const digits = normalizeText(s).replace(/^#/, '').trim()
  if (!/^\d{1,9}$/.test(digits)) return null
  const n = Number(digits)
  return n > 0 ? n : null
}

/** The second-currency columns of the CSV: the rate the receipt was valued at and its total at that rate. */
export interface CsvFxColumns { rate: string; totalFx: string; decimals: number }

/** Rows for the CSV export of a filtered list. Labels come from the screen so they are translated. */
export function salesCsvRows(sales: Sale[], labels: { number: string; date: string; time: string; customer: string; cashier: string; items: string; total: number | string; paid: string; credit: string; refunded: string; status: string; methods: string; note: string }, fmt: { date: (ms: number) => string; time: (ms: number) => string; status: (s: Sale) => string; method: (m: PaymentMethod) => string }, decimals: number, fx?: CsvFxColumns): (string | number)[][] {
  const rows: (string | number)[][] = [[labels.number, labels.date, labels.time, labels.customer, labels.cashier, labels.items, labels.total, labels.paid, labels.credit, labels.refunded, labels.status, labels.methods, labels.note, ...(fx ? [fx.rate, fx.totalFx] : [])]]
  for (const s of sales) {
    const rated = typeof s.rate === 'number' && s.rate > 0
    rows.push([s.number, fmt.date(s.createdAt), fmt.time(s.createdAt), s.customerName ?? '', s.userName, s.items.length, s.total, round(s.paid - s.change, decimals), s.credit, s.refunded, fmt.status(s), saleMethods(s).map(fmt.method).join(' + '), s.note ?? '',
      ...(fx ? [rated ? s.rate! : '', rated ? round(s.total / s.rate!, fx.decimals) : ''] : [])])
  }
  const sum = summarizeSales(sales, decimals)
  rows.push([], ['', '', '', '', '', sum.count, sum.total, '', '', sum.refunded])
  return rows
}
