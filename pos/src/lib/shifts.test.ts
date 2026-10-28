import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import type { Sale, Refund, Expense, CashMove, LedgerEntry, User } from '../db/types'
import { summarizeShift, openShift, closeShift, addCashMove, shiftSummary, shiftDifference, shiftMinutes, ShiftError } from './shifts'

const user: User = { id: 'u1', name: 'Sami', role: 'cashier', active: true, createdAt: 0 }
const admin: User = { id: 'u2', name: 'Boss', role: 'admin', active: true, createdAt: 0 }

function sale(o: Partial<Sale> & { total: number; payments: Sale['payments'] }, shiftId = 'sh'): Sale {
  return {
    id: o.id ?? Math.random().toString(36).slice(2), number: 1, createdAt: 1, items: [], subtotal: o.total, discount: 0, tax: 0,
    cost: 0, paid: o.paid ?? o.total, change: o.change ?? 0, credit: o.credit ?? 0, userId: 'u1', userName: 'Sami', shiftId,
    status: 'completed', refunded: 0, ...o,
  }
}
function refund(total: number, method: Refund['method'], shiftId = 'sh'): Refund {
  return { id: Math.random().toString(36).slice(2), saleId: 's', saleNumber: 1, createdAt: 2, items: [], total, method, restock: true, userId: 'u1', userName: 'Sami', shiftId }
}
const expense = (amount: number, shiftId: string | undefined = 'sh'): Expense => ({ id: Math.random().toString(36).slice(2), amount, category: 'rent', createdAt: 3, userId: 'u1', shiftId })
const cash = (type: 'in' | 'out', amount: number): CashMove => ({ id: Math.random().toString(36).slice(2), shiftId: 'sh', type, amount, createdAt: 4, userId: 'u1' })
const ledger = (type: LedgerEntry['type'], amount: number, method?: LedgerEntry['method']): LedgerEntry => ({ id: Math.random().toString(36).slice(2), customerId: 'c', type, amount, balanceAfter: 0, createdAt: 5, userId: 'u1', shiftId: 'sh', method })

describe('summarizeShift (pure)', () => {
  it('adds up an ordinary shift', () => {
    const s = summarizeShift({ openingCash: 1000 }, {
      sales: [
        sale({ total: 500, payments: [{ method: 'cash', amount: 500 }], paid: 1000, change: 500 }),   // cash net of change
        sale({ total: 300, payments: [{ method: 'card', amount: 300 }] }),
        sale({ total: 200, payments: [{ method: 'transfer', amount: 200 }] }),
        sale({ total: 400, payments: [{ method: 'cash', amount: 100 }, { method: 'credit', amount: 300 }], paid: 100, credit: 300 }),
      ],
      refunds: [refund(50, 'cash'), refund(80, 'card'), refund(20, 'credit')],
      expenses: [expense(120), expense(30)],
      cashMoves: [cash('in', 200), cash('out', 70)],
      ledger: [ledger('payment', -250, 'cash'), ledger('payment', -100, 'card'), ledger('sale', 300, 'credit')],
    }, 0)
    expect(s.salesCount).toBe(4)
    expect(s.salesTotal).toBe(1400)
    expect(s.byMethod).toEqual({ cash: 600, card: 300, transfer: 200, credit: 300 })
    expect(s.creditGiven).toBe(300)
    expect(s.refundsCount).toBe(3)
    expect(s.refundsTotal).toBe(150)
    expect(s.refundsCash).toBe(50)
    expect(s.refundsByMethod).toEqual({ cash: 50, card: 80, transfer: 0, credit: 20 })
    expect(s.expensesCash).toBe(150)
    expect(s.expensesCount).toBe(2)
    expect(s.cashIn).toBe(200)
    expect(s.cashOut).toBe(70)
    expect(s.customerPaymentsCash).toBe(250)
    // 1000 + 600 − 50 + 250 + 200 − 70 − 150
    expect(s.expectedCash).toBe(1780)
  })
  it('is just the opening cash for an empty shift', () => {
    const s = summarizeShift({ openingCash: 250 }, { sales: [], refunds: [], expenses: [], cashMoves: [], ledger: [] })
    expect(s.expectedCash).toBe(250)
    expect(s.salesCount).toBe(0)
    expect(s.byMethod.cash).toBe(0)
  })
  it('rounds to the currency decimals', () => {
    const s = summarizeShift({ openingCash: 10 }, {
      sales: [sale({ total: 0.1, payments: [{ method: 'cash', amount: 0.1 }] }), sale({ total: 0.2, payments: [{ method: 'cash', amount: 0.2 }] })],
      refunds: [], expenses: [], cashMoves: [], ledger: [],
    }, 2)
    expect(s.byMethod.cash).toBe(0.3)
    expect(s.expectedCash).toBe(10.3)
  })
  it('treats a cash payout to a customer (negative balance) as cash leaving the drawer', () => {
    const s = summarizeShift({ openingCash: 100 }, { sales: [], refunds: [], expenses: [], cashMoves: [], ledger: [ledger('payment', 40, 'cash')] }, 0)
    expect(s.customerPaymentsCash).toBe(-40)
    expect(s.expectedCash).toBe(60)
  })
})

describe('shift lifecycle (db)', () => {
  beforeEach(async () => { await db.delete(); await db.open() })

  it('opens one shift at a time', async () => {
    const sh = await openShift({ user, openingCash: 500, decimals: 0 })
    expect(sh.status).toBe('open')
    expect(sh.openingCash).toBe(500)
    await expect(openShift({ user: admin, openingCash: 0 })).rejects.toBeInstanceOf(ShiftError)
    await expect(openShift({ user: admin, openingCash: 0 })).rejects.toMatchObject({ key: 'shifts.err.alreadyOpen' })
    expect(await db.shifts.count()).toBe(1)
  })

  it('records cash moves and keeps the shift totals in step', async () => {
    const sh = await openShift({ user, openingCash: 100, decimals: 0 })
    await addCashMove({ shiftId: sh.id, type: 'in', amount: 50, note: 'change float', user, decimals: 0 })
    await addCashMove({ shiftId: sh.id, type: 'out', amount: 20, user, decimals: 0 })
    await expect(addCashMove({ shiftId: sh.id, type: 'out', amount: 0, user })).rejects.toMatchObject({ key: 'shifts.err.amount' })
    const row = (await db.shifts.get(sh.id))!
    expect(row.cashIn).toBe(50)
    expect(row.cashOut).toBe(20)
    expect(await db.cashMoves.where('shiftId').equals(sh.id).count()).toBe(2)
    const s = (await shiftSummary(sh.id, 0))!
    expect(s.expectedCash).toBe(130)
  })

  it('closes with expected and counted cash stored, then allows a new shift', async () => {
    const sh = await openShift({ user, openingCash: 1000, decimals: 0 })
    await db.sales.add(sale({ id: 's1', total: 700, payments: [{ method: 'cash', amount: 700 }] }, sh.id))
    await db.refunds.add(refund(100, 'cash', sh.id))
    await db.expenses.add(expense(50, sh.id))
    await db.expenses.add(expense(999, undefined))   // not from the drawer: ignored
    await db.ledger.add({ ...ledger('payment', -200, 'cash'), shiftId: sh.id })
    const { shift, summary } = await closeShift({ shiftId: sh.id, countedCash: 1800, note: ' ok ', decimals: 0 })
    expect(summary.expectedCash).toBe(1750)
    expect(shift.status).toBe('closed')
    expect(shift.expectedCash).toBe(1750)
    expect(shift.closingCash).toBe(1800)
    expect(shift.note).toBe('ok')
    expect(shift.closedAt).toBeTypeOf('number')
    expect(shiftDifference(shift, 0)).toBe(50)
    const stored = (await db.shifts.get(sh.id))!
    expect(stored.status).toBe('closed')
    expect(stored.expectedCash).toBe(1750)
    await expect(closeShift({ shiftId: sh.id, countedCash: 0 })).rejects.toMatchObject({ key: 'shifts.err.notOpen' })
    const next = await openShift({ user: admin, openingCash: 300 })
    expect(next.id).not.toBe(sh.id)
  })

  it('returns null for an unknown shift', async () => {
    expect(await shiftSummary('nope')).toBeNull()
  })

  it('measures the shift length', () => {
    expect(shiftMinutes({ openedAt: 0, closedAt: 90 * 60000 })).toBe(90)
    expect(shiftMinutes({ openedAt: 1000 }, 1000 + 5 * 60000)).toBe(5)
  })
})
