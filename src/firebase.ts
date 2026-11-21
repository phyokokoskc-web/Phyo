import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  setPersistence,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const ADMIN_EMAIL = 'phyokoko.ctd@gmail.com';

const app = initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type { ConfirmationResult };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function normalizePhoneE164(raw: string): string {
  const stripped = raw.trim().replace(/[\s\-()]/g, '');
  let e164 = '';
  if (stripped.startsWith('+')) {
    e164 = `+${stripped.slice(1).replace(/\D/g, '')}`;
  } else {
    const digits = stripped.replace(/\D/g, '');
    if (digits.startsWith('09') && digits.length >= 9 && digits.length <= 12) {
      e164 = `+95${digits.slice(1)}`;
    } else if (digits.startsWith('959') && digits.length >= 10 && digits.length <= 13) {
      e164 = `+${digits}`;
    } else if (digits.startsWith('9') && digits.length >= 8 && digits.length <= 11) {
      e164 = `+95${digits}`;
    } else {
      e164 = `+${digits}`;
    }
  }
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new Error('INVALID_PHONE');
  }
  return e164;
}

const recaptchaInstances = new Map<string, RecaptchaVerifier>();

export function clearPhoneRecaptcha(containerId: string) {
  const existing = recaptchaInstances.get(containerId);
  if (existing) {
    try {
      existing.clear();
    } catch {
      // Ignore cleanup error if DOM already unmounted
    }
    recaptchaInstances.delete(containerId);
  }
  if (typeof document !== 'undefined') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }
}

export async function sendPhoneSmsCode(
  phoneInput: string,
  containerId: string,
  lang: 'en' | 'mm' = 'en'
): Promise<{ confirmationResult: ConfirmationResult; normalizedPhone: string }> {
  const normalizedPhone = normalizePhoneE164(phoneInput);
  clearPhoneRecaptcha(containerId);
  const containerEl = document.getElementById(containerId);
  if (!containerEl) {
    throw new Error('RECAPTCHA_CONTAINER_MISSING');
  }
  auth.languageCode = lang === 'mm' ? 'my' : 'en';
  const verifier = new RecaptchaVerifier(auth, containerEl, {
    size: 'invisible',
  });
  recaptchaInstances.set(containerId, verifier);
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
    return { confirmationResult, normalizedPhone };
  } catch (err) {
    clearPhoneRecaptcha(containerId);
    throw err;
  }
}

export async function verifyPhoneSmsCode(
  confirmationResult: ConfirmationResult,
  code: string,
  fullName?: string
) {
  const cleanCode = code.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('INVALID_OTP_CODE');
  }
  const cred = await confirmationResult.confirm(cleanCode);
  if (fullName?.trim()) {
    await updateProfile(cred.user, { displayName: fullName.trim() }).catch(() => undefined);
  }
  return cred;
}

export async function signOutUser() {
  return signOut(auth);
}

export function isAdminEmail(email?: string | null, emailVerified?: boolean): boolean {
  return Boolean(emailVerified && email && email.toLowerCase() === ADMIN_EMAIL);
}
