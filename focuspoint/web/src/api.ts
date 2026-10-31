// Thin typed fetch wrapper for the Focus Point API (see ../shared/types.ts → ApiContract).
// Always sends X-Device; adds the team bearer token when one is stored. A network failure throws
// ApiError with offline=true and status=0 so screens can fall back to their caches.
import { deviceId } from './device'

export const TOKEN_KEY = 'fp_team_token'
const BASE: string = import.meta.env.VITE_API_BASE || ''

export class ApiError extends Error {
  status: number
  offline: boolean
  constructor(message: string, status: number, offline = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.offline = offline
  }
}

export function teamToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Device': deviceId() }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = teamToken()
  if (token) headers.Authorization = `Bearer ${token}`

  // A weak connection can leave a request hanging for minutes: reads give up after 15 s (the screen then uses the
  // copy saved on the phone); writes get longer so a booking is not cut off half-way.
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), method === 'GET' ? 15_000 : 45_000) : 0
  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl?.signal })
  } catch {
    clearTimeout(timer)
    throw new ApiError('لا يوجد اتصال بالإنترنت', 0, true)
  }

  let text: string
  try { text = await res.text() } catch { throw new ApiError('لا يوجد اتصال بالإنترنت', 0, true) } finally { clearTimeout(timer) }
  let data: unknown = undefined
  if (text) {
    try { data = JSON.parse(text) } catch { data = undefined }
  }
  if (!res.ok) {
    const serverMsg = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
      ? (data as { error: string }).error
      : ''
    throw new ApiError(serverMsg || `HTTP ${res.status}`, res.status)
  }
  return data as T
}

export const api = {
  get<T>(path: string): Promise<T> { return request<T>('GET', path) },
  post<T>(path: string, body?: unknown): Promise<T> { return request<T>('POST', path, body ?? {}) },
  patch<T>(path: string, body: unknown): Promise<T> { return request<T>('PATCH', path, body) },
  del<T>(path: string): Promise<T> { return request<T>('DELETE', path) },
}

/** Arabic text for the server's error codes the customer app can hit. */
const CODES: Record<string, string> = {
  slot_taken: 'هذا الوقت صار محجوزاً، اختر وقتاً آخر',
  hold_expired: 'انتهت مهلة الحجز — احجز من جديد',
  ref_used: 'رقم العملية هذا مسجّل على حجز آخر — تأكد من الرقم كما يظهر في شام كاش',
  invalid_ref: 'رقم العملية غير صحيح — أدخله كما يظهر في تطبيق شام كاش',
  illegal_transition: 'حالة الحجز تغيّرت — حدّث الصفحة',
  booking_not_found: 'ما لقينا هذا الحجز',
  customer_blocked: 'ما قدرنا نكمل الحجز بهذا الرقم — تواصل مع المركز',
  too_many_open: 'عندك حجز بانتظار الدفع — أكمله أو ألغِه أولاً',
  in_past: 'هذا الوقت مضى — اختر وقتاً لاحقاً',
  outside_hours: 'الوقت خارج ساعات العمل',
  off_grid: 'الوقت غير مطابق لخانات الحجز',
  not_same_day: 'يجب أن يبدأ الحجز وينتهي في اليوم نفسه',
  too_short: 'المدة أقل من الحد الأدنى',
  too_long: 'المدة أكثر من الحد الأقصى',
  invalid_phone: 'رقم الهاتف غير صحيح (09XXXXXXXX)',
  invalid_name: 'اكتب اسمك (حرفان على الأقل)',
  cash_not_allowed: 'الدفع عند الوصول غير متاح حالياً — ادفع عبر شام كاش',
  invalid_method: 'طريقة الدفع غير متاحة',
  too_many_attempts: 'محاولات كثيرة، جرّب بعد 15 دقيقة',
  invalid_credentials: 'رقم الهاتف أو كلمة المرور غير صحيحة',
  account_disabled: 'هذا الحساب معطّل — راجع المدير',
  too_many_pending: 'عندك حجوزات بانتظار الدفع — أكملها أو ألغِ واحداً منها أولاً',
  too_many_people: 'عدد الأشخاص أكبر من سعة الغرفة',
  booking_closed: 'الحجز أونلاين متوقف حالياً — تواصل مع المركز عبر واتساب أو الهاتف',
  shamcash_disabled: 'الدفع عبر شام كاش غير متاح حالياً — اختر الدفع عند الوصول',
  too_far_ahead: 'لا يمكن الحجز لهذا اليوم بعد — اختر يوماً أقرب',
  cancel_not_allowed: 'إلغاء الحجز يتم عن طريق المركز — تواصل معنا',
}
/** The raw server error code (e.g. "ref_used") when the error carries one. */
export function errorCode(err: unknown): string | null {
  return err instanceof ApiError && /^[a-z_]+$/.test(err.message) ? err.message : null
}

/** Arabic, user-facing text for any thrown error (server messages are shown when they are already Arabic). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.offline) return 'لا يوجد اتصال بالإنترنت'
    if (CODES[err.message]) return CODES[err.message]
    if (/[؀-ۿ]/.test(err.message)) return err.message
    switch (err.status) {
      case 400: return 'البيانات المدخلة غير صحيحة'
      case 401: return 'انتهت الجلسة، سجّل الدخول من جديد'
      case 403: return 'ما عندك صلاحية لهذا الإجراء'
      case 404: return 'غير موجود'
      case 409: return 'هذا الوقت صار محجوزاً، اختر وقتاً آخر'
      case 429: return 'محاولات كثيرة، جرّب بعد قليل'
      default: return err.status >= 500 ? 'خلل في الخادم، جرّب بعد لحظات' : 'حدث خطأ غير متوقع'
    }
  }
  return 'حدث خطأ غير متوقع'
}
