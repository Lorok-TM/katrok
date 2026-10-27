const CACHE_NAME = 'katrok-pwa-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/offline',
  '/favicon.ico',
  '/author',
  '/categories',
  '/page/about',
  '/page/contact',
  '/post',
  '/archives'
];

// 1. Proses Install: Pre-cache asset utama kanthi bener (CORS biasa ben statuse 200)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          // Ambil nganggo mode standar, yen gagal nembe di-log
          return fetch(url)
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
              throw new Error(`Respons ora OK kanggo URL: ${url}`);
            })
            .catch((err) => console.error('Gagal pre-cache:', url, err));
        })
      );
    })
  );
  self.skipWaiting();
});

// 2. Proses Aktifasi: Resik-resik cache lawas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

// 3. Proses Fetch: Strategi Network First, Fallback to Cache/Offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.origin === self.location.origin) {
    // Khusus kanggo Navigasi Halaman HTML
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Pas Offline: Goleki cache sing pas, nek ra ono langsung uncalno kaca '/offline'
            return caches.match(event.request, { ignoreSearch: true }).then((response) => {
              return response || caches.match('/offline') || caches.match('/');
            });
          })
      );
    } else {
      // Kanggo Aset Liyane (CSS, JS, Gambar) - Cache First
      event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          return cachedResponse || fetch(event.request).then((netResp) => {
            if (netResp.status === 200 || netResp.type === 'opaque') {
              const respClone = netResp.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, respClone));
            }
            return netResp;
          }).catch(() => new Response('Offline asset missing', { status: 404 }));
        })
      );
    }
  }
});


self.addEventListener('push', (event) => {
  let title = 'Kabar Terbaru, Bro!';
  let options = {
    body: 'Ada artikel baru yang menarik di web. Klik untuk baca!',
    icon: 'https://katrok.vercel.app/image/192.png',
    badge: 'https://katrok.vercel.app/image/72.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now() }
  };
  if (event.data) {
    try {
      const dataJson = event.data.json();
      title = dataJson.title || title;
      options.body = dataJson.body || options.body;
      if (dataJson.icon) options.icon = dataJson.icon;
    } catch (e) {
      options.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
