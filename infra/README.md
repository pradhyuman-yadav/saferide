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

SSM Parameter Store (free)
  └── /saferide/{env}/{service}/{KEY}  (one parameter per env var)
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

> Security group **names** cannot start with `sg-` — AWS reserves that prefix for SG IDs.
> Use `saferide-alb` and `saferide-ecs` as names. The actual ID (e.g. `sg-0abc123`) is
> assigned by AWS automatically.

### 2a. ALB Security Group (name: `saferide-alb`)
| Direction | Protocol | Port | Source |
|---|---|---|---|
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | HTTPS | 443 | 0.0.0.0/0 |
| Outbound | All | All | 0.0.0.0/0 |

### 2b. ECS Tasks Security Group (name: `saferide-ecs`)
| Direction | Protocol | Port | Source |
|---|---|---|---|
| Inbound | TCP | 4001–4005, 80 | `saferide-alb` SG ID |
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

# Allow reading SSM Parameter Store (free — replaces Secrets Manager)
# SecureString params are decrypted using the default aws/ssm KMS key at no charge.
aws iam put-role-policy \
  --role-name saferide-ecs-execution-role \
  --policy-name SSMParameterRead \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["ssm:GetParameters", "ssm:GetParameter"],
      "Resource": "arn:aws:ssm:ap-south-1:*:parameter/saferide/*"
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

## Step 5 — SSM Parameter Store (free)

SSM Parameter Store Standard tier is **free** — $0/month regardless of how many parameters you have.
Secrets Manager costs $0.40/secret/month. We use SSM instead.

Each env var is a separate SecureString parameter. Encrypted at rest using the default
`aws/ssm` KMS key (no charge). ECS fetches values at task startup via the ARN — the
task definition only stores the ARN, never the plaintext value.

Parameter path format: `/saferide/{env}/{service}/{KEY}`

```bash
# Helper function — paste this into your terminal session
put_param() {
  aws ssm put-parameter \
    --name "$1" \
    --value "$2" \
    --type SecureString \
    --overwrite \
    --region ap-south-1
}

# ── auth-service (prod) ────────────────────────────────────────────────────────
put_param "/saferide/prod/auth-service/NODE_ENV"                      "production"
put_param "/saferide/prod/auth-service/PORT"                          "4001"
put_param "/saferide/prod/auth-service/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/auth-service/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/auth-service/JWT_PRIVATE_KEY"               "-----BEGIN RSA PRIVATE KEY-----\n..."
put_param "/saferide/prod/auth-service/JWT_PUBLIC_KEY"                "-----BEGIN PUBLIC KEY-----\n..."
put_param "/saferide/prod/auth-service/LOG_LEVEL"                     "info"

# ── tenant-service (prod) ──────────────────────────────────────────────────────
put_param "/saferide/prod/tenant-service/NODE_ENV"                      "production"
put_param "/saferide/prod/tenant-service/PORT"                          "4002"
put_param "/saferide/prod/tenant-service/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/tenant-service/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/tenant-service/LOG_LEVEL"                     "info"

# ── route-service (prod) ───────────────────────────────────────────────────────
put_param "/saferide/prod/route-service/NODE_ENV"                      "production"
put_param "/saferide/prod/route-service/PORT"                          "4003"
put_param "/saferide/prod/route-service/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/route-service/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/route-service/GOOGLE_MAPS_API_KEY"           "AIza..."
put_param "/saferide/prod/route-service/LOG_LEVEL"                     "info"

# ── trip-service (prod) ────────────────────────────────────────────────────────
put_param "/saferide/prod/trip-service/NODE_ENV"                      "production"
put_param "/saferide/prod/trip-service/PORT"                          "4004"
put_param "/saferide/prod/trip-service/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/trip-service/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/trip-service/GOOGLE_MAPS_API_KEY"           "AIza..."
put_param "/saferide/prod/trip-service/LOG_LEVEL"                     "info"

# ── livetrack-gateway (prod) ───────────────────────────────────────────────────
put_param "/saferide/prod/livetrack-gateway/NODE_ENV"                      "production"
put_param "/saferide/prod/livetrack-gateway/PORT"                          "4005"
put_param "/saferide/prod/livetrack-gateway/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/livetrack-gateway/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/livetrack-gateway/LOG_LEVEL"                     "info"
```

Repeat the whole block with `/saferide/dev/` prefix pointing at your dev Firebase project.

To verify a parameter was stored correctly:
```bash
aws ssm get-parameter \
  --name "/saferide/prod/auth-service/PORT" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text \
  --region ap-south-1
```

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

Do this once before the first GitHub Actions deploy. Replace `ACCOUNT_ID` with your 12-digit AWS account ID.

SSM ARN format: `arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/KEY`

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
      {"name": "NODE_ENV",                      "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/NODE_ENV"},
      {"name": "PORT",                          "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/PORT"},
      {"name": "FIREBASE_SERVICE_ACCOUNT_JSON", "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/FIREBASE_SERVICE_ACCOUNT_JSON"},
      {"name": "FIREBASE_DATABASE_URL",         "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/FIREBASE_DATABASE_URL"},
      {"name": "JWT_PRIVATE_KEY",               "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/JWT_PRIVATE_KEY"},
      {"name": "JWT_PUBLIC_KEY",                "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/JWT_PUBLIC_KEY"},
      {"name": "LOG_LEVEL",                     "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/LOG_LEVEL"}
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

Repeat for the other 5 services — adjust `family`, `name`, `containerPort`, `image`, and SSM parameter paths accordingly.

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

## Step 13 — ECS Auto-Scaling

Each service has independent scaling rules. Configure these after the services are running.

### Fargate resource sizing per service

| Service | CPU units | Memory | Min tasks | Max tasks | Notes |
|---|---|---|---|---|---|
| `auth-service` | 256 | 512 MB | 1 | 5 | Stateless JWT validation — scales fast |
| `tenant-service` | 256 | 512 MB | 1 | 3 | Admin-only, low traffic |
| `route-service` | 256 | 512 MB | 1 | 8 | High read traffic from parent app |
| `trip-service` | 512 | 1024 MB | 1 | 10 | Bursty — peaks at school start/end times |
| `livetrack-gateway` | 512 | 1024 MB | 2 | 20 | Long-lived WebSocket connections — always 2+ |
| `web-admin` | 256 | 512 MB | 1 | 5 | Static files via nginx — rarely bottlenecks |

256 CPU units = 0.25 vCPU. Set these in the task definition (Step 8).

### Register scalable targets

```bash
SERVICES=(auth-service tenant-service route-service trip-service livetrack-gateway web-admin)
for svc in "${SERVICES[@]}"; do
  aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id "service/saferide-prod/saferide-$svc" \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 1 \
    --max-capacity 10 \
    --region ap-south-1
done

# livetrack-gateway: always keep 2+ tasks (WebSocket reconnect cost is high)
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id "service/saferide-prod/saferide-livetrack-gateway" \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 20 \
  --region ap-south-1
```

### CPU-based scale-out (all backend services)

Scale out when CPU > 65% for 2 consecutive minutes. Scale in when CPU < 30% for 10 minutes.

```bash
SERVICES=(auth-service tenant-service route-service trip-service livetrack-gateway)
for svc in "${SERVICES[@]}"; do
  aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --resource-id "service/saferide-prod/saferide-$svc" \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-name "cpu-tracking-$svc" \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
      "TargetValue": 65.0,
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
      },
      "ScaleOutCooldown": 120,
      "ScaleInCooldown": 600
    }' \
    --region ap-south-1
done
```

### Request-count scale-out (trip-service and livetrack-gateway)

These two see the most sudden spikes. Add a second policy based on ALB request count.
Replace `TARGET_GROUP_ARN` with your actual ARN from the ALB console.

```bash
for svc in trip-service livetrack-gateway; do
  TG_ARN=$(aws elbv2 describe-target-groups \
    --names "tg-saferide-${svc%-service}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

  # Convert full ARN to the short form ECS auto-scaling expects:
  # arn:aws:elasticloadbalancing:...:targetgroup/name/id  →  targetgroup/name/id
  TG_SHORT=$(echo "$TG_ARN" | sed 's|.*:||')

  ALB_ARN=$(aws elbv2 describe-load-balancers \
    --names saferide-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)
  ALB_SHORT=$(echo "$ALB_ARN" | sed 's|.*:loadbalancer/||')

  aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --resource-id "service/saferide-prod/saferide-$svc" \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-name "requests-tracking-$svc" \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration "{
      \"TargetValue\": 500.0,
      \"PredefinedMetricSpecification\": {
        \"PredefinedMetricType\": \"ALBRequestCountPerTarget\",
        \"ResourceLabel\": \"$ALB_SHORT/$TG_SHORT\"
      },
      \"ScaleOutCooldown\": 60,
      \"ScaleInCooldown\": 300
    }" \
    --region ap-south-1
done
```

500 requests/target/minute is a conservative starting point. Tune after observing production traffic.

### Scheduled scale-out for school hours (trip-service)

Trip data explodes at 7:00–8:30 AM and 2:00–4:00 PM IST (UTC+5:30 = UTC 1:30–3:00 and 8:30–10:30).
Pre-warm by bumping desired count before the spike hits.

```bash
# Scale up at 7:00 AM IST (01:30 UTC) Mon–Fri
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/saferide-prod/saferide-trip-service" \
  --scalable-dimension ecs:service:DesiredCount \
  --scheduled-action-name "morning-prewarm" \
  --schedule "cron(30 1 ? * MON-FRI *)" \
  --scalable-target-action MinCapacity=3,MaxCapacity=10 \
  --region ap-south-1

# Scale back down at 9:30 AM IST (04:00 UTC)
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/saferide-prod/saferide-trip-service" \
  --scalable-dimension ecs:service:DesiredCount \
  --scheduled-action-name "morning-cooldown" \
  --schedule "cron(0 4 ? * MON-FRI *)" \
  --scalable-target-action MinCapacity=1,MaxCapacity=10 \
  --region ap-south-1

# Scale up at 2:00 PM IST (08:30 UTC)
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/saferide-prod/saferide-trip-service" \
  --scalable-dimension ecs:service:DesiredCount \
  --scheduled-action-name "afternoon-prewarm" \
  --schedule "cron(30 8 ? * MON-FRI *)" \
  --scalable-target-action MinCapacity=3,MaxCapacity=10 \
  --region ap-south-1

# Scale back down at 4:30 PM IST (11:00 UTC)
aws application-autoscaling put-scheduled-action \
  --service-namespace ecs \
  --resource-id "service/saferide-prod/saferide-trip-service" \
  --scalable-dimension ecs:service:DesiredCount \
  --scheduled-action-name "afternoon-cooldown" \
  --schedule "cron(0 11 ? * MON-FRI *)" \
  --scalable-target-action MinCapacity=1,MaxCapacity=10 \
  --region ap-south-1
```

---

## What Happens on Each Deploy

Each service deploys **independently**. Changing only `auth-service/` triggers only the
auth-service workflow — nothing else rebuilds or restarts.

```
# auth-service change merged to main:
git push origin main
  → deploy-auth-service.yml triggers (path filter matched)
  → deploy-tenant-service.yml does NOT trigger (path didn't match)
  → docker build auth-service
  → push to ECR: saferide-auth-service:{sha} + dev-latest
  → ECS update saferide-dev: saferide-auth-service
  → rolling replace (new task up → old task drained)

# packages/types change merged to main:
git push origin main
  → ALL 6 deploy workflows trigger (packages/** path matches all)
  → 6 parallel builds + 6 parallel ECS updates

# Release deploy (any service):
git push origin release
  → per-service workflow triggers (path filter)
  → manual approval gate (GitHub Environments: production)
  → build → push prod-latest + {sha} tag
  → ECS update saferide-prod: {service}
  → aws ecs wait services-stable  ← blocks until healthy
```

Zero SSH. Zero rsync. Zero manual steps after this initial setup.
