import { describe, it, expect } from 'vitest'
import '../i18n/core'
import { DEFAULT_SETTINGS, type Customer, type LedgerEntry, type Settings } from '../db/types'
import { normalizeText, phoneDigits, matchesCustomer, sortCustomers, customerStats, balanceKind, telUrl, whatsappUrl, reminderText, statementSlice, statementRows, statementHtml, voucherHtml } from './customers'

const settings: Settings = { ...DEFAULT_SETTINGS, store: { name: 'متجر الأمل', phone: '0911222333', address: 'دمشق' } }
const cust = (p: Partial<Customer>): Customer => ({ id: 'c', name: 'x', balance: 0, createdAt: 0, updatedAt: 0, ...p })
const entry = (p: Partial<LedgerEntry>): LedgerEntry => ({ id: 'e', customerId: 'c', type: 'sale', amount: 0, balanceAfter: 0, createdAt: 0, userId: 'u', ...p })

describe('search', () => {
  it('normalises Arabic spelling and digits', () => {
    expect(normalizeText('أَحْمَد')).toBe('احمد')
    expect(normalizeText('فاطمة')).toBe('فاطمه')
    expect(normalizeText('مصطفى')).toBe('مصطفي')
    expect(normalizeText('  ٠٩١١ ')).toBe('0911')
    expect(phoneDigits('+963 ٩١١-222')).toBe('963911222')
    expect(phoneDigits(undefined)).toBe('')
  })
  it('matches by name words or phone digits', () => {
    const c = cust({ name: 'أحمد محمّد', phone: '0911 222 333' })
    expect(matchesCustomer(c, '')).toBe(true)
    expect(matchesCustomer(c, 'احمد')).toBe(true)
    expect(matchesCustomer(c, 'محمد احمد')).toBe(true)
    expect(matchesCustomer(c, '٢٢٢')).toBe(true)
    expect(matchesCustomer(c, '0911222')).toBe(true)
    expect(matchesCustomer(c, 'علي')).toBe(false)
    expect(matchesCustomer(c, 'احمد 999')).toBe(false)
  })
  it('sorts by name, debt or recency', () => {
    const a = cust({ id: 'a', name: 'ياسر', balance: 500, updatedAt: 1 })
    const b = cust({ id: 'b', name: 'أحمد', balance: 2000, updatedAt: 3 })
    const c = cust({ id: 'c', name: 'سامر', balance: -100, updatedAt: 2 })
    expect(sortCustomers([a, b, c], 'name').map(x => x.id)).toEqual(['b', 'c', 'a'])
    expect(sortCustomers([a, b, c], 'debt').map(x => x.id)).toEqual(['b', 'a', 'c'])
    expect(sortCustomers([a, b, c], 'recent').map(x => x.id)).toEqual(['b', 'c', 'a'])
  })
  it('counts debtors and totals', () => {
    const s = customerStats([cust({ balance: 1500 }), cust({ balance: 0 }), cust({ balance: -200.4 }), cust({ balance: 0.6 })], 0)
    expect(s).toEqual({ count: 4, debtors: 2, totalDebt: 1501, totalCredit: 200 })
    expect(balanceKind(5)).toBe('owes'); expect(balanceKind(-5)).toBe('has'); expect(balanceKind(0)).toBe('zero')
  })
})

describe('links and messages', () => {
  it('builds tel: and wa.me links', () => {
    expect(telUrl('+963 911 222 333')).toBe('tel:+963911222333')
    expect(telUrl('0911-222')).toBe('tel:0911222')
    expect(whatsappUrl('00963 911 222 333')).toBe('https://wa.me/963911222333')
    expect(whatsappUrl('+963911222333', 'مرحباً')).toBe('https://wa.me/963911222333?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B')
  })
  it('writes the reminder with the store name and the amount', () => {
    const txt = reminderText({ storeName: 'متجر الأمل', customerName: 'علي', balance: 1500, currency: settings.currency })
    expect(txt).toContain('علي'); expect(txt).toContain('متجر الأمل'); expect(txt).toContain('1,500 ل.س')
    expect(reminderText({ storeName: 's', customerName: 'n', balance: -20, currency: settings.currency })).toContain('20 ل.س')
    expect(reminderText({ storeName: 's', customerName: 'n', balance: 0, currency: settings.currency })).toContain('مسدّد')
  })
})

describe('statement', () => {
  const entries = [
    entry({ id: '1', type: 'sale', amount: 1000, balanceAfter: 1000, createdAt: 100, refId: 's1', note: '#5' }),
    entry({ id: '2', type: 'payment', amount: -400, balanceAfter: 600, createdAt: 200, method: 'cash' }),
    entry({ id: '3', type: 'adjust', amount: -600, balanceAfter: 0, createdAt: 300, note: 'تسوية' }),
    entry({ id: '4', type: 'refund', amount: -50, balanceAfter: -50, createdAt: 400, refId: 'r1', note: '#5' }),
  ]
  it('slices a period and carries the opening balance', () => {
    const all = statementSlice(entries)
    expect(all.opening).toBe(0); expect(all.rows.map(e => e.id)).toEqual(['1', '2', '3', '4'])
    const part = statementSlice(entries.slice().reverse(), 150, 350)
    expect(part.opening).toBe(1000); expect(part.rows.map(e => e.id)).toEqual(['2', '3'])
    expect(statementSlice(entries, 1000).rows).toEqual([])
    expect(statementSlice(entries, 1000).opening).toBe(-50)
  })
  it('builds CSV rows with debit / credit columns and the receipt number', () => {
    const rows = statementRows({ customer: cust({ name: 'علي' }), entries, settings, receipts: new Map([['s1', 5], ['r1', 5]]) })
    expect(rows[0]).toHaveLength(5)
    expect(rows[1][2]).toBe(1000); expect(rows[1][3]).toBe(''); expect(rows[1][4]).toBe(1000)
    expect(String(rows[1][1])).toContain('#5'); expect(String(rows[1][1])).not.toContain('#5 · #5')
    expect(rows[2][3]).toBe(400); expect(String(rows[2][1])).toContain('نقداً')
    expect(String(rows[3][1])).toContain('تسوية')
    expect(rows[rows.length - 1][4]).toBe(-50)
    const period = statementRows({ customer: cust({}), entries, settings, from: 150, to: 350 })
    expect(period[1][1]).toBe('رصيد أول الفترة'); expect(period[1][4]).toBe(1000)
    expect(period[period.length - 1][4]).toBe(0)
  })
  it('renders printable HTML with the store, the customer and the closing balance', () => {
    const html = statementHtml({ customer: cust({ name: 'علي <b>', phone: '0999' }), entries, settings, from: 0, to: 500 })
    expect(html).toContain('dir="rtl"'); expect(html).toContain('متجر الأمل'); expect(html).toContain('علي &lt;b&gt;')
    expect(html).toContain('كشف حساب'); expect(html).toContain('رصيد أول الفترة'); expect(html).toContain('الرصيد النهائي')
    expect(html).toContain('50 ل.س')
    expect(statementHtml({ customer: cust({}), entries: [], settings })).toContain('لا توجد حركات')
    expect(statementHtml({ customer: cust({}), entries: [], settings: { ...settings, lang: 'en' } })).toContain('dir="ltr"')
  })
  it('renders a payment voucher', () => {
    const html = voucherHtml({ customer: cust({ name: 'علي' }), entry: entries[1], settings, userName: 'أحمد' })
    expect(html).toContain('إيصال قبض'); expect(html).toContain('400 ل.س'); expect(html).toContain('نقداً'); expect(html).toContain('أحمد')
    expect(voucherHtml({ customer: cust({}), entry: entries[3], settings })).toContain('إشعار إرجاع')
  })
})
