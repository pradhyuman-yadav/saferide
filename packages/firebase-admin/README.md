# @saferide/firebase-admin

Singleton wrapper around the Firebase Admin SDK. Provides a single initialisation function and lazy-access getters for the Firestore client and the Auth client. All SafeRide backend services import from this package rather than calling `firebase-admin` directly.

## Exports

### `initFirebaseAdmin()`

Initialises the Firebase Admin SDK using the service account JSON from `FIREBASE_SERVICE_ACCOUNT_JSON`. Safe to call multiple times — subsequent calls are no-ops (hot-reload safety).

**Throws** if `FIREBASE_SERVICE_ACCOUNT_JSON` is not set or is not valid JSON.

Must be called once at service startup, before any other code that calls `getDb()` or `getAdminAuth()`.

### `getDb(): Firestore`

Returns the initialised Firestore client. Throws `'Firebase Admin not initialized. Call initFirebaseAdmin() first.'` if called before `initFirebaseAdmin()`.

### `getAdminAuth(): Auth`

Returns the initialised Firebase Auth client. Throws `'Firebase Admin not initialized. Call initFirebaseAdmin() first.'` if called before `initFirebaseAdmin()`.

The Auth client is used to call `verifyIdToken(token, true)` — the `true` argument enables revocation checking (requires an extra network call to Firebase on each verification).

## Usage

Call `initFirebaseAdmin()` once at the top of your service entrypoint, before any routes or repositories are instantiated:

```ts
// src/index.ts
import './config';                           // validate env first
import { initFirebaseAdmin } from '@saferide/firebase-admin';
import { logger } from '@saferide/logger';

// Must be called before getDb() or getAdminAuth() are used anywhere
initFirebaseAdmin();

// ... rest of Express setup
```

Then use the getters anywhere in the service (repositories, middleware, services):

```ts
// src/repositories/auth.repository.ts
import { getDb } from '@saferide/firebase-admin';

export class AuthRepository {
  async findProfile(uid: string) {
    const snap = await getDb().collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  }
}
```

```ts
// packages/middleware/src/verify-jwt.ts
import { getAdminAuth, getDb } from '@saferide/firebase-admin';

const decoded = await getAdminAuth().verifyIdToken(token, true);
const snap = await getDb().collection('users').doc(decoded.uid).get();
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | Single-line JSON string of the Firebase service account private key file. Generate from Firebase Console → Project Settings → Service Accounts → Generate new private key. Convert to single line: `jq -c . service-account.json`. Never commit the raw file. |
| `FIRESTORE_EMULATOR_HOST` | No | When set (e.g., `localhost:8080`), the Firestore client connects to the local emulator instead of production. Used in local development and CI. |

## Usage in package.json

```json
"@saferide/firebase-admin": "workspace:*"
```
