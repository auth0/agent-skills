---
name: auth0-express
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when adding session-based login, logout, or protected routes to an
  Express.js web application. Integrates express-openid-connect — use even if
  the user says "add login to my Express app" or "protect my Express routes".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: 1.1.0
  openclaw:
    emoji: 🔐
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
