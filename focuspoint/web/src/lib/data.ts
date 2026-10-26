// A small "network first, cache fallback" hook on top of offline.cachedGet, with an in-memory layer so
// screens render instantly when revisited.
import { useCallback, useEffect, useRef, useState } from 'react'
import { cachedGet } from '../offline'

const memo = new Map<string, unknown>()

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

  const reload = useCallback(async () => {
    const p = pathRef.current
    if (!p) return
    try {
      const r = await cachedGet<T>(p, { maxAgeMs: opts.maxAgeMs })
      if (pathRef.current !== p) return
      memo.set(p, r.data)
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

  useEffect(() => {
    if (!path) { setData(undefined); setLoading(false); return }
    const hit = memo.get(path) as T | undefined
    setData(hit)
    setLoading(hit === undefined)
    setError(null)
    void reload()
    const onFocus = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const timer = opts.pollMs ? window.setInterval(() => { if (document.visibilityState === 'visible') void reload() }, opts.pollMs) : 0
    return () => {
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      if (timer) window.clearInterval(timer)
    }
  }, [path, reload, opts.pollMs])

  return { data, loading, error, fromCache, reload }
}

export function dropMemo(path: string) { memo.delete(path) }
/** Pre-fill the in-memory layer (the Worker's boot JSON), so the first render already has the data. */
export function seedMemo(path: string, data: unknown) { if (data !== undefined && data !== null && !memo.has(path)) memo.set(path, data) }
