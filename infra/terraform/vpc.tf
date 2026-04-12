# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "saferide_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "saferide_vpc" }
}

# ─── PUBLIC SUBNETS ──────────────────────────────────────────────────────────
# Fargate tasks run here with assign_public_ip = true, removing the need for
# a NAT Gateway (~$32/month saving). Security comes from the task SG
# (port 80 from ALB only), not from subnet placement.

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.saferide_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-south-2a"
  map_public_ip_on_launch = true

  tags = { Name = "saferide-public-1", Tier = "public" }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.saferide_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-south-2b"
  map_public_ip_on_launch = true

  tags = { Name = "saferide-public-2", Tier = "public" }
}

# ─── INTERNET GATEWAY ────────────────────────────────────────────────────────

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.saferide_vpc.id
  tags   = { Name = "saferide-igw" }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.saferide_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = { Name = "saferide-public-rt" }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public_rt.id
}
