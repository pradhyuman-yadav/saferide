# auth-service

Handles user identity for all SafeRide clients — web admin, mobile app, and future services. Owns invite claiming and user profile reads. Does NOT own tenant management (that is tenant-service).

## Responsibility

- Verify Firebase ID tokens and provision Firestore user profiles from pending invites
- Serve authenticated user profile (`/me`)
- Does NOT create or manage tenants — that is `tenant-service`
- Does NOT issue JWTs — Firebase Auth handles that

## Local Development

```bash
# From repo root
pnpm install

# Copy and fill in environment variables (must be in auth-service/.env)
cp auth-service/.env.example auth-service/.env
# Edit auth-service/.env — fill in FIREBASE_SERVICE_ACCOUNT_JSON as a single-line JSON string

# Run with hot reload (from the service directory)
cd auth-service && pnpm dev
# or from root:
pnpm dev --filter saferide-auth-service

# Run tests
pnpm test --filter saferide-auth-service

# Watch mode
pnpm test:watch --filter saferide-auth-service

# Type check
pnpm typecheck --filter saferide-auth-service
```

The service starts on `http://localhost:4001` by default.

To use the Firebase emulator locally, set `FIRESTORE_EMULATOR_HOST=localhost:8080` and start the emulator with `firebase emulators:start`.

## Environment Variables

The service validates all variables at startup via Zod. It crashes immediately if any required variable is missing or invalid.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment. Accepts `development`, `production`, `test`. Controls Pino pretty-printing. |
| `PORT` | No | `4001` | TCP port the HTTP server listens on. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | — | Firebase service account key as **single-line JSON** (no newlines). Download from Firebase Console → Project Settings → Service Accounts → Generate new private key. Flatten with: `jq -c . service-account.json`. In production, store in AWS Secrets Manager. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed CORS origins. Example: `https://admin.saferide.in`. |
| `LOG_LEVEL` | No | `info` | Pino log level. Accepts `trace`, `debug`, `info`, `warn`, `error`. |

## API Reference

Base path: `/api/v1/auth`

All responses follow the envelope:
```json
// Success
{ "success": true, "data": { ... } }
// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message." } }
```

---

### `GET /health`

Health check. No authentication required.

**Response `200`**
```json
{ "success": true, "data": { "service": "auth-service", "status": "ok" } }
```

---

### `POST /api/v1/auth/invites/claim`

Claims a pending school admin invite. Creates a Firestore user profile and deletes the invite document. Rate-limited to **3 requests per hour per IP**.

Authentication is not required — this is the endpoint a new user calls before they have a profile.

**Request body**

| Field | Type | Constraints |
|---|---|---|
| `idToken` | `string` | Required. Firebase ID token obtained from `user.getIdToken()` on the client. |

```json
{ "idToken": "<firebase-id-token>" }
```

**Success `201`**
```json
{
  "success": true,
  "data": {
    "role": "school_admin",
    "tenantId": "tenant-abc123"
  }
}
```

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Request body missing `idToken` or it is an empty string. |
| `400` | `NO_EMAIL` | The Firebase account linked to the token has no email address. |
| `401` | `INVALID_TOKEN` | The ID token is malformed, expired, or has been revoked. |
| `404` | `INVITE_NOT_FOUND` | No pending invite exists for the email in the verified token. |
| `429` | `RATE_LIMITED` | More than 3 claim attempts from this IP in the last hour. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

**Audit log**: emits `INVITE_CLAIMED` with `actorId`, `actorRole`, and `tenantId` on success.

---

### `GET /api/v1/auth/me`

Returns the authenticated user's Firestore profile. Rate-limited to **5 requests per 15 minutes per IP**.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |

**Success `200`**
```json
{
  "success": true,
  "data": {
    "uid": "firebase-uid",
    "email": "admin@greenvalley.edu",
    "name": "Priya Sharma",
    "role": "school_admin",
    "tenantId": "tenant-abc123",
    "status": "active",
    "createdAt": 1711324800000,
    "updatedAt": 1711324800000
  }
}
```

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` | `Authorization` header is missing or does not start with `Bearer `. |
| `401` | `TOKEN_EXPIRED` | Firebase ID token has expired. |
| `401` | `TOKEN_REVOKED` | Firebase ID token has been revoked (e.g., sign-out on another device). |
| `401` | `INVALID_TOKEN` | Token is malformed or signature is invalid. |
| `401` | `USER_NOT_FOUND` | Token is valid but no Firestore profile exists for this UID (invite was never claimed). |
| `401` | `INVALID_PROFILE` | Firestore profile exists but fails schema validation. |
| `403` | `ACCOUNT_SUSPENDED` | User profile has `status: "suspended"`. |
| `404` | `USER_NOT_FOUND` | Profile document exists but returns null from Firestore (rare race condition). |
| `429` | `RATE_LIMITED` | More than 5 requests from this IP in the last 15 minutes. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

## Data Owned (Firestore)

| Collection | Access pattern | Notes |
|---|---|---|
| `users/{uid}` | Writes (creates profile on invite claim); reads (for `/me` and `verifyJwt`) | Profile document is created by the Admin SDK, which bypasses client Firestore security rules. Direct client writes are blocked by Firestore rules (`allow write: if false`). |
| `pendingInvites/{inviteKey}` | Reads (to validate invite on claim); deletes (after successful claim) | Invite key is the admin email with `@` and `.` replaced by `_`. e.g., `admin@school.edu` → `admin_school_edu`. Created by `tenant-service`, consumed here. |

## Production Deployment

See `docs/deployment.md`.

Runs on port `4001`. Stateless — can be horizontally scaled. All state lives in Firestore.

## Architecture Notes

**Invite claim flow**: The client sends a raw Firebase ID token (not just a UID). The service calls `getAdminAuth().verifyIdToken(token, true)` — the second argument enables revocation checking. Only after the token is verified does the service look up the pending invite by email. The invite lookup key is derived as `email.replace(/[@.]/g, '_')`. The user profile is created via the Admin SDK (`repo.createProfile`), which bypasses Firestore client security rules. The invite document is deleted atomically after the profile is created.

**`verifyJwt` middleware**: On every protected route, the middleware re-fetches the user profile from Firestore on each request to get the live `role`, `tenantId`, and `status`. This means suspending a user takes effect on the next request without requiring token revocation. The fetched data is attached to `req.user` and must never be overridden by request body or query string values.

**Middleware order** (enforced in `src/index.ts`):
1. `helmet()` — security headers
2. CORS
3. `express.json({ limit: '100kb' })` — body parsing
4. `requestId` — attaches `req.requestId`
5. Route handlers (rate limiting → `verifyJwt` → controller)
6. `errorHandler` — must be last
