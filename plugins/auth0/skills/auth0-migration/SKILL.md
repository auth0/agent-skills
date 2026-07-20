---
name: auth0-migration
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when migrating users or authentication from another provider (Firebase,
  Cognito, Supabase, Clerk, or custom auth) to Auth0. Covers bulk user import,
  gradual migration strategies, and updating JWT validation — use even if the
  user says "switch our auth to Auth0" or "move our users to Auth0".
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

# Deprecated

This skill has been consolidated into the single `auth0` skill, which routes to
the same guidance by detecting your framework. Use that skill instead for all
Auth0 authentication work.

ClawHub does not install it automatically. Get the consolidated skill with:

```bash
npx clawhub install auth0
```
