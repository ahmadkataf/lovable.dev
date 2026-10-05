import { describe, expect, it } from 'vitest'
import { hidIsScanner, hidLayouts, readHidReport } from '../lib/devices'

const U = (id: number) => (0x8c << 16) | id
// HID POS Usage Tables 1.02, Fig. 2: 3 symbology id bytes, 50 data bytes, then the continued bit (8 × 1 bit)
const fig2 = { collections: [{ usagePage: 0x8c, usage: 0x02, inputReports: [{ reportId: 2, items: [
  { usages: [U(0xfb), U(0xfc), U(0xfd)], reportSize: 8, reportCount: 3 },
  { usages: [U(0xfe)], reportSize: 8, reportCount: 50 },
  { usages: [U(0xff)], reportSize: 1, reportCount: 1 },
  { usages: [0x00ff0001], reportSize: 1, reportCount: 7 },
] }] }] }
// Honeywell: a length byte (no barcode usage) before the AIM bytes
const honeywell = { collections: [{ usagePage: 0x8c, usage: 0x02, inputReports: [{ reportId: 2, items: [
  { usages: [0xff000001], reportSize: 8, reportCount: 1 },
  { isRange: true, usageMinimum: U(0xfb), usageMaximum: U(0xfd), reportSize: 8, reportCount: 3 },
  { usages: [U(0xfe)], reportSize: 8, reportCount: 56 },
  { usages: [0xff000002], reportSize: 8, reportCount: 2 },
  { usages: [U(0xff)], reportSize: 1, reportCount: 1 },
] }] }] }
const bytes = (n: number, put: [number, number[]][]) => { const b = new Uint8Array(n); for (const [at, v] of put) b.set(v, at); return new DataView(b.buffer) }
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0))
const text = (r: ReturnType<typeof readHidReport>) => (r ? r.aim + new TextDecoder().decode(r.bytes) : null)

describe('HID POS scanners', () => {
  it('recognises the barcode scanner usage page, even nested', () => {
    expect(hidIsScanner(fig2)).toBe(true)
    expect(hidIsScanner({ collections: [{ usagePage: 1, usage: 6, children: [{ usagePage: 0x8c }] }] })).toBe(true)
    expect(hidIsScanner({ collections: [{ usagePage: 1, usage: 6 }] })).toBe(false)
  })
  it('reads the decoded data where the report description puts it', () => {
    const lay = hidLayouts(fig2)
    const r = readHidReport(lay, 2, bytes(54, [[0, ascii(']E0')], [3, ascii('6291041500213')]]))
    expect(text(r)).toBe(']E06291041500213')
    expect(r?.more).toBe(false)
    const more = readHidReport(lay, 2, bytes(54, [[0, ascii(']d2')], [3, ascii('0109501101530003')], [53, [1]]]))
    expect(more?.more).toBe(true)
  })
  it('uses the length byte when the device has one (and keeps zeros inside the data)', () => {
    const lay = hidLayouts(honeywell)
    expect(lay[0].lenField).toBeDefined()
    const r = readHidReport(lay, 2, bytes(63, [[0, [5]], [1, ascii(']C0')], [4, [0x41, 0x00, 0x42, 0x43, 0x44]]]))
    expect(r?.bytes.length).toBe(5)
    expect(r?.aim).toBe(']C0')
  })
  it('falls back to the Honeywell layout when the device describes nothing', () => {
    const r = readHidReport([], 2, bytes(63, [[0, [13]], [1, ascii(']E0')], [4, ascii('4006381333931')]]))
    expect(text(r)).toBe(']E04006381333931')
    expect(readHidReport([], 2, bytes(63, [[0, [3]], [1, ascii('xyz')]]))).toBeNull()
    expect(readHidReport([], 5, bytes(63, []))).toBeNull()
  })
})
