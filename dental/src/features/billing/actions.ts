// Billing writes. Each runs in one transaction so invoices, payments and treatment links never disagree, and each
// ends by reconciling the patient (planReconcile): money on account settles open invoices, oldest first.
// The UI logs the activity line afterwards (it knows the patient name and the language).
import { db, getClinic, getSetting, nextInvoiceNumber, nextReceiptNumber, setSetting } from '@/db'
import { newId, nowISO, todayISO } from '@/db/ids'
import type { ID, Invoice, InvoiceItem, InvoiceStatus, ISODate, Payment, PaymentMethod } from '@/db/types'
import { roundTo } from '@/lib/format'
import {
  computeTotals, DRAFT_NUMBER, EPS, invoiceStatus, isBillable, isDraftNumber, isRealDate, lineTotal, lowerInvoiceTotal, moneyDecimals, onAccountNet, receiptKey,
  reconcileWrites, splitPayment,
} from './lib'

/**
 * A refusal the screens can recognise and explain (billing.err.<code>):
 *  alreadyBilled  a treatment on the invoice was billed elsewhere meanwhile
 *  cancelled      the invoice was cancelled meanwhile
 *  zeroAmount     the amount is zero (after rounding to the currency)
 *  patientMissing the patient was deleted (in another window)
 *  futureDate     a payment cannot be dated after today
 *  badDate        not a calendar date
 *  refundTooBig   a refund larger than what was paid on the invoice plus the patient's credit
 *  refundedCredit the payment's credit was refunded since: delete the refund first
 *  notAllowed     only the clinic admin can delete payments
 */
export type BillingErrorCode = 'alreadyBilled' | 'cancelled' | 'zeroAmount' | 'patientMissing' | 'futureDate' | 'badDate' | 'refundTooBig' | 'refundedCredit' | 'notAllowed'
export class BillingError extends Error {
  constructor(public code: BillingErrorCode) { super(code) }
}

export interface InvoiceInput {
  patientId: ID
  doctorId?: ID
  date: ISODate
  dueDate?: ISODate
  items: InvoiceItem[]
  discount: number
  taxPercent: number
  notes?: string
}

/** Drops undefined / empty-string optional fields so stored records stay tidy. */
function clean<T extends object>(o: T): T {
  const out: any = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') out[k] = v
  return out
}

const decimalsOf = async () => moneyDecimals((await getClinic()).currencyDecimals)

/**
 * Runs a billing write and keeps the reconcile signature current: when everything was in line before the write
 * (the stored signature matched the table counts), the write reconciled its own patient, so the new counts are
 * recorded too and no screen needs to check all open invoices again afterwards.
 */
async function tracked<T>(tables: any[], body: () => Promise<T>): Promise<T> {
  return db.transaction('rw', [...tables, db.settings, db.invoices, db.payments], async () => {
    const before = await signature()
    const state = await getSetting<{ v?: number; sig?: string } | null>(RECONCILE_KEY, null)
    const result = await body()
    if (state && state.v === RECONCILE_VERSION && state.sig === before) {
      const after = await signature()
      if (after !== before) { await setSetting(RECONCILE_KEY, { v: RECONCILE_VERSION, sig: after }); lastSig = after }
    }
    return result
  })
}

/**
 * Brings one patient's payments and invoice caches in line (see planReconcile). Runs inside the caller's transaction,
 * which must include invoices, payments and clinic; opens its own otherwise.
 */
export async function reconcilePatient(patientId: ID): Promise<void> {
  await db.transaction('rw', db.invoices, db.payments, db.clinic, async () => {
    const d = await decimalsOf()
    const [invoices, payments] = await Promise.all([
      db.invoices.where('patientId').equals(patientId).toArray(),
      db.payments.where('patientId').equals(patientId).toArray(),
    ])
    const w = reconcileWrites(invoices, payments, d, newId, nowISO())
    if (w.payments.length) await db.payments.bulkPut(w.payments)
    if (w.invoices.length) await db.invoices.bulkPut(w.invoices)
  })
}

async function requirePatient(patientId: ID) {
  if (!patientId || !(await db.patients.get(patientId))) throw new BillingError('patientMissing')
}

/**
 * Creates or updates an invoice.
 * mode 'draft' keeps (or gives) the temporary DRAFT number; mode 'issue' takes the next real number when the invoice
 * has none yet. Prices and discounts are stored in the currency's minor unit. Treatment items on the lines are linked
 * to the invoice; lines removed while editing are unlinked. An issued invoice is settled at once from the patient's credit.
 */
export async function saveInvoice(input: InvoiceInput, opts: { id?: ID; mode: 'draft' | 'issue'; userId?: ID }): Promise<Invoice> {
  return tracked([db.invoices, db.treatments, db.clinic, db.payments, db.patients], async () => {
    await requirePatient(input.patientId)
    const existing = opts.id ? await db.invoices.get(opts.id) : undefined
    if (existing && existing.status === 'cancelled') throw new BillingError('cancelled')
    const d = await decimalsOf()
    const items = input.items.map(i => {
      const unitPrice = roundTo(i.unitPrice || 0, d), discount = roundTo(i.discount || 0, d)
      return { ...i, unitPrice, discount, total: lineTotal(i.qty, unitPrice, discount, d) }
    })
    // a treatment can sit on one invoice only: refuse lines whose treatment was billed elsewhere meanwhile
    const linkIds = [...new Set(items.map(i => i.treatmentItemId).filter(Boolean) as ID[])]
    const linkRows = await db.treatments.bulkGet(linkIds)
    if (linkRows.some(tr => tr && ((tr.invoiceId && tr.invoiceId !== existing?.id) || tr.patientId !== input.patientId))) throw new BillingError('alreadyBilled')
    const totals = computeTotals(items, input.discount, input.taxPercent, d)
    const wasDraft = !existing || existing.status === 'draft'
    let number = existing?.number ?? DRAFT_NUMBER
    let base: InvoiceStatus = 'draft'
    if (opts.mode === 'issue' || !wasDraft) {
      if (isDraftNumber(number)) number = await nextInvoiceNumber()
      base = 'unpaid'
    }
    const paid = existing?.paid ?? 0
    const now = nowISO()
    const inv: Invoice = clean({
      id: existing?.id ?? newId(),
      number,
      patientId: input.patientId,
      doctorId: input.doctorId,
      date: input.date,
      dueDate: input.dueDate,
      items,
      ...totals,
      taxPercent: Math.max(0, input.taxPercent || 0),
      paid,
      status: invoiceStatus(totals.total, paid, base, d),
      notes: input.notes?.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? opts.userId,
    }) as Invoice
    await db.invoices.put(inv)

    const before = new Set((existing?.items ?? []).map(i => i.treatmentItemId).filter(Boolean) as ID[])
    const after = new Set(items.map(i => i.treatmentItemId).filter(Boolean) as ID[])
    for (const tid of before) if (!after.has(tid)) await unlinkTreatment(tid, inv.id)
    for (const tid of after) await db.treatments.update(tid, { invoiceId: inv.id, updatedAt: now })
    if (existing?.patientId && existing.patientId !== inv.patientId) await reconcilePatient(existing.patientId)
    await reconcilePatient(inv.patientId)
    return (await db.invoices.get(inv.id)) ?? inv
  })
}

async function unlinkTreatment(treatmentId: ID, invoiceId: ID) {
  const tr = await db.treatments.get(treatmentId)
  if (!tr || tr.invoiceId !== invoiceId) return
  const { invoiceId: _drop, ...rest } = tr
  await db.treatments.put({ ...rest, updatedAt: nowISO() })
}

/**
 * Cancels an issued invoice: it keeps its number, its treatments can be billed again, and the money paid on it goes
 * back to the patient's account, where it settles their other open invoices first (the rest is credit).
 */
export async function cancelInvoice(id: ID): Promise<Invoice | undefined> {
  return tracked([db.invoices, db.treatments, db.payments, db.clinic], async () => {
    const inv = await db.invoices.get(id)
    if (!inv || inv.status === 'cancelled') return inv
    await db.invoices.put({ ...inv, status: 'cancelled', updatedAt: nowISO() })
    const linked = await db.treatments.where('invoiceId').equals(id).toArray()
    for (const tr of linked) await unlinkTreatment(tr.id, id)
    await reconcilePatient(inv.patientId)
    return db.invoices.get(id)
  })
}

/** Deletes a draft (only drafts can be deleted) and frees its treatments. */
export async function deleteDraftInvoice(id: ID): Promise<boolean> {
  return tracked([db.invoices, db.treatments], async () => {
    const inv = await db.invoices.get(id)
    if (!inv || inv.status !== 'draft') return false
    const linked = await db.treatments.where('invoiceId').equals(id).toArray()
    for (const tr of linked) await unlinkTreatment(tr.id, id)
    await db.invoices.delete(id)
    return true
  })
}

export interface PaymentInput {
  patientId: ID
  invoiceId?: ID
  amount: number              // negative = refund
  method: PaymentMethod
  date: ISODate
  reference?: string
  note?: string
  receivedBy?: ID
  /** A refund against an invoice: also lower the invoice by the refunded part (a credit note), so nothing is owed again. */
  creditNote?: boolean
  /** Line appended to the invoice notes when it is lowered (in the clinic language), e.g. "Lowered by 30 with refund R-000012". {receipt} is replaced. */
  creditNoteText?: string
}

/**
 * Records a payment (or a refund) as one hand-over with the next receipt number. Against an invoice it is applied
 * up to the invoice balance; the rest goes on account, where it settles the patient's other open invoices (oldest
 * first) and then stays as credit. A refund takes back from the chosen invoice what was paid on it, then from the
 * patient's credit, never more. Returns the rows saved (the first one opens the receipt).
 */
export async function recordPayment(input: PaymentInput): Promise<Payment[]> {
  if (!(Math.abs(Number(input.amount) || 0) > 0)) throw new BillingError('zeroAmount')
  if (!isRealDate(input.date)) throw new BillingError('badDate')
  if (input.date > todayISO()) throw new BillingError('futureDate')
  return tracked([db.payments, db.invoices, db.patients, db.clinic], async () => {
    await requirePatient(input.patientId)
    const d = await decimalsOf()
    const amount = roundTo(input.amount, d)
    if (!(Math.abs(amount) > 0)) throw new BillingError('zeroAmount')
    const inv = input.invoiceId ? await db.invoices.get(input.invoiceId) : undefined
    const target = inv && isBillable(inv) && inv.patientId === input.patientId ? inv : undefined
    const { onInvoice, onAccount } = splitPayment(amount, target)
    const receiptNo = await nextReceiptNumber()
    if (amount < 0) {
      const credit = Math.max(0, onAccountNet(await db.payments.where('patientId').equals(input.patientId).toArray()))
      if (-onAccount > credit + EPS) throw new BillingError('refundTooBig')
      if (target && input.creditNote && onInvoice < 0) {
        const lowered = lowerInvoiceTotal(target, -onInvoice, d)
        if (!lowered) throw new BillingError('refundTooBig')
        const line = (input.creditNoteText || '').replace('{receipt}', receiptNo).trim()
        await db.invoices.put({ ...target, ...lowered, notes: [target.notes?.trim(), line].filter(Boolean).join('\n') || undefined, updatedAt: nowISO() })
      }
    }
    const createdAt = nowISO()
    const base = { patientId: input.patientId, method: input.method, date: input.date, reference: input.reference?.trim(), note: input.note?.trim(), receivedBy: input.receivedBy, receiptNo, createdAt }
    const created: Payment[] = []
    if (target && onInvoice !== 0) created.push(clean({ id: newId(), ...base, invoiceId: target.id, amount: onInvoice }) as Payment)
    if (onAccount !== 0 || created.length === 0) created.push(clean({ id: newId(), ...base, amount: onAccount }) as Payment)
    await db.payments.bulkAdd(created)
    await reconcilePatient(input.patientId)
    const saved = await db.payments.bulkGet(created.map(p => p.id))
    return saved.filter((p): p is Payment => !!p)
  })
}

/**
 * Deletes one hand-over (every row of its receipt) and re-balances the invoices it paid. Clinic admin only: the
 * screens disable the action for other roles, and this refuses it too. A payment whose credit was refunded since
 * cannot go before the refund (the patient would owe money no invoice shows).
 */
export async function deleteReceipt(paymentId: ID, userId: ID | undefined): Promise<Payment[]> {
  return tracked([db.payments, db.invoices, db.users, db.clinic], async () => {
    const user = userId ? await db.users.get(userId) : undefined
    if (!user || user.role !== 'admin' || !user.active) throw new BillingError('notAllowed')
    const p = await db.payments.get(paymentId)
    if (!p) return []
    const all = await db.payments.where('patientId').equals(p.patientId).toArray()
    const key = receiptKey(p)
    const group = all.filter(x => receiptKey(x) === key)
    const rest = all.filter(x => receiptKey(x) !== key)
    if (onAccountNet(rest) < -EPS) throw new BillingError('refundedCredit')
    // the same on an invoice: a refund taken off what this payment paid on it must go first
    const touched = new Set(group.map(x => x.invoiceId).filter(Boolean) as ID[])
    for (const id of touched) if (rest.filter(x => x.invoiceId === id).reduce((a, x) => a + (Number(x.amount) || 0), 0) < -EPS) throw new BillingError('refundedCredit')
    await db.payments.bulkDelete(group.map(x => x.id))
    await reconcilePatient(p.patientId)
    return group
  })
}

// ---- keeping older data in line ---------------------------------------------------------------

const RECONCILE_KEY = 'billing.reconcile'
const RECONCILE_VERSION = 1
let pending: Promise<void> | null = null
let lastSig = ''

/**
 * Makes sure every patient's money is reconciled, for data that did not go through the actions above (records from
 * an older version, a restored backup, the demo clinic, invoices made by other modules). The first run after an
 * update checks every patient once; later runs check only the patients with open invoices, and only when the
 * number of invoices or payments changed. Cheap to call on every screen mount; never call from a live query.
 */
export function ensureReconciled(): Promise<void> {
  if (!pending) pending = runReconcile().catch(err => { console.warn('reconcile failed', err) }).finally(() => { pending = null })
  return pending
}

/** More rows than this added or removed outside billing since the last check means a bulk change: check everyone. */
const BULK_CHANGE = 50
function bulkChange(before: string | undefined, now: string): boolean {
  const [p0, i0] = (before ?? '').split(':').map(Number)
  const [p1, i1] = now.split(':').map(Number)
  return !(Math.abs(p1 - p0) + Math.abs(i1 - i0) <= BULK_CHANGE)
}

async function signature() {
  const [p, i] = await Promise.all([db.payments.count(), db.invoices.count()])
  return `${p}:${i}`
}

async function runReconcile(): Promise<void> {
  const sig = await signature()
  if (sig === lastSig) return
  const state = await getSetting<{ v?: number; sig?: string } | null>(RECONCILE_KEY, null)
  if (state && state.v === RECONCILE_VERSION && state.sig === sig) { lastSig = sig; return }
  // a full pass the first time, and after a bulk change made outside billing (a demo load, an import): such rows may
  // need fixing for patients without open invoices too (a refund beyond the credit, money on a cancelled invoice).
  // A few rows (an invoice from "bill completed work") only touch patients with open invoices: the cheap pass.
  const full = !state || state.v !== RECONCILE_VERSION || bulkChange(state.sig, sig)
  // one read-write transaction: the screens' live queries re-run once at the end, not after every patient
  let added = 0
  await db.transaction('rw', db.invoices, db.payments, db.clinic, async () => {
    const d = await decimalsOf()
    let invs: Invoice[], pays: Payment[]
    if (full) {
      ;[invs, pays] = await Promise.all([db.invoices.toArray(), db.payments.toArray()])
    } else {
      // after the first check, only patients with open invoices (or money left on a cancelled one) can be out of line
      const [unpaid, partial, cancelled] = await Promise.all([
        db.invoices.where('status').equals('unpaid').toArray(),
        db.invoices.where('status').equals('partial').toArray(),
        db.invoices.where('status').equals('cancelled').toArray(),
      ])
      const ids = [...new Set([...unpaid, ...partial].map(i => i.patientId).concat(cancelled.filter(i => Math.abs(i.paid || 0) > EPS).map(i => i.patientId)))]
      if (!ids.length) return
      if (ids.length <= 100) {
        ;[invs, pays] = await Promise.all([db.invoices.where('patientId').anyOf(ids).toArray(), db.payments.where('patientId').anyOf(ids).toArray()])
      } else {
        // many patients: two plain reads of the tables beat a cursor jumping through thousands of keys
        const wanted = new Set(ids)
        const [ai, ap] = await Promise.all([db.invoices.toArray(), db.payments.toArray()])
        invs = ai.filter(i => wanted.has(i.patientId)); pays = ap.filter(p => wanted.has(p.patientId))
      }
    }
    const byPatient = new Map<ID, { invoices: Invoice[]; payments: Payment[] }>()
    const slot = (id: ID) => { let s = byPatient.get(id); if (!s) { s = { invoices: [], payments: [] }; byPatient.set(id, s) } return s }
    for (const x of invs) slot(x.patientId).invoices.push(x)
    for (const x of pays) slot(x.patientId).payments.push(x)
    const known = new Set(pays.map(p => p.id))
    const now = nowISO()
    const putPays: Payment[] = [], putInvs: Invoice[] = []
    for (const s of byPatient.values()) {
      const w = reconcileWrites(s.invoices, s.payments, d, newId, now)
      putPays.push(...w.payments); putInvs.push(...w.invoices)
    }
    added = putPays.filter(p => !known.has(p.id)).length
    if (putPays.length) await db.payments.bulkPut(putPays)
    if (putInvs.length) await db.invoices.bulkPut(putInvs)
  })
  // the signature this pass leaves behind: the one it started from plus the rows it split off. If anything else
  // wrote meanwhile (a restore, a long import), the counts differ and the next call checks again.
  const [p0, i0] = sig.split(':').map(Number)
  const expected = `${p0 + added}:${i0}`
  await setSetting(RECONCILE_KEY, { v: RECONCILE_VERSION, sig: expected })
  lastSig = expected
}
