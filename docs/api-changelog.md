# API Changelog

All breaking changes, additions, and removals to service APIs are recorded here. Entries are newest-first.

---

## 2026-03-25

### auth-service — Initial release

#### Added

- `GET /health` — health check, no authentication required; returns `{ service: "auth-service", status: "ok" }`
- `POST /api/v1/auth/invites/claim` — claim a pending school admin invite using a Firebase ID token; creates Firestore user profile and deletes the invite document; rate-limited to 3 requests per hour per IP
- `GET /api/v1/auth/me` — return the authenticated user's Firestore profile; requires `Authorization: Bearer <token>`; rate-limited to 5 requests per 15 minutes per IP

### tenant-service — Initial release

#### Added

- `GET /health` — health check, no authentication required; returns `{ service: "tenant-service", status: "ok" }`
- `GET /api/v1/tenants` — list all tenants; requires `super_admin` role
- `GET /api/v1/tenants/:id` — get single tenant by Firestore document ID; requires `super_admin` or `school_admin` role; `school_admin` may only access their own tenant
- `POST /api/v1/tenants` — onboard a new school; requires `super_admin` role; creates `tenants/{id}` and `pendingInvites/{inviteKey}` documents in Firestore; `plan: "trial"` sets `status: "trial"` and `trialEndsAt` to 30 days from now; `plan: "basic"` or `"pro"` sets `status: "active"` and `trialEndsAt: null`; slug is auto-generated from name with a 4-character random suffix
- `PATCH /api/v1/tenants/:id/suspend` — suspend a school; requires `super_admin` role; returns `204`; returns `409 ALREADY_SUSPENDED` if already suspended
- `PATCH /api/v1/tenants/:id/reactivate` — reactivate a suspended school; requires `super_admin` role; returns `204`; returns `409 ALREADY_ACTIVE` if already active

### @saferide/types — Initial release

#### Added

- `UserProfileSchema` / `UserProfile` — Firestore user profile shape
- `USER_ROLES` / `UserRole` — valid role values: `super_admin`, `school_admin`, `manager`, `driver`, `parent`
- `TenantSchema` / `Tenant` — Firestore tenant shape
- `CreateTenantSchema` / `CreateTenantInput` — validated input for tenant creation
- `TENANT_STATUSES` / `TenantStatus` — `trial`, `active`, `suspended`, `cancelled`
- `TENANT_PLANS` / `TenantPlan` — `trial`, `basic`, `pro`
- `PendingInviteSchema` / `PendingInvite` — Firestore pending invite shape
- `ClaimInviteSchema` / `ClaimInviteInput` — validated input for invite claim
- `ApiSuccess<T>` / `ApiError` / `ApiResponse<T>` — standard response envelope interfaces
