# tenant-service

Owns all school/tenant lifecycle management for SafeRide. Creates, reads, suspends, and reactivates school tenants. On creation, automatically provisions a pending invite so the school admin can sign up.

## Responsibility

- CRUD for school tenants (Firestore `tenants/` collection)
- Enforce plan-based limits (`maxBuses`, `maxStudents`, `trialEndsAt`)
- Create `pendingInvites` for the school admin email on tenant creation
- Does NOT handle user authentication — that is `auth-service`
- Does NOT handle user profiles — that is `auth-service`

## Local Development

```bash
# From repo root
pnpm install

# Copy and fill in environment variables (must be in tenant-service/.env)
cp tenant-service/.env.example tenant-service/.env
# Edit tenant-service/.env — fill in FIREBASE_SERVICE_ACCOUNT_JSON as a single-line JSON string

# Run with hot reload (from the service directory)
cd tenant-service && pnpm dev
# or from root:
pnpm dev --filter saferide-tenant-service

# Run tests
pnpm test --filter saferide-tenant-service

# Watch mode
pnpm test:watch --filter saferide-tenant-service

# Type check
pnpm typecheck --filter saferide-tenant-service
```

The service starts on `http://localhost:4002` by default.

## Environment Variables

The service validates all variables at startup via Zod. It crashes immediately if any required variable is missing or invalid.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment. Accepts `development`, `production`, `test`. Controls Pino pretty-printing. |
| `PORT` | No | `4002` | TCP port the HTTP server listens on. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | — | Firebase service account key as **single-line JSON** (no newlines). Download from Firebase Console → Project Settings → Service Accounts → Generate new private key. Flatten with: `jq -c . service-account.json`. In production, store in AWS Secrets Manager. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed CORS origins. Example: `https://admin.saferide.in`. |
| `LOG_LEVEL` | No | `info` | Pino log level. Accepts `trace`, `debug`, `info`, `warn`, `error`. |

## API Reference

Base path: `/api/v1/tenants`

All routes require a valid Firebase ID token in `Authorization: Bearer <token>`. Rate-limited to **300 requests per minute per IP** (`adminRateLimiter`).

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
{ "success": true, "data": { "service": "tenant-service", "status": "ok" } }
```

---

### `GET /api/v1/tenants`

Lists all tenants. Requires `super_admin` role.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |

**Success `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-abc123",
      "name": "Green Valley School",
      "slug": "green-valley-school-k7x2",
      "city": "Bengaluru",
      "state": "Karnataka",
      "status": "trial",
      "plan": "trial",
      "trialEndsAt": 1713916800000,
      "maxBuses": 10,
      "maxStudents": 500,
      "contactName": "Ramesh Kumar",
      "contactEmail": "ramesh@greenvalley.edu",
      "contactPhone": "9876543210",
      "adminEmail": "admin@greenvalley.edu",
      "createdAt": 1711324800000,
      "updatedAt": 1711324800000
    }
  ]
}
```

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or invalid token. |
| `403` | `FORBIDDEN` | Authenticated user does not have `super_admin` role. |
| `429` | `RATE_LIMITED` | More than 300 requests from this IP in the last minute. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

---

### `GET /api/v1/tenants/:id`

Gets a single tenant by ID. Requires `super_admin` or `school_admin` role. A `school_admin` can only access their own tenant (`req.user.tenantId === id`).

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID of the tenant. |

**Success `200`**

Same shape as a single object in the `GET /api/v1/tenants` array response above.

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or invalid token. |
| `403` | `FORBIDDEN` | Role is not `super_admin` or `school_admin`; or role is `school_admin` but `req.user.tenantId !== id`. |
| `404` | `TENANT_NOT_FOUND` | No tenant document exists with this ID. |
| `429` | `RATE_LIMITED` | More than 300 requests from this IP in the last minute. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

---

### `POST /api/v1/tenants`

Onboards a new school. Requires `super_admin` role.

**Side effects:**
1. Creates a `tenants/{id}` document in Firestore.
2. Creates a `pendingInvites/{inviteKey}` document for the `adminEmail` so the school admin can claim their account via `auth-service`. The invite key is `adminEmail.replace(/[@.]/g, '_')`.

**Slug generation**: The `slug` field is auto-generated from the school `name` — lowercased, non-alphanumeric characters removed, spaces replaced with hyphens, with a 4-character random suffix appended (e.g., `"Green Valley School"` → `"green-valley-school-k7x2"`). It is not user-supplied.

**Plan logic:**
- `plan: "trial"` → `status: "trial"`, `trialEndsAt: now + 30 days`
- `plan: "basic"` or `plan: "pro"` → `status: "active"`, `trialEndsAt: null`

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |
| `Content-Type` | `application/json` |

**Request body**

| Field | Type | Constraints |
|---|---|---|
| `name` | `string` | Required. 1–100 characters. |
| `city` | `string` | Required. 1–100 characters. |
| `state` | `string` | Required. 1–100 characters. |
| `plan` | `"trial"` \| `"basic"` \| `"pro"` | Required. |
| `maxBuses` | `integer` | Required. 1–500. |
| `maxStudents` | `integer` | Required. 1–100,000. |
| `contactName` | `string` | Required. 1–100 characters. |
| `contactEmail` | `string` | Required. Valid email. |
| `contactPhone` | `string` | Required. Exactly 10 digits. |
| `adminEmail` | `string` | Required. Valid email. The pending invite is created for this address. |

```json
{
  "name": "Green Valley School",
  "city": "Bengaluru",
  "state": "Karnataka",
  "plan": "trial",
  "maxBuses": 10,
  "maxStudents": 500,
  "contactName": "Ramesh Kumar",
  "contactEmail": "ramesh@greenvalley.edu",
  "contactPhone": "9876543210",
  "adminEmail": "admin@greenvalley.edu"
}
```

**Success `201`**

Returns the full tenant object (same shape as `GET /api/v1/tenants/:id`).

```json
{
  "success": true,
  "data": {
    "id": "tenant-abc123",
    "name": "Green Valley School",
    "slug": "green-valley-school-k7x2",
    "status": "trial",
    "trialEndsAt": 1713916800000,
    ...
  }
}
```

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `400` | `VALIDATION_ERROR` | One or more request body fields fail validation. `error.details` contains per-field error messages. |
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or invalid token. |
| `403` | `FORBIDDEN` | Authenticated user does not have `super_admin` role. |
| `429` | `RATE_LIMITED` | More than 300 requests from this IP in the last minute. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

**Audit log**: emits `TENANT_CREATED` with `actorId`, `actorRole`, `targetId` (tenant ID), `tenantName`, and `plan` on success.

---

### `PATCH /api/v1/tenants/:id/suspend`

Suspends a school. Sets `status` to `"suspended"` in Firestore. Requires `super_admin` role. Returns no body on success.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID of the tenant. |

**Success `204`** — no response body.

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or invalid token. |
| `403` | `FORBIDDEN` | Authenticated user does not have `super_admin` role. |
| `404` | `TENANT_NOT_FOUND` | No tenant document exists with this ID. |
| `409` | `ALREADY_SUSPENDED` | The tenant's current `status` is already `"suspended"`. |
| `429` | `RATE_LIMITED` | More than 300 requests from this IP in the last minute. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

**Audit log**: emits `TENANT_SUSPENDED` with `actorId`, `actorRole`, `targetId`, and `tenantId` on success.

---

### `PATCH /api/v1/tenants/:id/reactivate`

Reactivates a suspended school. Sets `status` to `"active"` in Firestore. Requires `super_admin` role. Returns no body on success.

**Headers**

| Header | Value |
|---|---|
| `Authorization` | `Bearer <firebase-id-token>` |

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID of the tenant. |

**Success `204`** — no response body.

**Error responses**

| Status | Code | Cause |
|---|---|---|
| `401` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Missing, expired, or invalid token. |
| `403` | `FORBIDDEN` | Authenticated user does not have `super_admin` role. |
| `404` | `TENANT_NOT_FOUND` | No tenant document exists with this ID. |
| `409` | `ALREADY_ACTIVE` | The tenant's current `status` is already `"active"`. |
| `429` | `RATE_LIMITED` | More than 300 requests from this IP in the last minute. |
| `500` | `INTERNAL_ERROR` | Unhandled server error. |

**Audit log**: emits `TENANT_REACTIVATED` with `actorId`, `actorRole`, `targetId`, and `tenantId` on success.

## Data Owned (Firestore)

| Collection | Access pattern | Notes |
|---|---|---|
| `tenants/{id}` | Reads and writes | All writes via Admin SDK. Direct client writes blocked by Firestore rules (`allow write: if false`). |
| `pendingInvites/{inviteKey}` | Writes (creates on tenant creation) | Consumed by `auth-service` when the admin claims their invite. Key format: `adminEmail.replace(/[@.]/g, '_')`. |

## Production Deployment

See `docs/deployment.md`.

Runs on port `4002`. Stateless — can be horizontally scaled. All state lives in Firestore.

## Architecture Notes

**Slug generation**: `generateSlug` lowercases the name, strips non-alphanumeric characters, normalises consecutive hyphens, then appends a 4-character random alphanumeric suffix from `Math.random().toString(36).slice(2, 6)`. The slug is purely cosmetic — tenant lookups always use the Firestore document ID.

**Invite creation is not transactional**: `repo.create` (writes the tenant doc) and `repo.createInvite` (writes the invite doc) are two separate Firestore writes. If the service crashes between them, the tenant will exist without an invite. Handle this in operations by checking for orphaned tenants without matching invites.

**`school_admin` access restriction**: `GET /api/v1/tenants/:id` allows `school_admin` to read their own tenant, but the controller enforces `req.user.tenantId === id` before calling the service. This check is in the controller, not the service layer, because it requires request context (`req.user`).

**Middleware order** (enforced in `src/index.ts`):
1. `helmet()` — security headers
2. CORS
3. `express.json({ limit: '100kb' })` — body parsing
4. `requestId` — attaches `req.requestId`
5. Route handlers (`adminRateLimiter` → `verifyJwt` → `requireRole` → `validateBody` → controller)
6. `errorHandler` — must be last
