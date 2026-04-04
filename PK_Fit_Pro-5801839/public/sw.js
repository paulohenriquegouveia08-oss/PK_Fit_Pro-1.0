const CACHE_NAME = 'pk-fit-pro-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/favicon.jpg',
    '/manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and API calls
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Skip external requests and API calls
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith('/api')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response before caching
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // If not in cache and offline, return the cached index.html for navigation
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// ─── Workout Notification Click Handler ─────────────────
// When user taps the notification or "Voltar ao Treino" action
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Find any existing client
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // If none, open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

// ─── Web Push Handler ────────────────────────────────────
// The server (Netlify Function) sends the real push notification.
// This handler just displays it.
self.addEventListener('push', (event) => {
    let data = {
        title: '🔔 Descanso Finalizado!',
        body: 'Hora de voltar para a próxima série! 💪',
        icon: '/favicon.jpg',
        vibrate: [300, 200, 300, 200, 300],
        actions: [{ action: 'open', title: '💪 Voltar ao Treino' }]
    };

    try {
        if (event.data) {
            data = { ...data, ...event.data.json() };
        }
    } catch (_e) { /* use defaults */ }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            vibrate: data.vibrate,
            requireInteraction: true,
            tag: 'pk-rest-complete',
            actions: data.actions || []
        })
    );
});

// ─── Message handler (for clearing notifications when user returns) ───
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
        event.waitUntil(
            self.registration.getNotifications().then(notifications => {
                notifications.forEach(n => n.close());
            })
        );
    }
});
