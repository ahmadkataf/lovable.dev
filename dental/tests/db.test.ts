// @vitest-environment node
// Node environment: its Blob survives IndexedDB's structured clone (happy-dom's Blob does not), so the backup
// round-trip can be checked with a real file. Node has no FileReader; a minimal one stands in for the browser's.
import 'fake-indexeddb/auto'
import { Buffer } from 'node:buffer'
import { db, DEFAULT_CLINIC, ensureClinic, exportBackup, getClinic, getSetting, importBackup, logActivity, nextFileNumber, nextInvoiceNumber, resetDatabase, SCHEMA_VERSION, setSetting, TABLE_NAMES, updateClinic } from '../src/db'
import type { BackupFile, PatientFile } from '../src/db/types'
import { loadDemoData } from '../src/features/seed/demo'

if (typeof (globalThis as any).FileReader === 'undefined') {
  class NodeFileReader {
    result: string | null = null
    onload: ((e: unknown) => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    readAsDataURL(b: Blob) {
      b.arrayBuffer().then(buf => { this.result = `data:${b.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`; this.onload?.({ target: this }) }, e => this.onerror?.(e))
    }
  }
  ;(globalThis as any).FileReader = NodeFileReader
}

const at = '2026-10-01T09:00:00.000Z'
const blobText = (b: Blob) => b.text()
async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const n of TABLE_NAMES) out[n] = await (db as any)[n].count()
  return out
}

describe('db: schema', () => {
  beforeEach(async () => { await resetDatabase() })

  it('opens with every table of the backup list', async () => {
    await db.open()
    expect(db.isOpen()).toBe(true)
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLE_NAMES].sort())
  })

  it('indexes used by the screens exist', () => {
    const idx = (t: string) => (db as any)[t].schema.indexes.map((i: { name: string }) => i.name)
    expect(idx('appointments')).toEqual(expect.arrayContaining(['patientId', 'doctorId', 'date', 'start', 'status', '[date+doctorId]', '[patientId+date]']))
    expect(idx('patients')).toEqual(expect.arrayContaining(['fileNo', 'name', 'phone', 'tags']))
    expect(idx('invoices')).toEqual(expect.arrayContaining(['number', 'patientId', 'date', 'status', '[patientId+status]']))
    expect(idx('teeth')).toEqual(expect.arrayContaining(['[patientId+tooth]', '[patientId+active]']))
    expect((db as any).settings.schema.primKey.name).toBe('key')
  })

  it('ensureClinic creates the clinic once; getClinic fills defaults without writing', async () => {
    expect(await db.clinic.count()).toBe(0)
    expect((await getClinic()).nextInvoiceNumber).toBe(1)
    expect(await db.clinic.count()).toBe(0)
    await ensureClinic()
    await ensureClinic()
    expect(await db.clinic.count()).toBe(1)
    const c = await updateClinic({ name: 'عيادة الشام' })
    expect(c.name).toBe('عيادة الشام')
    expect(c.currency).toBe(DEFAULT_CLINIC.currency)
  })

  it('settings and the activity feed', async () => {
    expect(await getSetting('x', 5)).toBe(5)
    await setSetting('x', { a: 1 })
    expect(await getSetting('x', null)).toEqual({ a: 1 })
    await logActivity({ type: 'system', action: 'other', message: 'مرحباً' })
    const a = await db.activity.toArray()
    expect(a).toHaveLength(1)
    expect(a[0].at).toBeTruthy()
  })
})

describe('db: counters', () => {
  beforeEach(async () => { await resetDatabase(); await ensureClinic() })

  it('nextInvoiceNumber increments and pads, with the clinic prefix', async () => {
    expect(await nextInvoiceNumber()).toBe('INV-000001')
    expect(await nextInvoiceNumber()).toBe('INV-000002')
    expect((await getClinic()).nextInvoiceNumber).toBe(3)
    await updateClinic({ invoicePrefix: 'F-', nextInvoiceNumber: 1234567 })
    expect(await nextInvoiceNumber()).toBe('F-1234567')
    await updateClinic({ invoicePrefix: '' , nextInvoiceNumber: 42 })
    expect(await nextInvoiceNumber()).toBe('000042')
  })

  it('nextInvoiceNumber never hands out the same number twice, even concurrently', async () => {
    const got = await Promise.all(Array.from({ length: 20 }, () => nextInvoiceNumber()))
    expect(new Set(got).size).toBe(20)
    expect((await getClinic()).nextInvoiceNumber).toBe(21)
  })

  it('nextFileNumber increments', async () => {
    expect(await nextFileNumber()).toBe(1)
    expect(await nextFileNumber()).toBe(2)
    await updateClinic({ nextFileNumber: 500 })
    expect(await nextFileNumber()).toBe(500)
    expect((await getClinic()).nextFileNumber).toBe(501)
    const many = await Promise.all(Array.from({ length: 10 }, () => nextFileNumber()))
    expect(new Set(many).size).toBe(10)
  })
})

describe('db: backup and reset', () => {
  beforeEach(async () => { await resetDatabase(); await ensureClinic() })

  it('exportBackup → importBackup round-trip preserves counts and a file Blob', async () => {
    await updateClinic({ name: 'عيادة الابتسامة', setupDone: true })
    await loadDemoData()
    const file: PatientFile = { id: 'f1', patientId: (await db.patients.toCollection().first())!.id, kind: 'xray', name: 'صورة.png', mime: 'text/plain', size: 11, data: new Blob(['hello world'], { type: 'text/plain' }), createdAt: at }
    await db.files.add(file)
    await setSetting('pref', { lang: 'ar' })
    const before = await counts()
    expect(before.patients).toBeGreaterThan(50)
    expect(before.files).toBe(1)

    const backup = await exportBackup()
    expect(backup.app).toBe('dentora')
    expect(backup.version).toBe(SCHEMA_VERSION)
    expect(typeof (backup.tables.files[0] as any).data).toBe('string')
    expect((backup.tables.files[0] as any).data).toMatch(/^data:/)
    // the backup survives being written to disk as JSON
    const json: BackupFile = JSON.parse(JSON.stringify(backup))

    await resetDatabase()
    expect(Object.values(await counts()).every(n => n === 0)).toBe(true)

    const res = await importBackup(json)
    expect(res.tables).toBe(TABLE_NAMES.length)
    expect(res.rows).toBe(Object.values(before).reduce((a, n) => a + n, 0))
    expect(await counts()).toEqual(before)

    const restored = await db.files.get('f1')
    expect(restored!.data).toBeInstanceOf(Blob)
    expect(restored!.data.size).toBe(11)
    expect(await blobText(restored!.data)).toBe('hello world')
    expect(await getSetting('pref', null)).toEqual({ lang: 'ar' })
    expect((await getClinic()).name).toBe('عيادة الابتسامة')
    const inv = (await db.invoices.toArray()).find(i => i.items.length > 1)!
    expect(inv.items.length).toBeGreaterThan(1)
  }, 60_000)

  it('importBackup replaces the current data and refuses a file that is not a backup', async () => {
    await db.patients.add({ id: 'old', fileNo: 1, name: 'قديم', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: at, updatedAt: at })
    const backup: BackupFile = { app: 'dentora', version: SCHEMA_VERSION, exportedAt: at, tables: { patients: [{ id: 'new', fileNo: 7, name: 'جديد', gender: 'female', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: at, updatedAt: at }] } }
    await importBackup(backup)
    expect((await db.patients.toArray()).map(p => p.id)).toEqual(['new'])
    expect(await db.clinic.count()).toBe(0)
    await expect(importBackup({ app: 'other' } as any)).rejects.toThrow('not-a-backup')
    await expect(importBackup(null as any)).rejects.toThrow('not-a-backup')
    expect((await db.patients.toArray()).map(p => p.id)).toEqual(['new'])
  })

  it('resetDatabase empties everything', async () => {
    await loadDemoData()
    await db.files.add({ id: 'f', patientId: 'p', kind: 'photo', name: 'a', mime: 'image/png', size: 1, data: new Blob(['x']), createdAt: at })
    await setSetting('k', 1)
    const before = await counts()
    for (const n of ['clinic', 'users', 'patients', 'appointments', 'invoices', 'payments', 'stock', 'files', 'settings', 'activity']) expect(before[n]).toBeGreaterThan(0)
    await resetDatabase()
    expect(Object.values(await counts()).every(n => n === 0)).toBe(true)
  }, 60_000)
})
