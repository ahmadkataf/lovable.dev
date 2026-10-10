// Live alerts for the notifications panel. The pure functions below work on plain arrays (tests/search.test.ts);
// useAlerts() / useImportantIds() feed them from the database with useLiveQuery.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Appointment, AppointmentStatus, InventoryItem, Invoice, ISODate, LabOrder, Patient } from '@/db/types'
import { addDays, diffDays, fromISODate, toISODate } from '@/lib/dates'
import { round2 } from '@/lib/format'
import { useSession, type Permission } from '@/app/session'
import { collator } from './lib'

export const OVERDUE_AFTER_DAYS = 30     // an invoice without a due date is overdue this long after its date
export const EXPIRY_WINDOW_DAYS = 30
export const RECALL_MONTHS = 6
export const RECALL_LIMIT = 10
export const TODAY_LIMIT = 3

// ---- appointments -----------------------------------------------------------------------------------
type AptLike = Pick<Appointment, 'id' | 'patientId' | 'date' | 'start' | 'end' | 'status'>
const WAITING: AppointmentStatus[] = ['scheduled', 'confirmed']

/** Today's appointments still to be seen: arrived patients, and booked visits that have not ended yet. Sorted by time. */
export function remainingToday<A extends AptLike>(apts: A[], now: Date = new Date()): A[] {
  const day = toISODate(now)
  const iso = now.toISOString()
  return apts
    .filter(a => a.date === day && (a.status === 'arrived' || (WAITING.includes(a.status) && (a.end || a.start) > iso)))
    .sort((a, b) => a.start.localeCompare(b.start))
}
/** Tomorrow's appointments nobody has confirmed yet (status still "scheduled"). */
export function unconfirmedTomorrow<A extends AptLike>(apts: A[], today: ISODate): A[] {
  const tomorrow = addDays(today, 1)
  return apts.filter(a => a.date === tomorrow && a.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))
}

// ---- invoices ---------------------------------------------------------------------------------------
type InvLike = Pick<Invoice, 'id' | 'patientId' | 'date' | 'dueDate' | 'total' | 'paid' | 'status'>
export function invoiceDue(inv: Pick<Invoice, 'total' | 'paid'>): number {
  return round2(Math.max(0, (inv.total || 0) - (inv.paid || 0)))
}
/** Unpaid / partly paid, money still due, and past its due date — or older than `graceDays` when it has none. */
export function isOverdueInvoice(inv: InvLike, today: ISODate, graceDays = OVERDUE_AFTER_DAYS): boolean {
  if (inv.status !== 'unpaid' && inv.status !== 'partial') return false
  if (invoiceDue(inv) <= 0.004) return false
  if (inv.dueDate) return inv.dueDate < today
  return diffDays(inv.date, today) > graceDays
}
export interface OverdueInvoice<I extends InvLike = Invoice> {
  invoice: I
  due: number
  days: number                    // days since the due date, or since the invoice date when it has none
  basis: 'dueDate' | 'age'
}
/** Overdue invoices, most overdue first, with the total still due. */
export function overdueInvoices<I extends InvLike>(invoices: I[], today: ISODate, graceDays = OVERDUE_AFTER_DAYS): { list: OverdueInvoice<I>[]; totalDue: number } {
  const list: OverdueInvoice<I>[] = []
  for (const inv of invoices) {
    if (!isOverdueInvoice(inv, today, graceDays)) continue
    list.push(inv.dueDate
      ? { invoice: inv, due: invoiceDue(inv), days: diffDays(inv.dueDate, today), basis: 'dueDate' }
      : { invoice: inv, due: invoiceDue(inv), days: diffDays(inv.date, today), basis: 'age' })
  }
  list.sort((a, b) => b.days - a.days || b.due - a.due)
  return { list, totalDue: round2(list.reduce((s, x) => s + x.due, 0)) }
}

// ---- inventory --------------------------------------------------------------------------------------
type ItemLike = Pick<InventoryItem, 'id' | 'name' | 'quantity' | 'minQuantity' | 'active'> & Partial<Pick<InventoryItem, 'expiryDate' | 'unit'>>
/** At or below its minimum (out of stock included). Inactive items never alert. */
export function isLowStock(item: ItemLike): boolean {
  return item.active !== false && (item.quantity ?? 0) <= (item.minQuantity ?? 0)
}
/** Low-stock items: out of stock first, then the emptiest relative to the minimum. */
export function lowStockItems<I extends ItemLike>(items: I[]): I[] {
  const ratio = (i: I) => (i.minQuantity > 0 ? i.quantity / i.minQuantity : i.quantity)
  return items.filter(isLowStock).sort((a, b) => (a.quantity > 0 ? 1 : 0) - (b.quantity > 0 ? 1 : 0) || ratio(a) - ratio(b) || collator.compare(a.name, b.name))
}
export interface ExpiryAlert<I extends ItemLike = InventoryItem> { item: I; kind: 'expired' | 'expiring'; days: number }  // days left (negative = past)
/** In-stock items already expired, or expiring within `windowDays` (today counts as expiring, not expired). */
export function expiryState(item: ItemLike, today: ISODate, windowDays = EXPIRY_WINDOW_DAYS): Omit<ExpiryAlert, 'item'> | null {
  if (item.active === false || !item.expiryDate || (item.quantity ?? 0) <= 0) return null
  const days = diffDays(today, item.expiryDate)
  if (days < 0) return { kind: 'expired', days }
  if (days <= windowDays) return { kind: 'expiring', days }
  return null
}
export function expiringItems<I extends ItemLike>(items: I[], today: ISODate, windowDays = EXPIRY_WINDOW_DAYS): ExpiryAlert<I>[] {
  const out: ExpiryAlert<I>[] = []
  for (const item of items) { const s = expiryState(item, today, windowDays); if (s) out.push({ item, ...s }) }
  return out.sort((a, b) => a.days - b.days)
}

// ---- lab --------------------------------------------------------------------------------------------
type LabLike = Pick<LabOrder, 'id' | 'patientId' | 'status' | 'dueDate'>
export interface LabAlert<L extends LabLike = LabOrder> { order: L; kind: 'overdue' | 'today'; days: number }  // days late (0 = due today)
/** Lab work still out (sent / in progress) that is due today or late; most late first. */
export function labDue<L extends LabLike>(orders: L[], today: ISODate): LabAlert<L>[] {
  const out: LabAlert<L>[] = []
  for (const o of orders) {
    if ((o.status !== 'sent' && o.status !== 'in_progress') || !o.dueDate || o.dueDate > today) continue
    const days = diffDays(o.dueDate, today)
    out.push({ order: o, kind: days > 0 ? 'overdue' : 'today', days })
  }
  return out.sort((a, b) => b.days - a.days)
}

// ---- recall & birthdays -----------------------------------------------------------------------------
type PatLike = Pick<Patient, 'id' | 'name' | 'archived'> & Partial<Pick<Patient, 'birthDate' | 'gender'>>
/** The same day n months away, clamped to the month's last day (31 Aug − 6 months = 28/29 Feb, not 3 Mar). */
export function shiftMonths(d: ISODate, n: number): ISODate {
  const x = fromISODate(d)
  const first = new Date(x.getFullYear(), x.getMonth() + n, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  first.setDate(Math.min(x.getDate(), last))
  return toISODate(first)
}
/** Whole months from a to b (calendar months, day of month respected). */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const x = fromISODate(a), y = fromISODate(b)
  let m = (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth())
  if (y.getDate() < x.getDate()) m--
  return m
}
/** The date of each patient's latest completed appointment. */
export function lastCompletedByPatient(apts: Pick<Appointment, 'patientId' | 'date' | 'status'>[]): Map<string, ISODate> {
  const m = new Map<string, ISODate>()
  for (const a of apts) {
    if (a.status !== 'completed') continue
    const cur = m.get(a.patientId)
    if (!cur || a.date > cur) m.set(a.patientId, a.date)
  }
  return m
}
export interface RecallItem<P extends PatLike = Patient> { patient: P; lastVisit: ISODate; months: number }
/**
 * Patients due for a recall: their last completed appointment is more than `months` months ago and nothing is booked
 * from today on. Archived files are skipped. Most recently lapsed first (the likeliest to come back), capped at `limit`.
 */
export function recallPatients<P extends PatLike>(
  patients: P[], apts: Pick<Appointment, 'patientId' | 'date' | 'status'>[], today: ISODate,
  { months = RECALL_MONTHS, limit = RECALL_LIMIT }: { months?: number; limit?: number } = {},
): { list: RecallItem<P>[]; total: number } {
  const last = lastCompletedByPatient(apts)
  const booked = new Set(apts.filter(a => a.date >= today && a.status !== 'cancelled' && a.status !== 'no_show' && a.status !== 'completed').map(a => a.patientId))
  const cutoff = shiftMonths(today, -months)
  const all: RecallItem<P>[] = []
  for (const p of patients) {
    if (p.archived || booked.has(p.id)) continue
    const lv = last.get(p.id)
    if (!lv || lv >= cutoff) continue
    all.push({ patient: p, lastVisit: lv, months: monthsBetween(lv, today) })
  }
  all.sort((a, b) => (a.lastVisit === b.lastVisit ? collator.compare(a.patient.name, b.patient.name) : a.lastVisit < b.lastVisit ? 1 : -1))
  return { list: all.slice(0, limit), total: all.length }
}
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
/** Same month and day; 29 February birthdays are celebrated on 28 February in common years. */
export function isBirthday(birthDate: ISODate | undefined, today: ISODate): boolean {
  if (!birthDate || birthDate.length < 10) return false
  const md = birthDate.slice(5, 10), tmd = today.slice(5, 10)
  if (md === tmd) return true
  return md === '02-29' && tmd === '02-28' && !isLeap(Number(today.slice(0, 4)))
}
export interface BirthdayItem<P extends PatLike = Patient> { patient: P; age: number }
export function birthdaysToday<P extends PatLike>(patients: P[], today: ISODate): BirthdayItem<P>[] {
  return patients
    .filter(p => !p.archived && isBirthday(p.birthDate, today) && p.birthDate!.slice(0, 10) < today)
    .map(p => ({ patient: p, age: Number(today.slice(0, 4)) - Number(p.birthDate!.slice(0, 4)) }))
    .sort((a, b) => collator.compare(a.patient.name, b.patient.name))
}

// ---- the "important" set behind the red dot -----------------------------------------------------------
export interface ImportantInput {
  invoices?: InvLike[]
  items?: ItemLike[]
  labOrders?: LabLike[]
  appointments?: AptLike[]
}
/** Stable ids of what deserves the red dot: overdue invoices, low stock, late lab work, unconfirmed tomorrow. */
export function importantIds(input: ImportantInput, today: ISODate): string[] {
  const ids: string[] = []
  for (const x of overdueInvoices(input.invoices ?? [], today).list) ids.push(`inv:${x.invoice.id}`)
  for (const i of lowStockItems(input.items ?? [])) ids.push(`stock:${i.id}`)
  for (const l of labDue(input.labOrders ?? [], today)) if (l.kind === 'overdue') ids.push(`lab:${l.order.id}`)
  for (const a of unconfirmedTomorrow(input.appointments ?? [], today)) ids.push(`apt:${a.id}`)
  return ids
}
/** How many of the important ids have not been seen yet. */
export function unseenCount(ids: string[], seen: ReadonlySet<string>): number {
  let n = 0
  for (const id of ids) if (!seen.has(id)) n++
  return n
}

// ---- everything the panel shows ---------------------------------------------------------------------
export interface AlertInput {
  upcoming: Appointment[]          // date ≥ today
  completed: Pick<Appointment, 'patientId' | 'date' | 'status'>[]
  invoices: Invoice[]              // unpaid / partial
  items: InventoryItem[]
  labOrders: LabOrder[]            // sent / in progress
  patients: Patient[]
}
export interface Alerts {
  today: ISODate
  todayApts: Appointment[]
  unconfirmed: Appointment[]
  overdue: { list: OverdueInvoice<Invoice>[]; totalDue: number }
  lowStock: InventoryItem[]
  expiry: ExpiryAlert<InventoryItem>[]
  lab: LabAlert<LabOrder>[]
  recall: { list: RecallItem<Patient>[]; total: number }
  birthdays: BirthdayItem<Patient>[]
  important: string[]
  patients: Map<string, Patient>   // the patients the alerts mention
}
export function computeAlerts(input: AlertInput, now: Date = new Date()): Alerts {
  const today = toISODate(now)
  const todayApts = remainingToday(input.upcoming, now)
  const unconfirmed = unconfirmedTomorrow(input.upcoming, today)
  const overdue = overdueInvoices(input.invoices, today)
  const lowStock = lowStockItems(input.items)
  const expiry = expiringItems(input.items, today)
  const lab = labDue(input.labOrders, today)
  const recall = recallPatients(input.patients, [...input.completed, ...input.upcoming], today)
  const birthdays = birthdaysToday(input.patients, today)
  const want = new Set<string>([
    ...todayApts.map(a => a.patientId), ...unconfirmed.map(a => a.patientId), ...overdue.list.map(x => x.invoice.patientId), ...lab.map(x => x.order.patientId),
  ])
  const patients = new Map<string, Patient>()
  for (const p of input.patients) if (want.has(p.id)) patients.set(p.id, p)
  for (const r of recall.list) patients.set(r.patient.id, r.patient)
  for (const b of birthdays) patients.set(b.patient.id, b.patient)
  return {
    today, todayApts, unconfirmed, overdue, lowStock, expiry, lab, recall, birthdays, patients,
    important: importantIds({ invoices: input.invoices, items: input.items, labOrders: input.labOrders, appointments: input.upcoming }, today),
  }
}

// ---- hooks ------------------------------------------------------------------------------------------
/** The current date, refreshed when the day changes (checked every minute). */
export function useToday(): ISODate {
  const [d, setD] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => { const n = toISODate(new Date()); setD(c => (c === n ? c : n)) }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return d
}
/** A Date that ticks every `ms` (for "remaining today"). */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), ms); return () => window.clearInterval(id) }, [ms])
  return now
}

/** Which alert families the signed-in user may see. */
export function useAlertPerms(): { appointments: boolean; billing: boolean; inventory: boolean; clinical: boolean; patients: boolean; key: string } {
  const { can, user } = useSession()
  const has = (p: Permission) => can(p)
  const r = { appointments: has('appointments'), billing: has('billing'), inventory: has('inventory'), clinical: has('clinical'), patients: has('patients') }
  return { ...r, key: `${user?.id ?? ''}:${Object.values(r).map(Number).join('')}` }
}

/** Everything the notifications panel lists; undefined while loading. The data is read live once; the clock only re-runs the math. */
export function useAlerts(): Alerts | undefined {
  const perms = useAlertPerms()
  const now = useNow()
  const today = toISODate(now)
  const minute = Math.floor(now.getTime() / 60_000)
  const input = useLiveQuery(async (): Promise<AlertInput> => {
    const none = <T,>(): Promise<T[]> => Promise.resolve([])
    const [upcoming, completed, invoices, items, labOrders, patients] = await Promise.all([
      perms.appointments || perms.patients ? db.appointments.where('date').aboveOrEqual(today).toArray() : none<Appointment>(),
      perms.patients ? db.appointments.where('status').equals('completed').toArray() : none<Appointment>(),
      perms.billing ? db.invoices.where('status').anyOf('unpaid', 'partial').toArray() : none<Invoice>(),
      perms.inventory ? db.inventory.toArray() : none<InventoryItem>(),
      perms.clinical ? db.labOrders.where('status').anyOf('sent', 'in_progress').toArray() : none<LabOrder>(),
      db.patients.toArray(),
    ])
    return { upcoming, completed, invoices, items, labOrders, patients }
  }, [today, perms.key])
  return useMemo(() => {
    if (!input) return undefined
    const a = computeAlerts(input, new Date(minute * 60_000))
    // families the role may not see stay empty
    if (!perms.appointments) {
      a.todayApts = []; a.unconfirmed = []
      a.important = a.important.filter(id => !id.startsWith('apt:'))
    }
    if (!perms.patients) { a.recall = { list: [], total: 0 }; a.birthdays = [] }
    return a
  }, [input, minute, perms.appointments, perms.patients])
}

/** Ids of the important alerts, light enough to run in the shell all the time. */
export function useImportantIds(): string[] | undefined {
  const perms = useAlertPerms()
  const today = useToday()
  return useLiveQuery(async () => {
    const [invoices, items, labOrders, appointments] = await Promise.all([
      perms.billing ? db.invoices.where('status').anyOf('unpaid', 'partial').toArray() : Promise.resolve([] as Invoice[]),
      perms.inventory ? db.inventory.toArray() : Promise.resolve([] as InventoryItem[]),
      perms.clinical ? db.labOrders.where('status').anyOf('sent', 'in_progress').toArray() : Promise.resolve([] as LabOrder[]),
      perms.appointments ? db.appointments.where('date').equals(addDays(today, 1)).toArray() : Promise.resolve([] as Appointment[]),
    ])
    return importantIds({ invoices, items, labOrders, appointments }, today)
  }, [today, perms.key])
}

// ---- "seen" snapshot (localStorage) -----------------------------------------------------------------
const SEEN_KEY = 'dentora.notif.seen'
const listeners = new Set<() => void>()
let seenSnapshot: ReadonlySet<string> | null = null
function readSeen(): ReadonlySet<string> {
  if (seenSnapshot) return seenSnapshot
  let list: string[] = []
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); if (Array.isArray(v)) list = v.filter(x => typeof x === 'string') } catch { /* ignore */ }
  seenSnapshot = new Set(list)
  return seenSnapshot
}
function subscribeSeen(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => { if (e.key === SEEN_KEY) { seenSnapshot = null; cb() } }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage) }
}
/** Remembers the current important alerts as seen: the dot stays hidden until a new one appears. */
export function markSeen(ids: string[]): void {
  const cur = readSeen()
  if (ids.length === cur.size && ids.every(id => cur.has(id))) return
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 2000))) } catch { /* ignore */ }
  seenSnapshot = new Set(ids)
  listeners.forEach(l => l())
}
export function useSeen(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeSeen, readSeen, readSeen)
}
