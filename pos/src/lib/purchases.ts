// Purchases: goods bought from a supplier. createPurchase() does everything in ONE transaction:
// numbers the invoice, moves stock in (StockMove type 'purchase'), updates each product's cost (never its
// price) and books what is still owed on the supplier (supplier.balance += total − paid).
//
// Supplier payments: a payment made later is stored as a Purchase with NO items, total 0 and `paid` set
// (isSupplierPayment). It gets its own number from the same counter, so the purchases list shows invoices
// and payments in one sequence and the supplier's statement adds up: balance = Σ(total − paid).
//
// Paying from the cash drawer: when `drawerShiftId` is given, a CashMove 'out' is written on that shift
// for the cash paid, so the shift's expected cash goes down. Deleting the purchase writes the opposite
// CashMove when that shift is still open (money that already left a closed drawer cannot come back).
import { db, nextNumber } from '../db'
import type { ID, PaymentMethod, Purchase, PurchaseItem, User } from '../db/types'
import { applyStock } from './stock'
import { uid } from './ids'
import { round } from './money'

/** A refusal the UI can show: `key` is an i18n key (inventory.err.*). */
export class PurchaseError extends Error {
  key: string
  constructor(key: string) { super(key); this.name = 'PurchaseError'; this.key = key }
}

/** Purchase plus the fields this module records on top of the shared type (stored as-is in IndexedDB). */
export interface PurchaseRecord extends Purchase {
  method?: PaymentMethod
  /** The shift whose drawer the cash came from. */
  shiftId?: ID
}

export interface PurchaseLineInput { productId: ID; name: string; qty: number; cost: number }

export interface CreatePurchaseInput {
  supplierId?: ID
  items: PurchaseLineInput[]
  paid: number
  method?: PaymentMethod
  note?: string
  user: User
  decimals?: number
  /** Write a cash-out on this (open) shift for the cash paid now. */
  drawerShiftId?: ID
}

export const isSupplierPayment = (p: Purchase): boolean => p.items.length === 0

export function purchaseTotal(items: Pick<PurchaseItem, 'qty' | 'cost'>[], decimals = 2): number {
  return round(items.reduce((s, i) => s + round(i.qty * i.cost, decimals), 0), decimals)
}
export function purchaseRemaining(p: Pick<Purchase, 'total' | 'paid'>, decimals = 2): number {
  return round(p.total - p.paid, decimals)
}

const PURCHASE_TABLES = () => [db.purchases, db.products, db.stockMoves, db.suppliers, db.kv, db.cashMoves, db.shifts]

export async function createPurchase(input: CreatePurchaseInput): Promise<PurchaseRecord> {
  const d = input.decimals ?? 2
  const items: PurchaseItem[] = input.items
    .map(i => ({ productId: i.productId, name: i.name.trim(), qty: round(i.qty, 3), cost: round(i.cost, d) }))
    .filter(i => i.qty > 0)
  if (!items.length) throw new PurchaseError('inventory.err.noItems')
  if (items.some(i => i.cost < 0)) throw new PurchaseError('inventory.err.cost')
  const total = purchaseTotal(items, d)
  const paid = round(input.paid, d)
  if (paid < 0 || paid > total) throw new PurchaseError('inventory.err.paid')
  const at = Date.now()
  return db.transaction('rw', PURCHASE_TABLES(), async () => {
    const supplier = input.supplierId ? await db.suppliers.get(input.supplierId) : undefined
    const number = await nextNumber('purchase')
    const purchase: PurchaseRecord = {
      id: uid(), number, createdAt: at, supplierId: supplier?.id, supplierName: supplier?.name,
      items, total, paid, note: input.note?.trim() || undefined, userId: input.user.id,
      method: paid > 0 ? input.method ?? 'cash' : undefined,
    }
    await applyStock(items.map(i => ({ productId: i.productId, qty: i.qty, type: 'purchase' as const, refId: purchase.id, note: `#${number}`, userId: input.user.id })), at)
    for (const i of items) {
      const p = await db.products.get(i.productId)
      if (p && p.cost !== i.cost) await db.products.update(p.id, { cost: i.cost, updatedAt: at })
    }
    if (supplier) await db.suppliers.update(supplier.id, { balance: round(supplier.balance + total - paid, d) })
    if (input.drawerShiftId && paid > 0 && purchase.method === 'cash') {
      purchase.shiftId = await cashOutOfDrawer(input.drawerShiftId, paid, `#${number}`, input.user, d, at)
    }
    await db.purchases.add(purchase)
    return purchase
  })
}

/** A payment to a supplier, outside an invoice. Lowers supplier.balance; stored as an item-less Purchase. */
export async function paySupplier(o: { supplierId: ID; amount: number; method?: PaymentMethod; note?: string; user: User; decimals?: number; drawerShiftId?: ID }): Promise<PurchaseRecord> {
  const d = o.decimals ?? 2
  const amount = round(o.amount, d)
  if (!(amount > 0)) throw new PurchaseError('inventory.err.amount')
  const at = Date.now()
  return db.transaction('rw', PURCHASE_TABLES(), async () => {
    const supplier = await db.suppliers.get(o.supplierId)
    if (!supplier) throw new PurchaseError('inventory.err.noSupplier')
    const number = await nextNumber('purchase')
    const purchase: PurchaseRecord = {
      id: uid(), number, createdAt: at, supplierId: supplier.id, supplierName: supplier.name,
      items: [], total: 0, paid: amount, note: o.note?.trim() || undefined, userId: o.user.id, method: o.method ?? 'cash',
    }
    await db.suppliers.update(supplier.id, { balance: round(supplier.balance - amount, d) })
    if (o.drawerShiftId && purchase.method === 'cash') purchase.shiftId = await cashOutOfDrawer(o.drawerShiftId, amount, `#${number}`, o.user, d, at)
    await db.purchases.add(purchase)
    return purchase
  })
}

/**
 * Removes a purchase (or a supplier payment) and undoes its effects: stock goes back out (StockMove 'adjust'
 * with the invoice number in the note), the supplier balance is corrected, and cash paid from a still-open
 * drawer comes back in. Product costs are left as they are (the next purchase sets them again).
 */
export async function deletePurchase(id: ID, user: User, decimals = 2): Promise<void> {
  const at = Date.now()
  await db.transaction('rw', PURCHASE_TABLES(), async () => {
    const p = (await db.purchases.get(id)) as PurchaseRecord | undefined
    if (!p) return
    if (p.items.length) {
      await applyStock(p.items.map(i => ({ productId: i.productId, qty: -i.qty, type: 'adjust' as const, refId: p.id, note: `#${p.number}`, userId: user.id })), at)
    }
    if (p.supplierId) {
      const s = await db.suppliers.get(p.supplierId)
      if (s) await db.suppliers.update(s.id, { balance: round(s.balance - (p.total - p.paid), decimals) })
    }
    if (p.shiftId && p.paid > 0) {
      const shift = await db.shifts.get(p.shiftId)
      if (shift && shift.status === 'open') {
        await db.cashMoves.add({ id: uid(), shiftId: shift.id, type: 'in', amount: p.paid, note: `#${p.number}`, createdAt: at, userId: user.id })
        await db.shifts.update(shift.id, { cashIn: round(shift.cashIn + p.paid, decimals) })
      }
    }
    await db.purchases.delete(p.id)
  })
}

/** Writes a cash-out on an open shift; returns the shift id, or undefined when the shift is not open. */
async function cashOutOfDrawer(shiftId: ID, amount: number, note: string, user: User, decimals: number, at: number): Promise<ID | undefined> {
  const shift = await db.shifts.get(shiftId)
  if (!shift || shift.status !== 'open') return undefined
  await db.cashMoves.add({ id: uid(), shiftId: shift.id, type: 'out', amount, note, createdAt: at, userId: user.id })
  await db.shifts.update(shift.id, { cashOut: round(shift.cashOut + amount, decimals) })
  return shift.id
}
