import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEGAL_DATE, parseLegal, renderDoc, renderLegal } from '../src/pages/legal'
import { renderNotFound } from '../src/pages/notfound'
import { DEFAULT_SETTINGS } from '../src/types'

const assets = { siteCss: true, favicon: true, manifest: true }

describe('legal pages', () => {
  it('use the date of the app’s documents', () => {
    const lib = readFileSync(new URL('../../src/features/legal/lib.ts', import.meta.url), 'utf8')
    expect(lib).toContain(`LEGAL_DATE = '${LEGAL_DATE}'`)
  })
  it('parse the documents’ markup', () => {
    expect(parseLegal('Intro\n\n## Head\n- one\n- two\n\nPara\nnext line')).toEqual([
      { kind: 'p', text: 'Intro' }, { kind: 'h', text: 'Head' }, { kind: 'ul', items: ['one', 'two'] }, { kind: 'p', text: 'Para next line' },
    ])
  })
  it('fill in the seller and the contacts, escaped', () => {
    const s = { ...DEFAULT_SETTINGS, email: 'a<b>@x.co', whatsapp: '+963 996 489 504' }
    const { html, toc } = renderDoc('privacy', 'en', s)
    expect(html).not.toContain('{seller}')
    expect(html).not.toContain('{contact}')
    expect(html).toContain('href="https://wa.me/963996489504"')
    expect(html).toContain('a&lt;b&gt;@x.co')
    expect(html).not.toContain('a<b>')
    expect(toc.length).toBeGreaterThan(8)
  })
  it('have nothing the CSP would block, in both languages', () => {
    for (const doc of ['privacy', 'terms'] as const) for (const lang of ['ar', 'en'] as const) {
      const page = renderLegal(doc, lang, DEFAULT_SETTINGS, 'https://dentora.raqeem.dev', assets)
      expect(page).not.toMatch(/<script|\sstyle=|<style|\son[a-z]+=/i)
      expect(page).toContain(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`)
      expect(page).toContain('href="/css/legal.css"')
      expect(page).toContain(`<link rel="canonical" href="https://dentora.raqeem.dev${lang === 'en' ? '/en' : ''}/${doc}">`)
    }
    const nf = renderNotFound('https://dentora.raqeem.dev', assets)
    expect(nf).not.toMatch(/<script|\sstyle=|<style/i)
    expect(nf).toContain('noindex')
  })
  it('leave site.css out when the landing page has not published it', () => {
    const page = renderLegal('terms', 'ar', DEFAULT_SETTINGS, 'https://dentora.raqeem.dev', { siteCss: false, favicon: false, manifest: false })
    expect(page).not.toContain('/css/site.css')
    expect(page).not.toContain('favicon')
  })
})
