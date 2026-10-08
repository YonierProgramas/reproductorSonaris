const cacheName = '__SONARIS_CACHE__';
const assets = __SONARIS_ASSETS__;
const urls = assets.map(asset => new URL(asset, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(urls)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('sonaris-shell-') && name !== cacheName).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await (await caches.open(cacheName)).match(new URL('./index.html', self.registration.scope).href)) || new Response('Sonaris no está disponible sin conexión. Vuelve a conectarte y prepara los recursos.', {headers:{'Content-Type':'text/plain;charset=utf-8'}})));
  } else if (urls.includes(url.href)) {
    // Immutable same-origin shell assets are identical across Origin request headers.
    // Development preview servers may add Vary: Origin to module/CSS responses.
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request, {ignoreVary: true})) || fetch(request)));
  }
});
