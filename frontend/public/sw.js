/* Service worker Game Club.
   Стратегия: API — только сеть (данные всегда свежие);
   статика — сеть с фолбэком в кэш (чтобы оболочка открывалась быстро и переживала обрывы). */
const CACHE = 'gameclub-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API всегда из сети — никакого кэша для данных
  if (url.pathname.startsWith('/api/')) return;

  // Статика: сеть → кэш → (для навигации) корень из кэша
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return resp;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached ?? (event.request.mode === 'navigate' ? caches.match('/') : undefined),
        ),
      ),
  );
});
