import { describe, expect, it } from 'vitest'
import { cleanScanText, usChar } from '../lib/scan'

describe('scanner text', () => {
  it('strips the AIM symbology prefix and names the symbology', () => {
    expect(cleanScanText(']E06291041500213')).toEqual({ text: '6291041500213', symbology: 'EAN-13 / UPC' })
    expect(cleanScanText(']E412345670')).toEqual({ text: '12345670', symbology: 'EAN-8' })
    expect(cleanScanText(']C1010629104150021310ABC')).toEqual({ text: '010629104150021310ABC', symbology: 'GS1-128' })
    expect(cleanScanText(']Q1https://example.com')).toEqual({ text: 'https://example.com', symbology: 'QR Code' })
  })
  it('keeps codes that only look like a prefix', () => {
    expect(cleanScanText(']]ABC').text).toBe(']]ABC')
    expect(cleanScanText('0 451 103 316').text).toBe('0 451 103 316')
  })
  it('removes line endings and turns Arabic-Indic digits into Latin ones', () => {
    expect(cleanScanText('٦٢٩١٠٤١٥٠٠٢١٣\r\n').text).toBe('6291041500213')
    expect(cleanScanText('۱۲۳').text).toBe('123')
  })
  it('maps physical keys to US characters (an Arabic layout must not garble codes)', () => {
    expect(usChar('KeyA', false)).toBe('a')
    expect(usChar('KeyA', true)).toBe('A')
    expect(usChar('Digit7', false)).toBe('7')
    expect(usChar('Minus', false)).toBe('-')
    expect(usChar('Slash', false)).toBe('/')
    expect(usChar('Numpad5', false)).toBe('5')
    expect(usChar('ShiftLeft', false)).toBeNull()
  })
})
