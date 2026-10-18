// The languages of the site's marketing pages (the home page /, /<lang>, and the comparison page /compare,
// /<lang>/compare). Arabic is at the root, every other language under its own prefix. The user guide, the video
// course, the activation page and the legal pages exist in Arabic and English only (types.ts → Lang): a page in
// another language links to their English version (docLang).
// The app's own interface is Arabic and English; the pages in the other languages say so.
import type { Lang } from './types'

export type SiteLang = Lang | 'fr' | 'es' | 'pt' | 'tr' | 'id' | 'ur'

/** Every language with published pages, in the order of the language menu (Arabic first, the site's home). */
export const SITE_LANGS: readonly SiteLang[] = ['ar', 'en']

/** All languages the code knows (the ones not in SITE_LANGS yet have no pages). */
export const ALL_SITE_LANGS: readonly SiteLang[] = ['ar', 'en', 'fr', 'es', 'pt', 'tr', 'id', 'ur']

export const isSiteLang = (v: string): v is SiteLang => (SITE_LANGS as readonly string[]).includes(v)

/** hreflang / BCP 47 tag of each language (the Portuguese pages are written for Brazil). */
export const HREFLANG: Record<SiteLang, string> = { ar: 'ar', en: 'en', fr: 'fr', es: 'es', pt: 'pt-BR', tr: 'tr', id: 'id', ur: 'ur' }

/** og:locale of each language. */
export const OG_LOCALE: Record<SiteLang, string> = { ar: 'ar_AR', en: 'en_US', fr: 'fr_FR', es: 'es_ES', pt: 'pt_BR', tr: 'tr_TR', id: 'id_ID', ur: 'ur_PK' }

/** The language's own name, for the language menu. */
export const LANG_NAME: Record<SiteLang, string> = {
  ar: 'العربية', en: 'English', fr: 'Français', es: 'Español', pt: 'Português (Brasil)', tr: 'Türkçe', id: 'Bahasa Indonesia', ur: 'اردو',
}

export const isRtl = (lang: SiteLang) => lang === 'ar' || lang === 'ur'

/** The path of a marketing page in a language: sitePath('/', 'fr') = '/fr', sitePath('/compare', 'ar') = '/compare'. */
export function sitePath(path: string, lang: SiteLang): string {
  if (lang === 'ar') return path
  return path === '/' ? `/${lang}` : `/${lang}${path}`
}

/** The language of the pages that exist in Arabic and English only (guide, videos, activation, legal), for a page in `lang`. */
export const docLang = (lang: SiteLang): Lang => (lang === 'ar' ? 'ar' : 'en')

/** The language whose screenshots and sharing picture a page shows (the app's interface is Arabic or English). */
export const imageLang = (lang: SiteLang): Lang => (lang === 'ar' ? 'ar' : 'en')

/**
 * The language search engines show a reader whose language has no page (hreflang="x-default"): English, as the
 * site is read by dentists everywhere; Arabic readers get the Arabic pages through hreflang="ar".
 */
export const X_DEFAULT: Lang = 'en'

/** Last change of the marketing pages' text (the home page's words, the FAQ): the sitemap's lastmod. */
export const SITE_DATE = '2026-10-18'
