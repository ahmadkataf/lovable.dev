// Reports & dashboard aggregation. Every function here is pure: it takes plain arrays (already loaded with
// useLiveQuery by the pages) and returns numbers ready for the charts. Covered by tests/reports.test.ts.
import { APPOINTMENT_STATUSES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PROCEDURE_CATEGORIES } from '@/db/types'
import type {
  Appointment, AppointmentStatus, Expense, ExpenseCategory, InventoryItem, Invoice, ISODate, LabOrder, Patient, Payment, PaymentMethod,
  Procedure, ProcedureCategory, TreatmentItem, User,
} from '@/db/types'
import { addDays, addMonths, ageFrom, dateOf, diffDays, endOfMonth, fromISODate, startOfMonth, startOfWeek, timeToMinutes, toISODate } from '@/lib/dates'
import { normalizeText, round2 } from '@/lib/format'

// ---- periods ------------------------------------------------------------------------------------------

export type PeriodPreset = 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom'
export const PERIOD_PRESETS: PeriodPreset[] = ['month', 'lastMonth', 'quarter', 'year', 'custom']
export interface Period { from: ISODate; to: ISODate }

/** A real 'YYYY-MM-DD' calendar date (rejects 2026-02-30). */
export function isISODate(s?: string): s is ISODate {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = fromISODate(s)
  return !Number.isNaN(d.getTime()) && toISODate(d) === s
}

/** Valid, ordered range; falls back to the current month for missing / invalid ends. */
export function normalizeRange(from: string | undefined, to: string | undefined, today: ISODate): Period {
  const f = isISODate(from) ? from : isISODate(to) ? to : startOfMonth(today)
  const t = isISODate(to) ? to : isISODate(from) ? from : endOfMonth(today)
  return f <= t ? { from: f, to: t } : { from: t, to: f }
}

/** The calendar range a preset stands for. "Last 3 months" includes the current month. */
export function resolvePeriod(preset: PeriodPreset, today: ISODate, custom?: Partial<Period>): Period {
  switch (preset) {
    case 'month': return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'lastMonth': { const m = addMonths(startOfMonth(today), -1); return { from: m, to: endOfMonth(m) } }
    case 'quarter': return { from: addMonths(startOfMonth(today), -2), to: endOfMonth(today) }
    case 'year': { const y = today.slice(0, 4); return { from: `${y}-01-01`, to: `${y}-12-31` } }
    case 'custom': return normalizeRange(custom?.from, custom?.to, today)
  }
}

export const periodDays = (p: Period) => Math.max(1, diffDays(p.from, p.to) + 1)
export const inRange = (d: string | undefined, p: Period) => !!d && d >= p.from && d <= p.to

/** The part of the period up to today (for series of things that cannot happen in the future). */
export function untilToday(p: Period, today: ISODate): Period {
  return p.from <= today && today < p.to ? { from: p.from, to: today } : p
}

/** Whole calendar months (1st → last day)? Returns how many, or 0. */
export function wholeMonths(p: Period): number {
  if (p.from !== startOfMonth(p.from) || p.to !== endOfMonth(p.to)) return 0
  const a = fromISODate(p.from), b = fromISODate(p.to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
}

/** The comparison period: the same number of calendar months before, or the same number of days right before. */
export function previousPeriod(p: Period): Period {
  const months = wholeMonths(p)
  if (months > 0) { const from = addMonths(p.from, -months); return { from, to: endOfMonth(addMonths(p.from, -1)) } }
  const days = periodDays(p)
  return { from: addDays(p.from, -days), to: addDays(p.from, -1) }
}

/** % change; null when there is nothing to compare with. */
export function delta(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null
  if (Math.abs(prev) < 0.005) return null
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10
}

// ---- time buckets -------------------------------------------------------------------------------------

export type Unit = 'day' | 'week' | 'month'
export interface Bucket { key: string; from: ISODate; to: ISODate }
export interface Point extends Bucket { value: number }

/** Day buckets up to `dayUpTo` days, week buckets up to `weekUpTo`, months beyond. */
export function chooseUnit(p: Period, { dayUpTo = 62, weekUpTo = 0 }: { dayUpTo?: number; weekUpTo?: number } = {}): Unit {
  const days = periodDays(p)
  if (days <= dayUpTo) return 'day'
  if (days <= weekUpTo) return 'week'
  return 'month'
}

export function bucketKey(date: ISODate, unit: Unit, weekStart = 6): string {
  return unit === 'day' ? date : unit === 'week' ? startOfWeek(date, weekStart) : date.slice(0, 7)
}

/** Consecutive buckets covering the period; the first and last are clipped to it. */
export function buckets(p: Period, unit: Unit, weekStart = 6): Bucket[] {
  const out: Bucket[] = []
  const clip = (from: ISODate, to: ISODate): Bucket => ({ key: '', from: from < p.from ? p.from : from, to: to > p.to ? p.to : to })
  if (unit === 'day') {
    for (let d = p.from; d <= p.to && out.length < 4000; d = addDays(d, 1)) out.push({ key: d, from: d, to: d })
  } else if (unit === 'week') {
    for (let s = startOfWeek(p.from, weekStart); s <= p.to && out.length < 600; s = addDays(s, 7)) out.push({ ...clip(s, addDays(s, 6)), key: s })
  } else {
    for (let s = startOfMonth(p.from); s <= p.to && out.length < 240; s = addMonths(s, 1)) out.push({ ...clip(s, endOfMonth(s)), key: s.slice(0, 7) })
  }
  return out
}

/** Sums valueOf(x) into the buckets of the period (zero-filled). Items outside the period are ignored. */
export function seriesBy<T>(items: T[], dateOfItem: (x: T) => ISODate | undefined, valueOf: (x: T) => number, p: Period, unit: Unit, weekStart = 6): Point[] {
  const bs = buckets(p, unit, weekStart)
  const index = new Map(bs.map((b, i) => [b.key, i]))
  const values = bs.map(() => 0)
  for (const x of items) {
    const d = dateOfItem(x)
    if (!inRange(d, p)) continue
    const i = index.get(bucketKey(d!, unit, weekStart))
    if (i !== undefined) values[i] += Number(valueOf(x)) || 0
  }
  return bs.map((b, i) => ({ ...b, value: round2(values[i]) }))
}

// ---- money --------------------------------------------------------------------------------------------

type PayLike = Pick<Payment, 'amount' | 'date'>
type InvLike = Pick<Invoice, 'id' | 'patientId' | 'date' | 'status' | 'total' | 'paid'> & Partial<Pick<Invoice, 'doctorId' | 'items' | 'subtotal' | 'discount' | 'dueDate'>>

export const isBillable = (inv: Pick<Invoice, 'status'>) => inv.status !== 'draft' && inv.status !== 'cancelled'
/** Collected money (refunds are negative payments and reduce it). */
export const totalOf = (payments: Pick<Payment, 'amount'>[]) => round2(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0))

export function revenueByDay(payments: PayLike[], from: ISODate, to: ISODate): Point[] {
  return seriesBy(payments, p => p.date, p => p.amount, { from, to }, 'day')
}
export function revenueByMonth(payments: PayLike[], from: ISODate, to: ISODate): Point[] {
  return seriesBy(payments, p => p.date, p => p.amount, { from, to }, 'month')
}

export interface MethodSlice { method: PaymentMethod; value: number; count: number }
/** Collected money per payment method, in the fixed method order (so colours follow the method). */
export function byMethod(payments: Pick<Payment, 'amount' | 'method'>[]): MethodSlice[] {
  const m = new Map<PaymentMethod, MethodSlice>()
  for (const p of payments) {
    const method = PAYMENT_METHODS.includes(p.method) ? p.method : 'other'
    const s = m.get(method) ?? { method, value: 0, count: 0 }
    s.value += Number(p.amount) || 0; s.count++
    m.set(method, s)
  }
  return PAYMENT_METHODS.filter(k => m.has(k)).map(k => { const s = m.get(k)!; return { ...s, value: round2(s.value) } })
}

/** invoiceId → doctorId, for attributing payments to the doctor of the invoice they settle. */
export function invoiceDoctors(invoices: Pick<Invoice, 'id' | 'doctorId'>[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const i of invoices) if (i.doctorId) m.set(i.id, i.doctorId)
  return m
}
/** The doctor a payment counts for ('' = unattributed: on-account money or an invoice without a doctor). */
export const paymentDoctor = (p: Pick<Payment, 'invoiceId'>, docs: Map<string, string>) => (p.invoiceId ? docs.get(p.invoiceId) ?? '' : '')

export interface DoctorRevenue { doctorId: string; name: string; color?: string; invoiced: number; invoices: number; collected: number }
/**
 * Revenue per doctor. `invoices` is every invoice the payments may refer to (for attribution); the invoiced
 * figures count only invoices dated inside `period` when one is given. Collected money follows the invoice's doctor.
 */
export function byDoctor(invoices: InvLike[], payments: Pick<Payment, 'amount' | 'invoiceId'>[], users: (Pick<User, 'id' | 'name'> & Partial<Pick<User, 'color'>>)[], period?: Period): DoctorRevenue[] {
  const rows = new Map<string, DoctorRevenue>()
  const row = (id: string) => {
    let r = rows.get(id)
    if (!r) { const u = users.find(x => x.id === id); r = { doctorId: id, name: u?.name ?? '', color: u?.color, invoiced: 0, invoices: 0, collected: 0 }; rows.set(id, r) }
    return r
  }
  for (const inv of invoices) {
    if (!isBillable(inv) || (period && !inRange(inv.date, period))) continue
    const r = row(inv.doctorId ?? ''); r.invoiced += inv.total || 0; r.invoices++
  }
  const docs = invoiceDoctors(invoices)
  for (const p of payments) row(paymentDoctor(p, docs)).collected += Number(p.amount) || 0
  return [...rows.values()]
    .map(r => ({ ...r, invoiced: round2(r.invoiced), collected: round2(r.collected) }))
    .filter(r => Math.abs(r.collected) > 0.004 || r.invoices > 0)
    .sort((a, b) => b.collected - a.collected || b.invoiced - a.invoiced)
}

export interface CategoryValue { category: ProcedureCategory; value: number; count: number }
/**
 * Invoiced value per procedure category, from the invoice lines (net of the invoice-level discount, before tax).
 * A line finds its procedure through procedureId, or through the treatment it bills; anything else is "other".
 */
export function byCategory(invoices: InvLike[], procedures: Pick<Procedure, 'id' | 'category'>[], treatments: Pick<TreatmentItem, 'id' | 'procedureId'>[] = []): CategoryValue[] {
  const cat = new Map(procedures.map(p => [p.id, p.category]))
  const trProc = new Map(treatments.filter(t => t.procedureId).map(t => [t.id, t.procedureId!]))
  const acc = new Map<ProcedureCategory, { value: number; count: number }>()
  for (const inv of invoices) {
    if (!isBillable(inv) || !inv.items?.length) continue
    const sub = inv.subtotal ?? inv.items.reduce((a, i) => a + (i.total || 0), 0)
    const factor = sub > 0 ? Math.max(0, sub - (inv.discount || 0)) / sub : 1
    for (const it of inv.items) {
      const procId = it.procedureId ?? (it.treatmentItemId ? trProc.get(it.treatmentItemId) : undefined)
      const c = (procId && cat.get(procId)) || 'other'
      const a = acc.get(c) ?? { value: 0, count: 0 }
      a.value += (it.total || 0) * factor; a.count += it.qty || 1
      acc.set(c, a)
    }
  }
  return PROCEDURE_CATEGORIES.filter(c => (acc.get(c)?.value ?? 0) > 0.004)
    .map(c => ({ category: c, value: round2(acc.get(c)!.value), count: acc.get(c)!.count }))
    .sort((a, b) => b.value - a.value)
}

/** Average of the issued (non-draft, non-cancelled) invoices. */
export function avgInvoice(invoices: Pick<Invoice, 'status' | 'total'>[]): number {
  const list = invoices.filter(isBillable)
  return list.length ? round2(list.reduce((a, i) => a + (i.total || 0), 0) / list.length) : 0
}
export const invoicedTotal = (invoices: Pick<Invoice, 'status' | 'total'>[]) => round2(invoices.filter(isBillable).reduce((a, i) => a + (i.total || 0), 0))

export interface ExpenseSlice { category: ExpenseCategory; value: number; count: number }
export function expensesByCategory(expenses: Pick<Expense, 'category' | 'amount'>[]): ExpenseSlice[] {
  const acc = new Map<ExpenseCategory, ExpenseSlice>()
  for (const e of expenses) {
    const c = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'other'
    const s = acc.get(c) ?? { category: c, value: 0, count: 0 }
    s.value += Number(e.amount) || 0; s.count++
    acc.set(c, s)
  }
  return [...acc.values()].map(s => ({ ...s, value: round2(s.value) })).filter(s => s.value > 0.004).sort((a, b) => b.value - a.value)
}

export interface Profit { revenue: number; expenses: number; profit: number; margin: number | null }
export function profit(revenue: number, expenses: number): Profit {
  const p = round2(revenue - expenses)
  return { revenue: round2(revenue), expenses: round2(expenses), profit: p, margin: revenue > 0.004 ? Math.round((p / revenue) * 1000) / 10 : null }
}

export interface OutstandingRow { patientId: string; invoiced: number; paid: number; due: number; lastPayment?: ISODate; invoices: number }
/**
 * What every patient still owes: Σ issued invoices − Σ all their payments (on-account money included),
 * keeping only real debts, largest first. Patients with credit never offset anyone else.
 */
export function outstandingByPatient(invoices: InvLike[], payments: Pick<Payment, 'patientId' | 'amount' | 'date'>[], patients?: Pick<Patient, 'id'>[]): OutstandingRow[] {
  const rows = new Map<string, OutstandingRow>()
  const row = (id: string) => { let r = rows.get(id); if (!r) { r = { patientId: id, invoiced: 0, paid: 0, due: 0, invoices: 0 }; rows.set(id, r) } return r }
  for (const inv of invoices) { if (!isBillable(inv)) continue; const r = row(inv.patientId); r.invoiced += inv.total || 0; r.invoices++ }
  for (const p of payments) {
    const r = row(p.patientId); r.paid += Number(p.amount) || 0
    if ((p.amount || 0) > 0 && (!r.lastPayment || p.date > r.lastPayment)) r.lastPayment = p.date
  }
  const known = patients ? new Set(patients.map(p => p.id)) : null
  return [...rows.values()]
    .map(r => ({ ...r, invoiced: round2(r.invoiced), paid: round2(r.paid), due: round2(r.invoiced - r.paid) }))
    .filter(r => r.due > 0.004 && (!known || known.has(r.patientId)))
    .sort((a, b) => b.due - a.due)
}
/** Σ of what patients owe (credits ignored). */
export function outstandingTotal(invoices: InvLike[], payments: Pick<Payment, 'patientId' | 'amount' | 'date'>[]): { total: number; patients: number } {
  const rows = outstandingByPatient(invoices, payments)
  return { total: round2(rows.reduce((a, r) => a + r.due, 0)), patients: rows.length }
}

export interface Spender { patientId: string; paid: number; payments: number }
/** Patients who paid the most in the given payments. */
export function topSpenders(payments: Pick<Payment, 'patientId' | 'amount'>[], limit = 10): Spender[] {
  const m = new Map<string, Spender>()
  for (const p of payments) { const s = m.get(p.patientId) ?? { patientId: p.patientId, paid: 0, payments: 0 }; s.paid += Number(p.amount) || 0; s.payments++; m.set(p.patientId, s) }
  return [...m.values()].map(s => ({ ...s, paid: round2(s.paid) })).filter(s => s.paid > 0.004).sort((a, b) => b.paid - a.paid).slice(0, limit)
}

// ---- patients -----------------------------------------------------------------------------------------

type PatLike = Pick<Patient, 'id' | 'createdAt'> & Partial<Pick<Patient, 'gender' | 'birthDate' | 'referredBy' | 'archived' | 'doctorId'>>

/** New files per bucket (by the day the file was opened). */
export function newPatientsSeries(patients: Pick<Patient, 'createdAt'>[], p: Period, unit: Unit): Point[] {
  return seriesBy(patients, x => (x.createdAt ? dateOf(x.createdAt) : undefined), () => 1, p, unit)
}
export function newPatientsByMonth(patients: Pick<Patient, 'createdAt'>[], from: ISODate, to: ISODate): Point[] {
  return newPatientsSeries(patients, { from, to }, 'month')
}

export const AGE_BANDS = [
  { id: '0-17', min: 0, max: 17 }, { id: '18-29', min: 18, max: 29 }, { id: '30-44', min: 30, max: 44 },
  { id: '45-59', min: 45, max: 59 }, { id: '60+', min: 60, max: Infinity },
] as const
export type AgeBandId = typeof AGE_BANDS[number]['id']
/** Patients per age band at `at`; patients without a (valid) birth date are counted apart. */
export function ageBands(patients: Pick<Patient, 'birthDate'>[], at: Date = new Date()): { bands: { id: AgeBandId; count: number }[]; unknown: number } {
  const counts = AGE_BANDS.map(() => 0)
  let unknown = 0
  for (const p of patients) {
    const age = ageFrom(p.birthDate, at)
    if (age === null) { unknown++; continue }
    const i = AGE_BANDS.findIndex(b => age >= b.min && age <= b.max)
    if (i >= 0) counts[i]++; else unknown++
  }
  return { bands: AGE_BANDS.map((b, i) => ({ id: b.id, count: counts[i] })), unknown }
}

export function genderSplit(patients: Pick<Patient, 'gender'>[]): { male: number; female: number } {
  let male = 0, female = 0
  for (const p of patients) { if (p.gender === 'male') male++; else if (p.gender === 'female') female++ }
  return { male, female }
}

export interface ReferralRow { source: string; count: number }
/** Referral sources, case/diacritics-insensitive, most common first; `none` = files without a source. */
export function referralSources(patients: Pick<Patient, 'referredBy'>[], limit = 8): { rows: ReferralRow[]; none: number } {
  const m = new Map<string, ReferralRow>()
  let none = 0
  for (const p of patients) {
    const raw = (p.referredBy || '').trim().replace(/\s+/g, ' ')
    if (!raw) { none++; continue }
    const k = normalizeText(raw)
    const r = m.get(k) ?? { source: raw, count: 0 }
    r.count++; m.set(k, r)
  }
  return { rows: [...m.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)).slice(0, limit), none }
}

/** Patients registered in the period, or with a visit in it (the population the patients tab describes). */
export function patientsInScope<P extends PatLike>(patients: P[], apts: Pick<Appointment, 'patientId' | 'status'>[], p: Period): P[] {
  const visited = new Set(apts.filter(a => VISIT_STATUSES.includes(a.status)).map(a => a.patientId))
  return patients.filter(x => visited.has(x.id) || inRange(x.createdAt ? dateOf(x.createdAt) : undefined, p))
}

// ---- appointments -------------------------------------------------------------------------------------

type AptLike = Pick<Appointment, 'id' | 'patientId' | 'doctorId' | 'date' | 'start' | 'status'> & Partial<Pick<Appointment, 'end' | 'durationMin'>>
/** Statuses that mean the patient came in. */
export const VISIT_STATUSES: AppointmentStatus[] = ['arrived', 'in_progress', 'completed']

export const aptMinutes = (a: Partial<Pick<Appointment, 'start' | 'end' | 'durationMin'>>) => {
  if (a.durationMin && a.durationMin > 0) return a.durationMin
  if (a.start && a.end) { const m = Math.round((new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000); return m > 0 ? m : 0 }
  return 0
}

export function statusCounts(apts: Pick<Appointment, 'status'>[]): Record<AppointmentStatus, number> {
  const c = Object.fromEntries(APPOINTMENT_STATUSES.map(s => [s, 0])) as Record<AppointmentStatus, number>
  for (const a of apts) if (a.status in c) c[a.status]++
  return c
}

export interface AptStats {
  total: number; booked: number; completed: number; cancelled: number; noShow: number
  byStatus: Record<AppointmentStatus, number>
  bookedMinutes: number
  noShowRate: number          // % of booked (non-cancelled) appointments the patient missed
  completionRate: number      // % of booked appointments completed
  utilisation: number | null  // % of working minutes that were booked; null without working minutes
}
/** Booked = everything except cancelled. Utilisation = booked minutes ÷ working minutes. */
export function appointmentStats(apts: AptLike[], workingMinutes?: number): AptStats {
  const byStatus = statusCounts(apts)
  const total = apts.length
  const cancelled = byStatus.cancelled, noShow = byStatus.no_show, completed = byStatus.completed
  const booked = total - cancelled
  const bookedMinutes = apts.filter(a => a.status !== 'cancelled').reduce((s, a) => s + aptMinutes(a), 0)
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
  return {
    total, booked, completed, cancelled, noShow, byStatus, bookedMinutes,
    noShowRate: pct(noShow, booked), completionRate: pct(completed, booked),
    utilisation: workingMinutes && workingMinutes > 0 ? pct(bookedMinutes, workingMinutes) : null,
  }
}

/** Minutes the clinic is open in the period (per chair / doctor): working days × (workEnd − workStart). */
export function workingMinutes(p: Period, clinic: { workingDays: number[]; workStart: string; workEnd: string }): number {
  const perDay = Math.max(0, timeToMinutes(clinic.workEnd) - timeToMinutes(clinic.workStart))
  if (!perDay || !clinic.workingDays?.length) return 0
  let days = 0
  for (let d = p.from, i = 0; d <= p.to && i < 4000; d = addDays(d, 1), i++) if (clinic.workingDays.includes(fromISODate(d).getDay())) days++
  return days * perDay
}

export interface DoctorAptRow { doctorId: string; name: string; color?: string; booked: number; completed: number; noShows: number; cancelled: number; minutes: number; utilisation: number | null }
/** One row per doctor who had appointments (plus the listed doctors with none), busiest first. */
export function appointmentsByDoctor(apts: AptLike[], doctors: (Pick<User, 'id' | 'name'> & Partial<Pick<User, 'color'>>)[], workMinutes: number): DoctorAptRow[] {
  const ids = new Set<string>([...doctors.map(d => d.id), ...apts.map(a => a.doctorId)])
  const rows: DoctorAptRow[] = []
  for (const id of ids) {
    const mine = apts.filter(a => a.doctorId === id)
    const s = appointmentStats(mine, workMinutes)
    const u = doctors.find(d => d.id === id)
    rows.push({ doctorId: id, name: u?.name ?? '', color: u?.color, booked: s.booked, completed: s.completed, noShows: s.noShow, cancelled: s.cancelled, minutes: s.bookedMinutes, utilisation: s.utilisation })
  }
  return rows.sort((a, b) => b.booked - a.booked || b.completed - a.completed || a.name.localeCompare(b.name))
}

/** Booked (non-cancelled) appointments per bucket. */
export function appointmentsSeries(apts: AptLike[], p: Period, unit: Unit): Point[] {
  return seriesBy(apts.filter(a => a.status !== 'cancelled'), a => a.date, () => 1, p, unit)
}

/** Patients who came in (arrived / in progress / completed), counted once. */
export function patientsSeen(apts: Pick<Appointment, 'patientId' | 'status'>[]): number {
  return new Set(apts.filter(a => VISIT_STATUSES.includes(a.status)).map(a => a.patientId)).size
}

// ---- treatments ---------------------------------------------------------------------------------------

type TrLike = Pick<TreatmentItem, 'id' | 'procedureName' | 'price' | 'discount' | 'status' | 'createdAt'> & Partial<Pick<TreatmentItem, 'procedureId' | 'completedAt' | 'doctorId'>>
export const treatmentValue = (t: Pick<TreatmentItem, 'price' | 'discount'>) => round2(Math.max(0, (t.price || 0) - (t.discount || 0)))

export interface ProcedureRank { key: string; procedureId?: string; name: string; count: number; value: number }
/** Completed treatments grouped by procedure (or by name for free-text work), ranked by count or by value. */
export function topProcedures(treatments: TrLike[], { by = 'count', limit = 8 }: { by?: 'count' | 'value'; limit?: number } = {}): ProcedureRank[] {
  const m = new Map<string, ProcedureRank>()
  for (const t of treatments) {
    if (t.status !== 'completed') continue
    const key = t.procedureId || `name:${normalizeText(t.procedureName)}`
    const r = m.get(key) ?? { key, procedureId: t.procedureId, name: t.procedureName, count: 0, value: 0 }
    r.count++; r.value += treatmentValue(t)
    m.set(key, r)
  }
  const list = [...m.values()].map(r => ({ ...r, value: round2(r.value) }))
  list.sort(by === 'value' ? (a, b) => b.value - a.value || b.count - a.count : (a, b) => b.count - a.count || b.value - a.value)
  return list.slice(0, limit)
}

export interface PlanPoint extends Bucket { planned: number; completed: number }
/** Work added to treatment plans (by creation) vs work completed (by completion), per bucket. */
export function treatmentsOverTime(treatments: TrLike[], p: Period, unit: Unit): PlanPoint[] {
  const planned = seriesBy(treatments.filter(t => t.status !== 'cancelled'), t => (t.createdAt ? dateOf(t.createdAt) : undefined), () => 1, p, unit)
  const done = seriesBy(treatments.filter(t => t.status === 'completed'), t => (t.completedAt ? dateOf(t.completedAt) : undefined), () => 1, p, unit)
  return planned.map((b, i) => ({ key: b.key, from: b.from, to: b.to, planned: b.value, completed: done[i].value }))
}

// ---- dashboard ----------------------------------------------------------------------------------------

export const OVERDUE_AFTER_DAYS = 30
/** Unpaid / partly paid invoices past their due date (or older than 30 days without one): how many and how much. */
export function overdueInvoices(invoices: InvLike[], today: ISODate, graceDays = OVERDUE_AFTER_DAYS): { count: number; total: number } {
  let count = 0, total = 0
  for (const inv of invoices) {
    if (inv.status !== 'unpaid' && inv.status !== 'partial') continue
    const due = round2((inv.total || 0) - (inv.paid || 0))
    if (due <= 0.004) continue
    const late = inv.dueDate ? inv.dueDate < today : diffDays(inv.date, today) > graceDays
    if (late) { count++; total += due }
  }
  return { count, total: round2(total) }
}
export function lowStock<I extends Pick<InventoryItem, 'quantity' | 'minQuantity' | 'active'>>(items: I[]): I[] {
  return items.filter(i => i.active !== false && (i.quantity ?? 0) <= (i.minQuantity ?? 0))
}
/** Lab work still out (sent / in progress) that is due today or late. */
export function labDue(orders: Pick<LabOrder, 'status' | 'dueDate'>[], today: ISODate): { late: number; today: number } {
  let late = 0, due = 0
  for (const o of orders) {
    if ((o.status !== 'sent' && o.status !== 'in_progress') || !o.dueDate || o.dueDate > today) continue
    if (o.dueDate < today) late++; else due++
  }
  return { late, today: due }
}
export function unconfirmedTomorrow<A extends Pick<Appointment, 'date' | 'status'>>(apts: A[], today: ISODate): A[] {
  const tomorrow = addDays(today, 1)
  return apts.filter(a => a.date === tomorrow && a.status === 'scheduled')
}

/** The quick status steps offered on the dashboard for an appointment, most likely first. */
export function nextStatuses(s: AppointmentStatus): AppointmentStatus[] {
  switch (s) {
    case 'scheduled': return ['confirmed', 'arrived']
    case 'confirmed': return ['arrived']
    case 'arrived': return ['in_progress']
    case 'in_progress': return ['completed']
    default: return []
  }
}

/** Where the "now" line goes in a time-ordered list: the index of the first appointment starting after now (or -1 when the day is over / not started). */
export function nowIndex(apts: Pick<Appointment, 'start'>[], nowISO: string): number {
  if (!apts.length) return -1
  const i = apts.findIndex(a => a.start > nowISO)
  return i === -1 ? apts.length : i
}

/** i18n key of the greeting for an hour of the day (Arabic says مساء الخير for both afternoon and evening). */
export const greetingKey = (hour: number) => (hour >= 4 && hour < 12 ? 'goodMorning' : hour >= 12 && hour < 17 ? 'dashboard.goodAfternoon' : 'goodEvening')

/** Keeps the first `max − 1` slices and folds the rest into one "other" slice. */
export function foldOther<T extends { value: number }>(list: T[], max: number, makeOther: (value: number, folded: T[]) => T): T[] {
  if (list.length <= max) return list
  const keep = list.slice(0, max - 1), rest = list.slice(max - 1)
  return [...keep, makeOther(round2(rest.reduce((a, x) => a + x.value, 0)), rest)]
}

// ---- CSV ----------------------------------------------------------------------------------------------

/** One CSV cell: quoted when needed; text that a spreadsheet would run as a formula is neutralised. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** Rows → CSV text (CRLF line ends, as spreadsheets expect). */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n')
}
