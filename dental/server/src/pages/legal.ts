// /privacy and /terms (and /en/…): the app's own documents (src/features/legal/docs.ts), so the site and the app
// never say different things. The header and footer use the landing page's classes from /css/site.css, the rest is
// /css/legal.css (which also stands in for site.css when a build has none). No script, nothing inline, per the CSP.
import docs from '../../../src/features/legal/docs.ts'
import legalStrings from '../../../src/i18n/modules/legal.ts'
import { escapeHtml } from '../http'
import type { Lang, SiteSettings } from '../types'

/** Date of the documents' text. Keep in step with LEGAL_DATE in src/features/legal/lib.ts (a test checks it). */
export const LEGAL_DATE = '2026-10-15'
export const SELLER_NAME = 'Dentora'

export type LegalDoc = 'privacy' | 'terms'

/** What the page chrome needs to know about the published static files. */
export interface PageAssets { siteCss: boolean; favicon: boolean; manifest: boolean }

const T = {
  ar: {
    skip: 'تخطَّ إلى المحتوى', home: 'الصفحة الرئيسية', kicker: 'Dentora · معلومات قانونية', toc: 'محتويات الصفحة',
    docs: 'المستندات القانونية', whatsapp: 'واتساب', email: 'البريد الإلكتروني', rights: 'جميع الحقوق محفوظة',
    activate: 'تفعيل الترخيص', otherLang: 'English', otherLangName: 'Read in English',
    desc: {
      privacy: 'سياسة خصوصية Dentora لإدارة عيادات الأسنان: بيانات العيادة ومرضاها تبقى على جهازها، ولا نتلقى منها شيئاً.',
      terms: 'شروط استخدام برنامج Dentora لإدارة عيادات الأسنان (اتفاقية ترخيص المستخدم النهائي).',
    },
  },
  en: {
    skip: 'Skip to content', home: 'Home', kicker: 'Dentora · Legal', toc: 'On this page',
    docs: 'Legal documents', whatsapp: 'WhatsApp', email: 'Email', rights: 'All rights reserved',
    activate: 'Activate a licence', otherLang: 'العربية', otherLangName: 'اقرأ بالعربية',
    desc: {
      privacy: 'Privacy policy of Dentora dental clinic software: clinic and patient data stays on the clinic’s device, and we receive none of it.',
      terms: 'Terms of use of Dentora dental clinic software (the end-user licence agreement).',
    },
  },
} as const

const DOC_PATH: Record<LegalDoc, string> = { privacy: '/privacy', terms: '/terms' }
/** The path of a page in a language: '/privacy' ↔ '/en/privacy', '/' ↔ '/en'. */
export const langPath = (path: string, lang: Lang) => (lang === 'ar' ? path : path === '/' ? '/en' : `/en${path}`)
const docTitle = (doc: LegalDoc, lang: Lang) => legalStrings[lang][doc]

/** "11 تشرين الأول 2026" / "11 October 2026": Gregorian, Latin digits, Levant month names as in the app. */
export function legalDate(lang: Lang): string {
  const d = new Date(`${LEGAL_DATE}T00:00:00Z`)
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  } catch { return LEGAL_DATE }
}

// ---- the documents' markup: '## ' a heading, '- ' a bullet, a blank line between paragraphs ---------------------
export type Block = { kind: 'h' | 'p'; text: string } | { kind: 'ul'; items: string[] }
/** Same parser as the app's LegalText.tsx. */
export function parseLegal(src: string): Block[] {
  const out: Block[] = []
  for (const chunk of src.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
    let para: string[] = []
    const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = [] } }
    for (const line of lines) {
      if (line.startsWith('## ')) { flush(); out.push({ kind: 'h', text: line.slice(3).trim() }) }
      else if (line.startsWith('- ')) {
        flush()
        const last = out[out.length - 1]
        if (last && last.kind === 'ul') last.items.push(line.slice(2).trim())
        else out.push({ kind: 'ul', items: [line.slice(2).trim()] })
      } else para.push(line)
    }
    flush()
  }
  return out
}

/** wa.me link of the seller's number: digits only, without a leading 00 ("00963…" is typed for "+963…"). */
export const sellerWa = (whatsapp: string) => `https://wa.me/${(whatsapp || '').replace(/\D/g, '').replace(/^00/, '')}`

/** The seller's contacts as the documents' {contact}: the name, WhatsApp and, when set, e-mail. */
function contactHtml(lang: Lang, s: SiteSettings): string {
  const t = T[lang]
  const items = [
    s.whatsapp && `<li><span class="legal-contact-k">${t.whatsapp}</span> <a href="${escapeHtml(sellerWa(s.whatsapp))}" dir="ltr" rel="noopener">${escapeHtml(s.whatsapp)}</a></li>`,
    s.email && `<li><span class="legal-contact-k">${t.email}</span> <a href="mailto:${escapeHtml(s.email)}" dir="ltr">${escapeHtml(s.email)}</a></li>`,
  ].filter(Boolean).join('')
  return `<div class="legal-contact"><p class="legal-contact-name">${SELLER_NAME}</p>${items ? `<ul>${items}</ul>` : ''}</div>`
}
/** The same contacts as one line of text, for a {contact} inside a sentence. */
function contactText(lang: Lang, s: SiteSettings): string {
  const t = T[lang]
  return [SELLER_NAME, s.whatsapp && `${t.whatsapp}: ${s.whatsapp}`, s.email && `${t.email}: ${s.email}`].filter(Boolean).join(' — ')
}

/** The document as HTML, and its headings for the table of contents. Every piece of text is escaped. */
export function renderDoc(doc: LegalDoc, lang: Lang, s: SiteSettings): { html: string; toc: { id: string; text: string }[] } {
  const src = docs[lang][`${doc}.body`].split('{seller}').join(SELLER_NAME)
  const fill = (text: string) => escapeHtml(text.split('{contact}').join(contactText(lang, s)))
  const toc: { id: string; text: string }[] = []
  let first = true
  const html = parseLegal(src).map(b => {
    if (b.kind === 'h') { const id = `s${toc.length + 1}`; toc.push({ id, text: b.text }); first = false; return `<h2 id="${id}">${escapeHtml(b.text)}</h2>` }
    if (b.kind === 'ul') return `<ul>${b.items.map(i => `<li>${fill(i)}</li>`).join('')}</ul>`
    if (b.text.trim() === '{contact}') return contactHtml(lang, s)
    // The opening paragraph (before the first heading) is the summary: set apart as the lead.
    return `<p${first ? ' class="legal-lead"' : ''}>${fill(b.text)}</p>`
  }).join('\n')
  return { html, toc }
}

const LOGO_SVG = '<svg class="legal-logo" width="36" height="36" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><defs><linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0E8F86"/></linearGradient></defs><rect width="256" height="256" rx="60" fill="url(#lg-g)"/><path d="M120 60C108 46 92 42.5 76 54C58 67 54 92 62 114C71 139 76 170 84 188C87 195 96 195 99 188C104 176 107 158 112 146C115 138 125 138 128 146C133 158 136 176 141 188C144 195 153 195 156 188C164 170 169 139 178 114C186 92 182 67 164 54C148 42.5 132 46 120 60Z" fill="#fff"/><circle cx="178" cy="78" r="14" fill="#fff" opacity=".9"/></svg>'
const LANGUAGES_ICON = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>'

export interface Shell {
  lang: Lang; title: string; description: string; origin: string; assets: PageAssets
  /** The page's path in Arabic (e.g. '/privacy'); null for pages without a URL of their own (the 404 page). */
  path: string | null
  /** The language switch in the header; false hides it. */
  langSwitch?: boolean
  /** The page's own stylesheets and scripts, after the shared ones (markup, already escaped). */
  head?: string
  body: string
}
/** The document around a page's content: head, header with the logo and language switch, footer. */
export function shell(p: Shell): string {
  const t = T[p.lang], other: Lang = p.lang === 'ar' ? 'en' : 'ar'
  const url = (lang: Lang) => (p.path ? `${p.origin}${langPath(p.path, lang)}` : '')
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(p.title)}</title>`,
    `<meta name="description" content="${escapeHtml(p.description)}">`,
    '<meta name="theme-color" content="#0E8F86">',
    '<meta name="color-scheme" content="light">',
    // device numbers and keys are not phone numbers (iOS would make links of them)
    '<meta name="format-detection" content="telephone=no">',
    p.path ? `<link rel="canonical" href="${url(p.lang)}">` : '<meta name="robots" content="noindex">',
    p.path ? `<link rel="alternate" hreflang="ar" href="${url('ar')}"><link rel="alternate" hreflang="en" href="${url('en')}"><link rel="alternate" hreflang="x-default" href="${url('ar')}">` : '',
    p.assets.favicon ? '<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">' : '',
    p.assets.manifest ? '<link rel="manifest" href="/site.webmanifest">' : '',
    p.lang === 'ar' ? '<link rel="preload" href="/fonts/noto-kufi-arabic-wght.woff2" as="font" type="font/woff2" crossorigin>' : '',
    '<link rel="preload" href="/fonts/inter-latin-wght.woff2" as="font" type="font/woff2" crossorigin>',
    p.assets.siteCss ? '<link rel="stylesheet" href="/css/site.css">' : '',
    '<link rel="stylesheet" href="/css/legal.css">',
    p.head ?? '',
  ].filter(Boolean).join('\n')
  const home = langPath('/', p.lang)
  const switcher = p.langSwitch !== false && p.path
    ? `<a class="lang-link legal-lang" href="${langPath(p.path, other)}" hreflang="${other}" lang="${other}" title="${escapeHtml(t.otherLangName)}">${LANGUAGES_ICON}<span>${t.otherLang}</span></a>`
    : ''
  // The landing page's logo file when published (cached already), else the same mark inline.
  const logo = p.assets.favicon ? '<img class="legal-logo" src="/favicon.svg" width="36" height="36" alt="">' : LOGO_SVG
  const year = new Date().getUTCFullYear()
  // Each piece carries site.css's class (the landing page's header and footer) and legal.css's own, which only
  // styles it when site.css is missing (see legal.css).
  return `<!doctype html>
<html lang="${p.lang}" dir="${p.lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
${head}
</head>
<body class="legal-page">
<a class="skip-link legal-skip" href="#main">${t.skip}</a>
<header class="site-header legal-top"><div class="container header-inner legal-wrap legal-top-in">
<a class="brand legal-brand" href="${home}" aria-label="Dentora — ${escapeHtml(t.home)}">${logo}<span>Dentora</span></a>
<div class="header-actions legal-actions">${switcher}</div>
</div></header>
${p.body}
<footer class="site-footer legal-foot"><div class="container footer-bottom legal-wrap legal-foot-in">
<p>© ${year} Dentora. ${t.rights}.</p>
<nav aria-label="${escapeHtml(t.docs)}"><a href="${home}">${t.home}</a><a href="${langPath('/activate', p.lang)}">${t.activate}</a><a href="${langPath('/privacy', p.lang)}">${escapeHtml(docTitle('privacy', p.lang))}</a><a href="${langPath('/terms', p.lang)}">${escapeHtml(docTitle('terms', p.lang))}</a></nav>
</div></footer>
</body>
</html>
`
}

/** The whole page of a legal document. */
export function renderLegal(doc: LegalDoc, lang: Lang, s: SiteSettings, origin: string, assets: PageAssets): string {
  const t = T[lang]
  const { html, toc } = renderDoc(doc, lang, s)
  const title = docTitle(doc, lang)
  const updated = legalStrings[lang].updated.replace('{date}', legalDate(lang))
  const tocList = `<ol>${toc.map(h => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('')}</ol>`
  const tabs = (['privacy', 'terms'] as LegalDoc[]).map(d =>
    `<a href="${langPath(DOC_PATH[d], lang)}"${d === doc ? ' aria-current="page"' : ''}>${escapeHtml(docTitle(d, lang))}</a>`).join('')
  const body = `<main id="main" class="legal-main">
<div class="legal-hero"><div class="container legal-wrap">
<p class="legal-kicker">${t.kicker}</p>
<h1>${escapeHtml(title)}</h1>
<p class="legal-date">${escapeHtml(updated)}</p>
<nav class="legal-tabs" aria-label="${escapeHtml(t.docs)}">${tabs}</nav>
</div></div>
<div class="container legal-wrap legal-grid">
<aside class="legal-aside"><nav class="legal-toc" aria-label="${escapeHtml(t.toc)}"><p class="legal-toc-title">${t.toc}</p>${tocList}</nav></aside>
<article class="legal-doc">
<details class="legal-toc-m"><summary>${t.toc}</summary><nav aria-label="${escapeHtml(t.toc)}">${tocList}</nav></details>
${html}
</article>
</div>
</main>`
  return shell({ lang, title: `${title} — Dentora`, description: t.desc[doc], origin, assets, path: DOC_PATH[doc], body })
}
