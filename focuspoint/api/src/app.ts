// The built web app ([assets], web/dist) with the site content written into it:
//  - index.html (the SPA shell, for every page path): <title>, description, Open Graph / Twitter tags, JSON-LD, the brand
//    colour and window.__FP_BOOT__ = {content, settings}, so the first paint and link previews show the admin's edits;
//  - /manifest.webmanifest: the installed app's name / short name / description.
// Safety first (the editor is used live): if the content, the settings or the rewrite fail in any way, the original
// file is served untouched — the site can look outdated for a moment, but it never breaks.
import { loadContent } from './content'
import type { Env } from './env'
import { publicUrl } from './env'
import { loadSettings, publicSettings } from './settings'
import { bootScript, brandStyle, headValues, jsonLd, patchManifest, scriptJson } from './site'

/** Paths whose response the Worker may rewrite: page routes (no extension), .html files and the manifest. */
const isPagePath = (p: string): boolean => !/\.[A-Za-z0-9]+$/.test(p) || p.endsWith('.html') || p === '/manifest.webmanifest'

/** Rewritten responses carry no validator (their body depends on the content), so drop the asset's own conditionals. */
function unconditional(req: Request, url: URL): Request {
  if (!isPagePath(url.pathname) || (!req.headers.has('If-None-Match') && !req.headers.has('If-Modified-Since'))) return req
  const headers = new Headers(req.headers)
  headers.delete('If-None-Match')
  headers.delete('If-Modified-Since')
  return new Request(req.url, { method: req.method, headers })
}

function freshHeaders(from: Headers, type?: string): Headers {
  const h = new Headers(from)
  for (const k of ['ETag', 'Last-Modified', 'Content-Length']) h.delete(k)
  h.set('Cache-Control', 'no-cache')
  if (type) h.set('Content-Type', type)
  return h
}

export async function serveApp(req: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) return new Response('Focus Point API. The web app is not built (web/dist missing).', { status: 404 })
  const url = new URL(req.url)
  const asset = unconditional(req, url)
  let res = await env.ASSETS.fetch(asset)
  if (res.status === 404 && (req.method === 'GET' || req.method === 'HEAD')) {
    const index = new URL('/index.html', req.url)       // SPA fallback: deep links like /admin/bookings/12
    res = await env.ASSETS.fetch(new Request(index.toString(), { method: 'GET', headers: asset.headers }))
  }
  if (req.method !== 'GET' || res.status !== 200) return res
  if (url.pathname === '/manifest.webmanifest') return manifest(res, env)
  if (!(res.headers.get('Content-Type') ?? '').toLowerCase().startsWith('text/html')) return res
  return page(res, env, url)
}

async function manifest(res: Response, env: Env): Promise<Response> {
  const text = await res.text()
  try {
    const [content, settings] = await Promise.all([loadContent(env.DB), loadSettings(env.DB, env)])
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('manifest is not an object')
    const body = JSON.stringify(patchManifest(parsed as Record<string, unknown>, settings, content))
    return new Response(body, { status: 200, headers: freshHeaders(res.headers, 'application/manifest+json') })
  } catch (err) {
    console.error('manifest: serving the built file', err)
    return new Response(text, { status: res.status, headers: res.headers })
  }
}

/** Only the SPA shell is rewritten (it has the React root); other HTML files (privacy.html) are served as built. */
const isShell = (html: string): boolean => html.includes('id="root"')

async function page(res: Response, env: Env, url: URL): Promise<Response> {
  const html = await res.text()
  const original = () => new Response(html, { status: res.status, headers: res.headers })
  if (!isShell(html)) return original()
  try {
    const [content, settings] = await Promise.all([loadContent(env.DB), loadSettings(env.DB, env)])
    const origin = publicUrl(env, url.origin)
    const head = headValues(settings, content, origin, url.pathname)
    const ld = scriptJson(jsonLd(settings, content, origin))
    const tail = brandStyle(content) + bootScript(content, publicSettings(settings))
    const meta = (attr: 'name' | 'property', key: string, value: string) =>
      [`meta[${attr}="${key}"]`, { element: (el: Element) => { el.setAttribute('content', value) } }] as const
    const handlers: (readonly [string, HTMLRewriterElementContentHandlers])[] = [
      ['title', { element: (el) => { el.setInnerContent(head.title) } }],
      meta('name', 'description', head.description),
      ['link[rel="canonical"]', { element: (el) => { el.setAttribute('href', head.canonical) } }],
      meta('property', 'og:site_name', head.og.site_name),
      meta('property', 'og:url', head.og.url),
      meta('property', 'og:title', head.og.title),
      meta('property', 'og:description', head.og.description),
      meta('property', 'og:image', head.og.image),
      meta('property', 'og:image:width', head.og.image_width),
      meta('property', 'og:image:height', head.og.image_height),
      meta('property', 'og:image:alt', head.og.image_alt),
      meta('name', 'twitter:title', head.og.title),
      meta('name', 'twitter:description', head.og.description),
      meta('name', 'twitter:image', head.og.image),
      meta('name', 'apple-mobile-web-app-title', head.app_title),
      meta('name', 'application-name', head.app_title),
      ['script[type="application/ld+json"]', { element: (el) => { el.setInnerContent(ld, { html: true }) } }],
      ['head', { element: (el) => { el.append(tail, { html: true }) } }],
    ]
    let rw = new HTMLRewriter()
    for (const [sel, h] of handlers) rw = rw.on(sel, h)
    // Read the whole result here, inside the try: a failure half-way through must fall back, not cut the page.
    const out = await rw.transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).text()
    return new Response(out, { status: 200, headers: freshHeaders(res.headers) })
  } catch (err) {
    console.error('index.html: serving the built file', err)
    return original()
  }
}
