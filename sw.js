const CACHE_NAME = 'billsplit-pro-v1';

// Jo assets local hain aur foran cache hone chahiye
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dp/icon-192x192.png',
  '/dp/icon-512x512.png'
];

// Install Event: Assets ko precache karna
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Pre-caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Purane caches ko saaf karna
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network First Strategy (Utility SaaS platforms ke liye best)
self.addEventListener('fetch', event => {
  // Sirf GET requests ko handle karna hai (baki API calls standard chalengi)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Agar network response sahi hai, toh uski copy cache mein save karlo
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Agar network down hai (Offline mode), toh cache se file uthao
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Agar cache mein bhi nahi hai (maslan koi naya page), toh fallback return karo
          return new Response('Offline: Connection lost and resource not cached.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});
