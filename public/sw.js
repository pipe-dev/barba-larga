// This is a minimal service worker file required for PWA installation.
// It doesn't perform any caching or offline functionality.

// Version: 2026-09-04-v2-100-opacity-branding
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Perform activate steps
  console.log('Service Worker: Activating...');

  // Clean up old caches from previous service workers (e.g. next-pwa)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // This service worker doesn't intercept any fetch requests.
  // It simply lets the browser handle them as it normally would.
  // This is because we don't need offline functionality for this app.
  return;
});
