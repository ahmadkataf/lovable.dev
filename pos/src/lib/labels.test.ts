import { describe, it, expect } from 'vitest'
import { labelsHtml, countLabels, barcodeSvg } from './labels'
import { DEFAULT_SETTINGS, type Settings } from '../db/types'

const settings: Settings = { ...DEFAULT_SETTINGS, store: { ...DEFAULT_SETTINGS.store, name: 'بقالة الأمل' } }
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

describe('labels', () => {
  it('holds the product name, the price and the barcode digits', () => {
    const html = labelsHtml([{ name: 'حليب كامل الدسم 1 لتر', price: 1250, barcode: '6291041500213' }], settings, { size: '50x30' })
    expect(html).toContain('حليب كامل الدسم 1 لتر')
    expect(html).toContain('6291041500213')
    expect(html).toContain('1,250 ل.س')
    expect(html).toContain('بقالة الأمل')
    expect(html).toContain('size: 50mm 30mm')
  })
  it('prints one label (page) per copy', () => {
    const items = [
      { name: 'A', price: 10, barcode: '100', copies: 3 },
      { name: 'B', price: 20, barcode: '200' },
      { name: 'C', price: 30, barcode: '300', copies: 0 },
    ]
    expect(countLabels(items)).toBe(4)
    const html = labelsHtml(items, settings, { size: '38x25' })
    expect(count(html, /class="label"/g)).toBe(4)
    expect(count(html, /<div class="name">A<\/div>/g)).toBe(3)
    expect(html).not.toContain('<div class="name">C</div>')
  })
  it('lays A4 out as a grid instead of one page per label', () => {
    const html = labelsHtml([{ name: 'A', price: 1, barcode: '1', copies: 2 }], settings, { size: 'a4' })
    expect(html).toContain('size: A4')
    expect(html).toContain('class="sheet"')
    expect(count(html, /class="label"/g)).toBe(2)
  })
  it('escapes HTML in names and survives a missing barcode', () => {
    const html = labelsHtml([{ name: '<b>x</b> & y', price: 5, barcode: '' }], settings, { size: '58x40' })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('class="bc empty"')
  })
  it('leaves the store line out when the store has no name', () => {
    const html = labelsHtml([{ name: 'A', price: 1, barcode: '1' }], DEFAULT_SETTINGS, { size: '38x25' })
    expect(html).not.toContain('class="store"')
  })
  it('never throws without a DOM', () => {
    expect(barcodeSvg('6291041500213')).toBe('')
    expect(barcodeSvg('')).toBe('')
  })
})

describe('labels in the second currency', () => {
  const fx: Settings = { ...settings, currency2: { ...settings.currency2, enabled: true, rate: 13000 } }
  const items = [{ name: 'A', price: 130000, barcode: '1', fxPrice: 10 }, { name: 'B', price: 2000, barcode: '2' }]
  it('prints the primary price by default, the $ price on request, or both with the $ big', () => {
    expect(labelsHtml(items, fx, { size: '50x30' })).toContain('<div class="price">130,000 ل.س</div>')
    expect(labelsHtml(items, fx, { size: '50x30' })).not.toContain('$10.00')
    const sec = labelsHtml(items, fx, { size: '50x30', priceMode: 'secondary' })
    expect(sec).toContain('<div class="price">$10.00</div>')
    expect(sec).toContain('<div class="price">2,000 ل.س</div>')      // no anchor: the primary price
    const both = labelsHtml(items, fx, { size: '50x30', priceMode: 'both' })
    expect(both).toContain('<div class="price">$10.00</div><div class="price2">130,000 ل.س</div>')
    expect(both).not.toContain('<div class="price2">2,000')
  })
})
