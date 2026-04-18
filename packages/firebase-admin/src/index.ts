import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { Database } from 'firebase-admin/database';

// Re-export firestore utilities so services don't need firebase-admin as a direct dep
export { FieldValue, Timestamp } from 'firebase-admin/firestore';

let _app:  admin.app.App | null = null;
let _db:   Firestore            | null = null;
let _auth: Auth                 | null = null;
let _rtdb: Database             | null = null;

export function initFirebaseAdmin(options?: { databaseURL?: string }): void {
  if (_app !== null) return; // Already initialized (hot-reload safety)

  const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  let credential: admin.credential.Credential;
  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    credential = admin.credential.cert(serviceAccount);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const appOptions: admin.AppOptions = { credential };
  if (options?.databaseURL) appOptions.databaseURL = options.databaseURL;
  _app = admin.initializeApp(appOptions);
  _db   = admin.firestore(_app);
  _auth = admin.auth(_app);

  if (options?.databaseURL) {
    _rtdb = admin.database(_app);
  }
}

export function getDb(): Firestore {
  if (_db === null) throw new Error('Firebase Admin not initialized. Call initFirebaseAdmin() first.');
  return _db;
}

export function getAdminAuth(): Auth {
  if (_auth === null) throw new Error('Firebase Admin not initialized. Call initFirebaseAdmin() first.');
  return _auth;
}

/**
 * Returns the Realtime Database instance.
 * Only available if initFirebaseAdmin() was called with a databaseURL.
 */
export function getRtdb(): Database {
  if (_rtdb === null) throw new Error('Realtime Database not initialized. Pass databaseURL to initFirebaseAdmin().');
  return _rtdb;
}
