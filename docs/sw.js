/* Earworm Log: offline shell. Same-origin files load from the cache first and refresh in the background. */
const VERSION = 'earworm-log-v1.0.0';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'logic.js', 'i18n.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2', 'fonts/sarabun-th-400.woff2', 'fonts/sarabun-th-600.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const refresh = fetch(req).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; });
    if (hit) { refresh.catch(() => {}); return hit; }
    try { return await refresh; } catch (err) { return (await c.match('index.html')) || Response.error(); }
  }));
});
