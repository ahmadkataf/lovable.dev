// Backup and restore: the whole database as one JSON file, plus the "delete everything" reset.
// The file is { app: 'kasher', version: 1, exportedAt, tables: { <name>: rows[] } } for every name in TABLES.
import { db, TABLES, ensureDefaults, type TableName } from '../db'

export const BACKUP_APP = 'kasher'
export const BACKUP_VERSION = 1
/** db.kv key holding the time of the last successful export. */
export const BACKUP_LAST_KEY = 'backup.last'
/** After this many days without a backup the settings page shows a reminder. */
export const BACKUP_REMIND_DAYS = 7
const CHUNK = 500

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: number
  appVersion?: string
  tables: Partial<Record<TableName, unknown[]>>
}
export type BackupCounts = Record<TableName, number>
export type BackupError = 'invalid_json' | 'not_kasher' | 'version' | 'no_tables' | 'bad_rows'
export interface BackupValidation {
  ok: boolean
  counts: BackupCounts
  total: number
  exportedAt?: number
  appVersion?: string
  error?: BackupError
  /** The parsed file when ok. */
  data?: BackupFile
}

function appVersion(): string {
  try { return typeof __POS_VERSION__ === 'string' ? __POS_VERSION__ : 'dev' } catch { return 'dev' }
}
const emptyCounts = (): BackupCounts => Object.fromEntries(TABLES.map(n => [n, 0])) as BackupCounts
const allTables = () => TABLES.map(n => db.table(n))

/** Everything in the database as one JSON string. */
export async function exportBackup(): Promise<string> {
  const tables: Partial<Record<TableName, unknown[]>> = {}
  await db.transaction('r', allTables(), async () => {
    for (const name of TABLES) tables[name] = await db.table(name).toArray()
  })
  const file: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), appVersion: appVersion(), tables }
  return JSON.stringify(file)
}

/** Checks a file before restoring it and counts the rows per table. Never throws. */
export function validateBackup(json: string): BackupValidation {
  const counts = emptyCounts()
  const fail = (error: BackupError): BackupValidation => ({ ok: false, counts, total: 0, error })
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return fail('invalid_json') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail('invalid_json')
  const f = parsed as Record<string, unknown>
  if (f.app !== BACKUP_APP) return fail('not_kasher')
  if (typeof f.version !== 'number' || !Number.isInteger(f.version) || f.version < 1) return fail('not_kasher')
  if (f.version > BACKUP_VERSION) return fail('version')
  if (!f.tables || typeof f.tables !== 'object' || Array.isArray(f.tables)) return fail('no_tables')
  const tables = f.tables as Record<string, unknown>
  let total = 0
  for (const name of TABLES) {
    const rows = tables[name]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) return fail('bad_rows')
    for (const r of rows) if (!r || typeof r !== 'object' || Array.isArray(r)) return fail('bad_rows')
    counts[name] = rows.length
    total += rows.length
  }
  if (total === 0 && TABLES.every(n => tables[n] === undefined)) return fail('no_tables')
  const exportedAt = typeof f.exportedAt === 'number' && Number.isFinite(f.exportedAt) ? f.exportedAt : undefined
  const data: BackupFile = { app: BACKUP_APP, version: f.version, exportedAt: exportedAt ?? 0, appVersion: typeof f.appVersion === 'string' ? f.appVersion : undefined, tables: tables as BackupFile['tables'] }
  return { ok: true, counts, total, exportedAt, appVersion: data.appVersion, data }
}

/**
 * Replaces EVERYTHING with the file's content: one transaction over all tables, each cleared then filled
 * (chunks of 500). Throws with the validation error code when the file is not a Kasher backup.
 */
export async function importBackup(json: string): Promise<BackupCounts> {
  const v = validateBackup(json)
  if (!v.ok || !v.data) throw new Error(v.error ?? 'invalid_json')
  const data = v.data
  await db.transaction('rw', allTables(), async () => {
    for (const name of TABLES) {
      const table = db.table(name)
      await table.clear()
      const rows = data.tables[name] ?? []
      for (let i = 0; i < rows.length; i += CHUNK) await table.bulkPut(rows.slice(i, i + CHUNK))
    }
  })
  // a backup from a broken install could lack users or settings
  await ensureDefaults()
  return v.counts
}

/** Deletes every table, settings and users included, then recreates the defaults (one admin, default settings). */
export async function resetAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const name of TABLES) await db.table(name).clear()
  })
  await ensureDefaults()
}

export async function markBackupDone(at = Date.now()): Promise<void> {
  await db.kv.put({ key: BACKUP_LAST_KEY, value: at })
}
export async function getLastBackup(): Promise<number | null> {
  const row = await db.kv.get(BACKUP_LAST_KEY)
  const v = row?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
/** True when there never was a backup, or the last one is older than BACKUP_REMIND_DAYS. */
export function backupIsStale(last: number | null | undefined, now = Date.now()): boolean {
  if (!last) return true
  return now - last > BACKUP_REMIND_DAYS * 86400000
}
/** kasher-backup-2026-10-09.json (local date). */
export function backupFileName(at = Date.now()): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `kasher-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}
