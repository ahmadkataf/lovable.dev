import { put, putMany, remove, useStore } from './store'
import type { Base, CashEntry, Expense, Payment, Product, Purchase, Sale, StockMovement } from './types'
import { newId } from '../lib/id'
import { saleTotals } from '../lib/calc'

// The business operations. An invoice and the stock movements it causes are always written together.

export function nextNumber(collection: 'sales' | 'purchases'): number {
  let max = 0
  for (const r of useStore.getState()[collection].values()) if (r.number > max) max = r.number
  return max + 1
}

function userId() { return useStore.getState().currentUserId ?? undefined }

function movementsOf(refId: string): StockMovement[] {
  const out: StockMovement[] = []
  for (const m of useStore.getState().movements.values()) if (m.refId === refId) out.push(m)
  return out
}

export type SaleInput = Omit<Sale, 'id' | 'updatedAt' | 'subtotal' | 'total' | 'number' | 'userId'> & { id?: string; number?: number }

/** Creates or replaces a sale (or a return) together with its stock movements. */
export async function saveSale(input: SaleInput): Promise<Sale> {
  const id = input.id ?? newId()
  const { subtotal, total } = saleTotals(input.items, input.discount)
  const sale: Sale = { ...input, id, number: input.number ?? nextNumber('sales'), subtotal, total, paid: Math.min(Math.max(0, input.paid), total), userId: userId(), updatedAt: 0 }
  const entries: { collection: 'sales' | 'movements'; record: Base }[] = [{ collection: 'sales', record: sale }]
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  const sign = sale.type === 'return' ? 1 : -1
  for (const it of sale.items) {
    if (!it.productId || it.kind === 'service') continue
    entries.push({ collection: 'movements', record: { id: newId(), updatedAt: 0, productId: it.productId, date: sale.date, qty: sign * it.qty, reason: sale.type === 'return' ? 'sale_return' : 'sale', refId: id, note: `فاتورة ${sale.number}`, userId: sale.userId } as StockMovement })
  }
  await putMany(entries)
  return sale
}

export async function deleteSale(id: string): Promise<void> {
  const entries: { collection: 'sales' | 'movements'; record: Base }[] = []
  const sale = useStore.getState().sales.get(id)
  if (sale) entries.push({ collection: 'sales', record: { ...sale, deleted: true } })
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  if (entries.length) await putMany(entries)
}

export type PurchaseInput = Omit<Purchase, 'id' | 'updatedAt' | 'total' | 'number' | 'userId'> & { id?: string; number?: number }

export async function savePurchase(input: PurchaseInput): Promise<Purchase> {
  const id = input.id ?? newId()
  const total = input.items.reduce((s, i) => s + i.qty * i.cost, 0)
  const purchase: Purchase = { ...input, id, number: input.number ?? nextNumber('purchases'), total, paid: Math.min(Math.max(0, input.paid), total), userId: userId(), updatedAt: 0 }
  const entries: { collection: 'purchases' | 'movements' | 'products'; record: Base }[] = [{ collection: 'purchases', record: purchase }]
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  const sign = purchase.type === 'return' ? -1 : 1
  const products = useStore.getState().products
  for (const it of purchase.items) {
    const p = products.get(it.productId)
    if (!p || p.kind === 'service') continue
    entries.push({ collection: 'movements', record: { id: newId(), updatedAt: 0, productId: it.productId, date: purchase.date, qty: sign * it.qty, reason: purchase.type === 'return' ? 'purchase_return' : 'purchase', refId: id, note: `شراء ${purchase.number}`, userId: purchase.userId } as StockMovement })
    // buying at a new price updates the product's cost, so profit is computed from the latest price
    if (purchase.type === 'purchase' && it.cost > 0 && it.cost !== p.cost) entries.push({ collection: 'products', record: { ...p, cost: it.cost } as Product })
  }
  await putMany(entries)
  return purchase
}

export async function deletePurchase(id: string): Promise<void> {
  const entries: { collection: 'purchases' | 'movements'; record: Base }[] = []
  const p = useStore.getState().purchases.get(id)
  if (p) entries.push({ collection: 'purchases', record: { ...p, deleted: true } })
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  if (entries.length) await putMany(entries)
}

/** Sets the counted quantity of a product (stock-taking) by writing the difference as a movement. */
export async function adjustStock(product: Product, currentQty: number, newQty: number, note?: string): Promise<void> {
  const diff = newQty - currentQty
  if (diff === 0) return
  await put('movements', { productId: product.id, date: Date.now(), qty: diff, reason: 'adjust', note: note || 'تعديل جرد', userId: userId() })
}

export async function addPayment(p: Omit<Payment, 'id' | 'updatedAt' | 'userId'>): Promise<Payment> {
  return put('payments', { ...p, userId: userId() })
}
export async function addExpense(e: Omit<Expense, 'id' | 'updatedAt' | 'userId'> & { id?: string }): Promise<Expense> {
  return put('expenses', { ...e, userId: userId() })
}
export async function addCashEntry(c: Omit<CashEntry, 'id' | 'updatedAt' | 'userId'> & { id?: string }): Promise<CashEntry> {
  return put('cash', { ...c, userId: userId() })
}

export async function deleteProduct(id: string): Promise<void> {
  // its movements go with it; the invoices keep the name and the numbers
  const entries: { collection: 'products' | 'movements'; record: Base }[] = []
  const p = useStore.getState().products.get(id)
  if (p) entries.push({ collection: 'products', record: { ...p, deleted: true } })
  for (const m of useStore.getState().movements.values()) if (m.productId === id) entries.push({ collection: 'movements', record: { ...m, deleted: true } })
  if (entries.length) await putMany(entries)
}

export { remove }
