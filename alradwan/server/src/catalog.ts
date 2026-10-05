// Product details from a scanned barcode, so a shop adds a product by scanning it instead of typing.
//
//   GET  /api/catalog/lookup?code=&device=                      -> {found, name, brand?, category?, quantity?, image, source, shops?} | {found: false, retry?}
//   GET  /api/catalog/image?code=&device=                       -> the product's picture (from the looked-up result only)
//   POST /api/catalog/contribute  {token, device, items[]}      -> {ok, saved}            licensed devices share what they typed
//   POST /api/catalog/photo       {device, image}               -> {found, name, brand?, partNumber?, size?, category?, cars?}
//                                                                   a photo of the box read by an AI model (Workers AI)
//
// Only public product numbers (EAN-13, UPC-A, EAN-8, UPC-E, GTIN-14 with a valid check digit) are looked up; a
// shop's own in-store numbers (prefix 2…, coupons, UPC number systems 2/4/5) mean something different in every shop.
// The answer comes from, in order: what the shops themselves named the product (most common name wins, one vote
// per device), a cache of earlier outside answers, then Open Food Facts (and its sister sites for non-food), and
// only when that has nothing UPCitemdb, whose free tier allows 100 lookups a day from this server. Nothing else
// is shared: the contributions hold only the number, the name, the brand, the category and the unit — never
// prices, stock, shop names, addresses or licence codes. Only votes of devices still bound to a live licence
// count, so revoking a code also takes back what its devices named. Lookups are counted per device and per
// address (keyed hash, IPv6 by its /64) so the server is not a free proxy; the outside services have their own
// budgets for the whole server (Open Food Facts per minute, UPCitemdb per day, with a pause after its 429).
//
// CATALOG_OFF_URL and CATALOG_UPC_URL (optional, for local tests only) replace the base URLs of the two outside
// services, and an http: picture on the same host as one of them is then allowed too. Never set them in production.

import { readToken } from './license'

export interface CatalogEnv { DB: D1Database; TOKEN_SECRET?: string; CATALOG_OFF_URL?: string; CATALOG_UPC_URL?: string; AI?: { run(model: string, input: unknown): Promise<unknown> } }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }
const OFF_URL = 'https://world.openfoodfacts.org'
const UPC_URL = 'https://api.upcitemdb.com/prod/trial'
const OFF_FIELDS = 'product_name,product_name_ar,product_name_en,generic_name,brands,quantity,categories,image_front_small_url,image_front_url'
const USER_AGENT = 'AlRadwanGarage/1.8 (+https://alradwan.almutafawiqin.workers.dev)'
const DAY = 86400000
const FRESH_FOUND = 180 * DAY           // an outside answer is asked again after this long…
const FRESH_MISSING = 14 * DAY          // …and a "nobody knows it" sooner, products get added
const TIMEOUT = 4500                    // each outside call
const MAX_IMAGE = 1.5 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const LIMIT_DEVICE = 400                // lookups (and pictures) per device per UTC day
const LIMIT_IP = 2000                   // …and per address
const LIMIT_CONTRIB = 3000              // contributed items per device per day
const OFF_MINUTE = 90                   // Open Food Facts asks per minute, whole server (theirs: 100 product reads a minute)
const UPC_DAY = 90                      // UPCitemdb asks per UTC day, whole server (the trial: 100 a day)…
const UPC_DEVICE = 10                   // …of which one device may use this many
const UPC_IP = 20                       // …and one address this many
const UPC_PAUSE = 60000                 // after TOO_FAST; after EXCEED_LIMIT until the end of the day
const MAX_ITEMS = 50                    // per contribute call
const PHOTO_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct'
const MAX_PHOTO = 900 * 1024            // the app sends one JPEG of at most 1024 px
const PHOTO_DEVICE = 40                 // box photos read per device per UTC day…
const PHOTO_IP = 80                     // …per address…
const PHOTO_DAY = 400                   // …and for the whole server (the AI service's daily allowance)
const MAX_BODY = 64 * 1024

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...CORS } })
const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[a-f0-9]{32,64}$/.test(d)

// ---------- product numbers ----------
function checkDigit(body: string): number {
  let sum = 0
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w
  return (10 - (sum % 10)) % 10
}
const validCheck = (c: string) => checkDigit(c.slice(0, -1)) === Number(c[c.length - 1])

/** UPC-E (number system 0 or 1) to its UPC-A, or null when the check digit does not fit. */
function upcEtoA(e: string): string | null {
  if (!/^[01]\d{7}$/.test(e)) return null
  const d = e.slice(1, 7), last = d[5]
  let body: string
  if (last <= '2') body = d.slice(0, 2) + last + '0000' + d.slice(2, 5)
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5)
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4]
  else body = d.slice(0, 5) + '0000' + last
  const a = e[0] + body + e[7]
  return validCheck(a) ? a : null
}

/** The shared catalogue's key for a scanned code: a public product number's GTIN-14, or "pn:" and the part number
 *  of a car-part label (a Code 39 "P9818914980": part 98 189 149 80 of its maker, the same in every shop). Such
 *  part numbers are known only to the shops: no outside database is asked about them. */
export function catalogKey(raw: unknown): { key: string; gtin: { gtin: string; ask: string } | null } | null {
  const g = publicGtin(raw)
  if (g) return { key: g.gtin, gtin: g }
  const m = /^(?:1P|30P|P)([0-9A-Z][0-9A-Z.\-/ ]{4,39})$/.exec(String(raw ?? '').trim().toUpperCase())
  const pn = m ? m[1].replace(/[^0-9A-Z]/g, '') : ''
  return pn.length >= 5 && pn.length <= 30 && (pn.match(/\d/g)?.length ?? 0) >= 4 ? { key: 'pn:' + pn, gtin: null } : null
}

/** A public product number as {gtin: its GTIN-14 key, ask: the form the outside services know}, else null. */
export function publicGtin(raw: unknown): { gtin: string; ask: string } | null {
  const c = String(raw ?? '').replace(/[\s-]/g, '')
  if (/^\d{8}$/.test(c)) {
    // an 8-digit number starting with 0/1 that reads as a UPC-E is one (EAN-8 numbers 0… are in-store anyway)
    const a = upcEtoA(c)
    if (a) return publicGtin(a)                          // and its long form must be public too ("00000000" is not)
    if (!validCheck(c) || c[0] === '0' || c[0] === '2') return null
    return { gtin: c.padStart(14, '0'), ask: c }
  }
  if (!/^\d{12,14}$/.test(c) || !validCheck(c)) return null
  const gtin = c.padStart(14, '0')
  if (gtin[0] === '9') return null                       // GTIN-14 indicator 9: weighed / variable items
  const t = gtin.slice(1)                                // the 13-digit form (for GTIN-14 without the indicator)
  if (t[0] === '2' || /^(02|04|05|98|99)/.test(t)) return null
  if (t.startsWith('00000') && (t[5] === '0' || t[5] === '2')) return null   // an in-store EAN-8 written long
  return { gtin, ask: gtin[0] === '0' ? t : gtin }
}

// ---------- text ----------
/** Control characters out, spaces collapsed, at most `max` characters; empty → null. */
function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = [...v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim()
  return s || null
}
/** The most specific entry of a category path ("A > B > C" or "a, b, c"), without a language prefix like "en:". */
const lastPart = (v: unknown) => clean(typeof v === 'string' ? v.split(/\s*[>,]\s*/).filter(Boolean).pop()?.replace(/^[a-z]{2}:/, '') : null, 60)

// ---------- counting ----------
const today = () => Math.floor(Date.now() / DAY)
/** The address that counts: an IPv6 subscriber holds a whole /64, so only its first four groups. */
function addressOf(req: Request): string {
  const ip = (req.headers.get('cf-connecting-ip') ?? 'unknown').toLowerCase()
  if (!ip.includes(':')) return ip
  const [head, tail] = ip.split('::')
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : []
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  return groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':') + '::/64'
}
/** A keyed hash of the address, different every day: the stored keys cannot be turned back into addresses. */
async function addressKey(env: CatalogEnv, req: Request): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TOKEN_SECRET || 'alradwan-catalog'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(today() + ':' + addressOf(req)))
  return Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('')
}
/** Adds `by` to today's count of `k` unless that would pass `max`: a row (the new count) when allowed, none when not
 *  (a caller over its limit writes nothing). */
const bump = (env: CatalogEnv, k: string, by: number, max: number) => env.DB.prepare('INSERT INTO catalog_quota (k, day, n) VALUES (?, ?, ?) ON CONFLICT(k, day) DO UPDATE SET n = n + excluded.n WHERE catalog_quota.n + excluded.n <= ? RETURNING n').bind(k, today(), by, max)

/** Counts one lookup for the device and the address; false when either is over its day's limit. */
async function allowLookup(env: CatalogEnv, who: string, device: string): Promise<boolean> {
  const stmts = [bump(env, 'd:' + device, 1, LIMIT_DEVICE), bump(env, 'i:' + who, 1, LIMIT_IP)]
  // old days are dropped now and then, not on every call
  if (Math.random() < 0.01) stmts.push(env.DB.prepare('DELETE FROM catalog_quota WHERE day < ?').bind(today() - 3))
  const [d, i] = await env.DB.batch<{ n: number }>(stmts)
  return !!d.results[0] && !!i.results[0]
}

/** One more Open Food Facts ask this minute, for the whole server. */
const allowOff = async (env: CatalogEnv) => !!(await bump(env, 'o:' + Math.floor(Date.now() / 60000), 1, OFF_MINUTE).first())

/** One more UPCitemdb ask: not while it said "too fast" / "used up", within the device's, the address's and the
 *  server's share of the day (the server's is counted last, so a caller over its own share does not use it up). */
async function allowUpc(env: CatalogEnv, who: string, device: string): Promise<boolean> {
  const pause = await env.DB.prepare("SELECT n FROM catalog_quota WHERE k = 'upc-pause' AND day = ?").bind(today()).first<{ n: number }>()
  if (pause && pause.n > Date.now()) return false
  const [d, i] = await env.DB.batch<{ n: number }>([bump(env, 'ud:' + device, 1, UPC_DEVICE), bump(env, 'ui:' + who, 1, UPC_IP)])
  if (!d.results[0] || !i.results[0]) return false
  return !!(await bump(env, 'upc', 1, UPC_DAY).first())
}

// ---------- outside services ----------
type Found = { name: string; brand: string | null; category: string | null; quantity: string | null; image: string | null; source: 'openfoodfacts' | 'upcitemdb' }
/** found, nothing (a definite "not known"), or failed (could not ask: try again later, remember nothing) */
type Ask = Found | 'nothing' | 'failed'
type CacheRow = { gtin: string; found: number; name: string | null; brand: string | null; category: string | null; quantity: string | null; image_url: string | null; source: string | null; at: number }

/** A picture address the server may fetch: https only (plus the test hosts, when they are set). */
function imageUrl(env: CatalogEnv, v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 1000) return null
  try {
    const u = new URL(v)
    if (u.username || u.password) return null
    if (u.protocol === 'https:') return u.href
    const test = [env.CATALOG_OFF_URL, env.CATALOG_UPC_URL].filter((b): b is string => !!b).map(b => new URL(b).origin)
    return u.protocol === 'http:' && test.includes(u.origin) ? u.href : null
  } catch { return null }
}

async function askOff(env: CatalogEnv, code: string): Promise<Ask> {
  let res: Response
  try {
    // non-food products answer with a redirect to openproductsfacts / openbeautyfacts: followed
    res = await fetch(`${env.CATALOG_OFF_URL || OFF_URL}/api/v2/product/${code}.json?product_type=all&fields=${OFF_FIELDS}`, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) })
  } catch { return 'failed' }
  if (res.status === 404) return 'nothing'
  if (!res.ok) return 'failed'
  let b: { status?: number; product?: Record<string, unknown> } | null
  try { b = await res.json() } catch { return 'failed' }
  if (!b || typeof b !== 'object') return 'failed'
  const p = b.product
  if (b.status !== 1 || !p || typeof p !== 'object') return 'nothing'
  const name = clean(p.product_name_ar, 120) ?? clean(p.product_name, 120) ?? clean(p.product_name_en, 120) ?? clean(p.generic_name, 120)
  if (!name) return 'nothing'
  const brand = clean(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 60)
  return { name, brand, category: lastPart(p.categories), quantity: clean(p.quantity, 60), image: imageUrl(env, p.image_front_small_url) ?? imageUrl(env, p.image_front_url), source: 'openfoodfacts' }
}

async function askUpc(env: CatalogEnv, code: string): Promise<Ask> {
  let res: Response
  try {
    res = await fetch(`${env.CATALOG_UPC_URL || UPC_URL}/lookup?upc=${code}`, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) })
  } catch { return 'failed' }
  // 429 is TOO_FAST / EXCEED_LIMIT: the free tier is used up for now, so this says nothing about the product;
  // nobody asks again for a minute (too fast) or until the day is over (used up)
  if (res.status === 429) {
    const said = await res.json<{ code?: unknown } | null>().catch(() => null)
    const until = said?.code === 'EXCEED_LIMIT' ? (today() + 1) * DAY : Date.now() + UPC_PAUSE
    await env.DB.prepare("INSERT INTO catalog_quota (k, day, n) VALUES ('upc-pause', ?, ?) ON CONFLICT(k, day) DO UPDATE SET n = MAX(n, excluded.n)").bind(today(), until).run()
    return 'failed'
  }
  if (res.status === 400 || res.status === 404) return 'nothing'
  if (!res.ok) return 'failed'
  let b: { code?: string; items?: Record<string, unknown>[] } | null
  try { b = await res.json() } catch { return 'failed' }
  if (!b || typeof b !== 'object' || b.code !== 'OK') return 'failed'
  const it = Array.isArray(b.items) ? b.items[0] : undefined
  const name = clean(it?.title, 120)
  if (!it || !name) return 'nothing'
  const images = Array.isArray(it.images) ? it.images : []
  return { name, brand: clean(it.brand, 60), category: lastPart(it.category), quantity: null, image: images.map(u => imageUrl(env, u)).find(Boolean) ?? null, source: 'upcitemdb' }
}

// ---------- the endpoints ----------
async function lookup(req: Request, env: CatalogEnv, url: URL): Promise<Response> {
  const k = catalogKey(url.searchParams.get('code'))
  if (!k) return json({ error: 'bad code' }, 400)
  const g = { gtin: k.key, ask: k.gtin?.ask ?? '' }
  const device = url.searchParams.get('device')
  if (!validDevice(device)) return json({ error: 'bad device' }, 400)
  const who = await addressKey(env, req)
  if (!(await allowLookup(env, who, device))) return json({ error: 'too many' }, 429)
  const cached = await env.DB.prepare('SELECT * FROM catalog_cache WHERE gtin = ?').bind(g.gtin).first<CacheRow>()

  // 1. what the shops called it: the most common name (newest wins a tie), the details from its newest entry;
  //    only devices still bound to a live licence vote (a revoked, expired or unbound one no longer counts), and a
  //    shop's computer and phone together are one shop
  const now = Date.now()
  const shop = await env.DB.prepare(`WITH dl AS (SELECT d.device, MIN(d.code) AS lic FROM license_devices d JOIN licenses l ON l.code = d.code
      WHERE d.device IN (SELECT device FROM catalog_contrib WHERE gtin = ?) AND l.revoked = 0 AND (l.expires_at IS NULL OR l.expires_at > ?) GROUP BY d.device),
    v AS (SELECT c.*, dl.lic FROM catalog_contrib c JOIN dl ON dl.device = c.device WHERE c.gtin = ?)
    SELECT name, brand, category, unit, (SELECT COUNT(DISTINCT x.lic) FROM v x WHERE x.name = v.name) AS n FROM v ORDER BY n DESC, at DESC LIMIT 1`)
    .bind(g.gtin, now, g.gtin).first<{ name: string; brand: string | null; category: string | null; unit: string | null; n: number }>()
  if (shop) return json({ found: true, name: shop.name, brand: shop.brand ?? undefined, category: shop.category ?? undefined, quantity: shop.unit ?? undefined, image: !!(cached?.found && cached.image_url), source: 'shops', shops: shop.n })
  // a part number: only the shops know it
  if (!k.gtin) return json({ found: false })

  // 2. an earlier outside answer that is still fresh
  if (cached && now - cached.at < (cached.found ? FRESH_FOUND : FRESH_MISSING)) {
    if (!cached.found || !cached.name) return json({ found: false })
    return json({ found: true, name: cached.name, brand: cached.brand ?? undefined, category: cached.category ?? undefined, quantity: cached.quantity ?? undefined, image: !!cached.image_url, source: cached.source })
  }

  // 3. ask outside: Open Food Facts first; UPCitemdb (100 a day) only when that has nothing — not when it could
  //    not be asked (slow, down, over budget): then try again later, remembering nothing
  if (!(await allowOff(env))) return json({ found: false, retry: true })
  const off = await askOff(env, g.ask)
  if (off === 'failed') return json({ found: false, retry: true })
  const got = off !== 'nothing' ? off : await allowUpc(env, who, device) ? await askUpc(env, g.ask) : 'failed'
  if (got === 'failed') return json({ found: false, retry: true })
  const f = typeof got === 'object' ? got : null
  await env.DB.prepare(`INSERT INTO catalog_cache (gtin, found, name, brand, category, quantity, image_url, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(gtin) DO UPDATE SET found = excluded.found, name = excluded.name, brand = excluded.brand, category = excluded.category, quantity = excluded.quantity, image_url = excluded.image_url, source = excluded.source, at = excluded.at`)
    .bind(g.gtin, f ? 1 : 0, f?.name ?? null, f?.brand ?? null, f?.category ?? null, f?.quantity ?? null, f?.image ?? null, f?.source ?? null, now).run()
  if (!f) return json({ found: false })
  return json({ found: true, name: f.name, brand: f.brand ?? undefined, category: f.category ?? undefined, quantity: f.quantity ?? undefined, image: !!f.image, source: f.source })
}

/** The picture of a looked-up product, fetched from the address the lookup stored (never one the caller gives). */
async function image(req: Request, env: CatalogEnv, url: URL): Promise<Response> {
  const g = publicGtin(url.searchParams.get('code'))
  if (!g) return json({ error: 'bad code' }, 400)
  const device = url.searchParams.get('device')
  if (!validDevice(device)) return json({ error: 'bad device' }, 400)
  if (!(await allowLookup(env, await addressKey(env, req), device))) return json({ error: 'too many' }, 429)
  const row = await env.DB.prepare('SELECT image_url FROM catalog_cache WHERE gtin = ? AND found = 1').bind(g.gtin).first<{ image_url: string | null }>()
  const src = imageUrl(env, row?.image_url)
  if (!src) return json({ error: 'no image' }, 404)
  let res: Response
  try { res = await fetch(src, { headers: { 'user-agent': USER_AGENT, accept: 'image/*' }, signal: AbortSignal.timeout(TIMEOUT) }) } catch { return json({ error: 'unavailable' }, 502) }
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  // a redirect may only end at an address the server would have fetched in the first place
  if (!res.ok || !IMAGE_TYPES.has(type) || !imageUrl(env, res.url || src) || Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE || !res.body) { res.body?.cancel(); return json({ error: 'no image' }, 404) }
  // read it whole (at most 1.5 MB): a picture that turns out too big is refused, not sent half
  const parts: Uint8Array[] = []
  let size = 0
  const reader = res.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_IMAGE) { await reader.cancel(); return json({ error: 'no image' }, 404) }
      parts.push(value)
    }
  } catch { return json({ error: 'unavailable' }, 502) }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const p of parts) { bytes.set(p, at); at += p.byteLength }
  return new Response(bytes, { headers: { 'content-type': type, 'content-length': String(size), 'cache-control': 'public, max-age=604800', 'x-content-type-options': 'nosniff', ...CORS } })
}

/** A licensed device shares the names it gave scanned products; one vote per device per number, the newest replaces its own. */
async function contribute(req: Request, env: CatalogEnv): Promise<Response> {
  if (!env.TOKEN_SECRET) return json({ error: 'not configured' }, 503)
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too large' }, 413)
  let b: { token?: unknown; device?: unknown; items?: unknown }
  try { b = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  if (!b || typeof b !== 'object') return json({ error: 'bad json' }, 400)
  const s = await readToken(env.TOKEN_SECRET, b.token)
  if (!s || !validDevice(b.device) || s.d !== b.device) return json({ error: 'not licensed' }, 401)
  // the session is a binding, re-checked against the licence as it is now (revoked, expired or moved: no longer counts)
  const ok = await env.DB.prepare('SELECT 1 FROM licenses l JOIN license_devices d ON d.code = l.code WHERE l.code = ? AND d.device = ? AND l.revoked = 0 AND (l.expires_at IS NULL OR l.expires_at > ?)').bind(s.c, s.d, Date.now()).first()
  if (!ok) return json({ error: 'not licensed' }, 401)
  if (!Array.isArray(b.items)) return json({ error: 'bad items' }, 400)
  if (b.items.length > MAX_ITEMS) return json({ error: `too many items: send at most ${MAX_ITEMS} per request` }, 400)

  const items = new Map<string, { name: string; brand: string | null; category: string | null; unit: string | null }>()
  for (const it of b.items as Record<string, unknown>[]) {
    if (!it || typeof it !== 'object') continue
    const g = catalogKey(it.code)
    const name = clean(it.name, 121)
    if (!g || !name || [...name].length < 2 || [...name].length > 120) continue   // a longer name is refused, not cut
    items.set(g.key, { name, brand: clean(it.brand, 60), category: clean(it.category, 60), unit: clean(it.unit, 60) })
  }
  if (!items.size) return json({ ok: true, saved: 0 })
  if (!(await bump(env, 'c:' + s.d, items.size, LIMIT_CONTRIB).first())) return json({ error: 'too many' }, 429)
  const now = Date.now()
  const upsert = env.DB.prepare(`INSERT INTO catalog_contrib (gtin, device, name, brand, category, unit, at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(gtin, device) DO UPDATE SET name = excluded.name, brand = excluded.brand, category = excluded.category, unit = excluded.unit, at = excluded.at`)
  await env.DB.batch([...items].map(([gtin, i]) => upsert.bind(gtin, s.d, i.name, i.brand, i.category, i.unit, now)))
  return json({ ok: true, saved: items.size })
}

const PHOTO_PROMPT = `You read the packaging of products sold in a car-parts and general shop in Syria (boxes of parts, oils, filters, bulbs, tools, accessories, cleaning products and the like).
Look at the photo and answer with one JSON object only, no other text:
{"name": the product's name as a shop would write it in Arabic, short (at most 8 words): what it is in Arabic, then the brand and the model or part number in Latin letters (for example "فلتر زيت MANN W 712/75", "زيت محرك Castrol 5W-30 4 لتر", "لمبة H4 Philips 12V"),
 "brand": the maker's name as printed,
 "partNumber": the part / reference / article number printed on it (not the barcode digits),
 "size": the size, volume, weight, quantity or voltage printed (like "4 L", "12V 55W", "500 ml"),
 "category": a short Arabic category (like "فلاتر", "زيوت", "كهرباء", "فرامل", "إكسسوارات", "تنظيف"),
 "cars": the vehicles it fits if they are printed on it}
Use null for anything you cannot read on the box. Never invent a brand or a number that is not visible. If the photo does not show a product, answer {"name": null}.`

/** Reads a photo of a product's box with an AI model: what it is, its maker, part number and size. For barcodes
 *  no database knows: the shop takes one picture instead of typing. Counted per device, address and server. */
async function photo(req: Request, env: CatalogEnv): Promise<Response> {
  if (!env.AI) return json({ error: 'not configured' }, 503)
  if (Number(req.headers.get('content-length') ?? 0) > MAX_PHOTO * 1.4 + 4096) return json({ error: 'too large' }, 413)
  let b: { device?: unknown; image?: unknown }
  try { b = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  if (!b || typeof b !== 'object' || !validDevice(b.device)) return json({ error: 'bad device' }, 400)
  const img = b.image
  if (typeof img !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > MAX_PHOTO * 1.37 + 40) return json({ error: 'bad image' }, 400)
  const who = await addressKey(env, req)
  const [d, i] = await env.DB.batch<{ n: number }>([bump(env, 'pd:' + b.device, 1, PHOTO_DEVICE), bump(env, 'pi:' + who, 1, PHOTO_IP)])
  if (!d.results[0] || !i.results[0]) return json({ error: 'too many' }, 429)
  if (!(await bump(env, 'photo', 1, PHOTO_DAY).first())) return json({ error: 'too many' }, 429)
  let text = ''
  try {
    const r = await env.AI.run(PHOTO_MODEL, { messages: [{ role: 'user', content: [{ type: 'text', text: PHOTO_PROMPT }, { type: 'image_url', image_url: { url: img } }] }], max_tokens: 300, temperature: 0 }) as { response?: unknown; choices?: { message?: { content?: unknown } }[] }
    const out = r?.choices?.[0]?.message?.content ?? r?.response
    text = typeof out === 'string' ? out : out && typeof out === 'object' ? JSON.stringify(out) : ''
  } catch (e) {
    // the service's own allowance for the day is used up, or it is busy: try again later
    return json({ error: 'unavailable', detail: String(e).slice(0, 200) }, 503)
  }
  const m = /\{[\s\S]*\}/.exec(text)
  let o: Record<string, unknown> = {}
  try { o = m ? JSON.parse(m[0]) : {} } catch { o = {} }
  const pick = (k: string, max: number) => { const v = clean(o[k], max + 1); return v && !/^(null|none|unknown|n\/a|غير معروف)$/i.test(v) && [...v].length <= max ? v : null }
  const name = pick('name', 120)
  if (!name || [...name].length < 2) return json({ found: false })
  return json({ found: true, name, brand: pick('brand', 60), partNumber: pick('partNumber', 60), size: pick('size', 40), category: pick('category', 60), cars: pick('cars', 160) })
}

/** Routes the catalogue paths (no shop key needed); returns null for anything else. */
export async function handleCatalog(req: Request, env: CatalogEnv, path: string): Promise<Response | null> {
  if (!path.startsWith('/api/catalog/')) return null
  const url = new URL(req.url)
  if (path === '/api/catalog/lookup' && req.method === 'GET') return lookup(req, env, url)
  if (path === '/api/catalog/image' && req.method === 'GET') return image(req, env, url)
  if (path === '/api/catalog/contribute' && req.method === 'POST') return contribute(req, env)
  if (path === '/api/catalog/photo' && req.method === 'POST') return photo(req, env)
  return json({ error: 'not found' }, 404)
}
