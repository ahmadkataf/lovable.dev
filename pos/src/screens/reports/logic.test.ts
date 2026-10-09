import { describe, it, expect } from 'vitest'
import type { Sale, Refund, Expense } from '../../db/types'
import { periodRange } from '../../lib/format'
import { granularity, splitPeriods, timeBuckets, buildReport, type RawData } from './logic'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const sale = (id: string, createdAt: number, total: number, extra: Partial<Sale> = {}): Sale => ({
  id, number: 1, createdAt, items: [{ productId: 'p', name: 'x', unit: 'piece', qty: 1, price: total, originalPrice: total, cost: 0, discount: 0, taxRate: 0, tax: 0, total }],
  subtotal: total, discount: 0, tax: 0, total, cost: 0, payments: [{ method: 'cash', amount: total }], paid: total, change: 0, credit: 0,
  userId: 'u', userName: 'U', status: 'completed', refunded: 0, ...extra,
})
const refund = (id: string, saleId: string, createdAt: number, total: number): Refund => ({ id, saleId, saleNumber: 1, createdAt, items: [], total, method: 'cash', restock: false, userId: 'u', userName: 'U' })
const expense = (id: string, createdAt: number, amount: number): Expense => ({ id, amount, category: 'rent', createdAt, userId: 'u' })

const now = at(2026, 10, 9, 15)
const range = periodRange('custom', { from: at(2026, 10, 8), to: at(2026, 10, 9) }, now)   // Oct 8–9
const raw: RawData = {
  sales: [sale('a', at(2026, 10, 6, 9), 100), sale('b', at(2026, 10, 7, 9), 50), sale('c', at(2026, 10, 8, 10), 200), sale('d', at(2026, 10, 9, 11), 300)],
  refunds: [refund('r1', 'a', at(2026, 10, 8, 12), 20), refund('r2', 'z', at(2026, 10, 7, 12), 5)],
  expenses: [expense('e1', at(2026, 10, 9), 30), expense('e2', at(2026, 10, 6), 7)],
  extra: [sale('z', at(2026, 9, 1), 500)],
}

describe('reports screen logic', () => {
  it('picks hours for a day, days for up to a quarter, months beyond', () => {
    expect(granularity('today', periodRange('today', undefined, now))).toBe('hour')
    expect(granularity('yesterday', periodRange('yesterday', undefined, now))).toBe('hour')
    expect(granularity('week', periodRange('week', undefined, now))).toBe('day')
    expect(granularity('month', periodRange('month', undefined, now))).toBe('day')
    expect(granularity('year', periodRange('year', undefined, now))).toBe('month')
    expect(granularity('custom', periodRange('custom', { from: at(2026, 1, 1), to: at(2026, 3, 31) }, now))).toBe('day')
    expect(granularity('custom', periodRange('custom', { from: at(2026, 1, 1), to: at(2026, 4, 10) }, now))).toBe('month')
  })
  it('splits the loaded window into this period and the one before, with a sale lookup', () => {
    const { cur, prev, salesById } = splitPeriods(raw, range)
    expect(cur.sales.map(s => s.id)).toEqual(['c', 'd'])
    expect(prev.sales.map(s => s.id)).toEqual(['a', 'b'])
    expect(cur.refunds.map(r => r.id)).toEqual(['r1'])
    expect(prev.refunds.map(r => r.id)).toEqual(['r2'])
    expect(cur.expenses.map(e => e.id)).toEqual(['e1'])
    expect(prev.expenses.map(e => e.id)).toEqual(['e2'])
    expect([...salesById.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'z'])
  })
  it('buckets by the granularity', () => {
    const { cur } = splitPeriods(raw, range)
    expect(timeBuckets(cur, range, 'day', 0).map(b => [b.total, b.count, b.refunds])).toEqual([[200, 1, 20], [300, 1, 0]])
    expect(timeBuckets(cur, range, 'hour', 0)).toHaveLength(24)
    expect(timeBuckets(cur, range, 'hour', 0)[10].total).toBe(200)
    expect(timeBuckets(cur, range, 'month', 0)).toHaveLength(1)
    expect(timeBuckets(cur, range, 'month', 0)[0].total).toBe(500)
  })
  it('builds the whole report, with the previous period only when comparing', () => {
    const r = buildReport(raw, range, 'custom', false, [], [], 0)
    expect(r.summary.gross).toBe(500)
    expect(r.summary.refunds).toBe(20)
    expect(r.summary.expenses).toBe(30)
    expect(r.prevSummary).toBeNull()
    expect(r.prevBuckets).toBeNull()
    expect(r.buckets).toHaveLength(2)
    expect(r.methods.find(m => m.method === 'cash')?.amount).toBe(500)
    expect(r.products[0]).toMatchObject({ productId: 'p', qty: 2, revenue: 500 })
    expect(r.peakCount.flat().reduce((s, v) => s + v, 0)).toBe(2)
    expect(r.expenseCats).toEqual([{ category: 'rent', total: 30, count: 1, share: 1 }])

    const c = buildReport(raw, range, 'custom', true, [], [], 0)
    expect(c.prevRange).toEqual({ from: at(2026, 10, 6, 0), to: at(2026, 10, 8, 0) - 1 })
    expect(c.prevSummary?.gross).toBe(150)
    expect(c.prevSummary?.refunds).toBe(5)
    expect(c.prevBuckets?.map(b => b.total)).toEqual([100, 50])
    expect(r.fx).toBe(false)
    expect(r.estimated).toBe(0)
  })
  it('values the report in the second currency, each receipt at its own rate', () => {
    const fxRaw: RawData = {
      sales: [
        sale('s1', at(2026, 10, 8, 10), 130000, { rate: 13000, rateCode: 'USD', cost: 65000, items: [{ productId: 'p', name: 'x', unit: 'piece', qty: 1, price: 130000, originalPrice: 130000, cost: 65000, discount: 0, taxRate: 0, tax: 0, total: 130000 }] }),
        sale('s2', at(2026, 10, 9, 10), 140000, { rate: 14000, rateCode: 'USD' }),
      ],
      refunds: [{ ...refund('r1', 's1', at(2026, 10, 9, 12), 130000), rate: 13000, rateCode: 'USD', items: [{ productId: 'p', name: 'x', qty: 1, price: 130000, total: 130000 }] }],
      expenses: [expense('e1', at(2026, 10, 9), 28000)],
      extra: [],
    }
    const fx = { rateAt: () => undefined, current: 14000, decimals: 2 }
    const r = buildReport(fxRaw, range, 'custom', false, [], [], 2, fx)
    expect(r.fx).toBe(true)
    expect(r.summary.gross).toBe(20)           // $10 + $10, each at its own rate
    expect(r.summary.refunds).toBe(10)         // the full refund of s1 at the sale's rate
    expect(r.summary.net).toBe(10)             // s1 nets to $0
    expect(r.summary.cost).toBe(5)
    expect(r.summary.expenses).toBe(2)         // 28,000 at today's rate (no own rate) → estimated
    expect(r.estimated).toBe(1)
    expect(r.buckets.map(b => b.total)).toEqual([10, 10])
    expect(r.products[0]).toMatchObject({ productId: 'p', revenue: 20, refunded: 10 })   // both receipts sell 'p'
  })
  it('estimates unrated receipts from the history, then the current rate', () => {
    const mixed: RawData = {
      sales: [sale('old', at(2026, 10, 8, 10), 120000), sale('older', at(2026, 10, 9, 10), 100000), sale('new', at(2026, 10, 9, 11), 150000, { rate: 15000 })],
      refunds: [], expenses: [], extra: [],
    }
    const history = (ms: number) => (ms < at(2026, 10, 9, 0) ? 12000 : undefined)
    const r = buildReport(mixed, range, 'custom', false, [], [], 2, { rateAt: history, current: 10000, decimals: 2 })
    expect(r.summary.gross).toBe(30)           // 10 (history) + 10 (current) + 10 (own)
    expect(r.estimated).toBe(2)
    // without fx nothing is touched
    expect(buildReport(mixed, range, 'custom', false, [], [], 0).summary.gross).toBe(370000)
  })
})
