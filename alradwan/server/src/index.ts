// كراج الرضوان — sync server.
//
//   POST /api/sync   Bearer <shop key>   {since, changes[]}  -> {seq, changes[]}
//   GET  /api/ping   Bearer <shop key>                       -> {ok, records}
//   everything else: the website (the built app in ../dist)
//
// A shop is identified by its key: a long secret the owner types into every device. The key is never
// stored; only its hash names the shop's rows. Anyone with the key has the shop's data, so it must
// be kept private — but there is no account to create and nothing else to set up.

export interface Env { DB: D1Database; ASSETS: Fetcher }

const COLLECTIONS = new Set(['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'payments', 'expenses', 'cash', 'movements', 'users', 'settings', 'audit', 'carModels'])
const MAX_CHANGES = 2000
const MAX_BODY = 8 * 1024 * 1024        // one sync request
const MAX_RECORD = 400 * 1024           // one record (a product with a photo is well under this)
const MIN_KEY = 12
const FAIL_WINDOW = 15 * 60000          // wrong keys from one address inside this window…
const FAIL_LIMIT = 20                   // …beyond this many are refused for the rest of the window
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }

interface Change { collection: string; id: string; updatedAt: number; deleted: boolean; data: unknown }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } })

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
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
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
      const changes = (body.changes ?? []).filter(c => c && COLLECTIONS.has(c.collection) && typeof c.id === 'string' && c.id.length <= 64 && Number.isFinite(c.updatedAt) && JSON.stringify(c.data ?? {}).length <= MAX_RECORD).slice(0, MAX_CHANGES)
      // a new shop is created only by a device that brings data with it; an empty request with an unknown key is a guess
      if (!known && changes.length === 0) { await noteFailure(env, ip, now); return json({ seq: 0, more: false, changes: [], serverTime: now }) }

      // the shop's row (created on first contact) and its current seq
      await env.DB.prepare('INSERT INTO shops (shop, seq, created_at, last_seen) VALUES (?, 0, ?, ?) ON CONFLICT(shop) DO UPDATE SET last_seen = excluded.last_seen').bind(shop, now, now).run()
      let seq = (await env.DB.prepare('SELECT seq FROM shops WHERE shop = ?').bind(shop).first<{ seq: number }>())?.seq ?? 0

      if (changes.length) {
        // newest change wins: a record is replaced only if the incoming one is newer
        const existing = new Map<string, number>()
        for (let i = 0; i < changes.length; i += 90) {
          const part = changes.slice(i, i + 90)
          const q = part.map(() => '(col = ? AND id = ?)').join(' OR ')
          const rows = await env.DB.prepare(`SELECT col, id, updated_at FROM records WHERE shop = ? AND (${q})`).bind(shop, ...part.flatMap(c => [c.collection, c.id])).all<{ col: string; id: string; updated_at: number }>()
          for (const r of rows.results) existing.set(`${r.col}:${r.id}`, r.updated_at)
        }
        const stmts: D1PreparedStatement[] = []
        const upsert = env.DB.prepare('INSERT INTO records (shop, col, id, seq, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(shop, col, id) DO UPDATE SET seq = excluded.seq, updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data')
        for (const c of changes) {
          const old = existing.get(`${c.collection}:${c.id}`)
          if (old !== undefined && old >= c.updatedAt) continue
          existing.set(`${c.collection}:${c.id}`, c.updatedAt)
          seq++
          stmts.push(upsert.bind(shop, c.collection, c.id, seq, c.updatedAt, c.deleted ? 1 : 0, JSON.stringify(c.data ?? {})))
        }
        if (stmts.length) {
          stmts.push(env.DB.prepare('UPDATE shops SET seq = ? WHERE shop = ?').bind(seq, shop))
          for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100))
        }
      }

      // what changed since the device's last visit (in pages, so a fresh device gets everything over a few calls)
      const rows = await env.DB.prepare('SELECT col, id, seq, updated_at, deleted, data FROM records WHERE shop = ? AND seq > ? ORDER BY seq LIMIT ?').bind(shop, since, MAX_CHANGES + 1).all<{ col: string; id: string; seq: number; updated_at: number; deleted: number; data: string }>()
      const page = rows.results.slice(0, MAX_CHANGES)
      const more = rows.results.length > MAX_CHANGES
      const out = page.map(r => ({ collection: r.col, id: r.id, updatedAt: r.updated_at, deleted: !!r.deleted, data: JSON.parse(r.data) }))
      const lastSeq = more ? page[page.length - 1].seq : seq
      return json({ seq: lastSeq, more, changes: out, serverTime: now })
    }

    return json({ error: 'not found' }, 404)
  },
}
