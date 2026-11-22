const VERSION = 'aq-v4';
const APP_PATH = '/static/app/';
const SHELL = [
  '/',
  '/manifest.json',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/logo.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)));
    const response = await fetch('/', { cache: 'reload' }).catch(() => null);
    if (response?.ok) {
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => new URL(match[1], self.location.origin).href);
      await Promise.all(assets.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)));
      await cache.put('/', response);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('aq-') && key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/') || url.pathname === '/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && sameOrigin && url.pathname === '/') {
        const copy = response.clone();
        void caches.open(VERSION).then(cache => cache.put('/', copy));
      }
      return response;
    }).catch(async () => (await caches.match('/')) ?? Response.error()));
    return;
  }

  if (sameOrigin && (url.pathname.startsWith('/static/') || url.pathname === '/manifest.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response.ok) void cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(network.then(() => undefined));
        return cached;
      }
      return (await network) ?? Response.error();
    })());
  }
});
