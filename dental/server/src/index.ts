// Dentora's Worker (dentora-api), served at https://dentora.raqeem.dev and https://dentora-api.almutafawiqin.workers.dev.
// Static files (public/) are answered by Cloudflare before this runs; the Worker renders the landing page and the
// legal pages, counts downloads, serves the control panel page and its API, and answers everything else with a 404
// page. Routes and rules: SPEC.md.
import { handleApi } from './api'
import { addressKey } from './auth'
import { countDownload, deploymentSalt, ensureSchema, getSettingsCached, type Platform } from './db'
import { apiError, b64url, CACHE_PAGE, clientIp, html, NO_STORE, secure, text } from './http'
import { renderLanding } from './pages/landing'
import { LEGAL_DATE, langPath, renderLegal, sellerWa, type LegalDoc, type PageAssets } from './pages/legal'
import { renderNotFound } from './pages/notfound'
import { DEFAULT_SETTINGS, type Env, type LandingContext, type Lang, type SiteSettings } from './types'

/** The canonical address (canonical, hreflang, sitemap): the workers.dev copy points search engines here. Not exported:
 * the main module may only export handlers. */
const ORIGIN = 'https://dentora.raqeem.dev'

// ---- what build-public.mjs published (fixed for a deployment, so read once per isolate) --------------------------
interface Published { files: Set<string>; apk: LandingContext['apk'] }
let published: Promise<Published> | null = null
async function readPublished(env: Env, base: string): Promise<Published> {
  const get = async <T>(path: string): Promise<T | null> => {
    const res = await env.ASSETS.fetch(new Request(new URL(path, base)))
    return res.ok ? (await res.json()) as T : null
  }
  const manifest = await get<{ files: string[] }>('/files/manifest.json')
  const files = new Set(manifest?.files ?? [])
  const meta = files.has('/files/meta.json') ? await get<{ version: string; sizeBytes: number }>('/files/meta.json') : null
  return { files, apk: meta && files.has('/files/dentora.apk') ? { version: String(meta.version), sizeBytes: Number(meta.sizeBytes) } : null }
}
/** Never fails a page: on an error it answers "nothing published" and the next request reads again. */
async function getPublished(env: Env, base: string): Promise<Published> {
  published ??= readPublished(env, base)
  try {
    return await published
  } catch (e) {
    published = null
    console.error('published files unavailable:', e instanceof Error ? e.message : String(e))
    return { files: new Set(), apk: null }
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
  return html(renderNotFound(ORIGIN, pageAssets(await getPublished(env, base))), 404, 'public, max-age=60')
}

const LEGAL: Record<string, [LegalDoc, Lang]> = {
  '/privacy': ['privacy', 'ar'], '/en/privacy': ['privacy', 'en'], '/terms': ['terms', 'ar'], '/en/terms': ['terms', 'en'],
}

function robots(): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /download/', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n')
}
function sitemap(): string {
  const pages: [string, string, string][] = [['/', 'weekly', '1.0'], ['/privacy', 'yearly', '0.3'], ['/terms', 'yearly', '0.3']]
  const urls = pages.flatMap(([path, freq, priority]) => (['ar', 'en'] as Lang[]).map(lang => {
    const alt = (['ar', 'en'] as Lang[]).map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${langPath(path, l)}"/>`).join('')
    const lastmod = path === '/' ? '' : `<lastmod>${LEGAL_DATE}</lastmod>`
    return `<url><loc>${ORIGIN}${langPath(path, lang)}</loc>${alt}<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${path}"/>${lastmod}<changefreq>${freq}</changefreq><priority>${priority}</priority></url>`
  }))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
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
async function downloadWindows(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const s = await settingsOrDefault(env)
  if (request.method === 'GET') ctx.waitUntil(count(request, env, 'windows'))
  // The English page's link (?lang=en, or the referring /en page) asks in English.
  let lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'ar'
  try { if (new URL(request.headers.get('Referer') || '').pathname.startsWith('/en')) lang = 'en' } catch { /* no referrer */ }
  const target = s.windowsUrl || `${sellerWa(s.whatsapp)}?text=${encodeURIComponent(WINDOWS_ASK[lang])}`
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': NO_STORE } })
}

async function adminPage(env: Env, url: URL): Promise<Response> {
  const res = await env.ASSETS.fetch(new Request(new URL('/admin/index.html', url)))
  if (!res.ok) return notFound(env, url.href)
  return new Response(res.body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': NO_STORE, 'X-Robots-Tag': 'noindex' },
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

  if (path === '/' || path === '/en') {
    const lang: Lang = path === '/en' ? 'en' : 'ar'
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    return html(renderLanding(lang, s, { apk: pub.apk, origin: ORIGIN }), 200, CACHE_PAGE, { 'Content-Language': lang })
  }
  const legal = LEGAL[path]
  if (legal) {
    const [s, pub] = await Promise.all([settingsOrDefault(env), getPublished(env, url.href)])
    return html(renderLegal(legal[0], legal[1], s, ORIGIN, pageAssets(pub)), 200, CACHE_PAGE, { 'Content-Language': legal[1] })
  }
  switch (path) {
    case '/healthz': return text('ok', 200, 'text/plain', NO_STORE)
    case '/robots.txt': return text(robots(), 200, 'text/plain', 'public, max-age=3600')
    case '/sitemap.xml': return text(sitemap(), 200, 'application/xml', 'public, max-age=3600')
    case '/admin': case '/admin/': return adminPage(env, url)
    case '/download/android': return downloadAndroid(request, env, ctx, url)
    case '/download/windows': return downloadWindows(request, env, ctx, url)
  }
  // Anything else that reached the Worker is not a file (or is /files/*, published only through /download/*).
  return notFound(env, url.href)
}

const SERVER_ERROR = 'حدث خطأ مؤقت، حاولوا مرة أخرى بعد قليل.\nA temporary error occurred, please try again shortly.\n'

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let res: Response
    try {
      res = await route(request, env, ctx)
    } catch (e) {
      // The message only (never the request body or env): it names the failing step, not the secrets.
      console.error('request failed:', request.method, new URL(request.url).pathname, e instanceof Error ? e.message : String(e))
      res = new URL(request.url).pathname.startsWith('/api/') ? apiError('server', 500) : text(SERVER_ERROR, 500, 'text/plain', NO_STORE)
    }
    if (request.method === 'HEAD') res = new Response(null, res)
    return secure(res)
  },
} satisfies ExportedHandler<Env>
