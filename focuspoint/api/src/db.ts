// Row ↔ domain mapping for D1 results. JSON columns are parsed here and internal columns are stripped.
import type { Booking, Room, RoomContents, PlanRect, User, Role, BookingStatus, PaymentMethod } from '../../shared/types'

export interface UserRow { id: number; phone: string; name: string; role: Role; pass_hash: string; disabled: 0 | 1; created_at: string }
export interface RoomRow {
  id: number; name: string; type: Room['type']; capacity: number; contents: string; price_hour: number; price_day: number | null
  color: string | null; plan: string | null; active: 0 | 1; sort: number; description: string | null
}
export interface BookingRow {
  id: number; code: string; customer_phone: string; customer_name: string; device_id: string | null; client_id: string | null
  room_id: number; start: string; end: string; status: BookingStatus; price: number; method: PaymentMethod
  payment_ref: string | null; paid_at: string | null; verified_by: number | null; note: string | null; reject_reason: string | null
  people: number | null; hold_until: string | null; reminded: 0 | 1; created_at: string; updated_at: string; room_name?: string
}

export const toUser = (r: UserRow): User => ({ id: r.id, phone: r.phone, name: r.name, role: r.role, created_at: r.created_at, disabled: r.disabled })

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback
  try { return JSON.parse(text) as T } catch { return fallback }
}

export const toRoom = (r: RoomRow): Room => ({
  id: r.id, name: r.name, type: r.type, capacity: r.capacity,
  contents: parseJson<RoomContents>(r.contents, { chairs: 1, tables: 1 }),
  price_hour: r.price_hour, price_day: r.price_day, color: r.color,
  plan: parseJson<PlanRect | null>(r.plan, null), active: r.active, sort: r.sort, description: r.description,
})

export function toBooking(r: BookingRow): Booking {
  const { client_id: _c, reminded: _r, ...rest } = r
  return rest
}

/** Bookings joined with the room name (the `b` alias is used by ACTIVE_SQL and the filters). */
export const BOOKING_SELECT = 'SELECT b.*, r.name AS room_name FROM bookings b JOIN rooms r ON r.id = b.room_id'

export async function getBooking(db: D1Database, id: number): Promise<Booking | null> {
  const row = await db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).bind(id).first<BookingRow>()
  return row ? toBooking(row) : null
}

export async function getRoom(db: D1Database, id: number): Promise<Room | null> {
  const row = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>()
  return row ? toRoom(row) : null
}

export const nowIso = (): string => new Date().toISOString()
