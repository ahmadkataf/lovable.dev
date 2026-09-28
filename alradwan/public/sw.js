// Keeps the app available without internet: the shell is cached on first visit; new versions replace it
// on the next visit that has a connection.
const CACHE = 'alradwan-v1'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/api/')) return
  const isPage = req.mode === 'navigate' || req.destination === 'document'
  if (isPage) {
    // the page itself: network first, cache when offline
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)); return r }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))))
    return
  }
  // everything else (hashed assets, icons): cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && new URL(req.url).origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)) } return r })))
})
