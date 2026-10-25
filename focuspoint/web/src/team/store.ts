// Offline-first store for the team panel.
//
//  base   = what the server last told us (rooms, bookings, settings) + the sync cursor — persisted in IndexedDB.
//  queue  = changes made on this device that the server has not accepted yet (SyncOp + status) — persisted first, always.
//  view   = base with every queued op applied on top (pure, derived) — what the screens render.
//
// Every mutation appends a SyncOp with a client_id (UUID) and re-derives the view immediately (optimistic UI).
// The sync loop pushes the queue with POST /v1/team/sync whenever we are online (on load, on 'online', every 30 s,
// after each new op), applies the results (temp ids → real ids, failures flagged "يحتاج انتباه"), then pulls
// GET /v1/team/sync?since=<cursor> and merges. A queued op is only removed when the server has answered for it.
//
// Live updates while the panel is open: a Web Push forwarded by the service worker (postMessage) triggers an immediate
// pull, a chime and a 60-second "جديد" mark on the booking; in between, GET /v1/team/ping every 5 s (visible tab only)
// pulls as soon as the server's last_change moves.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ApiContract, Booking, PushMessage, Room, Settings, SyncOp, SyncResult } from '@shared/types'
import { api, ApiError } from '../api'
import { setTimeZone } from '../format'
import { cache } from '../offline'
import { onPushMessage } from '../lib/push'
import { playChime } from './sound'
import { describeError, isPendingVerification, isTemp, tempId, uuid } from './util'

type ManualBookingReq = ApiContract['POST /v1/team/bookings/manual']['req']
type EditBookingReq = ApiContract['PATCH /v1/team/bookings/:id']['req']
type SyncPull = ApiContract['GET /v1/team/sync?since=<iso>']['res']
type SyncPush = ApiContract['POST /v1/team/sync']['res']
type Ping = ApiContract['GET /v1/team/ping']['res']

const PING_MS = 5_000
const FRESH_MS = 60_000

export interface QueuedOp {
  op: SyncOp
  label: string                 // short Arabic description for the sync sheet
  status: 'pending' | 'failed'
  error?: string                // server error code when failed
  attempts: number
  created_at: string
}
export interface Base {
  rooms: Room[]
  bookings: Booking[]
  settings: Settings | null
  cursor: string | null
  pulled_at: string | null
}
export interface View { rooms: Room[]; bookings: Booking[]; settings: Settings | null }
export interface SyncState {
  online: boolean
  syncing: boolean
  pending: number
  failed: number
  error: string | null          // last network/server error (Arabic)
  last_sync: string | null
}
export interface Snapshot {
  ready: boolean                // loaded from IndexedDB (even if empty)
  base: Base
  queue: QueuedOp[]
  view: View
  sync: SyncState
  fresh: number[]               // booking ids that just arrived by push (shown with a "جديد" badge for a minute)
}

const BASE_KEY = 'team:base'
const QUEUE_KEY = 'team:queue'
const KEEP_DAYS = 90
const EMPTY_BASE: Base = { rooms: [], bookings: [], settings: null, cursor: null, pulled_at: null }

// ---------- pure helpers ----------

const roomName = (rooms: Room[], id: number) => rooms.find((r) => r.id === id)?.name

function upsertBy<T extends { id: number }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

/** Apply one queued op on top of a view (optimistic rendering and re-basing after a pull). */
export function applyOp(view: View, op: SyncOp, at: string): View {
  switch (op.op) {
    case 'manual_booking': {
      const d = op.data
      const id = tempId(op.client_id)
      if (view.bookings.some((b) => b.id === id)) return view
      const confirmed = d.method !== 'shamcash'
      const room = view.rooms.find((r) => r.id === d.room_id)
      const b: Booking = {
        id, code: '· · ·', customer_phone: d.phone, customer_name: d.name, device_id: null,
        room_id: d.room_id, start: d.start, end: d.end, status: confirmed ? 'confirmed' : 'pending_payment',
        price: d.price ?? 0, method: d.method, payment_ref: null, paid_at: confirmed ? at : null, verified_by: null,
        note: d.note ?? null, reject_reason: null, people: null, created_at: at, updated_at: at, hold_until: null,
        room_name: room?.name,
      }
      return { ...view, bookings: [...view.bookings, b] }
    }
    case 'confirm':
      return patchBooking(view, op.booking_id, (b) => ({ ...b, status: 'confirmed', paid_at: b.paid_at ?? at, updated_at: at }))
    case 'reject':
      return patchBooking(view, op.booking_id, (b) => ({ ...b, status: 'rejected', reject_reason: op.reason, updated_at: at }))
    case 'cancel':
      return patchBooking(view, op.booking_id, (b) => ({ ...b, status: 'cancelled', updated_at: at }))
    case 'edit_booking':
      return patchBooking(view, op.booking_id, (b) => {
        const next = { ...b, ...op.data, updated_at: at }
        if (op.data.room_id !== undefined) next.room_name = roomName(view.rooms, op.data.room_id) ?? b.room_name
        return next
      })
    case 'room_upsert': {
      const { id, client_room_id: _c, ...fields } = op.room
      if (typeof id === 'number') {
        const existing = view.rooms.find((r) => r.id === id)
        if (!existing) return view
        const room = { ...existing, ...fields } as Room
        const bookings = fields.name ? view.bookings.map((b) => (b.room_id === id ? { ...b, room_name: room.name } : b)) : view.bookings
        return { ...view, rooms: upsertBy(view.rooms, room), bookings }
      }
      const tid = tempId(op.client_id)
      if (view.rooms.some((r) => r.id === tid)) return view
      const room: Room = {
        id: tid, name: fields.name ?? 'قاعة جديدة', type: fields.type ?? 'private', capacity: fields.capacity ?? 1,
        contents: fields.contents ?? { chairs: 1, tables: 1 }, price_hour: fields.price_hour ?? 0, price_day: fields.price_day ?? null,
        color: fields.color ?? null, plan: fields.plan ?? null, active: fields.active ?? 1, sort: fields.sort ?? 0, description: fields.description ?? null,
      }
      return { ...view, rooms: [...view.rooms, room] }
    }
    case 'settings_patch':
      return view.settings ? { ...view, settings: { ...view.settings, ...op.data } } : view
    default:
      return view
  }
}
function patchBooking(view: View, id: number, fn: (b: Booking) => Booking): View {
  const i = view.bookings.findIndex((b) => b.id === id)
  if (i === -1) return view
  const bookings = view.bookings.slice()
  bookings[i] = fn(bookings[i])
  return { ...view, bookings }
}

export function deriveView(base: Base, queue: QueuedOp[]): View {
  let view: View = { rooms: base.rooms, bookings: base.bookings, settings: base.settings }
  for (const q of queue) view = applyOp(view, q.op, q.created_at)
  return view
}

/** Temp (negative) ids an op refers to — it cannot be sent before the op that creates them has been accepted. */
function tempRefs(op: SyncOp): number[] {
  const out: number[] = []
  switch (op.op) {
    case 'manual_booking': if (isTemp(op.data.room_id)) out.push(op.data.room_id); break
    case 'confirm': case 'cancel': case 'reject': if (isTemp(op.booking_id)) out.push(op.booking_id); break
    case 'edit_booking':
      if (isTemp(op.booking_id)) out.push(op.booking_id)
      if (op.data.room_id !== undefined && isTemp(op.data.room_id)) out.push(op.data.room_id)
      break
    case 'room_upsert': if (typeof op.room.id === 'number' && isTemp(op.room.id)) out.push(op.room.id); break
    default: break
  }
  return out
}
/** Does this op create the entity with the given temp id? */
function creates(q: QueuedOp, id: number): boolean {
  const o = q.op
  const creator = o.op === 'manual_booking' || (o.op === 'room_upsert' && typeof o.room.id !== 'number')
  return creator && tempId(o.client_id) === id
}
/** Replace temp ids with the real ones the server handed back. */
function remap(op: SyncOp, map: Map<number, number>): SyncOp {
  const m = (id: number) => map.get(id) ?? id
  switch (op.op) {
    case 'manual_booking': return { ...op, data: { ...op.data, room_id: m(op.data.room_id) } }
    case 'confirm': case 'cancel': case 'reject': return { ...op, booking_id: m(op.booking_id) }
    case 'edit_booking': return { ...op, booking_id: m(op.booking_id), data: op.data.room_id !== undefined ? { ...op.data, room_id: m(op.data.room_id) } : op.data }
    case 'room_upsert': return typeof op.room.id === 'number' ? { ...op, room: { ...op.room, id: m(op.room.id) } } : op
    default: return op
  }
}

// ---------- the store ----------

type Listener = () => void

class TeamStore {
  private base: Base = EMPTY_BASE
  private queue: QueuedOp[] = []
  private ready = false
  private online = typeof navigator === 'undefined' ? true : navigator.onLine
  private syncing = false
  private again = false
  private error: string | null = null
  private lastSync: string | null = null
  private snapshot: Snapshot | null = null
  private listeners = new Set<Listener>()
  private loading: Promise<void> | null = null
  private debounce = 0
  private fresh = new Map<number, number>()     // booking id → timeout handle
  private lastChange: string | null | undefined = undefined   // last_change seen from /v1/team/ping (undefined: never pinged)
  private pingBackoffUntil = 0
  private mismatchSyncAt = 0
  onUnauthorized: (() => void) | null = null

  // ---- subscription ----
  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l) } }
  getSnapshot = (): Snapshot => {
    if (!this.snapshot) {
      this.snapshot = {
        ready: this.ready, base: this.base, queue: this.queue, view: deriveView(this.base, this.queue),
        sync: {
          online: this.online, syncing: this.syncing,
          pending: this.queue.filter((q) => q.status === 'pending').length,
          failed: this.queue.filter((q) => q.status === 'failed').length,
          error: this.error, last_sync: this.lastSync,
        },
        fresh: [...this.fresh.keys()],
      }
    }
    return this.snapshot
  }
  private emit() { this.snapshot = null; this.listeners.forEach((l) => l()) }

  // ---- persistence ----
  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = (async () => {
      const [base, queue] = await Promise.all([cache.get<Base>(BASE_KEY), cache.get<QueuedOp[]>(QUEUE_KEY)])
      if (base && Array.isArray(base.rooms) && Array.isArray(base.bookings)) this.base = { ...EMPTY_BASE, ...base }
      if (Array.isArray(queue)) this.queue = queue.filter((q) => q && q.op && typeof q.op.client_id === 'string')
      setTimeZone(this.base.settings?.timezone)
      this.ready = true
      this.emit()
    })()
    return this.loading
  }
  private persistQueue(): Promise<void> { return cache.set(QUEUE_KEY, this.queue) }
  private persistBase(): Promise<void> { return cache.set(BASE_KEY, this.base) }

  setOnline(v: boolean) {
    if (this.online === v) return
    this.online = v
    if (v) this.error = null
    this.emit()
    if (v) void this.sync()
  }

  // ---- mutations (all optimistic + queued) ----
  private async enqueue(op: SyncOp, label: string): Promise<void> {
    const q: QueuedOp = { op, label, status: 'pending', attempts: 0, created_at: op.at }
    this.queue = [...this.queue, q]
    await this.persistQueue()          // the op is safe on disk before anything else happens
    this.emit()
    window.clearTimeout(this.debounce)
    this.debounce = window.setTimeout(() => void this.sync(), 250)
  }
  /** A fresh client_id + timestamp for a new op. */
  private stamp(): { client_id: string; at: string } { return { client_id: uuid(), at: new Date().toISOString() } }

  /** Walk-in booking. Returns the (temporary) booking id. */
  async manualBooking(data: Omit<ManualBookingReq, 'client_id'>): Promise<number> {
    const base = this.stamp()
    const o: SyncOp = { ...base, op: 'manual_booking', data: { ...data, client_id: base.client_id } }
    await this.enqueue(o, `حجز يدوي — ${data.name}`)
    return tempId(o.client_id)
  }
  confirm(booking: Booking) { return this.enqueue({ ...this.stamp(), op: 'confirm', booking_id: booking.id }, `تأكيد حجز ${booking.customer_name}`) }
  reject(booking: Booking, reason: string) { return this.enqueue({ ...this.stamp(), op: 'reject', booking_id: booking.id, reason }, `رفض حجز ${booking.customer_name}`) }
  cancel(booking: Booking) { return this.enqueue({ ...this.stamp(), op: 'cancel', booking_id: booking.id }, `إلغاء حجز ${booking.customer_name}`) }
  editBooking(booking: Booking, data: EditBookingReq) { return this.enqueue({ ...this.stamp(), op: 'edit_booking', booking_id: booking.id, data }, `تعديل حجز ${booking.customer_name}`) }
  /** Create (no id) or update (id) a room. Returns the id the view uses (temporary when creating). */
  async upsertRoom(room: Partial<Room> & { id?: number }): Promise<number> {
    const base = this.stamp()
    const o: SyncOp = { ...base, op: 'room_upsert', room: room.id ? room : { ...room, client_room_id: base.client_id } }
    await this.enqueue(o, room.id ? `تعديل قاعة ${room.name ?? ''}`.trim() : `قاعة جديدة — ${room.name ?? ''}`.trim())
    return room.id ?? tempId(o.client_id)
  }
  patchSettings(data: Partial<Settings>, label = 'تعديل الإعدادات') { return this.enqueue({ ...this.stamp(), op: 'settings_patch', data }, label) }

  /** Send a failed op again. */
  async retry(clientId: string) {
    this.queue = this.queue.map((q) => (q.op.client_id === clientId ? { ...q, status: 'pending', error: undefined } : q))
    await this.persistQueue()
    this.emit()
    void this.sync()
  }
  /** Forget the cursor and pull everything again (after a delete made through the REST API, for example). */
  async refetch() {
    this.base = { ...this.base, cursor: null }
    await this.sync()
  }
  /** Drop a failed op; the view falls back to the server's truth (a full pull follows). */
  async discard(clientId: string) {
    this.queue = this.queue.filter((q) => q.op.client_id !== clientId)
    await this.persistQueue()
    this.base = { ...this.base, cursor: null }
    this.emit()
    void this.sync()
  }

  // ---- sync loop ----
  async sync(): Promise<void> {
    if (!this.ready) await this.load()
    if (this.syncing) { this.again = true; return }
    if (!this.online) return
    this.syncing = true
    this.emit()
    try {
      await this.push()
      await this.pull()
      this.error = null
      this.lastSync = new Date().toISOString()
    } catch (err) {
      if (err instanceof ApiError && err.offline) { this.online = false; this.error = null }
      else if (err instanceof ApiError && err.status === 401) { this.error = describeError(err); this.onUnauthorized?.() }
      else this.error = describeError(err)
    } finally {
      this.syncing = false
      this.emit()
      if (this.again) { this.again = false; void this.sync() }
    }
  }

  private async push(): Promise<void> {
    // Loop: each round sends the longest prefix of pending ops that does not depend on a temp id.
    for (let round = 0; round < 50; round++) {
      const batch: QueuedOp[] = []
      const orphans = new Set<string>()
      for (const q of this.queue) {
        if (q.status !== 'pending') continue
        const refs = tempRefs(q.op)
        if (refs.length === 0) { batch.push(q); if (batch.length >= 100) break; continue }
        // The op that creates this temp entity must still be pending (and comes earlier in the queue). If it failed or
        // was discarded, this op can never apply: flag it instead of blocking the queue.
        const creators = refs.map((id) => this.queue.find((c) => creates(c, id)))
        if (creators.some((c) => !c || c.status === 'failed')) { orphans.add(q.op.client_id); continue }
        break
      }
      if (orphans.size) {
        this.queue = this.queue.map((q) => (orphans.has(q.op.client_id) ? { ...q, status: 'failed', error: 'depends_failed' } : q))
        await this.persistQueue()
        this.emit()
      }
      if (batch.length === 0) return
      const res = await api.post<SyncPush>('/v1/team/sync', { ops: batch.map((q) => q.op) })
      const byId = new Map<string, SyncResult>(res.results.map((r) => [r.client_id, r]))
      const idMap = new Map<number, number>()
      let base = this.base
      const remaining: QueuedOp[] = []
      for (const q of this.queue) {
        const r = byId.get(q.op.client_id)
        if (!r) { remaining.push(q); continue }
        if (r.ok) {
          if (r.booking) { base = { ...base, bookings: upsertBy(base.bookings, r.booking) }; idMap.set(tempId(q.op.client_id), r.booking.id) }
          if (r.room) { base = { ...base, rooms: upsertBy(base.rooms, r.room) }; idMap.set(tempId(q.op.client_id), r.room.id) }
        } else {
          remaining.push({ ...q, status: 'failed', error: r.error ?? 'internal', attempts: q.attempts + 1 })
        }
      }
      this.queue = idMap.size ? remaining.map((q) => ({ ...q, op: remap(q.op, idMap) })) : remaining
      this.base = base
      await this.persistQueue()
      await this.persistBase()
      this.emit()
    }
  }

  private async pull(): Promise<void> {
    const since = this.base.cursor
    const res = await api.get<SyncPull>(`/v1/team/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`)
    const deleted = new Set(res.deleted_rooms)
    const rooms = res.rooms.filter((r) => !deleted.has(r.id)).sort((a, b) => a.sort - b.sort || a.id - b.id)
    const keepFrom = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString()
    let bookings = since ? this.base.bookings : []
    for (const b of res.bookings) bookings = upsertBy(bookings, b)
    bookings = bookings.filter((b) => b.start >= keepFrom && !deleted.has(b.room_id)).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    this.base = { rooms, bookings, settings: res.settings, cursor: res.now, pulled_at: new Date().toISOString() }
    setTimeZone(res.settings?.timezone)
    await this.persistBase()
    this.emit()
  }

  // ---- live updates ----
  /** Mark a booking as just-arrived for a minute (the "جديد" badge). */
  markFresh(id: number) {
    const old = this.fresh.get(id)
    if (old) window.clearTimeout(old)
    this.fresh.set(id, window.setTimeout(() => { this.fresh.delete(id); this.emit() }, FRESH_MS))
    this.emit()
  }
  /** A push forwarded by the service worker while the panel is open: refresh now, chime, highlight. */
  handlePush(p: PushMessage) {
    if (p.kind !== 'booking_created' && p.kind !== 'payment_submitted' && p.kind !== 'announcement') return
    if (p.booking_id) this.markFresh(p.booking_id)
    void playChime()
    void this.sync()
  }
  /** Cheap 5-second poll: pull when the server's last_change moved (or its pending count disagrees with ours). */
  async ping(): Promise<void> {
    if (!this.online || this.syncing || Date.now() < this.pingBackoffUntil) return
    let r: Ping
    try { r = await api.get<Ping>('/v1/team/ping') } catch (err) {
      if (err instanceof ApiError && err.offline) { this.setOnline(false); return }
      if (err instanceof ApiError && err.status === 401) { this.onUnauthorized?.(); return }
      this.pingBackoffUntil = Date.now() + 60_000      // the endpoint is missing or the server is unhappy: try again in a minute
      return
    }
    const first = this.lastChange === undefined
    const moved = !first && r.last_change !== this.lastChange
    this.lastChange = r.last_change
    const localPending = this.getSnapshot().view.bookings.filter((b) => isPendingVerification(b) && !isTemp(b.id)).length
    if (moved) {
      if (r.pending > localPending) void playChime()
      void this.sync()
    } else if (!first && r.pending !== localPending && Date.now() - this.mismatchSyncAt > 60_000) {
      // Counts disagree without a cursor move (edge cases around the 30-minute grace): re-pull, at most once a minute.
      this.mismatchSyncAt = Date.now()
      void this.sync()
    }
  }

  /** Forget everything on this device (sign-out). Pending ops are kept so nothing is lost if the same team signs in again. */
  async clearBase() {
    this.base = EMPTY_BASE
    await this.persistBase()
    this.emit()
  }
}

export const store = new TeamStore()

// ---------- React bindings ----------

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
export function useRooms(activeOnly = true): Room[] {
  const { view } = useStore()
  return useMemo(() => (activeOnly ? view.rooms.filter((r) => r.active === 1) : view.rooms), [view.rooms, activeOnly])
}
export function useSettings(): Settings | null { return useStore().view.settings }

/** Mounts the sync loop: load from IndexedDB, then sync on load / online / focus / every 30 s; ping every 5 s while
 *  the tab is visible; and react to pushes forwarded by the service worker. */
export function useSyncLoop(onUnauthorized: () => void) {
  const ref = useRef(onUnauthorized)
  ref.current = onUnauthorized
  useEffect(() => {
    store.onUnauthorized = () => ref.current()
    void store.load().then(() => store.sync())
    const up = () => store.setOnline(true)
    const down = () => store.setOnline(false)
    const vis = () => { if (document.visibilityState === 'visible') void store.sync() }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    document.addEventListener('visibilitychange', vis)
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void store.sync() }, 30_000)
    const p = window.setInterval(() => { if (document.visibilityState === 'visible') void store.ping() }, PING_MS)
    const offPush = onPushMessage((m) => store.handlePush(m))
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      document.removeEventListener('visibilitychange', vis)
      window.clearInterval(t)
      window.clearInterval(p)
      offPush()
      store.onUnauthorized = null
    }
  }, [])
}
/** Ids of bookings that just arrived by push (for the "جديد" badge). */
export function useFresh(): Set<number> {
  const { fresh } = useStore()
  return useMemo(() => new Set(fresh), [fresh])
}
