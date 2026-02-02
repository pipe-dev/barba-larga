// This is a minimal service worker file required for PWA installation.
// It doesn't perform any caching or offline functionality.

self.addEventListener('install', (event) => {
  // Perform install steps
  console.log('Service Worker: Installing...');
  // Skip waiting to activate the new service worker immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Perform activate steps
  console.log('Service Worker: Activating...');
  // Take control of all pages under this service worker's scope immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // This service worker doesn't intercept any fetch requests.
  // It simply lets the browser handle them as it normally would.
  // This is because we don't need offline functionality for this app.
  return;
});
