import { db } from '../db/db'
import { loadAll, put, stripSync, useStore } from '../db/store'
import { COLLECTIONS, SETTINGS_ID, type Base, type CollectionName, type Settings } from '../db/types'
import { toInputDate } from './format'
import { saveFile } from './platform'
import { decryptText, encryptText, isEncrypted } from './crypto'

// A backup is one JSON file with every record. Restoring replaces this device's data with the file's.

export interface Backup { app: 'alradwan-garage'; version: 1; exportedAt: number; data: Record<CollectionName, Base[]> }

export async function makeBackup(): Promise<Backup> {
  const data = {} as Record<CollectionName, Base[]>
  for (const c of COLLECTIONS) data[c] = await db.table<Base>(c).toArray()
  data.settings = data.settings.map(r => stripSync(r as Settings) as Base)
  return { app: 'alradwan-garage', version: 1, exportedAt: Date.now(), data }
}

/** Writes the backup file; with a password it is encrypted (AES-256-GCM) and unreadable without it. */
export async function downloadBackup(password?: string): Promise<void> {
  const b = await makeBackup()
  const date = toInputDate(Date.now())
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
  const today = toInputDate(Date.now())
  if (localStorage.getItem('alradwan.autoBackupDay') === today) return
  const b = await makeBackup()
  const ok = await window.garageDesktop.autoBackup(`auto-${today}.json`, JSON.stringify(b))
  if (ok) localStorage.setItem('alradwan.autoBackupDay', today)
}

export function countBackup(b: Backup): number {
  return COLLECTIONS.reduce((n, c) => n + (b.data[c]?.filter(r => !r.deleted).length ?? 0), 0)
}

/** Every row must look like a record before anything is replaced: a damaged file must not empty the shop. */
export function validateBackup(b: Backup): { rows: number; problems: string[] } {
  const problems: string[] = []
  let rows = 0
  for (const c of COLLECTIONS) {
    const list = b.data[c]
    if (list === undefined) continue
    if (!Array.isArray(list)) { problems.push(`${c}: ليس قائمة`); continue }
    list.forEach((r, i) => {
      if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || typeof r.updatedAt !== 'number') problems.push(`${c} #${i + 1}: سجل تالف`)
      else rows++
    })
  }
  if (problems.length > 5) problems.splice(5, problems.length - 5, '…')
  return { rows, problems }
}

export async function restoreBackup(b: Backup): Promise<void> {
  const { problems } = validateBackup(b)
  if (problems.length) throw new Error('الملف تالف ولم يُلمس شيء: ' + problems.join('، '))
  const tables = COLLECTIONS.map(c => db.table(c))
  const localSync = useStore.getState().cfg.sync
  await db.transaction('rw', [...tables, db.outbox, db.meta], async () => {
    for (const t of tables) await t.clear()
    await db.outbox.clear(); await db.meta.clear()
    for (const c of COLLECTIONS) {
      const rows = (b.data[c] ?? []).map(r => (c === 'settings' ? (stripSync(r as Settings) as Base) : r))
      if (rows.length) {
        await db.table(c).bulkPut(rows)
        await db.outbox.bulkPut(rows.map(r => ({ key: `${c}:${r.id}`, collection: c, id: r.id })))
      }
    }
  })
  await loadAll()
  // the device keeps its own server connection
  if (localSync.key) await put('settings', { ...useStore.getState().cfg, sync: localSync, id: SETTINGS_ID })
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
