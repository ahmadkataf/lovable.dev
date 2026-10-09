import { describe, it, expect } from 'vitest'
import type { Sale, SaleItem, Refund, Expense, Product, Category } from '../db/types'
import {
  summarize, refundCost, bucketByDay, bucketByMonth, bucketByHour, topProducts, byCategory, byCashier, byMethod, byCustomer,
  peakHours, expensesByCategory, lowStockProducts, shortNumber, niceStep, previousPeriod, delta, saleMethods,
} from './reports'

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()
// 2026-10-05 is a Monday, 2026-10-06 a Tuesday
const DAY1 = at(2026, 10, 5, 0), DAY2 = at(2026, 10, 6, 0), DAY3 = at(2026, 10, 7, 0)

function item(o: Partial<SaleItem> & { name: string; qty: number; price: number; cost: number }): SaleItem {
  return { unit: 'piece', originalPrice: o.price, discount: 0, taxRate: 0, tax: 0, total: o.qty * o.price, ...o }
}
function sale(o: Partial<Sale> & { id: string; createdAt: number; items: SaleItem[] }): Sale {
  const subtotal = o.items.reduce((s, i) => s + i.total, 0)
  const discount = o.discount ?? 0
  const total = subtotal - discount
  const credit = o.credit ?? 0
  return {
    number: 1, subtotal, discount, tax: 0, total, cost: o.items.reduce((s, i) => s + i.cost * i.qty, 0),
    payments: [{ method: 'cash', amount: total }], paid: total - credit, change: 0, credit,
    userId: 'u1', userName: 'Sami', status: 'completed', refunded: 0, ...o,
  }
}

const p1 = item({ productId: 'p1', name: 'Cola', qty: 2, price: 100, cost: 60 })
const sales: Sale[] = [
  sale({ id: 's1', createdAt: at(2026, 10, 5, 10), items: [p1, item({ productId: 'p2', name: 'Bread', qty: 3, price: 20, cost: 10 })] }),                 // 260 cash
  sale({ id: 's2', createdAt: at(2026, 10, 5, 14), userId: 'u2', userName: 'Boss', customerId: 'c1', customerName: 'Ali',
    items: [item({ productId: 'p1', name: 'Cola', qty: 1, price: 100, cost: 60 })], payments: [{ method: 'credit', amount: 100 }], credit: 100 }),          // 100 on credit
  sale({ id: 's3', createdAt: at(2026, 10, 6, 9), customerId: 'c2', customerName: 'Omar', discount: 10,
    items: [item({ productId: 'p2', name: 'Bread', qty: 5, price: 20, cost: 10 })], payments: [{ method: 'card', amount: 90 }] }),                           // 100 − 10 = 90 card
  sale({ id: 's4', createdAt: at(2026, 10, 6, 20), items: [item({ name: 'خدمة', qty: 1, price: 50, cost: 0 })],
    payments: [{ method: 'cash', amount: 30 }, { method: 'transfer', amount: 20 }] }),                                                                       // 50 cash + transfer
]
const refunds: Refund[] = [
  { id: 'f1', saleId: 's1', saleNumber: 1, createdAt: at(2026, 10, 6, 11), items: [{ productId: 'p1', name: 'Cola', qty: 1, price: 100, total: 100 }], total: 100, method: 'cash', restock: true, userId: 'u1', userName: 'Sami' },
]
const expenses: Expense[] = [
  { id: 'e1', amount: 40, category: 'rent', createdAt: at(2026, 10, 5, 8), userId: 'u1' },
  { id: 'e2', amount: 10, category: 'rent', createdAt: at(2026, 10, 6, 8), userId: 'u1' },
  { id: 'e3', amount: 25, category: 'goods', createdAt: at(2026, 10, 6, 8), userId: 'u1' },
]
const products: Pick<Product, 'id' | 'categoryId'>[] = [{ id: 'p1', categoryId: 'c1' }, { id: 'p2', categoryId: 'c2' }, { id: 'p3', categoryId: 'gone' }]
const categories: Pick<Category, 'id' | 'name' | 'color'>[] = [{ id: 'c1', name: 'Drinks', color: '#111' }, { id: 'c2', name: 'Food', color: '#222' }]

describe('summarize', () => {
  it('adds up the tiles, with the refund margin taken off profit', () => {
    const s = summarize(sales, refunds, expenses, { decimals: 0 })
    expect(s.gross).toBe(500)
    expect(s.count).toBe(4)
    expect(s.avg).toBe(125)
    expect(s.items).toBe(12)
    expect(s.discount).toBe(10)
    expect(s.refunds).toBe(100)
    expect(s.refundCount).toBe(1)
    expect(s.net).toBe(400)
    expect(s.cost).toBe(260)
    expect(s.profit).toBe(200)       // (500 − 260) − (100 − 60)
    expect(s.expenses).toBe(75)
    expect(s.expenseCount).toBe(3)
    expect(s.netProfit).toBe(125)
    expect(s.credit).toBe(100)
  })
  it('finds the refunded sale in salesById when it is outside the period', () => {
    const rest = sales.filter(s => s.id !== 's1')
    expect(summarize(rest, refunds, [], { decimals: 0 }).profit).toBe(240 - 110 - 100)          // unknown sale: the whole refund counts
    expect(summarize(rest, refunds, [], { decimals: 0, salesById: new Map([['s1', sales[0]]]) }).profit).toBe(240 - 110 - 40)
  })
  it('is all zeros for nothing', () => {
    const s = summarize([], [], [])
    expect(s).toEqual({ gross: 0, count: 0, avg: 0, items: 0, discount: 0, tax: 0, refunds: 0, refundCount: 0, net: 0, cost: 0, profit: 0, expenses: 0, expenseCount: 0, netProfit: 0, credit: 0 })
  })
  it('rounds to the currency decimals', () => {
    const s = sale({ id: 'x', createdAt: 1, items: [item({ name: 'a', qty: 3, price: 0.1, cost: 0.03 })] })
    const r = summarize([s, s, s], [], [], { decimals: 2 })
    expect(r.gross).toBe(0.9)
    expect(r.cost).toBe(0.27)
  })
})

describe('refundCost', () => {
  it('uses the sale line cost × refunded qty', () => {
    expect(refundCost(refunds[0], sales[0])).toBe(60)
    expect(refundCost(refunds[0], undefined)).toBe(0)
    const byName: Refund = { ...refunds[0], items: [{ name: 'Bread', qty: 2, price: 20, total: 40 }, { productId: 'zzz', name: 'nope', qty: 1, price: 1, total: 1 }] }
    expect(refundCost(byName, { ...sales[0], items: [item({ name: 'Bread', qty: 3, price: 20, cost: 10 })] })).toBe(20)
    const renamed: Refund = { ...refunds[0], items: [{ productId: 'p1', name: 'Cola Zero', qty: 1, price: 100, total: 100 }] }
    expect(refundCost(renamed, sales[0])).toBe(60)
  })
})

describe('time buckets', () => {
  it('bucketByDay has one entry per day and ignores rows outside the range', () => {
    const b = bucketByDay(sales, refunds, DAY1 + 3600000, DAY3 + 5000, 0)
    expect(b.map(x => [x.day, x.total, x.count, x.refunds])).toEqual([[DAY1, 360, 2, 0], [DAY2, 140, 2, 100], [DAY3, 0, 0, 0]])
    expect(bucketByDay(sales, refunds, DAY3, DAY3, 0)).toEqual([{ day: DAY3, total: 0, count: 0, refunds: 0 }])
    expect(bucketByDay(sales, refunds, DAY3, DAY1, 0)).toEqual([])
  })
  it('bucketByMonth covers the months of the range', () => {
    const b = bucketByMonth(sales, refunds, at(2026, 9, 20), at(2026, 11, 2), 0)
    expect(b.map(x => [new Date(x.month).getMonth() + 1, x.total, x.count, x.refunds])).toEqual([[9, 0, 0, 0], [10, 500, 4, 100], [11, 0, 0, 0]])
  })
  it('bucketByHour gives 24 entries', () => {
    const b = bucketByHour(sales, refunds, 0)
    expect(b).toHaveLength(24)
    expect(b[10]).toEqual({ hour: 10, total: 260, count: 1, refunds: 0 })
    expect(b[11]).toEqual({ hour: 11, total: 0, count: 0, refunds: 100 })
    expect(b[9].total + b[14].total + b[20].total).toBe(240)
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(4)
  })
})

describe('breakdowns', () => {
  it('topProducts ranks by revenue (the share of what was paid) and nets refunds out of profit', () => {
    const top = topProducts(sales, refunds, 20, { decimals: 0 })
    expect(top.map(p => p.name)).toEqual(['Cola', 'Bread', 'خدمة'])
    expect(top[0]).toMatchObject({ productId: 'p1', qty: 3, revenue: 300, cost: 180, refundedQty: 1, refunded: 100, profit: 80 })   // 300 − 180 − (100 − 60)
    expect(top[1]).toMatchObject({ productId: 'p2', qty: 8, revenue: 150, cost: 80, profit: 70 })                                   // 60 + 100 × 0.9
    expect(top[2]).toMatchObject({ productId: undefined, qty: 1, revenue: 50, profit: 50 })
    expect(top.reduce((s, p) => s + p.revenue, 0)).toBe(500)
    expect(top.map(p => Math.round(p.share * 100))).toEqual([60, 30, 10])
    expect(topProducts(sales, refunds, 2)).toHaveLength(2)
    expect(topProducts([], [], 5)).toEqual([])
  })
  it('topProducts falls back to the average cost when the refunded sale is unknown', () => {
    const top = topProducts(sales.filter(s => s.id !== 's1'), refunds, 20, { decimals: 0 })
    const cola = top.find(p => p.productId === 'p1')!
    expect(cola.qty).toBe(1)
    expect(cola.profit).toBe(100 - 60 - (100 - 60))
  })
  it('byCategory groups lines through the product and keeps the colour', () => {
    const cats = byCategory(sales, products, categories, { decimals: 0 })
    expect(cats.map(c => [c.name, c.qty, c.revenue, c.profit, c.color])).toEqual([['Drinks', 3, 300, 120, '#111'], ['Food', 8, 150, 70, '#222'], ['', 1, 50, 50, undefined]])
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1)
    expect(byCategory([], products, categories)).toEqual([])
  })
  it('byCashier counts receipts and refunds per user', () => {
    const c = byCashier(sales, refunds, { decimals: 2 })
    expect(c.map(x => [x.name, x.count, x.total, x.refundCount, x.refunds, x.net])).toEqual([['Sami', 3, 400, 1, 100, 300], ['Boss', 1, 100, 0, 0, 100]])
    expect(c[0].avg).toBe(133.33)
    expect(c[0].share).toBe(0.8)
  })
  it('byMethod sums payments in a fixed order and counts receipts per method', () => {
    const m = byMethod(sales, refunds, { decimals: 0 })
    expect(m.map(x => [x.method, x.amount, x.count, x.refunds, x.net])).toEqual([['cash', 290, 2, 100, 190], ['card', 90, 1, 0, 90], ['transfer', 20, 1, 0, 20], ['credit', 100, 1, 0, 100]])
    expect(m.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1)
    // credit recorded on the sale but missing from payments still counts
    const odd = sale({ id: 'o', createdAt: 1, items: [item({ name: 'x', qty: 1, price: 80, cost: 0 })], payments: [{ method: 'cash', amount: 30 }], credit: 50 })
    expect(byMethod([odd], []).map(x => x.amount)).toEqual([30, 0, 0, 50])
    expect(byMethod([], []).map(x => x.share)).toEqual([0, 0, 0, 0])
  })
  it('byCustomer ranks named customers and skips walk-ins', () => {
    const c = byCustomer(sales, { decimals: 0 })
    expect(c.map(x => [x.customerId, x.name, x.count, x.total, x.credit])).toEqual([['c1', 'Ali', 1, 100, 100], ['c2', 'Omar', 1, 90, 0]])
  })
  it('peakHours fills a 7 × 24 matrix by weekday and hour', () => {
    const m = peakHours(sales)
    expect(m).toHaveLength(7)
    expect(m.every(r => r.length === 24)).toBe(true)
    expect(m[1][10]).toBe(1); expect(m[1][14]).toBe(1); expect(m[2][9]).toBe(1); expect(m[2][20]).toBe(1)
    expect(m.flat().reduce((s, v) => s + v, 0)).toBe(4)
    expect(peakHours(sales, 'total', 0)[1][10]).toBe(260)
  })
  it('expensesByCategory', () => {
    const e = expensesByCategory([...expenses, { id: 'e4', amount: 5, category: '  ', createdAt: 1, userId: 'u' }], 0)
    expect(e.map(x => [x.category, x.total, x.count])).toEqual([['rent', 50, 2], ['goods', 25, 1], ['other', 5, 1]])
    expect(e[0].share).toBeCloseTo(50 / 80)
    expect(expensesByCategory([])).toEqual([])
  })
  it('lowStockProducts keeps active, tracked products that are out or low, emptiest first', () => {
    const p = (id: string, stock: number, lowStock: number, trackStock = true, active = true) => ({ id, stock, lowStock, trackStock, active })
    const list = lowStockProducts([p('ok', 100, 5), p('low', 3, 5), p('out', 0, 5), p('untracked', 0, 5, false), p('inactive', 0, 5, true, false), p('noLimit', 2, 0), p('outNoLimit', 0, 0), p('neg', -1, 0)])
    expect(list.map(x => x.id)).toEqual(['neg', 'out', 'outNoLimit', 'low'])
  })
})

describe('helpers', () => {
  it('shortNumber', () => {
    expect(shortNumber(0)).toBe('0')
    expect(shortNumber(7.25)).toBe('7.3')
    expect(shortNumber(999)).toBe('999')
    expect(shortNumber(999.7)).toBe('1k')
    expect(shortNumber(1000)).toBe('1k')
    expect(shortNumber(1234)).toBe('1.2k')
    expect(shortNumber(12345)).toBe('12.3k')
    expect(shortNumber(123456)).toBe('123k')
    expect(shortNumber(1234567)).toBe('1.2M')
    expect(shortNumber(2500000000)).toBe('2.5B')
    expect(shortNumber(-1500)).toBe('-1.5k')
    expect(shortNumber(NaN)).toBe('0')
  })
  it('niceStep covers the maximum with little headroom', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(1234)).toBe(400)
    expect(niceStep(100)).toBe(25)
    expect(niceStep(7)).toBe(2)
    expect(niceStep(0.9)).toBe(0.25)
    expect(niceStep(39, 4)).toBe(10)
    for (const max of [1, 3, 17, 250, 999, 4321, 87654]) expect(niceStep(max) * 4).toBeGreaterThanOrEqual(max)
  })
  it('previousPeriod is the same number of days right before', () => {
    const p = previousPeriod({ from: DAY1, to: DAY2 + 86400000 - 1 })
    expect(p).toEqual({ from: at(2026, 10, 3, 0), to: DAY1 - 1 })
    expect(previousPeriod({ from: DAY1, to: DAY1 + 86400000 - 1 })).toEqual({ from: at(2026, 10, 4, 0), to: DAY1 - 1 })
  })
  it('delta', () => {
    expect(delta(150, 100)).toEqual({ diff: 50, pct: 0.5 })
    expect(delta(50, 100)).toEqual({ diff: -50, pct: -0.5 })
    expect(delta(50, 0)).toEqual({ diff: 50, pct: null })
    expect(delta(-20, -10)).toEqual({ diff: -10, pct: -1 })
  })
  it('saleMethods lists the methods used, credit included', () => {
    expect(saleMethods(sales[0])).toEqual(['cash'])
    expect(saleMethods(sales[3])).toEqual(['cash', 'transfer'])
    expect(saleMethods(sale({ id: 'q', createdAt: 1, items: [item({ name: 'x', qty: 1, price: 80, cost: 0 })], payments: [{ method: 'cash', amount: 30 }], credit: 50 }))).toEqual(['cash', 'credit'])
    expect(saleMethods(sale({ id: 'z', createdAt: 1, items: [], payments: [] }))).toEqual(['cash'])
  })
})
