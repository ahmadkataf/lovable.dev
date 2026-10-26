// What the Worker writes into the SPA's index.html and the web manifest from the site content + settings, so the
// first paint, link previews (WhatsApp, Facebook) and search engines already see the admin's edits (DESIGN §3 HTML,
// the seo/theme notes in shared/content.ts). Pure functions only — app.ts applies them with HTMLRewriter.
// Placeholders, JSON-LD and the brand palette come from the shared contract, so the API and the site render the same.
// With the default content and settings every value equals web/index.html and the built manifest (test/site.test.ts).
import {
  DEFAULT_CONTENT, brandStyle as brandCss, buildJsonLd, fillTemplate, siteTemplateVars, type SiteContent, type TemplateSettings,
} from '../../shared/content'
import type { PublicSettings } from '../../shared/types'

type S = TemplateSettings

/** {name} {phone} {hours} {slogan} … from the live settings + brand (rooms are not offered in the SEO fields). */
export const siteVars = (s: S, c: SiteContent): Record<string, string> => siteTemplateVars({ settings: s, brand: c.brand })

/** Plain fillTemplate with whitespace collapsed: a <title> or meta value is one line. */
const plain = (t: string, vars: Record<string, string>): string => fillTemplate(t, vars).replace(/\s+/g, ' ').trim()

// ---------- head ----------

export type PageKey = keyof SiteContent['seo']['pages']
const PAGE_OF: Record<string, PageKey> = { '/': 'home', '/spaces': 'spaces', '/about': 'about', '/contact': 'contact', '/book': 'book' }

/** Which seo.pages title a path uses (/book/3 is the booking page too); null → seo.title. */
export function pageOf(pathname: string): PageKey | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (p.startsWith('/book/')) return 'book'
  return PAGE_OF[p] ?? null
}

export interface HeadValues {
  title: string; description: string; canonical: string
  og: { site_name: string; url: string; title: string; description: string; image: string; image_width: string; image_height: string; image_alt: string }
  app_title: string
}

/** origin: the public origin without a trailing slash (env PUBLIC_URL, else the request's). */
export function headValues(s: S, c: SiteContent, origin: string, pathname: string): HeadValues {
  const vars = siteVars(s, c)
  const page = pageOf(pathname)
  const img = c.seo.og_image
  return {
    title: plain((page && c.seo.pages[page]) || c.seo.title, vars),
    description: plain(c.seo.description, vars),
    canonical: `${origin}/`,
    og: {
      site_name: plain(c.seo.site_name, vars), url: `${origin}/`, title: plain(c.seo.og_title, vars), description: plain(c.seo.og_description, vars),
      image: `${origin}${img.src}`, image_width: String(img.w), image_height: String(img.h), image_alt: plain(img.alt, vars),
    },
    app_title: plain(c.seo.app_short_name, vars),
  }
}

export const jsonLd = (s: S, c: SiteContent, origin: string): Record<string, unknown> => buildJsonLd(c, s, origin)

// ---------- theme ----------

/** `<style>` with the brand palette when the colour changed; '' for the default (the stylesheets already have it). */
export function brandStyle(c: SiteContent): string {
  const css = brandCss(c.theme.brand)
  return css && !/[<>]/.test(css) ? `<style id="fp-theme">${css}</style>` : ''
}

// ---------- boot data ----------

/**
 * JSON that is safe inside an inline <script>: "<" ">" "&" can never close the tag or open a comment, and U+2028/9
 * (legal in JSON, line breaks in old JS engines) are escaped. The result is still valid JSON and a valid JS literal.
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
 * The installed app's name / short_name / description = seo.app_name / app_short_name / app_description. While
 * app_name is still the default it follows settings.centre_name instead (the default app name is the default centre
 * name), so renaming the centre renames the app too. Everything else of the built manifest is kept as it is.
 */
export function patchManifest(manifest: Record<string, unknown>, s: S, c: SiteContent): Record<string, unknown> {
  const vars = siteVars(s, c)
  const name = c.seo.app_name !== DEFAULT_CONTENT.seo.app_name ? plain(c.seo.app_name, vars) : s.centre_name.trim()
  return {
    ...manifest,
    name: name || manifest.name,
    short_name: plain(c.seo.app_short_name, vars) || manifest.short_name,
    description: plain(c.seo.app_description, vars) || manifest.description,
  }
}
