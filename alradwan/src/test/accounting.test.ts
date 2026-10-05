import { describe, expect, it } from 'vitest'
import { ACC, FIXED_ACCOUNTS, accountsOf, agingReport, balanceSheet, buildJournal, incomeStatement, ledger, trialBalance, type Books } from '../lib/accounting'
import type { Customer, Product, Sale, Payment, Purchase, Expense, CashEntry, StockMovement, Supplier } from '../db/types'

const D = 86400000
const t0 = Date.parse('2026-01-01')
function books(): Books {
  const products = new Map<string, Product>([['p1', { id: 'p1', updatedAt: 0, code: 'P1', name: 'فلتر', unit: 'قطعة', cost: 100, price: 150, minStock: 1, openingStock: 10, kind: 'product', createdAt: t0 }]])
  const customers = new Map<string, Customer>([['c1', { id: 'c1', updatedAt: 0, name: 'أحمد', openingBalance: 500, createdAt: t0 }]])
  const suppliers = new Map<string, Supplier>([['s1', { id: 's1', updatedAt: 0, name: 'مورد', openingBalance: 0, createdAt: t0 }]])
  const item = { productId: 'p1', name: 'فلتر', qty: 2, price: 150, cost: 100, discount: 0, kind: 'product' as const }
  const sales = new Map<string, Sale>([
    ['sale1', { id: 'sale1', updatedAt: 0, number: 1, type: 'sale', date: t0 + 1 * D, customerId: 'c1', customerName: 'أحمد', items: [item], subtotal: 300, discount: 0, total: 300, paid: 100 }],
    ['q1', { id: 'q1', updatedAt: 0, number: 2, type: 'quote', date: t0 + 1 * D, customerName: 'x', items: [item], subtotal: 300, discount: 0, total: 300, paid: 0 }],
    ['ret1', { id: 'ret1', updatedAt: 0, number: 3, type: 'return', date: t0 + 2 * D, customerId: 'c1', customerName: 'أحمد', items: [{ ...item, qty: 1 }], subtotal: 150, discount: 0, total: 150, paid: 150 }],
  ])
  const purchases = new Map<string, Purchase>([['pu1', { id: 'pu1', updatedAt: 0, number: 1, type: 'purchase', date: t0 + 3 * D, supplierId: 's1', supplierName: 'مورد', items: [{ productId: 'p1', name: 'فلتر', qty: 5, cost: 100 }], total: 500, paid: 200 }]])
  const payments = new Map<string, Payment>([['pay1', { id: 'pay1', updatedAt: 0, date: t0 + 4 * D, partyType: 'customer', partyId: 'c1', partyName: 'أحمد', amount: 50 }]])
  const expenses = new Map<string, Expense>([['e1', { id: 'e1', updatedAt: 0, date: t0 + 5 * D, category: 'إيجار', amount: 80 }]])
  const cash = new Map<string, CashEntry>([['k1', { id: 'k1', updatedAt: 0, date: t0 + 6 * D, direction: 'out', amount: 30 }]])
  const movements = new Map<string, StockMovement>([['m1', { id: 'm1', updatedAt: 0, productId: 'p1', date: t0 + 7 * D, qty: -1, reason: 'adjust' }]])
  return { products, customers, suppliers, sales, purchases, payments, expenses, cash, movements, journal: new Map() }
}

describe('accounting', () => {
  const b = books(); const entries = buildJournal(b); const accounts = accountsOf(entries)
  it('every entry balances and quotations produce none', () => {
    for (const e of entries) { const d = e.lines.reduce((t, l) => t + l.debit, 0), c = e.lines.reduce((t, l) => t + l.credit, 0); expect(Math.abs(d - c)).toBeLessThan(0.01) }
    expect(entries.some(e => e.id.includes('q1'))).toBe(false)
  })
  it('trial balance totals agree', () => {
    const tb = trialBalance(entries, accounts, 0, t0 + 30 * D)
    const d = tb.reduce((t, r) => t + r.debit, 0), c = tb.reduce((t, r) => t + r.credit, 0)
    expect(Math.abs(d - c)).toBeLessThan(0.01)
  })
  it('ledger of cash follows the money', () => {
    // sale paid 100, return refunded 150, purchase paid 200, customer paid 50, expense 80, drawing 30
    const cashAcc = FIXED_ACCOUNTS.find(a => a.code === ACC.cash)!
    const l = ledger(entries, cashAcc, 0, t0 + 30 * D)
    expect(l.closing).toBe(100 - 150 - 200 + 50 - 80 - 30)
    expect(l.rows.length).toBe(6)
  })
  it('income statement: sales, returns, cost, expenses, stock loss', () => {
    const inc = incomeStatement(entries, 0, t0 + 30 * D)
    expect(inc.sales).toBe(300); expect(inc.returns).toBe(150); expect(inc.netSales).toBe(150)
    expect(inc.cogs).toBe(200 - 100)      // 2 sold at cost 100, 1 came back
    expect(inc.grossProfit).toBe(50)
    expect(inc.totalExpenses).toBe(80); expect(inc.stockDiff).toBe(100)
    expect(inc.netProfit).toBe(50 - 80 - 100)
  })
  it('balance sheet balances', () => {
    const bs = balanceSheet(entries, t0 + 30 * D)
    expect(bs.balanced).toBe(true)
    expect(bs.inventory).toBe(10 * 100 - 200 + 100 + 500 - 100)
    expect(bs.receivable).toBe(500 + 200 - 0 - 50)   // opening 500, unpaid 200 of the sale, return refunded in cash, payment 50
    expect(bs.payable).toBe(300)
  })
  it('aging settles the oldest debts first', () => {
    const rows = agingReport(b.customers, b.sales, b.payments, t0 + 100 * D)
    expect(rows.length).toBe(1)
    expect(rows[0].total).toBe(650)   // opening 500 + 200 unpaid − 50 paid (the return was refunded in cash)
    expect(rows[0].buckets[3]).toBe(650)  // everything older than 90 days
  })
})

describe('accounting — refunds, cash kinds, stable valuation', () => {
  it('a negative payment refunds the customer and reverses the entry', () => {
    const b = books()
    b.payments.set('ref1', { id: 'ref1', updatedAt: 0, date: t0 + 8 * D, partyType: 'customer', partyId: 'c1', partyName: 'أحمد', amount: -20 })
    const entries = buildJournal(b)
    const e = entries.find(x => x.id === 'pay-ref1')!
    expect(e.lines.find(l => l.account === ACC.cash)!.credit).toBe(20)
    expect(e.lines.find(l => l.account === ACC.receivable)!.debit).toBe(20)
    const bs = balanceSheet(entries, t0 + 30 * D)
    expect(bs.balanced).toBe(true)
    expect(bs.receivable).toBe(500 + 200 - 50 + 20)
  })
  it('cash entries post to capital, other income or loans by kind', () => {
    const b = books()
    b.cash.set('k2', { id: 'k2', updatedAt: 0, date: t0 + 9 * D, direction: 'in', kind: 'loan', amount: 1000 })
    b.cash.set('k3', { id: 'k3', updatedAt: 0, date: t0 + 9 * D, direction: 'in', kind: 'income', amount: 70 })
    const entries = buildJournal(b)
    const bs = balanceSheet(entries, t0 + 30 * D)
    expect(bs.accrued).toBe(1000)
    expect(incomeStatement(entries, 0, t0 + 30 * D).otherIncome).toBe(70)
    expect(bs.balanced).toBe(true)
  })
  it('opening stock is valued at the cost of the day it was entered, not today\'s', () => {
    const b = books()
    const p = b.products.get('p1')!
    b.products.set('p1', { ...p, cost: 130, openingCost: 100 })
    const bs = balanceSheet(buildJournal(b), t0)
    expect(bs.inventory).toBe(10 * 100)
  })
  it('rounding never unbalances an entry', () => {
    const b = books()
    const s = b.sales.get('sale1')!
    b.sales.set('sale1', { ...s, total: 10.01, subtotal: 10.01, paid: 5.005 })
    for (const e of buildJournal(b)) { const d = e.lines.reduce((t, l) => t + l.debit, 0), c = e.lines.reduce((t, l) => t + l.credit, 0); expect(Math.abs(d - c)).toBeLessThan(0.005) }
  })
})
