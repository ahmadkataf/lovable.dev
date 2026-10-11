// Backup, restore and reset with the database. The checks themselves are pure and live in ./lib.
import { db, exportBackup, importBackup, logActivity, resetDatabase, setSetting } from '@/db'
import { nowISO } from '@/db/ids'
import type { BackupFile, Setting } from '@/db/types'
import { saveText } from '@/platform'
import { backupFileName, DEVICE_SETTING_KEYS } from './lib'

/** Every table → a JSON file the user saves. Returns the file name, or null when the save dialog was cancelled. */
export async function exportBackupFile(message: string, by?: string): Promise<string | null> {
  const data = await exportBackup()
  const name = backupFileName()
  const ok = await saveText(name, JSON.stringify(data))
  if (!ok) return null
  await setSetting('lastBackupAt', nowISO())
  void logActivity({ type: 'system', action: 'backup', message, by })
  return name
}

/** This installation's own settings (activation, trial start), so a restore or a reset never takes them away. */
async function deviceSettings(extra: string[] = []): Promise<Setting[]> {
  const rows = await db.settings.bulkGet([...DEVICE_SETTING_KEYS, ...extra])
  return rows.filter((r): r is Setting => !!r)
}
async function putBack(rows: Setting[]): Promise<void> {
  if (rows.length) await db.settings.bulkPut(rows)
}

/** Replaces everything with the backup, keeping this device's activation (and the date of its last export). */
export async function restoreBackup(data: BackupFile): Promise<{ tables: number; rows: number }> {
  const keep = await deviceSettings(['lastBackupAt'])
  const r = await importBackup(data)
  await putBack(keep)
  return r
}

/** Wipes the clinic (keeping this device's activation) and signs out, ready for the setup wizard. */
export async function eraseEverything(): Promise<void> {
  const keep = await deviceSettings()
  await resetDatabase()
  await putBack(keep)
  try { localStorage.removeItem('dentora.session') } catch { /* ignore */ }
}

/** Reloads the app on the given route (after a restore or a reset nothing in memory is valid any more). */
export function restartApp(route = '/'): void {
  window.location.hash = `#${route}`
  window.location.reload()
}
