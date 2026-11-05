// Madar MVP — Cloudflare Worker (Hono + D1). API under /api/*, everything else is the built client (ASSETS).
// See docs/mvp-spec.md; routes are grouped per role under src/routes/.
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ApiError, type AppEnv } from './types'
import common from './routes/common'
import teacher from './routes/teacher'
import student from './routes/student'
import parent from './routes/parent'
import school from './routes/school'
import directorate from './routes/directorate'
import { doDatabase } from './dbshim'

const app = new Hono<AppEnv>()

// Production database: one SQLite-backed Durable Object exposed through a D1-shaped shim (tests pass a fake D1).
app.use('*', async (c, next) => {
  // A fresh stub per request (a stub created in one request must not be used by another).
  if (!c.env.DB && c.env.MADAR_DO) c.env = { ...c.env, DB: doDatabase(c.env.MADAR_DO.get(c.env.MADAR_DO.idFromName('main'))) }
  await next()
})

// Admin: apply schema/seed scripts and read table counts. Needs the ADMIN_KEY secret in the x-admin-key header.
app.post('/api/admin/sql', async c => {
  if (!c.env.ADMIN_KEY || c.req.header('x-admin-key') !== c.env.ADMIN_KEY) return c.json({ error: 'غير مصرّح' }, 403)
  const script = await c.req.text()
  if (!script.trim()) return c.json({ error: 'نصّ SQL فارغ' }, 400)
  const r = await c.env.DB.exec(script)
  return c.json({ statements: r.count })
})
app.post('/api/admin/reseed', async c => {
  if (!c.env.ADMIN_KEY || c.req.header('x-admin-key') !== c.env.ADMIN_KEY) return c.json({ error: 'غير مصرّح' }, 403)
  const { reseed } = await import('./worker')
  return c.json(await reseed(c.env))
})
app.get('/api/admin/health', async c => {
  if (!c.env.ADMIN_KEY || c.req.header('x-admin-key') !== c.env.ADMIN_KEY) return c.json({ error: 'غير مصرّح' }, 403)
  const stub = c.env.MADAR_DO ? (c.env.MADAR_DO.get(c.env.MADAR_DO.idFromName('main')) as unknown as import('./dbshim').DbStub) : null
  return c.json(stub ? await stub.health() : { note: 'no durable object binding' })
})

app.use('/api/*', cors({ origin: '*', allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }))
app.use('/api/*', async (c, next) => { await next(); c.header('cache-control', 'no-store') })

app.route('/', common)
app.route('/', teacher)
app.route('/', student)
app.route('/', parent)
app.route('/', school)
app.route('/', directorate)

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status as ContentfulStatusCode)
  console.error('[madar]', err)
  return c.json({ error: 'حدث خطأ في الخادم، حاول مجدّدًا' }, 500)
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
