import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_CLINIC, getClinic } from '@/db'
import type { Clinic, User } from '@/db/types'
import { formatMoney } from '@/lib/format'
import { useI18n } from '@/i18n'

/** The clinic record, live. Falls back to the defaults until the first read lands. */
export function useClinic(): Clinic {
  const c = useLiveQuery(() => getClinic(), [], undefined)
  return c ?? DEFAULT_CLINIC
}
/** undefined until the clinic record has been read once (for the routing gate). */
export function useClinicMaybe(): Clinic | undefined {
  return useLiveQuery(() => getClinic(), [], undefined)
}
export function useUsers(activeOnly = true): User[] {
  return useLiveQuery(() => (activeOnly ? db.users.filter(u => u.active).toArray() : db.users.toArray()), [activeOnly]) ?? []
}
export function useDoctors(): User[] {
  return useLiveQuery(() => db.users.filter(u => u.active && (u.role === 'doctor' || u.role === 'admin')).toArray(), []) ?? []
}
/** money(amount) formatted in the clinic currency and the UI language. */
export function useMoney() {
  const c = useClinic(); const { lang } = useI18n()
  return (n: number, opts?: { sign?: boolean; compact?: boolean }) => formatMoney(n, c, lang, opts)
}
export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q); const h = () => setM(mq.matches)
    mq.addEventListener('change', h); setM(mq.matches)
    return () => mq.removeEventListener('change', h)
  }, [q])
  return m
}
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
