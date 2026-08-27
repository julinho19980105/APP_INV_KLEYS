// Service Worker básico para cumplimiento de PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Estrategia de red primero para asegurar datos frescos de Firebase
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
