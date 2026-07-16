// Service Worker dedicado para Push Notifications (escopo global /)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  let data = { title: 'Carreira ID', body: 'Você tem uma nova notificação' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/carreira-icon-512.png',
    badge: '/carreira-icon-512.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    renotify: true,
    data: {
      url: data.url || '/feed',
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'Carreira ID', options);
      // Numero no icone do app (Badging API) -- conta notificacoes ainda nao vistas.
      if ('setAppBadge' in navigator) {
        try {
          const notifications = await self.registration.getNotifications();
          await navigator.setAppBadge(notifications.length);
        } catch (e) { /* Badging API pode nao estar disponivel neste navegador/SO */ }
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/feed';

  event.waitUntil(
    (async () => {
      // Atualiza o numero do badge (ou limpa, se nao sobrou nenhuma notificacao).
      if ('setAppBadge' in navigator) {
        try {
          const remaining = await self.registration.getNotifications();
          if (remaining.length > 0) {
            await navigator.setAppBadge(remaining.length);
          } else if ('clearAppBadge' in navigator) {
            await navigator.clearAppBadge();
          }
        } catch (e) { /* Badging API pode nao estar disponivel */ }
      }

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
