# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SafeRide is a school bus tracking and parent notification platform — a multi-tenant SaaS monorepo built with TypeScript, React Native, and microservices.

## Directory Structure

Currently flat — services are added as top-level directories as they are built.

- `mobile/` — React Native + Expo Router app (single app, all 4 roles)
- `packages/` — shared libraries (added when backend services begin)

Future services will be added as: `auth-service/`, `route-service/`, `web-admin/`, etc. at the root level. A monorepo tool (Turborepo + pnpm workspaces) will be wired up when the second service is added.

## Commands

```bash
pnpm install                          # Install all workspace dependencies
pnpm dev                              # Run all services with hot reload
pnpm dev --filter route-service       # Run a single service
pnpm build                            # Build all (Turborepo cached)
pnpm build --filter route-service     # Build single service
pnpm test                             # Run all tests (Vitest)
pnpm test --filter route-service      # Test single service
pnpm test:watch                       # Watch mode
pnpm test:coverage                    # Coverage report (must not regress)
pnpm lint                             # ESLint all workspaces
pnpm typecheck                        # TypeScript strict check (zero errors required)
pnpm format                           # Prettier all
```

## Architecture

### Backend Service Layers (strict, no exceptions)

Every backend service follows this exact layering:

```
routes/        → HTTP parsing only, call controller, return response
controllers/   → Orchestration: call services, assemble DTOs
services/      → All business logic and transformations
repositories/  → All Firestore queries — no direct db calls elsewhere
```

Rules:
- Zero business logic in routes or controllers
- Services can call other services; repositories cannot call services
- All Firestore access through repositories only

### Shared Packages

- `packages/types` — Shared TypeScript interfaces and Zod schemas; update when API contracts change
- `packages/firebase-admin` — Firebase Admin SDK wrapper; call `initFirebaseAdmin()` at service startup, then `getDb()` anywhere
- `packages/middleware` — Express middleware: `verifyJwt`, `requireRole`, `validateBody`, rate limiters, `errorHandler`
- `packages/logger` — Pino structured logger; never use `console.log`

### Real-Time Data Flow (Phase 2 — not yet built)

```
Driver phone GPS → trip-service → Firestore (gps_telemetry)
                                        ↓
                          livetrack-gateway → WebSocket → mobile (parent app)
```

### Mobile App (React Native + Expo Router)

File-based routing under `mobile/app/`:
- `(auth)/` — Login, OTP, onboarding
- `(parent)/` — Home/map, history, profile
- `(driver)/` — Trip controls, SOS

State: Zustand stores in `src/store/`. Real-time: `useWebSocket` / `useLiveTrack` hooks. Background GPS: Expo background tasks in `src/tasks/`.

### Web Admin (React + Vite)

Pages under `apps/web-admin/src/pages/`. Shared UI primitives in `packages/ui`. State via Zustand + React Query for server state.

## TypeScript Standards

- **Strict mode is mandatory** — no exceptions
- Use `interface` for domain entities, `type` for unions/utilities
- Use Zod for runtime validation and infer static types from schemas
- Never use `any` (use `unknown` + narrowing), `as` casts (except at system boundaries), or `!` non-null assertions
- ESLint blocks: `no-console`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-floating-promises`, `import/no-cycle`

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Variables, functions | camelCase, verb-first | `getBus`, `activeTrip` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SPEED_KMH` |
| Classes | PascalCase | `BusService`, `TripRepository` |
| Files | kebab-case | `bus.service.ts`, `eta.service.ts` |
| Firestore collections | camelCase plural | `buses`, `gpsTelemetry` |
| API endpoints | kebab-case plural nouns | `/buses`, `/routes/:id/stops` |

Function prefixes: `get*` throws if not found, `find*` returns `T | null`, `list*` returns `PaginatedResult<T>`, `is*`/`has*` returns boolean.

## Database (Firestore)

- Every document has `id` (Firestore auto-ID), `tenantId`, `createdAt` (ms), `updatedAt` (ms)
- **Multi-tenancy enforced**: every Firestore query must include `.where('tenantId', '==', tenantId)`
- `tenantId` always comes from `req.user.tenantId` (set by `verifyJwt`) — never from the request body
- Collections are flat root-level (not nested under `tenants/`): `buses`, `routes`, `stops`, `students`, `drivers`, `trips`, `gpsTelemetry`
- All Firestore access goes through repository classes — never call `getDb()` directly in services or controllers

## API Contract

URL: `/api/v1/{resource}[/{id}[/{sub-resource}]]`

All responses use this envelope:
```ts
// Success
{ success: true, data: {...}, meta?: { page, limit, total } }
// Error
{ success: false, error: { code: "BUS_NOT_FOUND", message: "...", details?: {...} } }
```

HTTP codes: 201 for POST creation, 204 for DELETE, 409 for business rule violations.

## Test-Driven Development (TDD)

**TDD is mandatory.** No implementation code is written before a failing test exists for it.

### The TDD Cycle

For every function, service method, API route, or component:

1. **Write the test first** — define the expected behavior before any implementation exists; the test must fail (red)
2. **Write the minimum implementation** to make the test pass (green)
3. **Refactor** — clean up implementation without breaking tests
4. **Run tests** — always execute the full relevant test suite after each change to confirm nothing regressed
5. **Expand coverage** — add edge-case and error-path tests before moving to the next unit

Never skip step 1. A test written after the implementation is not TDD.

### Test Execution

Run tests at every stage — after writing the failing test, after implementing, after refactoring:

```bash
pnpm test --filter <service>          # Run tests for the service you're working in
pnpm test:watch --filter <service>    # Watch mode during active development
pnpm test                             # Full suite — run before any commit
pnpm test:coverage                    # Check coverage report; aim to increase it, never decrease it
```

Coverage must increase (or stay the same) with every PR. Regressions in coverage are not allowed.

### Test Levels

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | Services, utilities — mock repositories |
| Integration | Supertest + Vitest | API routes — mocked Firestore or Firebase emulator |
| E2E | Playwright | Critical user flows only |

### Test Structure and Patterns

- Location: `tests/unit/`, `tests/integration/`, `tests/fixtures/`
- Pattern: AAA (Arrange-Act-Assert) — one clear block per test
- Unit tests mock repositories; integration tests mock Firestore (or use Firebase emulator)
- Each service layer gets its own test file: `bus.service.test.ts`, `bus.repository.test.ts`, etc.
- Test file mirrors source file location: `src/services/bus.service.ts` → `tests/unit/bus.service.test.ts`

### What Must Be Tested

- Every public method on every service (happy path + all error paths)
- Every repository method (via integration tests)
- Every API route (status codes, response envelope shape, auth/tenant isolation)
- Every Zod schema (valid input, each invalid field, boundary values)
- Every utility function in `packages/`

### Coverage Targets

| Scope | Minimum |
|---|---|
| Services (`services/`) | 90% |
| Repositories (`repositories/`) | 85% |
| Routes + controllers | 80% |
| Shared packages (`packages/`) | 85% |
| Overall | 85% |

These are floors, not ceilings. Increase coverage with every feature or fix.

## Environment Variables

- Each service has `src/config.ts` with a Zod schema — service crashes at startup if env is invalid
- `.env.example` is always committed and kept up to date
- Never access `process.env` directly in application code
- Never commit `.env` files with real secrets

## Design System ("Jade Pebble Morning")

Full spec: `saferide_brand_guidelines.html`. Summary below — treat this as law for every UI file.

### Color Palette

| Token | Hex | Role |
|---|---|---|
| `sage` | `#7B9669` | Primary brand · buttons · active states |
| `forest` | `#404E3B` | Headers · text · CTAs · depth |
| `mist` | `#BAC8B1` | Cards · secondary backgrounds |
| `slate` | `#6C8480` | Accent · meta text · icons |
| `stone` | `#E6E6E6` | Base · whitespace · dividers |
| `gold` | `#C2A878` | Premium highlights · alerts · warmth |
| `white` | `#F9F8F5` | Surfaces |
| `ink` | `#2A2A2A` | Dark text |

All tokens live in `src/theme/colors.ts` (mobile) and `src/styles/tokens.css` (web). Never hardcode hex values inline.

### Typography

| Role | Font | Size / Weight | Notes |
|---|---|---|---|
| Display | DM Serif Display | 38px / 400 | Emotional headlines only |
| Heading | DM Serif Display | 24px / 400 | Section titles |
| Subheading | DM Sans | 14px / 500 | Tracked uppercase, UI labels |
| Body | DM Sans | 14px / 400 | All copy |
| Caption | DM Sans | 11px / 400 | Timestamps, metadata |
| Code/data | Monospace | 12px | Bus IDs, ETAs, speeds — sage-colored |

### Spacing

Base-4 scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80`. Prefer multiples of 8 for layout. Never use arbitrary values like 13px or 22px.

### Motion

- `200ms ease-out` — micro interactions (buttons, badges, hover)
- `350ms ease-in-out` — panel transitions, card reveals, map pans
- **No bounce/spring** — this brand is still water

### Icons

Lucide icons, 24px, 2px stroke. No filled icons.

### Rules (non-negotiable)

- **Never** use Sage (`#7B9669`) text on Mist (`#BAC8B1`) background — contrast too low
- **Never** use gradients, drop shadows, or blur effects
- **Never** use more than 3 palette colors in a single component
- **Never** use ALL CAPS in body copy — subheadings only
- **Never** use red for alerts — use Gold (`#C2A878`)
- **Never** use font-weight 700+ — 500 is the maximum
- No inline styles in React Native — use `StyleSheet.create()` only

## Git Conventions

Branch: `{type}/SR-{ticket}-short-description` (e.g., `feat/SR-142-add-bus-crud`)
Commits: Conventional Commits format — `type(scope): description`
PR requirements: zero lint warnings, zero typecheck errors, `firestore.rules` updated if new collections added, `packages/types` updated if API changed, test coverage must not regress (`pnpm test:coverage`).

---

## Product Reference (PRD v2.0)

Full spec: `SafeRide_PRD_v2.md`. This section captures the essentials needed during development.

### Vision

> "Every parent knows their child is safe — from the moment they board the bus to the moment they walk into class."

Brand voice: **Calm, never cold. Precise, never terse. Grounded, never showy. Human, never casual.**
No exclamation marks. No "Amazing!". No flashing red. Parents trust calm.

### Key Personas

| Persona | Role | Core need |
|---|---|---|
| Priya, 34 | Parent | Live map + ETA without calling the driver |
| Ramesh, 42 | Transport Manager | All buses on one screen; zero parent calls |
| Raju, 38 | Driver | Tap Start, forget it — no distraction while driving |
| Sunita, 50 | Principal | Documented proof + legal protection |
| Vivek, 35 | IT Admin / ERP Manager | Set it once, syncs every night |

### Phase 1 Scope (Months 0–6)

- Multi-tenant school onboarding (self-serve, 30-day free trial)
- **Driver app** — background phone GPS, trip start/end, SOS button
- **Parent app** — live map, ETA alerts, push notifications, 7 languages (EN, HI, KN, TA, TE, MR, ML)
- **Live bus video** — WebRTC from driver's phone camera, 720p, <3s latency
- **Video recording** — 30-day rolling HLS storage, incident playback
- **Fleet dashboard** — web portal for transport managers
- **Webhook system** — schools subscribe to trip/safety events
- CSV student import + basic Fedena ERP adapter

### Build Order

1. ✅ **Parent mobile app UI** — core screens done; stubs (profile, notifications, route detail) filled in alongside backend work
2. ✅ **auth-service + tenant-service** — complete
3. **`route-service`** ← current focus — Firestore CRUD for buses, routes, stops, students, drivers; required for real tracking data in mobile and driver app
4. **Mobile stubs** — profile, notifications, route detail screens; fast wins that complete parent UX
5. **Driver GPS + trip lifecycle** — Expo background location task + trip start/end API; prerequisite for real end-to-end tracking
6. **Real-time pipeline** — livetrack-gateway → WebSocket → mobile; replaces mock polling
7. **Manager fleet dashboard** — builds on route-service data and real-time pipeline
8. **Video service** — WebRTC live stream + HLS 30-day recording
9. **Integrations** — webhooks, Fedena ERP adapter, CSV student import

**Dependency rule:** Never build real-time features until the trip lifecycle API is stable.

### Non-Functional Requirements (encode in every build step)

| Requirement | Target |
|---|---|
| GPS update latency (phone → parent app) | < 5 seconds end-to-end |
| Video stream start latency | < 3 seconds |
| API response time p95 | < 300ms |
| App cold start (mid-range Android) | < 2 seconds |
| Concurrent parent sessions | 50,000 at launch |
| Platform uptime (GPS + parent app) | 99.9% |
| Data residency | AWS ap-south-1 (Mumbai) only — never leaves India |

### Key Security & Compliance Rules

- Parent sees **only** buses linked to their own child
- All video stored in AWS ap-south-1 — never outside India
- DPDP 2023: children's location is sensitive personal data; consent required
- JWT sessions: 24-hour expiry, revocable
- Webhook payloads signed with HMAC-SHA256
- Multi-tenancy: DB-level RLS enforced on every query (`tenantId` mandatory)

---

## Security & Abuse Protection

**Security is not optional and not a phase.** Every feature, route, service method, and UI component must be built with these rules from day one. There are no "we'll secure it later" exceptions.

### 1. Authentication — Every Protected Route

- Every backend route except `/health` and `/api/v1/auth/login` must verify a valid JWT before doing anything else
- JWT verification middleware runs **first** in the middleware chain — before validation, before controllers
- Verify both signature (`RS256`) and expiry; reject expired tokens with `401`, not `403`
- Never trust `userId` or `tenantId` from the request body or query string — extract exclusively from the verified JWT payload
- Firebase ID tokens on the mobile side must be verified server-side using the Firebase Admin SDK; never trust the raw token without verification
- Refresh token rotation: issue a new refresh token on every use; invalidate the old one immediately

```ts
// Every protected route — no exceptions
router.use(verifyJwt);          // 1. Auth
router.use(requireTenant);      // 2. Tenant isolation
router.use(validateBody(schema)); // 3. Input validation
// ... then controller
```

### 2. Multi-Tenant Isolation — Zero Cross-Tenant Leakage

- **Every** Firestore query must include `.where('tenantId', '==', tenantId)` — no exceptions
- All repositories accept `tenantId` as an explicit parameter — never derive it inside a repository
- After retrieving a document by ID, always verify `doc.tenantId === tenantId` before returning it (defense-in-depth)
- Firestore security rules (`firestore.rules`) enforce tenant isolation at the platform level — write rules alongside every new collection
- Integration tests must explicitly assert that tenant A cannot read tenant B's data

### 3. Rate Limiting — Every Public-Facing Endpoint

Apply rate limits at the API gateway level **and** inside each service. Never rely on a single layer.

| Endpoint class | Limit | Window |
|---|---|---|
| Auth (login, OTP, password reset) | 5 requests | 15 minutes per IP |
| Account creation | 3 requests | 1 hour per IP |
| GPS telemetry ingest | 60 requests | 1 minute per device |
| Parent read endpoints | 120 requests | 1 minute per user |
| Webhook delivery retries | 10 retries | exponential back-off, max 24h |
| Admin / manager endpoints | 300 requests | 1 minute per user |

- Use Redis (`rate:limit:{endpoint}:{identifier}`) for distributed rate limit counters
- Return `429 Too Many Requests` with a `Retry-After` header
- On mobile: display a calm message — "Too many attempts. Please wait a few minutes." — never expose raw HTTP status to the user

### 4. Input Validation & Sanitization — Every System Boundary

- **Every** HTTP request body, query param, and path param must be validated with a Zod schema before it reaches a controller
- Never pass raw `req.body` to a service or repository
- Sanitize all string inputs: strip leading/trailing whitespace; reject control characters in user-facing fields
- Enforce maximum lengths on every string field (email ≤ 254, name ≤ 100, message ≤ 1000, etc.)
- Validate coordinates: latitude ∈ [−90, 90], longitude ∈ [−180, 180]; reject anything outside
- Never interpolate user-supplied values into file paths, shell commands, or SQL strings

```ts
// Every route — no raw req.body
const body = schema.parse(req.body); // throws ZodError → 400 if invalid
```

### 5. Firebase / Firestore Security Rules

Firestore rules are code. They live in `firestore.rules`, are committed to the repo, and are deployed in CI. They are never edited manually in the Firebase Console.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users may read/write only their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Parents may read only buses linked to their child
    match /buses/{busId} {
      allow read: if request.auth != null
                  && exists(/databases/$(database)/documents/children/$(request.auth.uid))
                  && get(/databases/$(database)/documents/children/$(request.auth.uid)).data.busId == busId;
      allow write: if false; // Backend only
    }

    // GPS telemetry — write from driver only; no direct parent read (served via WebSocket)
    match /telemetry/{docId} {
      allow write: if request.auth != null
                   && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'driver';
      allow read: if false; // Backend only
    }

    // Deny everything else by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 6. Abuse Protection — Login & Account Flows

- **Account lockout**: after 5 consecutive failed login attempts, lock the account for 15 minutes; notify the user via email
- **OTP brute-force protection**: invalidate an OTP after 3 wrong attempts; issue a new OTP only after a 60-second cooldown
- **Credential stuffing mitigation**: log and alert when a single IP attempts > 10 distinct accounts in 5 minutes; automatically block the IP for 1 hour
- **Bot detection**: require a CAPTCHA (hCaptcha, invisible) on account creation and password reset flows in production
- **Password strength**: minimum 8 characters, at least one letter and one number; reject common passwords against a top-10k blocklist
- **Email enumeration prevention**: password reset and OTP flows always return the same response whether the email exists or not ("If this email is registered, you'll receive a link shortly.")

### 7. JWT Security

- Algorithm: `RS256` (asymmetric) — never `HS256` with a shared secret in a multi-service architecture
- Access token TTL: 15 minutes; refresh token TTL: 30 days
- Store the refresh token in `HttpOnly, Secure, SameSite=Strict` cookie on web; in the device secure keychain on mobile (not AsyncStorage)
- Maintain a Redis revocation list (`jwt:revoked:{jti}`) for sign-out and security events; check it on every access token verification
- Rotate signing keys quarterly; support key ID (`kid`) in the JWT header for zero-downtime rotation
- Never log JWT payloads or tokens — log only `jti` and `userId`

### 8. Mobile Security

- **No secrets in AsyncStorage**: API keys, tokens, and credentials must be stored in the device secure enclave (`expo-secure-store`); AsyncStorage is for non-sensitive UI state only
- **Certificate pinning** (production builds): pin the public key of the API gateway certificate; reject connections to unknown certificates
- **Jailbreak / root detection**: warn (do not block) if the device appears to be rooted; log the event server-side
- **Code obfuscation**: enable Metro bundler's minification and Hermes bytecode compilation; never ship readable source maps to production
- **Deep link validation**: validate every deep link parameter before using it for navigation or data fetching; reject malformed or unexpected payloads
- **Biometric lock** (optional, not blocking): offer Face ID / fingerprint re-authentication for sensitive actions (e.g., changing linked child, updating contact number)

### 9. Data Protection & DPDP 2023 Compliance

- Children's real-time location is **sensitive personal data** under DPDP 2023 — collect explicit, informed consent from the parent at onboarding before any GPS data is shown
- Consent record (timestamp, version, userId) must be written to the DB and must not be deleteable by the user — only an admin can flag a consent as withdrawn
- Location data older than 30 days must be automatically purged (Kafka-triggered nightly job; covered by automated test)
- Parents may request a full data export (`GET /api/v1/me/data-export`) — export must be generated within 72 hours and delivered via a time-limited signed URL
- Parents may request account deletion (`DELETE /api/v1/me`) — all personal data must be purged within 30 days; bus tracking data is retained in anonymized form
- GPS coordinates in transit are encrypted with TLS 1.3; at rest, GPS documents in Firestore use field-level encryption for `lat` and `lon` (implemented in the telemetry ingestor)

### 10. Webhook Security

- Every outbound webhook payload is signed with `HMAC-SHA256` using a per-school signing secret
- The `X-SafeRide-Signature` header format: `sha256=<hex-digest>` (same pattern as GitHub webhooks)
- Signing secrets are rotated on request; old secrets remain valid for a 24-hour grace period
- Webhook endpoints must respond with `2xx` within 10 seconds; otherwise the delivery is retried with exponential back-off
- Webhook delivery logs are retained for 30 days — schools can inspect delivery history in the dashboard
- Never include children's full names or precise GPS coordinates in webhook payloads — use anonymized trip events only

```ts
// Signing — required for every webhook dispatch
import { createHmac } from 'crypto';

function signPayload(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}
```

### 11. Audit Logging

Every sensitive operation must produce a structured audit log entry via `packages/logger`. The log must be shipped to a tamper-evident log store (CloudWatch Logs with object lock in production).

**Operations that require an audit log entry:**

| Operation | Fields to log |
|---|---|
| Login success / failure | `userId`, `ip`, `userAgent`, `success`, `failureReason` |
| Password / OTP change | `userId`, `ip`, `timestamp` |
| Role change | `actorId`, `targetUserId`, `oldRole`, `newRole`, `tenantId` |
| Child linked / unlinked | `parentId`, `childId`, `tenantId`, `actorId` |
| Trip start / end | `tripId`, `driverId`, `busId`, `tenantId` |
| Consent granted / withdrawn | `userId`, `consentVersion`, `timestamp` |
| Data export requested | `userId`, `requestedAt` |
| Account deletion requested | `userId`, `requestedAt` |
| Webhook signing secret rotated | `tenantId`, `actorId` |
| Admin impersonation | `adminId`, `targetUserId`, `tenantId` |

Never log passwords, OTPs, JWT tokens, or raw GPS coordinates in audit entries.

### 12. Transport & Network Security

- All external connections use TLS 1.3 minimum; TLS 1.0/1.1 are disabled at the load balancer level
- MQTT connections from GPS devices use TLS mutual authentication (client certificates)
- WebSocket connections from mobile clients require a valid JWT in the `Authorization` header on the upgrade request
- CORS: allow only the production web-admin origin and the mobile app scheme; never use `Access-Control-Allow-Origin: *` in production
- HTTP security headers required on every response from web-facing services: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`

### 13. Dependency & Supply Chain Security

- Run `pnpm audit` in CI; fail the build on **high** or **critical** vulnerabilities with no patch available
- Pin exact versions (not ranges) for all security-sensitive dependencies: `jsonwebtoken`, `bcryptjs`, `firebase-admin`, `zod`
- Enable Dependabot / Renovate with auto-merge for patch-level updates only; minor and major updates require manual review
- Never install a package with fewer than 100k weekly downloads or no maintainer activity in the last 6 months without a written architectural decision record (ADR)
- Scan Docker images with `trivy` in CI before pushing to ECR

### 14. Security Testing Requirements

Security is tested, not assumed. The following tests are mandatory and must pass in CI:

- **Auth bypass**: assert that every protected route returns `401` when called without a token
- **Tenant isolation**: assert that a valid token from tenant A cannot read, write, or list any resource belonging to tenant B
- **Rate limit**: assert that the 6th login attempt within 15 minutes returns `429`
- **Input fuzzing**: assert that oversized inputs (10 MB body, 10,000-character strings, null bytes) return `400` — never `500`
- **Injection probes**: assert that LDAP injection strings and path traversal sequences (`../../../etc/passwd`) in any input field return `400`
- **Expired token**: assert that an expired JWT returns `401`
- **Revoked token**: assert that a valid but revoked JWT returns `401`
- **CORS**: assert that requests from non-whitelisted origins receive no `Access-Control-Allow-Origin` header
- **Webhook signature**: assert that a webhook payload with a tampered signature is rejected by the receiver SDK

These tests live in `tests/security/` and run in a separate CI job named `security-tests` after unit and integration tests pass.

---

## Documentation

**Documentation is not optional and not a post-build task.** Every service, package, and significant feature must be documented alongside the code. A feature is not done until it is documented.

### Rule: Document as You Build

Every time code is created or changed:
1. If a new service or package is created → create its `README.md` immediately
2. If an API endpoint is added or changed → update the endpoint docs
3. If env vars change → update `.env.example` and the README env var table
4. If a deployment step changes → update the deployment section
5. If a breaking change is made → add a migration note at the top of the README

Never create a README after the fact from memory. Write it as part of the same task.

### Required README Structure

Every service and package (`auth-service/`, `tenant-service/`, `packages/types/`, etc.) must have a `README.md` with these exact sections:

```markdown
# {Service Name}

One sentence: what this service does and who calls it.

## Responsibility
What this service owns. What it does NOT own (explicit boundaries).

## Local Development
\`\`\`bash
# Prerequisites
cp .env.example .env   # fill in values
pnpm install

# Start with hot reload
pnpm dev               # starts on port XXXX

# Run tests
pnpm test
pnpm test:coverage
\`\`\`

## Environment Variables
| Variable | Required | Description | Example |
|---|---|---|---|
| NODE_ENV | yes | Runtime environment | development |
| PORT | yes | HTTP port | 4002 |
| FIREBASE_SERVICE_ACCOUNT_JSON | yes | Firebase Admin SDK credentials as single-line JSON | {"type":"service_account",...} |

## API Reference
For each endpoint:
### POST /api/v1/resource
**Auth**: Bearer token required | **Role**: super_admin
**Rate limit**: 300 req/min

Request body:
\`\`\`json
{ "field": "value" }
\`\`\`
Success response (201):
\`\`\`json
{ "success": true, "data": { "id": "abc123" } }
\`\`\`
Error responses:
- 400 VALIDATION_ERROR — invalid request body
- 401 UNAUTHORIZED — missing or expired token
- 403 FORBIDDEN — insufficient role
- 404 NOT_FOUND — resource does not exist
- 409 CONFLICT — business rule violation

## Firestore Collections
Which collections this service reads and writes (with tenantId isolation rules).

## Production Deployment
See root `docs/deployment.md` for full production setup.
Service-specific notes go here (e.g. min replicas, memory requirements).

## Architecture Notes
Any non-obvious design decisions, trade-offs, or gotchas a new developer needs to know.
```

### Root-Level Deployment Guide

The file `docs/deployment.md` must exist and stay current. It covers the full production deployment from zero to live. Structure:

```markdown
# SafeRide Production Deployment

## Infrastructure Overview
## Prerequisites (tools, accounts, access)
## Step 1 — Firebase Setup
## Step 2 — Environment Variables (per service)
## Step 3 — Build & Deploy Backend Services
## Step 4 — Deploy Web Admin
## Step 5 — Deploy Mobile App (Expo EAS)
## Step 6 — Firestore Security Rules
## Step 7 — Post-Deploy Verification Checklist
## Rollback Procedure
## Monitoring & Alerts
```

### API Change Log

When any API contract changes (new endpoint, changed request shape, changed response shape, removed field), add an entry to `docs/api-changelog.md`:

```markdown
## YYYY-MM-DD — {service-name}
### Added
- POST /api/v1/tenants — onboard a new school
### Changed
- PATCH /api/v1/tenants/:id/suspend — now returns 204 (was 200)
### Removed
- (none)
```

### What Good Documentation Looks Like

**Bad** (do not do this):
```markdown
## API
POST /tenants — creates a tenant
```

**Good**:
```markdown
### POST /api/v1/tenants
Creates a new school tenant and generates a school admin invite.

**Auth**: Bearer token · **Role**: `super_admin` · **Rate limit**: 300 req/min

**Request body:**
\`\`\`json
{
  "name": "City Montessori School",
  "city": "Lucknow",
  "state": "Uttar Pradesh",
  "plan": "trial",
  "maxBuses": 10,
  "maxStudents": 500,
  "contactName": "Ramesh Kumar",
  "contactEmail": "ramesh@cms.edu.in",
  "contactPhone": "9876543210",
  "adminEmail": "admin@cms.edu.in"
}
\`\`\`

**Success (201):**
\`\`\`json
{ "success": true, "data": { "id": "xK9mP2qR...", "name": "City Montessori School", "status": "trial", ... } }
\`\`\`

**Side effects:** Creates `pendingInvites/{email_key}` so the school admin can claim their account.

**Errors:**
| Code | HTTP | Meaning |
|---|---|---|
| VALIDATION_ERROR | 400 | Missing or invalid fields |
| UNAUTHORIZED | 401 | No token / expired token |
| FORBIDDEN | 403 | Not super_admin |
```

### Package Documentation

Every shared package in `packages/` needs a README covering:
- What it exports and why
- Usage examples (copy-paste ready)
- How to add it as a dependency in a new service (`"@saferide/package": "workspace:*"`)
- Any initialization required at startup

### Enforcement

- No PR merges if a new service/package is missing its README
- No PR merges if new endpoints are undocumented
- After every build session, run a quick check: does every directory with a `src/` have a `README.md`?
