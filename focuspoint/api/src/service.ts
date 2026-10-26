// Booking and room operations shared by the online routes and the offline sync replay (POST /v1/team/sync).
// Every function validates, applies the status machine, and returns the fresh Booking/Room (joined with room_name).
import { isSafeImageSrc } from '../../shared/content'
import type { ApiContract, Booking, BookingStatus, PaymentMethod, Photo, Room, RoomContents, RoomType, Settings, User } from '../../shared/types'
import type { Env } from './env'
import { HttpError } from './http'
import { ACTIVE_SQL, NO_CONFLICT_SQL, REF_BLOCKING_SQL, beyondHorizon, canTransition, generateCode, holdState, price as priceFor, validateSlot, zeroRowsError } from './bookings'
import { BOOKING_SELECT, getBooking, getRoom, replaceRoomPhotos, toBooking, type BookingRow } from './db'
import { messageCtx, notifyDevice, notifyTeam, texts } from './notify'
import { loadSettings } from './settings'
import { HEX_COLOR_RE, isPlainObject, oneOf, optionalInt, optionalString, requireInt, requireIso, requirePhone, requireString } from './validate'

export interface Deps {
  env: Env; exec: ExecutionContext
  now: Date          // the server clock: timestamps, holds, conflict checks
  validateAt?: Date  // the clock slot validation is judged against (offline replay: when the device recorded the op); defaults to now
}

const ROOM_TYPES: readonly RoomType[] = ['private', 'meeting', 'desk', 'hall']
const METHODS: readonly PaymentMethod[] = ['shamcash', 'cash', 'free']

/** Live bookings that collide with [start, end) in a room, other than `excludeId`. Same rule as bookings.isBlocking. */
export async function conflicts(db: D1Database, roomId: number, start: string, end: string, now: Date, excludeId: number | null): Promise<BookingRow[]> {
  return (await db.prepare(
    `${BOOKING_SELECT} WHERE b.room_id = ? AND b.start < ? AND b.end > ? AND ${ACTIVE_SQL} AND b.id != ? ORDER BY b.id`)
    .bind(roomId, end, start, now.toISOString(), excludeId ?? -1).all<BookingRow>()).results
}

async function freshCode(db: D1Database): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateCode()
    const hit = await db.prepare('SELECT 1 FROM bookings WHERE code = ?').bind(code).first()
    if (!hit) return code
  }
  throw new HttpError(500, 'code_generation_failed')
}

export async function requireActiveRoom(db: D1Database, roomId: unknown): Promise<Room> {
  const id = requireInt(roomId, 'invalid_room', 1, Number.MAX_SAFE_INTEGER)
  const room = await getRoom(db, id)
  if (!room || !room.active) throw new HttpError(404, 'room_not_found')
  return room
}

interface InsertArgs {
  code: string; phone: string; name: string; deviceId: string | null; clientId: string | null; roomId: number
  start: string; end: string; status: BookingStatus; price: number; method: PaymentMethod; note: string | null
  people: number | null; holdUntil: string | null; verifiedBy: number | null; paidAt: string | null
}

/**
 * Double-booking protection. D1 has no row locks, so: insert the booking, then re-read every live booking that
 * overlaps it. If another one exists, the earliest-inserted (lowest id) wins; the later one is deleted and the
 * request answers 409 slot_taken. Two racing requests therefore resolve deterministically: the first keeps its slot,
 * the second sees the first and removes itself.
 */
async function insertChecked(d: Deps, a: InsertArgs): Promise<Booking> {
  const db = d.env.DB, iso = d.now.toISOString()
  const res = await db.prepare(
    `INSERT INTO bookings (code, customer_phone, customer_name, device_id, client_id, room_id, start, end, status, price, method,
       note, people, hold_until, verified_by, paid_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(a.code, a.phone, a.name, a.deviceId, a.clientId, a.roomId, a.start, a.end, a.status, a.price, a.method,
      a.note, a.people, a.holdUntil, a.verifiedBy, a.paidAt, iso, iso).run()
  const id = Number(res.meta.last_row_id)
  const others = await conflicts(db, a.roomId, a.start, a.end, d.now, id)
  if (others.some((o) => o.id < id)) {
    await db.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run()
    throw new HttpError(409, 'slot_taken')
  }
  const booking = await getBooking(db, id)
  if (!booking) throw new HttpError(500, 'insert_failed')
  return booking
}

const CUSTOMER_METHODS = ['shamcash', 'cash'] as const

/**
 * Customer booking. shamcash (default) → pending_payment with a hold; cash ("pay on arrival", only when
 * settings.allow_pay_on_arrival) → awaiting_verification at once, no hold, staff confirm at the desk.
 * The admin's booking capabilities apply here only (team walk-ins are never limited by them):
 * booking_enabled (409 booking_closed), shamcash_enabled (400 shamcash_disabled), booking_horizon_days
 * (400 too_far_ahead) and max_open_holds_per_phone (429 too_many_pending).
 */
export async function createCustomerBooking(d: Deps, deviceId: string, body: Record<string, unknown>): Promise<Booking> {
  const db = d.env.DB
  const settings = await loadSettings(db, d.env)
  // Paused first: whatever else the request says, the answer is "booking is closed right now".
  if (!settings.booking_enabled) throw new HttpError(409, 'booking_closed')
  const method = body.method === undefined ? 'shamcash' : oneOf(body.method, CUSTOMER_METHODS, 'invalid_method')
  const name = requireString(body.name, 'invalid_name', 2, 40)
  const phone = requirePhone(body.phone)
  const people = optionalInt(body.people, 'invalid_people', 1, 200)
  const note = optionalString(body.note, 'invalid_note', 300)
  const start = requireIso(body.start, 'invalid_time'), end = requireIso(body.end, 'invalid_time')

  if (await db.prepare('SELECT 1 FROM blocked_customers WHERE phone = ?').bind(phone).first()) throw new HttpError(403, 'customer_blocked')
  const room = await requireActiveRoom(db, body.room_id)
  if (people !== null && people > room.capacity) throw new HttpError(400, 'too_many_people')
  if (method === 'cash' && !settings.allow_pay_on_arrival) throw new HttpError(400, 'cash_not_allowed')
  if (method === 'shamcash' && !settings.shamcash_enabled) throw new HttpError(400, 'shamcash_disabled')
  const slot = validateSlot(start, end, settings, { now: d.now })
  if (!slot.ok) throw new HttpError(400, slot.error)
  if (beyondHorizon(start, d.now, settings.timezone, settings.booking_horizon_days)) throw new HttpError(400, 'too_far_ahead')

  // Quick pre-check (friendly 409 before writing) — the authoritative check happens after the insert.
  if ((await conflicts(db, room.id, start, end, d.now, null)).length > 0) throw new HttpError(409, 'slot_taken')
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE b.customer_phone = ? AND b.status = 'pending_payment' AND b.hold_until > ?`)
    .bind(phone, d.now.toISOString()).first<{ n: number }>()
  if ((open?.n ?? 0) >= settings.max_open_holds_per_phone) throw new HttpError(429, 'too_many_pending')

  const cash = method === 'cash'
  const booking = await insertChecked(d, {
    code: await freshCode(db), phone, name, deviceId, clientId: null, roomId: room.id, start, end,
    status: cash ? 'awaiting_verification' : 'pending_payment', price: priceFor(slot.minutes, room), method, note, people,
    holdUntil: cash ? null : new Date(d.now.getTime() + settings.hold_minutes * 60000).toISOString(), verifiedBy: null, paidAt: null,
  })
  const mc = await messageCtx(db, settings)
  await notifyTeam(d.env, d.exec, texts.booking_created(booking, mc))
  // Pay on arrival: nothing to transfer, so the team gets the verification request right away.
  if (cash) await notifyTeam(d.env, d.exec, texts.payment_submitted(booking, mc))
  return booking
}

/** Team walk-in booking. cash/free → confirmed immediately; shamcash → pending_payment with a hold. Idempotent by client_id. */
export async function createManualBooking(d: Deps, user: User, body: ApiContract['POST /v1/team/bookings/manual']['req'] | Record<string, unknown>): Promise<Booking> {
  const db = d.env.DB
  const b = body as Record<string, unknown>
  const clientId = optionalString(b.client_id, 'invalid_client_id', 64)
  if (clientId) {
    const existing = await db.prepare(`${BOOKING_SELECT} WHERE b.client_id = ?`).bind(clientId).first<BookingRow>()
    if (existing) return toBooking(existing)
  }
  const name = requireString(b.name, 'invalid_name', 2, 40)
  const phone = requirePhone(b.phone)
  const method = oneOf(b.method, METHODS, 'invalid_method')
  const note = optionalString(b.note, 'invalid_note', 300)
  const start = requireIso(b.start, 'invalid_time'), end = requireIso(b.end, 'invalid_time')
  const room = await requireActiveRoom(db, b.room_id)
  const settings = await loadSettings(db, d.env)
  const slot = validateSlot(start, end, settings, { now: d.validateAt ?? d.now, allowPast: true })
  if (!slot.ok) throw new HttpError(400, slot.error)
  const givenPrice = optionalInt(b.price, 'invalid_price', 0, 1_000_000_000)
  const price = givenPrice ?? (method === 'free' ? 0 : priceFor(slot.minutes, room))
  if ((await conflicts(db, room.id, start, end, d.now, null)).length > 0) throw new HttpError(409, 'slot_taken')

  const confirmed = method !== 'shamcash'
  return insertChecked(d, {
    code: await freshCode(db), phone, name, deviceId: null, clientId, roomId: room.id, start, end,
    status: confirmed ? 'confirmed' : 'pending_payment', price, method, note, people: null,
    holdUntil: confirmed ? null : new Date(d.now.getTime() + settings.hold_minutes * 60000).toISOString(),
    verifiedBy: confirmed ? user.id : null, paidAt: confirmed ? d.now.toISOString() : null,
  })
}

async function requireBooking(db: D1Database, id: number): Promise<Booking> {
  const b = await getBooking(db, id)
  if (!b) throw new HttpError(404, 'booking_not_found')
  return b
}

function assertTransition(b: Booking, to: BookingStatus): void {
  if (!canTransition(b.status, to)) throw new HttpError(409, 'illegal_transition')
}

/** Guarded status write: only applies when the row is still in the status we read (optimistic). */
async function setStatus(db: D1Database, b: Booking, to: BookingStatus, now: Date, extra: Record<string, string | number | null> = {}): Promise<Booking> {
  assertTransition(b, to)
  const cols = Object.keys(extra)
  const sets = ['status = ?', 'updated_at = ?', ...cols.map((c) => `${c} = ?`)].join(', ')
  const res = await db.prepare(`UPDATE bookings SET ${sets} WHERE id = ? AND status = ?`)
    .bind(to, now.toISOString(), ...cols.map((c) => extra[c] ?? null), b.id, b.status).run()
  if (res.meta.changes === 0) throw new HttpError(409, 'illegal_transition')
  return requireBooking(db, b.id)
}

/** Customer submits the Sham Cash transaction reference → awaiting_verification; the team is notified. */
export async function submitPayment(d: Deps, b: Booking, refInput: unknown): Promise<Booking> {
  const db = d.env.DB
  const ref = requireString(refInput, 'invalid_ref', 4, 40)
  if (b.status === 'pending_payment') {
    const hold = holdState(b.hold_until, d.now)
    // Grace: a reference arriving shortly after hold_until is still taken if nobody booked the slot meanwhile.
    const taken = hold === 'grace' && (await conflicts(db, b.room_id, b.start, b.end, d.now, b.id)).length > 0
    if (hold === 'expired' || taken) {
      await setStatus(db, b, 'expired', d.now).catch(() => undefined)
      throw new HttpError(409, 'hold_expired')
    }
  }
  assertTransition(b, 'awaiting_verification')
  // A reference is unique among bookings that still count; one typed on a cancelled/expired/rejected booking may be reused.
  const dup = await db.prepare(`SELECT 1 FROM bookings WHERE payment_ref = ? AND ${REF_BLOCKING_SQL} AND id != ?`).bind(ref, b.id).first()
  if (dup) throw new HttpError(409, 'ref_used')
  const updated = await setStatus(db, b, 'awaiting_verification', d.now, { payment_ref: ref, paid_at: d.now.toISOString() })
  const settings = await loadSettings(db, d.env)
  await notifyTeam(d.env, d.exec, texts.payment_submitted(updated, await messageCtx(db, settings)))
  return updated
}

export async function confirmBooking(d: Deps, id: number, verifiedBy: number | null): Promise<Booking> {
  const db = d.env.DB
  const b = await requireBooking(db, id)
  assertTransition(b, 'confirmed')
  // Atomic against a racing booking: the UPDATE applies only while the row is still in the status we read AND no live
  // booking overlaps it (another one may have been confirmed over an expired hold). 0 rows → why, from a fresh read.
  const iso = d.now.toISOString()
  const res = await db.prepare(
    `UPDATE bookings SET status = 'confirmed', updated_at = ?, verified_by = ?, paid_at = COALESCE(paid_at, ?)
     WHERE id = ? AND status = ? AND ${NO_CONFLICT_SQL}`)
    .bind(iso, verifiedBy, iso, b.id, b.status, b.room_id, b.end, b.start, b.id, iso).run()
  if (res.meta.changes === 0) throw new HttpError(409, zeroRowsError(await getBooking(db, b.id), b.status))
  const updated = await requireBooking(db, b.id)
  const settings = await loadSettings(db, d.env)
  await notifyDevice(d.env, d.exec, updated.device_id, texts.booking_confirmed(updated, await messageCtx(db, settings)))
  return updated
}

export async function rejectBooking(d: Deps, id: number, reasonInput: unknown): Promise<Booking> {
  const db = d.env.DB
  const reason = requireString(reasonInput, 'invalid_reason', 1, 200)
  const b = await requireBooking(db, id)
  const updated = await setStatus(db, b, 'rejected', d.now, { reject_reason: reason })
  const settings = await loadSettings(db, d.env)
  await notifyDevice(d.env, d.exec, updated.device_id, texts.booking_rejected(updated, await messageCtx(db, settings)))
  return updated
}

/**
 * Cancel. by = 'team' may cancel anything live and notifies the customer; by = 'customer' only before confirmation,
 * and only while settings.customer_can_cancel (403 cancel_not_allowed: the admin decided cancelling goes through the team).
 */
export async function cancelBooking(d: Deps, b: Booking, by: 'team' | 'customer'): Promise<Booking> {
  const db = d.env.DB
  if (by === 'customer') {
    if (b.status !== 'pending_payment' && b.status !== 'awaiting_verification') throw new HttpError(409, 'illegal_transition')
    if (!(await loadSettings(db, d.env)).customer_can_cancel) throw new HttpError(403, 'cancel_not_allowed')
  }
  const updated = await setStatus(db, b, 'cancelled', d.now)
  if (by === 'team') {
    const settings = await loadSettings(db, d.env)
    await notifyDevice(d.env, d.exec, updated.device_id, texts.booking_cancelled(updated, await messageCtx(db, settings)))
  }
  return updated
}

/** Move/edit a live booking (team). Re-validates the slot and checks overlaps (excluding itself). */
export async function editBooking(d: Deps, id: number, body: Record<string, unknown>): Promise<Booking> {
  const db = d.env.DB
  const b = await requireBooking(db, id)
  if (b.status !== 'pending_payment' && b.status !== 'awaiting_verification' && b.status !== 'confirmed') throw new HttpError(409, 'illegal_transition')
  const start = body.start !== undefined ? requireIso(body.start, 'invalid_time') : b.start
  const end = body.end !== undefined ? requireIso(body.end, 'invalid_time') : b.end
  const room = body.room_id !== undefined ? await requireActiveRoom(db, body.room_id) : null
  const roomId = room?.id ?? b.room_id
  const note = body.note !== undefined ? optionalString(body.note, 'invalid_note', 300) : b.note
  const price = body.price !== undefined ? requireInt(body.price, 'invalid_price', 0, 1_000_000_000) : b.price

  const moved = start !== b.start || end !== b.end || roomId !== b.room_id
  if (moved) {
    const settings = await loadSettings(db, d.env)
    const slot = validateSlot(start, end, settings, { now: d.validateAt ?? d.now, allowPast: true })
    if (!slot.ok) throw new HttpError(400, slot.error)
  }
  // One conditional UPDATE: still in the status we read and, when moved, no live booking overlaps the new window.
  const iso = d.now.toISOString()
  const res = await db.prepare(
    `UPDATE bookings SET start = ?, end = ?, room_id = ?, note = ?, price = ?, reminded = CASE WHEN start = ? THEN reminded ELSE 0 END, updated_at = ?
     WHERE id = ? AND status = ?${moved ? ` AND ${NO_CONFLICT_SQL}` : ''}`)
    .bind(start, end, roomId, note, price, start, iso, b.id, b.status, ...(moved ? [roomId, end, start, b.id, iso] : [])).run()
  if (res.meta.changes === 0) throw new HttpError(409, zeroRowsError(await getBooking(db, b.id), b.status))
  return requireBooking(db, b.id)
}

// ---- rooms (admin) ----
const BOOL_KEYS = ['screen', 'whiteboard', 'ac', 'wifi', 'projector', 'coffee'] as const

export function validateContents(v: unknown): RoomContents {
  if (!isPlainObject(v)) throw new HttpError(400, 'invalid_contents')
  const out: RoomContents = { chairs: requireInt(v.chairs, 'invalid_contents', 0, 500), tables: requireInt(v.tables, 'invalid_contents', 0, 200) }
  for (const k of BOOL_KEYS) {
    if (v[k] !== undefined) {
      if (typeof v[k] !== 'boolean') throw new HttpError(400, 'invalid_contents')
      out[k] = v[k] as boolean
    }
  }
  const notes = optionalString(v.notes, 'invalid_contents', 200)
  if (notes) out.notes = notes
  return out
}

/** Room.photos: ≤ 8 pictures with the content contract's Photo rules (src /img/… or /media/…, alt ≤ 200, 1–20000 px). */
export const MAX_ROOM_PHOTOS = 8
export function validatePhotos(v: unknown, max = MAX_ROOM_PHOTOS): Photo[] {
  if (v === null) return []
  if (!Array.isArray(v) || v.length > max) throw new HttpError(400, 'invalid_photos')
  const dim = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20000
  return v.map((p: unknown) => {
    if (!isPlainObject(p) || typeof p.src !== 'string' || !isSafeImageSrc(p.src.trim()) || !dim(p.w) || !dim(p.h)) throw new HttpError(400, 'invalid_photos')
    if (p.alt !== undefined && p.alt !== null && typeof p.alt !== 'string') throw new HttpError(400, 'invalid_photos')
    // eslint-disable-next-line no-control-regex
    const alt = (typeof p.alt === 'string' ? p.alt : '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim()
    if (alt.length > 200) throw new HttpError(400, 'invalid_photos')
    const out: Photo = { src: p.src.trim(), alt, w: p.w as number, h: p.h as number }
    if (p.small !== undefined && p.small !== null && p.small !== '') {
      if (typeof p.small !== 'string' || !isSafeImageSrc(p.small.trim())) throw new HttpError(400, 'invalid_photos')
      out.small = p.small.trim()
    }
    return out
  })
}

function validatePlanRect(v: unknown) {
  if (v === null || v === undefined) return null
  if (!isPlainObject(v)) throw new HttpError(400, 'invalid_plan')
  return {
    x: requireInt(v.x, 'invalid_plan', 0, 5000), y: requireInt(v.y, 'invalid_plan', 0, 5000),
    w: requireInt(v.w, 'invalid_plan', 1, 5000), h: requireInt(v.h, 'invalid_plan', 1, 5000),
  }
}

/** Cleans a room payload. For a create every required field must be present; for a patch only given fields are validated. */
export function validateRoom(body: Record<string, unknown>, mode: 'create' | 'patch'): Partial<Omit<Room, 'id'>> {
  const p: Partial<Omit<Room, 'id'>> = {}
  const has = (k: string) => mode === 'create' || body[k] !== undefined
  if (has('name')) p.name = requireString(body.name, 'invalid_name', 1, 60)
  if (has('type')) p.type = oneOf(body.type, ROOM_TYPES, 'invalid_type')
  if (has('capacity')) p.capacity = requireInt(body.capacity, 'invalid_capacity', 1, 500)
  if (has('contents')) p.contents = body.contents === undefined ? { chairs: 1, tables: 1 } : validateContents(body.contents)
  if (has('price_hour')) p.price_hour = requireInt(body.price_hour, 'invalid_price', 0, 1_000_000_000)
  if (body.price_day !== undefined || mode === 'create') p.price_day = optionalInt(body.price_day, 'invalid_price', 0, 1_000_000_000)
  if (body.color !== undefined || mode === 'create') {
    const c = optionalString(body.color, 'invalid_color', 7)
    if (c !== null && !HEX_COLOR_RE.test(c)) throw new HttpError(400, 'invalid_color')
    p.color = c
  }
  if (body.plan !== undefined || mode === 'create') p.plan = validatePlanRect(body.plan)
  if (body.active !== undefined || mode === 'create') {
    if (body.active !== undefined && body.active !== 0 && body.active !== 1) throw new HttpError(400, 'invalid_active')
    p.active = (body.active ?? 1) as 0 | 1
  }
  if (body.sort !== undefined || mode === 'create') p.sort = body.sort === undefined ? 0 : requireInt(body.sort, 'invalid_sort', -1000, 1000)
  if (body.description !== undefined || mode === 'create') p.description = optionalString(body.description, 'invalid_description', 300)
  if (body.photos !== undefined) p.photos = validatePhotos(body.photos)
  return p
}

export async function createRoom(db: D1Database, body: Record<string, unknown>): Promise<Room> {
  const r = validateRoom(body, 'create') as Omit<Room, 'id'>      // everything (photos included) is checked before any write
  const res = await db.prepare(
    'INSERT INTO rooms (name, type, capacity, contents, price_hour, price_day, color, plan, active, sort, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(r.name, r.type, r.capacity, JSON.stringify(r.contents), r.price_hour, r.price_day, r.color, r.plan ? JSON.stringify(r.plan) : null, r.active, r.sort, r.description).run()
  const id = Number(res.meta.last_row_id)
  if (r.photos?.length) await db.batch(replaceRoomPhotos(db, id, r.photos))
  const room = await getRoom(db, id)
  if (!room) throw new HttpError(500, 'insert_failed')
  return room
}

export async function patchRoom(db: D1Database, id: number, body: Record<string, unknown>): Promise<Room> {
  const existing = await getRoom(db, id)
  if (!existing) throw new HttpError(404, 'room_not_found')
  const p = validateRoom(body, 'patch')
  const r = { ...existing, ...p }
  // One transaction: the room fields and (when given) its whole photo list.
  await db.batch([
    db.prepare('UPDATE rooms SET name = ?, type = ?, capacity = ?, contents = ?, price_hour = ?, price_day = ?, color = ?, plan = ?, active = ?, sort = ?, description = ? WHERE id = ?')
      .bind(r.name, r.type, r.capacity, JSON.stringify(r.contents), r.price_hour, r.price_day, r.color, r.plan ? JSON.stringify(r.plan) : null, r.active, r.sort, r.description, id),
    ...(p.photos !== undefined ? replaceRoomPhotos(db, id, p.photos) : []),
  ])
  const room = await getRoom(db, id)
  if (!room) throw new HttpError(404, 'room_not_found')
  return room
}

/** Hard delete only when nothing references the room (FK); otherwise it is deactivated (active = 0). */
export async function deleteRoom(db: D1Database, id: number, now: Date): Promise<'deleted' | 'deactivated'> {
  const existing = await getRoom(db, id)
  if (!existing) throw new HttpError(404, 'room_not_found')
  const used = await db.prepare('SELECT 1 FROM bookings WHERE room_id = ? LIMIT 1').bind(id).first()
  if (used) {
    await db.prepare('UPDATE rooms SET active = 0 WHERE id = ?').bind(id).run()
    return 'deactivated'
  }
  await db.batch([
    db.prepare('DELETE FROM room_photos WHERE room_id = ?').bind(id),
    db.prepare('DELETE FROM rooms WHERE id = ?').bind(id),
    db.prepare('INSERT INTO deleted_rooms (id, deleted_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at').bind(id, now.toISOString()),
  ])
  return 'deleted'
}

export type { Settings }
