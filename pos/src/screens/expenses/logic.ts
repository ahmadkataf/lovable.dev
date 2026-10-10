// Pure expense logic: categories, grouping by day, totals per category, datetime-local helpers.
import type { Expense } from '../../db/types'
import { round } from '../../lib/money'
import { startOfDay } from '../../lib/format'

/** Built-in categories are stored by key and translated; anything else is the text the user typed. */
export const EXPENSE_CATEGORIES = ['rent', 'salaries', 'utilities', 'goods', 'transport', 'maintenance', 'other'] as const
export type BuiltinCategory = (typeof EXPENSE_CATEGORIES)[number]
export const isBuiltinCategory = (c: string): c is BuiltinCategory => (EXPENSE_CATEGORIES as readonly string[]).includes(c)

export type ExpensePeriod = 'today' | 'week' | 'month' | 'custom'

export function sumExpenses(list: Pick<Expense, 'amount'>[], decimals = 2): number {
  return round(list.reduce((s, e) => s + e.amount, 0), decimals)
}

export interface DayGroup { day: number; total: number; items: Expense[] }
/** Newest day first, newest expense first inside a day. */
export function groupByDay(list: Expense[], decimals = 2): DayGroup[] {
  const map = new Map<number, Expense[]>()
  for (const e of list) {
    const d = startOfDay(e.createdAt)
    const arr = map.get(d)
    if (arr) arr.push(e); else map.set(d, [e])
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, items]) => ({ day, items: items.slice().sort((a, b) => b.createdAt - a.createdAt), total: sumExpenses(items, decimals) }))
}

export interface CategoryTotal { category: string; total: number; count: number; pct: number }
/** Totals per category, largest first; pct is the share of the grand total (0–100). */
export function categoryTotals(list: Expense[], decimals = 2): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const e of list) {
    const key = e.category.trim() || 'other'
    const cur = map.get(key) ?? { total: 0, count: 0 }
    cur.total += e.amount; cur.count++
    map.set(key, cur)
  }
  const grand = sumExpenses(list, decimals)
  return [...map.entries()]
    .map(([category, v]) => ({ category, total: round(v.total, decimals), count: v.count, pct: grand > 0 ? Math.round((v.total / grand) * 100) : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

/** For <input type="datetime-local">: 2026-10-09T14:05 in local time. */
export function toDateTimeInput(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** Back from the input; an unparsable value gives `fallback`. */
export function fromDateTimeInput(s: string, fallback = Date.now()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  if (!m) return fallback
  const ms = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()
  return Number.isFinite(ms) ? ms : fallback
}
