import { db } from '../db/db'
import { clearAll, loadAll } from '../db/store'
import { COLLECTIONS, type Base, type CollectionName } from '../db/types'
import { fmtDate } from './format'
import { saveFile } from './platform'
import { decryptText, encryptText, isEncrypted } from './crypto'

// A backup is one JSON file with every record. Restoring replaces this device's data with the file's.

export interface Backup { app: 'alradwan-garage'; version: 1; exportedAt: number; data: Record<CollectionName, Base[]> }

export async function makeBackup(): Promise<Backup> {
  const data = {} as Record<CollectionName, Base[]>
  for (const c of COLLECTIONS) data[c] = await db.table<Base>(c).toArray()
  return { app: 'alradwan-garage', version: 1, exportedAt: Date.now(), data }
}

/** Writes the backup file; with a password it is encrypted (AES-256-GCM) and unreadable without it. */
export async function downloadBackup(password?: string): Promise<void> {
  const b = await makeBackup()
  const date = fmtDate(Date.now()).replaceAll('/', '-')
  let text = JSON.stringify(b)
  if (password) text = await encryptText(text, password)
  await saveFile(`نسخة-احتياطية-كراج-الرضوان-${date}${password ? '-مشفرة' : ''}.json`, text, 'application/json')
  localStorage.setItem('alradwan.lastBackup', String(Date.now()))
}

export function backupIsEncrypted(text: string): boolean { return isEncrypted(text) }

/** Reads a backup file; `password` is needed only for an encrypted one. */
export async function parseBackup(text: string, password?: string): Promise<Backup> {
  let raw = text
  if (isEncrypted(text)) {
    if (!password) throw new Error('هذه النسخة مشفّرة: أدخل كلمة السر')
    raw = await decryptText(text, password)
  }
  const b = JSON.parse(raw)
  if (b?.app !== 'alradwan-garage' || !b.data) throw new Error('هذا الملف ليس نسخة احتياطية من كراج الرضوان')
  return b as Backup
}

/** Days since the last backup taken from this device (∞ when none). */
export function daysSinceBackup(): number {
  const t = Number(localStorage.getItem('alradwan.lastBackup')) || 0
  return t ? Math.floor((Date.now() - t) / 86400000) : Infinity
}

/** On Windows the app keeps a silent daily copy in its own folder (the last 14 days), so a mistake or a crash
 *  never costs more than a day even if nobody remembers to back up. */
export async function autoBackupIfDue(): Promise<void> {
  if (!window.garageDesktop?.autoBackup) return
  const today = fmtDate(Date.now())
  if (localStorage.getItem('alradwan.autoBackupDay') === today) return
  const b = await makeBackup()
  const ok = await window.garageDesktop.autoBackup(`auto-${today.replaceAll('/', '-')}.json`, JSON.stringify(b))
  if (ok) localStorage.setItem('alradwan.autoBackupDay', today)
}

export function countBackup(b: Backup): number {
  return COLLECTIONS.reduce((n, c) => n + (b.data[c]?.filter(r => !r.deleted).length ?? 0), 0)
}

export async function restoreBackup(b: Backup): Promise<void> {
  await clearAll()
  const tables = COLLECTIONS.map(c => db.table(c))
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const c of COLLECTIONS) {
      const rows = b.data[c] ?? []
      if (rows.length) {
        await db.table(c).bulkPut(rows)
        await db.outbox.bulkPut(rows.map(r => ({ key: `${c}:${r.id}`, collection: c, id: r.id })))
      }
    }
  })
  await loadAll()
}

/** Merges a backup into the existing data (newest record wins) instead of replacing it. */
export async function mergeBackup(b: Backup): Promise<number> {
  let n = 0
  const tables = COLLECTIONS.map(c => db.table(c))
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const c of COLLECTIONS) {
      for (const r of b.data[c] ?? []) {
        const local = await db.table<Base>(c).get(r.id)
        if (local && local.updatedAt >= r.updatedAt) continue
        await db.table(c).put(r)
        await db.outbox.put({ key: `${c}:${r.id}`, collection: c, id: r.id })
        n++
      }
    }
  })
  await loadAll()
  return n
}
