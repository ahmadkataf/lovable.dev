import { db } from '../db/db'
import { applyRemoteMany, setChangeListener, stripSync, useStore } from '../db/store'
import type { Base, CollectionName, Settings } from '../db/types'
import { COLLECTIONS } from '../db/types'

// Sync with the shop's server (alradwan/server): the device sends the records it changed, and receives
// the records other devices changed since its last visit. Where two devices changed the same record,
// the newer change wins — on the server and on every device alike, so they all end up identical.

export interface SyncChange { collection: CollectionName; id: string; updatedAt: number; deleted: boolean; data: Base }
export interface SyncStatus { state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'; lastSync: number | null; pending: number; error?: string; clockSkew?: number }

const PAGE = 400
let pageBytes = 2 * 1024 * 1024    // a page of the outbox is at most this big; halved when the server says 413
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
  setInterval(() => { if (configured()) syncNow().catch(() => {}) }, 60000)
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
  running = true
  set({ state: 'syncing', error: undefined })
  try {
    const { url, key } = useStore.getState().cfg.sync
    const since = ((await db.meta.get('seq'))?.value as number | undefined) ?? 0
    // one page of the outbox per request (the server caps a request), the rest follows in the next round
    const all = await db.outbox.toArray()
    const outbox: typeof all = []
    const changes: SyncChange[] = []
    let bytes = 0
    for (const o of all) {
      if (outbox.length >= PAGE) break
      const rec = await db.table<Base>(o.collection).get(o.id)
      if (!rec) { await db.outbox.delete(o.key); continue }
      const change: SyncChange = { collection: o.collection, id: o.id, updatedAt: rec.updatedAt, deleted: !!rec.deleted, data: o.collection === 'settings' ? (stripSync(rec as Settings) as Base) : rec }
      const size = JSON.stringify(change).length
      if (outbox.length && bytes + size > pageBytes) break   // a page is cut by size (photos), never below one record
      outbox.push(o); changes.push(change); bytes += size
    }
    const res = await fetch(url.replace(/\/$/, '') + '/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ since, changes }),
    })
    if (res.status === 413 && changes.length > 1) { pageBytes = Math.max(64 * 1024, Math.floor(pageBytes / 2)); again = true; throw new Error('الدفعة كبيرة: ستُرسل على دفعات أصغر') }
    if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح المزامنة غير صحيح' : res.status === 429 ? 'محاولات كثيرة: سيُعاد الاتصال لاحقاً' : `الخادم رفض الطلب (${res.status})`)
    const body = (await res.json()) as { seq: number; more?: boolean; changes: SyncChange[]; serverTime?: number }
    // what we sent is now on the server — unless the record changed again here while the request was in flight
    const sentAt = new Map(changes.map(c => [`${c.collection}:${c.id}`, c.updatedAt]))
    const doneKeys: string[] = []
    await db.transaction('rw', [...outbox.map(o => db.table(o.collection)), db.outbox], async () => {
      for (const o of outbox) {
        const now = await db.table<Base>(o.collection).get(o.id)
        if (!now || now.updatedAt <= (sentAt.get(o.key) ?? 0)) doneKeys.push(o.key)
      }
      await db.outbox.bulkDelete(doneKeys)
    })
    let received = 0
    const incoming = body.changes.filter(c => COLLECTIONS.includes(c.collection))
    if (incoming.length) {
      const tables = Array.from(new Set(incoming.map(c => c.collection))).map(c => db.table(c))
      const applied: { collection: CollectionName; record: Base }[] = []
      await db.transaction('rw', tables, async () => {
        for (const c of incoming) {
          const local = await db.table<Base>(c.collection).get(c.id)
          if (local && local.updatedAt >= c.updatedAt) continue
          const rec = { ...(c.collection === 'settings' ? stripSync(c.data as Settings) : c.data), id: c.id, updatedAt: c.updatedAt, deleted: c.deleted || undefined } as Base
          await db.table(c.collection).put(rec)
          applied.push({ collection: c.collection, record: rec })
        }
      })
      if (applied.length) applyRemoteMany(applied)
      received = applied.length
    }
    // the newest change wins by its clock, so a device whose clock is wrong would always win or always lose
    const skew = body.serverTime ? Date.now() - body.serverTime : 0
    set({ clockSkew: Math.abs(skew) > 5 * 60000 ? skew : undefined })
    const now = Date.now()
    await db.meta.bulkPut([{ key: 'seq', value: body.seq }, { key: 'lastSync', value: now }])
    set({ state: 'idle', lastSync: now, pending: await pendingCount() })
    // a fresh device gets a large shop in pages, and a long outbox goes up in pages: keep going until both are done
    if (body.more || (await pendingCount()) > 0) again = true
    return { sent: changes.length, received }
  } catch (e) {
    // a request that never reached the server (no connection) is "offline", not an error: it retries by itself
    if (e instanceof TypeError || (e as Error).name === 'AbortError') set({ state: 'offline', pending: await pendingCount() })
    else set({ state: 'error', error: (e as Error).message, pending: await pendingCount() })
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

export function validateSyncUrl(url: string): string | null {
  const u = url.trim()
  if (!u) return 'أدخل عنوان الخادم'
  try {
    const p = new URL(u)
    if (p.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(p.hostname)) return 'العنوان يجب أن يبدأ بـ https:// حتى تبقى بياناتك مشفّرة على الطريق'
  } catch { return 'العنوان غير صحيح' }
  return null
}

export async function testConnection(url: string, key: string): Promise<string> {
  const bad = validateSyncUrl(url)
  if (bad) throw new Error(bad)
  if (key.trim().length < 12) throw new Error('مفتاح المحل قصير: استخدم 12 حرفاً على الأقل (زر «توليد مفتاح» يعطيك مفتاحاً قوياً)')
  const res = await fetch(url.replace(/\/$/, '') + '/api/ping', { headers: { authorization: 'Bearer ' + key } })
  if (res.status === 401) throw new Error('مفتاح المحل غير صحيح')
  if (res.status === 429) throw new Error('محاولات كثيرة: انتظر قليلاً ثم أعد المحاولة')
  if (!res.ok) throw new Error(`الخادم أجاب بخطأ (${res.status})`)
  const b = await res.json() as { ok: boolean; records: number; known?: boolean }
  // an unknown key is not a success: no device has saved it yet, so there is nothing to receive
  if (b.known === false) throw new Error('لا يوجد محل بهذا المفتاح على الخادم بعد. إن كنت تنقل البيانات من جهاز آخر: افتح المزامنة على ذلك الجهاز، تأكد أن «مزامنة تلقائية» مفعّلة واضغط «حفظ» هناك، ثم انسخ مفتاحه من جديد.')
  return `الاتصال ناجح: محلك موجود على الخادم وفيه ${b.records} سجل`
}
