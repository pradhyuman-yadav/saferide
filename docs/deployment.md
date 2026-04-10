# SafeRide — Zero to Production

Complete setup guide. Run once. Everything after this is automated.

**What you have:**
- Two GoDaddy domains: `saferide.co.in` (product) · `trysaferide.com` (marketing/redirect)
- Google Workspace for email (`@saferide.co.in`)
- AWS account

**Time estimate:** 3–4 hours end-to-end (most of it waiting for DNS propagation and Apple/Google review).

---

## Table of Contents

1. [External Accounts](#1-external-accounts)
2. [AWS Account Hardening](#2-aws-account-hardening)
3. [Route 53 — Move DNS off GoDaddy](#3-route-53--move-dns-off-godaddy)
4. [Google Workspace MX Records in Route 53](#4-google-workspace-mx-records-in-route-53)
5. [Firebase Projects](#5-firebase-projects)
6. [AWS Infrastructure](#6-aws-infrastructure)
7. [GitHub Repository Setup](#7-github-repository-setup)
8. [Secrets Reference](#8-secrets-reference)
9. [First Deploy](#9-first-deploy)
10. [Android — Google Play Store](#10-android--google-play-store)
11. [iOS — Apple App Store](#11-ios--apple-app-store)
12. [Verification Checklist](#12-verification-checklist)

---

## 1. External Accounts

Create these before touching AWS. You'll need IDs and keys from each.

### 1a. Expo (EAS) Account
→ https://expo.dev/signup

Create an account. Then create a new project:
- Account: your username or org
- Project name: `saferide`
- Slug: `saferide` (becomes part of the app's update URL)

Install EAS CLI locally and log in:
```bash
npm install -g eas-cli
eas login
```

Get your Expo token for CI:
```bash
expo token:create --name saferide-ci
```
Save this as `EXPO_TOKEN` in GitHub Secrets (Step 8).

### 1b. Google Play Console
→ https://play.google.com/console/signup

One-time $25 developer registration fee. Takes 24–48 hours for account activation.

Use the same Google account tied to your Google Workspace, or a dedicated `developer@saferide.co.in` account.

### 1c. Apple Developer Program
→ https://developer.apple.com/programs/enroll/

$99/year. Enrollment takes 24–48 hours for new accounts. Requires an Apple ID with two-factor authentication enabled.

After approval, note your **Team ID** — a 10-character string visible at developer.apple.com → Account → Membership details.

---

## 2. AWS Account Hardening

### 2a. Enable MFA on root account
AWS Console → top-right menu → Security credentials → Multi-factor authentication → Assign MFA device. Use an authenticator app (Google Authenticator or 1Password TOTP). Never use root for day-to-day work.

### 2b. Create a billing alert
AWS Console → Billing → Budgets → Create budget:
- Type: Cost budget
- Amount: ₹5,000/month (~$60 — generous for MVP Fargate workloads)
- Threshold: 80% → email to `you@saferide.co.in`

This catches runaway costs before they become a problem.

### 2c. Set your working region
All resources live in **ap-south-1 (Mumbai)**. DPDP 2023 requires children's location data to not leave India. Set the region selector in the AWS Console top bar before creating any resource.

---

## 3. Route 53 — Move DNS off GoDaddy

Moving both domains to Route 53 gives you one DNS panel for everything: A records, ACM validation CNAMEs, MX records, and SPF/DKIM — all in one place, all managed as code via AWS CLI.

### 3a. Create hosted zones

```bash
# Route 53 is a global service — use us-east-1 for the CLI even though
# your app resources are in ap-south-1
aws route53 create-hosted-zone \
  --name saferide.co.in \
  --caller-reference "saferide-co-in-$(date +%s)"

aws route53 create-hosted-zone \
  --name trysaferide.com \
  --caller-reference "trysaferide-com-$(date +%s)"
```

Get the nameservers for each zone:

```bash
# List zone IDs
aws route53 list-hosted-zones --query 'HostedZones[*].[Name,Id]' --output table

# Get NS records for a zone (replace ZONE_ID)
aws route53 get-hosted-zone --id /hostedzone/ZONE_ID \
  --query 'DelegationSet.NameServers'
```

You get 4 nameservers per zone, e.g.:
```
ns-1234.awsdns-12.org
ns-567.awsdns-34.co.uk
ns-890.awsdns-56.net
ns-123.awsdns-78.com
```

### 3b. Update nameservers in GoDaddy

GoDaddy → My Products → Domains → your domain → DNS → Nameservers → Change → Enter my own nameservers:
- Enter all 4 Route 53 nameservers
- Save

Repeat for `trysaferide.com` with its own 4 nameservers.

**DNS propagation takes 30 minutes to 24 hours.** Your existing GoDaddy records keep serving during propagation. Do not delete anything in GoDaddy yet.

### 3c. trysaferide.com

`trysaferide.com` is a marketing domain. Once DNS is live, point it at the same ALB as `saferide.co.in`. The ALB listener rule (priority 110) serves the same web-admin from both domains. Both get HTTPS via the wildcard ACM certificate.

---

## 4. Google Workspace MX Records in Route 53

**Do this immediately after updating nameservers** — email delivery stops working the moment Route 53 takes over DNS, until you recreate the records there.

Get the exact records from Google Workspace Admin → Domains → Manage domains → View DNS records for `saferide.co.in`.

Create them in Route 53 (Console → Route 53 → saferide.co.in hosted zone → Create record):

**MX records** (one record set with multiple values):
```
Type: MX
Name: (blank — zone apex)
Values:
  1  aspmx.l.google.com
  5  alt1.aspmx.l.google.com
  5  alt2.aspmx.l.google.com
  10 alt3.aspmx.l.google.com
  10 alt4.aspmx.l.google.com
TTL: 3600
```

**SPF** (TXT record):
```
Name: (blank)
Type: TXT
Value: "v=spf1 include:_spf.google.com ~all"
```

**DKIM** (TXT record — copy exact value from Google Workspace Admin):
```
Name: google._domainkey
Type: TXT
Value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4..."
```

**DMARC** (add after SPF and DKIM are confirmed working):
```
Name: _dmarc
Type: TXT
Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@saferide.co.in"
```

Send a test email to confirm delivery before moving on.

---

## 5. Firebase Projects

You already have two projects set up. This step configures them for production.

| | Dev | Prod |
|---|---|---|
| Project ID | `saferide-c3870` | `saferide-prod-a4336` |
| Firebase alias | `default` | `prod` |

### 5a. Enable services in both projects

Firebase Console → each project:

1. **Authentication** → Sign-in method → Enable: Phone (OTP), Email/Password
2. **Firestore Database** → Create → Production mode → Location: `asia-south1` (Mumbai)
3. **Realtime Database** → Create → Singapore (nearest RTDB region to Mumbai) → Locked mode

### 5b. Register Android and iOS apps

In each Firebase project, add both platform apps:

**Android app:**
- Package name: `in.saferide.app`
- Download `google-services.json` after registration

**iOS app:**
- Bundle ID: `in.saferide.app`
- Download `GoogleService-Info.plist` after registration

You'll have 4 files total: dev + prod × Android + iOS. The prod versions go into GitHub Secrets. The dev versions are used locally and in dev CI builds.

### 5c. Generate service account JSON for backend

Firebase Console → Project Settings → Service accounts → Generate new private key → download the JSON.

Convert to single-line format (required for Secrets Manager):
```bash
cat path/to/serviceAccountKey.json | python3 -m json.tool --compact
# or
cat path/to/serviceAccountKey.json | jq -c .
```

Copy the single-line output. You'll paste this into Secrets Manager as the value of `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 5d. Deploy Firestore security rules

```bash
cd path/to/SafeRide

firebase use default
firebase deploy --only firestore:rules,firestore:indexes,database

firebase use prod
firebase deploy --only firestore:rules,firestore:indexes,database
```

---

## 6. AWS Infrastructure

Run these steps in order. All in `ap-south-1` unless noted.

> **No EC2 instances in this stack.** There are no servers to SSH into, patch, or manage.
> ECS Fargate runs your containers on AWS-managed compute.
>
> Three things below will say "EC2" and confuse you — here's why:
> - **VPC** — the virtual network Fargate tasks run inside. Every AWS resource needs one.
>   We use the AWS default VPC so you don't have to configure networking from scratch.
> - **Security Groups** — firewall rules attached to the VPC. The AWS CLI and Console
>   put these under the `ec2` command/section even though they apply to Fargate.
> - **Load Balancers** — the ALB lives under "EC2 → Load Balancers" in the AWS Console.
>   It is not an EC2 instance. It's a managed AWS service that happens to be grouped there.
>
> When you see `aws ec2 ...` in commands below, it means "EC2 API" (the AWS networking API),
> not "create an EC2 server."

### 6a. Note your VPC and subnet IDs

VPC = Virtual Private Cloud. It's a private network inside AWS where your resources talk to each other. You need it even for serverless/Fargate deployments.

```bash
# Get the default VPC (already exists in every AWS account — you don't create it)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' --output text --region ap-south-1)
echo "VPC: $VPC_ID"

# Get two public subnets in different availability zones (also pre-existing)
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=defaultForAz,Values=true" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone]' \
  --output table --region ap-south-1
```

Note `SUBNET_A` (ap-south-1a) and `SUBNET_B` (ap-south-1b).

### 6b. Security groups

Security groups are firewall rules. They control which traffic can reach your Fargate tasks and ALB. No servers involved — these are just network-level allow/deny rules.

```bash
# ALB SG — accepts internet traffic on 80 and 443
# Note: names cannot start with "sg-" (AWS reserves that prefix for SG IDs)
ALB_SG=$(aws ec2 create-security-group \
  --group-name saferide-alb \
  --description "SafeRide ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text --region ap-south-1)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG --region ap-south-1 \
  --ip-permissions \
    'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]'

# ECS SG — only ALB can reach containers
ECS_SG=$(aws ec2 create-security-group \
  --group-name saferide-ecs \
  --description "SafeRide ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text --region ap-south-1)

aws ec2 authorize-security-group-ingress --group-id $ECS_SG --region ap-south-1 \
  --ip-permissions \
    "IpProtocol=tcp,FromPort=80,ToPort=80,UserIdGroupPairs=[{GroupId=$ALB_SG}]" \
    "IpProtocol=tcp,FromPort=4001,ToPort=4005,UserIdGroupPairs=[{GroupId=$ALB_SG}]"

echo "ALB SG: $ALB_SG"
echo "ECS SG: $ECS_SG"
```

### 6c. ECR repositories

```bash
for svc in auth-service tenant-service route-service trip-service livetrack-gateway web-admin; do
  aws ecr create-repository \
    --repository-name "saferide-$svc" \
    --image-scanning-configuration scanOnPush=true \
    --region ap-south-1
done
```

Get your account ID — you'll use this everywhere:
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com"
echo "Registry: $REGISTRY"
```

### 6d. IAM roles

```bash
# Task execution role — ECS agent needs this to pull images and read secrets
aws iam create-role \
  --role-name saferide-ecs-execution-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'

aws iam attach-role-policy \
  --role-name saferide-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam put-role-policy \
  --role-name saferide-ecs-execution-role \
  --policy-name SSMParameterRead \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["ssm:GetParameters","ssm:GetParameter"],
      "Resource":"arn:aws:ssm:ap-south-1:*:parameter/saferide/*"
    }]
  }'

# Task role — what the running application container is allowed to do
aws iam create-role \
  --role-name saferide-ecs-task-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'

# GitHub Actions user — CI uses this to push images and update ECS
aws iam create-user --user-name saferide-github-actions

aws iam put-user-policy \
  --user-name saferide-github-actions \
  --policy-name SafeRideDeploy \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[
      {
        "Effect":"Allow",
        "Action":[
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability","ecr:GetDownloadUrlForLayer","ecr:BatchGetImage",
          "ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:PutImage"
        ],
        "Resource":"*"
      },
      {
        "Effect":"Allow",
        "Action":[
          "ecs:DescribeTaskDefinition","ecs:RegisterTaskDefinition",
          "ecs:UpdateService","ecs:DescribeServices"
        ],
        "Resource":"*"
      },
      {
        "Effect":"Allow",
        "Action":"iam:PassRole",
        "Resource":[
          "arn:aws:iam::*:role/saferide-ecs-execution-role",
          "arn:aws:iam::*:role/saferide-ecs-task-role"
        ]
      }
    ]
  }'

# Create access keys — save the output immediately
aws iam create-access-key --user-name saferide-github-actions
```

The output gives you `AccessKeyId` and `SecretAccessKey`. Add these to GitHub Secrets as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### 6e. SSM Parameter Store (free — replaces Secrets Manager)

SSM Parameter Store Standard tier is **free**. Secrets Manager costs $0.40/secret/month.
Each env var is stored as a separate `SecureString` parameter, encrypted at rest using the
default `aws/ssm` KMS key (no charge). ECS injects them at task startup via ARN reference —
the task definition never contains plaintext values.

Parameter path: `/saferide/{env}/{service}/{KEY}`

```bash
# Helper — paste once into your terminal session
put_param() {
  aws ssm put-parameter \
    --name "$1" --value "$2" \
    --type SecureString --overwrite \
    --region ap-south-1
}

# ── auth-service prod ──────────────────────────────────────────────────────────
put_param "/saferide/prod/auth-service/NODE_ENV"                      "production"
put_param "/saferide/prod/auth-service/PORT"                          "4001"
put_param "/saferide/prod/auth-service/FIREBASE_SERVICE_ACCOUNT_JSON" '{"type":"service_account",...}'
put_param "/saferide/prod/auth-service/FIREBASE_DATABASE_URL"         "https://saferide-prod-a4336-default-rtdb.asia-southeast1.firebasedatabase.app"
put_param "/saferide/prod/auth-service/JWT_PRIVATE_KEY"               "-----BEGIN RSA PRIVATE KEY-----\n..."
put_param "/saferide/prod/auth-service/JWT_PUBLIC_KEY"                "-----BEGIN PUBLIC KEY-----\n..."
put_param "/saferide/prod/auth-service/REDIS_URL"                     "redis://your-redis:6379"
put_param "/saferide/prod/auth-service/LOG_LEVEL"                     "info"

# Repeat the same pattern for tenant-service (PORT=4002), route-service (PORT=4003,
# add GOOGLE_MAPS_API_KEY), trip-service (PORT=4004, add GOOGLE_MAPS_API_KEY),
# livetrack-gateway (PORT=4005).
# Then repeat entire block with /saferide/dev/ prefix for dev environment.
```

Verify a value was stored:
```bash
aws ssm get-parameter \
  --name "/saferide/prod/auth-service/PORT" \
  --with-decryption --query 'Parameter.Value' --output text --region ap-south-1
```

**Note on Redis:** You need Redis for rate limiting and JWT revocation. Use ElastiCache Serverless (~$6/month minimum) or a t4g.micro ElastiCache cluster (~$12/month). Create it in the same default VPC and add `sg-ecs-saferide` as an allowed inbound source on port 6379. Then paste the endpoint into your `REDIS_URL` parameters.

### 6f. CloudWatch log groups

```bash
for svc in auth-service tenant-service route-service trip-service livetrack-gateway web-admin; do
  aws logs create-log-group --log-group-name "/ecs/saferide-$svc-prod" --region ap-south-1
  aws logs create-log-group --log-group-name "/ecs/saferide-$svc-dev"  --region ap-south-1
  # 30 days for prod, 7 days for dev (cost control)
  aws logs put-retention-policy \
    --log-group-name "/ecs/saferide-$svc-prod" --retention-in-days 30 --region ap-south-1
  aws logs put-retention-policy \
    --log-group-name "/ecs/saferide-$svc-dev" --retention-in-days 7 --region ap-south-1
done
```

### 6g. ECS clusters

```bash
aws ecs create-cluster --cluster-name saferide-prod \
  --settings name=containerInsights,value=enabled --region ap-south-1

aws ecs create-cluster --cluster-name saferide-dev --region ap-south-1
```

Container Insights on prod gives CPU/memory graphs per service in CloudWatch — worth the small extra cost.

### 6h. ACM Certificate

AWS Console → Certificate Manager → **confirm region is ap-south-1** → Request → Public certificate:

Add domains:
```
saferide.co.in
*.saferide.co.in
trysaferide.com
*.trysaferide.com
```

Validation method: DNS validation.

ACM shows you CNAME records to add. For each record:
- Route 53 → saferide.co.in hosted zone → Create record → CNAME → paste the name and value ACM shows

ACM checks for these CNAMEs every few minutes and issues the cert automatically. Status changes from `Pending validation` to `Issued` in 5–10 minutes once the records are in.

Note the **Certificate ARN** after issuance.

### 6i. Application Load Balancer

The ALB is a managed AWS load balancer — no server, no patching. It lives under
"EC2 → Load Balancers" in the AWS Console purely for historical reasons; it has
nothing to do with EC2 instances.

**AWS Console → EC2 → Load Balancers → Create → Application Load Balancer:**

| Setting | Value |
|---|---|
| Name | `saferide-alb` |
| Scheme | Internet-facing |
| VPC | Default |
| Subnets | Select `SUBNET_A` and `SUBNET_B` |
| Security group | `sg-alb-saferide` |

**Listeners:**
- HTTP:80 → Action: Redirect to HTTPS (built-in action, status code 301)
- HTTPS:443 → Action: Return fixed 404 (override per rule below) → Certificate: select ACM cert

Note the **ALB DNS name** after creation (looks like `saferide-alb-1234567890.ap-south-1.elb.amazonaws.com`).

**Target groups** — create one per service. For each:
- Target type: **IP** (required for Fargate — not "Instance")
- Protocol: HTTP
- VPC: default
- Health check path: `/health`
- Health check interval: 30s · Healthy threshold: 2 · Unhealthy threshold: 3

| Target group name | Port |
|---|---|
| `tg-saferide-web-admin` | 80 |
| `tg-saferide-auth` | 4001 |
| `tg-saferide-tenant` | 4002 |
| `tg-saferide-route` | 4003 |
| `tg-saferide-trip` | 4004 |
| `tg-saferide-livetrack` | 4005 |

On `tg-saferide-livetrack` specifically: Attributes → Stickiness → Enable, duration 1 day. WebSocket connections are long-lived and must stay on the same task.

**HTTPS listener rules** (Listeners → 443 → Manage rules → Add rule):

| Priority | Condition | Forward to |
|---|---|---|
| 10 | Host: `ws.saferide.co.in` | `tg-saferide-livetrack` |
| 20 | Host: `api.saferide.co.in` AND Path: `/api/v1/auth/*` | `tg-saferide-auth` |
| 30 | Host: `api.saferide.co.in` AND Path: `/api/v1/tenants/*` | `tg-saferide-tenant` |
| 40 | Host: `api.saferide.co.in` AND Path: `/api/v1/routes/*` | `tg-saferide-route` |
| 50 | Host: `api.saferide.co.in` AND Path: `/api/v1/buses/*` | `tg-saferide-route` |
| 60 | Host: `api.saferide.co.in` AND Path: `/api/v1/stops/*` | `tg-saferide-route` |
| 70 | Host: `api.saferide.co.in` AND Path: `/api/v1/trips/*` | `tg-saferide-trip` |
| 100 | Host: `saferide.co.in` | `tg-saferide-web-admin` |
| 110 | Host: `trysaferide.com` | `tg-saferide-web-admin` |

### 6j. Route 53 A records

Route 53 → saferide.co.in hosted zone → Create record:

| Name | Type | Value |
|---|---|---|
| `saferide.co.in` | A → Alias → ALB | Select `saferide-alb` |
| `api.saferide.co.in` | A → Alias → ALB | Select `saferide-alb` |
| `ws.saferide.co.in` | A → Alias → ALB | Select `saferide-alb` |

Route 53 → trysaferide.com hosted zone:

| Name | Type | Value |
|---|---|---|
| `trysaferide.com` | A → Alias → ALB | Select `saferide-alb` |

### 6k. Register initial ECS task definitions

Do this once per service. After first deploy, CI rotates task definitions automatically.

Save the following as `task-def.json`, register it, then delete the file. Repeat for each service, changing `family`, `name`, `containerPort`, and secret keys.

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
      {"name": "REDIS_URL",                     "valueFrom": "arn:aws:ssm:ap-south-1:ACCOUNT_ID:parameter/saferide/prod/auth-service/REDIS_URL"}
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

```bash
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-south-1
```

Port reference for the other services:

| Service | containerPort | CPU | Memory |
|---|---|---|---|
| `auth-service` | 4001 | 256 | 512 |
| `tenant-service` | 4002 | 256 | 512 |
| `route-service` | 4003 | 256 | 512 |
| `trip-service` | 4004 | 512 | 1024 |
| `livetrack-gateway` | 4005 | 512 | 1024 |
| `web-admin` | 80 | 256 | 512 |

### 6l. Create ECS services

AWS Console → ECS → Clusters → `saferide-prod` → Services → Create:

| Field | Value |
|---|---|
| Compute options | Launch type: FARGATE |
| Task definition | `saferide-auth-service` (LATEST) |
| Service name | `saferide-auth-service` |
| Desired tasks | 1 |
| Deployment: Min healthy % | 100 |
| Deployment: Max % | 200 |
| Networking: VPC | Default |
| Networking: Subnets | Both AZs |
| Networking: Security group | `sg-ecs-saferide` |
| Networking: Public IP | **Disabled** (ALB handles ingress) |
| Load balancer | `saferide-alb` |
| Listener | 443 |
| Target group | `tg-saferide-auth` |
| Health check grace period | 60 seconds |

Repeat for all 6 services in both `saferide-prod` and `saferide-dev` clusters.

---

## 7. GitHub Repository Setup

### 7a. Branch protection rules

GitHub → your repo → Settings → Branches → Add branch protection rule:

**Rule for `main`:**
- Pattern: `main`
- ✅ Require a pull request before merging
- ✅ Required approvals: 1
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass: `Typecheck · Lint · Test` (from `ci.yml`)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

**Rule for `release`:**
- Same as main
- ✅ Restrict who can push: only you (or the team)
- Purpose: `release` is promotion-only. You merge `main → release`, never commit directly.

### 7b. Environments

GitHub → Settings → Environments → New environment → name: `production`

Configure:
- ✅ Required reviewers: add yourself (and any partners)
- Deployment branches: Selected branches → `release` only
- No wait timer — human approval is the gate

Every `deploy-{service}.yml` workflow on `release` branch hits this environment gate. The reviewer gets a GitHub notification and approves or rejects from the Actions UI.

---

## 8. Secrets Reference

GitHub → repo → Settings → Secrets and variables → Actions → New repository secret

### AWS (from Step 6d)
| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | AccessKeyId from IAM key creation |
| `AWS_SECRET_ACCESS_KEY` | SecretAccessKey from IAM key creation |

### Firebase
| Secret | How to get it |
|---|---|
| `FIREBASE_TOKEN` | Run `firebase login:ci` on your machine, copy the printed token |

### Web-admin build — dev (VITE_ vars baked into the bundle at build time)
| Secret | Value |
|---|---|
| `DEV_VITE_AUTH_SERVICE_URL` | `https://api-dev.saferide.co.in` |
| `DEV_VITE_FIREBASE_API_KEY` | Dev Firebase → Project settings → Your apps → Web → apiKey |
| `DEV_VITE_FIREBASE_AUTH_DOMAIN` | `saferide-c3870.firebaseapp.com` |
| `DEV_VITE_FIREBASE_PROJECT_ID` | `saferide-c3870` |
| `DEV_VITE_FIREBASE_STORAGE_BUCKET` | `saferide-c3870.appspot.com` |
| `DEV_VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase project settings |
| `DEV_VITE_FIREBASE_APP_ID` | From Firebase project settings |

### Web-admin build — prod
Same keys with `PROD_VITE_` prefix, pointing at `saferide-prod-a4336`.

### Mobile — EAS build environment
| Secret | Value |
|---|---|
| `EXPO_TOKEN` | From Step 1a |
| `PROD_GOOGLE_SERVICES_JSON` | Full contents of prod `google-services.json` |
| `PROD_GOOGLE_SERVICE_INFO_PLIST` | Full contents of prod `GoogleService-Info.plist` |
| `PROD_EXPO_PUBLIC_AUTH_SERVICE_URL` | `https://api.saferide.co.in` |
| `PROD_EXPO_PUBLIC_ROUTE_SERVICE_URL` | `https://api.saferide.co.in` |
| `PROD_EXPO_PUBLIC_TRIP_SERVICE_URL` | `https://api.saferide.co.in` |
| `PROD_EXPO_PUBLIC_WS_URL` | `wss://ws.saferide.co.in` |
| `PROD_EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console → APIs & Services → Credentials |
| `PROD_EXPO_PUBLIC_FIREBASE_API_KEY` | Prod Firebase → Project settings → apiKey |
| `PROD_EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `saferide-prod-a4336.firebaseapp.com` |
| `PROD_EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `saferide-prod-a4336` |
| `PROD_EXPO_PUBLIC_FIREBASE_DATABASE_URL` | From Firebase RTDB URL |
| `PROD_EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `saferide-prod-a4336.appspot.com` |
| `PROD_EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase project settings |
| `PROD_EXPO_PUBLIC_FIREBASE_APP_ID` | From Firebase project settings |

### Android publishing (from Step 10c)
| Secret | Value |
|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | Full JSON contents of Play Store service account key |

### iOS publishing (from Step 11c)
| Secret | Value |
|---|---|
| `APPLE_APP_STORE_CONNECT_KEY_ID` | 10-character Key ID |
| `APPLE_APP_STORE_CONNECT_ISSUER_ID` | UUID Issuer ID |
| `APPLE_APP_STORE_CONNECT_API_KEY` | Full contents of the `.p8` file |
| `APPLE_ASC_APP_ID` | Numeric App ID from App Store Connect URL |

---

## 9. First Deploy

### 9a. Push initial images to ECR

GitHub Actions can't do the first ECS deploy until ECR has at least one image tagged `prod-latest`. Bootstrap it from your machine:

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region ap-south-1 \
  | docker login \
    --username AWS \
    --password-stdin \
    "${ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com"

REGISTRY="${ACCOUNT_ID}.dkr.ecr.ap-south-1.amazonaws.com"

# Backend services (build from repo root — Dockerfiles use monorepo context)
for svc in auth-service tenant-service route-service trip-service livetrack-gateway; do
  docker build -f $svc/Dockerfile -t $REGISTRY/saferide-$svc:prod-latest .
  docker push $REGISTRY/saferide-$svc:prod-latest
done

# Web-admin — requires VITE_ build args
docker build \
  -f web-admin/Dockerfile \
  --build-arg VITE_AUTH_SERVICE_URL="https://api.saferide.co.in" \
  --build-arg VITE_FIREBASE_API_KEY="YOUR_PROD_API_KEY" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="saferide-prod-a4336.firebaseapp.com" \
  --build-arg VITE_FIREBASE_PROJECT_ID="saferide-prod-a4336" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="saferide-prod-a4336.appspot.com" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID" \
  --build-arg VITE_FIREBASE_APP_ID="YOUR_APP_ID" \
  -t $REGISTRY/saferide-web-admin:prod-latest \
  .
docker push $REGISTRY/saferide-web-admin:prod-latest
```

### 9b. Verify ECS services start

AWS Console → ECS → saferide-prod → Services. Each service should reach `Running: 1` and `Health status: Healthy` within 2 minutes.

If any service stays at `Running: 0`:
- Click the service → Tasks tab → stopped task → expand the container → read the stop reason
- Most common causes: wrong secret ARN (typo), image pull failure (wrong ECR URL), health check failing before startPeriod expires

### 9c. Smoke test the endpoints

```bash
curl https://api.saferide.co.in/health
# → {"success":true}

curl https://saferide.co.in/health
# → ok

# Test HTTPS redirect
curl -I http://api.saferide.co.in
# → HTTP/1.1 301 Moved Permanently, Location: https://...
```

### 9d. Activate CI/CD

Make a small change (any file inside a service directory), push to main:

```bash
git commit --allow-empty -m "chore: activate CI deploy pipeline"
git push origin main
```

GitHub Actions → Actions tab → you should see `Deploy auth-service` (or whichever service matches the path change) appear and run.

**For prod:** create a PR from `main` to `release`, get it approved, merge. The per-service workflow triggers, pauses at the `production` environment gate. GitHub sends you an email. Go to Actions → the workflow run → Review deployments → Approve.

---

## 10. Android — Google Play Store

### 10a. Create the app listing

Play Console → All apps → Create app:
- App name: `SafeRide — School Bus Tracking`
- Default language: English (India)
- App or game: App
- Free or paid: Free

The package name `in.saferide.app` is set in `mobile/app.json` and can never change after first upload.

### 10b. Complete store presence

Play Console → SafeRide → Store presence → Main store listing:

**Short description** (80 chars):
> Know where your child's school bus is — live, in real time.

**Full description** (key points to cover):
- Live GPS map for parents
- Push notifications when bus is nearby
- 7-day trip history
- SOS alert system for drivers
- Available in English, Hindi, Kannada, Tamil, Telugu, Marathi, Malayalam

**Screenshots required:**
- Phone: at least 2 screenshots at 1080×1920 or 16:9 ratio
- 7-inch tablet: optional but recommended
- Feature graphic: 1024×500 PNG (shown in search results)

**Content rating:** complete the IARC questionnaire — choose "designed for families" if the app targets children under 13, or "everyone" if parents are the primary users.

**Privacy policy:** `https://saferide.co.in/privacy` ← required by Google Play.

### 10c. Set up Google Play service account (for automated CI publishing)

This one-time setup lets `eas submit` in `mobile.yml` upload builds automatically.

Play Console → Setup → API access:
1. Click "Link to a Google Cloud project" → choose your Firebase project or create new
2. Click "Create new service account" (opens Google Cloud Console)
3. In Cloud Console → IAM → Service accounts → Create:
   - Name: `play-store-publisher`
   - Role: no role needed here (Play Console manages permissions separately)
4. After creating → Keys → Add key → JSON → download the file
5. Back in Play Console → Grant access → find your new service account → Grant access
6. Permissions: Release manager → Apply

Paste the full JSON contents into GitHub Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`.

### 10d. Generate signing key via EAS

EAS manages the Android keystore so you never handle `.jks` files.

```bash
cd mobile
eas build --platform android --profile production
```

First time: EAS asks whether it should manage the keystore. Choose **yes**. It:
1. Generates a keystore
2. Stores it on EAS servers
3. Uses it for every future build

**Backup step** (do not skip): EAS dashboard → project → Credentials → Android keystore → Download. Store this file offline in a password manager or secure vault. If you ever need to leave EAS or EAS has an outage, you need this file to sign APKs independently.

### 10e. First manual upload (one time only)

Google Play requires the **first AAB to be uploaded manually** via the Console — the API cannot create an app's first release.

After `eas build --platform android --profile production` completes:
1. EAS dashboard → your build → Download artifact → download the `.aab`
2. Play Console → SafeRide → Testing → Internal testing → Create new release
3. Upload the `.aab`
4. Release name: `1.0` (auto-populated from version code)
5. Add testers: add your own email
6. Review and rollout

After this first upload, all future uploads are automated via `eas submit` in `mobile.yml`.

### 10f. Update eas.json

Fill in your Apple Team ID (iOS section) and verify the Android track:

```json
"submit": {
  "production": {
    "android": {
      "track": "internal"
    },
    "ios": {
      "ascAppId": "YOUR_NUMERIC_APP_STORE_APP_ID",
      "appleTeamId": "YOUR_APPLE_TEAM_ID"
    }
  }
}
```

Start on `internal` track. Manually promote to `production` in Play Console when ready.

### 10g. Ongoing release flow

Every push to `release` with changes in `mobile/`:
1. `mobile.yml` runs `eas build --platform android --profile production`
2. `autoIncrement: true` bumps the version code automatically
3. `eas submit --platform android --latest` uploads to internal track
4. You test on an internal device
5. Play Console → promote to Production → Google reviews (typically instant for established apps, 1–3 days first time)

---

## 11. iOS — Apple App Store

### 11a. Register the App ID

Apple Developer Portal (developer.apple.com) → Certificates, Identifiers & Profiles → Identifiers → + :
- Type: App IDs
- Platform: iOS, iPadOS
- Description: SafeRide
- Bundle ID: Explicit → `in.saferide.app`
- Capabilities: enable Push Notifications, Associated Domains

### 11b. Create the app in App Store Connect

App Store Connect (appstoreconnect.apple.com) → My Apps → + → New App:
- Platforms: iOS
- Name: `SafeRide — School Bus Tracking`
- Primary language: English (India)
- Bundle ID: `in.saferide.app` (will appear in dropdown after Step 11a)
- SKU: `in.saferide.app`

The **numeric App ID** appears in the URL when you open the app in App Store Connect: `appstoreconnect.apple.com/apps/XXXXXXXXXX`. Save this as `APPLE_ASC_APP_ID`.

**App information to fill in:**
- Privacy policy URL: `https://saferide.co.in/privacy` ← Apple requires this for apps handling location
- Category: Navigation (primary), Education (secondary)
- Content rights: you own all content

**App store listing (1.0 Prepare for Submission):**
- Screenshots: required for 6.7" iPhone and 5.5" iPhone displays. Prepare these in Figma or by recording from a simulator.
- Subtitle (30 chars): `Real-time bus tracking`
- Keywords: school bus, parent tracking, student safety, live GPS
- Support URL: `https://saferide.co.in`
- Description: same messaging as Play Store (adapted for App Store tone)

### 11c. Create App Store Connect API key (for CI)

App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → Generate API Key:
- Name: `saferide-ci`
- Access: Developer

**Download the `.p8` file immediately — Apple only shows it once. You cannot download it again.**

From this screen, note:
- **Key ID** (10 chars, shown next to your key) → `APPLE_APP_STORE_CONNECT_KEY_ID`
- **Issuer ID** (UUID, shown at the top of the page) → `APPLE_APP_STORE_CONNECT_ISSUER_ID`

Paste the full `.p8` contents into `APPLE_APP_STORE_CONNECT_API_KEY`.

### 11d. EAS iOS credentials setup

EAS manages the Distribution Certificate and Provisioning Profile. Run once:

```bash
cd mobile
eas credentials --platform ios
```

Choose: production profile → EAS manages credentials → EAS logs into your Apple Developer account (prompts for Apple ID), creates a distribution certificate, creates an App Store provisioning profile for `in.saferide.app`, and stores both on EAS servers.

From this point on, `eas build --platform ios --profile production` uses these stored credentials automatically.

### 11e. First iOS build and TestFlight upload

```bash
cd mobile
eas build --platform ios --profile production --wait
```

Build takes 10–20 minutes on EAS servers. When complete:

```bash
eas submit --platform ios --latest \
  --non-interactive \
  --asc-app-id $APPLE_ASC_APP_ID
```

This uploads the `.ipa` to App Store Connect. Apple runs an automated binary scan (usually under 1 hour). After the scan:

App Store Connect → TestFlight → your build will appear → Add to Internal Group → add yourself → install via TestFlight on your iPhone.

Test thoroughly on a real device. When ready:

### 11f. Submit for App Store review

App Store Connect → SafeRide → App Store → + Version → `1.0.0`:
1. Select the TestFlight build
2. What's new: "Initial release. Real-time school bus tracking for parents and drivers."
3. Age rating: complete the questionnaire (no objectionable content, location used for parent/child safety)
4. Pricing: Free
5. Submit for Review

**First review: 1–3 business days.** Apple checks:
- Privacy policy URL loads ✅
- App doesn't crash on demo
- Location permission string is accurate (must describe exactly how location is used)
- Push notification permission string explains the purpose

After approval, go live immediately or set a scheduled release date.

### 11g. Ongoing iOS release flow

Every push to `release` with `mobile/**` changes:
1. `mobile.yml` builds new `.ipa` with incremented build number
2. `eas submit` uploads to TestFlight
3. Apple automated scan completes (~1 hour)
4. Build visible in TestFlight — install and test
5. App Store Connect → submit new version for review
6. Updates typically reviewed in 24 hours (much faster than first submission)

---

## 12. Verification Checklist

Run through this after completing the full setup.

### Infrastructure
- [ ] `curl https://api.saferide.co.in/health` → `{"success":true}`
- [ ] `curl -I http://api.saferide.co.in` → `301 Moved Permanently` to https
- [ ] `wscat -c wss://ws.saferide.co.in` → connects without error
- [ ] ECS → `saferide-prod` → all 6 services: `Running: 1`, health: `Healthy`
- [ ] CloudWatch → `/ecs/saferide-auth-service-prod` → log events appear after a request

### Web
- [ ] `https://saferide.co.in` → loads web-admin login page
- [ ] `https://saferide.co.in/privacy` → Privacy Policy renders
- [ ] `https://saferide.co.in/terms` → Terms of Service renders
- [ ] `https://trysaferide.com` → loads (redirects or same content)

### Email
- [ ] Send email to `you@saferide.co.in` → arrives in Google Workspace inbox
- [ ] `dig MX saferide.co.in` → returns Google MX records
- [ ] `dig TXT saferide.co.in` → includes `v=spf1 include:_spf.google.com`

### CI/CD pipeline
- [ ] Push change to `auth-service/` on main → only `Deploy auth-service` workflow runs
- [ ] Push change to `packages/` on main → all 6 service workflows run in parallel
- [ ] Push to `release` → workflow pauses at approval gate → approve → ECS prod updates → `services-stable` check passes

### Mobile
- [ ] Android development build installs and connects to API
- [ ] iOS TestFlight build installs and connects to API
- [ ] Location permission dialog appears (with correct usage description)
- [ ] Push notification received when triggered from Firebase Console

---

## Rollback

ECS retains the last 10 task definition revisions. Rolling back takes under 2 minutes:

```bash
# See recent revisions
aws ecs list-task-definitions \
  --family-prefix saferide-auth-service \
  --sort DESC --query 'taskDefinitionArns[:5]' \
  --output text --region ap-south-1

# Roll back to a specific revision (e.g. revision 42)
aws ecs update-service \
  --cluster saferide-prod \
  --service saferide-auth-service \
  --task-definition arn:aws:ecs:ap-south-1:ACCOUNT_ID:task-definition/saferide-auth-service:42 \
  --region ap-south-1

aws ecs wait services-stable \
  --cluster saferide-prod \
  --services saferide-auth-service \
  --region ap-south-1
```

---

## Ongoing Operations Reference

| Task | Command / Location |
|---|---|
| Deploy backend change | Merge PR to `main` (→ dev) or `release` (→ prod + approval) |
| Deploy mobile update | Merge `mobile/` changes to `release` — `mobile.yml` triggers |
| View live logs | `aws logs tail /ecs/saferide-auth-service-prod --follow --region ap-south-1` |
| Rotate a secret | Update in Secrets Manager → restart service: `aws ecs update-service --cluster saferide-prod --service saferide-auth-service --force-new-deployment` |
| Scale service manually | ECS Console → service → Update → change desired count |
| Add auto-scaling | See `infra/README.md` Step 13 |
| Check ALB request counts | CloudWatch → Metrics → ApplicationELB → per target group |
| Promote Android to production | Play Console → SafeRide → Production → select build → rollout |
| Promote iOS to App Store | App Store Connect → submit build for review |
