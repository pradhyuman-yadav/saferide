import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth }        from 'firebase/auth';
import type { Persistence }               from 'firebase/auth';
import { getFirestore }                   from 'firebase/firestore';
import { getDatabase }                    from 'firebase/database';
import * as SecureStore                   from 'expo-secure-store';

/**
 * Custom persistence adapter backed by Expo SecureStore.
 *
 * Firebase Auth tokens (including long-lived refresh tokens) are sensitive
 * credentials. Storing them in AsyncStorage exposes them to other apps on
 * rooted/jailbroken devices. SecureStore uses the platform secure enclave
 * (iOS Keychain / Android Keystore) to protect them.
 *
 * ── Firebase Auth 12.x compatibility note ───────────────────────────────────
 * Firebase 12.x changed its internal _getInstance() helper to assert:
 *   debugAssert(typeof cls === 'function', 'Expected a class definition')
 * then instantiates it with `new cls()`.
 *
 * A plain object (typeof === 'object') throws "INTERNAL ASSERTION FAILED:
 * Expected a class definition" immediately on startup. The persistence MUST
 * be a CLASS (typeof === 'function'), not a plain object literal.
 *
 * We pass the class constructor itself (not an instance) to initializeAuth.
 * Firebase internally calls `new SecureStorePersistenceClass()` via _getInstance.
 */
class SecureStorePersistenceClass {
  static readonly type = 'LOCAL';
  readonly type        = 'LOCAL' as Persistence['type'];

  async _isAvailable(): Promise<boolean> {
    // SecureStore is always available in Expo (backed by Android Keystore /
    // iOS Keychain). No need for a test write — that triggers a slow first-time
    // Keystore initialisation on Android and blocks Firebase Auth init.
    return true;
  }

  /**
   * SecureStore only allows alphanumeric, ".", "-", "_" in keys.
   * Firebase Auth uses keys like "firebase:authUser:API_KEY:[DEFAULT]"
   * which contain ":" and other invalid characters — sanitise before storage.
   */
  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async _set(key: string, value: string): Promise<void> {
    try {
      // WHEN_UNLOCKED_THIS_DEVICE_ONLY: tokens cannot migrate to a new device
      // via iCloud Keychain backup — appropriate for auth credentials.
      await SecureStore.setItemAsync(this.sanitizeKey(key), value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (err) {
      // SecureStore failures are non-fatal — user will need to sign in again
      // on next launch. Never surface raw storage errors to the user.
      if (__DEV__) console.warn('[SecureStorePersistence] _set failed:', err);
    }
  }

  async _get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(this.sanitizeKey(key));
    } catch (err) {
      if (__DEV__) console.warn('[SecureStorePersistence] _get failed:', err);
      return null;
    }
  }

  async _remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.sanitizeKey(key));
    } catch (err) {
      if (__DEV__) console.warn('[SecureStorePersistence] _remove failed:', err);
    }
  }

  // Firebase calls these for cross-tab sync in browsers — no-op on mobile.
  _addListener(_key: string, _listener: () => void): void {}
  _removeListener(_key: string, _listener: () => void): void {}
}

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

// Prevent duplicate initialisation on hot-reload:
// initializeAuth must only be called once; subsequent reloads use getAuth.
const isNew = getApps().length === 0;
const app   = isNew ? initializeApp(firebaseConfig) : getApp();

export const auth = isNew
  ? initializeAuth(app, { persistence: SecureStorePersistenceClass as unknown as Persistence })
  : getAuth(app);

export const db   = getFirestore(app);
export const rtdb = getDatabase(app);
