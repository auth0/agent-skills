---
name: sp-auth0
description: Always use this skill before running any `stripe projects` commands involving Auth0, or before writing any Auth0 integration code in this project.
---

# Auth0 via Stripe Projects (Strict Mode)

You are responsible for correctly provisioning, configuring, and validating Auth0 resources using Stripe Projects. Your goal is not just to create resources, but to ensure they are fully functional, correctly configured, and verifiably working for the target application.

---

## Core Rules

- Prefix every command with: `DEV_MODE=true`
- Use `stripe projects` CLI as the **primary control plane**
- Reference the [Auth0 Management API OpenAPI spec](https://auth0.com/docs/api/management/openapi.json) to inform valid properties for your configuration payloads.
- Never guess config keys or capabilities; use the OpenAPI spec schema.
- Always inspect the catalog before acting to ensure the resource type is supported.
- Always verify after changes
- Prefer complete configuration over minimal configuration
- Do not declare success without validation
- If Stripe Projects cannot perform a required action, fall back to:
  `stripe projects open auth0` and explicitly describe the remaining manual steps. **However, you must exhaust all CLI config options first.**

---

## Required Workflow (Do Not Skip Steps)

### 1) Discover Current State

Run:

```bash
DEV_MODE=true stripe projects status
DEV_MODE=true stripe projects services list
DEV_MODE=true stripe projects catalog auth0 --json
```

Use this data alongside the **Auth0 OpenAPI spec** to determine:
- available Auth0 resource types within Stripe Projects
- supported config fields (mapped to the Auth0 API schema)
- required/optional parameters
- limitations of Stripe Projects

If `client` is not in the catalog, stop and use only available deployable resource types.

---

### 2) Classify the Application Type

Determine the correct Auth0 application type before creating anything:

- **Regular Web App** → server-rendered apps (e.g. Next.js with backend/session)
- **SPA** → browser-only apps using tokens directly
- **Native** → mobile/desktop apps
- **M2M** → service-to-service authentication

If unclear:
- inspect repo structure
- check installed dependencies for Auth0 SDKs and infer the app type from the SDK's purpose
- check routing/auth patterns

Default to **Regular Web App** for server-rendered frameworks unless clearly SPA or M2M.

Never proceed without explicitly choosing an app type.

---

### 3) Align Code Integration

Use the official Auth0 SDK for the project's language and framework. Reuse an existing Auth0 SDK if one is already installed. Do not mix auth patterns.

---

### 4) Read Before You Write (Mandatory Post-Install Step)

**After installing any Auth0 SDK (or discovering one already installed), you MUST complete these steps before writing any integration code:**

1. **Check the installed version** using the project's package manager.

2. **Read the SDK's local README or docs for the installed version.** The installed package directory is the source of truth — not web docs, not training data. If the README references a migration guide or breaking changes doc, read that too.

3. **Identify the SDK's initialization pattern** from the local docs — not from memory or training data. Auth0 SDKs have had breaking changes across major versions (e.g., v4 of `@auth0/nextjs-auth0` changed from `initAuth0()` to `new Auth0Client()`). Your training data may reflect an outdated version.

**Only after completing all three steps may you write integration code.**

If the installed major version differs from what you expected, call it out to the user before proceeding (e.g., "The installed SDK is v4, which uses a different initialization pattern than v3").

This step exists because SDK APIs change across major versions, and build errors from stale patterns are expensive to debug. The locally installed package docs are the single source of truth for the installed version's API.

---

### 5) Derive Required URLs (Do Not Guess)

Determine:

- Base URL (e.g. `http://localhost:3000`)
- Callback URL (e.g. `/auth/callback`)
- Logout URL
- Web origins

Infer from:
- framework conventions
- existing routes
- env files
- README/config
- dev server config

Rules:
- Do NOT invent production domains
- Always include localhost for dev
- Do NOT omit required URLs
- Do NOT use wildcards unless explicitly justified

---

### 6) Create or Update Auth0 Client (Complete Config Only)

Formulate the `--config` JSON payload using the [Auth0 Management API OpenAPI spec](https://auth0.com/docs/api/management/openapi.json). 
- Creation payloads map directly to the `POST /v2/clients` endpoint.
- Update payloads map directly to the `PATCH /v2/clients/{id}` endpoint.

Create:

```bash
DEV_MODE=true stripe projects add auth0/client --name "<name>" --config '<json>' -y
```

Update:

```bash
DEV_MODE=true stripe projects update <name> auth0/client --config '<json>' -y
```

Requirements:
- **CRITICAL:** You MUST configure URIs directly via the CLI. DO NOT instruct the user to configure `callbacks`, `allowed_logout_urls`, or `web_origins` in the dashboard. These are supported API fields and must be included in your `--config` payload.
- You can and should use the CLI to set comprehensive configurations, including `callbacks`, `name`, `description`, `app_type`, `allowed_logout_urls`, `web_origins`, and everything else supported by the spec.
- If `--name` is used, include `"name"` in config
- Always include full URI configuration when supported.
- Do not submit partial configs for full setup requests.

---

### 7) Sync + Verify (Mandatory)

Run:

```bash
DEV_MODE=true stripe projects status
DEV_MODE=true stripe projects env
DEV_MODE=true stripe projects env --pull
```

Confirm:
- resource exists
- config applied
- env variables available locally
- project state is consistent

If verification is incomplete, explicitly state what cannot be confirmed.

---

### 8) Dashboard Fallback (When Needed)

If Stripe Projects cannot configure something:

```bash
DEV_MODE=true stripe projects open auth0
```

Then clearly specify:
- exact field names
- exact values to input
- where in the dashboard to set them

---

## Auth0 Configuration Requirements

For any web-based app, ensure ALL are set via the `--config` flag:

- Allowed Callback URLs (`callbacks`)
- Allowed Logout URLs (`allowed_logout_urls`)
- Allowed Web Origins (`web_origins`, if applicable)

Typical local setup (adjust if needed):

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`

Do not claim setup is complete if these are missing from your CLI execution.

---

## Output Requirements

Always include:

1. What was discovered from catalog/status
2. Chosen application type + reasoning
3. Exact CLI commands used or recommended (including full JSON payloads)
4. Final configuration values (especially URLs, validated against the OpenAPI spec)
5. Verification results
6. Any required manual steps (if applicable, but restricted to unsupported API fields)

---

## Failure Handling

If something fails:

1. Re-check catalog output and the Auth0 OpenAPI spec schema
2. Remove unsupported or incorrectly formatted fields only
3. Do NOT guess replacements
4. Validate service availability (`services list`)
5. Use dashboard fallback if needed (only as a last resort for unsupported fields)

---

## Hard Constraints

- Never instruct the user to configure `callbacks` or `allowed_logout_urls` in the dashboard. You must execute this via the CLI.
- Never fabricate config keys (always refer to the Auth0 OpenAPI spec)
- Never assume production URLs
- Never skip verification
- Never leave URI config incomplete
- Never bypass Stripe Projects when it supports the operation
- Never write integration code before checking the installed SDK version and reading its local README
- Never assume SDK initialization patterns from training data — always verify against the locally installed SDK's README/docs

---

## Commands Reference

```bash
DEV_MODE=true stripe projects status
DEV_MODE=true stripe projects services list
DEV_MODE=true stripe projects catalog auth0 --json
DEV_MODE=true stripe projects add auth0/client --name "<name>" --config '{"callbacks": ["http://localhost:3000/api/auth/callback"], "allowed_logout_urls": ["http://localhost:3000"]}' -y
DEV_MODE=true stripe projects update <name> auth0/client --config '<json>' -y
DEV_MODE=true stripe projects env
DEV_MODE=true stripe projects env --pull
DEV_MODE=true stripe projects open auth0
```
