// Database writes of the lab module. Callers pass the activity message already translated.
import { db, logActivity } from '@/db'
import type { LabOrder, LabOrderStatus } from '@/db/types'
import { newId, nowISO } from '@/db/ids'
import { statusPatch } from './lib'

export type LabInput = Omit<LabOrder, 'id' | 'createdAt' | 'updatedAt'>

function clean(o: LabOrder): LabOrder {
  const out = { ...o }
  for (const k of ['doctorId', 'shade', 'material', 'sentDate', 'dueDate', 'receivedDate', 'notes', 'treatmentItemId'] as const) {
    const v = out[k]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) delete out[k]
    else if (typeof v === 'string') (out as Record<string, unknown>)[k] = v.trim()
  }
  out.labName = out.labName.trim().replace(/\s+/g, ' ')
  out.cost = Math.max(0, Number(out.cost) || 0)
  return out
}

/** Creates (no id) or updates a lab order; returns its id. */
export async function saveLabOrder(input: LabInput, opts: { id?: string; by?: string; message: string }): Promise<string> {
  const now = nowISO()
  if (opts.id) {
    const cur = await db.labOrders.get(opts.id)
    if (!cur) throw new Error('not-found')
    const next = clean({ ...input, id: cur.id, createdAt: cur.createdAt, updatedAt: now })
    await db.labOrders.put(next)
    void logActivity({ type: 'lab', action: cur.status !== next.status ? 'status' : 'update', entityId: cur.id, patientId: next.patientId, message: opts.message, by: opts.by })
    return cur.id
  }
  const row = clean({ ...input, id: newId(), createdAt: now, updatedAt: now })
  await db.labOrders.add(row)
  void logActivity({ type: 'lab', action: 'create', entityId: row.id, patientId: row.patientId, message: opts.message, by: opts.by })
  return row.id
}

/** Moves an order to another status, keeping the sent / received / due dates consistent. */
export async function setLabStatus(order: LabOrder, status: LabOrderStatus, opts: { today: string; by?: string; message: string }): Promise<Partial<LabOrder>> {
  const patch = { ...statusPatch(order, status, opts.today), updatedAt: nowISO() }
  await db.labOrders.update(order.id, patch)
  void logActivity({ type: 'lab', action: 'status', entityId: order.id, patientId: order.patientId, message: opts.message, by: opts.by })
  return patch
}

export async function deleteLabOrder(order: LabOrder, opts: { by?: string; message: string }): Promise<void> {
  await db.labOrders.delete(order.id)
  void logActivity({ type: 'lab', action: 'delete', entityId: order.id, patientId: order.patientId, message: opts.message, by: opts.by })
}
