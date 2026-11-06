// Billing logic shared by every screen (and importable by other modules):
//   pure helpers — line/invoice totals, status derivation, payment splitting, credit allocation, receipts, periods,
//                  statements, ledgers;
//   db helpers   — recomputeInvoice (writes the cached paid/status) and patientAccount (read-only, safe in live queries).
// Covered by tests/billing.test.ts.
//
// Money rules (one definition everywhere):
//   • every stored amount is rounded to the clinic currency's minor unit (0, 2 or 3 decimals) when it is written;
//   • an invoice's due = total − the payments attached to it; a patient's balance = Σ issued totals − Σ all payments;
//   • money a patient holds on account always settles their open invoices first (oldest first, see planReconcile),
//     so "Σ open invoice dues" and "Σ positive patient balances" are the same number on every screen.
import { db } from '@/db'
import { nowISO } from '@/db/ids'
import { PAYMENT_METHODS } from '@/db/types'
import type { ID, Invoice, InvoiceItem, InvoiceStatus, ISODate, Patient, Payment, PaymentMethod } from '@/db/types'
import { addDays, addMonths, endOfMonth, fromISODate, startOfMonth, startOfWeek } from '@/lib/dates'
import { matches, roundTo } from '@/lib/format'

/** Amounts closer than half a fils are equal (money is stored with at most 3 decimals). */
export const EPS = 0.0005
/** Number a draft carries until it is issued. */
export const DRAFT_NUMBER = 'DRAFT'
export const isDraftNumber = (n?: string) => !n || n.startsWith(DRAFT_NUMBER)

// ---- rounding ---------------------------------------------------------------------------------

/** The currency's minor-unit decimals: 0, 1, 2 or 3 (anything else falls back to cents). */
export function moneyDecimals(decimals: unknown): number {
  return typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0 && decimals <= 3 ? decimals : 2
}
/** Rounds to the currency's minor unit, exact half-up (1.005 → 1.01, 2.5 → 3 with 0 decimals). */
export function roundMoney(n: number, decimals = 2): number {
  return roundTo(Number(n) || 0, moneyDecimals(decimals))
}
/**
 * Clears binary noise from sums and differences of stored amounts. Stored amounts have at most 3 decimals, so this
 * never changes a real value (0.1 + 0.2 → 0.3; 12.962 − 12.96 → 0.002).
 */
export const m3 = (n: number) => roundTo(Number(n) || 0, 3)
const sumOf = <T,>(list: T[], f: (x: T) => number) => m3(list.reduce((a, x) => a + (Number(f(x)) || 0), 0))

// ---- totals -----------------------------------------------------------------------------------

/**
 * qty × unit price − line discount, in the currency's minor unit. The price and the discount are rounded first,
 * so the printed line (qty × the printed price) always adds up.
 */
export function lineTotal(qty: number, unitPrice: number, discount = 0, decimals = 2): number {
  const d = moneyDecimals(decimals)
  return roundTo((Number(qty) || 0) * roundTo(Number(unitPrice) || 0, d) - roundTo(Number(discount) || 0, d), d)
}

export interface Totals { subtotal: number; discount: number; tax: number; total: number }
type LineLike = Pick<InvoiceItem, 'qty' | 'unitPrice' | 'discount'>

/**
 * Invoice totals: Σ line totals, minus the invoice discount (never below zero), plus tax on what remains.
 * Every figure is rounded to the clinic's `currencyDecimals` (0, 2 or 3), the same amount the patient sees and pays.
 */
export function computeTotals(items: LineLike[], invoiceDiscount = 0, taxPercent = 0, decimals = 2): Totals {
  const d = moneyDecimals(decimals)
  const subtotal = roundTo(items.reduce((a, i) => a + lineTotal(i.qty, i.unitPrice, i.discount, d), 0), d)
  const discount = roundTo(Math.min(Math.max(0, roundTo(Number(invoiceDiscount) || 0, d)), Math.max(0, subtotal)), d)
  const taxable = roundTo(subtotal - discount, d)
  const tax = roundTo((Math.max(0, taxable) * Math.max(0, Number(taxPercent) || 0)) / 100, d)
  return { subtotal, discount, tax, total: roundTo(taxable + tax, d) }
}

/**
 * The totals an issued invoice gets when it is lowered by `by` (a credit note that goes with a refund): the invoice
 * discount grows so that the new total is `total − by`. With tax, rounding can make that exact total unreachable;
 * the nearest lower total is used then (the patient keeps the minor-unit difference as credit). null = cannot lower.
 */
export function lowerInvoiceTotal(inv: Pick<Invoice, 'items' | 'discount' | 'taxPercent' | 'total'>, by: number, decimals = 2): Totals | null {
  const d = moneyDecimals(decimals)
  const amount = roundTo(by, d)
  if (!(amount > 0)) return null
  const target = roundTo(inv.total - amount, d)
  if (target < -EPS) return null
  const base = computeTotals(inv.items, 0, inv.taxPercent, d)
  const unit = Math.pow(10, -d)
  const rate = Math.max(0, Number(inv.taxPercent) || 0) / 100
  const guess = roundTo(target / (1 + rate), d)
  let best: Totals | null = null
  for (let k = -4; k <= 4; k++) {
    const taxable = roundTo(guess + k * unit, d)
    if (taxable < 0 || taxable > base.subtotal + EPS) continue
    const t = computeTotals(inv.items, roundTo(base.subtotal - taxable, d), inv.taxPercent, d)
    if (Math.abs(t.total - target) <= EPS) return t
    if (t.total < target && (!best || t.total > best.total)) best = t
  }
  return best
}

/** Status from the money, compared in the currency's minor unit: paid / partial / unpaid. Drafts and cancelled invoices keep theirs. */
export function invoiceStatus(total: number, paid: number, current: InvoiceStatus = 'unpaid', decimals = 2): InvoiceStatus {
  if (current === 'draft' || current === 'cancelled') return current
  const d = moneyDecimals(decimals)
  const t = roundTo(total, d), p = roundTo(paid, d)
  if (p <= 0) return t <= 0 ? 'paid' : 'unpaid'
  if (p >= t) return 'paid'
  return 'partial'
}

/** Is money owed on it (issued and not cancelled)? */
export const isBillable = (inv: Pick<Invoice, 'status'>) => inv.status !== 'draft' && inv.status !== 'cancelled'
export const isOpen = (inv: Pick<Invoice, 'status'>) => inv.status === 'unpaid' || inv.status === 'partial'

/** What is still owed on one invoice (0 for drafts, cancelled and paid invoices). */
export function invoiceBalance(inv: Pick<Invoice, 'status' | 'total' | 'paid'>): number {
  if (!isOpen(inv)) return 0
  return m3(Math.max(0, (inv.total || 0) - (inv.paid || 0)))
}

// ---- patient account ----------------------------------------------------------------------------

export interface Account { invoiced: number; paid: number; due: number }

/** invoiced = Σ totals of issued invoices; paid = Σ every payment of the patient (on-account too); due = invoiced − paid (negative = credit). */
export function accountFrom(invoices: Pick<Invoice, 'status' | 'total'>[], payments: Pick<Payment, 'amount'>[]): Account {
  const invoiced = sumOf(invoices.filter(isBillable), i => i.total)
  const paid = sumOf(payments, p => p.amount)
  return { invoiced, paid, due: m3(invoiced - paid) }
}

/** The patient's balance, read from the database. Read-only, so it is safe inside useLiveQuery. */
export async function patientAccount(patientId: ID): Promise<Account> {
  const [invoices, payments] = await Promise.all([
    db.invoices.where('patientId').equals(patientId).toArray(),
    db.payments.where('patientId').equals(patientId).toArray(),
  ])
  return accountFrom(invoices, payments)
}

/** Money the patient holds on account: Σ payments not attached to an invoice (negative = refunded beyond the credit). */
export const onAccountNet = (payments: Pick<Payment, 'amount' | 'invoiceId'>[]) => sumOf(payments.filter(p => !p.invoiceId), p => p.amount)

/**
 * Re-sums the payments of one invoice and writes the cached paid / status / updatedAt, at the clinic's decimals.
 * Never call from a live query. Inside another transaction, that one must include invoices, payments and clinic.
 */
export async function recomputeInvoice(invoiceId: ID): Promise<Invoice | undefined> {
  return db.transaction('rw', db.invoices, db.payments, db.clinic, async () => {
    const inv = await db.invoices.get(invoiceId)
    if (!inv) return undefined
    const clinic = await db.clinic.get('clinic')
    const payments = await db.payments.where('invoiceId').equals(invoiceId).toArray()
    const paid = sumOf(payments, p => p.amount)
    const status = invoiceStatus(inv.total, paid, inv.status, clinic?.currencyDecimals ?? 2)
    if (inv.paid === paid && inv.status === status) return inv
    const next: Invoice = { ...inv, paid, status, updatedAt: nowISO() }
    await db.invoices.put(next)
    return next
  })
}

// ---- credit allocation ------------------------------------------------------------------------

const byOldest = <T extends { date: string; createdAt?: string; id: string }>(a: T, b: T) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || '') < (b.createdAt || '') ? -1 : (a.createdAt || '') > (b.createdAt || '') ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export interface ReconcilePlan {
  /** payment rows to write (changed rows and the new halves of split rows) */
  put: Payment[]
  /** invoices whose attached payments changed (their cached paid / status must be recomputed) */
  invoices: ID[]
}
/**
 * Puts one patient's money where it belongs, without changing how much was received or when:
 *  1. payments sitting on a cancelled, draft or missing invoice go back to the account;
 *  2. an invoice holding more than its total gives the excess back to the account;
 *  3. money on account settles the open invoices, oldest first (a row is split when it covers part of an invoice);
 *  4. refunds on account beyond the credit (older data) come off the invoices that were paid, newest first, so the
 *     debt they create shows on an invoice instead of only in the patient's balance.
 * Split rows keep the date, method, receipt number and creation time of the payment they came from.
 */
export function planReconcile(invoices: Invoice[], payments: Payment[], makeId: () => string): ReconcilePlan {
  const rows: Payment[] = payments.map(p => ({ ...p }))
  const changed = new Set<Payment>()
  const touched = new Set<ID>()
  const invById = new Map(invoices.map(i => [i.id, i]))
  const billable = (id?: string) => { const i = id ? invById.get(id) : undefined; return !!i && isBillable(i) }
  const attached = (id: string) => sumOf(rows.filter(r => r.invoiceId === id), r => r.amount)
  const setInvoice = (r: Payment, invoiceId: string | undefined) => { if (invoiceId) r.invoiceId = invoiceId; else delete r.invoiceId }
  /** Moves `amount` (same sign as the row) of row r onto invoiceId (undefined = the account). */
  const move = (r: Payment, amount: number, invoiceId: string | undefined) => {
    if (r.invoiceId) touched.add(r.invoiceId)
    if (invoiceId) touched.add(invoiceId)
    if (Math.abs(m3(amount - r.amount)) <= EPS) { setInvoice(r, invoiceId); changed.add(r); return }
    r.amount = m3(r.amount - amount); changed.add(r)
    const half: Payment = { ...r, id: makeId(), amount: m3(amount) }
    setInvoice(half, invoiceId)
    rows.push(half); changed.add(half)
  }
  const newestFirst = (a: Payment, b: Payment) => -byOldest(a, b)

  // 1. money on a cancelled / draft / missing invoice returns to the account
  for (const r of rows) if (r.invoiceId && !billable(r.invoiceId)) move(r, r.amount, undefined)

  // 2. an invoice never holds more than its total
  for (const inv of invoices) {
    if (!isBillable(inv)) continue
    let excess = m3(attached(inv.id) - Math.max(0, inv.total || 0))
    while (excess > EPS) {
      const r = rows.filter(x => x.invoiceId === inv.id && x.amount > EPS).sort(newestFirst)[0]
      if (!r) break
      const take = m3(Math.min(r.amount, excess))
      move(r, take, undefined)
      excess = m3(excess - take)
    }
  }

  const onAccount = () => rows.filter(r => !r.invoiceId)
  const net = onAccountNet(rows)
  if (net > EPS) {
    // 3. credit settles open invoices, oldest first
    let avail = net
    const open = invoices.filter(i => isBillable(i) && attached(i.id) < (i.total || 0) - EPS).sort(byOldest)
    for (const inv of open) {
      let room = m3((inv.total || 0) - attached(inv.id))
      while (avail > EPS && room > EPS) {
        const r = onAccount().filter(x => x.amount > EPS).sort(byOldest)[0]
        if (!r) break
        const take = m3(Math.min(r.amount, room, avail))
        move(r, take, inv.id)
        avail = m3(avail - take); room = m3(room - take)
      }
      if (avail <= EPS) break
    }
  } else if (net < -EPS) {
    // 4. a refund beyond the credit comes off the invoices that were paid, newest first
    let need = -net
    const paid = invoices.filter(i => isBillable(i) && attached(i.id) > EPS).sort((a, b) => -byOldest(a, b))
    for (const inv of paid) {
      let room = attached(inv.id)
      while (need > EPS && room > EPS) {
        const r = onAccount().filter(x => x.amount < -EPS).sort(newestFirst)[0]
        if (!r) break
        const take = m3(Math.min(-r.amount, room, need))
        move(r, -take, inv.id)
        need = m3(need - take); room = m3(room - take)
      }
      if (need <= EPS) break
    }
  }
  return { put: [...changed], invoices: [...touched] }
}

export interface ReconcileWrites { payments: Payment[]; invoices: Invoice[] }
/**
 * Everything one patient's records need to agree: planReconcile's payment moves, then every invoice's cached
 * paid / status recomputed from the rows attached to it (at the currency's decimals). Pure: the caller writes.
 */
export function reconcileWrites(invoices: Invoice[], payments: Payment[], decimals: number, makeId: () => string, now: string): ReconcileWrites {
  const plan = planReconcile(invoices, payments, makeId)
  const rows = new Map(payments.map(p => [p.id, p]))
  for (const p of plan.put) rows.set(p.id, p)
  const paidOf = new Map<ID, number>()
  for (const r of rows.values()) if (r.invoiceId) paidOf.set(r.invoiceId, m3((paidOf.get(r.invoiceId) ?? 0) + (Number(r.amount) || 0)))
  const inv: Invoice[] = []
  for (const i of invoices) {
    const paid = paidOf.get(i.id) ?? 0
    const status = invoiceStatus(i.total, paid, i.status, decimals)
    if (paid !== i.paid || status !== i.status) inv.push({ ...i, paid, status, updatedAt: now })
  }
  return { payments: plan.put, invoices: inv }
}

/**
 * Where a payment will land, for the payment form: the chosen invoice first, then the patient's other open invoices
 * (oldest first), and what is left stays as credit. Mirrors recordPayment + planReconcile.
 */
export function previewAllocation(amount: number, target: Pick<Invoice, 'id' | 'total' | 'paid'> | null | undefined, open: Pick<Invoice, 'id' | 'number' | 'total' | 'paid' | 'date' | 'createdAt'>[]): { lines: { id: ID; number: string; amount: number }[]; credit: number } {
  let left = m3(Math.max(0, amount))
  const lines: { id: ID; number: string; amount: number }[] = []
  const order = [...open].sort(byOldest)
  if (target) {
    const t = order.find(i => i.id === target.id)
    if (t) { order.splice(order.indexOf(t), 1); order.unshift(t) }
  }
  for (const inv of order) {
    if (left <= EPS) break
    const room = m3(Math.max(0, inv.total - inv.paid))
    const take = m3(Math.min(room, left))
    if (take > EPS) { lines.push({ id: inv.id, number: inv.number, amount: take }); left = m3(left - take) }
  }
  return { lines, credit: left }
}

// ---- payments ---------------------------------------------------------------------------------

/**
 * How a payment lands: on the invoice up to its balance, the rest on account (where planReconcile then settles the
 * patient's other open invoices). A refund (negative amount) takes back at most what was paid on the invoice; the
 * rest comes off the account.
 */
export function splitPayment(amount: number, invoice?: Pick<Invoice, 'total' | 'paid'> | null): { onInvoice: number; onAccount: number } {
  const a = m3(Number(amount) || 0)
  if (!invoice) return { onInvoice: 0, onAccount: a }
  if (a >= 0) {
    const balance = m3(Math.max(0, invoice.total - invoice.paid))
    const on = m3(Math.min(a, balance))
    return { onInvoice: on, onAccount: m3(a - on) }
  }
  const back = m3(Math.min(-a, Math.max(0, invoice.paid)))
  return { onInvoice: back ? -back : 0, onAccount: m3(a + back) }
}

// ---- receipts ---------------------------------------------------------------------------------

/** The receipt number older payments (saved before numbering) print: the tail of the payment id. */
export const legacyReceiptNo = (paymentId: string) => paymentId.slice(-6).toUpperCase()
/** @deprecated kept for older callers: use receiptLabel. */
export const receiptNo = legacyReceiptNo
/**
 * The hand-over a payment row belongs to. Rows saved together (an overpayment split between an invoice and the
 * account, credit later spread over invoices) share it, so one hand-over is one receipt and one ledger line.
 */
export const receiptKey = (p: Pick<Payment, 'receiptNo' | 'patientId' | 'createdAt'>) => (p.receiptNo ? `r:${p.receiptNo}` : `t:${p.patientId}|${p.createdAt}`)

export interface ReceiptGroup<P extends Payment = Payment> {
  key: string
  /** the first row saved (smallest id): its id opens the receipt */
  lead: P
  rows: P[]
  /** printed number: the sequential receipt number, or the id tail of older payments */
  label: string
  numbered: boolean
  patientId: ID
  date: ISODate
  method: PaymentMethod
  amount: number
  /** part of the amount attached to each invoice */
  allocations: { invoiceId: ID; amount: number }[]
  /** part of the amount that stayed on the account (credit, or a refund taken off it) */
  onAccount: number
  reference?: string
  note?: string
  receivedBy?: ID
  createdAt: string
}
/** Payment rows grouped into hand-overs, newest first (by date, then by when they were recorded). */
export function groupReceipts<P extends Payment>(rows: P[]): ReceiptGroup<P>[] {
  const map = new Map<string, P[]>()
  for (const r of rows) {
    const k = receiptKey(r)
    const list = map.get(k)
    if (list) list.push(r); else map.set(k, [r])
  }
  const out: ReceiptGroup<P>[] = []
  for (const [key, list] of map) {
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const lead = list[0]
    const alloc = new Map<ID, number>()
    let onAccount = 0
    for (const r of list) {
      if (r.invoiceId) alloc.set(r.invoiceId, m3((alloc.get(r.invoiceId) ?? 0) + (Number(r.amount) || 0)))
      else onAccount = m3(onAccount + (Number(r.amount) || 0))
    }
    out.push({
      key, lead, rows: list, label: lead.receiptNo || legacyReceiptNo(lead.id), numbered: !!lead.receiptNo,
      patientId: lead.patientId, date: lead.date, method: lead.method, amount: sumOf(list, r => r.amount),
      allocations: [...alloc].map(([invoiceId, amount]) => ({ invoiceId, amount })), onAccount,
      reference: list.find(r => r.reference)?.reference, note: list.find(r => r.note)?.note, receivedBy: lead.receivedBy, createdAt: lead.createdAt,
    })
  }
  return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1) : a.key < b.key ? 1 : -1))
}

export interface LedgerStats { net: number; cash: number; cardTransfer: number; refunds: number; count: number }
/**
 * Cash-ledger cards: net of everything, net cash, net card + transfer, and refunds (as a positive sum).
 * Pass receipt groups to count hand-overs (one per receipt), or raw rows to count rows.
 */
export function paymentStats(payments: Pick<Payment, 'amount' | 'method'>[]): LedgerStats {
  let net = 0, cash = 0, cardTransfer = 0, refunds = 0
  for (const p of payments) {
    const a = Number(p.amount) || 0
    net += a
    if (p.method === 'cash') cash += a
    if (p.method === 'card' || p.method === 'transfer') cardTransfer += a
    if (a < 0) refunds += -a
  }
  return { net: m3(net), cash: m3(cash), cardTransfer: m3(cardTransfer), refunds: m3(refunds), count: payments.length }
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
    return { method: m, count: items.length, total: sumOf(items, p => p.amount), items }
  })
}

// ---- invoices list ----------------------------------------------------------------------------

/**
 * Cards above the invoices list, about the invoices dated in the period: issued totals, what has been paid on them
 * (`collected`, whatever the payment date) and what is still due on them. Drafts and cancelled invoices carry no money.
 */
export interface InvoiceStats { invoiced: number; collected: number; outstanding: number; count: number; drafts: number }
export function invoiceStats(invoices: Pick<Invoice, 'status' | 'total' | 'paid'>[]): InvoiceStats {
  const issued = invoices.filter(isBillable)
  const invoiced = sumOf(issued, i => i.total)
  const outstanding = sumOf(issued, invoiceBalance)
  return { invoiced, collected: m3(invoiced - outstanding), outstanding, count: issued.length, drafts: invoices.filter(i => i.status === 'draft').length }
}

export type StatusFilter = 'all' | InvoiceStatus
export interface InvoiceFilter { status?: StatusFilter; doctorId?: string; q?: string }
type PatientLookup = Pick<Patient, 'name' | 'fileNo'> & Partial<Pick<Patient, 'phone'>>
/** Search matches the invoice number, the patient name, file number or phone. */
export function filterInvoices<I extends Pick<Invoice, 'number' | 'status' | 'doctorId' | 'patientId'>>(list: I[], f: InvoiceFilter, patients: Map<string, PatientLookup>): I[] {
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
/** Newest first: by date, then by creation time (plain comparisons: ISO strings sort as text). */
export function sortInvoices<I extends Pick<Invoice, 'date' | 'createdAt'>>(list: I[]): I[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.createdAt || '') < (b.createdAt || '') ? 1 : (a.createdAt || '') > (b.createdAt || '') ? -1 : 0))
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
    entries.push({ key: `i-${inv.id}`, date: inv.date, kind: 'invoice', invoiceId: inv.id, number: inv.number, debit: m3(inv.total), credit: 0, order: 0, created: inv.createdAt || '' })
  }
  for (const p of payments) {
    const a = m3(Number(p.amount) || 0)
    entries.push({ key: `p-${p.id}`, date: p.date, kind: a < 0 ? 'refund' : 'payment', paymentId: p.id, invoiceId: p.invoiceId, method: p.method, debit: a < 0 ? -a : 0, credit: a >= 0 ? a : 0, order: 1, created: p.createdAt || '' })
  }
  entries.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.order - b.order || (a.created < b.created ? -1 : a.created > b.created ? 1 : 0)))
  let balance = 0
  return entries.map(({ order: _o, created: _c, ...e }) => { balance = m3(balance + e.debit - e.credit); return { ...e, balance } })
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
export interface InvoiceErrors { patient?: 'required'; items?: 'empty'; discount?: 'tooBig' | 'number'; tax?: 'number'; date?: 'date'; dueDate?: 'date' | 'beforeIssue'; lines: Record<string, LineErrors> }

export function validateInvoice(input: { patientId?: string; date?: string; dueDate?: string; lines: DraftLine[]; discount: number | null; taxPercent: number | null }, decimals = 2): InvoiceErrors {
  const d = moneyDecimals(decimals)
  const e: InvoiceErrors = { lines: {} }
  if (!input.patientId) e.patient = 'required'
  if (!isRealDate(input.date)) e.date = 'date'
  if (input.dueDate) {
    if (!isRealDate(input.dueDate)) e.dueDate = 'date'
    else if (isRealDate(input.date) && input.dueDate < input.date!) e.dueDate = 'beforeIssue'
  }
  if (!input.lines.length) e.items = 'empty'
  for (const l of input.lines) {
    const le: LineErrors = {}
    if (!l.description.trim()) le.description = 'required'
    if (l.qty === null || !(l.qty > 0)) le.qty = 'positive'
    if (l.unitPrice === null || l.unitPrice < 0) le.unitPrice = 'number'
    if (l.discount !== null && l.discount < 0) le.discount = 'number'
    else if (roundTo(l.discount || 0, d) > roundTo((l.qty || 0) * roundTo(l.unitPrice || 0, d), d) + EPS) le.discount = 'tooBig'
    if (l.tooth !== null && !isValidTooth(l.tooth)) le.tooth = 'tooth'
    if (Object.keys(le).length) e.lines[l.key] = le
  }
  const subtotal = roundTo(input.lines.reduce((a, l) => a + lineTotal(l.qty || 0, l.unitPrice || 0, l.discount || 0, d), 0), d)
  if ((input.discount || 0) < 0) e.discount = 'number'
  else if (roundTo(input.discount || 0, d) > Math.max(0, subtotal) + EPS) e.discount = 'tooBig'
  if (input.taxPercent !== null && !(input.taxPercent >= 0 && input.taxPercent <= 100)) e.tax = 'number'
  return e
}
export const hasErrors = (e: InvoiceErrors) => !!(e.patient || e.items || e.discount || e.tax || e.date || e.dueDate || Object.keys(e.lines).length)

/** Turns edited lines into stored invoice items: empty numbers become 0, prices and discounts are rounded to the currency, totals recomputed. */
export function toInvoiceItems(lines: DraftLine[], idOf: (l: DraftLine) => string = l => l.key, decimals = 2): InvoiceItem[] {
  const d = moneyDecimals(decimals)
  return lines.map(l => {
    const qty = l.qty || 0, unitPrice = roundTo(l.unitPrice || 0, d), discount = roundTo(l.discount || 0, d)
    const item: InvoiceItem = { id: idOf(l), description: l.description.trim(), qty, unitPrice, discount, total: lineTotal(qty, unitPrice, discount, d) }
    if (l.treatmentItemId) item.treatmentItemId = l.treatmentItemId
    if (l.procedureId) item.procedureId = l.procedureId
    if (l.tooth !== null && l.tooth !== undefined) item.tooth = l.tooth
    return item
  })
}
export function toDraftLines(items: InvoiceItem[]): DraftLine[] {
  return items.map(i => ({ key: i.id, treatmentItemId: i.treatmentItemId, procedureId: i.procedureId, description: i.description, tooth: i.tooth ?? null, qty: i.qty, unitPrice: i.unitPrice, discount: i.discount || null }))
}

// ---- wording ----------------------------------------------------------------------------------

const PLURAL_FORMS: Record<string, readonly string[]> = { ar: ['zero', 'one', 'two', 'few', 'many', 'other'], en: ['one', 'other'] }
/** 'billing.payments.count' + 3 + 'ar' → 'billing.payments.count.few' (Arabic has six plural forms, English two). */
export function pluralKey(base: string, n: number, lang: string): string {
  const forms = PLURAL_FORMS[lang] ?? PLURAL_FORMS.en
  let cat = 'other'
  try { cat = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(n) } catch { cat = n === 1 ? 'one' : 'other' }
  return `${base}.${forms.includes(cat) ? cat : 'other'}`
}
