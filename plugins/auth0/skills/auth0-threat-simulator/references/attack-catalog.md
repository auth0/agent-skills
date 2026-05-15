# Attack Catalog — Auth0 Threat Simulator

## Attacks by SDK Type

This catalog maps each attack to where it manifests (app-side, tenant-side, or both) for every supported SDK.

---

## Token Security Attacks

### T1: Token Replay Attack

**Description:** Stolen access token replayed from a different client or origin to access protected APIs.

| SDK | App-Side Check | Tenant-Side Check |
|-----|---------------|-------------------|
| Next.js | `audience` set in `auth0.ts` config | API token_lifetime ≤ 3600s |
| React SPA | `audience` prop on Auth0Provider | API token_lifetime ≤ 3600s |
| Android | `.withAudience()` in WebAuthProvider | API token_lifetime ≤ 3600s |
| iOS | `audience` parameter in `.webAuth()` | API token_lifetime ≤ 3600s |
| Express | `authorizationParams.audience` in config | API token_lifetime ≤ 3600s |

**Severity:** HIGH if no audience configured; MEDIUM if lifetime > 3600s

---

### T2: Refresh Token Theft & Replay

**Description:** Refresh token stolen via XSS (SPA), device theft (mobile), or log exposure (server) used to mint new access tokens indefinitely.

| SDK | App-Side Check | Tenant-Side Check |
|-----|---------------|-------------------|
| Next.js | Tokens in HTTP-only cookies (default ✓) | `rotation_type: rotating`, `reuse_interval: 0` |
| React SPA | NOT in localStorage (use `useRefreshTokens` + `cacheLocation: memory`) | `rotation_type: rotating`, `reuse_interval: 0` |
| Android | `SecureCredentialsManager` (not SharedPreferences) | `rotation_type: rotating` |
| iOS | `CredentialsManager` with biometrics | `rotation_type: rotating` |
| Express | Tokens in encrypted session (default ✓) | `rotation_type: rotating` |

**App-side detection:**
```bash
# SPA: Check for unsafe storage
grep -rn "localStorage\|sessionStorage" src/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -i "token"

# Android: Check credential storage
grep -rn "SharedPreferences" app/src/ --include="*.kt" --include="*.java" | grep -i "token\|credential"

# iOS: Check for UserDefaults token storage
grep -rn "UserDefaults" . --include="*.swift" | grep -i "token\|credential"
```

**Tenant-side detection:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '.refresh_token'
```

**Severity:** CRITICAL if rotation disabled + tokens in localStorage; HIGH if either one alone

---

### T3: Client Secret Exposure

**Description:** Client secret leaked in frontend code, version control, or build artifacts.

| SDK | Expected | VULNERABLE if |
|-----|----------|--------------|
| Next.js | Secret in `.env.local`, file in `.gitignore` | Secret in committed files or source code |
| React SPA | NO secret anywhere | Any `client_secret` reference in codebase |
| Android | NO secret anywhere | Any secret in strings.xml or source |
| iOS | NO secret anywhere | Any secret in plist or source |
| Express | Secret in `.env`, file in `.gitignore` | Secret in committed files |

**Detection:**
```bash
# Search for exposed secrets
grep -rn "client_secret\|AUTH0_CLIENT_SECRET\|AUTH0_SECRET" . \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.html" --include="*.xml" --include="*.swift" --include="*.kt" \
  --exclude-dir=node_modules --exclude-dir=.git

# Check gitignore coverage
grep -l "AUTH0_SECRET\|AUTH0_CLIENT_SECRET\|client_secret" .env .env.local 2>/dev/null
git check-ignore .env .env.local 2>/dev/null
```

**Tenant-side check:**
```bash
# SPA and Native apps should have token_endpoint_auth_method = none
auth0 apps show <CLIENT_ID> --json | jq '{app_type, token_endpoint_auth_method}'
```

**Severity:** CRITICAL if secret in public code; HIGH if .env not gitignored

---

### T4: JWT Algorithm Confusion

**Description:** API accepts weaker signing algorithm than intended, allowing token forgery.

**Tenant-side:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '.jwt_configuration.alg'
auth0 apis list --json | jq '.[] | {name, signing_alg}'
```

**VULNERABLE if:**
- `alg` is `HS256` for multi-party scenarios
- API doesn't pin algorithm during validation

**Severity:** HIGH if HS256 used with SPA (shared secret risks)

---

## Authentication Flow Attacks

### A1: PKCE Downgrade

**Description:** Public client without PKCE enforcement allows authorization code interception.

| SDK | Minimum Version for PKCE | How to Check |
|-----|--------------------------|--------------|
| `@auth0/auth0-spa-js` | 2.0+ (always PKCE) | `jq '.dependencies["@auth0/auth0-spa-js"]' package.json` |
| `@auth0/auth0-react` | 2.0+ (via spa-js) | `jq '.dependencies["@auth0/auth0-react"]' package.json` |
| `nextjs-auth0` | 4.0+ (PKCE for web) | `jq '.dependencies["nextjs-auth0"]' package.json` |
| `react-native-auth0` | 3.0+ (default PKCE) | `jq '.dependencies["react-native-auth0"]' package.json` |
| `com.auth0.android:auth0` | 2.0+ (default PKCE) | `grep "auth0" build.gradle` |
| `Auth0.swift` | 2.0+ (default PKCE) | Check Package.swift version |

**Tenant-side:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '.grant_types'
```

**VULNERABLE if:**
- `grant_types` includes `implicit` (tokens in URL fragment)
- SDK version below PKCE minimum
- Custom auth code that bypasses SDK's PKCE

**Severity:** CRITICAL if implicit flow on SPA; HIGH if old SDK without PKCE

---

### A2: Redirect URI Manipulation

**Description:** Attacker redirects authorization code or tokens to a controlled server via permissive callback URLs.

**Cross-reference check:**

| SDK | App Expects | Auth0 Must Have |
|-----|------------|-----------------|
| Next.js v4 | `{APP_BASE_URL}/auth/callback` | Exact URL in `callbacks` |
| React SPA | `redirect_uri` or `window.location.origin` | URL in `callbacks` + origin in `web_origins` |
| Android | `{scheme}://{domain}/android/{pkg}/callback` | Exact URL in `callbacks` |
| iOS | `{bundleId}://{domain}/ios/{bundleId}/callback` | Exact URL in `callbacks` |
| Express | `{AUTH0_BASE_URL}/callback` | Exact URL in `callbacks` |

**Tenant-side:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '{callbacks, allowed_logout_urls, web_origins}'
```

**VULNERABLE if:**
- Wildcards in callbacks (`https://*.example.com`)
- HTTP callbacks for non-localhost
- Localhost in production tenant
- App's expected callback NOT registered (integration broken)
- Excessive unused callbacks (unnecessary attack surface)

**Severity:** HIGH if wildcards; CRITICAL if HTTP on production

---

### A3: App Type Mismatch

**Description:** SDK type doesn't match Auth0 application type, causing security model violations.

| SDK Used | Required App Type | Required `token_endpoint_auth_method` |
|----------|------------------|--------------------------------------|
| `@auth0/auth0-react` | `spa` | `none` |
| `@auth0/auth0-vue` | `spa` | `none` |
| `@auth0/auth0-angular` | `spa` | `none` |
| `nextjs-auth0` | `regular_web` | `client_secret_post` or `client_secret_basic` |
| `express-openid-connect` | `regular_web` | `client_secret_post` or `client_secret_basic` |
| `react-native-auth0` | `native` | `none` |
| `com.auth0.android:auth0` | `native` | `none` |
| `Auth0.swift` | `native` | `none` |

**Detection:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '{app_type, token_endpoint_auth_method}'
```

**VULNERABLE if:**
- Mismatch between SDK type and app type
- SPA/Native with `client_secret_post` (secret would be exposed)
- Regular Web App with `none` (no client authentication = anyone can exchange codes)

**Severity:** CRITICAL — app type mismatch is a fundamental security model violation

---

### A4: Missing Web Origins (SPA Only)

**Description:** SPA without correct `web_origins` cannot perform silent authentication and may fail with CORS errors, pushing developers to insecure workarounds.

**Detection:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '.web_origins'
```

**VULNERABLE if:**
- `web_origins` is empty for SPA app type
- App's origin not in the list

**Severity:** MEDIUM (functionality issue that can lead to insecure workarounds)

---

## Credential Attacks

### C1: Credential Stuffing (No Rate Limiting)

**Detection:**
```bash
auth0 api get "attack-protection/brute-force-protection" | jq '{enabled, max_attempts, mode}'
auth0 api get "attack-protection/suspicious-ip-throttling" | jq '{enabled}'
auth0 api get "attack-protection/breached-password-detection" | jq '{enabled, shields}'
```

**VULNERABLE if:**
- Any of the three protections disabled
- Brute-force max_attempts > 10
- Breached password detection doesn't include `block` in shields

**Severity:** HIGH on production; WARN on development

---

### C2: Weak Password Policy

**Detection:**
```bash
auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | {name, options: {passwordPolicy: .options.passwordPolicy, min_length: .options.password_complexity_options.min_length}}'
```

**VULNERABLE if:**
- `passwordPolicy` is `none` or `low`
- Min length < 8

**Severity:** HIGH on production

---

## Session Attacks

### S1: Session Hijacking via Long Lifetime

**Detection:**
```bash
auth0 api get "tenants/settings" | jq '{session_lifetime, idle_session_lifetime}'
```

**VULNERABLE if:**
- `session_lifetime` > 72 (hours)
- `idle_session_lifetime` > 24 (hours)

**Severity:** MEDIUM

---

### S2: Incomplete Logout

**App-side check by SDK:**

| SDK | Complete Logout Requires |
|-----|-------------------------|
| Next.js v4 | Using SDK's redirect to `/auth/logout` |
| React SPA | Calling `logout()` from `useAuth0()` |
| Android | `WebAuthProvider.logout()` with scheme |
| iOS | `Auth0.webAuth().clearSession()` |
| Express | Using `res.oidc.logout()` |

**App-side detection:**
```bash
# Check logout implementation exists
grep -rn "logout" src/ app/ pages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v "node_modules\|test\|spec"
```

**Tenant-side:**
```bash
auth0 apps show <CLIENT_ID> --json | jq '.allowed_logout_urls'
```

**VULNERABLE if:**
- No logout implementation in app code
- Custom logout that doesn't use SDK's method (skips Auth0 session clear)
- `allowed_logout_urls` is empty
- Refresh tokens not revoked on logout

**Severity:** MEDIUM (session persists after user thinks they logged out)

---

## Full Test Matrix

| # | Attack | SPA | Web App | Native | Check |
|---|--------|-----|---------|--------|-------|
| T1 | Token Replay | ✓ | ✓ | ✓ | Both |
| T2 | Refresh Token Theft | ✓ | ✓ | ✓ | Both |
| T3 | Secret Exposure | ✓ | ✓ | ✓ | App |
| T4 | Algorithm Confusion | ✓ | ✓ | — | Tenant |
| A1 | PKCE Downgrade | ✓ | — | ✓ | Both |
| A2 | Redirect URI | ✓ | ✓ | ✓ | Both |
| A3 | App Type Mismatch | ✓ | ✓ | ✓ | Both |
| A4 | Missing Web Origins | ✓ | — | — | Tenant |
| C1 | Credential Stuffing | ✓ | ✓ | ✓ | Tenant |
| C2 | Weak Passwords | ✓ | ✓ | ✓ | Tenant |
| S1 | Long Sessions | ✓ | ✓ | ✓ | Tenant |
| S2 | Incomplete Logout | ✓ | ✓ | ✓ | Both |
