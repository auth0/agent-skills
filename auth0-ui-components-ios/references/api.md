# Auth0 UI Components iOS — API Reference

## Configuration Options

### Auth0.plist Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `Domain` | String | Yes | Your Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `ClientId` | String | Yes | Your Auth0 Native application Client ID |
| `Audience` | String | Recommended | My Account API audience: `https://{domain}/api/v2/` |

### Programmatic Configuration

```swift
Auth0UniversalComponentsSDKInitializer.initialize(
    session: URLSession = .shared,       // URLSession for network requests
    bundle: Bundle = .main,              // Bundle containing Auth0.plist
    domain: String,                      // Auth0 tenant domain
    clientId: String,                    // Native app Client ID
    audience: String,                    // My Account API audience
    tokenProvider: TokenProvider          // Your TokenProvider implementation
)
```

### Auth0.plist Configuration

```swift
// Uses Auth0.plist from the main bundle
Auth0UniversalComponentsSDKInitializer.initialize(
    tokenProvider: TokenProvider          // Your TokenProvider implementation
)
```

## TokenProvider Protocol

```swift
public protocol TokenProvider {
    /// Fetch the current user's credentials (access token, ID token, refresh token)
    func fetchCredentials() async throws -> Credentials

    /// Store updated credentials (e.g., after token refresh)
    func storeCredentials(credentials: Credentials)

    /// Cache API credentials for a specific audience
    func store(apiCredentials: APICredentials, for audience: String)

    /// Fetch API credentials for a specific audience and scope
    func fetchAPICredentials(audience: String, scope: String) async throws -> APICredentials
}
```

### APICredentials

```swift
public struct APICredentials {
    public let accessToken: String
}
```

## UI Components

### MyAccountAuthMethodsView

The main MFA management view. Displays:
- List of enrolled authentication methods
- Option to enroll new methods
- Option to remove existing methods
- Supported methods: TOTP, Push, SMS, Email, Recovery Codes, Passkeys

**Usage:**
```swift
MyAccountAuthMethodsView()
```

**Modifiers:**
```swift
// Wrap in its own NavigationStack (use when not already inside one)
MyAccountAuthMethodsView()
    .embeddedInNavigationStack()
```

### Environment Values

```swift
// Host navigation path — connect to your app's NavigationStack
.environment(\.hostNavigationPath, $router.path)
```

## Supported Platforms

| Platform | Minimum Version | Passkey Support |
|----------|----------------|----------------|
| iOS | 16.0+ | 16.6+ |
| macOS | 14.0+ | 13.5+ |
| visionOS | 1.0+ | 1.0+ |

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Auth0.swift | 2.16.1 (exact) | Core Auth0 SDK — Web Auth, Credentials, token management |

## Claims Reference

The SDK works with standard OIDC claims from the Auth0 ID token:

| Claim | Description |
|-------|-------------|
| `sub` | User ID (Auth0 user identifier) |
| `email` | User email address |
| `name` | User display name |
| `picture` | User profile picture URL |
| `email_verified` | Whether email is verified |

My Account API uses the `openid profile email` scopes plus the Management API v2 audience.

## Testing Checklist

- [ ] SDK initializes without errors (no crash on `Auth0UniversalComponentsSDKInitializer.initialize()`)
- [ ] `Auth0.plist` is included in the app bundle
- [ ] TokenProvider `fetchCredentials()` returns valid credentials
- [ ] TokenProvider `fetchAPICredentials()` returns a valid access token for the My Account API
- [ ] `MyAccountAuthMethodsView` renders and shows enrolled methods
- [ ] TOTP enrollment works (QR code displayed, verification code accepted)
- [ ] Recovery codes are generated and displayed
- [ ] Passkey enrollment works on iOS 16.6+ device
- [ ] Step-up authentication via Universal Login completes successfully
- [ ] Error states are handled gracefully (expired tokens, network errors)

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "My Account APIs not enabled" error | Tenant feature not activated | Enable My Account APIs in Auth0 Dashboard > Settings > Advanced |
| `TokenProvider` methods throw errors | Missing or expired credentials | Ensure user is logged in before showing MFA views; handle token refresh |
| Passkey enrollment fails | iOS version too low | Requires iOS 16.6+, macOS 13.5+, or visionOS 1.0+ |
| Universal Login doesn't redirect back | Missing associated domains | Configure `webcredentials:{domain}` in Xcode Signing & Capabilities |
| "No credentials" error | User not authenticated | Ensure the user completes login before accessing MFA management |
| Build error on import | SPM dependency not resolved | Clean build folder (Cmd+Shift+K) and resolve packages (File > Packages > Resolve) |

## Security Considerations

- **No client secrets**: Native apps use public clients — never embed a Client Secret
- **Keychain storage**: Credentials are stored in the iOS Keychain via the Auth0 Swift SDK's `CredentialsManager`
- **Token refresh**: Use `offline_access` scope to enable refresh tokens for seamless token renewal
- **Associated domains**: Required for Universal Login — validates the app-website association
- **Biometric protection**: The underlying Auth0 Swift SDK supports biometric protection for stored credentials via `CredentialsManager`
- **Step-up authentication**: MFA verification uses Universal Login, ensuring the authentication flow is handled securely by Auth0
