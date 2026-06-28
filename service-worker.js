const CACHE_NAME = 'chair-timer-v8-color-picker-modal';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=color-picker-modal-1',
  './app.js?v=color-picker-modal-1',
  './manifest.json',
  './assets/antler.png',
  './assets/chair.png?v=user-chair-2',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
