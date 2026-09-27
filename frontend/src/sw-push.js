// Service Worker for AutoApply AI Web Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'AutoApply AI', body: event.data.text() };
    }
  }

  const title = data.title || 'AutoApply AI Match Alert';
  const options = {
    body: data.body || 'A new high-match job has been found and tailored for you.',
    icon: data.icon || '/assets/logos/08-favicon-32.svg',
    badge: data.badge || '/assets/logos/08-favicon-32.svg',
    data: data.data || { url: '/alerts' },
    vibrate: [200, 100, 200],
    tag: data.data?.notificationId || 'autoapply-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
