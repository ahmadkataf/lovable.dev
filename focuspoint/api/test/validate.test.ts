import { describe, expect, it } from 'vitest'
import { normalisePhone, isUuid } from '../src/validate'
import { localDayRange, localToUtc, localParts, formatWhen, isTimeString } from '../src/tz'

describe('normalisePhone', () => {
  it('accepts every Syrian form and returns 09XXXXXXXX', () => {
    expect(normalisePhone('0985258963')).toBe('0985258963')
    expect(normalisePhone('+963 985 258 963')).toBe('0985258963')
    expect(normalisePhone('00963985258963')).toBe('0985258963')
    expect(normalisePhone('963985258963')).toBe('0985258963')
    expect(normalisePhone('985258963')).toBe('0985258963')
    expect(normalisePhone('098-525-8963')).toBe('0985258963')
    expect(normalisePhone('٠٩٨٥٢٥٨٩٦٣')).toBe('0985258963')
  })
  it('rejects anything else', () => {
    expect(normalisePhone('0115258963')).toBeNull()      // landline
    expect(normalisePhone('09852589')).toBeNull()
    expect(normalisePhone('+1 555 123 4567')).toBeNull()
    expect(normalisePhone('')).toBeNull()
    expect(normalisePhone(985258963)).toBeNull()
  })
})

describe('time zone helpers', () => {
  it('converts Damascus wall-clock to UTC (+3)', () => {
    expect(localToUtc('2026-10-24', '09:00', 'Asia/Damascus').toISOString()).toBe('2026-10-24T06:00:00.000Z')
    expect(localParts(new Date('2026-10-24T20:30:00.000Z'), 'Asia/Damascus')).toMatchObject({ date: '2026-10-24', hh: 23, mm: 30, minutes: 1410, weekday: 6 })
    expect(localParts(new Date('2026-10-24T21:30:00.000Z'), 'Asia/Damascus').date).toBe('2026-10-25')
  })
  it('gives a local day range', () => {
    const { from, to } = localDayRange('2026-10-24', 'Asia/Damascus')
    expect(from.toISOString()).toBe('2026-10-23T21:00:00.000Z')
    expect(to.toISOString()).toBe('2026-10-24T21:00:00.000Z')
  })
  it('formats a window in Arabic with Latin digits', () => {
    expect(formatWhen('2026-10-24T07:00:00.000Z', '2026-10-24T09:00:00.000Z', 'Asia/Damascus')).toBe('السبت 24/10 · 10:00–12:00')
  })
  it('validates HH:MM and UUIDs', () => {
    expect(isTimeString('09:00')).toBe(true)
    expect(isTimeString('24:00')).toBe(false)
    expect(isTimeString('9:00')).toBe(false)
    expect(isUuid('3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })
})
