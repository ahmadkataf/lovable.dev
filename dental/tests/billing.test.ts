import 'fake-indexeddb/auto'
import type { Invoice, Payment, TreatmentItem } from '../src/db/types'
import { db, resetDatabase, updateClinic } from '../src/db'
import {
  accountFrom, buildStatement, computeTotals, filterInvoices, groupByMethod, invoiceBalance, invoiceStats, invoiceStatus, isRealDate, isValidTooth,
  lineTotal, normalizePeriod, patientAccount, paymentStats, presetPeriod, receiptNo, recomputeInvoice, sortInvoices, splitPayment, statusCounts,
  toDraftLines, toInvoiceItems, validateInvoice, hasErrors, type DraftLine,
} from '../src/features/billing/lib'
import { cancelInvoice, deleteDraftInvoice, deletePayment, recordPayment, saveInvoice } from '../src/features/billing/actions'

const inv = (p: Partial<Invoice>): Invoice => ({
  id: 'i', number: 'INV-000001', patientId: 'p1', date: '2026-10-01', items: [], subtotal: 0, discount: 0, taxPercent: 0, tax: 0, total: 0, paid: 0, status: 'unpaid',
  createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', ...p,
})
const pay = (p: Partial<Payment>): Payment => ({ id: 'p', patientId: 'p1', amount: 0, method: 'cash', date: '2026-10-01', createdAt: '2026-10-01T09:00:00.000Z', ...p })
const line = (p: Partial<DraftLine>): DraftLine => ({ key: 'k', description: 'Filling', tooth: null, qty: 1, unitPrice: 100, discount: null, ...p })

describe('billing: totals', () => {
  it('line total = qty × price − discount, rounded to cents', () => {
    expect(lineTotal(2, 100, 50)).toBe(150)
    expect(lineTotal(3, 33.333, 0)).toBe(100)
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
  it('receipt numbers are the id tail', () => {
    expect(receiptNo('lq2k3abcdef123')).toBe('DEF123')
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
  it('round-trips lines and items', () => {
    const items = toInvoiceItems([line({ key: 'a', tooth: 36, qty: 2, unitPrice: 50, discount: 10, treatmentItemId: 't1' }), line({ key: 'b', tooth: null, discount: null })])
    expect(items[0]).toEqual({ id: 'a', treatmentItemId: 't1', description: 'Filling', tooth: 36, qty: 2, unitPrice: 50, discount: 10, total: 90 })
    expect(items[1]).toEqual({ id: 'b', description: 'Filling', qty: 1, unitPrice: 100, discount: 0, total: 100 })
    expect(toDraftLines(items)[1]).toMatchObject({ key: 'b', tooth: null, discount: null })
  })
})

describe('billing: database flows', () => {
  const tr = (p: Partial<TreatmentItem>): TreatmentItem => ({ id: 't', patientId: 'p1', procedureName: 'Composite filling', price: 80, discount: 0, status: 'completed', createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', ...p })
  beforeEach(async () => {
    await resetDatabase()
    await updateClinic({ invoicePrefix: 'INV-', nextInvoiceNumber: 7 })
    await db.treatments.bulkPut([tr({ id: 't1', tooth: 36 }), tr({ id: 't2', tooth: 21, price: 120 })])
  })
  const input = (over: Partial<Parameters<typeof saveInvoice>[0]> = {}) => ({
    patientId: 'p1', date: '2026-10-10', discount: 0, taxPercent: 0,
    items: [{ id: 'l1', treatmentItemId: 't1', description: 'Composite filling', tooth: 36, qty: 1, unitPrice: 80, discount: 0, total: 80 }, { id: 'l2', description: 'X-ray', qty: 1, unitPrice: 20, discount: 0, total: 20 }],
    ...over,
  })

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

  it('payments update the cached paid/status; overpayment goes on account', async () => {
    const a = await saveInvoice(input({ taxPercent: 10 }), { mode: 'issue' })
    expect(a.total).toBe(110)
    const first = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 60, method: 'cash', date: '2026-10-10', receivedBy: 'u1' })
    expect(first).toHaveLength(1)
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 60, status: 'partial' })
    const second = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'card', date: '2026-10-10', reference: ' 4421 ' })
    expect(second.map(p => [p.invoiceId, p.amount])).toEqual([[a.id, 50], [undefined, 50]])
    expect(second[0].reference).toBe('4421')
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 110, status: 'paid' })
    expect(await patientAccount('p1')).toEqual({ invoiced: 110, paid: 160, due: -50 })
    await deletePayment(second[0].id)
    expect(await db.invoices.get(a.id)).toMatchObject({ paid: 60, status: 'partial' })
    await db.payments.where('invoiceId').equals(a.id).delete()
    expect(await recomputeInvoice(a.id)).toMatchObject({ paid: 0, status: 'unpaid' })
    expect(await recomputeInvoice('nope')).toBeUndefined()
  })

  it('refunds reduce what was paid on the invoice', async () => {
    const a = await saveInvoice(input(), { mode: 'issue' })
    await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: 100, method: 'cash', date: '2026-10-10' })
    const r = await recordPayment({ patientId: 'p1', invoiceId: a.id, amount: -30, method: 'cash', date: '2026-10-11' })
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
})
