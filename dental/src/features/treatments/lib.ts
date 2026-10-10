// Pure logic of the treatments module: totals, status derivation, invoice building, chart suggestions, the FDI
// tooth grid, the price-list helpers and the register filters. No database access and no React here, so every
// function is covered by tests/treatments.test.ts.
import type {
  Clinic, ID, Invoice, InvoiceItem, ISODate, Procedure, ProcedureCategory, ToothCondition, ToothSurface, TreatmentItem, TreatmentPlan, TreatmentStatus,
} from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { addDays, dateOf, endOfMonth, startOfMonth, startOfWeek } from '@/lib/dates'
import { round2 } from '@/lib/format'

export type PlanStatus = TreatmentPlan['status']
export const ITEM_STATUSES: TreatmentStatus[] = ['planned', 'in_progress', 'completed', 'cancelled']
export const PLAN_STATUSES: PlanStatus[] = ['draft', 'approved', 'in_progress', 'completed', 'cancelled']

// ---- money --------------------------------------------------------------------------------------

/** price − discount, never below zero, rounded to cents. */
export function itemTotal(i: Pick<TreatmentItem, 'price' | 'discount'>): number {
  return round2(Math.max(0, (Number(i.price) || 0) - (Number(i.discount) || 0)))
}
const live = <T extends Pick<TreatmentItem, 'status'>>(items: readonly T[]) => items.filter(i => i.status !== 'cancelled')

export interface PlanTotals {
  count: number          // items that are not cancelled
  subtotal: number       // Σ price
  discount: number       // Σ discount
  total: number          // Σ itemTotal
  done: number           // completed items
  doneValue: number      // Σ itemTotal of completed items
  progress: number       // 0–100, by value (by count when everything is free)
}
/** Totals of a plan (cancelled items do not count). */
export function planTotals(items: readonly TreatmentItem[]): PlanTotals {
  const l = live(items)
  const subtotal = round2(l.reduce((a, i) => a + (Number(i.price) || 0), 0))
  const total = round2(l.reduce((a, i) => a + itemTotal(i), 0))
  const doneItems = l.filter(i => i.status === 'completed')
  const doneValue = round2(doneItems.reduce((a, i) => a + itemTotal(i), 0))
  const progress = l.length === 0 ? 0 : total > 0 ? Math.round((doneValue / total) * 100) : Math.round((doneItems.length / l.length) * 100)
  return { count: l.length, subtotal, discount: round2(subtotal - total), total, done: doneItems.length, doneValue, progress }
}

export interface Bucket { count: number; value: number }
export interface Summary { planned: Bucket; inProgress: Bucket; completed: Bucket; unbilled: Bucket; cancelled: Bucket }
const bucket = (list: readonly TreatmentItem[]): Bucket => ({ count: list.length, value: round2(list.reduce((a, i) => a + itemTotal(i), 0)) })
/** Counts and values per status, plus the completed work that has not been invoiced yet. */
export function summarize(items: readonly TreatmentItem[]): Summary {
  return {
    planned: bucket(items.filter(i => i.status === 'planned')),
    inProgress: bucket(items.filter(i => i.status === 'in_progress')),
    completed: bucket(items.filter(i => i.status === 'completed')),
    unbilled: bucket(unbilledItems(items)),
    cancelled: bucket(items.filter(i => i.status === 'cancelled')),
  }
}
/** Completed, not invoiced yet. */
export function unbilledItems<T extends Pick<TreatmentItem, 'status' | 'invoiceId'>>(items: readonly T[]): T[] {
  return items.filter(i => i.status === 'completed' && !i.invoiceId)
}

// ---- status workflow ----------------------------------------------------------------------------

/**
 * The plan status that follows from its items:
 * cancelled stays cancelled; completed when every item that is not cancelled is completed; in progress as soon as
 * one item is in progress or completed (starting work implies the patient accepted the plan); otherwise a draft
 * stays a draft until it is approved, and an approved plan whose work was undone goes back to approved.
 */
export function planStatusFrom(items: readonly Pick<TreatmentItem, 'status'>[], current: PlanStatus = 'draft'): PlanStatus {
  if (current === 'cancelled') return 'cancelled'
  const l = live(items)
  if (l.length > 0 && l.every(i => i.status === 'completed')) return 'completed'
  if (l.some(i => i.status === 'in_progress' || i.status === 'completed')) return 'in_progress'
  return current === 'draft' ? 'draft' : 'approved'
}

/** Which status changes an item offers. A billed item cannot be reopened (its invoice would no longer match). */
export function nextStatuses(i: Pick<TreatmentItem, 'status' | 'invoiceId'>): TreatmentStatus[] {
  switch (i.status) {
    case 'planned': return ['in_progress', 'completed', 'cancelled']
    case 'in_progress': return ['completed', 'planned', 'cancelled']
    case 'completed': return i.invoiceId ? [] : ['in_progress']
    case 'cancelled': return ['planned']
  }
}

/** The fields to write when an item moves to a new status (completedAt is set once, cleared when reopened). */
export function statusPatch(i: Pick<TreatmentItem, 'status' | 'completedAt'>, next: TreatmentStatus, now: string): Partial<TreatmentItem> {
  const patch: Partial<TreatmentItem> = { status: next, updatedAt: now }
  if (next === 'completed') patch.completedAt = i.status === 'completed' && i.completedAt ? i.completedAt : now
  else patch.completedAt = undefined
  return patch
}

// ---- invoices -----------------------------------------------------------------------------------

/** The doctor most items were done by (ties: the first one met), or undefined. */
export function mainDoctor(items: readonly Pick<TreatmentItem, 'doctorId'>[]): ID | undefined {
  const count = new Map<ID, number>()
  for (const i of items) if (i.doctorId) count.set(i.doctorId, (count.get(i.doctorId) ?? 0) + 1)
  let best: ID | undefined, n = 0
  for (const [id, c] of count) if (c > n) { best = id; n = c }
  return best
}

export type InvoiceDraft = Omit<Invoice, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'createdBy'>
/**
 * The invoice for a set of completed treatment items: one line per item (qty 1, the item's price and discount),
 * no invoice-level discount, the clinic's tax on the subtotal, nothing paid yet.
 */
export function invoiceFromItems(
  items: readonly TreatmentItem[],
  clinic: Pick<Clinic, 'taxPercent'>,
  opts: { date: ISODate; patientId?: ID; doctorId?: ID; makeId: () => string; describe?: (i: TreatmentItem) => string },
): InvoiceDraft {
  const lines: InvoiceItem[] = items.map(i => {
    const line: InvoiceItem = {
      id: opts.makeId(), treatmentItemId: i.id, description: opts.describe ? opts.describe(i) : i.procedureName,
      qty: 1, unitPrice: round2(Number(i.price) || 0), discount: round2(Math.min(Number(i.discount) || 0, Number(i.price) || 0)), total: itemTotal(i),
    }
    if (i.procedureId) line.procedureId = i.procedureId
    if (i.tooth) line.tooth = i.tooth
    return line
  })
  const subtotal = round2(lines.reduce((a, l) => a + l.total, 0))
  const taxPercent = Math.max(0, Number(clinic.taxPercent) || 0)
  const tax = round2((subtotal * taxPercent) / 100)
  const total = round2(subtotal + tax)
  const draft: InvoiceDraft = {
    patientId: opts.patientId ?? items[0]?.patientId ?? '', date: opts.date, items: lines,
    subtotal, discount: 0, taxPercent, tax, total, paid: 0, status: total > 0 ? 'unpaid' : 'paid',
  }
  const doctorId = opts.doctorId ?? mainDoctor(items)
  if (doctorId) draft.doctorId = doctorId
  return draft
}

// ---- dental chart -------------------------------------------------------------------------------

const CHART_CONDITION: Partial<Record<ProcedureCategory, ToothCondition>> = {
  restorative: 'filled', endodontic: 'root_canal', prosthodontic: 'crown', surgical: 'missing', implant: 'implant', preventive: 'sealant', cosmetic: 'veneer',
}
/** The chart finding a completed procedure of this category usually leaves on the tooth (null = no suggestion). */
export function chartConditionFor(category?: ProcedureCategory): ToothCondition | null {
  return (category && CHART_CONDITION[category]) || null
}
/** Conditions recorded on surfaces (the others cover the whole tooth). Same set as the chart module. */
export const SURFACE_CONDITIONS: ToothCondition[] = ['caries', 'filled', 'sealant', 'fracture']
export const isSurfaceCondition = (c: ToothCondition) => SURFACE_CONDITIONS.includes(c)
/** Conditions offered when updating the chart after a treatment. */
export const CHART_CHOICES: ToothCondition[] = ['filled', 'sealant', 'root_canal', 'crown', 'bridge', 'veneer', 'implant', 'missing', 'healthy']

/** Surfaces to record: the item's own, else a sensible default (occlusal on back teeth, buccal on front teeth). */
export function chartSurfaces(condition: ToothCondition, tooth: number, surfaces?: readonly ToothSurface[]): ToothSurface[] {
  if (!isSurfaceCondition(condition)) return []
  if (surfaces && surfaces.length) return sortSurfaces(surfaces)
  return [isAnterior(tooth) ? (condition === 'sealant' ? 'L' : 'B') : 'O']
}

// ---- teeth (FDI) --------------------------------------------------------------------------------

const seq = (q: number, n: number, reverse: boolean) => { const out: number[] = []; for (let i = 1; i <= n; i++) out.push(q * 10 + i); return reverse ? out.reverse() : out }
/** The tooth picker as the dentist faces the patient: each arch is [patient's right quadrant, patient's left quadrant]. */
export const TEETH_GRID = {
  adult: { upper: [seq(1, 8, true), seq(2, 8, false)], lower: [seq(4, 8, true), seq(3, 8, false)] },
  primary: { upper: [seq(5, 5, true), seq(6, 5, false)], lower: [seq(8, 5, true), seq(7, 5, false)] },
} as const
export type Dentition = keyof typeof TEETH_GRID

export function isValidTooth(n: unknown): n is number {
  if (typeof n !== 'number' || !Number.isInteger(n)) return false
  const q = Math.floor(n / 10), p = n % 10
  if (q >= 1 && q <= 4) return p >= 1 && p <= 8
  if (q >= 5 && q <= 8) return p >= 1 && p <= 5
  return false
}
export const isPrimaryTooth = (n: number) => isValidTooth(n) && n >= 51
/** Incisors and canines have an incisal edge (I) instead of an occlusal surface (O). */
export const isAnterior = (n: number) => isValidTooth(n) && n % 10 <= 3
/** Parses a ?tooth= value. */
export function parseTooth(v: string | null | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return isValidTooth(n) ? n : null
}

/** Picker order of the surface chips. */
export const SURFACES: ToothSurface[] = ['M', 'D', 'O', 'B', 'L', 'I', 'R']
/** Display order: the usual dental shorthand (MOD, MIB…). */
const SURFACE_ORDER: ToothSurface[] = ['M', 'O', 'I', 'D', 'B', 'L', 'R']
export function sortSurfaces(s: readonly ToothSurface[]): ToothSurface[] { return SURFACE_ORDER.filter(x => s.includes(x)) }
export function surfaceCode(s?: readonly ToothSurface[]): string { return s && s.length ? sortSurfaces(s).join('') : '' }
/** The surfaces that make sense for the chosen teeth: no O on front teeth only, no I on back teeth only. */
export function surfacesForTeeth(teeth: readonly number[]): ToothSurface[] {
  const valid = teeth.filter(isValidTooth)
  if (!valid.length) return [...SURFACES]
  const front = valid.some(isAnterior), back = valid.some(n => !isAnterior(n))
  return SURFACES.filter(s => (s === 'O' ? back : s === 'I' ? front : true))
}
/** Teeth sorted in chart order (upper right → upper left → lower left → lower right). */
export function sortTeeth(teeth: readonly number[]): number[] {
  const order = [...TEETH_GRID.adult.upper.flat(), ...TEETH_GRID.primary.upper.flat(), ...TEETH_GRID.primary.lower.flat().reverse(), ...TEETH_GRID.adult.lower.flat().reverse()]
  return [...new Set(teeth)].filter(isValidTooth).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// ---- item form ----------------------------------------------------------------------------------

export interface ItemInput { procedure?: Pick<Procedure, 'toothSpecific'> | null; teeth: readonly number[]; price: number | null; discount: number | null }
export type ItemErrors = Partial<Record<'procedure' | 'teeth' | 'price' | 'discount', string>>
/** Validation keys (looked up in the module dictionary) of the add/edit item form. */
export function validateItem(i: ItemInput): ItemErrors {
  const e: ItemErrors = {}
  if (!i.procedure) e.procedure = 'v.procedure'
  else if (i.procedure.toothSpecific && i.teeth.length === 0) e.teeth = 'v.teeth'
  if (i.price === null || !Number.isFinite(i.price)) e.price = 'v.price'
  else if (i.price < 0) e.price = 'v.priceNegative'
  if (i.discount !== null && (i.discount < 0 || !Number.isFinite(i.discount))) e.discount = 'v.discountNegative'
  else if (i.discount !== null && i.price !== null && i.discount > i.price) e.discount = 'v.discountTooBig'
  return e
}

// ---- price list ---------------------------------------------------------------------------------

/** Price list order: manual order, then code, then name. */
export function sortProcedures<T extends Pick<Procedure, 'sortOrder' | 'code' | 'name'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) =>
    (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || (a.code ?? '￿').localeCompare(b.code ?? '￿', 'en', { numeric: true }) || a.name.localeCompare(b.name, 'ar'))
}
/** Procedures grouped by category, in the catalogue's category order; empty groups are left out. */
export function groupByCategory<T extends Pick<Procedure, 'category' | 'sortOrder' | 'code' | 'name'>>(list: readonly T[]): { category: ProcedureCategory; items: T[] }[] {
  return PROCEDURE_CATEGORIES.map(category => ({ category, items: sortProcedures(list.filter(p => p.category === category)) })).filter(g => g.items.length > 0)
}

export interface BulkChange { mode: 'percent' | 'fixed'; value: number; round: number }
/** New price after a bulk change: ± percent or ± a fixed amount, rounded to the step (0 = cents), never negative. */
export function bulkPrice(price: number, c: BulkChange): number {
  const base = Number(price) || 0
  let next = c.mode === 'percent' ? base * (1 + (Number(c.value) || 0) / 100) : base + (Number(c.value) || 0)
  next = Math.max(0, next)
  if (c.round > 0) next = Math.round(next / c.round) * c.round
  return round2(Math.max(0, next))
}
/** A code that is not taken yet: D2391 → D2391-2 → D2391-3… */
export function uniqueCode(code: string | undefined, taken: readonly (string | undefined)[]): string | undefined {
  if (!code) return undefined
  const set = new Set(taken.filter(Boolean).map(c => c!.toLowerCase()))
  if (!set.has(code.toLowerCase())) return code
  const base = code.replace(/-\d+$/, '')
  for (let n = 2; n < 1000; n++) { const c = `${base}-${n}`; if (!set.has(c.toLowerCase())) return c }
  return undefined
}
/** Colours offered for a procedure (the brand palette, also used for staff). */
export const PROCEDURE_COLORS = ['#0E8F86', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#4F46E5', '#CA8A04', '#DC2626']

// ---- the clinic register ------------------------------------------------------------------------

/** The date an item belongs to: when it was done, else when it is planned, else when it was added. */
export function itemDate(i: Pick<TreatmentItem, 'status' | 'completedAt' | 'plannedDate' | 'createdAt'>): ISODate {
  if (i.status === 'completed' && i.completedAt) return dateOf(i.completedAt)
  return i.plannedDate || dateOf(i.createdAt)
}

export type RangePreset = 'all' | 'today' | 'week' | 'month' | 'custom'
export interface Range { from: ISODate; to: ISODate }
/** The inclusive range of a preset (null = no date limit). The week starts on Saturday, as in the rest of the app. */
export function rangeFor(preset: RangePreset, today: ISODate, custom?: Partial<Range>): Range | null {
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'week': { const from = startOfWeek(today); return { from, to: addDays(from, 6) } }
    case 'month': return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'custom': {
      const from = custom?.from || '0000-01-01', to = custom?.to || '9999-12-31'
      return from <= to ? { from, to } : { from: to, to: from }
    }
    default: return null
  }
}
export const inRange = (d: ISODate, r: Range | null) => !r || (d >= r.from && d <= r.to)

export interface RegisterFilter {
  status?: TreatmentStatus | 'all'
  doctorId?: ID | ''
  category?: ProcedureCategory | ''
  range?: Range | null
  q?: string
}
/** Filters the clinic-wide register. `categoryOf` and `patientName` resolve what items do not store; `match` is the app's Arabic-aware search. */
export function filterRegister<T extends TreatmentItem>(items: readonly T[], f: RegisterFilter, ctx: {
  categoryOf: (i: T) => ProcedureCategory | undefined
  patientName: (i: T) => string
  match: (hay: string | undefined, needle: string) => boolean
}): T[] {
  const q = (f.q ?? '').trim()
  return items.filter(i =>
    (!f.status || f.status === 'all' || i.status === f.status)
    && (!f.doctorId || i.doctorId === f.doctorId)
    && (!f.category || ctx.categoryOf(i) === f.category)
    && inRange(itemDate(i), f.range ?? null)
    && (!q || ctx.match(i.procedureName, q) || ctx.match(ctx.patientName(i), q) || (i.tooth !== undefined && String(i.tooth) === q)))
}
/** Newest first (by itemDate, then creation). */
export function sortByDateDesc<T extends TreatmentItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const da = itemDate(a), dbb = itemDate(b)
    return da < dbb ? 1 : da > dbb ? -1 : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}
/** Groups rows by patient, keeping the order in which patients first appear. */
export function groupByPatient<T extends Pick<TreatmentItem, 'patientId'>>(items: readonly T[]): { patientId: ID; items: T[] }[] {
  const map = new Map<ID, T[]>()
  for (const i of items) { const l = map.get(i.patientId); if (l) l.push(i); else map.set(i.patientId, [i]) }
  return [...map].map(([patientId, list]) => ({ patientId, items: list }))
}

/** RFC 4180 CSV with a BOM so Excel opens Arabic text correctly. */
export function toCSV(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')
}

// ---- words --------------------------------------------------------------------------------------

type T = (k: string, p?: Record<string, string | number>) => string
/** Counted strings with real plural forms: keys '<key>_<rule>' (Arabic: zero one two few many other), falling back to '<key>_other'. */
export function tn(t: T, lang: 'ar' | 'en', key: string, n: number, params: Record<string, string | number> = {}): string {
  const rule = new Intl.PluralRules(lang).select(n)
  const p = { n, ...params }
  const s = t(`${key}_${rule}`, p)
  return s.endsWith(`_${rule}`) ? t(`${key}_other`, p) : s
}
