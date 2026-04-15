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
 * This implements Firebase's internal _Persistence interface (type-asserted
 * via `as unknown as Persistence` because the interface is not exported).
 * Firebase's getReactNativePersistence was removed in SDK 12 — this is the
 * recommended replacement pattern for bare Expo projects.
 */
const SecureStorePersistence = {
  type: 'LOCAL' as Persistence['type'],

  async _isAvailable(): Promise<boolean> {
    try {
      const TEST_KEY = '__sr_firebase_availability_test__';
      await SecureStore.setItemAsync(TEST_KEY, '1');
      await SecureStore.deleteItemAsync(TEST_KEY);
      return true;
    } catch {
      return false;
    }
  },

  async _set(key: string, value: string): Promise<void> {
    // WHEN_UNLOCKED_THIS_DEVICE_ONLY: tokens cannot migrate to a new device
    // via iCloud Keychain backup — appropriate for auth credentials.
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async _get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async _remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },

  // Firebase calls these for cross-tab sync in browsers — no-op on mobile.
  _addListener(_key: string, _listener: () => void): void {},
  _removeListener(_key: string, _listener: () => void): void {},
} as unknown as Persistence;

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
  ? initializeAuth(app, { persistence: SecureStorePersistence })
  : getAuth(app);

export const db   = getFirestore(app);
export const rtdb = getDatabase(app);
