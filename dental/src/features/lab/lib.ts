// Pure helpers of the lab module: the status flow, due-date math, filters and counts, the FDI picker layout,
// shades and materials. No React, no database: everything here is unit-tested.
import type { ISODate, Lang, LabOrder, LabOrderStatus } from '@/db/types'
import { LAB_ORDER_STATUSES } from '@/db/types'
import { addDays, endOfMonth, startOfMonth } from '@/lib/dates'
import { matches } from '@/lib/format'

/** Days a lab usually needs; the form proposes sent + this. */
export const DEFAULT_LAB_DAYS = 7
export function defaultDueDate(sent: ISODate, days = DEFAULT_LAB_DAYS): ISODate {
  return addDays(sent, days)
}

/** The happy path of an order. */
export const LAB_FLOW: LabOrderStatus[] = ['draft', 'sent', 'in_progress', 'received', 'fitted']
/** The next step of the flow, or null when there is none (fitted, cancelled). A remake comes back as "received". */
export function nextStatus(s: LabOrderStatus): LabOrderStatus | null {
  switch (s) {
    case 'draft': return 'sent'
    case 'sent': return 'in_progress'
    case 'in_progress': return 'received'
    case 'remake': return 'received'
    case 'received': return 'fitted'
    default: return null
  }
}
/** Not back from the lab yet (the due date matters). */
export function isPending(o: Pick<LabOrder, 'status'>): boolean {
  return o.status === 'draft' || o.status === 'sent' || o.status === 'in_progress' || o.status === 'remake'
}
/** At the lab right now. */
export function isAtLab(o: Pick<LabOrder, 'status'>): boolean {
  return o.status === 'sent' || o.status === 'in_progress' || o.status === 'remake'
}
/** Work not finished: anything but fitted or cancelled. */
export function isOpen(o: Pick<LabOrder, 'status'>): boolean {
  return o.status !== 'fitted' && o.status !== 'cancelled'
}
/** Past its due date and still not received. */
export function isOverdue(o: Pick<LabOrder, 'status' | 'dueDate'>, today: ISODate): boolean {
  return !!o.dueDate && o.dueDate < today && isPending(o)
}
/** Due today or within the next six days, not received yet. */
export function isDueThisWeek(o: Pick<LabOrder, 'status' | 'dueDate'>, today: ISODate): boolean {
  return !!o.dueDate && isPending(o) && o.dueDate >= today && o.dueDate <= addDays(today, 6)
}

/**
 * The fields to write when an order moves to `status`: the received date is set when the work comes back (kept when it
 * was already there), cleared when the order goes back to the lab; the sent date is filled in when it leaves.
 */
export function statusPatch(o: Pick<LabOrder, 'sentDate' | 'receivedDate' | 'dueDate'>, status: LabOrderStatus, today: ISODate): Partial<LabOrder> {
  const p: Partial<LabOrder> = { status }
  if (status === 'received' || status === 'fitted') {
    p.receivedDate = o.receivedDate || today
  } else if (status === 'sent' || status === 'in_progress' || status === 'remake' || status === 'draft') {
    p.receivedDate = undefined
  }
  if ((status === 'sent' || status === 'in_progress') && !o.sentDate) p.sentDate = today
  if (status === 'remake' && (!o.dueDate || o.dueDate <= today)) p.dueDate = defaultDueDate(today)
  if (status === 'sent' && !o.dueDate) p.dueDate = defaultDueDate(o.sentDate || today)
  return p
}

export type StatusFilter = 'all' | LabOrderStatus
/** The board's segments, in the order the clinic works through them. */
export const STATUS_FILTERS: StatusFilter[] = ['all', 'sent', 'in_progress', 'received', 'fitted', 'remake', 'cancelled', 'draft']
export function statusCounts(orders: Pick<LabOrder, 'status'>[]): Record<StatusFilter, number> {
  const c = { all: orders.length } as Record<StatusFilter, number>
  for (const s of LAB_ORDER_STATUSES) c[s] = 0
  for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1
  return c
}

/** Distinct lab names, most used first (then alphabetical); blanks ignored, spacing normalised. */
export function labNames(orders: Pick<LabOrder, 'labName'>[]): string[] {
  const m = new Map<string, { name: string; n: number }>()
  for (const o of orders) {
    const name = (o.labName || '').trim().replace(/\s+/g, ' ')
    if (!name) continue
    const k = name.toLowerCase()
    const cur = m.get(k)
    if (cur) cur.n++; else m.set(k, { name, n: 1 })
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map(x => x.name)
}
/** Other values typed in a free-text field before (materials, shades), most used first. */
export function usedValues<T>(rows: T[], pick: (r: T) => string | undefined): string[] {
  return labNames(rows.map(r => ({ labName: pick(r) ?? '' })))
}

/** The day an order's cost counts for: when it was sent, else when it was created. */
export function costDate(o: Pick<LabOrder, 'sentDate' | 'createdAt'>): ISODate {
  return o.sentDate || (o.createdAt || '').slice(0, 10)
}
/** Lab costs of the month containing `day` (cancelled orders and drafts excluded). */
export function labCostInMonth(orders: Pick<LabOrder, 'sentDate' | 'createdAt' | 'cost' | 'status'>[], day: ISODate): number {
  const from = startOfMonth(day), to = endOfMonth(day)
  let total = 0
  for (const o of orders) {
    if (o.status === 'cancelled' || o.status === 'draft') continue
    const d = costDate(o)
    if (d >= from && d <= to) total += Number(o.cost) || 0
  }
  return Math.round(total * 100) / 100
}

export interface LabStats { open: number; atLab: number; ready: number; dueWeek: number; overdue: number; monthCost: number }
export function labStats(orders: LabOrder[], today: ISODate): LabStats {
  return {
    open: orders.filter(isOpen).length,
    atLab: orders.filter(isAtLab).length,
    ready: orders.filter(o => o.status === 'received').length,
    dueWeek: orders.filter(o => isDueThisWeek(o, today)).length,
    overdue: orders.filter(o => isOverdue(o, today)).length,
    monthCost: labCostInMonth(orders, today),
  }
}

export type DueFilter = '' | 'overdue' | 'week'
export interface LabFilter { status: StatusFilter; lab?: string; doctorId?: string; due?: DueFilter; q?: string; today: ISODate; patientName?: (id: string) => string | undefined }
export function filterOrders(orders: LabOrder[], f: LabFilter): LabOrder[] {
  const q = (f.q ?? '').trim()
  const lab = (f.lab ?? '').trim().toLowerCase()
  return orders.filter(o => {
    if (f.status !== 'all' && o.status !== f.status) return false
    if (lab && (o.labName || '').trim().replace(/\s+/g, ' ').toLowerCase() !== lab) return false
    if (f.doctorId && o.doctorId !== f.doctorId) return false
    if (f.due === 'overdue' && !isOverdue(o, f.today)) return false
    if (f.due === 'week' && !isDueThisWeek(o, f.today)) return false
    if (q && !(matches(f.patientName?.(o.patientId), q) || matches(o.labName, q) || matches(o.material, q) || o.teeth.some(t => String(t) === q))) return false
    return true
  })
}
/** Overdue first, then pending work by due date, then the rest newest first. */
export function sortOrders(orders: LabOrder[], today: ISODate): LabOrder[] {
  const rank = (o: LabOrder) => (isOverdue(o, today) ? 0 : isPending(o) ? 1 : o.status === 'received' ? 2 : 3)
  return [...orders].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r) return r
    if (rank(a) <= 1) return (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (b.createdAt || '').localeCompare(a.createdAt || '')
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
  })
}

// ---- teeth ---------------------------------------------------------------------------------------

/** The FDI picker as the dentist faces the patient: patient's right on the viewer's left. */
export const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
export const FDI_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
export const FDI_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
export const FDI_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]
export const FDI_UPPER = [...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT]
export const FDI_LOWER = [...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT]
export function isFdiTooth(n: number): boolean {
  const q = Math.floor(n / 10), t = n % 10
  return ((q >= 1 && q <= 4) && t >= 1 && t <= 8) || ((q >= 5 && q <= 8) && t >= 1 && t <= 5)
}
/** Adds or removes a tooth; the result is sorted by quadrant then position, without duplicates. */
export function toggleTooth(teeth: number[], n: number): number[] {
  const set = new Set(teeth)
  if (set.has(n)) set.delete(n); else set.add(n)
  return sortTeeth([...set])
}
export function sortTeeth(teeth: number[]): number[] {
  return [...new Set(teeth)].filter(isFdiTooth).sort((a, b) => a - b)
}
/** Teeth listed one by one ("11–13" style ranges are ambiguous across quadrants). */
export function teethLabel(teeth: number[], lang: Lang = 'ar'): string {
  return sortTeeth(teeth).join(lang === 'ar' ? '، ' : ', ')
}
/** Which arch(es) the teeth sit in. */
export function archOf(teeth: number[]): 'upper' | 'lower' | 'both' | null {
  const s = sortTeeth(teeth)
  if (!s.length) return null
  const up = s.some(t => [1, 2, 5, 6].includes(Math.floor(t / 10)))
  const low = s.some(t => [3, 4, 7, 8].includes(Math.floor(t / 10)))
  return up && low ? 'both' : up ? 'upper' : 'lower'
}

// ---- shades & materials --------------------------------------------------------------------------

/** VITA classical A1–D4 and the bleach shades. */
export const VITA_SHADES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4', 'BL1', 'BL2', 'BL3', 'BL4'] as const
/** Approximate swatch colours, only to help the eye in the picker. */
export const SHADE_SWATCH: Record<string, string> = {
  A1: '#F3E7CF', A2: '#EEDDBD', 'A3': '#E7D0A8', 'A3.5': '#DFC394', A4: '#D3B07B',
  B1: '#F5ECD7', B2: '#EFE0BD', B3: '#E5CD9C', B4: '#DDC18A',
  C1: '#E8DEC7', C2: '#DED0B0', C3: '#D3C29D', C4: '#C5AE85',
  D2: '#E6DAC3', D3: '#DCCCAE', D4: '#D7C7A5',
  BL1: '#FBF8F1', BL2: '#F8F3E8', BL3: '#F5EFE1', BL4: '#F2EAD8',
}
export const LAB_MATERIALS: Record<Lang, string[]> = {
  ar: ['زيركون', 'زيركون متعدد الطبقات', 'إيماكس (ليثيوم ديسيليكات)', 'خزف على معدن (PFM)', 'معدن كامل', 'أكريل', 'أكريل حراري', 'كومبوزيت', 'PMMA مؤقت', 'طقم مرن (فليكسيبل)', 'كروم كوبالت', 'PEEK'],
  en: ['Zirconia', 'Multilayer zirconia', 'e.max (lithium disilicate)', 'PFM (porcelain fused to metal)', 'Full metal', 'Acrylic', 'Heat-cured acrylic', 'Composite', 'PMMA (temporary)', 'Flexible (nylon)', 'Cobalt-chrome', 'PEEK'],
}
