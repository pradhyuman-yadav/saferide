# SafeRide Infrastructure Setup

One-time AWS setup for ECR + ECS Fargate + ALB. Run these steps once. After that,
GitHub Actions handles every deploy automatically.

**Region:** `ap-south-1` (Mumbai) — all resources go here. No exceptions (DPDP 2023).

---

## Architecture

```
Internet
  ↓
Route 53 (DNS)
  ↓
ACM (TLS cert — free)
  ↓
ALB (Application Load Balancer)
  ├── saferide.co.in          → ECS: saferide-web-admin   (nginx, port 80)
  ├── api.saferide.co.in      → ECS: saferide-auth / tenant / route / trip
  └── ws.saferide.co.in       → ECS: saferide-livetrack-gateway (WebSocket)

ECR (image registry)
  └── one repo per service: saferide-{service-name}

ECS Fargate (managed containers)
  ├── Cluster: saferide-dev
  └── Cluster: saferide-prod

Secrets Manager
  └── saferide/{env}/{service}  (JSON blob of env vars per service)
```

---

## Step 1 — VPC (use the default)

No custom VPC needed at MVP scale. Use the default VPC in ap-south-1.

Make a note of:
- Your default VPC ID: `vpc-xxxxxxxx`
- Two public subnet IDs (different AZs): `subnet-aaaaaaaa`, `subnet-bbbbbbbb`

AWS Console → VPC → Your VPCs → Default VPC → Subnets tab.

---

## Step 2 — Security Groups

Create three security groups in the default VPC.

### 2a. ALB Security Group (`sg-alb-saferide`)
| Direction | Protocol | Port | Source |
|---|---|---|---|
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | HTTPS | 443 | 0.0.0.0/0 |
| Outbound | All | All | 0.0.0.0/0 |

### 2b. ECS Tasks Security Group (`sg-ecs-saferide`)
| Direction | Protocol | Port | Source |
|---|---|---|---|
| Inbound | TCP | 4001–4005, 80 | sg-alb-saferide (the ALB SG ID) |
| Outbound | All | All | 0.0.0.0/0 |

This means only the ALB can reach your containers. Nothing else.

---

## Step 3 — ECR Repositories

Create one repository per service. All private.

```bash
aws ecr create-repository --repository-name saferide-auth-service      --region ap-south-1
aws ecr create-repository --repository-name saferide-tenant-service    --region ap-south-1
aws ecr create-repository --repository-name saferide-route-service     --region ap-south-1
aws ecr create-repository --repository-name saferide-trip-service      --region ap-south-1
aws ecr create-repository --repository-name saferide-livetrack-gateway --region ap-south-1
aws ecr create-repository --repository-name saferide-web-admin         --region ap-south-1
```

Enable image scanning on each repo (AWS Console → ECR → repo → Edit → Scan on push: On).

Note your account ID: run `aws sts get-caller-identity --query Account --output text`

Your ECR registry URL: `{ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com`

---

## Step 4 — IAM Roles

### 4a. ECS Task Execution Role

This role lets ECS pull images from ECR and fetch secrets from Secrets Manager.

```bash
# Create the role
aws iam create-role \
  --role-name saferide-ecs-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach AWS-managed policies
aws iam attach-role-policy \
  --role-name saferide-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Allow reading Secrets Manager (for env vars)
aws iam put-role-policy \
  --role-name saferide-ecs-execution-role \
  --policy-name SecretsManagerRead \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-south-1:*:secret:saferide/*"
    }]
  }'
```

### 4b. ECS Task Role

What the running container is allowed to do. Minimal for now.

```bash
aws iam create-role \
  --role-name saferide-ecs-task-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

### 4c. GitHub Actions Deploy User

```bash
aws iam create-user --user-name saferide-github-actions

aws iam put-user-policy \
  --user-name saferide-github-actions \
  --policy-name SafeRideDeploy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": [
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:WaitUntilServicesStable"
        ],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": "iam:PassRole",
        "Resource": [
          "arn:aws:iam::*:role/saferide-ecs-execution-role",
          "arn:aws:iam::*:role/saferide-ecs-task-role"
        ]
      }
    ]
  }'

# Create access keys — save these for GitHub Secrets
aws iam create-access-key --user-name saferide-github-actions
```

Save the `AccessKeyId` and `SecretAccessKey` → add to GitHub Secrets as:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Step 5 — Secrets Manager

Store all sensitive env vars here. One secret per service per environment.
Secret name format: `saferide/{env}/{service}` (e.g. `saferide/prod/auth-service`).

Each secret is a JSON object. Example for auth-service:

```json
{
  "NODE_ENV": "production",
  "PORT": "4001",
  "FIREBASE_SERVICE_ACCOUNT_JSON": "{...single-line JSON...}",
  "FIREBASE_DATABASE_URL": "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app",
  "JWT_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "JWT_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----\n...",
  "REDIS_URL": "redis://...",
  "LOG_LEVEL": "info"
}
```

Create via AWS Console (Secrets Manager → Store a new secret → Other type → Plaintext, paste JSON) or CLI:

```bash
aws secretsmanager create-secret \
  --name saferide/prod/auth-service \
  --region ap-south-1 \
  --secret-string '{"NODE_ENV":"production","PORT":"4001",...}'
```

Repeat for each service (auth, tenant, route, trip, livetrack-gateway).

---

## Step 6 — CloudWatch Log Groups

One log group per service per environment:

```bash
SERVICES=(auth-service tenant-service route-service trip-service livetrack-gateway web-admin)
for svc in "${SERVICES[@]}"; do
  aws logs create-log-group --log-group-name "/ecs/saferide-$svc-prod" --region ap-south-1
  aws logs create-log-group --log-group-name "/ecs/saferide-$svc-dev"  --region ap-south-1
  # Retain 30 days (cost control)
  aws logs put-retention-policy --log-group-name "/ecs/saferide-$svc-prod" --retention-in-days 30 --region ap-south-1
  aws logs put-retention-policy --log-group-name "/ecs/saferide-$svc-dev"  --retention-in-days 7  --region ap-south-1
done
```

---

## Step 7 — ECS Clusters

```bash
aws ecs create-cluster --cluster-name saferide-prod --region ap-south-1
aws ecs create-cluster --cluster-name saferide-dev  --region ap-south-1
```

Enable Container Insights for prod:
```bash
aws ecs update-cluster-settings \
  --cluster saferide-prod \
  --settings name=containerInsights,value=enabled \
  --region ap-south-1
```

---

## Step 8 — Register Initial Task Definitions

Do this once before the first GitHub Actions deploy. Replace placeholders:
- `ACCOUNT_ID` → your 12-digit AWS account ID
- `SECRET_ARN_PREFIX` → `arn:aws:secretsmanager:ap-south-1:ACCOUNT_ID:secret:saferide/prod`

Template (save as `task-def.json`, register, then delete the file):

```json
{
  "family": "saferide-auth-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/saferide-ecs-execution-role",
  "taskRoleArn":      "arn:aws:iam::ACCOUNT_ID:role/saferide-ecs-task-role",
  "containerDefinitions": [{
    "name": "auth-service",
    "image": "ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/saferide-auth-service:prod-latest",
    "portMappings": [{"containerPort": 4001, "protocol": "tcp"}],
    "essential": true,
    "secrets": [
      {"name": "NODE_ENV",                      "valueFrom": "SECRET_ARN_PREFIX/auth-service:NODE_ENV::"},
      {"name": "PORT",                          "valueFrom": "SECRET_ARN_PREFIX/auth-service:PORT::"},
      {"name": "FIREBASE_SERVICE_ACCOUNT_JSON", "valueFrom": "SECRET_ARN_PREFIX/auth-service:FIREBASE_SERVICE_ACCOUNT_JSON::"},
      {"name": "FIREBASE_DATABASE_URL",         "valueFrom": "SECRET_ARN_PREFIX/auth-service:FIREBASE_DATABASE_URL::"},
      {"name": "JWT_PRIVATE_KEY",               "valueFrom": "SECRET_ARN_PREFIX/auth-service:JWT_PRIVATE_KEY::"},
      {"name": "JWT_PUBLIC_KEY",                "valueFrom": "SECRET_ARN_PREFIX/auth-service:JWT_PUBLIC_KEY::"},
      {"name": "REDIS_URL",                     "valueFrom": "SECRET_ARN_PREFIX/auth-service:REDIS_URL::"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group":         "/ecs/saferide-auth-service-prod",
        "awslogs-region":        "ap-south-1",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command":     ["CMD-SHELL", "wget -qO- http://localhost:4001/health || exit 1"],
      "interval":    30,
      "timeout":     5,
      "retries":     3,
      "startPeriod": 60
    }
  }]
}
```

Repeat this pattern for each of the 6 services (adjust `family`, `name`, `containerPort`, `image`, and secret keys).

```bash
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-south-1
```

---

## Step 9 — ALB Setup

### 9a. Create the ALB

AWS Console → EC2 → Load Balancers → Create → Application Load Balancer:
- Name: `saferide-alb`
- Scheme: Internet-facing
- IP type: IPv4
- VPC: default
- Subnets: pick 2 AZs
- Security group: `sg-alb-saferide`

### 9b. ACM Certificate (free HTTPS)

AWS Console → Certificate Manager → Request → Public certificate:
- Add domains: `saferide.co.in`, `*.saferide.co.in` (wildcard covers api., ws., dev.)
- Validation: DNS (ACM shows you CNAME records to add in Route 53 — takes ~5 min)

Attach the cert to the ALB HTTPS listener.

### 9c. Target Groups

One target group per service:

| Name | Protocol | Port | Health check path |
|---|---|---|---|
| `tg-saferide-web-admin` | HTTP | 80 | `/health` |
| `tg-saferide-auth` | HTTP | 4001 | `/health` |
| `tg-saferide-tenant` | HTTP | 4002 | `/health` |
| `tg-saferide-route` | HTTP | 4003 | `/health` |
| `tg-saferide-trip` | HTTP | 4004 | `/health` |
| `tg-saferide-livetrack` | HTTP | 4005 | `/health` |

Target type: **IP** (required for Fargate). VPC: default.

### 9d. Listener Rules

**Port 80 listener**: one rule → redirect all to HTTPS 443.

**Port 443 listener** (with ACM cert attached):

| Priority | Condition | Action |
|---|---|---|
| 1 | Host: `ws.saferide.co.in` | Forward → `tg-saferide-livetrack` |
| 2 | Host: `api.saferide.co.in`, Path: `/api/v1/auth/*` | Forward → `tg-saferide-auth` |
| 3 | Host: `api.saferide.co.in`, Path: `/api/v1/tenants/*` | Forward → `tg-saferide-tenant` |
| 4 | Host: `api.saferide.co.in`, Path: `/api/v1/routes/*` or `/buses/*` or `/stops/*` | Forward → `tg-saferide-route` |
| 5 | Host: `api.saferide.co.in`, Path: `/api/v1/trips/*` | Forward → `tg-saferide-trip` |
| 100 | Host: `saferide.co.in` | Forward → `tg-saferide-web-admin` |

For WebSocket (livetrack): ALB supports WebSocket natively on HTTPS — no special config needed.

---

## Step 10 — ECS Services

Create one ECS service per task definition in each cluster.

Example for auth-service in prod (repeat for each service):

AWS Console → ECS → Clusters → saferide-prod → Services → Create:
- Launch type: Fargate
- Task definition: `saferide-auth-service` (latest)
- Service name: `saferide-auth-service`
- Desired tasks: 1
- VPC: default, Subnets: both AZs, Security group: `sg-ecs-saferide`
- Load balancer: `saferide-alb`, Target group: `tg-saferide-auth`
- Health check grace period: 60s

Minimum healthy percent: 100, Maximum percent: 200 (rolling deploy — new task starts before old one stops).

---

## Step 11 — Route 53 DNS

In your hosted zone for `saferide.co.in`:

| Record | Type | Value |
|---|---|---|
| `saferide.co.in` | A (Alias) | ALB DNS name |
| `api.saferide.co.in` | A (Alias) | ALB DNS name |
| `ws.saferide.co.in` | A (Alias) | ALB DNS name |

All three point at the same ALB — routing is done by host header rules in the listener.

---

## Step 12 — GitHub Secrets

Add these in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | From Step 4c |
| `AWS_SECRET_ACCESS_KEY` | From Step 4c |
| `FIREBASE_TOKEN` | Run `firebase login:ci` locally |
| `DEV_VITE_AUTH_SERVICE_URL` | `https://api-dev.saferide.co.in` |
| `DEV_VITE_FIREBASE_*` | Dev Firebase project values |
| `PROD_VITE_AUTH_SERVICE_URL` | `https://api.saferide.co.in` |
| `PROD_VITE_FIREBASE_*` | Prod Firebase project values |

---

## Local Dev

`docker-compose.yml` at the repo root is for local development only.
It is not used in production — ECS handles orchestration there.

```bash
# Local dev (all services)
cp .env.example .env  # fill in values
docker compose up --build

# Or run natively with hot reload
pnpm dev
```

---

## What Happens on Each Deploy

```
git push origin main         # dev deploy
  → GitHub Actions
  → docker build (6 images)
  → docker push to ECR
  → ECS update-service (new task def revision per service)
  → ECS replaces old task with new task (rolling)
  → deploy Firestore rules to dev Firebase

git push origin release      # prod deploy
  → typecheck + lint + test
  → manual approval gate (GitHub Environments)
  → same as above but to saferide-prod cluster
  → waits for each service to reach steady state
  → triggers mobile EAS build + submit
```

Zero SSH. Zero rsync. Zero manual steps after this initial setup.
