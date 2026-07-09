# Auth0 MCP Server — Tenant Configuration

Use the Auth0 MCP server when it is active in the current agent session (i.e., Auth0 tools appear in the tool list).

The hosted Auth0 MCP server exposes a subset of Management API operations as agent tools. No CLI install required.

---

## Check if MCP is active

Auth0 MCP tools are prefixed `auth0_` (e.g. `auth0_list_applications`). Check the available tools list.
If no Auth0 tools are present, this session has no active MCP server — use the Auth0 CLI for tenant configuration instead.

---

## What the MCP server can and cannot do

The MCP server covers a **narrower** surface than the CLI or Terraform. It exposes tools for
applications, resource servers (APIs), application grants, actions, forms, logs, and onboarding/quickstarts.
It does **not** cover the tenant features listed as "No" below.

| Task | MCP tool available? | If not, use |
|---|---|---|
| Create / update an application (client) | Yes | — |
| Create / update a resource server (API), incl. DPoP | Yes | — |
| Create an application grant | Yes | — |
| Manage actions / forms / read logs | Yes | — |
| **MFA / Guardian factors** | **No** | Auth0 CLI or Terraform |
| **Universal Login branding** | **No** | Auth0 CLI or Terraform |
| **Organizations** | **No** | Auth0 CLI or Terraform |
| **Custom domains** | **No** | Auth0 CLI or Terraform |
| **ACUL rendering config** | **No** | Auth0 CLI or Terraform |

When a task needs one of the "No" rows, do not fabricate a tool — tell the user the MCP server does
not expose it and fall back to the CLI (or Terraform if the project is IaC-managed).

---

## Common configuration operations

### Create an application (client)
```
Tool: auth0_create_application
Parameters:
  name: "My App"
  app_type: "spa" | "regular_web" | "native" | "non_interactive"
  callbacks: ["http://localhost:3000/callback"]
  allowed_logout_urls: ["http://localhost:3000"]
  web_origins: ["http://localhost:3000"]
```

### Create a resource server (API)
```
Tool: auth0_create_resource_server
Parameters:
  name: "My API"
  identifier: "https://api.example.com"
  signing_alg: "RS256"
```

### DPoP (sender-constrained tokens) on a resource server
The resource-server tools accept a `proof_of_possession` object, passed straight
through to the Management API. Setting `mechanism: "dpop"` and `required: true`
makes the API reject plain bearer tokens.
```
Tool: auth0_update_resource_server
Parameters:
  id: "<resource server id>"
  proof_of_possession:
    mechanism: "dpop"
    required: true
    required_for: "all_clients"
```
The client-side toggle (`require_proof_of_possession`) is **not** exposed by the
application tools — set it via the Auth0 CLI or Terraform.

---

## Notes

- MCP operations call the Auth0 Management API directly — changes take effect immediately.
- For bulk operations or infrastructure-as-code, prefer the Auth0 Terraform provider.
- For scripting or CI/CD without a live MCP session, prefer the Auth0 CLI.
- For anything in the "No" rows above (MFA, branding, organizations, custom domains, ACUL), use the CLI or Terraform.
