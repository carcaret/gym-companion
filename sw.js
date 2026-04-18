const CACHE_NAME = 'gym-companion-v4';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './src/constants.js',
  './src/dates.js',
  './src/metrics.js',
  './src/formatting.js',
  './src/data.js',
  './src/workout.js',
  './src/log-mutations.js',
  './src/history.js',
  './src/github.js',
  './src/charts.js',
  './db.json',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.github.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Network-First Strategy
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
