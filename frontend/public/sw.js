// Keeps the app usable offline: pages and data are network-first with a cached fallback,
// hashed bundles in assets/ are cache-first. Bump VERSION to drop old caches.
const VERSION = 'v1';
const CACHE = `pharmreach-${VERSION}`;
const scope = new URL(self.registration.scope);
const shell = ['./', 'manifest.json', 'favicon.svg', 'logo.svg', 'icons/icon-192.png', 'icons/icon-512.png']
  .map((path) => new URL(path, scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('pharmreach-') && key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await cache.match(new URL('./', scope).href);
      if (home) return home;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Live API answers (routes, prices, locations searched) are never served stale.
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.href.startsWith(scope.href) || url.pathname.includes('/api/')) return;
  event.respondWith(url.pathname.includes('/assets/') ? cacheFirst(request) : networkFirst(request));
});
