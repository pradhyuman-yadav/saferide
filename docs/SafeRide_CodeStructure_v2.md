# SafeRide — Code Structure & Engineering Standards
> Version 2.0 · March 2026  
> Updated with Integration Layer, Adapter Pattern, Plugin System, Video Service  
> **Required reading for all engineers before first commit**

---

## Table of Contents

1. [Purpose & Golden Rule](#1-purpose--golden-rule)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Backend Service Structure](#3-backend-service-structure)
4. [Integration Layer Structure](#4-integration-layer-structure)
5. [TypeScript Standards](#5-typescript-standards)
6. [Naming Conventions](#6-naming-conventions)
7. [API Design Standards](#7-api-design-standards)
8. [Database Conventions](#8-database-conventions)
9. [Event & Kafka Conventions](#9-event--kafka-conventions)
10. [Mobile App Structure](#10-mobile-app-structure)
11. [Admin Web App Structure](#11-admin-web-app-structure)
12. [Shared Package Conventions](#12-shared-package-conventions)
13. [Testing Standards](#13-testing-standards)
14. [Git & PR Conventions](#14-git--pr-conventions)
15. [Environment & Configuration](#15-environment--configuration)
16. [Linting & Formatting](#16-linting--formatting)
17. [Quick Reference Card](#17-quick-reference-card)

---

## 1. Purpose & Golden Rule

This document is the canonical definition of how code is written, organised, and structured across every repository in SafeRide. Every engineer — backend, mobile, frontend, DevOps — reads this before writing a single line.

> **The Golden Rule:** "A piece of code should look like it was written by one person, regardless of how many people worked on it."
>
> If you read a function and think *"this looks different from the rest"* — it is wrong, even if it works.

**What changed in v2.0:**
- Added integration layer structure (adapters, plugins, webhook service)
- Added video service structure
- Added adapter pattern conventions
- Added partner API conventions
- Updated Kafka topic catalogue with integration topics

---

## 2. Monorepo Structure

SafeRide uses a monorepo managed with **pnpm workspaces** and **Turborepo**.

### 2.1 Top-Level Layout

```
saferide/
├── apps/                              ← Deployable applications
│   ├── api-gateway/                   ← Kong / AWS API Gateway config
│   ├── auth-service/                  ← Authentication & sessions
│   ├── tenant-service/                ← School onboarding & org management
│   ├── route-service/                 ← Bus, route, stop, student management
│   ├── telemetry-ingestor/            ← MQTT consumer + phone GPS → Kafka
│   ├── stream-processor/              ← Kafka consumer → Redis + DB + alerts
│   ├── livetrack-gateway/             ← WebSocket server (parent live map)
│   ├── notifications-service/         ← FCM push, SMS, delivery tracking
│   ├── trip-service/                  ← Trip lifecycle & history
│   ├── video-service/                 ← WebRTC sessions, recording, HLS
│   ├── webhook-service/               ← Outbound webhook delivery
│   ├── partner-api/                   ← Public partner-facing API (/partner/v1)
│   ├── web-admin/                     ← React web app (transport manager)
│   └── mobile/                        ← React Native app (parent + driver)
│
├── integrations/                      ← Integration adapters (NEW in v2)
│   ├── adapters/
│   │   ├── fedena/                    ← Fedena ERP adapter
│   │   ├── entab/                     ← Entab CampusCare adapter
│   │   ├── google-workspace/          ← Google Admin + Calendar adapter
│   │   ├── ola/                       ← Ola for Business dispatch adapter
│   │   ├── rapido/                    ← Rapido School adapter
│   │   └── generic-csv/               ← Generic CSV import (all schools)
│   ├── shared/
│   │   ├── sync-engine.ts             ← Delta sync, conflict resolution
│   │   ├── gps-normalizer.ts          ← Multi-provider GPS normalisation
│   │   └── transform-pipeline.ts      ← Field mapping + validation
│   └── index.ts
│
├── packages/                          ← Shared code (never deployed alone)
│   ├── types/                         ← TypeScript types & Zod schemas
│   ├── db/                            ← Prisma schema, migrations, client
│   ├── kafka/                         ← Kafka producer/consumer helpers
│   ├── redis/                         ← Redis client & geo helpers
│   ├── logger/                        ← Structured logger (Pino)
│   ├── errors/                        ← Shared error classes & codes
│   ├── notifications/                 ← FCM + SMS client wrappers
│   ├── config/                        ← Env validation (Zod)
│   ├── sdk/                           ← SafeRide partner SDK (@saferide/sdk)
│   └── ui/                            ← Shared React Native + Web components
│
├── infra/
│   ├── k8s/                           ← Kubernetes Helm charts
│   ├── terraform/                     ← AWS resources
│   └── docker/                        ← Dockerfiles
│
├── scripts/                           ← Dev tooling, DB seeding, codegen
├── docs/                              ← ADRs, runbooks
├── .github/workflows/                 ← CI/CD
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Why This Layout

| Design decision | Reason |
|---|---|
| `integrations/` is a top-level folder, not inside `apps/` | Adapters are not deployed services — they are consumers/producers that plug into Kafka. They do not expose HTTP endpoints except for incoming webhooks. |
| `packages/sdk/` lives in packages | The SDK is consumed by partners externally AND used internally for testing. It must be a proper versioned package. |
| `partner-api/` is a separate app | The partner API has different rate limiting, versioning, and auth rules from the internal API gateway. Separate service = separate deployment config. |
| `video-service/` is its own service | Video is computationally heavy (mediasoup). Scaling it independently prevents GPS tracking performance from being affected by video load. |

---

## 3. Backend Service Structure

Every backend service in `apps/` follows **identical** internal structure.

### 3.1 Canonical Service Layout

```
apps/route-service/
├── src/
│   ├── index.ts                       ← Entry point, starts server
│   ├── app.ts                         ← Fastify app factory (exported for tests)
│   ├── config.ts                      ← Env vars via Zod (validated at startup)
│   │
│   ├── routes/                        ← HTTP handlers ONLY. Zero business logic.
│   │   ├── bus.routes.ts
│   │   ├── route.routes.ts
│   │   └── index.ts                   ← Registers all routes
│   │
│   ├── controllers/                   ← Orchestration: call service → return DTO
│   │   ├── bus.controller.ts
│   │   └── route.controller.ts
│   │
│   ├── services/                      ← ALL business logic. Pure functions where possible.
│   │   ├── bus.service.ts
│   │   ├── route.service.ts
│   │   └── eta.service.ts
│   │
│   ├── repositories/                  ← ALL database queries. No SQL anywhere else.
│   │   ├── bus.repository.ts
│   │   └── route.repository.ts
│   │
│   ├── schemas/                       ← Zod request/response validation
│   │   └── bus.schema.ts
│   │
│   ├── middleware/                    ← Auth, tenant injection, error handler
│   │   ├── auth.middleware.ts
│   │   └── tenant.middleware.ts
│   │
│   ├── events/                        ← Kafka producers/consumers
│   │   ├── producers/
│   │   └── consumers/
│   │
│   └── types/
│       └── internal.ts                ← Service-local types only
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 3.2 The Layer Contract

| Layer | Job | Can call | Cannot call |
|---|---|---|---|
| `routes/` | Parse request, call controller, return response. **Zero logic.** | `controllers/` | `services/`, `repositories/`, DB |
| `controllers/` | Orchestrate: call services, assemble response DTO | `services/` | `repositories/`, DB directly |
| `services/` | Business logic. Validate rules. Transform data. | `repositories/`, other `services/` | DB directly |
| `repositories/` | All DB queries. Return domain objects. | `packages/db` | `services/`, HTTP, Kafka |
| `events/` | Publish/consume Kafka events. | `services/` | `repositories/` directly |

> **Hard rule: No raw Prisma calls outside `repositories/`.** A service that calls `prisma.bus.findMany()` directly is a bug.

### 3.3 File Naming Rules

| File type | Convention | Example |
|---|---|---|
| Route | `{entity}.routes.ts` | `bus.routes.ts` |
| Controller | `{entity}.controller.ts` | `bus.controller.ts` |
| Service | `{entity}.service.ts` | `eta.service.ts` |
| Repository | `{entity}.repository.ts` | `bus.repository.ts` |
| Schema | `{entity}.schema.ts` | `bus.schema.ts` |
| Middleware | `{name}.middleware.ts` | `auth.middleware.ts` |
| Producer | `{entity}.producer.ts` | `gps.producer.ts` |
| Consumer | `{entity}.consumer.ts` | `gps.consumer.ts` |
| Test | `{file}.test.ts` | `bus.service.test.ts` |
| Fixture | `{entity}.fixture.ts` | `bus.fixture.ts` |

---

## 4. Integration Layer Structure

### 4.1 The Adapter Pattern

The adapter pattern is the fundamental rule for all third-party integrations. SafeRide core services know **nothing** about Fedena, Ola, or any external system. Adapters are the translation layer.

```
External System       Adapter                     SafeRide Core
───────────────       ───────                     ─────────────

Fedena student  →→→  FedenaAdapter  →→→   POST /api/v1/students
roster API            maps fields            (internal API)
                      deduplicates
                      validates

SafeRide             FedenaAdapter  →→→   Fedena attendance
student.boarded  →→→  consumes webhook         module API
(Kafka → webhook)     writes attendance

KEY RULE:
  Adapters know ERP internals.
  SafeRide core knows nothing about any ERP.
  Core services are never modified to accommodate an integration.
```

### 4.2 Adapter Service Structure

```
integrations/adapters/fedena/
├── src/
│   ├── fedena.client.ts               ← HTTP client for Fedena API
│   ├── fedena.mapper.ts               ← Field mapping: Fedena ↔ SafeRide
│   ├── fedena.sync.ts                 ← Scheduled student roster sync
│   ├── fedena.webhook-handler.ts      ← Handle incoming Fedena events
│   ├── fedena.attendance-writer.ts    ← Write attendance back to Fedena
│   └── index.ts
├── tests/
│   ├── fedena.mapper.test.ts          ← Unit test mappings
│   ├── fedena.sync.test.ts            ← Integration test with mock Fedena API
│   └── fixtures/
│       ├── fedena-student.fixture.ts
│       └── saferide-student.fixture.ts
└── package.json
```

### 4.3 Adapter Rules

```ts
// Every adapter must implement this interface
interface SafeRideAdapter {
  id:      string           // 'fedena' | 'entab' | 'ola' | 'rapido'
  version: string

  // Called when adapter is enabled for a tenant
  onEnable:  (tenantId: string, config: AdapterConfig) => Promise<void>
  // Called when adapter is disabled
  onDisable: (tenantId: string) => Promise<void>
  // Health check — is the external system reachable?
  healthCheck: (config: AdapterConfig) => Promise<boolean>
}

// RULES:
// 1. Adapters never call SafeRide services directly.
//    They call the SafeRide internal API (HTTP) or produce to Kafka.
// 2. Adapters never touch SafeRide's database.
// 3. Adapters are isolated: a bug in FedenaAdapter cannot affect route-service.
// 4. Adapters have their own test suite.
//    Tests mock the external API (Fedena), never SafeRide internals.
// 5. Adapters store state in their own Redis namespace: adapter:{id}:{tenantId}:*
```

### 4.4 GPS Normalizer Pattern

All GPS sources — driver phone, AIS-140 hardware, Ola, Rapido — produce different formats. The normalizer converts everything to `CanonicalGPSEvent` before it enters the SafeRide pipeline.

```ts
// integrations/shared/gps-normalizer.ts

interface GPSNormalizer<TInput> {
  normalize(sourceId: string, payload: TInput): CanonicalGPSEvent
}

// Each provider has its own normalizer
class OlaGPSNormalizer implements GPSNormalizer<OlaDriverLocation> {
  normalize(rideId: string, payload: OlaDriverLocation): CanonicalGPSEvent {
    return {
      busId:      this.rideIdToBusId(rideId),
      lat:        payload.driverLocation.lat,
      lng:        payload.driverLocation.lng,
      speedKmh:   payload.driverLocation.speed * 3.6,  // Ola sends m/s
      headingDeg: payload.driverLocation.bearing ?? 0,
      source:     { type: 'ride_hailing_webhook', sourceId: rideId, providerId: 'ola' },
      rawPayload: payload,                              // Always preserve original
      normalizedAt: new Date().toISOString(),
    }
  }
}

// After normalization, all providers look the same to stream-processor
// The pipeline never has an if (source === 'ola') branch
```

### 4.5 Webhook Service Structure

```
apps/webhook-service/
├── src/
│   ├── index.ts
│   ├── config.ts
│   │
│   ├── consumers/
│   │   └── webhook.consumer.ts        ← Consumes saferide.webhooks.outbound
│   │
│   ├── services/
│   │   ├── delivery.service.ts        ← HTTP delivery logic
│   │   ├── signature.service.ts       ← HMAC-SHA256 signing
│   │   └── retry.service.ts           ← Exponential backoff retry
│   │
│   ├── repositories/
│   │   ├── subscription.repository.ts ← Look up registered webhooks
│   │   └── delivery-log.repository.ts ← Write delivery attempts
│   │
│   └── routes/
│       └── webhook-admin.routes.ts    ← CRUD for webhook registrations
│
└── tests/
```

### 4.6 Partner API Structure

```
apps/partner-api/
├── src/
│   ├── index.ts
│   ├── config.ts
│   │
│   ├── routes/                        ← /partner/v1/* endpoints
│   │   ├── buses.routes.ts            ← GET /partner/v1/buses
│   │   ├── trips.routes.ts            ← GET /partner/v1/trips
│   │   ├── students.routes.ts         ← GET /partner/v1/students
│   │   └── dispatch.routes.ts         ← POST /partner/v1/dispatch/trips
│   │
│   ├── middleware/
│   │   ├── oauth.middleware.ts        ← Validate OAuth 2.0 Bearer token
│   │   ├── scope.middleware.ts        ← Enforce OAuth scope requirements
│   │   └── rate-limit.middleware.ts   ← Per-partner rate limiting
│   │
│   ├── services/
│   │   └── partner-transform.service.ts  ← Map internal → partner response format
│   │
│   └── auth/
│       ├── oauth-server.ts            ← Authorization Code + Client Credentials flows
│       └── token.service.ts           ← Token issuance, refresh, revocation
│
└── tests/
```

---

## 5. TypeScript Standards

### 5.1 Strict Mode — Non-Negotiable

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": false,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

### 5.2 Type Rules

**✅ DO:**
- `interface` for domain entities
- `type` for unions, intersections, utility types
- Zod for runtime validation — infer static types from schemas
- String literal unions instead of plain enums
- Export cross-service types from `packages/types/`

**❌ DO NOT:**
- Never `any`. Use `unknown` and narrow.
- Never `as Type` casts at non-boundary points
- Never `!` non-null assertions
- Never duplicate a type across two services

```ts
// ✅ Canonical types — always inferred from Zod
import { z } from 'zod'

export const CreateBusSchema = z.object({
  regNumber:  z.string().min(4).max(20),
  deviceImei: z.string().length(15).nullable(),
  capacity:   z.number().int().min(1).max(100),
})

export type CreateBusInput = z.infer<typeof CreateBusSchema>
// Never write the type manually — it lives in one place

// ✅ Integration boundary — one place where `unknown` is allowed
function parseExternalPayload(raw: unknown): CanonicalGPSEvent {
  const validated = OlaLocationSchema.parse(raw)  // Zod throws on invalid
  return normalizer.normalize(validated)
}
```

### 5.3 Error Handling

```ts
// packages/errors/src/index.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('RESOURCE_NOT_FOUND', `${resource} ${id} not found`, 404)
  }
}

export class IntegrationError extends AppError {
  constructor(adapter: string, message: string, details?: unknown) {
    super('INTEGRATION_ERROR', `[${adapter}] ${message}`, 502, details)
  }
}

// RULES:
// All async functions must be fully awaited — never fire-and-forget
// Never swallow errors with empty catch blocks
// Throw typed errors — never throw strings
// Integration errors must include the adapter name in the error code
```

---

## 6. Naming Conventions

### 6.1 Universal Rules

| What | Convention | Examples |
|---|---|---|
| Variables | `camelCase` | `busId`, `tenantSlug`, `activeTrip` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_SPEED_KMH`, `DEFAULT_GEOFENCE_RADIUS_M` |
| Functions | `camelCase`, verb-first | `getBus()`, `normalizeGPS()`, `dispatchOlaRide()` |
| Classes | `PascalCase` | `BusService`, `FedenaAdapter`, `OlaGPSNormalizer` |
| Interfaces | `PascalCase`, no `I` prefix | `Bus`, `CanonicalGPSEvent`, `SafeRidePlugin` |
| Files | `kebab-case.suffix.ts` | `bus.service.ts`, `fedena.mapper.ts` |
| Folders | `kebab-case` | `route-service/`, `generic-csv/` |
| Env vars | `SCREAMING_SNAKE_CASE` | `FEDENA_API_KEY`, `OLA_WEBHOOK_SECRET` |
| DB tables | `snake_case`, plural | `buses`, `gps_telemetry`, `webhook_subscriptions` |
| Kafka topics | `dot.separated`, domain first | `saferide.gps.location-received` |
| Redis keys | `colon:separated`, entity first | `bus:state:{busId}`, `adapter:fedena:{tenantId}:last-sync` |
| API endpoints | `kebab-case`, plural nouns | `/buses`, `/partner/v1/trips` |
| Integration IDs | `kebab-case` | `'fedena'`, `'ola'`, `'generic-csv'` |

### 6.2 Function Naming Vocabulary

| Prefix | Returns | Examples |
|---|---|---|
| `get` | `T` — throws if not found | `getBus()`, `getActiveTrip()` |
| `find` | `T \| null` — never throws | `findBusByImei()`, `findActiveTrip()` |
| `create` | `T` | `createBus()`, `createWebhookSubscription()` |
| `update` | `T` — throws if not found | `updateBusRoute()` |
| `delete` | `void` — throws if not found | `deleteBus()` |
| `list` | `PaginatedResult<T>` | `listBusesByTenant()` |
| `calculate` | `T` — pure function | `calculateETA()`, `calculateDistance()` |
| `normalize` | `CanonicalType` | `normalizeGPS()`, `normalizeStudent()` |
| `handle` | `Promise<void>` — event handlers | `handleGpsEvent()`, `handleWebhookDelivery()` |
| `sync` | `Promise<SyncResult>` — adapter syncs | `syncFedenaStudents()` |
| `dispatch` | `Promise<void>` — external API calls | `dispatchOlaRide()` |
| `emit` | `Promise<void>` — Kafka publish | `emitTripStarted()`, `emitWebhookEvent()` |
| `is` / `has` | `boolean` | `isActiveBus()`, `hasVideoFeature()` |

---

## 7. API Design Standards

### 7.1 Two API Surfaces

SafeRide has two distinct API surfaces with different rules:

| Attribute | Internal API | Partner API |
|---|---|---|
| URL prefix | `/api/v1/` | `/partner/v1/` |
| Auth | Service JWT | OAuth 2.0 Bearer token |
| Rate limiting | High (per service) | Per-partner quota |
| Versioning | Less strict | Strict 18-month support |
| Breaking changes | Discussed in team | Never — use new version |

### 7.2 URL Structure

```
Internal API:
  GET    /api/v1/buses
  POST   /api/v1/buses
  GET    /api/v1/buses/:busId
  PATCH  /api/v1/buses/:busId
  POST   /api/v1/trips/:tripId/start       ← Action as sub-resource
  GET    /api/v1/buses/:busId/live         ← Current state sub-resource

Partner API:
  GET    /partner/v1/buses/:busId/location ← Scoped to partner access
  GET    /partner/v1/trips/:tripId
  WS     /partner/v1/routes/:routeId/live  ← WebSocket
  POST   /partner/v1/dispatch/trips        ← Ride-hailing dispatch

Integration webhooks (inbound from partners):
  POST   /integrations/fedena/webhook      ← Fedena events
  POST   /integrations/fedena/location     ← Not used (Fedena doesn't have GPS)
  POST   /integrations/ola/driver-location ← Ola GPS events
  POST   /integrations/rapido/location     ← Rapido GPS events
```

### 7.3 Response Envelope

```ts
// All responses — internal and partner — use this envelope

interface ApiResponse<T> {
  success: true
  data: T
  meta?: { page?: number; limit?: number; total?: number; nextCursor?: string }
}

interface ApiErrorResponse {
  success: false
  error: {
    code:     string   // Machine-readable: "BUS_NOT_FOUND"
    message:  string   // Human-readable
    details?: unknown  // Validation errors
  }
}

// ✅ All responses look like this:
// { success: true, data: { ... } }
// { success: false, error: { code: "...", message: "..." } }

// ❌ These are banned:
// { status: "ok", result: ... }
// { buses: [...] }
// { error: "not found" }
```

### 7.4 Idempotency

All `POST` operations in the Partner API and integration endpoints must support idempotency.

```ts
// Partner/integration requests include:
// Idempotency-Key: erp-student-import-20260321-001234

// Server implementation:
async function handleIdempotentRequest(key: string, handler: () => Promise<Response>) {
  const cached = await redis.get(`idempotency:${key}`)
  if (cached) return JSON.parse(cached)  // Return previous response

  const response = await handler()
  await redis.setex(`idempotency:${key}`, 86400, JSON.stringify(response))  // Cache 24h
  return response
}
```

### 7.5 HTTP Status Codes

| Situation | Code |
|---|---|
| Success GET/PATCH | 200 |
| Created (POST) | 201 |
| Deleted (DELETE) | 204 |
| Async accepted | 202 |
| Validation error | 400 |
| Auth token invalid | 401 |
| Insufficient scope | 403 |
| Not found | 404 |
| Conflict (duplicate) | 409 |
| Rate limited | 429 |
| Server error | 500 |
| External system error (adapter) | 502 |

---

## 8. Database Conventions

### 8.1 Schema Rules

```prisma
// Every table has these four fields — no exceptions
model Bus {
  id        String   @id @default(cuid())
  tenantId  String                           // Always present — RLS key
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // External IDs for integration
  externalIds Json @default("{}")            // { "fedena": "12345" }

  // Domain fields
  regNumber   String
  deviceImei  String?
  capacity    Int
  active      Boolean @default(true)

  @@index([tenantId])
  @@unique([tenantId, regNumber])
  @@map("buses")
}

// Integration tables — separate from core domain
model WebhookSubscription {
  id        String   @id @default(cuid())
  tenantId  String
  url       String
  secret    String                           // For HMAC signing
  events    String[]                         // Event types subscribed to
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@map("webhook_subscriptions")
}

model SyncLog {
  id          String   @id @default(cuid())
  tenantId    String
  adapterId   String                         // 'fedena', 'entab', etc.
  type        String                         // 'students', 'routes'
  status      String                         // 'success', 'partial', 'error'
  recordsIn   Int
  recordsOut  Int
  errors      Json?
  startedAt   DateTime
  completedAt DateTime?

  @@index([tenantId, adapterId])
  @@map("sync_logs")
}
```

### 8.2 External IDs Convention

Every entity that an ERP or partner might reference must have an `externalIds` field.

```ts
// The externalIds JSON column stores adapter-specific IDs
// { "fedena": "12345", "entab": "S-2026-789", "google": "uid-abc" }

// Looking up a student from Fedena:
const student = await prisma.student.findFirst({
  where: {
    tenantId,
    externalIds: { path: ['fedena'], equals: fedenaStudentId }
  }
})

// Creating with external ID:
await prisma.student.create({
  data: {
    ...studentData,
    externalIds: { fedena: fedenaStudentId }
  }
})

// RULE: Never store a foreign key to an external system as a separate column.
// Always use externalIds JSON. This keeps the schema clean when adapters are removed.
```

### 8.3 Repository Pattern

```ts
// repositories/bus.repository.ts

export const busRepository = {

  // find* → T | null (never throws)
  async findById(id: string, tenantId: string): Promise<Bus | null> {
    return prisma.bus.findFirst({ where: { id, tenantId } })
  },

  // get* → T (throws NotFoundError)
  async getById(id: string, tenantId: string): Promise<Bus> {
    const bus = await this.findById(id, tenantId)
    if (!bus) throw new NotFoundError('Bus', id)
    return bus
  },

  // findByExternalId — for adapter use
  async findByExternalId(adapterId: string, externalId: string, tenantId: string): Promise<Bus | null> {
    return prisma.bus.findFirst({
      where: {
        tenantId,
        externalIds: { path: [adapterId], equals: externalId }
      }
    })
  },

  // list → always paginated with cursor
  async list(tenantId: string, filter: ListBusesFilter) {
    const { limit = 20, cursor, active } = filter
    const [items, total] = await Promise.all([
      prisma.bus.findMany({
        where: { tenantId, ...(active !== undefined && { active }) },
        take: limit + 1,                   // Fetch one extra to detect hasMore
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.bus.count({ where: { tenantId } })
    ])

    const hasMore = items.length > limit
    const data = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? data[data.length - 1]?.id : null

    return { items: data, total, nextCursor, hasMore }
  },

} as const
```

---

## 9. Event & Kafka Conventions

### 9.1 Event Schema Rules

```ts
// packages/types/src/events/

// Base event — all events extend this
interface BaseEvent {
  readonly eventId:     string   // Unique — for deduplication
  readonly eventType:   string   // Discriminator
  readonly tenantId:    string   // Always present
  readonly occurredAt:  string   // ISO 8601 — when it happened
  readonly publishedAt: string   // ISO 8601 — when we ingested it
  readonly version:     number   // Schema version (start at 1)
  readonly source?:     string   // 'driver_app' | 'fedena' | 'ola'
}

// RULES:
// 1. Event names are past tense: GpsLocationReceived, TripStarted, StudentBoarded
// 2. All fields are readonly — events are immutable
// 3. Numeric fields include unit: speedKmh, headingDeg, distanceM
// 4. Integration events include source field identifying the adapter
```

### 9.2 Complete Topic Catalogue

```
# Core GPS & Trips
saferide.gps.location-received      ← All GPS (phone, hardware, Ola, Rapido)
saferide.gps.sos-triggered
saferide.trips.started
saferide.trips.ended
saferide.trips.deviation-detected
saferide.trips.delayed
saferide.alerts.speed-exceeded

# Notifications
saferide.notifications.requested
saferide.notifications.delivered

# Integration (outbound — ERP sync results)
saferide.students.sync-requested    ← ERP adapter publishes sync jobs
saferide.students.synced            ← Sync completed, downstream can react

# Integration (inbound — GPS from ride-hailing)
# Note: ride-hailing GPS is normalised and published to saferide.gps.location-received
# The source field identifies the provider

# Webhooks
saferide.webhooks.outbound          ← Events to be delivered to partner URLs

# Phase 2+
saferide.tap.v1.events              ← RFID tap events (board/alight)
saferide.gate.v1.entries            ← School gate entry events

# Dead letter queues
saferide.gps.location-received.dlq
saferide.webhooks.outbound.dlq
saferide.students.sync-requested.dlq
```

### 9.3 Schema Compatibility Rule

Integration events must be backward-compatible. When a breaking change is needed:

```
1. Create new topic version: saferide.students.v2.sync-requested
2. Produce to both v1 and v2 during migration period
3. Migrate consumers to v2
4. Stop producing to v1 (deprecated)
5. Remove v1 after all consumers confirm migrated
```

---

## 10. Mobile App Structure (React Native)

### 10.1 Folder Layout

```
apps/mobile/
├── src/
│   ├── app/                           ← Expo Router file-based navigation
│   │   ├── (auth)/
│   │   │   ├── login.tsx
│   │   │   └── otp.tsx
│   │   ├── (parent)/
│   │   │   ├── index.tsx              ← Home: live map
│   │   │   ├── video.tsx              ← Live bus camera
│   │   │   ├── history.tsx
│   │   │   └── profile.tsx
│   │   ├── (driver)/
│   │   │   ├── index.tsx              ← Trip controls
│   │   │   └── sos.tsx
│   │   └── _layout.tsx
│   │
│   ├── components/
│   │   ├── ui/                        ← Primitives: Button, Text, Card, Badge
│   │   ├── map/                       ← BusMarker, RoutePolyline, StopPin
│   │   ├── video/                     ← LiveVideoPlayer, VideoQualityBadge
│   │   ├── trip/                      ← TripCard, ETABadge, StopList
│   │   └── notifications/
│   │
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── livetrack.store.ts
│   │   ├── trips.store.ts
│   │   ├── video.store.ts             ← WebRTC session state
│   │   └── index.ts
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useLiveTrack.ts
│   │   ├── useBackgroundGPS.ts        ← Driver GPS background task
│   │   ├── useLiveVideo.ts            ← Parent: WebRTC session lifecycle
│   │   ├── useVideoQuality.ts         ← Adaptive quality based on connection
│   │   └── useETANotification.ts
│   │
│   ├── api/
│   │   ├── client.ts                  ← Axios with JWT interceptor + refresh
│   │   ├── buses.api.ts
│   │   ├── trips.api.ts
│   │   ├── gps.api.ts                 ← GPS broadcast endpoints
│   │   ├── video.api.ts               ← WebRTC session management
│   │   └── auth.api.ts
│   │
│   ├── tasks/
│   │   ├── gps-broadcast.task.ts      ← Expo background location task
│   │   └── notification.task.ts
│   │
│   ├── constants/
│   │   ├── colors.ts                  ← SafeRide brand tokens
│   │   ├── dimensions.ts
│   │   └── config.ts
│   │
│   └── utils/
│       ├── geo.ts
│       ├── format.ts
│       └── permissions.ts
│
└── app.config.ts
```

### 10.2 Brand Tokens

```ts
// constants/colors.ts — SafeRide Jade Pebble Morning palette

export const COLORS = {
  // Primary
  sage:      '#7B9669',    // Primary brand, buttons, active states
  forest:    '#404E3B',    // Headers, body text, CTAs
  mist:      '#BAC8B1',    // Cards, secondary backgrounds
  slate:     '#6C8480',    // Metadata, timestamps, icons
  stone:     '#E6E6E6',    // Base, whitespace, dividers
  gold:      '#C2A878',    // Alerts, premium accents, warmth

  // Semantic (mapped to brand colours)
  success:   '#7B9669',    // = sage
  warning:   '#C2A878',    // = gold (never red — brand is calm)
  danger:    '#8B6E5A',    // Warm brown, not red
  info:      '#6C8480',    // = slate

  // Text
  textPrimary:   '#404E3B',
  textSecondary: '#6C8480',
  textMuted:     '#9AAF97',

  // Never use: pure red (#ef4444) — breaks the calm brand
} as const
```

### 10.3 Component Rules

1. One component per file. `BusMarker.tsx` exports `BusMarker`.
2. Function declarations, not arrow functions, for root components.
3. Props interface named `{ComponentName}Props`, defined above component, exported.
4. `StyleSheet.create()` at the bottom of file. No inline styles.
5. No business logic in components — extract to hooks.
6. `React.memo()` only for measured bottlenecks.
7. Video components must handle `quality: 'offline'` state gracefully (show last frame, not blank).

---

## 11. Admin Web App Structure (React + Vite)

```
apps/web-admin/
├── src/
│   ├── pages/
│   │   ├── dashboard/                 ← Live fleet map
│   │   ├── buses/                     ← Bus CRUD
│   │   ├── routes/                    ← Route management
│   │   ├── drivers/
│   │   ├── video/                     ← Video monitoring + incident playback
│   │   ├── integrations/              ← Adapter management (Fedena, CSV)
│   │   │   ├── IntegrationsPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── FedenaSetup.tsx
│   │   │   │   └── CSVImport.tsx
│   │   │   └── WebhooksPage.tsx
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── map/                       ← FleetMap, BusMarker, RouteLayer
│   │   ├── video/                     ← VideoPlayer, RecordingTimeline
│   │   └── layout/
│   │
│   ├── features/
│   │   ├── live-tracking/             ← WebSocket, fleet state
│   │   ├── alerts/                    ← Alert feed, SOS
│   │   ├── video-monitor/             ← Live video grid, incident lookup
│   │   ├── integrations/              ← Sync status, logs, adapter config
│   │   └── reporting/                 ← Export, PDF generation
│   │
│   ├── store/
│   ├── api/
│   ├── hooks/
│   ├── constants/
│   └── utils/
```

### 11.1 Integrations Page Rules

The integrations page is the admin's control panel for all adapters and webhooks. Rules:

- Each adapter gets its own setup wizard (multi-step form)
- Sync status shown with last-sync timestamp and record count
- Sync errors shown with row-level detail (not just "failed")
- Webhook delivery log shows last 100 attempts with HTTP status code
- Admin can trigger manual sync from UI
- Admin can send test webhook to verify endpoint

---

## 12. Shared Package Conventions

### 12.1 Package Registry

| Package | Purpose | Consumers |
|---|---|---|
| `@saferide/types` | All shared TypeScript types + Zod schemas | All services |
| `@saferide/db` | Prisma client + schema + migrations | Any service touching DB |
| `@saferide/kafka` | Typed Kafka producer/consumer wrappers | Services with Kafka |
| `@saferide/redis` | Redis client, Geo helpers, pub/sub | stream-processor, livetrack-gateway |
| `@saferide/logger` | Structured Pino logger | All services |
| `@saferide/errors` | Typed error classes | All services |
| `@saferide/notifications` | FCM + MSG91 client wrappers | notifications-service |
| `@saferide/config` | Env validation via Zod | All services |
| `@saferide/sdk` | Public partner SDK | External partners + integration tests |
| `@saferide/ui` | Shared React Native + Web components | mobile, web-admin |

### 12.2 The Logger Rule

```ts
// ✅ ALWAYS use @saferide/logger
import { logger } from '@saferide/logger'

logger.info({ busId, tenantId, lat, lng }, 'GPS location received')
logger.error({ error, adapterId: 'fedena', tenantId }, 'Sync failed')
logger.warn({ busId, speedKmh }, 'Speed threshold exceeded')

// ❌ NEVER in production code
console.log('GPS:', data)         // Not structured, not searchable
console.error(error)              // No context
logger.info('thing happened')     // No fields — useless in production

// Integration errors must always include adapterId:
logger.error({ adapterId: 'fedena', tenantId, error }, 'Student sync error')
```

### 12.3 The Config Rule

```ts
// Every service has its own config.ts
// Every env var is validated at startup via Zod
// Service crashes immediately if any required var is missing

const parsed = ConfigSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid config:', parsed.error.format())
  process.exit(1)    // Hard exit — do not start broken
}

export const config = parsed.data
// Usage: import { config } from '@/config'
// Never: process.env.DATABASE_URL
```

---

## 13. Testing Standards

### 13.1 Test Pyramid

| Level | What | Tool | Target |
|---|---|---|---|
| Unit | Services, mappers, normalizers, utils | Vitest | 80% of services/ and adapters/ |
| Integration | API routes with real DB (Docker) | Supertest + Vitest | All P0 endpoints |
| Adapter | Adapter with mocked external API | Vitest + nock | All adapter sync flows |
| E2E | Critical user flows (login, track, video) | Playwright | 5–10 key journeys |

### 13.2 Adapter Testing Rules

```ts
// tests/unit/fedena.mapper.test.ts

describe('FedenaMapper', () => {
  describe('toSafeRideStudent', () => {
    it('maps fedena student fields to SafeRide canonical format', () => {
      const fedenaStudent = createFedenaStudentFixture()
      const result = FedenaMapper.toSafeRideStudent(fedenaStudent)
      expect(result.parentPhone).toMatch(/^\+91\d{10}$/)  // E.164 format
      expect(result.externalIds).toEqual({ fedena: fedenaStudent.student_id.toString() })
    })

    it('normalises Indian phone numbers without country code', () => {
      const input = createFedenaStudentFixture({ parent_mobile: '9876543210' })
      const result = FedenaMapper.toSafeRideStudent(input)
      expect(result.parentPhone).toBe('+919876543210')
    })
  })
})

// RULE: Adapter tests mock the external API — never call real Fedena/Ola
// Use nock for HTTP mocking
// Use createXxxFixture() for test data — never inline objects
```

### 13.3 Test Structure

```ts
// Arrange-Act-Assert for all tests
it('throws NotFoundError when bus does not exist', async () => {
  // Arrange
  busRepository.findById = vi.fn().mockResolvedValue(null)

  // Act
  const act = () => busService.getBus('nonexistent', 'tenant_abc')

  // Assert
  await expect(act()).rejects.toThrow(NotFoundError)
})

// describe = thing being tested
// it = specific behaviour in sentence form
// Fixtures for all test data — never magic strings inline
```

---

## 14. Git & PR Conventions

### 14.1 Branch Naming

```
feat/SR-142-add-bus-crud-endpoints
fix/SR-209-gps-latency-spike
feat/SR-310-fedena-adapter
feat/SR-411-live-video-parent-app
chore/SR-300-upgrade-prisma-5
```

### 14.2 Commit Format (Conventional Commits)

```
feat(route-service): add stop reordering endpoint
fix(stream-processor): handle null tripId in GPS events
feat(fedena-adapter): add nightly student roster sync
feat(video-service): add HLS recording to S3
feat(webhook-service): add delivery retry with exponential backoff
chore(deps): upgrade kafka.js to 2.2.4
```

### 14.3 PR Checklist

- [ ] PR title follows conventional commit format
- [ ] Description explains WHAT changed and WHY
- [ ] New functions have tests
- [ ] No `console.log`, TODO, or debug code
- [ ] No new `any` types
- [ ] Database migration included if schema changed
- [ ] `packages/types` updated if API contract changed
- [ ] If adding an adapter: adapter has its own test suite
- [ ] If adding a Kafka topic: topic documented in event catalogue
- [ ] `pnpm run lint` — zero warnings
- [ ] `pnpm run typecheck` — zero errors

### 14.4 PR Size Policy

| Size | Lines | Policy |
|---|---|---|
| Small | <200 | Merge same day |
| Medium | 200–500 | 1 reviewer, review within 24h |
| Large | 500+ | Must be split unless single migration |
| Epic | 1000+ | Architecture sign-off required |

---

## 15. Environment & Configuration

### 15.1 .env Rules

```bash
# .env.example — committed to git, always up to date
# .env.local — gitignored, developer's actual values

# Core
PORT=3003
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/saferide
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=minimum-32-characters-long-change-this

# Video (video-service only)
MEDIASOUP_ANNOUNCED_IP=
AWS_S3_VIDEO_BUCKET=saferide-video-dev
CLOUDFRONT_VIDEO_DOMAIN=https://video.saferide.in

# Integrations (adapter-specific)
FEDENA_API_URL=
FEDENA_API_KEY=
OLA_WEBHOOK_SECRET=
RAPIDO_WEBHOOK_SECRET=

# AIS-140 Compliance
AIS140_STATE_SERVER_IP=
AIS140_STATE_SERVER_PORT=
```

**Rules:**
- ✅ `.env.example` updated every time a new env var is added
- ❌ Never commit `.env`, `.env.local`
- ❌ Never `process.env.ANYTHING` in application code — always via `config.ts`

---

## 16. Linting & Formatting

### 16.1 Key ESLint Rules

| Rule | Why |
|---|---|
| `no-console: error` | Use `@saferide/logger` |
| `no-explicit-any: error` | Use `unknown` and narrow |
| `no-floating-promises: error` | Unhandled promises = silent failures |
| `import/no-cycle: error` | Circular imports = startup bugs |
| `no-restricted-imports (process.env)` | Must go through `config.ts` |
| `no-restricted-imports (prisma)` | Must go through `repositories/` |

### 16.2 Pre-commit Hooks

```bash
# .husky/pre-commit
pnpm lint-staged

# lint-staged — zero warnings allowed
"*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"]
```

Bypassing with `--no-verify` is not permitted.

---

## 17. Quick Reference Card

| Decision | Answer |
|---|---|
| Where does business logic go? | `services/` — never in routes, controllers, repositories |
| Where do DB queries go? | `repositories/` — nowhere else |
| I need a type in 2 services | `packages/types/` |
| I need to log something | `logger.info({ context }, 'message')` |
| I need to throw an error | `throw new NotFoundError()` or `new AppError()` |
| I need to read env | `config.ts` — never `process.env` |
| I need to add a new ERP | Create adapter in `integrations/adapters/{erp}/` — never modify core services |
| I need to normalise ride-hailing GPS | Implement `GPSNormalizer` in `integrations/shared/gps-normalizer.ts` |
| I need to store an external ID | `externalIds` JSON field — never a new column |
| My integration test needs real Fedena | No. Mock with nock. Never call real external APIs in tests. |
| Should I use `any`? | No. Use `unknown` and narrow. |
| Should I use `!`? | No. Handle the null case. |
| My PR is 700 lines. OK? | No. Split it. |
| Can I skip lint with `--no-verify`? | No. Fix the lint error. |
| New env var needed? | Add to `config.ts` schema AND `.env.example` — both, always |

---

*SafeRide Engineering Standards v2.0 — March 2026*  
*Questions? Post in `#engineering-standards`. Disputes resolved by architecture review.*
