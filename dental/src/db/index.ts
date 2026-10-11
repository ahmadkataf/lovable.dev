import Dexie, { type EntityTable } from 'dexie'
import type {
  Activity, Appointment, BackupFile, Clinic, ClinicalNote, Drug, Expense, InventoryItem, Invoice, LabOrder, Patient, PatientFile, Payment,
  Prescription, Procedure, Setting, StockMovement, ToothRecord, TreatmentItem, TreatmentPlan, User,
} from './types'
import { newId, nowISO } from './ids'
import { fromBase64 } from '@/platform/bytes'
import { safeFileType, SNIFF_BYTES } from '@/platform/filetype'

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
// Real backups are written and read in chunks by src/features/settings/backup (a ZIP archive: table JSON plus one
// entry per patient file). This part only puts a prepared backup into the database, all at once or not at all.

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })
}

/**
 * The whole database as one object in the old single-JSON backup format (files as data: URLs). Kept for tests and
 * small tools only: it holds every file in memory, so the app itself writes backups with writeBackup() instead.
 */
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

/**
 * A data: URL from an old backup → a Blob, decoded here without fetch() (a backup must never make the app load an
 * address). The type comes from the bytes, not from the URL: an HTML page labelled as a PDF stays inert bytes.
 * Null when it is not a well-formed data: URL.
 */
export function dataUrlToBlob(url: string): Blob | null {
  if (typeof url !== 'string' || !/^data:/i.test(url)) return null
  const comma = url.indexOf(',')
  if (comma < 0) return null
  const meta = url.slice(5, comma)
  let bytes: Uint8Array
  try {
    if (/;base64$/i.test(meta)) bytes = fromBase64(url.slice(comma + 1))
    else bytes = new TextEncoder().encode(decodeURIComponent(url.slice(comma + 1)))
  } catch { return null }
  return new Blob([bytes as BlobPart], { type: safeFileType(bytes.subarray(0, SNIFF_BYTES)) })
}

/** Settings rows that belong to this installation (its activation, its trial start, its last export), not to the clinic. */
export const DEVICE_KEYS = ['license', 'installedAt', 'lastBackupAt'] as const
const DAY = 86_400_000

/** A past (or today's) instant, as milliseconds; NaN for anything else, including dates in the future. */
function pastInstant(v: unknown, now: number): number {
  if (typeof v !== 'string' || !v) return NaN
  const t = new Date(v).getTime()
  return Number.isFinite(t) && t <= now + DAY ? t : NaN
}

/**
 * The settings a restore writes: the backup's own settings, plus this device's rows decided here.
 * - license: this device's activation stays; without one, the backup's is taken (a code only works on the device it
 *   was made for, so this only helps a clinic restoring its own device after a reinstall).
 * - installedAt: the EARLIEST of this device's trial start, the backup's, the day the backed-up clinic was created and
 *   the day the backup was made. Future dates are ignored. So restoring (or editing) a backup can never restart the trial.
 * - lastBackupAt: this device's last export; on a device that never exported, the date of the restored backup.
 */
export function mergeDeviceSettings(backupRows: Setting[], deviceRows: Setting[], ctx: { exportedAt?: unknown; clinicCreatedAt?: unknown } = {}, now = Date.now()): Setting[] {
  const fromBackup = new Map(backupRows.map(r => [r.key, r.value]))
  const fromDevice = new Map(deviceRows.map(r => [r.key, r.value]))
  const out = backupRows.filter(r => !(DEVICE_KEYS as readonly string[]).includes(r.key))
  const license = fromDevice.get('license') ?? fromBackup.get('license')
  if (license !== undefined && license !== null) out.push({ key: 'license', value: license })
  // the backup's own date counts too: the clinic's trial had started by the time it was exported
  const starts = [fromDevice.get('installedAt'), fromBackup.get('installedAt'), ctx.clinicCreatedAt, ctx.exportedAt].map(v => pastInstant(v, now)).filter(Number.isFinite)
  out.push({ key: 'installedAt', value: new Date(starts.length ? Math.min(...starts) : now).toISOString() })
  const device = fromDevice.get('lastBackupAt')
  const last = typeof device === 'string' && device ? device : Number.isFinite(pastInstant(ctx.exportedAt, now)) ? String(ctx.exportedAt) : null
  if (last) out.push({ key: 'lastBackupAt', value: last })
  return out
}

const isRow = (r: unknown): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r)
const validKey = (k: unknown) => (typeof k === 'string' && k.length > 0) || (typeof k === 'number' && Number.isFinite(k))

/** Picture fields the screens put in <img src>: the clinic's logo, a patient's photo, a file's thumbnail. */
const IMAGE_FIELDS: Partial<Record<TableName, string>> = { clinic: 'logo', patients: 'photo', files: 'thumb' }
/** Only an embedded picture (data:image/…) is kept: an address in a crafted backup would make the app load it. */
export const isSafeImageUrl = (v: unknown): boolean => typeof v === 'string' && /^data:image\/[a-z0-9.+-]+[;,]/i.test(v)
function withSafeImage(name: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const field = IMAGE_FIELDS[name]
  if (!field || row[field] === undefined || row[field] === null || isSafeImageUrl(row[field])) return row
  const copy = { ...row }
  delete copy[field]
  return copy
}

/** One table's rows, checked and ready for bulkPut. Patient files must already carry a Blob (or a data: URL from an old backup). */
function prepareRows(name: TableName, list: unknown, skipped: { files: number }): Record<string, unknown>[] {
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new Error('bad-table')
  const pk = name === 'settings' ? 'key' : 'id'
  const out: Record<string, unknown>[] = []
  for (const raw of list) {
    if (!isRow(raw) || !validKey(raw[pk])) throw new Error('bad-row')
    if (name !== 'files') { out.push(withSafeImage(name, raw)); continue }
    const row: Record<string, unknown> = { ...withSafeImage(name, raw) }
    delete row.__entry; delete row.__bytes          // archive bookkeeping (src/features/settings/backup)
    const data = row.data
    const blob = data instanceof Blob ? data : typeof data === 'string' ? dataUrlToBlob(data) : null
    if (!blob) { skipped.files++; continue }   // an unreadable file is left out rather than stored without its bytes
    out.push({ ...row, data: blob, mime: blob.type || row.mime, size: blob.size })
  }
  return out
}

/** Puts `rows` in place of a table's content: new rows first, then the old ones that are gone, so the table is never empty in between. */
async function replaceTable(name: TableName, rows: Record<string, unknown>[]): Promise<void> {
  const table = (db as any)[name]
  const pk = name === 'settings' ? 'key' : 'id'
  if (rows.length) await table.bulkPut(rows)
  const keep = new Set(rows.map(r => r[pk]))
  const old: unknown[] = await table.toCollection().primaryKeys()
  const gone = old.filter(k => !keep.has(k))
  if (gone.length) await table.bulkDelete(gone)
}

/**
 * Replaces everything with the backup's content, all at once or not at all. Every file is a Blob (or is decoded)
 * BEFORE the transaction opens: awaiting anything but Dexie inside it (fetch, FileReader, timers) would let
 * IndexedDB commit half a restore. This device's activation and the earliest trial start are kept (see
 * mergeDeviceSettings). The caller confirms first.
 */
export async function importBackup(data: BackupFile): Promise<{ tables: number; rows: number; skippedFiles: number }> {
  if (!data || data.app !== 'dentora' || !isRow(data.tables)) throw new Error('not-a-backup')
  const skipped = { files: 0 }
  const prepared = {} as Record<TableName, Record<string, unknown>[]>
  for (const name of TABLE_NAMES) prepared[name] = prepareRows(name, (data.tables as Record<string, unknown>)[name], skipped)
  const ctx = { exportedAt: data.exportedAt, clinicCreatedAt: prepared.clinic[0]?.createdAt }
  let rows = 0
  await db.transaction('rw', TABLE_NAMES.map(n => (db as any)[n]), async () => {
    for (const name of TABLE_NAMES) {
      let list = prepared[name]
      if (name === 'settings') {
        const device = (await db.settings.bulkGet([...DEVICE_KEYS])).filter((r): r is Setting => !!r)
        list = mergeDeviceSettings(list as unknown as Setting[], device, ctx) as unknown as Record<string, unknown>[]
      }
      await replaceTable(name, list)
      rows += list.length
    }
  })
  return { tables: TABLE_NAMES.length, rows, skippedFiles: skipped.files }
}

/**
 * Wipes the database in one transaction (used by "start over" and by tests). Settings rows named in `keepSettings`
 * (this device's activation and trial start) stay, and never disappear even for a moment.
 */
export async function resetDatabase(keepSettings: readonly string[] = []): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map(n => (db as any)[n]), async () => {
    for (const name of TABLE_NAMES) {
      if (name === 'settings' && keepSettings.length) {
        const keys = (await db.settings.toCollection().primaryKeys()).filter(k => !keepSettings.includes(String(k)))
        if (keys.length) await db.settings.bulkDelete(keys)
      } else await (db as any)[name].clear()
    }
  })
}

// ---- storage ------------------------------------------------------------------------------------------------
/** True for a write refused because the disk (or the browser's share of it) is full. */
export function isQuotaError(e: unknown): boolean {
  for (let x: any = e, depth = 0; x && depth < 5; x = x.inner ?? x.cause, depth++) {
    const name = String(x.name || '')
    const msg = String(x.message || '')
    if (name === 'QuotaExceededError' || /quota|full disk|no space|ENOSPC/i.test(msg)) return true
  }
  return false
}

let persisted: boolean | null = null
/**
 * Asks the browser to keep this app's storage even when the disk runs low (otherwise it is "best effort" and may be
 * evicted). Called once at start-up after setup. Resolves true/false, or null where the browser cannot tell.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    const sm = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!sm?.persist) return (persisted = null)
    persisted = (await sm.persisted?.()) || (await sm.persist())
    return persisted
  } catch { return (persisted = null) }
}
/** The answer of requestPersistentStorage() (null before it ran, or where unknown). */
export const storagePersisted = () => persisted

/** Bytes this app may still store, from the browser's estimate; null when the browser does not say. */
export async function storageAvailable(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e || typeof e.quota !== 'number' || typeof e.usage !== 'number') return null
    return Math.max(0, e.quota - e.usage)
  } catch { return null }
}
