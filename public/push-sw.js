/* แจ้งเตือน Web Push (ถูก importScripts เข้า service worker ที่ vite-plugin-pwa สร้าง) */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Brain Gym', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Brain Gym', {
      body: data.body || '',
      icon: '/pwa-192.png',
      badge: '/favicon-32.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          return c.focus().then(() => c.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
