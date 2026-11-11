// Starting the app when IndexedDB misbehaves: a failed or stalled open must never leave the loading spinner up for
// good (the field report: "a screen keeps spinning until the app is closed and opened again").
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

beforeAll(() => {
  const g = globalThis as any
  g.window = g
  g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  g.document = { documentElement: { dataset: {}, lang: '', dir: '' }, querySelector: () => null, addEventListener() {}, visibilityState: 'visible' }
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, String(v)) }, removeItem: (k: string) => { m.delete(k) } } }
  g.sessionStorage = mem()
  g.localStorage = mem()
})

const realOpen = indexedDB.open.bind(indexedDB)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
/** indexedDB.open answers with an error the first `times` calls (what Chromium does on a backing-store failure),
 *  after `delay` ms. */
function failOpens(times: number, name = 'UnknownError', message = 'Internal error opening backing store for indexedDB.open.', delay = 1) {
  let n = 0
  ;(indexedDB as any).open = (...a: any[]) => {
    if (n++ >= times) return realOpen(...(a as [string, number]))
    const req: any = { onerror: null, onsuccess: null, onblocked: null, onupgradeneeded: null }
    setTimeout(() => { req.error = new DOMException(message, name); req.onerror?.({ target: req, preventDefault() {}, stopPropagation() {} }) }, delay)
    return req
  }
  return () => n
}
async function fresh() {
  const { useStore, bootTuning } = await import('./store')
  const { db } = await import('../db')
  bootTuning.attemptMs = 300
  bootTuning.retryDelays = [20, 40]
  db.close({ disableAutoOpen: false })
  useStore.setState({ ready: false, bootError: null })
  return { useStore, db }
}

describe('starting the app', () => {
  beforeEach(() => { (indexedDB as any).open = realOpen })
  afterEach(() => { (indexedDB as any).open = realOpen })

  it('starts normally', async () => {
    const { useStore } = await fresh()
    await useStore.getState().boot()
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().bootError).toBeNull()
  })

  it('recovers by itself when opening the database fails a few times (no restart needed)', async () => {
    const { useStore } = await fresh()
    const calls = failOpens(5)        // Dexie itself retries an UnknownError up to 3 more times per open
    await useStore.getState().boot()
    expect(calls()).toBeGreaterThan(5)
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().bootError).toBeNull()
  })

  it('shows the error instead of spinning forever when the database cannot be opened, and "try again" works', async () => {
    const { useStore } = await fresh()
    failOpens(1000, 'QuotaExceededError', 'Encountered full disk while opening backing store for indexedDB.open.')
    await useStore.getState().boot()
    const s = useStore.getState()
    expect(s.ready).toBe(false)
    expect(s.bootError).not.toBeNull()
    expect(`${s.bootError!.name} ${s.bootError!.message}`).toMatch(/QuotaExceededError|full disk/)
    // the storage was freed: the recovery screen's "try again" opens the app in the same page
    ;(indexedDB as any).open = realOpen
    await useStore.getState().retryBoot()
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().bootError).toBeNull()
  })

  it('a stalled open (an upgrade held up by another connection) is waited on, never cancelled or piled up, and the app opens by itself', async () => {
    const { useStore, db } = await fresh()
    // the shop's database as version 1 left it, held open by a connection that ignores "versionchange"
    await new Promise(r => { const q = indexedDB.deleteDatabase('kaseb'); q.onsuccess = q.onerror = q.onblocked = () => r(null) })
    const { default: Dexie } = await import('dexie')
    const v1 = new Dexie('kaseb')
    v1.version(1).stores({
      products: 'id, name, *barcodes, sku, categoryId, updatedAt, favorite, active, stock', categories: 'id, sort, name',
      customers: 'id, name, phone, updatedAt, balance', suppliers: 'id, name', sales: 'id, number, createdAt, customerId, userId, shiftId, status',
      refunds: 'id, saleId, createdAt, userId, shiftId, customerId', stockMoves: 'id, productId, createdAt, type, refId',
      purchases: 'id, number, createdAt, supplierId', ledger: 'id, customerId, createdAt, type, refId, shiftId', expenses: 'id, createdAt, category, shiftId',
      shifts: 'id, status, openedAt, userId', cashMoves: 'id, shiftId, createdAt', users: 'id, name, active', heldTickets: 'id, createdAt, userId', kv: 'key',
    })
    await v1.open(); v1.close()
    const blocker: IDBDatabase = await new Promise((res, rej) => { const q = realOpen('kaseb', 10); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
    let opens = 0
    ;(indexedDB as any).open = (...a: any[]) => { opens++; return realOpen(...(a as [string, number])) }
    const booting = useStore.getState().boot()
    for (let i = 0; i < 100 && !useStore.getState().bootError; i++) await sleep(20)
    await sleep(200)
    // slow, not failed: the card says so (restart offered) and nothing reopened or queued more opens
    expect(useStore.getState().ready).toBe(false)
    expect(useStore.getState().bootError?.name).toBe('BootTimeout')
    expect(opens).toBe(1)
    // the other connection lets go: the upgrade finishes and the app opens without any retry
    blocker.close()
    await booting
    expect(opens).toBe(1)
    expect(useStore.getState().ready).toBe(true)
    expect(useStore.getState().bootError).toBeNull()
    expect(db.verno).toBe(2)
  })

  it('an open that is slow and then fails ends on the real error (not "still opening" for good), with retries', async () => {
    const { useStore } = await fresh()
    const calls = failOpens(1000, 'QuotaExceededError', 'Encountered full disk while opening backing store for indexedDB.open.', 500)
    const booting = useStore.getState().boot()
    for (let i = 0; i < 50 && !useStore.getState().bootError; i++) await sleep(20)
    expect(useStore.getState().bootError?.name).toBe('BootTimeout')   // after the time limit: "still opening"
    await booting
    const s = useStore.getState()
    expect(s.ready).toBe(false)
    expect(s.bootError?.name).not.toBe('BootTimeout')
    expect(`${s.bootError!.name} ${s.bootError!.message}`).toMatch(/QuotaExceededError|full disk/)
    expect(calls()).toBeGreaterThanOrEqual(3)                             // the retries reopened the failed database
    // "try again" once the storage is free
    ;(indexedDB as any).open = realOpen
    await useStore.getState().retryBoot()
    expect(useStore.getState().ready).toBe(true)
  })

  it('a second start (the database was lost mid-session) takes the licence as it is now, not as it was at launch', async () => {
    const { useStore } = await fresh()
    await useStore.getState().boot()
    const { license } = await import('../license')
    const realGet = license.get
    const now = { ...realGet.call(license), state: 'active' as const, checking: false }
    ;(license as any).get = () => now
    try {
      useStore.setState({ ready: false, bootError: { name: 'DatabaseClosedError', message: 'x', lost: true } })
      await useStore.getState().retryBoot()
      expect(useStore.getState().ready).toBe(true)
      expect(useStore.getState().license).toBe(now)
    } finally { (license as any).get = realGet }
  })

  it('keeps the failures in the local error log for support', async () => {
    const { useStore } = await fresh()
    localStorage.removeItem('kaseb.errors')
    failOpens(1000)
    await useStore.getState().boot()
    const { readErrors, errorReport } = await import('../lib/recovery')
    expect(readErrors().some(e => e.where.startsWith('boot'))).toBe(true)
    expect(errorReport()).toMatch(/boot/)
  })
})
