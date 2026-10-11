// Pure expenses logic: periods, totals, breakdowns. Covered by tests/expenses.test.ts.
import type { Expense, ExpenseCategory, ISODate } from '@/db/types'
import { EXPENSE_CATEGORIES } from '@/db/types'
import { addDays, addMonths, diffDays, endOfMonth, startOfMonth } from '@/lib/dates'
import { round2 } from '@/lib/format'

export interface Period { from: ISODate; to: ISODate }

/** The calendar month that contains `date`. */
export function monthPeriod(date: ISODate): Period { return { from: startOfMonth(date), to: endOfMonth(date) } }
export function isFullMonth(p: Period): boolean { return p.from === startOfMonth(p.from) && p.to === endOfMonth(p.from) }
/** The month `n` months away from a month period (the custom range is first snapped to its starting month). */
export function shiftMonth(p: Period, n: number): Period { return monthPeriod(addMonths(startOfMonth(p.from), n)) }
export function periodDays(p: Period): number { return Math.max(1, diffDays(p.from, p.to) + 1) }
/** The comparable period just before: the previous month for a month, otherwise a range of the same length ending the day before. */
export function previousPeriod(p: Period): Period {
  if (isFullMonth(p)) return shiftMonth(p, -1)
  const to = addDays(p.from, -1)
  return { from: addDays(to, -(periodDays(p) - 1)), to }
}
export const inPeriod = (date: ISODate, p: Period) => date >= p.from && date <= p.to
export const isValidPeriod = (p: Period) => isRealDate(p.from) && isRealDate(p.to) && p.from <= p.to

export const periodTotal = (expenses: Pick<Expense, 'amount'>[]) => round2(expenses.reduce((a, e) => a + (e.amount || 0), 0))

export interface CategoryShare { category: ExpenseCategory; total: number; count: number; pct: number }
/** Totals per category, largest first; pct is the share of the grand total (0–100, one decimal). Empty categories are left out. */
export function categoryBreakdown(expenses: Pick<Expense, 'amount' | 'category'>[]): CategoryShare[] {
  const map = new Map<ExpenseCategory, { total: number; count: number }>()
  for (const e of expenses) {
    const c = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'other'
    const cur = map.get(c) ?? { total: 0, count: 0 }
    cur.total += e.amount || 0; cur.count++
    map.set(c, cur)
  }
  const grand = [...map.values()].reduce((a, v) => a + v.total, 0)
  return [...map.entries()]
    .map(([category, v]) => ({ category, total: round2(v.total), count: v.count, pct: grand > 0 ? Math.round((v.total / grand) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}
export const topCategory = (shares: CategoryShare[]): CategoryShare | null => shares[0] ?? null

/** Percentage change from `previous` to `current`; null when there is nothing to compare against (previous = 0 and current > 0). */
export function periodDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current <= 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export interface ExpenseFilters { q?: string; category?: ExpenseCategory | '' }
export function filterExpenses(list: Expense[], f: ExpenseFilters, match: (hay: string | undefined, needle: string) => boolean): Expense[] {
  const q = (f.q || '').trim()
  return list.filter(e => {
    if (f.category && e.category !== f.category) return false
    if (q && !(match(e.description, q) || match(e.vendor, q))) return false
    return true
  })
}
/** Newest first, then most recently recorded. */
export function sortExpenses(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** Semantic colour token per category, used by badges and the breakdown bars. */
export const CATEGORY_TONE: Record<ExpenseCategory, 'info' | 'purple' | 'primary' | 'pink' | 'accent' | 'warning' | 'orange' | 'success' | 'danger' | 'default'> = {
  rent: 'info', salaries: 'purple', materials: 'primary', lab: 'pink', equipment: 'accent', utilities: 'warning', marketing: 'orange', maintenance: 'success', taxes: 'danger', other: 'default',
}
export const CATEGORY_COLOR_VAR: Record<ExpenseCategory, string> = {
  rent: 'var(--info)', salaries: 'var(--purple)', materials: 'var(--primary)', lab: 'var(--pink)', equipment: 'var(--accent)', utilities: 'var(--warning)', marketing: 'var(--orange)', maintenance: 'var(--success)', taxes: 'var(--danger)', other: 'var(--text-4)',
}

/** 'YYYY-MM-DD' that names a real calendar day (2026-13-01 and 2026-02-30 are not). */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export type ExpenseErrors = Partial<Record<'category' | 'amount' | 'date' | 'description', 'required' | 'positive' | 'date'>>
export function validateExpense(v: { category: string; amount: number | null; date: string; description: string }): ExpenseErrors {
  const e: ExpenseErrors = {}
  if (!v.category) e.category = 'required'
  if (v.amount === null || !Number.isFinite(v.amount)) e.amount = 'required'
  else if (v.amount <= 0) e.amount = 'positive'
  if (!v.date) e.date = 'required'
  else if (!isRealDate(v.date)) e.date = 'date'
  if (!v.description.trim()) e.description = 'required'
  return e
}

/**
 * RFC-4180 CSV with a BOM so Excel opens Arabic text correctly. Typed text that starts like a formula
 * (= + - @, tab, CR) gets a leading apostrophe so a spreadsheet shows it instead of running it; numbers stay numbers.
 */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')
}
