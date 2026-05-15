# Remediation Guide — Auth0 Threat Simulator

## Fix Patterns by Location

Every finding requires a fix on the **app side**, the **tenant side**, or **both**. This guide provides exact fixes for each.

---

## App-Side Fixes

### Fix: Remove Tokens from localStorage (SPA)

**Applies to:** React, Vue, Angular SPAs

**Before (vulnerable):**
```typescript
// WRONG: tokens accessible to any XSS attack
const { getAccessTokenSilently } = useAuth0();
const token = await getAccessTokenSilently();
localStorage.setItem('access_token', token);
```

**After (secure):**
```typescript
// CORRECT: let the SDK manage token storage in memory
const { getAccessTokenSilently } = useAuth0();
// Just call this when you need a token — SDK caches it in memory
const token = await getAccessTokenSilently();
// Use it directly, don't store it
await fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
```

**Auth0Provider config for secure storage:**
```typescript
<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  useRefreshTokens={true}        // Use refresh tokens instead of iframe
  cacheLocation="memory"          // Keep tokens in memory, not localStorage
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: "https://your-api.example.com"
  }}
>
```

---

### Fix: Use SecureCredentialsManager (Android)

**Before (vulnerable):**
```kotlin
// WRONG: tokens in plain SharedPreferences
val prefs = context.getSharedPreferences("auth", Context.MODE_PRIVATE)
prefs.edit().putString("access_token", credentials.accessToken).apply()
```

**After (secure):**
```kotlin
// CORRECT: encrypted storage with optional biometric protection
val auth0 = Auth0(context)
val storage = SecureCredentialsManager(
    context,
    auth0.authentication,
    SharedPreferencesStorage(context)
)

// Store
storage.saveCredentials(credentials)

// Retrieve (auto-refreshes if expired)
storage.getCredentials(object : Callback<Credentials, CredentialsManagerException> {
    override fun onSuccess(result: Credentials) {
        // Use result.accessToken
    }
    override fun onFailure(error: CredentialsManagerException) {
        // Re-authenticate
    }
})
```

---

### Fix: Use CredentialsManager with Biometrics (iOS)

**Before (vulnerable):**
```swift
// WRONG: token in UserDefaults
UserDefaults.standard.set(credentials.accessToken, forKey: "access_token")
```

**After (secure):**
```swift
// CORRECT: Keychain storage with biometric protection
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

// Enable biometric protection
credentialsManager.enableBiometrics(withTitle: "Authenticate to access credentials")

// Store
credentialsManager.store(credentials: credentials)

// Retrieve (auto-refreshes)
credentialsManager.credentials { result in
    switch result {
    case .success(let credentials):
        // Use credentials.accessToken
    case .failure(let error):
        // Re-authenticate
    }
}
```

---

### Fix: Remove Client Secret from SPA/Native Code

**Detection and removal:**
```bash
# Find the offending files
grep -rn "client_secret\|AUTH0_CLIENT_SECRET" . \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.env" --include="*.xml" --include="*.swift" --include="*.kt" \
  --exclude-dir=node_modules --exclude-dir=.git

# Remove any found references
# SPA and Native apps NEVER need a client secret
```

For SPAs and Native apps, ensure the Auth0 app is configured with:
```bash
auth0 apps update <CLIENT_ID> --json '{"token_endpoint_auth_method": "none"}'
```

---

### Fix: Add Audience to SDK Configuration

**Next.js v4 (`lib/auth0.ts`):**
```typescript
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: 'https://your-api.example.com',  // ADD THIS
  },
});
```

**React SPA:**
```typescript
<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: 'https://your-api.example.com',  // ADD THIS
  }}
>
```

**Android:**
```kotlin
WebAuthProvider.login(auth0)
    .withAudience("https://your-api.example.com")  // ADD THIS
    .withScheme(getString(R.string.com_auth0_scheme))
    .start(this, callback)
```

**iOS:**
```swift
Auth0.webAuth()
    .audience("https://your-api.example.com")  // ADD THIS
    .start { result in ... }
```

---

### Fix: Ensure .env Files Are Gitignored

```bash
# Check current gitignore
cat .gitignore | grep -i env

# Add if missing
echo ".env.local" >> .gitignore
echo ".env" >> .gitignore

# If already committed, remove from tracking (without deleting the file)
git rm --cached .env.local 2>/dev/null
git rm --cached .env 2>/dev/null
```

---

### Fix: Implement Complete Logout

**Next.js v4:**
```typescript
// In a server action or API route
import { auth0 } from '@/lib/auth0';

export async function logout() {
  return auth0.handleLogout();
}
```

**React SPA:**
```typescript
const { logout } = useAuth0();

const handleLogout = () => {
  logout({
    logoutParams: {
      returnTo: window.location.origin,
    },
  });
};
```

**Android:**
```kotlin
WebAuthProvider.logout(auth0)
    .withScheme(getString(R.string.com_auth0_scheme))
    .start(this, object : Callback<Void?, AuthenticationException> {
        override fun onSuccess(result: Void?) {
            // Clear local credentials too
            credentialsManager.clearCredentials()
        }
        override fun onFailure(error: AuthenticationException) { }
    })
```

**iOS:**
```swift
Auth0.webAuth()
    .clearSession { result in
        switch result {
        case .success:
            // Also clear stored credentials
            credentialsManager.clear()
        case .failure(let error):
            print("Logout failed: \(error)")
        }
    }
```

---

## Tenant-Side Fixes

### Fix: Enable Refresh Token Rotation

```bash
auth0 apps update <CLIENT_ID> --json '{
  "refresh_token": {
    "rotation_type": "rotating",
    "expiration_type": "expiring",
    "token_lifetime": 2592000,
    "idle_token_lifetime": 1296000,
    "infinite_token_lifetime": false,
    "infinite_idle_token_lifetime": false,
    "reuse_interval": 0
  }
}'
```

---

### Fix: Correct App Type Mismatch

```bash
# Check current type
auth0 apps show <CLIENT_ID> --json | jq '.app_type'

# Fix: change to correct type
# For SPA SDKs:
auth0 apps update <CLIENT_ID> --json '{"app_type": "spa", "token_endpoint_auth_method": "none"}'

# For server-side SDKs (Next.js, Express):
auth0 apps update <CLIENT_ID> --json '{"app_type": "regular_web", "token_endpoint_auth_method": "client_secret_post"}'

# For mobile SDKs:
auth0 apps update <CLIENT_ID> --json '{"app_type": "native", "token_endpoint_auth_method": "none"}'
```

---

### Fix: Set Correct Callback URLs

```bash
# Next.js
auth0 apps update <CLIENT_ID> --json '{
  "callbacks": ["http://localhost:3000/auth/callback", "https://app.example.com/auth/callback"],
  "allowed_logout_urls": ["http://localhost:3000", "https://app.example.com"],
  "web_origins": ["http://localhost:3000", "https://app.example.com"]
}'

# React SPA
auth0 apps update <CLIENT_ID> --json '{
  "callbacks": ["http://localhost:5173", "https://app.example.com"],
  "allowed_logout_urls": ["http://localhost:5173", "https://app.example.com"],
  "web_origins": ["http://localhost:5173", "https://app.example.com"]
}'

# Android
auth0 apps update <CLIENT_ID> --json '{
  "callbacks": ["demo://YOUR_DOMAIN/android/com.example.app/callback"],
  "allowed_logout_urls": ["demo://YOUR_DOMAIN/android/com.example.app/callback"]
}'

# iOS
auth0 apps update <CLIENT_ID> --json '{
  "callbacks": ["com.example.app://YOUR_DOMAIN/ios/com.example.app/callback"],
  "allowed_logout_urls": ["com.example.app://YOUR_DOMAIN/ios/com.example.app/callback"]
}'
```

---

### Fix: Remove Implicit Grant Type

```bash
# Check current grants
auth0 apps show <CLIENT_ID> --json | jq '.grant_types'

# Remove implicit, keep only secure grants
auth0 apps update <CLIENT_ID> --json '{
  "grant_types": ["authorization_code", "refresh_token"]
}'
```

---

### Fix: Enable Attack Protection (All Three)

```bash
# Brute-force protection
auth0 api patch "attack-protection/brute-force-protection" --data '{
  "enabled": true,
  "shields": ["block", "user_notification"],
  "max_attempts": 5,
  "mode": "count_per_identifier_and_ip"
}'

# Breached password detection
auth0 api patch "attack-protection/breached-password-detection" --data '{
  "enabled": true,
  "shields": ["block", "user_notification", "admin_notification"],
  "method": "standard"
}'

# Suspicious IP throttling
auth0 api patch "attack-protection/suspicious-ip-throttling" --data '{
  "enabled": true,
  "shields": ["block", "admin_notification"],
  "allowlist": []
}'
```

---

### Fix: Strengthen Password Policy

```bash
# Get connection ID
auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | .id'

# Update policy
auth0 api patch "connections/<CONNECTION_ID>" --data '{
  "options": {
    "passwordPolicy": "good",
    "password_complexity_options": {
      "min_length": 10
    },
    "password_no_personal_info": {
      "enable": true
    },
    "password_history": {
      "enable": true,
      "size": 5
    }
  }
}'
```

---

### Fix: Set Reasonable Session Lifetimes

```bash
auth0 api patch "tenants/settings" --data '{
  "session_lifetime": 48,
  "idle_session_lifetime": 12
}'
```

Values are in **hours**.

---

### Fix: Reduce API Token Lifetime

```bash
# Get API ID
auth0 apis list --json | jq '.[] | {id, name, token_lifetime}'

# Update to 1 hour max
auth0 apis update <API_ID> --json '{
  "token_lifetime": 3600
}'
```

---

## Verification

After applying fixes, re-run the relevant checks to confirm:

```bash
# Quick verification script
echo "=== App Type ==="
auth0 apps show <CLIENT_ID> --json | jq '{app_type, token_endpoint_auth_method}'

echo "=== Callbacks ==="
auth0 apps show <CLIENT_ID> --json | jq '{callbacks, allowed_logout_urls, web_origins}'

echo "=== Grant Types ==="
auth0 apps show <CLIENT_ID> --json | jq '.grant_types'

echo "=== Refresh Token ==="
auth0 apps show <CLIENT_ID> --json | jq '.refresh_token'

echo "=== Attack Protection ==="
auth0 api get "attack-protection/brute-force-protection" | jq '.enabled'
auth0 api get "attack-protection/breached-password-detection" | jq '.enabled'
auth0 api get "attack-protection/suspicious-ip-throttling" | jq '.enabled'

echo "=== Session ==="
auth0 api get "tenants/settings" | jq '{session_lifetime, idle_session_lifetime}'

echo "=== Password Policy ==="
auth0 api get "connections" | jq '.[] | select(.strategy == "auth0") | .options.passwordPolicy'
```

> **Agent instruction:** After applying any fix, always re-run the specific check that flagged the issue to confirm it now passes. Update the report status from FAIL to PASS with a note about what was changed.
