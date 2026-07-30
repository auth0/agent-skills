# Auth0 Terraform Provider — Tenant Configuration

Use the Auth0 Terraform provider when the project has a `terraform/` directory or `*.tf` files.
This keeps Auth0 configuration in version-controlled infrastructure-as-code.

Provider: `auth0/auth0` on the Terraform Registry.

---

## Setup

```hcl
# terraform/versions.tf
terraform {
  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "~> 1.0"
    }
  }
}

provider "auth0" {
  domain        = var.auth0_domain
  client_id     = var.auth0_client_id
  client_secret = var.auth0_client_secret
}
```

Authenticate using a Machine-to-Machine application with the Auth0 Management API audience.

---

## Common resources

### Application (client)
```hcl
resource "auth0_client" "my_app" {
  name     = "My App"
  app_type = "spa"

  callbacks              = ["https://example.com/callback"]
  allowed_logout_urls    = ["https://example.com"]
  web_origins            = ["https://example.com"]
  allowed_origins        = ["https://example.com"]

  jwt_configuration {
    alg = "RS256"
  }
}
```

### API (resource server)
```hcl
resource "auth0_resource_server" "my_api" {
  name        = "My API"
  identifier  = "https://api.example.com"
  signing_alg = "RS256"

  enforce_policies     = true
  token_dialect        = "access_token_authz"
  allow_offline_access = true
}
```

### Organization
```hcl
resource "auth0_organization" "acme" {
  name         = "acme-corp"
  display_name = "Acme Corp"
}

resource "auth0_organization_member" "acme_admin" {
  organization_id = auth0_organization.acme.id
  user_id         = auth0_user.admin.id
}

resource "auth0_organization_connections" "acme_connections" {
  organization_id = auth0_organization.acme.id

  enabled_connections {
    connection_id              = auth0_connection.acme_enterprise.id
    assign_membership_on_login = true
  }
}
```

### MFA (Guardian)
```hcl
resource "auth0_guardian" "mfa" {
  policy = "all-applications"

  otp    { enabled = true }
  email  { enabled = true }
  webauthn_roaming { enabled = true }
}
```

### Branding
```hcl
resource "auth0_branding" "main" {
  logo_url        = "https://example.com/logo.png"
  favicon_url     = "https://example.com/favicon.ico"

  colors {
    primary         = "#eb5424"
    page_background = "#000000"
  }
}
```

### Custom domain
```hcl
resource "auth0_custom_domain" "main" {
  domain = "login.example.com"
  type   = "auth0_managed_certs"
}

resource "auth0_custom_domain_verification" "main" {
  custom_domain_id = auth0_custom_domain.main.id

  timeouts {
    create = "15m"
  }
}
```

### DPoP (sender-constrained tokens)
DPoP is configured per resource server (the API that must reject bearer replay)
and per client (whether proof-of-possession is mandatory). There is no
tenant-wide DPoP toggle.

```hcl
resource "auth0_resource_server" "my_api" {
  name       = "My API"
  identifier = "https://api.example.com"

  proof_of_possession {
    mechanism    = "dpop"          # "dpop" or "mtls"
    required     = true            # reject non-DPoP tokens
    required_for = "all_clients"   # or "public_clients"
  }
}

resource "auth0_client" "my_app" {
  name = "My App"

  require_proof_of_possession = true
}
```

### ACUL (Advanced Customization for Universal Login)
The Terraform provider sets a screen's **rendering mode** to `advanced` (this is
what turns ACUL on for that screen) and configures head tags. Building the screen
components themselves is a code task done in the app — Terraform does not scaffold
or deploy component code.

```hcl
resource "auth0_prompt_screen_renderer" "login_id" {
  prompt_type    = "login-id"
  screen_name    = "login-id"
  rendering_mode = "advanced"      # "standard" or "advanced" (ACUL)

  head_tags = jsonencode([
    {
      tag        = "script"
      attributes = { src = "https://cdn.example.com/login-id.js", defer = true }
    }
  ])
}
```

---

## Workflow

```bash
cd terraform/
terraform init
terraform plan -var-file="auth0.tfvars"
terraform apply -var-file="auth0.tfvars"
```

---

## Variable file pattern

```hcl
# auth0.tfvars (add to .gitignore — contains secrets)
auth0_domain        = "your-tenant.auth0.com"
auth0_client_id     = "your-m2m-client-id"
auth0_client_secret = "<YOUR_M2M_CLIENT_SECRET>"
```
