import type { Customer, Payment, Product, Purchase, Sale, StockMovement, Supplier, Expense, CashEntry } from '../db/types'

// Everything the screens show is computed from the records: stock from the movements, balances from the
// invoices and payments, the cash box from all money in and out. Nothing is stored twice.

export function stockMap(products: Map<string, Product>, movements: Map<string, StockMovement>): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of products.values()) m.set(p.id, p.kind === 'service' ? 0 : p.openingStock || 0)
  for (const mv of movements.values()) {
    if (!m.has(mv.productId)) continue
    if (mv.reason === 'opening') continue // kept for history only: the opening stock is on the product
    m.set(mv.productId, (m.get(mv.productId) ?? 0) + mv.qty)
  }
  return m
}

export function saleTotals(items: { qty: number; price: number; discount: number }[], invoiceDiscount: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0)
  const total = Math.max(0, subtotal - (invoiceDiscount || 0))
  return { subtotal, total }
}

export function saleProfit(sale: Sale): number {
  if (sale.type === 'quote') return 0
  const sign = sale.type === 'return' ? -1 : 1
  const gross = sale.items.reduce((s, i) => s + (i.price - i.cost) * i.qty - (i.discount || 0), 0)
  return sign * (gross - (sale.discount || 0))
}

export function saleDue(sale: Sale): number { return Math.max(0, sale.total - sale.paid) }

export function payStatus(total: number, paid: number): 'paid' | 'partial' | 'unpaid' {
  if (paid >= total - 0.0001) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

/** What a customer owes (positive) — opening balance + unpaid sales − returns credit − payments received */
export function customerBalance(c: Customer, sales: Iterable<Sale>, payments: Iterable<Payment>): number {
  let b = c.openingBalance || 0
  for (const s of sales) {
    if (s.customerId !== c.id || s.type === 'quote') continue
    const due = s.total - s.paid
    b += s.type === 'return' ? -due : due
  }
  for (const p of payments) if (p.partyType === 'customer' && p.partyId === c.id) b -= p.amount
  return b
}

/** What we owe a supplier (positive) */
export function supplierBalance(s: Supplier, purchases: Iterable<Purchase>, payments: Iterable<Payment>): number {
  let b = s.openingBalance || 0
  for (const p of purchases) {
    if (p.supplierId !== s.id) continue
    const due = p.total - p.paid
    b += p.type === 'return' ? -due : due
  }
  for (const p of payments) if (p.partyType === 'supplier' && p.partyId === s.id) b -= p.amount
  return b
}

export interface CashLine { date: number; kind: string; label: string; amount: number; ref?: { type: string; id: string } }

/** Every movement of money, newest first. Positive = came in, negative = went out. */
export function cashLines(sales: Iterable<Sale>, purchases: Iterable<Purchase>, payments: Iterable<Payment>, expenses: Iterable<Expense>, cash: Iterable<CashEntry>): CashLine[] {
  const lines: CashLine[] = []
  for (const s of sales) if (s.paid && s.type !== 'quote') lines.push({ date: s.date, kind: s.type === 'return' ? 'مرتجع مبيعات' : 'مبيعات', label: `فاتورة ${s.number} — ${s.customerName}`, amount: s.type === 'return' ? -s.paid : s.paid, ref: { type: 'sale', id: s.id } })
  for (const p of purchases) if (p.paid) lines.push({ date: p.date, kind: p.type === 'return' ? 'مرتجع مشتريات' : 'مشتريات', label: `شراء ${p.number} — ${p.supplierName}`, amount: p.type === 'return' ? p.paid : -p.paid, ref: { type: 'purchase', id: p.id } })
  for (const p of payments) lines.push({ date: p.date, kind: p.partyType === 'customer' ? 'تحصيل من عميل' : 'دفع لمورد', label: p.partyName + (p.note ? ` — ${p.note}` : ''), amount: p.partyType === 'customer' ? p.amount : -p.amount, ref: { type: 'payment', id: p.id } })
  for (const e of expenses) lines.push({ date: e.date, kind: 'مصروف', label: e.category + (e.note ? ` — ${e.note}` : ''), amount: -e.amount, ref: { type: 'expense', id: e.id } })
  for (const c of cash) lines.push({ date: c.date, kind: c.direction === 'in' ? 'إيداع في الصندوق' : 'سحب من الصندوق', label: c.note || '', amount: c.direction === 'in' ? c.amount : -c.amount, ref: { type: 'cash', id: c.id } })
  lines.sort((a, b) => b.date - a.date)
  return lines
}

export function sumBetween(lines: CashLine[], from: number, to: number): number {
  let s = 0
  for (const l of lines) if (l.date >= from && l.date <= to) s += l.amount
  return s
}
