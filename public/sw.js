/*
 * MiCasa service worker.
 * Caches only static, immutable assets and the offline page. Authenticated
 * HTML and /api responses are never cached: financial data must stay live.
 * Registered as /sw.js?v=<commit sha>; a new deploy installs a new worker.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `micasa-static-${VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/brand/mark-160.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const NEXT_STATIC_ASSET = /\/_next\/static\/[^"'\s)]+\.(?:css|js|woff2)/g;

/** Cache /offline plus the CSS/JS/fonts it references so it renders offline. */
const precacheOfflinePage = async (cache) => {
  const response = await fetch(OFFLINE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Offline page failed: ${response.status}`);
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = [...new Set(html.match(NEXT_STATIC_ASSET) ?? [])];
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => undefined)));
};

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/brand/') ||
  url.pathname.startsWith('/splash/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([cache.addAll(PRECACHE_URLS), precacheOfflinePage(cache)]),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('micasa-static-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      // Start navigation requests in parallel with worker boot (cold launches).
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

const networkWithOfflineFallback = async (event) => {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkWithOfflineFallback(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
