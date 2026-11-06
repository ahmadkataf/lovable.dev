// Everything the dashboard shows, read live from the database (read-only: safe inside useLiveQuery).
// Each panel has its own small live query, so a write re-runs only the queries that read what it changed:
// a status click on today's schedule (appointment + patient + activity rows) never re-reads invoices or payments.
// Money is read through indexes only: payments by date, and open invoices by status (credit is always applied to
// open invoices by billing, so Σ open dues is the clinic's outstanding).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '@/db'
import type { Activity, Appointment, InventoryItem, Invoice, LabOrder, Patient, Payment, TreatmentItem } from '@/db/types'
import { addDays, addMonths, combine, daysInMonth, endOfMonth, startOfMonth } from '@/lib/dates'

/** Each part is undefined until its own query has answered, so every panel shows as soon as its data is in. */
export interface DashboardRaw {
  schedule?: {
    todayApts: Appointment[]
    /** patients referenced by today's schedule */
    schedulePatients: Map<string, Patient>
  }
  month?: {
    /** appointments of this month and of last month (deltas) */
    monthApts: Appointment[]
    tomorrowApts: Appointment[]
    /** new patient files: this month so far, and the same days of last month */
    newNow: number
    newLast: number
    /** treatments completed this month */
    doneThisMonth: TreatmentItem[]
  }
  money?: {
    /** payments from min(1st of last month, 29 days ago) to the end of this month */
    payments: Payment[]
    /** unpaid and partly paid invoices (only when the user may see money) */
    openInvoices: Invoice[]
  }
  stock?: { inventory: InventoryItem[]; labs: LabOrder[] }
  activity?: Activity[]
  /** when the last backup was taken (null = never), and whether there is anything to back up yet */
  backup?: { at: string | null; hasData: boolean }
}

export function useDashboardData(today: string, withMoney: boolean): DashboardRaw {
  const monthStart = startOfMonth(today), monthEnd = endOfMonth(today)
  const lastStart = addMonths(monthStart, -1)

  const schedule = useLiveQuery(async () => {
    const todayApts = await db.appointments.where('date').equals(today).toArray()
    todayApts.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    const ids = [...new Set(todayApts.map(a => a.patientId))]
    const pats = ids.length ? await db.patients.bulkGet(ids) : []
    return { todayApts, schedulePatients: new Map(pats.filter((p): p is Patient => !!p).map(p => [p.id, p])) }
  }, [today])

  const month = useLiveQuery(async () => {
    const sameDay = Math.min(Number(today.slice(8, 10)), daysInMonth(lastStart))
    const at = (d: string) => combine(d, '00:00')
    const [monthApts, tomorrowApts, newNow, newLast, doneThisMonth] = await Promise.all([
      db.appointments.where('date').between(lastStart, monthEnd, true, true).toArray(),
      db.appointments.where('date').equals(addDays(today, 1)).toArray(),
      db.patients.where('createdAt').between(at(monthStart), at(addDays(today, 1)), true, false).count(),
      db.patients.where('createdAt').between(at(lastStart), at(addDays(lastStart, sameDay)), true, false).count(),
      db.treatments.where('completedAt').aboveOrEqual(at(monthStart)).toArray(),
    ])
    return { monthApts, tomorrowApts, newNow, newLast, doneThisMonth }
  }, [today])

  const money = useLiveQuery(async () => {
    if (!withMoney) return { payments: [] as Payment[], openInvoices: [] as Invoice[] }
    const from30 = addDays(today, -29)
    const payFrom = lastStart < from30 ? lastStart : from30
    // two equals() reads (one getAll each) instead of anyOf(), which walks a cursor and is observed key by key
    const [payments, unpaid, partial] = await Promise.all([
      db.payments.where('date').between(payFrom, monthEnd, true, true).toArray(),
      db.invoices.where('status').equals('unpaid').toArray(),
      db.invoices.where('status').equals('partial').toArray(),
    ])
    return { payments, openInvoices: [...unpaid, ...partial] }
  }, [today, withMoney])

  const stock = useLiveQuery(async () => {
    const [inventory, sent, inProgress] = await Promise.all([
      db.inventory.toArray(), db.labOrders.where('status').equals('sent').toArray(), db.labOrders.where('status').equals('in_progress').toArray(),
    ])
    return { inventory, labs: [...sent, ...inProgress] }
  }, [])
  const activity = useLiveQuery(() => db.activity.orderBy('at').reverse().limit(12).toArray(), [])
  const backup = useLiveQuery(async () => ({ at: await getSetting<string | null>('lastBackupAt', null), hasData: (await db.patients.count()) > 0 }), [])

  return { schedule, month, money, stock, activity, backup }
}
