import { describe, it, expect } from 'vitest'
import { zatcaQr, parseZatcaQr } from './zatca'

describe('zatca qr', () => {
  it('encodes the five TLV fields and reads them back', () => {
    const qr = zatcaQr({ seller: 'سوبرماركت الأمل', vat: '310122393500003', time: new Date('2026-10-09T12:34:56.000Z'), total: 115, vatAmount: 15 })
    const f = parseZatcaQr(qr)
    expect(f[1]).toBe('سوبرماركت الأمل')
    expect(f[2]).toBe('310122393500003')
    expect(f[3]).toBe('2026-10-09T12:34:56Z')
    expect(f[4]).toBe('115.00'); expect(f[5]).toBe('15.00')
    expect(qr).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})
