# SafeRide Production Deployment

## Infrastructure Overview

```
Firebase (Auth + Firestore)                ← identity + structured data
AWS ap-south-1 (Mumbai)                    ← all compute — data never leaves India
  ├── ECS Fargate (auth-service)           port 4001
  ├── ECS Fargate (tenant-service)         port 4002
  ├── CloudFront + S3 (web-admin)          static hosting
  └── CloudWatch Logs                      audit trail (object lock enabled)
Mobile: Expo EAS Build + Submit
```

## Prerequisites

- Node 22+, pnpm 10+
- Firebase project created (Blaze plan required for production — Spark plan has quota limits that will not support concurrent users)
- AWS CLI configured for `ap-south-1`
- Docker Desktop (for local image builds)
- Expo account + EAS CLI (`npm install -g eas-cli`)

## Step 1 — Firebase Setup

1. Go to Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Download the JSON file
3. Convert to a single line: `jq -c . service-account.json`
   > **Important:** The JSON must be on a single line. The private key inside contains literal `\n` escape sequences — do not expand them into real newlines. The entire value must fit on one line in the `.env` file.
4. For local dev: paste the single-line JSON directly into `auth-service/.env` and `tenant-service/.env` as the value of `FIREBASE_SERVICE_ACCOUNT_JSON` — no quotes needed
5. For production: store the single-line JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in AWS Secrets Manager (one secret per service)
5. Enable Authentication → Sign-in method → Email/Password
6. Enable Firestore Database → Start in production mode → Region: `asia-south2` (Mumbai)
7. Apply Firestore security rules from `firestore.rules` (see Step 2)

## Step 2 — Firestore Security Rules

Rules live in `firestore.rules` at the repo root. Deploy from the repo — never edit manually in the Firebase Console.

```bash
firebase deploy --only firestore:rules
```

Current rules enforce:

| Collection | Client read | Client write |
|---|---|---|
| `users/{userId}` | Owner only (`request.auth.uid == userId`) | Blocked — backend Admin SDK only |
| `tenants/{tenantId}` | Any authenticated user | Blocked — backend Admin SDK only |
| `pendingInvites/{inviteKey}` | Blocked — backend Admin SDK only | Blocked — backend Admin SDK only |
| Everything else | Blocked | Blocked |

## Step 3 — Environment Variables (per service)

Store all secrets in AWS Secrets Manager. Inject into ECS task definitions as environment variables at deployment time — never store in plaintext `.env` files in the container image.

**auth-service** (port 4001):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4001` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | From AWS Secrets Manager |
| `CORS_ORIGINS` | `https://admin.saferide.in` |
| `LOG_LEVEL` | `info` |

**tenant-service** (port 4002):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4002` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | From AWS Secrets Manager |
| `CORS_ORIGINS` | `https://admin.saferide.in` |
| `LOG_LEVEL` | `info` |

## Step 4 — Build Backend Services

Run from the repo root. All commands must succeed before proceeding to Docker build.

```bash
pnpm install
pnpm typecheck          # must be zero errors
pnpm test               # must be 100% pass
pnpm --filter saferide-auth-service build
pnpm --filter saferide-tenant-service build
```

TypeScript output lands in `auth-service/dist/` and `tenant-service/dist/`.

## Step 5 — Deploy to ECS Fargate

Each service has its own Dockerfile. General pattern:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY dist/ ./dist/
COPY package.json ./
RUN npm install --omit=dev
CMD ["node", "dist/index.js"]
```

Build, tag, and push:

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  {AWS_ACCOUNT}.dkr.ecr.ap-south-1.amazonaws.com

# auth-service
docker build -t saferide-auth-service ./auth-service
docker tag saferide-auth-service:latest \
  {AWS_ACCOUNT}.dkr.ecr.ap-south-1.amazonaws.com/saferide-auth-service:latest
docker push {AWS_ACCOUNT}.dkr.ecr.ap-south-1.amazonaws.com/saferide-auth-service:latest

# tenant-service
docker build -t saferide-tenant-service ./tenant-service
docker tag saferide-tenant-service:latest \
  {AWS_ACCOUNT}.dkr.ecr.ap-south-1.amazonaws.com/saferide-tenant-service:latest
docker push {AWS_ACCOUNT}.dkr.ecr.ap-south-1.amazonaws.com/saferide-tenant-service:latest
```

ECS services are configured to pull the `latest` tag and redeploy on push. Trigger a forced redeployment if ECS does not pick up the new image automatically:

```bash
aws ecs update-service --cluster saferide --service auth-service --force-new-deployment
aws ecs update-service --cluster saferide --service tenant-service --force-new-deployment
```

## Step 6 — Deploy Web Admin

```bash
cd web-admin
cp .env.example .env.production

# Fill in production service URLs:
# VITE_TENANT_SERVICE_URL=https://tenant.saferide.in
# VITE_AUTH_SERVICE_URL=https://auth.saferide.in

pnpm build

# Upload to S3 and invalidate CloudFront cache
aws s3 sync dist/ s3://saferide-web-admin/ --delete
aws cloudfront create-invalidation --distribution-id {DISTRIBUTION_ID} --paths "/*"
```

The web-admin reads `VITE_TENANT_SERVICE_URL` and `VITE_AUTH_SERVICE_URL` from `.env.production` at build time. These are baked into the static bundle — changing them requires a rebuild and redeploy.

## Step 7 — Bootstrap Super Admin

The first super admin account must be created manually once after the initial deployment. There is no API endpoint for this because no admin exists yet to authorise it.

1. Sign into Firebase Console → Authentication → Users → Add user (email + password)
2. Copy the UID
3. In Firestore Console → `users/{UID}`, create the document:

```json
{
  "uid": "{UID}",
  "email": "you@saferide.in",
  "name": "Your Name",
  "role": "super_admin",
  "tenantId": null,
  "status": "active",
  "createdAt": 1711324800000,
  "updatedAt": 1711324800000
}
```

`createdAt` and `updatedAt` are Unix epoch milliseconds. Use `Date.now()` in the browser console to get the current value.

After creating the document, sign into the web admin at `https://admin.saferide.in` with the email and password you set in Firebase Auth.

## Step 8 — Post-Deploy Verification Checklist

- [ ] `GET https://auth.saferide.in/health` returns `{ "success": true, "data": { "service": "auth-service", "status": "ok" } }`
- [ ] `GET https://tenant.saferide.in/health` returns `{ "success": true, "data": { "service": "tenant-service", "status": "ok" } }`
- [ ] Web admin login works at `https://admin.saferide.in`
- [ ] Onboard a test school via web admin → verify `tenants/{id}` document created in Firestore
- [ ] Verify `pendingInvites/{inviteKey}` document created for the school admin email
- [ ] School admin signs up at the web admin → invite claimed → `users/{uid}` profile created → `pendingInvites` document deleted
- [ ] Sign in as school admin → verify redirect to school dashboard and `GET /api/v1/tenants/:id` returns only their own tenant
- [ ] Suspend the test school → verify `status` changes to `"suspended"` in Firestore
- [ ] Reactivate the test school → verify `status` changes to `"active"`
- [ ] CloudWatch Logs → verify `{ $.audit = true }` filter returns entries for the above actions

## Rollback Procedure

**Backend services (ECS):** Redeploy a previous task definition revision.

```bash
# List recent revisions
aws ecs describe-task-definition --task-definition auth-service

# Roll back to a specific revision
aws ecs update-service \
  --cluster saferide \
  --service auth-service \
  --task-definition auth-service:{prev_revision}
```

**Web admin:** S3 versioning is enabled. Sync the previous build artefact and invalidate CloudFront.

```bash
# List object versions to find the previous bundle
aws s3api list-object-versions --bucket saferide-web-admin --prefix index.html

# Restore previous version by copying it (or re-run the previous CI build and sync)
aws cloudfront create-invalidation --distribution-id {DISTRIBUTION_ID} --paths "/*"
```

## Monitoring and Alerts

All Pino structured logs are shipped to CloudWatch Logs automatically via the ECS `awslogs` log driver.

Useful CloudWatch Insights queries:

```
# All audit events
fields @timestamp, action, actorId, actorRole, targetId
| filter audit = 1
| sort @timestamp desc

# All 5xx errors
fields @timestamp, path, requestId
| filter level >= 50
| sort @timestamp desc
```

Recommended CloudWatch alarms (configure in each service's log group):

| Alarm | Threshold | Period |
|---|---|---|
| 5xx error rate | > 1% of requests | 5 minutes |
| p95 API latency | > 300ms | 5 minutes |
| ECS unhealthy task count | > 0 | 1 minute |
| Auth failures (`INVALID_TOKEN`) | > 50 per minute | 1 minute |
