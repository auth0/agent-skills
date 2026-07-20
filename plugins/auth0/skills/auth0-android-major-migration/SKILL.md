---
name: auth0-android-major-migration
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when upgrading an Android app's Auth0 SDK (com.auth0.android:auth0) to the
  next major version. Detects the current version, checks prerequisites, and
  applies only the breaking changes that affect the project's real call sites.
  Use even if the user just says "update my Auth0 Android SDK" or "migrate to
  Auth0 Android v4".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  argument-hint: '[target-version]   # e.g. 4.0.0 or 4.0.0-beta.1; omit to auto-resolve the latest v4 release'
  openclaw:
    emoji: 🔄
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
      - gh
---

# Deprecated

This skill has been consolidated into the single `auth0` skill, which routes to
the same guidance by detecting your framework. Use that skill instead for all
Auth0 authentication work.

ClawHub does not install it automatically. Get the consolidated skill with:

```bash
npx clawhub install auth0
```
