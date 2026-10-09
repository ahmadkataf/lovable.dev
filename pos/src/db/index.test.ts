import { describe, it, expect, beforeEach } from 'vitest'
import { db, nextNumber, mergeSettings, ensureDefaults, loadSettings } from './index'
import { DEFAULT_SETTINGS } from './types'

beforeEach(async () => { await db.delete(); await db.open() })

describe('nextNumber', () => {
  it('counts 1, 2, 3 per key and survives a counter that is not a number (a hand-edited backup)', async () => {
    expect(await nextNumber('sale')).toBe(1)
    expect(await nextNumber('sale')).toBe(2)
    expect(await nextNumber('purchase')).toBe(1)
    await db.kv.put({ key: 'counter:sale', value: '7' })
    expect(await nextNumber('sale')).toBe(8)               // not '71'
    await db.kv.put({ key: 'counter:sale', value: null })
    expect(await nextNumber('sale')).toBe(1)
  })
})

describe('settings', () => {
  it('mergeSettings fills what an older settings object lacks, nested keys included, and keeps what is set', () => {
    const s = mergeSettings({ lang: 'en', pos: { allowNegativeStock: false } as never, loyalty: { enabled: true } as never })
    expect(s.lang).toBe('en')
    expect(s.pos.allowNegativeStock).toBe(false)
    expect(s.pos.scale).toEqual(DEFAULT_SETTINGS.pos.scale)
    expect(s.loyalty).toEqual({ ...DEFAULT_SETTINGS.loyalty, enabled: true })
    expect(s.currency2).toEqual(DEFAULT_SETTINGS.currency2)
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })
  it('ensureDefaults makes one admin and the settings, once', async () => {
    await Promise.all([ensureDefaults(), ensureDefaults()])
    expect(await db.users.count()).toBe(1)
    expect((await loadSettings()).currency.code).toBe(DEFAULT_SETTINGS.currency.code)
  })
})
