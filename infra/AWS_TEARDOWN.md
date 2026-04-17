# AWS Teardown & Restore Guide

> **Reason for teardown:** AWS billing credit requested by support (case with Syed, billing dept).
> Teardown required before credit can be applied.
> **Date of teardown:** 2026-04-13
> **Account ID:** 353452028936

---

## Current State Snapshot (before teardown)

### Region
All production infrastructure is in **ap-south-2 (Hyderabad)** — not Mumbai.
No active resources found in ap-south-1 (Mumbai).

### What's Running

| Resource | Name/ID | Details |
|---|---|---|
| ECS Cluster | `saferide-cluster` | Fargate |
| ECS Service (prod) | `saferide-monolith` | desired=1, running=1 |
| ECS Service (dev) | `saferide-dev` | desired=0, running=0 (scaled down) |
| ECR Repository | `saferide_ecr` | `353452028936.dkr.ecr.ap-south-2.amazonaws.com/saferide_ecr` |
| ECR Images | 2 images (~130 MB each) | Untagged (pushed 2026-04-12) |
| ALB | `saferide-alb` | DNS: `saferide-alb-1030632978.ap-south-2.elb.amazonaws.com` |
| ALB ARN | | `arn:aws:elasticloadbalancing:ap-south-2:353452028936:loadbalancer/app/saferide-alb/e3e0a25a88cb5271` |
| ACM Certificate | `5199e9ea-e9b8-40fe-8404-2dda717a4919` | `saferide.co.in` + `*.saferide.co.in` + `trysaferide.com` + `www.trysaferide.com`, Status: ISSUED |
| VPC | `saferide-vpc` | CIDR: 10.0.0.0/16 |
| Subnet A | `subnet-02eae857b07a246a8` | 10.0.1.0/24, ap-south-2a |
| Subnet B | `subnet-06c770fbd067c83b5` | 10.0.2.0/24, ap-south-2b |
| Elastic IP 1 | `eipalloc-0b5b65c542e885d58` | 16.112.205.99 (in use) |
| Elastic IP 2 | `eipalloc-06c1c185b3f2eaddc` | 18.61.175.8 (in use) |
| CloudWatch Log Group | `/ecs/saferide-monolith` | |
| CloudWatch Log Group | `/ecs/saferide-dev` | |

### Route53 Hosted Zones (IMPORTANT — contains NS delegation)

| Zone | Zone ID | Records |
|---|---|---|
| `saferide.co.in` | `Z0899738Z808TL3LETOV` | 12 records |
| `trysaferide.com` | `Z04176313FTXAI6H9FA76` | 6 records |

**Action needed after restore:** The NS records for both domains must point back to the Route53 nameservers. Check your domain registrar (likely GoDaddy/Namecheap) — the NS records there should already be set and won't change unless you delete and recreate the hosted zone with a new zone ID. **If you delete the hosted zone, the NS servers will change and you'll need to update them at the registrar.**

### IAM Resources (kept — no cost)

| Resource | ARN |
|---|---|
| OIDC Provider | `arn:aws:iam::353452028936:oidc-provider/token.actions.githubusercontent.com` |
| Role: github-actions | `arn:aws:iam::353452028936:role/saferide-github-actions` |
| Role: ecs-execution | `arn:aws:iam::353452028936:role/saferide-ecs-execution-role` |
| Role: ecs-task | `arn:aws:iam::353452028936:role/saferide-ecs-task-role` |
| User: saferide-deploy | `arn:aws:iam::353452028936:user/saferide-deploy` |

> IAM resources have no per-hour cost. You can keep them or destroy them — keeping them saves time on restore.

### GitHub Secrets (already set, survive AWS teardown)

| Secret | Value source |
|---|---|
| `AWS_REGION` | `ap-south-2` |
| `AWS_ROLE_ARN` | `arn:aws:iam::353452028936:role/saferide-github-actions` |
| `ECR_REPOSITORY` | `353452028936.dkr.ecr.ap-south-2.amazonaws.com/saferide_ecr` |
| `FIREBASE_TOKEN` | Firebase project |
| `VITE_FIREBASE_*` | Firebase project config |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Cloud Console |

> These survive teardown. No action needed — they'll work again as soon as infrastructure is restored.

---

## Teardown Steps

### Option A: Terraform destroy (recommended — cleanest)

```bash
cd infra/terraform
terraform destroy
```

This removes everything Terraform manages. Type `yes` when prompted.
**Takes ~5-10 minutes.**

> Note: If `terraform destroy` fails on the ACM certificate (because it's in-use by ALB), Terraform should handle the order automatically. If it hangs, run with `-target` flags below.

### Option B: Manual order (if terraform destroy fails)

Run in this order to avoid dependency errors:

```bash
cd infra/terraform

# 1. Scale ECS services to 0 first (stops billing for tasks)
aws ecs update-service --region ap-south-2 --cluster saferide-cluster --service saferide-monolith --desired-count 0
aws ecs update-service --region ap-south-2 --cluster saferide-cluster --service saferide-dev --desired-count 0

# 2. Destroy in dependency order
terraform destroy -target=aws_appautoscaling_scheduled_action.dev_scale_down
terraform destroy -target=aws_appautoscaling_scheduled_action.dev_scale_up
terraform destroy -target=aws_appautoscaling_target.dev
terraform destroy -target=aws_ecs_service.saferide
terraform destroy -target=aws_ecs_service.dev
terraform destroy -target=aws_ecs_task_definition.saferide
terraform destroy -target=aws_ecs_task_definition.dev
terraform destroy -target=aws_lb_listener_rule.dev
terraform destroy -target=aws_lb_listener_rule.trysaferide_redirect
terraform destroy -target=aws_lb_listener.https
terraform destroy -target=aws_lb_listener.http
terraform destroy -target=aws_lb.saferide_alb
terraform destroy -target=aws_lb_target_group.prod
terraform destroy -target=aws_lb_target_group.dev
terraform destroy -target=aws_acm_certificate_validation.saferide
terraform destroy -target=aws_acm_certificate.saferide
terraform destroy -target=aws_route53_record.apex
terraform destroy -target=aws_route53_record.api
terraform destroy -target=aws_route53_record.app
terraform destroy -target=aws_route53_record.dev
terraform destroy -target=aws_route53_record.trysaferide_apex
terraform destroy -target=aws_route53_record.trysaferide_www
terraform destroy -target='aws_route53_record.cert_validation_saferide["*.saferide.co.in"]'
terraform destroy -target='aws_route53_record.cert_validation_saferide["saferide.co.in"]'
terraform destroy -target='aws_route53_record.cert_validation_trysaferide["trysaferide.com"]'
terraform destroy -target='aws_route53_record.cert_validation_trysaferide["www.trysaferide.com"]'
terraform destroy -target=aws_ecs_cluster.saferide
terraform destroy -target=aws_ecr_lifecycle_policy.saferide_ecr_policy
terraform destroy -target=aws_ecr_repository.saferide_ecr
terraform destroy -target=aws_cloudwatch_log_group.saferide
terraform destroy -target=aws_cloudwatch_log_group.saferide_dev
terraform destroy -target=aws_security_group.alb
terraform destroy -target=aws_security_group.ecs_instances
terraform destroy -target=aws_route_table_association.public_1
terraform destroy -target=aws_route_table_association.public_2
terraform destroy -target=aws_route_table.public_rt
terraform destroy -target=aws_subnet.public_1
terraform destroy -target=aws_subnet.public_2
terraform destroy -target=aws_internet_gateway.igw
terraform destroy -target=aws_vpc.saferide_vpc
# IAM — keep if you want faster restore, destroy if support requires it
terraform destroy -target=aws_iam_role_policy.github_actions
terraform destroy -target=aws_iam_role_policy.ecs_execution_ssm
terraform destroy -target=aws_iam_role_policy_attachment.ecs_execution_base
terraform destroy -target=aws_iam_role.ecs_execution_role
terraform destroy -target=aws_iam_role.ecs_task_role
terraform destroy -target=aws_iam_role.github_actions
terraform destroy -target=aws_iam_openid_connect_provider.github_actions
```

### After terraform destroy — manual cleanup

Some resources may need manual console deletion if Terraform missed them:

1. **Route53 Hosted Zones** — if not destroyed by Terraform (because they were imported as data sources, not managed):
   - Go to Route53 console, delete all records in both zones first, then delete the zones themselves
   - Zone IDs: `Z0899738Z808TL3LETOV` (saferide.co.in), `Z04176313FTXAI6H9FA76` (trysaferide.com)

2. **Elastic IPs** — release if not released by Terraform:
   ```bash
   aws ec2 release-address --region ap-south-2 --allocation-id eipalloc-0b5b65c542e885d58
   aws ec2 release-address --region ap-south-2 --allocation-id eipalloc-06c1c185b3f2eaddc
   ```

3. **ECR images** — delete if ECR repo deletion fails due to images:
   ```bash
   aws ecr batch-delete-image --region ap-south-2 --repository-name saferide_ecr \
     --image-ids "$(aws ecr list-images --region ap-south-2 --repository-name saferide_ecr --query 'imageIds' --output json)"
   ```

4. **Verify nothing is running:**
   ```bash
   aws ec2 describe-instances --region ap-south-2 --query 'Reservations[].Instances[?State.Name!=`terminated`]'
   aws elbv2 describe-load-balancers --region ap-south-2
   aws ec2 describe-addresses --region ap-south-2
   ```

---

## Restore Steps (after credit applied)

### Prerequisites
- All Terraform code is intact in `infra/terraform/` — no code changes needed
- GitHub Secrets already set — no changes needed
- **ONLY manual step:** If Route53 zones were deleted, you need to re-delegate NS records at your domain registrar

### Step 1: Rebuild ECR image

```bash
# Build and push fresh image
docker build -t saferide .
aws ecr get-login-password --region ap-south-2 | docker login --username AWS --password-stdin 353452028936.dkr.ecr.ap-south-2.amazonaws.com
docker tag saferide:latest 353452028936.dkr.ecr.ap-south-2.amazonaws.com/saferide_ecr:latest
docker push 353452028936.dkr.ecr.ap-south-2.amazonaws.com/saferide_ecr:latest
```

Or just push to `main` branch — the GitHub Actions `deploy-prod.yml` workflow will build and deploy automatically.

### Step 2: Run terraform apply

```bash
cd infra/terraform
terraform init   # only needed if .terraform/ was deleted
terraform plan
terraform apply
```

**Takes ~10-15 minutes** (ACM certificate validation takes ~5 minutes).

### Step 3: If Route53 zones were recreated (new zone IDs)

If you deleted and recreated the Route53 hosted zones, the nameservers will have changed.
Get the new NS records:

```bash
aws route53 list-resource-record-sets --hosted-zone-id <NEW_ZONE_ID> \
  --query "ResourceRecordSets[?Type=='NS'].ResourceRecords[].Value" --output text
```

Then update the NS records at your domain registrar for `saferide.co.in` and `trysaferide.com`.
DNS propagation takes 1-48 hours.

### Step 4: Verify deployment

```bash
curl -I https://saferide.co.in/health
curl -I https://dev.saferide.co.in/health
```

---

## About the AL2 ECS AMI Email

> "Upcoming End of Life of the Amazon Linux 2 ECS-optimized AMI in AP-SOUTH-2"

This email refers to an EC2-based ECS container instance still running in ap-south-2. Our **current Terraform uses Fargate** (no EC2 instances), so this is likely a leftover from the old setup. The teardown above will clean it up. No migration action needed — on restore we'll continue using Fargate which is EC2-free.

---

## Cost Breakdown (what was billing)

| Service | Why it cost money |
|---|---|
| ACM Exportable Certificate ($172) | ACM public certs are free. "Exportable" private certs cost money. Check if the wrong cert type was created. |
| ALB | ~$0.008/hour + LCU charges |
| NAT Gateway | ~$0.045/hour + data transfer |
| Public IPv4 Addresses | $0.005/hour each (2 EIPs = $0.01/hour) |
| EC2 instances | Any stopped EC2 in ap-south-2 still charges for EBS |
| Route53 | $0.50/zone/month + query charges |
