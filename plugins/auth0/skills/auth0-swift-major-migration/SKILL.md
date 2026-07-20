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

# Deprecated

This skill has been consolidated into the single `auth0` skill, which routes to
the same guidance by detecting your framework. Use that skill instead for all
Auth0 authentication work.

ClawHub does not install it automatically. Get the consolidated skill with:

```bash
npx clawhub install auth0
```
