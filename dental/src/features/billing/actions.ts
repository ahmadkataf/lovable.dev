// Billing writes. Each runs in one transaction so invoices, payments and treatment links never disagree.
// The UI logs the activity line afterwards (it knows the patient name and the language).
import { db, nextInvoiceNumber } from '@/db'
import { newId, nowISO } from '@/db/ids'
import type { ID, Invoice, InvoiceItem, InvoiceStatus, ISODate, Payment, PaymentMethod } from '@/db/types'
import { computeTotals, DRAFT_NUMBER, invoiceStatus, isBillable, isDraftNumber, lineTotal, recomputeInvoice, splitPayment } from './lib'

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

/**
 * Creates or updates an invoice.
 * mode 'draft' keeps (or gives) the temporary DRAFT number; mode 'issue' takes the next real number when the invoice
 * has none yet. Treatment items on the lines are linked to the invoice; lines removed while editing are unlinked.
 */
export async function saveInvoice(input: InvoiceInput, opts: { id?: ID; mode: 'draft' | 'issue'; userId?: ID }): Promise<Invoice> {
  return db.transaction('rw', [db.invoices, db.treatments, db.clinic], async () => {
    const existing = opts.id ? await db.invoices.get(opts.id) : undefined
    if (existing && existing.status === 'cancelled') throw new Error('cancelled')
    const items = input.items.map(i => ({ ...i, total: lineTotal(i.qty, i.unitPrice, i.discount) }))
    const totals = computeTotals(items, input.discount, input.taxPercent)
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
      status: invoiceStatus(totals.total, paid, base),
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
    return inv
  })
}

async function unlinkTreatment(treatmentId: ID, invoiceId: ID) {
  const tr = await db.treatments.get(treatmentId)
  if (!tr || tr.invoiceId !== invoiceId) return
  const { invoiceId: _drop, ...rest } = tr
  await db.treatments.put({ ...rest, updatedAt: nowISO() })
}

/** Cancels an issued invoice: it keeps its number (and any payments), and its treatments can be billed again. */
export async function cancelInvoice(id: ID): Promise<Invoice | undefined> {
  return db.transaction('rw', db.invoices, db.treatments, async () => {
    const inv = await db.invoices.get(id)
    if (!inv || inv.status === 'cancelled') return inv
    const next: Invoice = { ...inv, status: 'cancelled', updatedAt: nowISO() }
    await db.invoices.put(next)
    const linked = await db.treatments.where('invoiceId').equals(id).toArray()
    for (const tr of linked) await unlinkTreatment(tr.id, id)
    return next
  })
}

/** Deletes a draft (only drafts can be deleted) and frees its treatments. */
export async function deleteDraftInvoice(id: ID): Promise<boolean> {
  return db.transaction('rw', db.invoices, db.treatments, async () => {
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
}

/**
 * Records a payment. Against an invoice it is applied up to the invoice balance and the rest is saved as a second,
 * on-account payment. Returns the created payments (the first is the one to show on the receipt).
 */
export async function recordPayment(input: PaymentInput): Promise<Payment[]> {
  return db.transaction('rw', db.payments, db.invoices, async () => {
    const inv = input.invoiceId ? await db.invoices.get(input.invoiceId) : undefined
    const target = inv && isBillable(inv) ? inv : undefined
    const { onInvoice, onAccount } = splitPayment(input.amount, target)
    const createdAt = nowISO()
    const base = { patientId: input.patientId, method: input.method, date: input.date, reference: input.reference?.trim(), note: input.note?.trim(), receivedBy: input.receivedBy, createdAt }
    const created: Payment[] = []
    if (target && onInvoice !== 0) created.push(clean({ id: newId(), ...base, invoiceId: target.id, amount: onInvoice }) as Payment)
    if (onAccount !== 0 || created.length === 0) created.push(clean({ id: newId(), ...base, amount: onAccount }) as Payment)
    await db.payments.bulkAdd(created)
    if (target) await recomputeInvoice(target.id)
    return created
  })
}

/** Deletes a payment and refreshes its invoice's paid / status. */
export async function deletePayment(id: ID): Promise<Payment | undefined> {
  return db.transaction('rw', db.payments, db.invoices, async () => {
    const p = await db.payments.get(id)
    if (!p) return undefined
    await db.payments.delete(id)
    if (p.invoiceId) await recomputeInvoice(p.invoiceId)
    return p
  })
}
