import { describe, it, expect, beforeAll } from 'vitest'
import { handleApi } from '../worker/index'
import type { Database } from '../worker/db'
import { buildDemo } from '../shared/demo'
import { DJI_DRONES } from '../shared/dji'
import { computeDashboard } from '../shared/stats'

// vite does not know node:sqlite as a builtin yet, so it is loaded at run time
import { createRequire } from 'node:module'
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')

function memoryDb(): Database {
  const sqlite = new DatabaseSync(':memory:')
  class Stmt {
    args: unknown[] = []
    constructor(public sql: string) {}
    bind(...args: unknown[]) { const s = new Stmt(this.sql); s.args = args.map(a => (a === undefined ? null : a)); return s }
    async first() { return (sqlite.prepare(this.sql).get(...(this.args as never[])) as never) ?? null }
    async all() { return { results: sqlite.prepare(this.sql).all(...(this.args as never[])) as never[] } }
    async run() { return sqlite.prepare(this.sql).run(...(this.args as never[])) }
  }
  return { prepare: sql => new Stmt(sql) as never, batch: async stmts => { for (const s of stmts) await s.run() } }
}

const db = memoryDb()
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await handleApi(new Request(`http://x${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), db)
  return { status: res.status, data: await res.json() as any }
}

describe('demo data', () => {
  const demo = buildDemo()
  it('covers every DJI series with a product and every part type', () => {
    expect(demo.products.length).toBeGreaterThan(80)
    expect(new Set(demo.products.map(p => p.category)).size).toBe(demo.categories.length)
    for (const p of demo.products) { expect(p.demo).toBe(true); expect(p.price).toBeGreaterThan(0); for (const m of p.compatible) expect(DJI_DRONES.some(d => d.id === m)).toBe(true) }
  })
  it('has unique ids and numbers', () => {
    expect(new Set(demo.products.map(p => p.id)).size).toBe(demo.products.length)
    expect(new Set(demo.orders.map(o => o.number)).size).toBe(demo.orders.length)
    expect(new Set(demo.tickets.map(t => t.number)).size).toBe(demo.tickets.length)
  })
  it('ledger income matches delivered orders', () => {
    const delivered = demo.orders.filter(o => o.status === 'delivered')
    expect(demo.ledger.filter(l => l.ref?.kind === 'order').length).toBe(delivered.length)
    const d = computeDashboard(demo.orders, demo.tickets, demo.products, demo.ledger)
    expect(d.demoCount).toBe(demo.products.length + demo.orders.length + demo.tickets.length + demo.ledger.length)
  })
})

describe('api', () => {
  let token = ''
  let productId = ''
  beforeAll(async () => {
    const boot = await call('GET', '/api/bootstrap')
    productId = boot.data.products[0].id
  })
  it('seeds the demo copy on first use', async () => {
    const { data } = await call('GET', '/api/bootstrap')
    expect(data.products.length).toBeGreaterThan(80)
    expect(data.settings.siteName).toBe('SUFIX')
    expect(data.drones.length).toBe(DJI_DRONES.length)
  })
  it('rejects an order without a valid phone', async () => {
    const r = await call('POST', '/api/orders', { customer: { name: 'x y', phone: '12' }, items: [{ productId, qty: 1 }] })
    expect(r.status).toBe(400)
  })
  it('creates an order, prices it server-side and tracks it', async () => {
    const r = await call('POST', '/api/orders', { customer: { name: 'زبون', phone: '0912 345 678', city: 'حلب', address: 'شارع' }, items: [{ productId, qty: 2, price: 1 }], zone: 'حلب' })
    expect(r.status).toBe(200)
    expect(r.data.number).toBe(1001 + 24)
    expect(r.data.items[0].price).not.toBe(1)
    expect(r.data.adminNotes).toBeUndefined()
    const t = await call('GET', `/api/track?number=${r.data.number}&phone=963912345678`)
    expect(t.data.kind).toBe('order')
    const bad = await call('GET', `/api/track?number=${r.data.number}&phone=0999999999`)
    expect(bad.status).toBe(404)
  })
  it('needs a first-run password, then a session', async () => {
    expect((await call('GET', '/api/admin/dashboard')).status).toBe(401)
    expect((await call('GET', '/api/admin/status')).data.setup).toBe(true)
    expect((await call('POST', '/api/admin/setup', { password: '123' })).status).toBe(400)
    token = (await call('POST', '/api/admin/setup', { password: 'strong-pass' })).data.token
    expect(token).toHaveLength(64)
    expect((await call('POST', '/api/admin/setup', { password: 'again' })).status).toBe(403)
    expect((await call('POST', '/api/admin/login', { password: 'wrong' })).status).toBe(401)
    expect((await call('GET', '/api/admin/dashboard', undefined, token)).status).toBe(200)
  })
  it('delivering an order books the income and takes the stock', async () => {
    const orders = (await call('GET', '/api/admin/orders?q=0912345678', undefined, token)).data
    const o = orders[0]
    const before = (await call('GET', `/api/products/${productId}`)).data.stock
    await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'confirmed' }, token)
    expect((await call('GET', `/api/products/${productId}`)).data.stock).toBe(before - 2)
    await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'delivered' }, token)
    await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'delivered' }, token)
    const ledger = (await call('GET', '/api/admin/ledger', undefined, token)).data
    expect(ledger.filter((l: any) => l.ref?.id === o.id)).toHaveLength(1)
    await call('PATCH', `/api/admin/orders/${o.id}`, { status: 'cancelled' }, token)
    expect((await call('GET', `/api/products/${productId}`)).data.stock).toBe(before)
  })
  it('clears and restores the demo copy', async () => {
    const p = (await call('POST', '/api/admin/products', { name: 'منتج حقيقي', category: 'drones', price: 10, stock: 1 }, token)).data
    await call('POST', '/api/admin/demo/clear', undefined, token)
    const boot = await call('GET', '/api/bootstrap')
    expect(boot.data.products.map((x: any) => x.id)).toEqual([p.id])
    expect(boot.data.settings.demoCleared).toBe(true)
    expect((await call('GET', '/api/admin/orders', undefined, token)).data.every((o: any) => !o.demo)).toBe(true)
    await call('POST', '/api/admin/demo/restore', undefined, token)
    expect((await call('GET', '/api/bootstrap')).data.products.length).toBeGreaterThan(80)
  })
  it('settings merge over the defaults and keep demoCleared', async () => {
    const r = await call('PUT', '/api/admin/settings', { siteName: 'متجري', hero: { title: 'عنوان' }, whatsapp: '+963 9 1' }, token)
    expect(r.data.siteName).toBe('متجري')
    expect(r.data.hero.title).toBe('عنوان')
    expect(r.data.hero.cta1).toBeTruthy()
    expect(r.data.whatsapp).toBe('96391')
    expect(r.data.demoCleared).toBe(false)
  })
  it('exports and imports a backup', async () => {
    const b = (await call('GET', '/api/admin/export', undefined, token)).data
    expect(b.version).toBe(1)
    expect((await call('POST', '/api/admin/import', b, token)).data.ok).toBe(true)
  })
})
