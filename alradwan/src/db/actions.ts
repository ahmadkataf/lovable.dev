import { auditEntry, putMany, remove, useStore } from './store'
import type { Base, CashEntry, Expense, Payment, Product, Purchase, Sale, StockMovement } from './types'
import { newId } from '../lib/id'
import { saleTotals } from '../lib/calc'
import { invoiceNo, money } from '../lib/format'

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
  const cfg = useStore.getState().cfg
  const sale: Sale = { ...input, id, number: input.number ?? nextNumber('sales'), subtotal, total, paid: Math.min(Math.max(0, input.paid), total), userId: userId(), rate: input.rate ?? (cfg.rate || undefined), currency: input.currency ?? cfg.currency, updatedAt: 0 }
  const entries: { collection: 'sales' | 'movements' | 'audit'; record: Base }[] = [{ collection: 'sales', record: sale }]
  const existed = useStore.getState().sales.has(id)
  entries.push({ collection: 'audit', record: auditEntry(existed ? 'update' : 'create', `${sale.type === 'return' ? 'مرتجع' : 'فاتورة'} ${invoiceNo(sale.number)} — ${sale.customerName} — ${money(sale.total, { display: 'base' })}`, 'sales', id) })
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
  const entries: { collection: 'sales' | 'movements' | 'audit'; record: Base }[] = []
  const sale = useStore.getState().sales.get(id)
  if (sale) entries.push({ collection: 'sales', record: { ...sale, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف ${sale.type === 'return' ? 'مرتجع' : 'فاتورة'} ${invoiceNo(sale.number)} — ${sale.customerName} — ${money(sale.total, { display: 'base' })}`, 'sales', id) })
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  if (entries.length) await putMany(entries)
}

export type PurchaseInput = Omit<Purchase, 'id' | 'updatedAt' | 'total' | 'number' | 'userId'> & { id?: string; number?: number }

export async function savePurchase(input: PurchaseInput): Promise<Purchase> {
  const id = input.id ?? newId()
  const total = input.items.reduce((s, i) => s + i.qty * i.cost, 0)
  const cfg = useStore.getState().cfg
  const purchase: Purchase = { ...input, id, number: input.number ?? nextNumber('purchases'), total, paid: Math.min(Math.max(0, input.paid), total), userId: userId(), rate: input.rate ?? (cfg.rate || undefined), currency: input.currency ?? cfg.currency, updatedAt: 0 }
  const entries: { collection: 'purchases' | 'movements' | 'products' | 'audit'; record: Base }[] = [{ collection: 'purchases', record: purchase }]
  entries.push({ collection: 'audit', record: auditEntry(useStore.getState().purchases.has(id) ? 'update' : 'create', `${purchase.type === 'return' ? 'مرتجع شراء' : 'شراء'} ${invoiceNo(purchase.number)} — ${purchase.supplierName} — ${money(purchase.total, { display: 'base' })}`, 'purchases', id) })
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
  const entries: { collection: 'purchases' | 'movements' | 'audit'; record: Base }[] = []
  const p = useStore.getState().purchases.get(id)
  if (p) entries.push({ collection: 'purchases', record: { ...p, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف شراء ${invoiceNo(p.number)} — ${p.supplierName}`, 'purchases', id) })
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  if (entries.length) await putMany(entries)
}

/** Sets the counted quantity of a product (stock-taking) by writing the difference as a movement. */
export async function adjustStock(product: Product, currentQty: number, newQty: number, note?: string): Promise<void> {
  const diff = newQty - currentQty
  if (diff === 0) return
  await putMany([
    { collection: 'movements', record: { id: newId(), updatedAt: 0, productId: product.id, date: Date.now(), qty: diff, reason: 'adjust', note: note || 'تعديل جرد', userId: userId() } as StockMovement },
    { collection: 'audit', record: auditEntry('stock', `جرد ${product.name}: ${currentQty} ← ${newQty}${note ? ` (${note})` : ''}`, 'products', product.id) },
  ])
}

export async function addPayment(p: Omit<Payment, 'id' | 'updatedAt' | 'userId'>): Promise<Payment> {
  const rec = { ...p, id: newId(), updatedAt: 0, userId: userId() } as Payment
  await putMany([{ collection: 'payments', record: rec }, { collection: 'audit', record: auditEntry('create', `${p.partyType === 'customer' ? 'تحصيل من' : 'دفع إلى'} ${p.partyName}: ${money(p.amount, { display: 'base' })}`, 'payments', rec.id) }])
  return rec
}
export async function addExpense(e: Omit<Expense, 'id' | 'updatedAt' | 'userId'> & { id?: string }): Promise<Expense> {
  const rec = { ...e, id: e.id ?? newId(), updatedAt: 0, userId: userId() } as Expense
  await putMany([{ collection: 'expenses', record: rec }, { collection: 'audit', record: auditEntry('create', `مصروف ${e.category}: ${money(e.amount, { display: 'base' })}${e.note ? ` — ${e.note}` : ''}`, 'expenses', rec.id) }])
  return rec
}
export async function addCashEntry(c: Omit<CashEntry, 'id' | 'updatedAt' | 'userId'> & { id?: string }): Promise<CashEntry> {
  const rec = { ...c, id: c.id ?? newId(), updatedAt: 0, userId: userId() } as CashEntry
  await putMany([{ collection: 'cash', record: rec }, { collection: 'audit', record: auditEntry('create', `${c.direction === 'in' ? 'إيداع في الصندوق' : 'سحب من الصندوق'}: ${money(c.amount, { display: 'base' })}${c.note ? ` — ${c.note}` : ''}`, 'cash', rec.id) }])
  return rec
}

/** Deletes a payment, expense or cash entry and logs it. */
export async function deleteMoneyEntry(collection: 'payments' | 'expenses' | 'cash', id: string): Promise<void> {
  const rec = (useStore.getState()[collection] as Map<string, Base>).get(id)
  if (!rec) return
  const label = collection === 'payments' ? `دفعة ${(rec as Payment).partyName} ${money((rec as Payment).amount, { display: 'base' })}` : collection === 'expenses' ? `مصروف ${(rec as Expense).category} ${money((rec as Expense).amount, { display: 'base' })}` : `حركة صندوق ${money((rec as CashEntry).amount, { display: 'base' })}`
  await putMany([{ collection, record: { ...rec, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف ${label}`, collection, id) }])
}

export async function deleteProduct(id: string): Promise<void> {
  // its movements go with it; the invoices keep the name and the numbers
  const entries: { collection: 'products' | 'movements' | 'audit'; record: Base }[] = []
  const p = useStore.getState().products.get(id)
  if (p) entries.push({ collection: 'products', record: { ...p, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف قطعة ${p.name} (${p.code})`, 'products', id) })
  for (const m of useStore.getState().movements.values()) if (m.productId === id) entries.push({ collection: 'movements', record: { ...m, deleted: true } })
  if (entries.length) await putMany(entries)
}

export { remove }
