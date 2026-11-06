import { describe, it, expect } from 'vitest'
import { cleanPhone, validPhone, intlPhone } from './phone'

describe('shop phone', () => {
  it('cleans what people type, Arabic digits included', () => {
    expect(cleanPhone(' ٠٩٤٤ ١٢٣ ٤٥٦ ')).toBe('0944123456')
    expect(cleanPhone('+963 944-123-456')).toBe('+963944123456')
    expect(cleanPhone('00963944123456')).toBe('+963944123456')
    expect(cleanPhone('(011) 222 3344')).toBe('0112223344')
    expect(cleanPhone('abc')).toBe('')
  })
  it('accepts real numbers and refuses short or malformed ones', () => {
    expect(validPhone('0944123456')).toBe(true)
    expect(validPhone('٠٩٤٤١٢٣٤٥٦')).toBe(true)
    expect(validPhone('0112223344')).toBe(true)
    expect(validPhone('+963944123456')).toBe(true)
    expect(validPhone('+905321234567')).toBe(true)
    expect(validPhone('963944123456')).toBe(true)
    expect(validPhone('094412345')).toBe(false)      // a digit short
    expect(validPhone('09441234567')).toBe(false)    // a digit too many
    expect(validPhone('12345')).toBe(false)
    expect(validPhone('')).toBe(false)
  })
  it('gives the international digits for WhatsApp', () => {
    expect(intlPhone('0944123456')).toBe('963944123456')
    expect(intlPhone('+963 944 123 456')).toBe('963944123456')
    expect(intlPhone('00905321234567')).toBe('905321234567')
    expect(intlPhone('')).toBe('')
  })
})
