// The control panel's JSON API (/api/*): routes, validation and audit. The contract is SPEC.md → Control panel API.
import {
  addressKey, clearAttempts, clearedCookie, currentSession, DEVICE_SECONDS, deviceCookie, knownDevice, passwordMatches,
  passwordReady, revokeSession, sameOriginWrite, SESSION_SECONDS, sessionCookie, sessionKey, signToken, takeAttempt,
  type Claims,
} from './auth'
import {
  activeLicencesOf, allLicences, audit, ensureSchema, getLicence, getSettings, insertLicence, insertReset, listAudit,
  listLicences, listResets, saveSettings, stats, updateLicence,
} from './db'
import { apiError, clientIp, json, readJson, toCsv } from './http'
import {
  formatDeviceInput, getSigner, isDeviceNumber, isPlan, licenceMessage, makeActivation, makeReset, parseUntil,
  resetMessage, VALIDITIES, verifyCode,
} from './licence'
import type { Env, Licence, LicenceStatus, Plan, ResetCode, SiteSettings, Validity } from './types'

type Body = Record<string, unknown>
/** A validation result: the clean value, or the error code (and field) the API answers with. */
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; field?: string }
const bad = (error: string, field?: string): { ok: false; error: string; field?: string } => (field ? { ok: false, error, field } : { ok: false, error })

export const STATUSES: LicenceStatus[] = ['active', 'refunded', 'void']
const TEXT_MAX = 200, NOTE_MAX = 1000, SETTINGS_TEXT_MAX = 300, URL_MAX = 2000

/** A trimmed text field: '' when absent, null when not a string or too long. */
function textOf(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > max ? null : s
}
/** Dollars as a number (a numeric string is accepted), 0–100000, rounded to cents; null when not one. */
export function priceOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n * 100) / 100 : null
}
/** An integer query parameter within [min, max], else the default. */
function intParam(url: URL, name: string, def: number, min: number, max: number): number {
  const raw = url.searchParams.get(name)
  const n = raw === null || raw === '' ? def : Number(raw)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : def
}

export interface LicenceInput {
  device: string; plan: Plan; until: Date | null
  customer: string; clinic: string; phone: string; price: number; note: string
}
/** POST /api/licences body → a licence to issue. `price` absent = the settings' price. */
export function checkLicenceInput(b: Body, defaultPrice: number, now = new Date()): Checked<LicenceInput> {
  const device = typeof b.device === 'string' ? b.device : ''
  if (!isDeviceNumber(device)) return bad('device')
  if (typeof b.plan !== 'string' || !isPlan(b.plan)) return bad('plan')
  const validity = b.validity
  if (typeof validity !== 'string' || !(VALIDITIES as string[]).includes(validity)) return bad('validity')
  let until: Date | null | undefined
  if (validity === 'date') {
    // parseUntil also takes "1y"/"lifetime"; here only a calendar day (today or later) is a date.
    until = typeof b.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.until.trim()) ? parseUntil(b.until.trim(), now) : undefined
    if (!until) return bad('until')
  } else until = parseUntil(validity as Validity, now)
  if (until === undefined) return bad('validity')
  const price = b.price === undefined || b.price === null || b.price === '' ? defaultPrice : priceOf(b.price)
  if (price === null) return bad('price')
  const texts: Record<string, string> = {}
  for (const [k, max] of [['customer', TEXT_MAX], ['clinic', TEXT_MAX], ['phone', TEXT_MAX], ['note', NOTE_MAX]] as const) {
    const v = textOf(b[k], max)
    if (v === null) return bad('field', k)
    texts[k] = v
  }
  return { ok: true, value: { device: formatDeviceInput(device), plan: b.plan, until, price, customer: texts.customer, clinic: texts.clinic, phone: texts.phone, note: texts.note } }
}

export type LicencePatch = Partial<Pick<Licence, 'customer' | 'clinic' | 'phone' | 'price' | 'note' | 'status'>>
/** PATCH /api/licences/:id body → the fields to change (other keys are ignored). */
export function checkLicencePatch(b: Body): Checked<LicencePatch> {
  const out: LicencePatch = {}
  for (const [k, max] of [['customer', TEXT_MAX], ['clinic', TEXT_MAX], ['phone', TEXT_MAX], ['note', NOTE_MAX]] as const) {
    if (!(k in b)) continue
    const v = textOf(b[k], max)
    if (v === null) return bad('field', k)
    out[k] = v
  }
  if ('price' in b) {
    const p = priceOf(b.price)
    if (p === null) return bad('price')
    out.price = p
  }
  if ('status' in b) {
    if (typeof b.status !== 'string' || !(STATUSES as string[]).includes(b.status)) return bad('field', 'status')
    out.status = b.status as LicenceStatus
  }
  return { ok: true, value: out }
}

const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim()
/** PUT /api/settings body → the settings after the change (unknown keys are ignored). */
export function checkSettingsPatch(b: Body, current: SiteSettings): Checked<SiteSettings> {
  const next: SiteSettings = { ...current }
  for (const key of Object.keys(current) as (keyof SiteSettings)[]) {
    if (!(key in b)) continue
    const v = b[key]
    if (key === 'priceUsd') {
      const p = priceOf(v)
      if (p === null) return bad('field', key)
      next.priceUsd = p
      continue
    }
    if (typeof v !== 'string') return bad('field', key)
    const s = oneLine(v)
    if (key === 'whatsapp') {
      const digits = s.replace(/\D/g, '')
      if (!/^\+?[\d\s().-]+$/.test(s) || digits.length < 8 || digits.length > 15) return bad('field', key)
    } else if (key === 'email') {
      if (s && (s.length > 254 || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(s))) return bad('field', key)
    } else if (key === 'windowsUrl') {
      if (s && (s.length > URL_MAX || !isHttpsUrl(s))) return bad('field', key)
    } else if (s.length > SETTINGS_TEXT_MAX) return bad('field', key)
    next[key] = s
  }
  return { ok: true, value: next }
}
export function isHttpsUrl(s: string): boolean {
  try { const u = new URL(s); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password } catch { return false }
}

const fail = (c: { error: string; field?: string }) => apiError(c.error, 400, c.field ? { field: c.field } : {})

// ---- routes ------------------------------------------------------------------------------------------------------
interface Ctx { request: Request; env: Env; url: URL; ip: string; db: D1Database }
interface SignedIn extends Ctx { session: Claims }

/** Everything under /api/. HEAD is answered like GET (index.ts drops the body). */
export async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method === 'HEAD' ? 'GET' : request.method
  if (method !== 'GET' && !sameOriginWrite(request)) return apiError('origin', 403)
  await ensureSchema(env.DB)
  const c: Ctx = { request, env, url, ip: clientIp(request), db: env.DB }
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/'

  if (path === '/login') return method === 'POST' ? login(c) : apiError('not_found', 404)
  // Signed in before anything else, so the API's shape is not visible to strangers.
  const session = await currentSession(request, env)
  if (!session) return apiError('auth', 401)

  const route = `${method} ${path}`
  switch (route) {
    case 'POST /logout': return logout({ ...c, session })
    case 'GET /me': return me(c)
    case 'GET /stats': return json(await stats(c.db))
    case 'GET /licences': return licencesList(c)
    case 'POST /licences': return licenceCreate(c)
    case 'GET /licences.csv': return licencesCsv(c)
    case 'GET /resets': return json({ items: await listResets(c.db, intParam(url, 'limit', 50, 1, 200)) })
    case 'POST /resets': return resetCreate(c)
    case 'POST /verify': return verify(c)
    case 'GET /settings': return json(await getSettings(c.db))
    case 'PUT /settings': return settingsUpdate(c)
    case 'GET /audit': return json({ items: await listAudit(c.db, intParam(url, 'limit', 100, 1, 500)) })
  }
  const one = /^\/licences\/([A-Za-z0-9-]{1,64})$/.exec(path)
  if (one && method === 'GET') return licenceGet(c, one[1])
  if (one && method === 'PATCH') return licencePatch(c, one[1])
  return apiError('not_found', 404)
}

async function login(c: Ctx): Promise<Response> {
  if (!passwordReady(c.env)) return apiError('setup', 503)
  // The attempt is counted before the password is compared (takeAttempt), so parallel guesses cannot pass the limit.
  const key = addressKey(c.ip)
  const gate = await takeAttempt(c.db, key, await knownDevice(c.request, c.env))
  if (!gate.allowed) return apiError('locked', 429, { retryAfter: gate.retryAfter })
  const body = await readJson(c.request)
  const given = body && typeof body.password === 'string' ? body.password.slice(0, 512) : ''
  if (!(await passwordMatches(given, c.env.ADMIN_PASSWORD as string))) {
    await audit(c.db, 'login.fail', '', c.ip)
    // The failure that reaches the limit already answers "locked", so the panel can say for how long.
    return gate.retryAfter > 0 ? apiError('locked', 429, { retryAfter: gate.retryAfter }) : apiError('password', 401)
  }
  await clearAttempts(c.db, key)
  await audit(c.db, 'login.ok', '', c.ip)
  const cookieKey = await sessionKey(c.env)
  const now = Math.floor(Date.now() / 1000)
  const res = json({ ok: true })
  res.headers.append('Set-Cookie', sessionCookie(await signToken(cookieKey, 'session', now + SESSION_SECONDS)))
  res.headers.append('Set-Cookie', deviceCookie(await signToken(cookieKey, 'device', now + DEVICE_SECONDS)))
  return res
}

async function logout(c: SignedIn): Promise<Response> {
  // Revoked, not only cleared: a copy of the cookie (another browser, a synced profile) stops working as well.
  await revokeSession(c.db, c.session)
  await audit(c.db, 'logout', '', c.ip)
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie() })
}

async function me(c: Ctx): Promise<Response> {
  const s = await getSigner(c.env)
  return json({ ok: true, signing: s.ok, signingError: s.ok ? null : s.error })
}

async function licencesList(c: Ctx): Promise<Response> {
  const status = c.url.searchParams.get('status') || ''
  if (status && !(STATUSES as string[]).includes(status)) return apiError('field', 400, { field: 'status' })
  const q = (c.url.searchParams.get('q') || '').slice(0, 100)
  return json(await listLicences(c.db, {
    q, status: status as LicenceStatus | '', limit: intParam(c.url, 'limit', 50, 1, 200), offset: intParam(c.url, 'offset', 0, 0, 1_000_000),
  }))
}

async function licenceCreate(c: Ctx): Promise<Response> {
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  const settings = await getSettings(c.db)
  const input = checkLicenceInput(body, settings.priceUsd)
  if (!input.ok) return fail(input)
  const signer = await getSigner(c.env)
  if (!signer.ok) return apiError('signing', 503)
  const v = input.value
  const issued = await makeActivation(signer.key, v.device, v.plan, v.until)
  const licence: Licence = {
    id: crypto.randomUUID(), device: issued.device, plan: issued.plan, until: issued.until, code: issued.code,
    customer: v.customer, clinic: v.clinic, phone: v.phone, price: v.price, note: v.note, status: 'active',
    createdAt: new Date().toISOString(),
  }
  await insertLicence(c.db, licence)
  await audit(c.db, 'licence.create', [licence.device, licence.plan, licence.until ?? 'lifetime', `$${licence.price}`, licence.clinic || licence.customer].filter(Boolean).join(' · '), c.ip)
  const existing = await activeLicencesOf(c.db, licence.device, licence.id)
  return json({ licence, message: licenceMessage(licence), existing }, 201)
}

async function licenceGet(c: Ctx, id: string): Promise<Response> {
  const licence = await getLicence(c.db, id)
  return licence ? json({ licence, message: licenceMessage(licence) }) : apiError('not_found', 404)
}

async function licencePatch(c: Ctx, id: string): Promise<Response> {
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  const patch = checkLicencePatch(body)
  if (!patch.ok) return fail(patch)
  const before = await getLicence(c.db, id)
  if (!before) return apiError('not_found', 404)
  const after: Licence = { ...before, ...patch.value }
  const changed = (Object.keys(patch.value) as (keyof LicencePatch)[]).filter(k => before[k] !== after[k])
  if (changed.length) {
    await updateLicence(c.db, after)
    // Values only for the short fields; a changed note or name is named, not copied into the log.
    const detail = changed.map(k => (k === 'status' || k === 'price' ? `${k}: ${before[k]} → ${after[k]}` : k)).join(', ')
    await audit(c.db, 'licence.update', `${after.device} · ${detail}`, c.ip)
  }
  return json({ licence: after })
}

async function licencesCsv(c: Ctx): Promise<Response> {
  const rows = await allLicences(c.db)
  await audit(c.db, 'licences.csv', `${rows.length}`, c.ip)
  const csv = toCsv(
    ['created_at', 'device', 'plan', 'valid_until', 'status', 'customer', 'clinic', 'phone', 'price_usd', 'note', 'code', 'id'],
    rows.map(l => [l.createdAt, l.device, l.plan, l.until ?? 'lifetime', l.status, l.customer, l.clinic, l.phone, l.price, l.note, l.code, l.id]),
  )
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="dentora-licences-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}

async function resetCreate(c: Ctx): Promise<Response> {
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  if (typeof body.device !== 'string' || !isDeviceNumber(body.device)) return apiError('device', 400)
  const texts: Record<string, string> = {}
  for (const [k, max] of [['customer', TEXT_MAX], ['phone', TEXT_MAX], ['note', NOTE_MAX]] as const) {
    const v = textOf(body[k], max)
    if (v === null) return apiError('field', 400, { field: k })
    texts[k] = v
  }
  const signer = await getSigner(c.env)
  if (!signer.ok) return apiError('signing', 503)
  const issued = await makeReset(signer.key, body.device)
  const reset: ResetCode = {
    id: crypto.randomUUID(), device: issued.device, code: issued.code, day: issued.day, lastDay: issued.lastDay,
    customer: texts.customer, phone: texts.phone, note: texts.note, createdAt: new Date().toISOString(),
  }
  await insertReset(c.db, reset)
  await audit(c.db, 'reset.create', [reset.device, `→ ${reset.lastDay}`, reset.customer].filter(Boolean).join(' · '), c.ip)
  return json({ reset, message: resetMessage(reset) }, 201)
}

async function verify(c: Ctx): Promise<Response> {
  const body = await readJson(c.request)
  if (!body || typeof body.device !== 'string' || !isDeviceNumber(body.device)) return apiError('device', 400)
  const code = typeof body.code === 'string' ? body.code.slice(0, 4000) : ''
  return json(await verifyCode(body.device, code))
}

async function settingsUpdate(c: Ctx): Promise<Response> {
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  const current = await getSettings(c.db)
  const next = checkSettingsPatch(body, current)
  if (!next.ok) return fail(next)
  const changed = (Object.keys(current) as (keyof SiteSettings)[]).filter(k => current[k] !== next.value[k])
  if (changed.length) {
    await saveSettings(c.db, next.value)
    await audit(c.db, 'settings.update', changed.join(', '), c.ip)
  }
  return json(next.value)
}
