// Renders an editable content text (shared/content.ts) with the site's markup: textParts() isolates a Latin run
// (<bdi dir="ltr" className="fp-nowrap">), {phone}/{instagram} (<bdi dir="ltr" className="num">) and shows {code}/{ref}
// bold (<b className="num">), exactly as the hand-written pages did. `rich` texts may also hold **emphasis** and
// [label](link): parseRich() runs first and textParts() on each part, so live data can never inject a link; a link that
// fails isSafeLink is shown as its label. Only pass `rich` for fields the schema marks rich (others are not link-checked).
import { Fragment, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fillTemplate, isSafeLink, parseRich, pickVariant, textParts } from '@shared/content'
import type { SiteContent, WordingFlags } from '@shared/content'
import { Icon } from '../ui'
import { useContent, useTemplateVars, useWordingFlags } from '../lib/content'

export type Vars = Record<string, string | number>

function parts(text: string, vars: Vars): ReactNode[] {
  return textParts(text, vars).map((p, i) => {
    switch (p.kind) {
      case 'latin': return <bdi key={i} dir="ltr" className="fp-nowrap">{p.text}</bdi>
      case 'ltr': return <bdi key={i} dir="ltr" className="num">{p.text}</bdi>
      case 'strong': return <b key={i} className="num">{p.text}</b>
      default: return <Fragment key={i}>{p.text}</Fragment>
    }
  })
}

/** One content text, filled with `vars`. Renders nothing for an empty text (callers hide the element around it). */
export function ContentText({ text, vars = {}, rich = false }: { text: string; vars?: Vars; rich?: boolean }) {
  if (!text) return null
  if (!rich) return <>{parts(text, vars)}</>
  return (
    <>
      {parseRich(text).map((r, i) => {
        if (r.kind !== 'link') return r.kind === 'em' ? <b key={i}>{parts(r.text, vars)}</b> : <Fragment key={i}>{parts(r.text, vars)}</Fragment>
        if (!isSafeLink(r.href)) return <Fragment key={i}>{parts(r.text, vars)}</Fragment>
        if (r.href.startsWith('/')) return <Link key={i} to={r.href}>{parts(r.text, vars)}</Link>
        const external = r.href.startsWith('https://')
        return <a key={i} href={r.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{parts(r.text, vars)}</a>
      })}
    </>
  )
}

/** True when a content text would show something. */
export const hasText = (t: string | null | undefined): t is string => typeof t === 'string' && t.trim() !== ''

/**
 * The booking-flow texts (content.booking) with the live placeholders and the wording variants of the current settings.
 * `text(field)` = pickVariant (…_no_reminder, …_cash_only …) of that field; `plain(field, extra)` = filled string for
 * props that only take a string (sheet titles, segmented labels).
 */
export function useBookingCopy(): {
  content: SiteContent
  booking: SiteContent['booking']
  vars: Record<string, string>
  flags: WordingFlags
  text: (field: keyof SiteContent['booking'] & string) => string
  plain: (field: keyof SiteContent['booking'] & string, extra?: Vars) => string
} {
  const content = useContent()
  const vars = useTemplateVars(content)
  const flags = useWordingFlags()
  const booking = content.booking
  const text = (field: keyof SiteContent['booking'] & string): string => pickVariant(booking, field, flags)
  const plain = (field: keyof SiteContent['booking'] & string, extra: Vars = {}): string => fillTemplate(text(field), { ...vars, ...extra })
  return { content, booking, vars, flags, text, plain }
}

/** Same markup as ui <Empty>, with content texts (an empty hint hides its line). */
export function ContentEmpty({ title, hint, vars, action }: { title: string; hint?: string; vars: Vars; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true"><Icon name="calendar" size={28} /></div>
      <h3 className="empty-title"><ContentText text={title} vars={vars} /></h3>
      {hasText(hint) && <p className="muted"><ContentText text={hint} vars={vars} /></p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

/** document.title while the page is shown (restored on leave), as the site pages do. */
export function useDocTitle(title: string) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title
    return () => { document.title = prev }
  }, [title])
}

/** The /book pages' tab title: seo.pages.book, '' → seo.title (what the Worker writes into index.html for /book). */
export function useBookTitle() {
  const content = useContent()
  const vars = useTemplateVars(content)
  const t = content.seo.pages.book || content.seo.title
  useDocTitle(fillTemplate(t, vars).replace(/\s+/g, ' ').trim())
}
