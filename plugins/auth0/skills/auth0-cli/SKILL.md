---
name: auth0-cli
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when running Auth0 CLI commands to manage tenant resources — creating apps
  or APIs, managing users, roles, organizations, actions, log streams, custom
  domains, or Universal Login config. Also use when calling the Auth0 Management
  API directly via the CLI.
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
