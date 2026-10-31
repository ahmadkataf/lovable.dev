// In-app inbox state: the list of notifications for this device and the unread count shown on the nav.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Notification } from '@shared/types'
import { api } from '../api'
import { cachedGet, useOnline } from '../offline'
import { onPushMessage } from './push'
import { dropMemo } from './data'

interface Value {
  items: Notification[]
  unread: number
  loading: boolean
  fromCache: boolean
  refresh(): Promise<void>
  markAllRead(): Promise<void>
}
const Ctx = createContext<Value | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const online = useOnline()
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const r = await cachedGet<Notification[]>('/v1/notifications')
      setItems(Array.isArray(r.data) ? r.data : [])
      setFromCache(r.fromCache)
    } catch { /* nothing cached yet: keep what we have */ } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!items.some((n) => !n.read)) return
    setItems((list) => list.map((n) => ({ ...n, read: 1 as const })))
    try { await api.post('/v1/notifications/read', {}) } catch { /* will be retried on the next open */ }
  }, [items])

  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) void refresh() }, 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearInterval(timer) }
  }, [refresh])
  useEffect(() => { if (online) void refresh() }, [online, refresh])
  // A push arrived while the app is open: the inbox and "my bookings" are stale at once.
  useEffect(() => onPushMessage(() => { dropMemo('/v1/bookings/mine'); void refresh() }), [refresh])

  const value = useMemo<Value>(() => ({
    items, unread: items.filter((n) => !n.read).length, loading, fromCache, refresh, markAllRead,
  }), [items, loading, fromCache, refresh, markAllRead])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotifications(): Value {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNotifications outside provider')
  return v
}
