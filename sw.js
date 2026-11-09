/* Service worker: la app abre al instante desde el caché y se actualiza en segundo plano. */
const CACHE = 'avance-v1.2';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function tellClients(msg) {
  const all = await self.clients.matchAll({ includeUncontrolled: true });
  all.forEach((c) => c.postMessage(msg));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isNav = req.mode === 'navigate';
  const key = isNav ? 'index.html' : req;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req).catch(() => null);

    const refresh = network.then(async (res) => {
      if (!res || !res.ok) return;
      if (isNav && cached) {
        const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
        if (a !== b) { await cache.put(key, res.clone()); await tellClients({ type: 'updated' }); }
      } else {
        await cache.put(key, res.clone());
      }
    }).catch(() => {});
    e.waitUntil(refresh);

    if (cached) return cached;
    const res = await network;
    return res || new Response('Sin conexión y sin copia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
