---
name: auth0-branding
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when customizing the look of Auth0 Universal Login to match a brand —
  changing colors, logo, fonts, page layout, or login text. Also use when
  resetting branding to defaults or checking if branding is wired up end-to-end.
  Does not cover full custom UI screens — use acul-screen-generator for that.
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
