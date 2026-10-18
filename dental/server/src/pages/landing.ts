// The public landing page: GET / (Arabic, RTL), /en (English) and /<lang> for every language of site-lang.ts, one full
// HTML document per request. The comparison page (compare.ts) is built from the same pieces (makeView, pageHead,
// header, footer). The CSP allows scripts and styles from 'self' only, so there is no inline <script> code, <style> or
// style="" here; the JSON-LD block is data the browser never runs. Words live in content.ts, styles in site/css,
// pictures in site/img.
import { DEFAULT_SETTINGS, ORIGIN, type LandingContext, type SiteSettings } from '../types'
import { docLang, HREFLANG, imageLang, isRtl, LANG_NAME, OG_LOCALE, SITE_DATE, SITE_LANGS, sitePath, X_DEFAULT, type SiteLang } from '../site-lang'
import { COPY, type Copy, type Feature, type IconName } from './content'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
/** Every settings value and every word goes through this before it reaches the HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ESC[c])
}

/** Replaces {name} in an already-escaped template with ready (escaped) HTML. */
export function fillHtml(template: string, vars: Record<string, string>): string {
  return escapeHtml(template).replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

/** The same for plain text (structured data): no escaping, the JSON encoder does that. */
export function fillText(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}

/** JSON for a <script type="application/ld+json"> block: nothing in it can close the element. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

// Lucide icons (ISC licence, the set the app itself uses), inner markup of a 24×24 stroke icon. The tooth is the
// brand mark from public/icon.svg redrawn as a stroke icon, since Lucide has none. The activation page uses them too.
export const ICONS: Record<IconName, string> = {
  wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  monitorSmartphone: '<path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96 3.15"/><path d="M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  databaseBackup: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 12a9 3 0 0 0 5 2.69"/><path d="M21 9.3V5"/><path d="M3 5v14a9 3 0 0 0 6.47 2.88"/><path d="M12 12v4h4"/><path d="M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16"/>',
  lockKeyhole: '<circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
  heartPulse: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  tooth: '<path d="M11.88 4.62C10.38 2.88 8.38 2.44 6.38 3.88C4.12 5.5 3.62 8.62 4.62 11.38C5.75 14.5 6.38 18.38 7.38 20.62C7.75 21.5 8.88 21.5 9.25 20.62C9.88 19.12 10.25 16.88 10.88 15.38C11.25 14.38 12.5 14.38 12.88 15.38C13.5 16.88 13.88 19.12 14.5 20.62C14.88 21.5 16 21.5 16.38 20.62C17.38 18.38 18 14.5 19.12 11.38C20.12 8.62 19.62 5.5 17.38 3.88C15.38 2.44 13.38 2.88 11.88 4.62Z"/>',
  calendarCheck: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  chartColumn: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  userCog: '<path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m14.305 16.53.923-.382"/><path d="m15.228 13.852-.923-.383"/><path d="m16.852 12.228-.383-.923"/><path d="m16.852 17.772-.383.924"/><path d="m19.148 12.228.383-.923"/><path d="m19.53 18.696-.382-.924"/><path d="m20.772 13.852.924-.383"/><path d="m20.772 16.148.924.383"/><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  messageCircle: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  infinity: '<path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/>',
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/>',
  keyRound: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  lifeBuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  circleAlert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  loaderCircle: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  bookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  playCircle: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
}

// Each page carries the icons it uses once, as <symbol>s in a hidden sprite, and every icon is a <use> of one.
// renderLanding is synchronous, so this per-render set cannot mix two requests.
let usedIcons = new Set<IconName>()
/** A page starts with no icons in its sprite. */
export function resetIcons(): void { usedIcons = new Set() }

export function icon(name: IconName, cls = ''): string {
  usedIcons.add(name)
  // stroke and fill come from .ic in site.css
  return `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`
}

export function iconSprite(): string {
  const symbols = [...usedIcons].map(n => `<symbol id="i-${n}" viewBox="0 0 24 24">${ICONS[n]}</symbol>`).join('')
  return `<svg class="icon-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">${symbols}</svg>`
}

/** "Forward" in the reading direction. */
export const forward = (lang: SiteLang) => icon(isRtl(lang) ? 'arrowLeft' : 'arrowRight')

/** Responsive image sources: one file per width, e.g. /img/hero-ar-960.webp. */
const srcset = (base: string, widths: number[], ext: string) => widths.map(w => `${base}-${w}.${ext} ${w}w`).join(', ')

const HERO_W = [640, 960, 1280, 1600, 2000]
const CHART_W = [800, 1200, 1600, 2200]
const PHONE_W = [300, 480, 720]

export interface View {
  lang: SiteLang
  t: Copy
  s: SiteSettings
  ctx: LandingContext
  origin: string
  /** Path prefix of the marketing pages in this language: '' (Arabic), '/en', '/fr'… */
  base: string
  /** Path prefix of the pages that exist in Arabic and English only (guide, videos, activation, legal): '' or '/en'. */
  docBase: string
  /** This page's path in Arabic ('/' or '/compare'): its other languages are sitePath(path, lang). */
  path: string
  waDigits: string
  waDisplay: string
  price: string
  /** The price as shown inside running text ("‎59$‎" in Arabic, "$59" in English). */
  priceInline: string
}

export function waLink(v: View, message: string): string {
  return `https://wa.me/${v.waDigits}?text=${encodeURIComponent(message)}`
}

function formatSize(bytes: number, v: View): string {
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} ${v.t.mb}`
}

/** What every marketing page needs: the language, its words, the seller's settings, the published downloads. */
export function makeView(lang: SiteLang, s: SiteSettings, ctx: LandingContext, path = '/'): View {
  const t = COPY[lang]
  if (!t) throw new Error(`no words for the language ${lang}`)
  // settings are validated by the API, but the page must still render if a field is missing or odd
  const digits = String(s.whatsapp ?? '').replace(/\D/g, '')
  const fallback = DEFAULT_SETTINGS.whatsapp
  const waOk = digits.length >= 8 && digits.length <= 15
  const priceNum = Number.isFinite(s.priceUsd) && s.priceUsd >= 0 ? s.priceUsd : DEFAULT_SETTINGS.priceUsd
  const price = Number.isInteger(priceNum) ? String(priceNum) : priceNum.toFixed(2)
  return {
    lang, t, s, ctx, path,
    origin: String(ctx.origin || '').replace(/\/+$/, ''),
    base: lang === 'ar' ? '' : `/${lang}`,
    docBase: docLang(lang) === 'ar' ? '' : '/en',
    waDigits: waOk ? digits : fallback.replace(/\D/g, ''),
    waDisplay: waOk ? String(s.whatsapp).trim() : fallback,
    price,
    // U+2066…U+2069 keep "59$" in that order inside right-to-left text
    priceInline: isRtl(lang) ? `\u2066${price}$\u2069` : `$${price}`,
  }
}

export function renderLanding(lang: SiteLang, s: SiteSettings, ctx: LandingContext): string {
  const v = makeView(lang, s, ctx, '/')
  const t = v.t
  const dir = isRtl(lang) ? 'rtl' : 'ltr'
  resetIcons()
  const body = `<a class="skip-link" href="#main">${escapeHtml(t.skip)}</a>
${announcement(v)}${header(v)}
<main id="main">
${hero(v)}
${trust(v)}
${summary(v)}
${features(v)}
${privacy(v)}
${screenshots(v)}
${steps(v)}
${pricing(v)}
${downloads(v)}
${faq(v)}
${finalCta(v)}
</main>
${footer(v)}`
  return `<!doctype html>
<html lang="${HREFLANG[lang]}" dir="${dir}">
${head(v)}
<body>
${iconSprite()}
${body}
</body>
</html>
`
}

export interface HeadOptions {
  title: string
  description: string
  /** Title of the sharing card (og:title), when other than the page title. */
  ogTitle?: string
  ogType: 'website' | 'article'
  /** The page's own stylesheet after site.css (e.g. '/css/landing.css'). */
  css: string[]
  /** The page's own script, if any. */
  script?: string
  /** The structured data: one @graph. */
  ld: unknown
}

/** The fonts a page in this language preloads: Arabic script pages the Arabic face too. */
function fontsFor(lang: SiteLang): string[] {
  return isRtl(lang) ? ['/fonts/noto-kufi-arabic-wght.woff2', '/fonts/inter-latin-wght.woff2'] : ['/fonts/inter-latin-wght.woff2']
}

/** The page's <head>: title, description, canonical and its hreflang cluster (every language, x-default English), icons, fonts, sharing card, structured data. */
export function pageHead(v: View, o: HeadOptions): string {
  const { lang, origin } = v
  const url = origin + sitePath(v.path, lang)
  const og = `${origin}/img/og-${imageLang(lang)}.jpg`
  const alternates = SITE_LANGS.map(l => `<link rel="alternate" hreflang="${HREFLANG[l]}" href="${escapeHtml(origin + sitePath(v.path, l))}">`).join('\n')
  const ogAlt = SITE_LANGS.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('\n')
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}">
<link rel="canonical" href="${escapeHtml(url)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${escapeHtml(origin + sitePath(v.path, X_DEFAULT))}">
<meta name="theme-color" content="#0E8F86">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${fontsFor(lang).map(f => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="/css/site.css">
${o.css.map(c => `<link rel="stylesheet" href="${c}">`).join('\n')}
<meta property="og:type" content="${o.ogType}">
<meta property="og:site_name" content="Dentora">
<meta property="og:title" content="${escapeHtml(o.ogTitle ?? o.title)}">
<meta property="og:description" content="${escapeHtml(o.description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(og)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(v.t.meta.ogImageAlt)}">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${ogAlt}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(o.ogTitle ?? o.title)}">
<meta name="twitter:description" content="${escapeHtml(o.description)}">
<meta name="twitter:image" content="${escapeHtml(og)}">
<meta name="twitter:image:alt" content="${escapeHtml(v.t.meta.ogImageAlt)}">
<script type="application/ld+json">${jsonForScript(o.ld)}</script>
${o.script ? `<script src="${o.script}" defer></script>` : ''}
</head>`
}

function head(v: View): string {
  const { t } = v
  return pageHead(v, { title: t.meta.title, description: t.meta.description, ogTitle: t.meta.ogTitle, ogType: 'website', css: ['/css/landing.css'], script: '/js/landing.js', ld: structuredData(v) })
}

// ---- structured data (schema.org) ------------------------------------------------------------------------------------
// The company behind Dentora (Raqeem), the site (Dentora, for the site name search engines show) and the app are
// described once with stable @ids, so every page can point to them. Everything here is also visible on the pages.

/** The maker of Dentora: Raqeem (raqeem.dev). Its logo is the mark raqeem.dev itself shows, saved as /img/raqeem-logo.png. */
export const ORG_ID = `${ORIGIN}/#organization`
export const SITE_ID = `${ORIGIN}/#website`
export const APP_ID = `${ORIGIN}/#software`

export function organization(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Raqeem',
    alternateName: 'رقيم',
    url: 'https://raqeem.dev',
    logo: { '@type': 'ImageObject', url: `${ORIGIN}/img/raqeem-logo.png`, width: 512, height: 512 },
    brand: { '@type': 'Brand', name: 'Dentora' },
  }
}

export function website(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: 'Dentora',
    alternateName: ['دنتورا', 'Dentora dental clinic software'],
    url: `${ORIGIN}/`,
    inLanguage: SITE_LANGS.map(l => HREFLANG[l]),
    publisher: { '@id': ORG_ID },
  }
}

/** The home page's screenshots in a language, largest file of each (the structured data's and the sitemap's images). */
export function screenshotPaths(lang: SiteLang): string[] {
  const img = imageLang(lang)
  return [
    `/img/hero-${img}-1600.webp`,
    `/img/shot-${img}-chart-1600.webp`,
    ...COPY.en.shots.phones.map(p => `/img/phone-${img}-${p.key}-720.webp`),
  ]
}

const mbText = (bytes: number) => `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`

/** The app as schema.org SoftwareApplication: the same facts the page states (requirements, price, trial, languages, features). */
export function softwareApplication(v: View): Record<string, unknown> {
  const { t, ctx, origin } = v
  const en = COPY.en
  const img = imageLang(v.lang)
  const sizes = [ctx.apk && `Android APK ${mbText(ctx.apk.sizeBytes)}`, ctx.windows && `Windows installer ${mbText(ctx.windows.sizeBytes)}`].filter(Boolean)
  const app: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': APP_ID,
    name: 'Dentora',
    alternateName: 'دنتورا',
    url: `${origin}${sitePath('/', v.lang)}`,
    image: `${origin}/img/og-${img}.jpg`,
    description: t.meta.description,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Dental practice management software',
    operatingSystem: 'Windows 10, Windows 11, Android 7.0 or later',
    softwareRequirements: 'Windows 10 or 11 (64-bit), or Android 7.0 or later. Internet only once, to activate the licence.',
    // the app's own interface languages (not this page's)
    inLanguage: ['ar', 'en'],
    featureList: en.features.items.map(f => f.title).concat(['Works fully offline', 'Data stays on the device', 'Arabic and English interface']),
    screenshot: screenshotPaths(v.lang).map(p => origin + p),
    downloadUrl: [ctx.apk && `${origin}/download/android`, (ctx.windows || v.s.windowsUrl) && `${origin}/download/windows`].filter(Boolean),
    publisher: { '@id': ORG_ID },
    author: { '@id': ORG_ID },
    isAccessibleForFree: false,
    offers: {
      '@type': 'Offer',
      price: v.price,
      priceCurrency: 'USD',
      description: 'Lifetime licence for one device, paid once, every feature included. 7-day free trial with no sign-up.',
      url: `${origin}${sitePath('/', v.lang)}#pricing`,
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORG_ID },
    },
  }
  if (sizes.length) app.fileSize = sizes.join('; ')
  if (ctx.apk?.version) app.softwareVersion = ctx.apk.version
  return app
}

function structuredData(v: View) {
  const { t, origin } = v
  const url = `${origin}${sitePath('/', v.lang)}`
  const page = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: t.meta.title,
    description: t.meta.description,
    inLanguage: HREFLANG[v.lang],
    isPartOf: { '@id': SITE_ID },
    about: { '@id': APP_ID },
    mainEntity: { '@id': APP_ID },
    dateModified: SITE_DATE,
    primaryImageOfPage: `${origin}/img/og-${imageLang(v.lang)}.jpg`,
  }
  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url: `${url}#faq`,
    inLanguage: HREFLANG[v.lang],
    mainEntity: t.faq.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: faqText(v, item.a) },
    })),
  }
  return { '@context': 'https://schema.org', '@graph': [organization(), website(), page, softwareApplication(v), faqPage] }
}

/** The activation page's address as written in a sentence: "dentora.raqeem.dev/activate" ("…/en/activate"). */
const activateAddress = (v: View) => `${v.origin.replace(/^https?:\/\//, '')}${v.docBase}/activate`

/** FAQ answer as plain text (for the structured data): {compare} becomes the link's text and the page's address. */
export function faqText(v: View, a: string): string {
  const ltr = (s: string) => (isRtl(v.lang) ? `\u2066${s}\u2069` : s)
  const email = v.s.email ? fillText(v.t.faq.emailPart, { email: v.s.email }) : ''
  const compare = `${v.t.faq.compareLink} (${ltr(`${v.origin}${sitePath('/compare', v.lang)}`)})`
  return fillText(a, { price: v.priceInline, whatsapp: ltr(v.waDisplay), email, activate: ltr(activateAddress(v)), compare })
}

/** FAQ answer as HTML: the phone number, the e-mail, the activation page's address and the comparison page become links. */
export function faqHtml(v: View, a: string): string {
  const phone = `<a href="${escapeHtml(waLink(v, v.t.wa.general))}" rel="noopener" target="_blank"><bdi dir="ltr">${escapeHtml(v.waDisplay)}</bdi></a>`
  const email = v.s.email
    ? fillHtml(v.t.faq.emailPart, { email: `<a href="mailto:${escapeHtml(v.s.email)}"><bdi dir="ltr">${escapeHtml(v.s.email)}</bdi></a>` })
    : ''
  const activate = `<a href="${v.docBase}/activate"><bdi dir="ltr">${escapeHtml(activateAddress(v))}</bdi></a>`
  const compare = `<a href="${sitePath('/compare', v.lang)}">${escapeHtml(v.t.faq.compareLink)}</a>`
  return fillHtml(a, { price: escapeHtml(v.priceInline), whatsapp: phone, email, activate, compare })
}

export function announcement(v: View): string {
  // written by the seller in Arabic and English only (control panel): the other languages show none
  const text = String((v.lang === 'ar' ? v.s.announcementAr : v.lang === 'en' ? v.s.announcementEn : '') ?? '').trim()
  if (!text) return ''
  return `<aside class="announce" aria-label="${escapeHtml(v.t.announcement)}"><div class="container"><p>${escapeHtml(text)}</p></div></aside>\n`
}

/**
 * The sections of the home page (from another page, the home page's sections), the comparison page, then the user
 * guide and the video course (pages of their own; in Arabic or English only).
 */
function navItems(v: View): string {
  const n = v.t.nav
  const home = v.path === '/' ? '' : sitePath('/', v.lang)
  return [[`${home}#features`, n.features], [`${home}#screenshots`, n.screenshots], [`${home}#pricing`, n.pricing], [`${home}#download`, n.download], [`${home}#faq`, n.faq],
    [sitePath('/compare', v.lang), n.compare], [`${v.docBase}/guide`, n.guide], [`${v.docBase}/videos`, n.videos]]
    .map(([href, label]) => `<li><a href="${href}"${href === sitePath(v.path, v.lang) ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`).join('')
}

/**
 * The language switch: with two languages a link to the other one, with more a menu of all of them (a <details>, no
 * script needed). Each link goes to this same page in that language.
 */
function langLink(v: View, cls: string): string {
  if (SITE_LANGS.length === 2) {
    const other = SITE_LANGS.find(l => l !== v.lang) ?? 'en'
    return `<a class="${cls}" href="${sitePath(v.path, other)}" hreflang="${HREFLANG[other]}" lang="${HREFLANG[other]}" title="${escapeHtml(v.t.other.label)}">${icon('languages')}<span>${escapeHtml(LANG_NAME[other])}</span></a>`
  }
  const items = SITE_LANGS.map(l => `<li><a href="${sitePath(v.path, l)}" hreflang="${HREFLANG[l]}" lang="${HREFLANG[l]}"${l === v.lang ? ' aria-current="true"' : ''}>${escapeHtml(LANG_NAME[l])}</a></li>`).join('')
  return `<details class="lang-menu ${cls}"><summary aria-label="${escapeHtml(v.t.langMenu)}">${icon('languages')}<span>${escapeHtml(LANG_NAME[v.lang])}</span>${icon('chevronDown', 'lang-chev')}</summary><ul class="lang-list">${items}</ul></details>`
}

function brand(): string {
  return `<img src="/favicon.svg" width="36" height="36" alt=""><span>Dentora</span>`
}

export function header(v: View): string {
  const { t } = v
  const wa = escapeHtml(waLink(v, t.wa.general))
  return `<header class="site-header">
<div class="container header-inner">
<a class="brand" href="${sitePath('/', v.lang)}">${brand()}</a>
<nav class="nav-inline" aria-label="${escapeHtml(t.nav.label)}"><ul>${navItems(v)}</ul></nav>
<div class="header-actions">
${langLink(v, 'lang-link')}
<a class="btn btn-wa btn-sm header-wa" href="${wa}" rel="noopener" target="_blank">${icon('messageCircle')}<span class="label">${escapeHtml(t.whatsapp.header)}</span></a>
<details class="menu">
<summary aria-label="${escapeHtml(t.menu)}">${icon('menu', 'ic-open')}${icon('x', 'ic-close')}</summary>
<div class="menu-panel">
<nav aria-label="${escapeHtml(t.nav.label)}"><ul>${navItems(v)}</ul></nav>
${langLink(v, 'menu-lang')}
<a class="btn btn-wa btn-block" href="${wa}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(t.whatsapp.header)}</span></a>
</div>
</details>
</div>
</div>
</header>`
}

/** The Android button: the published APK, or a WhatsApp request when none is published yet. */
function androidButton(v: View, cls: string, withMeta: boolean): string {
  const { t, ctx } = v
  if (!ctx.apk) {
    return `<a class="btn ${cls}" href="${escapeHtml(waLink(v, t.wa.android))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(t.hero.androidRequest)}</span></a>`
  }
  const meta = withMeta
    ? `<small>${fillHtml(t.hero.apkMeta, { version: `<bdi dir="ltr">${escapeHtml(ctx.apk.version)}</bdi>`, size: escapeHtml(formatSize(ctx.apk.sizeBytes, v)) })}</small>`
    : ''
  return `<a class="btn ${cls}" href="/download/android" rel="nofollow">${icon('download')}<span class="btn-text"><span>${escapeHtml(t.hero.android)}</span>${meta}</span></a>`
}

/** The Windows button: /download/windows counts the download, then goes to the installer or to WhatsApp. */
function windowsLabel(v: View): string {
  return v.ctx.windows || v.s.windowsUrl ? v.t.hero.windows : v.t.hero.windowsRequest
}

function hero(v: View): string {
  const { t, lang } = v
  const sizes = '(min-width: 1440px) 750px, (min-width: 1200px) 54vw, min(960px, calc(100vw - 32px))'
  const base = `/img/hero-${imageLang(lang)}`
  return `<section class="hero" aria-labelledby="hero-title">
<div class="container hero-inner">
<div class="hero-copy">
<p class="badge"><span class="dot" aria-hidden="true"></span>${escapeHtml(t.hero.badge)}</p>
<h1 id="hero-title">${escapeHtml(t.hero.titleA)} <span class="hl">${escapeHtml(t.hero.titleB)}</span></h1>
<p class="hero-lead">${escapeHtml(t.hero.lead)}</p>
<div class="hero-ctas">
${androidButton(v, 'btn-primary btn-lg', true)}
<a class="btn btn-outline btn-lg" href="/download/windows" rel="nofollow">${icon('monitor')}<span>${escapeHtml(windowsLabel(v))}</span></a>
</div>
<a class="hero-wa" href="${escapeHtml(waLink(v, t.wa.general))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(t.hero.whatsapp)}</span>${forward(lang)}</a>
<ul class="hero-points">${t.hero.points.map(p => `<li>${icon('check')}<span>${escapeHtml(p)}</span></li>`).join('')}</ul>
</div>
<div class="hero-media">
<picture>
<source type="image/avif" srcset="${srcset(base, HERO_W, 'avif')}" sizes="${sizes}">
<img src="${base}-1280.webp" srcset="${srcset(base, HERO_W, 'webp')}" sizes="${sizes}" width="1600" height="984" alt="${escapeHtml(t.hero.imageAlt)}" fetchpriority="high" decoding="async">
</picture>
</div>
</div>
</section>`
}

function trust(v: View): string {
  const icons: IconName[] = ['wifiOff', 'languages', 'monitorSmartphone', 'shieldCheck', 'databaseBackup']
  return `<section class="trust" aria-label="${escapeHtml(v.t.trust.label)}">
<div class="container"><ul class="trust-list">${v.t.trust.items.map((item, i) => `<li><span class="trust-icon">${icon(icons[i])}</span><span>${escapeHtml(item)}</span></li>`).join('')}</ul></div>
</section>`
}

/** "What is Dentora?": the facts in one paragraph, near the top (what search engines and AI assistants quote). */
function summary(v: View): string {
  const sm = v.t.summary
  return `<section class="summary" id="about" aria-labelledby="about-title">
<div class="container summary-inner">
<h2 id="about-title">${escapeHtml(sm.title)}</h2>
<p>${fillHtml(sm.text, { price: escapeHtml(v.priceInline) })}</p>
${sm.appLang ? `<p class="summary-note">${icon('languages')}<span>${escapeHtml(sm.appLang)}</span></p>` : ''}
</div>
</section>`
}

export function sectionHead(id: string, eyebrow: string, title: string, lead?: string, cls = 'section-head'): string {
  return `<div class="${cls}"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2 id="${id}-title">${escapeHtml(title)}</h2>${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}</div>`
}

function featureCard(f: Feature): string {
  const chips = f.chips?.length
    ? `<ul class="chips">${f.chips.map(c => `<li class="chip${c.tone ? ` chip-${c.tone}` : ''}">${escapeHtml(c.label)}</li>`).join('')}</ul>`
    : ''
  return `<li class="feature${chips ? ' feature-wide' : ''}"><span class="feature-icon">${icon(f.icon)}</span><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.text)}</p>${chips}</li>`
}

function features(v: View): string {
  const f = v.t.features
  return `<section class="section features" id="features" aria-labelledby="features-title">
<div class="container">
${sectionHead('features', f.eyebrow, f.title, f.lead)}
<ul class="feature-grid">${f.items.map(featureCard).join('\n')}</ul>
</div>
</section>`
}

function privacy(v: View): string {
  const p = v.t.privacy
  return `<section class="privacy" id="privacy" aria-labelledby="privacy-title">
<div class="container privacy-inner">
${sectionHead('privacy', p.eyebrow, p.title, p.lead, 'privacy-head')}
<ul class="privacy-points">${p.points.map(x => `<li><span class="pp-icon">${icon(x.icon)}</span><div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.text)}</p></div></li>`).join('')}</ul>
</div>
</section>`
}

function screenshots(v: View): string {
  const { t } = v
  const sh = t.shots
  const img = imageLang(v.lang)
  const chart = `/img/shot-${img}-chart`
  const phones = sh.phones.map(p => {
    const b = `/img/phone-${img}-${p.key}`
    return `<li><figure class="phone-card"><div class="phone"><div class="screen"><img src="${b}-480.webp" srcset="${srcset(b, PHONE_W, 'webp')}" sizes="(min-width: 1100px) 220px, 232px" width="480" height="853" alt="${escapeHtml(p.alt)}" loading="lazy" decoding="async"></div></div><figcaption><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.text)}</span></figcaption></figure></li>`
  }).join('\n')
  return `<section class="section shots" id="screenshots" aria-labelledby="screenshots-title">
<div class="container">
${sectionHead('screenshots', sh.eyebrow, sh.title, sh.lead)}
<figure class="desk">
<div class="window">
<div class="window-bar" aria-hidden="true"><img src="/favicon.svg" width="16" height="16" alt=""><span>${escapeHtml(sh.windowTitle)}</span><span class="win-ctl"><span></span><span></span><span></span></span></div>
<img src="${chart}-1200.webp" srcset="${srcset(chart, CHART_W, 'webp')}" sizes="(min-width: 1240px) 1200px, calc(100vw - 32px)" width="1600" height="900" alt="${escapeHtml(sh.featured.alt)}" loading="lazy" decoding="async">
</div>
<figcaption><span class="tag">${icon('monitor')}${escapeHtml(sh.desktopLabel)}</span><strong>${escapeHtml(sh.featured.title)}</strong><span>${escapeHtml(sh.featured.text)}</span></figcaption>
</figure>
<div class="phones-wrap">
<p class="phones-head"><span class="tag">${icon('smartphone')}${escapeHtml(sh.phoneLabel)}</span></p>
<ul class="phones" tabindex="0" aria-label="${escapeHtml(sh.phoneLabel)}">
${phones}
</ul>
</div>
</div>
</section>`
}

function steps(v: View): string {
  const st = v.t.steps
  const icons: IconName[] = ['download', 'messageCircle', 'keyRound']
  return `<section class="section steps" id="how" aria-labelledby="how-title">
<div class="container">
${sectionHead('how', st.eyebrow, st.title, st.lead)}
<ol class="step-list">${st.items.map((x, i) => `<li class="step"><div class="step-top"><span class="step-num" aria-hidden="true">${i + 1}</span>${icon(icons[i], 'step-icon')}</div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.text)}</p>${x.link ? `<a class="step-link" href="${v.docBase}${x.linkTo ?? '/activate'}">${escapeHtml(x.link)}${forward(v.lang)}</a>` : ''}</li>`).join('')}</ol>
</div>
</section>`
}

function pricing(v: View): string {
  const { t, s, lang } = v
  const p = t.pricing
  // the seller writes this line in Arabic and English only (control panel); the other languages show the card without it
  const priceText = String((lang === 'ar' ? s.priceTextAr : lang === 'en' ? s.priceTextEn : '') ?? '').trim()
  return `<section class="section pricing" id="pricing" aria-labelledby="pricing-title">
<div class="container pricing-grid">
<div class="pricing-copy">
${sectionHead('pricing', p.eyebrow, p.title, p.lead, 'pricing-head')}
<ul class="pricing-points">${p.points.map(x => `<li><span class="pr-icon">${icon(x.icon)}</span><div><h3>${escapeHtml(x.title)}</h3><p>${escapeHtml(x.text)}</p></div></li>`).join('')}</ul>
</div>
<div class="price-card">
<p class="price-label">${icon('infinity')}${escapeHtml(p.label)}</p>
<p class="price-amount"><span class="price-figure" dir="ltr">${lang === 'ar'
    // Arabic writes the sign after the number (59$), as the price line, the FAQ and the panel do.
    ? `<span class="price-num">${escapeHtml(v.price)}</span><span class="price-cur">$</span>`
    : `<span class="price-cur">$</span><span class="price-num">${escapeHtml(v.price)}</span>`}</span></p>
${priceText ? `<p class="price-text">${escapeHtml(priceText)}</p>` : ''}
<p class="price-terms">${escapeHtml(p.terms)}</p>
<p class="price-incl">${escapeHtml(p.includedTitle)}</p>
<ul class="checks">${p.included.map(x => `<li><span class="check-dot">${icon('check')}</span><span>${escapeHtml(x)}</span></li>`).join('')}</ul>
<a class="btn btn-wa btn-lg btn-block" href="${escapeHtml(waLink(v, t.wa.buy))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(p.cta)}</span></a>
<a class="price-trial" href="#download">${escapeHtml(p.trial)}${forward(lang)}</a>
</div>
</div>
</section>`
}

function downloads(v: View): string {
  const { t, ctx, s } = v
  const d = t.download
  const a = d.android
  const w = d.windows
  const androidFacts = ctx.apk
    ? `<li>${icon('check')}<span>${escapeHtml(a.req)}</span></li><li>${icon('check')}<span>${fillHtml(a.meta, { version: `<bdi dir="ltr">${escapeHtml(ctx.apk.version)}</bdi>`, size: escapeHtml(formatSize(ctx.apk.sizeBytes, v)) })}</span></li>`
    : `<li>${icon('check')}<span>${escapeHtml(a.req)}</span></li><li>${icon('check')}<span>${escapeHtml(a.requestText)}</span></li>`
  const androidBtn = ctx.apk
    ? `<a class="btn btn-primary btn-lg btn-block" href="/download/android" rel="nofollow">${icon('download')}<span>${escapeHtml(a.btn)}</span></a>`
    : `<a class="btn btn-wa btn-lg btn-block" href="${escapeHtml(waLink(v, t.wa.android))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(a.requestBtn)}</span></a>`
  // The installer published on this Worker first (its version and size), else the settings' link, else WhatsApp.
  const winFile = ctx.windows
    ? fillHtml(w.file, { version: `<bdi dir="ltr">${escapeHtml(ctx.windows.version)}</bdi>`, size: escapeHtml(formatSize(ctx.windows.sizeBytes, v)) })
    : escapeHtml(s.windowsUrl ? w.meta : w.requestText)
  const winFacts = `<li>${icon('check')}<span>${escapeHtml(w.req)}</span></li><li>${icon('check')}<span>${winFile}</span></li>`
  const winBtn = ctx.windows || s.windowsUrl
    ? `<a class="btn btn-primary btn-lg btn-block" href="/download/windows" rel="nofollow">${icon('download')}<span>${escapeHtml(w.btn)}</span></a>`
    : `<a class="btn btn-wa btn-lg btn-block" href="/download/windows" rel="nofollow">${icon('messageCircle')}<span>${escapeHtml(w.requestBtn)}</span></a>`
  return `<section class="section download" id="download" aria-labelledby="download-title">
<div class="container">
${sectionHead('download', d.eyebrow, d.title, d.lead)}
<div class="dl-grid">
<article class="dl-card" aria-labelledby="dl-android">
<div class="dl-head"><span class="dl-icon">${icon('smartphone')}</span><div><div class="dl-title"><h3 id="dl-android">${escapeHtml(a.name)}</h3><span class="tag dl-free">${escapeHtml(d.free)}</span></div><p>${escapeHtml(a.for)}</p></div></div>
<ul class="dl-facts">${androidFacts}</ul>
${ctx.apk ? `<p class="dl-note">${escapeHtml(a.note)}</p>` : ''}
${androidBtn}
</article>
<article class="dl-card" aria-labelledby="dl-windows">
<div class="dl-head"><span class="dl-icon">${icon('monitor')}</span><div><div class="dl-title"><h3 id="dl-windows">${escapeHtml(w.name)}</h3><span class="tag dl-free">${escapeHtml(d.free)}</span></div><p>${escapeHtml(w.for)}</p></div></div>
<ul class="dl-facts">${winFacts}</ul>
${ctx.windows ? `<p class="dl-note">${escapeHtml(w.note)}</p>` : ''}
${winBtn}
</article>
</div>
<div class="req"><h3>${escapeHtml(d.reqTitle)}</h3><ul>${d.reqs.map(r => `<li>${icon('check')}<span>${escapeHtml(r)}</span></li>`).join('')}</ul></div>
</div>
</section>`
}

function faq(v: View): string {
  const f = v.t.faq
  return `<section class="section faq" id="faq" aria-labelledby="faq-title">
<div class="container faq-grid">
<div class="faq-head">
<p class="eyebrow">${escapeHtml(f.eyebrow)}</p>
<h2 id="faq-title">${escapeHtml(f.title)}</h2>
<p class="lead">${escapeHtml(f.more)}</p>
<a class="btn btn-wa" href="${escapeHtml(waLink(v, v.t.wa.general))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(f.moreLink)}</span></a>
<div class="faq-learn"><p>${escapeHtml(f.learn.text)}</p><ul><li><a href="${v.docBase}/guide">${icon('bookOpen')}<span>${escapeHtml(f.learn.guide)}</span></a></li><li><a href="${v.docBase}/videos">${icon('playCircle')}<span>${escapeHtml(f.learn.videos)}</span></a></li></ul></div>
</div>
<div class="faq-list">
${f.items.map((item, i) => `<details class="qa"${i === 0 ? ' open' : ''}><summary><span>${escapeHtml(item.q)}</span>${icon('chevronDown')}</summary><div class="qa-a"><p>${faqHtml(v, item.a)}</p></div></details>`).join('\n')}
</div>
</div>
</section>`
}

/** "#download" on the home page, the home page's download section from any other page. */
export const homeAnchor = (v: View, id: string) => `${v.path === '/' ? '' : sitePath('/', v.lang)}#${id}`

export function finalCta(v: View): string {
  const c = v.t.cta
  return `<section class="cta-band" aria-labelledby="cta-title">
<div class="container">
<div class="cta-card">
<h2 id="cta-title">${escapeHtml(c.title)}</h2>
<p>${escapeHtml(c.lead)}</p>
<div class="cta-actions">
<a class="btn btn-white btn-lg" href="${homeAnchor(v, 'download')}">${icon('download')}<span>${escapeHtml(c.download)}</span></a>
<a class="btn btn-ghost-light btn-lg" href="${escapeHtml(waLink(v, v.t.wa.general))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${escapeHtml(c.whatsapp)}</span></a>
</div>
</div>
</div>
</section>`
}

export function footer(v: View): string {
  const { t, s, docBase } = v
  const f = t.footer
  const email = String(s.email ?? '').trim()
  // every language of this page, as plain links crawlers follow (the header's menu holds the same)
  const langs = SITE_LANGS.length > 2
    ? `<nav class="footer-langs" aria-label="${escapeHtml(t.langMenu)}"><ul>${SITE_LANGS.map(l => `<li><a href="${sitePath(v.path, l)}" hreflang="${HREFLANG[l]}" lang="${HREFLANG[l]}"${l === v.lang ? ' aria-current="true"' : ''}>${escapeHtml(LANG_NAME[l])}</a></li>`).join('')}</ul></nav>`
    : langLink(v, 'lang-link')
  return `<footer class="site-footer">
<div class="container footer-grid">
<div class="footer-brand">
<a class="brand" href="${sitePath('/', v.lang)}">${brand()}</a>
<p>${escapeHtml(f.tagline)}</p>
</div>
<nav class="footer-col" aria-labelledby="ft-product"><h2 class="footer-title" id="ft-product">${escapeHtml(f.product)}</h2><ul class="footer-links">${navItems(v)}<li><a href="${docBase}/activate">${escapeHtml(f.activate)}</a></li></ul></nav>
<nav class="footer-col" aria-labelledby="ft-legal"><h2 class="footer-title" id="ft-legal">${escapeHtml(f.legal)}</h2><ul class="footer-links"><li><a href="${docBase}/privacy">${escapeHtml(f.privacy)}</a></li><li><a href="${docBase}/terms">${escapeHtml(f.terms)}</a></li></ul></nav>
<div class="footer-col"><h2 class="footer-title">${escapeHtml(f.contact)}</h2><ul class="footer-links">
<li><a href="${escapeHtml(waLink(v, t.wa.general))}" rel="noopener" target="_blank">${icon('messageCircle')}<bdi dir="ltr">${escapeHtml(v.waDisplay)}</bdi></a></li>
${email ? `<li><a href="mailto:${escapeHtml(email)}">${icon('mail')}<bdi dir="ltr">${escapeHtml(email)}</bdi></a></li>` : ''}
</ul></div>
</div>
<div class="container footer-bottom">
<p>© ${new Date().getUTCFullYear()} Dentora. ${escapeHtml(f.rights)}</p>
${langs}
</div>
</footer>`
}
