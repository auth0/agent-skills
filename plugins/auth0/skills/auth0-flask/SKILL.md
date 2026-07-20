---
name: auth0-flask
description: >-
  Deprecated — use the `auth0` skill instead (run `npx clawhub install auth0`).
  Use when adding session-based login, logout, or user profile to a Flask web
  application. Integrates auth0-server-python — use even if the user says "add
  login to my Flask app" or "protect my Flask routes".
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
