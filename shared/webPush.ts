// Pure Web Crypto RFC 8291 (aes128gcm) + VAPID ES256 Web Push & Firebase ID Token verifier.
// Runs identically in Node.js 22+ (Express server.ts) and Cloudflare Workers V8 (worker.ts).

export interface PushSubscriptionInput {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  actionTarget?: string;
  notifId?: string;
  url?: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const clean = str.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function hmacSha256(
  keyBytes: Uint8Array<ArrayBuffer>,
  dataBytes: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

export async function generateVapidKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) {
    throw new Error('Failed to export generated VAPID JWK');
  }
  const xBytes = base64UrlDecode(jwk.x);
  const yBytes = base64UrlDecode(jwk.y);
  const pubRaw = concatBytes(new Uint8Array([0x04]), xBytes, yBytes);
  return {
    publicKey: base64UrlEncode(pubRaw),
    privateKey: jwk.d,
  };
}

async function importVapidPrivateKey(publicKeyB64: string, privateKeyB64: string): Promise<CryptoKey> {
  const pubBytes = base64UrlDecode(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID public key (expected 65-byte uncompressed P-256 point)');
  }
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: privateKeyB64.trim(),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function createVapidAuthHeader(
  endpoint: string,
  vapid: VapidConfig
): Promise<string> {
  const origin = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const headerB64 = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const payloadB64 = base64UrlEncode(
    textEncoder.encode(
      JSON.stringify({
        aud: origin,
        exp,
        sub: vapid.subject,
      })
    )
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importVapidPrivateKey(vapid.publicKey, vapid.privateKey);
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    textEncoder.encode(signingInput)
  );
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(sigBuf))}`;
  return `vapid t=${jwt}, k=${vapid.publicKey.trim()}`;
}

export async function encryptWebPushPayload(
  p256dhB64: string,
  authB64: string,
  plaintextBytes: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublicBytes = base64UrlDecode(p256dhB64);
  const authSecret = base64UrlDecode(authB64);
  if (uaPublicBytes.length !== 65 || uaPublicBytes[0] !== 0x04) {
    throw new Error('Invalid subscriber p256dh public key');
  }
  if (authSecret.length < 16) {
    throw new Error('Invalid subscriber auth secret');
  }

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const asPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      ephemeral.privateKey,
      256
    )
  );

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // RFC 8291 Section 3.3
  const prkKey = await hmacSha256(authSecret, ecdhSecret);
  const keyInfo = concatBytes(
    textEncoder.encode('WebPush: info\x00'),
    uaPublicBytes,
    asPublicRaw
  );
  const ikm = await hmacSha256(prkKey, concatBytes(keyInfo, new Uint8Array([0x01])));

  const prk = await hmacSha256(salt, ikm);
  const cekFull = await hmacSha256(
    prk,
    concatBytes(textEncoder.encode('Content-Encoding: aes128gcm\x00'), new Uint8Array([0x01]))
  );
  const nonceFull = await hmacSha256(
    prk,
    concatBytes(textEncoder.encode('Content-Encoding: nonce\x00'), new Uint8Array([0x01]))
  );
  const cek = cekFull.slice(0, 16);
  const nonce = nonceFull.slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const paddedPlaintext = concatBytes(plaintextBytes, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      paddedPlaintext
    )
  );

  const rsBuf = new Uint8Array(4);
  new DataView(rsBuf.buffer).setUint32(0, 4096, false);

  return concatBytes(
    salt,
    rsBuf,
    new Uint8Array([asPublicRaw.length]),
    asPublicRaw,
    ciphertext
  );
}

export async function sendWebPushMessage(
  sub: PushSubscriptionInput,
  payload: PushNotificationPayload,
  vapid: VapidConfig
): Promise<{ ok: boolean; status: number; expired: boolean; error?: string }> {
  try {
    const authHeader = await createVapidAuthHeader(sub.endpoint, vapid);
    const plaintext = textEncoder.encode(JSON.stringify(payload));
    const body = await encryptWebPushPayload(sub.p256dh, sub.auth, plaintext);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'high',
      },
      body: body.buffer,
    });

    if (res.ok || res.status === 201 || res.status === 202) {
      return { ok: true, status: res.status, expired: false };
    }
    const expired = res.status === 404 || res.status === 410;
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      expired,
      error: errText.slice(0, 200) || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// --- Firebase ID Token RS256 Verification via Google Public JWKS ---
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let cachedJwks: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

async function fetchGoogleJwks(): Promise<JsonWebKey[]> {
  if (cachedJwks && Date.now() - cachedJwks.fetchedAt < 3600_000) {
    return cachedJwks.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase JWKS');
  }
  const data = (await res.json()) as { keys?: JsonWebKey[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  cachedJwks = { keys, fetchedAt: Date.now() };
  return keys;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export async function verifyFirebaseAdminToken(
  token: string,
  expectedProjectId: string,
  expectedAdminEmail: string
): Promise<VerifiedFirebaseToken | null> {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(textDecoder.decode(base64UrlDecode(headerB64))) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;

    const claims = JSON.parse(textDecoder.decode(base64UrlDecode(payloadB64))) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== expectedProjectId) return null;
    if (claims.iss !== `https://securetoken.google.com/${expectedProjectId}`) return null;
    if (!claims.sub || typeof claims.sub !== 'string') return null;
    if (!claims.exp || claims.exp <= now) return null;
    if (claims.iat && claims.iat > now + 300) return null;
    if (!claims.email_verified || claims.email?.toLowerCase() !== expectedAdminEmail.toLowerCase()) {
      return null;
    }

    const keys = await fetchGoogleJwks();
    const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return null;

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      base64UrlDecode(sigB64),
      textEncoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!verified) return null;

    return {
      uid: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified,
    };
  } catch {
    return null;
  }
}
