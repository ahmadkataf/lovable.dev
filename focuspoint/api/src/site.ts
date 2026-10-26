// What the Worker writes into the SPA's index.html and the web manifest from the site content + settings, so the
// first paint, link previews (WhatsApp, Facebook) and search engines already see the admin's edits (DESIGN §3 HTML).
// Pure functions only — app.ts applies them with HTMLRewriter. With the default content and settings every value is
// exactly what web/index.html and the built manifest already say (test/site.test.ts checks it against the files).
import { DEFAULT_CONTENT, fillTemplate, type SiteContent } from '../../shared/content'
import type { PublicSettings, Settings } from '../../shared/types'

type S = Pick<Settings, 'centre_name' | 'phone' | 'address' | 'instagram' | 'open' | 'close' | 'hold_minutes'>

// ---------- placeholders ----------

const toMin = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** "21:00" → "9 م", "09:30" → "9:30 ص" (same as the web's shortClock). */
export function shortClock(hhmm: string): string {
  const [h = 0, mi = 0] = hhmm.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${mi ? `:${String(mi).padStart(2, '0')}` : ''} ${h < 12 ? 'ص' : 'م'}`
}

/** The site-wide {placeholders} the SEO texts may use (room counts are not offered there, so they are not read). */
export function siteVars(s: S, c: SiteContent): Record<string, string> {
  let span = toMin(s.close) - toMin(s.open)
  if (span <= 0) span += 24 * 60
  return {
    name: s.centre_name, phone: s.phone, address: s.address, instagram: s.instagram.replace(/^@/, ''),
    hours: `${shortClock(s.open)} – ${shortClock(s.close)}`, open: shortClock(s.open), close: shortClock(s.close),
    hoursPerDay: String(Math.round(span / 60)), holdMinutes: String(s.hold_minutes),
    slogan: c.brand.slogan, eyebrow: c.brand.eyebrow,
  }
}

// ---------- head ----------

export type PageKey = keyof SiteContent['seo']['pages']
const PAGE_OF: Record<string, PageKey> = { '/': 'home', '/spaces': 'spaces', '/about': 'about', '/contact': 'contact', '/book': 'book' }

/** Which seo.pages title a path uses (/book/3 is the booking page too); null → seo.title. */
export function pageOf(pathname: string): PageKey | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (p.startsWith('/book/')) return 'book'
  return PAGE_OF[p] ?? null
}

/** Absolute URL for a site path ("/img/og.png" → "https://…/img/og.png"). */
const abs = (origin: string, src: string): string => (/^https?:\/\//.test(src) ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`)

export interface HeadValues {
  title: string; description: string; canonical: string
  og: { site_name: string; url: string; title: string; description: string; image: string; image_width: string; image_height: string; image_alt: string }
  app_title: string
}

export function headValues(s: S, c: SiteContent, origin: string, pathname: string): HeadValues {
  const vars = siteVars(s, c)
  const fill = (t: string) => fillTemplate(t, vars)
  const page = pageOf(pathname)
  const title = fill((page && c.seo.pages[page]) || c.seo.title)
  const img = c.seo.og_image
  return {
    title, description: fill(c.seo.description), canonical: `${origin}/`,
    og: {
      site_name: fill(c.seo.site_name), url: `${origin}/`, title: fill(c.seo.og_title), description: fill(c.seo.og_description),
      image: abs(origin, img.src), image_width: String(img.w), image_height: String(img.h), image_alt: img.alt,
    },
    app_title: fill(c.seo.app_short_name),
  }
}

/** "0985258963" → "+963985258963" (schema.org wants the international form); anything else unchanged. */
export function intlPhone(phone: string): string {
  const p = phone.replace(/[\s-]/g, '')
  if (/^0\d{6,}$/.test(p)) return `+963${p.slice(1)}`
  if (/^00\d+$/.test(p)) return `+${p.slice(2)}`
  return p
}

/** "درعا، شارع المجمع الحكومي – بناء العايش" → locality "درعا", street the rest. No comma → the whole text is the street. */
export function splitAddress(address: string): { street: string; locality: string | null } {
  const m = /^([^،,]+)[،,]\s*(.+)$/.exec(address.trim())
  return m?.[1] && m[2] ? { locality: m[1].trim(), street: m[2].trim() } : { locality: null, street: address.trim() }
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The LocalBusiness JSON-LD, same structure and (with defaults) the same values as web/index.html. */
export function jsonLd(s: S, c: SiteContent, origin: string): Record<string, unknown> {
  const vars = siteVars(s, c)
  const fill = (t: string) => fillTemplate(t, vars)
  const { street, locality } = splitAddress(s.address)
  const sameAs = [vars.instagram ? `https://instagram.com/${vars.instagram}` : '', c.brand.facebook_url, c.brand.tiktok_url].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    additionalType: 'https://schema.org/CoworkingSpace',
    name: fill(c.seo.site_name),
    alternateName: s.centre_name,
    description: fill(c.seo.ld_description),
    slogan: c.brand.slogan,
    url: origin,
    logo: `${origin}/icons/icon-512.png`,
    image: abs(origin, c.seo.og_image.src),
    telephone: intlPhone(s.phone),
    ...(c.brand.email ? { email: c.brand.email } : {}),
    address: { '@type': 'PostalAddress', streetAddress: street, ...(locality ? { addressLocality: locality } : {}), addressCountry: 'SY' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: s.open, closes: s.close }],
    ...(sameAs.length ? { sameAs } : {}),
    currenciesAccepted: 'SYP',
  }
}

// ---------- theme ----------

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: [number, number, number], b: [number, number, number], t: number): string =>
  `#${hex2(a[0] + (b[0] - a[0]) * t)}${hex2(a[1] + (b[1] - a[1]) * t)}${hex2(a[2] + (b[2] - a[2]) * t)}`
function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/**
 * The brand colour and the shades the stylesheet derives from it (web/src/styles.css :root): hover a little darker,
 * -50 / -100 light tints, the hairline, and the text colour on it (white unless the colour is too light for white).
 */
export function brandVars(brand: string): Record<string, string> {
  const c = rgb(brand)
  const L = luminance(c)
  const onBrand = (1.05 / (L + 0.05)) >= ((L + 0.05) / (luminance([15, 23, 42]) + 0.05)) ? '#ffffff' : '#0f172a'
  return {
    '--brand': brand.toLowerCase(),
    '--brand-hover': mix(c, [0, 0, 0], 0.14),
    '--brand-50': mix(c, [255, 255, 255], 0.94),
    '--brand-100': mix(c, [255, 255, 255], 0.88),
    '--on-brand': onBrand,
    '--wine-line': `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.32)`,
  }
}

/** `<style>` for a changed brand colour; '' while it is the default (the stylesheet already has it). */
export function brandStyle(c: SiteContent): string {
  const brand = c.theme.brand
  if (!/^#[0-9a-fA-F]{6}$/.test(brand) || brand.toLowerCase() === DEFAULT_CONTENT.theme.brand.toLowerCase()) return ''
  const vars = Object.entries(brandVars(brand)).map(([k, v]) => `${k}:${v}`).join(';')
  return `<style id="fp-theme">:root{${vars}}</style>`
}

// ---------- boot data ----------

/**
 * JSON that is safe inside an inline <script>: "<" ">" "&" can never close the tag or start a comment, and U+2028/9
 * (legal in JSON, line breaks in old JS) are escaped. The result is still valid JSON / a JS literal.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

/** window.__FP_BOOT__ = {content, settings}: the site renders the edited content on the first paint, before any fetch. */
export const bootScript = (content: SiteContent, settings: PublicSettings): string =>
  `<script id="fp-boot">window.__FP_BOOT__=${scriptJson({ content, settings })}</script>`

// ---------- manifest ----------

/**
 * The installed app's name follows the centre: seo.app_name when the admin changed it, else settings.centre_name
 * (the default app name is the default centre name). short_name / description come from the content. Everything else
 * of the built manifest (icons, colours, scope…) is kept as it is.
 */
export function patchManifest(manifest: Record<string, unknown>, s: S, c: SiteContent): Record<string, unknown> {
  const vars = siteVars(s, c)
  const fill = (t: string) => fillTemplate(t, vars).trim()
  const name = c.seo.app_name !== DEFAULT_CONTENT.seo.app_name ? fill(c.seo.app_name) : s.centre_name.trim()
  return {
    ...manifest,
    name: name || manifest.name,
    short_name: fill(c.seo.app_short_name) || manifest.short_name,
    description: fill(c.seo.app_description) || manifest.description,
  }
}
