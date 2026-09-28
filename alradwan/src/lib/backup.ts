import { db } from '../db/db'
import { clearAll, loadAll } from '../db/store'
import { COLLECTIONS, type Base, type CollectionName } from '../db/types'
import { fmtDate } from './format'
import { saveFile } from './platform'

// A backup is one JSON file with every record. Restoring replaces this device's data with the file's.

export interface Backup { app: 'alradwan-garage'; version: 1; exportedAt: number; data: Record<CollectionName, Base[]> }

export async function makeBackup(): Promise<Backup> {
  const data = {} as Record<CollectionName, Base[]>
  for (const c of COLLECTIONS) data[c] = await db.table<Base>(c).toArray()
  return { app: 'alradwan-garage', version: 1, exportedAt: Date.now(), data }
}

export async function downloadBackup(): Promise<void> {
  const b = await makeBackup()
  const name = `نسخة-احتياطية-كراج-الرضوان-${fmtDate(Date.now()).replaceAll('/', '-')}.json`
  await saveFile(name, JSON.stringify(b), 'application/json')
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text)
  if (b?.app !== 'alradwan-garage' || !b.data) throw new Error('هذا الملف ليس نسخة احتياطية من كراج الرضوان')
  return b as Backup
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
