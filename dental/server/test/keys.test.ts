// Licence keys end to end through the API (in-memory D1): the seller issues keys in the panel, the clinic turns one
// into its activation code (POST /api/activate). Codes are signed with a throwaway key pair made for this file: the
// app's public key is swapped for its public half (vi.mock below), so the Worker's own checks and the app's verifier
// accept those codes, and the seller's real private key is never needed.
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkCode } from '../../src/license/core.ts'
import { handleApi } from '../src/api'
import { MAX_ACTIVATION_FAILURES } from '../src/auth'
import { ensureSchema, getLicence, getLicenceByKey, insertLicence, listLicences, stats } from '../src/db'
import { DEFAULT_SETTINGS, type Env, type Licence } from '../src/types'
import { memoryD1 } from './d1'

const testKeys = vi.hoisted(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { privateJwk: JSON.stringify({ kty, crv, x, y, d }), publicKey: { kty, crv, x, y } as JsonWebKey }
})
vi.mock('../../src/license/core.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/license/core.ts')>(),
  PUBLIC_KEY: (await testKeys).publicKey,
}))

const ORIGIN = 'https://dentora.raqeem.dev'
const PASSWORD = 'qa-dentora-pass-2026'
const KEY_FORMAT = /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/
const DEV_A = 'AB2C-D3EF', DEV_B = 'ZZZZ-9999'
const today = () => new Date().toISOString().slice(0, 10)
const plusYears = (n: number) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10) }
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

// The licences table as the first release created it (production has it, with rows, before keys exist).
const OLD_LICENCES = `CREATE TABLE licences (
    id TEXT PRIMARY KEY, device TEXT NOT NULL, plan TEXT NOT NULL, until TEXT, code TEXT NOT NULL,
    customer TEXT NOT NULL DEFAULT '', clinic TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL, search TEXT NOT NULL DEFAULT '')`
const columns = (raw: DatabaseSync, table: string) => raw.prepare(`PRAGMA table_info(${table})`).all().map(c => String(c.name))

describe('the schema migration', () => {
  it('adds the key columns to a database made before keys, keeping its licences', async () => {
    const raw = new DatabaseSync(':memory:')
    raw.exec(OLD_LICENCES)
    raw.exec(`INSERT INTO licences (id, device, plan, until, code, customer, price, status, created_at, search)
      VALUES ('old-1', 'AB2C-D3EF', 'pro', NULL, 'CODE', 'Sami', 59, 'active', '2026-10-01T00:00:00.000Z', 'ab2c-d3ef')`)
    const db = memoryD1(raw)
    await ensureSchema(db)
    expect(columns(raw, 'licences').slice(-3)).toEqual(['key', 'validity', 'activated_at'])
    expect(columns(raw, 'activation_attempts')).toEqual(['id', 'ip', 'at'])
    expect(await getLicence(db, 'old-1')).toMatchObject({ device: DEV_A, code: 'CODE', key: null, validity: null, activatedAt: null })
    expect((await listLicences(db, { q: 'ab2c', status: '', limit: 50, offset: 0 })).total).toBe(1)
    expect((await stats(db)).licences).toMatchObject({ total: 1, pending: 0 })
  })
  it('ends with the same table on an empty database, runs again without harm, and keeps keys unique', async () => {
    const fresh = new DatabaseSync(':memory:'), old = new DatabaseSync(':memory:')
    old.exec(OLD_LICENCES)
    await ensureSchema(memoryD1(fresh))
    await ensureSchema(memoryD1(old))
    expect(columns(fresh, 'licences')).toEqual(columns(old, 'licences'))
    // Another isolate (a new D1 object) finds everything in place.
    await expect(ensureSchema(memoryD1(fresh))).resolves.toBeUndefined()
    const db = memoryD1(fresh)
    const sold = (id: string, key: string | null): Licence => ({
      id, device: key ? '' : DEV_A, plan: 'pro', until: null, code: key ? '' : 'C', key, validity: key ? 'lifetime' : null, activatedAt: null,
      customer: '', clinic: '', phone: '', price: 59, note: '', status: 'active', createdAt: new Date().toISOString(),
    })
    await insertLicence(db, sold('a', 'K2M4-P6R8-T9V3-X5Z7'))
    await expect(insertLicence(db, sold('b', 'K2M4-P6R8-T9V3-X5Z7'))).rejects.toThrow(/UNIQUE/)
    // Device licences have no key: any number of them.
    await insertLicence(db, sold('c', null))
    await insertLicence(db, sold('d', null))
  })
  it('lets two isolates migrate the same database at once', async () => {
    const raw = new DatabaseSync(':memory:')
    raw.exec(OLD_LICENCES)
    await Promise.all([ensureSchema(memoryD1(raw)), ensureSchema(memoryD1(raw)), ensureSchema(memoryD1(raw))])
    expect(columns(raw, 'licences').filter(c => c === 'key')).toHaveLength(1)
  })
})

describe('licence keys through the API', () => {
  let env: Env
  beforeEach(async () => {
    env = { DB: memoryD1(), ASSETS: {} as Fetcher, ADMIN_PASSWORD: PASSWORD, LICENSE_PRIVATE_JWK: (await testKeys).privateJwk }
  })
  const call = (method: string, path: string, opts: { body?: unknown; raw?: string; cookie?: string; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { 'CF-Connecting-IP': '5.5.5.5', ...(method !== 'GET' ? { 'X-Dentora': '1', Origin: ORIGIN } : {}), ...opts.headers }
    if (opts.cookie) headers.Cookie = opts.cookie
    const body = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body))
    const req = new Request(ORIGIN + path, { method, headers, body })
    return handleApi(req, env, new URL(req.url))
  }
  const login = async () => {
    const r = await call('POST', '/api/login', { body: { password: PASSWORD } })
    expect(r.status).toBe(200)
    return r.headers.getSetCookie()[0].split(';')[0]
  }
  const sale = { plan: 'pro', validity: 'lifetime', customer: 'Dr. Lina', clinic: 'Al Noor', phone: '+963 996 489 504', note: '' }
  type Item = { licence: Licence; message: { ar: string; en: string; whatsappUrl: string | null } }
  const sell = async (cookie: string, over: Record<string, unknown> = {}): Promise<Item[]> => {
    const r = await call('POST', '/api/keys', { cookie, body: { ...sale, ...over } })
    expect(r.status).toBe(201)
    return ((await r.json()) as { items: Item[] }).items
  }
  /** As the app or the activation page sends it: no cookie, no X-Dentora. */
  const activate = (body: unknown, opts: { ip?: string; headers?: Record<string, string> } = {}) => {
    const req = new Request(`${ORIGIN}/api/activate`, {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': opts.ip ?? '7.7.7.7', ...opts.headers },
    })
    return handleApi(req, env, new URL(req.url))
  }
  const auditOf = async (cookie: string) => ((await (await call('GET', '/api/audit', { cookie })).json()) as { items: { action: string; detail: string; ip: string }[] }).items
  /** A sale put straight into the database (a sale in the past, or a date already gone). */
  const insertKey = async (key: string, over: Partial<Licence>) => {
    await ensureSchema(env.DB)
    await insertLicence(env.DB, {
      id: crypto.randomUUID(), device: '', plan: 'pro', until: null, code: '', key, validity: 'lifetime', activatedAt: null,
      customer: '', clinic: '', phone: '', price: 59, note: '', status: 'active', createdAt: new Date().toISOString(), ...over,
    })
  }

  describe('in the control panel', () => {
    it('POST /api/keys makes waiting keys at the settings price, and logs them without the keys', async () => {
      const cookie = await login()
      const items = await sell(cookie, { count: 3 })
      expect(items).toHaveLength(3)
      for (const { licence, message } of items) {
        expect(licence.key).toMatch(KEY_FORMAT)
        expect(licence).toMatchObject({ device: '', code: '', plan: 'pro', validity: 'lifetime', until: null, activatedAt: null, price: DEFAULT_SETTINGS.priceUsd, status: 'active', clinic: 'Al Noor' })
        expect(message.ar).toContain(licence.key)
        expect(message.en).toContain('/en/activate')
        expect(message.whatsappUrl).toMatch(/^https:\/\/wa\.me\/963996489504\?text=/)
      }
      expect(new Set(items.map(i => i.licence.key)).size).toBe(3)
      const [entry] = await auditOf(cookie)
      expect(entry.action).toBe('keys.create')
      expect(entry.detail).toBe('3 × pro lifetime · $59 · Al Noor')
      for (const { licence } of items) {
        expect(entry.detail).not.toContain(licence.key)
        expect(entry.detail).not.toContain(licence.key!.slice(-4))
      }

      await call('PUT', '/api/settings', { cookie, body: { priceUsd: 45 } })
      const [y1] = await sell(cookie, { validity: '1y', plan: 'standard' })
      expect(y1.licence).toMatchObject({ price: 45, plan: 'standard', validity: '1y', until: null })
      const [dated] = await sell(cookie, { validity: 'date', until: '2031-12-31', price: 20 })
      expect(dated.licence).toMatchObject({ price: 20, validity: 'date', until: '2031-12-31' })
      expect((await auditOf(cookie))[0].detail).toBe('1 × pro 2031-12-31 · $20 · Al Noor')
      // Issuing keys signs nothing: it works without the signing secret.
      env.LICENSE_PRIVATE_JWK = undefined
      expect((await sell(cookie)).length).toBe(1)
    })
    it('POST /api/keys refuses a bad batch, naming what is wrong, and makes none', async () => {
      const cookie = await login()
      const cases: [Record<string, unknown>, Record<string, unknown>][] = [
        [{ count: 0 }, { error: 'count' }], [{ count: 51 }, { error: 'count' }], [{ count: 1.5 }, { error: 'count' }],
        [{ plan: 'gold' }, { error: 'plan' }], [{ validity: 'forever' }, { error: 'validity' }],
        [{ validity: 'date', until: '2020-01-01' }, { error: 'until' }], [{ price: -3 }, { error: 'price' }],
        [{ customer: 'x'.repeat(201) }, { error: 'field', field: 'customer' }],
      ]
      for (const [over, error] of cases) {
        const r = await call('POST', '/api/keys', { cookie, body: { ...sale, ...over } })
        expect([r.status, await r.json()]).toEqual([400, error])
      }
      const broken = await call('POST', '/api/keys', { cookie, raw: '[1]' })
      expect([broken.status, await broken.json()]).toEqual([400, { error: 'field', field: 'body' }])
      expect(((await (await call('GET', '/api/licences', { cookie })).json()) as { total: number }).total).toBe(0)
    })
    it('lists keys with the rest, finds them with or without dashes, and filters the pending ones', async () => {
      const cookie = await login()
      const [one, two] = await sell(cookie, { count: 2, clinic: 'Smile' })
      expect((await call('POST', '/api/licences', { cookie, body: { ...sale, device: DEV_B } })).status).toBe(201)
      expect((await activate({ key: two.licence.key, device: DEV_A })).status).toBe(200)
      const list = async (query: string) => ((await (await call('GET', `/api/licences?${query}`, { cookie })).json()) as { items: Licence[]; total: number })
      expect((await list('')).total).toBe(3)
      expect((await list(`q=${one.licence.key}`)).items.map(i => i.id)).toEqual([one.licence.id])
      expect((await list(`q=${one.licence.key!.replace(/-/g, '').toLowerCase()}`)).items.map(i => i.id)).toEqual([one.licence.id])
      expect((await list(`q=${DEV_A}`)).items.map(i => i.id)).toEqual([two.licence.id])
      expect((await list('status=pending')).items.map(i => i.id)).toEqual([one.licence.id])
      expect((await list('status=pending&q=smile')).total).toBe(1)
      expect((await call('GET', '/api/licences?status=waiting', { cookie })).status).toBe(400)
      const st = (await (await call('GET', '/api/stats', { cookie })).json()) as { licences: { total: number; pending: number } }
      expect(st.licences).toMatchObject({ total: 3, pending: 1 })
    })
    it('shows the key message while the key waits, the code message once it is activated', async () => {
      const cookie = await login()
      const [{ licence }] = await sell(cookie, { validity: '2y' })
      const before = (await (await call('GET', `/api/licences/${licence.id}`, { cookie })).json()) as Item
      expect(before.message.en).toContain(licence.key)
      expect(before.message.en).toContain('valid for two years from activation')
      const { code } = (await (await activate({ key: licence.key, device: DEV_A })).json()) as { code: string }
      const after = (await (await call('GET', `/api/licences/${licence.id}`, { cookie })).json()) as Item
      expect(after.licence).toMatchObject({ device: DEV_A, code, until: plusYears(2), validity: '2y', key: licence.key })
      expect(after.licence.activatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(after.message.en).toContain(code)
      expect(after.message.en).not.toContain(licence.key)
      expect(after.message.en).toContain(`valid until ${plusYears(2)}`)
    })
    it('PATCH refunded or void stops a waiting key from being activated; active again lets it through', async () => {
      const cookie = await login()
      const [a, b] = await sell(cookie, { count: 2 })
      expect((await call('PATCH', `/api/licences/${a.licence.id}`, { cookie, body: { status: 'void' } })).status).toBe(200)
      expect((await call('PATCH', `/api/licences/${b.licence.id}`, { cookie, body: { status: 'refunded' } })).status).toBe(200)
      for (const { licence } of [a, b]) {
        const r = await activate({ key: licence.key, device: DEV_A })
        expect([r.status, await r.json()]).toEqual([410, { error: 'void' }])
      }
      expect(await getLicenceByKey(env.DB, a.licence.key!)).toMatchObject({ device: '', code: '' })
      const [log] = await auditOf(cookie)
      expect(log).toMatchObject({ action: 'licence.update', detail: `…${b.licence.key!.slice(-4)} · status: active → refunded` })
      await call('PATCH', `/api/licences/${a.licence.id}`, { cookie, body: { status: 'active' } })
      expect((await activate({ key: a.licence.key, device: DEV_A })).status).toBe(200)
    })
    it('exports keys in the CSV with their validity and activation time', async () => {
      const cookie = await login()
      const [waiting] = await sell(cookie, { validity: '1y' })
      const [used] = await sell(cookie)
      await call('POST', '/api/licences', { cookie, body: { ...sale, device: DEV_B, validity: 'date', until: '2031-12-31' } })
      await activate({ key: used.licence.key, device: DEV_A })
      const text = new TextDecoder().decode(await (await call('GET', '/api/licences.csv', { cookie })).arrayBuffer()).replace(/^﻿/, '')
      const [head, ...rows] = text.trimEnd().split('\r\n').map(l => l.split(','))
      expect(head.join(',')).toBe('created_at,device,plan,valid_until,status,customer,clinic,phone,price_usd,note,code,id,key,validity,activated_at')
      const row = (key: string) => Object.fromEntries(head.map((h, i) => [h, rows.find(r => r[head.indexOf('key')] === key)![i]]))
      expect(row(waiting.licence.key!)).toMatchObject({ device: '', code: '', valid_until: '', validity: '1y', activated_at: '' })
      expect(row(used.licence.key!)).toMatchObject({ device: DEV_A, valid_until: 'lifetime', validity: 'lifetime' })
      expect(row(used.licence.key!).activated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(row('')).toMatchObject({ device: DEV_B, valid_until: '2031-12-31', key: '', validity: '', activated_at: '' })
    })
    it('POST /api/verify tells where a key stands, whatever device is given', async () => {
      const cookie = await login()
      const [pending, activated, refunded, voided] = await sell(cookie, { count: 4, validity: '1y' })
      const { code } = (await (await activate({ key: activated.licence.key, device: DEV_A })).json()) as { code: string }
      await call('PATCH', `/api/licences/${refunded.licence.id}`, { cookie, body: { status: 'refunded' } })
      await call('PATCH', `/api/licences/${voided.licence.id}`, { cookie, body: { status: 'void' } })
      const verify = async (body: Record<string, unknown>) => {
        const r = await call('POST', '/api/verify', { cookie, body })
        expect(r.status).toBe(200)
        return r.json()
      }
      const typed = pending.licence.key!.toLowerCase().replace(/-/g, ' ')
      expect(await verify({ code: typed })).toEqual({ kind: 'key', ok: true, status: 'pending', plan: 'pro', validity: '1y' })
      expect(await verify({ code: activated.licence.key, device: '' })).toMatchObject({
        kind: 'key', ok: true, status: 'activated', plan: 'pro', validity: '1y', until: plusYears(1), device: DEV_A,
      })
      expect(await verify({ code: refunded.licence.key, device: DEV_B })).toMatchObject({ kind: 'key', ok: false, status: 'refunded' })
      expect(await verify({ code: voided.licence.key })).toMatchObject({ kind: 'key', ok: false, status: 'void' })
      expect(await verify({ code: '2345-6789-ABCD-EFGH' })).toEqual({ kind: 'key', ok: false, status: 'unknown' })
      // Codes are checked as before, for a device.
      expect(await verify({ code, device: DEV_A })).toEqual({ kind: 'activation', ok: true, plan: 'pro', until: plusYears(1) })
      expect((await call('POST', '/api/verify', { cookie, body: { code } })).status).toBe(400)
    })
  })

  describe('public activation (POST /api/activate)', () => {
    it('turns a key into the code for the device, checked with the app’s verifier', async () => {
      const cookie = await login()
      const [{ licence }] = await sell(cookie, { validity: '1y' })
      const r = await activate({ key: licence.key!.toLowerCase().replace(/-/g, ''), device: 'ab2c d3ef' }, { headers: { Origin: 'null' } })
      expect(r.status).toBe(200)
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(r.headers.get('Set-Cookie')).toBeNull()
      expect(r.headers.get('Cache-Control')).toBe('no-store')
      const body = (await r.json()) as { code: string; device: string; plan: string; until: string | null }
      expect(Object.keys(body).sort()).toEqual(['code', 'device', 'plan', 'until'])
      expect(body).toMatchObject({ device: DEV_A, plan: 'pro', until: plusYears(1) })
      expect(body.code).toMatch(/^([2-9A-HJ-NP-Z]{4}-){27}[2-9A-HJ-NP-Z]{4}$/)
      const check = await checkCode(DEV_A, body.code, new Date(), (await testKeys).publicKey)
      expect(check.ok && check.plan === 'pro' && check.until?.toISOString().slice(0, 10)).toBe(plusYears(1))
      expect(await getLicenceByKey(env.DB, licence.key!)).toMatchObject({ device: DEV_A, code: body.code, until: plusYears(1) })
      const [entry] = await auditOf(cookie)
      expect(entry).toMatchObject({ action: 'key.activate', detail: `…${licence.key!.slice(-4)} · ${DEV_A}`, ip: '' })
    })
    it('gives the same device the same code again, and refuses another device', async () => {
      const cookie = await login()
      const [{ licence }] = await sell(cookie)
      const first = (await (await activate({ key: licence.key, device: DEV_A })).json()) as { code: string }
      const again = await activate({ key: licence.key!.replace(/-/g, ' '), device: 'AB2CD3EF' })
      expect(again.status).toBe(200)
      expect(((await again.json()) as { code: string }).code).toBe(first.code)
      const other = await activate({ key: licence.key, device: DEV_B })
      expect([other.status, await other.json()]).toEqual([409, { error: 'used' }])
      expect(other.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const [used, activation] = await auditOf(cookie)
      expect(used).toMatchObject({ action: 'key.used', detail: `…${licence.key!.slice(-4)} · ${DEV_A}`, ip: '' })
      expect(used.detail).not.toContain(DEV_B)
      // The repeat by the same device wrote nothing: the entry before is the activation itself.
      expect(activation).toMatchObject({ action: 'key.activate', detail: `…${licence.key!.slice(-4)} · ${DEV_A}` })
      expect(await getLicenceByKey(env.DB, licence.key!)).toMatchObject({ device: DEV_A, code: first.code })
    })
    it('refuses a date key after its day (410 expired), and takes it on the day itself', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', { validity: 'date', until: dayBefore(today()) })
      await insertKey('WXYZ-2345-6789-ABCD', { validity: 'date', until: today() })
      const late = await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })
      expect([late.status, await late.json()]).toEqual([410, { error: 'expired' }])
      expect(late.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const onTime = await activate({ key: 'WXYZ-2345-6789-ABCD', device: DEV_A })
      expect([onTime.status, ((await onTime.json()) as { until: string }).until]).toEqual([200, today()])
    })
    it('counts 1y and 2y from the activation day, not from the sale', async () => {
      const soldLastYear = new Date(Date.now() - 400 * 86_400_000).toISOString()
      await insertKey('K2M4-P6R8-T9V3-X5Z7', { validity: '1y', createdAt: soldLastYear })
      await insertKey('WXYZ-2345-6789-ABCD', { validity: '2y', plan: 'standard', createdAt: soldLastYear })
      expect(await (await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })).json()).toMatchObject({ plan: 'pro', until: plusYears(1) })
      expect(await (await activate({ key: 'WXYZ-2345-6789-ABCD', device: DEV_B })).json()).toMatchObject({ plan: 'standard', until: plusYears(2) })
    })
    it('answers 400 for a malformed key, device or body and 404 for an unknown key, all with CORS', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      const cases: [unknown, number, Record<string, unknown>][] = [
        [{ key: 'K2M4-P6R8-T9V3', device: DEV_A }, 400, { error: 'key' }],
        [{ key: 'K0M4-P6R8-T9V3-X5Z7', device: DEV_A }, 400, { error: 'key' }],
        [{ device: DEV_A }, 400, { error: 'key' }],
        [{ key: 'K2M4-P6R8-T9V3-X5Z7', device: 'AB1C-D3EF' }, 400, { error: 'device' }],
        [{ key: 'K2M4-P6R8-T9V3-X5Z7' }, 400, { error: 'device' }],
        ['{not json', 400, { error: 'field', field: 'body' }],
        [{ key: '2345-6789-ABCD-EFGH', device: DEV_A }, 404, { error: 'unknown' }],
      ]
      for (const [body, status, error] of cases) {
        const r = await activate(body)
        expect([r.status, await r.json()]).toEqual([status, error])
        expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*')
        expect(r.headers.get('Set-Cookie')).toBeNull()
      }
      // Arabic-Indic digits in the key and the device are read as Latin ones.
      expect((await activate({ key: 'K٢M٤-P٦R٨-T٩V٣-X٥Z٧', device: 'AB٢C-D٣EF' })).status).toBe(200)
    })
    it('needs no session, cookie, X-Dentora or same Origin, and never sets a cookie', async () => {
      const cookie = await login()
      const [{ licence }] = await sell(cookie)
      const r = await activate({ key: licence.key, device: DEV_A }, { headers: { Origin: 'https://another.example', Cookie: cookie } })
      expect(r.status).toBe(200)
      expect(r.headers.get('Set-Cookie')).toBeNull()
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
    it('answers the CORS preflight, and no other method', async () => {
      const pre = await handleApi(new Request(`${ORIGIN}/api/activate`, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST' } }), env, new URL(`${ORIGIN}/api/activate`))
      expect(pre.status).toBe(204)
      const cors = ['Allow-Origin', 'Allow-Methods', 'Allow-Headers', 'Max-Age'].map(h => pre.headers.get(`Access-Control-${h}`))
      expect(cors).toEqual(['*', 'POST, OPTIONS', 'Content-Type', '86400'])
      expect(await pre.text()).toBe('')
      const get = await handleApi(new Request(`${ORIGIN}/api/activate`), env, new URL(`${ORIGIN}/api/activate`))
      expect([get.status, get.headers.get('Access-Control-Allow-Origin')]).toEqual([404, '*'])
    })
    it('answers a server failure with CORS too', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      env.DB = { prepare() { throw new Error('D1 unavailable') }, batch: () => Promise.reject(new Error('D1 unavailable')) } as unknown as D1Database
      const r = await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })
      expect([r.status, await r.json(), r.headers.get('Access-Control-Allow-Origin')]).toEqual([500, { error: 'server' }, '*'])
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })
    it(`locks an address after ${MAX_ACTIVATION_FAILURES} failures, for the rest of the 15 minutes`, async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      for (let i = 0; i < MAX_ACTIVATION_FAILURES; i++) {
        const r = await activate({ key: `2345-6789-ABCD-EF${'GHJKLMNPQR'[i]}${'GHJKLMNPQR'[i]}`, device: DEV_A }, { ip: '9.9.9.9' })
        expect(r.status).toBe(404)
      }
      const locked = await activate({ key: '2345-6789-ABCD-EFGH', device: DEV_A }, { ip: '9.9.9.9' })
      expect(locked.status).toBe(429)
      expect(locked.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const body = (await locked.json()) as { error: string; retryAfter: number }
      expect(body.error).toBe('locked')
      expect(body.retryAfter).toBeGreaterThan(880)
      expect(body.retryAfter).toBeLessThanOrEqual(900)
      // Even the right key waits; another address does not.
      expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A }, { ip: '9.9.9.9' })).status).toBe(429)
      expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A }, { ip: '9.9.9.8' })).status).toBe(200)
    })
    it(`looks up at most ${MAX_ACTIVATION_FAILURES} keys from one address, however many arrive at once`, async () => {
      const all = await Promise.all(Array.from({ length: 30 }, () => activate({ key: '2345-6789-ABCD-EFGH', device: DEV_A }, { ip: '9.9.9.7' })))
      expect(all.filter(r => r.status === 404)).toHaveLength(MAX_ACTIVATION_FAILURES)
      expect(all.filter(r => r.status === 429)).toHaveLength(30 - MAX_ACTIVATION_FAILURES)
    })
    it('counts IPv6 addresses per /64', async () => {
      for (let i = 1; i <= MAX_ACTIVATION_FAILURES; i++) await activate({ key: '2345-6789-ABCD-EFGH', device: DEV_A }, { ip: `2001:db8:1:2::${i}` })
      expect((await activate({ key: '2345-6789-ABCD-EFGH', device: DEV_A }, { ip: '2001:db8:1:2:ffff::9' })).status).toBe(429)
      expect((await activate({ key: '2345-6789-ABCD-EFGH', device: DEV_A }, { ip: '2001:db8:1:3::1' })).status).toBe(404)
    })
    it('counts only failures: successes, broken bodies and a Worker that cannot sign give their slot back', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      await insertKey('WXYZ-2345-6789-ABCD', {})
      for (let i = 0; i < 12; i++) expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })).status).toBe(200)
      for (let i = 0; i < 12; i++) expect((await activate('[]')).status).toBe(400)
      env.LICENSE_PRIVATE_JWK = undefined
      for (let i = 0; i < 12; i++) expect((await activate({ key: 'WXYZ-2345-6789-ABCD', device: DEV_A })).status).toBe(503)
      for (let i = 0; i < MAX_ACTIVATION_FAILURES; i++) expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_B })).status).toBe(409)
      expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })).status).toBe(429)
    })
    it('answers 503 when the Worker cannot sign, and the key stays unused', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      for (const secret of [undefined, '{not json', JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b', d: 'c' })]) {
        env.LICENSE_PRIVATE_JWK = secret
        const r = await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })
        expect([r.status, await r.json(), r.headers.get('Access-Control-Allow-Origin')]).toEqual([503, { error: 'signing' }, '*'])
      }
      expect(await getLicenceByKey(env.DB, 'K2M4-P6R8-T9V3-X5Z7')).toMatchObject({ device: '', code: '', activatedAt: null })
      env.LICENSE_PRIVATE_JWK = (await testKeys).privateJwk
      expect((await activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })).status).toBe(200)
    })
    it('lets exactly one of several devices racing for a key win', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      const devices = [DEV_A, DEV_B, 'XY7K-M4PQ', 'HJKL-MNPQ', 'RSTU-VWXY', '2345-6789']
      const answers = await Promise.all(devices.map((device, i) => activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device }, { ip: `10.0.0.${i}` })))
      expect(answers.map(r => r.status).sort()).toEqual([200, 409, 409, 409, 409, 409])
      const winner = devices[answers.findIndex(r => r.status === 200)]
      const { code } = (await answers.find(r => r.status === 200)!.json()) as { code: string }
      expect(await getLicenceByKey(env.DB, 'K2M4-P6R8-T9V3-X5Z7')).toMatchObject({ device: winner, code })
      expect((await checkCode(winner, code, new Date(), (await testKeys).publicKey)).ok).toBe(true)
    })
    it('gives one device that asks twice at once the one stored code', async () => {
      await insertKey('K2M4-P6R8-T9V3-X5Z7', {})
      const answers = await Promise.all([1, 2, 3].map(() => activate({ key: 'K2M4-P6R8-T9V3-X5Z7', device: DEV_A })))
      expect(answers.map(r => r.status)).toEqual([200, 200, 200])
      const codes = await Promise.all(answers.map(async r => ((await r.json()) as { code: string }).code))
      expect(new Set(codes).size).toBe(1)
      expect((await getLicenceByKey(env.DB, 'K2M4-P6R8-T9V3-X5Z7'))?.code).toBe(codes[0])
    })
  })

  describe('the rest of the API', () => {
    it('still needs the session and the CSRF header, and answers no CORS', async () => {
      const keys = await call('POST', '/api/keys', { body: sale })
      expect([keys.status, keys.headers.get('Access-Control-Allow-Origin')]).toEqual([401, null])
      const cookie = await login()
      expect((await call('POST', '/api/keys', { cookie, body: sale, headers: { 'X-Dentora': '' } })).status).toBe(403)
      expect((await call('POST', '/api/keys', { cookie, body: sale, headers: { Origin: 'https://another.example' } })).status).toBe(403)
      const pre = await handleApi(new Request(`${ORIGIN}/api/keys`, { method: 'OPTIONS', headers: { Origin: 'https://another.example' } }), env, new URL(`${ORIGIN}/api/keys`))
      expect([pre.status, pre.headers.get('Access-Control-Allow-Origin')]).toEqual([403, null])
      for (const path of ['/api/licences', '/api/licences.csv', '/api/stats']) {
        const r = await call('GET', path)
        expect([r.status, r.headers.get('Access-Control-Allow-Origin')]).toEqual([401, null])
      }
      expect((await call('POST', '/api/verify', { body: { code: '2345-6789-ABCD-EFGH' } })).status).toBe(401)
    })
  })
})
