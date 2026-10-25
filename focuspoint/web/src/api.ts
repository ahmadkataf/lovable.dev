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

  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('لا يوجد اتصال بالإنترنت', 0, true)
  }

  const text = await res.text()
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

/** Arabic, user-facing text for any thrown error (server messages are shown when they are already Arabic). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.offline) return 'لا يوجد اتصال بالإنترنت'
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
