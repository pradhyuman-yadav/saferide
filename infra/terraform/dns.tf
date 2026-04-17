# ─── ROUTE 53 DATA SOURCES ───────────────────────────────────────────────────

data "aws_route53_zone" "saferide_co_in" {
  name         = "saferide.co.in."
  private_zone = false
}

data "aws_route53_zone" "trysaferide_com" {
  name         = "trysaferide.com."
  private_zone = false
}

# ─── ACM CERTIFICATE ─────────────────────────────────────────────────────────
# Covers the apex and all subdomains with a single cert.

resource "aws_acm_certificate" "saferide" {
  domain_name               = "saferide.co.in"
  subject_alternative_names = ["*.saferide.co.in", "trysaferide.com", "www.trysaferide.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "saferide-cert" }
}

# ─── DNS VALIDATION RECORDS ──────────────────────────────────────────────────

resource "aws_route53_record" "cert_validation_saferide" {
  for_each = {
    for dvo in aws_acm_certificate.saferide.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
    if endswith(dvo.domain_name, "saferide.co.in")
  }

  zone_id         = data.aws_route53_zone.saferide_co_in.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_route53_record" "cert_validation_trysaferide" {
  for_each = {
    for dvo in aws_acm_certificate.saferide.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
    if endswith(dvo.domain_name, "trysaferide.com")
  }

  zone_id         = data.aws_route53_zone.trysaferide_com.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "saferide" {
  certificate_arn = aws_acm_certificate.saferide.arn
  validation_record_fqdns = concat(
    [for r in aws_route53_record.cert_validation_saferide : r.fqdn],
    [for r in aws_route53_record.cert_validation_trysaferide : r.fqdn],
  )

  timeouts {
    create = "2h"
  }
}

# ─── ALB DNS RECORDS — saferide.co.in ────────────────────────────────────────

# Apex: saferide.co.in → ALB (web-admin SPA + API)
resource "aws_route53_record" "apex" {
  zone_id         = data.aws_route53_zone.saferide_co_in.zone_id
  name            = "saferide.co.in"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

# app.saferide.co.in → ALB
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.saferide_co_in.zone_id
  name    = "app.saferide.co.in"
  type    = "A"

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

# api.saferide.co.in → ALB (mobile app calls this)
resource "aws_route53_record" "api" {
  zone_id         = data.aws_route53_zone.saferide_co_in.zone_id
  name            = "api.saferide.co.in"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

# ─── ALB DNS RECORDS — trysaferide.com ───────────────────────────────────────

# trysaferide.com → ALB (listener rule below redirects to saferide.co.in)
resource "aws_route53_record" "trysaferide_apex" {
  zone_id         = data.aws_route53_zone.trysaferide_com.zone_id
  name            = "trysaferide.com"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "trysaferide_www" {
  zone_id         = data.aws_route53_zone.trysaferide_com.zone_id
  name            = "www.trysaferide.com"
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

# ─── HTTPS LISTENER ──────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.saferide_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.saferide.certificate_arn

  # Default: forward saferide.co.in / api.saferide.co.in / app.saferide.co.in to the app
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.prod.arn
  }

  tags = { Name = "saferide-https-listener" }
}

# trysaferide.com → 301 redirect to https://saferide.co.in
resource "aws_lb_listener_rule" "trysaferide_redirect" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    host_header {
      values = ["trysaferide.com", "www.trysaferide.com"]
    }
  }

  action {
    type = "redirect"
    redirect {
      host        = "saferide.co.in"
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─── DEV DNS + ALB ROUTING ───────────────────────────────────────────────────

resource "aws_route53_record" "dev" {
  zone_id = data.aws_route53_zone.saferide_co_in.zone_id
  name    = "dev.saferide.co.in"
  type    = "A"

  alias {
    name                   = aws_lb.saferide_alb.dns_name
    zone_id                = aws_lb.saferide_alb.zone_id
    evaluate_target_health = true
  }
}

# Route dev.saferide.co.in → dev target group (priority 20, below trysaferide redirect)
resource "aws_lb_listener_rule" "dev" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  condition {
    host_header {
      values = ["dev.saferide.co.in"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dev.arn
  }
}

# ─── OUTPUTS ─────────────────────────────────────────────────────────────────

output "app_url" {
  description = "Web admin + API base URL"
  value       = "https://saferide.co.in"
}

output "api_url" {
  description = "API base URL for mobile app"
  value       = "https://api.saferide.co.in"
}

output "dev_url" {
  description = "Dev environment URL"
  value       = "https://dev.saferide.co.in"
}
