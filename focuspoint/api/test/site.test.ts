// What the Worker writes into index.html and the manifest. With the default content and settings every value must be
// what web/index.html and the PWA manifest (web/vite.config.ts) already say — the site looks the same until an edit.
import { describe, expect, it } from 'vitest'
import indexHtml from '../../web/index.html?raw'
import viteConfig from '../../web/vite.config.ts?raw'
import { DEFAULT_CONTENT, mergeContent, type SiteContent } from '../../shared/content'
import { DEFAULT_SETTINGS, publicSettings } from '../src/settings'
import { bootScript, brandStyle, headValues, jsonLd, pageOf, patchManifest, scriptJson } from '../src/site'

const ORIGIN = 'https://focuspoint.raqeem.dev'
const S = DEFAULT_SETTINGS
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const metaContent = (attr: 'name' | 'property', key: string): string | undefined =>
  indexHtml.match(new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`))?.[1]
const edit = (patch: (c: SiteContent) => void): SiteContent => { const c = mergeContent({}); patch(c); return c }

describe('index.html head with the defaults', () => {
  const h = headValues(S, DEFAULT_CONTENT, ORIGIN, '/book')      // /book uses seo.title, like index.html
  it('title, description, canonical', () => {
    expect(h.title).toBe(indexHtml.match(/<title>([^<]*)<\/title>/)?.[1])
    expect(h.description).toBe(decode(metaContent('name', 'description') ?? ''))
    expect(h.canonical).toBe(indexHtml.match(/<link rel="canonical" href="([^"]*)"/)?.[1])
  })
  it('Open Graph and Twitter tags', () => {
    expect(h.og.site_name).toBe(metaContent('property', 'og:site_name'))
    expect(h.og.url).toBe(metaContent('property', 'og:url'))
    expect(h.og.title).toBe(metaContent('property', 'og:title'))
    expect(h.og.description).toBe(metaContent('property', 'og:description'))
    expect(h.og.image).toBe(metaContent('property', 'og:image'))
    expect(h.og.image_width).toBe(metaContent('property', 'og:image:width'))
    expect(h.og.image_height).toBe(metaContent('property', 'og:image:height'))
    expect(h.og.image_alt).toBe(metaContent('property', 'og:image:alt'))
    expect(h.og.title).toBe(metaContent('name', 'twitter:title'))
    expect(h.og.description).toBe(metaContent('name', 'twitter:description'))
    expect(h.og.image).toBe(metaContent('name', 'twitter:image'))
    expect(h.app_title).toBe(metaContent('name', 'apple-mobile-web-app-title'))
    expect(h.app_title).toBe(metaContent('name', 'application-name'))
  })
  it('JSON-LD: same structure and values', () => {
    const block = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? ''
    expect(jsonLd(S, DEFAULT_CONTENT, ORIGIN)).toEqual(JSON.parse(block))
  })
  it('no brand <style> for the default colour', () => {
    expect(brandStyle(DEFAULT_CONTENT)).toBe('')
  })
})

describe('index.html head after edits', () => {
  it('per-page titles (empty → seo.title), placeholders filled, whitespace collapsed', () => {
    expect(headValues(S, DEFAULT_CONTENT, ORIGIN, '/').title).toBe(DEFAULT_CONTENT.seo.pages.home)
    expect(headValues(S, DEFAULT_CONTENT, ORIGIN, '/spaces/').title).toBe(DEFAULT_CONTENT.seo.pages.spaces)
    expect(headValues(S, DEFAULT_CONTENT, ORIGIN, '/team/today').title).toBe(DEFAULT_CONTENT.seo.title)
    const c = edit((x) => { x.seo.title = '{name} | {slogan}'; x.seo.description = 'سطر\n  تاني {hours}'; x.seo.pages.book = 'احجز عند {name}' })
    const s = { ...S, centre_name: 'مركز جديد' }
    expect(headValues(s, c, ORIGIN, '/b/12').title).toBe(`مركز جديد | ${DEFAULT_CONTENT.brand.slogan}`)
    expect(headValues(s, c, ORIGIN, '/book/3').title).toBe('احجز عند مركز جديد')
    expect(headValues(s, c, ORIGIN, '/').description).toBe('سطر تاني 9 ص – 11 م')
  })
  it('og:image is absolute, from the origin', () => {
    const c = edit((x) => { x.seo.og_image = { src: '/media/0123456789abcdef.webp', alt: 'صورة', w: 1200, h: 630 } })
    expect(headValues(S, c, 'http://127.0.0.1:8797', '/').og.image).toBe('http://127.0.0.1:8797/media/0123456789abcdef.webp')
    expect(jsonLd(S, c, ORIGIN).image).toBe(`${ORIGIN}/media/0123456789abcdef.webp`)
  })
  it('a new brand colour adds its palette', () => {
    const style = brandStyle(edit((x) => { x.theme.brand = '#1d4ed8' }))
    expect(style).toMatch(/^<style id="fp-theme">:root\{.*\}<\/style>$/)
    expect(style).toContain('--brand:#1d4ed8')
    expect(style).toContain('--brand-hover:')
    expect(style).toContain('--brand-50:')
    expect(style).toContain('--brand-100:')
  })
  it('pageOf', () => {
    expect(pageOf('/')).toBe('home')
    expect(pageOf('/about')).toBe('about')
    expect(pageOf('/contact/')).toBe('contact')
    expect(pageOf('/book')).toBe('book')
    expect(pageOf('/book/5')).toBe('book')
    expect(pageOf('/mine')).toBeNull()
  })
})

describe('boot script JSON', () => {
  it('escapes everything that could end the script or open a comment, and stays the same JSON', () => {
    const v = { a: '</script><script>alert(1)</script>', b: '<!-- x -->', c: 'a & b > c', d: 'line\u2028sep\u2029para', e: 'عربي' }
    const out = scriptJson(v)
    expect(out).not.toMatch(/[<>&\u2028\u2029]/)
    expect(JSON.parse(out)).toEqual(v)
    // eslint-disable-next-line no-new-func
    expect(new Function(`return ${out}`)()).toEqual(v)      // also a valid JS literal
  })
  it('carries {content, settings} and only one closing tag', () => {
    const c = edit((x) => { x.announcement = { enabled: true, text: '</script> عرض', link_label: '', link_url: '', tone: 'info' } })
    const settings = publicSettings({ ...S, vapid_public_key: 'k' })
    const html = bootScript(c, settings)
    expect(html.startsWith('<script id="fp-boot">window.__FP_BOOT__=')).toBe(true)
    expect(html.match(/<\/script/g)).toHaveLength(1)
    const json = html.slice('<script id="fp-boot">window.__FP_BOOT__='.length, -'</script>'.length)
    const boot = JSON.parse(json)
    expect(boot).toEqual({ content: c, settings, at: expect.any(Number) })   // at: when the page was made (old saved pages are not trusted)
    expect(Math.abs(boot.at - Date.now())).toBeLessThan(60_000)
  })
})

describe('manifest', () => {
  const built = {
    name: 'فوكس بوينت', short_name: 'Focus Point', description: 'احجز مكانك في فوكس بوينت — درعا',
    start_url: '/', display: 'standalone', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  }
  it('is unchanged with the defaults (and those are the vite config values)', () => {
    for (const v of [built.name, built.short_name, built.description]) expect(viteConfig).toContain(`'${v}'`)
    expect(patchManifest(built, S, DEFAULT_CONTENT)).toEqual(built)
  })
  it('the name follows the centre name until the admin sets an app name', () => {
    expect(patchManifest(built, { ...S, centre_name: 'مركز جديد' }, DEFAULT_CONTENT).name).toBe('مركز جديد')
    const c = edit((x) => { x.seo.app_name = 'تطبيق {name}'; x.seo.app_short_name = 'FP'; x.seo.app_description = 'وصف' })
    expect(patchManifest(built, { ...S, centre_name: 'مركز جديد' }, c)).toEqual({ ...built, name: 'تطبيق مركز جديد', short_name: 'FP', description: 'وصف' })
  })
})
