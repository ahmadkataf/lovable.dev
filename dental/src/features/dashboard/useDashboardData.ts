// Everything the dashboard shows, read live from the database (read-only: safe inside useLiveQuery).
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Activity, Appointment, InventoryItem, Invoice, LabOrder, Patient, Payment, TreatmentItem } from '@/db/types'
import { addDays, addMonths, combine, endOfMonth, startOfMonth } from '@/lib/dates'

export interface DashboardRaw {
  todayApts: Appointment[]
  /** appointments of this month and of last month (deltas) */
  monthApts: Appointment[]
  tomorrowApts: Appointment[]
  /** payments since min(1st of last month, 29 days ago) */
  payments: Payment[]
  /** patients registered since the 1st of last month */
  newPatients: Patient[]
  /** treatments completed this month */
  doneThisMonth: TreatmentItem[]
  /** patients referenced by today's schedule */
  schedulePatients: Map<string, Patient>
  inventory: InventoryItem[]
  labs: LabOrder[]
  activity: Activity[]
  /** every invoice and payment (balances), only when the user may see money */
  invoices: Invoice[]
  allPayments: Payment[]
}

export function useDashboardData(today: string, withMoney: boolean): DashboardRaw | undefined {
  return useLiveQuery(async () => {
    const monthStart = startOfMonth(today), monthEnd = endOfMonth(today)
    const lastStart = addMonths(monthStart, -1)
    const from30 = addDays(today, -29)
    const payFrom = lastStart < from30 ? lastStart : from30
    const [todayApts, monthApts, tomorrowApts, payments, newPatients, doneThisMonth, inventory, labs, activity, invoices, allPayments] = await Promise.all([
      db.appointments.where('date').equals(today).toArray(),
      db.appointments.where('date').between(lastStart, monthEnd, true, true).toArray(),
      db.appointments.where('date').equals(addDays(today, 1)).toArray(),
      db.payments.where('date').between(payFrom, today, true, true).toArray(),
      db.patients.where('createdAt').aboveOrEqual(combine(lastStart, '00:00')).toArray(),
      db.treatments.where('completedAt').aboveOrEqual(combine(monthStart, '00:00')).toArray(),
      db.inventory.toArray(),
      db.labOrders.where('status').anyOf('sent', 'in_progress').toArray(),
      db.activity.orderBy('at').reverse().limit(12).toArray(),
      withMoney ? db.invoices.toArray() : Promise.resolve([] as Invoice[]),
      withMoney ? db.payments.toArray() : Promise.resolve([] as Payment[]),
    ])
    todayApts.sort((a, b) => a.start.localeCompare(b.start))
    const ids = [...new Set(todayApts.map(a => a.patientId))]
    const pats = ids.length ? await db.patients.bulkGet(ids) : []
    const schedulePatients = new Map(pats.filter((p): p is Patient => !!p).map(p => [p.id, p]))
    return { todayApts, monthApts, tomorrowApts, payments, newPatients, doneThisMonth, schedulePatients, inventory, labs, activity, invoices, allPayments }
  }, [today, withMoney])
}
