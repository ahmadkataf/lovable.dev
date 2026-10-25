// Shared helpers for the marketing pages (/, /spaces, /about, /contact): centre facts, live data, small building blocks.
import { useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PublicSettings, Room, RoomType } from '@shared/types'
import { useCached } from '../../lib/data'
import { fmtSYP, shortClock, timeZone } from '../../format'
export { shortClock }
import { SiteIcon, type SiteIconName } from './SiteIcon'
import './site.css'

/** The owner's facts — used as fallbacks while (or if) the API settings are not available. */
export const CENTRE = {
  name: 'فوكس بوينت',
  latin: 'Focus Point',
  firstOfItsKind: 'المشروع الأول من نوعه بدرعا',
  slogan: 'مساحتك وركنك الهادئ للإبداع',
  address: 'درعا – شارع المجمع الحكومي – بناء العايش',
  phone: '0985258963',
  phoneIntl: '+963985258963',
  whatsapp: 'https://wa.me/963985258963',
  instagram: 'its_focus_point',
  open: '09:00',
  close: '23:00',
}

export const IMG = {
  meeting: { src: '/img/room-a.webp', small: '/img/room-a-720.webp', w: 1105, h: 1400, alt: 'قاعة الاجتماعات في فوكس بوينت: طاولة خمرية طويلة وكراسي مريحة وشاشة وضوء طبيعي من الشباك' },
  meetingTable: { src: '/img/room-a-table.webp', small: '/img/room-a-table-720.webp', w: 919, h: 1400, alt: 'طاولة الاجتماعات الخمرية عن قرب مع مقابس الكهرباء' },
  big: { src: '/img/room-b.webp', small: '/img/room-b-720.webp', w: 1105, h: 1400, alt: 'طاولة كبيرة ونوافذ بانورامية تطل على درعا ولوحة THINK OUTSIDE THE BOX' },
  bigWide: { src: '/img/room-b-wide.webp', small: '/img/room-b-wide-720.webp', w: 1400, h: 821, alt: 'المساحة من الداخل: طاولة كبيرة، كراسي مريحة، ونوافذ واسعة مليانة ضوء' },
  think: { src: '/img/think-box.webp', small: '/img/think-box.webp', w: 586, h: 784, alt: 'لوحة THINK OUTSIDE THE BOX على الحيط' },
}
export type Photo = (typeof IMG)[keyof typeof IMG]

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

// ---- space groups (private rooms / meeting room / open space) ----
export type GroupId = 'private' | 'meeting' | 'open'
export interface SpaceGroup {
  id: GroupId
  title: string
  blurb: string
  icon: SiteIconName
  tone: 'violet' | 'blue' | 'teal'
  photo: Photo | null
  rooms: Room[]
  fallbackCap: string
}
export const GROUP_OF: Record<RoomType, GroupId> = { private: 'private', meeting: 'meeting', hall: 'meeting', desk: 'open' }

const GROUP_META: Omit<SpaceGroup, 'rooms'>[] = [
  { id: 'private', title: 'غرف خاصة', blurb: 'غرفة إلك لحالك أو مع فريقك الصغير، بابها بيتسكّر وبتشتغل فيها على راحتك.', icon: 'door', tone: 'blue', photo: null, fallbackCap: '2–4 أشخاص' },
  { id: 'meeting', title: 'قاعة الاجتماعات', blurb: 'قاعة لـ10 أشخاص فيها شاشة وسبورة، للاجتماعات والدورات والعروض.', icon: 'present', tone: 'violet', photo: IMG.meeting, fallbackCap: 'حتى 10 أشخاص' },
  { id: 'open', title: 'المساحة المفتوحة', blurb: 'مكان مشترك لـ8 أشخاص، ضوء طبيعي وجو بيشجّع عالشغل.', icon: 'grid', tone: 'teal', photo: IMG.bigWide, fallbackCap: 'حتى 8 أشخاص' },
]

export function groupRooms(rooms: Room[]): SpaceGroup[] {
  return GROUP_META.map((g) => ({ ...g, rooms: rooms.filter((r) => GROUP_OF[r.type] === g.id) }))
}

export function capacityLabel(rooms: Room[], fallback: string): string {
  if (!rooms.length) return fallback
  const caps = rooms.map((r) => r.capacity)
  const lo = Math.min(...caps), hi = Math.max(...caps)
  if (lo === hi) return lo === 1 ? 'شخص واحد' : lo === 2 ? 'شخصين' : `حتى ${lo} أشخاص`
  return `${lo}–${hi} أشخاص`
}

export function minHourly(rooms: Room[]): number | null {
  const p = rooms.map((r) => r.price_hour).filter((n) => n > 0)
  return p.length ? Math.min(...p) : null
}

/** "تبدأ من 15,000 ل.س بالساعة" from the live API (a shimmer while loading, a soft line if it failed). */
export function FromPrice({ rooms, loading, compact = false }: { rooms: Room[]; loading: boolean; compact?: boolean }) {
  const p = minHourly(rooms)
  if (p != null) {
    return (
      <span className="fp-price">
        <span className="fp-price-from">{compact ? 'من' : 'تبدأ من'}</span>
        <b className="money">{fmtSYP(p)}</b>
        <span className="fp-price-unit">بالساعة</span>
      </span>
    )
  }
  if (loading) return <span className="fp-price fp-shimmer" aria-label="عم نجيب الأسعار">&nbsp;</span>
  return <span className="fp-price fp-price-soft">الأسعار بتبين وقت الحجز</span>
}

// ---- small building blocks ----
export function Section({ id, className, children, tint = false, labelledBy }: { id?: string; className?: string; children: ReactNode; tint?: boolean; labelledBy?: string }) {
  return (
    <section id={id} className={`fp-section${tint ? ' fp-tint' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={labelledBy}>
      <div className="fp-container">{children}</div>
    </section>
  )
}

export function SectionHead({ id, kicker, title, lead, center = false }: { id?: string; kicker?: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <header className={`fp-head${center ? ' is-center' : ''}`}>
      {kicker && <span className="fp-kicker">{kicker}</span>}
      <h2 id={id} className="fp-h2">{title}</h2>
      {lead && <p className="fp-lead">{lead}</p>}
    </header>
  )
}

/** Inner-page header: kicker, H1, lead, optional actions. */
export function PageHeader({ kicker, title, lead, children }: { kicker: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="fp-pagehead">
      <div className="fp-container">
        <span className="fp-kicker">{kicker}</span>
        <h1 className="fp-h1">{title}</h1>
        {lead && <p className="fp-lead fp-lead-lg">{lead}</p>}
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

/** Solid brand band with a white call to action. */
export function CtaBand({ title = 'جاهز تبدأ؟ احجز مكانك هلأ', text = 'اختار المساحة والوقت، اكتب اسمك ورقمك، وادفع بشام كاش أو عند وصولك. بدون حساب وبدون تعقيد.' }: { title?: string; text?: string }) {
  return (
    <section className="fp-section fp-cta-wrap" aria-labelledby="fp-cta-title">
      <div className="fp-container">
        <div className="fp-cta">
          <span className="fp-cta-shape" aria-hidden="true" />
          <div className="fp-cta-text">
            <h2 id="fp-cta-title" className="fp-cta-title">{title}</h2>
            <p>{text}</p>
          </div>
          <div className="fp-cta-actions">
            <Link to="/book" className="btn btn-lg btn-white fp-btn">احجز الآن <SiteIcon name="arrow" size={20} /></Link>
            <a href={CENTRE.whatsapp} target="_blank" rel="noreferrer" className="btn btn-lg fp-btn fp-btn-ghost-white"><SiteIcon name="whatsapp" size={20} /> اسألنا عالواتساب</a>
          </div>
        </div>
      </div>
    </section>
  )
}
