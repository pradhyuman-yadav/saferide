# @saferide/middleware

Reusable Express middleware for all SafeRide backend services. Provides authentication, authorisation, rate limiting, input validation, request tracing, and error handling.

## Exports

### `verifyJwt`

Verifies a Firebase ID token from the `Authorization: Bearer <token>` header. On success, attaches the verified user context to `req.user`. Must run before any middleware or handler that reads `req.user`.

**What it does:**
1. Reads the `Authorization` header and strips the `Bearer ` prefix.
2. Calls `getAdminAuth().verifyIdToken(token, true)` — the `true` argument checks whether the token has been revoked (requires a live Firebase network call).
3. Fetches the Firestore `users/{uid}` document to get the live role, tenantId, and status.
4. Validates the Firestore document against `UserProfileSchema`.
5. Checks `status !== 'suspended'`.
6. Sets `req.user` and calls `next()`.

**Sets on `req.user`:**

| Field | Type | Source |
|---|---|---|
| `uid` | `string` | Firebase decoded token |
| `email` | `string` | Firebase decoded token (empty string if absent) |
| `role` | `UserRole` | Firestore `users/{uid}.role` |
| `tenantId` | `string \| null` | Firestore `users/{uid}.tenantId` |

**Error responses:**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` | Header missing or does not start with `Bearer `. |
| `401` | `TOKEN_EXPIRED` | Firebase error code `auth/id-token-expired`. |
| `401` | `TOKEN_REVOKED` | Firebase error code `auth/id-token-revoked`. |
| `401` | `INVALID_TOKEN` | Any other Firebase token error (malformed, wrong signature, etc.). |
| `401` | `USER_NOT_FOUND` | Token is valid but no Firestore profile exists for the UID. |
| `401` | `INVALID_PROFILE` | Firestore profile exists but fails `UserProfileSchema` validation. |
| `403` | `ACCOUNT_SUSPENDED` | User profile has `status: "suspended"`. |

**Usage:**

```ts
import { verifyJwt } from '@saferide/middleware';

// Applied per-route
router.get('/me', verifyJwt, (req, res) => {
  res.json({ uid: req.user.uid, role: req.user.role });
});

// Or applied globally to all routes in a router
router.use(verifyJwt);
```

---

### `requireRole(...roles: UserRole[])`

Authorisation guard. Returns a middleware that checks `req.user.role` against the allowed roles list. Must run after `verifyJwt`.

**Error responses:**

| Status | Code | Cause |
|---|---|---|
| `403` | `FORBIDDEN` | `req.user.role` is not in the `roles` list. |

**Usage:**

```ts
import { verifyJwt, requireRole } from '@saferide/middleware';

router.get('/tenants', verifyJwt, requireRole('super_admin'), controller.list);
router.get('/tenants/:id', verifyJwt, requireRole('super_admin', 'school_admin'), controller.getById);
```

---

### `validateBody(schema: ZodTypeAny)`

Validates `req.body` against a Zod schema before the request reaches a controller. On success, replaces `req.body` with the parsed (and coerced/stripped) output. On failure, returns a `400` with per-field error details.

Never pass raw `req.body` to a service or repository — always use `validateBody` first.

**Error responses:**

| Status | Code | Cause |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `req.body` fails schema validation. `error.details` contains Zod's flattened field errors. |

**Usage:**

```ts
import { validateBody } from '@saferide/middleware';
import { CreateTenantSchema } from '@saferide/types';

router.post('/', verifyJwt, requireRole('super_admin'), validateBody(CreateTenantSchema), controller.create);
```

---

### Rate limiters

All rate limiters use `express-rate-limit` and return `standardHeaders: true` (RFC 6585 `RateLimit-*` headers) and `legacyHeaders: false`. The response body on limit is:

```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "..." } }
```

| Export | Limit | Window | Use on |
|---|---|---|---|
| `authRateLimiter` | 5 requests | 15 minutes per IP | Auth read endpoints (e.g., `GET /me`) |
| `createAccountRateLimiter` | 3 requests | 1 hour per IP | Account creation / invite claim (`POST /invites/claim`) |
| `adminRateLimiter` | 300 requests | 1 minute per IP | Admin and manager endpoints (all tenant-service routes) |
| `readRateLimiter` | 120 requests | 1 minute per IP | Standard parent/driver read endpoints |

Apply at the router level to cover all routes in that router, or per-route:

```ts
import { adminRateLimiter, authRateLimiter, createAccountRateLimiter } from '@saferide/middleware';

// All routes in this router get the admin limiter
tenantsRouter.use(adminRateLimiter);

// Per-route with different limiters
authRouter.post('/invites/claim', createAccountRateLimiter, ...);
authRouter.get('/me', authRateLimiter, ...);
```

---

### `requestId`

Attaches a request ID to `req.requestId`. Uses the incoming `x-request-id` header if present, otherwise generates a UUID with `crypto.randomUUID()`. Apply early in the middleware chain so downstream middleware and error handlers can include it in logs.

**Usage:**

```ts
import { requestId } from '@saferide/middleware';

app.use(requestId);
// req.requestId is now available in all subsequent middleware
```

---

### `errorHandler`

Catch-all Express error handler. Logs the error via `logger.error` with `requestId` and `path` for traceability, then returns a generic `500` response. Must be registered last — after all routes — or it will not catch errors from those routes.

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again."
  }
}
```

**Usage:**

```ts
import { errorHandler } from '@saferide/middleware';

// Routes go here
app.use('/api/v1/auth', authRouter);

// errorHandler must be LAST
app.use(errorHandler);
```

Route handlers propagate errors to `errorHandler` by passing them to `next`:

```ts
router.get('/foo', (req, res, next) => {
  someAsyncOperation().catch(next);
});
```

---

### `types.d.ts` — Express Request augmentation

This file augments the global Express `Request` interface so TypeScript knows about the two fields added by middleware in this package. It is compiled as part of the package and applies to any service that imports `@saferide/middleware`.

**Augmented fields:**

| Field | Type | Set by |
|---|---|---|
| `req.user` | `{ uid: string; email: string; role: UserRole; tenantId: string \| null }` | `verifyJwt` |
| `req.requestId` | `string` | `requestId` |

These fields are not optional in the type — accessing `req.user` before `verifyJwt` runs will not produce a TypeScript error but will throw at runtime. Always place `verifyJwt` before any handler that reads `req.user`.

## Recommended middleware order

Every backend service must follow this order:

```ts
app.use(helmet());
app.use(cors({ ... }));
app.use(express.json({ limit: '100kb' }));
app.use(requestId);

// Per-route or router-level:
router.use(rateLimiter);       // 1. Rate limit
router.use(verifyJwt);         // 2. Auth
router.use(requireRole(...));  // 3. Authorisation
router.use(validateBody(...));  // 4. Input validation
// 5. Controller

app.use(errorHandler);         // Last — after all routes
```

## Usage in package.json

```json
"@saferide/middleware": "workspace:*"
```
