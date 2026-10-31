// The editable site content (docs/cms/DESIGN.md). The Worker injects window.__FP_BOOT__ = {content, settings} into
// index.html, so the very first paint already shows the admin's edits; GET /v1/content then keeps it fresh (and
// offline it comes from the cache). Whatever happens, pages get a complete SiteContent: mergeContent() fills anything
// missing or malformed with today's defaults, so a bad value can never break a page.
import { useEffect, useMemo } from 'react'
import { DEFAULT_BRAND_COLOR, DEFAULT_CONTENT, brandPalette, mergeContent, siteTemplateVars, wordingFlags, type SiteContent, type WordingFlags } from '@shared/content'
import type { ContentResponse, PublicSettings, Room } from '@shared/types'
import { SAVED_MAX_AGE_MS, seedMemo, useCached } from './data'

declare global {
  interface Window { __FP_BOOT__?: { content?: unknown; settings?: PublicSettings; updated_at?: string | null; at?: number } }
}

/** Call once at startup (main.tsx), before the first render. */
export function readBoot(): void {
  try {
    const boot = window.__FP_BOOT__
    if (!boot) return
    // A page saved on the phone a long time ago: don't present its settings as current (the network refresh follows).
    if (!boot.at || Date.now() - boot.at > SAVED_MAX_AGE_MS) return
    if (boot.content) seedMemo('/v1/content', { content: boot.content, updated_at: boot.updated_at ?? null })
    if (boot.settings) seedMemo('/v1/settings', boot.settings)
  } catch { /* defaults */ }
}

/** The live site content, always complete. */
export function useContent(): SiteContent {
  const { data } = useCached<ContentResponse>('/v1/content')
  return useMemo(() => (data?.content ? mergeContent(data.content) : DEFAULT_CONTENT), [data])
}

/** The values for {name} {phone} {hours} {privateCount} … from live settings, rooms and the brand texts. */
export function useTemplateVars(content?: SiteContent): Record<string, string> {
  const own = useContent()
  const c = content ?? own
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  const { data: rooms } = useCached<Room[]>('/v1/rooms')
  return useMemo(
    () => siteTemplateVars({ settings: settings ?? null, brand: c.brand, rooms: rooms ? rooms.filter((r) => r.active) : null }),
    [settings, rooms, c.brand],
  )
}

/** Which wording variants apply (pay on arrival on/off, Sham Cash on/off, customer cancel, reminders). */
export function useWordingFlags(): WordingFlags {
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  return useMemo(() => wordingFlags(settings ?? undefined), [settings])
}

/** Applies the brand colour (theme.brand) as CSS variables; the Worker already injects them for the first paint. */
export function useBrandColour(): void {
  const c = useContent()
  const hex = c.theme.brand
  useEffect(() => {
    const root = document.documentElement
    const palette = brandPalette(hex)
    if (palette['--brand'] === DEFAULT_BRAND_COLOR) { Object.keys(palette).forEach((k) => root.style.removeProperty(k)); return }
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v))
  }, [hex])
}
