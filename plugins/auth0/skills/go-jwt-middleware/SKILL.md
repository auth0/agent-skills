---
name: go-jwt-middleware
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when protecting Go HTTP API endpoints with JWT Bearer token validation or
  scope checks. Integrates go-jwt-middleware/v3 — use even if the user says
  "validate tokens in my Go API" or "secure my Go HTTP endpoints".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔐
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
      - go
      - auth0
      - gh
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
    - id: brew
      kind: brew
      formula: gh
      bins:
      - gh
      label: Install GitHub CLI (brew)
---

# Deprecated

This skill has been consolidated into the single `auth0` skill, which routes to
the same guidance by detecting your framework. Use that skill instead for all
Auth0 authentication work.

ClawHub does not install it automatically. Get the consolidated skill with:

```bash
npx clawhub install auth0
```
