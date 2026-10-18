// Backup, restore and reset with the database. The archive format lives in ./backup/archive, the checks of the old
// JSON format in ./lib. A backup is recorded as done only after the platform confirmed the whole file was written.
import { importBackup, isQuotaError, logActivity, resetDatabase, setSetting, storageAvailable } from '@/db'
import { nowISO } from '@/db/ids'
import type { BackupFile } from '@/db/types'
import { saveStream, type SaveStreamOptions } from '@/platform'
import { clearSession } from '@/app/session'
import { DEVICE_SETTING_KEYS } from './lib'
import { archiveFileName, BACKUP_MIME, BackupError, estimateBackupSize, snapshotDatabase, writeBackup, type BackupProgress } from './backup/archive'

export interface ExportOptions {
  password?: string
  signal?: AbortSignal
  onProgress?: (p: BackupProgress) => void
  /** Every byte is written; the file is being put in place (Android: the "save as" screen is open). */
  onFinishing?: () => void
}
export interface ExportResult { name: string; bytes: number; files: number }

/**
 * Writes the whole clinic to a backup file the user keeps. Returns the saved file's name and size, or null when the
 * save dialog was cancelled. Throws SaveError (disk full, verification failed…) or the error that stopped it.
 */
export async function exportBackupFile(message: string, by?: string, opts: ExportOptions = {}): Promise<ExportResult | null> {
  const snap = await snapshotDatabase()
  let files = 0
  const save: SaveStreamOptions = { sizeHint: estimateBackupSize(snap), signal: opts.signal, quiet: true, onFinishing: opts.onFinishing }
  const r = await saveStream(archiveFileName(), BACKUP_MIME, async write => {
    files = (await writeBackup(snap, write, { password: opts.password, signal: opts.signal, onProgress: opts.onProgress })).files
  }, save)
  if (r.status !== 'saved') return null
  // only now, with the file confirmed on disk
  await setSetting('lastBackupAt', nowISO())
  void logActivity({ type: 'system', action: 'backup', message, by })
  return { name: r.name, bytes: r.bytes, files }
}

/**
 * Replaces everything with a backup prepared by readBackup() (or an old in-memory one), all at once or not at all.
 * Keeps this device's activation and never moves the trial start later (see mergeDeviceSettings in @/db).
 * `neededBytes`: about how much the restore will store, checked against the free space first.
 */
export async function restoreBackup(data: BackupFile, opts: { neededBytes?: number } = {}): Promise<{ tables: number; rows: number; skippedFiles: number }> {
  if (opts.neededBytes) {
    const free = await storageAvailable()
    if (free !== null && free < opts.neededBytes * 1.1 + 32 * 1024 * 1024) throw new BackupError('space')
  }
  try {
    return await importBackup(data)
  } catch (e) {
    if (isQuotaError(e)) throw new BackupError('space')
    throw e
  }
}

/** Wipes the clinic (keeping this device's activation, trial start and licence clock, in the same transaction) and signs out. */
export async function eraseEverything(): Promise<void> {
  await resetDatabase(DEVICE_SETTING_KEYS)
  clearSession()
}

/** Reloads the app on the given route (after a restore or a reset nothing in memory is valid any more). */
export function restartApp(route = '/'): void {
  window.location.hash = `#${route}`
  window.location.reload()
}
