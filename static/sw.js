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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          return fetch(new Request(url, { mode: 'no-cors', credentials: 'omit' }))
            .then((response) => {
              return cache.put(url, response);
            })
            .catch((err) => console.error('Gagal pre-cache:', url, err));
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin) {
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
            return caches.match(event.request, { ignoreSearch: true }).then((response) => {
              if (response) return response;
              return caches.match('/offline/')
              .then((res) => res || caches.match('/offline/index.html'))
              .then((res) => res || caches.match('/'));
            });
          })
      );
    } else {
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
