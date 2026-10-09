// Refunds: ONE transaction that writes the Refund, puts the items back in stock (when asked), takes the money
// off the customer's account (method 'credit') and marks the sale 'partial' / 'refunded'.
// The pure helpers (remaining quantities, line totals) drive the refund dialog and are tested.
//
// What a line is worth when refunded: the customer paid `sale.total` for `sale.subtotal` worth of lines
// (a sale discount, or an exclusive tax, sits between the two), so a line's refund value is its share of
// the total. Without a discount or exclusive tax that is exactly item.total / item.qty per unit.
import { logAudit } from './audit'
import { db } from '../db'
import type { Sale, Refund, PaymentMethod, User, Shift, Settings } from '../db/types'
import { applyStock } from './stock'
import { applyLedger } from './ledger'
import { uid } from './ids'
import { round, formatQty } from './money'
import { addMessages } from '../i18n'

addMessages({
  ar: {
    'refunds.err.noItems': 'اختر صنفاً واحداً على الأقل للإرجاع',
    'refunds.err.badLine': 'سطر غير صحيح في طلب الإرجاع',
    'refunds.err.creditNoCustomer': 'الإرجاع إلى حساب العميل يحتاج إلى عميل مسجّل على الفاتورة',
    'refunds.err.saleMissing': 'الفاتورة غير موجودة',
    'refunds.err.nothingLeft': 'هذه الفاتورة مسترجعة بالكامل',
    'refunds.err.overRefund': 'الكمية المطلوبة من «{name}» أكبر من المتبقي ({qty})',
  },
  en: {
    'refunds.err.noItems': 'Pick at least one item to refund',
    'refunds.err.badLine': 'Invalid line in the refund request',
    'refunds.err.creditNoCustomer': 'Refunding to the account needs a customer on the receipt',
    'refunds.err.saleMissing': 'The receipt no longer exists',
    'refunds.err.nothingLeft': 'This receipt is already fully refunded',
    'refunds.err.overRefund': 'The quantity of "{name}" is more than what is left ({qty})',
  },
})

/** A refusal the UI can show: `key` is an i18n key (refunds.err.*). Nothing is written when it is thrown. */
export class RefundError extends Error {
  key: string
  vars?: Record<string, string | number>
  constructor(key: string, vars?: Record<string, string | number>) {
    super(key)
    this.name = 'RefundError'
    this.key = key
    this.vars = vars
  }
}

export function refundErrorText(e: unknown, t: (k: string, vars?: Record<string, string | number>) => string): string {
  if (e instanceof RefundError) return t(e.key, e.vars)
  return t('common.error')
}

const EPS = 1e-6

/** What the customer actually paid for a whole line: its share of the sale total. */
export function paidForLine(sale: Sale, index: number, decimals: number): number {
  const it = sale.items[index]
  if (!it || sale.subtotal <= 0) return 0
  return round((it.total * sale.total) / sale.subtotal, decimals)
}

/** The effective unit price of a line (what one unit is worth on a refund). */
export function unitRefundPrice(sale: Sale, index: number, decimals: number): number {
  const it = sale.items[index]
  if (!it || !(it.qty > 0)) return 0
  return round(paidForLine(sale, index, decimals) / it.qty, decimals)
}

/** The money handed back for `qty` of line `index`. */
export function refundLineTotal(sale: Sale, index: number, qty: number, decimals: number): number {
  const it = sale.items[index]
  if (!it || !(it.qty > 0) || !(qty > 0)) return 0
  return round((paidForLine(sale, index, decimals) * qty) / it.qty, decimals)
}

export interface RefundLine { index: number; qty: number }

/** The live total of a refund being prepared. Never more than what is still refundable on the sale. */
export function refundTotal(sale: Sale, lines: RefundLine[], decimals: number): number {
  const sum = round(lines.reduce((s, l) => s + refundLineTotal(sale, l.index, l.qty, decimals), 0), decimals)
  return Math.min(sum, refundableTotal(sale, decimals))
}

/** How much money can still go back on this sale. */
export function refundableTotal(sale: Sale, decimals: number): number {
  return round(Math.max(0, sale.total - sale.refunded), decimals)
}

/**
 * The quantity still refundable per sale line (same order as sale.items), after the given refunds.
 * Refund rows do not carry the line index, so each refunded item is matched to the sale line with the same
 * product, name and unit price (then the same product and name), in order.
 */
export function remainingQty(sale: Sale, refunds: Refund[], decimals = 2): number[] {
  const rem = sale.items.map(i => round(i.qty, 3))
  for (const f of refunds) {
    if (f.saleId !== sale.id) continue
    for (const ri of f.items) {
      let left = round(ri.qty, 3)
      const same = sale.items.map((_, i) => i).filter(i => (sale.items[i].productId ?? '') === (ri.productId ?? '') && sale.items[i].name === ri.name)
      const exact = same.filter(i => round(unitRefundPrice(sale, i, decimals), decimals) === round(ri.price, decimals))
      const order = [...exact, ...same.filter(i => !exact.includes(i))]
      for (const i of order) {
        if (left <= EPS) break
        const take = Math.min(rem[i], left)
        if (take <= 0) continue
        rem[i] = round(rem[i] - take, 3)
        left = round(left - take, 3)
      }
    }
  }
  return rem.map(q => (q < EPS ? 0 : q))
}

/** True when something on the sale can still be refunded. */
export function canRefund(sale: Sale, refunds: Refund[], decimals = 2): boolean {
  if (sale.status === 'refunded') return false
  return remainingQty(sale, refunds, decimals).some(q => q > EPS)
}

export interface CreateRefundInput {
  sale: Sale
  items: RefundLine[]
  method: PaymentMethod
  restock: boolean
  reason?: string
  user: User
  shift: Shift | null
  settings: Settings
}

/**
 * Writes the refund. Throws a RefundError (with a message key) when a quantity is more than what is left,
 * when 'credit' is used without a customer, or when the sale is already fully refunded. Nothing is written on a throw.
 */
export async function createRefund(input: CreateRefundInput): Promise<Refund> {
  const { sale, method, restock, user, shift, settings } = input
  const d = settings.currency.decimals
  const reason = input.reason?.trim() || undefined
  const want = new Map<number, number>()
  for (const l of input.items) {
    if (!Number.isInteger(l.index) || l.index < 0 || l.index >= sale.items.length || !Number.isFinite(l.qty)) throw new RefundError('refunds.err.badLine')
    if (!(l.qty > 0)) continue
    want.set(l.index, round((want.get(l.index) ?? 0) + l.qty, 3))
  }
  if (!want.size) throw new RefundError('refunds.err.noItems')
  if (method === 'credit' && !sale.customerId) throw new RefundError('refunds.err.creditNoCustomer')
  const at = Date.now()

  return db.transaction('rw', [db.refunds, db.sales, db.products, db.stockMoves, db.customers, db.ledger], async () => {
    const fresh = await db.sales.get(sale.id)
    if (!fresh) throw new RefundError('refunds.err.saleMissing')
    if (fresh.status === 'refunded') throw new RefundError('refunds.err.nothingLeft')
    const prev = await db.refunds.where('saleId').equals(fresh.id).toArray()
    const remaining = remainingQty(fresh, prev, d)

    const items: Refund['items'] = []
    for (const [index, qty] of [...want.entries()].sort((a, b) => a[0] - b[0])) {
      const it = fresh.items[index]
      if (!it) throw new RefundError('refunds.err.badLine')
      if (qty > remaining[index] + EPS) throw new RefundError('refunds.err.overRefund', { name: it.name, qty: formatQty(remaining[index]) })
      items.push({ productId: it.productId, name: it.name, qty, price: unitRefundPrice(fresh, index, d), total: refundLineTotal(fresh, index, qty, d), ...(it.unitsPerQty && it.unitsPerQty !== 1 ? { unitsPerQty: it.unitsPerQty } : {}) })
    }
    const allDone = remaining.every((r, i) => round(r - (want.get(i) ?? 0), 3) <= EPS)
    const left = refundableTotal(fresh, d)
    let total = round(items.reduce((s, i) => s + i.total, 0), d)
    // the last refund closes the sale exactly, whatever rounding did on the way; never hand back more than was paid
    if (allDone || total > left) total = left

    if (method === 'credit') {
      const cust = await db.customers.get(fresh.customerId!)
      if (!cust) throw new RefundError('refunds.err.creditNoCustomer')
    }

    const refund: Refund = {
      id: uid(), saleId: fresh.id, saleNumber: fresh.number, createdAt: at, items, total, method, restock, reason,
      customerId: fresh.customerId, userId: user.id, userName: user.name, shiftId: shift?.id,
    }
    if (restock) {
      await applyStock(
        items.filter(i => i.productId).map(i => ({ productId: i.productId!, qty: round(i.qty * (i.unitsPerQty ?? 1), 3), type: 'refund' as const, refId: refund.id, note: `#${fresh.number}`, userId: user.id })),
        at,
      )
    }
    if (method === 'credit' && total > 0) {
      await applyLedger({ customerId: fresh.customerId!, type: 'refund', amount: -total, refId: refund.id, note: `#${fresh.number}`, method: 'credit', userId: user.id, shiftId: shift?.id }, d, at)
    }
    const refunded = round(fresh.refunded + total, d)
    const status: Sale['status'] = allDone || round(fresh.total - refunded, d) <= 0 ? 'refunded' : 'partial'
    await db.refunds.add(refund)
    await db.sales.update(fresh.id, { refunded, status })
    await logAudit({ kind: 'refund', detail: `#${fresh.number} · ${refund.items.map(i => i.name).join(', ')}`, refId: refund.id, amount: total, user: { id: user.id, name: user.name } })
    return refund
  })
}
