import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_OVERALL, MAX_PER_IP } from '../src/auth'
import { checkKeysInput, checkLicenceInput, checkLicencePatch, checkSettingsPatch, handleApi, isHttpsUrl, priceOf } from '../src/api'
import { countDownload, ensureSchema, insertLicence, listLicences, stats } from '../src/db'
import { DEFAULT_SETTINGS, type Env, type Licence } from '../src/types'
import { memoryD1 } from './d1'

const NOW = new Date(Date.UTC(2026, 9, 11, 12))
const base = { device: 'AB2C-D3EF', plan: 'pro', validity: 'lifetime', customer: 'Sami', clinic: 'Al Noor', phone: '+963 996 489 504', price: 59, note: '' }

describe('licence input', () => {
  it('accepts a valid sale and cleans the device number', () => {
    const r = checkLicenceInput({ ...base, device: ' ab2c d3ef ' }, 59, NOW)
    expect(r.ok && r.value.device).toBe('AB2C-D3EF')
    expect(r.ok && r.value.until).toBeNull()
  })
  it('names the first bad field', () => {
    expect(checkLicenceInput({ ...base, device: 'AB2C-D3E' }, 59, NOW)).toEqual({ ok: false, error: 'device' })
    expect(checkLicenceInput({ ...base, device: 'AB1C-D3EF' }, 59, NOW)).toEqual({ ok: false, error: 'device' })
    expect(checkLicenceInput({ ...base, plan: 'gold' }, 59, NOW)).toEqual({ ok: false, error: 'plan' })
    expect(checkLicenceInput({ ...base, validity: '3y' }, 59, NOW)).toEqual({ ok: false, error: 'validity' })
    expect(checkLicenceInput({ ...base, validity: 'date' }, 59, NOW)).toEqual({ ok: false, error: 'until' })
    expect(checkLicenceInput({ ...base, validity: 'date', until: '2026-10-10' }, 59, NOW)).toEqual({ ok: false, error: 'until' })
    expect(checkLicenceInput({ ...base, validity: 'date', until: '2027-02-30' }, 59, NOW)).toEqual({ ok: false, error: 'until' })
    expect(checkLicenceInput({ ...base, validity: 'date', until: '1y' }, 59, NOW)).toEqual({ ok: false, error: 'until' })
    expect(checkLicenceInput({ ...base, price: -1 }, 59, NOW)).toEqual({ ok: false, error: 'price' })
    expect(checkLicenceInput({ ...base, price: 100_001 }, 59, NOW)).toEqual({ ok: false, error: 'price' })
    expect(checkLicenceInput({ ...base, price: 'abc' }, 59, NOW)).toEqual({ ok: false, error: 'price' })
    expect(checkLicenceInput({ ...base, customer: 'x'.repeat(201) }, 59, NOW)).toEqual({ ok: false, error: 'field', field: 'customer' })
    expect(checkLicenceInput({ ...base, note: 'x'.repeat(1001) }, 59, NOW)).toEqual({ ok: false, error: 'field', field: 'note' })
    expect(checkLicenceInput({ ...base, phone: 12 }, 59, NOW)).toEqual({ ok: false, error: 'field', field: 'phone' })
  })
  it('works out the last day', () => {
    const y1 = checkLicenceInput({ ...base, validity: '1y' }, 59, NOW)
    expect(y1.ok && y1.value.until?.toISOString().slice(0, 10)).toBe('2027-10-11')
    const y2 = checkLicenceInput({ ...base, validity: '2y' }, 59, NOW)
    expect(y2.ok && y2.value.until?.toISOString().slice(0, 10)).toBe('2028-10-11')
    const d = checkLicenceInput({ ...base, validity: 'date', until: '2026-10-11' }, 59, NOW)
    expect(d.ok && d.value.until?.toISOString().slice(0, 10)).toBe('2026-10-11')
  })
  it('takes the settings price when none is given, and rounds to cents', () => {
    const r = checkLicenceInput({ ...base, price: undefined }, 45, NOW)
    expect(r.ok && r.value.price).toBe(45)
    expect(priceOf('59.999')).toBe(60)
    expect(priceOf(0)).toBe(0)
  })
})

describe('keys input', () => {
  const keys = { plan: 'pro', validity: 'lifetime', customer: 'Reseller', clinic: '', phone: '', note: '' }
  it('makes one key by default, at the settings price; a date key keeps its day, 1y/2y wait for activation', () => {
    expect(checkKeysInput(keys, 59, NOW)).toEqual({ ok: true, value: { ...keys, count: 1, price: 59, until: null } })
    const y1 = checkKeysInput({ ...keys, validity: '1y', count: 5, price: '40' }, 59, NOW)
    expect(y1.ok && [y1.value.count, y1.value.price, y1.value.validity, y1.value.until]).toEqual([5, 40, '1y', null])
    const d = checkKeysInput({ ...keys, validity: 'date', until: '2027-03-31', count: '3' }, 59, NOW)
    expect(d.ok && [d.value.count, d.value.until?.toISOString().slice(0, 10)]).toEqual([3, '2027-03-31'])
  })
  it('takes 1 to 50 keys, whole numbers only', () => {
    for (const count of [0, 51, 2.5, -1, 'many', '3x', true, [2]]) expect(checkKeysInput({ ...keys, count }, 59, NOW)).toEqual({ ok: false, error: 'count' })
    expect(checkKeysInput({ ...keys, count: 50 }, 59, NOW).ok).toBe(true)
  })
  it('checks the sale like a licence, without a device', () => {
    expect(checkKeysInput({ ...keys, plan: 'gold' }, 59, NOW)).toEqual({ ok: false, error: 'plan' })
    expect(checkKeysInput({ ...keys, validity: '3y' }, 59, NOW)).toEqual({ ok: false, error: 'validity' })
    expect(checkKeysInput({ ...keys, validity: 'date', until: '2026-10-10' }, 59, NOW)).toEqual({ ok: false, error: 'until' })
    expect(checkKeysInput({ ...keys, price: -1 }, 59, NOW)).toEqual({ ok: false, error: 'price' })
    expect(checkKeysInput({ ...keys, note: 'x'.repeat(1001) }, 59, NOW)).toEqual({ ok: false, error: 'field', field: 'note' })
    expect(checkKeysInput({ ...keys, count: 0, plan: 'gold' }, 59, NOW)).toEqual({ ok: false, error: 'count' })
  })
})

describe('licence patch', () => {
  it('keeps only known fields and checks them', () => {
    expect(checkLicencePatch({ status: 'refunded', price: 0, device: 'ignored' })).toEqual({ ok: true, value: { status: 'refunded', price: 0 } })
    expect(checkLicencePatch({ status: 'deleted' })).toEqual({ ok: false, error: 'field', field: 'status' })
    expect(checkLicencePatch({ price: -5 })).toEqual({ ok: false, error: 'price' })
    expect(checkLicencePatch({ note: 'x'.repeat(1001) })).toEqual({ ok: false, error: 'field', field: 'note' })
  })
})

describe('settings', () => {
  it('accepts valid values', () => {
    const r = checkSettingsPatch({ priceUsd: 49, whatsapp: '+963 996 489 504', email: 'sales@raqeem.dev', windowsUrl: 'https://example.com/Dentora-Setup.exe', announcementEn: '  Offer\nends Friday ' }, DEFAULT_SETTINGS)
    expect(r.ok && r.value).toMatchObject({ priceUsd: 49, email: 'sales@raqeem.dev', announcementEn: 'Offer ends Friday' })
  })
  it('refuses bad values, naming the field', () => {
    expect(checkSettingsPatch({ whatsapp: '12345' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'whatsapp' })
    expect(checkSettingsPatch({ whatsapp: '+1 234 567 890 123 456' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'whatsapp' })
    expect(checkSettingsPatch({ whatsapp: 'call me' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'whatsapp' })
    expect(checkSettingsPatch({ windowsUrl: 'http://example.com/x.exe' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'windowsUrl' })
    expect(checkSettingsPatch({ windowsUrl: 'javascript:alert(1)' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'windowsUrl' })
    expect(checkSettingsPatch({ priceUsd: 100_001 }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'priceUsd' })
    expect(checkSettingsPatch({ priceTextAr: 'x'.repeat(301) }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'priceTextAr' })
    expect(checkSettingsPatch({ email: 'not-an-email' }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'email' })
    expect(checkSettingsPatch({ announcementAr: 5 }, DEFAULT_SETTINGS)).toEqual({ ok: false, error: 'field', field: 'announcementAr' })
  })
  it('allows clearing the optional ones', () => {
    const r = checkSettingsPatch({ email: '', windowsUrl: '', announcementAr: '' }, { ...DEFAULT_SETTINGS, email: 'a@b.co' })
    expect(r.ok && r.value.email).toBe('')
  })
  it('knows an https URL', () => {
    expect(isHttpsUrl('https://dentora.raqeem.dev/x')).toBe(true)
    expect(isHttpsUrl('https://user:pw@x.com')).toBe(false)
    expect(isHttpsUrl('ftp://x.com')).toBe(false)
  })
})

describe('licence search and stats', () => {
  const lic = (over: Partial<Licence>): Licence => ({
    id: crypto.randomUUID(), device: 'AB2C-D3EF', plan: 'pro', until: null, code: 'C', key: null, validity: null, activatedAt: null,
    customer: '', clinic: '', phone: '', price: 59, note: '', status: 'active', createdAt: new Date().toISOString(), ...over,
  })
  /** A key sold and not activated yet. */
  const waiting = (key: string, over: Partial<Licence> = {}) => lic({ device: '', code: '', key, validity: 'lifetime', ...over })
  it('finds by device with or without the dash, by name and by phone', async () => {
    const db = memoryD1(); await ensureSchema(db)
    await insertLicence(db, lic({ device: 'AB2C-D3EF', customer: 'سامي', clinic: 'Al Noor', phone: '+963 996 489 504', createdAt: '2026-10-01T00:00:00.000Z' }))
    await insertLicence(db, lic({ device: 'ZZZZ-9999', customer: 'Lina', phone: '0944 123 456', status: 'refunded', createdAt: '2026-10-02T00:00:00.000Z' }))
    const q = (s: string, status: '' | 'active' | 'refunded' = '') => listLicences(db, { q: s, status, limit: 50, offset: 0 }).then(r => r.items.map(i => i.device))
    expect(await q('ab2cd3ef')).toEqual(['AB2C-D3EF'])
    expect(await q('AB2C-D3')).toEqual(['AB2C-D3EF'])
    expect(await q('سامي')).toEqual(['AB2C-D3EF'])
    expect(await q('al noor')).toEqual(['AB2C-D3EF'])
    expect(await q('0996 489 504')).toEqual(['AB2C-D3EF'])
    expect(await q('944123')).toEqual(['ZZZZ-9999'])
    expect(await q('')).toEqual(['ZZZZ-9999', 'AB2C-D3EF'])
    expect(await q('', 'refunded')).toEqual(['ZZZZ-9999'])
    expect(await q('%')).toEqual([])
  })
  it('finds a key with or without its dashes, and lists the keys still waiting', async () => {
    const db = memoryD1(); await ensureSchema(db)
    await insertLicence(db, lic({ device: 'AB2C-D3EF', createdAt: '2026-10-01T00:00:00.000Z' }))
    await insertLicence(db, waiting('K2M4-P6R8-T9V3-X5Z7', { clinic: 'Al Noor', createdAt: '2026-10-02T00:00:00.000Z' }))
    await insertLicence(db, waiting('ABCD-EFGH-JKLM-NPQR', { status: 'void', createdAt: '2026-10-03T00:00:00.000Z' }))
    await insertLicence(db, lic({ device: 'ZZZZ-9999', key: 'WXYZ-2345-6789-ABCD', validity: '1y', activatedAt: '2026-10-05T00:00:00.000Z', createdAt: '2026-10-04T00:00:00.000Z' }))
    const q = (s: string, status: '' | 'pending' | 'void' = '') => listLicences(db, { q: s, status, limit: 50, offset: 0 }).then(r => r.items.map(i => i.key ?? i.device))
    expect(await q('K2M4-P6R8-T9V3-X5Z7')).toEqual(['K2M4-P6R8-T9V3-X5Z7'])
    expect(await q('k2m4p6r8t9v3x5z7')).toEqual(['K2M4-P6R8-T9V3-X5Z7'])
    expect(await q('T9V3-X5')).toEqual(['K2M4-P6R8-T9V3-X5Z7'])
    expect(await q('WXYZ2345')).toEqual(['WXYZ-2345-6789-ABCD'])
    expect(await q('zzzz9999')).toEqual(['WXYZ-2345-6789-ABCD'])
    expect(await q('', 'pending')).toEqual(['K2M4-P6R8-T9V3-X5Z7'])
    expect(await q('al noor', 'pending')).toEqual(['K2M4-P6R8-T9V3-X5Z7'])
    expect(await q('', 'void')).toEqual(['ABCD-EFGH-JKLM-NPQR'])
    const all = await listLicences(db, { q: '', status: '', limit: 50, offset: 0 })
    expect(all.total).toBe(4)
    expect(all.items.find(i => i.key === 'K2M4-P6R8-T9V3-X5Z7')).toMatchObject({ device: '', code: '', validity: 'lifetime', activatedAt: null })
    expect(all.items.find(i => i.device === 'AB2C-D3EF')).toMatchObject({ key: null, validity: null, activatedAt: null })
  })
  it('counts sales and revenue', async () => {
    const db = memoryD1(); await ensureSchema(db)
    const now = new Date(Date.UTC(2026, 9, 11))
    await insertLicence(db, lic({ price: 59, createdAt: '2026-10-05T00:00:00.000Z' }))
    await insertLicence(db, lic({ price: 40, createdAt: '2026-09-05T00:00:00.000Z' }))
    await insertLicence(db, lic({ price: 59, status: 'refunded', createdAt: '2026-10-06T00:00:00.000Z' }))
    await insertLicence(db, lic({ price: 59, status: 'void', createdAt: '2026-10-07T00:00:00.000Z' }))
    // Keys are sales too: counted and summed like licences; pending = active keys not activated yet.
    await insertLicence(db, waiting('K2M4-P6R8-T9V3-X5Z7', { price: 30, createdAt: '2026-10-08T00:00:00.000Z' }))
    await insertLicence(db, waiting('ABCD-EFGH-JKLM-NPQR', { price: 30, status: 'refunded', createdAt: '2026-10-08T00:00:00.000Z' }))
    await insertLicence(db, lic({ key: 'WXYZ-2345-6789-ABCD', validity: '1y', activatedAt: '2026-10-09T00:00:00.000Z', price: 30, createdAt: '2026-10-08T00:00:00.000Z' }))
    const s = await stats(db, now)
    expect(s.licences).toEqual({ total: 6, month: 5, revenue: 159, revenueMonth: 119, pending: 1 })
    expect(s.downloads).toEqual({ android: 0, windows: 0, android30: 0, windows30: 0 })
  })
  it('counts a download once per visitor, platform and day', async () => {
    const db = memoryD1(); await ensureSchema(db)
    const day1 = Date.UTC(2026, 9, 10, 12), day2 = day1 + 86_400_000
    const got = []
    for (let i = 0; i < 5; i++) got.push(await countDownload(db, 'windows', 'visitor-a', day1))
    got.push(await countDownload(db, 'android', 'visitor-a', day1), await countDownload(db, 'windows', 'visitor-b', day1), await countDownload(db, 'windows', 'visitor-a', day2))
    expect(got).toEqual([true, false, false, false, false, true, true, true])
    const s = await stats(db, new Date(day2))
    expect(s.downloads).toEqual({ android: 1, windows: 3, android30: 1, windows30: 3 })
  })
})

describe('the API end to end (in-memory D1, no signing key)', () => {
  let env: Env
  const ORIGIN = 'https://dentora.raqeem.dev'
  beforeEach(() => {
    env = { DB: memoryD1(), ASSETS: {} as Fetcher, ADMIN_PASSWORD: 'qa-dentora-pass-2026' }
  })
  const call = (method: string, path: string, opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { 'CF-Connecting-IP': '5.5.5.5', ...(method !== 'GET' ? { 'X-Dentora': '1', Origin: ORIGIN } : {}), ...opts.headers }
    if (opts.cookie) headers.Cookie = opts.cookie
    const req = new Request(ORIGIN + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
    return handleApi(req, env, new URL(req.url))
  }
  /** Signs in; the session cookie, plus the device cookie as `device`. */
  const signIn = async (headers: Record<string, string> = {}) => {
    const r = await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' }, headers })
    expect(r.status).toBe(200)
    const [session = '', device = ''] = r.headers.getSetCookie().map(c => c.split(';')[0])
    return { session, device }
  }
  const login = async () => (await signIn()).session

  it('refuses writes without the header or from another origin', async () => {
    expect((await call('POST', '/api/login', { body: {}, headers: { 'X-Dentora': '' } })).status).toBe(403)
    const r = await call('POST', '/api/login', { body: {}, headers: { Origin: 'https://evil.example' } })
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'origin' })
  })
  it('answers setup without a long enough password', async () => {
    env.ADMIN_PASSWORD = 'short'
    const r = await call('POST', '/api/login', { body: { password: 'short' } })
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: 'setup' })
  })
  it('locks after repeated wrong passwords, even for the right one', async () => {
    for (let i = 1; i < MAX_PER_IP; i++) {
      const r = await call('POST', '/api/login', { body: { password: 'wrong-password-123' } })
      expect(r.status).toBe(401)
      expect(await r.json()).toEqual({ error: 'password' })
    }
    const last = await call('POST', '/api/login', { body: { password: 'wrong-password-123' } })
    expect(last.status).toBe(429)
    const body = await last.json() as { error: string; retryAfter: number }
    expect(body.error).toBe('locked')
    expect(body.retryAfter).toBeGreaterThan(800)
    expect((await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' } })).status).toBe(429)
  })
  it('signs in, serves the routes, and needs the cookie for each', async () => {
    expect((await call('GET', '/api/me')).status).toBe(401)
    const cookie = await login()
    expect(cookie).toMatch(/^__Host-dentora_admin=/)
    const me = await call('GET', '/api/me', { cookie })
    expect(me.headers.get('Cache-Control')).toBe('no-store')
    expect(me.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(await me.json()).toEqual({ ok: true, signing: false, signingError: 'missing' })

    const bad = await call('POST', '/api/licences', { cookie, body: { ...base, device: 'nope' } })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'device' })
    expect((await call('POST', '/api/licences', { cookie, body: base })).status).toBe(503)
    expect((await call('POST', '/api/resets', { cookie, body: { device: 'AB2C-D3EF' } })).status).toBe(503)

    const put = await call('PUT', '/api/settings', { cookie, body: { priceUsd: 49, whatsapp: '+963 944 000 111' } })
    expect(put.status).toBe(200)
    expect(await (await call('GET', '/api/settings', { cookie })).json()).toMatchObject({ priceUsd: 49, whatsapp: '+963 944 000 111' })
    const badPut = await call('PUT', '/api/settings', { cookie, body: { windowsUrl: 'http://x.com' } })
    expect(await badPut.json()).toEqual({ error: 'field', field: 'windowsUrl' })

    const csv = await call('GET', '/api/licences.csv', { cookie })
    expect(csv.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    // The BOM is in the bytes (Response.text() drops it while decoding).
    const bytes = new Uint8Array(await csv.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes).startsWith('created_at,device,plan')).toBe(true)

    const audit = await (await call('GET', '/api/audit', { cookie })).json() as { items: { action: string }[] }
    expect(audit.items.map(a => a.action)).toEqual(['licences.csv', 'settings.update', 'login.ok'])
    const st = await (await call('GET', '/api/stats', { cookie })).json() as { recent: unknown[] }
    expect(st.recent).toHaveLength(3)

    expect((await call('GET', '/api/licences/does-not-exist', { cookie })).status).toBe(404)
    expect(await (await call('GET', '/api/nothing-here', { cookie })).json()).toEqual({ error: 'not_found' })
    expect((await call('POST', '/api/verify', { cookie, body: { device: 'x' } })).status).toBe(400)

    const out = await call('POST', '/api/logout', { cookie })
    expect(out.headers.get('Set-Cookie')).toContain('Max-Age=0')
  })
  it('refuses a forged cookie', async () => {
    expect((await call('GET', '/api/stats', { cookie: '__Host-dentora_admin=eyJleHAiOjk5OTk5OTk5OTl9.AAAA' })).status).toBe(401)
  })
  it('sets a session cookie and a device cookie, and a device token is no session', async () => {
    const { session, device } = await signIn()
    expect(session).toMatch(/^__Host-dentora_admin=[\w-]+\.[\w-]+$/)
    expect(device).toMatch(/^__Host-dentora_device=[\w-]+\.[\w-]+$/)
    expect((await call('GET', '/api/me', { cookie: session })).status).toBe(200)
    expect((await call('GET', '/api/me', { cookie: `__Host-dentora_admin=${device.split('=')[1]}` })).status).toBe(401)
  })
  it('logging out ends the session for every copy of the cookie', async () => {
    const one = await login(), two = await login()
    expect((await call('POST', '/api/logout', { cookie: one })).status).toBe(200)
    expect((await call('GET', '/api/me', { cookie: one })).status).toBe(401)
    expect((await call('POST', '/api/logout', { cookie: one })).status).toBe(401)
    expect((await call('GET', '/api/me', { cookie: two })).status).toBe(200)
  })
  it('compares at most MAX_PER_IP passwords from one address, however many arrive at once', async () => {
    const all = await Promise.all(Array.from({ length: 40 }, (_, i) => call('POST', '/api/login', { body: { password: `wrong-${i}` }, headers: { 'CF-Connecting-IP': '7.7.7.7' } })))
    expect(all.filter(r => r.status === 401)).toHaveLength(MAX_PER_IP - 1)
    expect(all.filter(r => r.status === 429)).toHaveLength(40 - (MAX_PER_IP - 1))
    const cookie = await login()
    const audit = await (await call('GET', '/api/audit?limit=500', { cookie })).json() as { items: { action: string; ip: string }[] }
    expect(audit.items.filter(a => a.action === 'login.fail' && a.ip === '7.7.7.7')).toHaveLength(MAX_PER_IP)
  })
  it('counts IPv6 addresses per /64', async () => {
    for (let i = 1; i <= MAX_PER_IP; i++) await call('POST', '/api/login', { body: { password: 'wrong' }, headers: { 'CF-Connecting-IP': `2001:db8:1:2::${i}` } })
    const r = await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' }, headers: { 'CF-Connecting-IP': '2001:db8:1:2:ffff::9' } })
    expect(r.status).toBe(429)
    expect((await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' }, headers: { 'CF-Connecting-IP': '2001:db8:1:3::1' } })).status).toBe(200)
  })
  it(`strangers' failures (${MAX_OVERALL} from anywhere) pause new browsers, never one that signed in before`, async () => {
    const { device } = await signIn({ 'CF-Connecting-IP': '8.8.8.8' })
    for (let i = 0; i < MAX_OVERALL; i++) await call('POST', '/api/login', { body: { password: 'wrong' }, headers: { 'CF-Connecting-IP': `10.0.${i}.1` } })
    const stranger = await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' }, headers: { 'CF-Connecting-IP': '9.9.9.9' } })
    expect(stranger.status).toBe(429)
    const seller = await call('POST', '/api/login', { body: { password: 'qa-dentora-pass-2026' }, headers: { 'CF-Connecting-IP': '9.9.9.10', Cookie: device } })
    expect(seller.status).toBe(200)
  })
  it('stops reading a body past 16 KB, with or without Content-Length', async () => {
    const big = new ReadableStream({ start(c) { for (let i = 0; i < 64; i++) c.enqueue(new Uint8Array(1024).fill(97)); c.close() } })
    const req = new Request('https://dentora.raqeem.dev/api/login', { method: 'POST', body: big, duplex: 'half', headers: { 'X-Dentora': '1', 'CF-Connecting-IP': '6.6.6.6' } } as RequestInit)
    const r = await handleApi(req, env, new URL(req.url))
    expect(r.status).toBe(401)
  })
})
