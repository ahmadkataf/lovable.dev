// Focus Point — shared domain types and the HTTP API contract (used by api/ and web/).
// Times are ISO-8601 strings in UTC; the centre's local zone is Asia/Damascus (settings.timezone).

export type Role = 'customer' | 'staff' | 'admin'
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

export interface User {
  id: number; phone: string; name: string; role: Role; created_at: string; disabled: 0 | 1
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
  user_id: number; room_id: number; start: string; end: string; status: BookingStatus
  price: number; method: PaymentMethod
  payment_ref: string | null; paid_at: string | null; verified_by: number | null
  note: string | null; reject_reason: string | null; people: number | null
  created_at: string; updated_at: string; hold_until: string | null
  // joined for lists
  room_name?: string; user_name?: string; user_phone?: string
}
export interface Notification {
  id: number; user_id: number; kind: NotificationKind; title: string; body: string
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
// Auth: Authorization: Bearer <token> (HS256 token from /v1/auth/*, 30 days). Roles enforced per route.
export interface ApiContract {
  // public
  'GET /v1/settings': { res: Omit<Settings, 'shamcash_number' | 'shamcash_name' | 'shamcash_qr' | 'payment_instructions'> & { shamcash_number?: string } }
  'GET /v1/rooms': { res: Room[] }                                 // active rooms
  'GET /v1/rooms/:id/availability?date=YYYY-MM-DD': { res: { busy: { start: string; end: string; status: BookingStatus }[] } }
  'POST /v1/auth/register': { req: { phone: string; name: string; password: string }; res: { token: string; user: User } }
  'POST /v1/auth/login': { req: { phone: string; password: string }; res: { token: string; user: User } }
  // customer (any signed-in user)
  'GET /v1/me': { res: User }
  'PATCH /v1/me': { req: { name?: string; password?: string }; res: User }
  'POST /v1/bookings': { req: { room_id: number; start: string; end: string; people?: number; note?: string }; res: Booking }   // → pending_payment, hold_until
  'GET /v1/bookings': { res: Booking[] }                           // my bookings (staff: ?all=1&status=&date=&room_id=)
  'GET /v1/bookings/:id': { res: Booking & { payment: PaymentInfo | null } }
  'POST /v1/bookings/:id/payment': { req: { ref: string }; res: Booking }   // → awaiting_verification
  'POST /v1/bookings/:id/cancel': { res: Booking }                 // customer: only before confirmed; staff: any
  'GET /v1/notifications': { res: Notification[] }
  'POST /v1/notifications/read': { req: { ids?: number[] }; res: { ok: true } }
  'POST /v1/push/subscribe': { req: { subscription: PushSubscriptionJSON }; res: { ok: true } }
  'POST /v1/push/unsubscribe': { req: { endpoint: string }; res: { ok: true } }
  // staff + admin
  'POST /v1/bookings/:id/confirm': { res: Booking }                // verifies payment → confirmed (push to customer)
  'POST /v1/bookings/:id/reject': { req: { reason: string }; res: Booking }
  'POST /v1/bookings/manual': { req: { room_id: number; start: string; end: string; phone: string; name: string; method: PaymentMethod; price?: number; note?: string }; res: Booking }  // walk-in → confirmed
  'GET /v1/admin/dashboard?date=': { res: { today: Booking[]; pending: Booking[]; occupancy: { room_id: number; hours: number }[]; revenue_month: number } }
  'GET /v1/admin/users?q=': { res: User[] }
  // admin only
  'POST /v1/admin/rooms' : { req: Omit<Room, 'id'>; res: Room }
  'PATCH /v1/admin/rooms/:id': { req: Partial<Omit<Room, 'id'>>; res: Room }
  'DELETE /v1/admin/rooms/:id': { res: { ok: true } }              // only when it has no future bookings; else active=0
  'GET /v1/admin/settings': { res: Settings }
  'PATCH /v1/admin/settings': { req: Partial<Settings>; res: Settings }
  'PATCH /v1/admin/users/:id': { req: { role?: Role; disabled?: 0 | 1; name?: string }; res: User }
  'POST /v1/admin/announce': { req: { title: string; body: string; to: 'all' | 'staff' | 'customers' }; res: { sent: number } }
  'GET /v1/admin/report?from=&to=': { res: { bookings: Booking[]; revenue: number; hours_by_room: Record<string, number> } }
  // integrations
  'POST /v1/payments/shamcash/webhook': { req: { ref: string; amount: number; sender?: string; note?: string }; res: { matched: boolean } }  // X-Webhook-Secret header
}
export interface PaymentInfo {
  method: PaymentMethod; amount: number; code: string; shamcash_number: string; shamcash_name: string
  shamcash_qr: string | null; instructions: string; hold_until: string | null; ref: string | null
}
