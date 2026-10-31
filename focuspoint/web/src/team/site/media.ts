// Shared plumbing of the site editor's requests: headers (X-Device + team token, as in ../../api), an error type that
// keeps the server's `path` (so the exact field can be shown), image uploads with progress (XMLHttpRequest — fetch
// has no upload progress), where a picture loads from, and Arabic error text. Used by the editor and the room sheet.
import type { MediaUpload } from '@shared/types'
import { ApiError, teamToken } from '../../api'
import { deviceId } from '../../device'

export const API_BASE: string = import.meta.env.VITE_API_BASE || ''

/** An API error that may point at one field of a section (`path`, dot path inside the section). */
export class SiteApiError extends ApiError {
  path: string | null
  detail: string | null     // the server's message, shown when it is Arabic
  constructor(code: string, status: number, offline = false, path: string | null = null, detail: string | null = null) {
    super(code, status, offline)
    this.name = 'SiteApiError'
    this.path = path
    this.detail = detail
  }
}

export function requestHeaders(json: boolean): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'X-Device': deviceId() }
  if (json) h['Content-Type'] = 'application/json'
  const token = teamToken()
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

export function errorFrom(status: number, text: string): SiteApiError {
  let data: unknown
  try { data = text ? JSON.parse(text) : undefined } catch { data = undefined }
  const o = (data && typeof data === 'object' ? data : {}) as { error?: unknown; path?: unknown; message?: unknown }
  return new SiteApiError(
    typeof o.error === 'string' ? o.error : `HTTP ${status}`,
    status,
    false,
    typeof o.path === 'string' ? o.path : null,
    typeof o.message === 'string' ? o.message : null,
  )
}

/** POST /v1/admin/media with the raw image bytes; onProgress gets 0…1 while the body goes up. */
export function uploadMedia(blob: Blob, w: number, h: number, onProgress?: (p: number) => void): Promise<MediaUpload> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/v1/admin/media?w=${w}&h=${h}`)
    for (const [k, v] of Object.entries(requestHeaders(false))) xhr.setRequestHeader(k, v)
    xhr.setRequestHeader('Content-Type', blob.type)
    xhr.timeout = 120_000
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total) }
    xhr.onerror = () => reject(new SiteApiError('offline', 0, true))
    xhr.ontimeout = () => reject(new SiteApiError('offline', 0, true))
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(errorFrom(xhr.status, xhr.responseText)); return }
      try {
        const r = JSON.parse(xhr.responseText) as MediaUpload
        if (!r || typeof r.src !== 'string') throw new Error('bad')
        resolve(r)
      } catch { reject(new SiteApiError('bad_response', xhr.status)) }
    }
    xhr.send(blob)
  })
}

/** Where the browser loads a site picture from: /img/… ships with this app; /media/… is served by the API. */
export function mediaUrl(src: string): string {
  return src.startsWith('/media/') ? API_BASE + src : src
}

// ---- Arabic text for the editor's errors ----
const CODES: Record<string, string> = {
  invalid_content: 'في حقل قيمته غير صحيحة',
  unknown_section: 'قسم غير معروف',
  media_in_use: 'الصورة مستخدمة بالموقع أو بقاعة، ما فيك تحذفها',
  media_too_large: 'الصورة أكبر من 1 ميغا حتى بعد التصغير',
  media_quota: 'وصلت مساحة الصور للحد (300 صورة أو 150 ميغا) وكلها مستعملة بالموقع. أزل صوراً من الأقسام ثم جرّب بكرا.',
  too_large: 'الصورة أكبر من 1 ميغا حتى بعد التصغير',
  payload_too_large: 'الصورة أكبر من 1 ميغا حتى بعد التصغير',
  unsupported_media: 'نوع الصورة غير مدعوم (WebP أو JPEG أو PNG)',
  unsupported_media_type: 'نوع الصورة غير مدعوم (WebP أو JPEG أو PNG)',
  empty_body: 'الصورة فاضية، جرّب كمان مرة',
  media_not_found: 'الصورة مو موجودة',
  invalid_json: 'البيانات ما وصلت كاملة، جرّب كمان مرة',
  invalid_image: 'الملف مو صورة صالحة',
  invalid_size: 'أبعاد الصورة غير صحيحة',
  invalid_photos: 'صور القاعة غير صحيحة (8 صور كحد أقصى)',
  nothing_to_undo: 'ما في حفظ سابق لنرجعله',
  no_history: 'ما في حفظ سابق لنرجعله',
  forbidden: 'هذا الإجراء للمدير فقط',
  unauthorized: 'انتهت الجلسة، سجّل الدخول من جديد',
  invalid_token: 'انتهت الجلسة، سجّل الدخول من جديد',
  bad_response: 'ردّ غير متوقع من الخادم، جرّب كمان مرة',
}
const hasArabic = (s: string) => /[؀-ۿ]/.test(s)

export function siteErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.offline) return 'ما في اتصال بالإنترنت — تعديلاتك باقية هون، احفظها لما يرجع الاتصال'
    if (err instanceof SiteApiError && err.detail && hasArabic(err.detail)) return err.detail
    if (CODES[err.message]) return CODES[err.message] as string
    if (hasArabic(err.message)) return err.message
    switch (err.status) {
      case 400: return 'البيانات غير صحيحة'
      case 401: return CODES.unauthorized as string
      case 403: return CODES.forbidden as string
      case 404: return 'محرّر الموقع غير متاح على الخادم بعد'
      case 413: return CODES.too_large as string
      case 415: return CODES.unsupported_media as string
      case 429: return 'محاولات كثيرة، جرّب بعد شوي'
      default: return err.status >= 500 ? 'خلل بالخادم، جرّب بعد لحظات' : 'صار خطأ غير متوقع'
    }
  }
  if (err instanceof Error && hasArabic(err.message)) return err.message
  return 'صار خطأ غير متوقع'
}
