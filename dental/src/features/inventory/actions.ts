// Inventory writes. Every quantity change is a StockMovement written in the same transaction as the item,
// so item.quantity always equals the sum of its movements (the dashboard and notifications read it directly).
import { db } from '@/db'
import { newId, nowISO, todayISO } from '@/db/ids'
import type { Expense, ID, ISODate, InventoryItem, StockReason } from '@/db/types'
import { round2 } from '@/lib/format'
import { canDeleteItem } from './lib'

export type ItemDraft = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>

export class StockError extends Error {
  constructor(public code: 'notFound' | 'notEnough' | 'hasMovements') { super(code) }
}

/** Adds an item; a positive opening quantity is recorded as an 'initial' movement. */
export async function createItem(draft: ItemDraft, by?: ID): Promise<ID> {
  const id = newId()
  const now = nowISO()
  const quantity = Math.max(0, round2(draft.quantity || 0))
  await db.transaction('rw', db.inventory, db.stock, async () => {
    await db.inventory.add({ ...draft, quantity, id, createdAt: now, updatedAt: now })
    if (quantity > 0) await db.stock.add({ id: newId(), itemId: id, delta: quantity, reason: 'initial', date: todayISO(), by, createdAt: now })
  })
  return id
}

/** Updates the descriptive fields; the quantity is kept (it only changes through movements). */
export async function updateItem(id: ID, draft: ItemDraft): Promise<void> {
  await db.transaction('rw', db.inventory, async () => {
    const cur = await db.inventory.get(id)
    if (!cur) throw new StockError('notFound')
    await db.inventory.put({ ...cur, ...draft, id, quantity: cur.quantity, createdAt: cur.createdAt, updatedAt: nowISO() })
  })
}

export async function setItemActive(id: ID, active: boolean): Promise<void> {
  await db.inventory.update(id, { active, updatedAt: nowISO() })
}

/** Applies a signed quantity change and records it. Resolves to the new quantity; never lets stock go below zero. */
export async function recordMovement(itemId: ID, delta: number, reason: StockReason, opts: { note?: string; by?: ID; date?: ISODate } = {}): Promise<number> {
  let after = 0
  await db.transaction('rw', db.inventory, db.stock, async () => {
    const item = await db.inventory.get(itemId)
    if (!item) throw new StockError('notFound')
    after = round2(item.quantity + delta)
    if (after < 0) throw new StockError('notEnough')
    const now = nowISO()
    await db.inventory.update(itemId, { quantity: after, updatedAt: now })
    await db.stock.add({ id: newId(), itemId, delta: round2(delta), reason, date: opts.date ?? todayISO(), note: opts.note?.trim() || undefined, by: opts.by, createdAt: now })
  })
  return after
}

export interface PurchaseInput {
  lines: { itemId: ID; quantity: number; costPrice: number | null }[]
  date: ISODate
  supplier?: string
  reference?: string
  by?: ID
  /** When set, the purchase total is also recorded as a 'materials' expense with this description. */
  expenseDescription?: string
}
/** Several items in one go: quantities up, cost prices refreshed, one 'purchase' movement per line. Returns the total. */
export async function recordPurchase(p: PurchaseInput): Promise<{ total: number; count: number; expenseId?: ID }> {
  let total = 0, count = 0
  let expenseId: ID | undefined
  const supplier = p.supplier?.trim() || undefined
  const reference = p.reference?.trim() || undefined
  const note = [supplier, reference].filter(Boolean).join(' · ') || undefined
  await db.transaction('rw', db.inventory, db.stock, db.expenses, async () => {
    const now = nowISO()
    for (const l of p.lines) {
      const item = await db.inventory.get(l.itemId)
      if (!item || !(l.quantity > 0)) continue
      const cost = l.costPrice !== null && Number.isFinite(l.costPrice) && l.costPrice >= 0 ? round2(l.costPrice) : item.costPrice
      await db.inventory.put({ ...item, quantity: round2(item.quantity + l.quantity), costPrice: cost, supplier: supplier ?? item.supplier, updatedAt: now })
      await db.stock.add({ id: newId(), itemId: item.id, delta: round2(l.quantity), reason: 'purchase', date: p.date, note, by: p.by, createdAt: now })
      total += l.quantity * (cost || 0)
      count++
    }
    total = round2(total)
    if (p.expenseDescription && total > 0) {
      const e: Expense = { id: newId(), category: 'materials', amount: total, date: p.date, description: p.expenseDescription, vendor: supplier, by: p.by, createdAt: now }
      await db.expenses.add(e)
      expenseId = e.id
    }
  })
  return { total, count, expenseId }
}

/** Deletes an item whose history is only its opening stock (that movement goes with it). */
export async function deleteItem(id: ID): Promise<void> {
  await db.transaction('rw', db.inventory, db.stock, async () => {
    const moves = await db.stock.where('itemId').equals(id).toArray()
    if (!canDeleteItem(moves)) throw new StockError('hasMovements')
    await db.stock.bulkDelete(moves.map(m => m.id))
    await db.inventory.delete(id)
  })
}

/** True when the item has movements other than its opening stock. Read-only. */
export async function hasRealMovements(id: ID): Promise<boolean> {
  const moves = await db.stock.where('itemId').equals(id).toArray()
  return !canDeleteItem(moves)
}
