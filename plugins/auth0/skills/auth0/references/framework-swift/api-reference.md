# API Reference & Testing — Auth0 Swift

> `verified against Auth0.swift@3.x`. This file keeps only the must-know symbols
> the common path uses plus the testing/triage tables. The exhaustive option set,
> biometric policies, and every claim are delegated to the package docs — see the
> pointer at the end.

## Must-know symbols (common path)

- **`Auth0.plist`** needs two String keys: `ClientId` and `Domain`. No client
  secret — native apps use PKCE.
- **WebAuth builder:** `.useHTTPS()` (Universal Links callback, recommended),
  `.scope("openid profile email offline_access")` (add `offline_access` for
  refresh tokens), `.audience("<api-identifier>")` (required for API access
  tokens), `.parameters(["screen_hint": "signup"])`, `.organization(_)`,
  `.ephemeralSession()` (no persisted SSO cookie).
- **CredentialsManager:** `store(credentials:)` → `Bool`, `credentials()` async
  (auto-renews if expired), `canRenew()`, `hasValid(minTTL:)`, `clear()` → `Bool`,
  `revoke(headers:)` async, `enableBiometrics(withTitle:policy:)`. The `user`
  property returns a `UserInfo?` decoded from the stored ID token.
- **`Credentials`** exposes `accessToken`, `idToken`, `refreshToken` (nil without
  `offline_access`), `expiresIn: Date`, `tokenType`, `scope`.

```swift
import Auth0

// Read the profile from stored credentials (reuse the existing manager)
if let user = credentialsManager.user {
    print("User ID: \(user.sub), Email: \(user.email ?? "none")")
}
```

> **Full reference:** the complete `Auth0.plist` keys, every WebAuth/
> CredentialsManager option, biometric reuse policies (`.default`, `.always`,
> `.session`, `.appLifecycle`), the full `Credentials` shape, and the standard
> OIDC + Auth0-specific claim set live in the installed package's docs (`README` /
> `EXAMPLES.md` / DocC). Source of truth if not installed:
> github.com/auth0/Auth0.swift (EXAMPLES.md, DocC at auth0.github.io/Auth0.swift).
> Auth0 concepts: https://auth0.com/docs/libraries/auth0-swift

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

