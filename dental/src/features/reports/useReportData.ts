// Loads everything the report tabs need for a period (and the comparison period) with useLiveQuery, then splits
// and filters it by doctor in memory. Read-only: nothing here writes, so it is safe inside live queries.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Appointment, Expense, Invoice, Patient, Payment, Procedure, TreatmentItem, User } from '@/db/types'
import { addDays, combine, dateOf } from '@/lib/dates'
import { useUsers } from '@/app/hooks'
import { inRange, invoiceDoctors, paymentDoctor, previousPeriod, type Period } from './queries'

export interface ReportData {
  period: Period
  prev: Period
  doctorId: string
  payments: Payment[]; prevPayments: Payment[]
  invoices: Invoice[]; prevInvoices: Invoice[]
  /** invoices of the range plus every older invoice a payment of the range settles (for doctor attribution) */
  refInvoices: Invoice[]
  expenses: Expense[]; prevExpenses: Expense[]
  appointments: Appointment[]; prevAppointments: Appointment[]
  /** treatments created or completed in the period */
  treatments: TreatmentItem[]; prevTreatments: TreatmentItem[]
  patients: Patient[]
  patientMap: Map<string, Patient>
  procedures: Procedure[]
  users: User[]
}

const dayStart = (d: string) => combine(d, '00:00')
const dayEnd = (d: string) => combine(addDays(d, 1), '00:00')
const trDay = (iso?: string) => (iso ? dateOf(iso) : undefined)

export function useReportData(period: Period, doctorId: string): ReportData | undefined {
  const prev = useMemo(() => previousPeriod(period), [period])
  const users = useUsers(false)
  const raw = useLiveQuery(async () => {
    const from = prev.from, to = period.to
    const [payments, invoices, expenses, appointments, trDone, trNew, patients, procedures] = await Promise.all([
      db.payments.where('date').between(from, to, true, true).toArray(),
      db.invoices.where('date').between(from, to, true, true).toArray(),
      db.expenses.where('date').between(from, to, true, true).toArray(),
      db.appointments.where('date').between(from, to, true, true).toArray(),
      db.treatments.where('completedAt').between(dayStart(from), dayEnd(to), true, false).toArray(),
      db.treatments.where('createdAt').between(dayStart(from), dayEnd(to), true, false).toArray(),
      db.patients.toArray(),
      db.procedures.toArray(),
    ])
    const have = new Set(invoices.map(i => i.id))
    const missing = [...new Set(payments.map(p => p.invoiceId).filter((id): id is string => !!id && !have.has(id)))]
    const extra = missing.length ? (await db.invoices.bulkGet(missing)).filter((x): x is Invoice => !!x) : []
    const trMap = new Map<string, TreatmentItem>()
    for (const t of [...trDone, ...trNew]) trMap.set(t.id, t)
    return { payments, invoices, refInvoices: [...invoices, ...extra], expenses, appointments, treatments: [...trMap.values()], patients, procedures }
  }, [prev.from, period.to])

  return useMemo(() => {
    if (!raw) return undefined
    const docs = invoiceDoctors(raw.refInvoices)
    const byDoc = <T,>(list: T[], f: (x: T) => string | undefined) => (doctorId ? list.filter(x => f(x) === doctorId) : list)
    const payments = byDoc(raw.payments, p => paymentDoctor(p, docs))
    const invoices = byDoc(raw.invoices, i => i.doctorId)
    const appointments = byDoc(raw.appointments, a => a.doctorId)
    const treatments = byDoc(raw.treatments, t => t.doctorId)
    const inP = (p: Period) => <T extends { date: string }>(x: T) => inRange(x.date, p)
    const trIn = (p: Period) => (t: TreatmentItem) => inRange(trDay(t.createdAt), p) || inRange(trDay(t.completedAt), p)
    return {
      period, prev, doctorId, users,
      payments: payments.filter(inP(period)), prevPayments: payments.filter(inP(prev)),
      invoices: invoices.filter(inP(period)), prevInvoices: invoices.filter(inP(prev)),
      refInvoices: raw.refInvoices,
      expenses: raw.expenses.filter(inP(period)), prevExpenses: raw.expenses.filter(inP(prev)),
      appointments: appointments.filter(inP(period)), prevAppointments: appointments.filter(inP(prev)),
      treatments: treatments.filter(trIn(period)), prevTreatments: treatments.filter(trIn(prev)),
      patients: raw.patients,
      patientMap: new Map(raw.patients.map(p => [p.id, p])),
      procedures: raw.procedures,
    }
  }, [raw, period, prev, doctorId, users])
}

/** Every invoice and payment, for current balances (the outstanding tab); undefined while loading or when off. */
export function useAllBalances(enabled: boolean): { invoices: Invoice[]; payments: Payment[] } | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return { invoices: [], payments: [] }
    const [invoices, payments] = await Promise.all([db.invoices.toArray(), db.payments.toArray()])
    return { invoices, payments }
  }, [enabled])
}
