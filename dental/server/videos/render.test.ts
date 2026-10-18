// The course pages (render.ts) and the chapter list (index.ts). Run from server/ with a config that includes this
// folder, e.g. npx vitest run --config <a config whose test.include has 'videos/**/*.test.ts'> (vitest.config.ts
// only looks in test/).
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/types'
import { CHAPTERS, chapterBySlug } from './index'
import { chaptersCount, clock, isoDuration, lengthText, recordOf, renderVideoChapter, renderVideosHome, sizeText } from './render'
import type { VideoChapter, VideoManifest, VideoRecord } from './types'

const assets = { siteCss: true, favicon: true, manifest: true }
const ORIGIN = 'https://dentora.raqeem.dev'
const SHA = 'abcdef0123456789'.repeat(4)
const rec = (over: Partial<VideoRecord> = {}): VideoRecord => ({
  durationSeconds: 187, sizeBytes: 18_874_368, width: 1920, height: 1080, sha256: SHA, recordedAt: '2026-10-15T09:00:00Z',
  scenes: [
    { id: 'open', start: 0, text: 'نفتح قائمة المرضى <b>من</b> الشريط الجانبي.' },
    { id: 'search', start: 12.5, text: 'Search "Sami" & press Enter.' },
    { id: 'end', start: 95, text: 'Done.' },
  ],
  ...over,
})
const manifest: VideoManifest = {
  'ar/patients': rec(),
  'en/patients': rec(),
  'en/chart': rec({ recordedAt: undefined, scenes: [{ id: 'one', start: 0, text: 'Only one scene.' }] }),
  // being recorded: the transcript is there, the file is not
  'ar/reports': { durationSeconds: 0, sizeBytes: 0, width: 0, height: 0, sha256: '', scenes: [{ id: 'a', start: 0, text: 'الإيرادات أولاً.' }, { id: 'b', start: 4, text: 'ثم المصروفات.' }] },
}
const patients = chapterBySlug('patients') as VideoChapter
const ld = (page: string) => {
  const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(page)
  if (!m) throw new Error('no JSON-LD')
  return JSON.parse(m[1]) as { '@graph': Record<string, unknown>[] }
}
const INLINE = /\sstyle=|<style|\son[a-z]+=/i
const scripts = (page: string) => page.match(/<script\b[^>]*>/g) ?? []
const ALLOWED_SCRIPT = /^<script (type="application\/ld\+json"|src="\/js\/videos\.js" defer)>$/

describe('the chapter list', () => {
  it('follows the guide, one chapter per topic, numbered from 1 without a gap', () => {
    expect(CHAPTERS.map(c => c.slug)).toEqual([
      'getting-started', 'interface', 'dashboard', 'patients', 'chart', 'appointments', 'treatments', 'billing', 'prescriptions', 'lab',
      'inventory', 'expenses', 'reports', 'settings', 'staff', 'backup', 'licence',
    ])
    expect(CHAPTERS.map(c => c.order)).toEqual(CHAPTERS.map((_, i) => i + 1))
    for (const c of CHAPTERS) {
      expect(c.guide).toBeTruthy()
      for (const lang of ['ar', 'en'] as const) {
        expect(c.title[lang].trim().length).toBeGreaterThan(3)
        expect(c.summary[lang].trim().length).toBeGreaterThan(20)
      }
      expect(c.title.ar).toMatch(/[\u0600-\u06FF]/)
      expect(c.summary.ar).toMatch(/[\u0600-\u06FF]/)
    }
    expect(chapterBySlug('patients')?.order).toBe(4)
    expect(chapterBySlug('nope')).toBeUndefined()
  })
})

describe('words and numbers', () => {
  it('write clocks, lengths, sizes and ISO durations', () => {
    expect(clock(187)).toBe('3:07')
    expect(clock(3725)).toBe('1:02:05')
    expect(clock(0)).toBe('0:00')
    expect(isoDuration(187)).toBe('PT3M7S')
    expect(isoDuration(3600)).toBe('PT1H')
    expect(isoDuration(0)).toBe('PT0S')
    expect(lengthText(187, 'en')).toBe('3 min')
    expect(lengthText(3725, 'en')).toBe('1 h 02 min')
    expect(lengthText(45, 'en')).toBe('45 s')
    expect(lengthText(120, 'ar')).toBe('دقيقتان')
    expect(lengthText(1500, 'ar')).toBe('25 دقيقة')
    expect(lengthText(300, 'ar')).toBe('5 دقائق')
    expect(lengthText(3900, 'ar')).toBe('ساعة و5 دقائق')
    expect(chaptersCount(17, 'ar')).toBe('17 فصلاً')
    expect(chaptersCount(5, 'ar')).toBe('5 فصول')
    expect(chaptersCount(1, 'en')).toBe('1 chapter')
    expect(chaptersCount(17, 'en')).toBe('17 chapters')
    expect(sizeText(18_874_368, 'en')).toBe('18 MB')
    expect(sizeText(18_874_368, 'ar')).toBe('18 م.ب')
    expect(sizeText(900_000, 'en')).toBe('0.9 MB')
  })
  it('take a recording only when it has a duration', () => {
    expect(recordOf(manifest, 'ar', 'patients')?.durationSeconds).toBe(187)
    expect(recordOf(manifest, 'ar', 'reports')).toBeUndefined()
    expect(recordOf(manifest, 'ar', 'chart')).toBeUndefined()
    expect(recordOf(null, 'ar', 'patients')).toBeUndefined()
    expect(recordOf({ 'ar/patients': 'junk' as unknown as VideoRecord }, 'ar', 'patients')).toBeUndefined()
  })
})

describe('the course home', () => {
  it('lists every chapter with its poster or a "coming" card, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const page = renderVideosHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS, manifest)
      expect(page).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(page).toContain(`<link rel="canonical" href="${ORIGIN}${lang === 'en' ? '/en' : ''}/videos">`)
      expect(page).toContain(`<link rel="alternate" hreflang="ar" href="${ORIGIN}/videos">`)
      expect(page).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/en/videos">`)
      expect(page).toContain('href="/css/videos.css"')
      expect(page).toContain('<script src="/js/videos.js" defer></script>')
      for (const c of CHAPTERS) {
        expect(page).toContain(`href="${lang === 'en' ? '/en' : ''}/videos/${c.slug}"`)
        expect(page).toContain(c.title[lang].replace(/’/g, '&#39;'))
      }
      expect((page.match(/class="vc-card /g) ?? []).length + (page.match(/class="vc-card"/g) ?? []).length).toBe(17)
      // the recorded chapter has a poster and a duration; the others say "coming"
      expect(page).toContain(`<img src="/videos/${lang}/patients.jpg?v=abcdef012345"`)
      expect(page).toContain('3:07')
      expect((page.match(/vc-card-soon/g) ?? []).length).toBe(lang === 'ar' ? 16 : 15)
      expect(page).toContain(lang === 'ar' ? 'قريباً' : 'Coming soon')
      // the facts: the count, the total length of what is published, how many are published
      expect(page).toContain(lang === 'ar' ? '17 فصلاً' : '17 chapters')
      // Arabic has one recording of 3:07, English two (patients and chart)
      expect(page).toContain(lang === 'ar' ? '3 دقائق' : '6 min')
      expect(page).toContain(lang === 'ar' ? '1 من 17' : '2 of 17')
      // "watch from the start" goes to the first recorded chapter
      expect(page).toContain(`class="btn btn-primary legal-btn vc-btn" href="${lang === 'en' ? '/en' : ''}/videos/patients"`)
      expect(page).not.toMatch(INLINE)
      for (const s of scripts(page)) expect(s).toMatch(ALLOWED_SCRIPT)
      const graph = ld(page)['@graph']
      const list = graph.find(g => g['@type'] === 'ItemList') as { itemListElement: { url: string; name: string }[] }
      expect(list.itemListElement).toHaveLength(17)
      expect(list.itemListElement[3]).toMatchObject({ position: 4, url: `${ORIGIN}${lang === 'en' ? '/en' : ''}/videos/patients` })
      expect(graph.find(g => g['@type'] === 'BreadcrumbList')).toBeTruthy()
    }
  })
  it('says the first chapters are being recorded when nothing is published', () => {
    const page = renderVideosHome('ar', DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS, {})
    expect(page).toContain('قيد التسجيل')
    expect(page).not.toContain('<img src="/videos/')
    expect(page).toContain('href="/videos/getting-started"')
    expect(renderVideosHome('en', DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS, null)).toContain('being recorded')
  })
})

describe('a chapter page', () => {
  const page = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, patients, CHAPTERS, manifest)
  it('has the player with the poster, the file and the caption track of its language', () => {
    expect(page).toContain('<video controls playsinline preload="metadata" poster="/videos/ar/patients.jpg?v=abcdef012345" width="1920" height="1080" lang="ar">')
    expect(page).toContain('<source src="/videos/ar/patients.mp4?v=abcdef012345" type="video/mp4">')
    expect(page).toContain('<track kind="subtitles" src="/videos/ar/patients.vtt?v=abcdef012345" srclang="ar" label="العربية" default>')
    expect(page).toContain('href="/videos/ar/patients.mp4?v=abcdef012345" download')
    expect(page).toContain('data-next="/videos/chart"')
    expect(page).toContain('الفصل 4 من 17')
    expect(page).toContain('3:07')
    expect(page).toContain('18 م.ب')
  })
  it('has the transcript with escaped text and time links that seek (or reload at ?t=)', () => {
    expect((page.match(/class="vc-line"/g) ?? []).length).toBe(3)
    expect(page).toContain('نفتح قائمة المرضى &lt;b&gt;من&lt;/b&gt; الشريط الجانبي.')
    expect(page).not.toContain('<b>من</b>')
    expect(page).toContain('Search &quot;Sami&quot; &amp; press Enter.')
    expect(page).toContain('<a class="vc-time" href="?t=12#player" data-t="12.5" aria-label="الانتقال إلى 0:12"><time datetime="PT12S">0:12</time></a>')
    expect(page).toContain('id="scene-search" data-start="12.5" data-end="95"')
    expect(page).toContain('id="scene-end" data-start="95" data-end="187"')
  })
  it('links the neighbours, the guide topic and WhatsApp', () => {
    expect(page).toContain('class="vc-pager-prev" href="/videos/dashboard" rel="prev"')
    expect(page).toContain('class="vc-pager-next" href="/videos/chart" rel="next"')
    expect(page).toContain('href="/guide/patients"')
    expect(page).toContain(`href="https://wa.me/963996489504?text=${encodeURIComponent('مرحباً، لدي سؤال عن Dentora بعد مشاهدة فصل «المرضى: الملفات والسجل الطبي».').replace(/'/g, '&#39;')}"`)
    // the chapter list, the current one marked
    expect((page.match(/<li class="vc-item[ "]/g) ?? []).length).toBe(17)
    expect(page).toContain('<li class="vc-item is-current" data-slug="patients"><a href="/videos/patients" aria-current="page">')
    expect(page).toContain('<li class="vc-item vc-item-soon" data-slug="chart">')
  })
  it('has canonical, hreflang, Open Graph video and the structured data', () => {
    expect(page).toContain(`<link rel="canonical" href="${ORIGIN}/videos/patients">`)
    expect(page).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/en/videos/patients">`)
    expect(page).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/videos/patients">`)
    expect(page).toContain('<meta property="og:type" content="video.other">')
    expect(page).toContain(`<meta property="og:video" content="${ORIGIN}/videos/ar/patients.mp4?v=abcdef012345">`)
    expect(page).toContain(`<meta property="og:image" content="${ORIGIN}/videos/ar/patients.jpg?v=abcdef012345">`)
    const graph = ld(page)['@graph']
    const video = graph.find(g => g['@type'] === 'VideoObject') as Record<string, unknown>
    expect(video).toMatchObject({
      name: patients.title.ar, description: patients.summary.ar, thumbnailUrl: [`${ORIGIN}/videos/ar/patients.jpg?v=abcdef012345`],
      uploadDate: '2026-10-15T09:00:00Z', duration: 'PT3M7S', contentUrl: `${ORIGIN}/videos/ar/patients.mp4?v=abcdef012345`, inLanguage: 'ar',
      url: `${ORIGIN}/videos/patients`, width: 1920, height: 1080,
    })
    const clips = video.hasPart as Record<string, unknown>[]
    expect(clips).toHaveLength(3)
    expect(clips[1]).toMatchObject({ '@type': 'Clip', startOffset: 12.5, endOffset: 95, url: `${ORIGIN}/videos/patients?t=12` })
    expect(clips[2]).toMatchObject({ endOffset: 187 })
    const crumbs = graph.find(g => g['@type'] === 'BreadcrumbList') as { itemListElement: { item: string; name: string }[] }
    expect(crumbs.itemListElement.map(c => c.item)).toEqual([`${ORIGIN}/`, `${ORIGIN}/videos`, `${ORIGIN}/videos/patients`])
    expect(crumbs.itemListElement[2].name).toBe(patients.title.ar)
  })
  it('starts at ?t= when asked', () => {
    const at = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, patients, CHAPTERS, manifest, { t: 42.7 })
    expect(at).toContain('<source src="/videos/ar/patients.mp4?v=abcdef012345#t=42" type="video/mp4">')
    expect(at).toContain('data-start="42"')
    expect(page).not.toContain('#t=')
    expect(renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, patients, CHAPTERS, manifest, { t: -3 })).not.toContain('#t=')
  })
  it('leaves uploadDate out when the manifest has no date', () => {
    const en = renderVideoChapter('en', DEFAULT_SETTINGS, ORIGIN, assets, chapterBySlug('chart') as VideoChapter, CHAPTERS, manifest)
    const video = ld(en)['@graph'].find(g => g['@type'] === 'VideoObject') as Record<string, unknown>
    expect(video).toBeTruthy()
    expect('uploadDate' in video).toBe(false)
    expect('hasPart' in video).toBe(false)   // one scene is not a list of clips
    expect(en).toContain('<track kind="subtitles" src="/videos/en/chart.vtt?v=abcdef012345" srclang="en" label="English" default>')
  })
})

describe('a chapter not recorded yet', () => {
  it('says the video is coming and shows the summary, without a player or a VideoObject', () => {
    const page = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, chapterBySlug('treatments') as VideoChapter, CHAPTERS, manifest)
    expect(page).not.toContain('<video')
    expect(page).toContain('vc-soon-panel')
    expect(page).toContain('هذا الفصل قيد التسجيل')
    expect(page).toContain('href="/guide/treatments"')
    expect(page).not.toContain('og:video')
    expect(page).not.toContain('class="vc-transcript"')
    expect(page).not.toContain('vc-keys')
    expect(page).not.toContain(' download')
    expect(page).toContain('<meta property="og:type" content="website">')
    const graph = ld(page)['@graph']
    expect(graph.find(g => g['@type'] === 'VideoObject')).toBeUndefined()
    expect(graph.find(g => g['@type'] === 'BreadcrumbList')).toBeTruthy()
  })
  it('still shows the transcript when the manifest has scenes', () => {
    const page = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, chapterBySlug('reports') as VideoChapter, CHAPTERS, manifest)
    expect(page).not.toContain('<video')
    expect((page.match(/class="vc-line"/g) ?? []).length).toBe(2)
    expect(page).toContain('ثم المصروفات.')
    expect(page).toContain('href="?t=4#player"')
    expect(page).not.toContain('data-end="undefined"')
  })
  it('points to the other language when that one is recorded', () => {
    const ar = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, chapterBySlug('chart') as VideoChapter, CHAPTERS, manifest)
    expect(ar).toContain('class="vc-soon-other" href="/en/videos/chart" hreflang="en"')
    const en = renderVideoChapter('en', DEFAULT_SETTINGS, ORIGIN, assets, chapterBySlug('treatments') as VideoChapter, CHAPTERS, manifest)
    expect(en).not.toContain('vc-soon-other')
  })
  it('has no previous link on the first chapter and no next on the last', () => {
    const first = renderVideoChapter('en', DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS[0], CHAPTERS, manifest)
    expect(first).toContain('class="vc-pager-prev vc-pager-none"')
    expect(first).toContain('class="vc-pager-next" href="/en/videos/interface" rel="next"')
    const last = renderVideoChapter('en', DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS[CHAPTERS.length - 1], CHAPTERS, manifest)
    expect(last).toContain('class="vc-pager-next vc-pager-none"')
    expect(last).not.toContain('data-next=')
  })
})

describe('every page', () => {
  it('has nothing the CSP would block and escapes what it shows', () => {
    const nasty: VideoChapter = { slug: 'x', order: 99, guide: 'x', title: { ar: 'عنوان <img src="x"><script>alert(1)</script>', en: 'Title "quoted" & <script>' }, summary: { ar: 'ملخص </script><script>alert(1)</script>', en: 'Sum "q"' } }
    const bad: VideoManifest = { 'ar/x': rec({ scenes: [{ id: 'a"b', start: 1, text: '</li><script>x()</script>' }] }) }
    for (const lang of ['ar', 'en'] as const) {
      for (const c of [...CHAPTERS, nasty]) {
        const page = renderVideoChapter(lang, { ...DEFAULT_SETTINGS, whatsapp: '' }, ORIGIN, assets, c, [...CHAPTERS, nasty], { ...manifest, ...bad })
        expect(page).not.toMatch(INLINE)
        for (const s of scripts(page)) expect(s).toMatch(ALLOWED_SCRIPT)
        expect(page).not.toContain('<script>')
        expect(page).not.toContain('<img src="x">')
        // an empty WhatsApp setting falls back to the default number
        expect(page).toContain('https://wa.me/963996489504?text=')
      }
      const home = renderVideosHome(lang, DEFAULT_SETTINGS, ORIGIN, assets, [...CHAPTERS, nasty], manifest)
      expect(home).not.toMatch(INLINE)
      expect(home).not.toContain('<script>')
      expect(home).not.toContain('<img src="x">')
    }
    const page = renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, nasty, [nasty], bad)
    expect(page).toContain('<h1>عنوان &lt;img src=&quot;x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
    expect(page).toContain('<title>عنوان &lt;img src=&quot;x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; — دورة فيديو Dentora</title>')
    expect(page).toContain('&lt;/li&gt;&lt;script&gt;x()&lt;/script&gt;')
    expect(page).toContain('id="scene-a&quot;b"')
    expect(page).toContain('\\u003c/script\\u003e')   // inside the JSON-LD
    expect(ld(page)['@graph'][0].name).toBe(nasty.title.ar)
  })
  it('renders with a missing or odd manifest', () => {
    for (const m of [undefined, null, {}, { 'ar/patients': null }, { 'ar/patients': { scenes: 'no' } }] as unknown[]) {
      expect(() => renderVideoChapter('ar', DEFAULT_SETTINGS, ORIGIN, assets, patients, CHAPTERS, m as VideoManifest)).not.toThrow()
      expect(() => renderVideosHome('ar', DEFAULT_SETTINGS, ORIGIN, assets, CHAPTERS, m as VideoManifest)).not.toThrow()
    }
  })
})
