// The user guide's pages (render.ts) and the topic list (index.ts). vitest.config.ts only looks in test/, so run it
// from dental/ without that config (vitest's default include, scanning server/guide):
//   npx vitest run --root server --dir server/guide -c /dev/null
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type SiteSettings } from '../src/types'
import { TOPICS, topicBySlug } from './index'
import {
  countText, guideProblems, imageOf, inlineMarkup, linkTargets, plainText,
  renderGuideHome, renderGuideTopic, type GuideImages,
} from './render'
import type { GuideTopic } from './types'

const assets = { siteCss: true, favicon: true, manifest: true }
const ORIGIN = 'https://dentora.raqeem.dev'
const EVIL = '<script>alert("x")</script> & \'quotes\' "too"'

/** A small guide: two topics, every kind of block, hostile text, one picture missing. */
const patients: GuideTopic = {
  slug: 'patients', order: 4, icon: 'users',
  title: { ar: `المرضى ${EVIL}`, en: `Patients ${EVIL}` },
  summary: { ar: 'ملفات المرضى وتاريخهم الطبي.', en: 'Patient files and their medical history.' },
  blocks: [
    {
      id: 'list', title: { ar: 'القائمة', en: 'The list' },
      text: {
        ar: [`نص ${EVIL}`, '**الاسم**: كما كتبته.', '**الهاتف**: للاتصال.', 'انظر [الفواتير](billing#pay) و[الترخيص](licence).'],
        en: [`Text ${EVIL}`, '**Name**: as typed.', '**Phone**: to call.', 'See [Invoices](billing#pay) and [Licence](licence).'],
      },
      shots: ['patients-list'],
    },
    {
      id: 'add', title: { ar: 'إضافة مريض', en: 'Adding a patient' },
      steps: { ar: ['اضغط **مريض جديد** أو `Ctrl+Shift+N`.', 'اضغط **حفظ**.'], en: ['Click **New patient** or press `Ctrl+Shift+N`.', 'Click **Save**.'] },
      tips: { ar: ['اضغط `Esc` للإلغاء.'], en: ['Press `Esc` to cancel.'] },
      shots: ['patients-new', 'patients-phone', 'patients-missing'],
    },
  ],
  shots: [
    { id: 'patients-list', device: 'desktop', alt: { ar: `القائمة ${EVIL}`, en: `The list ${EVIL}` }, caption: { ar: 'اضغط **المرضى**.', en: 'Click **Patients**.' }, recipe: '' },
    { id: 'patients-new', device: 'desktop', alt: { ar: 'النموذج', en: 'The form' }, recipe: '' },
    { id: 'patients-phone', device: 'phone', alt: { ar: 'على الهاتف', en: 'On a phone' }, recipe: '' },
    { id: 'patients-missing', device: 'desktop', alt: { ar: 'صورة لم تُصوَّر', en: 'A picture not made yet' }, recipe: '' },
  ],
}
const billing: GuideTopic = {
  slug: 'billing', order: 8, icon: 'receipt',
  title: { ar: 'الفواتير', en: 'Invoices' },
  summary: { ar: 'الفواتير والدفعات.', en: 'Invoices and payments.' },
  blocks: [{ id: 'pay', title: { ar: 'دفعة', en: 'A payment' }, text: { ar: ['نص.'], en: ['Text.'] } }],
  shots: [],
}
const topics = [billing, patients]   // out of order on purpose: the pages sort by `order`
const images: GuideImages = {
  'ar/patients-list': { widths: [1600, 900], width: 1600, height: 1000, cssWidth: 1440 },
  'en/patients-list': { widths: [900, 1600], width: 1600, height: 1000, cssWidth: 1440 },
  'ar/patients-new': { widths: [1200, 900], width: 1200, height: 1500, cssWidth: 600 },
  'en/patients-new': { widths: [1200, 900], width: 1200, height: 1500, cssWidth: 600 },
  'ar/patients-phone': { widths: [780, 390], width: 780, height: 1688, cssWidth: 390 },
  'en/patients-phone': { widths: [780, 390], width: 780, height: 1688, cssWidth: 390 },
}
const page = (lang: 'ar' | 'en', s: SiteSettings = DEFAULT_SETTINGS) => renderGuideTopic(lang, s, ORIGIN, assets, patients, topics, images)
const home = (lang: 'ar' | 'en') => renderGuideHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, topics)
const ld = (html: string) => {
  const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)
  if (!m) throw new Error('no JSON-LD')
  return JSON.parse(m[1]) as { '@graph': Record<string, unknown>[] }
}
const imgTag = (html: string, id: string) => new RegExp(`<img src="/img/guide/[a-z]+/${id}-\\d+\\.webp"[^>]*>`).exec(html)?.[0] ?? ''
const INLINE = /\sstyle=|<style|\son[a-z]+=/i
const ALLOWED_SCRIPT = /^<script (type="application\/ld\+json"|src="\/js\/guide\.js" defer)>$/

describe('escaping', () => {
  it('never lets a topic string become markup, in text, titles, attributes or the structured data', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const html of [page(lang), home(lang)]) {
        expect(html).not.toContain('<script>alert')
        expect(html).not.toContain('"too"')
        expect(INLINE.test(html)).toBe(false)
        for (const tag of html.match(/<script\b[^>]*>/g) ?? []) expect(tag).toMatch(ALLOWED_SCRIPT)
        // the JSON-LD cannot be closed early
        expect(html.match(/<\/script>/g)?.length).toBe(html.match(/<script\b/g)?.length)
      }
      const html = page(lang)
      expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39; &quot;too&quot;')
      expect(imgTag(html, 'patients-list')).toContain('alt="')
      expect(imgTag(html, 'patients-list')).toContain('&lt;script&gt;')
      expect(ld(html)['@graph'][0].headline).toContain('<script>alert("x")</script>')
    }
  })
})

describe('text markup', () => {
  const targets = linkTargets(topics)
  it('turns **label**, `key` and [text](slug#block) into markup after escaping everything else', () => {
    expect(inlineMarkup('Click **Save** <b>now</b>', 'en')).toBe('Click <strong>Save</strong> &lt;b&gt;now&lt;/b&gt;')
    expect(inlineMarkup('Press `Esc`', 'en')).toBe('Press <kbd dir="ltr">Esc</kbd>')
    expect(inlineMarkup('`Ctrl+K`', 'en')).toBe('<kbd class="gd-keys" dir="ltr"><kbd>Ctrl</kbd><span>+</span><kbd>K</kbd></kbd>')
    expect(inlineMarkup('`+` and `-`', 'en')).toBe('<kbd dir="ltr">+</kbd> and <kbd dir="ltr">-</kbd>')
    expect(inlineMarkup('`<b>`', 'en')).toBe('<kbd dir="ltr">&lt;b&gt;</kbd>')
    expect(inlineMarkup('**a "b"**', 'en')).toBe('<strong>a &quot;b&quot;</strong>')
    expect(inlineMarkup('**see [Invoices](billing)**', 'en', targets)).toBe('<strong>see <a href="/en/guide/billing">Invoices</a></strong>')
    expect(inlineMarkup('[**Invoices**](billing#pay)', 'ar', targets)).toBe('<a href="/guide/billing#pay"><strong>Invoices</strong></a>')
    expect(inlineMarkup('2 * 3 and a lone ** star', 'en')).toBe('2 * 3 and a lone ** star')
  })
  it('links in the page’s language, to topics and blocks that exist only', () => {
    expect(inlineMarkup('[x](billing#pay)', 'ar', targets)).toBe('<a href="/guide/billing#pay">x</a>')
    expect(inlineMarkup('[x](billing#pay)', 'en', targets)).toBe('<a href="/en/guide/billing#pay">x</a>')
    expect(inlineMarkup('[x](billing)', 'en', targets)).toBe('<a href="/en/guide/billing">x</a>')
    // a block the topic does not have: the top of the topic
    expect(inlineMarkup('[x](billing#nope)', 'en', targets)).toBe('<a href="/en/guide/billing">x</a>')
    // a topic not in the list (here the fixture has no licence topic): plain text
    expect(inlineMarkup('[Licence](licence)', 'en', targets)).toBe('<span class="gd-xref">Licence</span>')
    // the page's own topic: its anchor alone
    expect(inlineMarkup('[x](patients#add)', 'en', targets, 'patients')).toBe('<a href="#add">x</a>')
    expect(inlineMarkup('[x](#add)', 'en', targets, 'patients')).toBe('<a href="#add">x</a>')
    // anything that is not slug#block is never a link
    expect(inlineMarkup('[x](javascript:alert(1))', 'en', targets)).not.toContain('href')
    expect(inlineMarkup('[x](https://evil.example)', 'en', targets)).toBe('x')
    expect(inlineMarkup('[x](BILLING)', 'en', targets)).toBe('x')
  })
  it('gives plain text for titles and the structured data', () => {
    expect(plainText('Click **Save** or `Esc`, see [Invoices](billing#pay)')).toBe('Click Save or Esc, see Invoices')
  })
})

describe('pictures', () => {
  it('uses the manifest: srcset of every width, width/height (shown no wider than the capture), lazy after the first', () => {
    const html = page('en')
    const list = imgTag(html, 'patients-list')
    expect(list).toContain('srcset="/img/guide/en/patients-list-1600.webp 1600w, /img/guide/en/patients-list-900.webp 900w"')
    expect(list).toContain('width="1440" height="900"')
    expect(list).toContain('sizes="')
    expect(list).not.toContain('loading=')
    const crop = imgTag(html, 'patients-new')
    expect(crop).toContain('width="600" height="750"')
    expect(crop).toContain('loading="lazy"')
    const phone = imgTag(html, 'patients-phone')
    expect(phone).toContain('width="780" height="1688"')
    expect(html).toContain('class="gd-fig gd-fig-phone gd-fig-screen"')
    // the large file opens without the script
    expect(html).toContain('<a class="gd-zoom" href="/img/guide/en/patients-list-1600.webp" data-w="1600" data-h="1000">')
    expect(html).toMatch(/<figure class="gd-fig gd-fig-desktop" id="shot-patients-list">[\s\S]*?<picture><img[\s\S]*?<figcaption>Click <strong>Patients<\/strong>\.<\/figcaption>/)
  })
  it('shows a neutral placeholder with the alt text for a picture not made yet', () => {
    const html = page('ar')
    expect(html).toContain('<div class="gd-ph gd-ph-desktop" role="img" aria-label="صورة لم تُصوَّر">')
    expect(html).toContain('<span class="gd-ph-alt">صورة لم تُصوَّر</span>')
    expect(html).not.toContain('patients-missing-')
    // the same with no manifest at all
    const bare = renderGuideTopic('en', DEFAULT_SETTINGS, ORIGIN, assets, patients, topics, null)
    expect(bare.match(/class="gd-ph /g)?.length).toBe(4)
    expect(bare).not.toContain('<img src="/img/guide')
  })
  it('reads only sound manifest entries', () => {
    expect(imageOf(images, 'ar', 'patients-list')?.widths).toEqual([1600, 900])
    expect(imageOf(images, 'en', 'patients-list')?.widths).toEqual([1600, 900])
    expect(imageOf(images, 'ar', 'nope')).toBeUndefined()
    expect(imageOf({ 'ar/x': { widths: [], width: 10, height: 10 } }, 'ar', 'x')).toBeUndefined()
    expect(imageOf({ 'ar/x': { widths: [100], width: -1, height: 10 } }, 'ar', 'x')).toBeUndefined()
    expect(imageOf({ 'ar/../x': { widths: [100], width: 10, height: 10 } }, 'ar', '../x')).toBeUndefined()
  })
})

describe('addresses, head and structured data', () => {
  it('canonical and hreflang ar/en/x-default, per language', () => {
    for (const [lang, html, ar, en] of [
      ['ar', home('ar'), `${ORIGIN}/guide`, `${ORIGIN}/en/guide`],
      ['en', home('en'), `${ORIGIN}/guide`, `${ORIGIN}/en/guide`],
      ['ar', page('ar'), `${ORIGIN}/guide/patients`, `${ORIGIN}/en/guide/patients`],
      ['en', page('en'), `${ORIGIN}/guide/patients`, `${ORIGIN}/en/guide/patients`],
    ] as const) {
      expect(html).toContain(`<link rel="canonical" href="${lang === 'ar' ? ar : en}">`)
      expect(html).toContain(`<link rel="alternate" hreflang="ar" href="${ar}">`)
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${en}">`)
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${en}">`)
      expect(html).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(html).toContain(`<meta property="og:url" content="${lang === 'ar' ? ar : en}">`)
      expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/img/og-${lang}.jpg">`)
      expect(html).toContain('<link rel="stylesheet" href="/css/guide.css">')
    }
  })
  it('renders with an empty origin too (relative addresses)', () => {
    expect(renderGuideTopic('en', DEFAULT_SETTINGS, '', assets, patients, topics, images)).toContain('<meta property="og:url" content="/en/guide/patients">')
    expect(renderGuideHome('ar', DEFAULT_SETTINGS, 'https://x.example/', assets, topics)).toContain('<link rel="canonical" href="https://x.example/guide">')
  })
  it('title and meta description from the topic, TechArticle and BreadcrumbList', () => {
    const html = page('en')
    expect(html).toContain('<meta name="description" content="Patient files and their medical history.">')
    expect(html).toMatch(/<title>Patients &lt;script&gt;.*— Dentora user guide<\/title>/)
    const g = ld(html)['@graph']
    expect(g[0]['@type']).toBe('TechArticle')
    expect(g[0].url).toBe(`${ORIGIN}/en/guide/patients`)
    expect(g[0].inLanguage).toBe('en')
    expect(g[0].image).toBe(`${ORIGIN}/img/guide/en/patients-list-1600.webp`)
    expect(g[0].articleSection).toEqual(['The list', 'Adding a patient'])
    expect(g[1]['@type']).toBe('BreadcrumbList')
    expect((g[1].itemListElement as { item: string }[]).map(i => i.item)).toEqual([`${ORIGIN}/en`, `${ORIGIN}/en/guide`, `${ORIGIN}/en/guide/patients`])
    const h = ld(home('ar'))['@graph']
    expect(h[0]['@type']).toBe('CollectionPage')
    expect((h[1].itemListElement as { item: string }[]).map(i => i.item)).toEqual([`${ORIGIN}/`, `${ORIGIN}/guide`])
  })
})

describe('the pages', () => {
  it('home: the cards in order (topics may be missing), the search box for the script only', () => {
    const html = home('ar')
    const slugs = [...html.matchAll(/<li class="gd-card" data-slug="([a-z-]+)">/g)].map(m => m[1])
    expect(slugs).toEqual(['patients', 'billing'])
    expect(html).toContain('<a href="/guide/patients">')
    expect(html).toMatch(/<form class="gd-search" role="search" action="\/guide" hidden data-js>/)
    expect(home('en')).toContain('<a href="/en/guide/billing">Invoices</a>')
    expect(html).toContain('<a href="/guide/patients#add">إضافة مريض</a>')
  })
  it('topic: breadcrumb, table of contents, steps, tips, the topics list, previous/next, WhatsApp', () => {
    const html = page('en')
    expect(html).toContain('<nav class="gd-crumbs" aria-label="Breadcrumb"><ol><li><a href="/en">Home</a></li><li><a href="/en/guide">User guide</a></li><li aria-current="page">')
    expect(html.match(/<ol class="gd-toc-list"><li><a href="#list">The list<\/a><\/li><li><a href="#add">Adding a patient<\/a><\/li><\/ol>/g)?.length).toBe(2)
    expect(html).toContain('<section class="gd-block" id="add" aria-labelledby="add-h">')
    expect(html).toContain('<ol class="gd-steps" aria-label="Steps"><li>Click <strong>New patient</strong> or press <kbd class="gd-keys" dir="ltr">')
    expect(html).toContain('<ul class="gd-defs"><li><strong>Name</strong>: as typed.</li><li><strong>Phone</strong>: to call.</li></ul>')
    expect(html).toContain('<aside class="gd-tip" aria-label="Good to know">')
    expect(html).toContain('<a href="/en/guide/patients" aria-current="page">')
    expect(html).toContain('<a class="gd-pager-next" href="/en/guide/billing" rel="next">')
    expect(html).not.toContain('gd-pager-prev')
    expect(html).toContain(`href="https://wa.me/963996489504?text=${encodeURIComponent('Hello, I have a question about Dentora: “Patients <script>alert("x")</script> & \'quotes\' "too"” in the user guide.').replace(/'/g, '&#39;')}"`)
    // a seller number that is not a number falls back to the default one
    expect(page('ar', { ...DEFAULT_SETTINGS, whatsapp: 'abc' })).toContain('https://wa.me/963996489504?text=')
    expect(page('ar', { ...DEFAULT_SETTINGS, whatsapp: '+44 7700 900123' })).toContain('https://wa.me/447700900123?text=')
  })
  it('refuses a topic whose slug could not be a URL', () => {
    expect(() => renderGuideTopic('ar', DEFAULT_SETTINGS, ORIGIN, assets, { ...billing, slug: 'x" onload="y' }, topics)).toThrow(/bad topic slug/)
  })
  it('counts in Arabic and English', () => {
    const f = ['قسم واحد', 'قسمان', 'أقسام', 'قسماً']
    expect([1, 2, 3, 10, 11, 16].map(n => countText(n, 'ar', f))).toEqual(['قسم واحد', 'قسمان', '3 أقسام', '10 أقسام', '11 قسماً', '16 قسماً'])
    expect([1, 4].map(n => countText(n, 'en', ['1 section', '', '', '{n} sections']))).toEqual(['1 section', '4 sections'])
  })
  it('finds what is wrong in the data', () => {
    const p = guideProblems(topics, images)
    expect(p.some(x => x.includes('patients-missing') && x.includes('no ar picture'))).toBe(true)
    // every planned topic is written now (PLANNED_TOPICS is empty): a link to a topic not in the list is reported
    expect(p.some(x => x.includes('[الترخيص](licence)') && x.includes('does not exist'))).toBe(true)
    const bad: GuideTopic = { ...billing, slug: 'bad', order: 8, icon: 'nope', blocks: [{ id: 'main', title: { ar: 'أ', en: 'a' }, text: { ar: ['[x](nowhere)', 'b'], en: ['a'] } }] }
    const q = guideProblems([billing, bad])
    for (const s of ["order 8 is also billing's", "unknown icon 'nope'", 'one the page uses itself', 'text has 2 Arabic and 1 English', 'goes to a topic that does not exist']) {
      expect(q.some(x => x.includes(s)), s).toBe(true)
    }
  })
})

describe('the guide’s own topics (index.ts)', () => {
  it('are sorted, unique, and every page renders in both languages', () => {
    expect(TOPICS.length).toBeGreaterThan(0)
    expect(new Set(TOPICS.map(t => t.slug)).size).toBe(TOPICS.length)
    expect(TOPICS.map(t => t.order)).toEqual([...TOPICS.map(t => t.order)].sort((a, b) => a - b))
    expect(topicBySlug(TOPICS[0].slug)).toBe(TOPICS[0])
    expect(topicBySlug('nope')).toBeUndefined()
    for (const lang of ['ar', 'en'] as const) {
      expect(renderGuideHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, TOPICS).match(/class="gd-card"/g)?.length).toBe(TOPICS.length)
      for (const t of TOPICS) {
        const html = renderGuideTopic(lang, DEFAULT_SETTINGS, ORIGIN, assets, t, TOPICS, null)
        expect(INLINE.test(html), t.slug).toBe(false)
        expect(html.match(/<section class="gd-block"/g)?.length ?? 0, t.slug).toBe(t.blocks.length)
      }
    }
    const problems = guideProblems(TOPICS)
    if (problems.length) console.warn(`guideProblems (${problems.length}):\n  ${problems.join('\n  ')}`)
  })
})
