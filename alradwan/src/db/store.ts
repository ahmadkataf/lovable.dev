import { create } from 'zustand'
import { db } from './db'
import { COLLECTIONS, DEFAULT_SETTINGS, SETTINGS_ID, type Base, type CollectionName, type Collections, type Settings } from './types'
import { newId } from '../lib/id'

// The whole shop lives in memory while the app is open (a shop has thousands of records, not millions),
// so searching and reports are instant. Every change is written to the local database at once and
// queued for the sync server.

type Maps = { [K in CollectionName]: Map<string, Collections[K]> }

export interface StoreState extends Maps {
  loaded: boolean
  /** the shop's settings record, merged over the defaults */
  cfg: Settings
  currentUserId: string | null
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
  version: 0,
}))

let onChange: (() => void) | null = null
/** Called after every local write (the sync module registers itself here). */
export function setChangeListener(fn: (() => void) | null) { onChange = fn }

export async function loadAll(): Promise<void> {
  const maps = emptyMaps()
  await Promise.all(COLLECTIONS.map(async c => {
    const rows = await db.table<Base>(c).toArray()
    const m = maps[c] as Map<string, Base>
    for (const r of rows) if (!r.deleted) m.set(r.id, r)
  }))
  const settings = { ...DEFAULT_SETTINGS, ...(maps.settings.get(SETTINGS_ID) ?? {}) } as Settings
  settings.sync = { ...DEFAULT_SETTINGS.sync, ...(settings.sync ?? {}) }
  const savedUser = localStorage.getItem('alradwan.user')
  useStore.setState({ ...maps, cfg: settings, loaded: true, currentUserId: savedUser && maps.users.has(savedUser) ? savedUser : null, version: 1 })
}

/** Writes a record locally and queues it for the sync server. Returns the stored record. */
export async function put<K extends CollectionName>(collection: K, record: Omit<Collections[K], 'id' | 'updatedAt'> & Partial<Base>): Promise<Collections[K]> {
  const full = { ...record, id: record.id ?? newId(), updatedAt: Date.now() } as Collections[K]
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

function applyLocal(collection: CollectionName, record: Base, notify = true) {
  const state = useStore.getState()
  const m = new Map(state[collection] as Map<string, Base>)
  if (record.deleted) m.delete(record.id); else m.set(record.id, record)
  const patch: Partial<StoreState> = { [collection]: m } as any
  if (collection === 'settings' && record.id === SETTINGS_ID && !record.deleted) patch.cfg = { ...DEFAULT_SETTINGS, ...(record as Settings) }
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

/** Wipes everything on this device (used before restoring a backup). */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear() })
  useStore.setState({ ...emptyMaps(), cfg: DEFAULT_SETTINGS, currentUserId: null, version: useStore.getState().version + 1 })
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
export const useCanSeeCost = () => useStore(s => {
  if (s.users.size === 0) return true
  const u = s.currentUserId ? s.users.get(s.currentUserId) : null
  return u?.role === 'admin' || s.cfg.staffSeesCost
})
