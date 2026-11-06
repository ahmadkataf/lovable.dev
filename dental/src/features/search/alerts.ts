// Live alerts for the notifications panel. The pure functions below work on plain arrays (tests/search.test.ts);
// useAlerts() / useImportantIds() feed them from the database with useLiveQuery.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '@/db'
import type { Appointment, AppointmentStatus, InventoryItem, Invoice, ISODate, LabOrder, Patient } from '@/db/types'
import { addDays, dateOf, diffDays, fromISODate, toISODate } from '@/lib/dates'
import { round2 } from '@/lib/format'
import { useSession, type Permission } from '@/app/session'
import { usePatientIndex } from '@/features/billing/patientIndex'
import { BACKUP_REMIND_DAYS, backupAgeDays } from '@/features/settings/lib'
import { collator } from './lib'

export const OVERDUE_AFTER_DAYS = 30     // an invoice without a due date is overdue this long after its date
export const EXPIRY_WINDOW_DAYS = 60   // the same window as the inventory page (EXPIRY_SOON_DAYS) and its form hint
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
type PatLike = Pick<Patient, 'id' | 'name' | 'archived'> & Partial<Pick<Patient, 'birthDate' | 'gender' | 'lastVisit'>>
/** What the alerts need of a patient (the shared slim patient index has all of it, without photos or medical text). */
export type AlertPatient = PatLike & Partial<Pick<Patient, 'phone'>>
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
 * Patients due for a recall: their last completed visit is more than `months` months ago and nothing is booked from
 * today on. The last visit is the patient's cached lastVisit (kept in step with completed appointments by the
 * appointments module), or a completed appointment in `apts` when one is later. `apts` only needs the bookings from
 * today on, so the thousands of past completed visits are never read. Archived files are skipped. Most recently
 * lapsed first (the likeliest to come back), capped at `limit`.
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
    const cached = p.lastVisit ? dateOf(p.lastVisit) : undefined
    const fromApts = last.get(p.id)
    const lv = cached && (!fromApts || cached > fromApts) ? cached : fromApts
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

// ---- backups ------------------------------------------------------------------------------------------
/**
 * The backup reminder: the clinic's only copy of its records lives on this device, so the panel says so when no
 * backup was ever exported (once the clinic holds data) or the last one is BACKUP_REMIND_DAYS old or more.
 */
export interface BackupAlert { kind: 'never' | 'old'; days: number | null; id: string }
export function backupAlert(lastISO: string | null | undefined, hasData: boolean, now: Date = new Date(), remindDays = BACKUP_REMIND_DAYS): BackupAlert | null {
  const days = backupAgeDays(lastISO, now)
  if (days === null && !hasData) return null
  if (days !== null && days < remindDays) return null
  // the id changes every week, so the red dot comes back weekly until a backup is exported
  const week = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (7 * 86_400_000))
  return { kind: days === null ? 'never' : 'old', days, id: `backup:${lastISO ? dateOf(lastISO) : 'never'}:${week}` }
}

// ---- the "important" set behind the red dot -----------------------------------------------------------
export interface ImportantInput {
  invoices?: InvLike[]
  items?: ItemLike[]
  labOrders?: LabLike[]
  appointments?: AptLike[]
  backup?: BackupAlert | null
}
/** Stable ids of what deserves the red dot: overdue invoices, low stock, late lab work, unconfirmed tomorrow, a backup due. */
export function importantIds(input: ImportantInput, today: ISODate): string[] {
  const ids: string[] = []
  for (const x of overdueInvoices(input.invoices ?? [], today).list) ids.push(`inv:${x.invoice.id}`)
  for (const i of lowStockItems(input.items ?? [])) ids.push(`stock:${i.id}`)
  for (const l of labDue(input.labOrders ?? [], today)) if (l.kind === 'overdue') ids.push(`lab:${l.order.id}`)
  for (const a of unconfirmedTomorrow(input.appointments ?? [], today)) ids.push(`apt:${a.id}`)
  if (input.backup) ids.push(input.backup.id)
  return ids
}
/** How many of the important ids have not been seen yet (`seen` holds ids or their seenHash). */
export function unseenCount(ids: string[], seen: ReadonlySet<string>): number {
  let n = 0
  for (const id of ids) if (!seen.has(id) && !seen.has(seenHash(id))) n++
  return n
}

// ---- everything the panel shows ---------------------------------------------------------------------
export interface AlertInput {
  upcoming: Appointment[]          // date ≥ today
  /** Past completed visits (optional: the patients' cached lastVisit already says when they were last seen). */
  completed?: Pick<Appointment, 'patientId' | 'date' | 'status'>[]
  invoices: Invoice[]              // unpaid / partial
  items: InventoryItem[]
  labOrders: LabOrder[]            // sent / in progress
  patients: AlertPatient[]
  /** lastBackupAt (null = never) and whether the clinic holds any data yet; undefined = not shown to this user. */
  backup?: { lastAt: string | null; hasData: boolean }
}
export interface Alerts {
  today: ISODate
  todayApts: Appointment[]
  unconfirmed: Appointment[]
  overdue: { list: OverdueInvoice<Invoice>[]; totalDue: number }
  lowStock: InventoryItem[]
  expiry: ExpiryAlert<InventoryItem>[]
  lab: LabAlert<LabOrder>[]
  recall: { list: RecallItem<AlertPatient>[]; total: number }
  birthdays: BirthdayItem<AlertPatient>[]
  backup: BackupAlert | null
  important: string[]
  patients: Map<string, AlertPatient>   // the patients the alerts mention
}
export function computeAlerts(input: AlertInput, now: Date = new Date()): Alerts {
  const today = toISODate(now)
  const todayApts = remainingToday(input.upcoming, now)
  const unconfirmed = unconfirmedTomorrow(input.upcoming, today)
  const overdue = overdueInvoices(input.invoices, today)
  const lowStock = lowStockItems(input.items)
  const expiry = expiringItems(input.items, today)
  const lab = labDue(input.labOrders, today)
  const recall = recallPatients(input.patients, [...(input.completed ?? []), ...input.upcoming], today)
  const birthdays = birthdaysToday(input.patients, today)
  const backup = input.backup ? backupAlert(input.backup.lastAt, input.backup.hasData, now) : null
  const want = new Set<string>([
    ...todayApts.map(a => a.patientId), ...unconfirmed.map(a => a.patientId), ...overdue.list.map(x => x.invoice.patientId), ...lab.map(x => x.order.patientId),
  ])
  const patients = new Map<string, AlertPatient>()
  for (const p of input.patients) if (want.has(p.id)) patients.set(p.id, p)
  for (const r of recall.list) patients.set(r.patient.id, r.patient)
  for (const b of birthdays) patients.set(b.patient.id, b.patient)
  return {
    today, todayApts, unconfirmed, overdue, lowStock, expiry, lab, recall, birthdays, backup, patients,
    important: importantIds({ invoices: input.invoices, items: input.items, labOrders: input.labOrders, appointments: input.upcoming, backup }, today),
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

/** Which alert families the signed-in user may see. Everyone sees the backup reminder; only administrators get its red dot. */
export function useAlertPerms(): { appointments: boolean; billing: boolean; inventory: boolean; clinical: boolean; patients: boolean; settings: boolean; key: string } {
  const { can, user } = useSession()
  const has = (p: Permission) => can(p)
  const r = { appointments: has('appointments'), billing: has('billing'), inventory: has('inventory'), clinical: has('clinical'), patients: has('patients'), settings: has('settings') }
  return { ...r, key: `${user?.id ?? ''}:${Object.values(r).map(Number).join('')}` }
}

/** lastBackupAt and whether the clinic holds data yet (a fresh install with no patient is not nagged). Index reads only. */
async function readBackupState(): Promise<{ lastAt: string | null; hasData: boolean }> {
  const [lastAt, patients] = await Promise.all([getSetting<string | null>('lastBackupAt', null), db.patients.count()])
  return { lastAt: typeof lastAt === 'string' ? lastAt : null, hasData: patients > 0 }
}

/**
 * Everything the notifications panel lists; undefined while loading. The data is read live once; the clock only re-runs
 * the math. Only index-bounded rows are read (bookings from today on, unpaid invoices, stock, lab work at the lab):
 * recalls and birthdays come from the shared in-memory patient index (lastVisit, birthDate), never from the tens of
 * thousands of past appointments.
 */
export function useAlerts(): Alerts | undefined {
  const perms = useAlertPerms()
  const now = useNow()
  const today = toISODate(now)
  const minute = Math.floor(now.getTime() / 60_000)
  const index = usePatientIndex()
  const input = useLiveQuery(async () => {
    const none = <T,>(): Promise<T[]> => Promise.resolve([])
    const [upcoming, invoices, items, labOrders, backup] = await Promise.all([
      perms.appointments || perms.patients ? db.appointments.where('date').aboveOrEqual(today).toArray() : none<Appointment>(),
      perms.billing ? db.invoices.where('status').anyOf('unpaid', 'partial').toArray() : none<Invoice>(),
      perms.inventory ? db.inventory.toArray() : none<InventoryItem>(),
      perms.clinical ? db.labOrders.where('status').anyOf('sent', 'in_progress').toArray() : none<LabOrder>(),
      readBackupState(),
    ])
    return { upcoming, invoices, items, labOrders, backup }
  }, [today, perms.key])
  return useMemo(() => {
    if (!input || !index) return undefined
    const a = computeAlerts({ ...input, patients: index.list }, new Date(minute * 60_000))
    // families the role may not see stay empty
    if (!perms.appointments) {
      a.todayApts = []; a.unconfirmed = []
      a.important = a.important.filter(id => !id.startsWith('apt:'))
    }
    if (!perms.patients) { a.recall = { list: [], total: 0 }; a.birthdays = [] }
    if (!perms.settings) a.important = a.important.filter(id => !id.startsWith('backup:'))
    return a
  }, [input, index, minute, perms.appointments, perms.patients, perms.settings])
}

/** Ids of the important alerts, light enough to run in the shell all the time (index reads and counts only). */
export function useImportantIds(): string[] | undefined {
  const perms = useAlertPerms()
  const today = useToday()
  return useLiveQuery(async () => {
    const [invoices, items, labOrders, appointments, backup] = await Promise.all([
      perms.billing ? db.invoices.where('status').anyOf('unpaid', 'partial').toArray() : Promise.resolve([] as Invoice[]),
      perms.inventory ? db.inventory.toArray() : Promise.resolve([] as InventoryItem[]),
      perms.clinical ? db.labOrders.where('status').anyOf('sent', 'in_progress').toArray() : Promise.resolve([] as LabOrder[]),
      perms.appointments ? db.appointments.where('date').equals(addDays(today, 1)).toArray() : Promise.resolve([] as Appointment[]),
      perms.settings ? readBackupState() : Promise.resolve(null),
    ])
    return importantIds({ invoices, items, labOrders, appointments, backup: backup ? backupAlert(backup.lastAt, backup.hasData) : null }, today)
  }, [today, perms.key])
}

// ---- "seen" snapshot (localStorage) -----------------------------------------------------------------
// The ids of the important alerts seen when the panel was last opened. Every id is kept (a busy clinic can have
// thousands of overdue invoices, and dropping some would bring the red dot back after a restart), each stored as a
// short hash so the list stays small (about 8 bytes per alert).
const SEEN_KEY = 'dentora.notif.seen'
const listeners = new Set<() => void>()
let seenSnapshot: ReadonlySet<string> | null = null
/** FNV-1a 32-bit hash of an id, in base 36 ('inv:01J…' → '1x3k9fz'). */
export function seenHash(id: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
/** The stored list as a set of hashes; older versions stored the ids themselves (they contain ':'). */
export function parseSeen(raw: string | null): Set<string> {
  let list: unknown = []
  try { list = JSON.parse(raw || '[]') } catch { /* ignore */ }
  const out = new Set<string>()
  if (Array.isArray(list)) for (const x of list) if (typeof x === 'string') out.add(x.includes(':') ? seenHash(x) : x)
  return out
}
function readSeen(): ReadonlySet<string> {
  if (seenSnapshot) return seenSnapshot
  let raw: string | null = null
  try { raw = localStorage.getItem(SEEN_KEY) } catch { /* private mode */ }
  seenSnapshot = parseSeen(raw)
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
  const hashes = [...new Set(ids.map(seenHash))]
  if (hashes.length === cur.size && hashes.every(h => cur.has(h))) return
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(hashes)) } catch { /* full or private mode: the dot simply shows again */ }
  seenSnapshot = new Set(hashes)
  listeners.forEach(l => l())
}
/** The seen alerts (as hashes): pass it to unseenCount / isSeen. */
export function useSeen(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeSeen, readSeen, readSeen)
}
/** Whether an alert id is in a seen set (hashed or, for tests and old data, plain). */
export const isSeen = (seen: ReadonlySet<string>, id: string) => seen.has(id) || seen.has(seenHash(id))
