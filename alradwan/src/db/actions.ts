import { auditEntry, putMany, remove, useStore } from './store'
import type { Base, CashEntry, Expense, JournalEntry, Payment, Product, Purchase, Sale, StockMovement } from './types'
import { newId } from '../lib/id'
import { saleTotals, stockMap } from '../lib/calc'
import { invoiceNo, money } from '../lib/format'

// The business operations. An invoice and the stock movements it causes are always written together.

export function nextNumber(collection: 'sales' | 'purchases'): number {
  const s = useStore.getState()
  let max = s.seqFloor[collection]
  for (const r of s[collection].values()) if (r.number > max) max = r.number
  return max + 1
}
function noteNumber(collection: 'sales' | 'purchases', n: number) {
  const s = useStore.getState()
  if (n > s.seqFloor[collection]) useStore.setState({ seqFloor: { ...s.seqFloor, [collection]: n } })
}
/** Is this invoice number already carried by a live document? (a restored invoice may need a new one) */
export function numberTaken(collection: 'sales' | 'purchases', n: number, exceptId?: string): boolean {
  for (const r of useStore.getState()[collection].values()) if (r.number === n && r.id !== exceptId) return true
  return false
}
const r2 = (n: number) => Math.round(n * 100) / 100

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
  const existing = useStore.getState().sales.get(id)
  if (input.type !== 'quote' && input.paid < total - 0.004 && !input.customerId) throw new Error('فاتورة آجلة بلا عميل: اختر العميل حتى يُسجَّل الدين عليه')
  // an edit keeps the day's exchange rate and the cashier who issued the invoice; the activity log records the editor
  const sale: Sale = { ...input, id, number: input.number ?? nextNumber('sales'), subtotal, total, paid: input.type === 'quote' ? 0 : r2(Math.min(Math.max(0, input.paid), total)), userId: existing?.userId ?? userId(), rate: input.rate ?? existing?.rate ?? (cfg.rate || undefined), currency: input.currency ?? existing?.currency ?? cfg.currency, updatedAt: 0 }
  const entries: { collection: 'sales' | 'movements' | 'audit'; record: Base }[] = [{ collection: 'sales', record: sale }]
  const existed = !!existing
  entries.push({ collection: 'audit', record: auditEntry(existed ? 'update' : 'create', `${sale.type === 'return' ? 'مرتجع' : sale.type === 'quote' ? 'عرض سعر' : 'فاتورة'} ${invoiceNo(sale.number)} — ${sale.customerName} — ${money(sale.total, { display: 'base' })}`, 'sales', id) })
  // movements carry ids derived from the invoice line, so two devices editing the same invoice replace, never duplicate
  const keep = new Set<string>()
  const sign = sale.type === 'return' ? 1 : -1
  sale.items.forEach((it, i) => {
    if (sale.type === 'quote' || !it.productId || it.kind === 'service') return
    const mid = `${id}:${i}`; keep.add(mid)
    entries.push({ collection: 'movements', record: { id: mid, updatedAt: 0, productId: it.productId, date: sale.date, qty: sign * it.qty, reason: sale.type === 'return' ? 'sale_return' : 'sale', refId: id, note: `فاتورة ${sale.number}`, userId: sale.userId } as StockMovement })
  })
  for (const old of movementsOf(id)) if (!keep.has(old.id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  await putMany(entries)
  noteNumber('sales', sale.number)
  return sale
}

/** Turns a quotation into a real invoice (stock and cash move now); the quotation is kept and marked. */
export async function convertQuote(quote: Sale, paid: number): Promise<Sale> {
  const sale = await saveSale({ type: 'sale', date: Date.now(), customerId: quote.customerId, customerName: quote.customerName, items: quote.items.map(i => ({ ...i })), discount: quote.discount, discountPct: quote.discountPct, paid, notes: quote.notes ? `${quote.notes} (من عرض السعر ${invoiceNo(quote.number)})` : `من عرض السعر ${invoiceNo(quote.number)}` })
  const marked: Sale = { ...quote, convertedTo: sale.id }
  await putMany([{ collection: 'sales', record: marked }, { collection: 'audit', record: auditEntry('update', `تحويل عرض السعر ${invoiceNo(quote.number)} إلى الفاتورة ${invoiceNo(sale.number)}`, 'sales', quote.id) }])
  return sale
}

export async function saveJournal(entry: Omit<JournalEntry, 'id' | 'updatedAt' | 'userId'> & { id?: string }): Promise<JournalEntry> {
  const rec = { ...entry, id: entry.id ?? newId(), updatedAt: 0, userId: userId() } as JournalEntry
  const total = rec.lines.reduce((t, l) => t + l.debit, 0)
  await putMany([{ collection: 'journal', record: rec }, { collection: 'audit', record: auditEntry(entry.id ? 'update' : 'create', `قيد محاسبي: ${rec.memo} — ${money(total, { display: 'base' })}`, 'journal', rec.id) }])
  return rec
}
export async function deleteJournal(id: string): Promise<void> {
  const j = useStore.getState().journal.get(id); if (!j) return
  await putMany([{ collection: 'journal', record: { ...j, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف قيد: ${j.memo}`, 'journal', id) }])
}

export async function deleteSale(id: string): Promise<void> {
  const entries: { collection: 'sales' | 'movements' | 'audit'; record: Base }[] = []
  const sale = useStore.getState().sales.get(id)
  for (const r of useStore.getState().sales.values()) if (r.returnOf === id) throw new Error(`لهذه الفاتورة مرتجع (${invoiceNo(r.number)}): احذف المرتجع أولاً`)
  if (sale) entries.push({ collection: 'sales', record: { ...sale, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف ${sale.type === 'return' ? 'مرتجع' : 'فاتورة'} ${invoiceNo(sale.number)} — ${sale.customerName} — ${money(sale.total, { display: 'base' })}`, 'sales', id) })
  for (const old of movementsOf(id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  if (entries.length) await putMany(entries)
}

export type PurchaseInput = Omit<Purchase, 'id' | 'updatedAt' | 'total' | 'number' | 'userId'> & { id?: string; number?: number }

export async function savePurchase(input: PurchaseInput): Promise<Purchase> {
  const id = input.id ?? newId()
  const total = input.items.reduce((s, i) => s + i.qty * i.cost, 0)
  const cfg = useStore.getState().cfg
  const existing = useStore.getState().purchases.get(id)
  const purchase: Purchase = { ...input, id, number: input.number ?? nextNumber('purchases'), total, paid: r2(Math.min(Math.max(0, input.paid), total)), userId: existing?.userId ?? userId(), rate: input.rate ?? existing?.rate ?? (cfg.rate || undefined), currency: input.currency ?? existing?.currency ?? cfg.currency, updatedAt: 0 }
  const entries: { collection: 'purchases' | 'movements' | 'products' | 'audit'; record: Base }[] = [{ collection: 'purchases', record: purchase }]
  entries.push({ collection: 'audit', record: auditEntry(useStore.getState().purchases.has(id) ? 'update' : 'create', `${purchase.type === 'return' ? 'مرتجع شراء' : 'شراء'} ${invoiceNo(purchase.number)} — ${purchase.supplierName} — ${money(purchase.total, { display: 'base' })}`, 'purchases', id) })
  const sign = purchase.type === 'return' ? -1 : 1
  const state = useStore.getState()
  const products = state.products
  const stock = stockMap(products, state.movements)
  const keep = new Set<string>()
  // the latest purchase of a part sets its cost as a weighted average of what is on the shelf and what came in (IAS 2)
  const newerPurchaseOf = (pid: string) => Array.from(state.purchases.values()).some(x => x.id !== id && x.type === 'purchase' && x.date > purchase.date && x.items.some(i => i.productId === pid))
  purchase.items.forEach((it, i) => {
    const p = products.get(it.productId)
    if (!p || p.kind === 'service') return
    const mid = `${id}:${i}`; keep.add(mid)
    entries.push({ collection: 'movements', record: { id: mid, updatedAt: 0, productId: it.productId, date: purchase.date, qty: sign * it.qty, reason: purchase.type === 'return' ? 'purchase_return' : 'purchase', refId: id, note: `شراء ${purchase.number}`, userId: purchase.userId } as StockMovement })
    if (purchase.type === 'purchase' && it.cost > 0 && !newerPurchaseOf(it.productId)) {
      const onHand = Math.max(0, stock.get(it.productId) ?? 0)
      const avg = onHand > 0 && p.cost > 0 ? r2((onHand * p.cost + it.qty * it.cost) / (onHand + it.qty)) : it.cost
      if (avg !== p.cost) entries.push({ collection: 'products', record: { ...p, cost: avg } as Product })
    }
  })
  for (const old of movementsOf(id)) if (!keep.has(old.id)) entries.push({ collection: 'movements', record: { ...old, deleted: true } })
  await putMany(entries)
  noteNumber('purchases', purchase.number)
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
    { collection: 'movements', record: { id: newId(), updatedAt: 0, productId: product.id, date: Date.now(), qty: diff, reason: 'adjust', unitCost: product.cost, note: note || 'تعديل جرد', userId: userId() } as StockMovement },
    { collection: 'audit', record: auditEntry('stock', `جرد ${product.name}: ${currentQty} ← ${newQty}${note ? ` (${note})` : ''}`, 'products', product.id) },
  ])
}

export async function addPayment(p: Omit<Payment, 'id' | 'updatedAt' | 'userId'>): Promise<Payment> {
  const rec = { ...p, id: newId(), updatedAt: 0, userId: userId() } as Payment
  const label = p.amount < 0 ? (p.partyType === 'customer' ? 'رد مبلغ إلى' : 'استرداد من') : p.partyType === 'customer' ? 'تحصيل من' : 'دفع إلى'
  await putMany([{ collection: 'payments', record: rec }, { collection: 'audit', record: auditEntry('create', `${label} ${p.partyName}: ${money(Math.abs(p.amount), { display: 'base' })}`, 'payments', rec.id) }])
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
  // a part that was bought or sold stays, so the books that mention it keep adding up; only its invoices can remove it
  for (const m of useStore.getState().movements.values()) if (m.productId === id && m.refId) throw new Error('هذه القطعة لها فواتير بيع أو شراء فلا تُحذف — اجعل كميتها صفراً بالجرد، أو احذف فواتيرها أولاً')
  const entries: { collection: 'products' | 'movements' | 'audit'; record: Base }[] = []
  const p = useStore.getState().products.get(id)
  if (p) entries.push({ collection: 'products', record: { ...p, deleted: true } }, { collection: 'audit', record: auditEntry('delete', `حذف قطعة ${p.name} (${p.code})`, 'products', id) })
  for (const m of useStore.getState().movements.values()) if (m.productId === id) entries.push({ collection: 'movements', record: { ...m, deleted: true } })
  if (entries.length) await putMany(entries)
}

export { remove }
