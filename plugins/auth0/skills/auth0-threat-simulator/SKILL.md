---
name: auth0-threat-simulator
description: Use after integrating any Auth0 SDK to simulate identity attacks against the end-to-end setup — validates both application-side SDK configuration and Auth0 tenant security by testing for token replay, credential stuffing, session fixation, PKCE downgrade, redirect URI manipulation, and other auth threats across the full integration surface.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F6E1"
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
        - node
        - auth0
      os:
        - darwin
        - linux
      install:
        - id: brew
          kind: brew
          package: auth0/auth0-cli/auth0
          bins: [auth0]
          label: 'Install Auth0 CLI (brew)'
---

# Auth0 Threat Simulator

Simulate common identity attacks against an end-to-end Auth0 integration — from the SDK setup in the application to the tenant configuration — to identify vulnerabilities and recommend specific fixes.

This skill validates the **complete attack surface**: how the SDK is configured in the app, how the Auth0 tenant is set up, and how they interact under adversarial conditions.

## Prerequisites

- Auth0 CLI authenticated (`auth0 login`) to the target tenant
- Application codebase with an Auth0 SDK already integrated
- Node.js 18+ for running simulation checks

## When NOT to Use

- **Before SDK integration** — use the appropriate SDK skill first (`auth0-nextjs`, `auth0-react`, `auth0-android`, etc.), then validate with this skill
- **Against production tenants with real users** — use a staging/dev tenant or get explicit authorization
- **For load testing or DoS** — this tests security logic, not infrastructure capacity
- **Without authorization** — only test tenants you own or have written permission to test

## Threat Simulation Workflow

### 1. Detect Integration and Gather Context

> **Agent instruction:** First, identify what SDK and framework are in use, then gather both app-side config and tenant-side config:
>
> **Detect the SDK:**
> ```bash
> # JS/TS projects
> cat package.json 2>/dev/null | jq '{dependencies, devDependencies}' | grep -i auth0
>
> # Android
> grep -r "auth0" build.gradle* 2>/dev/null
>
> # iOS
> grep -r "Auth0" Package.swift Podfile 2>/dev/null
>
> # Python
> grep -i auth0 requirements.txt pyproject.toml 2>/dev/null
> ```
>
> **Read the app-side configuration** (env vars, SDK config, middleware, providers). Identify the Client ID from the app's env/config.
>
> **Fetch the tenant-side configuration:**
> ```bash
> auth0 apps show <CLIENT_ID> --json
> auth0 api get "attack-protection/brute-force-protection"
> auth0 api get "attack-protection/breached-password-detection"
> auth0 api get "attack-protection/suspicious-ip-throttling"
> auth0 api get "tenants/settings" | jq '{session_lifetime, idle_session_lifetime}'
> auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | {name, options: {passwordPolicy: .options.passwordPolicy}}'
> ```

### 2. Simulate Token Security Attacks

Test the token handling across both the SDK configuration and Auth0 tenant settings.

#### Attack T1: Token Replay

**What:** An attacker steals an access token and replays it from a different client/origin.

> **Agent instruction:** Check both sides:
> ```bash
> # Tenant side: token binding and lifetimes
> auth0 apps show <CLIENT_ID> --json | jq '{jwt_configuration, refresh_token}'
> auth0 apis list --json | jq '.[] | {name, identifier, token_lifetime}'
> ```
> **App side:** Check if the SDK is configured with a specific `audience` parameter. Grep for:
> - Next.js: `authorizationParams: { audience:` in `auth0.ts`/`lib/auth0.ts`
> - React: `audience` prop on `Auth0Provider`
> - Android: `.withAudience()` in WebAuthProvider calls
> - Express: `authorizationParams: { audience:` in auth config

**VULNERABLE if:**
- No `audience` configured in SDK (tokens are opaque Auth0 tokens, not JWT — less useful for APIs but still a config gap)
- Access token lifetime > 3600 seconds on the API
- Refresh token rotation disabled

**Fix:** Set audience in SDK config AND reduce token lifetime in Auth0 API settings.

---

#### Attack T2: Refresh Token Theft

**What:** Attacker steals a refresh token (XSS on SPA, device theft on mobile) and mints new access tokens.

> **Agent instruction:**
> ```bash
> # Tenant: check rotation settings
> auth0 apps show <CLIENT_ID> --json | jq '.refresh_token'
> ```
> **App side:** Check token storage:
> - SPA: Are tokens stored via SDK (in-memory/web worker) or manually in localStorage? Grep for `localStorage.setItem` near token values.
> - Android: Is `SecureCredentialsManager` used or plain SharedPreferences?
> - iOS: Is `CredentialsManager` used or plain UserDefaults/Keychain without biometrics?
> - Next.js: Tokens in HTTP-only cookies (correct by default in v4)

**VULNERABLE if:**
- `rotation_type` is `non-rotating`
- `reuse_interval` > 0 (allows parallel use of old tokens)
- `expiration_type` is `non-expiring`
- App stores tokens in localStorage (SPA) or SharedPreferences (Android)

---

#### Attack T3: Client Secret Exposure

**What:** Client secret leaked in frontend code, version control, or logs.

> **Agent instruction:**
> - For SPAs: Client secret must NOT exist anywhere in the codebase. Grep for `AUTH0_CLIENT_SECRET`, `client_secret` in frontend files.
> - For Regular Web Apps: Secret must be in `.env.local`/`.env` and that file must be in `.gitignore`.
> - Check: `grep -r "client_secret\|AUTH0_CLIENT_SECRET\|AUTH0_SECRET" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.html" src/ app/ pages/ 2>/dev/null`
> - Check: `grep -r "AUTH0_SECRET\|AUTH0_CLIENT_SECRET" .env .env.local 2>/dev/null` and verify `.gitignore` contains the env file.

**VULNERABLE if:**
- Client secret found in frontend/public code
- `.env` or `.env.local` not in `.gitignore`
- Secret hardcoded (not from environment variable)
- SPA or Native app has a client secret set in Auth0 (should have `token_endpoint_auth_method: none`)

---

### 3. Simulate Authentication Flow Attacks

Test the authorization flow as configured in both the SDK and the tenant.

#### Attack A1: PKCE Downgrade

**What:** Public client (SPA/Native) without PKCE is vulnerable to authorization code interception.

> **Agent instruction:**
> ```bash
> auth0 apps show <CLIENT_ID> --json | jq '{app_type, grant_types, token_endpoint_auth_method}'
> ```
> **App side:** Verify the SDK version supports PKCE:
> - `@auth0/auth0-spa-js` >= 2.0 (always uses PKCE)
> - `@auth0/auth0-react` >= 2.0 (uses auth0-spa-js under the hood)
> - `nextjs-auth0` >= 4.0 (uses PKCE for Regular Web App)
> - `react-native-auth0` >= 3.0 (PKCE by default)
> - `com.auth0.android:auth0` >= 2.0 (PKCE by default)
> - `Auth0.swift` >= 2.0 (PKCE by default)

**VULNERABLE if:**
- `grant_types` includes `implicit` (deprecated, exposes tokens in URL)
- App type is SPA/Native but SDK version is too old for PKCE enforcement
- Custom auth implementation bypasses SDK's PKCE handling

---

#### Attack A2: Redirect URI Manipulation

**What:** Overly permissive callback URLs allow redirecting auth codes/tokens to attacker-controlled servers.

> **Agent instruction:** Cross-reference app config with Auth0 tenant:
> ```bash
> auth0 apps show <CLIENT_ID> --json | jq '{callbacks, allowed_logout_urls, web_origins}'
> ```
>
> **Build the expected callback URL from the app:**
> - Next.js v4: `APP_BASE_URL` + `/auth/callback`
> - React SPA: `redirect_uri` prop or `window.location.origin`
> - Android: `{scheme}://{domain}/android/{package}/callback`
> - iOS: `{bundleId}://{domain}/ios/{bundleId}/callback`
> - Express: `AUTH0_BASE_URL` + `/callback`
>
> Compare against what's registered in `callbacks`.

**VULNERABLE if:**
- Callback URLs contain wildcards (`*`)
- Callback URLs use HTTP for non-localhost
- Localhost callbacks present on a production tenant
- Expected callback from app is NOT registered in Auth0 (login will fail)
- Extra unused callback URLs registered (unnecessary attack surface)
- Mismatch between app's callback and Auth0's registered callbacks

---

#### Attack A3: Open Redirect via Logout

**What:** If `allowed_logout_urls` is not restrictive, an attacker can craft a logout link that redirects users to a phishing page.

> **Agent instruction:**
> ```bash
> auth0 apps show <CLIENT_ID> --json | jq '.allowed_logout_urls'
> ```
> **App side:** Check where the app redirects after logout:
> - Next.js: `returnTo` in logout redirect
> - React: `logoutParams.returnTo`
> - Android: `.withReturnToUrl()`
> - Express: `returnTo` in logout route

**VULNERABLE if:**
- `allowed_logout_urls` is empty (logout may not redirect properly)
- `allowed_logout_urls` contains overly broad patterns
- App's logout redirect URL is not in `allowed_logout_urls`

---

#### Attack A4: App Type Mismatch

**What:** A SPA SDK registered as a Regular Web App (or vice versa) creates token handling vulnerabilities.

> **Agent instruction:**
> ```bash
> auth0 apps show <CLIENT_ID> --json | jq '.app_type'
> ```
> Cross-reference with the SDK detected in step 1.

**VULNERABLE if:**
- SPA SDK (`@auth0/auth0-react`, `@auth0/auth0-vue`, `@auth0/auth0-angular`) but app type is NOT `spa`
- Server SDK (`nextjs-auth0`, `express-openid-connect`) but app type is NOT `regular_web`
- Mobile SDK (`react-native-auth0`, `Auth0.swift`, `com.auth0.android:auth0`) but app type is NOT `native`
- `token_endpoint_auth_method` is `client_secret_post` for a SPA/Native app (should be `none`)

---

### 4. Simulate Credential Attacks

Test the tenant's defenses against credential-based attacks.

#### Attack C1: Credential Stuffing & Brute Force

> **Agent instruction:**
> ```bash
> auth0 api get "attack-protection/brute-force-protection" | jq '.'
> auth0 api get "attack-protection/suspicious-ip-throttling" | jq '.'
> auth0 api get "attack-protection/breached-password-detection" | jq '.'
> ```

**VULNERABLE if:**
- Brute-force protection disabled
- Breached password detection disabled
- Suspicious IP throttling disabled
- Max attempts threshold > 10

---

#### Attack C2: Weak Password Policy

> **Agent instruction:**
> ```bash
> auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | {name, options: {passwordPolicy: .options.passwordPolicy, password_complexity_options: .options.password_complexity_options, password_no_personal_info: .options.password_no_personal_info}}'
> ```

**VULNERABLE if:**
- `passwordPolicy` is `none` or `low`
- No password history enforcement
- No personal info restriction

---

### 5. Simulate Session Attacks

#### Attack S1: Session Hijacking via Excessive Lifetime

> **Agent instruction:**
> ```bash
> auth0 api get "tenants/settings" | jq '{session_lifetime, idle_session_lifetime}'
> ```

**VULNERABLE if:**
- `session_lifetime` > 72 hours
- `idle_session_lifetime` > 24 hours

---

#### Attack S2: Incomplete Logout

> **Agent instruction:**
> **App side:** Check if the app's logout implementation is complete:
> - Does it call Auth0's `/v2/logout` endpoint? (SDK handles this, but check custom implementations)
> - Does it revoke refresh tokens? Grep for `revoke` or `/oauth/revoke`
> - Does it clear local storage/sessions?
>
> **Tenant side:**
> ```bash
> auth0 apps show <CLIENT_ID> --json | jq '.allowed_logout_urls'
> ```

**VULNERABLE if:**
- App doesn't use SDK's built-in logout (custom implementation skips Auth0 session clear)
- Refresh tokens not revoked on logout
- `allowed_logout_urls` empty (logout redirect fails silently)

---

### 6. Generate Threat Simulation Report

> **Agent instruction:** Produce a structured report covering both the app and tenant sides. For each finding, specify whether the fix is app-side (code change), tenant-side (Auth0 CLI/Dashboard), or both:

```markdown
# Auth0 Threat Simulation Report

## Integration Under Test
- **Framework:** [framework]
- **SDK:** [package@version]
- **Auth0 App:** [name] (Client ID: [id])
- **App Type:** [SPA | Regular Web App | Native]
- **Tenant:** [tenant domain]

## Risk Summary
- **Critical:** [count] — actively exploitable
- **High:** [count] — exploitable with minimal effort
- **Medium:** [count] — exploitable under specific conditions
- **Low:** [count] — defense-in-depth improvements

## Critical Findings
| # | Attack | Vulnerable Component | Finding | Fix Location |
|---|--------|---------------------|---------|--------------|
| 1 | ... | App / Tenant / Both | ... | ... |

## High-Risk Findings
| # | Attack | Vulnerable Component | Finding | Fix Location |
|---|--------|---------------------|---------|--------------|

## Medium-Risk Findings
...

## Passed Tests
- [Tests that passed]

## Remediation Commands

### App-Side Fixes
[Code changes needed in the application]

### Tenant-Side Fixes
[Auth0 CLI commands to fix tenant configuration]
```

## Detailed Documentation

- **[Setup Guide](references/setup.md)** — Preparing a tenant for threat simulation
- **[Attack Catalog](references/attack-catalog.md)** — Full catalog of simulated attacks per SDK type
- **[Remediation Guide](references/remediation.md)** — Fix patterns for every finding (app-side and tenant-side)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Running only tenant-side checks | Always validate both sides — a secure tenant with a misconfigured SDK is still vulnerable |
| Ignoring token storage in the app | Tenant rotation settings are useless if tokens are in localStorage |
| Checking only the primary callback | Test ALL configured callbacks and logout URLs for manipulation |
| Assuming latest SDK = secure | SDK must be configured correctly — just installing it isn't enough |
| Skipping M2M applications | Machine-to-machine apps with broad scopes are high-value targets |

## Related Skills

- `auth0-quickstart` — Set up Auth0 tenant from scratch
- `auth0-nextjs` — Next.js SDK integration
- `auth0-react` — React SPA SDK integration
- `auth0-android` — Android SDK integration
- `auth0-swift` — iOS/macOS SDK integration
- `auth0-mfa` — Multi-factor authentication hardening
- `auth0-sdk-migration` — Upgrade to latest SDK versions

## Quick Reference

### Attack Surface by SDK Type

| SDK Type | App-Side Attacks | Tenant-Side Attacks |
|----------|-----------------|-------------------|
| SPA | Token storage (XSS), secret exposure, missing audience | Callbacks, web origins, implicit grant, rotation |
| Regular Web | Secret management, middleware bypass, CSRF | Callbacks, session lifetime, auth method |
| Native | Credential storage, scheme hijacking, deep link interception | Callbacks (custom scheme), app type, rotation |

### Key Validation Commands

```bash
# Full app config
auth0 apps show <CLIENT_ID> --json

# Attack protection (all three)
auth0 api get "attack-protection/brute-force-protection"
auth0 api get "attack-protection/breached-password-detection"
auth0 api get "attack-protection/suspicious-ip-throttling"

# Session settings
auth0 api get "tenants/settings" | jq '{session_lifetime, idle_session_lifetime}'

# Password policy
auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | .options.passwordPolicy'
```

## References

- [Auth0 Security Best Practices](https://auth0.com/docs/secure)
- [Auth0 Attack Protection](https://auth0.com/docs/secure/attack-protection)
- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://datatracker.ietf.org/doc/html/rfc9700)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
