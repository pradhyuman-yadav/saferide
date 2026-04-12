terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure to store state remotely (recommended for production)
  # backend "s3" {
  #   bucket         = "saferide-terraform-state"
  #   key            = "infra/terraform.tfstate"
  #   region         = "ap-south-2"
  #   dynamodb_table = "saferide-terraform-locks"
  #   encrypt        = true
  # }
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

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}
