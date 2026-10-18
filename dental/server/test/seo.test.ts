// What search engines and AI assistants read: the home page's words and structured data, the comparison page,
// /llms.txt and /llms-full.txt, and the sitemap (dates, language clusters, pictures and videos). Through the Worker,
// with the real renderers.
import { describe, expect, it, vi } from 'vitest'
import { TOPICS } from '../guide/index'
import { CACHE_PAGE, PUBLIC_CSP } from '../src/http'
import { COMPARE } from '../src/pages/compare-content'
import { COPY } from '../src/pages/content'
import { SITE_LANGS } from '../src/site-lang'
import type { Env } from '../src/types'
import { CHAPTERS } from '../videos/index'
import { memoryD1 } from './d1'

const ORIGIN = 'https://dentora.raqeem.dev'
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext

async function workerWith(files: Record<string, object>) {
  vi.resetModules()
  const { default: worker } = await import('../src/index')
  const fetcher = {
    async fetch(req: Request) {
      const path = new URL(req.url).pathname
      return path in files ? Response.json(files[path]) : new Response('', { status: 404 })
    },
  } as unknown as Fetcher
  const env: Env = { DB: memoryD1(), ASSETS: fetcher }
  return (path: string) => worker.fetch(new Request(ORIGIN + path) as Parameters<typeof worker.fetch>[0], env, ctx)
}

const SHA = 'abcdef0123456789'.repeat(4)
const rec = (recordedAt: string) => ({ durationSeconds: 125.4, sizeBytes: 1000, width: 1920, height: 1080, sha256: SHA, recordedAt, scenes: [] })
const PUBLISHED = {
  '/files/manifest.json': { files: ['/files/manifest.json', '/videos/manifest.json', '/img/guide/manifest.json'] },
  '/videos/manifest.json': { 'ar/patients': rec('2026-10-16T08:00:00Z'), 'ar/chart': rec('2026-10-14T08:00:00Z') },
  '/img/guide/manifest.json': { [`ar/${TOPICS[0].shots[0].id}`]: { widths: [1600, 900], width: 1600, height: 900 } },
}

const graphOf = (html: string) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(m).not.toBeNull()
  return JSON.parse(m![1])['@graph'] as Record<string, unknown>[]
}
const types = (graph: Record<string, unknown>[]) => graph.map(n => n['@type'])
/** Text of an element's HTML, without tags and entities, as a reader sees it. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/[⁦-⁩]/g, '')

describe('the home page', () => {
  it('says "بدون إنترنت" in the Arabic title, description and hero, and keeps descriptions within 155 characters', async () => {
    for (const lang of ['ar', 'en'] as const) expect(COPY[lang].meta.description.length).toBeLessThanOrEqual(155)
    expect(COPY.ar.meta.title).toContain('بدون إنترنت')
    expect(COPY.ar.meta.description).toContain('بدون إنترنت')
    expect(COPY.ar.hero.badge).toContain('بدون إنترنت')
    expect(COPY.en.hero.badge).toContain('offline')
    const page = await (await (await workerWith({}))('/')).text()
    expect(page).toContain('<section class="summary" id="about"')
    expect(page).toContain(`<title>${COPY.ar.meta.title}</title>`)
  })
  it('describes the maker, the site and the app, with an FAQ that matches the visible answers, and no rating', async () => {
    const get = await workerWith({})
    for (const [path, lang] of [['/', 'ar'], ['/en', 'en']] as const) {
      const r = await get(path)
      expect([r.status, r.headers.get('Content-Language'), r.headers.get('Content-Security-Policy')]).toEqual([200, lang, PUBLIC_CSP])
      const html = await r.text()
      expect(html).not.toMatch(/AggregateRating|aggregateRating|reviewCount|ratingValue/)
      const graph = graphOf(html)
      expect(types(graph)).toEqual(['Organization', 'WebSite', 'WebPage', 'SoftwareApplication', 'FAQPage'])
      const org = graph[0], site = graph[1], app = graph[3]
      expect(org).toMatchObject({ '@id': `${ORIGIN}/#organization`, name: 'Raqeem', url: 'https://raqeem.dev' })
      expect(site).toMatchObject({ '@id': `${ORIGIN}/#website`, name: 'Dentora', publisher: { '@id': `${ORIGIN}/#organization` } })
      expect(app).toMatchObject({
        '@id': `${ORIGIN}/#software`, operatingSystem: 'Windows 10, Windows 11, Android 7.0 or later', inLanguage: ['ar', 'en'],
        offers: { '@type': 'Offer', price: '59', priceCurrency: 'USD' }, publisher: { '@id': `${ORIGIN}/#organization` },
      })
      expect((app.screenshot as string[]).length).toBe(7)
      // every FAQ question and answer of the structured data is on the page, in the same order
      const faq = graph[4].mainEntity as { name: string; acceptedAnswer: { text: string } }[]
      expect(faq.map(q => q.name)).toEqual(COPY[lang].faq.items.map(i => i.q))
      const visible = [...html.matchAll(/<div class="qa-a"><p>([\s\S]*?)<\/p><\/div>/g)].map(m => textOf(m[1]).replace(/\s+/g, ' '))
      expect(visible).toHaveLength(faq.length)
      for (const [i, q] of faq.entries()) {
        // the structured data writes links out as "label (address)"; the page shows the label as a link
        const plain = q.acceptedAnswer.text.replace(/[⁦-⁩]/g, '').replace(/ \(https:\/\/[^)]+\)/g, '').replace(/\s+/g, ' ')
        expect(visible[i]).toBe(plain)
      }
      // the new questions dentists ask assistants, and the link to the comparison
      expect(html).toContain(`href="${lang === 'ar' ? '' : '/en'}/compare"`)
    }
  })
  it('links the comparison from the header and the footer, and keeps hreflang with English as x-default', async () => {
    const html = await (await (await workerWith({}))('/en')).text()
    expect((html.match(/<a href="\/en\/compare"/g) || []).length).toBeGreaterThanOrEqual(3)   // inline nav, phone menu, footer
    expect(html).toContain(`<link rel="alternate" hreflang="ar" href="${ORIGIN}/">`)
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/en">`)
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en">`)
  })
})

describe('the comparison page', () => {
  it('is served at /compare and /en/compare with its own canonical, hreflang and structured data', async () => {
    const get = await workerWith({})
    for (const [path, lang] of [['/compare', 'ar'], ['/en/compare', 'en']] as const) {
      const r = await get(path)
      expect([r.status, r.headers.get('Content-Type'), r.headers.get('Cache-Control'), r.headers.get('Content-Security-Policy'), r.headers.get('Content-Language'), r.headers.get('X-Frame-Options')])
        .toEqual([200, 'text/html; charset=utf-8', CACHE_PAGE, PUBLIC_CSP, lang, 'DENY'])
      const html = await r.text()
      const c = COMPARE[lang]
      expect(html).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}">`)
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/compare">`)
      expect(html).toContain(`<h1 id="cmp-title">${c.meta.h1}</h1>`)
      expect(c.meta.description.length).toBeLessThanOrEqual(155)
      expect(html).toContain('<time datetime="2026-10-18">')
      expect(html).not.toMatch(/\sstyle=|<style|\son[a-z]+=|<script>(?!)/i)
      expect(html).not.toMatch(/AggregateRating|ratingValue/)
      // the table: one row per approach, one cell per column
      expect((html.match(/<tr( class="cmp-ours")?>\n<th scope="row">/g) || []).length).toBe(3)
      expect((html.match(/<td data-label=/g) || []).length).toBe(3 * c.columns.length)
      // every source is linked
      for (const s of c.sources.items) expect(html).toContain(`href="${s.url}"`)
      const graph = graphOf(html)
      expect(types(graph)).toEqual(['Organization', 'WebSite', 'SoftwareApplication', 'WebPage', 'Article', 'BreadcrumbList', 'FAQPage'])
      const faq = graph[6].mainEntity as { name: string }[]
      expect(faq.map(q => q.name)).toEqual(c.faq.map(f => f.q))
      for (const f of c.faq) expect(html).toContain(`<summary><span>${f.q.replace(/'/g, '&#39;')}</span>`)
      expect(graph[4]).toMatchObject({ '@type': 'Article', headline: c.meta.h1, dateModified: '2026-10-18', author: { '@id': `${ORIGIN}/#organization` } })
    }
  })
  it('never states a competitor price', () => {
    for (const lang of ['ar', 'en'] as const) {
      const c = COMPARE[lang]
      for (const a of c.approaches.filter(x => x.key !== 'offline')) expect(a.cells.join(' ')).not.toMatch(/\$|€|£|\d+\s*(USD|dollars|دولار)/)
    }
  })
})

describe('/llms.txt and /llms-full.txt', () => {
  it('are plain text in the llms.txt format, with the facts and a link to every page', async () => {
    const get = await workerWith(PUBLISHED)
    const r = await get('/llms.txt')
    expect([r.status, r.headers.get('Content-Type')]).toEqual([200, 'text/plain; charset=utf-8'])
    const txt = await r.text()
    expect(txt.startsWith('# Dentora\n\n> Dentora is dental clinic management software that works fully offline')).toBe(true)
    for (const fact of ['Windows 10 and Windows 11 (64-bit)', 'Android 7.0 or later', '$59, paid once', '7 days with every feature', 'AES-256', 'Arabic (right-to-left']) expect(txt).toContain(fact)
    for (const path of ['/en', '/', '/en/compare', '/compare', '/en/guide', '/guide', '/videos', '/en/videos', '/en/activate', '/en/privacy', '/en/terms', '/llms-full.txt']) {
      expect(txt).toContain(`](${ORIGIN}${path})`)
    }
    for (const t of TOPICS) expect(txt).toContain(`(${ORIGIN}/en/guide/${t.slug})`)
    // only the published chapters, on the page that plays them
    expect(txt).toContain(`(${ORIGIN}/videos/patients)`)
    expect(txt).not.toContain(`(${ORIGIN}/videos/billing)`)
    expect(txt).not.toMatch(/\{(price|compare|activate|whatsapp)\}/)
    const full = await (await get('/llms-full.txt')).text()
    for (const f of COPY.en.faq.items) expect(full).toContain(`### ${f.q}`)
    for (const f of COMPARE.en.faq) expect(full).toContain(`### ${f.q}`)
    for (const x of COPY.en.features.items) expect(full).toContain(`### ${x.title}`)
    expect(full).not.toMatch(/\{(price|compare|activate|whatsapp|email)\}/)
  })
})

describe('the sitemap', () => {
  it('dates every page, groups every language with English as x-default, and lists pictures and the recorded videos', async () => {
    const get = await workerWith(PUBLISHED)
    const r = await get('/sitemap.xml')
    expect([r.status, r.headers.get('Content-Type')]).toEqual([200, 'application/xml; charset=utf-8'])
    const xml = await r.text()
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    expect(xml).toContain('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"')
    const urls = xml.match(/<url>[\s\S]*?<\/url>/g) || []
    expect(urls.length).toBe(2 * SITE_LANGS.length + 6 + 2 * (1 + TOPICS.length) + 2 * (1 + CHAPTERS.length))
    for (const u of urls) {
      expect(u).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
      expect(u).toMatch(/hreflang="x-default" href="https:\/\/dentora\.raqeem\.dev\/en(\/|")/)
    }
    const url = (loc: string) => urls.find(u => u.startsWith(`<url><loc>${ORIGIN}${loc}</loc>`))!
    expect(url('/compare')).toContain('<lastmod>2026-10-18</lastmod>')
    expect((url('/').match(/<image:image>/g) || []).length).toBe(7)
    expect(url(`/guide/${TOPICS[0].slug}`)).toContain(`<image:loc>${ORIGIN}/img/guide/ar/${TOPICS[0].shots[0].id}-1600.webp</image:loc>`)
    // a recorded chapter: its video, dated by the recording, on the Arabic page only
    const patients = url('/videos/patients')
    expect(patients).toContain('<lastmod>2026-10-16</lastmod>')
    expect(patients).toContain(`<video:content_loc>${ORIGIN}/videos/ar/patients.mp4?v=abcdef012345</video:content_loc>`)
    expect(patients).toContain(`<video:thumbnail_loc>${ORIGIN}/videos/ar/patients.jpg?v=abcdef012345</video:thumbnail_loc>`)
    expect(patients).toContain('<video:duration>125</video:duration>')
    expect(url('/en/videos/patients')).not.toContain('<video:video>')
    expect(url('/videos/billing')).not.toContain('<video:video>')
    // the course home: its newest recording
    expect(url('/videos')).toContain('<lastmod>2026-10-16</lastmod>')
    expect(url('/en/videos')).toContain('<lastmod>2026-10-15</lastmod>')
  })
})
