// /sitemap.xml: every page of the site, each with its language versions (hreflang, x-default = English), the day its
// content last changed (<lastmod>), and what it shows: the home page's screenshots and the guide's pictures as
// <image:image>, and each recorded chapter of the video course as <video:video> on the page that plays it.
// The dates are those of the pages' words (SITE_DATE, COMPARE_DATE, GUIDE_DATE, LEGAL_DATE, the recordings), not of
// the deployment: a page whose content did not change keeps its date.
import { GUIDE_DATE, TOPICS } from '../guide/index'
import { imageOf, imageUrl, type GuideImages } from '../guide/render'
import { CHAPTERS } from '../videos/index'
import { recordOf, videoFiles } from '../videos/render'
import type { VideoManifest } from '../videos/types'
import { COMPARE_DATE } from './pages/compare-content'
import { screenshotPaths } from './pages/landing'
import { LEGAL_DATE, langPath } from './pages/legal'
import { HREFLANG, SITE_DATE, SITE_LANGS, sitePath, X_DEFAULT, type SiteLang } from './site-lang'
import type { Lang } from './types'

/** The activation page's text last changed (src/pages/activate.ts). */
export const ACTIVATE_DATE = '2026-10-15'
/** The video course pages' own words last changed (videos/index.ts, videos/render.ts); a chapter page is newer when its recording is. */
export const VIDEOS_DATE = '2026-10-15'

const DOC_LANGS: readonly Lang[] = ['ar', 'en']
const XML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
const x = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => XML[c])

interface Entry {
  loc: string
  /** hreflang → address, x-default included. */
  alternates: [string, string][]
  lastmod: string
  changefreq: 'weekly' | 'monthly' | 'yearly'
  priority: string
  images?: string[]
  videos?: { thumb: string; title: string; description: string; content: string; duration: number; date?: string }[]
}

/** The later of two ISO dates (YYYY-MM-DD; a full instant is cut to its day). */
const later = (a: string, b?: string) => {
  const d = (b ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > a ? d : a
}

function entryXml(e: Entry): string {
  const alt = e.alternates.map(([h, href]) => `<xhtml:link rel="alternate" hreflang="${h}" href="${x(href)}"/>`).join('')
  const images = (e.images ?? []).map(src => `<image:image><image:loc>${x(src)}</image:loc></image:image>`).join('')
  const videos = (e.videos ?? []).map(v => '<video:video>'
    + `<video:thumbnail_loc>${x(v.thumb)}</video:thumbnail_loc><video:title>${x(v.title)}</video:title>`
    + `<video:description>${x(v.description)}</video:description><video:content_loc>${x(v.content)}</video:content_loc>`
    + `<video:duration>${Math.max(1, Math.round(v.duration))}</video:duration>${v.date ? `<video:publication_date>${x(v.date)}</video:publication_date>` : ''}`
    + '<video:family_friendly>yes</video:family_friendly></video:video>').join('')
  return `<url><loc>${x(e.loc)}</loc>${alt}<lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority>${images}${videos}</url>`
}

export interface SitemapInput {
  origin: string
  guideImages: GuideImages | null
  videos: VideoManifest | null
}

export function sitemapEntries({ origin, guideImages, videos }: SitemapInput): Entry[] {
  const out: Entry[] = []
  // the marketing pages: every site language, the cluster of all of them
  const marketing = (path: string, lastmod: string, changefreq: Entry['changefreq'], priority: string, images?: (l: SiteLang) => string[]) => {
    const alternates: [string, string][] = [...SITE_LANGS.map(l => [HREFLANG[l], origin + sitePath(path, l)] as [string, string]), ['x-default', origin + sitePath(path, X_DEFAULT)]]
    for (const l of SITE_LANGS) out.push({ loc: origin + sitePath(path, l), alternates, lastmod, changefreq, priority, images: images?.(l) })
  }
  marketing('/', SITE_DATE, 'weekly', '1.0', l => screenshotPaths(l).map(p => origin + p))
  marketing('/compare', COMPARE_DATE, 'monthly', '0.8')

  // the pages in Arabic and English only
  const doc = (path: string, lastmod: (l: Lang) => string, changefreq: Entry['changefreq'], priority: string, extra: (l: Lang) => Partial<Entry> = () => ({})) => {
    const alternates: [string, string][] = [...DOC_LANGS.map(l => [l, origin + langPath(path, l)] as [string, string]), ['x-default', origin + langPath(path, X_DEFAULT)]]
    for (const l of DOC_LANGS) out.push({ loc: origin + langPath(path, l), alternates, lastmod: lastmod(l), changefreq, priority, ...extra(l) })
  }
  doc('/activate', () => ACTIVATE_DATE, 'monthly', '0.5')
  doc('/privacy', () => LEGAL_DATE, 'yearly', '0.3')
  doc('/terms', () => LEGAL_DATE, 'yearly', '0.3')

  // the user guide: its home and every topic, with the topic's pictures in that language
  const topics = [...TOPICS].sort((a, b) => a.order - b.order)
  doc('/guide', () => GUIDE_DATE, 'weekly', '0.8')
  for (const t of topics) {
    doc(`/guide/${t.slug}`, () => GUIDE_DATE, 'monthly', '0.6', l => ({
      images: t.shots.flatMap(sh => {
        const img = imageOf(guideImages, l, sh.id)
        return img ? [origin + imageUrl(l, sh.id, img.widths[0])] : []
      }),
    }))
  }

  // the video course: its home (newest recording in that language) and every chapter (its recording, when made)
  const chapters = [...CHAPTERS].sort((a, b) => a.order - b.order)
  doc('/videos', l => chapters.reduce((d, c) => later(d, recordOf(videos, l, c.slug)?.recordedAt), VIDEOS_DATE), 'weekly', '0.8')
  // a chapter page is listed in the languages it is recorded in (the others are "coming" placeholders, not indexed)
  for (const c of chapters) {
    const path = `/videos/${c.slug}`
    const langs = DOC_LANGS.filter(l => recordOf(videos, l, c.slug))
    if (!langs.length) continue
    const def: Lang = langs.includes(X_DEFAULT) ? X_DEFAULT : langs[0]
    const alternates: [string, string][] = [...langs.map(l => [l, origin + langPath(path, l)] as [string, string]), ['x-default', origin + langPath(path, def)]]
    for (const l of langs) {
      const rec = recordOf(videos, l, c.slug)!
      const files = videoFiles(l, c.slug, rec)
      out.push({
        loc: origin + langPath(path, l), alternates, lastmod: later(VIDEOS_DATE, rec.recordedAt), changefreq: 'monthly', priority: '0.6',
        videos: [{
          thumb: origin + files.jpg, title: c.title[l], description: c.summary[l], content: origin + files.mp4,
          duration: rec.durationSeconds, date: rec.recordedAt,
        }],
      })
    }
  }
  return out
}

export function sitemapXml(input: SitemapInput): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" '
    + 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'
    + sitemapEntries(input).map(entryXml).join('\n')
    + '\n</urlset>\n'
}
