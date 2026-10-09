// Completing a sale: ONE transaction that numbers the receipt, writes it, moves stock and books credit.
// Also the payment arithmetic the payment dialog uses (pure, tested).
//
// Money fields on a Sale (see db/types.ts):
//   payments  what was applied to the sale per method; they add up to the total (cash is net of change)
//   paid      cash/card/transfer actually received, gross (cash tendered includes the change handed back)
//   change    cash handed back            →  paid - change + credit === total
//   credit    what went on the customer's account
import { db, nextNumber } from '../db'
import type { Sale, Payment, PaymentMethod, User, Shift, Settings, FxPayment } from '../db/types'
import { toSaleItems, type Cart, type Totals } from './cart'
import { applyStock } from './stock'
import { applyLedger } from './ledger'
import { uid } from './ids'
import { round } from './money'
import { addMessages, t } from '../i18n'
import { logAudit } from './audit'
import { pointsEarned } from './loyalty'

addMessages({
  ar: {
    'sales.err.emptyCart': 'السلة فارغة',
    'sales.err.creditNoCustomer': 'البيع بالدين يحتاج إلى اختيار عميل',
    'sales.err.invalidPayment': 'مبلغ الدفع غير صحيح',
    'sales.err.paymentMismatch': 'المبالغ لا تطابق الإجمالي، أعد المحاولة',
    'sales.err.invalidQty': 'توجد كمية غير صحيحة في السلة',
    'sales.err.outOfStock': 'لا يوجد مخزون كافٍ من «{name}»',
    'sales.pay.enterAmount': 'أدخل المبلغ المستلم',
    'sales.pay.shortNoCustomer': 'المبلغ أقل من الإجمالي — اختر عميلاً لتسجيل الباقي ديناً',
  },
  en: {
    'sales.err.emptyCart': 'The cart is empty',
    'sales.err.creditNoCustomer': 'Selling on credit needs a customer',
    'sales.err.invalidPayment': 'The payment amount is not valid',
    'sales.err.paymentMismatch': 'The amounts do not add up to the total, try again',
    'sales.err.invalidQty': 'A line in the cart has an invalid quantity',
    'sales.err.outOfStock': 'Not enough stock of "{name}"',
    'sales.pay.enterAmount': 'Enter the amount received',
    'sales.pay.shortNoCustomer': 'Less than the total — pick a customer to put the rest on credit',
  },
})

/** A refusal the UI can show: `key` is an i18n key (sales.err.*), `vars` fills its placeholders. */
export class SaleError extends Error {
  key: string
  vars?: Record<string, string | number>
  constructor(key: string, vars?: Record<string, string | number>) {
    super(key)
    this.name = 'SaleError'
    this.key = key
    this.vars = vars
  }
}

export interface CompleteSaleInput {
  cart: Cart
  totals: Totals
  payments: Payment[]
  paid: number
  change: number
  credit: number
  fx?: FxPayment
  user: User
  shift: Shift | null
  settings: Settings
}

/**
 * Writes the sale. Throws a SaleError (with a message key) for an empty cart, credit without a customer,
 * amounts that do not add up, or missing stock when negative stock is not allowed. Nothing is written on a throw.
 */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const { cart, totals, payments, user, shift, settings } = input
  const d = settings.currency.decimals
  const paid = round(input.paid, d)
  const change = round(input.change, d)
  const credit = round(input.credit, d)

  if (!cart.lines.length) throw new SaleError('sales.err.emptyCart')
  if (credit > 0 && !cart.customerId) throw new SaleError('sales.err.creditNoCustomer')
  if (paid < 0 || change < 0 || credit < 0 || change > paid) throw new SaleError('sales.err.invalidPayment')
  if (round(paid - change + credit, d) !== round(totals.total, d)) throw new SaleError('sales.err.paymentMismatch')
  if (cart.lines.some(l => !(l.qty > 0))) throw new SaleError('sales.err.invalidQty')

  const at = Date.now()
  const sale = await db.transaction('rw', [db.sales, db.products, db.stockMoves, db.customers, db.ledger, db.kv], async () => {
    if (!settings.pos.allowNegativeStock) {
      const need = new Map<string, number>()
      for (const l of cart.lines) if (l.productId) need.set(l.productId, round((need.get(l.productId) ?? 0) + l.qty, 3))
      for (const [productId, qty] of need) {
        const p = await db.products.get(productId)
        if (p && p.trackStock && round(p.stock - qty, 3) < 0) throw new SaleError('sales.err.outOfStock', { name: p.name })
      }
    }
    if (credit > 0 && !(await db.customers.get(cart.customerId!))) throw new SaleError('sales.err.creditNoCustomer')
    // loyalty: redeem what the cart asked for, earn on what was paid
    let pointsRedeemed = 0, pointsEarnedNow = 0
    if (settings.loyalty.enabled && cart.customerId) {
      const cust = await db.customers.get(cart.customerId)
      if (cust) {
        pointsRedeemed = Math.min(cust.points ?? 0, Math.max(0, Math.floor(cart.redeemPoints ?? 0)))
        pointsEarnedNow = pointsEarned(totals.total, settings.loyalty)
        await db.customers.update(cust.id, { points: Math.max(0, (cust.points ?? 0) - pointsRedeemed + pointsEarnedNow), updatedAt: at })
      }
    }
    const number = await nextNumber('sale')
    const sale: Sale = {
      id: uid(),
      number,
      createdAt: at,
      items: toSaleItems(cart, totals, d),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountPct: cart.discountPct,
      tax: totals.tax,
      total: totals.total,
      cost: totals.cost,
      payments: payments.filter(p => p.amount > 0).map(p => ({ method: p.method, amount: round(p.amount, d) })),
      paid,
      change,
      credit,
      fx: input.fx && input.fx.received > 0 ? input.fx : undefined,
      pointsEarned: pointsEarnedNow || undefined,
      pointsRedeemed: pointsRedeemed || undefined,
      customerId: cart.customerId,
      customerName: cart.customerName,
      userId: user.id,
      userName: user.name,
      shiftId: shift?.id,
      status: 'completed',
      refunded: 0,
      note: cart.note,
    }
    await applyStock(
      cart.lines.filter(l => l.productId).map(l => ({ productId: l.productId!, qty: -l.qty, type: 'sale' as const, refId: sale.id, userId: user.id })),
      at,
    )
    if (credit > 0) {
      await applyLedger({ customerId: cart.customerId!, type: 'sale', amount: credit, refId: sale.id, method: 'credit', userId: user.id, shiftId: shift?.id, note: `#${number}` }, d, at)
    }
    await db.sales.add(sale)
    return sale
  })
  // the owner's activity log: discounts and price changes at the till
  const lineDiscounts = round(cart.lines.reduce((s, l) => s + l.discount, 0), d)
  if (totals.discount > 0 || lineDiscounts > 0) await logAudit({ kind: 'sale.discount', detail: `#${sale.number}`, refId: sale.id, amount: round(totals.discount + lineDiscounts, d), user: { id: user.id, name: user.name } })
  const overridden = cart.lines.filter(l => l.productId && l.price !== l.originalPrice)
  if (overridden.length) await logAudit({ kind: 'sale.priceOverride', detail: `#${sale.number}: ${overridden.map(l => `${l.name} ${l.originalPrice}→${l.price}`).join(', ')}`, refId: sale.id, user: { id: user.id, name: user.name } })
  void t
  return sale
}

/** The customer's balance right after a sale on credit (from the ledger), or undefined when there is none. */
export async function balanceAfterSale(sale: Sale): Promise<number | undefined> {
  if (!sale.credit || !sale.customerId) return undefined
  const rows = await db.ledger.where('refId').equals(sale.id).toArray()
  const row = rows.filter(r => r.type === 'sale' && r.customerId === sale.customerId).sort((a, b) => b.createdAt - a.createdAt)[0]
  return row?.balanceAfter
}

export interface PaymentPlan {
  method: PaymentMethod
  payments: Payment[]
  paid: number
  change: number
  credit: number
  /** What is still missing when the plan is not valid. */
  short: number
  valid: boolean
  /** Why it is not valid (an i18n key). */
  reason?: string
  /** Set when the cash came in the second currency. */
  fx?: FxPayment
}

/**
 * Turns "method + amount received" into the amounts stored on the sale.
 * - credit: the whole total goes on the account (needs a customer).
 * - cash: more than the total gives change; less, with a customer, puts the remainder on credit.
 * - card / transfer: never more than the total; less, with a customer, puts the remainder on credit.
 */
export function planPayment(o: { total: number; method: PaymentMethod; tendered: number; hasCustomer: boolean; decimals: number }): PaymentPlan {
  const d = o.decimals
  const total = round(Math.max(0, o.total), d)
  const tendered = round(Math.max(0, o.tendered), d)
  if (o.method === 'credit') {
    return {
      method: 'credit', payments: [{ method: 'credit', amount: total }], paid: 0, change: 0, credit: total, short: 0,
      valid: o.hasCustomer, reason: o.hasCustomer ? undefined : 'sales.err.creditNoCustomer',
    }
  }
  const applied = round(Math.min(tendered, total), d)
  const remainder = round(total - applied, d)
  const change = o.method === 'cash' ? round(Math.max(0, tendered - total), d) : 0
  const paid = round(applied + change, d)
  const payments: Payment[] = [{ method: o.method, amount: applied }]
  if (remainder > 0) {
    if (o.hasCustomer && applied > 0) {
      payments.push({ method: 'credit', amount: remainder })
      return { method: o.method, payments, paid, change, credit: remainder, short: 0, valid: true }
    }
    return {
      method: o.method, payments, paid, change, credit: 0, short: remainder, valid: false,
      reason: o.hasCustomer ? 'sales.pay.enterAmount' : 'sales.pay.shortNoCustomer',
    }
  }
  return { method: o.method, payments, paid, change, credit: 0, short: 0, valid: true }
}

/** The text for a failed completeSale / planPayment, through the given translator. */
export function saleErrorText(e: unknown, t: (k: string, vars?: Record<string, string | number>) => string): string {
  if (e instanceof SaleError) return t(e.key, e.vars)
  return t('common.error')
}
