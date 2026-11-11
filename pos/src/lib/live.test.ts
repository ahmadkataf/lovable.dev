// A database that fails mid-session comes back by itself even when no live query notices: a payment (a write) that
// hits the failed open must not leave the sales screen refusing every sale until the cashier changes screens.
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  const g = globalThis as any
  g.window = g
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)) }, removeItem: (k: string) => { m.delete(k) } } }
  g.localStorage = mem()
  g.sessionStorage = mem()
})

const realOpen = indexedDB.open.bind(indexedDB)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('database recovery without a live query', () => {
  it('a write after a forced close and a failed reopen: the database is reopened on its own and the next write works', async () => {
    const { db } = await import('../db')
    await import('./live')                       // installs the recovery timer
    await db.open()
    await db.kv.put({ key: 'x', value: 1 })
    // the browser closes the connection; the next (automatic) open fails once: storage full
    const opens: string[] = []
    let n = 0
    ;(indexedDB as any).open = (...a: any[]) => {
      if (n++ >= 1) { opens.push('ok'); return realOpen(...(a as [string, number])) }
      opens.push('fail')
      const req: any = {}
      setTimeout(() => { req.error = new DOMException('Encountered full disk while opening backing store for indexedDB.open.', 'QuotaExceededError'); req.onerror?.({ target: req, preventDefault() {}, stopPropagation() {} }) }, 1)
      return req
    }
    try {
      db.backendDB().onclose?.(new Event('close'))
      const first = await db.kv.put({ key: 'sale', value: 1 }).then(() => null, (e: { name?: string }) => e?.name)
      expect(first).toBe('DatabaseClosedError')
      expect(db.hasFailed()).toBe(true)
      // nothing reads the database meanwhile (no live query): the timer reopens it within a few seconds
      for (let i = 0; i < 80 && !db.isOpen(); i++) await sleep(100)
      expect(opens).toEqual(['fail', 'ok'])
      const next = await db.kv.put({ key: 'sale', value: 2 }).then(() => null, (e: { name?: string }) => e?.name)
      expect(next).toBeNull()
    } finally { (indexedDB as any).open = realOpen }
  }, 15000)
})
