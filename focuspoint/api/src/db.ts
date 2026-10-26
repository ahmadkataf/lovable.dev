// Row ↔ domain mapping for D1 results. JSON columns are parsed here and internal columns are stripped.
import type { Booking, Photo, Room, RoomContents, PlanRect, User, Role, BookingStatus, PaymentMethod } from '../../shared/types'

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

/** A room row + its photos. Rooms always leave the API with `photos` (load them with photosByRoom / roomsWithPhotos). */
export const toRoom = (r: RoomRow, photos: Photo[]): Room => ({
  id: r.id, name: r.name, type: r.type, capacity: r.capacity,
  contents: parseJson<RoomContents>(r.contents, { chairs: 1, tables: 1 }),
  price_hour: r.price_hour, price_day: r.price_day, color: r.color,
  plan: parseJson<PlanRect | null>(r.plan, null), active: r.active, sort: r.sort, description: r.description,
  photos,
})

export interface RoomPhotoRow { room_id: number; sort: number; src: string; alt: string; w: number | null; h: number | null; small: string | null }

export const toPhoto = (p: RoomPhotoRow): Photo => {
  const out: Photo = { src: p.src, alt: p.alt ?? '', w: p.w ?? 1, h: p.h ?? 1 }
  if (p.small) out.small = p.small
  return out
}

/** Photos of the given rooms (all rooms when `ids` is omitted), in their saved order. */
export async function photosByRoom(db: D1Database, ids?: number[]): Promise<Map<number, Photo[]>> {
  const out = new Map<number, Photo[]>()
  if (ids && ids.length === 0) return out
  const rows = ids
    ? (await db.prepare(`SELECT * FROM room_photos WHERE room_id IN (${ids.map(() => '?').join(',')}) ORDER BY room_id, sort`).bind(...ids).all<RoomPhotoRow>()).results
    : (await db.prepare('SELECT * FROM room_photos ORDER BY room_id, sort').all<RoomPhotoRow>()).results
  for (const r of rows) {
    const list = out.get(r.room_id) ?? []
    list.push(toPhoto(r))
    out.set(r.room_id, list)
  }
  return out
}

/** Room rows → Rooms with photos, in one extra query (the small room_photos table is read whole for long lists). */
export async function roomsWithPhotos(db: D1Database, rows: RoomRow[]): Promise<Room[]> {
  const photos = await photosByRoom(db, rows.length > 50 ? undefined : rows.map((r) => r.id))
  return rows.map((r) => toRoom(r, photos.get(r.id) ?? []))
}

/** Statements that replace a room's photo list (run them in one db.batch with the room write). */
export function replaceRoomPhotos(db: D1Database, roomId: number, photos: Photo[]): D1PreparedStatement[] {
  const insert = db.prepare('INSERT INTO room_photos (room_id, sort, src, alt, w, h, small) VALUES (?, ?, ?, ?, ?, ?, ?)')
  return [
    db.prepare('DELETE FROM room_photos WHERE room_id = ?').bind(roomId),
    ...photos.map((p, i) => insert.bind(roomId, i, p.src, p.alt, p.w, p.h, p.small ?? null)),
  ]
}

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
  return row ? (await roomsWithPhotos(db, [row]))[0] ?? null : null
}

export const nowIso = (): string => new Date().toISOString()
