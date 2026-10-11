import Dexie, { type EntityTable } from 'dexie'
import type {
  Activity, Appointment, BackupFile, Clinic, ClinicalNote, Drug, Expense, InventoryItem, Invoice, LabOrder, Patient, PatientFile, Payment,
  Prescription, Procedure, Setting, StockMovement, ToothRecord, TreatmentItem, TreatmentPlan, User,
} from './types'
import { newId, nowISO } from './ids'

export const SCHEMA_VERSION = 1

export class DentoraDB extends Dexie {
  clinic!: EntityTable<Clinic, 'id'>
  users!: EntityTable<User, 'id'>
  patients!: EntityTable<Patient, 'id'>
  appointments!: EntityTable<Appointment, 'id'>
  procedures!: EntityTable<Procedure, 'id'>
  teeth!: EntityTable<ToothRecord, 'id'>
  plans!: EntityTable<TreatmentPlan, 'id'>
  treatments!: EntityTable<TreatmentItem, 'id'>
  invoices!: EntityTable<Invoice, 'id'>
  payments!: EntityTable<Payment, 'id'>
  drugs!: EntityTable<Drug, 'id'>
  prescriptions!: EntityTable<Prescription, 'id'>
  labOrders!: EntityTable<LabOrder, 'id'>
  inventory!: EntityTable<InventoryItem, 'id'>
  stock!: EntityTable<StockMovement, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  files!: EntityTable<PatientFile, 'id'>
  notes!: EntityTable<ClinicalNote, 'id'>
  activity!: EntityTable<Activity, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'dentora') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      clinic: 'id',
      users: 'id, role, active, name',
      patients: 'id, fileNo, name, phone, archived, createdAt, lastVisit, doctorId, *tags',
      appointments: 'id, patientId, doctorId, date, start, status, [date+doctorId], [patientId+date]',
      procedures: 'id, category, active, name',
      teeth: 'id, patientId, tooth, active, [patientId+tooth], [patientId+active]',
      plans: 'id, patientId, status',
      treatments: 'id, patientId, planId, status, invoiceId, appointmentId, doctorId, [patientId+status], completedAt, createdAt',
      invoices: 'id, number, patientId, date, status, doctorId, [patientId+status], createdAt',
      payments: 'id, patientId, invoiceId, date, method, receivedBy, createdAt',
      drugs: 'id, name, active',
      prescriptions: 'id, patientId, doctorId, date, createdAt',
      labOrders: 'id, patientId, status, dueDate, labName, createdAt',
      inventory: 'id, name, category, active, expiryDate',
      stock: 'id, itemId, date, reason',
      expenses: 'id, date, category',
      files: 'id, patientId, kind, createdAt',
      notes: 'id, patientId, appointmentId, date, createdAt',
      activity: 'id, at, type, patientId, by',
      settings: 'key',
    })
  }
}

export const db = new DentoraDB()

/** All table names, in the order a backup writes and restores them. */
export const TABLE_NAMES = ['clinic', 'users', 'patients', 'appointments', 'procedures', 'teeth', 'plans', 'treatments', 'invoices', 'payments', 'drugs', 'prescriptions', 'labOrders', 'inventory', 'stock', 'expenses', 'files', 'notes', 'activity', 'settings'] as const
export type TableName = typeof TABLE_NAMES[number]

export const DEFAULT_CLINIC: Clinic = {
  id: 'clinic',
  name: '',
  currency: 'USD', currencySymbol: '$', currencyDecimals: 2,
  lang: 'ar', theme: 'light',
  workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, defaultAppointmentMinutes: 30,
  taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: 1, nextFileNumber: 1,
  setupDone: false,
  createdAt: nowISO(), updatedAt: nowISO(),
}

/** The clinic record with defaults filled in. Read-only (safe inside live queries); ensureClinic() creates it. */
export async function getClinic(): Promise<Clinic> {
  const c = await db.clinic.get('clinic')
  return c ? { ...DEFAULT_CLINIC, ...c } : DEFAULT_CLINIC
}
/** Creates the clinic record on first run. Called once at app start, never from a live query. */
export async function ensureClinic(): Promise<Clinic> {
  const c = await db.clinic.get('clinic')
  if (c) return { ...DEFAULT_CLINIC, ...c }
  await db.clinic.put(DEFAULT_CLINIC)
  return DEFAULT_CLINIC
}
export async function updateClinic(patch: Partial<Clinic>): Promise<Clinic> {
  const c = await getClinic()
  const next = { ...c, ...patch, id: 'clinic' as const, updatedAt: nowISO() }
  await db.clinic.put(next)
  return next
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** Adds a line to the activity feed shown on the dashboard. Never throws. */
export async function logActivity(a: Omit<Activity, 'id' | 'at'> & { at?: string }): Promise<void> {
  try { await db.activity.add({ id: newId(), at: a.at ?? nowISO(), ...a }) } catch { /* feed only */ }
}

/** Next invoice number, atomically; writes the counter back. */
export async function nextInvoiceNumber(): Promise<string> {
  return db.transaction('rw', db.clinic, async () => {
    const c = await getClinic()
    const n = c.nextInvoiceNumber || 1
    await db.clinic.put({ ...c, nextInvoiceNumber: n + 1, updatedAt: nowISO() })
    return `${c.invoicePrefix || ''}${String(n).padStart(6, '0')}`
  })
}
/** Next receipt number ('R-000123'), atomically; used for every new payment. */
export async function nextReceiptNumber(): Promise<string> {
  return db.transaction('rw', db.clinic, async () => {
    const c = await getClinic()
    const n = c.nextReceiptNumber || 1
    await db.clinic.put({ ...c, nextReceiptNumber: n + 1, updatedAt: nowISO() })
    return `${c.receiptPrefix ?? 'R-'}${String(n).padStart(6, '0')}`
  })
}
export async function nextFileNumber(): Promise<number> {
  return db.transaction('rw', db.clinic, async () => {
    const c = await getClinic()
    const n = c.nextFileNumber || 1
    await db.clinic.put({ ...c, nextFileNumber: n + 1, updatedAt: nowISO() })
    return n
  })
}

// ---- backup / restore -------------------------------------------------------------------------
async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })
}
async function dataUrlToBlob(u: string): Promise<Blob> {
  const r = await fetch(u); return r.blob()
}

/** Every table as plain JSON (file blobs become data URLs). */
export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) {
    const rows = await (db as any)[name].toArray()
    if (name === 'files') {
      for (const f of rows as PatientFile[]) if (f.data instanceof Blob) (f as any).data = await blobToDataUrl(f.data)
    }
    tables[name] = rows
  }
  return { app: 'dentora', version: SCHEMA_VERSION, exportedAt: nowISO(), tables }
}

/** Replaces everything with the backup's content. The caller confirms first. */
export async function importBackup(data: BackupFile): Promise<{ tables: number; rows: number }> {
  if (!data || data.app !== 'dentora' || !data.tables) throw new Error('not-a-backup')
  let rows = 0, count = 0
  await db.transaction('rw', TABLE_NAMES.map(n => (db as any)[n]), async () => {
    for (const name of TABLE_NAMES) {
      const table = (db as any)[name]
      await table.clear()
      const list = (data.tables[name] ?? []) as any[]
      if (name === 'files') for (const f of list) if (typeof f.data === 'string') f.data = await dataUrlToBlob(f.data)
      if (list.length) await table.bulkPut(list)
      rows += list.length; count++
    }
  })
  return { tables: count, rows }
}

/** Wipes the database (used by "start over" and by tests). */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map(n => (db as any)[n]), async () => {
    for (const name of TABLE_NAMES) await (db as any)[name].clear()
  })
}
