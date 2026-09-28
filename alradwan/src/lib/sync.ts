import { db } from '../db/db'
import { applyRemote, bump, setChangeListener, useStore } from '../db/store'
import type { Base, CollectionName } from '../db/types'
import { COLLECTIONS } from '../db/types'

// Sync with the shop's server (alradwan/server): the device sends the records it changed, and receives
// the records other devices changed since its last visit. Where two devices changed the same record,
// the newer change wins — on the server and on every device alike, so they all end up identical.

export interface SyncChange { collection: CollectionName; id: string; updatedAt: number; deleted: boolean; data: Base }
export interface SyncStatus { state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'; lastSync: number | null; pending: number; error?: string }

const listeners = new Set<(s: SyncStatus) => void>()
let status: SyncStatus = { state: 'off', lastSync: null, pending: 0 }
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let again = false

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void { listeners.add(fn); fn(status); return () => { listeners.delete(fn) } }
function set(patch: Partial<SyncStatus>) { status = { ...status, ...patch }; listeners.forEach(l => l(status)) }
export function getSyncStatus() { return status }

async function pendingCount() { return db.outbox.count() }

export async function initSync() {
  const last = (await db.meta.get('lastSync'))?.value as number | undefined
  set({ lastSync: last ?? null, pending: await pendingCount(), state: configured() ? 'idle' : 'off' })
  setChangeListener(() => { pendingCount().then(n => set({ pending: n })); schedule(3000) })
  window.addEventListener('online', () => schedule(500))
  setInterval(() => { if (configured() && navigator.onLine) syncNow().catch(() => {}) }, 60000)
  if (configured()) schedule(500)
}

function configured(): boolean {
  const s = useStore.getState().cfg.sync
  return !!(s?.enabled && s.url && s.key)
}

export function schedule(ms: number) {
  if (!configured()) { set({ state: 'off' }); return }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; syncNow().catch(() => {}) }, ms)
}

/** One round trip: push what changed here, pull what changed elsewhere. */
export async function syncNow(): Promise<{ sent: number; received: number }> {
  if (!configured()) { set({ state: 'off' }); return { sent: 0, received: 0 } }
  if (running) { again = true; return { sent: 0, received: 0 } }
  if (!navigator.onLine) { set({ state: 'offline' }); return { sent: 0, received: 0 } }
  running = true
  set({ state: 'syncing', error: undefined })
  try {
    const { url, key } = useStore.getState().cfg.sync
    const since = ((await db.meta.get('seq'))?.value as number | undefined) ?? 0
    const outbox = await db.outbox.toArray()
    const changes: SyncChange[] = []
    for (const o of outbox) {
      const rec = await db.table<Base>(o.collection).get(o.id)
      if (rec) changes.push({ collection: o.collection, id: o.id, updatedAt: rec.updatedAt, deleted: !!rec.deleted, data: rec })
    }
    const res = await fetch(url.replace(/\/$/, '') + '/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ since, changes }),
    })
    if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح المزامنة غير صحيح' : `الخادم رفض الطلب (${res.status})`)
    const body = (await res.json()) as { seq: number; more?: boolean; changes: SyncChange[] }
    // what we sent is now on the server
    await db.outbox.bulkDelete(outbox.map(o => o.key))
    let received = 0
    const incoming = body.changes.filter(c => COLLECTIONS.includes(c.collection))
    if (incoming.length) {
      const tables = Array.from(new Set(incoming.map(c => c.collection))).map(c => db.table(c))
      const applied: SyncChange[] = []
      await db.transaction('rw', tables, async () => {
        for (const c of incoming) {
          const local = await db.table<Base>(c.collection).get(c.id)
          if (local && local.updatedAt >= c.updatedAt) continue
          const rec = { ...c.data, id: c.id, updatedAt: c.updatedAt, deleted: c.deleted || undefined }
          await db.table(c.collection).put(rec)
          applied.push({ ...c, data: rec })
        }
      })
      for (const c of applied) applyRemote(c.collection, c.data)
      received = applied.length
      if (applied.length) bump()
    }
    const now = Date.now()
    await db.meta.bulkPut([{ key: 'seq', value: body.seq }, { key: 'lastSync', value: now }])
    set({ state: 'idle', lastSync: now, pending: await pendingCount() })
    // a fresh device gets a large shop in pages: keep going until the server says there is no more
    if (body.more) again = true
    return { sent: changes.length, received }
  } catch (e) {
    const msg = e instanceof TypeError ? 'تعذّر الوصول إلى الخادم' : (e as Error).message
    set({ state: 'error', error: msg, pending: await pendingCount() })
    throw e
  } finally {
    running = false
    if (again) { again = false; schedule(1000) }
  }
}

/** After changing the server or the key: forget where we were, so the next sync fetches everything. */
export async function resetSyncCursor() {
  await db.meta.delete('seq')
  // and resend everything we have, so a fresh server gets the whole shop
  const entries: { key: string; collection: CollectionName; id: string }[] = []
  for (const c of COLLECTIONS) {
    const ids = (await db.table<Base>(c).toCollection().primaryKeys()) as string[]
    for (const id of ids) entries.push({ key: `${c}:${id}`, collection: c, id })
  }
  await db.outbox.bulkPut(entries)
  set({ pending: entries.length, state: configured() ? 'idle' : 'off' })
}

export async function testConnection(url: string, key: string): Promise<string> {
  const res = await fetch(url.replace(/\/$/, '') + '/api/ping', { headers: { authorization: 'Bearer ' + key } })
  if (res.status === 401) throw new Error('مفتاح المحل غير صحيح')
  if (!res.ok) throw new Error(`الخادم أجاب بخطأ (${res.status})`)
  const b = await res.json() as { ok: boolean; records: number }
  return `الاتصال ناجح — على الخادم ${b.records} سجل`
}
