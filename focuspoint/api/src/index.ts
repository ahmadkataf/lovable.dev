// Focus Point API — Cloudflare Worker entry. /v1/* is the JSON API (shared/types.ts ApiContract); /media/* the images
// uploaded from the site editor (media.ts); everything else is the built web app from [assets] with an index.html
// fallback (single-page app) and the site content written into it (app.ts). Cron work lives in cron.ts.
import { serveApp } from './app'
import { assetLinks } from './assetlinks'
import { authenticate } from './auth'
import { runCron } from './cron'
import type { Env } from './env'
import { CORS_HEADERS, HttpError, error, json } from './http'
import { match, type Ctx, type Route } from './router'
import { serveMedia } from './media'
import { adminRoutes } from './routes/admin'
import { contentRoutes } from './routes/content'
import { paymentRoutes } from './routes/payments'
import { publicRoutes } from './routes/public'
import { syncRoutes } from './routes/sync'
import { teamRoutes } from './routes/team'
import { isUuid } from './validate'

// Order matters only where a static path shadows a ":param" path (e.g. /v1/bookings/mine before /v1/bookings/:id).
const routes: Route[] = [...publicRoutes, ...teamRoutes, ...syncRoutes, ...adminRoutes, ...contentRoutes, ...paymentRoutes]

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
    if (err instanceof HttpError) return error(err.status, err.code, err.extra)
    console.error(`${req.method} ${url.pathname}`, err)
    return error(500, 'internal')
  }
}

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/v1' || url.pathname.startsWith('/v1/')) return handleApi(req, env, exec, url)
    if (url.pathname === '/.well-known/assetlinks.json') return json(assetLinks(env.ASSETLINKS_FINGERPRINTS), 200, { 'Cache-Control': 'public, max-age=3600' })
    if (url.pathname.startsWith('/media/')) return serveMedia(req, env, url, exec)
    return serveApp(req, env)
  },
  async scheduled(_event: ScheduledController, env: Env, exec: ExecutionContext): Promise<void> {
    exec.waitUntil(runCron(env, exec).then((r) => console.log('cron', JSON.stringify(r))))
  },
} satisfies ExportedHandler<Env>
