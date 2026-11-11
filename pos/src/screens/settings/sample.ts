// A fake receipt for the "print a test receipt" button: three items, totals computed exactly like a real sale.
import type { Sale, Settings, User } from '../../db/types'
import { computeTotals, toSaleItems, type Cart } from '../../lib/cart'
import { round } from '../../lib/money'
import { t } from '../../i18n'

export function sampleSale(settings: Settings, user: Pick<User, 'id' | 'name'> | null, now = Date.now()): Sale {
  const d = settings.currency.decimals
  const unit = d === 0 ? 1000 : 1   // amounts that look right for the currency
  const base = (n: number) => round(n * unit, d)
  const items = [
    { name: t('settings.receipt.sample.item1'), price: base(1.5), qty: 2, cost: base(1.1) },
    { name: t('settings.receipt.sample.item2'), price: base(3.25), qty: 1, cost: base(2.4) },
    { name: t('settings.receipt.sample.item3'), price: base(7.5), qty: 1, cost: base(6.2) },
  ]
  const cart: Cart = {
    lines: items.map((i, k) => ({
      key: `sample-${k}`, name: i.name, barcode: `200000000000${k}`, unit: 'piece', price: i.price, originalPrice: i.price, qty: i.qty,
      cost: i.cost, discount: 0, taxRate: settings.tax.rate, allowFraction: false, trackStock: false, stock: 0,
    })),
    discount: 0,
  }
  const totals = computeTotals(cart, settings.tax, d)
  const paid = round(Math.ceil(totals.total / (unit * 5) || 1) * unit * 5, d)
  return {
    id: 'sample', number: 1001, createdAt: now,
    items: toSaleItems(cart, totals, d),
    subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, cost: totals.cost,
    payments: [{ method: 'cash', amount: totals.total }], paid, change: round(paid - totals.total, d), credit: 0,
    customerName: t('settings.receipt.sample.customer'),
    userId: user?.id ?? 'sample', userName: user?.name ?? '', status: 'completed', refunded: 0,
  }
}
