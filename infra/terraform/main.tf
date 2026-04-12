terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "terraform-state-bucket-saferide"
    key     = "terraform.tfstate"
    region  = "ap-south-2"
    encrypt = true
  }
}

provider "aws" {
  region = "ap-south-2"

  default_tags {
    tags = {
      Project     = "SafeRide"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─── VARIABLES ────────────────────────────────────────────────────────────────

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type for ECS hosts"
  type        = string
  default     = "t3.small" # 2 vCPU, 2 GB — minimum for monolith; bump to t3.medium under real load
}

variable "desired_instance_count" {
  description = "Number of EC2 instances in the ECS ASG"
  type        = number
  default     = 1 # Start lean — scale up when you have real traffic
}

# ─── DATA ─────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
