// Loads what the open report tab needs for a period (and the comparison period), then splits and filters it by doctor
// in memory. Reports are snapshots: they are read once in one read-only transaction (no live-query bookkeeping of
// every key read, no result cloning) and read again, a moment later, when a table they use changes.
// Only the open tab's tables are read; patients come from the shared slim index, never as whole records.
import { useMemo } from 'react'
import { db } from '@/db'
import type { Appointment, Expense, Invoice, ISODate, Payment, Procedure, TreatmentItem, User } from '@/db/types'
import { addDays, combine, dateOf, today } from '@/lib/dates'
import { useUsers } from '@/app/hooks'
import { usePatientIndex, type SlimPatient } from '@/features/billing/patientIndex'
import { useSnapshot } from '@/features/billing/snapshot'
import { comparablePeriod, inRange, invoiceDoctors, paymentDoctor, type Period } from './queries'

export type ReportTab = 'financial' | 'patients' | 'appointments' | 'treatments' | 'outstanding'

export interface ReportData {
  period: Period
  /** The comparison period of the KPI deltas (the same stretch of the previous period while this one runs). */
  prev: Period
  /** Where the current side of a delta stops: today while the period is still running, else its last day. */
  cmpTo: ISODate
  /** The period is still running: deltas compare "so far" with the same days before. */
  partial: boolean
  doctorId: string
  payments: Payment[]; prevPayments: Payment[]
  invoices: Invoice[]; prevInvoices: Invoice[]
  /** invoices of the range plus every older invoice a payment of the range settles (for doctor attribution) */
  refInvoices: Invoice[]
  expenses: Expense[]; prevExpenses: Expense[]
  appointments: Appointment[]; prevAppointments: Appointment[]
  /** treatments created or completed in the period (and, on the financial tab, the ones its invoice lines bill) */
  treatments: TreatmentItem[]; prevTreatments: TreatmentItem[]
  /** every patient, slim (patients tab only) */
  patients: SlimPatient[]
  patientMap: Map<string, SlimPatient>
  procedures: Procedure[]
  users: User[]
}

const dayStart = (d: string) => combine(d, '00:00')
const dayEnd = (d: string) => combine(addDays(d, 1), '00:00')
const trDay = (iso?: string) => (iso ? dateOf(iso) : undefined)

/** Tables each tab reads (a change to any of them refreshes the tab). */
const TABLES: Record<ReportTab, string[]> = {
  financial: ['payments', 'invoices', 'expenses', 'procedures', 'treatments'],
  patients: ['payments', 'invoices', 'appointments'],
  appointments: ['appointments'],
  treatments: ['treatments'],
  outstanding: ['invoices', 'payments'],
}

// useSnapshot lives in billing (the invoices list uses it too); re-exported for the report tabs.
export { useSnapshot }

interface Raw {
  payments: Payment[]; invoices: Invoice[]; refInvoices: Invoice[]; expenses: Expense[]; appointments: Appointment[]; treatments: TreatmentItem[]; procedures: Procedure[]
}
const EMPTY: Raw = { payments: [], invoices: [], refInvoices: [], expenses: [], appointments: [], treatments: [], procedures: [] }

async function loadRaw(tab: ReportTab, from: ISODate, to: ISODate): Promise<Raw> {
  if (tab === 'outstanding') return EMPTY
  const tables = TABLES[tab].map(t => (db as any)[t])
  return db.transaction('r', tables, async () => {
    const out: Raw = { ...EMPTY }
    if (tab === 'financial' || tab === 'patients') {
      ;[out.payments, out.invoices] = await Promise.all([
        db.payments.where('date').between(from, to, true, true).toArray(),
        db.invoices.where('date').between(from, to, true, true).toArray(),
      ])
      const have = new Set(out.invoices.map(i => i.id))
      const missing = [...new Set(out.payments.map(p => p.invoiceId).filter((id): id is string => !!id && !have.has(id)))]
      const extra = missing.length ? (await db.invoices.bulkGet(missing)).filter((x): x is Invoice => !!x) : []
      out.refInvoices = [...out.invoices, ...extra]
    }
    if (tab === 'financial') {
      ;[out.expenses, out.procedures] = await Promise.all([db.expenses.where('date').between(from, to, true, true).toArray(), db.procedures.toArray()])
      // invoice lines that bill a treatment without naming its procedure find the category through the treatment
      const trIds = [...new Set(out.invoices.flatMap(i => i.items.filter(it => it.treatmentItemId && !it.procedureId).map(it => it.treatmentItemId!)))]
      out.treatments = trIds.length ? (await db.treatments.bulkGet(trIds)).filter((x): x is TreatmentItem => !!x) : []
    }
    if (tab === 'patients' || tab === 'appointments') out.appointments = await db.appointments.where('date').between(from, to, true, true).toArray()
    if (tab === 'treatments') {
      const [done, added] = await Promise.all([
        db.treatments.where('completedAt').between(dayStart(from), dayEnd(to), true, false).toArray(),
        db.treatments.where('createdAt').between(dayStart(from), dayEnd(to), true, false).toArray(),
      ])
      const map = new Map<string, TreatmentItem>()
      for (const t of [...done, ...added]) map.set(t.id, t)
      out.treatments = [...map.values()]
    }
    return out
  })
}

export function useReportData(period: Period, doctorId: string, tab: ReportTab = 'financial'): ReportData | undefined {
  const cmp = useMemo(() => comparablePeriod(period, today()), [period])
  const prev = cmp.prev
  const users = useUsers(false)
  const index = usePatientIndex(tab === 'patients')
  const raw = useSnapshot(`${tab}|${prev.from}|${period.to}`, TABLES[tab], () => loadRaw(tab, prev.from, period.to))

  return useMemo(() => {
    if (!raw || (tab === 'patients' && !index)) return undefined
    const docs = invoiceDoctors(raw.refInvoices)
    const byDoc = <T,>(list: T[], f: (x: T) => string | undefined) => (doctorId ? list.filter(x => f(x) === doctorId) : list)
    const payments = byDoc(raw.payments, p => paymentDoctor(p, docs))
    const invoices = byDoc(raw.invoices, i => i.doctorId)
    const appointments = byDoc(raw.appointments, a => a.doctorId)
    const treatments = tab === 'financial' ? raw.treatments : byDoc(raw.treatments, t => t.doctorId)
    const inP = (p: Period) => <T extends { date: string }>(x: T) => inRange(x.date, p)
    const trIn = (p: Period) => (t: TreatmentItem) => inRange(trDay(t.createdAt), p) || inRange(trDay(t.completedAt), p)
    const patients = tab === 'patients' && index ? index.list : []
    return {
      period, prev, cmpTo: cmp.to, partial: cmp.partial, doctorId, users,
      payments: payments.filter(inP(period)), prevPayments: payments.filter(inP(prev)),
      invoices: invoices.filter(inP(period)), prevInvoices: invoices.filter(inP(prev)),
      refInvoices: raw.refInvoices,
      expenses: raw.expenses.filter(inP(period)), prevExpenses: raw.expenses.filter(inP(prev)),
      appointments: appointments.filter(inP(period)), prevAppointments: appointments.filter(inP(prev)),
      treatments: tab === 'financial' ? treatments : treatments.filter(trIn(period)), prevTreatments: tab === 'financial' ? [] : treatments.filter(trIn(prev)),
      patients,
      patientMap: tab === 'patients' && index ? index.byId : new Map(),
      procedures: raw.procedures,
    }
  }, [raw, index, tab, period, prev, cmp, doctorId, users])
}

export interface OutstandingData {
  /** every unpaid or partly paid invoice (credit on account is always applied to them by billing) */
  invoices: Invoice[]
  /** the date of each debtor's last payment */
  lastPayment: Map<string, ISODate>
}
/**
 * What the outstanding tab needs: the open invoices (two reads of the status index) and the date of each debtor's
 * last payment. Never the patients table: names come from the slim index, photos only for the rows on screen.
 */
export function useOutstandingData(): OutstandingData | undefined {
  return useSnapshot('outstanding', TABLES.outstanding, () => db.transaction('r', db.invoices, db.payments, async () => {
    const [unpaid, partial] = await Promise.all([db.invoices.where('status').equals('unpaid').toArray(), db.invoices.where('status').equals('partial').toArray()])
    const invoices = [...unpaid, ...partial]
    const debtors = new Set(invoices.map(i => i.patientId))
    const lastPayment = new Map<string, ISODate>()
    if (debtors.size) {
      // a few debtors: their own payments; many: one plain read of the table (cheaper than a cursor over thousands of keys)
      const pays = debtors.size <= 100 ? await db.payments.where('patientId').anyOf([...debtors]).toArray() : (await db.payments.toArray()).filter(p => debtors.has(p.patientId))
      for (const p of pays) if ((p.amount || 0) > 0) { const cur = lastPayment.get(p.patientId); if (!cur || p.date > cur) lastPayment.set(p.patientId, p.date) }
    }
    return { invoices, lastPayment }
  }))
}
