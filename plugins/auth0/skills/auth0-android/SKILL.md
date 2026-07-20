---
name: auth0-android
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when adding Auth0 login, logout, or credential management to an Android
  app in Kotlin or Java. Covers Web Auth, biometric-protected
  CredentialsManager, and MFA — even if the user just says "add login to my
  Android app" without mentioning Auth0. Integrates com.auth0.android:auth0.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔐
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
      - gh
      - node
---

# Deprecated

This skill has been consolidated into the single `auth0` skill, which routes to
the same guidance by detecting your framework. Use that skill instead for all
Auth0 authentication work.

ClawHub does not install it automatically. Get the consolidated skill with:

```bash
npx clawhub install auth0
```
