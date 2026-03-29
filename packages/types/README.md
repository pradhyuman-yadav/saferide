# @saferide/types

Shared TypeScript interfaces and Zod runtime schemas used by every SafeRide service and the web-admin. This is the single source of truth for all data shapes.

## What it exports

### From `user.ts`

| Export | Kind | Description |
|---|---|---|
| `USER_ROLES` | `const` | Tuple of all valid role strings: `['super_admin', 'school_admin', 'manager', 'driver', 'parent']` |
| `UserRole` | `type` | Union type inferred from `USER_ROLES`: `'super_admin' \| 'school_admin' \| 'manager' \| 'driver' \| 'parent'` |
| `UserProfileSchema` | `ZodObject` | Runtime schema for a Firestore user profile document. Fields: `uid` (string), `email` (email string), `name` (1–100 chars), `role` (UserRole), `tenantId` (string \| null), `status` (`'active' \| 'invited' \| 'suspended'`), `createdAt` (number ms), `updatedAt` (number ms). |
| `UserProfile` | `type` | TypeScript type inferred from `UserProfileSchema`. |

### From `tenant.ts`

| Export | Kind | Description |
|---|---|---|
| `TENANT_STATUSES` | `const` | Tuple: `['trial', 'active', 'suspended', 'cancelled']` |
| `TENANT_PLANS` | `const` | Tuple: `['trial', 'basic', 'pro']` |
| `TenantStatus` | `type` | Union inferred from `TENANT_STATUSES`. |
| `TenantPlan` | `type` | Union inferred from `TENANT_PLANS`. |
| `TenantSchema` | `ZodObject` | Runtime schema for a Firestore tenant document. Fields: `id`, `name` (1–100), `slug`, `city` (1–100), `state` (1–100), `status` (TenantStatus), `plan` (TenantPlan), `trialEndsAt` (number \| null), `maxBuses` (positive int), `maxStudents` (positive int), `contactName` (1–100), `contactEmail` (email), `contactPhone` (10–15 chars), `adminEmail` (email), `createdAt` (number ms), `updatedAt` (number ms). |
| `Tenant` | `type` | TypeScript type inferred from `TenantSchema`. |
| `CreateTenantSchema` | `ZodObject` | Input schema for `POST /api/v1/tenants`. Subset of `TenantSchema` — omits auto-generated fields (`id`, `slug`, `status`, `trialEndsAt`, `createdAt`, `updatedAt`). `contactPhone` must match `/^\d{10}$/`. `maxBuses` max is 500; `maxStudents` max is 100,000. |
| `CreateTenantInput` | `type` | TypeScript type inferred from `CreateTenantSchema`. |

### From `invite.ts`

| Export | Kind | Description |
|---|---|---|
| `PendingInviteSchema` | `ZodObject` | Runtime schema for a Firestore `pendingInvites` document. Fields: `tenantId` (string), `email` (email), `role` (UserRole), `contactName` (string, optional), `createdAt` (number ms), `updatedAt` (number ms). |
| `PendingInvite` | `type` | TypeScript type inferred from `PendingInviteSchema`. |
| `ClaimInviteSchema` | `ZodObject` | Input schema for `POST /api/v1/auth/invites/claim`. Fields: `idToken` (non-empty string). |
| `ClaimInviteInput` | `type` | TypeScript type inferred from `ClaimInviteSchema`. |

### From `api.ts`

| Export | Kind | Description |
|---|---|---|
| `ApiSuccess<T>` | `interface` | Typed success envelope. Shape: `{ success: true; data: T; meta?: { page, limit, total } }`. |
| `ApiError` | `interface` | Error envelope. Shape: `{ success: false; error: { code: string; message: string; details?: Record<string, unknown> } }`. |
| `ApiResponse<T>` | `type` | Union: `ApiSuccess<T> \| ApiError`. Use as the return type for all API client functions. |

## Usage

```ts
// Add to your service's package.json dependencies:
"@saferide/types": "workspace:*"

// Then import:
import { TenantSchema, CreateTenantSchema, UserProfile } from '@saferide/types';

// Validate at runtime:
const tenant = TenantSchema.parse(firestoreDoc.data());

// Infer TypeScript types:
type Tenant = z.infer<typeof TenantSchema>;  // or just import Tenant directly

// Use ApiResponse for typed fetch wrappers:
import type { ApiResponse, Tenant } from '@saferide/types';
const res: ApiResponse<Tenant> = await response.json();
if (!res.success) {
  console.error(res.error.code, res.error.message);
} else {
  console.log(res.data.name);
}
```

## Updating schemas

When you add a field to any Zod schema here:

1. Update the schema in the relevant `.ts` file under `src/`
2. Add a test case in `tests/schemas.test.ts` covering the new field (valid value, missing value if required, boundary values)
3. Update `docs/api-changelog.md` with the date and a description of the change
4. Check all services that use the schema still typecheck: `pnpm typecheck`
5. If the field appears in an API response, update the corresponding service README

Never add a field as optional in the schema just to avoid a breaking change — fix the callers.
