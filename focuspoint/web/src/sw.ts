// Focus Point service worker (vite-plugin-pwa, injectManifest).
// - Precaches the app shell (the manifest injected at build time into self.__WB_MANIFEST).
// - Navigations: network first, fall back to the cached index.html (SPA shell) when offline.
// - Hashed assets: cache first.
// - API reads needed to render the home screen offline (/v1/settings, /v1/rooms, /v1/availability): network first,
//   fall back to the last good response.
// - Web Push: shows a notification, forwards the payload to every open window ({type: 'push', payload}) so the team
//   panel and the customer app refresh at once, and opens/focuses the app on click.
// No Workbox runtime is used, so the worker stays tiny and readable.

// ---- Minimal worker-scope typings (the app's tsconfig uses the DOM lib, which lacks these) ----
interface ExtendableEvent extends Event { waitUntil(p: Promise<unknown>): void }
interface FetchEvent extends ExtendableEvent { readonly request: Request; respondWith(r: Response | Promise<Response>): void }
interface PushEvent extends ExtendableEvent { readonly data: { json(): unknown; text(): string } | null }
interface NotificationEvent extends ExtendableEvent { readonly notification: Notification; readonly action: string }
interface WindowClientLike { readonly url: string; focus(): Promise<WindowClientLike>; navigate(url: string): Promise<WindowClientLike | null>; postMessage(message: unknown): void }
interface ServiceWorkerScope {
  __WB_MANIFEST: { url: string; revision: string | null }[]
  readonly location: Location
  readonly registration: ServiceWorkerRegistration
  readonly clients: { matchAll(o?: { type?: 'window'; includeUncontrolled?: boolean }): Promise<WindowClientLike[]>; openWindow(url: string): Promise<WindowClientLike | null>; claim(): Promise<void> }
  skipWaiting(): Promise<void>
  addEventListener(type: 'install' | 'activate', fn: (e: ExtendableEvent) => void): void
  addEventListener(type: 'fetch', fn: (e: FetchEvent) => void): void
  addEventListener(type: 'push', fn: (e: PushEvent) => void): void
  addEventListener(type: 'notificationclick', fn: (e: NotificationEvent) => void): void
  addEventListener(type: 'message', fn: (e: MessageEvent) => void): void
}
const sw = self as unknown as ServiceWorkerScope

// Workbox replaces the literal `self.__WB_MANIFEST` at build time; keep it spelled exactly like this.
const manifest = ((self as unknown as { __WB_MANIFEST?: ServiceWorkerScope["__WB_MANIFEST"] }).__WB_MANIFEST) || []
const SHELL = 'fp-shell-' + hash(JSON.stringify(manifest))
const API = 'fp-api-v1'
const API_PATHS = ['/v1/settings', '/v1/rooms', '/v1/availability']
const ORIGIN = sw.location.origin

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
function shellUrl(entry: { url: string; revision: string | null }): string {
  const u = new URL(entry.url, ORIGIN)
  // Un-hashed files (index.html, icons) get the revision as a cache-busting query, like Workbox does.
  if (entry.revision && !/\.[0-9a-f]{8,}\./i.test(u.pathname)) u.searchParams.set('v', entry.revision)
  return u.href
}
const shellFiles = new Map<string, string>()   // pathname → fetch url
for (const e of manifest) shellFiles.set(new URL(e.url, ORIGIN).pathname, shellUrl(e))

sw.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL)
    await Promise.all([...shellFiles.values()].map(async (url) => {
      const res = await fetch(url, { cache: 'reload' })
      if (!res.ok) return
      // The asset host redirects /index.html → / (307). A response flagged `redirected` is rejected by the browser
      // when served to a navigation request (net::ERR_FAILED), so store a clean copy of the body instead.
      const clean = res.redirected ? new Response(await res.arrayBuffer(), { status: 200, headers: res.headers }) : res
      await cache.put(url, clean)
    }))
    await sw.skipWaiting()
  })())
})

sw.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => n.startsWith('fp-shell-') && n !== SHELL).map((n) => caches.delete(n)))
    await sw.clients.claim()
  })())
})

sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void sw.skipWaiting()
})

async function shellResponse(pathname: string): Promise<Response | undefined> {
  const key = shellFiles.get(pathname)
  if (!key) return undefined
  return (await caches.open(SHELL)).match(key)
}

sw.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // SPA navigations: network first, cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        if (res.ok) return res
        return (await shellResponse('/index.html')) || res
      } catch {
        return (await shellResponse('/index.html')) || Response.error()
      }
    })())
    return
  }

  // Precached shell files: cache first.
  if (url.origin === ORIGIN && shellFiles.has(url.pathname)) {
    event.respondWith((async () => (await shellResponse(url.pathname)) || fetch(req))())
    return
  }

  // Public API reads: network first, fall back to the last good copy.
  if (API_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + '?'))) {
    event.respondWith((async () => {
      const cache = await caches.open(API)
      try {
        const res = await fetch(req)
        if (res.ok) await cache.put(req, res.clone())
        return res
      } catch (err) {
        const hit = await cache.match(req)
        if (hit) return hit
        throw err
      }
    })())
  }
})

// ---- Web Push ----
// The payload shape is shared/types.ts PushMessage: {kind, booking_id, url, title, body, tag?}.
interface PushPayload { kind?: string; title?: string; body?: string; url?: string; booking_id?: number | null; tag?: string }
const TEAM_KINDS = new Set(['booking_created', 'payment_submitted'])

/** Where a notification should open inside this app (the server's url may be a generic path; kind + booking id win). */
function targetFor(data: PushPayload): string {
  if (data.kind && TEAM_KINDS.has(data.kind)) return data.booking_id ? `/team/bookings?booking=${data.booking_id}` : '/team'
  if (data.url && data.url.startsWith('/admin')) return '/team'      // a team announcement (the API's generic team path)
  if (data.booking_id) return `/b/${data.booking_id}`
  if (data.url && /^\/(team|b\/|inbox|mine)/.test(data.url)) return data.url
  return '/inbox'
}

async function broadcast(message: unknown): Promise<void> {
  const wins = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const w of wins) { try { w.postMessage(message) } catch { /* a closing window */ } }
}

sw.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try { data = (event.data?.json() as PushPayload) || {} } catch { data = { body: event.data?.text() } }
  const title = data.title || 'فوكس بوينت'
  const url = targetFor(data)
  event.waitUntil(Promise.all([
    sw.registration.showNotification(title, {
      body: data.body || '',
      data: { url },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag,
      renotify: !!data.tag,
    } as NotificationOptions),
    broadcast({ type: 'push', payload: { ...data, url }, at: Date.now() }),
  ]))
})

sw.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data || {}) as { url?: string }
  const target = new URL(data.url || '/inbox', ORIGIN).href
  event.waitUntil((async () => {
    const wins = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const same = wins.find((w) => new URL(w.url).origin === ORIGIN)
    if (same) {
      await same.focus()
      await same.navigate(target)
      return
    }
    await sw.clients.openWindow(target)
  })())
})
