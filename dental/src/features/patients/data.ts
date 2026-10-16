// Database writes shared by the patients list and the patient profile.
import { db } from '@/db'

/** Every table that holds rows belonging to one patient (by patientId). */
export const PATIENT_TABLES = ['appointments', 'teeth', 'plans', 'treatments', 'invoices', 'payments', 'prescriptions', 'labOrders', 'files', 'notes', 'activity'] as const

/** The money history of a patient: issued invoices (drafts do not count) and payments. */
export interface MoneyHistory { invoices: number; payments: number }
export const hasMoneyHistory = (m: MoneyHistory) => m.invoices > 0 || m.payments > 0

/**
 * Issued invoices (paid, unpaid, partial or cancelled: each took a real number and may sit in a closed cash day or a
 * report) and payments of a patient. Drafts are not money history: they never counted and are deleted with the file.
 */
export async function moneyHistory(patientId: string): Promise<MoneyHistory> {
  const [invoices, payments] = await Promise.all([
    db.invoices.where('patientId').equals(patientId).toArray(),
    db.payments.where('patientId').equals(patientId).count(),
  ])
  return { invoices: invoices.filter(i => i.status !== 'draft').length, payments }
}

/** Thrown by deletePatientCascade() when the patient has money history: the file must be archived instead. */
export class PatientHasMoneyHistory extends Error {
  constructor(readonly history: MoneyHistory) { super('patient-has-money-history') }
}

/**
 * Deletes the patient and everything recorded for them, atomically. Refused (PatientHasMoneyHistory, nothing deleted)
 * when the patient has issued invoices or payments: deleting them would change past revenue, closed cash days and
 * reports after the fact. Such a file is archived instead.
 */
export async function deletePatientCascade(patientId: string): Promise<void> {
  const tables = PATIENT_TABLES.map(n => db[n])
  await db.transaction('rw', [db.patients, ...tables], async () => {
    // checked inside the transaction, so a payment recorded a moment ago cannot slip through
    const history = await moneyHistory(patientId)
    if (hasMoneyHistory(history)) throw new PatientHasMoneyHistory(history)
    for (const table of tables) await (table as any).where('patientId').equals(patientId).delete()
    await db.patients.delete(patientId)
  })
}
