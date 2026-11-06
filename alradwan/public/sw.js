// Keeps the app available without internet: the whole shell is cached the moment the worker installs,
// each build has its own cache (the old one is dropped), and a new version takes over on the next load.
const BUILD = '__BUILD__'
const CACHE = 'alradwan-' + BUILD
const PRECACHE = __PRECACHE__
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))).catch(() => {})).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.pathname.includes('/api/') || url.origin !== location.origin) return
  const isPage = req.mode === 'navigate' || req.destination === 'document'
  if (isPage) {
    // the page itself: network first, cache when offline
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)) } return r }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))))
    return
  }
  // everything else (hashed assets, icons): cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)) } return r })))
})
