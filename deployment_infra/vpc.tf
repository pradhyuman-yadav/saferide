# ─── VPC ─────────────────────────────────────────────────────────────────────

resource "aws_vpc" "saferide_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "saferide_vpc"
  }
}

# ─── PUBLIC SUBNETS ──────────────────────────────────────────────────────────

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.saferide_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-south-2a"
  map_public_ip_on_launch = true

  tags = {
    Name = "saferide-public-1"
    Tier = "public"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.saferide_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-south-2b"
  map_public_ip_on_launch = true

  tags = {
    Name = "saferide-public-2"
    Tier = "public"
  }
}

# ─── PRIVATE SUBNETS ─────────────────────────────────────────────────────────

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.saferide_vpc.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "ap-south-2a"

  tags = {
    Name = "saferide-private-1"
    Tier = "private"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.saferide_vpc.id
  cidr_block        = "10.0.4.0/24"
  availability_zone = "ap-south-2b"

  tags = {
    Name = "saferide-private-2"
    Tier = "private"
  }
}

# ─── INTERNET GATEWAY (public subnets) ───────────────────────────────────────

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.saferide_vpc.id

  tags = {
    Name = "saferide-igw"
  }
}

resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.saferide_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "saferide-public-rt"
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public_rt.id
}

# ─── NAT GATEWAY + EIP (private subnets egress) ──────────────────────────────

resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = {
    Name = "saferide-nat-eip"
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_nat_gateway" "nat_gw" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_1.id # NAT GW lives in a public subnet

  tags = {
    Name = "saferide-nat-gw"
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_route_table" "private_rt" {
  vpc_id = aws_vpc.saferide_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gw.id
  }

  tags = {
    Name = "saferide-private-rt"
  }
}

resource "aws_route_table_association" "private_1" {
  subnet_id      = aws_subnet.private_1.id
  route_table_id = aws_route_table.private_rt.id
}

resource "aws_route_table_association" "private_2" {
  subnet_id      = aws_subnet.private_2.id
  route_table_id = aws_route_table.private_rt.id
}
