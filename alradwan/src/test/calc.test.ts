import { describe, expect, it } from 'vitest'
import { cashLines, customerBalance, payStatus, saleProfit, saleTotals, stockMap, supplierBalance } from '../lib/calc'
import type { Customer, Payment, Product, Purchase, Sale, StockMovement, Supplier } from '../db/types'
import { matches, norm, toNumber } from '../lib/format'

const product = (id: string, opening: number, kind: 'product' | 'service' = 'product'): Product => ({ id, updatedAt: 0, code: id, name: id, unit: 'قطعة', cost: 10, price: 15, minStock: 1, openingStock: opening, kind, createdAt: 0 })
const sale = (p: Partial<Sale>): Sale => ({ id: 's', updatedAt: 0, number: 1, type: 'sale', date: 0, customerName: 'x', items: [], subtotal: 0, discount: 0, total: 0, paid: 0, ...p })

describe('stock', () => {
  it('is the opening stock plus the movements', () => {
    const products = new Map([['a', product('a', 5)], ['svc', product('svc', 0, 'service')]])
    const movements = new Map<string, StockMovement>([
      ['m1', { id: 'm1', updatedAt: 0, productId: 'a', date: 0, qty: -2, reason: 'sale' }],
      ['m2', { id: 'm2', updatedAt: 0, productId: 'a', date: 0, qty: 10, reason: 'purchase' }],
      ['m3', { id: 'm3', updatedAt: 0, productId: 'gone', date: 0, qty: 1, reason: 'adjust' }],
    ])
    const s = stockMap(products, movements)
    expect(s.get('a')).toBe(13)
    expect(s.get('svc')).toBe(0)
    expect(s.has('gone')).toBe(false)
  })
})

describe('sales', () => {
  it('totals and profit with line and invoice discounts', () => {
    const items = [{ qty: 2, price: 100, cost: 60, discount: 10, name: 'a', kind: 'product' as const }, { qty: 1, price: 50, cost: 0, discount: 0, name: 'b', kind: 'service' as const }]
    expect(saleTotals(items, 20)).toEqual({ subtotal: 240, total: 220 })
    const s = sale({ items, discount: 20, subtotal: 240, total: 220, paid: 220 })
    expect(saleProfit(s)).toBe(2 * 40 - 10 + 50 - 20)
    expect(saleProfit({ ...s, type: 'return' })).toBe(-(2 * 40 - 10 + 50 - 20))
    expect(payStatus(220, 220)).toBe('paid'); expect(payStatus(220, 100)).toBe('partial'); expect(payStatus(220, 0)).toBe('unpaid')
  })
})

describe('balances', () => {
  const c: Customer = { id: 'c', updatedAt: 0, name: 'c', openingBalance: 100, createdAt: 0 }
  const sales = [sale({ id: '1', customerId: 'c', total: 500, paid: 200 }), sale({ id: '2', customerId: 'c', type: 'return', total: 50, paid: 0 }), sale({ id: '3', customerId: 'other', total: 999 })]
  const payments: Payment[] = [{ id: 'p', updatedAt: 0, date: 0, partyType: 'customer', partyId: 'c', partyName: 'c', amount: 150 }, { id: 'p2', updatedAt: 0, date: 0, partyType: 'supplier', partyId: 'c', partyName: 'c', amount: 999 }]
  it('customer: opening + unpaid sales − unpaid returns − payments', () => {
    expect(customerBalance(c, sales, payments)).toBe(100 + 300 - 50 - 150)
  })
  it('supplier: opening + unpaid purchases − payments', () => {
    const s: Supplier = { id: 's', updatedAt: 0, name: 's', openingBalance: 0, createdAt: 0 }
    const purchases: Purchase[] = [{ id: 'q', updatedAt: 0, number: 1, type: 'purchase', date: 0, supplierId: 's', supplierName: 's', items: [], total: 1000, paid: 400 }]
    const pays: Payment[] = [{ id: 'p', updatedAt: 0, date: 0, partyType: 'supplier', partyId: 's', partyName: 's', amount: 100 }]
    expect(supplierBalance(s, purchases, pays)).toBe(500)
  })
  it('cash box: money in minus money out', () => {
    const lines = cashLines(sales, [], payments, [{ id: 'e', updatedAt: 0, date: 0, category: 'x', amount: 30 }], [{ id: 'k', updatedAt: 0, date: 0, direction: 'out', amount: 20 }])
    expect(lines.reduce((t, l) => t + l.amount, 0)).toBe(200 + 150 - 999 - 30 - 20)
  })
})

describe('text and numbers', () => {
  it('reads Arabic digits and separators', () => { expect(toNumber('١٢٬٥٠٠')).toBe(12500); expect(toNumber('1,250.5')).toBe(1250.5); expect(toNumber('')).toBe(0) })
  it('searches without caring about hamza, ta marbuta or case', () => {
    expect(norm('فلتر هواء أمامي')).toBe('فلتر هواء امامي')
    expect(matches('فلتر هوا', 'فلتر هواء', 'FLT-002')).toBe(true)
    expect(matches('flt-002', 'فلتر هواء', 'FLT-002')).toBe(true)
    expect(matches('زيت', 'فلتر هواء', 'FLT-002')).toBe(false)
  })
})
