import 'fake-indexeddb/auto'
import type { Invoice, Payment, TreatmentItem } from '../src/db/types'
import { db, resetDatabase, updateClinic } from '../src/db'
import { setSetting } from '../src/db'
import {
  accountFrom, buildStatement, computeTotals, filterInvoices, groupByMethod, groupReceipts, invoiceBalance, invoiceStats, invoiceStatus, isRealDate, isValidTooth,
  legacyReceiptNo, lineTotal, lowerInvoiceTotal, normalizePeriod, onAccountNet, patientAccount, paymentStats, planReconcile, presetPeriod, previewAllocation, receiptKey,
  recomputeInvoice, reconcileWrites, sortInvoices, splitPayment, statusCounts, toDraftLines, toInvoiceItems, validateInvoice, hasErrors, roundMoney, pluralKey, type DraftLine,
} from '../src/features/billing/lib'
import { BillingError, cancelInvoice, deleteDraftInvoice, deleteReceipt, ensureReconciled, reconcilePatient, recordPayment, saveInvoice } from '../src/features/billing/actions'
import { todayISO } from '../src/db/ids'

const inv = (p: Partial<Invoice>): Invoice => ({
  id: 'i', number: 'INV-000001', patientId: 'p1', date: '2026-10-01', items: [], subtotal: 0, discount: 0, taxPercent: 0, tax: 0, total: 0, paid: 0, status: 'unpaid',
  createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', ...p,
})
const pay = (p: Partial<Payment>): Payment => ({ id: 'p', patientId: 'p1', amount: 0, method: 'cash', date: '2026-10-01', createdAt: '2026-10-01T09:00:00.000Z', ...p })
const line = (p: Partial<DraftLine>): DraftLine => ({ key: 'k', description: 'Filling', tooth: null, qty: 1, unitPrice: 100, discount: null, ...p })

describe('billing: totals', () => {
  it('line total = qty × price − discount, with the price rounded to the currency first (so the printed line adds up)', () => {
    expect(lineTotal(2, 100, 50)).toBe(150)
    expect(lineTotal(3, 33.333, 0)).toBe(99.99)
    expect(lineTotal(3, 1337.5, 0, 0)).toBe(4014)       // 1,338 × 3, as printed
    expect(lineTotal(1, 10.4, 0, 0) + lineTotal(1, 10.4, 0, 0)).toBe(20)
    expect(lineTotal(1, 7.125, 0, 3)).toBe(7.125)
    expect(lineTotal(1, 0.1, 0) + lineTotal(1, 0.2, 0)).toBeCloseTo(0.3)
    expect(lineTotal(1, 80)).toBe(80)
    expect(lineTotal(NaN as any, 10, 0)).toBe(0)
  })
  it('invoice totals: discount, then tax on the rest', () => {
    const items = [{ qty: 2, unitPrice: 100, discount: 20 }, { qty: 1, unitPrice: 50, discount: 0 }]
    expect(computeTotals(items, 0, 0)).toEqual({ subtotal: 230, discount: 0, tax: 0, total: 230 })
    expect(computeTotals(items, 30, 10)).toEqual({ subtotal: 230, discount: 30, tax: 20, total: 220 })
    expect(computeTotals(items, 0, 5)).toEqual({ subtotal: 230, discount: 0, tax: 11.5, total: 241.5 })
    expect(computeTotals([{ qty: 1, unitPrice: 99.99, discount: 0 }], 0, 7.5)).toEqual({ subtotal: 99.99, discount: 0, tax: 7.5, total: 107.49 })
  })
  it('rounds tax and total to the currency decimals (a 0-decimal currency gets whole amounts)', () => {
    const items = [{ qty: 1, unitPrice: 60, discount: 0 }, { qty: 1, unitPrice: 180, discount: 20 }, { qty: 1, unitPrice: 15, discount: 0 }]
    expect(computeTotals(items, 0, 5)).toEqual({ subtotal: 235, discount: 0, tax: 11.75, total: 246.75 })
    expect(computeTotals(items, 0, 5, 0)).toEqual({ subtotal: 235, discount: 0, tax: 12, total: 247 })
    expect(computeTotals(items, 0, 5, 2)).toEqual(computeTotals(items, 0, 5))
    expect(roundMoney(2.5, 0)).toBe(3); expect(roundMoney(1.005, 2)).toBe(1.01); expect(roundMoney(1.25, 7 as any)).toBe(1.25)
  })
  it('half-up rounding is exact for every half-cent (audit: 42.70 at 5% gave 2.13)', () => {
    expect(computeTotals([{ qty: 1, unitPrice: 42.7, discount: 0 }], 0, 5).tax).toBe(2.14)
    expect(computeTotals([{ qty: 1, unitPrice: 21.35, discount: 0 }], 0, 10).tax).toBe(2.14)
    expect(computeTotals([{ qty: 1, unitPrice: 14.5, discount: 0 }], 0, 15).tax).toBe(2.18)
    expect(roundMoney(10.075, 2)).toBe(10.08)
    expect(roundMoney(-1.005, 2)).toBe(-1.01)
    // exhaustive: every price from 0.01 to 2000.00 at 5%, 10% and 15%, against integer arithmetic
    for (const rate of [5, 10, 15]) {
      let wrong = 0
      for (let cents = 1; cents <= 200000; cents++) {
        const expected = Math.floor((cents * rate + 50) / 100) / 100   // half-up on whole cents
        if (computeTotals([{ qty: 1, unitPrice: cents / 100, discount: 0 }], 0, rate).tax !== expected) wrong++
      }
      expect(wrong).toBe(0)
    }
  }, 60_000)   // 600k cases: a few seconds, longer when the whole suite runs in parallel
  it('3-decimal currencies keep their fils (KWD, BHD, OMR, JOD)', () => {
    expect(computeTotals([{ qty: 1, unitPrice: 12.345, discount: 0 }], 0, 5, 3)).toEqual({ subtotal: 12.345, discount: 0, tax: 0.617, total: 12.962 })
    expect(computeTotals([{ qty: 1, unitPrice: 12.25, discount: 0 }], 0, 5, 3).tax).toBe(0.613)
    expect(computeTotals([{ qty: 2, unitPrice: 7.125, discount: 0.005 }], 0.1, 10, 3)).toEqual({ subtotal: 14.245, discount: 0.1, tax: 1.415, total: 15.56 })
    expect(invoiceStatus(12.962, 12.96, 'unpaid', 3)).toBe('partial')
    expect(invoiceStatus(12.962, 12.962, 'unpaid', 3)).toBe('paid')
    expect(invoiceBalance(inv({ total: 12.962, paid: 12.96, status: 'partial' }))).toBe(0.002)
  })
  it('0-decimal currencies: status is decided in whole units, as the amounts are shown', () => {
    expect(invoiceStatus(21, 20.6, 'unpaid', 0)).toBe('paid')
    expect(invoiceStatus(21, 20.4, 'unpaid', 0)).toBe('partial')
  })
  it('lowers an issued invoice by a refunded amount (credit note), tax included', () => {
    const items = [{ id: 'a', description: 'x', qty: 1, unitPrice: 100, discount: 0, total: 100 }]
    expect(lowerInvoiceTotal({ items, discount: 0, taxPercent: 0, total: 100 }, 30)).toEqual({ subtotal: 100, discount: 30, tax: 0, total: 70 })
    expect(lowerInvoiceTotal({ items, discount: 0, taxPercent: 5, total: 105 }, 30)).toEqual({ subtotal: 100, discount: 28.57, tax: 3.57, total: 75 })
    expect(lowerInvoiceTotal({ items, discount: 0, taxPercent: 5, total: 105 }, 105)).toEqual({ subtotal: 100, discount: 100, tax: 0, total: 0 })
    expect(lowerInvoiceTotal({ items, discount: 0, taxPercent: 5, total: 105 }, 106)).toBeNull()
    expect(lowerInvoiceTotal({ items, discount: 0, taxPercent: 5, total: 105 }, 0)).toBeNull()
    // 15% in whole units: some totals cannot be reached; the nearest lower one is used
    const big = [{ id: 'a', description: 'x', qty: 1, unitPrice: 1000, discount: 0, total: 1000 }]
    for (let by = 1; by <= 300; by++) {
      const t = lowerInvoiceTotal({ items: big, discount: 0, taxPercent: 15, total: 1150 }, by, 0)!
      expect(t.total).toBeLessThanOrEqual(1150 - by)
      expect(t.total).toBeGreaterThanOrEqual(1150 - by - 1)
      expect(t).toEqual(computeTotals(big, t.discount, 15, 0))
    }
  })
  it('the invoice discount never takes the total below zero', () => {
    expect(computeTotals([{ qty: 1, unitPrice: 100, discount: 0 }], 150, 10)).toEqual({ subtotal: 100, discount: 100, tax: 0, total: 0 })
    expect(computeTotals([], 10, 10)).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 })
    expect(computeTotals([{ qty: 1, unitPrice: 100, discount: 0 }], -5, -3)).toEqual({ subtotal: 100, discount: 0, tax: 0, total: 100 })
  })
})

describe('billing: status and balances', () => {
  it('derives paid / partial / unpaid', () => {
    expect(invoiceStatus(100, 0)).toBe('unpaid')
    expect(invoiceStatus(100, 40)).toBe('partial')
    expect(invoiceStatus(100, 100)).toBe('paid')
    expect(invoiceStatus(100, 120)).toBe('paid')
    expect(invoiceStatus(100, 99.999)).toBe('paid')
    expect(invoiceStatus(0, 0)).toBe('paid')
    expect(invoiceStatus(100, -10)).toBe('unpaid')
    expect(invoiceStatus(100, 40, 'paid')).toBe('partial')
  })
  it('drafts and cancelled invoices keep their status', () => {
    expect(invoiceStatus(100, 100, 'draft')).toBe('draft')
    expect(invoiceStatus(100, 0, 'cancelled')).toBe('cancelled')
  })
  it('balance of one invoice', () => {
    expect(invoiceBalance(inv({ total: 300, paid: 120, status: 'partial' }))).toBe(180)
    expect(invoiceBalance(inv({ total: 300, paid: 400, status: 'paid' }))).toBe(0)
    expect(invoiceBalance(inv({ total: 21, paid: 20.6, status: 'paid' }))).toBe(0)
    expect(invoiceBalance(inv({ total: 300, status: 'draft' }))).toBe(0)
    expect(invoiceBalance(inv({ total: 300, status: 'cancelled' }))).toBe(0)
  })
  it('patient account: issued invoices minus every payment', () => {
    const invoices = [inv({ total: 300, status: 'partial' }), inv({ total: 200, status: 'unpaid' }), inv({ total: 999, status: 'draft' }), inv({ total: 50, status: 'cancelled' })]
    const payments = [pay({ amount: 100 }), pay({ amount: 50, invoiceId: undefined }), pay({ amount: -20 })]
    expect(accountFrom(invoices, payments)).toEqual({ invoiced: 500, paid: 130, due: 370 })
    expect(accountFrom([], [pay({ amount: 80 })])).toEqual({ invoiced: 0, paid: 80, due: -80 })
  })
})

describe('billing: payments', () => {
  it('splits an overpayment into invoice + on account', () => {
    expect(splitPayment(150, { total: 300, paid: 200 })).toEqual({ onInvoice: 100, onAccount: 50 })
    expect(splitPayment(80, { total: 300, paid: 200 })).toEqual({ onInvoice: 80, onAccount: 0 })
    expect(splitPayment(80, { total: 300, paid: 300 })).toEqual({ onInvoice: 0, onAccount: 80 })
    expect(splitPayment(80, null)).toEqual({ onInvoice: 0, onAccount: 80 })
  })
  it('refunds take back at most what was paid on the invoice', () => {
    expect(splitPayment(-50, { total: 300, paid: 200 })).toEqual({ onInvoice: -50, onAccount: 0 })
    expect(splitPayment(-250, { total: 300, paid: 200 })).toEqual({ onInvoice: -200, onAccount: -50 })
    expect(splitPayment(-30, { total: 300, paid: 0 })).toEqual({ onInvoice: 0, onAccount: -30 })
  })
  it('ledger stats and grouping by method', () => {
    const list = [pay({ amount: 100, method: 'cash' }), pay({ amount: 50, method: 'card' }), pay({ amount: 70, method: 'transfer' }), pay({ amount: -20, method: 'cash' }), pay({ amount: 30, method: 'insurance' })]
    expect(paymentStats(list)).toEqual({ net: 230, cash: 80, cardTransfer: 120, refunds: 20, count: 5 })
    const groups = groupByMethod(list)
    expect(groups.map(g => g.method)).toEqual(['cash', 'card', 'transfer', 'insurance'])
    expect(groups[0]).toMatchObject({ count: 2, total: 80 })
    expect(groupByMethod([])).toEqual([])
  })
  it('older payments without a receipt number print the id tail', () => {
    expect(legacyReceiptNo('lq2k3abcdef123')).toBe('DEF123')
  })
  it('groups the rows of one hand-over into one receipt', () => {
    const rows = [
      pay({ id: 'a1', receiptNo: 'R-000004', invoiceId: 'i1', amount: 91.74, createdAt: '2026-10-02T09:00:00.000Z', date: '2026-10-02' }),
      pay({ id: 'a2', receiptNo: 'R-000004', amount: 28.26, createdAt: '2026-10-02T09:00:00.000Z', date: '2026-10-02' }),
      pay({ id: 'b1', receiptNo: 'R-000003', invoiceId: 'i1', amount: 50, createdAt: '2026-10-01T09:00:00.000Z', date: '2026-10-01' }),
      pay({ id: 'c1', invoiceId: 'i0', amount: 10, createdAt: '2026-09-01T09:00:00.000Z', date: '2026-09-01' }),   // older rows: grouped by creation
      pay({ id: 'c2', amount: 5, createdAt: '2026-09-01T09:00:00.000Z', date: '2026-09-01' }),
    ]
    const g = groupReceipts(rows)
    expect(g.map(x => [x.label, x.amount, x.rows.length])).toEqual([['R-000004', 120, 2], ['R-000003', 50, 1], ['C1', 15, 2]])
    expect(g[0]).toMatchObject({ allocations: [{ invoiceId: 'i1', amount: 91.74 }], onAccount: 28.26, numbered: true })
    expect(g[2].numbered).toBe(false)
    expect(receiptKey(rows[0])).toBe(receiptKey(rows[1]))
    expect(paymentStats(g).count).toBe(3)                     // the cash report counts hand-overs
  })
})

describe('billing: lists', () => {
  const patients = new Map([['p1', { name: 'أحمد الخطيب', fileNo: 12, phone: '0944 123 456' }], ['p2', { name: 'Layla Haddad', fileNo: 7, phone: '' }]])
  const list = [
    inv({ id: 'a', number: 'INV-000001', patientId: 'p1', doctorId: 'd1', status: 'paid', total: 100, paid: 100, date: '2026-10-02' }),
    inv({ id: 'b', number: 'INV-000002', patientId: 'p2', doctorId: 'd2', status: 'partial', total: 200, paid: 50, date: '2026-10-05' }),
    inv({ id: 'c', number: 'DRAFT', patientId: 'p1', doctorId: 'd1', status: 'draft', total: 70, date: '2026-10-05', createdAt: '2026-10-05T10:00:00.000Z' }),
    inv({ id: 'd', number: 'INV-000003', patientId: 'p2', status: 'cancelled', total: 40, date: '2026-10-03' }),
  ]
  it('stats count issued invoices only', () => {
    expect(invoiceStats(list)).toEqual({ invoiced: 300, collected: 150, outstanding: 150, count: 2, drafts: 1 })
  })
  it('sorts with plain comparisons (no localeCompare on ISO dates)', () => {
    expect(sortInvoices([inv({ id: 'x', date: '2026-01-02' }), inv({ id: 'y', date: '2026-10-02' }), inv({ id: 'z', date: '2026-10-02', createdAt: '2026-10-02T10:00:00.000Z' })]).map(i => i.id)).toEqual(['z', 'y', 'x'])
  })
  it('filters by status, doctor and Arabic-aware search', () => {
    expect(filterInvoices(list, { status: 'partial' }, patients).map(i => i.id)).toEqual(['b'])
    expect(filterInvoices(list, { doctorId: 'd1' }, patients).map(i => i.id)).toEqual(['a', 'c'])
    expect(filterInvoices(list, { q: 'احمد' }, patients).map(i => i.id)).toEqual(['a', 'c'])
    expect(filterInvoices(list, { q: '000002' }, patients).map(i => i.id)).toEqual(['b'])
    expect(filterInvoices(list, { q: 'layla' }, patients).map(i => i.id)).toEqual(['b', 'd'])
    expect(filterInvoices(list, { q: '0944123' }, patients).map(i => i.id)).toEqual(['a', 'c'])
    expect(filterInvoices(list, { status: 'all', q: '' }, patients)).toHaveLength(4)
  })
  it('sorts newest first and counts statuses', () => {
    expect(sortInvoices(list).map(i => i.id)).toEqual(['c', 'b', 'd', 'a'])
    expect(statusCounts(list)).toEqual({ all: 4, draft: 1, unpaid: 0, partial: 1, paid: 1, cancelled: 1 })
  })
})

describe('billing: periods', () => {
  it('presets around a date (week starts Saturday)', () => {
    expect(presetPeriod('today', '2026-10-10')).toEqual({ preset: 'today', from: '2026-10-10', to: '2026-10-10' })
    expect(presetPeriod('week', '2026-10-10')).toEqual({ preset: 'week', from: '2026-10-10', to: '2026-10-16' })   // 10 Oct 2026 is a Saturday
    expect(presetPeriod('week', '2026-10-09')).toEqual({ preset: 'week', from: '2026-10-03', to: '2026-10-09' })
    expect(presetPeriod('month', '2026-10-10')).toEqual({ preset: 'month', from: '2026-10-01', to: '2026-10-31' })
    expect(presetPeriod('lastMonth', '2026-03-31')).toEqual({ preset: 'lastMonth', from: '2026-02-01', to: '2026-02-28' })
    expect(presetPeriod('lastMonth', '2026-01-15')).toEqual({ preset: 'lastMonth', from: '2025-12-01', to: '2025-12-31' })
    expect(presetPeriod('custom', '2026-10-10')).toEqual({ preset: 'custom', from: '2026-10-01', to: '2026-10-31' })
  })
  it('normalizes custom ranges', () => {
    expect(normalizePeriod({ preset: 'custom', from: '2026-10-20', to: '2026-10-01' })).toEqual({ preset: 'custom', from: '2026-10-01', to: '2026-10-20' })
    expect(normalizePeriod({ preset: 'custom', from: '', to: '2026-10-01' })).toEqual({ preset: 'custom', from: '2026-10-01', to: '2026-10-01' })
    expect(isRealDate('2024-02-29')).toBe(true)
    expect(isRealDate('2026-02-29')).toBe(false)
  })
})

describe('billing: statement', () => {
  it('runs the balance in date order; refunds are debits; drafts and cancelled are skipped', () => {
    const rows = buildStatement(
      [inv({ id: 'a', number: 'INV-1', total: 300, date: '2026-10-01' }), inv({ id: 'b', number: 'INV-2', total: 200, date: '2026-10-05' }), inv({ id: 'x', total: 50, status: 'draft' }), inv({ id: 'y', total: 50, status: 'cancelled' })],
      [pay({ id: 'p1', amount: 100, date: '2026-10-01' }), pay({ id: 'p2', amount: 250, date: '2026-10-06' }), pay({ id: 'p3', amount: -50, date: '2026-10-07', method: 'cash' })],
    )
    expect(rows.map(r => [r.kind, r.debit, r.credit, r.balance])).toEqual([
      ['invoice', 300, 0, 300], ['payment', 0, 100, 200], ['invoice', 200, 0, 400], ['payment', 0, 250, 150], ['refund', 50, 0, 200],
    ])
  })
})

describe('billing: invoice editor', () => {
  it('validates FDI tooth numbers', () => {
    expect([11, 18, 28, 48, 51, 55, 85].every(isValidTooth)).toBe(true)
    expect([10, 19, 49, 56, 86, 9, 100, 11.5].some(isValidTooth)).toBe(false)
  })
  it('reports missing patient, empty items and bad lines', () => {
    const e = validateInvoice({ patientId: '', date: '2026-10-10', lines: [], discount: null, taxPercent: 0 })
    expect(e.patient).toBe('required'); expect(e.items).toBe('empty'); expect(hasErrors(e)).toBe(true)
    const e2 = validateInvoice({ patientId: 'p', date: '2026-10-10', lines: [line({ key: 'a', description: ' ', discount: 150 }), line({ key: 'b', qty: 0, tooth: 19 })], discount: 500, taxPercent: 120 })
    expect(e2.lines.a).toEqual({ description: 'required', discount: 'tooBig' })
    expect(e2.lines.b).toEqual({ qty: 'positive', tooth: 'tooth' })
    expect(e2.discount).toBe('tooBig'); expect(e2.tax).toBe('number')
    expect(hasErrors(validateInvoice({ patientId: 'p', date: '2026-10-10', lines: [line({ key: 'a', tooth: 36, discount: 20 })], discount: 10, taxPercent: 5 }))).toBe(false)
  })
  it('flags a due date before the issue date, a negative discount and a non-numeric tax', () => {
    const ok = { patientId: 'p', date: '2026-10-10', lines: [line({ key: 'a' })], discount: null, taxPercent: null }
    expect(validateInvoice({ ...ok, dueDate: '2026-10-01' }).dueDate).toBe('beforeIssue')
    expect(validateInvoice({ ...ok, dueDate: '2026-10-10' }).dueDate).toBeUndefined()
    expect(validateInvoice({ ...ok, dueDate: '2026-02-30' }).dueDate).toBe('date')
    expect(hasErrors(validateInvoice({ ...ok, dueDate: '2026-10-01' }))).toBe(true)
    expect(validateInvoice({ ...ok, discount: -5 }).discount).toBe('number')
    expect(validateInvoice({ ...ok, discount: 500 }).discount).toBe('tooBig')
    expect(validateInvoice({ ...ok, taxPercent: NaN }).tax).toBe('number')
    expect(hasErrors(validateInvoice(ok))).toBe(false)
  })
  it('picks the Arabic and English plural forms', () => {
    expect([0, 1, 2, 3, 10, 11, 100].map(n => pluralKey('c', n, 'ar'))).toEqual(['c.zero', 'c.one', 'c.two', 'c.few', 'c.few', 'c.many', 'c.other'])
    expect([0, 1, 2, 7].map(n => pluralKey('c', n, 'en'))).toEqual(['c.other', 'c.one', 'c.other', 'c.other'])
  })
  it('round-trips lines and items', () => {
    const items = toInvoiceItems([line({ key: 'a', tooth: 36, qty: 2, unitPrice: 50, discount: 10, treatmentItemId: 't1' }), line({ key: 'b', tooth: null, discount: null })])
    expect(items[0]).toEqual({ id: 'a', treatmentItemId: 't1', description: 'Filling', tooth: 36, qty: 2, unitPrice: 50, discount: 10, total: 90 })
    expect(items[1]).toEqual({ id: 'b', description: 'Filling', qty: 1, unitPrice: 100, discount: 0, total: 100 })
    expect(toDraftLines(items)[1]).toMatchObject({ key: 'b', tooth: null, discount: null })
  })
})

describe('billing: credit allocation (pure)', () => {
  let n = 0
  const mk = () => `new${++n}`
  it('credit on account settles open invoices oldest first, splitting the deposit row', () => {
    const invoices = [inv({ id: 'b', total: 300, date: '2026-10-05' }), inv({ id: 'a', total: 100, date: '2026-10-01' })]
    const payments = [pay({ id: 'd', amount: 250, receiptNo: 'R-000001', date: '2026-09-20' })]
    const w = reconcileWrites(invoices, payments, 2, mk, 'now')
    const rows = w.payments.map(p => [p.invoiceId, p.amount, p.receiptNo, p.date]).sort()
    expect(rows).toEqual([['a', 100, 'R-000001', '2026-09-20'], ['b', 150, 'R-000001', '2026-09-20']])
    expect(w.payments.some(p => p.id === 'd')).toBe(true)        // the original row is kept (one half), the other half is new
    expect(w.invoices.map(i => [i.id, i.paid, i.status])).toEqual([['b', 150, 'partial'], ['a', 100, 'paid']])
  })
  it('keeps the credit when there is nothing open, and touches nothing when all is in order', () => {
    expect(planReconcile([inv({ id: 'a', total: 100, paid: 100, status: 'paid' })], [pay({ id: 'x', invoiceId: 'a', amount: 100 }), pay({ id: 'y', amount: 40 })], mk).put).toEqual([])
  })
  it('money on a cancelled invoice returns to the account and pays the next one', () => {
    const invoices = [inv({ id: 'c', total: 100, paid: 100, status: 'cancelled' }), inv({ id: 'n', total: 80, date: '2026-10-06' })]
    const w = reconcileWrites(invoices, [pay({ id: 'x', invoiceId: 'c', amount: 100 })], 2, mk, 'now')
    const rows = [...w.payments].sort((a, b) => a.amount - b.amount)
    expect(rows.map(p => [p.invoiceId, p.amount])).toEqual([[undefined, 20], ['n', 80]])
    expect(w.invoices.map(i => [i.id, i.paid, i.status])).toEqual([['c', 0, 'cancelled'], ['n', 80, 'paid']])
  })
  it('an invoice holding more than its total gives the excess back', () => {
    const w = reconcileWrites([inv({ id: 'a', total: 100, paid: 130, status: 'paid' })], [pay({ id: 'x', invoiceId: 'a', amount: 130 })], 2, mk, 'now')
    expect(w.payments.map(p => [p.invoiceId, p.amount]).sort()).toEqual([['a', 100], [undefined, 30]].sort())
  })
  it('older data: a refund on account beyond the credit comes off the last paid invoice, so the debt shows on it', () => {
    const invoices = [inv({ id: 'a', total: 105, paid: 105, status: 'paid' })]
    const payments = [pay({ id: 'x', invoiceId: 'a', amount: 105 }), pay({ id: 'r', amount: -30, date: '2026-10-09' })]
    const w = reconcileWrites(invoices, payments, 2, mk, 'now')
    expect(w.payments.map(p => [p.id, p.invoiceId, p.amount])).toEqual([['r', 'a', -30]])
    expect(w.invoices.map(i => [i.paid, i.status])).toEqual([[75, 'partial']])
    expect(onAccountNet([...payments.filter(p => p.id !== 'r'), ...w.payments])).toBe(0)
  })
  it('previews where a payment goes: the chosen invoice, the other open ones oldest first, then credit', () => {
    const open = [inv({ id: 'b', number: 'INV-2', total: 50, paid: 0, date: '2026-10-05' }), inv({ id: 'a', number: 'INV-1', total: 100, paid: 60, date: '2026-10-01' })]
    expect(previewAllocation(200, open[0], open)).toEqual({ lines: [{ id: 'b', number: 'INV-2', amount: 50 }, { id: 'a', number: 'INV-1', amount: 40 }], credit: 110 })
    expect(previewAllocation(30, null, open)).toEqual({ lines: [{ id: 'a', number: 'INV-1', amount: 30 }], credit: 0 })
  })
})

describe('billing: database flows', () => {
  const tr = (p: Partial<TreatmentItem>): TreatmentItem => ({ id: 't', patientId: 'p1', procedureName: 'Composite filling', price: 80, discount: 0, status: 'completed', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', ...p })
  const patient = (id: string) => ({ id, fileNo: 1, name: `Patient ${id}`, gender: 'female' as const, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
  const admin = { id: 'u-admin', name: 'Admin', role: 'admin' as const, pinHash: '', pinSalt: '', color: '#000', active: true, createdAt: '', updatedAt: '' }
  const reception = { ...admin, id: 'u-rec', role: 'receptionist' as const }
  beforeEach(async () => {
    await resetDatabase()
    await updateClinic({ invoicePrefix: 'INV-', nextInvoiceNumber: 7 })
    await db.patients.bulkPut([patient('p1'), patient('p2')])
    await db.users.bulkPut([admin, reception])
    await db.treatments.bulkPut([tr({ id: 't1', tooth: 36 }), tr({ id: 't2', tooth: 21, price: 120 })])
  })
  const input = (over: Partial<Parameters<typeof saveInvoice>[0]> = {}) => ({
    patientId: 'p1', date: '2026-10-10', discount: 0, taxPercent: 0,
    items: [{ id: 'l1', treatmentItemId: 't1', description: 'Composite filling', tooth: 36, qty: 1, unitPrice: 80, discount: 0, total: 80 }, { id: 'l2', description: 'X-ray', qty: 1, unitPrice: 20, discount: 0, total: 20 }],
    ...over,
  })
  const free = (unitPrice: number, id = 'f') => ({ id, description: 'Free line', qty: 1, unitPrice, discount: 0, total: unitPrice })
  const day = '2026-10-10'
  /** The figures every screen shows must agree: Σ open invoice dues (invoices, dashboard, reports) = Σ positive patient balances (patients). */
  async function screensAgree() {
    const [invoices, payments] = await Promise.all([db.invoices.toArray(), db.payments.toArray()])
    const byInvoices = invoices.reduce((a, i) => a + invoiceBalance(i), 0)
    const ids = [...new Set([...invoices.map(i => i.patientId), ...payments.map(p => p.patientId)])]
    const byPatients = ids.map(id => accountFrom(invoices.filter(i => i.patientId === id), payments.filter(p => p.patientId === id)).due).filter(d => d > 0).reduce((a, d) => a + d, 0)
    expect(Math.round(byInvoices * 100) / 100).toBe(Math.round(byPatients * 100) / 100)
    for (const i of invoices) {
      const paid = payments.filter(p => p.invoiceId === i.id).reduce((a, p) => a + p.amount, 0)
      expect(Math.round(i.paid * 100) / 100).toBe(Math.round(paid * 100) / 100)
    }
    return byInvoices
  }

  it('a draft keeps the DRAFT number and takes a real one when issued', async () => {
    const draft = await saveInvoice(input(), { mode: 'draft' })
    expect(draft).toMatchObject({ number: 'DRAFT', status: 'draft', total: 100 })
    expect((await db.treatments.get('t1'))?.invoiceId).toBe(draft.id)
    expect((await db.clinic.get('clinic'))?.nextInvoiceNumber).toBe(7)
    const issued = await saveInvoice(input(), { id: draft.id, mode: 'issue' })
    expect(issued).toMatchObject({ id: draft.id, number: 'INV-000007', status: 'unpaid', createdAt: draft.createdAt })
    expect((await db.clinic.get('clinic'))?.nextInvoiceNumber).toBe(8)
    const edited = await saveInvoice(input({ items: input().items.slice(1) }), { id: draft.id, mode: 'issue' })
    expect(edited.number).toBe('INV-000007')
    expect(edited.total).toBe(20)
    expect((await db.treatments.get('t1'))?.invoiceId).toBeUndefined()
  })

  it('payments update the cached paid/status; overpayment goes on account; receipts are numbered in sequence', async () => {
    const a = await saveInvoice(input({ taxPercent: 10 }), { mode: 'issue' })
    expect(a.total).toBe(110)
    const first = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 60, method: 'cash', date: day, receivedBy: 'u1' })
    expect(first).toHaveLength(1)
    expect(first[0].receiptNo).toBe('R-000001')
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 60, status: 'partial' })
    const second = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'card', date: day, reference: ' 4421 ' })
    expect(second.map(p => [p.invoiceId, p.amount, p.receiptNo])).toEqual([[a.id, 50, 'R-000002'], [undefined, 50, 'R-000002']])
    expect(second[0].reference).toBe('4421')
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 110, status: 'paid' })
    expect(await patientAccount('p1')).toEqual({ invoiced: 110, paid: 160, due: -50 })
    expect(groupReceipts(await db.payments.toArray()).map(g => [g.label, g.amount])).toEqual([['R-000002', 100], ['R-000001', 60]])
    await deleteReceipt(second[0].id, 'u-admin')            // the whole hand-over goes
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 60, status: 'partial' })
    expect(await db.payments.count()).toBe(1)
    await db.payments.where('invoiceId').equals(a.id).delete()
    expect(await recomputeInvoice(a.id)).toMatchObject({ paid: 0, status: 'unpaid' })
    expect(await recomputeInvoice('nope')).toBeUndefined()
  })

  it('credit pays the next invoice at once, so the invoices and the patient balance always agree (audit: 5,131 vs 4,906)', async () => {
    const dep = await recordPayment({ patientId: 'p1', amount: 400, method: 'cash', date: day })
    expect(dep[0].invoiceId).toBeUndefined()
    const a = await saveInvoice(input({ items: [free(141.74)] }), { mode: 'issue' })
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 141.74, status: 'paid' })
    const b = await saveInvoice(input({ items: [free(300, 'g')] }), { mode: 'issue' })
    expect(await db.invoices.get(b.id)).toMatchObject({ paid: 258.26, status: 'partial' })
    expect(await screensAgree()).toBeCloseTo(41.74)
    // every row still belongs to the one deposit receipt
    expect(groupReceipts(await db.payments.toArray()).map(g => [g.label, g.amount, g.allocations.length])).toEqual([['R-000001', 400, 2]])
  })

  it('an overpayment settles the patient’s other open invoices before it becomes credit (audit: overdue 21 next to outstanding 0)', async () => {
    const a = await saveInvoice(input({ items: [free(141.74)] }), { mode: 'issue' })
    const b = await saveInvoice(input({ items: [free(21, 'g')], date: '2026-08-01' }), { mode: 'issue' })
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 50, method: 'cash', date: day })
    const r = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 120, method: 'cash', date: day })
    expect(await db.invoices.get(a.id)).toMatchObject({ status: 'paid' })
    expect(await db.invoices.get(b.id)).toMatchObject({ paid: 21, status: 'paid' })
    expect(await patientAccount('p1')).toEqual({ invoiced: 162.74, paid: 170, due: -7.26 })
    const receipt = groupReceipts((await db.payments.toArray()).filter(p => p.receiptNo === r[0].receiptNo))[0]
    expect(receipt.amount).toBe(120)                       // one receipt for the full amount handed over
    expect(receipt.allocations.map(x => x.amount).sort()).toEqual([21, 91.74])
    expect(receipt.onAccount).toBe(7.26)
    await screensAgree()
  })

  it('cancelling an invoice moves its payments to the patient’s other open invoices', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'cash', date: day })
    const b = await saveInvoice(input({ items: [free(60)] }), { mode: 'issue' })
    expect((await db.invoices.get(b.id))?.status).toBe('unpaid')
    await cancelInvoice(a.id)
    expect(await db.invoices.get(a.id)).toMatchObject({ status: 'cancelled', paid: 0 })
    expect(await db.invoices.get(b.id)).toMatchObject({ paid: 60, status: 'paid' })
    expect(await patientAccount('p1')).toEqual({ invoiced: 60, paid: 100, due: -40 })
    await screensAgree()
  })

  it('refunds never create a debt no invoice shows (audit: phantom 30 after refunding a paid invoice)', async () => {
    const a = await saveInvoice(input({ taxPercent: 5 }), { mode: 'issue' })
    expect(a.total).toBe(105)
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 105, method: 'card', date: day })
    // on account, with no credit: refused
    await expect(recordPayment({ patientId: 'p1', amount: -30, method: 'card', date: day })).rejects.toThrow('refundTooBig')
    // against the invoice, with a credit note: the invoice is lowered and nothing is owed
    const r = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: -30, method: 'card', date: day, creditNote: true, creditNoteText: 'Lowered with refund {receipt}' })
    expect(r.map(p => [p.invoiceId, p.amount])).toEqual([[a.id, -30]])
    const after = await db.invoices.get(a.id)
    expect(after).toMatchObject({ total: 75, paid: 75, status: 'paid', discount: 28.57, tax: 3.57 })
    expect(after?.notes).toBe(`Lowered with refund ${r[0].receiptNo}`)
    expect(await patientAccount('p1')).toEqual({ invoiced: 75, paid: 75, due: 0 })
    expect(await screensAgree()).toBe(0)
    // without the credit note, the invoice shows what the patient owes again (and so does every other screen)
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: -10, method: 'card', date: day })
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 65, status: 'partial' })
    expect(await screensAgree()).toBe(10)
    // a refund from credit
    await recordPayment({ patientId: 'p1', amount: 50, method: 'cash', date: day })
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 75, status: 'paid' })
    await recordPayment({ patientId: 'p1', amount: -40, method: 'cash', date: day })
    await expect(recordPayment({ patientId: 'p1', amount: -1, method: 'cash', date: day })).rejects.toThrow('refundTooBig')
    expect(await patientAccount('p1')).toEqual({ invoiced: 75, paid: 75, due: 0 })
    await screensAgree()
  })

  it('uses the clinic currency decimals for prices, tax, total and payments', async () => {
    await updateClinic({ currencyDecimals: 0 })
    const a = await saveInvoice(input({ taxPercent: 5, items: [{ id: 'l1', description: 'Filling', qty: 1, unitPrice: 235, discount: 0, total: 235 }] }), { mode: 'issue' })
    expect(a).toMatchObject({ subtotal: 235, tax: 12, total: 247 })
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 247, method: 'cash', date: day })
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 247, status: 'paid' })
    // audit: two lines of 10.4 printed as 10 + 10 = 21; a payment of 20.6 on 21 stayed partly paid
    const b = await saveInvoice(input({ items: [free(10.4, 'x'), free(10.4, 'y')] }), { mode: 'issue' })
    expect(b.items.map(i => [i.unitPrice, i.total])).toEqual([[10, 10], [10, 10]])
    expect(b.total).toBe(20)
    const c = await saveInvoice(input({ items: [free(21, 'z')] }), { mode: 'issue' })
    const p = await recordPayment({ patientId: 'p1', invoiceId: c.id, amount: 20.6, method: 'cash', date: day })
    expect(p[0].amount).toBe(21)
    expect(await db.invoices.get(c.id)).toMatchObject({ paid: 21, status: 'paid' })
    await updateClinic({ currencyDecimals: 3 })
    const k = await saveInvoice(input({ taxPercent: 5, items: [free(12.345, 'k')] }), { mode: 'issue' })
    expect(k).toMatchObject({ subtotal: 12.345, tax: 0.617, total: 12.962 })
    const kp = await recordPayment({ patientId: 'p1', invoiceId: k.id, amount: 12.96, method: 'cash', date: day })
    expect(kp[0].amount).toBe(12.96)
    expect(await db.invoices.get(k.id)).toMatchObject({ status: 'partial' })
  })

  it('refuses a treatment that is already billed on another invoice, and zero payments', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    await expect(saveInvoice(input(), { mode: 'issue' })).rejects.toBeInstanceOf(BillingError)
    await expect(saveInvoice(input({ patientId: 'p2' }), { id: a.id, mode: 'issue' })).rejects.toThrow('alreadyBilled')
    expect((await db.clinic.get('clinic'))?.nextInvoiceNumber).toBe(8)   // the refused invoice took no number
    expect(await db.invoices.count()).toBe(1)
    await expect(recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 0, method: 'cash', date: day })).rejects.toThrow('zeroAmount')
    await updateClinic({ currencyDecimals: 0 })
    await expect(recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 0.4, method: 'cash', date: day })).rejects.toThrow('zeroAmount')
    expect(await db.payments.count()).toBe(0)
    expect((await db.clinic.get('clinic'))?.nextReceiptNumber ?? 1).toBe(1)   // a refused payment took no receipt number
  })

  it('refuses payments dated in the future and records for a deleted patient (audit: second tab)', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    const tomorrow = new Date(Date.now() + 86_400_000)
    const t = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    await expect(recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 10, method: 'cash', date: t })).rejects.toThrow('futureDate')
    await expect(recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 10, method: 'cash', date: '2026-02-30' })).rejects.toThrow('badDate')
    expect((await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 10, method: 'cash', date: todayISO() }))[0].date).toBe(todayISO())
    await db.patients.delete('p2')
    await expect(saveInvoice(input({ patientId: 'p2', items: [free(5)] }), { mode: 'issue' })).rejects.toThrow('patientMissing')
    await expect(recordPayment({ patientId: 'p2', amount: 10, method: 'cash', date: day })).rejects.toThrow('patientMissing')
    expect(await db.invoices.where('patientId').equals('p2').count()).toBe(0)
    expect(await db.payments.where('patientId').equals('p2').count()).toBe(0)
  })

  it('only the admin deletes payments, and a refunded credit must lose its refund first', async () => {
    const dep = await recordPayment({ patientId: 'p1', amount: 100, method: 'cash', date: day })
    await expect(deleteReceipt(dep[0].id, 'u-rec')).rejects.toThrow('notAllowed')
    await expect(deleteReceipt(dep[0].id, undefined)).rejects.toThrow('notAllowed')
    const refund = await recordPayment({ patientId: 'p1', amount: -30, method: 'cash', date: day })
    await expect(deleteReceipt(dep[0].id, 'u-admin')).rejects.toThrow('refundedCredit')
    await deleteReceipt(refund[0].id, 'u-admin')
    await deleteReceipt(dep[0].id, 'u-admin')
    expect(await db.payments.count()).toBe(0)
    // on an invoice too: the payment cannot go while a refund taken off it stays (it would leave a debt no invoice can carry once cancelled)
    const a = await saveInvoice(input(), { mode: 'issue' })
    const paid = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'cash', date: day })
    const back = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: -30, method: 'cash', date: day })
    await expect(deleteReceipt(paid[0].id, 'u-admin')).rejects.toThrow('refundedCredit')
    await deleteReceipt(back[0].id, 'u-admin')
    await deleteReceipt(paid[0].id, 'u-admin')
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 0, status: 'unpaid' })
  })

  it('refunds reduce what was paid on the invoice', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'cash', date: day })
    const r = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: -30, method: 'cash', date: '2026-10-11' > todayISO() ? day : '2026-10-11' })
    expect(r[0]).toMatchObject({ invoiceId: a.id, amount: -30 })
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 70, status: 'partial' })
  })

  it('cancel keeps the number and frees treatments; only drafts can be deleted', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    expect(await deleteDraftInvoice(a.id)).toBe(false)
    const c = await cancelInvoice(a.id)
    expect(c).toMatchObject({ status: 'cancelled', number: a.number })
    expect((await db.treatments.get('t1'))?.invoiceId).toBeUndefined()
    await expect(saveInvoice(input(), { id: a.id, mode: 'issue' })).rejects.toThrow()
    const d = await saveInvoice(input(), { mode: 'draft' })
    expect(await deleteDraftInvoice(d.id)).toBe(true)
    expect(await db.invoices.get(d.id)).toBeUndefined()
    expect((await db.treatments.get('t1'))?.invoiceId).toBeUndefined()
  })

  it('older data is reconciled once: credit, money on cancelled invoices, refunds beyond the credit', async () => {
    const mkInv = (id: string, total: number, extra: Partial<Invoice> = {}) => inv({ id, number: id, patientId: 'p1', total, subtotal: total, status: 'unpaid', ...extra })
    await db.invoices.bulkPut([mkInv('A', 100, { date: '2026-09-01' }), mkInv('B', 50, { date: '2026-09-05' }), mkInv('C', 70, { paid: 70, status: 'cancelled' }), inv({ id: 'Q', number: 'Q', patientId: 'p2', total: 105, paid: 105, status: 'paid' })])
    await db.payments.bulkPut([
      pay({ id: 'dep', patientId: 'p1', amount: 120, date: '2026-08-20' }),                 // a deposit never applied
      pay({ id: 'onC', patientId: 'p1', invoiceId: 'C', amount: 70, date: '2026-09-02' }), // left on a cancelled invoice
      pay({ id: 'q1', patientId: 'p2', invoiceId: 'Q', amount: 105 }), pay({ id: 'q2', patientId: 'p2', amount: -30 }),  // a phantom-debt refund
    ])
    await setSetting('billing.reconcile', null)
    await ensureReconciled()
    expect(await db.invoices.get('A')).toMatchObject({ paid: 100, status: 'paid' })
    expect(await db.invoices.get('B')).toMatchObject({ paid: 50, status: 'paid' })
    expect(await db.invoices.get('C')).toMatchObject({ paid: 0, status: 'cancelled' })
    expect(await db.invoices.get('Q')).toMatchObject({ paid: 75, status: 'partial' })
    expect(await patientAccount('p1')).toEqual({ invoiced: 150, paid: 190, due: -40 })
    await screensAgree()
    // a later invoice made outside billing (e.g. "bill completed work") is picked up by the next check
    await db.invoices.put(mkInv('D', 30, { date: '2026-10-01' }))
    await ensureReconciled()
    expect(await db.invoices.get('D')).toMatchObject({ paid: 30, status: 'paid' })
    await reconcilePatient('p1')
    await screensAgree()
  })
  it('a bulk write outside billing after the first check (a demo load, an import) gets a full check again', async () => {
    await ensureReconciled()                                           // the clinic was checked once, while empty
    // then many rows arrive at once; p2 only has paid invoices and an older-style refund beyond its credit
    const many = Array.from({ length: 60 }, (_, k) => inv({ id: `x${k}`, number: `X${k}`, patientId: 'p1', total: 10, subtotal: 10, paid: 10, status: 'paid', date: '2026-09-01' }))
    await db.invoices.bulkPut([...many, inv({ id: 'Q', number: 'Q', patientId: 'p2', total: 105, paid: 105, status: 'paid' })])
    await db.payments.bulkPut([...many.map(i => pay({ id: `y${i.id}`, patientId: 'p1', invoiceId: i.id, amount: 10, date: '2026-09-01' })), pay({ id: 'q1', patientId: 'p2', invoiceId: 'Q', amount: 105 }), pay({ id: 'q2', patientId: 'p2', amount: -30 })])
    await ensureReconciled()
    expect(await db.invoices.get('Q')).toMatchObject({ paid: 75, status: 'partial' })
    await screensAgree()
    // a single outside write afterwards stays the cheap check of the patients with open invoices
    await db.invoices.put(inv({ id: 'D', number: 'D', patientId: 'p2', total: 5, subtotal: 5, status: 'unpaid', date: '2026-10-01' }))
    await ensureReconciled()
    await screensAgree()
  })
})

describe('billing: shared patient index', () => {
  beforeEach(async () => { await resetDatabase() })
  it('keeps the national ID for search and never the photo; the first read goes through the table in pages', async () => {
    const { readSlimPatients, slimPatient } = await import('../src/features/billing/patientIndex')
    const now = '2026-10-01T08:00:00.000Z'
    const rows = Array.from({ length: 23 }, (_, i) => ({
      id: `p${String(i).padStart(3, '0')}`, fileNo: i + 1, name: `مريض ${i + 1}`, gender: 'male' as const, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false,
      createdAt: now, updatedAt: now, nationalId: i % 2 ? `0${i}123456789` : undefined, photo: i % 3 ? 'data:image/jpeg;base64,AAAA' : undefined,
    }))
    await db.patients.bulkAdd(rows)
    const slim = slimPatient(rows[1])
    expect(slim.nationalId).toBe('01123456789')
    expect(slim.hasPhoto).toBe(true)
    expect('photo' in slim).toBe(false)
    const all = await readSlimPatients(5)                                   // 5 pages of 5, 5, 5, 5, 3
    expect(all.map(p => p.id)).toEqual(rows.map(r => r.id))
    expect(all.some(p => 'photo' in p)).toBe(false)
    expect(all.filter(p => p.nationalId).length).toBe(11)
    expect(await readSlimPatients(23)).toHaveLength(23)                    // a last page that is exactly full
  })
})
