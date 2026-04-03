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

// ─── Background Rest Timer Logic ────────────────────────
// ─── Background Rest Timer Logic ────────────────────────
let countdownInterval;
let stopTimerResolve = null;

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'START_REST_TIMER') {
        const targetTime = event.data.targetTime;
        const exerciseName = event.data.exerciseName;

        if (countdownInterval) clearInterval(countdownInterval);
        if (stopTimerResolve) stopTimerResolve();

        // Use event.waitUntil to prevent the browser from killing the Service Worker!
        event.waitUntil(
            new Promise((resolve) => {
                stopTimerResolve = resolve;

                countdownInterval = setInterval(async () => {
                    const rem = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));

                    // Show countdown every 5 seconds
                    if (rem > 0 && rem % 5 === 0) {
                        const mins = Math.floor(rem / 60);
                        const secs = rem % 60;
                        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                        await self.registration.showNotification('⏱️ Descanso em andamento', {
                            body: `${timeStr} restantes — ${exerciseName}`,
                            tag: 'pk-rest-timer', // keep same tag to replace
                            icon: '/favicon.jpg',
                            silent: true
                        });
                    }

                    // Show final alarm and clear interval
                    if (rem <= 0) {
                        clearInterval(countdownInterval);

                        // Close the countdown notification before showing the final one
                        const activeNotes = await self.registration.getNotifications({ tag: 'pk-rest-timer' });
                        activeNotes.forEach(n => n.close());

                        await self.registration.showNotification('🔔 Descanso Finalizado!', {
                            body: 'Hora de voltar para a próxima série! 💪',
                            tag: 'pk-rest-complete',
                            icon: '/favicon.jpg',
                            vibrate: [300, 200, 300, 200, 300, 200, 300, 200, 300],
                            requireInteraction: true,
                            actions: [
                                { action: 'open', title: '💪 Voltar ao Treino' }
                            ]
                        });

                        // Resolve the promise to allow the Service Worker to sleep again
                        resolve();
                    }
                }, 1000);
            })
        );
    }
    else if (event.data && event.data.type === 'STOP_REST_TIMER') {
        if (countdownInterval) clearInterval(countdownInterval);

        // Clear all active tracking notifications and resolve promise
        event.waitUntil(
            self.registration.getNotifications().then(notifications => {
                notifications.forEach(n => n.close());
                if (stopTimerResolve) {
                    stopTimerResolve();
                    stopTimerResolve = null;
                }
            })
        );
    }
});
