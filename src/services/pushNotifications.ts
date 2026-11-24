import type { StoreNotification } from '../types';

export interface PushPublicKeyResponse {
  configured: boolean;
  publicKey: string | null;
}

export interface BrowserPushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isServiceWorkerPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function isIOSNeedsHomeScreen(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String.trim() + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function fetchPushPublicKey(): Promise<PushPublicKeyResponse> {
  try {
    const res = await fetch('/api/push/public-key', { cache: 'no-store' });
    if (!res.ok) return { configured: false, publicKey: null };
    const data = (await res.json()) as PushPublicKeyResponse;
    return {
      configured: Boolean(data.configured && data.publicKey),
      publicKey: data.publicKey || null,
    };
  } catch {
    return { configured: false, publicKey: null };
  }
}

export async function getActiveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
    ]);
  } catch {
    return null;
  }
}

export async function subscribeBrowserToWebPush(
  vapidPublicKey: string
): Promise<BrowserPushKeys | null> {
  if (!isServiceWorkerPushSupported()) return null;
  const reg = await getActiveServiceWorkerRegistration();
  if (!reg) return null;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
  const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
  if (!subscription.endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  };
}

export async function getCurrentBrowserPushEndpoint(): Promise<string | null> {
  if (!isServiceWorkerPushSupported()) return null;
  const reg = await getActiveServiceWorkerRegistration();
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint || null;
}

export async function unsubscribeBrowserFromWebPush(): Promise<string | null> {
  if (!isServiceWorkerPushSupported()) return null;
  const reg = await getActiveServiceWorkerRegistration();
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  return endpoint;
}

/**
 * Shows an OS-level Notification Bar alert when an open/backgrounded tab receives
 * a real-time Firestore notification (while avoiding duplicate popups if Web Push already delivered it).
 */
export async function showOsNotificationBarAlert(notif: StoreNotification): Promise<void> {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') return;

  const title = notif.title || notif.senderName || 'Shoptopia';
  const body = notif.message || '';
  const tag = `shoptopia-notif-${notif.id}`;

  const reg = await getActiveServiceWorkerRegistration();
  if (reg && 'showNotification' in reg) {
    try {
      await reg.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        data: {
          url: '/',
          actionTarget: notif.actionTarget || 'none',
          notifId: notif.id,
        },
      });
      return;
    } catch {
      // Fallback to window Notification below
    }
  }

  try {
    const n = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some mobile browsers require ServiceWorkerRegistration.showNotification
  }
}
