import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  const g = globalThis as any
  const m = new Map<string, string>()
  g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)) }, removeItem: (k: string) => { m.delete(k) } }
})

describe('recovery helpers', () => {
  it('withTimeout rejects with the given name and passes values through', async () => {
    const { withTimeout } = await import('./recovery')
    await expect(withTimeout(new Promise(() => {}), 20, 'BootTimeout')).rejects.toMatchObject({ name: 'BootTimeout' })
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7)
    await expect(withTimeout(Promise.reject(new TypeError('x')), 1000)).rejects.toBeInstanceOf(TypeError)
  })

  it('describeError keeps the real IndexedDB error that Dexie wraps, once', async () => {
    const { describeError } = await import('./recovery')
    const inner = { name: 'QuotaExceededError', message: 'Encountered full disk while opening backing store' }
    expect(describeError({ name: 'OpenFailedError', message: 'open failed', inner })).toEqual({ name: 'OpenFailedError', message: 'open failed (QuotaExceededError: Encountered full disk while opening backing store)' })
    expect(describeError({ name: 'OpenFailedError', message: 'UnknownError Internal error', inner: { name: 'UnknownError', message: 'Internal error' } }).message).toBe('UnknownError Internal error')
    expect(describeError('plain')).toEqual({ name: 'Error', message: 'plain' })
    // Dexie's own repetition of the browser's text is shown once
    expect(describeError({ name: 'QuotaExceededError', message: 'Encountered full disk. QuotaExceededError: Encountered full disk.' }).message).toBe('Encountered full disk.')
    expect(describeError({ name: 'DataError', message: 'a DataError: b' }).message).toBe('a DataError: b')
  })

  it('logError keeps the last errors and folds repeats', async () => {
    const { logError, readErrors } = await import('./recovery')
    localStorage.removeItem('kaseb.errors')
    logError('boot', new Error('a')); logError('boot', new Error('a')); logError('boot', new Error('b'))
    expect(readErrors().map(e => e.message)).toEqual(['a', 'b'])
    for (let i = 0; i < 30; i++) logError('x', new Error('e' + i))
    expect(readErrors().length).toBe(20)
  })
})

describe('cloud upload header', () => {
  it('asciiJson is Latin-1 safe and parses back to the same value (Arabic device names, emoji)', async () => {
    const { asciiJson } = await import('./cloud')
    const meta = { name: 'حاسوب المحل 💻', counts: { sales: 3 }, appVersion: '1.0.1' }
    const h = asciiJson(meta)
    expect(/^[\x20-\x7e]*$/.test(h)).toBe(true)
    expect(JSON.parse(h)).toEqual(meta)
  })
})
