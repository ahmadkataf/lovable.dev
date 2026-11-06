// Customer debt: every change writes a LedgerEntry and updates the balance, so the statement always adds up.
import Dexie from 'dexie'
import { db } from '../db'
import type { LedgerType, PaymentMethod } from '../db/types'
import { uid } from './ids'
import { round } from './money'

export interface LedgerChange {
  customerId: string
  type: LedgerType
  amount: number          // + the customer owes more (a sale on credit), - owes less (a payment, a refund to the account)
  refId?: string
  note?: string
  method?: PaymentMethod
  userId: string
  shiftId?: string
}

/** Applies the change inside the current transaction (customers + ledger) or opens one. Returns the new balance. */
export async function applyLedger(c: LedgerChange, decimals = 2, at = Date.now()): Promise<number> {
  const run = async () => {
    const cust = await db.customers.get(c.customerId)
    if (!cust) throw new Error('customer not found')
    const balanceAfter = round(cust.balance + c.amount, decimals)
    await db.customers.update(cust.id, { balance: balanceAfter, updatedAt: at })
    await db.ledger.add({ id: uid(), customerId: cust.id, type: c.type, amount: round(c.amount, decimals), balanceAfter, refId: c.refId, note: c.note, method: c.method, createdAt: at, userId: c.userId, shiftId: c.shiftId })
    return balanceAfter
  }
  if (Dexie.currentTransaction) return run()
  return db.transaction('rw', db.customers, db.ledger, run)
}
