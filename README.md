# SafeRide

> Every parent knows their child is safe — from the moment they board the bus to the moment they walk into class.

School bus tracking and parent notification platform. Multi-tenant SaaS — live GPS maps, push alerts, driver SOS, and a fleet dashboard for transport managers.

---

## Repository layout

```
SafeRide/
│
├── auth-service/          JWT auth, OTP, session management         :4001
├── tenant-service/        School onboarding, plan management        :4002
├── route-service/         Buses, routes, stops, students, drivers   :4003
├── trip-service/          Trip lifecycle, GPS telemetry ingest      :4004
├── livetrack-gateway/     WebSocket real-time push to parent app    :4005
│
├── mobile/                React Native + Expo Router (iOS & Android)
├── web-admin/             React + Vite fleet dashboard
│
├── packages/
│   ├── types/             Shared TypeScript interfaces + Zod schemas
│   ├── middleware/        verifyJwt, requireRole, validateBody, errorHandler
│   ├── logger/            Pino structured logger
│   └── firebase-admin/    Firebase Admin SDK wrapper
│
├── scripts/               seed.ts — populates dev Firebase with test data
│
├── docker/                Container runtime: pm2.config.js, start.sh
├── nginx/                 nginx.conf (dev), nginx.monolith.conf (prod monolith)
├── infra/
│   ├── README.md          Infrastructure overview
│   └── terraform/         VPC, ECS cluster, ECR, ALB (ap-south-2)
│
├── docs/
│   ├── deployment.md      Zero-to-production setup guide
│   ├── api-changelog.md   API contract history
│   ├── adr/               Architecture Decision Records
│   ├── SafeRide_PRD_v2.md         Product Requirements
│   ├── SafeRide_TechDoc_v3.md     Technical specification
│   ├── SafeRide_DesignSystem_v2.md Design system (Jade Pebble Morning)
│   ├── SafeRide_CodeStructure_v2.md Code structure guide
│   ├── SafeRide_BuildChecklist.md  Sprint build checklist
│   └── archive/           v1 docs — superseded
│
├── brand/                 Logos, brand assets, saferide_brand_guidelines.html
│
├── Dockerfile.monolith    Single-image build: all services + nginx + PM2
├── docker-compose.yml     Local dev — spins up the monolith on :80
├── firebase.json          Firebase project config + deploy targets
└── firestore.rules        Firestore security rules (deployed via CI)
```

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env        # fill in Firebase + JWT values

# 3. Seed dev data
pnpm seed

# 4. Run all backend services in parallel
pnpm dev
```

Services start on ports 4001–4005. Web admin: `cd web-admin && pnpm dev` (Vite, port 5173). Mobile: `cd mobile && pnpm start` (Expo).

---

## Common commands

```bash
pnpm dev                              # All backend services with hot reload
pnpm build                            # Build all packages + services
pnpm test                             # Run all tests (Vitest)
pnpm test:coverage                    # Coverage report
pnpm typecheck                        # TypeScript strict check — zero errors required
pnpm lint                             # ESLint all workspaces

# Single service
pnpm dev --filter route-service
pnpm test --filter route-service
pnpm build --filter route-service
```

---

## Docker (local)

```bash
# Build and run the full monolith (all services + web admin + nginx)
docker compose up --build

# Health check
curl http://localhost/health
```

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend services | Node.js 22, TypeScript 5.5, Express |
| Shared packages | Zod, Pino, Firebase Admin SDK |
| Mobile | React Native, Expo Router, Zustand |
| Web admin | React 18, Vite, Zustand, React Query |
| Database | Firebase Firestore (multi-tenant, `tenantId` on every query) |
| Auth | Firebase Auth + RS256 JWT (15 min access / 30 day refresh) |
| Real-time | WebSocket (livetrack-gateway) |
| Infrastructure | AWS ECS EC2, ECR, ALB, SSM — region ap-south-2 (Mumbai) |
| Container | nginx + PM2 inside a single Alpine image |
| CI/CD | GitHub Actions — lint/typecheck/test on PR, deploy on merge to `release` |

---

## Architecture

```
Parent app  ──→  ALB  ──→  nginx (port 80)
                              ├── /api/v1/auth/*      → auth-service      :4001
                              ├── /api/v1/tenants/*   → tenant-service    :4002
                              ├── /api/v1/routes/*    → route-service     :4003
                              ├── /api/v1/trips/*     → trip-service      :4004
                              ├── /ws                 → livetrack-gateway :4005
                              └── /*                  → web-admin SPA
```

Every backend service follows strict layering — `routes → controllers → services → repositories` — with all Firestore access through repositories only. Every query includes `.where('tenantId', '==', tenantId)`.

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for the full zero-to-production guide.

**First deploy in brief:**
```bash
# 1. Provision infra (one-time)
cd infra/terraform && terraform init && terraform apply

# 2. Store secrets in SSM Parameter Store
aws ssm put-parameter --name /saferide/prod/FIREBASE_SERVICE_ACCOUNT_JSON ...
aws ssm put-parameter --name /saferide/prod/JWT_PRIVATE_KEY ...
aws ssm put-parameter --name /saferide/prod/JWT_PUBLIC_KEY ...

# 3. Build and push image to ECR
docker build -f Dockerfile.monolith -t <ecr-url>:prod-latest .
docker push <ecr-url>:prod-latest

# 4. Every redeploy after that
aws ecs update-service --cluster saferide-cluster \
  --service saferide-monolith --force-new-deployment
```

---

## Environment variables

One `.env` file at the root covers all services in local development. Copy from the template:

```bash
cp .env.example .env
```

Key variables:

| Variable | Used by | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | All services | Service account JSON (single line) |
| `JWT_PRIVATE_KEY` | auth-service | RS256 private key for token signing |
| `JWT_PUBLIC_KEY` | All services | RS256 public key for token verification |
| `FIREBASE_PROJECT_ID` | All services | Firebase project ID |
| `VITE_FIREBASE_*` | web-admin | Firebase client config (baked into bundle) |
| `EXPO_PUBLIC_*` | mobile | Expo public config |

In production, secrets come from AWS SSM Parameter Store — never from the image or task environment directly.

---

## Contributing

Branch naming: `{type}/SR-{ticket}-short-description`
Commit format: Conventional Commits — `type(scope): description`
PR requirements: zero lint warnings · zero typecheck errors · tests pass · coverage must not regress
