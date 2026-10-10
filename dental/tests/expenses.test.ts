import type { Expense } from '../src/db/types'
import {
  categoryBreakdown, filterExpenses, inPeriod, isFullMonth, isRealDate, isValidPeriod, monthPeriod, periodDays, periodDelta, periodTotal, previousPeriod, shiftMonth, sortExpenses,
  topCategory, validateExpense,
} from '../src/features/expenses/lib'
import { matches } from '../src/lib/format'

const exp = (p: Partial<Expense>): Expense => ({ id: 'x', category: 'other', amount: 0, date: '2026-10-01', description: '', createdAt: '2026-10-01T00:00:00.000Z', ...p })

describe('expenses: periods', () => {
  it('month period and navigation', () => {
    expect(monthPeriod('2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthPeriod('2024-02-15')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(shiftMonth(monthPeriod('2026-01-10'), -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(shiftMonth(monthPeriod('2026-12-10'), 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' })
    expect(shiftMonth({ from: '2026-10-05', to: '2026-10-20' }, 1)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(isFullMonth(monthPeriod('2026-10-10'))).toBe(true)
    expect(isFullMonth({ from: '2026-10-01', to: '2026-10-30' })).toBe(false)
    expect(periodDays({ from: '2026-10-01', to: '2026-10-31' })).toBe(31)
  })
  it('previous period keeps the same length for custom ranges', () => {
    expect(previousPeriod(monthPeriod('2026-03-10'))).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(previousPeriod({ from: '2026-10-11', to: '2026-10-20' })).toEqual({ from: '2026-10-01', to: '2026-10-10' })
    expect(previousPeriod({ from: '2026-01-01', to: '2026-01-01' })).toEqual({ from: '2025-12-31', to: '2025-12-31' })
  })
  it('membership and validity', () => {
    const p = { from: '2026-10-01', to: '2026-10-31' }
    expect(inPeriod('2026-10-01', p)).toBe(true)
    expect(inPeriod('2026-10-31', p)).toBe(true)
    expect(inPeriod('2026-11-01', p)).toBe(false)
    expect(isValidPeriod(p)).toBe(true)
    expect(isValidPeriod({ from: '2026-10-31', to: '2026-10-01' })).toBe(false)
    expect(isValidPeriod({ from: '', to: '2026-10-01' })).toBe(false)
    expect(isRealDate('2024-02-29')).toBe(true)
    expect(isRealDate('2026-02-29')).toBe(false)
    expect(isRealDate('2026-13-01')).toBe(false)
  })
})

describe('expenses: totals and breakdown', () => {
  const list = [
    exp({ id: '1', category: 'rent', amount: 1000 }),
    exp({ id: '2', category: 'salaries', amount: 2500.5 }),
    exp({ id: '3', category: 'salaries', amount: 499.5 }),
    exp({ id: '4', category: 'materials', amount: 1000 }),
    exp({ id: '5', category: 'nope' as any, amount: 1 }),
  ]
  it('period total rounds to cents', () => {
    expect(periodTotal(list)).toBe(5001)
    expect(periodTotal([])).toBe(0)
    expect(periodTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
  })
  it('breakdown is sorted by total with shares summing to ~100', () => {
    const b = categoryBreakdown(list)
    expect(b.map(s => s.category)).toEqual(['salaries', 'materials', 'rent', 'other'])
    expect(b[0]).toEqual({ category: 'salaries', total: 3000, count: 2, pct: 60 })
    expect(b[1].pct).toBe(20)
    expect(b[3].category).toBe('other')                    // unknown categories fold into "other"
    expect(Math.round(b.reduce((a, s) => a + s.pct, 0))).toBe(100)
    expect(topCategory(b)?.category).toBe('salaries')
    expect(topCategory([])).toBeNull()
    expect(categoryBreakdown([])).toEqual([])
  })
  it('period delta', () => {
    expect(periodDelta(1200, 1000)).toBe(20)
    expect(periodDelta(800, 1000)).toBe(-20)
    expect(periodDelta(1000, 1000)).toBe(0)
    expect(periodDelta(0, 0)).toBe(0)
    expect(periodDelta(500, 0)).toBeNull()
    expect(periodDelta(1234.5, 1000)).toBe(23.5)
  })
})

describe('expenses: filters, sorting, validation', () => {
  const list = [
    exp({ id: 'a', date: '2026-10-03', description: 'فاتورة كهرباء', vendor: 'شركة الكهرباء', category: 'utilities', createdAt: '2026-10-03T09:00:00.000Z' }),
    exp({ id: 'b', date: '2026-10-03', description: 'Gloves', vendor: 'Medix', category: 'materials', createdAt: '2026-10-03T11:00:00.000Z' }),
    exp({ id: 'c', date: '2026-10-09', description: 'Rent', category: 'rent' }),
  ]
  it('search covers description and vendor, Arabic-insensitive', () => {
    expect(filterExpenses(list, { q: 'كهرباء' }, matches).map(e => e.id)).toEqual(['a'])
    expect(filterExpenses(list, { q: 'medix' }, matches).map(e => e.id)).toEqual(['b'])
    expect(filterExpenses(list, { category: 'rent' }, matches).map(e => e.id)).toEqual(['c'])
    expect(filterExpenses(list, {}, matches)).toHaveLength(3)
  })
  it('sorts newest first, then most recently recorded', () => {
    expect(sortExpenses(list).map(e => e.id)).toEqual(['c', 'b', 'a'])
  })
  it('validates the form', () => {
    expect(validateExpense({ category: 'rent', amount: 10, date: '2026-10-01', description: 'x' })).toEqual({})
    expect(validateExpense({ category: '', amount: null, date: '', description: '  ' })).toEqual({ category: 'required', amount: 'required', date: 'required', description: 'required' })
    expect(validateExpense({ category: 'rent', amount: 0, date: '2026-13-01', description: 'x' })).toEqual({ amount: 'positive', date: 'date' })
    expect(validateExpense({ category: 'rent', amount: -5, date: 'abc', description: 'x' })).toEqual({ amount: 'positive', date: 'date' })
  })
})
