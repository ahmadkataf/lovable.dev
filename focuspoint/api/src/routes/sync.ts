// Offline sync for the team app.
//  GET  /v1/team/sync?since=  → everything the device needs (rooms, changed bookings, settings, deleted room ids, server time)
//  POST /v1/team/sync {ops}   → replays the device's offline queue in order; each op is idempotent by client_id (sync_ops)
import type { Room, SyncOp, SyncResult } from '../../../shared/types'
import { BOOKING_SELECT, toBooking, toRoom, type BookingRow, type RoomRow } from '../db'
import { HttpError, json, readJson } from '../http'
import { requireUser, route, type Ctx, type Route } from '../router'
import { cancelBooking, confirmBooking, createManualBooking, createRoom, editBooking, patchRoom, rejectBooking } from '../service'
import { loadSettings, saveSettings, validateSettingsPatch, loadStoredSettings } from '../settings'
import { getBooking } from '../db'
import { isPlainObject } from '../validate'

const MAX_OPS = 200

async function applyOp(c: Ctx, op: SyncOp): Promise<SyncResult> {
  const user = requireUser(c), d = { env: c.env, exec: c.exec, now: c.now }
  const admin = () => { if (user.role !== 'admin') throw new HttpError(403, 'forbidden') }
  switch (op.op) {
    case 'manual_booking': {
      const data = { ...(op.data as Record<string, unknown>) }
      data.client_id = (typeof data.client_id === 'string' && data.client_id) || op.client_id
      return { client_id: op.client_id, ok: true, booking: await createManualBooking(d, user, data) }
    }
    case 'confirm':
      return { client_id: op.client_id, ok: true, booking: await confirmBooking(d, op.booking_id, user.id) }
    case 'reject':
      return { client_id: op.client_id, ok: true, booking: await rejectBooking(d, op.booking_id, op.reason) }
    case 'cancel': {
      const b = await getBooking(c.env.DB, op.booking_id)
      if (!b) throw new HttpError(404, 'booking_not_found')
      return { client_id: op.client_id, ok: true, booking: await cancelBooking(d, b, 'team') }
    }
    case 'edit_booking':
      return { client_id: op.client_id, ok: true, booking: await editBooking(d, op.booking_id, (op.data ?? {}) as Record<string, unknown>) }
    case 'room_upsert': {
      admin()
      const { id, client_room_id: _cid, ...fields } = (op.room ?? {}) as Partial<Room> & { id?: number; client_room_id?: string }
      const room = typeof id === 'number' && id > 0
        ? await patchRoom(c.env.DB, id, fields as Record<string, unknown>)
        : await createRoom(c.env.DB, fields as Record<string, unknown>)   // the result carries the real id for client_room_id
      return { client_id: op.client_id, ok: true, room }
    }
    case 'settings_patch': {
      admin()
      const current = await loadStoredSettings(c.env.DB)
      await saveSettings(c.env.DB, validateSettingsPatch((op.data ?? {}) as Record<string, unknown>, current))
      return { client_id: op.client_id, ok: true }
    }
    default:
      throw new HttpError(400, 'unknown_op')
  }
}

export const syncRoutes: Route[] = [
  route('GET', '/v1/team/sync', 'team', async (c) => {
    const db = c.env.DB
    const sinceRaw = c.url.searchParams.get('since')
    let since: string | null = null
    if (sinceRaw) {
      const t = Date.parse(sinceRaw)
      if (Number.isNaN(t)) throw new HttpError(400, 'invalid_since')
      since = new Date(t).toISOString()
    }
    // `now` is taken before the reads so a client that stores it as its next cursor cannot miss a concurrent write.
    const now = c.now.toISOString()
    const bookingsSql = since
      ? `${BOOKING_SELECT} WHERE b.updated_at > ? ORDER BY b.updated_at LIMIT 2000`
      : `${BOOKING_SELECT} WHERE b.start >= ? ORDER BY b.start LIMIT 5000`
    const bookingsArg = since ?? new Date(c.now.getTime() - 60 * 86400000).toISOString()
    const [rooms, bookings, deleted, settings] = await Promise.all([
      db.prepare('SELECT * FROM rooms ORDER BY sort, id').all<RoomRow>(),
      db.prepare(bookingsSql).bind(bookingsArg).all<BookingRow>(),
      since ? db.prepare('SELECT id FROM deleted_rooms WHERE deleted_at > ?').bind(since).all<{ id: number }>()
            : db.prepare('SELECT id FROM deleted_rooms').all<{ id: number }>(),
      loadSettings(db, c.env),
    ])
    return json({
      now, rooms: rooms.results.map(toRoom), bookings: bookings.results.map(toBooking), settings,
      deleted_rooms: deleted.results.map((r) => r.id),
    })
  }),

  route('POST', '/v1/team/sync', 'team', async (c) => {
    const user = requireUser(c)
    const body = await readJson(c.req)
    if (!Array.isArray(body.ops) || body.ops.length > MAX_OPS) throw new HttpError(400, 'invalid_ops')
    const results: SyncResult[] = []
    for (const raw of body.ops as unknown[]) {
      if (!isPlainObject(raw) || typeof raw.client_id !== 'string' || raw.client_id.length < 1 || raw.client_id.length > 64 || typeof raw.op !== 'string') {
        results.push({ client_id: typeof raw === 'object' && raw && typeof (raw as { client_id?: unknown }).client_id === 'string' ? (raw as { client_id: string }).client_id : '', ok: false, error: 'invalid_op' })
        continue
      }
      const op = raw as unknown as SyncOp
      const stored = await c.env.DB.prepare('SELECT result FROM sync_ops WHERE client_id = ?').bind(op.client_id).first<{ result: string }>()
      if (stored) { results.push(JSON.parse(stored.result) as SyncResult); continue }
      let result: SyncResult, persist = true
      try {
        result = await applyOp(c, op)
      } catch (err) {
        if (err instanceof HttpError) result = { client_id: op.client_id, ok: false, error: err.code }
        else { console.error('sync op failed', op.op, err); result = { client_id: op.client_id, ok: false, error: 'internal' }; persist = false }
      }
      if (persist) {
        await c.env.DB.prepare('INSERT INTO sync_ops (client_id, user_id, result) VALUES (?, ?, ?) ON CONFLICT(client_id) DO NOTHING')
          .bind(op.client_id, user.id, JSON.stringify(result)).run()
      }
      results.push(result)
    }
    return json({ results, now: c.now.toISOString() })
  }),
]
