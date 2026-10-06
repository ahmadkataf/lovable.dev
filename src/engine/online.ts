// Activation for a book sold online (see server/). The app holds only the free unit; after the server
// accepts the student's code it sends the rest of the book and its audio, and the app asks the server
// again every time it opens, so a code that is cancelled or has expired stops working at once.
import { useEffect, useRef, useState } from 'react'
import meta from '@book-meta'
import type { Exam, Module } from './types'
import { deviceNumber } from './license'
import { setAudioSource } from './audio'
import { rawDeviceId, type Access } from './access'

declare const __EMAR_API__: string
declare const __EMAR_STORE__: string
const API = __EMAR_API__
/** The Google Play build: it may unlock with a code, but must not lead students to pay outside Google Play. */
export const playStore = __EMAR_STORE__ === 'play'
/** The page describing what the app keeps and sends, required by Google Play. */
export const privacyUrl = API ? `${API}/privacy` : ''
const SESSION_KEY = `${meta.storageKey}.session`
const REQUEST_KEY = `${meta.storageKey}.request`   // the payment request waiting for the seller's approval
const REF_KEY = `${meta.storageKey}.ref`           // the invite code of the friend whose link opened the app
const CACHE = `emar-${meta.id}-content`

/** The web app's address for this book (/app/ for the Baccalaureate, /app<grade>/ for the others). */
export const webAppUrl = API ? `${API}/app${meta.id === 'g12' ? '' : meta.id.replace(/\D/g, '')}/` : ''

export type OnlineReason = 'ok' | 'invalid' | 'book' | 'used' | 'revoked' | 'expired' | 'network' | 'wait' | 'format' | 'server'
export type OnlineStatus = 'checking' | 'free' | 'loading' | 'pro' | 'offline'

function read(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function write(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }

// an invite link (…/app/?ref=ABC123) is remembered, so the code is filled in when the student pays later
try {
  const ref = new URLSearchParams(location.search).get('ref')
  if (ref && /^[0-9A-Za-z]{6}$/.test(ref)) localStorage.setItem(REF_KEY, ref.toUpperCase())
} catch { /* ignore */ }
export const savedInvite = (): string => read(REF_KEY) || ''

/** A price like "20$" with a discount taken off, rounded to half a dollar. */
export function discounted(price: string, pct: number): string {
  const n = parseFloat(price.replace(/[^\d.]/g, ''))
  if (!n || !pct) return price
  return `${Math.round(n * (100 - pct) / 50) / 2}$`
}

/** What the server knows the phone by: a hash, so the phone's own id never leaves it. */
async function serverDevice(): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`server:${meta.id}:${rawDeviceId()}`)))
  return [...h].slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function post(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

/** Downloads are kept on the phone (per content version) so the book is not fetched again at every launch;
 *  they are only used after the server has accepted the session. */
async function cachedFetch(key: string, url: string, headers: Record<string, string>): Promise<Response> {
  let cache: Cache | null = null
  try { cache = await caches.open(CACHE) } catch { cache = null }
  const hit = cache && (await cache.match(key))
  if (hit) return hit
  const r = await fetch(url, { headers })
  if (r.ok && cache) { try { await cache.put(key, r.clone()) } catch { /* storage full: use it without keeping it */ } }
  return r
}
async function dropOldVersions(version: string) {
  try {
    const cache = await caches.open(CACHE)
    for (const req of await cache.keys()) if (!req.url.includes(`/v-${version}/`)) await cache.delete(req)
  } catch { /* no cache storage */ }
}

export type PayRequest = { id: number; status: 'pending' | 'approved' | 'rejected' }
export type RequestForm = { name: string; phone: string; payRef: string; invite: string; price: string }
export type InviteInfo = { invite: string; joined: number; waiting: number; discount: number; giftEvery: number; gifts: { code: string; used: boolean }[] }

export interface OnlineAccess extends Access {
  status: OnlineStatus
  modules?: Module[]
  exams?: Exam[]
  notice: string
  retry: () => void
  /** the student's payment request, while it waits for approval */
  request: PayRequest | null
  sendRequest: (f: RequestForm) => Promise<{ ok: true; id: number } | { ok: false; error: string }>
  checkRequest: () => Promise<void>
  checkInvite: (invite: string) => Promise<number | null>
  inviteInfo: () => Promise<InviteInfo | null>
}

const NOTICE: Record<string, string> = {
  revoked: 'أُلغي كود التفعيل على هذا الجهاز. تواصل معنا إن كان هذا خطأً.',
  expired: 'انتهى اشتراكك. جدّده لتعود إلى كل الدروس.',
  used: 'هذا الكود مفعّل على جهاز آخر.',
  session: 'انتهت الجلسة. أدخل كودك مرة أخرى.',
}

export function useOnlineAccess(): OnlineAccess {
  const [device, setDevice] = useState('')
  const [status, setStatus] = useState<OnlineStatus>(read(SESSION_KEY) ? 'checking' : 'free')
  const [until, setUntil] = useState<Date | null>(null)
  const [code, setCode] = useState('')
  const [content, setContent] = useState<{ modules: Module[]; exams: Exam[] } | null>(null)
  const [notice, setNotice] = useState('')
  const [request, setRequest] = useState<PayRequest | null>(() => {
    try { const r = JSON.parse(read(REQUEST_KEY) || 'null'); return r?.id ? { id: Number(r.id), status: 'pending' } : null } catch { return null }
  })
  const devRef = useRef('')

  /** Ask the server whether this phone may open the book now; if so, load the book. */
  const open = async (): Promise<OnlineReason> => {
    const token = read(SESSION_KEY)
    if (!token) { setStatus('free'); return 'invalid' }
    if (!API) { setStatus('offline'); return 'network' }
    setStatus(s => (s === 'pro' ? s : 'checking'))
    let res
    try { res = await post('/v1/session', { book: meta.id, token, device: devRef.current }) }
    catch { setStatus('offline'); setNotice('لا يوجد اتصال بالإنترنت. الوحدة الأولى متاحة، وباقي الكتاب يحتاج اتصالاً للتحقق من اشتراكك.'); return 'network' }
    if (res.status !== 200) {
      const why = String(res.data.error || 'session')
      write(SESSION_KEY, null); setStatus('free'); setContent(null); setAudioSource(null)
      setNotice(NOTICE[why] || NOTICE.session)
      return (why as OnlineReason)
    }
    const fresh = String(res.data.token), version = String(res.data.version || '0')
    write(SESSION_KEY, fresh)
    setUntil(res.data.until ? new Date(Number(res.data.until)) : null)
    setCode(String(res.data.code || ''))
    setStatus(s => (s === 'pro' ? s : 'loading'))
    const headers = { authorization: `Bearer ${fresh}`, 'x-device': devRef.current }
    const url = (f: string) => `${API}/v1/content/${meta.id}/${f}`
    try {
      const r = await cachedFetch(`${API}/v-${version}/full.json`, url('full.json'), headers)
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as { modules: Module[]; exams: Exam[] }
      // every request after this one carries the newest session
      const audio = (f: string) => cachedFetch(`${API}/v-${version}/audio/${f}`, url(`audio/${f}`), { authorization: `Bearer ${read(SESSION_KEY)}`, 'x-device': devRef.current })
      setAudioSource(audio)
      setContent({ modules: data.modules, exams: data.exams })
      setStatus('pro'); setNotice('')
      dropOldVersions(version)
      return 'ok'
    } catch {
      setStatus('offline'); setNotice('تعذّر تنزيل الكتاب. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.')
      return 'network'
    }
  }

  useEffect(() => {
    let live = true
    ;(async () => {
      const [shown, dev] = await Promise.all([deviceNumber(meta.id, rawDeviceId()), serverDevice()])
      if (!live) return
      devRef.current = dev; setDevice(shown)
      await open()
      if (live) checkRequest()
    })()
    return () => { live = false }
  }, []) // eslint-disable-line

  // while a payment request waits, ask now and then whether the seller approved it: the app then activates itself
  useEffect(() => {
    if (request?.status !== 'pending' || status === 'pro') return
    const t = setInterval(() => { if (devRef.current) checkRequest() }, 15000)
    return () => clearInterval(t)
  }, [request?.status, status]) // eslint-disable-line

  const activate = async (c: string): Promise<string> => {
    const clean = c.toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (clean.length !== 12) return 'format'
    if (!API) return 'network'
    let res
    try { res = await post('/v1/activate', { book: meta.id, code: clean, device: devRef.current }) }
    catch { return 'network' }
    if (res.status !== 200) return String(res.data.error || 'server')
    write(SESSION_KEY, String(res.data.token))
    return open()
  }

  const checkRequest = async () => {
    const saved = read(REQUEST_KEY)
    if (!saved || !API || !devRef.current) return
    let id = 0
    try { id = Number(JSON.parse(saved).id) } catch { /* ignore */ }
    if (!id) { write(REQUEST_KEY, null); setRequest(null); return }
    let res
    try { res = await post('/v1/request-status', { book: meta.id, device: devRef.current, id }) } catch { return }
    if (res.status === 404) { write(REQUEST_KEY, null); setRequest(null); return }
    if (res.status !== 200) return
    const st = String(res.data.status)
    if (st === 'approved' && res.data.code) {
      const r = await activate(String(res.data.code))
      if (r === 'ok' || r === 'used' || r === 'invalid') { write(REQUEST_KEY, null); setRequest({ id, status: 'approved' }) }
    } else if (st === 'rejected') {
      write(REQUEST_KEY, null); setRequest({ id, status: 'rejected' })
      setNotice('ما قدرنا نتأكد من دفعتك لهذا الطلب. راسلنا على واتساب مع صورة الإيصال.')
    } else setRequest({ id, status: 'pending' })
  }

  const sendRequest = async (f: RequestForm) => {
    if (!API) return { ok: false as const, error: 'network' }
    let res
    try { res = await post('/v1/request', { book: meta.id, device: devRef.current, ...f, invite: f.invite || undefined }) }
    catch { return { ok: false as const, error: 'network' } }
    if (res.status !== 200) return { ok: false as const, error: String(res.data.error || 'server') }
    const id = Number(res.data.id)
    write(REQUEST_KEY, JSON.stringify({ id })); setRequest({ id, status: 'pending' }); setNotice('')
    return { ok: true as const, id }
  }

  const checkInvite = async (invite: string) => {
    if (!API) return null
    try {
      const r = await fetch(`${API}/v1/invite-check?invite=${encodeURIComponent(invite)}`)
      if (!r.ok) return null
      return Number((await r.json()).discount) || 0
    } catch { return null }
  }

  const inviteInfo = async () => {
    const token = read(SESSION_KEY)
    if (!token || !API) return null
    try {
      const res = await post('/v1/invite', { book: meta.id, token, device: devRef.current })
      return res.status === 200 ? (res.data as unknown as InviteInfo) : null
    } catch { return null }
  }

  return {
    pro: status === 'pro', until, device, code, activate, status, notice, retry: () => { open() },
    modules: content?.modules, exams: content?.exams,
    request, sendRequest, checkRequest, checkInvite, inviteInfo,
  }
}

/** This build sells its book online (book.json has an "api" entry). */
export const onlineBook = 'api' in meta
