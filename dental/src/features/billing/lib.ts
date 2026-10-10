// Billing logic shared by every screen (and importable by other modules):
//   pure helpers — line/invoice totals, status derivation, payment splitting, periods, statements, ledgers;
//   db helpers   — recomputeInvoice (writes the cached paid/status) and patientAccount (read-only, safe in live queries).
// Covered by tests/billing.test.ts.
import { db } from '@/db'
import { nowISO } from '@/db/ids'
import { PAYMENT_METHODS } from '@/db/types'
import type { ID, Invoice, InvoiceItem, InvoiceStatus, ISODate, Patient, Payment, PaymentMethod } from '@/db/types'
import { addDays, addMonths, endOfMonth, fromISODate, startOfMonth, startOfWeek } from '@/lib/dates'
import { matches, round2 } from '@/lib/format'

/** Amounts closer than half a cent are equal. */
export const EPS = 0.005
/** Number a draft carries until it is issued. */
export const DRAFT_NUMBER = 'DRAFT'
export const isDraftNumber = (n?: string) => !n || n.startsWith(DRAFT_NUMBER)

// ---- totals -----------------------------------------------------------------------------------

/** qty × unit price − line discount, rounded to cents. */
export function lineTotal(qty: number, unitPrice: number, discount = 0): number {
  return round2((Number(qty) || 0) * (Number(unitPrice) || 0) - (Number(discount) || 0))
}

export interface Totals { subtotal: number; discount: number; tax: number; total: number }
type LineLike = Pick<InvoiceItem, 'qty' | 'unitPrice' | 'discount'>

/** Invoice totals: Σ line totals, minus the invoice discount (never below zero), plus tax on what remains. */
export function computeTotals(items: LineLike[], invoiceDiscount = 0, taxPercent = 0): Totals {
  const subtotal = round2(items.reduce((a, i) => a + lineTotal(i.qty, i.unitPrice, i.discount), 0))
  const discount = round2(Math.min(Math.max(0, Number(invoiceDiscount) || 0), Math.max(0, subtotal)))
  const taxable = round2(subtotal - discount)
  const tax = round2((Math.max(0, taxable) * Math.max(0, Number(taxPercent) || 0)) / 100)
  return { subtotal, discount, tax, total: round2(taxable + tax) }
}

/** Status from the money: paid / partial / unpaid. Drafts and cancelled invoices keep their status. */
export function invoiceStatus(total: number, paid: number, current: InvoiceStatus = 'unpaid'): InvoiceStatus {
  if (current === 'draft' || current === 'cancelled') return current
  const t = round2(total), p = round2(paid)
  if (p <= EPS) return t <= EPS ? 'paid' : 'unpaid'
  if (p >= t - EPS) return 'paid'
  return 'partial'
}

/** Is money owed on it (issued and not cancelled)? */
export const isBillable = (inv: Pick<Invoice, 'status'>) => inv.status !== 'draft' && inv.status !== 'cancelled'
export const isOpen = (inv: Pick<Invoice, 'status'>) => inv.status === 'unpaid' || inv.status === 'partial'

/** What is still owed on one invoice (0 for drafts, cancelled and paid invoices). */
export function invoiceBalance(inv: Pick<Invoice, 'status' | 'total' | 'paid'>): number {
  if (!isBillable(inv)) return 0
  return round2(Math.max(0, (inv.total || 0) - (inv.paid || 0)))
}

// ---- patient account ----------------------------------------------------------------------------

export interface Account { invoiced: number; paid: number; due: number }

/** invoiced = Σ totals of issued invoices; paid = Σ every payment of the patient (on-account too); due = invoiced − paid (negative = credit). */
export function accountFrom(invoices: Pick<Invoice, 'status' | 'total'>[], payments: Pick<Payment, 'amount'>[]): Account {
  const invoiced = round2(invoices.filter(isBillable).reduce((a, i) => a + (i.total || 0), 0))
  const paid = round2(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0))
  return { invoiced, paid, due: round2(invoiced - paid) }
}

/** The patient's balance, read from the database. Read-only, so it is safe inside useLiveQuery. */
export async function patientAccount(patientId: ID): Promise<Account> {
  const [invoices, payments] = await Promise.all([
    db.invoices.where('patientId').equals(patientId).toArray(),
    db.payments.where('patientId').equals(patientId).toArray(),
  ])
  return accountFrom(invoices, payments)
}

/** Re-sums the payments of one invoice and writes the cached paid / status / updatedAt. Never call from a live query. */
export async function recomputeInvoice(invoiceId: ID): Promise<Invoice | undefined> {
  return db.transaction('rw', db.invoices, db.payments, async () => {
    const inv = await db.invoices.get(invoiceId)
    if (!inv) return undefined
    const payments = await db.payments.where('invoiceId').equals(invoiceId).toArray()
    const paid = round2(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0))
    const next: Invoice = { ...inv, paid, status: invoiceStatus(inv.total, paid, inv.status), updatedAt: nowISO() }
    await db.invoices.put(next)
    return next
  })
}

// ---- payments ---------------------------------------------------------------------------------

/**
 * How a payment lands: on the invoice up to its balance, the rest on account.
 * A refund (negative amount) takes back at most what was paid on the invoice; the rest comes off the account.
 */
export function splitPayment(amount: number, invoice?: Pick<Invoice, 'total' | 'paid'> | null): { onInvoice: number; onAccount: number } {
  const a = round2(Number(amount) || 0)
  if (!invoice) return { onInvoice: 0, onAccount: a }
  if (a >= 0) {
    const balance = round2(Math.max(0, invoice.total - invoice.paid))
    const on = round2(Math.min(a, balance))
    return { onInvoice: on, onAccount: round2(a - on) }
  }
  const back = round2(Math.min(-a, Math.max(0, invoice.paid)))
  return { onInvoice: back ? -back : 0, onAccount: round2(a + back) }
}

/** Short receipt number shown on printed receipts: the tail of the payment id. */
export const receiptNo = (paymentId: string) => paymentId.slice(-6).toUpperCase()

export interface LedgerStats { net: number; cash: number; cardTransfer: number; refunds: number; count: number }
/** Cash-ledger cards: net of everything, net cash, net card + transfer, and refunds (as a positive sum). */
export function paymentStats(payments: Pick<Payment, 'amount' | 'method'>[]): LedgerStats {
  let net = 0, cash = 0, cardTransfer = 0, refunds = 0
  for (const p of payments) {
    const a = Number(p.amount) || 0
    net += a
    if (p.method === 'cash') cash += a
    if (p.method === 'card' || p.method === 'transfer') cardTransfer += a
    if (a < 0) refunds += -a
  }
  return { net: round2(net), cash: round2(cash), cardTransfer: round2(cardTransfer), refunds: round2(refunds), count: payments.length }
}

export interface MethodGroup<P> { method: PaymentMethod; count: number; total: number; items: P[] }
/** Payments grouped by method in the usual order (cash, card, transfer…), empty methods left out. */
export function groupByMethod<P extends Pick<Payment, 'amount' | 'method'>>(payments: P[]): MethodGroup<P>[] {
  const order = [...PAYMENT_METHODS]
  const map = new Map<PaymentMethod, P[]>()
  for (const p of payments) {
    const m = order.includes(p.method) ? p.method : 'other'
    if (!map.has(m)) map.set(m, [])
    map.get(m)!.push(p)
  }
  return order.filter(m => map.has(m)).map(m => {
    const items = map.get(m)!
    return { method: m, count: items.length, total: round2(items.reduce((a, p) => a + (Number(p.amount) || 0), 0)), items }
  })
}

// ---- invoices list ----------------------------------------------------------------------------

export interface InvoiceStats { invoiced: number; collected: number; outstanding: number; count: number; drafts: number }
/** Cards above the invoices list: issued invoices only (drafts and cancelled carry no money). */
export function invoiceStats(invoices: Pick<Invoice, 'status' | 'total' | 'paid'>[]): InvoiceStats {
  const issued = invoices.filter(isBillable)
  const invoiced = round2(issued.reduce((a, i) => a + (i.total || 0), 0))
  const outstanding = round2(issued.reduce((a, i) => a + invoiceBalance(i), 0))
  return { invoiced, collected: round2(invoiced - outstanding), outstanding, count: issued.length, drafts: invoices.filter(i => i.status === 'draft').length }
}

export type StatusFilter = 'all' | InvoiceStatus
export interface InvoiceFilter { status?: StatusFilter; doctorId?: string; q?: string }
/** Search matches the invoice number, the patient name, file number or phone. */
export function filterInvoices<I extends Pick<Invoice, 'number' | 'status' | 'doctorId' | 'patientId'>>(list: I[], f: InvoiceFilter, patients: Map<string, Pick<Patient, 'name' | 'fileNo' | 'phone'>>): I[] {
  const q = (f.q || '').trim()
  return list.filter(inv => {
    if (f.status && f.status !== 'all' && inv.status !== f.status) return false
    if (f.doctorId && inv.doctorId !== f.doctorId) return false
    if (q) {
      const p = patients.get(inv.patientId)
      const hay = [inv.number, p?.name, p?.fileNo !== undefined ? String(p.fileNo) : '', p?.phone?.replace(/\s+/g, '')].join(' ')
      if (!matches(hay, q.replace(/^#/, ''))) return false
    }
    return true
  })
}
/** Newest first: by date, then by creation time. */
export function sortInvoices<I extends Pick<Invoice, 'date' | 'createdAt'>>(list: I[]): I[] {
  return [...list].sort((a, b) => (b.date === a.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date)))
}
export function statusCounts(list: Pick<Invoice, 'status'>[]): Record<StatusFilter, number> {
  const c: Record<StatusFilter, number> = { all: list.length, draft: 0, unpaid: 0, partial: 0, paid: 0, cancelled: 0 }
  for (const i of list) c[i.status] = (c[i.status] || 0) + 1
  return c
}

// ---- periods ----------------------------------------------------------------------------------

export type PeriodPreset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom'
export const PERIOD_PRESETS: PeriodPreset[] = ['today', 'week', 'month', 'lastMonth', 'custom']
export interface Period { preset: PeriodPreset; from: ISODate; to: ISODate }

/** The date range of a preset around `today` (week starts on Saturday). 'custom' starts as the current month. */
export function presetPeriod(preset: PeriodPreset, today: ISODate): Period {
  switch (preset) {
    case 'today': return { preset, from: today, to: today }
    case 'week': { const from = startOfWeek(today); return { preset, from, to: addDays(from, 6) } }
    case 'lastMonth': { const m = addMonths(startOfMonth(today), -1); return { preset, from: m, to: endOfMonth(m) } }
    default: return { preset, from: startOfMonth(today), to: endOfMonth(today) }
  }
}
export const inPeriod = (date: ISODate, p: Pick<Period, 'from' | 'to'>) => date >= p.from && date <= p.to
export function isRealDate(s?: string): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = fromISODate(s)
  return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === s
}
/** A custom range typed backwards is put the right way round; a broken date falls back to the other end. */
export function normalizePeriod(p: Period): Period {
  let { from, to } = p
  if (!isRealDate(from)) from = isRealDate(to) ? to : from
  if (!isRealDate(to)) to = from
  return from <= to ? { ...p, from, to } : { ...p, from: to, to: from }
}

// ---- account statement ------------------------------------------------------------------------

export interface StatementRow {
  key: string
  date: ISODate
  kind: 'invoice' | 'payment' | 'refund'
  invoiceId?: ID
  paymentId?: ID
  number?: string            // invoice number
  method?: PaymentMethod
  debit: number
  credit: number
  balance: number            // running: what the patient owes after this line (negative = credit)
}
/** Issued invoices (debit) and payments (credit; refunds are debits) in date order with a running balance. */
export function buildStatement(invoices: Invoice[], payments: Payment[]): StatementRow[] {
  type Entry = Omit<StatementRow, 'balance'> & { order: number; created: string }
  const entries: Entry[] = []
  for (const inv of invoices) {
    if (!isBillable(inv)) continue
    entries.push({ key: `i-${inv.id}`, date: inv.date, kind: 'invoice', invoiceId: inv.id, number: inv.number, debit: round2(inv.total), credit: 0, order: 0, created: inv.createdAt || '' })
  }
  for (const p of payments) {
    const a = round2(Number(p.amount) || 0)
    entries.push({ key: `p-${p.id}`, date: p.date, kind: a < 0 ? 'refund' : 'payment', paymentId: p.id, invoiceId: p.invoiceId, method: p.method, debit: a < 0 ? -a : 0, credit: a >= 0 ? a : 0, order: 1, created: p.createdAt || '' })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.created.localeCompare(b.created))
  let balance = 0
  return entries.map(({ order: _o, created: _c, ...e }) => { balance = round2(balance + e.debit - e.credit); return { ...e, balance } })
}

// ---- invoice editor ---------------------------------------------------------------------------

/** FDI tooth numbers: permanent 11–48, primary 51–85. */
export function isValidTooth(n: number): boolean {
  if (!Number.isInteger(n)) return false
  const q = Math.floor(n / 10), u = n % 10
  return (q >= 1 && q <= 4 && u >= 1 && u <= 8) || (q >= 5 && q <= 8 && u >= 1 && u <= 5)
}

/** A line while it is being edited: empty number fields are null. */
export interface DraftLine {
  key: string
  treatmentItemId?: ID
  procedureId?: ID
  description: string
  tooth: number | null
  qty: number | null
  unitPrice: number | null
  discount: number | null
}
export interface LineErrors { description?: 'required'; qty?: 'positive'; unitPrice?: 'number'; discount?: 'tooBig' | 'number'; tooth?: 'tooth' }
export interface InvoiceErrors { patient?: 'required'; items?: 'empty'; discount?: 'tooBig'; tax?: 'number'; date?: 'date'; lines: Record<string, LineErrors> }

export function validateInvoice(input: { patientId?: string; date?: string; lines: DraftLine[]; discount: number | null; taxPercent: number | null }): InvoiceErrors {
  const e: InvoiceErrors = { lines: {} }
  if (!input.patientId) e.patient = 'required'
  if (!isRealDate(input.date)) e.date = 'date'
  if (!input.lines.length) e.items = 'empty'
  for (const l of input.lines) {
    const le: LineErrors = {}
    if (!l.description.trim()) le.description = 'required'
    if (l.qty === null || !(l.qty > 0)) le.qty = 'positive'
    if (l.unitPrice === null || l.unitPrice < 0) le.unitPrice = 'number'
    if (l.discount !== null && l.discount < 0) le.discount = 'number'
    else if ((l.discount || 0) > round2((l.qty || 0) * (l.unitPrice || 0)) + EPS) le.discount = 'tooBig'
    if (l.tooth !== null && !isValidTooth(l.tooth)) le.tooth = 'tooth'
    if (Object.keys(le).length) e.lines[l.key] = le
  }
  const subtotal = round2(input.lines.reduce((a, l) => a + lineTotal(l.qty || 0, l.unitPrice || 0, l.discount || 0), 0))
  if ((input.discount || 0) > Math.max(0, subtotal) + EPS || (input.discount || 0) < 0) e.discount = 'tooBig'
  if (input.taxPercent !== null && (input.taxPercent < 0 || input.taxPercent > 100)) e.tax = 'number'
  return e
}
export const hasErrors = (e: InvoiceErrors) => !!(e.patient || e.items || e.discount || e.tax || e.date || Object.keys(e.lines).length)

/** Turns edited lines into stored invoice items (empty numbers become 0, totals recomputed). */
export function toInvoiceItems(lines: DraftLine[], idOf: (l: DraftLine) => string = l => l.key): InvoiceItem[] {
  return lines.map(l => {
    const qty = l.qty || 0, unitPrice = l.unitPrice || 0, discount = l.discount || 0
    const item: InvoiceItem = { id: idOf(l), description: l.description.trim(), qty, unitPrice, discount, total: lineTotal(qty, unitPrice, discount) }
    if (l.treatmentItemId) item.treatmentItemId = l.treatmentItemId
    if (l.procedureId) item.procedureId = l.procedureId
    if (l.tooth !== null && l.tooth !== undefined) item.tooth = l.tooth
    return item
  })
}
export function toDraftLines(items: InvoiceItem[]): DraftLine[] {
  return items.map(i => ({ key: i.id, treatmentItemId: i.treatmentItemId, procedureId: i.procedureId, description: i.description, tooth: i.tooth ?? null, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount || null }))
}
