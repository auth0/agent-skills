# Auth0 Security Audit Plugin

This project is an Auth0 Customer Identity Cloud (CIC) security audit plugin for Claude Code.
It targets Auth0 CIC only — not Okta Workforce Identity Cloud or Okta Identity Engine.

**Prerequisites:**
- Node.js ^20.19.0 || ^22.12.0 || ^24.0.0
- `auth0-mcp-server` configured in `.claude/settings.json` (already done — runs via `hooks/mcp-server.js`)

**Credential handling — IMPORTANT:**
All Auth0 credential acquisition is handled automatically by `hooks/mcp-server.js`. Do NOT look for tokens in the OS keychain, `~/.config`, or any other system location. Do NOT attempt to run `auth0-mcp-server init` manually.

The wrapper uses the device authorization flow:
1. Checks for an existing token in the OS keychain (stored by a previous `auth0-mcp-server init` run)
2. If no token is found, runs `npx @auth0/auth0-mcp-server init` (without options) — this opens the Auth0 device-auth page in the browser and persists the token in the OS keychain
3. Spawns `npx @auth0/auth0-mcp-server run`

The MCP tools (`auth0_list_actions`, `auth0_list_applications`, etc.) are ready to use without any additional auth steps after the first browser-based login.

**Slash command:** `/auth0-audit` — see `.claude/commands/auth0-audit.md` for full implementation steps.

## Project Structure

```
.claude/
  commands/
    auth0-audit.md      ← slash command definition (skill steps)
  settings.json         ← MCP server + hook config
hooks/
  inject-auth0-context.js  ← SessionStart hook
  mcp-server.js            ← MCP server wrapper (token caching)
tools/
  render-findings.js    ← ActionsWhisperer output renderer
  token-graveyard.js    ← TokenGraveyard analysis + scoring
  passkeys-readiness.js ← PasskeysReadiness 4-checkpoint script
scripts/
  setup-demo-tenant.js  ← Populates dev tenant with synthetic data
  teardown-demo-tenant.js
  demo-cache.json       ← Cached API responses for offline demo
```
