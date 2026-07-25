// Same Sky — service worker.
//
// Two jobs:
//  1. Always try the network first, so a fix reaches both phones on the next open
//     instead of hours later when a cache happens to expire.
//  2. Keep the last good copy, so the app still opens on a train with no signal.

const CACHE = 'same-sky-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // Supabase, tiles, fonts: untouched

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      // Offline and never seen: fall back to the app shell so it still opens.
      return (await caches.match('./index.html')) || Response.error();
    }
  })());
});
