// Goal Crusher service worker. Bump CACHE_VERSION with every release (matches version.json).
const CACHE_VERSION = 'goal-crusher-1.3.0';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Safari refuses redirected responses for navigations; rebuild them as plain responses.
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('/version.json')) return; // always network
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await clean(await fetch(req, { cache: 'no-store' }));
        if (res.ok) { const c = await caches.open(CACHE_VERSION); c.put('./index.html', res.clone()); }
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    const net = fetch(req).then(async (res) => {
      if (res && !res.redirected && (res.ok || res.type === 'opaque')) { const c = await caches.open(CACHE_VERSION); c.put(req, res.clone()); }
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
