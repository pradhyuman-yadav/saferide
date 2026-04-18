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
        description  = "Keep last 10 prod images"
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
        description  = "Keep last 5 dev images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
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

# ─── CLOUDWATCH LOG GROUPS ────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "saferide" {
  name              = "/ecs/saferide-monolith"
  retention_in_days = 30
  tags              = { Name = "saferide-prod-logs" }
}

resource "aws_cloudwatch_log_group" "saferide_dev" {
  name              = "/ecs/saferide-dev"
  retention_in_days = 7  # shorter retention for dev
  tags              = { Name = "saferide-dev-logs" }
}

# ─── SECURITY GROUP — ALB ────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "saferide-alb-sg-"
  description = "ALB - HTTP and HTTPS from internet"
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

  lifecycle { create_before_destroy = true }
  tags = { Name = "saferide-alb-sg" }
}

# ─── SECURITY GROUP — ECS FARGATE TASKS ──────────────────────────────────────

resource "aws_security_group" "ecs_instances" {
  name_prefix = "saferide-ecs-instances-sg-"
  description = "ECS EC2 instances - port 80 from ALB only"
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

  lifecycle { create_before_destroy = true }
  tags = { Name = "saferide-ecs-instances-sg" }
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

  enable_deletion_protection = true   # prevent accidental terraform destroy from taking down prod

  tags = { Name = "saferide-alb" }
}

# ─── TARGET GROUPS ────────────────────────────────────────────────────────────
# Fargate uses awsvpc networking → target_type must be "ip"

resource "aws_lb_target_group" "prod" {
  name        = "saferide-prod-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.saferide_vpc.id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  lifecycle { create_before_destroy = true }
  tags = { Name = "saferide-prod-tg" }
}

resource "aws_lb_target_group" "dev" {
  name        = "saferide-dev-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = aws_vpc.saferide_vpc.id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  lifecycle { create_before_destroy = true }
  tags = { Name = "saferide-dev-tg" }
}

# ─── ALB LISTENERS ───────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.saferide_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─── PROD ECS TASK DEFINITION ────────────────────────────────────────────────
# Fargate valid combination: 512 CPU (0.5 vCPU) + 2048 MB (2 GB)
# Cost: ~$21/month. Headroom for 5 Node processes + nginx (~800 MB peak).

resource "aws_ecs_task_definition" "saferide" {
  family                   = "saferide-monolith"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "saferide"
    image     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/saferide_ecr:prod-latest"
    essential = true

    portMappings = [{
      containerPort = 80
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" }
    ]

    secrets = [
      {
        name      = "FIREBASE_SERVICE_ACCOUNT_JSON"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/auth-service/FIREBASE_SERVICE_ACCOUNT_JSON"
      },
      {
        name      = "JWT_PRIVATE_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/auth-service/JWT_PRIVATE_KEY"
      },
      {
        name      = "JWT_PUBLIC_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/auth-service/JWT_PUBLIC_KEY"
      },
      {
        name      = "FIREBASE_DATABASE_URL"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/auth-service/FIREBASE_DATABASE_URL"
      },
      {
        name      = "GOOGLE_MAPS_API_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/prod/route-service/GOOGLE_MAPS_API_KEY"
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

  lifecycle { ignore_changes = [container_definitions] }
}

# ─── DEV ECS TASK DEFINITION ─────────────────────────────────────────────────
# Fargate valid combination: 256 CPU (0.25 vCPU) + 512 MB
# Cost: ~$5/month running 24/7, ~$1.50/month with night scale-down.

resource "aws_ecs_task_definition" "dev" {
  family                   = "saferide-dev"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "saferide"
    image     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/saferide_ecr:dev-latest"
    essential = true

    portMappings = [{
      containerPort = 80
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "development" }
    ]

    secrets = [
      {
        name      = "FIREBASE_SERVICE_ACCOUNT_JSON"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/dev/auth-service/FIREBASE_SERVICE_ACCOUNT_JSON"
      },
      {
        name      = "JWT_PRIVATE_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/dev/auth-service/JWT_PRIVATE_KEY"
      },
      {
        name      = "JWT_PUBLIC_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/dev/auth-service/JWT_PUBLIC_KEY"
      },
      {
        name      = "FIREBASE_DATABASE_URL"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/dev/auth-service/FIREBASE_DATABASE_URL"
      },
      {
        name      = "GOOGLE_MAPS_API_KEY"
        valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/saferide/dev/route-service/GOOGLE_MAPS_API_KEY"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/saferide-dev"
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  lifecycle { ignore_changes = [container_definitions] }
}

# ─── PROD ECS SERVICE ─────────────────────────────────────────────────────────

resource "aws_ecs_service" "saferide" {
  name            = "saferide-monolith"
  cluster         = aws_ecs_cluster.saferide.id
  task_definition = aws_ecs_task_definition.saferide.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_instances.id]
    assign_public_ip = true  # replaces NAT gateway — tasks pull ECR via public internet
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.prod.arn
    container_name   = "saferide"
    container_port   = 80
  }

  deployment_minimum_healthy_percent = 100  # Fargate: rolling deploy with no downtime
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 90

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]

  lifecycle { ignore_changes = [task_definition] }

  tags = { Name = "saferide-monolith-service" }
}

# ─── PROD AUTOSCALING ─────────────────────────────────────────────────────────
# Scales the prod service between 1 and 3 tasks based on CPU utilisation.
# At 512 CPU / 2 GB per task, 3 tasks = 1.5 vCPU and 6 GB — adequate for
# ~200 simultaneous active bus trips (school morning peak).

resource "aws_appautoscaling_target" "saferide_prod" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.saferide.name}/${aws_ecs_service.saferide.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "saferide_prod_cpu" {
  name               = "saferide-prod-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.saferide_prod.resource_id
  scalable_dimension = aws_appautoscaling_target.saferide_prod.scalable_dimension
  service_namespace  = aws_appautoscaling_target.saferide_prod.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60.0   # scale out when average CPU > 60%
    scale_in_cooldown  = 300    # wait 5 min before scaling in (avoids flapping)
    scale_out_cooldown = 60     # scale out quickly when load spikes
  }
}

# ─── DEV ECS SERVICE ──────────────────────────────────────────────────────────

resource "aws_ecs_service" "dev" {
  name            = "saferide-dev"
  cluster         = aws_ecs_cluster.saferide.id
  task_definition = aws_ecs_task_definition.dev.arn
  desired_count   = 0  # starts at 0; first deploy-dev push brings it to 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_instances.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.dev.arn
    container_name   = "saferide"
    container_port   = 80
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  health_check_grace_period_seconds  = 90

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]

  lifecycle { ignore_changes = [task_definition, desired_count] }

  tags = { Name = "saferide-dev-service" }
}

# ─── DEV SCHEDULED SCALING (scale to 0 at night, back up in morning IST) ────

resource "aws_appautoscaling_target" "dev" {
  max_capacity       = 1
  min_capacity       = 0
  resource_id        = "service/${aws_ecs_cluster.saferide.name}/${aws_ecs_service.dev.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_scheduled_action" "dev_scale_down" {
  name               = "saferide-dev-scale-down"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.dev.resource_id
  scalable_dimension = aws_appautoscaling_target.dev.scalable_dimension
  schedule           = "cron(30 14 * * ? *)"  # 8:00 PM IST (UTC+5:30) = 14:30 UTC

  scalable_target_action {
    min_capacity = 0
    max_capacity = 0
  }
}

resource "aws_appautoscaling_scheduled_action" "dev_scale_up" {
  name               = "saferide-dev-scale-up"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.dev.resource_id
  scalable_dimension = aws_appautoscaling_target.dev.scalable_dimension
  schedule           = "cron(30 2 * * ? *)"  # 8:00 AM IST (UTC+5:30) = 02:30 UTC

  scalable_target_action {
    min_capacity = 1
    max_capacity = 1
  }
}

# ─── OUTPUTS ─────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  value = aws_lb.saferide_alb.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.saferide_ecr.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.saferide.name
}

output "ecs_service_name" {
  value = aws_ecs_service.saferide.name
}
