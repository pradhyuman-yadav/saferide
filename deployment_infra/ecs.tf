# ─── ECR REPOSITORY ──────────────────────────────────────────────────────────

resource "aws_ecr_repository" "saferide_ecr" {
  name                 = "saferide_ecr"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "saferide_ecr"
  }
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
          tagPrefixList = ["v"]
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

  tags = {
    Name = "saferide-cluster"
  }
}

# ─── SECURITY GROUP — ECS EC2 INSTANCES ──────────────────────────────────────
# NOTE: All-port ingress is intentionally open for now (development).
# Tighten to specific ports before going to production.

resource "aws_security_group" "ecs_instances" {
  name        = "saferide-ecs-instances-sg"
  description = "ECS EC2 instances — all ingress open (tighten before prod)"
  vpc_id      = aws_vpc.saferide_vpc.id

  ingress {
    description = "All traffic (temporary — dev only)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "saferide-ecs-instances-sg"
    Warning = "all-ports-open-dev-only"
  }
}

# ─── IAM — ECS EC2 INSTANCE ROLE ─────────────────────────────────────────────

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

# ─── LAUNCH CONFIGURATION — t3.micro in private subnet ───────────────────────

data "aws_ssm_parameter" "ecs_ami" {
  # Latest ECS-optimised Amazon Linux 2 AMI for the region
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

resource "aws_launch_configuration" "ecs_lc" {
  name_prefix          = "saferide-ecs-lc-"
  image_id             = data.aws_ssm_parameter.ecs_ami.value
  instance_type        = "t3.micro"
  iam_instance_profile = aws_iam_instance_profile.ecs_instance_profile.name
  key_name             = "saferide_key"   # must match the key pair name in AWS (saferide_key.pem)
  security_groups      = [aws_security_group.ecs_instances.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo ECS_CLUSTER=${aws_ecs_cluster.saferide.name} >> /etc/ecs/ecs.config
  EOF
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ─── AUTO SCALING GROUP ───────────────────────────────────────────────────────

resource "aws_autoscaling_group" "ecs_asg" {
  name                 = "saferide-ecs-asg"
  launch_configuration = aws_launch_configuration.ecs_lc.name
  min_size             = 1
  max_size             = 4
  desired_capacity     = 2

  # Instances live in the private subnets
  vpc_zone_identifier = [
    aws_subnet.private_1.id,
    aws_subnet.private_2.id,
  ]

  target_group_arns = [aws_lb_target_group.ecs_tg.arn]
  health_check_type = "ELB"

  lifecycle {
    create_before_destroy = true
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

# ─── SECURITY GROUP — ALB ─────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "saferide-alb-sg"
  description = "ALB — allow HTTP and HTTPS from internet"
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

  tags = {
    Name = "saferide-alb-sg"
  }
}

# ─── APPLICATION LOAD BALANCER (public subnets) ───────────────────────────────

resource "aws_lb" "saferide_alb" {
  name               = "saferide-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]

  subnets = [
    aws_subnet.public_1.id,
    aws_subnet.public_2.id,
  ]

  enable_deletion_protection = false # set to true in production

  tags = {
    Name = "saferide-alb"
  }
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

  tags = {
    Name = "saferide-ecs-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.saferide_alb.arn
  port              = 80
  protocol          = "HTTP"

  # Forward to ECS target group
  # TODO: replace with HTTPS redirect once ACM cert is provisioned
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_tg.arn
  }
}

# ─── OUTPUTS ──────────────────────────────────────────────────────────────────

output "alb_dns_name" {
  description = "ALB DNS — point your domain CNAME here"
  value       = aws_lb.saferide_alb.dns_name
}

output "ecr_repository_url" {
  description = "ECR repo URL for docker push"
  value       = aws_ecr_repository.saferide_ecr.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.saferide.name
}
