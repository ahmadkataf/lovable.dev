// كراج الرضوان — sync server.
//
//   POST /api/sync   Bearer <shop key>   {since, changes[]}  -> {seq, changes[]}
//   GET  /api/ping   Bearer <shop key>                       -> {ok, records}
//   everything else: the website (the built app in ../dist)
//
// A shop is identified by its key: a long secret the owner types into every device. The key is never
// stored; only its hash names the shop's rows, and a settings record that still carries one is stripped. Anyone with the key has the shop's data, so it must
// be kept private — but there is no account to create and nothing else to set up.

import { handleLicense } from './license'
import { ADMIN_PAGE } from './admin'

export interface Env { DB: D1Database; ASSETS: Fetcher; TOKEN_SECRET?: string; ADMIN_KEY?: string }


const COLLECTIONS = new Set(['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'payments', 'expenses', 'cash', 'movements', 'users', 'settings', 'audit', 'carModels', 'journal', 'vehicles'])
const MAX_CHANGES = 2000
const MAX_BODY = 8 * 1024 * 1024        // one sync request
const MAX_RECORD = 400 * 1024           // one record (a product with a photo is well under this)
const MIN_KEY = 12
const FAIL_WINDOW = 15 * 60000          // wrong keys from one address inside this window…
const FAIL_LIMIT = 20                   // …beyond this many are refused for the rest of the window
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }

interface Change { collection: string; id: string; updatedAt: number; deleted: boolean; data: unknown }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', ...CORS } })
const LOOKUP = 45                       // D1 binds at most 100 parameters per statement: 1 + 2×45
const MAX_SKEW = 60 * 60000             // a record dated more than an hour ahead is clamped to now

/** Only plain records whose data agrees with its envelope; a record stamped in the far future would be un-overwritable. */
function cleanChange(c: Change, now: number): Change | null {
  if (!c || typeof c !== 'object' || !COLLECTIONS.has(c.collection)) return null
  if (typeof c.id !== 'string' || !c.id || c.id.length > 64) return null
  if (!Number.isFinite(c.updatedAt) || c.updatedAt < 0) return null
  const data = c.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (d.id !== undefined && d.id !== c.id) return null
  if (c.collection === 'settings') delete d.sync
  const updatedAt = Math.min(c.updatedAt, now + MAX_SKEW)
  d.updatedAt = updatedAt
  if (JSON.stringify(d).length > MAX_RECORD) return null
  return { collection: c.collection, id: c.id, updatedAt, deleted: !!c.deleted, data: d }
}

async function shopId(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('alradwan:' + key))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

function keyOf(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  const k = m?.[1]?.trim() ?? ''
  return k.length >= MIN_KEY && k.length <= 200 ? k : null
}

function ipOf(req: Request): string { return req.headers.get('cf-connecting-ip') ?? 'unknown' }

/** Guessing keys: an address that keeps sending unknown keys is refused for a while. A wrong key is only
 *  detectable as "a shop with no records", so the check counts requests for shops that do not exist yet. */
async function tooManyFailures(env: Env, ip: string, now: number): Promise<boolean> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_failures WHERE ip = ? AND at > ?').bind(ip, now - FAIL_WINDOW).first<{ n: number }>()
  return (row?.n ?? 0) >= FAIL_LIMIT
}
async function noteFailure(env: Env, ip: string, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_failures (ip, at) VALUES (?, ?)').bind(ip, now),
    env.DB.prepare('DELETE FROM auth_failures WHERE at < ?').bind(now - FAIL_WINDOW),
  ])
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try { return await handle(req, env) } catch (e) { console.error('alradwan:', (e as Error)?.message ?? e); return json({ error: 'server error' }, 500) }
  },
}

async function handle(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/admin' || url.pathname === '/admin/') return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const lic = await handleLicense(req, env, url.pathname)
    if (lic) return lic
    const key = keyOf(req)
    if (!key) return json({ error: 'missing or short key' }, 401)
    const shop = await shopId(key)
    const now = Date.now()
    const ip = ipOf(req)
    if (await tooManyFailures(env, ip, now)) return json({ error: 'too many attempts' }, 429)
    const known = !!(await env.DB.prepare('SELECT 1 FROM shops WHERE shop = ?').bind(shop).first())

    if (url.pathname === '/api/ping') {
      if (!known) await noteFailure(env, ip, now)
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE shop = ? AND deleted = 0').bind(shop).first<{ n: number }>()
      return json({ ok: true, records: row?.n ?? 0, known, serverTime: now })
    }

    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const len = Number(req.headers.get('content-length') ?? 0)
      if (len > MAX_BODY) return json({ error: 'too large' }, 413)
      let body: { since?: number; changes?: Change[] }
      try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) }
      const since = Number(body.since) || 0
      const rawChanges = Array.isArray(body.changes) ? body.changes : []
      if (rawChanges.length > MAX_CHANGES) return json({ error: `too many changes: send at most ${MAX_CHANGES} per request` }, 400)
      const changes = rawChanges.map(c => cleanChange(c, now)).filter((c): c is Change => c !== null)
      // a new shop is created only by a device that brings data with it; an empty request with an unknown key is a guess
      if (!known && changes.length === 0) { await noteFailure(env, ip, now); return json({ seq: 0, more: false, changes: [], serverTime: now }) }

      // the shop's row (created on first contact) and its current seq
      await env.DB.prepare('INSERT INTO shops (shop, seq, created_at, last_seen) VALUES (?, 0, ?, ?) ON CONFLICT(shop) DO UPDATE SET last_seen = excluded.last_seen').bind(shop, now, now).run()

      if (changes.length) {
        // newest change wins: a record is replaced only if the incoming one is newer
        const existing = new Map<string, number>()
        for (let i = 0; i < changes.length; i += LOOKUP) {
          const part = changes.slice(i, i + LOOKUP)
          const q = part.map(() => '(col = ? AND id = ?)').join(' OR ')
          const rows = await env.DB.prepare(`SELECT col, id, updated_at FROM records WHERE shop = ? AND (${q})`).bind(shop, ...part.flatMap(c => [c.collection, c.id])).all<{ col: string; id: string; updated_at: number }>()
          for (const r of rows.results) existing.set(`${r.col}:${r.id}`, r.updated_at)
        }
        const accepted: Change[] = []
        for (const c of changes) {
          const old = existing.get(`${c.collection}:${c.id}`)
          if (old !== undefined && old >= c.updatedAt) continue
          existing.set(`${c.collection}:${c.id}`, c.updatedAt)
          accepted.push(c)
        }
        if (accepted.length) {
          // the sequence numbers are reserved in one atomic statement, so two devices syncing at once get disjoint ranges
          const end = (await env.DB.prepare('UPDATE shops SET seq = seq + ? WHERE shop = ? RETURNING seq').bind(accepted.length, shop).first<{ seq: number }>())?.seq ?? 0
          let seq = end - accepted.length
          // while these rows are being written, readers must not run past them (see the pull below)
          await env.DB.prepare('INSERT INTO reservations (shop, start, at) VALUES (?, ?, ?)').bind(shop, seq + 1, now).run()
          const upsert = env.DB.prepare('INSERT INTO records (shop, col, id, seq, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(shop, col, id) DO UPDATE SET seq = excluded.seq, updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data')
          const stmts = accepted.map(c => upsert.bind(shop, c.collection, c.id, ++seq, c.updatedAt, c.deleted ? 1 : 0, JSON.stringify(c.data)))
          for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100))
          await env.DB.prepare('DELETE FROM reservations WHERE shop = ? AND start = ?').bind(shop, seq - accepted.length + 1).run()
        }
      }

      // what changed since the device's last visit (in pages, so a fresh device gets everything over a few calls)
      // another device may hold a reserved range it is still writing: deliver only what lies below it (stale reservations are ignored)
      const pending = await env.DB.prepare('SELECT MIN(start) AS s FROM reservations WHERE shop = ? AND at > ?').bind(shop, now - 120000).first<{ s: number | null }>()
      const cap = pending?.s ?? Number.MAX_SAFE_INTEGER
      const rows = await env.DB.prepare('SELECT col, id, seq, updated_at, deleted, data FROM records WHERE shop = ? AND seq > ? AND seq < ? ORDER BY seq LIMIT ?').bind(shop, since, cap, MAX_CHANGES + 1).all<{ col: string; id: string; seq: number; updated_at: number; deleted: number; data: string }>()
      const page = rows.results.slice(0, MAX_CHANGES)
      const more = rows.results.length > MAX_CHANGES
      const out = page.map(r => ({ collection: r.col, id: r.id, updatedAt: r.updated_at, deleted: !!r.deleted, data: JSON.parse(r.data) }))
      // the cursor is the highest number actually delivered: a range reserved by a request still writing is not skipped
      const lastSeq = page.length ? page[page.length - 1].seq : since
      return json({ seq: lastSeq, more, changes: out, serverTime: now })
    }

    return json({ error: 'not found' }, 404)
}
