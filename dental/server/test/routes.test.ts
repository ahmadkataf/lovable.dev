// The Worker's router for the key activation page and the public API, through its fetch handler (security headers
// included). The page itself is replaced by a stub here (it has its own tests): what is checked is what the router
// hands it and how the answer is served.
import { describe, expect, it, vi } from 'vitest'
import { CACHE_PAGE, PUBLIC_CSP } from '../src/http'
import worker from '../src/index'
import { renderActivate } from '../src/pages/activate'
import { DEFAULT_SETTINGS, type Env } from '../src/types'
import { memoryD1 } from './d1'

vi.mock('../src/pages/activate', () => ({ renderActivate: vi.fn(() => '<!doctype html><title>Dentora</title>') }))

const ORIGIN = 'https://dentora.raqeem.dev'
// No published files: every ASSETS lookup answers 404 (the pages then leave site.css, the favicon and the manifest out).
const env: Env = { DB: memoryD1(), ASSETS: { fetch: async () => new Response('', { status: 404 }) } as unknown as Fetcher }
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext
const fetchPath = (path: string, init?: RequestInit) => worker.fetch(new Request(ORIGIN + path, init) as Parameters<typeof worker.fetch>[0], env, ctx)
const NO_ASSETS = { siteCss: false, favicon: false, manifest: false }

describe('the activation page', () => {
  it('is served at /activate and /en/activate like the legal pages', async () => {
    for (const [path, lang] of [['/activate', 'ar'], ['/en/activate', 'en']] as const) {
      vi.mocked(renderActivate).mockClear()
      const r = await fetchPath(path)
      expect(r.status).toBe(200)
      expect(r.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(r.headers.get('Cache-Control')).toBe(CACHE_PAGE)
      expect(r.headers.get('Content-Security-Policy')).toBe(PUBLIC_CSP)
      expect(r.headers.get('Content-Language')).toBe(lang)
      expect(r.headers.get('X-Frame-Options')).toBe('DENY')
      expect(renderActivate).toHaveBeenCalledWith(lang, DEFAULT_SETTINGS, ORIGIN, NO_ASSETS, '')
    }
  })
  it('passes on ?device= only when it is a device number, formatted', async () => {
    const asked = async (query: string) => {
      vi.mocked(renderActivate).mockClear()
      expect((await fetchPath(`/en/activate${query}`)).status).toBe(200)
      return vi.mocked(renderActivate).mock.calls[0][4]
    }
    expect(await asked('?device=ab2cd3ef')).toBe('AB2C-D3EF')
    expect(await asked('?device=AB2C-D3EF')).toBe('AB2C-D3EF')
    expect(await asked(`?device=${encodeURIComponent('AB٢C-D٣EF')}`)).toBe('AB2C-D3EF')
    expect(await asked('?device=AB1C-D3EF')).toBe('')
    expect(await asked(`?device=${encodeURIComponent('"><script>alert(1)</script>')}`)).toBe('')
    expect(await asked('?device=')).toBe('')
  })
  it('drops a trailing slash and answers HEAD', async () => {
    const slash = await fetchPath('/activate/?device=AB2C-D3EF')
    expect([slash.status, slash.headers.get('Location')]).toEqual([301, '/activate?device=AB2C-D3EF'])
    const head = await fetchPath('/en/activate', { method: 'HEAD' })
    expect([head.status, await head.text()]).toEqual([200, ''])
  })
  it('is in the sitemap, in both languages, and robots.txt lets crawlers in', async () => {
    const map = await (await fetchPath('/sitemap.xml')).text()
    const locs = [...map.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    expect(locs).toEqual(['/', '/en', '/activate', '/en/activate', '/privacy', '/en/privacy', '/terms', '/en/terms'].map(p => ORIGIN + p))
    expect(map).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/activate"/>`)
    expect((map.match(/<lastmod>/g) || []).length).toBe(4)
    const robots = await (await fetchPath('/robots.txt')).text()
    expect(robots.split('\n').filter(l => l.startsWith('Disallow:'))).toEqual(['Disallow: /admin', 'Disallow: /api/', 'Disallow: /download/'])
  })
})

describe('the public API through the Worker', () => {
  it('keeps the CORS headers next to the security headers', async () => {
    const pre = await fetchPath('/api/activate', { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(pre.headers.get('Strict-Transport-Security')).toBeTruthy()
    const r = await fetchPath('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'null' }, body: JSON.stringify({ key: '2345-6789-ABCD-EFGH', device: 'AB2C-D3EF' }) })
    expect([r.status, await r.json()]).toEqual([404, { error: 'unknown' }])
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(r.headers.get('Set-Cookie')).toBeNull()
    const other = await fetchPath('/api/licences', { method: 'OPTIONS', headers: { Origin: 'null' } })
    expect([other.status, other.headers.get('Access-Control-Allow-Origin')]).toEqual([403, null])
  })
})
