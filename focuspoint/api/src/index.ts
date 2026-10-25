// Focus Point API — Cloudflare Worker entry. /v1/* is the JSON API (shared/types.ts ApiContract); everything else is the
// built web app from [assets] with an index.html fallback (single-page app). Cron work lives in cron.ts.
import { assetLinks } from './assetlinks'
import { authenticate } from './auth'
import { runCron } from './cron'
import type { Env } from './env'
import { CORS_HEADERS, HttpError, error, json } from './http'
import { match, type Ctx, type Route } from './router'
import { adminRoutes } from './routes/admin'
import { paymentRoutes } from './routes/payments'
import { publicRoutes } from './routes/public'
import { syncRoutes } from './routes/sync'
import { teamRoutes } from './routes/team'
import { isUuid } from './validate'

// Order matters only where a static path shadows a ":param" path (e.g. /v1/bookings/mine before /v1/bookings/:id).
const routes: Route[] = [...publicRoutes, ...teamRoutes, ...syncRoutes, ...adminRoutes, ...paymentRoutes]

async function handleApi(req: Request, env: Env, exec: ExecutionContext, url: URL): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  const hit = match(routes, req.method, url.pathname)
  if (!hit) return error(404, 'not_found')
  try {
    const user = await authenticate(req, env)   // throws 401 on a bad/expired token or a disabled account
    const deviceHeader = req.headers.get('X-Device')
    if (deviceHeader !== null && !isUuid(deviceHeader)) throw new HttpError(400, 'invalid_device')
    if (hit.route.access !== 'public' && !user) throw new HttpError(401, 'unauthorized')
    if (hit.route.access === 'admin' && user?.role !== 'admin') throw new HttpError(403, 'forbidden')
    const ctx: Ctx = { req, env, exec, url, params: hit.params, now: new Date(), user, device: deviceHeader }
    return await hit.route.handler(ctx)
  } catch (err) {
    if (err instanceof HttpError) return error(err.status, err.code)
    console.error(`${req.method} ${url.pathname}`, err)
    return error(500, 'internal')
  }
}

async function serveApp(req: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) return new Response('Focus Point API. The web app is not built (web/dist missing).', { status: 404 })
  const res = await env.ASSETS.fetch(req)
  if (res.status !== 404 || (req.method !== 'GET' && req.method !== 'HEAD')) return res
  const index = new URL('/index.html', req.url)       // SPA fallback: deep links like /admin/bookings/12
  return env.ASSETS.fetch(new Request(index.toString(), { method: 'GET', headers: req.headers }))
}

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) return handleApi(req, env, exec, url)
    if (url.pathname === '/.well-known/assetlinks.json') return json(assetLinks(env.ASSETLINKS_FINGERPRINTS), 200, { 'Cache-Control': 'public, max-age=3600' })
    return serveApp(req, env)
  },
  async scheduled(_event: ScheduledController, env: Env, exec: ExecutionContext): Promise<void> {
    exec.waitUntil(runCron(env, exec).then((r) => console.log('cron', JSON.stringify(r))))
  },
} satisfies ExportedHandler<Env>
