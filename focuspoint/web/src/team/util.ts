// Small helpers for the team panel: ids, Arabic error text, prices, labels, links, CSV.
import type { Booking, BookingStatus, PaymentMethod, Room, RoomContents, RoomType, Settings } from '@shared/types'
import { ApiError } from '../api'
import { normalisePhone, toLocalParts } from '../format'
import type { IconName } from '../ui'

export function uuid(): string {
  const c: Crypto & { randomUUID?: () => string } = crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Deterministic negative id for an entity created offline (from the op's client_id). Real ids are positive. */
export function tempId(clientId: string): number {
  let h = 2166136261
  for (let i = 0; i < clientId.length; i++) { h ^= clientId.charCodeAt(i); h = Math.imul(h, 16777619) }
  return -(((h >>> 0) % 2_000_000_000) + 1)
}
export const isTemp = (id: number): boolean => id < 0

export const cx = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(' ')

// ---- Arabic text for server error codes (REST errors and SyncResult.error) ----
const ERRORS: Record<string, string> = {
  slot_taken: 'هذا الوقت صار محجوزاً — تداخل مع حجز آخر',
  ref_used: 'رقم العملية مسجّل على حجز آخر',
  hold_expired: 'انتهت مهلة الدفع لهذا الحجز',
  cash_not_allowed: 'الدفع عند الوصول غير مفعّل في الإعدادات',
  illegal_transition: 'حالة الحجز تغيّرت ولم يعد هذا الإجراء ممكناً',
  booking_not_found: 'الحجز غير موجود',
  room_not_found: 'القاعة غير موجودة',
  user_not_found: 'الحساب غير موجود',
  customer_blocked: 'هذا الزبون محظور',
  phone_taken: 'رقم الهاتف مستخدم لحساب آخر',
  weak_password: 'كلمة المرور قصيرة (6 أحرف على الأقل)',
  cannot_change_self: 'لا يمكنك تغيير صلاحيات حسابك أو تعطيله',
  forbidden: 'هذا الإجراء للمدير فقط',
  unauthorized: 'انتهت الجلسة، سجّل الدخول من جديد',
  invalid_token: 'انتهت الجلسة، سجّل الدخول من جديد',
  account_disabled: 'هذا الحساب معطّل',
  invalid_phone: 'رقم الهاتف غير صحيح (09XXXXXXXX)',
  invalid_name: 'الاسم غير صحيح (حرفان على الأقل)',
  invalid_time: 'الوقت غير صحيح',
  off_grid: 'الوقت لا يطابق خانات الحجز (كل 30 أو 60 دقيقة)',
  not_same_day: 'يجب أن يبدأ الحجز وينتهي في اليوم نفسه',
  outside_hours: 'الوقت خارج ساعات العمل',
  too_short: 'المدة أقل من الحد الأدنى',
  too_long: 'المدة أكثر من الحد الأقصى',
  in_past: 'الوقت في الماضي',
  invalid_price: 'السعر غير صحيح',
  invalid_method: 'طريقة الدفع غير صحيحة',
  invalid_color: 'اللون غير صحيح',
  invalid_plan: 'بيانات المخطط غير صحيحة (الأبعاد بين 200 و5000)',
  invalid_qr: 'صورة QR غير مقبولة (PNG/JPEG حتى 300 كيلوبايت)',
  invalid_hours: 'ساعات العمل غير صحيحة (الافتتاح قبل الإغلاق)',
  invalid_duration: 'حدود المدة غير صحيحة (مضاعفات طول الخانة، والأدنى ≤ الأقصى)',
  invalid_hold: 'مهلة الدفع بين 5 و180 دقيقة',
  invalid_slot_minutes: 'طول الخانة 30 أو 60 دقيقة',
  invalid_capacity: 'السعة غير صحيحة',
  invalid_contents: 'محتويات القاعة غير صحيحة',
  invalid_date: 'التاريخ غير صحيح',
  invalid_status: 'الحالة غير صحيحة',
  invalid_ops: 'طلب المزامنة غير صالح',
  unknown_op: 'نوع التغيير غير معروف',
  invalid_op: 'التغيير غير صالح',
  depends_failed: 'يعتمد على تغيير سابق لم يُقبل',
  internal: 'خلل في الخادم، سنعيد المحاولة',
  too_many_attempts: 'محاولات كثيرة، جرّب بعد قليل',
  invalid_credentials: 'رقم الهاتف أو كلمة المرور غير صحيحة',
}

/** Arabic text for any error (ApiError, server code string, or unknown). */
export function describeError(err: unknown): string {
  if (typeof err === 'string') return ERRORS[err] ?? (/[؀-ۿ]/.test(err) ? err : `خطأ: ${err}`)
  if (err instanceof ApiError) {
    if (err.offline) return 'لا يوجد اتصال بالإنترنت'
    if (ERRORS[err.message]) return ERRORS[err.message]
    if (/[؀-ۿ]/.test(err.message)) return err.message
    switch (err.status) {
      case 400: return 'البيانات المدخلة غير صحيحة'
      case 401: return ERRORS.unauthorized
      case 403: return ERRORS.forbidden
      case 404: return 'غير موجود'
      case 409: return ERRORS.slot_taken
      case 429: return ERRORS.too_many_attempts
      default: return err.status >= 500 ? 'خلل في الخادم، جرّب بعد لحظات' : 'حدث خطأ غير متوقع'
    }
  }
  if (err instanceof Error && /[؀-ۿ]/.test(err.message)) return err.message
  return 'حدث خطأ غير متوقع'
}

// ---- labels ----
export const ROOM_TYPE: Record<RoomType, string> = { private: 'غرفة خاصة', meeting: 'قاعة اجتماعات', desk: 'مساحة مفتوحة', hall: 'قاعة' }
export const ROOM_TYPES: RoomType[] = ['private', 'meeting', 'desk', 'hall']
export const METHOD: Record<PaymentMethod, string> = { shamcash: 'شام كاش', cash: 'نقداً', free: 'مجاني' }
export const STATUSES: BookingStatus[] = ['awaiting_verification', 'pending_payment', 'confirmed', 'completed', 'cancelled', 'rejected', 'expired']
export const LIVE: BookingStatus[] = ['pending_payment', 'awaiting_verification', 'confirmed']
export const isLive = (s: BookingStatus): boolean => LIVE.includes(s)
/** The server's "live booking" rule (api/src/bookings.ts isBlocking): confirmed, awaiting verification, or a hold that
 *  has not run out yet. Use it for conflicts and the grid; `isLive` is only a status filter. */
export function isBlocking(b: Pick<Booking, 'status' | 'hold_until'>, now = Date.now()): boolean {
  if (b.status === 'confirmed' || b.status === 'awaiting_verification') return true
  if (b.status === 'pending_payment') return b.hold_until !== null && Date.parse(b.hold_until) > now
  return false
}
/** Conflicting live booking of the same room over [start, end), excluding `selfId`. */
export function findConflict(bookings: Booking[], roomId: number, start: string, end: string, selfId: number | null = null, now = Date.now()): Booking | undefined {
  return bookings.find((o) => o.id !== selfId && o.room_id === roomId && isBlocking(o, now) && overlaps(start, end, o.start, o.end))
}
/** A verification that is still worth the team's attention: not more than 30 minutes past its end. */
export function isPendingVerification(b: Booking, now = Date.now()): boolean {
  return b.status === 'awaiting_verification' && Date.parse(b.end) + 30 * 60000 > now
}

export function capacityLabel(n: number): string {
  if (n === 1) return 'شخص واحد'
  if (n === 2) return 'شخصان'
  if (n <= 10) return `${n} أشخاص`
  return `${n} شخصاً`
}

export function contentsList(c: RoomContents): { icon: IconName; label: string }[] {
  const out: { icon: IconName; label: string }[] = []
  if (c.chairs) out.push({ icon: 'chair', label: c.chairs === 1 ? 'كرسي' : c.chairs === 2 ? 'كرسيان' : `${c.chairs} كراسي` })
  if (c.tables) out.push({ icon: 'table', label: c.tables === 1 ? 'طاولة' : c.tables === 2 ? 'طاولتان' : `${c.tables} طاولات` })
  if (c.screen) out.push({ icon: 'screen', label: 'شاشة' })
  if (c.projector) out.push({ icon: 'projector', label: 'بروجكتر' })
  if (c.whiteboard) out.push({ icon: 'whiteboard', label: 'سبورة' })
  if (c.wifi) out.push({ icon: 'wifi', label: 'إنترنت' })
  if (c.ac) out.push({ icon: 'ac', label: 'تكييف' })
  if (c.coffee) out.push({ icon: 'coffee', label: 'قهوة' })
  return out
}

// ---- time grid ----
export const toMin = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export const toHHMM = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const minutesBetween = (startIso: string, endIso: string): number => Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000)

/** Start times offered for manual bookings: opening → last start that fits min_minutes (past times allowed for walk-ins). */
export function startOptions(s: Pick<Settings, 'open' | 'close' | 'slot_minutes' | 'min_minutes'>): string[] {
  const open = toMin(s.open), close = toMin(s.close), step = s.slot_minutes || 30
  const out: string[] = []
  for (let t = Math.ceil(open / step) * step; t + s.min_minutes <= close; t += step) out.push(toHHMM(t))
  return out
}
/** Durations (minutes) that fit between a start time and closing. */
export function durationOptions(s: Pick<Settings, 'close' | 'slot_minutes' | 'min_minutes' | 'max_minutes'>, time: string): number[] {
  const step = s.slot_minutes || 30
  const max = Math.min(s.max_minutes, toMin(s.close) - toMin(time))
  const out: number[] = []
  for (let m = s.min_minutes; m <= max; m += step) out.push(m)
  return out
}
/** Same formula as the server: hourly price, capped by the day price from 8 hours. */
export function priceFor(room: Pick<Room, 'price_hour' | 'price_day'>, minutes: number): number {
  const hourly = Math.round((minutes / 60) * room.price_hour)
  if (room.price_day !== null && room.price_day !== undefined && minutes >= 8 * 60) return Math.min(room.price_day, hourly)
  return hourly
}
export const localDate = (iso: string): string => toLocalParts(iso).date
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd)
}

// ---- contact links ----
export const telHref = (phone: string): string => `tel:${phone}`
export function whatsappHref(phone: string, text?: string): string {
  const p = normalisePhone(phone) ?? phone
  const intl = p.startsWith('0') ? `963${p.slice(1)}` : p.replace(/\D/g, '')
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// ---- files ----
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

/** Digits (incl. Arabic-Indic) → integer, or null. */
export function parseInt10(v: string): number | null {
  const d = v.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[^\d]/g, '')
  return d ? Number(d) : null
}

export function sortByStart(a: Booking, b: Booking): number { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0 }
