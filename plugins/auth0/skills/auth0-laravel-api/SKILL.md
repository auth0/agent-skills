---
name: auth0-laravel-api
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when protecting Laravel API endpoints with JWT Bearer token validation or
  scope checks. Integrates auth0/login with the AuthorizationGuard for stateless
  APIs receiving access tokens.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔐
    homepage: https://github.com/auth0/agent-skills
---

# ⚠️ Deprecated — install the replacement skill

**Do not use this skill.** It has been consolidated into the single `auth0`
skill, which auto-detects your framework and routes to the same guidance for all
Auth0 authentication work (login, logout, route protection, token validation,
MFA, and more).

ClawHub does **not** install the replacement automatically. When you download
this outdated skill, install the consolidated one by running:

```bash
npx clawhub install auth0
```

Then use the `auth0` skill instead — this one will not be maintained.
