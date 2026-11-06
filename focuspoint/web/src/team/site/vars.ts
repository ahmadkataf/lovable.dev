// Live values for the {placeholders} preview under a text ("هكذا بيطلع"): the centre's settings and rooms from the
// team store, the brand texts being edited, and TEMPLATE_EXAMPLE for booking-specific ones ({code}, {when} …).
import { useMemo } from 'react'
import { TEMPLATE_EXAMPLE } from '@shared/content'
import type { Room, Settings } from '@shared/types'
import { shortClock } from '../../format'
import { useStore } from '../store'
import { toMin } from '../util'

export function editorVars(settings: Settings | null, rooms: Room[], brand: { slogan?: string; eyebrow?: string } | null): Record<string, string> {
  const v: Record<string, string> = { ...TEMPLATE_EXAMPLE }
  if (settings) {
    v.name = settings.centre_name || v.name!
    v.phone = settings.phone || v.phone!
    v.address = settings.address || v.address!
    v.instagram = (settings.instagram || v.instagram!).replace(/^@/, '')
    if (/^\d{2}:\d{2}$/.test(settings.open) && /^\d{2}:\d{2}$/.test(settings.close)) {
      v.open = shortClock(settings.open)
      v.close = shortClock(settings.close)
      v.hours = `${v.open} – ${v.close}`
      let span = toMin(settings.close) - toMin(settings.open)
      if (span <= 0) span += 24 * 60
      v.hoursPerDay = String(Math.round(span / 60))
    }
    if (settings.hold_minutes) v.holdMinutes = String(settings.hold_minutes)
  }
  const active = rooms.filter((r) => r.active === 1)
  const priv = active.filter((r) => r.type === 'private')
  const meeting = active.filter((r) => r.type === 'meeting' || r.type === 'hall')
  const open = active.filter((r) => r.type === 'desk')
  if (priv.length) {
    v.privateCount = String(priv.length)
    v.privateMin = String(Math.min(...priv.map((r) => r.capacity)))
    v.privateMax = String(Math.max(...priv.map((r) => r.capacity)))
  }
  if (meeting.length) v.meetingCapacity = String(Math.max(...meeting.map((r) => r.capacity)))
  if (open.length) v.openCapacity = String(Math.max(...open.map((r) => r.capacity)))
  if (brand?.slogan) v.slogan = brand.slogan
  if (brand?.eyebrow) v.eyebrow = brand.eyebrow
  return v
}

export function useEditorVars(brand: { slogan?: string; eyebrow?: string } | null): Record<string, string> {
  const { view } = useStore()
  return useMemo(() => editorVars(view.settings, view.rooms, brand), [view.settings, view.rooms, brand])
}

// ---- colour ----
/** WCAG contrast ratio of a #RRGGBB colour against white (1…21). */
export function contrastWithWhite(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return null
  const lum = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h as string, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * lum[0]! + 0.7152 * lum[1]! + 0.0722 * lum[2]!
  return 1.05 / (L + 0.05)
}

/** Flat, dark brand colours that keep white text readable (all ≥ 4.5:1). Never beige / sand / brown. */
export const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#7b1e2e', label: 'خمري (الأصل)' },
  { value: '#9f1239', label: 'توتي' },
  { value: '#b91c1c', label: 'أحمر' },
  { value: '#1d4ed8', label: 'أزرق' },
  { value: '#0369a1', label: 'سماوي غامق' },
  { value: '#0f766e', label: 'فيروزي' },
  { value: '#047857', label: 'أخضر' },
  { value: '#6d28d9', label: 'بنفسجي' },
  { value: '#334155', label: 'رمادي فحمي' },
  { value: '#0f172a', label: 'كحلي' },
]
