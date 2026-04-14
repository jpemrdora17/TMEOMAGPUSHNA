/* ==============================================
   service-worker.js — PWA Offline Support
   Caches core files for offline use
   ============================================== */

const CACHE_NAME = 'tmeo-cache-v1';

// Files to cache for offline use
const CACHE_FILES = [
  './',
  './login.html',
  './register.html',
  './admin.html',
  './staff.html',
  './enforcer.html',
  './css/global.css',
  './css/auth.css',
  './css/sidebar.css',
  './css/dashboard.css',
  './js/storage.js',
  './js/auth.js',
  './js/admin.js',
  './js/staff.js',
  './js/enforcer.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// ===== INSTALL: Cache all core files =====
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app files');
      return cache.addAll(CACHE_FILES);
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE: Clean old caches =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH: Serve from cache, fallback to network =====
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // Serve from cache
      }
      // Try network
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('./login.html');
        }
      });
    })
  );
});
