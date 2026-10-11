// Database writes of the prescriptions module. Callers pass the activity message already translated.
import { db, logActivity } from '@/db'
import type { Drug, Prescription, PrescriptionItem } from '@/db/types'
import { newId, nowISO } from '@/db/ids'

export interface RxInput {
  patientId: string
  doctorId: string
  date: string
  diagnosis?: string
  notes?: string
  items: PrescriptionItem[]
}

/** Creates (no id) or updates a prescription; returns its id. */
export async function savePrescription(input: RxInput, opts: { id?: string; by?: string; message: string }): Promise<string> {
  const now = nowISO()
  const diagnosis = input.diagnosis?.trim() || undefined
  const notes = input.notes?.trim() || undefined
  if (opts.id) {
    const cur = await db.prescriptions.get(opts.id)
    if (!cur) throw new Error('not-found')
    const next: Prescription = { ...cur, patientId: input.patientId, doctorId: input.doctorId, date: input.date, items: input.items, diagnosis, notes, updatedAt: now }
    if (!diagnosis) delete next.diagnosis
    if (!notes) delete next.notes
    await db.prescriptions.put(next)
    void logActivity({ type: 'prescription', action: 'update', entityId: cur.id, patientId: input.patientId, message: opts.message, by: opts.by })
    return cur.id
  }
  const rx: Prescription = { id: newId(), patientId: input.patientId, doctorId: input.doctorId, date: input.date, items: input.items, createdAt: now, updatedAt: now }
  if (diagnosis) rx.diagnosis = diagnosis
  if (notes) rx.notes = notes
  await db.prescriptions.add(rx)
  void logActivity({ type: 'prescription', action: 'create', entityId: rx.id, patientId: rx.patientId, message: opts.message, by: opts.by })
  return rx.id
}

export async function deletePrescription(rx: Prescription, opts: { by?: string; message: string }): Promise<void> {
  await db.prescriptions.delete(rx.id)
  void logActivity({ type: 'prescription', action: 'delete', entityId: rx.id, patientId: rx.patientId, message: opts.message, by: opts.by })
}

export type DrugInput = Omit<Drug, 'id' | 'createdAt'>
/** Strips empty optional strings so the stored record stays clean. */
export function cleanDrug(d: DrugInput): DrugInput {
  const out: DrugInput = { name: d.name.trim(), active: d.active }
  const opt = ['nameEn', 'form', 'strength', 'defaultDose', 'defaultFrequency', 'defaultDuration', 'defaultInstructions'] as const
  for (const k of opt) { const v = (d[k] ?? '').trim(); if (v) out[k] = v }
  return out
}
export async function saveDrug(input: DrugInput, id?: string): Promise<string> {
  const d = cleanDrug(input)
  if (id) {
    const cur = await db.drugs.get(id)
    if (!cur) throw new Error('not-found')
    await db.drugs.put({ id, createdAt: cur.createdAt, ...d })
    return id
  }
  const row: Drug = { id: newId(), createdAt: nowISO(), ...d }
  await db.drugs.add(row)
  return row.id
}
