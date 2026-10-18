// The Worker's router for the user guide (guide/) and the video course (videos/) pages, the pictures' and the
// recordings' manifests read from the published files, and the two JSON files of /files/* it lets through. The
// renderers are the real ones (they have their own tests); what is checked is what the router hands them and how
// the answer is served.
import { describe, expect, it, vi } from 'vitest'
import { TOPICS } from '../guide/index'
import { CACHE_PAGE, PUBLIC_CSP } from '../src/http'
import { DEFAULT_SETTINGS, type Env } from '../src/types'
import { CHAPTERS } from '../videos/index'
import { memoryD1 } from './d1'

const ORIGIN = 'https://dentora.raqeem.dev'
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext

/** A stand-in for the static files: the paths given (JSON for objects), 404 for the rest, and a count per path. */
function assets(files: Record<string, string | object>) {
  const hits: Record<string, number> = {}
  const fetcher = {
    async fetch(req: Request) {
      const path = new URL(req.url).pathname
      hits[path] = (hits[path] || 0) + 1
      if (!(path in files)) return new Response('', { status: 404 })
      const v = files[path]
      return new Response(typeof v === 'string' ? v : JSON.stringify(v), { status: 200, headers: { 'Content-Type': typeof v === 'string' ? 'application/octet-stream' : 'application/json' } })
    },
  }
  return { fetcher: fetcher as unknown as Fetcher, hits }
}
/** A Worker of its own (src/index.ts caches what is published per isolate: a module instance here). */
async function workerWith(files: Record<string, string | object>) {
  vi.resetModules()
  const { default: worker } = await import('../src/index')
  const { fetcher, hits } = assets(files)
  const env: Env = { DB: memoryD1(), ASSETS: fetcher }
  const get = (path: string, init?: RequestInit) => worker.fetch(new Request(ORIGIN + path, init) as Parameters<typeof worker.fetch>[0], env, ctx)
  return { get, hits }
}
const manifestOf = (...paths: string[]) => ({ files: [...paths, '/files/manifest.json'].sort() })
const first = TOPICS[0], firstShot = TOPICS.find(t => t.shots.length)!.shots[0]
const chapter = CHAPTERS[0]
const SHA = 'abcdef0123456789'.repeat(4)
const recording = { durationSeconds: 61.5, sizeBytes: 1234567, width: 1920, height: 1080, sha256: SHA, recordedAt: '2026-10-15T09:00:00Z', scenes: [{ id: 'open', start: 0, text: 'Open.' }, { id: 'next', start: 12, text: 'Next.' }] }

const pageHeaders = (r: Response, lang: string) => ({ status: r.status, type: r.headers.get('Content-Type'), cache: r.headers.get('Cache-Control'), csp: r.headers.get('Content-Security-Policy'), lang: r.headers.get('Content-Language'), frame: r.headers.get('X-Frame-Options') })
const expectedHeaders = (lang: string) => ({ status: 200, type: 'text/html; charset=utf-8', cache: CACHE_PAGE, csp: PUBLIC_CSP, lang, frame: 'DENY' })

describe('the user guide through the Worker', () => {
  it('serves the home and every topic in both languages like the legal pages, nothing published', async () => {
    const { get } = await workerWith({})
    for (const [path, lang] of [['/guide', 'ar'], ['/en/guide', 'en']] as const) {
      const r = await get(path)
      expect(pageHeaders(r, lang)).toEqual(expectedHeaders(lang))
      const page = await r.text()
      expect(page).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(page).toContain(`<link rel="canonical" href="${ORIGIN}${path}">`)
      expect((page.match(/class="gd-card" data-slug="/g) || []).length).toBe(TOPICS.length)
      expect(page).not.toContain('/css/site.css')   // not published in this stand-in
    }
    for (const topic of TOPICS) {
      for (const lang of ['ar', 'en'] as const) {
        const path = `${lang === 'en' ? '/en' : ''}/guide/${topic.slug}`
        const r = await get(path)
        expect(pageHeaders(r, lang), path).toEqual(expectedHeaders(lang))
        expect(await r.text(), path).toContain(`<link rel="canonical" href="${ORIGIN}${path}">`)
      }
    }
  })
  it('answers 404 for a topic that does not exist, a slug in the wrong shape or a file name, and redirects a trailing slash', async () => {
    const { get } = await workerWith({})
    for (const path of ['/guide/nope', '/en/guide/nope', `/guide/${first.slug.toUpperCase()}`, '/guide/manifest.json', `/guide/${first.slug}/x`, '/guide/-x']) {
      const r = await get(path)
      expect(r.status, path).toBe(404)
      expect(await r.text(), path).toContain('الصفحة غير موجودة')
    }
    for (const [path, to] of [['/guide/', '/guide'], ['/en/guide/', '/en/guide'], [`/guide/${first.slug}/`, `/guide/${first.slug}`]]) {
      const r = await get(path)
      expect([r.status, r.headers.get('Location')], path).toEqual([301, to])
    }
    const head = await get(`/en/guide/${first.slug}`, { method: 'HEAD' })
    expect([head.status, await head.text()]).toEqual([200, ''])
  })
  it('reads the pictures’ manifest from the published files once per isolate and sets the pictures’ sizes', async () => {
    const files = {
      '/files/manifest.json': manifestOf('/img/guide/manifest.json', '/css/site.css', '/favicon.svg', '/site.webmanifest'),
      '/img/guide/manifest.json': { [`ar/${firstShot.id}`]: { widths: [1600, 900], width: 1600, height: 1000, cssWidth: 1440 }, [`en/${firstShot.id}`]: { widths: [1600, 900], width: 1600, height: 1000, cssWidth: 1440 } },
    }
    const { get, hits } = await workerWith(files)
    const topic = TOPICS.find(t => t.shots.some(s => s.id === firstShot.id))!
    const ar = await (await get(`/guide/${topic.slug}`)).text()
    const en = await (await get(`/en/guide/${topic.slug}`)).text()
    await get('/guide')
    // the manifest's pixel size on the zoom link; the picture itself has a size (its display size) as well
    expect(ar).toContain(`<a class="gd-zoom" href="/img/guide/ar/${firstShot.id}-1600.webp" data-w="1600" data-h="1000">`)
    expect(ar).toMatch(new RegExp(`<img src="/img/guide/ar/${firstShot.id}-[0-9]+\\.webp"[^>]*width="[0-9]+" height="[0-9]+"`))
    expect(en).toContain(`<a class="gd-zoom" href="/img/guide/en/${firstShot.id}-1600.webp" data-w="1600" data-h="1000">`)
    expect(ar).toContain('/css/site.css')
    expect(hits['/img/guide/manifest.json']).toBe(1)
    expect(hits['/files/manifest.json']).toBe(1)
  })
  it('shows a placeholder, not a broken picture, when the manifest is missing or not JSON', async () => {
    const { get } = await workerWith({ '/files/manifest.json': manifestOf('/img/guide/manifest.json'), '/img/guide/manifest.json': 'not json at all' })
    const topic = TOPICS.find(t => t.shots.some(s => s.id === firstShot.id))!
    const page = await (await get(`/guide/${topic.slug}`)).text()
    expect(page).not.toContain(`/img/guide/ar/${firstShot.id}-`)
    expect(page).toContain('الصورة قيد الإعداد')
  })
})

describe('the video course through the Worker', () => {
  it('serves the home and every chapter in both languages, "coming" while nothing is recorded', async () => {
    const { get, hits } = await workerWith({ '/files/manifest.json': manifestOf('/css/site.css') })
    for (const [path, lang] of [['/videos', 'ar'], ['/en/videos', 'en']] as const) {
      const r = await get(path)
      expect(pageHeaders(r, lang)).toEqual(expectedHeaders(lang))
      const page = await r.text()
      expect(page).toContain(`<link rel="canonical" href="${ORIGIN}${path}">`)
      expect((page.match(/class="vc-card[^"]*" data-slug="/g) || []).length).toBe(CHAPTERS.length)
      expect(page).not.toContain('<video')
    }
    for (const c of CHAPTERS) {
      const r = await get(`/videos/${c.slug}`)
      expect(pageHeaders(r, 'ar'), c.slug).toEqual(expectedHeaders('ar'))
      const page = await r.text()
      expect(page, c.slug).toContain('vc-soon-panel')
      expect(page, c.slug).not.toContain('<video')
      expect(page, c.slug).toContain(`href="/guide/${c.guide}"`)
    }
    expect(hits['/videos/manifest.json']).toBeUndefined()   // not in the published files: never asked for
  })
  it('404 for a chapter that does not exist, a language folder, a file name; trailing slashes redirected', async () => {
    const { get } = await workerWith({})
    for (const path of ['/videos/nope', '/en/videos/nope', '/videos/ar', '/videos/manifest.json', `/videos/ar/${chapter.slug}.mp4`, `/videos/${chapter.slug.toUpperCase()}`]) {
      const r = await get(path)
      expect(r.status, path).toBe(404)
      expect(await r.text(), path).toContain('Page not found')
    }
    for (const [path, to] of [['/videos/', '/videos'], [`/en/videos/${chapter.slug}/?t=3`, `/en/videos/${chapter.slug}?t=3`]]) {
      const r = await get(path)
      expect([r.status, r.headers.get('Location')], path).toEqual([301, to])
    }
  })
  it('reads the recordings’ manifest once per isolate; a recorded chapter gets its player, ?t= its start', async () => {
    const files = {
      '/files/manifest.json': manifestOf('/videos/manifest.json', `/videos/ar/${chapter.slug}.mp4`, `/videos/ar/${chapter.slug}.vtt`, `/videos/ar/${chapter.slug}.jpg`),
      '/videos/manifest.json': { [`ar/${chapter.slug}`]: recording },
    }
    const { get, hits } = await workerWith(files)
    const ar = await (await get(`/videos/${chapter.slug}`)).text()
    const en = await (await get(`/en/videos/${chapter.slug}`)).text()
    const home = await (await get('/videos')).text()
    expect(ar).toContain('<video')
    expect(ar).toContain(`/videos/ar/${chapter.slug}.mp4?v=${SHA.slice(0, 12)}`)
    expect(ar).toContain('"@type":"VideoObject"')
    expect(ar).toContain('property="og:video"')
    expect(en).toContain('vc-soon-panel')
    expect(en).toContain(`href="/videos/${chapter.slug}"`)   // the Arabic recording is offered
    expect(home).toContain('1:01')
    expect(hits['/videos/manifest.json']).toBe(1)
    const at = await (await get(`/videos/${chapter.slug}?t=12`)).text()
    expect(at).toMatch(/<source[^>]*src="[^"]*#t=12"/)
    for (const bad of ['?t=-3', '?t=abc', '?t=', '?t=0']) expect(await (await get(`/videos/${chapter.slug}${bad}`)).text(), bad).not.toContain('#t=')
    const dec = await (await get(`/videos/${chapter.slug}?t=12.9`)).text()
    expect(dec).toMatch(/#t=12"/)
  })
})

describe('the published files’ JSON', () => {
  const meta = { version: '1.0.0', sizeBytes: 3, sha256: 'a'.repeat(64) }
  const windows = { version: '1.0.0', sizeBytes: 5, sha256: 'b'.repeat(64), parts: [{ path: '/files/windows/setup.000', size: 5 }] }
  it('serves /files/meta.json and /files/windows.json only while their downloads are served; nothing else of /files/', async () => {
    const { get } = await workerWith({
      '/files/manifest.json': manifestOf('/files/dentora.apk', '/files/meta.json', '/files/windows.json', '/files/windows/setup.000'),
      '/files/dentora.apk': 'apk', '/files/meta.json': meta, '/files/windows.json': windows, '/files/windows/setup.000': 'setup',
    })
    for (const [path, body] of [['/files/meta.json', meta], ['/files/windows.json', windows]] as const) {
      const r = await get(path)
      expect([r.status, r.headers.get('Content-Type'), r.headers.get('Cache-Control'), r.headers.get('X-Content-Type-Options')], path).toEqual([200, 'application/json; charset=utf-8', 'public, max-age=60', 'nosniff'])
      expect(await r.json(), path).toEqual(body)
    }
    for (const path of ['/files/dentora.apk', '/files/windows/setup.000', '/files/manifest.json', '/files/meta.json/', '/files/other.json']) {
      const r = await get(path)
      expect([301, 404], path).toContain(r.status)
    }
    const head = await get('/files/windows.json', { method: 'HEAD' })
    expect([head.status, await head.text()]).toEqual([200, ''])
  })
  it('404 for both when the APK is not published and the installer is missing a part', async () => {
    const { get } = await workerWith({
      '/files/manifest.json': manifestOf('/files/meta.json', '/files/windows.json'),
      '/files/meta.json': meta, '/files/windows.json': windows,
    })
    expect((await get('/files/meta.json')).status).toBe(404)
    expect((await get('/files/windows.json')).status).toBe(404)
  })
})

describe('the public pages’ policy', () => {
  it('names media-src for the course’s recordings, on every public page', async () => {
    expect(PUBLIC_CSP).toContain("media-src 'self'")
    const { get } = await workerWith({})
    for (const path of ['/', '/en/guide', `/videos/${chapter.slug}`, '/activate', '/privacy']) {
      expect((await get(path)).headers.get('Content-Security-Policy'), path).toBe(PUBLIC_CSP)
    }
    expect((await get('/no-such-page')).headers.get('Content-Security-Policy')).toBe(PUBLIC_CSP)
    expect((await get('/api/me')).headers.get('Content-Security-Policy')).not.toContain('cloudflareinsights')
  })
  it('keeps the settings’ WhatsApp number on the guide and the course pages', async () => {
    const { get } = await workerWith({})
    const wa = `https://wa.me/${DEFAULT_SETTINGS.whatsapp.replace(/\D/g, '')}`
    expect(await (await get('/guide')).text()).toContain(wa)
    expect(await (await get('/en/videos')).text()).toContain(wa)
  })
})
