// Shared helpers for the marketing pages (/, /spaces, /about, /contact): live data, space groups, small building blocks.
// Every customer-visible text, photo and link comes from the editable site content (useSite: content + {placeholder}
// values + wording flags); this file keeps only the layout, the ui chrome and the live room logic.
import { useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_CONTENT, type Photo, type SiteContent, type SpaceGroupId } from '@shared/content'
import type { PublicSettings, Room, RoomContents, RoomType } from '@shared/types'
import { useCached } from '../../lib/data'
import { fmtSYP, shortClock, timeZone } from '../../format'
import { brandWhatsapp, ContentText, hasText, pickPage, plainText, useSite } from '../../components/site/siteContent'
export { shortClock }
import { SiteIcon, type SiteIconName } from './SiteIcon'
import './site.css'

/** The owner's facts — used as fallbacks while (or if) the API settings are not available. */
export const CENTRE = {
  name: 'فوكس بوينت',
  address: 'درعا – شارع المجمع الحكومي – بناء العايش',
  phone: '0985258963',
  instagram: 'its_focus_point',
  open: '09:00',
  close: '23:00',
}

export type { Photo }

export function mapsUrl(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`
}
export function telHref(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '')
  return `tel:${d}`
}
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, '')}`
}

/** document.title while the page is shown. */
export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => { document.title = prev }
  }, [title])
}

/** document.title from the content (seo.pages[page], '' = seo.title), placeholders filled. */
export function usePageTitle(page: keyof SiteContent['seo']['pages']) {
  const { c, vars } = useSite()
  useTitle(plainText(pickPage(c, page), vars))
}

export interface SiteData {
  settings: PublicSettings | undefined
  rooms: Room[]
  roomsLoading: boolean
  roomsFailed: boolean
  name: string
  address: string
  phone: string
  instagram: string
  open: string
  close: string
  hoursPerDay: number
  payOnArrival: boolean
}

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export function useSiteData(): SiteData {
  const settingsQ = useCached<PublicSettings>('/v1/settings')
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const s = settingsQ.data
  const rooms = useMemo(() => (roomsQ.data || []).filter((r) => r.active).sort((a, b) => a.sort - b.sort), [roomsQ.data])
  const open = s?.open || CENTRE.open
  const close = s?.close || CENTRE.close
  let span = toMin(close) - toMin(open)
  if (span <= 0) span += 24 * 60
  return {
    settings: s,
    rooms,
    roomsLoading: roomsQ.loading && !roomsQ.data,
    roomsFailed: !!roomsQ.error && !roomsQ.data,
    name: s?.centre_name || CENTRE.name,
    address: s?.address || CENTRE.address,
    phone: s?.phone || CENTRE.phone,
    instagram: (s?.instagram || CENTRE.instagram).replace(/^@/, ''),
    open, close,
    hoursPerDay: Math.round(span / 60),
    payOnArrival: s ? !!s.allow_pay_on_arrival : true,
  }
}

/** "9 ص – 11 م" */
export function hoursLabel(d: Pick<SiteData, 'open' | 'close'>): string {
  return `${shortClock(d.open)} – ${shortClock(d.close)}`
}

/** Open right now in the centre's time zone? null when it cannot be computed. */
export function openNow(d: Pick<SiteData, 'open' | 'close'>): boolean | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone(), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    const h = Number(parts.find((p) => p.type === 'hour')?.value)
    const m = Number(parts.find((p) => p.type === 'minute')?.value)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    const now = h * 60 + m
    const o = toMin(d.open), c = toMin(d.close)
    return c > o ? now >= o && now < c : now >= o || now < c
  } catch { return null }
}

/** The live «مفتوح هلأ / مسكّر هلأ…» badge of the hours cards (texts: brand.status_open / status_closed). */
export function OpenStatus({ data }: { data: Pick<SiteData, 'open' | 'close'> }) {
  const { c, vars } = useSite()
  const isOpen = openNow(data)
  if (isOpen == null) return null
  return (
    <span className={`fp-status ${isOpen ? 'is-open' : 'is-closed'}`}>
      <span className="fp-dot" aria-hidden="true" /><ContentText text={isOpen ? c.brand.status_open : c.brand.status_closed} vars={vars} />
    </span>
  )
}

// ---- space groups (private rooms / meeting room / open space) ----
export type GroupId = SpaceGroupId
export type Tone = 'violet' | 'blue' | 'teal'
export interface SpaceGroup {
  id: GroupId
  title: string                 // content texts (placeholders not filled yet)
  blurb: string
  badge: string
  icon: SiteIconName
  tone: Tone
  photo: Photo | null           // content photo of the group (null → drawn placeholder)
  defaultPhoto: Photo | null    // today's photo, if the edited one fails to load
  amenities: RoomContentsKey[]  // content fallback list (rooms not loaded / none active)
  rooms: Room[]
  fallbackCap: string
}
type RoomContentsKey = 'wifi' | 'ac' | 'screen' | 'whiteboard' | 'projector' | 'coffee'
export const GROUP_OF: Record<RoomType, GroupId> = { private: 'private', meeting: 'meeting', hall: 'meeting', desk: 'open' }
/** Accent colours code the space types (fixed, not content). */
const GROUP_ORDER: { id: GroupId; tone: Tone }[] = [
  { id: 'private', tone: 'blue' },
  { id: 'meeting', tone: 'violet' },
  { id: 'open', tone: 'teal' },
]

export function groupRooms(rooms: Room[], c: SiteContent): SpaceGroup[] {
  return GROUP_ORDER.map(({ id, tone }) => {
    const g = c.spaces.groups[id] ?? DEFAULT_CONTENT.spaces.groups[id]
    return {
      id, tone,
      title: g.title, blurb: g.blurb, badge: g.badge, icon: g.icon,
      // the default photo is only a fallback for an edited photo that fails to load: a removed photo stays removed
      photo: g.photo, defaultPhoto: g.photo ? DEFAULT_CONTENT.spaces.groups[id].photo : null,
      amenities: (g.amenities ?? []).map((a) => a.key),
      rooms: rooms.filter((r) => GROUP_OF[r.type] === id),
      fallbackCap: g.cap,
    }
  })
}

/** A room's own photos (rooms from an older cache may have none). */
export const roomPhotos = (r: Room): Photo[] => (Array.isArray(r.photos) ? r.photos : [])

/** The first photo of the first room of the group that has photos (rooms are in display order). */
export function groupRoomPhoto(rooms: Room[]): Photo | null {
  for (const r of rooms) { const p = roomPhotos(r)[0]; if (p) return p }
  return null
}

export function capacityLabel(rooms: Room[], fallback: string): string {
  if (!rooms.length) return fallback
  const caps = rooms.map((r) => r.capacity)
  const lo = Math.min(...caps), hi = Math.max(...caps)
  if (lo === hi) return lo === 1 ? 'شخص واحد' : lo === 2 ? 'شخصين' : `حتى ${lo} أشخاص`
  return `${lo}–${hi} أشخاص`
}

/** Amenity labels (ui wording; the keys are the RoomContents flags and the icon names). */
export const AMENITY_LABEL: Record<RoomContentsKey, string> = {
  wifi: 'إنترنت', ac: 'تكييف', screen: 'شاشة', whiteboard: 'سبورة', projector: 'بروجكتر', coffee: 'قهوة',
}
const AMENITY_ORDER: RoomContentsKey[] = ['wifi', 'ac', 'screen', 'whiteboard', 'projector', 'coffee']

/** What every room of the group has; while the rooms are not loaded (or none is active) the content's list. */
export function groupAmenities(g: SpaceGroup): RoomContentsKey[] {
  const contents: RoomContents[] = g.rooms.map((r) => r.contents)
  if (!contents.length) return g.amenities.filter((k, i, all) => k in AMENITY_LABEL && all.indexOf(k) === i)
  return AMENITY_ORDER.filter((k) => contents.every((c) => !!c[k]))
}

export function minHourly(rooms: Room[]): number | null {
  const p = rooms.map((r) => r.price_hour).filter((n) => n > 0)
  return p.length ? Math.min(...p) : null
}

/** "تبدأ من 15,000 ل.س بالساعة" from the live API (a shimmer while loading, a soft line if it failed). */
export function FromPrice({ rooms, loading, compact = false }: { rooms: Room[]; loading: boolean; compact?: boolean }) {
  const { c } = useSite()
  const s = c.spaces
  const p = minHourly(rooms)
  if (p != null) {
    return (
      <span className="fp-price">
        <span className="fp-price-from">{compact ? s.price_from_short : s.price_from}</span>
        <b className="money">{fmtSYP(p)}</b>
        {hasText(s.price_unit) && <span className="fp-price-unit">{s.price_unit}</span>}
      </span>
    )
  }
  if (loading) return <span className="fp-price fp-shimmer" aria-label="عم نجيب الأسعار">&nbsp;</span>
  return <span className="fp-price fp-price-soft">{s.price_unknown}</span>
}

// ---- small building blocks ----
export function Section({ id, className, children, tint = false, labelledBy }: { id?: string; className?: string; children: ReactNode; tint?: boolean; labelledBy?: string }) {
  return (
    <section id={id} className={`fp-section${tint ? ' fp-tint' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={labelledBy}>
      <div className="fp-container">{children}</div>
    </section>
  )
}

/** Section heading from content texts: the kicker and the lead hide when empty. */
export function SectionHead({ id, kicker, title, lead, center = false, leadRich = false }: { id?: string; kicker?: string; title: string; lead?: string; center?: boolean; leadRich?: boolean }) {
  const { vars } = useSite()
  return (
    <header className={`fp-head${center ? ' is-center' : ''}`}>
      {hasText(kicker) && <span className="fp-kicker"><ContentText text={kicker} vars={vars} /></span>}
      <h2 id={id} className="fp-h2"><ContentText text={title} vars={vars} /></h2>
      {hasText(lead) && <p className="fp-lead"><ContentText text={lead} vars={vars} rich={leadRich} /></p>}
    </header>
  )
}

/** Inner-page header: kicker, H1, lead (content texts; kicker and lead hide when empty), optional actions. */
export function PageHeader({ kicker, title, lead, titleRich = false, children }: { kicker: string; title: string; lead?: string; titleRich?: boolean; children?: ReactNode }) {
  const { vars } = useSite()
  return (
    <section className="fp-pagehead">
      <div className="fp-container">
        {hasText(kicker) && <span className="fp-kicker"><ContentText text={kicker} vars={vars} /></span>}
        <h1 className="fp-h1"><ContentText text={title} vars={vars} rich={titleRich} em="brand" /></h1>
        {hasText(lead) && <p className="fp-lead fp-lead-lg"><ContentText text={lead} vars={vars} /></p>}
        {children && <div className="fp-actions">{children}</div>}
      </div>
    </section>
  )
}

export function TileIcon({ name, tone, size = 'md' }: { name: SiteIconName; tone: 'blue' | 'green' | 'violet' | 'sky' | 'teal' | 'rose' | 'brand' | 'neutral'; size?: 'md' | 'lg' }) {
  return (
    <span className={`fp-ticon is-${tone}${size === 'lg' ? ' is-lg' : ''}`}>
      <SiteIcon name={name} size={size === 'lg' ? 30 : 22} />
    </span>
  )
}

/** Solid brand band with a white call to action (texts: home.cta — also on /about — or the /spaces cta). */
export function CtaBand({ title, text }: { title: string; text: string }) {
  const { c, vars } = useSite()
  const wa = brandWhatsapp(c, vars)
  return (
    <section className="fp-section fp-cta-wrap" aria-labelledby="fp-cta-title">
      <div className="fp-container">
        <div className="fp-cta">
          <span className="fp-cta-shape" aria-hidden="true" />
          <div className="fp-cta-text">
            <h2 id="fp-cta-title" className="fp-cta-title"><ContentText text={title} vars={vars} /></h2>
            {hasText(text) && <p><ContentText text={text} vars={vars} /></p>}
          </div>
          <div className="fp-cta-actions">
            <Link to="/book" className="btn btn-lg btn-white fp-btn">احجز الآن <SiteIcon name="arrow" size={20} /></Link>
            <a href={wa.href} target="_blank" rel="noreferrer" className="btn btn-lg fp-btn fp-btn-ghost-white"><SiteIcon name="whatsapp" size={20} /> اسألنا عالواتساب</a>
          </div>
        </div>
      </div>
    </section>
  )
}

/** After the page rendered, scroll to the #anchor of the address (editor previews like /#faq); runs after the
 *  layout's scroll-to-top. */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    const h = window.location.hash
    if (!ready || !h || h.length < 2) return
    const t = window.setTimeout(() => {
      try { document.getElementById(decodeURIComponent(h.slice(1)))?.scrollIntoView() } catch { /* bad anchor */ }
    }, 0)
    return () => window.clearTimeout(t)
  }, [ready])
}
