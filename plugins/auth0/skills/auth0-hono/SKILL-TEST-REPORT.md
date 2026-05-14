# auth0-hono Skill Test Report

**Date:** 2026-05-14
**Tester:** Claude Code (automated + manual browser verification)
**SDK Version:** @auth0/auth0-hono v2.0.0-beta.0 (local)
**Auth0 Tenant:** dev-10whndm3tf8jetu5.us.auth0.com
**Client ID:** vxx3Ko8xqRJgYqgvkOcuAiGLbYTiYYGM

---

## Test Environment

- Node.js v25.9.0
- Hono v4.12.18
- @hono/node-server v2.0.2
- tsx v4.21.0
- TypeScript v6.0.3
- macOS (Apple Silicon)

---

## Test Methodology

1. Created fresh project from scratch (`npm init -y`)
2. Followed skill Quick Start instructions verbatim
3. Used existing Auth0 app credentials from smoke-test `.env`
4. Tested via curl (automated) + browser (manual login flow)

---

## Test Results

| Test Case | Method | Expected | Actual | Pass |
|-----------|--------|----------|--------|------|
| Public route `GET /` (unauthenticated) | curl | JSON welcome message | `{"message":"Welcome! Visit /auth/login to sign in."}` | PASS |
| Login `GET /auth/login` | curl | 302 to Auth0 + TX cookie | 302 + PKCE code_challenge + `__a0_tx` cookie | PASS |
| Protected route `GET /profile` (unauthenticated) | curl | 302 to `/auth/login` | 302 → `/auth/login` | PASS |
| Logout `GET /auth/logout` | curl | 302 to base URL via IDP | 302 → `http://localhost:3000` | PASS |
| Callback without state `GET /auth/callback?code=fake` | curl | Error JSON | `{"error":"missing_transaction","error_description":"..."}` | PASS |
| Full login flow (browser) | browser | Auth0 Universal Login → callback → session | Authenticated, returned user claims | PASS |
| Authenticated `GET /` | browser | User greeting + email | `{"message":"Hello, tushar.pandey@okta.com!","email":"tushar.pandey@okta.com"}` | PASS |

---

## Issues Found & Fixed

### 1. API Reference Defaults (api.md)

| Field | Documented | Actual (Schema.ts) | Impact |
|-------|-----------|---------------------|--------|
| `authorizationParams.response_type` | `'id_token'` | `'code'` | Customer would expect implicit flow, SDK uses auth code + PKCE |
| `idpLogout` | `false` | `true` | Customer would expect local-only logout, SDK does IDP logout by default |
| `authorizationParams.response_mode` | `'form_post'` | `undefined` (auto for non-code flows) | Misleading for default code flow |
| `routes.login` | `'/login'` (prefixed) | `'/auth/login'` (full path) | Custom route values interpreted incorrectly |

**Status:** Fixed

### 2. Missing Exports (SKILL.md)

| Export | Type | Purpose |
|--------|------|---------|
| `pauseSilentLogin()` | middleware | Temporarily pause silent login |
| `resumeSilentLogin()` | middleware | Resume silent login after cancellation |
| `toSafeRedirect(url, baseURL)` | utility | Validate redirect URL against base |

**Status:** Fixed (added to Quick Reference)

### 3. ESM Requirement Not Documented

**Problem:** `npm init -y` creates `"type": "commonjs"` project. SDK only ships ESM (`"import"` in exports). Results in `ERR_PACKAGE_PATH_NOT_EXPORTED` at runtime.

**Customer impact:** High — first thing that breaks when following Quick Start.

**Status:** Fixed — added to Prerequisites and Common Mistakes table.

### 4. Custom Routes Description (integration.md)

**Problem:** Stated routes are "prefixed with `/auth`" but SDK uses values as full paths (Schema defaults include `/auth/` prefix already).

**Status:** Fixed

---

## Skill Quality Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | 9/10 | Covers all major features, minor exports missing (now added) |
| Accuracy | 7/10 → 9/10 | 4 default values wrong (now fixed) |
| Code examples | 10/10 | All compile, imports correct, patterns match SDK behavior |
| Setup guide | 8/10 → 9/10 | ESM gap (now fixed), bootstrap script well-documented |
| Error documentation | 10/10 | All 7 error types documented with status codes |
| Testing patterns | 9/10 | Mock middleware pattern correct, checklist comprehensive |
| Common mistakes | 8/10 → 10/10 | ESM error added, all major gotchas covered |

**Overall: 9/10** (post-fixes)

---

## Files Modified

```
plugins/auth0/skills/auth0-hono/SKILL.md
  - Added ESM prerequisite
  - Added pauseSilentLogin, resumeSilentLogin to Quick Reference
  - Added toSafeRedirect utility to Quick Reference
  - Added ERR_PACKAGE_PATH_NOT_EXPORTED to Common Mistakes

plugins/auth0/skills/auth0-hono/references/api.md
  - Fixed response_type default: 'id_token' → 'code'
  - Fixed idpLogout default: false → true
  - Fixed response_mode default: 'form_post' → — (conditional)
  - Fixed route defaults: short paths → full paths

plugins/auth0/skills/auth0-hono/references/integration.md
  - Fixed custom routes description (values used as-is, no prefix)
```

---

## Recommendations

1. **SDK package.json:** Consider adding `"require"` export (CJS wrapper) or at minimum a clear error message — many Node projects still default to CJS
2. **Skill Quick Start:** Step 1 could mention `"type": "module"` in package.json setup
3. **Auth0 Dashboard link:** Add deep link to application settings for callback URL configuration
4. **Production deployment:** Add section for Cloudflare Workers / Deno Deploy since SDK supports `env(c)` adapter pattern
