// Offline helpers: an online/offline hook, a tiny IndexedDB key-value cache, and cachedGet()
// (network first, cache fallback). No external libraries.
import { useEffect, useState } from 'react'
import { api } from './api'

const DB_NAME = 'focuspoint'
const STORE = 'kv'
const memory = new Map<string, unknown>()   // fallback when IndexedDB is unavailable
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbPromise
}

function tx<R>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<R>): Promise<R | undefined> {
  return openDb().then((db) => {
    if (!db) return undefined
    return new Promise<R | undefined>((resolve) => {
      try {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(undefined)
        t.onabort = () => resolve(undefined)
      } catch { resolve(undefined) }
    })
  })
}

export const cache = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await openDb()
    if (!db) return memory.get(key) as T | undefined
    return tx<T>('readonly', (s) => s.get(key) as IDBRequest<T>)
  },
  async set<T>(key: string, value: T): Promise<void> {
    const db = await openDb()
    if (!db) { memory.set(key, value); return }
    await tx('readwrite', (s) => s.put(value, key))
  },
  async del(key: string): Promise<void> {
    const db = await openDb()
    if (!db) { memory.delete(key); return }
    await tx('readwrite', (s) => s.delete(key))
  },
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}

interface Entry<T> { t: number; data: T }

/** GET through the API; on failure (offline or server error) fall back to the cached copy if it is fresh enough. */
export async function cachedGet<T>(path: string, opts: { maxAgeMs?: number } = {}): Promise<{ data: T; fromCache: boolean }> {
  const key = `get:${path}`
  try {
    const data = await api.get<T>(path)
    void cache.set<Entry<T>>(key, { t: Date.now(), data })
    return { data, fromCache: false }
  } catch (err) {
    const hit = await cache.get<Entry<T>>(key)
    if (hit && (opts.maxAgeMs === undefined || Date.now() - hit.t <= opts.maxAgeMs)) return { data: hit.data, fromCache: true }
    throw err
  }
}
