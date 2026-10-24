// Focus Point — shared domain types and the HTTP API contract (used by api/ and web/).
// Times are ISO-8601 strings in UTC; the centre's local zone is Asia/Damascus (settings.timezone).

export type Role = 'staff' | 'admin'          // accounts exist only for the team; customers book as guests (name + phone)
export type RoomType = 'private' | 'meeting' | 'desk' | 'hall'
export type BookingStatus =
  | 'pending_payment'        // created; the slot is held for settings.hold_minutes
  | 'awaiting_verification'  // the customer entered the Sham Cash transaction reference
  | 'confirmed'              // staff verified the payment (or walk-in paid in cash)
  | 'rejected'               // staff rejected (reason)
  | 'expired'                // hold ran out without a payment reference
  | 'cancelled'              // by the customer (before confirmation) or by staff
  | 'completed'              // end time passed while confirmed
export type PaymentMethod = 'shamcash' | 'cash' | 'free'
export type NotificationKind =
  | 'booking_created' | 'payment_submitted' | 'booking_confirmed' | 'booking_rejected'
  | 'booking_cancelled' | 'booking_expired' | 'booking_reminder' | 'announcement'

export interface User {                        // a staff/admin account
  id: number; phone: string; name: string; role: Role; created_at: string; disabled: 0 | 1
}
export interface Customer {                    // derived from bookings: one row per phone
  phone: string; name: string; bookings: number; last_booking: string | null; blocked: 0 | 1
}
export interface RoomContents {
  chairs: number; tables: number; screen?: boolean; whiteboard?: boolean; ac?: boolean; wifi?: boolean
  projector?: boolean; coffee?: boolean; notes?: string
}
export interface PlanRect { x: number; y: number; w: number; h: number }   // in plan units (settings.plan.width × height)
export interface Room {
  id: number; name: string; type: RoomType; capacity: number; contents: RoomContents
  price_hour: number; price_day: number | null        // Syrian pounds
  color: string | null; plan: PlanRect | null; active: 0 | 1; sort: number; description: string | null
}
export interface Booking {
  id: number; code: string                            // code: 6 chars shown to the customer and written in the transfer note
  customer_phone: string; customer_name: string  // guests: no account; a booking belongs to a phone number
  device_id: string | null                      // the browser/app that made it (random id kept in the app; it sees "my bookings" and gets push)
  room_id: number; start: string; end: string; status: BookingStatus
  price: number; method: PaymentMethod
  payment_ref: string | null; paid_at: string | null; verified_by: number | null
  note: string | null; reject_reason: string | null; people: number | null
  created_at: string; updated_at: string; hold_until: string | null
  // joined for lists
  room_name?: string
}
export interface Notification {
  id: number; kind: NotificationKind; title: string; body: string
  user_id: number | null; device_id: string | null   // exactly one is set: a team account or a customer device
  booking_id: number | null; read: 0 | 1; created_at: string
}
export interface Plan {
  width: number; height: number
  walls: { x: number; y: number; w: number; h: number }[]   // drawn as light blocks (corridor, reception…)
  labels: { x: number; y: number; text: string }[]
}
export interface Settings {
  centre_name: string; phone: string; address: string; instagram: string
  timezone: string; open: string; close: string        // "09:00", "23:00" local
  slot_minutes: 30 | 60; min_minutes: number; max_minutes: number; hold_minutes: number
  shamcash_number: string; shamcash_name: string; shamcash_qr: string | null   // qr: data URL (PNG) or null
  payment_instructions: string
  plan: Plan
  vapid_public_key: string                             // for push subscriptions
}

// ---------- API (all JSON; errors are {error: string} with 4xx/5xx) ----------
// Customers: no accounts. The app generates a random device id (UUID) once and sends it as "X-Device: <id>" on every
// request; a booking is tied to that device and to the phone number typed in. A customer can also find a booking
// with its code + phone. Team: Authorization: Bearer <token> (HS256 from /v1/team/login, 30 days), roles staff/admin.
export interface ApiContract {
  // public (customers; X-Device header)
  'GET /v1/settings': { res: PublicSettings }
  'GET /v1/rooms': { res: Room[] }                                 // active rooms
  'GET /v1/availability?date=YYYY-MM-DD': { res: { room_id: number; start: string; end: string; status: BookingStatus }[] }  // all rooms, one call
  'POST /v1/bookings': { req: { room_id: number; start: string; end: string; name: string; phone: string; people?: number; note?: string }; res: Booking }  // → pending_payment + hold
  'GET /v1/bookings/mine': { res: Booking[] }                      // by X-Device
  'GET /v1/bookings/lookup?code=&phone=': { res: Booking }         // adopt: the server adds the device to this booking
  'GET /v1/bookings/:id': { res: Booking & { payment: PaymentInfo | null } }   // device must own it (or team)
  'POST /v1/bookings/:id/payment': { req: { ref: string }; res: Booking }     // → awaiting_verification
  'POST /v1/bookings/:id/cancel': { res: Booking }                 // customer: only before confirmed; team: any
  'GET /v1/notifications': { res: Notification[] }                 // by X-Device (or team account)
  'POST /v1/notifications/read': { req: { ids?: number[] }; res: { ok: true } }
  'POST /v1/push/subscribe': { req: { subscription: PushSubscriptionJSON }; res: { ok: true } }   // tied to X-Device or the team account
  'POST /v1/push/unsubscribe': { req: { endpoint: string }; res: { ok: true } }
  // team (staff + admin)
  'POST /v1/team/login': { req: { phone: string; password: string }; res: { token: string; user: User } }
  'GET /v1/team/me': { res: User }
  'PATCH /v1/team/me': { req: { name?: string; password?: string }; res: User }
  'GET /v1/team/bookings?from=&to=&status=&room_id=&q=': { res: Booking[] }
  'POST /v1/team/bookings/:id/confirm': { res: Booking }           // verifies payment → confirmed (push to the customer device)
  'POST /v1/team/bookings/:id/reject': { req: { reason: string }; res: Booking }
  'POST /v1/team/bookings/manual': { req: { room_id: number; start: string; end: string; phone: string; name: string; method: PaymentMethod; price?: number; note?: string; client_id?: string }; res: Booking }  // walk-in → confirmed; client_id makes it idempotent (offline queue)
  'PATCH /v1/team/bookings/:id': { req: { start?: string; end?: string; room_id?: number; note?: string; price?: number }; res: Booking }   // move/edit (checks overlap)
  'GET /v1/team/dashboard?date=': { res: { today: Booking[]; pending: Booking[]; counts: { today: number; week: number; pending: number }; revenue_month: number } }
  'GET /v1/team/customers?q=': { res: Customer[] }
  'POST /v1/team/customers/:phone/block': { req: { blocked: 0 | 1 }; res: Customer }
  // offline sync (team app): everything changed since a cursor, so the panel works offline and catches up
  'GET /v1/team/sync?since=<iso>': { res: { now: string; rooms: Room[]; bookings: Booking[]; settings: Settings; deleted_rooms: number[] } }
  'POST /v1/team/sync': { req: { ops: SyncOp[] }; res: { results: SyncResult[]; now: string } }   // replay the offline queue, in order, idempotent by client_id
  // admin only
  'POST /v1/admin/rooms': { req: Omit<Room, 'id'>; res: Room }
  'PATCH /v1/admin/rooms/:id': { req: Partial<Omit<Room, 'id'>>; res: Room }
  'DELETE /v1/admin/rooms/:id': { res: { ok: true } }              // only when it has no future bookings; else active=0
  'GET /v1/admin/settings': { res: Settings }
  'PATCH /v1/admin/settings': { req: Partial<Settings>; res: Settings }
  'GET /v1/admin/team': { res: User[] }
  'POST /v1/admin/team': { req: { phone: string; name: string; password: string; role: Role }; res: User }
  'PATCH /v1/admin/team/:id': { req: { role?: Role; disabled?: 0 | 1; name?: string; password?: string }; res: User }
  'POST /v1/admin/announce': { req: { title: string; body: string; to: 'customers' | 'team' }; res: { sent: number } }
  'GET /v1/admin/report?from=&to=': { res: { bookings: Booking[]; revenue: number; hours_by_room: Record<string, number> } }
  'POST /v1/admin/bootstrap': { req: { setup_key: string; phone: string; name: string; password: string }; res: { token: string; user: User } }  // first admin only
  // integrations
  'POST /v1/payments/shamcash/webhook': { req: { ref: string; amount: number; sender?: string; note?: string }; res: { matched: boolean } }  // X-Webhook-Secret header
}
export type PublicSettings = Pick<Settings, 'centre_name' | 'phone' | 'address' | 'instagram' | 'timezone' | 'open' | 'close' | 'slot_minutes' | 'min_minutes' | 'max_minutes' | 'hold_minutes' | 'plan' | 'vapid_public_key'>
// One queued change made offline in the team app. client_id is a UUID made on the device; replaying the same op is a no-op.
export type SyncOp =
  | { client_id: string; at: string; op: 'manual_booking'; data: ApiContract['POST /v1/team/bookings/manual']['req'] }
  | { client_id: string; at: string; op: 'confirm' | 'cancel'; booking_id: number }
  | { client_id: string; at: string; op: 'reject'; booking_id: number; reason: string }
  | { client_id: string; at: string; op: 'edit_booking'; booking_id: number; data: ApiContract['PATCH /v1/team/bookings/:id']['req'] }
  | { client_id: string; at: string; op: 'room_upsert'; room: Partial<Room> & { id?: number; client_room_id?: string } }
  | { client_id: string; at: string; op: 'settings_patch'; data: Partial<Settings> }
export interface SyncResult { client_id: string; ok: boolean; error?: string; booking?: Booking; room?: Room }
export interface PaymentInfo {
  method: PaymentMethod; amount: number; code: string; shamcash_number: string; shamcash_name: string
  shamcash_qr: string | null; instructions: string; hold_until: string | null; ref: string | null
}
