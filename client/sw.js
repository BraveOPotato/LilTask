// ════════════════════════════════════════════════════════════
// LilTask — Service Worker
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'liltask-v1.2.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/crdt.mjs',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ─── Install: cache static shell ─────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: purge old caches ──────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ──────────────────────────────────────
// Static assets  → cache-first
// Cloudflare Worker sync calls → network-only (never cache)
// Everything else → network-first, fallback to cache

function isCacheable(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-only: sync worker + non-GET
  if (
    url.hostname.endsWith('workers.dev') ||
    e.request.method !== 'GET'
  ) {
    return; // let browser handle normally
  }

  // Skip non-cacheable schemes (chrome-extension://, etc.)
  if (!isCacheable(e.request)) return;

  // Cache-first: own static assets
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname === '/') {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Network-first: everything else
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
