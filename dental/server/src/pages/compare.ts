// /compare and /en/compare (later /<lang>/compare): "Best offline dental clinic software: comparison". It compares
// three ways of running a dental clinic's software (an offline app on the device, a cloud subscription, a desktop
// system on the clinic's own server), with the vendors' own pages as sources, then a checklist, who Dentora is and
// is not for, and an FAQ. The words are in compare-content.ts; the page reuses the home page's header, footer and
// styles (landing.ts, landing.css) plus compare.css. Structured data: WebPage + Article + BreadcrumbList + FAQPage,
// pointing to the Organization, WebSite and SoftwareApplication of the home page by their @ids.
import { HREFLANG, sitePath, type SiteLang } from '../site-lang'
import type { LandingContext, SiteSettings } from '../types'
import { COMPARE, COMPARE_DATE, type CompareCopy } from './compare-content'
import {
  announcement, APP_ID, escapeHtml, fillHtml, fillText, finalCta, footer, header, homeAnchor, icon, iconSprite, makeView,
  ORG_ID, organization, pageHead, resetIcons, SITE_ID, softwareApplication, website, type View,
} from './landing'

export const COMPARE_PATH = '/compare'

/** "18 October 2026" in the page's language (Western digits, like the rest of the site). */
function dateText(iso: string, lang: SiteLang): string {
  const d = new Date(`${iso}T12:00:00Z`)
  try {
    return new Intl.DateTimeFormat(`${HREFLANG[lang]}-u-nu-latn`, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  } catch {
    return iso
  }
}

const fill = (v: View, s: string) => fillText(s, { price: v.priceInline })
/** A template (plain text with {price}) as HTML: fillHtml escapes it. */
const fillH = (v: View, s: string) => fillHtml(s, { price: escapeHtml(v.priceInline) })

function crumbs(v: View, c: CompareCopy): string {
  return `<nav class="cmp-crumbs" aria-label="${escapeHtml(c.crumbs.label)}"><ol><li><a href="${sitePath('/', v.lang)}">${escapeHtml(c.crumbs.home)}</a></li><li aria-current="page">${escapeHtml(c.crumbs.here)}</li></ol></nav>`
}

function intro(v: View, c: CompareCopy): string {
  return `<section class="cmp-hero" aria-labelledby="cmp-title">
<div class="container cmp-hero-inner">
${crumbs(v, c)}
<p class="eyebrow">${escapeHtml(c.eyebrow)}</p>
<h1 id="cmp-title">${escapeHtml(c.meta.h1)}</h1>
<div class="cmp-answer">${c.intro.map(p => `<p>${fillH(v, p)}</p>`).join('')}</div>
<p class="cmp-reviewed">${icon('calendarCheck')}<span>${fillHtml(c.reviewedLabel, { date: `<time datetime="${COMPARE_DATE}">${escapeHtml(dateText(COMPARE_DATE, v.lang))}</time>` })}</span></p>
</div>
</section>`
}

/** The table: one row per approach, one column per question; on a phone each row becomes a card (data-label). */
function table(v: View, c: CompareCopy): string {
  const rows = c.approaches.map(a => {
    const examples = a.examples.length
      ? `<p class="cmp-examples"><span>${escapeHtml(c.examplesLabel)}</span> ${a.examples.map(e => `<a href="${escapeHtml(e.url)}" rel="noopener external" target="_blank">${escapeHtml(e.name)}</a>`).join(c.listSep)}</p>`
      : ''
    return `<tr${a.key === 'offline' ? ' class="cmp-ours"' : ''}>
<th scope="row"><span class="cmp-name">${escapeHtml(a.name)}</span>${examples}</th>
${a.cells.map((cell, i) => `<td data-label="${escapeHtml(c.columns[i])}">${fillH(v, cell)}</td>`).join('\n')}
</tr>`
  }).join('\n')
  return `<section class="section cmp-table-section" id="table" aria-labelledby="cmp-table-title">
<div class="container">
<div class="section-head">
<h2 id="cmp-table-title">${escapeHtml(c.tableTitle)}</h2>
<p class="lead">${escapeHtml(c.tableLead)}</p>
</div>
<div class="cmp-table-wrap">
<table class="cmp-table">
<caption class="sr-only">${escapeHtml(c.tableTitle)}</caption>
<thead><tr><th scope="col">${escapeHtml(c.approachCol)}</th>${c.columns.map(col => `<th scope="col">${escapeHtml(col)}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>
${c.approaches.map(a => `<div class="cmp-approach" id="approach-${a.key}"><h3>${escapeHtml(a.name)}</h3><p>${fillH(v, a.summary)}</p></div>`).join('\n')}
<p class="cmp-note">${icon('info')}<span>${escapeHtml(c.tableNote)}</span></p>
</div>
</section>`
}

function choose(c: CompareCopy): string {
  return `<section class="section cmp-choose" id="choose" aria-labelledby="cmp-choose-title">
<div class="container cmp-narrow">
<h2 id="cmp-choose-title">${escapeHtml(c.choose.title)}</h2>
<p class="lead">${escapeHtml(c.choose.lead)}</p>
<ol class="cmp-checklist">${c.choose.items.map(x => `<li><span class="check-dot">${icon('check')}</span><span>${escapeHtml(x)}</span></li>`).join('')}</ol>
</div>
</section>`
}

function fit(v: View, c: CompareCopy): string {
  const list = (items: string[], ic: 'check' | 'x') => `<ul>${items.map(x => `<li>${icon(ic)}<span>${fillH(v, x)}</span></li>`).join('')}</ul>`
  return `<section class="section cmp-fit" id="fit" aria-labelledby="cmp-fit-title">
<div class="container">
<div class="section-head"><h2 id="cmp-fit-title">${escapeHtml(c.fit.title)}</h2></div>
<div class="cmp-fit-grid">
<div class="cmp-fit-card cmp-fit-yes"><h3>${escapeHtml(c.fit.forTitle)}</h3>${list(c.fit.for, 'check')}</div>
<div class="cmp-fit-card cmp-fit-no"><h3>${escapeHtml(c.fit.notTitle)}</h3>${list(c.fit.not, 'x')}</div>
</div>
</div>
</section>`
}

function faq(v: View, c: CompareCopy): string {
  return `<section class="section faq cmp-faq" id="faq" aria-labelledby="cmp-faq-title">
<div class="container cmp-narrow">
<h2 id="cmp-faq-title">${escapeHtml(c.faqTitle)}</h2>
<div class="faq-list">
${c.faq.map((item, i) => `<details class="qa"${i === 0 ? ' open' : ''}><summary><span>${escapeHtml(item.q)}</span>${icon('chevronDown')}</summary><div class="qa-a"><p>${fillH(v, item.a)}</p></div></details>`).join('\n')}
</div>
</div>
</section>`
}

function sources(c: CompareCopy): string {
  return `<section class="section cmp-sources" id="sources" aria-labelledby="cmp-sources-title">
<div class="container cmp-narrow">
<h2 id="cmp-sources-title">${escapeHtml(c.sources.title)}</h2>
<p>${escapeHtml(c.sources.lead)}</p>
<ol class="cmp-source-list">${c.sources.items.map(x => `<li><a href="${escapeHtml(x.url)}" rel="noopener external" target="_blank">${escapeHtml(x.label)}</a><span class="cmp-source-url" dir="ltr">${escapeHtml(x.url.replace(/^https?:\/\//, ''))}</span></li>`).join('')}</ol>
</div>
</section>`
}

function structuredData(v: View, c: CompareCopy) {
  const url = `${v.origin}${sitePath(COMPARE_PATH, v.lang)}`
  const home = `${v.origin}${sitePath('/', v.lang)}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      website(),
      softwareApplication(v),
      {
        '@type': 'WebPage', '@id': url, url, name: c.meta.title, description: c.meta.description,
        inLanguage: HREFLANG[v.lang], isPartOf: { '@id': SITE_ID }, about: { '@id': APP_ID },
        breadcrumb: { '@id': `${url}#breadcrumb` }, mainEntity: { '@id': `${url}#article` },
        datePublished: COMPARE_DATE, dateModified: COMPARE_DATE, lastReviewed: COMPARE_DATE,
        primaryImageOfPage: `${v.origin}/img/og-${v.lang === 'ar' ? 'ar' : 'en'}.jpg`,
      },
      {
        '@type': 'Article', '@id': `${url}#article`, headline: c.meta.h1, description: c.meta.description,
        inLanguage: HREFLANG[v.lang], url, mainEntityOfPage: { '@id': url },
        datePublished: COMPARE_DATE, dateModified: COMPARE_DATE,
        author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
        about: [{ '@id': APP_ID }, { '@type': 'Thing', name: c.topic }],
        image: `${v.origin}/img/og-${v.lang === 'ar' ? 'ar' : 'en'}.jpg`,
        citation: c.sources.items.map(x => ({ '@type': 'CreativeWork', name: x.label, url: x.url })),
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: c.crumbs.home, item: home },
          { '@type': 'ListItem', position: 2, name: c.crumbs.here, item: url },
        ],
      },
      {
        '@type': 'FAQPage', '@id': `${url}#faq`, url: `${url}#faq`, inLanguage: HREFLANG[v.lang], isPartOf: { '@id': url },
        mainEntity: c.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: fill(v, f.a) } })),
      },
    ],
  }
}

export function renderCompare(lang: SiteLang, s: SiteSettings, ctx: LandingContext): string {
  const c = COMPARE[lang]
  if (!c) throw new Error(`no comparison page in ${lang}`)
  const v = makeView(lang, s, ctx, COMPARE_PATH)
  resetIcons()
  const head = pageHead(v, {
    title: c.meta.title, description: c.meta.description, ogType: 'article',
    css: ['/css/landing.css', '/css/compare.css'], script: '/js/landing.js', ld: structuredData(v, c),
  })
  const body = `<a class="skip-link" href="#main">${escapeHtml(v.t.skip)}</a>
${announcement(v)}${header(v)}
<main id="main" class="cmp">
${intro(v, c)}
${table(v, c)}
${choose(c)}
${fit(v, c)}
${faq(v, c)}
${sources(c)}
${finalCta(v)}
</main>
${footer(v)}`
  return `<!doctype html>
<html lang="${HREFLANG[lang]}" dir="${lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr'}">
${head}
<body>
${iconSprite()}
${body}
</body>
</html>
`
}

/** For the home page's links ("full comparison") and the sitemap. */
export const comparePath = (lang: SiteLang) => sitePath(COMPARE_PATH, lang)
export { homeAnchor }
