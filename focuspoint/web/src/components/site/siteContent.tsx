// The site's editable content, read once for the customer shell and shared by the header, footer, announcement bar
// and the site pages (docs/cms/DESIGN.md §4). Rendering follows the contract in shared/content.ts:
// - texts go through textParts() (Latin runs, {phone}/{instagram} isolated left-to-right, {code}/{ref} bold);
// - fields marked `rich` go through parseRich() first (**emphasis**, [label](link)), then textParts() per part;
// - an empty optional text hides its element (hasText), a picture that fails to load falls back (usePhotoChain).
import { createContext, Fragment, useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_CONTENT, TEMPLATE_EXAMPLE, fillTemplate, intlPhone, isSafeImageSrc, isSafeLink, parseRich, siteTemplateVars, textParts,
  whatsappLink, wordingFlags, type Photo, type SiteContent, type WordingFlags,
} from '@shared/content'
import { useContent, useTemplateVars, useWordingFlags } from '../../lib/content'

type Vars = Record<string, string | number>

export interface SiteCtx {
  c: SiteContent
  /** {name} {phone} {hours} {privateCount} … (live settings and rooms, today's values while they load). */
  vars: Record<string, string>
  /** Which wording variants apply (pickVariant). */
  flags: WordingFlags
}

// Outside the provider (never in the app) every consumer still gets today's site.
const Ctx = createContext<SiteCtx>({ c: DEFAULT_CONTENT, vars: siteTemplateVars(), flags: wordingFlags(null) })

/** Loads the content, the placeholder values and the wording flags once for the whole customer shell. */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const c = useContent()
  const vars = useTemplateVars(c)
  const flags = useWordingFlags()
  const value = useMemo(() => ({ c, vars, flags }), [c, vars, flags])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSite = (): SiteCtx => useContext(Ctx)

// ---------- texts ----------

/** Has something to show ('' and whitespace hide the element the text feeds). */
export const hasText = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

/** Plain text (aria-label, title, alt): placeholders filled, whitespace collapsed. */
export const plainText = (t: string, vars: Vars): string => fillTemplate(t, vars).replace(/\s+/g, ' ').trim()

/** A page's browser-tab title before filling: seo.pages[page], '' = seo.title. */
export const pickPage = (c: SiteContent, page: keyof SiteContent['seo']['pages']): string => c.seo.pages[page] || c.seo.title

// A long Latin run (a whole English sentence typed by the admin) must still wrap on a phone; short ones
// (THINK OUTSIDE THE BOX, Focus Point) stay on one line as the site shows them today.
const NOWRAP_MAX = 32

function runs(t: string, vars: Vars, key: string): ReactNode[] {
  return textParts(t, vars).map((p, i) => {
    const k = `${key}-${i}`
    switch (p.kind) {
      case 'latin': return <bdi key={k} dir="ltr" className={p.text.length <= NOWRAP_MAX ? 'fp-nowrap' : undefined}>{p.text}</bdi>
      case 'ltr': return <bdi key={k} dir="ltr" className="num">{p.text}</bdi>
      case 'strong': return <b key={k} className="num">{p.text}</b>
      default: return <Fragment key={k}>{p.text}</Fragment>
    }
  })
}

/**
 * One content text, filled and marked up. `rich` (only for fields the schema marks rich): **emphasis** → brand colour
 * (em="brand", headings) or <b> (body), [label](link) → a router link for site pages, a new tab for https.
 */
export function ContentText({ text, vars, rich = false, em = 'bold' }: { text: string; vars: Vars; rich?: boolean; em?: 'brand' | 'bold' }) {
  if (!rich) return <>{runs(text, vars, 't')}</>
  return (
    <>
      {parseRich(text).map((p, i) => {
        if (p.kind === 'em') {
          return em === 'brand'
            ? <span key={i} className="fp-brand-text">{runs(p.text, vars, `e${i}`)}</span>
            : <b key={i}>{runs(p.text, vars, `e${i}`)}</b>
        }
        if (p.kind === 'link') return <SmartLink key={i} href={p.href}>{runs(p.text, vars, `l${i}`)}</SmartLink>
        return <Fragment key={i}>{runs(p.text, vars, `p${i}`)}</Fragment>
      })}
    </>
  )
}

// ---------- links ----------

/** Paths the SPA router serves (everything else under / — /privacy, /media/… — is a file the Worker serves). */
const SPA_PATH = /^\/(?:$|[?#]|(?:spaces|about|contact|book|b|mine|inbox|team)(?:[/?#]|$))/

/** A content link: router link for site pages, new tab for https://, plain for tel:/mailto:/files; unsafe → text only. */
export function SmartLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (!isSafeLink(href)) return <>{children}</>
  if (SPA_PATH.test(href)) return <Link to={href} className={className}>{children}</Link>
  const external = href.startsWith('https://')
  return <a href={href} className={className} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>
}

/** The WhatsApp number: brand.whatsapp, else the centre phone (settings), else today's number. */
export function whatsappNumber(c: SiteContent, vars: Vars): string {
  for (const n of [c.brand.whatsapp, String(vars.phone ?? ''), TEMPLATE_EXAMPLE.phone]) if (n && intlPhone(n)) return n
  return TEMPLATE_EXAMPLE.phone
}

/** WhatsApp chat link + the number as shown (+963…). */
export function brandWhatsapp(c: SiteContent, vars: Vars): { href: string; display: string } {
  const n = whatsappNumber(c, vars)
  return { href: whatsappLink(n), display: intlPhone(n) }
}

/** An optional brand link ('' or not a safe link → null: the element is not shown). */
export const optionalLink = (url: string): string | null => (url && isSafeLink(url) ? url : null)

/** brand.email as a mailto: link, or null. */
export const emailLink = (email: string): string | null => (email && isSafeLink(`mailto:${email}`) ? `mailto:${email}` : null)

/** "https://www.facebook.com/focuspoint/" → "facebook.com/focuspoint" (shown next to the icon). */
export const prettyUrl = (url: string): string => url.replace(/^https:\/\/(?:www\.|m\.)?/, '').replace(/\/+$/, '')

// ---------- pictures ----------

/** A picture path the site may show (/img/… or /media/…). */
export const isUsableSrc = (s: unknown): s is string => typeof s === 'string' && isSafeImageSrc(s)

const usable = (p: Photo | null | undefined): p is Photo =>
  !!p && typeof p.src === 'string' && isSafeImageSrc(p.src) && Number(p.w) > 0 && Number(p.h) > 0

/**
 * The first usable picture of `candidates` (a room photo, the content photo, today's default…). onError moves to the
 * next one; when none is left `photo` is null and the caller shows its placeholder (or nothing).
 */
export function usePhotoChain(candidates: (Photo | null | undefined)[], small = false): { photo: Photo | null; src: string; onError: () => void } {
  const list: Photo[] = []
  for (const p of candidates) if (usable(p) && !list.some((q) => q.src === p.src)) list.push(p)
  const key = list.map((p) => `${p.src}|${p.small ?? ''}`).join(',')
  const [failed, setFailed] = useState<{ key: string; n: number }>({ key, n: 0 })
  const n = failed.key === key ? failed.n : 0
  const photo = list[n] ?? null
  const src = photo ? (small && photo.small && isSafeImageSrc(photo.small) ? photo.small : photo.src) : ''
  return { photo, src, onError: () => setFailed({ key, n: n + 1 }) }
}
