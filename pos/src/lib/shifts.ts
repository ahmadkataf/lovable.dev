// Shifts: a cash-drawer session. One shift is open at a time for the whole store (not per user).
// Every number on the closing report comes from summarizeShift(), which only looks at what happened
// during the shift (sales, refunds, expenses, cash moves, customer payments), so the expected cash can
// always be re-derived from the records. Closing stores expectedCash and closingCash on the shift.
import { db } from '../db'
import type { CashMove, Expense, LedgerEntry, PaymentMethod, Refund, Sale, Shift, User } from '../db/types'
import { uid } from './ids'
import { round } from './money'

/** A refusal the UI can show: `key` is an i18n key (shifts.err.*). */
export class ShiftError extends Error {
  key: string
  constructor(key: string) { super(key); this.name = 'ShiftError'; this.key = key }
}

export interface ShiftData {
  sales: Sale[]
  refunds: Refund[]
  expenses: Expense[]
  cashMoves: CashMove[]
  ledger: LedgerEntry[]
}

export interface ShiftSummary {
  openingCash: number
  salesCount: number
  salesTotal: number
  /** What the sales took in, per method (cash is net of change; credit = what went on accounts). */
  byMethod: Record<PaymentMethod, number>
  refundsCount: number
  refundsTotal: number
  refundsCash: number
  refundsByMethod: Record<PaymentMethod, number>
  /** Expenses booked against this shift ("from the drawer"). */
  expensesCash: number
  expensesCount: number
  cashIn: number
  cashOut: number
  /** Customer debt paid in cash during the shift (ledger 'payment' entries with method cash). */
  customerPaymentsCash: number
  /** Sales put on customers' accounts. */
  creditGiven: number
  /** opening + cash sales − cash refunds + cash customer payments + in − out − cash expenses */
  expectedCash: number
}

const emptyMethods = (): Record<PaymentMethod, number> => ({ cash: 0, card: 0, credit: 0, transfer: 0 })

/** Pure: the summary of a shift from its records. */
export function summarizeShift(shift: Pick<Shift, 'openingCash'>, data: ShiftData, decimals = 2): ShiftSummary {
  const r = (n: number) => round(n, decimals)
  const byMethod = emptyMethods()
  const refundsByMethod = emptyMethods()
  let salesTotal = 0, creditGiven = 0
  for (const s of data.sales) {
    salesTotal += s.total
    creditGiven += s.credit
    for (const p of s.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount
  }
  let refundsTotal = 0
  for (const f of data.refunds) {
    refundsTotal += f.total
    refundsByMethod[f.method] = (refundsByMethod[f.method] ?? 0) + f.total
  }
  const expensesCash = data.expenses.reduce((s, e) => s + e.amount, 0)
  const cashIn = data.cashMoves.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0)
  const cashOut = data.cashMoves.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0)
  // a payment lowers the debt, so its amount is negative; the cash that came in is the opposite
  const customerPaymentsCash = data.ledger.filter(l => l.type === 'payment' && l.method === 'cash').reduce((s, l) => s - l.amount, 0)
  for (const k of Object.keys(byMethod) as PaymentMethod[]) { byMethod[k] = r(byMethod[k]); refundsByMethod[k] = r(refundsByMethod[k]) }
  const refundsCash = refundsByMethod.cash
  const openingCash = r(shift.openingCash)
  const expectedCash = r(openingCash + byMethod.cash - refundsCash + customerPaymentsCash + cashIn - cashOut - expensesCash)
  return {
    openingCash,
    salesCount: data.sales.length,
    salesTotal: r(salesTotal),
    byMethod,
    refundsCount: data.refunds.length,
    refundsTotal: r(refundsTotal),
    refundsCash,
    refundsByMethod,
    expensesCash: r(expensesCash),
    expensesCount: data.expenses.length,
    cashIn: r(cashIn),
    cashOut: r(cashOut),
    customerPaymentsCash: r(customerPaymentsCash),
    creditGiven: r(creditGiven),
    expectedCash,
  }
}

/** Everything recorded against a shift. Works inside a transaction that covers these tables, or on its own. */
export async function loadShiftData(shiftId: string): Promise<ShiftData> {
  const [sales, refunds, expenses, cashMoves, ledger] = await Promise.all([
    db.sales.where('shiftId').equals(shiftId).toArray(),
    db.refunds.where('shiftId').equals(shiftId).toArray(),
    db.expenses.where('shiftId').equals(shiftId).toArray(),
    db.cashMoves.where('shiftId').equals(shiftId).toArray(),
    db.ledger.where('shiftId').equals(shiftId).toArray(),
  ])
  return { sales, refunds, expenses, cashMoves, ledger }
}

/** The live summary of a shift (open or closed), or null when the shift does not exist. */
export async function shiftSummary(shiftId: string, decimals = 2): Promise<ShiftSummary | null> {
  const shift = await db.shifts.get(shiftId)
  if (!shift) return null
  return summarizeShift(shift, await loadShiftData(shiftId), decimals)
}

export const SHIFT_TABLES = [db.shifts, db.sales, db.refunds, db.expenses, db.cashMoves, db.ledger]

/** Opens a shift. Throws ShiftError('shifts.err.alreadyOpen') when one is already open. */
export async function openShift(o: { user: User; openingCash: number; decimals?: number }): Promise<Shift> {
  const at = Date.now()
  return db.transaction('rw', db.shifts, async () => {
    const open = await db.shifts.where('status').equals('open').first()
    if (open) throw new ShiftError('shifts.err.alreadyOpen')
    const shift: Shift = {
      id: uid(), userId: o.user.id, userName: o.user.name, openedAt: at,
      openingCash: round(Math.max(0, o.openingCash), o.decimals ?? 2), cashIn: 0, cashOut: 0, status: 'open',
    }
    await db.shifts.add(shift)
    return shift
  })
}

/** Money put in or taken out of the drawer (not a sale, not an expense). Keeps shift.cashIn / cashOut in step. */
export async function addCashMove(o: { shiftId: string; type: 'in' | 'out'; amount: number; note?: string; user: User; decimals?: number }): Promise<CashMove> {
  const amount = round(o.amount, o.decimals ?? 2)
  if (!(amount > 0)) throw new ShiftError('shifts.err.amount')
  const at = Date.now()
  return db.transaction('rw', db.shifts, db.cashMoves, async () => {
    const shift = await db.shifts.get(o.shiftId)
    if (!shift || shift.status !== 'open') throw new ShiftError('shifts.err.notOpen')
    const move: CashMove = { id: uid(), shiftId: shift.id, type: o.type, amount, note: o.note?.trim() || undefined, createdAt: at, userId: o.user.id }
    await db.cashMoves.add(move)
    await db.shifts.update(shift.id, o.type === 'in' ? { cashIn: round(shift.cashIn + amount, o.decimals ?? 2) } : { cashOut: round(shift.cashOut + amount, o.decimals ?? 2) })
    return move
  })
}

/** Closes the shift: stores what was expected and what was counted. Returns the closed shift and its summary. */
export async function closeShift(o: { shiftId: string; countedCash: number; note?: string; decimals?: number }): Promise<{ shift: Shift; summary: ShiftSummary }> {
  const d = o.decimals ?? 2
  const at = Date.now()
  return db.transaction('rw', SHIFT_TABLES, async () => {
    const shift = await db.shifts.get(o.shiftId)
    if (!shift || shift.status !== 'open') throw new ShiftError('shifts.err.notOpen')
    const summary = summarizeShift(shift, await loadShiftData(shift.id), d)
    const patch: Partial<Shift> = {
      status: 'closed', closedAt: at, closingCash: round(Math.max(0, o.countedCash), d), expectedCash: summary.expectedCash,
      cashIn: summary.cashIn, cashOut: summary.cashOut, note: o.note?.trim() || undefined,
    }
    await db.shifts.update(shift.id, patch)
    return { shift: { ...shift, ...patch }, summary }
  })
}

/** counted − expected: positive = over, negative = short. */
export function shiftDifference(shift: Pick<Shift, 'closingCash' | 'expectedCash'>, decimals = 2): number {
  return round((shift.closingCash ?? 0) - (shift.expectedCash ?? 0), decimals)
}

/** Shift length in whole minutes (until now while open). */
export function shiftMinutes(shift: Pick<Shift, 'openedAt' | 'closedAt'>, now = Date.now()): number {
  return Math.max(0, Math.round(((shift.closedAt ?? now) - shift.openedAt) / 60000))
}
