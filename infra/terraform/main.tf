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


# ─── DATA ─────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
