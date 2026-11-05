/* API client (docs/mvp-spec.md §7 "Offline"):
   - Authorization: Bearer <token> from localStorage.
   - Every successful GET is cached in localStorage (`cache:<url>` with a
     timestamp) and the cached copy is returned when fetch fails.
   - POSTs to attendance / homework / submit are queued in `outbox` while
     offline and replayed in order when `online` fires. Homework carries a
     client-generated `client_id` the server dedupes on. An item the server
     rejects (4xx) stays in the outbox, marked with the error, until the user
     retries or discards it.
   - Dev mock: when the build is made with VITE_MOCK=1 every request goes to
     src/mock.ts instead of fetch. The mock is loaded behind that build-time
     constant, so a production build does not contain it at all. */

import type { DirectorateDashboard, DirectorateSchoolDay, DirectorateWeeklyReport, LoginResponse, User } from './types';

export const MOCK_ENV = import.meta.env.VITE_MOCK === '1';

const KEY = { token: 'token', user: 'user', code: 'code', mock: 'mock', outbox: 'outbox' } as const;
const CACHE_PREFIX = 'cache:';
const QUEUEABLE = [/^\/api\/attendance$/, /^\/api\/homework$/, /^\/api\/homework\/\d+\/submit$/];

export class ApiError extends Error {
  constructor(public status: number, message: string, public offline = false) {
    super(message);
  }
}

/* ───────── events ───────── */

export type ApiEventName = 'from-cache' | 'fresh' | 'outbox' | 'unauthorized' | 'outbox-error' | 'replayed';
type Listener = (detail?: unknown) => void;
const listeners = new Map<ApiEventName, Set<Listener>>();

export function onApi(name: ApiEventName, fn: Listener): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(fn);
  return () => listeners.get(name)?.delete(fn);
}
function emit(name: ApiEventName, detail?: unknown) {
  listeners.get(name)?.forEach((fn) => {
    try { fn(detail); } catch (e) { console.error(e); }
  });
}

/* ───────── storage helpers ───────── */

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}
function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function getToken(): string | null {
  return lsGet(KEY.token);
}
export function getStoredUser(): User | null {
  try { const raw = lsGet(KEY.user); return raw ? (JSON.parse(raw) as User) : null; } catch { return null; }
}
export function getStoredCode(): string | null {
  return lsGet(KEY.code);
}
/** The in-memory demo is used only by builds made with VITE_MOCK=1 (the production build never falls back to it). */
export function isMock(): boolean {
  return MOCK_ENV;
}

export function setSession(token: string, user: User, code: string, viaMock: boolean) {
  clearCache();
  lsSet(KEY.token, token);
  lsSet(KEY.user, JSON.stringify(user));
  lsSet(KEY.code, code.toUpperCase());
  if (viaMock) lsSet(KEY.mock, '1'); else lsRemove(KEY.mock);
}

export function clearSession() {
  lsRemove(KEY.token);
  lsRemove(KEY.user);
  lsRemove(KEY.code);
  lsRemove(KEY.mock);
  clearCache();
}

/** Forget everything done in the demo session (mock builds only). */
export async function resetMockData(): Promise<void> {
  if (MOCK_ENV) (await import('./mock')).resetMock();
}

/* ───────── GET cache ───────── */

interface CacheEntry<T> { t: number; data: T }

export function peekCache<T>(url: string): T | null {
  try {
    const raw = lsGet(CACHE_PREFIX + url);
    if (!raw) return null;
    return (JSON.parse(raw) as CacheEntry<T>).data;
  } catch { return null; }
}
function writeCache(url: string, data: unknown) {
  lsSet(CACHE_PREFIX + url, JSON.stringify({ t: Date.now(), data } satisfies CacheEntry<unknown>));
}
export function clearCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/* ───────── transport ───────── */

interface Raw { status: number; data: unknown; cached: boolean; swOffline: boolean; contentType: string }

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof DOMException && e.name === 'AbortError');
}

async function raw(method: string, url: string, body?: unknown, timeoutMs = 15000): Promise<Raw> {
  if (MOCK_ENV) {
    const { mockRequest } = await import('./mock');
    const r = await mockRequest(method, url, body, getToken());
    return { status: r.status, data: r.body, cached: false, swOffline: false, contentType: r.contentType ?? 'application/json' };
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
    const contentType = res.headers.get('content-type') ?? '';
    let data: unknown = null;
    if (contentType.includes('application/json')) {
      try { data = await res.json(); } catch { data = null; }
    } else {
      data = await res.text();
    }
    return { status: res.status, data, cached: res.headers.get('x-madar-cache') === '1', swOffline: res.headers.get('x-madar-offline') === '1', contentType };
  } finally {
    clearTimeout(timer);
  }
}

function errorMessage(r: Raw, fallback: string): string {
  const d = r.data as { error?: unknown } | null;
  if (d && typeof d === 'object' && typeof d.error === 'string') return d.error;
  return fallback;
}

export const SESSION_EXPIRED = 'انتهت الجلسة، يلزم تسجيل الدخول مجدّداً';

function handleStatus(r: Raw): void {
  if (r.status === 401) {
    emit('unauthorized');
    throw new ApiError(401, errorMessage(r, SESSION_EXPIRED));
  }
  if (r.status >= 400) throw new ApiError(r.status, errorMessage(r, r.status >= 500 ? 'خطأ في الخادم، يُرجى المحاولة لاحقاً' : 'تعذّر تنفيذ الطلب'));
}

export async function get<T>(url: string): Promise<T> {
  let r: Raw;
  try {
    r = await raw('GET', url);
    if (r.swOffline) throw new TypeError('offline');
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const cached = peekCache<T>(url);
    if (cached !== null) {
      emit('from-cache', url);
      return cached;
    }
    emit('from-cache', url);
    throw new ApiError(0, 'لا اتصال بالخادم ولا نسخة محفوظة لهذه الشاشة', true);
  }
  handleStatus(r);
  if (r.cached) emit('from-cache', url);
  else emit('fresh', url);
  writeCache(url, r.data);
  return r.data as T;
}

export interface PostOptions { queueable?: boolean }
export interface Queued { queued: true; client_id?: string }

export async function post<T>(url: string, body: unknown, opts: PostOptions = {}): Promise<T | Queued> {
  const queueable = opts.queueable ?? QUEUEABLE.some((re) => re.test(url));
  if (queueable && typeof navigator !== 'undefined' && navigator.onLine === false) return enqueue(url, body);
  let r: Raw;
  try {
    r = await raw('POST', url, body);
    if (r.swOffline) throw new TypeError('offline');
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    if (queueable) return enqueue(url, body);
    throw new ApiError(0, 'لا اتصال بالخادم', true);
  }
  handleStatus(r);
  emit('fresh', url);
  return r.data as T;
}

/* ───────── outbox ───────── */

/** A queued write. `error` is set when the server refused it (4xx): it then waits for a retry or a discard. */
export interface OutboxItem { id: string; url: string; body: unknown; created_at: string; label: string; error?: string }
export interface OutboxState { pending: number; rejected: OutboxItem[] }

function labelFor(url: string): string {
  if (url === '/api/attendance') return 'تسجيل حضور';
  if (url === '/api/homework') return 'نشر واجب';
  if (/\/submit$/.test(url)) return 'تسليم واجب';
  return url;
}

export function outboxItems(): OutboxItem[] {
  try { const raw = lsGet(KEY.outbox); return raw ? (JSON.parse(raw) as OutboxItem[]) : []; } catch { return []; }
}
export function outboxState(): OutboxState {
  const items = outboxItems();
  return { pending: items.filter((i) => !i.error).length, rejected: items.filter((i) => !!i.error) };
}
function saveOutbox(items: OutboxItem[]) {
  lsSet(KEY.outbox, JSON.stringify(items));
  emit('outbox', outboxState());
}
/** Writes still waiting to be sent (rejected ones are not counted). */
export function outboxCount(): number {
  return outboxState().pending;
}

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

function enqueue(url: string, body: unknown): Queued {
  const items = outboxItems();
  const id = newId();
  items.push({ id, url, body, created_at: new Date().toISOString(), label: labelFor(url) });
  saveOutbox(items);
  const b = body as { client_id?: string } | null;
  return { queued: true, client_id: b && typeof b === 'object' ? b.client_id : undefined };
}

function markRejected(id: string, error: string) {
  saveOutbox(outboxItems().map((x) => (x.id === id ? { ...x, error } : x)));
}

/** Clears the error of a rejected item and replays the outbox. */
export async function retryOutboxItem(id: string): Promise<number> {
  const items = outboxItems().map((x) => (x.id === id ? { ...x, error: undefined } : x));
  saveOutbox(items);
  return replayOutbox();
}
/** Drops a rejected item for good. */
export function discardOutboxItem(id: string) {
  saveOutbox(outboxItems().filter((x) => x.id !== id));
}

let replaying = false;
/** Replay the pending items in order. Stops at the first network failure; items the server rejects (4xx) are kept
    and marked, so the user can retry or discard them from the outbox banner. */
export async function replayOutbox(): Promise<number> {
  if (replaying) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  if (!getToken()) return 0;
  replaying = true;
  let sent = 0;
  try {
    for (const item of outboxItems().filter((x) => !x.error)) {
      try {
        const r = await raw('POST', item.url, item.body);
        if (r.swOffline) break;
        if (r.status === 401) { emit('unauthorized'); break; }
        if (r.status >= 500) break;
        if (r.status >= 400) {
          const msg = errorMessage(r, 'رفض الخادم العملية');
          markRejected(item.id, msg);
          emit('outbox-error', `${item.label}: ${msg}`);
          continue;
        }
        saveOutbox(outboxItems().filter((x) => x.id !== item.id));
        sent++;
      } catch (e) {
        if (isNetworkError(e)) break;
        markRejected(item.id, 'تعذّر الإرسال');
        emit('outbox-error', `${item.label}: تعذّر الإرسال`);
      }
    }
  } finally {
    replaying = false;
  }
  if (sent) emit('replayed', sent);
  return sent;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void replayOutbox(); });
  setTimeout(() => { void replayOutbox(); }, 1500);
}

/* ───────── login ───────── */

export interface LoginResult extends LoginResponse { viaMock: boolean }

/** Log in with an access code. In a VITE_MOCK=1 build the in-memory demo answers instead of the server. */
export async function login(code: string): Promise<LoginResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) throw new ApiError(400, 'يلزم إدخال رمز الدخول');
  if (MOCK_ENV) {
    const { mockRequest } = await import('./mock');
    const r = await mockRequest('POST', '/api/login', { code: clean }, null);
    if (r.status >= 400) throw new ApiError(r.status, (r.body as { error: string }).error);
    return { ...(r.body as LoginResponse), viaMock: true };
  }
  lsRemove(KEY.mock);
  let r: Raw;
  // Production never falls back to the mock: the pilot must show the real server's data on every device.
  try {
    r = await raw('POST', '/api/login', { code: clean }, 12000);
  } catch (e) {
    if (isNetworkError(e)) throw new ApiError(0, 'لا اتصال بالخادم. يُرجى التحقّق من الإنترنت والمحاولة مجدّداً');
    throw e;
  }
  const unreachable = r.swOffline || r.status === 502 || r.status === 503 || r.status === 504 || (r.status >= 500 && !r.contentType.includes('application/json')) || (r.status < 400 && !r.contentType.includes('application/json'));
  if (unreachable) throw new ApiError(r.status || 0, 'الخادم غير متاح حالياً، يُرجى المحاولة بعد قليل');
  if (r.status >= 400) throw new ApiError(r.status, errorMessage(r, r.status === 429 ? 'محاولات كثيرة، يُرجى الانتظار قليلاً' : 'رمز الدخول غير صحيح'));
  const data = r.data as LoginResponse;
  if (!data || !data.token || !data.user) throw new ApiError(500, 'استجابة غير متوقّعة من الخادم');
  return { ...data, viaMock: false };
}

/* ───────── directorate (round 2) ───────── */

/** The directorate endpoints, as URLs (for `useApi`) and as typed fetchers. */
export const directorateUrls = {
  dashboard: (date: string) => `/api/directorate/dashboard?date=${encodeURIComponent(date)}`,
  school: (id: number | string, date: string) => `/api/directorate/school/${encodeURIComponent(String(id))}?date=${encodeURIComponent(date)}`,
  report: (week: string) => `/api/directorate/report?week=${encodeURIComponent(week)}`,
  csv: (date: string) => `/api/directorate/report.csv?date=${encodeURIComponent(date)}`,
};
export function getDirectorateDashboard(date: string): Promise<DirectorateDashboard> {
  return get<DirectorateDashboard>(directorateUrls.dashboard(date));
}
export function getDirectorateSchool(id: number | string, date: string): Promise<DirectorateSchoolDay> {
  return get<DirectorateSchoolDay>(directorateUrls.school(id, date));
}
export function getDirectorateReport(week: string): Promise<DirectorateWeeklyReport> {
  return get<DirectorateWeeklyReport>(directorateUrls.report(week));
}

/* ───────── files ───────── */

/** Download a CSV (or any file) through the authenticated API and save it. The token travels in the Authorization
    header (never in the URL); the file is handed to the browser as a blob: URL, which the Android shell reads back. */
export async function download(url: string, filename: string): Promise<void> {
  let blob: Blob;
  if (MOCK_ENV) {
    const { mockRequest } = await import('./mock');
    const r = await mockRequest('GET', url, undefined, getToken());
    if (r.status >= 400) throw new ApiError(r.status, (r.body as { error: string }).error);
    blob = new Blob([String(r.body)], { type: r.contentType ?? 'text/csv;charset=utf-8' });
  } else {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try { res = await fetch(url, { headers, cache: 'no-store' }); } catch { throw new ApiError(0, 'لا اتصال بالخادم', true); }
    if (res.status === 401) { emit('unauthorized'); throw new ApiError(401, 'انتهت الجلسة'); }
    if (!res.ok) throw new ApiError(res.status, 'تعذّر تنزيل التقرير');
    blob = await res.blob();
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

export { newId as clientId };
