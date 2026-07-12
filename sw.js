/* ================================================================
   RoadBuddy — Service Worker (PWA)
   File: sw.js  (must live at the root of the project)
   ----------------------------------------------------------------
   Strategy:
     Static assets (CSS/JS/fonts) → Cache-first
     API calls (/api/*)           → Network-first, no cache
     HTML pages                   → Network-first, offline fallback
     Leaflet tiles                → Cache-first (maps work offline)
   ================================================================ */

const CACHE_VERSION  = 'roadbuddy-v1';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const TILE_CACHE     = `${CACHE_VERSION}-tiles`;

/* Assets to pre-cache on install */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard-motorist.html',
  '/dashboard-provider.html',
  '/dashboard-admin.html',
  '/pricing.html',
  '/css/styles.css',
  '/css/admin.css',
  '/css/messaging.css',
  '/css/map.css',
  '/css/ratings.css',
  '/css/admin-sections.css',
  '/js/main.js',
  '/js/api.js',
  '/js/messaging.js',
  '/js/map.js',
  '/js/ratings.js',
  '/js/admin-sections.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

/* ── Install: pre-cache all static assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS.filter(u => !u.startsWith('https://fonts'))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache warning:', err))
  );
});

/* ── Activate: remove old cache versions ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('roadbuddy-') && k !== STATIC_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: route-based caching strategy ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET, chrome-extension, and data URLs */
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  /* API calls → network-only (never cache auth/data) */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  /* Map tiles → cache-first (allows offline map viewing) */
  if (url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('cartocdn.com')) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  /* Everything else → network-first with offline fallback */
  event.respondWith(networkFirst(request));
});

/* ── Strategies ── */

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ message: 'You are offline. Please check your connection.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    /* Offline fallback for HTML navigation */
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }

    return new Response(
      '<h1 style="font-family:sans-serif;text-align:center;padding:3rem;">You are offline. Please check your connection.</h1>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/* ── Listen for skip-waiting message from frontend ── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
