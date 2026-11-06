// Database writes of the lab module. Callers pass the activity message (and the expense description) already translated.
// An order received or fitted with a cost records that cost as one expense (category "lab", linked to the order),
// kept in step when the cost, the lab or the status changes, and removed with the order: the lab page, the expenses
// and the profit in the reports then tell the same story without typing every lab bill twice.
import { db, logActivity } from '@/db'
import type { Expense, LabOrder, LabOrderStatus } from '@/db/types'
import { newId, nowISO, todayISO } from '@/db/ids'
import { ensureRefs, takeRef } from '@/features/prescriptions/numbers'
import { labExpenseDue, labExpenseFields, statusPatch } from './lib'

/** How the order's expense is described ('{ref}' becomes the order's LAB- reference) and who records it (the signed-in user). */
export interface ExpenseOpts { by?: string; expenseDesc: string }

/**
 * Creates, updates or removes the order's expense so it matches the order. Runs inside the caller's transaction
 * (labOrders + expenses); returns the order with its expenseId set or cleared.
 */
async function syncExpense(order: LabOrder, opts: ExpenseOpts): Promise<LabOrder> {
  const linked = order.expenseId ? await db.expenses.get(order.expenseId) : undefined
  if (labExpenseDue({ ...order, expenseId: linked?.id })) {
    const ref = (order as LabOrder & { number?: string }).number ?? ''
    const fields = labExpenseFields(order, opts.expenseDesc.split('{ref}').join(ref).replace(/\s*\(\s*\)\s*$/, '').trim(), todayISO())
    if (linked) {
      // the day stays the one it was recorded on unless the received date was changed
      const date = order.receivedDate || linked.date
      const next: Expense = { ...linked, ...fields, date, labOrderId: order.id }
      if (!fields.vendor) delete next.vendor
      await db.expenses.put(next)
      return order
    }
    const row: Expense = { id: newId(), ...fields, labOrderId: order.id, createdAt: nowISO() }
    if (opts.by) row.by = opts.by
    await db.expenses.add(row)
    return { ...order, expenseId: row.id }
  }
  if (linked) await db.expenses.delete(linked.id)
  if (order.expenseId) { const next = { ...order }; delete next.expenseId; return next }
  return order
}

export type LabInput = Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt'>

function clean(o: LabOrder): LabOrder {
  const out = { ...o }
  for (const k of ['doctorId', 'shade', 'material', 'sentDate', 'dueDate', 'receivedDate', 'notes', 'treatmentItemId', 'expenseId'] as const) {
    const v = out[k]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) delete out[k]
    else if (typeof v === 'string') (out as Record<string, unknown>)[k] = v.trim()
  }
  out.labName = out.labName.trim().replace(/\s+/g, ' ')
  out.cost = Math.max(0, Number(out.cost) || 0)
  return out
}

/** Creates (no id) or updates a lab order (and its expense); returns its id. New orders get the next LAB- reference. */
export async function saveLabOrder(input: LabInput, opts: { id?: string; message: string } & ExpenseOpts): Promise<string> {
  const now = nowISO()
  if (opts.id) {
    const id = opts.id
    const { cur, next } = await db.transaction('rw', db.labOrders, db.expenses, async () => {
      const cur = await db.labOrders.get(id)
      if (!cur) throw new Error('not-found')
      // fields the form does not edit (the reference, the linked expense) are kept
      const merged = clean({ ...cur, ...input, id: cur.id, createdAt: cur.createdAt, updatedAt: now })
      if (!input.receivedDate) delete merged.receivedDate
      const next = await syncExpense(merged, opts)
      await db.labOrders.put(next)
      return { cur, next }
    })
    void logActivity({ type: 'lab', action: cur.status !== next.status ? 'status' : 'update', entityId: cur.id, patientId: next.patientId, message: opts.message, by: opts.by })
    return cur.id
  }
  await ensureRefs('lab')
  const row = await db.transaction('rw', db.labOrders, db.expenses, db.settings, async () => {
    const base = clean({ ...input, id: newId(), createdAt: now, updatedAt: now })
    const row = await syncExpense({ ...base, number: await takeRef('lab') } as LabOrder, opts)
    await db.labOrders.add(row)
    return row
  })
  void logActivity({ type: 'lab', action: 'create', entityId: row.id, patientId: row.patientId, message: opts.message, by: opts.by })
  return row.id
}

/** Moves an order to another status, keeping the sent / received / due dates and the expense consistent. */
export async function setLabStatus(order: LabOrder, status: LabOrderStatus, opts: { today: string; message: string } & ExpenseOpts): Promise<Partial<LabOrder>> {
  const patch = { ...statusPatch(order, status, opts.today), updatedAt: nowISO() }
  await db.transaction('rw', db.labOrders, db.expenses, async () => {
    const cur = (await db.labOrders.get(order.id)) ?? order
    const merged: LabOrder = { ...cur, ...patch }
    if (patch.receivedDate === undefined && 'receivedDate' in patch) delete merged.receivedDate
    const next = await syncExpense(merged, opts)
    await db.labOrders.put(next)
  })
  void logActivity({ type: 'lab', action: 'status', entityId: order.id, patientId: order.patientId, message: opts.message, by: opts.by })
  return patch
}

/** Deletes an order and the expense it recorded. */
export async function deleteLabOrder(order: LabOrder, opts: { by?: string; message: string }): Promise<void> {
  await db.transaction('rw', db.labOrders, db.expenses, async () => {
    const cur = await db.labOrders.get(order.id)
    const expenseId = cur?.expenseId ?? order.expenseId
    if (expenseId) await db.expenses.delete(expenseId)
    await db.labOrders.delete(order.id)
  })
  void logActivity({ type: 'lab', action: 'delete', entityId: order.id, patientId: order.patientId, message: opts.message, by: opts.by })
}
