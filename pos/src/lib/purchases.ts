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
//
// Invoices in the second currency (`fx`): the lines are typed in it (`fxCost`), the primary `cost`/`total`/`paid` are
// derived at the invoice's own rate, and the invoice as the supplier wrote it is kept in `purchase.fx`. Such an invoice
// moves `supplier.fxBalance` (what we owe in that currency) and leaves `balance` alone; a primary-currency invoice does
// the opposite. The drawer is always counted in the primary currency.
//
// Cost basis: a line bought in the second currency sets the product's `fxCost` (buying in $ IS the cost basis, anchored
// or not) and its derived `cost`; a primary-currency line on a product with `fxCost` sets `cost` and re-expresses
// `fxCost` at the current rate (`currency2`), or drops it when no rate is known. The price is never touched.
import { db, nextNumber } from '../db'
import type { ID, PaymentMethod, Purchase, PurchaseFx, PurchaseItem, SecondCurrency, User } from '../db/types'
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

/** A typed line; `fxCost` is the unit cost in the invoice's second currency (used when the invoice has `fx`). */
export interface PurchaseLineInput { productId: ID; name: string; qty: number; cost: number; fxCost?: number }
/** The second currency an invoice (or a payment) is written in, with the rate that applies to it. */
export type PurchaseFxInput = Omit<PurchaseFx, 'total' | 'paid'>

export interface CreatePurchaseInput {
  supplierId?: ID
  items: PurchaseLineInput[]
  /** What was paid now: in the primary currency, or in `fx` when the invoice is in the second currency. */
  paid: number
  method?: PaymentMethod
  note?: string
  user: User
  decimals?: number
  /** Write a cash-out on this (open) shift for the cash paid now. */
  drawerShiftId?: ID
  /** The invoice is in the second currency at this rate. */
  fx?: PurchaseFxInput
  /** The shop's second currency (its current rate re-expresses `fxCost` after a primary-currency line). */
  currency2?: Pick<SecondCurrency, 'rate'>
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
  const fxIn = input.fx
  if (fxIn && !(fxIn.rate > 0)) throw new PurchaseError('inventory.err.rate')
  const fd = fxIn?.decimals ?? 2
  const items: PurchaseItem[] = input.items
    .map(i => {
      const base = { productId: i.productId, name: i.name.trim(), qty: round(i.qty, 3) }
      if (!fxIn) return { ...base, cost: round(i.cost, d) }
      const fxCost = round(typeof i.fxCost === 'number' ? i.fxCost : i.cost / fxIn.rate, fd)
      return { ...base, cost: round(fxCost * fxIn.rate, d), fxCost }
    })
    .filter(i => i.qty > 0)
  if (!items.length) throw new PurchaseError('inventory.err.noItems')
  if (items.some(i => i.cost < 0 || (i.fxCost ?? 0) < 0)) throw new PurchaseError('inventory.err.cost')
  // the invoice's own figures decide validity; the primary figures are derived from them at its rate
  let fx: PurchaseFx | undefined
  let total: number, paid: number
  if (fxIn) {
    const fxTotal = purchaseTotal(items.map(i => ({ qty: i.qty, cost: i.fxCost! })), fd)
    const fxPaid = round(input.paid, fd)
    if (fxPaid < 0 || fxPaid > fxTotal) throw new PurchaseError('inventory.err.paid')
    fx = { ...fxIn, total: fxTotal, paid: fxPaid }
    total = round(fxTotal * fxIn.rate, d)
    paid = round(fxPaid * fxIn.rate, d)
  } else {
    total = purchaseTotal(items, d)
    paid = round(input.paid, d)
    if (paid < 0 || paid > total) throw new PurchaseError('inventory.err.paid')
  }
  const at = Date.now()
  return db.transaction('rw', PURCHASE_TABLES(), async () => {
    const supplier = input.supplierId ? await db.suppliers.get(input.supplierId) : undefined
    const number = await nextNumber('purchase')
    const purchase: PurchaseRecord = {
      id: uid(), number, createdAt: at, supplierId: supplier?.id, supplierName: supplier?.name,
      items, total, paid, note: input.note?.trim() || undefined, userId: input.user.id,
      method: paid > 0 ? input.method ?? 'cash' : undefined,
      ...(fx ? { fx } : {}),
    }
    await applyStock(items.map(i => ({ productId: i.productId, qty: i.qty, type: 'purchase' as const, refId: purchase.id, note: `#${number}`, userId: input.user.id })), at)
    for (const i of items) {
      const p = await db.products.get(i.productId)
      if (!p) continue
      if (typeof i.fxCost === 'number') {
        if (p.cost !== i.cost || p.fxCost !== i.fxCost) await db.products.update(p.id, { cost: i.cost, fxCost: i.fxCost, updatedAt: at })
      } else if (typeof p.fxCost === 'number') {
        const rate = input.currency2?.rate ?? 0
        const fxCost = rate > 0 ? round(i.cost / rate, 2) : undefined
        if (p.cost !== i.cost || p.fxCost !== fxCost) await db.products.update(p.id, { cost: i.cost, fxCost, updatedAt: at })
      } else if (p.cost !== i.cost) await db.products.update(p.id, { cost: i.cost, updatedAt: at })
    }
    if (supplier) {
      if (fx) await db.suppliers.update(supplier.id, { fxBalance: round((supplier.fxBalance ?? 0) + fx.total - fx.paid, fd) })
      else await db.suppliers.update(supplier.id, { balance: round(supplier.balance + total - paid, d) })
    }
    if (input.drawerShiftId && paid > 0 && purchase.method === 'cash') {
      purchase.shiftId = await cashOutOfDrawer(input.drawerShiftId, paid, `#${number}`, input.user, d, at)
    }
    await db.purchases.add(purchase)
    return purchase
  })
}

/**
 * A payment to a supplier, outside an invoice. Lowers supplier.balance (or, with `fx`, `fxBalance` by `amount` in that
 * currency); stored as an item-less Purchase whose `paid` is always the primary equivalent (what left the drawer).
 */
export async function paySupplier(o: { supplierId: ID; amount: number; method?: PaymentMethod; note?: string; user: User; decimals?: number; drawerShiftId?: ID; fx?: PurchaseFxInput }): Promise<PurchaseRecord> {
  const d = o.decimals ?? 2
  if (o.fx && !(o.fx.rate > 0)) throw new PurchaseError('inventory.err.rate')
  const fxPaid = o.fx ? round(o.amount, o.fx.decimals) : 0
  const amount = o.fx ? round(fxPaid * o.fx.rate, d) : round(o.amount, d)
  if (!(amount > 0) || (o.fx && !(fxPaid > 0))) throw new PurchaseError('inventory.err.amount')
  const at = Date.now()
  return db.transaction('rw', PURCHASE_TABLES(), async () => {
    const supplier = await db.suppliers.get(o.supplierId)
    if (!supplier) throw new PurchaseError('inventory.err.noSupplier')
    const number = await nextNumber('purchase')
    const purchase: PurchaseRecord = {
      id: uid(), number, createdAt: at, supplierId: supplier.id, supplierName: supplier.name,
      items: [], total: 0, paid: amount, note: o.note?.trim() || undefined, userId: o.user.id, method: o.method ?? 'cash',
      ...(o.fx ? { fx: { ...o.fx, total: 0, paid: fxPaid } } : {}),
    }
    if (o.fx) await db.suppliers.update(supplier.id, { fxBalance: round((supplier.fxBalance ?? 0) - fxPaid, o.fx.decimals) })
    else await db.suppliers.update(supplier.id, { balance: round(supplier.balance - amount, d) })
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
      if (s && p.fx) await db.suppliers.update(s.id, { fxBalance: round((s.fxBalance ?? 0) - (p.fx.total - p.fx.paid), p.fx.decimals) })
      else if (s) await db.suppliers.update(s.id, { balance: round(s.balance - (p.total - p.paid), decimals) })
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
