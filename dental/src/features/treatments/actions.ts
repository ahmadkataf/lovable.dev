// Writes of the treatments module. Each runs in one transaction so plans, items, invoices and the chart never
// disagree; the UI logs the activity line afterwards (it knows the names and the language).
import { db, getClinic, nextInvoiceNumber } from '@/db'
import { newId, nowISO, todayISO } from '@/db/ids'
import type { ID, Invoice, Procedure, ToothCondition, ToothRecord, ToothSurface, TreatmentItem, TreatmentPlan, TreatmentStatus } from '@/db/types'
import { DEFAULT_PROCEDURES, scalePrice } from '@/features/seed/catalog'
import { seedDefaults } from '@/features/seed/demo'
import { isEmptyPlan, planRecord } from '@/features/chart/lib'
import { bulkPrice, invoiceFromItems, planStatusFrom, statusPatch, unbilledItems, type BulkChange } from './lib'

/** Drops undefined / empty-string fields so stored records stay tidy. */
function clean<T extends object>(o: T): T {
  const out: any = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') out[k] = v
  return out
}

// ---- plans ----------------------------------------------------------------------------------------

/** Re-derives a plan's status from its items and writes it when it changed. Call inside a transaction on plans + treatments. */
async function syncPlan(planId?: ID): Promise<void> {
  if (!planId) return
  const plan = await db.plans.get(planId)
  if (!plan) return
  const items = await db.treatments.where('planId').equals(planId).toArray()
  const next = planStatusFrom(items, plan.status)
  if (next !== plan.status) await db.plans.update(planId, { status: next, updatedAt: nowISO() })
}

export interface PlanInput { title: string; doctorId?: ID; notes?: string }
export async function createPlan(patientId: ID, input: PlanInput): Promise<TreatmentPlan> {
  const now = nowISO()
  const plan: TreatmentPlan = clean({ id: newId(), patientId, title: input.title.trim(), doctorId: input.doctorId, notes: input.notes?.trim(), status: 'draft' as const, createdAt: now, updatedAt: now })
  await db.plans.add(plan)
  return plan
}
export async function updatePlan(id: ID, input: PlanInput): Promise<void> {
  const plan = await db.plans.get(id)
  if (!plan) return
  const { doctorId: _d, notes: _n, ...rest } = plan
  await db.plans.put(clean({ ...rest, title: input.title.trim(), doctorId: input.doctorId, notes: input.notes?.trim(), updatedAt: nowISO() }))
}
/** Approval: draft → approved (or straight to in progress / completed when work already started). */
export async function approvePlan(id: ID): Promise<{ status: TreatmentPlan['status'] }> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    const items = await db.treatments.where('planId').equals(id).toArray()
    const status = planStatusFrom(items, 'approved')
    await db.plans.update(id, { status, updatedAt: nowISO() })
    return { status }
  })
}
/** Cancels the plan and the work in it that has not been done. */
export async function cancelPlan(id: ID): Promise<number> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    const now = nowISO()
    const open = await db.treatments.where('planId').equals(id).filter(i => i.status === 'planned' || i.status === 'in_progress').toArray()
    for (const i of open) await db.treatments.update(i.id, { status: 'cancelled', updatedAt: now })
    await db.plans.update(id, { status: 'cancelled', updatedAt: now })
    return open.length
  })
}
/** Brings a cancelled plan back (its cancelled items stay cancelled until restored one by one). */
export async function reopenPlan(id: ID): Promise<void> {
  await db.transaction('rw', db.plans, db.treatments, async () => {
    const items = await db.treatments.where('planId').equals(id).toArray()
    await db.plans.update(id, { status: planStatusFrom(items, 'approved'), updatedAt: nowISO() })
  })
}
/**
 * Deletes a plan. Work that was done is clinical history: completed items stay on the patient's record without a
 * plan; everything else in the plan is deleted.
 */
export async function deletePlan(id: ID): Promise<{ deleted: number; kept: number }> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    const items = await db.treatments.where('planId').equals(id).toArray()
    let deleted = 0, kept = 0
    for (const i of items) {
      if (i.status === 'completed' || i.invoiceId) {
        const { planId: _p, ...rest } = i
        await db.treatments.put({ ...rest, updatedAt: nowISO() }); kept++
      } else { await db.treatments.delete(i.id); deleted++ }
    }
    await db.plans.delete(id)
    return { deleted, kept }
  })
}

// ---- items ----------------------------------------------------------------------------------------

export interface ItemDraft {
  procedure: Pick<Procedure, 'id' | 'name' | 'nameEn'>
  procedureName: string
  teeth: number[]                 // one item per tooth; empty = one item without a tooth
  surfaces?: ToothSurface[]
  price: number
  discount: number
  doctorId?: ID
  plannedDate?: string
  notes?: string
  status?: TreatmentStatus        // 'completed' for a quick treatment
  completedAt?: string            // quick treatment done on an earlier day
}
/** Adds one item per tooth. `plan` is an existing plan id, a new plan to create first, or nothing (items without a plan). */
export async function addItems(patientId: ID, d: ItemDraft, plan?: { id: ID } | { create: PlanInput }): Promise<{ items: TreatmentItem[]; planId?: ID }> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    let planId: ID | undefined
    if (plan && 'id' in plan) planId = plan.id
    else if (plan && 'create' in plan) planId = (await createPlan(patientId, plan.create)).id
    const now = nowISO()
    const status = d.status ?? 'planned'
    const teeth: (number | undefined)[] = d.teeth.length ? d.teeth : [undefined]
    const items = teeth.map((tooth): TreatmentItem => clean({
      id: newId(), patientId, planId, procedureId: d.procedure.id, procedureName: d.procedureName, tooth,
      surfaces: tooth && d.surfaces?.length ? [...d.surfaces] : undefined,
      price: d.price, discount: d.discount || 0, status, doctorId: d.doctorId, notes: d.notes?.trim(),
      plannedDate: d.plannedDate, completedAt: status === 'completed' ? d.completedAt ?? now : undefined, createdAt: now, updatedAt: now,
    }))
    await db.treatments.bulkAdd(items)
    await syncPlan(planId)
    return { items, planId }
  })
}

export type ItemPatch = Partial<Pick<TreatmentItem, 'procedureId' | 'procedureName' | 'tooth' | 'surfaces' | 'price' | 'discount' | 'doctorId' | 'plannedDate' | 'notes'>>
/** Edits an item. A billed item keeps what its invoice shows (procedure, tooth, price, discount). */
export async function updateItem(id: ID, patch: ItemPatch): Promise<TreatmentItem | undefined> {
  return db.transaction('rw', db.treatments, async () => {
    const cur = await db.treatments.get(id)
    if (!cur) return undefined
    const p: ItemPatch = { ...patch }
    if (cur.invoiceId) { delete p.procedureId; delete p.procedureName; delete p.tooth; delete p.surfaces; delete p.price; delete p.discount }
    const merged = { ...cur, ...p, updatedAt: nowISO() }
    if (!merged.tooth) merged.surfaces = undefined
    if (merged.notes !== undefined) merged.notes = merged.notes.trim()
    const next = clean(merged) as TreatmentItem
    await db.treatments.put(next)
    return next
  })
}

/** Moves an item along the workflow and re-derives its plan's status. */
export async function setItemStatus(id: ID, status: TreatmentStatus): Promise<TreatmentItem | undefined> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    const cur = await db.treatments.get(id)
    if (!cur || cur.status === status) return cur
    if (cur.invoiceId && cur.status === 'completed') return cur           // billed work cannot be reopened
    const next = clean({ ...cur, ...statusPatch(cur, status, nowISO()) }) as TreatmentItem
    await db.treatments.put(next)
    await syncPlan(cur.planId)
    return next
  })
}

/** Deletes an item that has not been billed. */
export async function deleteItem(id: ID): Promise<boolean> {
  return db.transaction('rw', db.plans, db.treatments, async () => {
    const cur = await db.treatments.get(id)
    if (!cur || cur.invoiceId) return false
    await db.treatments.delete(id)
    await syncPlan(cur.planId)
    return true
  })
}

// ---- dental chart ---------------------------------------------------------------------------------

export interface ChartEntry { tooth: number; condition: ToothCondition; surfaces: ToothSurface[]; treatmentItemId?: ID }
/**
 * Records what the treatment left on each tooth. The chart module decides what a new finding replaces (a crown hides
 * old fillings, an extraction clears the tooth…), so the chart and this module always agree.
 */
export async function applyChartEntries(patientId: ID, entries: ChartEntry[], userId?: ID): Promise<number> {
  return db.transaction('rw', db.teeth, async () => {
    let written = 0
    for (const e of entries) {
      const rows = await db.teeth.where('[patientId+tooth]').equals([patientId, e.tooth]).toArray()
      const plan = planRecord(rows, { tooth: e.tooth, condition: e.condition, surfaces: e.surfaces, treatmentItemId: e.treatmentItemId })
      if (isEmptyPlan(plan)) continue
      for (const id of plan.deactivate) await db.teeth.update(id, { active: false })
      for (const id of plan.activate) await db.teeth.update(id, { active: true })
      const now = nowISO()
      for (const r of plan.add) {
        await db.teeth.add(clean<ToothRecord>({ id: newId(), patientId, tooth: r.tooth, surfaces: r.surfaces, condition: r.condition, active: r.active, recordedAt: now, recordedBy: userId, treatmentItemId: r.treatmentItemId, note: r.note }))
      }
      written++
    }
    return written
  })
}

// ---- billing --------------------------------------------------------------------------------------

/** Invoices completed, unbilled items of one patient and links them to the new invoice. */
export async function billItems(patientId: ID, itemIds: ID[], userId?: ID): Promise<Invoice> {
  return db.transaction('rw', [db.invoices, db.treatments, db.clinic], async () => {
    const found = (await db.treatments.bulkGet(itemIds)).filter((i): i is TreatmentItem => !!i && i.patientId === patientId)
    const items = unbilledItems(found)
    if (!items.length) throw new Error('nothing-to-bill')
    const clinic = await getClinic()
    const number = await nextInvoiceNumber()
    const now = nowISO()
    const draft = invoiceFromItems(items, clinic, { patientId, date: todayISO(), makeId: newId })
    const invoice = clean<Invoice>({ ...draft, id: newId(), number, createdAt: now, updatedAt: now, createdBy: userId })
    await db.invoices.add(invoice)
    for (const i of items) await db.treatments.update(i.id, { invoiceId: invoice.id, updatedAt: now })
    return invoice
  })
}

// ---- procedures -----------------------------------------------------------------------------------

export type ProcedureInput = Omit<Procedure, 'id' | 'createdAt' | 'updatedAt'>
export async function saveProcedure(input: ProcedureInput, id?: ID): Promise<Procedure> {
  const now = nowISO()
  const existing = id ? await db.procedures.get(id) : undefined
  let sortOrder = existing?.sortOrder ?? input.sortOrder
  if (sortOrder === undefined) {
    const all = await db.procedures.toArray()
    sortOrder = all.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0) + 1
  }
  const rec: Procedure = clean({
    ...input, id: existing?.id ?? newId(), name: input.name.trim(), nameEn: input.nameEn?.trim(), code: input.code?.trim(),
    sortOrder, createdAt: existing?.createdAt ?? now, updatedAt: now,
  }) as Procedure
  rec.active = !!input.active; rec.toothSpecific = !!input.toothSpecific; rec.price = Number(input.price) || 0
  await db.procedures.put(rec)
  return rec
}
/** How many treatment items and invoice lines use a procedure (a used procedure is deactivated, not deleted). */
export async function procedureUsage(id: ID): Promise<number> {
  const [items, invoices] = await Promise.all([
    db.treatments.filter(i => i.procedureId === id).count(),
    db.invoices.filter(inv => inv.items.some(l => l.procedureId === id)).count(),
  ])
  return items + invoices
}
export async function setProcedureActive(id: ID, active: boolean): Promise<void> {
  await db.procedures.update(id, { active, updatedAt: nowISO() })
}
/** Deletes an unused procedure; returns false (and deletes nothing) when it is used. */
export async function deleteProcedure(id: ID): Promise<boolean> {
  return db.transaction('rw', db.procedures, db.treatments, db.invoices, async () => {
    if ((await procedureUsage(id)) > 0) return false
    await db.procedures.delete(id)
    return true
  })
}
/** Applies a bulk price change to the given procedures; returns how many prices changed. */
export async function applyBulkPrice(ids: ID[], change: BulkChange): Promise<number> {
  return db.transaction('rw', db.procedures, async () => {
    const now = nowISO()
    let n = 0
    for (const p of await db.procedures.bulkGet(ids)) {
      if (!p) continue
      const price = bulkPrice(p.price, change)
      if (price !== p.price) { await db.procedures.update(p.id, { price, updatedAt: now }); n++ }
    }
    return n
  })
}
/**
 * Loads the default catalogue. seedDefaults() (seed module) is idempotent; if it leaves the list empty (an older
 * build where it is not available), the catalogue is inserted from the same definitions here.
 */
export async function loadDefaultCatalogue(): Promise<number> {
  const before = await db.procedures.count()
  try { await seedDefaults() } catch { /* fall back below */ }
  if ((await db.procedures.count()) === 0) {
    const clinic = await getClinic()
    const now = nowISO()
    await db.procedures.bulkAdd(DEFAULT_PROCEDURES.map((p, i): Procedure => ({
      id: newId(), code: p.code, name: p.name, nameEn: p.nameEn, category: p.category, price: scalePrice(p.price, clinic.currency),
      durationMin: p.durationMin, toothSpecific: p.toothSpecific, active: true, sortOrder: i + 1, createdAt: now, updatedAt: now,
    })))
  }
  return (await db.procedures.count()) - before
}
