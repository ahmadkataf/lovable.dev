// The control panel's JSON API (/api/*): routes, validation and audit; and the one public route, POST /api/activate,
// where a clinic turns a licence key into its activation code. The contract is SPEC.md → Control panel API and
// Public key activation.
import {
  addressKey, clearAttempts, clearedCookie, currentSession, DEVICE_SECONDS, deviceCookie, knownDevice, passwordMatches,
  passwordReady, releaseActivationAttempt, revokeSession, sameOriginWrite, SESSION_SECONDS, sessionCookie, sessionKey,
  signToken, takeActivationAttempt, takeAttempt, type Claims,
} from './auth'
import {
  activeLicencesOf, allLicences, audit, bindKey, dayOf, ensureSchema, getLicence, getLicenceByKey, getSettings,
  insertLicence, insertLicences, insertReset, listAudit, listLicences, listResets, saveSettings, stats, updateLicence,
} from './db'
import { apiError, clientIp, json, NO_STORE, PREFLIGHT_HEADERS, readJson, toCsv, withCors } from './http'
import {
  cleanKey, formatDeviceInput, getSigner, isDeviceNumber, isPlan, keyUntil, licenceMessage, makeActivation, makeReset,
  newKey, parseUntil, resetMessage, VALIDITIES, verifyCode, verifyKey,
} from './licence'
import type { Activation, Env, Licence, LicenceStatus, Plan, ResetCode, SiteSettings, Validity } from './types'

type Body = Record<string, unknown>
/** A validation result: the clean value, or the error code (and field) the API answers with. */
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string; field?: string }
const bad = (error: string, field?: string): { ok: false; error: string; field?: string } => (field ? { ok: false, error, field } : { ok: false, error })

export const STATUSES: LicenceStatus[] = ['active', 'refunded', 'void']
/** The list also filters on 'pending': active keys not activated yet. */
const LIST_STATUSES = [...STATUSES, 'pending']
const TEXT_MAX = 200, NOTE_MAX = 1000, SETTINGS_TEXT_MAX = 300, URL_MAX = 2000
/** Keys made at once (POST /api/keys). */
export const MAX_KEYS = 50

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

/** What a sale records besides its device or key. */
interface SaleDetails { customer: string; clinic: string; phone: string; price: number; note: string }
/** A sale's plan, validity and details. `day`: the day chosen for 'date' (today or later), else null. */
interface Sale extends SaleDetails { plan: Plan; validity: Validity; day: Date | null }
/** The fields a licence and a batch of keys share, checked in this order: plan, validity, until, price, texts. */
function checkSale(b: Body, defaultPrice: number, now: Date): Checked<Sale> {
  if (typeof b.plan !== 'string' || !isPlan(b.plan)) return bad('plan')
  const validity = b.validity
  if (typeof validity !== 'string' || !(VALIDITIES as string[]).includes(validity)) return bad('validity')
  let day: Date | null = null
  if (validity === 'date') {
    // parseUntil also takes "1y"/"lifetime"; here only a calendar day (today or later) is a date.
    day = typeof b.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.until.trim()) ? parseUntil(b.until.trim(), now) ?? null : null
    if (!day) return bad('until')
  }
  const price = b.price === undefined || b.price === null || b.price === '' ? defaultPrice : priceOf(b.price)
  if (price === null) return bad('price')
  const texts: Record<string, string> = {}
  for (const [k, max] of [['customer', TEXT_MAX], ['clinic', TEXT_MAX], ['phone', TEXT_MAX], ['note', NOTE_MAX]] as const) {
    const v = textOf(b[k], max)
    if (v === null) return bad('field', k)
    texts[k] = v
  }
  return { ok: true, value: { plan: b.plan, validity: validity as Validity, day, price, customer: texts.customer, clinic: texts.clinic, phone: texts.phone, note: texts.note } }
}

export interface LicenceInput extends SaleDetails { device: string; plan: Plan; until: Date | null }
/** POST /api/licences body → a licence to issue. `price` absent = the settings' price. */
export function checkLicenceInput(b: Body, defaultPrice: number, now = new Date()): Checked<LicenceInput> {
  const device = typeof b.device === 'string' ? b.device : ''
  if (!isDeviceNumber(device)) return bad('device')
  const sale = checkSale(b, defaultPrice, now)
  if (!sale.ok) return sale
  const { validity, day, ...v } = sale.value
  const until = validity === 'date' ? day : parseUntil(validity, now)
  if (until === undefined) return bad('validity')
  return { ok: true, value: { ...v, device: formatDeviceInput(device), until } }
}

export interface KeysInput extends SaleDetails {
  count: number; plan: Plan; validity: Validity
  /** The day of a 'date' key; null otherwise (1y/2y are counted from the activation day). */
  until: Date | null
}
/** POST /api/keys body → keys to issue: `count` absent = 1; `price` (per key) absent = the settings' price. */
export function checkKeysInput(b: Body, defaultPrice: number, now = new Date()): Checked<KeysInput> {
  const raw = b.count
  const count = raw === undefined || raw === null || raw === '' ? 1
    : typeof raw === 'number' ? raw : typeof raw === 'string' && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN
  if (!Number.isInteger(count) || count < 1 || count > MAX_KEYS) return bad('count')
  const sale = checkSale(b, defaultPrice, now)
  if (!sale.ok) return sale
  const { day, ...v } = sale.value
  return { ok: true, value: { ...v, count, until: day } }
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
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/'
  // The public route comes before the CSRF rule and the session: it reads no cookie and carries no authority.
  if (path === '/activate') return publicActivate({ request, env, url, ip: clientIp(request), db: env.DB }, method)
  if (method !== 'GET' && !sameOriginWrite(request)) return apiError('origin', 403)
  await ensureSchema(env.DB)
  const c: Ctx = { request, env, url, ip: clientIp(request), db: env.DB }

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
    case 'POST /keys': return keysCreate(c)
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
  if (status && !LIST_STATUSES.includes(status)) return apiError('field', 400, { field: 'status' })
  const q = (c.url.searchParams.get('q') || '').slice(0, 100)
  return json(await listLicences(c.db, {
    q, status: status as LicenceStatus | 'pending' | '', limit: intParam(c.url, 'limit', 50, 1, 200), offset: intParam(c.url, 'offset', 0, 0, 1_000_000),
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
    key: null, validity: null, activatedAt: null,
    customer: v.customer, clinic: v.clinic, phone: v.phone, price: v.price, note: v.note, status: 'active',
    createdAt: new Date().toISOString(),
  }
  await insertLicence(c.db, licence)
  await audit(c.db, 'licence.create', [licence.device, licence.plan, licence.until ?? 'lifetime', `$${licence.price}`, licence.clinic || licence.customer].filter(Boolean).join(' · '), c.ip)
  const existing = await activeLicencesOf(c.db, licence.device, licence.id)
  return json({ licence, message: licenceMessage(licence), existing }, 201)
}

/**
 * Keys sold without a device number: each is a licence row waiting for its device (device and code ''), activated
 * later by the clinic (POST /api/activate). Nothing is signed here, so this works without the signing secret.
 */
async function keysCreate(c: Ctx): Promise<Response> {
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  const settings = await getSettings(c.db)
  const input = checkKeysInput(body, settings.priceUsd)
  if (!input.ok) return fail(input)
  const v = input.value
  const until = v.until ? dayOf(v.until) : null, createdAt = new Date().toISOString()
  const licences: Licence[] = Array.from({ length: v.count }, () => ({
    id: crypto.randomUUID(), device: '', plan: v.plan, until, code: '', key: newKey(), validity: v.validity, activatedAt: null,
    customer: v.customer, clinic: v.clinic, phone: v.phone, price: v.price, note: v.note, status: 'active', createdAt,
  }))
  await insertLicences(c.db, licences)
  // The keys themselves stay out of the log (the dashboard shows it): how many, what, for how much, for whom.
  await audit(c.db, 'keys.create', [`${v.count} × ${v.plan} ${until ?? v.validity}`, `$${v.price}`, v.clinic || v.customer].filter(Boolean).join(' · '), c.ip)
  return json({ items: licences.map(licence => ({ licence, message: licenceMessage(licence) })) }, 201)
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
    await audit(c.db, 'licence.update', `${saleName(after)} · ${detail}`, c.ip)
  }
  return json({ licence: after })
}

/** How the log names a sale: its device, or for a key not activated yet the key's last 4 characters (never the whole key). */
const saleName = (l: Licence) => l.device || (l.key ? `…${l.key.slice(-4)}` : '')

async function licencesCsv(c: Ctx): Promise<Response> {
  const rows = await allLicences(c.db)
  await audit(c.db, 'licences.csv', `${rows.length}`, c.ip)
  // valid_until of a 1y/2y key not activated yet is empty: its last day is set on activation (see validity).
  const validUntil = (l: Licence) => l.until ?? (l.validity && l.validity !== 'lifetime' && !l.device ? '' : 'lifetime')
  const csv = toCsv(
    ['created_at', 'device', 'plan', 'valid_until', 'status', 'customer', 'clinic', 'phone', 'price_usd', 'note', 'code', 'id', 'key', 'validity', 'activated_at'],
    rows.map(l => [l.createdAt, l.device, l.plan, validUntil(l), l.status, l.customer, l.clinic, l.phone, l.price, l.note, l.code, l.id, l.key ?? '', l.validity ?? '', l.activatedAt ?? '']),
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
  const code = body && typeof body.code === 'string' ? body.code.slice(0, 4000) : ''
  // A licence key (16 characters once cleaned) is looked up, whatever the device says.
  const key = cleanKey(code)
  if (key) return json(verifyKey(await getLicenceByKey(c.db, key)))
  if (!body || typeof body.device !== 'string' || !isDeviceNumber(body.device)) return apiError('device', 400)
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

// ---- public key activation ---------------------------------------------------------------------------------------
/** The answers that count against the address's limit: a malformed key or device, an unknown, used, void or expired key. */
const FAILED = [400, 404, 409, 410]

/**
 * /api/activate: no session, no cookie read or set, no X-Dentora or Origin check, and CORS on every answer (errors
 * too), so the activation page, the app (any origin, file:// included) and other sites' scripts can all call it.
 */
async function publicActivate(c: Ctx, method: string): Promise<Response> {
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...PREFLIGHT_HEADERS, 'Cache-Control': NO_STORE } })
  if (method !== 'POST') return withCors(apiError('not_found', 404))
  let res: Response
  try {
    res = await activate(c)
  } catch (e) {
    // As index.ts does for every route, plus the CORS header, so the page and the app can read the error.
    console.error('activation failed:', e instanceof Error ? e.message : String(e))
    res = apiError('server', 500)
  }
  return withCors(res)
}

/** POST /api/activate `{ key, device }` → 200 Activation (docs/LICENCE-KEYS.md → Public activation). */
async function activate(c: Ctx): Promise<Response> {
  await ensureSchema(c.db)
  const body = await readJson(c.request)
  if (!body) return apiError('field', 400, { field: 'body' })
  const gate = await takeActivationAttempt(c.db, addressKey(c.ip))
  if (!gate.allowed) return apiError('locked', 429, { retryAfter: gate.retryAfter })
  let res: Response | undefined
  try {
    res = await redeem(c, body)
    return res
  } finally {
    // Only failures stay counted: a success or a server problem gives its slot back.
    if (!res || !FAILED.includes(res.status)) await releaseActivationAttempt(c.db, gate.id)
  }
}

async function redeem(c: Ctx, body: Body): Promise<Response> {
  const key = typeof body.key === 'string' ? cleanKey(body.key) : null
  if (!key) return apiError('key', 400)
  if (typeof body.device !== 'string' || !isDeviceNumber(body.device)) return apiError('device', 400)
  const device = formatDeviceInput(body.device), now = new Date()
  let l = await getLicenceByKey(c.db, key)
  if (!l) return apiError('unknown', 404)
  if (!l.device && l.status === 'active') {
    const until = keyUntil(l, now)
    if (until === undefined) return apiError('expired', 410)
    const signer = await getSigner(c.env)
    if (!signer.ok) return apiError('signing', 503)
    // issueCode checks the code back with the app's own verifier before it is stored, as for every code the panel makes.
    const issued = await makeActivation(signer.key, device, l.plan, until)
    if (await bindKey(c.db, { ...l, device: issued.device, code: issued.code, until: issued.until, activatedAt: now.toISOString() })) {
      // No address in these entries: the server keeps only the device number and the time with the sale.
      await audit(c.db, 'key.activate', `…${key.slice(-4)} · ${issued.device}`, '')
      return json({ code: issued.code, device: issued.device, plan: issued.plan, until: issued.until } satisfies Activation)
    }
    // Another request bound the key first (another clinic, or this one twice), or it was voided meanwhile.
    l = await getLicenceByKey(c.db, key)
    if (!l) return apiError('unknown', 404)
  }
  return answerBound(c, l, key, device, now)
}

/** A key that is not waiting and active: its code again for its own device, else why not. */
async function answerBound(c: Ctx, l: Licence, key: string, device: string, now: Date): Promise<Response> {
  if (!l.device) return apiError('void', 410)
  if (l.device !== device) {
    // The device that tried is not written down: only the key's own device is kept with the sale.
    await audit(c.db, 'key.used', `…${key.slice(-4)} · ${l.device}`, '')
    return apiError('used', 409)
  }
  // The same device again (reinstalled, data cleared): the same code, checked again with the app's verifier. Not
  // logged: successes are not rate limited, so a repeat must cost no write.
  const check = await verifyCode(device, l.code, now)
  if (check.kind === 'activation' && check.reason === 'expired') return apiError('expired', 410)
  if (!check.ok || check.kind !== 'activation') throw new Error(`stored code of key …${key.slice(-4)} does not verify: ${check.reason}`)
  return json({ code: l.code, device: l.device, plan: l.plan, until: l.until } satisfies Activation)
}
