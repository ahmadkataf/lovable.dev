// The marketing pages in more languages (src/pages/i18n/<lang>.ts: the home page's words `copy` and the comparison's
// `compare`): each must say exactly what the English says, with the same placeholders, lists of the same length and
// the same links, within the length limits search engines show. Run for one language:
//   LANG_CHECK=fr npx vitest run test/i18n.test.ts
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { COMPARE, type CompareCopy } from '../src/pages/compare-content'
import { SOURCES } from '../src/pages/compare-sources'
import { COPY, type Copy } from '../src/pages/content'

const ALL = ['fr', 'es', 'pt', 'tr', 'id', 'ur'] as const
const fileOf = (lang: string) => fileURLToPath(new URL(`../src/pages/i18n/${lang}.ts`, import.meta.url))
const wanted = (process.env.LANG_CHECK || '').split(',').filter(Boolean)
const LANGS = (wanted.length ? wanted : ALL.filter(l => existsSync(fileOf(l)))) as string[]

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

/** Walks two values of the same shape and reports where they differ in shape, placeholders or fixed values. */
function compareShape(en: unknown, tr: unknown, path: string, out: string[], fixed: (p: string) => boolean) {
  if (typeof en === 'string') {
    if (typeof tr !== 'string') { out.push(`${path}: not a string`); return }
    if (!tr.trim()) out.push(`${path}: empty`)
    if (placeholders(en) !== placeholders(tr)) out.push(`${path}: placeholders {${placeholders(en)}} ≠ {${placeholders(tr)}}`)
    if (fixed(path) && en !== tr) out.push(`${path}: must stay "${en}"`)
    return
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(tr)) { out.push(`${path}: not a list`); return }
    if (en.length !== tr.length) out.push(`${path}: ${tr.length} items, English has ${en.length}`)
    en.forEach((x, i) => compareShape(x, tr[i], `${path}[${i}]`, out, fixed))
    return
  }
  if (en && typeof en === 'object') {
    if (!tr || typeof tr !== 'object') { out.push(`${path}: not an object`); return }
    const a = Object.keys(en).filter(k => k !== 'appLang').sort(), b = Object.keys(tr as object).filter(k => k !== 'appLang').sort()
    if (a.join() !== b.join()) out.push(`${path}: keys ${b.join()} ≠ ${a.join()}`)
    for (const k of a) compareShape((en as Record<string, unknown>)[k], (tr as Record<string, unknown>)[k], `${path}.${k}`, out, fixed)
    return
  }
  if (en !== tr) out.push(`${path}: ${String(tr)} ≠ ${String(en)}`)
}

// Values that are not words: icons, chip tones, phone keys, link targets, the vendors' names and addresses.
const FIXED = /\.(icon|tone|key|linkTo)$|\.examples\[\d+\]\.name$|\.url$/

it('knows which languages to check', () => { expect(LANGS.every(l => (ALL as readonly string[]).includes(l))).toBe(true) })

describe.each(LANGS)('the pages in %s', lang => {
  it('has its file', () => { expect(existsSync(fileOf(lang))).toBe(true) })
  it('says what the English says, in the same shape', async () => {
    const mod = await import(/* @vite-ignore */ fileOf(lang)) as { copy: Copy; compare: CompareCopy }
    const out: string[] = []
    compareShape(COPY.en, mod.copy, 'copy', out, p => FIXED.test(p) || /^copy\.wa\./.test(p))
    // the Dentora row links to the page in this language; every other address stays
    compareShape(COMPARE.en, mod.compare, 'compare', out, p => FIXED.test(p) && !/approaches\[0\]\.examples\[0\]\.url$/.test(p))
    expect(out).toEqual([])
  })
  it('keeps titles and descriptions within what search results show, and says the app is in Arabic and English', async () => {
    const { copy, compare } = await import(/* @vite-ignore */ fileOf(lang)) as { copy: Copy; compare: CompareCopy }
    expect(copy.meta.description.length).toBeLessThanOrEqual(155)
    expect(compare.meta.description.length).toBeLessThanOrEqual(155)
    expect(copy.meta.title.length).toBeLessThanOrEqual(75)
    expect(compare.meta.title.length).toBeLessThanOrEqual(80)
    expect(copy.summary.appLang?.trim()).toBeTruthy()
    expect(copy.meta.title).toContain('Dentora')
    expect(compare.meta.title).toContain('Dentora')
    // the same sources, the same vendors, the Dentora row linking to this language's home page
    expect(compare.sources.items).toEqual(SOURCES)
    expect(compare.approaches.map(a => a.key)).toEqual(['offline', 'cloud', 'server'])
    expect(compare.approaches[0].examples[0].url).toBe(`https://dentora.raqeem.dev/${lang}`)
    // the seller reads the WhatsApp messages: they stay in English
    expect(copy.wa).toEqual(COPY.en.wa)
    // facts that must survive translation
    const all = JSON.stringify([copy, compare])
    for (const fact of ['7', '10', '11', '64', 'AES-256', 'FDI', 'Android', 'Windows', '{price}']) expect(all).toContain(fact)
    expect(all).not.toMatch(/AggregateRating|★|☆/)
  })
})
