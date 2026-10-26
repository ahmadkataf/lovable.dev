// Focus Point — shared domain types and the HTTP API contract (used by api/ and web/).
// Times are ISO-8601 strings in UTC; the centre's local zone is Asia/Damascus (settings.timezone).
// The editable site content (texts, images, links of the website) has its own contract in ./content.
import type { ContentErrorCode, Photo, SectionId, SiteContent } from './content'
export type { ContentErrorCode, Photo, SectionId, SiteContent } from './content'

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
  photos: Photo[]                                    // in order, ≤8 (admin); [] → the site shows its group photo (content spaces.groups)
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
  allow_pay_on_arrival: boolean                        // customers may choose "cash on arrival" (default false): no transfer, staff confirm at the desk
  // ---- booking & payment capabilities (admin › الإعدادات). The defaults keep today's behaviour. ----
  /** Online booking is open (default true). false → the booking pages show booking_closed_message (or the content's
   *  booking.closed_text) instead of the form, and the API refuses new customer bookings with 409 `booking_closed`.
   *  Team walk-ins are not affected. */
  booking_enabled: boolean
  /** Shown on the booking pages while booking_enabled is false; '' → content booking.closed_text. ≤500 chars, default ''. */
  booking_closed_message: string
  /** Customers may pay by Sham Cash transfer (default true). At least one of shamcash_enabled / allow_pay_on_arrival
   *  stays on; false → cash on arrival only, and method 'shamcash' from a customer is refused with 400 `shamcash_disabled`. */
  shamcash_enabled: boolean
  /** How many days ahead (today included) a customer may book: the /book date strip and a server check
   *  (400 `too_far_ahead`). 1–365, default 14. */
  booking_horizon_days: number
  /** Reminder push this many minutes before a confirmed booking starts (cron window ±5 min). 0 = no reminders,
   *  otherwise 15–1440. Default 60. */
  reminder_minutes: number
  /** Unpaid Sham Cash holds one phone may have at the same time (429 `too_many_pending`). 1–20, default 3. */
  max_open_holds_per_phone: number
  /** Customers may cancel their own booking while it is not yet confirmed (default true, today's rule). false → the
   *  cancel button is hidden and POST /v1/bookings/:id/cancel from a customer is refused (409 `cancel_not_allowed`). */
  customer_can_cancel: boolean
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
  'POST /v1/bookings': { req: { room_id: number; start: string; end: string; name: string; phone: string; people?: number; note?: string; method?: 'shamcash' | 'cash' }; res: Booking }  // shamcash (default) → pending_payment + hold; cash (only when settings.allow_pay_on_arrival) → awaiting_verification at once, no hold
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
  'GET /v1/team/ping': { res: { now: string; pending: number; last_change: string | null } }   // cheap 5-second poll: pending verifications + the latest booking change (poll GET /v1/team/sync?since= when it moves)
  'POST /v1/team/sync': { req: { ops: SyncOp[] }; res: { results: SyncResult[]; now: string } }   // replay the offline queue, in order, idempotent by client_id
  // admin only
  'POST /v1/admin/rooms': { req: Omit<Room, 'id' | 'photos'> & { photos?: Photo[] }; res: Room }   // photos ≤8, src /img/… or /media/… (PATCH and sync room_upsert take them too)
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
  // site content (see ./content): defaults ⊕ the sections the admin saved
  'GET /v1/content': { res: ContentResponse }                       // public; Cache-Control: no-cache + ETag (304 on If-None-Match)
  'GET /v1/admin/content': { res: AdminContentResponse }
  'PUT /v1/admin/content/:section': { req: SiteContent[SectionId]; res: ContentSectionResponse }   // body = the full section value, checked by validateSection (400 InvalidContentError)
  'DELETE /v1/admin/content/:section': { res: ContentSectionResponse }                             // back to the default
  // undo: every PUT / DELETE / undo first keeps the section's previous value (site_content_history, last 20 per section)
  'GET /v1/admin/content/:section/history': { res: ContentHistoryEntry[] }                         // newest first, ≤20
  'POST /v1/admin/content/:section/undo': { res: ContentSectionResponse }                          // restores the latest kept value (409 nothing_to_undo)
  // uploaded images (stored in D1). Raw body image/webp|jpeg|png ≤ 1,000,000 bytes; w/h = pixel size measured by the browser
  'POST /v1/admin/media?w=&h=': { req: Blob | ArrayBuffer; res: MediaUpload }
  'GET /v1/admin/media': { res: MediaItem[] }                      // newest first
  'DELETE /v1/admin/media/:id': { res: { ok: true } }              // 409 media_in_use while content or a room photo uses it
  // (outside /v1) GET /media/:id.webp → the image bytes, Cache-Control: public, max-age=31536000, immutable
  // integrations
  'POST /v1/payments/shamcash/webhook': { req: { ref: string; amount: number; sender?: string; note?: string }; res: { matched: boolean } }  // X-Webhook-Secret header
}
export type PublicSettings = Pick<Settings, 'centre_name' | 'phone' | 'address' | 'instagram' | 'timezone' | 'open' | 'close' | 'slot_minutes' | 'min_minutes' | 'max_minutes' | 'hold_minutes' | 'allow_pay_on_arrival' | 'plan' | 'vapid_public_key'
  | 'booking_enabled' | 'booking_closed_message' | 'shamcash_enabled' | 'booking_horizon_days' | 'reminder_minutes' | 'max_open_holds_per_phone' | 'customer_can_cancel'>
export interface ContentResponse { content: SiteContent; updated_at: string | null }   // updated_at null = nothing saved yet
export interface AdminContentResponse extends ContentResponse { overridden: SectionId[] }   // the sections the admin saved
export interface ContentSectionResponse {
  section: SectionId
  value: SiteContent[SectionId]     // the merged section as the site now shows it
  overridden: boolean               // false after DELETE (default again)
  updated_at: string | null
}
/** 400 from PUT /v1/admin/content/:section: `reason` and `path` come from validateSection, `message` is its Arabic text. */
export interface InvalidContentError { error: 'invalid_content'; reason: ContentErrorCode; path: string; message: string }
/** One kept value of a section (GET …/history, newest first): what the section showed before the save at saved_at. */
export interface ContentHistoryEntry {
  id: number
  saved_at: string | null        // when it was replaced
  saved_by: number | null        // the admin who replaced it
  saved_by_name: string | null
  was_default: boolean           // true → before that save the section showed the default
  value: SiteContent[SectionId]  // the section as it looked then (merged with today's defaults, so always renderable)
}
export interface MediaUpload { id: string; src: string; w: number; h: number; bytes: number }   // src = '/media/<id>.webp' (or .jpg / .png)
export interface MediaItem extends MediaUpload {
  mime: 'image/webp' | 'image/jpeg' | 'image/png'
  created_at: string
  used: boolean                     // referenced by the content or by a room photo
}
// The JSON a Web Push carries (the service worker shows it and forwards it to open clients via postMessage).
export interface PushMessage { kind: NotificationKind; booking_id: number | null; url: string; title: string; body: string; tag?: string }
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
