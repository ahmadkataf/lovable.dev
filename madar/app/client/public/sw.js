/* مَدار — service worker.
   Precache the app shell at install (the list is injected at build time by
   vite.config.ts: «/» with its inlined styles, the fonts — the two preloaded
   from index.html and the 600 weight — then the hashed bundle and icons),
   cache-first for /assets/* and /fonts/*, network-first for GET /api/*
   (POST is never cached), and the cached shell for navigations when the
   network fails or the server has no SPA fallback. */
const BUILD = '__BUILD__';
const PRECACHE = __PRECACHE__;
const SHELL = `madar-shell-${BUILD}`;
const RUNTIME = `madar-runtime-${BUILD}`;
const API = `madar-api-${BUILD}`;
const KEEP = new Set([SHELL, RUNTIME, API]);
/* Servers may answer with `Vary: Origin`; the page fetches module scripts,
   stylesheets and fonts in CORS mode, so match caches ignoring Vary. */
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const list = Array.isArray(PRECACHE) ? PRECACHE : ['/'];
      /* The shell is always refetched; fonts and hashed assets may come from the
         HTTP cache the page just filled (no second download on a slow link). */
      await Promise.all(
        list.map((url) =>
          cache.add(new Request(url, { cache: url === '/' ? 'reload' : 'default' })).catch(() => null),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('madar-') && !KEEP.has(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Mark a cached response so the app can show «تعمل من النسخة المحفوظة». */
function markCached(res) {
  if (!res) return res;
  const headers = new Headers(res.headers);
  headers.set('x-madar-cache', '1');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function networkFirstApi(req) {
  const cache = await caches.open(API);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => null);
    return res;
  } catch {
    const hit = await cache.match(req, MATCH);
    if (hit) return markCached(hit);
    return new Response(JSON.stringify({ error: 'لا اتصال بالخادم' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-madar-offline': '1' },
    });
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req, MATCH);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(req, res.clone()).catch(() => null);
  }
  return res;
}

async function shell(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      if (new URL(req.url).pathname === '/') {
        const cache = await caches.open(SHELL);
        cache.put('/', res.clone()).catch(() => null);
      }
      return res;
    }
    const cached = await caches.match('/', MATCH);
    return cached || res;
  } catch {
    const cached = await caches.match('/', MATCH);
    return (
      cached ||
      new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>مَدار</title><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>لا اتصال</h1><p>افتح التطبيق مرّة واحدة وأنت متّصل بالإنترنت ليُحفظ على الجهاز.</p></body></html>', {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(req));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(shell(req));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
