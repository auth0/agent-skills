---
name: auth0-mfa
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when adding MFA or step-up authentication to an app — requiring users to
  verify with a second factor (TOTP, SMS, passkey, push) for login or before a
  sensitive action. Also use for adaptive/risk-based MFA or compliance
  requirements like HIPAA or PCI-DSS, even if the user just says "add two-factor
  auth" or "require MFA before this action".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔐
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
