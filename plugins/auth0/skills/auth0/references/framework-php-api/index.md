# Auth0 PHP API — reference hub

Protect PHP API endpoints with JWT access token validation using `auth0/auth0-php` in API mode (`STRATEGY_API`).

<!-- Shared prerequisites: critical rules, prerequisites, when-NOT-to-use, SDK
     install, and base .env config. Read this first (hop 1), then follow the
     dispatch table below to the one leaf for your intent. (Carved from the
     original framework-php-api.md.) -->

## Critical rules

- TOKEN ISOLATION: the agent must NEVER directly see, display, echo, log, or store access token values. Do not run `auth0 test token` on its own, and do not ask the user to paste a token into the conversation.
- When testing protected endpoints, ALWAYS chain token acquisition and the `curl` call in a single `&&` command that captures the token into a shell variable and uses it immediately.
- A Client ID is REQUIRED for the M2M token flow — if M2M setup was not completed, ask the user first.
- ALWAYS read `domain` and `audience` from environment variables; never embed credentials in source.

## Prerequisites

- PHP 8.2+ with extensions: `mbstring`, `openssl`, `json`
- Composer installed
- Auth0 API resource configured (not an Application - must be an API)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **PHP web applications with login/logout flows** - use the Auth0 PHP web app integration workflow for session-based authentication
- **Laravel applications** - Use `auth0/laravel-auth0` which has built-in API guard support
- **Symfony applications** - Use `auth0/symfony` with its security bundle
- **Single Page Applications** - use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Issuing tokens** - This skill is for *validating* access tokens, not issuing them

## Install SDK

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7 "symfony/cache:^7.0"
```

- `auth0/auth0-php` - The Auth0 SDK (v8.x)
- `vlucas/phpdotenv` - Load `.env` files into `$_ENV`
- `guzzlehttp/guzzle` + `guzzlehttp/psr7` - PSR-18 HTTP client required by the SDK
- `symfony/cache` - PSR-6 cache for JWKS key caching (recommended for production)

## Configure .env

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_AUDIENCE` is the API identifier you set when creating the API resource in Auth0.

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-php-api/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup (SdkConfiguration, Auth0 class, Token accessors, exceptions, verification flow): `Read: references/framework-php-api/api-reference.md`
- Tenant setup / API + M2M provisioning / test tokens: `Read: references/framework-php-api/setup.md`
- Advanced framework patterns (scopes, RBAC, multi-audience, CORS, caching, custom claims, Organizations, HS256, testing): `Read: references/framework-php-api/patterns.md`
- Any other task (guidance, debugging, scope enforcement): start with `Read: references/framework-php-api/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
