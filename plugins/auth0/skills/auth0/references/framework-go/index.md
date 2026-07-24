# Auth0 Go — reference hub

Protect Go HTTP API endpoints with JWT access token validation using github.com/auth0/go-jwt-middleware/v3.

<!-- Shared prerequisites: critical rules, version-fetch instruction,
     prerequisites, when-NOT-to-use, SDK install, and base .env config. Read
     this first (hop 1), then follow the dispatch table below to the one leaf
     for your intent. (Carved from the original framework-go.md.) -->

## Critical rules

- Access token values must stay out of the agent's view. Capture a token into a shell variable inside a single command chain and use it there; print only its length, and discard the shell variable when the command ends. The token itself remains valid until normal expiry or revocation.
- To obtain a client secret, always have the user run `auth0 apps show <CLIENT_ID> --reveal-secrets` in their own terminal, rather than running `--reveal-secrets` from the agent.
- A Client ID is required to run `auth0 test token`; complete the M2M application setup first to obtain it.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/go-jwt-middleware/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

## Prerequisites

- Go 1.21 or higher
- Auth0 API configured (not Application - must be API resource)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Go server-rendered web applications** - Use `go-auth0` for session-based web apps
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Mobile applications** - Use the Auth0 integration workflow for Swift, Android, or React Native
- **Non-Go backends** - Use the Auth0 integration workflow for ASP.NET Core (.NET), or `express-jwt` for Node.js

## Install SDK

```bash
go get github.com/auth0/go-jwt-middleware/v3
go get github.com/joho/godotenv
```

## Configure .env

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain must NOT include `https://`. The middleware constructs the issuer URL automatically.

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-go/integrate.md` |

**Then, as needed for your task:**
- Tenant setup, API + M2M provisioning, and advanced framework patterns (permissions, CORS, DPoP, framework adapters, testing) all live in `integrate.md` (Setup and Integration Patterns sections): `Read: references/framework-go/integrate.md`
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-go/api-reference.md`
- Any other task (guidance, debugging, scope enforcement): start with `Read: references/framework-go/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
