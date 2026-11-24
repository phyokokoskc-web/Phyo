import firebaseConfig from './firebase-applet-config.json';
import {
  sendWebPushMessage,
  verifyFirebaseAdminToken,
  type PushNotificationPayload,
  type PushSubscriptionInput,
} from './shared/webPush';

interface WorkerEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const ADMIN_EMAIL = 'phyokoko.ctd@gmail.com';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/push/public-key' && request.method === 'GET') {
      const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
      const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
      return jsonResponse({
        configured: Boolean(publicKey && privateKey),
        publicKey: publicKey || null,
      });
    }

    if (url.pathname === '/api/push/send' && request.method === 'POST') {
      const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
      const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
      const subject = (env.VAPID_SUBJECT || `mailto:${ADMIN_EMAIL}`).trim();

      if (!publicKey || !privateKey) {
        return jsonResponse({
          ok: false,
          configured: false,
          sent: 0,
          failed: 0,
          expiredIds: [],
        });
      }

      const authHeader = request.headers.get('Authorization') || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const verifiedAdmin = await verifyFirebaseAdminToken(
        idToken,
        firebaseConfig.projectId,
        ADMIN_EMAIL
      );
      if (!verifiedAdmin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }

      let body: {
        subscriptions?: PushSubscriptionInput[];
        payload?: PushNotificationPayload;
      } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400);
      }

      const subs = Array.isArray(body.subscriptions) ? body.subscriptions.slice(0, 200) : [];
      const rawPayload = body.payload;
      if (!rawPayload || !rawPayload.title || !rawPayload.body) {
        return jsonResponse({ error: 'Notification title and body are required' }, 400);
      }

      const cleanPayload: PushNotificationPayload = {
        title: String(rawPayload.title).slice(0, 140),
        body: String(rawPayload.body).slice(0, 600),
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: rawPayload.tag ? String(rawPayload.tag).slice(0, 120) : `shoptopia-${Date.now()}`,
        actionTarget: rawPayload.actionTarget ? String(rawPayload.actionTarget).slice(0, 120) : 'none',
        notifId: rawPayload.notifId ? String(rawPayload.notifId).slice(0, 128) : '',
        url: rawPayload.url ? String(rawPayload.url).slice(0, 240) : '/',
      };

      const validSubs = subs.filter(
        (s) =>
          s &&
          typeof s.id === 'string' &&
          typeof s.endpoint === 'string' &&
          s.endpoint.startsWith('https://') &&
          typeof s.p256dh === 'string' &&
          typeof s.auth === 'string'
      );

      const results = await Promise.all(
        validSubs.map(async (sub) => {
          const res = await sendWebPushMessage(sub, cleanPayload, {
            publicKey,
            privateKey,
            subject,
          });
          return { id: sub.id, ...res };
        })
      );

      const sent = results.filter((r) => r.ok).length;
      const expiredIds = results.filter((r) => r.expired).map((r) => r.id);
      const failed = results.filter((r) => !r.ok).length;

      return jsonResponse({
        ok: true,
        configured: true,
        sent,
        failed,
        expiredIds,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
