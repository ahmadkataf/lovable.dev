// Madar MVP — Cloudflare Worker (Hono + D1). API under /api/*, everything else is the built client (ASSETS).
// See docs/mvp-spec.md; routes are grouped per role under src/routes/.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ApiError, type AppEnv } from './types'
import { adminLimiter, clientIp, safeEqual } from './auth'
import common from './routes/common'
import teacher from './routes/teacher'
import student from './routes/student'
import parent from './routes/parent'
import school from './routes/school'
import directorate from './routes/directorate'
import { doDatabase, doStub } from './dbshim'

const app = new Hono<AppEnv>()

// Production database: one SQLite-backed Durable Object exposed through a D1-shaped shim (tests pass a fake D1).
app.use('*', async (c, next) => {
  // A fresh stub per request (a stub created in one request must not be used by another).
  if (!c.env.DB && c.env.MADAR_DO) c.env = { ...c.env, DB: doDatabase(c.env.MADAR_DO.get(c.env.MADAR_DO.idFromName('main'))) }
  await next()
})

// Browsers may call the API only from the app's own origins (the PWA, the workers.dev preview and local dev servers).
// Hono adds `Vary: Origin` itself whenever the origin is not '*'.
const ALLOWED_ORIGINS = new Set([
  'https://app.madar.raqeem.dev',
  'https://madar-app.almutafawiqin.workers.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8787',
])
app.use('/api/*', cors({ origin: origin => (ALLOWED_ORIGINS.has(origin) ? origin : null), allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }))
// Every API answer (admin ones included — they are registered below this line) is personal: never cache it.
app.use('/api/*', async (c, next) => { await next(); c.header('cache-control', 'no-store') })

// Admin: apply schema/seed scripts and read table counts. Needs the ADMIN_KEY secret in the x-admin-key header.
// Throttled per IP (in memory, then durably in the database object) and compared in constant time.
app.use('/api/admin/*', async (c, next) => {
  const ip = clientIp(c)
  if (!adminLimiter.hit(ip)) throw new ApiError(429, 'محاولات كثيرة، يُرجى المحاولة بعد قليل')
  const stub = doStub(c.env)
  if (stub && !(await stub.adminAttempt(ip)).allowed) throw new ApiError(429, 'محاولات كثيرة، يُرجى المحاولة بعد قليل')
  if (!safeEqual(c.req.header('x-admin-key'), c.env.ADMIN_KEY)) throw new ApiError(403, 'غير مصرّح')
  await next()
})
app.post('/api/admin/sql', async c => {
  const script = await c.req.text()
  if (!script.trim()) return c.json({ error: 'نصّ SQL فارغ' }, 400)
  const r = await c.env.DB.exec(script)
  return c.json({ statements: r.count })
})
app.post('/api/admin/reseed', async c => {
  const { reseed } = await import('./worker')
  return c.json(await reseed(c.env))
})
app.get('/api/admin/health', async c => {
  const stub = doStub(c.env)
  return c.json(stub ? await stub.health() : { note: 'no durable object binding' })
})

app.route('/', common)
app.route('/', teacher)
app.route('/', student)
app.route('/', parent)
app.route('/', school)
app.route('/', directorate)

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status as ContentfulStatusCode)
  console.error('[madar]', err)
  return c.json({ error: 'حدث خطأ في الخادم، يُرجى المحاولة مجدّداً' }, 500)
})

/** Static client; unknown paths without a file extension fall back to the app shell (SPA routing). */
app.notFound(async c => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'المسار غير موجود' }, 404)
  if (!c.env.ASSETS) return c.text('Not found', 404)
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status !== 404 || c.req.method !== 'GET' || /\.[a-z0-9]+$/i.test(c.req.path)) return res
  const url = new URL(c.req.url)
  url.pathname = '/index.html'
  const shell = await c.env.ASSETS.fetch(new Request(url.toString(), { headers: c.req.raw.headers }))
  return shell.status === 404 ? res : shell
})

export default app
