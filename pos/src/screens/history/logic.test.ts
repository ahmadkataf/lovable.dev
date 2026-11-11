import { describe, it, expect } from 'vitest'
import type { Sale } from '../../db/types'
import { saleMethods, filterSales, groupSalesByDay, summarizeSales, parseReceiptNumber, salesCsvRows } from './logic'

const day = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0).getTime()
const sale = (p: Partial<Sale>): Sale => ({
  id: 'x', number: 1, createdAt: day(1), items: [{ name: 'a', unit: 'piece', qty: 1, price: 100, originalPrice: 100, cost: 0, discount: 0, taxRate: 0, tax: 0, total: 100 }],
  subtotal: 100, discount: 0, tax: 0, total: 100, cost: 0, payments: [{ method: 'cash', amount: 100 }], paid: 100, change: 0, credit: 0,
  userId: 'u1', userName: 'أحمد', status: 'completed', refunded: 0, ...p,
})
const sales: Sale[] = [
  sale({ id: 'a', number: 3, createdAt: day(9, 18), total: 300, paid: 300, payments: [{ method: 'card', amount: 300 }], status: 'partial', refunded: 50, customerName: 'علي حسن' }),
  sale({ id: 'b', number: 2, createdAt: day(9, 9), total: 200, payments: [{ method: 'cash', amount: 100 }, { method: 'credit', amount: 100 }], credit: 100, customerId: 'c1', customerName: 'أحمد', userId: 'u2' }),
  sale({ id: 'c', number: 1, createdAt: day(8), total: 100, status: 'refunded', refunded: 100 }),
]

describe('history logic', () => {
  it('lists the payment methods of a receipt', () => {
    expect(saleMethods(sales[0])).toEqual(['card'])
    expect(saleMethods(sales[1])).toEqual(['cash', 'credit'])
    expect(saleMethods(sale({ payments: [{ method: 'credit', amount: 100 }], credit: 100 }))).toEqual(['credit'])
    expect(saleMethods(sale({ payments: [], total: 0 }))).toEqual(['cash'])
  })
  it('filters by cashier, method, status and customer', () => {
    expect(filterSales(sales, {}).length).toBe(3)
    expect(filterSales(sales, { userId: 'u2' }).map(s => s.id)).toEqual(['b'])
    expect(filterSales(sales, { method: 'credit' }).map(s => s.id)).toEqual(['b'])
    expect(filterSales(sales, { method: 'cash' }).map(s => s.id)).toEqual(['b', 'c'])
    expect(filterSales(sales, { status: 'anyRefund' }).map(s => s.id)).toEqual(['a', 'c'])
    expect(filterSales(sales, { status: 'refunded' }).map(s => s.id)).toEqual(['c'])
    expect(filterSales(sales, { status: 'partial' }).map(s => s.id)).toEqual(['a'])
    expect(filterSales(sales, { status: 'completed' }).map(s => s.id)).toEqual(['b'])
    expect(filterSales(sales, { customer: 'احمد' }).map(s => s.id)).toEqual(['b'])
    expect(filterSales(sales, { customer: 'حسن' }).map(s => s.id)).toEqual(['a'])
    expect(filterSales(sales, { customer: '  ' }).length).toBe(3)
  })
  it('groups by day with totals and keeps the newest-first order', () => {
    const g = groupSalesByDay(sales, 0)
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ day: new Date(2026, 9, 9).getTime(), count: 2, total: 500, refunded: 50 })
    expect(g[0].items.map(s => s.number)).toEqual([3, 2])
    expect(g[1]).toMatchObject({ count: 1, total: 100, refunded: 100 })
    expect(groupSalesByDay([], 0)).toEqual([])
  })
  it('summarises the set', () => {
    expect(summarizeSales(sales, 0)).toEqual({ count: 3, total: 600, refunded: 150, net: 450 })
  })
  it('reads receipt numbers from typed or scanned text', () => {
    expect(parseReceiptNumber('123')).toBe(123)
    expect(parseReceiptNumber('#45 ')).toBe(45)
    expect(parseReceiptNumber('١٢')).toBe(12)
    expect(parseReceiptNumber('0')).toBeNull()
    expect(parseReceiptNumber('abc')).toBeNull()
    expect(parseReceiptNumber('6291041500213')).toBeNull()   // a product barcode is not a receipt
    expect(parseReceiptNumber('')).toBeNull()
  })
  it('builds CSV rows with a totals line', () => {
    const rows = salesCsvRows(sales, { number: 'n', date: 'd', time: 't', customer: 'c', cashier: 'u', items: 'i', total: 'T', paid: 'p', credit: 'cr', refunded: 'r', status: 's', methods: 'm', note: 'nt' },
      { date: () => 'D', time: () => 'T', status: s => s.status, method: m => m }, 0)
    expect(rows[0]).toHaveLength(13)
    expect(rows[1]).toEqual([3, 'D', 'T', 'علي حسن', 'أحمد', 1, 300, 300, 0, 50, 'partial', 'card', ''])
    expect(rows[2][11]).toBe('cash + credit')
    expect(rows[rows.length - 1]).toEqual(['', '', '', '', '', 3, 600, '', '', 150])
  })
  it('adds the rate and the second-currency total when asked, blank for unrated receipts', () => {
    const rated = [sale({ id: 'r', number: 7, total: 130000, rate: 13000, rateCode: 'USD' }), sales[1]]
    const rows = salesCsvRows(rated, { number: 'n', date: 'd', time: 't', customer: 'c', cashier: 'u', items: 'i', total: 'T', paid: 'p', credit: 'cr', refunded: 'r', status: 's', methods: 'm', note: 'nt' },
      { date: () => 'D', time: () => 'T', status: s => s.status, method: m => m }, 0, { rate: 'rate', totalFx: 'total USD', decimals: 2 })
    expect(rows[0]).toHaveLength(15)
    expect(rows[0].slice(13)).toEqual(['rate', 'total USD'])
    expect(rows[1].slice(13)).toEqual([13000, 10])
    expect(rows[2].slice(13)).toEqual(['', ''])
    expect(rows[rows.length - 1]).toEqual(['', '', '', '', '', 2, 130200, '', '', 0])
  })
})
