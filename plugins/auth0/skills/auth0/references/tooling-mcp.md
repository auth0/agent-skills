# Auth0 MCP Server — Tenant Configuration

Use the Auth0 MCP server when it is active in the current agent session (i.e., Auth0 tools appear in the tool list).

The hosted Auth0 MCP server exposes Management API operations as agent tools. No CLI install required.

---

## Check if MCP is active

Auth0 MCP tools start with `auth0_` or `auth0-mcp_`. Check the available tools list.
If no Auth0 tools are present, this session has no active MCP server — use the Auth0 CLI for tenant configuration instead.

---

## Common configuration operations

### Create an Auth0 application
```
Tool: create_client
Parameters:
  name: "My App"
  app_type: "spa" | "regular_web" | "native" | "non_interactive"
  callbacks: ["http://localhost:3000/callback"]
  allowed_logout_urls: ["http://localhost:3000"]
  web_origins: ["http://localhost:3000"]
```

### Create an API
```
Tool: create_resource_server
Parameters:
  name: "My API"
  identifier: "https://api.example.com"
  signing_alg: "RS256"
```

### Enable MFA
```
Tool: update_guardian_policy
Parameters:
  all_types: true

# Or enable a specific factor:
Tool: update_guardian_factor
Parameters:
  factor_name: "sms" | "otp" | "push-notification" | "webauthn-roaming"
  enabled: true
```

### Create an organization
```
Tool: create_organization
Parameters:
  name: "acme-corp"
  display_name: "Acme Corp"
```

### Set custom domain
```
Tool: create_custom_domain
Parameters:
  domain: "login.example.com"
  type: "auth0_managed_certs"
```

### Update Universal Login branding
```
Tool: update_branding
Parameters:
  colors:
    primary: "#eb5424"
    page_background: "#000000"
  logo_url: "https://example.com/logo.png"
```

---

## Notes

- MCP operations call the Auth0 Management API directly — changes take effect immediately.
- For bulk operations or infrastructure-as-code, prefer the Auth0 Terraform provider.
- For scripting or CI/CD without a live MCP session, prefer the Auth0 CLI.
