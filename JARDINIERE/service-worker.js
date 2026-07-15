const CACHE_NAME = 'jardiniere-pwa-v143';
const APP_SHELL = [
  './Logiciel%20jardiniere.html',
  './styles.css',
  './js/00-state-config.js',
  './js/01-construction-core.js',
  './js/02-ui-layout-init.js',
  './js/03-plan2d.js',
  './js/04-scene3d-horizon.js',
  './js/05-storage-project.js',
  './js/06-architecture-solar.js',
  './js/07-jardinieres-ui.js',
  './js/08-placement-objects.js',
  './js/09-jardiniere-rendering.js',
  './js/10-devis-chantier.js',
  './js/11-boot.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if(event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if(response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if(cached) return cached;
        if(event.request.mode === 'navigate') {
          return caches.match('./Logiciel%20jardiniere.html');
        }
        return undefined;
      }))
  );
});
