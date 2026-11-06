// The activation page (/activate, /en/activate): it renders safely for the CSP, escapes what it is given and fills in
// only a valid device number; the landing page and the legal pages link to it.
import { describe, expect, it } from 'vitest'
import { renderActivate } from '../src/pages/activate'
import { renderLanding } from '../src/pages/landing'
import { renderLegal } from '../src/pages/legal'
import { DEFAULT_SETTINGS } from '../src/types'

const ORIGIN = 'https://dentora.raqeem.dev'
const assets = { siteCss: true, favicon: true, manifest: true }
const page = (lang: 'ar' | 'en', device = '', s = DEFAULT_SETTINGS) => renderActivate(lang, s, ORIGIN, assets, device)

describe('activation page', () => {
  it('has nothing the CSP would block: /js/activate.js and a data block, no style or handler', () => {
    for (const lang of ['ar', 'en'] as const) {
      const html = page(lang)
      expect(html.match(/<script\b[^>]*>/g)).toEqual(['<script src="/js/activate.js" defer>', '<script type="application/json" id="act-text">'])
      // its own stylesheet after the shared ones, in the head
      const head = html.slice(0, html.indexOf('</head>'))
      expect(head.indexOf('/css/legal.css')).toBeGreaterThan(-1)
      expect(head.indexOf('/css/activate.css')).toBeGreaterThan(head.indexOf('/css/legal.css'))
      expect(html).not.toMatch(/\sstyle=|<style|\son[a-z]+=/i)
      expect(html).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${lang === 'en' ? '/en' : ''}/activate">`)
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/activate">`)
      expect(html.match(/<h1>/g)).toHaveLength(1)
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
  it('fills in the device number only when it is one, formatted', () => {
    expect(page('ar', '7kq4m2xd')).toContain('value="7KQ4-M2XD"')
    expect(page('ar', '٧KQ٤-M٢XD')).toContain('value="7KQ4-M2XD"')
    for (const bad of ['7KQ4-M2X', '"><script>alert(1)</script>', 'OOOO-1111']) expect(page('en', bad)).toContain('id="act-device" name="device" type="text" dir="ltr" value=""')
  })
  it('gives the script its words as JSON that cannot close the element', () => {
    const s = { ...DEFAULT_SETTINGS, whatsapp: '+963 </script><script>alert()</script> 912 345 678' }
    const html = page('en', '', s)
    const json = /<script type="application\/json" id="act-text">(.*?)<\/script>/s.exec(html)![1]
    expect(json).not.toMatch(/<|>/)
    const t = JSON.parse(json)
    expect(t.chat).toBe('https://wa.me/963912345678')   // the digits of the setting only
    for (const k of ['deviceEmpty', 'keyEmpty', 'device', 'key', 'code', 'unknown', 'used', 'void', 'expired', 'locked', 'signing', 'network', 'server']) expect(t.err[k]).toBeTruthy()
    expect(t.err.locked).toContain('{time}')
  })
  it('sends help to the seller, or to the default number when the setting is unusable', () => {
    expect(page('ar', '7KQ4M2XD')).toContain('href="https://wa.me/963996489504?text=')
    expect(page('ar', '', { ...DEFAULT_SETTINGS, whatsapp: '12' })).toContain('href="https://wa.me/963996489504?text=')
    expect(decodeURIComponent(/id="act-wa" href="([^"]+)"/.exec(page('en', '7KQ4M2XD'))![1])).toContain('Device number: 7KQ4-M2XD')
  })
})

describe('landing page and the activation page', () => {
  it('links it from the steps, the FAQ and the footer, in both languages; the legal pages’ footer too', () => {
    for (const lang of ['ar', 'en'] as const) {
      const base = lang === 'ar' ? '' : '/en'
      const html = renderLanding(lang, DEFAULT_SETTINGS, { apk: null, origin: ORIGIN })
      expect(html).toContain(`class="step-link" href="${base}/activate"`)
      expect(html).toContain(`<a href="${base}/activate"><bdi dir="ltr">dentora.raqeem.dev${base}/activate</bdi></a>`)
      expect(html).toContain(`<li><a href="${base}/activate">`)
      expect(html).not.toMatch(/\{(activate|price|whatsapp|email)\}/)
      expect(renderLegal('privacy', lang, DEFAULT_SETTINGS, ORIGIN, assets)).toContain(`<a href="${base}/activate">`)
    }
  })
})
