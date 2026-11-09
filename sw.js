/* Journal de gym – service worker : rend le site installable et utilisable hors ligne.
   Fichiers du site : réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Les appels à l'API GitHub (données, jeton) ne passent jamais par le cache. */
const CACHE = 'jg-v4';
const CHART = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const SHELL = ['./', 'index.html', 'stats.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png', CHART];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;

  if (url.origin !== self.location.origin) {           // bibliothèque du CDN : cache d'abord
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  e.respondWith(fetch(req).then(res => {               // fichiers du site : réseau d'abord
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
