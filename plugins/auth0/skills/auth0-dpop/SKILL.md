---
name: auth0-dpop
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when adding DPoP (Demonstrating Proof-of-Possession) token binding to
  protect API calls with device-bound, sender-constrained access tokens that
  cannot be replayed if stolen. Also use when a user says "bind tokens to the
  client", "prevent token theft", or "sender-constrained tokens".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔑
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
      - auth0
    os:
    - darwin
    - linux
    install:
    - id: brew
      kind: brew
      formula: auth0/auth0-cli/auth0
      bins:
      - auth0
      label: Install Auth0 CLI (brew)
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
