---
name: auth0-swift-major-migration
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when upgrading an iOS or macOS app's Auth0.swift SDK from v2 to v3.
  Detects the current version, fetches the new SDK source to confirm API
  signatures, and applies only the breaking changes that affect real call sites
  — use even if the user says "update my Auth0 Swift SDK" or "migrate to
  Auth0.swift v3".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔄
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
