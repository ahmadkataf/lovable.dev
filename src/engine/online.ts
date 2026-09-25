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
const CACHE = `emar-${meta.id}-content`

export type OnlineReason = 'ok' | 'invalid' | 'book' | 'used' | 'revoked' | 'expired' | 'network' | 'wait' | 'format' | 'server'
export type OnlineStatus = 'checking' | 'free' | 'loading' | 'pro' | 'offline'

function read(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function write(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }

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

export interface OnlineAccess extends Access {
  status: OnlineStatus
  modules?: Module[]
  exams?: Exam[]
  notice: string
  retry: () => void
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
    })()
    return () => { live = false }
  }, []) // eslint-disable-line

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

  return {
    pro: status === 'pro', until, device, code, activate, status, notice, retry: () => { open() },
    modules: content?.modules, exams: content?.exams,
  }
}

/** This build sells its book online (book.json has an "api" entry). */
export const onlineBook = 'api' in meta
