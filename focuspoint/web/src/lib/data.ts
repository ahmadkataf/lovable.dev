// A small "network first, cache fallback" hook on top of offline.cachedGet, with an in-memory layer so
// screens render instantly when revisited.
import { useCallback, useEffect, useRef, useState } from 'react'
import { cachedGet, peekCached } from '../offline'

const memo = new Map<string, unknown>()
/** A copy saved on the phone older than this is not shown while refreshing (a week-old price list would mislead). */
export const SAVED_MAX_AGE_MS = 3 * 24 * 3600 * 1000
/** Paths changed in this tab (a booking made or cancelled): their saved copy is out of date, so it is never painted. */
const dropped = new Set<string>()
// Several components often ask for the same path at the same moment (mount, focus, back online): they share one
// request. A page's explicit reload() (after a booking change) always goes to the network on its own.
const inflight = new Map<string, Promise<{ data: unknown; fromCache: boolean }>>()
function sharedGet<T>(path: string, maxAgeMs?: number): Promise<{ data: T; fromCache: boolean }> {
  let pr = inflight.get(path)
  if (!pr) {
    pr = cachedGet<unknown>(path, { maxAgeMs }).finally(() => inflight.delete(path))
    inflight.set(path, pr)
  }
  return pr as Promise<{ data: T; fromCache: boolean }>
}

export interface Loaded<T> {
  data: T | undefined
  loading: boolean
  error: unknown
  fromCache: boolean
  reload: () => Promise<void>
}

export function useCached<T>(path: string | null, opts: { maxAgeMs?: number; pollMs?: number } = {}): Loaded<T> {
  const [data, setData] = useState<T | undefined>(() => (path ? (memo.get(path) as T | undefined) : undefined))
  const [loading, setLoading] = useState(!!path && !memo.has(path))
  const [error, setError] = useState<unknown>(null)
  const [fromCache, setFromCache] = useState(false)
  const pathRef = useRef(path)
  pathRef.current = path

  const load = useCallback(async (shared: boolean) => {
    const p = pathRef.current
    if (!p) return
    try {
      const r = shared ? await sharedGet<T>(p, opts.maxAgeMs) : await cachedGet<T>(p, { maxAgeMs: opts.maxAgeMs })
      if (pathRef.current !== p) return
      memo.set(p, r.data)
      if (!r.fromCache) dropped.delete(p)
      setData(r.data)
      setFromCache(r.fromCache)
      setError(null)
    } catch (e) {
      if (pathRef.current !== p) return
      setError(e)
    } finally {
      if (pathRef.current === p) setLoading(false)
    }
  }, [opts.maxAgeMs])
  /** Explicit refresh (e.g. after a booking change): always a fresh request of its own. */
  const reload = useCallback(() => load(false), [load])

  useEffect(() => {
    if (!path) { setData(undefined); setLoading(false); return }
    const hit = memo.get(path) as T | undefined
    setData(hit)
    setLoading(hit === undefined)
    setError(null)
    // Nothing in memory (a fresh app open): paint the copy saved on this phone straight away, unless the network
    // answers first. The request below still runs and replaces it; fromCache stays false, so no "offline" notice
    // flashes while it refreshes.
    // `loading` stays true until the network answers, so screens keep their "تحديث" indicator.
    if (hit === undefined && !dropped.has(path)) {
      void peekCached<T>(path, opts.maxAgeMs ?? SAVED_MAX_AGE_MS).then((saved) => {
        if (saved === undefined || pathRef.current !== path || memo.has(path) || dropped.has(path)) return
        setData((cur) => (cur === undefined ? saved : cur))
      })
    }
    void load(true)
    const onFocus = () => { if (document.visibilityState === 'visible') void load(true) }
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const timer = opts.pollMs ? window.setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, opts.pollMs) : 0
    return () => {
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      if (timer) window.clearInterval(timer)
    }
  }, [path, load, opts.pollMs])

  return { data, loading, error, fromCache, reload }
}

export function dropMemo(path: string) { memo.delete(path); dropped.add(path) }
/** Pre-fill the in-memory layer (the Worker's boot JSON), so the first render already has the data. */
export function seedMemo(path: string, data: unknown) { if (data !== undefined && data !== null && !memo.has(path)) memo.set(path, data) }
