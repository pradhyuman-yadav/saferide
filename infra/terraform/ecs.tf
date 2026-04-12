# ─── ECR REPOSITORY ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "saferide_ecr" {
  name                 = "saferide_ecr"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "saferide_ecr" }
}

resource "aws_ecr_lifecycle_policy" "saferide_ecr_policy" {
  repository = aws_ecr_repository.saferide_ecr.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["prod"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ─── ECS CLUSTER ─────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "saferide" {
  name = "saferide-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "saferide-cluster" }
}

# ─── IAM — EC2 INSTANCE ROLE (lets EC2 register with ECS cluster) ────────────

data "aws_iam_policy_document" "ecs_instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_instance_role" {
  name               = "saferide-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_instance_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_instance_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance_profile" {
  name = "saferide-ecs-instance-profile"
  role = aws_iam_role.ecs_instance_role.name
}

# ─── IAM — ECS TASK EXECUTION ROLE (pulls ECR image, reads SSM secrets) ──────

resource "aws_iam_role" "ecs_execution_role" {
  name = "saferide-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_base" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allows the execution role to pull secrets from SSM Parameter Store
resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "SSMParameterRead"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/*"
    }]
  })
}

# ─── IAM — ECS TASK ROLE (permissions the app itself has at runtime) ─────────

resource "aws_iam_role" "ecs_task_role" {
  name = "saferide-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# ─── CLOUDWATCH LOG GROUP ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "saferide" {
  name              = "/ecs/saferide-monolith"
  retention_in_days = 30

  tags = { Name = "saferide-monolith-logs" }
}

# ─── SECURITY GROUP — ALB (internet-facing) ───────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "saferide-alb-sg"
  description = "ALB — HTTP and HTTPS from internet"
  vpc_id      = aws_vpc.saferide_vpc.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "saferide-alb-sg" }
}

# ─── SECURITY GROUP — ECS EC2 INSTANCES (only accept traffic from ALB) ───────

resource "aws_security_group" "ecs_instances" {
  name        = "saferide-ecs-instances-sg"
  description = "ECS EC2 instances — port 80 from ALB only"
  vpc_id      = aws_vpc.saferide_vpc.id

  ingress {
    description     = "HTTP from ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "saferide-ecs-instances-sg" }
}

# ─── LAUNCH TEMPLATE ─────────────────────────────────────────────────────────

data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

resource "aws_launch_template" "ecs_lt" {
  name_prefix   = "saferide-ecs-lt-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.instance_type
  key_name      = "saferide_key" # EC2 key pair — create in AWS Console before terraform apply

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance_profile.name
  }

  network_interfaces {
    security_groups             = [aws_security_group.ecs_instances.id]
    associate_public_ip_address = false # instances live in private subnets
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo ECS_CLUSTER=${aws_ecs_cluster.saferide.name} >> /etc/ecs/ecs.config
  EOF
  )

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "saferide-ecs-lt" }
}

# ─── AUTO SCALING GROUP ───────────────────────────────────────────────────────

resource "aws_autoscaling_group" "ecs_asg" {
  name             = "saferide-ecs-asg"
  min_size         = 1
  max_size         = 4
  desired_capacity = var.desired_instance_count

  launch_template {
    id      = aws_launch_template.ecs_lt.id
    version = "$Latest"
  }

  vpc_zone_identifier = [
    aws_subnet.private_1.id,
    aws_subnet.private_2.id,
  ]

  health_check_type         = "ELB"
  health_check_grace_period = 120

  lifecycle {
    create_before_destroy = true
    # ECS manages desired_capacity via capacity provider — prevent Terraform drift
    ignore_changes = [desired_capacity]
  }

  tag {
    key                 = "Name"
    value               = "saferide-ecs-instance"
    propagate_at_launch = true
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }
}

# ─── ECS CAPACITY PROVIDER (links the ASG to the ECS cluster) ────────────────

resource "aws_ecs_capacity_provider" "saferide" {
  name = "saferide-capacity-provider"

  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.ecs_asg.arn

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 80 # keep instances at ~80% utilisation before scaling out
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "saferide" {
  cluster_name       = aws_ecs_cluster.saferide.name
  capacity_providers = [aws_ecs_capacity_provider.saferide.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.saferide.name
    weight            = 1
  }
}

# ─── APPLICATION LOAD BALANCER ───────────────────────────────────────────────

resource "aws_lb" "saferide_alb" {
  name               = "saferide-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]

  subnets = [
    aws_subnet.public_1.id,
    aws_subnet.public_2.id,
  ]

  enable_deletion_protection = false # set to true once you have real users

  tags = { Name = "saferide-alb" }
}

resource "aws_lb_target_group" "ecs_tg" {
  name        = "saferide-ecs-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.saferide_vpc.id
  target_type = "instance"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "saferide-ecs-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.saferide_alb.arn
  port              = 80
  protocol          = "HTTP"

  # TODO: once ACM cert is provisioned, change this to HTTPS redirect
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_tg.arn
  }
}

# ─── ECS TASK DEFINITION ─────────────────────────────────────────────────────
# Memory budget for t3.small (2 GB total):
#   OS + ECS agent: ~400 MB reserved
#   Task:          1500 MB  ← what we declare here
#   Headroom:       ~100 MB
#
# Each Node process uses ~100-200 MB idle.
# 5 processes × 150 MB + nginx ~50 MB ≈ 800 MB working set — fits comfortably.

resource "aws_ecs_task_definition" "saferide" {
  family                   = "saferide-monolith"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "512"  # leave the other 1024 for the OS
  memory                   = "1500"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "saferide"
    image     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/saferide_ecr:prod-latest"
    essential = true

    portMappings = [{
      containerPort = 80
      hostPort      = 80
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" }
    ]

    secrets = [
      {
        name      = "FIREBASE_SERVICE_ACCOUNT_JSON"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/FIREBASE_SERVICE_ACCOUNT_JSON"
      },
      {
        name      = "JWT_PRIVATE_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/JWT_PRIVATE_KEY"
      },
      {
        name      = "JWT_PUBLIC_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/JWT_PUBLIC_KEY"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/saferide-monolith"
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  # Terraform manages the task definition shape, not the image tag.
  # Image updates happen via `docker push :prod-latest` + force-new-deployment.
  lifecycle {
    ignore_changes = [container_definitions]
  }
}

# ─── ECS SERVICE ─────────────────────────────────────────────────────────────
# Note on deployments: bridge networking + hostPort 80 means only one task
# can run per instance. With desired_count=1 and one instance, a rolling
# deploy briefly stops the old task before starting the new one (~30-60s
# downtime). Deploy during off-peak hours until you scale to 2+ instances.

resource "aws_ecs_service" "saferide" {
  name            = "saferide-monolith"
  cluster         = aws_ecs_cluster.saferide.id
  task_definition = aws_ecs_task_definition.saferide.arn
  desired_count   = 1

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.saferide.name
    weight            = 1
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs_tg.arn
    container_name   = "saferide"
    container_port   = 80
  }

  deployment_minimum_healthy_percent = 0   # required on single-instance: stop old before starting new
  deployment_maximum_percent         = 100
  health_check_grace_period_seconds  = 90  # give PM2 + services time to fully start

  depends_on = [
    aws_lb_listener.http,
    aws_ecs_cluster_capacity_providers.saferide,
  ]

  lifecycle {
    # CI/CD rotates task definitions — Terraform should not override them
    ignore_changes = [task_definition]
  }

  tags = { Name = "saferide-monolith-service" }
}

# ─── OUTPUTS ─────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "Point your domain CNAME at this"
  value       = aws_lb.saferide_alb.dns_name
}

output "ecr_repository_url" {
  description = "Use this in your docker push commands"
  value       = aws_ecr_repository.saferide_ecr.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.saferide.name
}

output "ecs_service_name" {
  value = aws_ecs_service.saferide.name
}
