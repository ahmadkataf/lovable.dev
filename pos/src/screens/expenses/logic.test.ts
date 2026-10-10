import { describe, it, expect } from 'vitest'
import type { Expense } from '../../db/types'
import { sumExpenses, groupByDay, categoryTotals, toDateTimeInput, fromDateTimeInput, isBuiltinCategory } from './logic'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const ex = (amount: number, category: string, createdAt: number, id = Math.random().toString(36).slice(2)): Expense => ({ id, amount, category, createdAt, userId: 'u' })

describe('expenses logic', () => {
  it('sums with rounding', () => {
    expect(sumExpenses([{ amount: 0.1 }, { amount: 0.2 }], 2)).toBe(0.3)
    expect(sumExpenses([], 0)).toBe(0)
  })
  it('groups by day, newest first, and totals each day', () => {
    const list = [ex(10, 'rent', at(2026, 10, 1, 9), 'a'), ex(5, 'goods', at(2026, 10, 3, 8), 'b'), ex(7, 'goods', at(2026, 10, 3, 18), 'c'), ex(1, 'other', at(2026, 10, 2), 'd')]
    const g = groupByDay(list, 0)
    expect(g.map(x => [new Date(x.day).getDate(), x.total, x.items.map(i => i.id)])).toEqual([[3, 12, ['c', 'b']], [2, 1, ['d']], [1, 10, ['a']]])
  })
  it('totals per category with a share of the whole', () => {
    const list = [ex(60, 'rent', 1), ex(30, 'goods', 2), ex(10, 'goods', 3), ex(0, '  ', 4)]
    expect(categoryTotals(list, 0)).toEqual([
      { category: 'rent', total: 60, count: 1, pct: 60 },
      { category: 'goods', total: 40, count: 2, pct: 40 },
      { category: 'other', total: 0, count: 1, pct: 0 },
    ])
    expect(categoryTotals([], 0)).toEqual([])
  })
  it('knows the built-in categories', () => {
    expect(isBuiltinCategory('rent')).toBe(true)
    expect(isBuiltinCategory('قهوة للمحل')).toBe(false)
  })
  it('round-trips datetime-local values', () => {
    const ms = at(2026, 3, 7, 14) + 5 * 60000
    expect(toDateTimeInput(ms)).toBe('2026-03-07T14:05')
    expect(fromDateTimeInput('2026-03-07T14:05')).toBe(ms)
    expect(fromDateTimeInput('garbage', 123)).toBe(123)
    expect(fromDateTimeInput('', 7)).toBe(7)
  })
})
