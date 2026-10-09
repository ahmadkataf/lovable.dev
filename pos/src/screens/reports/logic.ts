// Pure glue between the loaded rows and the screen: the chart granularity, the split into this period and the
// previous one (both windows come from one DB read), the chart buckets, and the whole report in one object.
import type { Sale, Refund, Expense, Product, Category } from '../../db/types'
import { daysBetween, type Period } from '../../lib/format'
import {
  summarize, bucketByDay, bucketByHour, bucketByMonth, topProducts, byCategory, byCashier, byMethod, byCustomer, peakHours, expensesByCategory, previousPeriod,
  type Range, type ReportSummary, type ProductStat, type CategoryStat, type CashierStat, type MethodStat, type CustomerStat, type ExpenseCategoryStat,
} from '../../lib/reports'

export type Granularity = 'hour' | 'day' | 'month'

/** Hours for a single day, months for anything longer than a quarter, days otherwise. */
export function granularity(period: Period, range: Range): Granularity {
  if (period === 'today' || period === 'yesterday') return 'hour'
  return daysBetween(range.from, range.to) + 1 > 92 ? 'month' : 'day'
}

export interface RawData {
  sales: Sale[]
  refunds: Refund[]
  expenses: Expense[]
  /** Sales outside the loaded window that refunds inside it point to. */
  extra: Sale[]
}
export interface PeriodData { sales: Sale[]; refunds: Refund[]; expenses: Expense[] }

/** The rows of the period, the rows before it (the previous period when comparing), and a sale lookup for refunds. */
export function splitPeriods(raw: RawData, range: Range): { cur: PeriodData; prev: PeriodData; salesById: Map<string, Sale> } {
  const inRange = (ms: number) => ms >= range.from && ms <= range.to
  const before = (ms: number) => ms < range.from
  const salesById = new Map<string, Sale>()
  for (const s of raw.sales) salesById.set(s.id, s)
  for (const s of raw.extra) salesById.set(s.id, s)
  return {
    cur: { sales: raw.sales.filter(s => inRange(s.createdAt)), refunds: raw.refunds.filter(r => inRange(r.createdAt)), expenses: raw.expenses.filter(e => inRange(e.createdAt)) },
    prev: { sales: raw.sales.filter(s => before(s.createdAt)), refunds: raw.refunds.filter(r => before(r.createdAt)), expenses: raw.expenses.filter(e => before(e.createdAt)) },
    salesById,
  }
}

/** `key` is the hour (0..23), the day's start or the month's start, by granularity. */
export interface TimeBucket { key: number; total: number; count: number; refunds: number }

export function timeBuckets(data: PeriodData, range: Range, g: Granularity, decimals: number): TimeBucket[] {
  if (g === 'hour') return bucketByHour(data.sales, data.refunds, decimals).map(b => ({ key: b.hour, total: b.total, count: b.count, refunds: b.refunds }))
  if (g === 'month') return bucketByMonth(data.sales, data.refunds, range.from, range.to, decimals).map(b => ({ key: b.month, total: b.total, count: b.count, refunds: b.refunds }))
  return bucketByDay(data.sales, data.refunds, range.from, range.to, decimals).map(b => ({ key: b.day, total: b.total, count: b.count, refunds: b.refunds }))
}

export interface Report {
  range: Range
  prevRange: Range | null
  granularity: Granularity
  cur: PeriodData
  summary: ReportSummary
  prevSummary: ReportSummary | null
  buckets: TimeBucket[]
  prevBuckets: TimeBucket[] | null
  products: ProductStat[]
  categories: CategoryStat[]
  cashiers: CashierStat[]
  methods: MethodStat[]
  customers: CustomerStat[]
  peakCount: number[][]
  peakTotal: number[][]
  expenseCats: ExpenseCategoryStat[]
}

export function buildReport(raw: RawData, range: Range, period: Period, compare: boolean, products: Product[], categories: Category[], decimals: number): Report {
  const g = granularity(period, range)
  const { cur, prev, salesById } = splitPeriods(raw, range)
  const opts = { decimals, salesById }
  const prevRange = compare ? previousPeriod(range) : null
  return {
    range, prevRange, granularity: g, cur,
    summary: summarize(cur.sales, cur.refunds, cur.expenses, opts),
    prevSummary: prevRange ? summarize(prev.sales, prev.refunds, prev.expenses, opts) : null,
    buckets: timeBuckets(cur, range, g, decimals),
    prevBuckets: prevRange ? timeBuckets(prev, prevRange, g, decimals) : null,
    products: topProducts(cur.sales, cur.refunds, 20, opts),
    categories: byCategory(cur.sales, products, categories, opts),
    cashiers: byCashier(cur.sales, cur.refunds, opts),
    methods: byMethod(cur.sales, cur.refunds, opts),
    customers: byCustomer(cur.sales, opts),
    peakCount: peakHours(cur.sales, 'count'),
    peakTotal: peakHours(cur.sales, 'total', decimals),
    expenseCats: expensesByCategory(cur.expenses, decimals),
  }
}
