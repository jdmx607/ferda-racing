// FERDA Racing League — Service Worker
//
// Offline strategy:
//   • App shell (index.html + manifest + icons) is pre-cached on install.
//   • Page navigations: network-first, falling back to the cached shell — so the
//     installed app always opens, even with no signal.
//   • Built JS/CSS (/assets/*, content-hashed) + icons + fonts: cache-first with
//     background refresh — the rules, history and stats screens ship in these
//     bundles, so they work offline once visited.
//   • League data comes from Firestore's own offline cache (see src/firebase.js);
//     Firebase / NASCAR / API calls are never served from this cache.

const CACHE_NAME = 'ferda-racing-v3';   // bump to force clients onto a fresh shell
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .catch(err => console.warn('SW: shell pre-cache incomplete:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

const NETWORK_ONLY_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'cf.nascar.com',
  'api.emailjs.com',
];

function putInCache(request, response) {
  if (response && response.ok && response.type !== 'opaqueredirect') {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Live data / APIs: always network (Firestore has its own offline cache)
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h)) || (url.origin === self.location.origin && url.pathname.startsWith('/api'))) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // App navigations: network-first, cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => putInCache('/index.html', res))
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Static assets (hashed bundles, icons, fonts): cache-first, refresh in background
  const isStatic = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')
    || /\.(js|css|png|jpg|svg|ico|webp|woff2?|ttf)$/.test(url.pathname)
    || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com');
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(res => putInCache(request, res)).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else: network, cache fallback
  event.respondWith(fetch(request).then(res => putInCache(request, res)).catch(() => caches.match(request)));
});

// Push notifications (draft turn etc. — sent by /api/push)
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'FERDA Racing';
  const options = {
    body: data.body || data.message || "It's your turn to pick!",
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — focus an open app window or open one
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
