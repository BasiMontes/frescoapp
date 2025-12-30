
const CACHE_NAME = 'fresco-v1.0-gold';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.3',
  'https://aistudiocdn.com/lucide-react@^0.561.0',
  'https://aistudiocdn.com/react-dom@^19.2.3/',
  'https://aistudiocdn.com/date-fns@^4.1.0'
];

// Instalación: Cacheamos lo crítico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Fresco SW: Cacheando assets críticos (Gold)...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 Fresco SW: Limpiando caché antigua...');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ESTRATEGIA 1: Cache First (Imágenes de Unsplash y Assets estáticos)
  // Queremos que las imágenes carguen instantáneamente, aunque sean de hace un rato.
  if (url.hostname.includes('unsplash.com') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          // Solo cacheamos si la respuesta es válida
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        });
      })
    );
    return;
  }

  // ESTRATEGIA 2: Network First, fallback to Cache (Todo lo demás)
  // Intentamos ir a la red para tener datos frescos. Si falla (túnel, metro), tiramos de caché.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
         // Si la red responde bien, actualizamos la caché para la próxima vez
         const responseToCache = networkResponse.clone();
         caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
         return networkResponse;
      })
      .catch(() => {
        // Si falla la red, buscamos en caché
        return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Si no hay caché y es navegación, podríamos devolver una página offline.html (opcional)
            return new Response("Estás offline y no hay datos cacheados.", { status: 503, statusText: "Offline" });
        });
      })
  );
});