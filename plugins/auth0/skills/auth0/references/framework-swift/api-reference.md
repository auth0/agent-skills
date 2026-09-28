# API Reference & Testing — Auth0 Swift

> `verified against Auth0.swift@3.x`. The tables below cover the symbols the
> common integration path uses. For the exhaustive option set and every claim,
> see the pointer at the end of this file.

## Configuration Reference

### Auth0.plist Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ClientId` | String | Yes | Your Auth0 application Client ID |
| `Domain` | String | Yes | Your Auth0 tenant domain (e.g., `tenant.auth0.com`) |

### WebAuth Builder Options

| Method | Type | Description |
|--------|------|-------------|
| `.useHTTPS()` | — | Use Universal Links (HTTPS) for callback — recommended |
| `.scope(_ scope: String)` | `String` | Space-separated OAuth scopes. Default: `"openid profile email"`. Add `"offline_access"` for refresh tokens |
| `.audience(_ audience: String)` | `String` | API audience (resource identifier). Required for API access tokens |
| `.parameters(_ params: [String: String])` | `[String: String]` | Additional authorize parameters (e.g., `["screen_hint": "signup"]`) |
| `.organization(_ organization: String)` | `String` | Auth0 Organization ID or name |
| `.redirectURL(_ url: URL)` | `URL` | Override the callback URL |
| `.ephemeralSession()` | — | Do not persist session cookies (no SSO) |

Less-common builders (`.invitationURL`, `.provider`, `.nonce`, `.maxAge`,
`.leeway`) and their full signatures are in the package docs — see the pointer at
the end of this file.

### CredentialsManager Options

| Method | Type | Description |
|--------|------|-------------|
| `CredentialsManager(authentication:)` | — | Standard initialization |
| `CredentialsManager(authentication:maxRetries:)` | `Int` | Set retry attempts on transient errors |
| `CredentialsManager(authentication:storeKey:)` | `String` | Custom Keychain key for multi-account support |
| `.store(credentials:)` | `Bool` | Store credentials; returns `false` if Keychain write fails |
| `.credentials()` | `Credentials` (async) | Retrieve valid credentials; auto-renews if expired |
| `.credentials(minTTL:)` | `Credentials` (async) | Retrieve with minimum remaining TTL |
| `.canRenew()` | `Bool` | Returns `true` if a refresh token is available |
| `.hasValid(minTTL:)` | `Bool` | Returns `true` if access token is valid for at least `minTTL` seconds |
| `.clear()` | `Bool` | Remove credentials from Keychain |
| `.revoke(headers:)` | `Void` (async) | Revoke refresh token and clear credentials |
| `.enableBiometrics(withTitle:)` | — | Prompt biometric authentication when retrieving credentials |
| `.enableBiometrics(withTitle:policy:)` | — | Biometrics with custom `LAPolicy` |
| `.clearBiometricSession()` | — | Clear cached biometric session |
| `.isBiometricSessionValid()` | `Bool` | Check if biometric session is still valid |

### Biometric Policy Options

`enableBiometrics(withTitle:policy:)` accepts a reuse policy (`.default`,
`.always`, `.session(timeoutInSeconds:)`, `.appLifecycle(timeoutInSeconds:)`).
Full defaults and semantics are in the package docs — see the pointer at the end
of this file.

### Credentials Object

| Property | Type | Description |
|----------|------|-------------|
| `accessToken` | `String` | JWT access token for API calls |
| `tokenType` | `String` | Token type, usually `"Bearer"` |
| `idToken` | `String` | JWT ID token with user identity claims |
| `refreshToken` | `String?` | Refresh token (requires `offline_access` scope) |
| `expiresIn` | `Date` | Access token expiration date |
| `scope` | `String?` | Granted scopes |

---

## Claims Reference

### Standard OIDC Claims (from ID Token)

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | String | User ID (e.g., `"auth0|64abc123"`) |
| `name` | String | Full display name |
| `given_name` | String | First name |
| `family_name` | String | Last name |
| `email` | String | Email address |
| `email_verified` | Bool | Whether email is verified |
| `picture` | String | Profile picture URL |
| `updated_at` | Date | Last profile update timestamp |
| `iss` | String | Issuer — your Auth0 domain |
| `aud` | String | Audience — your Client ID |
| `exp` | Date | Expiration time |
| `iat` | Date | Issued at time |

### Auth0-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `https://example.com/permissions` | `[String]` | User permissions (added via Auth0 Actions) |
| `https://example.com/roles` | `[String]` | User roles (added via Auth0 Actions) |
| `org_id` | String | Organization ID |
| `org_name` | String | Organization name |

### Reading User Profile Claims

Read the user's profile from stored credentials with the `CredentialsManager`
`user` property. It decodes the ID token and returns a `UserInfo?` whose
properties expose the standard OIDC claims (`sub`, `name`, `email`, `picture`, …):

```swift
import Auth0

// Reuse the existing credentialsManager instance
if let user = credentialsManager.user {
    print("User ID: \(user.sub)")
    print("Name: \(user.name ?? "none")")
    print("Email: \(user.email ?? "none")")
}
```

To decode the ID token manually, use JWTDecode (bundled with Auth0.swift):

```swift
import JWTDecode

if let jwt = try? decode(jwt: credentials.idToken) {
    let email = jwt.claim(name: "email").string
    let name = jwt.claim(name: "name").string
    print("Email: \(email ?? "none"), Name: \(name ?? "none")")
}
```

---

## Testing Checklist

> **Physical device note:** Web Auth (ASWebAuthenticationSession) works in the iOS Simulator, but biometric authentication (Face ID / Touch ID) requires a real device. Test biometric flows on a physical device before shipping. Simulator has limitations for camera-based Face ID and some Keychain access control scenarios.

- [ ] `Auth0.plist` is present in the Xcode project and added to the app target
- [ ] Both `https://` Universal Link and `{bundle}://` custom scheme URLs are in Auth0 Dashboard Callback URLs
- [ ] App builds without errors: `xcodebuild build -scheme SCHEME -destination "platform=iOS Simulator,name=iPhone 16"`
- [ ] Login opens system browser (ASWebAuthenticationSession) and redirects back to app
- [ ] `credentialsManager.store(credentials:)` returns `true` after login
- [ ] `credentialsManager.canRenew()` returns `true` after storing credentials with `offline_access`
- [ ] `credentialsManager.credentials()` returns valid access token without re-login (token auto-refresh)
- [ ] Logout clears session cookie (subsequent login shows login prompt, not silent SSO)
- [ ] `credentialsManager.clear()` returns `true` after logout
- [ ] Error cases are handled: `userCancelled`, `noCredentialsAvailable`, `failedToRenewCredentials`
- [ ] Biometric prompt appears (if enabled) before credentials are returned
- [ ] App state persists across launches (credentials survive app restart)

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Auth0.plist not found` | File not added to target | Right-click `Auth0.plist` → Add Files → check app target |
| `No such module 'Auth0'` | Package not installed or wrong target | Verify SPM package in Xcode → Package Dependencies; re-resolve |
| `Redirect to app fails` | Callback URL mismatch | Ensure URL in Auth0 Dashboard matches bundle ID exactly |
| `Cannot open URL` (iOS) | Missing URL scheme | Add `$(PRODUCT_BUNDLE_IDENTIFIER)` to URL Schemes in Info tab |
| Login shows blank screen | Universal Links not configured | Use `.useHTTPS()` only if Universal Links are configured, else omit it |
| Token not renewable | Missing `offline_access` scope | Add `"offline_access"` to `.scope()` call |
| `biometricsFailed` error | No biometric enrolled or cancelled | Fall back to re-login |
| `cannotAccessKeychainItem` | Keychain entitlements missing | Verify app has Keychain Sharing capability or correct entitlements |
| Crash on macOS | Missing network entitlement | Add "Outgoing Connections (Client)" capability in Signing & Capabilities |
| Build fails on Swift 6 | Concurrency issues | Ensure callbacks are dispatched on `@MainActor` for UI updates |

---

## Security Considerations

- **No client secret**: Native apps use PKCE — no client secret is required or used. Do not add one to `Auth0.plist`.
- **Keychain storage**: Always use `CredentialsManager` for token storage. Never use `UserDefaults` or plain files.
- **Universal Links vs custom scheme**: Universal Links (`https://`) are recommended for production; custom schemes (`{bundle}://`) are acceptable but less secure.

Broader hardening (refresh token rotation, biometric access-control flags,
certificate pinning, App Transport Security, scope minimization) is Auth0 platform
guidance, not SDK-specific: https://auth0.com/docs/secure and
https://auth0.com/docs/libraries/auth0-swift.

---

## Related Capabilities

- Auth0 authentication for Android/Kotlin apps — the Auth0 integration workflow for Android
- Cross-platform iOS + Android authentication with Flutter — the Auth0 integration workflow for Flutter
- Cross-platform iOS + Android authentication with React Native — the Auth0 integration workflow for React Native
- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication — ask for MFA (feature:mfa)

---

> **Full reference:** the complete WebAuth/CredentialsManager option set, biometric
> policies, and every claim live in the installed package's docs (`README` /
> `EXAMPLES.md` / DocC). Source of truth if not installed:
> github.com/auth0/Auth0.swift (EXAMPLES.md, and the DocC site at
> auth0.github.io/Auth0.swift). Auth0 concepts: https://auth0.com/docs/libraries/auth0-swift

---

