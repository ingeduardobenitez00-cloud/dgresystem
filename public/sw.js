/**
 * Service Worker para funcionamiento fuera de línea de la aplicación DGREC
 */

const CACHE_NAME = 'dgrec-offline-cache-v2';
const OFFLINE_URLS = [
  '/manifest.json',
  '/logo1.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('Advertencia en precache offline:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // No interceptar nunca chunks de Next.js (/_next/), entorno local (localhost), APIs ni Firebase
  if (
    url.includes('/_next/') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('/api/') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
      return Response.error();
    })
  );
});
