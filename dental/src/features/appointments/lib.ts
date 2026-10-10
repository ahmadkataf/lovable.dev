// Pure logic of the appointments module: intervals, the day-grid layout, slots, ranges and status flow.
// No React and no database here, so every rule is covered by tests/appointments.test.ts.
import type { Appointment, AppointmentStatus, ISODate, Patient } from '@/db/types'
import { addDays, addMonths, fromISODate, minutesToTime, startOfMonth, startOfWeek, endOfMonth, timeToMinutes, toISODate, combine } from '@/lib/dates'
import { normalizeText } from '@/lib/format'

export type CalView = 'day' | 'week' | 'month' | 'list'
export const CAL_VIEWS: CalView[] = ['day', 'week', 'month', 'list']
/** The week starts on Saturday (Levant). */
export const WEEK_START = 6
/** The agenda shows this many days from the selected date. */
export const LIST_DAYS = 14
export const DURATIONS = [15, 20, 30, 45, 60, 90, 120]
const MIN = 60_000

/** Anything with a start and an end instant (ISO strings). */
export interface Span { start: string; end: string }

const ms = (iso: string) => new Date(iso).getTime()

/** Half-open intervals [start, end): touching edges (10:00–10:30 and 10:30–11:00) do not overlap. */
export function overlaps(a: Span, b: Span): boolean {
  return ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end)
}

/** Cancelled and no-show appointments free their time. */
export function blocksTime(status: AppointmentStatus): boolean {
  return status !== 'cancelled' && status !== 'no_show'
}

/** Appointments of the same doctor that collide with `candidate` (the candidate itself is skipped when editing). */
export function findConflicts<T extends Span & Pick<Appointment, 'id' | 'doctorId' | 'status'>>(
  candidate: Span & { id?: string; doctorId: string }, others: T[],
): T[] {
  return others
    .filter(o => o.id !== candidate.id && o.doctorId === candidate.doctorId && blocksTime(o.status) && overlaps(candidate, o))
    .sort((a, b) => ms(a.start) - ms(b.start))
}

/** start + minutes, as an ISO instant. */
export function endFrom(startISO: string, minutes: number): string {
  return new Date(ms(startISO) + minutes * MIN).toISOString()
}
/** Whole minutes between two instants. */
export function durationOf(a: Span): number {
  return Math.max(0, Math.round((ms(a.end) - ms(a.start)) / MIN))
}
/** Minutes since local midnight of an instant. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

// ---- slots ---------------------------------------------------------------------------------------
/** 'HH:MM' slots from `start` (inclusive) to `end` (exclusive), every `step` minutes. */
export function generateSlots(start: string, end: string, step: number): string[] {
  const s = timeToMinutes(start), e = timeToMinutes(end), st = Math.max(5, Math.round(step) || 30)
  const out: string[] = []
  for (let m = s; m < e && out.length < 288; m += st) out.push(minutesToTime(m))
  return out
}
/** Rounds minutes down to the slot grid (a click at 09:47 on a 15-minute grid → 09:45). */
export function snapMinutes(minutes: number, step: number): number {
  const st = Math.max(1, step)
  return Math.floor(minutes / st) * st
}
/** Rounds minutes up to the slot grid. */
export function ceilMinutes(minutes: number, step: number): number {
  const st = Math.max(1, step)
  return Math.ceil(minutes / st) * st
}

export interface WorkHours { workStart: string; workEnd: string; slotMinutes: number }

/**
 * The first start time ('HH:MM') on `date`, at or after `from`, where `durationMin` fits inside working hours
 * without touching any busy span. `busy` should already be limited to one doctor and to time-blocking statuses.
 */
export function nextFreeSlot(busy: Span[], date: ISODate, durationMin: number, hours: WorkHours, from?: string): string | null {
  const step = Math.max(5, hours.slotMinutes || 30)
  const ws = timeToMinutes(hours.workStart), we = timeToMinutes(hours.workEnd)
  let m = ws
  if (from) m = Math.max(ws, ceilMinutes(timeToMinutes(from) - ws, step) + ws)
  for (; m + durationMin <= we; m += step) {
    const start = combine(date, minutesToTime(m))
    const span = { start, end: endFrom(start, durationMin) }
    if (!busy.some(b => overlaps(span, b))) return minutesToTime(m)
  }
  return null
}

/** Is any time-blocking appointment running during the slot [time, time + step)? */
export function slotIsBusy(items: (Span & { status: AppointmentStatus })[], date: ISODate, time: string, step: number): boolean {
  const start = combine(date, time)
  const span = { start, end: endFrom(start, step) }
  return items.some(a => blocksTime(a.status) && overlaps(span, a))
}

// ---- day grid ------------------------------------------------------------------------------------
export interface Placed<T> { item: T; col: number; cols: number }

/**
 * Lays out the events of one column (one doctor, one day): events that overlap — directly or through a chain —
 * form a cluster and share its width; each event takes the first sub-column that is free at its start.
 */
export function layoutColumns<T extends Span>(items: T[]): Placed<T>[] {
  const evs = items
    .map(item => { const s = ms(item.start); return { item, s, e: Math.max(ms(item.end), s + MIN) } })
    .sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s))
  const out: Placed<T>[] = []
  let cluster: { item: T; col: number }[] = []
  let colEnds: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    const cols = Math.max(1, colEnds.length)
    for (const c of cluster) out.push({ item: c.item, col: c.col, cols })
    cluster = []; colEnds = []; clusterEnd = -Infinity
  }
  for (const ev of evs) {
    if (cluster.length && ev.s >= clusterEnd) flush()
    let col = colEnds.findIndex(end => end <= ev.s)
    if (col === -1) { col = colEnds.length; colEnds.push(ev.e) } else colEnds[col] = ev.e
    cluster.push({ item: ev.item, col })
    clusterEnd = Math.max(clusterEnd, ev.e)
  }
  flush()
  return out
}

/** Grid bounds in minutes: the working hours, widened (to whole hours) to show any appointment outside them. */
export function gridBounds(workStart: string, workEnd: string, items: Span[]): { startMin: number; endMin: number } {
  let s = timeToMinutes(workStart), e = timeToMinutes(workEnd)
  if (e <= s) e = s + 60
  for (const a of items) {
    const as = minutesOfDay(a.start)
    const ae = as + Math.max(durationOf(a), 1)
    if (as < s) s = as
    if (ae > e) e = ae
  }
  return { startMin: Math.max(0, Math.floor(s / 60) * 60), endMin: Math.min(24 * 60, Math.ceil(e / 60) * 60) }
}

/** Vertical scale of the time grid: pixels per minute for a slot length (a 30-minute slot is 52px tall). */
export function pxPerMinute(step: number): number {
  const px: Record<number, number> = { 5: 14, 10: 22, 15: 30, 20: 36, 30: 52, 60: 76 }
  const st = step || 30
  return (px[st] ?? 52) / st
}

// ---- ranges --------------------------------------------------------------------------------------
/** The dates a view shows (inclusive). The month view covers whole weeks so the leading/trailing days get chips too. */
export function viewRange(view: CalView, date: ISODate): { from: ISODate; to: ISODate } {
  if (view === 'day') return { from: date, to: date }
  if (view === 'week') { const from = startOfWeek(date, WEEK_START); return { from, to: addDays(from, 6) } }
  if (view === 'month') {
    const from = startOfWeek(startOfMonth(date), WEEK_START)
    const last = endOfMonth(date)
    const to = addDays(startOfWeek(last, WEEK_START), 6)
    return { from, to }
  }
  return { from: date, to: addDays(date, LIST_DAYS - 1) }
}
/** The date after pressing "previous" (-1) or "next" (+1) in a view. */
export function shiftDate(view: CalView, date: ISODate, dir: 1 | -1): ISODate {
  if (view === 'day') return addDays(date, dir)
  if (view === 'week') return addDays(date, 7 * dir)
  if (view === 'month') return addMonths(startOfMonth(date), dir)
  return addDays(date, LIST_DAYS * dir)
}
/** The month view as rows of 7 dates, Saturday first. */
export function monthGrid(date: ISODate): ISODate[][] {
  const { from, to } = viewRange('month', date)
  const weeks: ISODate[][] = []
  for (let d = from; d <= to && weeks.length < 6; ) {
    const row: ISODate[] = []
    for (let i = 0; i < 7; i++) { row.push(d); d = addDays(d, 1) }
    weeks.push(row)
  }
  return weeks
}
export function weekDates(date: ISODate): ISODate[] {
  const from = startOfWeek(date, WEEK_START)
  return Array.from({ length: 7 }, (_, i) => addDays(from, i))
}
export function weekdayOf(date: ISODate): number { return fromISODate(date).getDay() }
export function isWorkingDay(date: ISODate, workingDays: number[]): boolean {
  return workingDays.includes(weekdayOf(date))
}
/** Does [time, time + duration) sit inside working hours? */
export function withinHours(time: string, durationMin: number, workStart: string, workEnd: string): boolean {
  const s = timeToMinutes(time)
  return s >= timeToMinutes(workStart) && s + durationMin <= timeToMinutes(workEnd)
}
export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
}
export function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  return toISODate(fromISODate(d)) === d
}

// ---- grouping & filters --------------------------------------------------------------------------
export function sortByStart<T extends Pick<Appointment, 'start'>>(items: T[]): T[] {
  return [...items].sort((a, b) => ms(a.start) - ms(b.start))
}
/** Items grouped by their `date`, days ascending and times ascending inside each day. */
export function groupByDate<T extends Pick<Appointment, 'date' | 'start'>>(items: T[]): { date: ISODate; items: T[] }[] {
  const map = new Map<ISODate, T[]>()
  for (const a of sortByStart(items)) { const l = map.get(a.date); if (l) l.push(a); else map.set(a.date, [a]) }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, list]) => ({ date, items: list }))
}
export function countByDate<T extends Pick<Appointment, 'date'>>(items: T[]): Map<ISODate, number> {
  const m = new Map<ISODate, number>()
  for (const a of items) m.set(a.date, (m.get(a.date) ?? 0) + 1)
  return m
}

/** Status filter of the calendar: everything, only the live ones, or one status. */
export type StatusFilter = 'all' | 'active' | AppointmentStatus
export function matchesStatus(status: AppointmentStatus, f: StatusFilter): boolean {
  if (f === 'all') return true
  if (f === 'active') return blocksTime(status)
  return status === f
}
/** Doctor filter: an empty selection means every doctor. */
export function matchesDoctor(doctorId: string, selected: string[]): boolean {
  return selected.length === 0 || selected.includes(doctorId)
}

// ---- status flow ---------------------------------------------------------------------------------
/** The status buttons the details dialog offers for each status. */
export const STATUS_ACTIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'arrived', 'cancelled', 'no_show'],
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived: ['in_progress'],
  in_progress: ['completed'],
  completed: ['scheduled'],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
}
/** The one-tap "next step" of the working day (confirm → arrived → start → complete). */
export function nextStep(status: AppointmentStatus): AppointmentStatus | null {
  switch (status) {
    case 'scheduled': return 'confirmed'
    case 'confirmed': return 'arrived'
    case 'arrived': return 'in_progress'
    case 'in_progress': return 'completed'
    default: return null
  }
}
/** Patient.lastVisit after completing an appointment: the later of the two (completing an old visit never moves it back). */
export function nextLastVisit(current: string | undefined, visitStart: string): string {
  if (!current) return visitStart
  return ms(visitStart) > ms(current) ? visitStart : current
}

// ---- patient tab ---------------------------------------------------------------------------------
const CLOSED: AppointmentStatus[] = ['completed', 'cancelled', 'no_show']
/** Upcoming = a later day, or today and not closed yet. */
export function isUpcoming(a: Pick<Appointment, 'date' | 'status'>, todayISO: ISODate): boolean {
  if (a.date > todayISO) return true
  return a.date === todayISO && !CLOSED.includes(a.status)
}
export function patientSummary<T extends Pick<Appointment, 'date' | 'start' | 'status'>>(items: T[], todayISO: ISODate) {
  const upcoming = sortByStart(items.filter(a => isUpcoming(a, todayISO)))
  const past = sortByStart(items.filter(a => !isUpcoming(a, todayISO))).reverse()
  return {
    upcoming, past,
    total: items.length,
    visits: items.filter(a => a.status === 'completed').length,
    noShows: items.filter(a => a.status === 'no_show').length,
    cancelled: items.filter(a => a.status === 'cancelled').length,
    next: upcoming.find(a => blocksTime(a.status)),
  }
}

// ---- text ----------------------------------------------------------------------------------------
/** Arabic plural class (0, 1, 2, 3–10, 11+ and 101–102 back to "many"); English uses the same keys. */
export function pluralForm(n: number): 'zero' | 'one' | 'two' | 'few' | 'many' {
  const a = Math.abs(Math.trunc(n))
  if (a === 0) return 'zero'
  if (a === 1) return 'one'
  if (a === 2) return 'two'
  const r = a % 100
  if (r >= 3 && r <= 10) return 'few'
  return 'many'
}

// ---- patient picker ------------------------------------------------------------------------------
/**
 * Patients matching what the receptionist typed: name (Arabic-aware, ignores hamza/ta-marbuta variants),
 * file number, or phone digits. Best matches first; at most `max`.
 */
export function searchPatients<T extends Pick<Patient, 'name' | 'fileNo' | 'phone' | 'phone2'>>(list: T[], query: string, max = 8): T[] {
  const q = normalizeText(query)
  if (!q) return list.slice(0, max)
  const digits = q.replace(/\D/g, '')
  const onlyDigits = /^[\d\s+#-]+$/.test(q)
  const scored: { p: T; s: number }[] = []
  for (const p of list) {
    const name = normalizeText(p.name)
    let s = 0
    if (onlyDigits && digits) {
      if (String(p.fileNo) === digits) s = 100
      else if (digits.length >= 3 && [p.phone, p.phone2].some(ph => (ph || '').replace(/\D/g, '').includes(digits.replace(/^0+/, '') || digits))) s = 60
      else if (String(p.fileNo).startsWith(digits)) s = 40
    } else if (name.startsWith(q)) s = 90
    else if (name.split(/\s+/).some(w => w.startsWith(q))) s = 70
    else if (name.includes(q)) s = 50
    else {
      const words = q.split(/\s+/).filter(Boolean)
      if (words.length > 1 && words.every(w => name.includes(w))) s = 45
    }
    if (s) scored.push({ p, s })
  }
  return scored.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name)).slice(0, max).map(x => x.p)
}

/** Splits what was typed into the quick "new patient" fields: digits go to the phone, words to the name. */
export function quickPatientFromQuery(query: string): { name: string; phone: string } {
  const q = query.trim()
  if (/^[\d\s+()-]+$/.test(q) && q.replace(/\D/g, '').length >= 3) return { name: '', phone: q }
  return { name: q, phone: '' }
}
