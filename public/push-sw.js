// Service Worker Web Push & OS Notification Bar Handler
// Imported by the VitePWA Workbox Service Worker so background push alerts
// appear in the device notification bar even when the storefront is closed.

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Shoptopia',
    body: 'New update from the store.',
    icon: '/pwa-192x192.png',
    badge: '/notif-badge-96x96.png',
    tag: 'shoptopia-alert',
    actionTarget: 'none',
    notifId: '',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          ...payload,
          title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : payload.title,
          body: typeof parsed.body === 'string' && parsed.body.trim() ? parsed.body.trim() : payload.body,
          icon: typeof parsed.icon === 'string' && parsed.icon ? parsed.icon : payload.icon,
          badge: typeof parsed.badge === 'string' && parsed.badge ? parsed.badge : payload.badge,
          tag: typeof parsed.tag === 'string' && parsed.tag ? parsed.tag : payload.tag,
          actionTarget: typeof parsed.actionTarget === 'string' ? parsed.actionTarget : 'none',
          notifId: typeof parsed.notifId === 'string' ? parsed.notifId : '',
          url: typeof parsed.url === 'string' && parsed.url ? parsed.url : '/',
        };
      }
    } catch {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    vibrate: [180, 90, 180],
    requireInteraction: false,
    data: {
      url: payload.url,
      actionTarget: payload.actionTarget,
      notifId: payload.notifId,
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const actionTarget = typeof data.actionTarget === 'string' ? data.actionTarget : 'none';
  let targetUrl = typeof data.url === 'string' && data.url ? data.url : '/';

  if (actionTarget === 'orders') {
    targetUrl = '/orders';
  } else if (actionTarget === 'chat') {
    targetUrl = '/?openChat=1';
  } else if (actionTarget && actionTarget.startsWith('category:')) {
    targetUrl = `/?category=${encodeURIComponent(actionTarget.slice('category:'.length))}`;
  } else if (actionTarget === 'shop') {
    targetUrl = '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            actionTarget,
            notifId: data.notifId || '',
            url: targetUrl,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'SHOW_LOCAL_NOTIFICATION' && msg.payload) {
    const p = msg.payload;
    event.waitUntil(
      self.registration.showNotification(p.title || 'Shoptopia', {
        body: p.body || '',
        icon: p.icon || '/pwa-192x192.png',
        badge: p.badge || '/notif-badge-96x96.png',
        tag: p.tag || `shoptopia-local-${Date.now()}`,
        renotify: true,
        vibrate: [180, 90, 180],
        data: {
          url: p.url || '/',
          actionTarget: p.actionTarget || 'none',
          notifId: p.notifId || '',
        },
      })
    );
  }
});
