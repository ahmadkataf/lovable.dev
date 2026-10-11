// Database writes shared by the patients list and the patient profile.
import { db } from '@/db'

/** Every table that holds rows belonging to one patient (by patientId). */
export const PATIENT_TABLES = ['appointments', 'teeth', 'plans', 'treatments', 'invoices', 'payments', 'prescriptions', 'labOrders', 'files', 'notes', 'activity'] as const

/** Deletes the patient and everything recorded for them, atomically. */
export async function deletePatientCascade(patientId: string): Promise<void> {
  const tables = PATIENT_TABLES.map(n => db[n])
  await db.transaction('rw', [db.patients, ...tables], async () => {
    for (const table of tables) await (table as any).where('patientId').equals(patientId).delete()
    await db.patients.delete(patientId)
  })
}
