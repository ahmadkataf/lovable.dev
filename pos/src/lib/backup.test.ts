import { describe, it, expect, beforeEach } from 'vitest'
import { db, TABLES } from '../db'
import { DEFAULT_SETTINGS } from '../db/types'
import { exportBackup, validateBackup, importBackup, resetAllData, backupFileName, backupIsStale, markBackupDone, getLastBackup, BACKUP_REMIND_DAYS } from './backup'

const product = (id: string, name = 'x') => ({ id, name, barcodes: [], price: 10, cost: 5, trackStock: true, stock: 3, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 1, updatedAt: 1 })

beforeEach(async () => { await db.delete(); await db.open() })

async function seed() {
  await db.categories.add({ id: 'c1', name: 'cat', color: '#000', sort: 0, createdAt: 1 })
  await db.products.bulkAdd([product('p1', 'Water'), product('p2', 'Tea')])
  await db.customers.add({ id: 'cu', name: 'Ali', balance: 100, createdAt: 1, updatedAt: 1 })
  await db.users.add({ id: 'u', name: 'Admin', role: 'admin', active: true, createdAt: 1 })
  await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, store: { name: 'Shop', phone: '', address: '' } } })
  await db.kv.put({ key: 'counter:sale', value: 42 })
}

describe('backup', () => {
  it('exports a kaseb file with every table', async () => {
    await seed()
    const json = await exportBackup()
    const f = JSON.parse(json)
    expect(f.app).toBe('kaseb')
    expect(f.version).toBe(1)
    expect(typeof f.exportedAt).toBe('number')
    for (const name of TABLES) expect(Array.isArray(f.tables[name])).toBe(true)
    expect(f.tables.products).toHaveLength(2)
    expect(f.tables.kv).toHaveLength(2)
  })

  it('round trip: export -> clear -> import restores the counts and the rows', async () => {
    await seed()
    const json = await exportBackup()
    const v = validateBackup(json)
    expect(v.ok).toBe(true)
    expect(v.counts.products).toBe(2)
    expect(v.counts.categories).toBe(1)
    expect(v.counts.customers).toBe(1)
    expect(v.total).toBe(2 + 1 + 1 + 1 + 2)

    for (const name of TABLES) await db.table(name).clear()
    expect(await db.products.count()).toBe(0)

    const counts = await importBackup(json)
    expect(counts.products).toBe(2)
    expect(await db.products.count()).toBe(2)
    expect(await db.categories.count()).toBe(1)
    expect(await db.customers.count()).toBe(1)
    expect(await db.users.count()).toBe(1)
    expect((await db.products.get('p2'))!.name).toBe('Tea')
    expect((await db.customers.get('cu'))!.balance).toBe(100)
    expect((await db.kv.get('counter:sale'))!.value).toBe(42)
    expect(((await db.kv.get('settings'))!.value as any).store.name).toBe('Shop')
  })

  it('import replaces what is there (rows not in the file disappear)', async () => {
    await seed()
    const json = await exportBackup()
    await db.products.add(product('p3', 'Later'))
    await db.sales.add({ id: 's', number: 1, createdAt: 1, items: [], subtotal: 0, discount: 0, tax: 0, total: 0, cost: 0, payments: [], paid: 0, change: 0, credit: 0, userId: 'u', userName: 'a', status: 'completed', refunded: 0 })
    await importBackup(json)
    expect(await db.products.get('p3')).toBeUndefined()
    expect(await db.products.count()).toBe(2)
    expect(await db.sales.count()).toBe(0)
  })

  it('imports big tables in chunks', async () => {
    await db.users.add({ id: 'u', name: 'Admin', role: 'admin', active: true, createdAt: 1 })
    const rows = Array.from({ length: 1203 }, (_, i) => product(`p${i}`))
    await db.products.bulkAdd(rows)
    const json = await exportBackup()
    await db.products.clear()
    await importBackup(json)
    expect(await db.products.count()).toBe(1203)
  })

  it('creates the defaults when the file has no users', async () => {
    const json = JSON.stringify({ app: 'kaseb', version: 1, exportedAt: 1, tables: { products: [product('p1')] } })
    await importBackup(json)
    expect(await db.products.count()).toBe(1)
    expect(await db.users.count()).toBe(1)
    expect((await db.users.toArray())[0].role).toBe('admin')
    expect(await db.kv.get('settings')).toBeDefined()
  })

  it('rejects invalid JSON and foreign files', async () => {
    expect(validateBackup('{nope')).toMatchObject({ ok: false, error: 'invalid_json' })
    expect(validateBackup('[]')).toMatchObject({ ok: false, error: 'invalid_json' })
    expect(validateBackup('"text"')).toMatchObject({ ok: false, error: 'invalid_json' })
    expect(validateBackup(JSON.stringify({ app: 'other', version: 1, tables: {} }))).toMatchObject({ ok: false, error: 'not_kaseb' })
    expect(validateBackup(JSON.stringify({ app: 'kaseb', version: 99, tables: { products: [] } }))).toMatchObject({ ok: false, error: 'version' })
    expect(validateBackup(JSON.stringify({ app: 'kaseb', version: 1 }))).toMatchObject({ ok: false, error: 'no_tables' })
    expect(validateBackup(JSON.stringify({ app: 'kaseb', version: 1, tables: { foreign: [] } }))).toMatchObject({ ok: false, error: 'no_tables' })
    expect(validateBackup(JSON.stringify({ app: 'kaseb', version: 1, tables: { products: 'x' } }))).toMatchObject({ ok: false, error: 'bad_rows' })
    expect(validateBackup(JSON.stringify({ app: 'kaseb', version: 1, tables: { products: [1, 2] } }))).toMatchObject({ ok: false, error: 'bad_rows' })
    await seed()
    await expect(importBackup('{nope')).rejects.toThrow('invalid_json')
    await expect(importBackup(JSON.stringify({ app: 'x' }))).rejects.toThrow('not_kaseb')
    // nothing was touched
    expect(await db.products.count()).toBe(2)
  })

  it('ignores unknown tables and keeps the known ones', () => {
    const v = validateBackup(JSON.stringify({ app: 'kaseb', version: 1, exportedAt: 123, tables: { products: [product('a')], future: [{ x: 1 }] } }))
    expect(v.ok).toBe(true)
    expect(v.counts.products).toBe(1)
    expect(v.total).toBe(1)
    expect(v.exportedAt).toBe(123)
  })

  it('resetAllData wipes everything and recreates the defaults', async () => {
    await seed()
    await markBackupDone(5)
    await resetAllData()
    expect(await db.products.count()).toBe(0)
    expect(await db.customers.count()).toBe(0)
    expect(await db.categories.count()).toBe(0)
    expect(await db.users.count()).toBe(1)
    const admin = (await db.users.toArray())[0]
    expect(admin.role).toBe('admin')
    expect(admin.id).not.toBe('u')
    expect(await db.kv.get('counter:sale')).toBeUndefined()
    expect(await getLastBackup()).toBeNull()
    expect(((await db.kv.get('settings'))!.value as any).store.name).toBe('')
  })

  it('remembers the last backup time', async () => {
    expect(await getLastBackup()).toBeNull()
    await markBackupDone(1000)
    expect(await getLastBackup()).toBe(1000)
  })

  it('backupIsStale and backupFileName', () => {
    const now = new Date(2026, 9, 9, 12).getTime()
    expect(backupIsStale(null, now)).toBe(true)
    expect(backupIsStale(0, now)).toBe(true)
    expect(backupIsStale(now - 86400000, now)).toBe(false)
    expect(backupIsStale(now - BACKUP_REMIND_DAYS * 86400000, now)).toBe(false)
    expect(backupIsStale(now - (BACKUP_REMIND_DAYS * 86400000 + 1), now)).toBe(true)
    expect(backupFileName(now)).toBe('kaseb-backup-2026-10-09.json')
    expect(backupFileName(new Date(2026, 0, 3).getTime())).toBe('kaseb-backup-2026-01-03.json')
  })
})

describe('restore and the exchange rate', () => {
  it('re-derives anchored products at the restored rate and notes it in the history; plain files restore untouched', async () => {
    await db.users.add({ id: 'u', name: 'Admin', role: 'admin', active: true, createdAt: 1 })
    const c2 = { ...DEFAULT_SETTINGS.currency2, enabled: true, pricing: true, rate: 13000 }
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, currency2: c2 } })
    // a hand-edited file: the lira price disagrees with the anchor at the file's rate
    await db.products.bulkAdd([{ ...product('p1', 'Oil'), price: 999, fxPrice: 10, updatedAt: 7 }, product('p2', 'Tea')])
    const json = await exportBackup()
    await db.products.clear()
    await importBackup(json)
    const p1 = (await db.products.get('p1'))!
    expect(p1.price).toBe(130000); expect(p1.updatedAt).toBe(7); expect(p1.repricedAt).toBeDefined()
    expect((await db.products.get('p2'))!.price).toBe(10)
    const hist = (await db.kv.get('fx.history'))!.value as { source: string; repriced: number }[]
    expect(hist[0]).toMatchObject({ source: 'restore', repriced: 1 })
    // a second restore of the now-consistent data changes nothing and adds no history row
    await importBackup(await exportBackup())
    expect(((await db.kv.get('fx.history'))!.value as unknown[]).length).toBe(1)
    // pre-feature file (no currency2 pricing): nothing happens
    await importBackup(JSON.stringify({ app: 'kaseb', version: 1, exportedAt: 1, tables: { products: [{ ...product('p9'), fxPrice: 1 }] } }))
    expect((await db.products.get('p9'))!.price).toBe(10)
    expect(await db.kv.get('fx.history')).toBeUndefined()
  })
})
