# SafeRide — Code Structure & Engineering Standards
> Version 1.0 · March 2026  
> **Required reading for all engineers before first commit.**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Backend Service Structure](#3-backend-service-structure)
4. [TypeScript Standards](#4-typescript-standards)
5. [Naming Conventions](#5-naming-conventions)
6. [API Design Standards](#6-api-design-standards)
7. [Database Conventions](#7-database-conventions-prisma--postgresql)
8. [Event & Kafka Conventions](#8-event--kafka-conventions)
9. [Mobile App Structure](#9-mobile-app-structure-react-native)
10. [Admin Web App Structure](#10-admin-web-app-structure-react--vite)
11. [Shared Package Conventions](#11-shared-package-conventions-packages)
12. [Testing Standards](#12-testing-standards)
13. [Git & PR Conventions](#13-git--pr-conventions)
14. [Environment & Configuration](#14-environment--configuration)
15. [Linting & Formatting](#15-linting--formatting)
16. [Quick Reference Card](#16-quick-reference-card)

---

## 1. Purpose

This document defines the canonical code structure, naming conventions, file organisation, and engineering patterns for every repository in the SafeRide platform. Every engineer — backend, frontend, mobile, or DevOps — must read this before writing their first line of code.

Consistency is not aesthetic preference. It is the difference between a codebase a new engineer can navigate in one hour versus one week. Every rule in this document has a reason. When in doubt, follow the rule first and raise a discussion in the `#engineering-standards` channel second.

> **The Golden Rule:** "A piece of code should look like it was written by one person, regardless of how many people worked on it."
>
> If you read a function and think _"this looks different from the rest"_ — it is wrong, even if it works.

---

## 2. Monorepo Structure

SafeRide uses a monorepo managed with **pnpm workspaces** and **Turborepo**. All services, apps, and shared packages live in one repository. This enables atomic commits across services, shared type safety, and unified CI/CD.

### 2.1 Top-Level Layout

```
saferide/                          ← Repository root
├── apps/                          ← Deployable applications
│   ├── api-gateway/               ← Kong / AWS API Gateway config
│   ├── auth-service/              ← Authentication & sessions
│   ├── tenant-service/            ← School onboarding & org management
│   ├── route-service/             ← Bus, route, stop, student management
│   ├── telemetry-ingestor/        ← MQTT consumer → Kafka producer
│   ├── stream-processor/          ← Kafka consumer → Redis + DB + alerts
│   ├── livetrack-gateway/         ← WebSocket server for parent app
│   ├── notifications-service/     ← FCM push, SMS, delivery tracking
│   ├── trip-service/              ← Trip lifecycle & history
│   ├── web-admin/                 ← React web app (transport manager)
│   └── mobile/                    ← React Native app (parent + driver)
│
├── packages/                      ← Shared code (never deployed alone)
│   ├── types/                     ← Shared TypeScript types & Zod schemas
│   ├── db/                        ← Prisma schema, migrations, client
│   ├── kafka/                     ← Kafka producer/consumer helpers
│   ├── redis/                     ← Redis client & geo helpers
│   ├── logger/                    ← Structured logger (Pino)
│   ├── errors/                    ← Shared error classes & codes
│   ├── notifications/             ← FCM + SMS client wrappers
│   ├── config/                    ← Env validation (Zod)
│   └── ui/                        ← Shared React Native + Web components
│
├── infra/                         ← Infrastructure as code
│   ├── k8s/                       ← Kubernetes manifests (Helm charts)
│   ├── terraform/                 ← AWS resource definitions
│   └── docker/                    ← Dockerfiles per service
│
├── scripts/                       ← Dev tooling, DB seeding, codegen
├── docs/                          ← Architecture decisions, runbooks
├── .github/workflows/             ← CI/CD pipelines
├── turbo.json                     ← Turborepo pipeline config
├── pnpm-workspace.yaml            ← Workspace definitions
└── package.json                   ← Root dev dependencies
```

### 2.2 Why Monorepo?

| Benefit | Practical Impact |
|---|---|
| Shared TypeScript types | Change the GPS event schema once in `packages/types` — all services get the update at compile time, not at runtime surprise |
| Atomic commits | A Kafka message format change can update the producer (`telemetry-ingestor`) and consumer (`stream-processor`) in the same commit and PR |
| Unified lint/format | One ESLint + Prettier config. No "this service uses tabs, this one uses spaces" debates |
| Single CI pipeline | Turborepo only rebuilds and retests services that changed — not the entire repo on every commit |
| Local dev simplicity | One `pnpm install` at root. One `pnpm dev` to run all services with hot reload |

---

## 3. Backend Service Structure

Every backend service in `apps/` follows the **exact same** internal folder structure. If you know one service, you know all of them. No exceptions.

### 3.1 Canonical Service Layout

```
apps/route-service/                ← Example: any backend service
├── src/
│   ├── index.ts                   ← Entry point: starts server, registers plugins
│   ├── app.ts                     ← Fastify app factory (exported for testing)
│   ├── config.ts                  ← Env vars (validated via @saferide/config)
│   │
│   ├── routes/                    ← HTTP route handlers ONLY — no business logic
│   │   ├── bus.routes.ts
│   │   ├── route.routes.ts
│   │   ├── stop.routes.ts
│   │   └── index.ts               ← Registers all routes on the Fastify instance
│   │
│   ├── controllers/               ← Thin orchestration: call service, return response DTO
│   │   ├── bus.controller.ts
│   │   ├── route.controller.ts
│   │   └── stop.controller.ts
│   │
│   ├── services/                  ← ALL business logic lives here. Pure functions where possible.
│   │   ├── bus.service.ts
│   │   ├── route.service.ts
│   │   ├── stop.service.ts
│   │   └── eta.service.ts
│   │
│   ├── repositories/              ← All database queries. No SQL anywhere else.
│   │   ├── bus.repository.ts
│   │   ├── route.repository.ts
│   │   └── stop.repository.ts
│   │
│   ├── schemas/                   ← Zod request/response validation schemas
│   │   ├── bus.schema.ts
│   │   └── route.schema.ts
│   │
│   ├── middleware/                ← Auth guards, tenant injection, error handler
│   │   ├── auth.middleware.ts
│   │   ├── tenant.middleware.ts
│   │   └── error.middleware.ts
│   │
│   ├── events/                    ← Kafka producers/consumers for this service
│   │   ├── producers/
│   │   └── consumers/
│   │
│   └── types/                     ← Service-local types (not shared across services)
│       └── internal.ts
│
├── tests/
│   ├── unit/                      ← Pure logic tests (services, utils)
│   ├── integration/               ← API route tests (with real DB via Docker)
│   └── fixtures/                  ← Shared test data factories
│
├── Dockerfile
├── package.json
└── tsconfig.json
```

### 3.2 The Layer Contract

Each layer has **exactly one job**. Mixing responsibilities is the most common source of unmaintainable code. Violations of this contract are **blocking PR comments**.

| Layer | Job | Can call | Cannot call |
|---|---|---|---|
| `routes/` | Parse request, call controller, return response. **Zero logic.** | `controllers/` | `services/`, `repositories/`, DB |
| `controllers/` | Orchestrate: call one or more services, assemble response DTO | `services/` | `repositories/`, DB directly |
| `services/` | Business logic. Validate rules. Transform data. | `repositories/`, other `services/` | DB directly, HTTP clients directly |
| `repositories/` | All DB queries. Return domain objects, never raw DB rows. | `packages/db` (Prisma client) | `services/`, HTTP, Kafka |
| `events/` | Publish/consume Kafka events. Map to/from domain types. | `services/` | `repositories/` directly |

> **Rule: No raw SQL outside `repositories/`**
> Every database interaction goes through a repository function. A service that calls `prisma.bus.findMany()` directly is a bug — move it to `bus.repository.ts`. This makes every DB operation discoverable and testable in one place.

### 3.3 File Naming Rules — Backend

| File Type | Convention | Examples |
|---|---|---|
| Route file | `{entity}.routes.ts` | `bus.routes.ts`, `trip.routes.ts` |
| Controller file | `{entity}.controller.ts` | `bus.controller.ts` |
| Service file | `{entity}.service.ts` | `eta.service.ts`, `bus.service.ts` |
| Repository file | `{entity}.repository.ts` | `bus.repository.ts` |
| Schema file | `{entity}.schema.ts` | `bus.schema.ts` |
| Middleware file | `{name}.middleware.ts` | `auth.middleware.ts` |
| Event producer | `{entity}.producer.ts` | `gps.producer.ts` |
| Event consumer | `{entity}.consumer.ts` | `gps.consumer.ts` |
| Test file | `{file}.test.ts` | `bus.service.test.ts` |
| Fixture file | `{entity}.fixture.ts` | `bus.fixture.ts` |
| Type file | `{name}.types.ts` or `types/internal.ts` | — |

### 3.4 Index Files

Every folder that exports things **must** have an `index.ts` that re-exports. Consumers import from the folder, not the file. This lets you refactor internals without updating import paths everywhere.

```ts
// ✅ CORRECT — import from folder
import { BusService } from '@/services'
import { BusRepository } from '@/repositories'

// ❌ WRONG — import from specific file
import { BusService } from '@/services/bus.service'

// services/index.ts
export { BusService } from './bus.service'
export { RouteService } from './route.service'
export { ETAService } from './eta.service'
```

---

## 4. TypeScript Standards

### 4.1 Strict Mode — Non-Negotiable

All TypeScript configs extend from the root `tsconfig.base.json` with strict mode enabled. There are **no exceptions**. If you cannot type something, the solution is never `any` — it is always understanding the type better.

```jsonc
// tsconfig.base.json (root — all services extend this)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,                    // Enables all strict flags
    "noUncheckedIndexedAccess": true,  // arr[0] is T | undefined, not T
    "noImplicitReturns": true,         // Every code path must return
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": false,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}

// apps/route-service/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

### 4.2 Type Definitions

**✅ DO**
- Use `interface` for object shapes that represent domain entities
- Use `type` for unions, intersections, utility types
- Use Zod for runtime validation — infer static types from schemas
- Use `const` enums or string literal unions instead of plain enums
- Export types from `packages/types/` for cross-service sharing

**❌ DO NOT**
- Never use `any`. Use `unknown` and narrow it, or use generics.
- Never use `as Type` casts except at system boundaries (parsing external data)
- Never use `!` non-null assertions — handle the null case explicitly
- Never define the same type in two services — extract to `packages/types/`
- Never use `Object`, `object`, `Function`, or `{}` as types

```ts
// ✅ Domain entity — use interface
interface Bus {
  readonly id: string
  readonly tenantId: string
  regNumber: string
  deviceImei: string | null      // Explicit null — not undefined
  capacity: number
  active: boolean
  createdAt: Date
}

// ✅ Union type for state
type TripStatus = 'idle' | 'active' | 'completed' | 'cancelled'

// ✅ Zod schema — single source of truth for validation AND types
import { z } from 'zod'

export const CreateBusSchema = z.object({
  regNumber: z.string().min(4).max(20),
  deviceImei: z.string().length(15).nullable(),
  capacity: z.number().int().min(1).max(100),
})

export type CreateBusInput = z.infer<typeof CreateBusSchema>
// ↑ Type is derived from schema — never written manually

// ❌ NEVER do this
function processData(data: any) { ... }    // any = bug waiting to happen
const bus = result as Bus                  // Cast = lying to the compiler
const name = user!.name                    // ! = crash waiting to happen
```

### 4.3 Async / Error Handling

**Rules:**
- All async functions must be fully awaited — never fire-and-forget
- Never swallow errors with empty catch blocks
- Use typed error classes — never `throw "string"`
- Every Kafka consumer must have a dead letter queue handler

```ts
// packages/errors/src/index.ts

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
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

export class UnauthorizedError extends AppError {
  constructor(reason: string) {
    super('UNAUTHORIZED', reason, 401)
  }
}

// ✅ Service function — throws typed error, never swallows
async function getBus(id: string, tenantId: string): Promise<Bus> {
  const bus = await busRepository.findById(id, tenantId)
  if (!bus) throw new NotFoundError('Bus', id)
  return bus
}

// ❌ NEVER do this
try {
  await doSomething()
} catch (e) {
  // swallowed — the error is gone, the bug is invisible
}
```

---

## 5. Naming Conventions

Names are the primary documentation. A well-named function needs no comment.

### 5.1 Universal Rules

| What | Convention | Examples |
|---|---|---|
| Variables | `camelCase` | `busId`, `tenantSlug`, `activeTrip` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_SPEED_KMH`, `DEFAULT_GEOFENCE_RADIUS` |
| Functions / Methods | `camelCase`, verb-first | `getBus()`, `createTrip()`, `calculateETA()` |
| Classes | `PascalCase` | `BusService`, `TripRepository`, `AppError` |
| Interfaces | `PascalCase`, no `I` prefix | `Bus`, `TripEvent`, `CreateBusInput` |
| Type aliases | `PascalCase` | `TripStatus`, `NotificationChannel` |
| Enums | `PascalCase` for name and values | `TripStatus.Active` (not `ACTIVE`) |
| Files | `kebab-case.suffix.ts` | `bus.service.ts`, `eta.service.ts` |
| Folders | `kebab-case` | `route-service/`, `stream-processor/` |
| Env variables | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET` |
| Database tables | `snake_case`, plural | `buses`, `gps_telemetry`, `trip_events` |
| DB columns | `snake_case` | `tenant_id`, `device_imei`, `created_at` |
| Kafka topics | `dot.separated`, domain first | `saferide.gps.raw`, `saferide.alerts` |
| Redis keys | `colon:separated`, entity first | `bus:state:{busId}`, `trip:eta:{tripId}` |
| API endpoints | `kebab-case`, plural nouns, no verbs | `/buses`, `/buses/:id/trips`, `/routes/:id/stops` |

### 5.2 Function Naming Vocabulary

Use consistent verb prefixes so any engineer can predict what a function does before reading it.

| Prefix | Meaning | Returns | Examples |
|---|---|---|---|
| `get` | Fetch one or more records. **Throws** if not found. | `T` or `T[]` | `getBus()`, `getActiveTrips()` |
| `find` | Fetch that may return null. **Never throws.** | `T \| null` | `findBusByImei()`, `findActiveTrip()` |
| `create` | Insert new record. Returns created entity. | `T` | `createBus()`, `createTrip()` |
| `update` | Modify existing record. Throws if not found. | `T` | `updateBusRoute()`, `updateTripStatus()` |
| `delete` | Remove record. Throws if not found. | `void` | `deleteBus()`, `deleteRoute()` |
| `list` | Fetch multiple with optional filters/pagination. | `PaginatedResult<T>` | `listBusesByTenant()` |
| `validate` | Check data correctness. Throws if invalid. | `void` | `validateRouteStops()` |
| `calculate` | Compute a derived value. **Pure function.** | `T` | `calculateETA()`, `calculateDistance()` |
| `build` | Construct an object/payload from inputs. | `T` | `buildNotificationPayload()` |
| `handle` | Process an event. Used in consumers/handlers. | `Promise<void>` | `handleGpsEvent()`, `handleSOSAlert()` |
| `send` | Dispatch a notification or message. | `Promise<void>` | `sendPushNotification()`, `sendSMS()` |
| `emit` | Publish a Kafka event. | `Promise<void>` | `emitTripStarted()` |
| `is` / `has` | Boolean check. **Always returns boolean.** | `boolean` | `isActiveBus()`, `hasActiveTrip()` |

---

## 6. API Design Standards

### 6.1 URL Structure

```
# Pattern: /api/v1/{resource}[/{id}[/{sub-resource}]]

# Buses
GET    /api/v1/buses                     → List all buses for tenant
POST   /api/v1/buses                     → Create a bus
GET    /api/v1/buses/:busId              → Get single bus
PATCH  /api/v1/buses/:busId              → Partial update
DELETE /api/v1/buses/:busId              → Delete

# Trips (sub-resource of bus)
GET    /api/v1/buses/:busId/trips        → List trips for bus
GET    /api/v1/trips/:tripId             → Get single trip
POST   /api/v1/trips/:tripId/start       → Start trip (action on resource)
POST   /api/v1/trips/:tripId/end         → End trip

# Routes
GET    /api/v1/routes                    → List all routes
POST   /api/v1/routes                    → Create route
GET    /api/v1/routes/:routeId           → Get route with stops
POST   /api/v1/routes/:routeId/stops     → Add a stop
```

**Rules:**
- ✅ Plural nouns: `/buses` not `/bus`
- ✅ No verbs in URL: `/trips/:id/start` not `/startTrip`
- ✅ Kebab-case: `/route-stops` not `/routeStops`
- ✅ Version prefix: `/api/v1/` on all routes
- ❌ Never: `/getActiveBuses`, `/api/bus`, `/Buses`

### 6.2 Response Shape

Every API response wraps the payload in a consistent envelope.

```ts
// packages/types/src/api.types.ts

// Success response
interface ApiResponse<T> {
  success: true
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

// Error response
interface ApiErrorResponse {
  success: false
  error: {
    code: string        // Machine-readable: "BUS_NOT_FOUND"
    message: string     // Human-readable: "Bus not found"
    details?: unknown   // Validation errors, field-level info
  }
}

// ✅ All responses look like this:
// Success:  { success: true, data: { id: "...", regNumber: "KA05..." } }
// Error:    { success: false, error: { code: "BUS_NOT_FOUND", message: "..." } }
// List:     { success: true, data: [...], meta: { total: 42, page: 1, limit: 20 } }

// ❌ These are banned:
// { status: "ok", result: ... }         ← inconsistent envelope
// { buses: [...] }                       ← no envelope
// { error: "not found" }                 ← string error, not object
```

### 6.3 HTTP Status Codes

| Situation | Status | Notes |
|---|---|---|
| Successful GET / PATCH | `200 OK` | Resource found and returned |
| Successful POST (created) | `201 Created` | Always for resource creation |
| Successful DELETE | `204 No Content` | No body returned |
| Async job accepted | `202 Accepted` | For fire-and-forget operations |
| Validation error | `400 Bad Request` | Invalid input — include field details |
| Missing / invalid auth token | `401 Unauthorized` | Not 403 — token issue |
| Valid token but insufficient role | `403 Forbidden` | Not 401 — authorisation issue |
| Resource not found | `404 Not Found` | Never 200 with empty data |
| Business rule violation | `409 Conflict` | e.g. duplicate reg number |
| Rate limit hit | `429 Too Many Requests` | Include `Retry-After` header |
| Server / unexpected error | `500 Internal Server Error` | Never expose stack trace to client |

---

## 7. Database Conventions (Prisma + PostgreSQL)

### 7.1 Schema Rules

```prisma
// packages/db/prisma/schema.prisma

// RULE 1: Every table has these four fields — no exceptions
model Bus {
  id        String   @id @default(cuid())   // cuid() not uuid() — shorter, URL-safe
  tenantId  String                           // Multi-tenancy — always present
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Domain fields
  regNumber  String
  deviceImei String?   // Optional fields use ? not default null
  capacity   Int
  active     Boolean   @default(true)

  // Relations — always explicit
  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  trips   Trip[]

  // Indexes — every foreign key must be indexed
  @@index([tenantId])
  @@index([tenantId, active])             // Composite for common query pattern
  @@unique([tenantId, regNumber])         // Business constraint at DB level
  @@map("buses")                          // Table name: snake_case plural
}

// RULE 2: Enum values — PascalCase in Prisma, stored as string in DB
enum TripStatus {
  Idle
  Active
  Completed
  Cancelled
}
```

### 7.2 Migration Rules

1. **Never edit** a migration file after it has been committed.
2. Migration names must be descriptive: `add_device_imei_to_buses`, not `migration_001`.
3. Every migration must be reversible — include a down migration comment.
4. Never drop a column in the same migration that removes it from the schema — add a deprecation period.
5. Always run `prisma migrate dev --name {description}` — never edit `schema.prisma` without generating a migration.

### 7.3 Repository Pattern

```ts
// repositories/bus.repository.ts
import { prisma } from '@saferide/db'
import type { Bus, Prisma } from '@saferide/db'
import type { ListBusesFilter } from '@/types/internal'

// RULE: Repository functions always take tenantId as first or explicit argument.
// You cannot accidentally query across tenants.

export const busRepository = {

  // find* returns T | null — never throws for "not found"
  async findById(id: string, tenantId: string): Promise<Bus | null> {
    return prisma.bus.findFirst({
      where: { id, tenantId }    // tenantId ALWAYS in where clause
    })
  },

  // get* throws if not found — used when the record must exist
  async getById(id: string, tenantId: string): Promise<Bus> {
    const bus = await this.findById(id, tenantId)
    if (!bus) throw new NotFoundError('Bus', id)
    return bus
  },

  // List functions return { items, total } — always paginated
  async list(tenantId: string, filter: ListBusesFilter) {
    const { page = 1, limit = 20, active } = filter
    const where: Prisma.BusWhereInput = {
      tenantId,
      ...(active !== undefined && { active })
    }
    const [items, total] = await Promise.all([
      prisma.bus.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.bus.count({ where })
    ])
    return { items, total, page, limit }
  },

} as const
```

---

## 8. Event & Kafka Conventions

### 8.1 Event Schema Rules

```ts
// packages/types/src/events/gps.events.ts

// RULE 1: Event names are past-tense noun phrases
// ✅ GpsLocationReceived, TripStarted, SOSTriggered
// ❌ ReceiveGps, StartTrip, TriggerSOS

// RULE 2: Every event has this base shape
interface BaseEvent {
  readonly eventId:      string   // Unique ID for deduplication
  readonly eventType:    string   // Discriminator: "GpsLocationReceived"
  readonly tenantId:     string   // Always present — never omit
  readonly occurredAt:   string   // ISO 8601 — when it happened on device
  readonly publishedAt:  string   // ISO 8601 — when we ingested it
  readonly version:      number   // Schema version — start at 1
}

export interface GpsLocationReceived extends BaseEvent {
  readonly eventType: 'GpsLocationReceived'
  readonly version: 1
  readonly payload: {
    readonly busId:       string
    readonly deviceId:    string
    readonly tripId:      string | null
    readonly lat:         number
    readonly lng:         number
    readonly speedKmh:    number   // RULE 3: Unit in field name
    readonly headingDeg:  number
  }
}

// RULE 4: All fields are readonly — events are immutable
// RULE 5: Payloads use camelCase, not snake_case
```

### 8.2 Topic Naming

```
# Pattern: {platform}.{domain}.{event-noun}

saferide.gps.location-received      ← GPS telemetry from devices/drivers
saferide.gps.sos-triggered           ← Emergency/panic button event
saferide.trips.started               ← Driver started a trip
saferide.trips.ended                 ← Driver ended a trip
saferide.trips.deviation-detected    ← Bus went off route
saferide.alerts.speed-exceeded       ← Bus exceeded speed threshold
saferide.notifications.requested     ← Notification to be sent
saferide.notifications.delivered     ← FCM/SMS delivery confirmed

# Dead letter topics — failed processing goes here
saferide.gps.location-received.dlq
saferide.notifications.requested.dlq

# Rules:
# ✅ Lowercase, hyphen-separated event noun
# ✅ Past tense for event topics
# ✅ DLQ topics are {original-topic}.dlq
# ❌ Never: saferide_gps_location, GPS.Received, SAFERIDE.GPS
```

---

## 9. Mobile App Structure (React Native)

### 9.1 Folder Layout

```
apps/mobile/
├── src/
│   ├── app/                       ← Expo Router: file-based navigation
│   │   ├── (auth)/                ← Auth group: login, otp, onboarding
│   │   │   ├── login.tsx
│   │   │   └── otp.tsx
│   │   ├── (parent)/              ← Parent group: home, history, profile
│   │   │   ├── index.tsx          ← Home screen (live map)
│   │   │   ├── history.tsx
│   │   │   └── profile.tsx
│   │   ├── (driver)/              ← Driver group: trip controls
│   │   │   ├── index.tsx
│   │   │   └── sos.tsx
│   │   └── _layout.tsx            ← Root layout with auth gate
│   │
│   ├── components/                ← Reusable UI components
│   │   ├── ui/                    ← Primitive: Button, Text, Card, Badge
│   │   ├── map/                   ← Map-specific: BusMarker, RoutePolyline
│   │   ├── trip/                  ← Domain: TripCard, ETABadge, StopList
│   │   └── notifications/         ← NotificationBanner, AlertToast
│   │
│   ├── store/                     ← Zustand global state
│   │   ├── auth.store.ts
│   │   ├── livetrack.store.ts
│   │   ├── trips.store.ts
│   │   └── index.ts
│   │
│   ├── hooks/                     ← Custom hooks
│   │   ├── useWebSocket.ts        ← WS connection lifecycle
│   │   ├── useLiveTrack.ts        ← Subscribes to bus location
│   │   ├── useBackgroundGPS.ts    ← Driver: background location task
│   │   └── useETANotification.ts  ← Local notification scheduling
│   │
│   ├── api/                       ← React Query hooks for HTTP calls
│   │   ├── client.ts              ← Axios instance with interceptors
│   │   ├── buses.api.ts
│   │   ├── trips.api.ts
│   │   └── auth.api.ts
│   │
│   ├── tasks/                     ← Expo background tasks
│   │   ├── gps-broadcast.task.ts  ← Driver GPS background broadcast
│   │   └── notification.task.ts
│   │
│   ├── constants/
│   │   ├── colors.ts              ← Design tokens — never magic hex values inline
│   │   ├── dimensions.ts          ← Spacing, radius, font sizes
│   │   └── config.ts              ← API URLs, feature flags
│   │
│   └── utils/                     ← Pure utility functions
│       ├── geo.ts                 ← Distance, bearing calculations
│       ├── format.ts              ← ETA display, date formatting
│       └── permissions.ts         ← Location permission helpers
│
├── assets/
└── app.config.ts
```

### 9.2 Component Rules

1. One component per file. File name matches component name: `BusMarker.tsx` exports `BusMarker`.
2. Use **function declarations**, not arrow functions, for root components.
3. Props interface named `{ComponentName}Props` — defined in the same file, above the component.
4. No inline styles — use `StyleSheet.create()` at the bottom of the file.
5. No business logic in components — extract to hooks or services.
6. Every screen component is in `app/`. Reusable UI is in `components/`.
7. Use `React.memo()` only for measured performance bottlenecks — not by default.

```tsx
// ✅ Correct component structure
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/ui'
import { COLORS } from '@/constants/colors'

// Props interface — named, above component, exported
export interface ETABadgeProps {
  etaMinutes: number
  isLate: boolean
}

// Function declaration — not arrow function for root component
export function ETABadge({ etaMinutes, isLate }: ETABadgeProps) {
  const label = etaMinutes <= 0 ? 'Arrived' : `${etaMinutes} min`

  return (
    <View style={[styles.badge, isLate && styles.late]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

// StyleSheet at the bottom — no magic numbers
const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.green100,
  },
  late: { backgroundColor: COLORS.red100 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.green800 },
})

// ❌ Wrong patterns:
// const ETABadge = (props) => { ... }    ← arrow function for root component
// style={{ marginTop: 16 }}              ← inline style
// if (!etaMinutes) return null            ← business logic in component
```

---

## 10. Admin Web App Structure (React + Vite)

### 10.1 Folder Layout

```
apps/web-admin/
├── src/
│   ├── pages/                     ← Route-level pages (one per URL)
│   │   ├── dashboard/
│   │   │   ├── DashboardPage.tsx
│   │   │   └── components/        ← Page-local components (NOT reusable)
│   │   ├── buses/
│   │   ├── routes/
│   │   ├── drivers/
│   │   └── settings/
│   │
│   ├── components/                ← Shared components across pages
│   │   ├── ui/                    ← Primitive: Button, Input, Badge, Table
│   │   ├── map/                   ← FleetMap, BusMarker, RouteLayer
│   │   └── layout/                ← Sidebar, TopNav, PageWrapper
│   │
│   ├── features/                  ← Stateful feature modules
│   │   ├── live-tracking/         ← WebSocket, live fleet map state
│   │   ├── alerts/                ← Alert feed, SOS handling
│   │   └── reporting/             ← Trip export, CSV/PDF generation
│   │
│   ├── store/                     ← Zustand global state
│   ├── api/                       ← React Query + Axios API hooks
│   ├── hooks/                     ← Custom hooks
│   ├── constants/
│   └── utils/
│
└── index.html
```

### 10.2 Page vs Component Rule

| Type | Location | Rule |
|---|---|---|
| Page | `pages/{feature}/{Name}Page.tsx` | Routed. Composes features & components. No UI primitives directly. |
| Page-local component | `pages/{feature}/components/` | Used by **one** page only. Move to `components/` when reused by a second page. |
| Shared component | `components/` | Used by 2+ pages. Has **no data fetching** — receives props only. |
| Feature module | `features/{feature}/` | Encapsulates complex stateful feature: WebSocket management, real-time alerts. |

---

## 11. Shared Package Conventions (`packages/`)

Packages are the backbone of consistency. Every package must be independently buildable, testable, and versioned. A package that cannot be built in isolation has hidden dependencies — fix it.

### 11.1 Package Structure

```
packages/types/                    ← Example shared package
├── src/
│   ├── index.ts                   ← Single public entry point — exports everything
│   ├── api.types.ts
│   ├── domain/
│   │   ├── bus.types.ts
│   │   ├── trip.types.ts
│   │   └── user.types.ts
│   └── events/
│       ├── gps.events.ts
│       ├── trip.events.ts
│       └── index.ts
├── package.json
└── tsconfig.json
```

```ts
// How services import from packages
import type { Bus, CreateBusInput } from '@saferide/types'
import { prisma } from '@saferide/db'
import { logger } from '@saferide/logger'
import { AppError, NotFoundError } from '@saferide/errors'

// Package names use @saferide/ scope in package.json:
// "name": "@saferide/types"
// Referenced in services: "dependencies": { "@saferide/types": "workspace:*" }
```

### 11.2 The Logger Package

Every service uses `@saferide/logger`. **No `console.log` anywhere in production code.** Structured JSON logs are the only valid format.

```ts
// ✅ Correct — structured with context
logger.info({ busId, tenantId, lat, lng }, 'GPS location received')
logger.error({ error, busId }, 'Failed to update bus position')
logger.warn({ busId, speed }, 'Speed threshold exceeded')

// ❌ NEVER in production code
console.log('GPS received:', data)     // Not structured, not searchable
console.error(error)                   // No context, impossible to correlate
logger.info('doing thing')             // No fields — useless in production
```

---

## 12. Testing Standards

### 12.1 Test Pyramid

| Level | What to test | Tool | Coverage Target | Speed |
|---|---|---|---|---|
| Unit | Services, utilities, pure functions — no DB, no HTTP | Vitest | 80% of `services/` | <1s per test |
| Integration | API routes with real DB (Docker) | Supertest + Vitest | All P0 endpoints | <10s per test |
| E2E | Critical user flows only (login, create bus, live track) | Playwright | 5–10 key journeys | <60s per test |

### 12.2 Test File Conventions

```ts
// tests/unit/bus.service.test.ts

// RULE: describe block = the thing being tested
// RULE: it() = specific behaviour, sentence format
describe('BusService', () => {

  describe('getBus', () => {
    it('returns the bus when it exists for the tenant', async () => { ... })
    it('throws NotFoundError when bus does not exist', async () => { ... })
    it('throws NotFoundError when bus belongs to a different tenant', async () => { ... })
  })

  describe('createBus', () => {
    it('creates a bus with valid input', async () => { ... })
    it('throws ConflictError when reg number already exists for tenant', async () => { ... })
  })
})

// RULE: Every test follows Arrange-Act-Assert (AAA)
it('throws NotFoundError when bus does not exist', async () => {
  // Arrange
  const nonExistentId = 'bus_does_not_exist'
  const tenantId = 'tenant_abc'
  busRepository.findById = vi.fn().mockResolvedValue(null)

  // Act
  const act = () => busService.getBus(nonExistentId, tenantId)

  // Assert
  await expect(act()).rejects.toThrow(NotFoundError)
})

// RULE: Use fixtures for test data — never inline magic values
import { createBusFixture } from '@/tests/fixtures/bus.fixture'
const bus = createBusFixture({ tenantId: 'tenant_abc' })
```

### 12.3 What We Do Not Test

- Prisma-generated code — already tested by Prisma
- Third-party SDK internals (FCM, AWS SDK)
- Framework boilerplate (Fastify plugin registration)
- One-liner getters and setters with no logic

---

## 13. Git & PR Conventions

### 13.1 Branch Naming

```
# Pattern: {type}/{ticket-id}-{short-description}

feat/SR-142-add-bus-crud-endpoints
fix/SR-209-gps-latency-spike-on-reconnect
chore/SR-300-upgrade-prisma-5
docs/SR-401-update-api-readme
refactor/SR-188-extract-eta-service

# Types:
# feat      — new feature
# fix       — bug fix
# chore     — maintenance, dependency updates
# docs      — documentation only
# refactor  — code change with no behaviour change
# test      — adding or fixing tests
# hotfix    — emergency production fix
```

### 13.2 Commit Message Format (Conventional Commits)

```
# Pattern: {type}({scope}): {short description}
#
# Body (optional): explain WHY, not WHAT
# Footer (optional): BREAKING CHANGE or Closes #ticket

# ✅ Good examples
feat(route-service): add stop reordering endpoint
fix(stream-processor): handle null tripId in GPS events
chore(deps): upgrade kafka.js to 2.2.4
refactor(telemetry-ingestor): extract MQTT auth to separate module

# ✅ With body for complex change
fix(livetrack-gateway): prevent memory leak on client disconnect

Redis pub/sub subscriptions were not being cleaned up when a WebSocket
client disconnected. After 100+ reconnections this caused the process
to consume ~2GB RAM. Now unsubscribing in the disconnect handler.

Closes SR-287

# ❌ Bad — these will be rejected in PR review
fixed stuff
WIP
update
changes
```

### 13.3 PR Rules

**Checklist before requesting review:**

- [ ] PR title follows conventional commit format
- [ ] Description explains WHAT changed and WHY (not just "see diff")
- [ ] All new functions have tests — unit or integration
- [ ] No `console.log`, TODO comments, or debug code left in
- [ ] No new `any` types introduced
- [ ] Database migration included if schema changed
- [ ] `packages/types` updated if API contract changed
- [ ] `pnpm run lint` passes with zero warnings
- [ ] `pnpm run typecheck` passes with zero errors
- [ ] Linked to Jira ticket in description

**PR size policy:**

| PR Size | Line Count | Policy |
|---|---|---|
| Small | <200 lines | Merge same day. Target this as the default. |
| Medium | 200–500 lines | Needs 1 reviewer approval. Review within 24 hours. |
| Large | 500+ lines | Must be split unless it is a single migration. Talk to the team first. |
| Epic | 1000+ lines | Not allowed without architecture sign-off. Always split. |

---

## 14. Environment & Configuration

### 14.1 Config Validation Pattern

Every service validates all environment variables at startup using Zod. **A service that starts with a missing config is a production incident waiting to happen. Fail fast, fail loud.**

```ts
// apps/route-service/src/config.ts
import { z } from 'zod'

const ConfigSchema = z.object({
  // Server
  PORT:     z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'test', 'production']),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Kafka
  KAFKA_BROKERS:   z.string().transform(s => s.split(',')),
  KAFKA_CLIENT_ID: z.string(),

  // Auth
  JWT_SECRET: z.string().min(32),

  // Optional with defaults
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

// Validate at module load time — service crashes immediately if invalid
const parsed = ConfigSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid configuration:', parsed.error.format())
  process.exit(1)    // Hard exit — do not start with broken config
}

export const config = parsed.data
// Usage: import { config } from '@/config'  ← typed, validated
```

### 14.2 `.env` File Rules

```bash
# .env.example  — committed to git, has ALL keys with placeholder values
# .env.local    — gitignored, developer's actual values
# .env.test     — gitignored, test environment values

# ✅ .env.example (committed — always kept up to date)
DATABASE_URL=postgresql://user:password@localhost:5432/saferide
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=change-me-must-be-at-least-32-characters-long
LOG_LEVEL=info
```

**Rules:**
- ✅ `.env.example` is **always** up to date — update it when adding a new env var
- ❌ Never commit `.env`, `.env.local`, or any file with real secrets
- ❌ Never hardcode URLs, secrets, or environment-specific values in code
- ❌ Never access `process.env` directly in application code — always via `config.ts`

---

## 15. Linting & Formatting

Formatting is never discussed in code review. Prettier handles it. Linting enforces architectural rules that cannot be expressed as types. Both run in CI — **a failing lint blocks merge**.

### 15.1 Key ESLint Rules

| Rule | Why |
|---|---|
| `no-console: error` | Use `@saferide/logger` — `console.log` is invisible in production logs |
| `@typescript-eslint/no-explicit-any: error` | `any` defeats TypeScript — use `unknown` and narrow |
| `@typescript-eslint/no-floating-promises: error` | Unhandled promises are silent failures |
| `import/no-cycle: error` | Circular imports cause subtle startup bugs and unclear ownership |
| `no-restricted-imports (process.env)` | Must go through `config.ts` — never raw `process.env` |
| `@typescript-eslint/explicit-function-return-type: warn` | Makes function contracts explicit at a glance |
| `no-unused-vars: error` | Dead code is confusion — delete it |

### 15.2 Pre-commit Hooks

```bash
# .husky/pre-commit — runs before every commit
pnpm lint-staged

# lint-staged config in package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings=0",
    "prettier --write"
  ],
  "*.{json,md,yaml}": [
    "prettier --write"
  ]
}
```

> If lint fails, the commit is aborted. Bypassing with `--no-verify` is **not permitted** in this project.

---

## 16. Quick Reference Card

> When in doubt, consult this before opening a new file.

| Decision | Answer |
|---|---|
| Where does business logic go? | `services/` — never in `routes/`, `controllers/`, or `repositories/` |
| Where do DB queries go? | `repositories/` — never anywhere else |
| I need a type used by 2 services | `packages/types/` — export it, import with `@saferide/types` |
| I need to log something | `@saferide/logger` — `logger.info({ context }, 'message')` |
| I need to throw an error | `@saferide/errors` — `throw new NotFoundError()` or `AppError` |
| I need to read an env var | `config.ts` in the service — never `process.env` directly |
| Should I use `any`? | No. Use `unknown` and narrow, or use a generic. |
| Should I use `!` (non-null assertion)? | No. Handle the null case. |
| How do I name a boolean function? | Prefix with `is` or `has` — `isBusActive()`, `hasActiveTrip()` |
| How do I name a DB fetch that might miss? | Prefix with `find` — `findById()` returns `T \| null` |
| How do I name a DB fetch that must succeed? | Prefix with `get` — `getById()` throws if not found |
| My PR is 700 lines. Is that OK? | No. Split it. Talk to the team. |
| I want to skip lint with `--no-verify` | No. Fix the lint error. |
| New env variable needed? | Add to `config.ts` schema **AND** `.env.example` — both, always |
| `console.log` just for debugging? | No. Remove it before committing. Use the logger. |

---

*SafeRide Engineering Standards v1.0 — Questions? Post in `#engineering-standards`. Disputes resolved by architecture review, not PR comments.*
