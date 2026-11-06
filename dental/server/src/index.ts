// Dentora's Worker (dentora-api), served at https://dentora.raqeem.dev and https://dentora-api.almutafawiqin.workers.dev.
// Static files (public/) are answered by Cloudflare before this runs; the Worker renders the landing page, the legal
// pages, the key activation page, the user guide (guide/) and the video course pages (videos/), counts downloads,
// serves the control panel page and the API, and answers everything else with a 404 page. Routes and rules: SPEC.md.
import { TOPICS, topicBySlug } from '../guide/index'
import { renderGuideHome, renderGuideTopic, type GuideImages } from '../guide/render'
import { CHAPTERS, chapterBySlug } from '../videos/index'
import { recordOf, renderVideoChapter, renderVideosHome } from '../videos/render'
import type { VideoManifest } from '../videos/types'
import { handleApi } from './api'
import { addressKey } from './auth'
import { countDownload, deploymentSalt, ensureSchema, getSettingsCached, type Platform } from './db'
import { apiError, b64url, CACHE_PAGE, clientIp, html, NO_STORE, secure, text, PUBLIC_CSP } from './http'
import { formatDeviceInput, isDeviceNumber } from './licence'
import { renderActivate } from './pages/activate'
import { renderCompare } from './pages/compare'
import { renderLanding } from './pages/landing'
import { renderLlmsFull, renderLlmsTxt } from './pages/llms'
import { renderLegal, sellerWa, type LegalDoc, type PageAssets } from './pages/legal'
import { renderNotFound } from './pages/notfound'
import { HREFLANG, SITE_LANGS, type SiteLang } from './site-lang'
import { sitemapXml } from './sitemap'
import { DEFAULT_SETTINGS, ORIGIN, type Env, type LandingContext, type Lang, type SiteSettings } from './types'

// ---- what build-public.mjs published (fixed for a deployment, so read once per isolate) --------------------------
/** The Windows installer, published in parts (scripts/build-public.mjs): streamed back to back as one file. */
interface WindowsSetup { version: string; sizeBytes: number; parts: { path: string; size: number }[] }
interface Published {
  files: Set<string>
  apk: LandingContext['apk']
  windows: WindowsSetup | null
  /** The guide's pictures and their sizes (site/img/guide/manifest.json); null when none are published. */
  guideImages: GuideImages | null
  /** The recorded chapters of the video course (site/videos/manifest.json); null until the first one is published. */
  videos: VideoManifest | null
}
let published: Promise<Published> | null = null
async function readPublished(env: Env, base: string): Promise<Published> {
  // A file that is not JSON, or not an object, counts as absent (the page then shows what it can); a failure to
  // reach the files at all is thrown, so getPublished() reads again on the next request instead of caching it.
  const get = async <T extends object>(path: string): Promise<T | null> => {
    const res = await env.ASSETS.fetch(new Request(new URL(path, base)))
    if (!res.ok) return null
    try {
      const v: unknown = await res.json()
      return v && typeof v === 'object' && !Array.isArray(v) ? v as T : null
    } catch { return null }
  }
  const manifest = await get<{ files: string[] }>('/files/manifest.json')
  const files = new Set(Array.isArray(manifest?.files) ? manifest.files : [])
  const meta = files.has('/files/meta.json') ? await get<{ version: string; sizeBytes: number }>('/files/meta.json') : null
  const win = files.has('/files/windows.json') ? await get<WindowsSetup>('/files/windows.json') : null
  const guideImages = files.has('/img/guide/manifest.json') ? await get<GuideImages>('/img/guide/manifest.json') : null
  const videos = files.has('/videos/manifest.json') ? await get<VideoManifest>('/videos/manifest.json') : null
  return {
    files,
    apk: meta && files.has('/files/dentora.apk') ? { version: String(meta.version), sizeBytes: Number(meta.sizeBytes) } : null,
    windows: win && isWholeSetup(win, files) ? { version: String(win.version), sizeBytes: win.sizeBytes, parts: win.parts } : null,
    guideImages,
    videos,
  }
}
/** Every part is published and the parts add up to the installer: never serve a file with a piece missing. */
function isWholeSetup(w: WindowsSetup, files: Set<string>): boolean {
  if (!Array.isArray(w.parts) || !w.parts.length || !(w.sizeBytes > 0)) return false
  let total = 0
  for (const p of w.parts) {
    if (typeof p?.path !== 'string' || !files.has(p.path) || !(p.size > 0)) return false
    total += p.size
  }
  return total === w.sizeBytes
}
/** Never fails a page: on an error it answers "nothing published" and the next request reads again. */
async function getPublished(env: Env, base: string): Promise<Published> {
  published ??= readPublished(env, base)
  try {
    return await published
  } catch (e) {
    published = null
    console.error('published files unavailable:', e instanceof Error ? e.message : String(e))
    return { files: new Set(), apk: null, windows: null, guideImages: null, videos: null }
  }
}
const pageAssets = (p: Published): PageAssets => ({
  siteCss: p.files.has('/css/site.css'), favicon: p.files.has('/favicon.svg'), manifest: p.files.has('/site.webmanifest'),
})

/** The settings, or the defaults if the database cannot be read: public pages keep working through a D1 hiccup. */
async function settingsOrDefault(env: Env): Promise<SiteSettings> {
  try {
    await ensureSchema(env.DB)
    return await getSettingsCached(env.DB)
  } catch (e) {
    console.error('settings unavailable, using defaults:', e instanceof Error ? e.message : String(e))
    return { ...DEFAULT_SETTINGS }
  }
}
/**
 * Counts a download once per visitor, platform and day. Not counted: a request the browser itself marks as not a
 * visit (a prefetch, or a fetch/image from another page: Sec-Fetch-Mode other than navigate). The visitor is a salted
 * hash of the address (its /64 for IPv6), so the database never holds the address itself.
 */
async function count(request: Request, env: Env, platform: Platform): Promise<void> {
  const mode = request.headers.get('Sec-Fetch-Mode')
  if ((mode && mode !== 'navigate') || /prefetch/i.test(request.headers.get('Sec-Purpose') || request.headers.get('Purpose') || '')) return
  try {
    await ensureSchema(env.DB)
    const salt = await deploymentSalt(env.DB)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`download|${salt}|${addressKey(clientIp(request))}`))
    await countDownload(env.DB, platform, b64url(new Uint8Array(digest).subarray(0, 16)))
  } catch (e) { console.error('download not counted:', e instanceof Error ? e.message : String(e)) }
}

// ---- pages -------------------------------------------------------------------------------------------------------
async function notFound(env: Env, base: string): Promise<Response> {
  return html(renderNotFound(ORIGIN, pageAssets(await getPublished(env, base))), 404, 'public, max-age=60', { 'Content-Security-Policy': PUBLIC_CSP })
}

// The marketing pages: the home page and the comparison, in every site language (Arabic at the root, /en, /fr…).
const MARKETING: Record<string, [SiteLang, 'home' | 'compare']> = Object.fromEntries(SITE_LANGS.flatMap(l => [
  [l === 'ar' ? '/' : `/${l}`, [l, 'home']],
  [l === 'ar' ? '/compare' : `/${l}/compare`, [l, 'compare']],
]))
const LEGAL: Record<string, [LegalDoc, Lang]> = {
  '/privacy': ['privacy', 'ar'], '/en/privacy': ['privacy', 'en'], '/terms': ['terms', 'ar'], '/en/terms': ['terms', 'en'],
}
const ACTIVATE: Record<string, Lang> = { '/activate': 'ar', '/en/activate': 'en' }
// /guide, /guide/<slug>, /videos, /videos/<slug>, each also under /en. A slug is kebab-case (guide/types.ts); anything
// else under these paths (a file name, upper case) is no page and gets the 404 page.
const GUIDE_RE = /^(\/en)?\/guide(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/
const VIDEOS_RE = /^(\/en)?\/videos(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/
// /videos/<lang>/<chapter>.mp4: a recorded chapter's video, answered by videoFile() (the file is published under /files/).
const VIDEO_FILE_RE = /^\/videos\/(ar|en)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.mp4$/

function robots(): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /download/', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n')
}
// ---- downloads ---------------------------------------------------------------------------------------------------
async function downloadAndroid(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const pub = await getPublished(env, url.href)
  if (!pub.apk) return notFound(env, url.href)
  const range = request.headers.get('Range')
  const asset = await env.ASSETS.fetch(new Request(new URL('/files/dentora.apk', url), { headers: range ? { Range: range } : {} }))
  if (asset.status === 416) {
    return new Response(null, { status: 416, headers: { 'Content-Range': asset.headers.get('Content-Range') || `bytes */${pub.apk.sizeBytes}`, 'Cache-Control': NO_STORE } })
  }
  if (!asset.ok) return notFound(env, url.href)
  // A download is a GET answered from the first byte: not a HEAD, not the rest of an interrupted download (judged
  // by what is served, as the static file layer may answer a range request with the whole file).
  const fromStart = asset.status === 200 || /^bytes 0-/.test(asset.headers.get('Content-Range') || '')
  if (request.method === 'GET' && fromStart) ctx.waitUntil(count(request, env, 'android'))
  const headers = new Headers({
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="Dentora-${pub.apk.version}.apk"`,
    'Cache-Control': NO_STORE,
  })
  for (const h of ['Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
    const v = asset.headers.get(h)
    if (v) headers.set(h, v)
  }
  return new Response(asset.body, { status: asset.status, headers })
}

const WINDOWS_ASK: Record<Lang, string> = {
  ar: 'مرحباً، أريد نسخة ويندوز من برنامج Dentora لإدارة عيادة الأسنان.',
  en: 'Hello, I would like the Windows version of Dentora, the dental clinic software.',
}
/**
 * The installer published on this Worker when there is one, else the settings' link, else WhatsApp. The installer's
 * parts are piped one after the other into a FixedLengthStream (its Content-Length is the whole file), which the
 * runtime streams without running JavaScript per chunk. No ranges: a resumed download starts again from the start.
 */
async function downloadWindows(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const pub = await getPublished(env, url.href)
  if (pub.windows) return windowsSetup(request, env, ctx, url, pub.windows)
  const s = await settingsOrDefault(env)
  if (request.method === 'GET') ctx.waitUntil(count(request, env, 'windows'))
  // The English page's link (?lang=en, or the referring /en page) asks in English.
  let lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ar'
  try { if (new URL(request.headers.get('Referer') || '').pathname.startsWith('/en')) lang = 'en' } catch { /* no referrer */ }
  const target = s.windowsUrl || `${sellerWa(s.whatsapp)}?text=${encodeURIComponent(WINDOWS_ASK[lang])}`
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': NO_STORE } })
}

function windowsSetup(request: Request, env: Env, ctx: ExecutionContext, url: URL, w: WindowsSetup): Response {
  const headers = new Headers({
    'Content-Type': 'application/vnd.microsoft.portable-executable',
    'Content-Disposition': `attachment; filename="Dentora-Setup-${w.version}.exe"`,
    'Content-Length': String(w.sizeBytes),
    'Accept-Ranges': 'none',
    'Cache-Control': NO_STORE,
  })
  if (request.method !== 'GET') return new Response(null, { status: 200, headers })
  // Only a download from the first byte counts: no Range, or one that starts at byte 0 (download managers send that on
  // their first request). A resume (a Range from a later byte) gets the whole file but is not counted again.
  const range = request.headers.get('Range')
  if (!range || /^bytes=0-/.test(range)) ctx.waitUntil(count(request, env, 'windows'))
  const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(w.sizeBytes) : new TransformStream<Uint8Array, Uint8Array>()
  ctx.waitUntil((async () => {
    try {
      for (const part of w.parts) {
        const res = await env.ASSETS.fetch(new Request(new URL(part.path, url)))
        if (!res.ok || !res.body) throw new Error(`${part.path}: ${res.status}`)
        await res.body.pipeTo(writable, { preventClose: true })
      }
      await writable.close()
    } catch (e) {
      console.error('windows download failed:', e instanceof Error ? e.message : String(e))
      await writable.abort(e).catch(() => {})
    }
  })())
  return new Response(readable, { status: 200, headers })
}

/** The edge cache of this data centre (absent outside the Workers runtime, e.g. in the tests). */
const edgeCache = (): Cache | undefined => (globalThis as { caches?: { default?: Cache } }).caches?.default
/** The request headers the edge cache answers by itself: byte ranges (206) and revalidation (304). */
const CACHE_ASKS = ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']

/**
 * /videos/<lang>/<chapter>.mp4, a chapter of the video course that is in the manifest. The static file layer answers a
 * Range request with the whole file, and Safari (iPhone, Mac) plays a video only from a server that answers ranges;
 * every browser also needs them to jump ahead before the file has arrived. So build-public.mjs publishes the videos
 * under /files/videos/ and this answers them from the edge cache, whose match() serves ranges and conditional requests
 * itself, without JavaScript per byte. On a miss (the first request in a data centre, or an evicted file) the file is
 * put in the cache first; the cache key carries the file's sha256, so a re-recorded chapter is never answered from the
 * old one. Without a cache (workers.dev, the tests) the whole file is answered, without Accept-Ranges.
 */
async function videoFile(request: Request, env: Env, url: URL, lang: Lang, slug: string): Promise<Response> {
  const pub = await getPublished(env, url.href)
  const rec = recordOf(pub.videos, lang, slug)
  const file = `/files/videos/${lang}/${slug}.mp4`
  if (!rec || !pub.files.has(file)) return notFound(env, url.href)
  const key = `${url.origin}/videos/${lang}/${slug}.mp4?sha256=${rec.sha256}`
  const ask = () => {
    const headers = new Headers()
    for (const h of CACHE_ASKS) { const v = request.headers.get(h); if (v) headers.set(h, v) }
    return new Request(key, { headers })
  }
  const whole = async (): Promise<Response | null> => {
    const asset = await env.ASSETS.fetch(new Request(new URL(file, url)))
    if (!asset.ok || !asset.body) return null
    const size = Number(asset.headers.get('Content-Length')) || rec.sizeBytes
    const body = typeof FixedLengthStream === 'function' ? asset.body.pipeThrough(new FixedLengthStream(size)) : asset.body
    const headers = new Headers({ 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Cache-Control': 'public, max-age=604800', ETag: `"${rec.sha256}"` })
    const recorded = Date.parse(rec.recordedAt ?? '')
    if (Number.isFinite(recorded)) headers.set('Last-Modified', new Date(recorded).toUTCString())
    return new Response(body, { status: 200, headers })
  }
  const cache = edgeCache()
  if (cache) {
    try {
      const hit = await cache.match(ask())
      if (hit) return hit
      const res = await whole()
      if (!res) return notFound(env, url.href)
      await cache.put(key, res)
      const put = await cache.match(ask())
      if (put) return put
    } catch (e) {
      console.error('video cache failed:', e instanceof Error ? e.message : String(e))
    }
  }
  const res = await whole()
  if (!res) return notFound(env, url.href)
  res.headers.set('Accept-Ranges', 'none')
  return res
}

/**
 * /files/meta.json and /files/windows.json: what is published of the APK and the Windows installer (version, size,
 * sha256, the installer's parts), served only while the download they describe is served too, so
 * scripts/fetch-published.mjs can check a downloaded installer against the advertised sha256. The files themselves
 * (the APK, the installer's parts, the manifest of published paths) stay behind /download/* (404 here).
 */
async function publishedJson(env: Env, url: URL): Promise<Response> {
  const pub = await getPublished(env, url.href)
  const served = url.pathname === '/files/meta.json' ? !!pub.apk : !!pub.windows
  const asset = served ? await env.ASSETS.fetch(new Request(new URL(url.pathname, url))) : null
  if (!asset?.ok) return notFound(env, url.href)
  return new Response(asset.body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' } })
}

async function adminPage(env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(new Request(new URL('/admin/index.html', url)))
  if (!res.ok) return notFound(env, url.href)
  return new Response(res.body, {
    // no-transform: Cloudflare injects nothing (Web Analytics' beacon) into the panel; its CSP would refuse it anyway
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `${NO_STORE}, no-transform`, 'X-Robots-Tag': 'noindex' },
  })
}

// ---- router ------------------------------------------------------------------------------------------------------
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  if (path === '/api' || path.startsWith('/api/')) return handleApi(request, env, url)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': NO_STORE } })
  }
  // One address per page: /en/ → /en, /privacy/ → /privacy (the panel keeps both /admin and /admin/). The target
  // starts with exactly one slash: "//evil.example/" must not turn into "//evil.example", a link to another site.
  if (path.length > 1 && path.endsWith('/') && path !== '/admin/') {
    const clean = '/' + path.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '')
    return new Response(null, { status: 301, headers: { Location: clean + url.search, 'Cache-Control': CACHE_PAGE } })
  }

  const marketing = MARKETING[path]
  if (marketing) {
    const [lang, page] = marketing
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    const windows = pub.windows && { version: pub.windows.version, sizeBytes: pub.windows.sizeBytes }
    const ctx: LandingContext = { apk: pub.apk, windows, origin: ORIGIN }
    return html(page === 'home' ? renderLanding(lang, s, ctx) : renderCompare(lang, s, ctx), 200, CACHE_PAGE, { 'Content-Language': HREFLANG[lang], 'Content-Security-Policy': PUBLIC_CSP })
  }
  const legal = LEGAL[path]
  if (legal) {
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    return html(renderLegal(legal[0], legal[1], s, ORIGIN, pageAssets(pub)), 200, CACHE_PAGE, { 'Content-Language': legal[1], 'Content-Security-Policy': PUBLIC_CSP })
  }
  const activateLang = ACTIVATE[path]
  if (activateLang) {
    // ?device= (the app's "activate in the browser" link) fills in the device number, only when it is one.
    const asked = url.searchParams.get('device') || ''
    const device = isDeviceNumber(asked) ? formatDeviceInput(asked) : ''
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    return html(renderActivate(activateLang, s, ORIGIN, pageAssets(pub), device), 200, CACHE_PAGE, { 'Content-Language': activateLang, 'Content-Security-Policy': PUBLIC_CSP })
  }
  const guide = GUIDE_RE.exec(path)
  if (guide) {
    const lang: Lang = guide[1] ? 'en' : 'ar'
    const topic = guide[2] === undefined ? null : topicBySlug(guide[2])
    if (guide[2] !== undefined && !topic) return notFound(env, url.href)
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    const page = topic
      ? renderGuideTopic(lang, s, ORIGIN, pageAssets(pub), topic, TOPICS, pub.guideImages)
      : renderGuideHome(lang, s, ORIGIN, pageAssets(pub), TOPICS)
    return html(page, 200, CACHE_PAGE, { 'Content-Language': lang, 'Content-Security-Policy': PUBLIC_CSP })
  }
  const video = VIDEO_FILE_RE.exec(path)
  if (video) return videoFile(request, env, url, video[1] as Lang, video[2])
  const videos = VIDEOS_RE.exec(path)
  if (videos) {
    const lang: Lang = videos[1] ? 'en' : 'ar'
    const chapter = videos[2] === undefined ? null : chapterBySlug(videos[2])
    if (videos[2] !== undefined && !chapter) return notFound(env, url.href)
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    // ?t=<seconds> (a transcript's time link used without JavaScript, or a shared moment) starts the video there
    const t = Number(url.searchParams.get('t'))
    const page = chapter
      ? renderVideoChapter(lang, s, ORIGIN, pageAssets(pub), chapter, CHAPTERS, pub.videos, Number.isFinite(t) && t > 0 ? { t } : {})
      : renderVideosHome(lang, s, ORIGIN, pageAssets(pub), CHAPTERS, pub.videos)
    return html(page, 200, CACHE_PAGE, { 'Content-Language': lang, 'Content-Security-Policy': PUBLIC_CSP })
  }
  switch (path) {
    case '/healthz': return text('ok', 200, 'text/plain', NO_STORE)
    case '/robots.txt': return text(robots(), 200, 'text/plain', 'public, max-age=3600')
    case '/sitemap.xml': {
      const pub = await getPublished(env, url.href)
      return text(sitemapXml({ origin: ORIGIN, guideImages: pub.guideImages, videos: pub.videos }), 200, 'application/xml', 'public, max-age=3600')
    }
    case '/llms.txt': case '/llms-full.txt': {
      const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
      const windows = pub.windows && { version: pub.windows.version, sizeBytes: pub.windows.sizeBytes }
      const input = { s, ctx: { apk: pub.apk, windows, origin: ORIGIN }, videos: pub.videos }
      return text(path === '/llms.txt' ? renderLlmsTxt(input) : renderLlmsFull(input), 200, 'text/plain', CACHE_PAGE)
    }
    case '/admin': case '/admin/': return adminPage(env, url)
    case '/download/android': return downloadAndroid(request, env, ctx, url)
    case '/download/windows': return downloadWindows(request, env, ctx, url)
    case '/files/meta.json': case '/files/windows.json': return publishedJson(env, url)
  }
  // Anything else that reached the Worker is not a file (or is /files/*, published only through /download/*, and
  // the two JSON files above), or /videos/<file> and /guide/<file> that do not exist.
  return notFound(env, url.href)
}

const SERVER_ERROR = 'حدث خطأ مؤقت، حاولوا مرة أخرى بعد قليل.\nA temporary error occurred, please try again shortly.\n'

// The site's own host; the Worker also answers on its workers.dev address (wrangler.toml), which search engines must
// not index as a second copy of the site (the pages' canonical links already point here).
const SITE_HOST = new URL(ORIGIN).hostname
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    // Plain http:// on the site's own host goes to https:// (HSTS only applies once a browser has seen https).
    if (url.protocol === 'http:' && url.hostname === SITE_HOST) {
      url.protocol = 'https:'
      return secure(new Response(null, { status: 301, headers: { Location: url.href, 'Cache-Control': CACHE_PAGE } }))
    }
    let res: Response
    try {
      res = await route(request, env, ctx)
    } catch (e) {
      // The message only (never the request body or env): it names the failing step, not the secrets.
      console.error('request failed:', request.method, new URL(request.url).pathname, e instanceof Error ? e.message : String(e))
      res = new URL(request.url).pathname.startsWith('/api/') ? apiError('server', 500) : text(SERVER_ERROR, 500, 'text/plain', NO_STORE)
    }
    if (request.method === 'HEAD') res = new Response(null, res)
    const out = secure(res)
    if (url.hostname !== SITE_HOST && !LOCAL_HOST.test(url.hostname)) out.headers.set('X-Robots-Tag', 'noindex')
    return out
  },
} satisfies ExportedHandler<Env>
