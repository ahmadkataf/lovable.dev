import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, type Sale, type Refund, type Settings } from '../db/types'
import { receiptHtml, receiptText, receiptDoc, alignLine, escapeHtml } from './receipt'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  store: { name: 'متجر الأمل', phone: '0991234567', address: 'دمشق - المزة', taxNumber: 'TX-77' },
  receipt: { ...DEFAULT_SETTINGS.receipt, header: 'أهلاً بكم', footer: 'شكراً لزيارتكم' },
}
const sale: Sale = {
  id: 's1', number: 42, createdAt: Date.UTC(2026, 9, 9, 10, 30), status: 'completed', refunded: 0,
  items: [
    { productId: 'p1', name: 'حليب كامل الدسم 1 لتر', unit: 'piece', qty: 2, price: 1000, originalPrice: 1000, cost: 800, discount: 0, taxRate: 0, tax: 0, total: 2000 },
    { productId: 'p2', name: 'خبز', unit: 'piece', qty: 1, price: 450, originalPrice: 500, cost: 300, discount: 0, taxRate: 0, tax: 0, total: 450, note: 'طازج' },
    { name: 'توصيل', unit: 'piece', qty: 1, price: 300, originalPrice: 300, cost: 0, discount: 50, taxRate: 0, tax: 0, total: 250 },
  ],
  subtotal: 2700, discount: 200, discountPct: undefined, tax: 0, total: 2500, cost: 1900,
  payments: [{ method: 'cash', amount: 1500 }, { method: 'credit', amount: 1000 }], paid: 2000, change: 500, credit: 1000,
  customerId: 'c1', customerName: 'علي', userId: 'u1', userName: 'أحمد', note: 'يُسلَّم مساءً',
}
const refund: Refund = {
  id: 'r1', saleId: 's1', saleNumber: 42, createdAt: Date.UTC(2026, 9, 10, 9, 0), items: [{ productId: 'p1', name: 'حليب كامل الدسم 1 لتر', qty: 1, price: 1000, total: 1000 }],
  total: 1000, method: 'cash', restock: true, reason: 'منتهي الصلاحية', customerId: 'c1', userId: 'u1', userName: 'أحمد',
}

describe('receiptText', () => {
  it('has the store, number, every item, totals, payments and footer', () => {
    const txt = receiptText(sale, settings, { balanceAfter: 3000 })
    expect(txt).toContain('متجر الأمل')
    expect(txt).toContain('#42')
    for (const i of sale.items) expect(txt).toContain(i.name)
    expect(txt).toContain('2 × 1,000 ل.س')
    expect(txt).toContain('2,500 ل.س')      // total
    expect(txt).toContain('-200 ل.س')       // sale discount
    expect(txt).toContain('2,000 ل.س')      // cash tendered (applied + change)
    expect(txt).toContain('500 ل.س')        // change
    expect(txt).toContain('1,000 ل.س')      // on account
    expect(txt).toContain('3,000 ل.س')      // balance after
    expect(txt).toContain('شكراً لزيارتكم')
    expect(txt).toContain('يُسلَّم مساءً')
    expect(txt).toContain('طازج')
  })
  it('aligns a label and a value on one line', () => {
    expect(alignLine('abc', '12', 10)).toBe('abc     12')
    expect(alignLine('a very long label', '1,000', 10)).toBe('a very long label\n     1,000')
  })
})

describe('receiptHtml', () => {
  it('is a complete rtl document sized for the paper', () => {
    const html = receiptHtml(sale, settings)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('@page { size: 80mm auto; margin: 0 }')
    expect(html).toContain('width: 72mm')
    expect(html).toContain('متجر الأمل')
    expect(html).toContain('0991234567')
    expect(html).toContain('TX-77')
    expect(html).toContain('أهلاً بكم')
    expect(html).toContain('#42')
    for (const i of sale.items) expect(html).toContain(i.name)
    expect(html).toContain('2,500 ل.س')
    expect(html).not.toContain('<svg')          // no DOM here: the barcode is skipped
    expect(html).not.toContain('نسخة')
  })
  it('uses 48mm on 58mm paper and ltr in English', () => {
    const html = receiptHtml(sale, { ...settings, lang: 'en', receipt: { ...settings.receipt, paper: 58 } })
    expect(html).toContain('@page { size: 58mm auto; margin: 0 }')
    expect(html).toContain('width: 48mm')
    expect(html).toContain('dir="ltr"')
    expect(html).toContain('font-size: 12px')
  })
  it('marks a copy and escapes html', () => {
    const html = receiptHtml({ ...sale, note: '<b>x</b>' }, settings, { copy: true })
    expect(html).toContain('نسخة')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.toContain('<b>x</b>')
    expect(escapeHtml('a&"\'')).toBe('a&amp;&quot;&#39;')
  })
  it('renders a refund with its title, items, amount and the original number', () => {
    const html = receiptHtml(sale, settings, { refund })
    expect(html).toContain('إرجاع')
    expect(html).toContain('#42')
    expect(html).toContain('حليب كامل الدسم 1 لتر')
    expect(html).toContain('1,000 ل.س')
    expect(html).toContain('منتهي الصلاحية')
    expect(html).not.toContain('خبز')          // only the refunded items
    const txt = receiptText(sale, settings, { refund })
    expect(txt).toContain('إرجاع')
    expect(txt).toContain('الفاتورة الأصلية: #42')
  })
  it('shows tax rows only when tax is on, and the logo only when asked', () => {
    const doc = receiptDoc({ ...sale, tax: 100 }, { ...settings, tax: { enabled: true, rate: 10, inclusive: true, label: 'ض.ق.م' } })
    expect(doc.totals.map(l => l.label)).toContain('ض.ق.م (شامل)')
    const off = receiptDoc(sale, settings)
    expect(off.totals.some(l => l.label.includes('ض'))).toBe(false)
    const withLogo = receiptDoc(sale, { ...settings, store: { ...settings.store, logo: 'data:image/png;base64,AAAA' } })
    expect(withLogo.logo).toBeDefined()
    expect(receiptDoc(sale, { ...settings, store: { ...settings.store, logo: 'data:image/png;base64,AAAA' }, receipt: { ...settings.receipt, showLogo: false } }).logo).toBeUndefined()
    expect(receiptDoc(sale, { ...settings, receipt: { ...settings.receipt, showBarcode: false } }).barcode).toBeUndefined()
  })
})

describe('receipt and the exchange rate', () => {
  const fxSettings: Settings = { ...settings, currency2: { ...settings.currency2, enabled: true, rate: 13000, showOnReceipt: true } }
  const fxSale: Sale = {
    ...sale, rate: 13000, rateCode: 'USD', discount: 0, discountPct: undefined, subtotal: 130000, total: 130000, cost: 100000,
    payments: [{ method: 'cash', amount: 130000 }], paid: 130000, change: 0, credit: 0,
    items: [
      { productId: 'p1', name: 'زيت', unit: 'piece', qty: 1, price: 130000, originalPrice: 130000, cost: 100000, discount: 0, taxRate: 0, tax: 0, total: 130000, fxPrice: 10, fxCost: 7.69 },
    ],
  }
  it('prints the $ list price next to the lira price, the ≈ total and the rate line exactly once', () => {
    const doc = receiptDoc(fxSale, fxSettings)
    expect(doc.items[0].detail).toBe('1 × 130,000 ل.س ($10.00)')         // shown even for qty 1
    expect(doc.totals.map(l => l.label)).toContain('≈ بالـ$')
    expect(doc.totals.find(l => l.label === '≈ بالـ$')).toMatchObject({ value: '$10.00', small: true })
    expect(doc.payments.filter(l => l.label === 'سعر الصرف')).toHaveLength(1)
    expect(doc.payments.find(l => l.label === 'سعر الصرف')!.value).toBe('1 $ = 13,000 ل.س')
    const txt = receiptText(fxSale, fxSettings)
    expect(txt).toContain('($10.00)'); expect(txt).toContain('$10.00'); expect(txt).toContain('1 $ = 13,000 ل.س')
    expect(receiptHtml(fxSale, fxSettings)).toContain('≈ بالـ$')
  })
  it('does not print the rate twice when the cash came in dollars (that block already has it)', () => {
    const withFx: Sale = { ...fxSale, fx: { code: 'USD', symbol: '$', symbolAfter: false, decimals: 2, rate: 13000, received: 10, receivedPrimary: 130000 } }
    const doc = receiptDoc(withFx, fxSettings)
    expect(doc.payments.filter(l => l.label === 'سعر الصرف')).toHaveLength(1)
    expect(doc.payments.some(l => l.label === 'المستلم بـ$')).toBe(true)
  })
  it('prints nothing of it when the sale has no rate, the setting is off, or the line was overridden', () => {
    expect(receiptDoc({ ...fxSale, rate: undefined, rateCode: undefined }, fxSettings).totals.some(l => l.label.startsWith('≈'))).toBe(false)
    const off = receiptDoc(fxSale, { ...fxSettings, currency2: { ...fxSettings.currency2, showOnReceipt: false } })
    expect(off.totals.some(l => l.label.startsWith('≈'))).toBe(false)
    expect(off.payments.some(l => l.label === 'سعر الصرف')).toBe(false)
    expect(off.items[0].detail).toBeUndefined()
    const over = receiptDoc({ ...fxSale, items: [{ ...fxSale.items[0], price: 120000, total: 120000 }] }, fxSettings)
    expect(over.items[0].detail).toBe('1 × 120,000 ل.س')
    expect(over.items[0].original).toBe('130,000 ل.س')
  })
  it('uses the catalog when the sale was in another code, and prints the sale rate on a refund receipt', () => {
    const eur = receiptDoc({ ...fxSale, rateCode: 'EUR' }, fxSettings)
    expect(eur.totals.find(l => l.label.startsWith('≈'))!.value).toBe('€10.00')
    const doc = receiptDoc(fxSale, fxSettings, { refund: { ...refund, rate: 13000, rateCode: 'USD' } })
    expect(doc.payments.find(l => l.label === 'سعر الصرف')!.value).toBe('1 $ = 13,000 ل.س')
    expect(doc.totals.some(l => l.label.startsWith('≈'))).toBe(false)
    expect(receiptDoc(sale, settings, { refund }).payments.some(l => l.label === 'سعر الصرف')).toBe(false)
  })
})
