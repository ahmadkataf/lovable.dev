import { create } from 'zustand'
import { db } from './db'
import { COLLECTIONS, DEFAULT_SETTINGS, DEFAULT_STAFF_PERMISSIONS, SETTINGS_ID, type AuditAction, type AuditEntry, type Base, type CollectionName, type Collections, type Permission, type Settings, type User } from './types'
import { newId } from '../lib/id'
import { platformName } from '../lib/platform'

// The whole shop lives in memory while the app is open (a shop has thousands of records, not millions),
// so searching and reports are instant. Every change is written to the local database at once and
// queued for the sync server.

type Maps = { [K in CollectionName]: Map<string, Collections[K]> }

export interface StoreState extends Maps {
  loaded: boolean
  /** the shop's settings record, merged over the defaults */
  cfg: Settings
  currentUserId: string | null
  /** the highest invoice numbers ever used on this device, deleted ones included: a number is never handed out twice */
  seqFloor: { sales: number; purchases: number }
  /** bumps on every change, so screens that compute derived numbers know when to recompute */
  version: number
}

function emptyMaps(): Maps {
  const m = {} as Maps
  for (const c of COLLECTIONS) (m as any)[c] = new Map()
  return m
}

export const useStore = create<StoreState>(() => ({
  ...emptyMaps(),
  loaded: false,
  cfg: DEFAULT_SETTINGS,
  currentUserId: null,
  seqFloor: { sales: 0, purchases: 0 },
  version: 0,
}))

// The server address and the shop key are device-local: they must not travel to the server or into backups.
const SYNC_KEY = 'alradwan.sync'
export function readLocalSync(): Settings['sync'] { try { return { ...DEFAULT_SETTINGS.sync, ...(JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') as Partial<Settings['sync']>) } } catch { return { ...DEFAULT_SETTINGS.sync } } }
function writeLocalSync(s: Settings['sync']) { localStorage.setItem(SYNC_KEY, JSON.stringify({ url: s.url ?? '', key: s.key ?? '', enabled: !!s.enabled })) }
/** The settings record as kept and sent: without the device-local sync block. */
export function stripSync<T extends { sync?: unknown }>(r: T): Omit<T, 'sync'> { const { sync: _s, ...rest } = r; void _s; return rest }
function mergeSettings(record: Partial<Settings> | undefined): Settings { return { ...DEFAULT_SETTINGS, ...(record ?? {}), sync: readLocalSync() } }

let onChange: (() => void) | null = null
/** Called after every local write (the sync module registers itself here). */
export function setChangeListener(fn: (() => void) | null) { onChange = fn }

export async function loadAll(): Promise<void> {
  const maps = emptyMaps()
  const seqFloor = { sales: 0, purchases: 0 }
  await Promise.all(COLLECTIONS.map(async c => {
    const rows = await db.table<Base>(c).toArray()
    const m = maps[c] as Map<string, Base>
    for (const r of rows) {
      if (!r.deleted) m.set(r.id, r)
      if (c === 'sales' || c === 'purchases') seqFloor[c] = Math.max(seqFloor[c], Number((r as { number?: number }).number) || 0)
    }
  }))
  const stored = maps.settings.get(SETTINGS_ID) as Settings | undefined
  // an older version kept the sync block inside the record: move it to this device and drop it from the record
  if (stored?.sync && (stored.sync.key || stored.sync.url) && !localStorage.getItem(SYNC_KEY)) writeLocalSync(stored.sync)
  const settings = mergeSettings(stored)
  const savedUser = localStorage.getItem('alradwan.user')
  useStore.setState({ ...maps, cfg: settings, seqFloor, loaded: true, currentUserId: savedUser && maps.users.has(savedUser) ? savedUser : null, version: 1 })
}

/** Writes a record locally and queues it for the sync server. Returns the stored record. */
export async function put<K extends CollectionName>(collection: K, record: Omit<Collections[K], 'id' | 'updatedAt'> & Partial<Base>): Promise<Collections[K]> {
  let full = { ...record, id: record.id ?? newId(), updatedAt: Date.now() } as Collections[K]
  if (collection === 'settings') { const s = full as unknown as Settings; if (s.sync) writeLocalSync(s.sync); full = stripSync(s) as unknown as Collections[K] }
  await db.transaction('rw', db.table(collection), db.outbox, async () => {
    await db.table(collection).put(full)
    await db.outbox.put({ key: `${collection}:${full.id}`, collection, id: full.id })
  })
  applyLocal(collection, full)
  onChange?.()
  return full
}

/** Writes several records in one transaction (an invoice with its stock movements, an import…). */
export async function putMany(entries: { collection: CollectionName; record: Base }[]): Promise<void> {
  const now = Date.now()
  const tables = Array.from(new Set(entries.map(e => e.collection))).map(c => db.table(c))
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const e of entries) {
      e.record.updatedAt = now
      await db.table(e.collection).put(e.record)
      await db.outbox.put({ key: `${e.collection}:${e.record.id}`, collection: e.collection, id: e.record.id })
    }
  })
  for (const e of entries) applyLocal(e.collection, e.record, false)
  bump()
  onChange?.()
}

export async function remove(collection: CollectionName, id: string): Promise<void> {
  const existing = (useStore.getState()[collection] as Map<string, Base>).get(id) ?? (await db.table<Base>(collection).get(id))
  if (!existing) return
  const tomb = { ...existing, deleted: true, updatedAt: Date.now() }
  await db.transaction('rw', db.table(collection), db.outbox, async () => {
    await db.table(collection).put(tomb)
    await db.outbox.put({ key: `${collection}:${id}`, collection, id })
  })
  applyLocal(collection, tomb)
  onChange?.()
}

/** Applies a record that came from the sync server (already stored in the database by the sync module). */
export function applyRemote(collection: CollectionName, record: Base) {
  applyLocal(collection, record, false)
}

/** Applies many remote records at once: one new Map per collection instead of one per record. */
export function applyRemoteMany(entries: { collection: CollectionName; record: Base }[]) {
  const state = useStore.getState()
  const maps = new Map<CollectionName, Map<string, Base>>()
  const patch: Partial<StoreState> = {}
  for (const e of entries) {
    let m = maps.get(e.collection)
    if (!m) { m = new Map(state[e.collection] as Map<string, Base>); maps.set(e.collection, m) }
    if (e.record.deleted) m.delete(e.record.id); else m.set(e.record.id, e.record)
    if (e.collection === 'settings' && e.record.id === SETTINGS_ID && !e.record.deleted) patch.cfg = mergeSettings(e.record as Settings)
    if (e.collection === 'users' && e.record.deleted && state.currentUserId === e.record.id) patch.currentUserId = null
  }
  for (const [c, m] of maps) (patch as any)[c] = m
  patch.version = state.version + 1
  useStore.setState(patch)
}

/** The name of this device as it appears in the activity log. */
export function deviceName(): string {
  let d = localStorage.getItem('alradwan.device')
  if (!d) { d = { android: 'هاتف', windows: 'حاسوب', web: 'متصفح' }[platformName()] + '-' + Math.random().toString(36).slice(2, 6); localStorage.setItem('alradwan.device', d) }
  return d
}

/** An activity-log record, ready to be written with the operation it describes. */
export function auditEntry(action: AuditAction, summary: string, collection?: CollectionName, refId?: string): AuditEntry {
  const s = useStore.getState()
  const u = s.currentUserId ? s.users.get(s.currentUserId) : undefined
  return { id: newId(), updatedAt: 0, date: Date.now(), userId: u?.id, userName: u?.name ?? 'بدون مستخدم', action, collection, refId, summary, device: deviceName() }
}

export async function audit(action: AuditAction, summary: string, collection?: CollectionName, refId?: string): Promise<void> {
  await put('audit', auditEntry(action, summary, collection, refId))
}

function applyLocal(collection: CollectionName, record: Base, notify = true) {
  const state = useStore.getState()
  const m = new Map(state[collection] as Map<string, Base>)
  if (record.deleted) m.delete(record.id); else m.set(record.id, record)
  const patch: Partial<StoreState> = { [collection]: m } as any
  if (collection === 'settings' && record.id === SETTINGS_ID && !record.deleted) patch.cfg = mergeSettings(record as Settings)
  if (collection === 'users' && record.deleted && state.currentUserId === record.id) patch.currentUserId = null
  if (notify) patch.version = state.version + 1
  useStore.setState(patch)
}

export function bump() { useStore.setState(s => ({ version: s.version + 1 })) }

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = useStore.getState().cfg
  await put('settings', { ...current, ...patch, id: SETTINGS_ID })
}

export function setCurrentUser(id: string | null) {
  if (id) localStorage.setItem('alradwan.user', id); else localStorage.removeItem('alradwan.user')
  useStore.setState({ currentUserId: id })
}
/** Locks the screen (logout): the next person must enter their own PIN. */
export async function logout(reason: 'manual' | 'auto' = 'manual'): Promise<void> {
  const s = useStore.getState()
  const u = s.currentUserId ? s.users.get(s.currentUserId) : null
  if (u) await audit('logout', reason === 'auto' ? `قفل تلقائي بعد خمول — ${u.name}` : `تسجيل خروج ${u.name}`, 'users', u.id).catch(() => {})
  setCurrentUser(null)
}

/** Wipes everything on this device (used before restoring a backup). */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear() })
  useStore.setState({ ...emptyMaps(), cfg: mergeSettings(undefined), currentUserId: null, version: useStore.getState().version + 1 })
}

// ---------- small typed helpers for the screens ----------
export const useCollection = <K extends CollectionName>(name: K) => useStore(s => s[name]) as unknown as Map<string, Collections[K]>
export const useSettings = () => useStore(s => s.cfg)
export const useCurrentUser = () => useStore(s => (s.currentUserId ? s.users.get(s.currentUserId) ?? null : null))
export const useIsAdmin = () => useStore(s => {
  if (s.users.size === 0) return true
  const u = s.currentUserId ? s.users.get(s.currentUserId) : null
  return u?.role === 'admin'
})
/** Whether a user may do something: the admin may do everything; a staff member what the admin ticked
 *  (or the default for that permission; the two old shop-wide switches still count as defaults). */
export function userCan(u: User | null | undefined, perm: Permission, cfg: Settings, noUsers = false): boolean {
  if (noUsers) return true
  if (!u) return false
  if (u.role === 'admin') return true
  const v = u.permissions?.[perm]
  if (v !== undefined) return v
  if (perm === 'seeCost') return !!cfg.staffSeesCost
  if (perm === 'editPrices') return !!cfg.staffEditsPrices
  return DEFAULT_STAFF_PERMISSIONS[perm]
}
export function can(perm: Permission): boolean {
  const s = useStore.getState()
  return userCan(s.currentUserId ? s.users.get(s.currentUserId) : null, perm, s.cfg, s.users.size === 0)
}
export const usePerm = (perm: Permission) => useStore(s => userCan(s.currentUserId ? s.users.get(s.currentUserId) : null, perm, s.cfg, s.users.size === 0))
export const useCanSeeCost = () => usePerm('seeCost')
