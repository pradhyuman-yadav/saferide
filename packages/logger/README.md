# @saferide/logger

Structured Pino logger and audit log helper used by every SafeRide backend service. In development, output is pretty-printed with colour and human-readable timestamps via `pino-pretty`. In production, output is newline-delimited JSON shipped to CloudWatch Logs.

## Exports

### `logger`

A configured Pino logger instance. Log level is read from `process.env.LOG_LEVEL` at module load time, defaulting to `'info'`.

Never use `console.log` anywhere in the codebase — use `logger` instead.

```ts
import { logger } from '@saferide/logger';

// Structured log with context fields
logger.info({ port: 4001, env: 'production' }, 'auth-service started');
logger.warn({ uid: 'abc', issues: parsed.error.issues }, 'Invalid user profile in Firestore');
logger.error({ err, requestId: req.requestId, path: req.path }, 'Unhandled error');
```

Pino log levels in order of severity: `trace` → `debug` → `info` → `warn` → `error` → `fatal`. The configured level and all levels above it are emitted; lower levels are suppressed.

### `auditLog(params)`

Emits a structured `logger.info` entry tagged with `audit: true` for sensitive operations. Audit entries are queryable in CloudWatch using the filter `{ $.audit = true }`.

**Signature**

```ts
function auditLog(params: {
  action:    string;
  actorId:   string;
  actorRole: string;
  tenantId?: string | null;
  targetId?: string;
  meta?:     Record<string, unknown>;
}): void
```

**Parameters**

| Field | Required | Description |
|---|---|---|
| `action` | Yes | Screaming snake case event name. e.g. `'INVITE_CLAIMED'`, `'TENANT_CREATED'`. |
| `actorId` | Yes | Firebase UID of the user performing the action. Never log JWT tokens — log only the UID. |
| `actorRole` | Yes | Role of the acting user at the time of the action. |
| `tenantId` | No | Tenant context. Pass `null` for super-admin actions that are not scoped to a tenant. |
| `targetId` | No | Firestore document ID of the resource being acted on (e.g., the tenant ID for `TENANT_SUSPENDED`). |
| `meta` | No | Arbitrary additional key-value pairs. Use for non-sensitive contextual fields (e.g., `{ plan: 'trial', tenantName: 'Green Valley' }`). Never include passwords, OTPs, tokens, or raw GPS coordinates. |

**Usage examples**

```ts
import { auditLog } from '@saferide/logger';

// Invite claimed
auditLog({
  action:    'INVITE_CLAIMED',
  actorId:   result.uid,
  actorRole: result.role,
  tenantId:  result.tenantId,
});

// Tenant created
auditLog({
  action:    'TENANT_CREATED',
  actorId:   req.user.uid,
  actorRole: req.user.role,
  targetId:  tenant.id,
  meta:      { tenantName: tenant.name, plan: tenant.plan },
});

// Tenant suspended
auditLog({
  action:    'TENANT_SUSPENDED',
  actorId:   req.user.uid,
  actorRole: req.user.role,
  targetId:  id,
  tenantId:  id,
});
```

**Emitted log shape**

```json
{
  "level": 30,
  "time": 1711324800000,
  "audit": true,
  "action": "TENANT_CREATED",
  "actorId": "firebase-uid-abc",
  "actorRole": "super_admin",
  "targetId": "tenant-xyz",
  "meta": { "tenantName": "Green Valley School", "plan": "trial" },
  "msg": "AUDIT: TENANT_CREATED"
}
```

## Usage

```ts
// Add to your service's package.json dependencies:
"@saferide/logger": "workspace:*"

// Import what you need:
import { logger, auditLog } from '@saferide/logger';
```

## Log level in production

Set `LOG_LEVEL=info` in production. Use `debug` or `trace` only in development — these levels produce high-volume output that increases CloudWatch costs.
