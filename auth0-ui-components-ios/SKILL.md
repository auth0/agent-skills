---
name: auth0-ui-components-ios
description: Use when adding MFA enrollment and verification UI to an iOS, macOS, or visionOS SwiftUI application - integrates Auth0UniversalComponents SDK for native Apple platform MFA management with TOTP, push, SMS, email, recovery codes, and passkeys
---

# Auth0 UI Components for iOS Integration

Composable SwiftUI building blocks for multi-factor authentication (MFA) enrollment and verification on iOS, macOS, and visionOS. Integrates with the Auth0 Swift SDK and Auth0 My Account APIs to provide ready-to-use MFA management UI components.

> **Agent instruction — version fetch:**
> Before starting, fetch the latest version:
> ```bash
> gh api repos/auth0/ui-components-ios/releases/latest --jq '.tag_name'
> ```
> If no release is found, the SDK is pre-release. Use SPM with `from: "1.0.0"` as documented in the README.

## Prerequisites

- iOS 16.0+ / macOS 14.0+ / visionOS 1.0+
- Swift 6.0+
- Xcode 26.0+
- Auth0 tenant with **My Account APIs enabled** (currently in early access)
- Auth0 Swift SDK (automatically included as a dependency)

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Adding basic login/logout to iOS/macOS | [auth0-swift](/auth0-swift) — Web Auth login, credential storage, biometric protection |
| Adding Auth0 to Android apps | [auth0-android](/auth0-android) — Native Android authentication |
| Adding Auth0 to React Native apps | [auth0-react-native](/auth0-react-native) — Cross-platform mobile auth |
| Adding Auth0 to Flutter apps | [auth0-flutter](/auth0-flutter) — Cross-platform mobile auth |
| Building a web SPA with Auth0 | [auth0-react](/auth0-react), [auth0-angular](/auth0-angular), [auth0-vue](/auth0-vue) |
| Building a backend API with Auth0 | [auth0-aspnetcore-api](/auth0-aspnetcore-api) |

## Quick Start Workflow

> **Agent instruction — CLI automation:**
> Use the Auth0 CLI to create and configure the application:
> ```bash
> auth0 apps create --name "MyApp-ios" --type native --auth-method none --callbacks "{bundleId}://{domain}/ios/{bundleId}/callback" --logout-urls "{bundleId}://{domain}/ios/{bundleId}/callback" --json --no-input
> ```
> If the CLI is not installed or fails, fall back to manual setup via the Auth0 Dashboard.

> **Agent instruction — quick start:**
> Follow these steps in order. At each step, read the referenced file for detailed instructions.
>
> 1. **Check for existing Auth0 setup**: Search the project for `import Auth0` or `Auth0.plist`. If found, the base Auth0 SDK is already configured — skip to step 4.
> 2. **Set up Auth0 credentials**: Follow [references/setup.md](references/setup.md) — either run the bootstrap script or configure manually.
> 3. **Install Auth0UniversalComponents**: Add the SPM dependency or CocoaPods pod per [references/setup.md](references/setup.md).
> 4. **Initialize the SDK**: Add `Auth0UniversalComponentsSDKInitializer.initialize(tokenProvider:)` in the app's `init()`.
> 5. **Implement TokenProvider**: Create a struct conforming to `TokenProvider` with credential fetch/store methods per [references/integration.md](references/integration.md).
> 6. **Add MFA UI**: Embed `MyAccountAuthMethodsView()` in a `NavigationStack` per [references/integration.md](references/integration.md).
> 7. **Configure Universal Login**: Set up associated domains and callback URLs for step-up authentication per [references/setup.md](references/setup.md).
> 8. **Build and verify**: Build the project and verify MFA enrollment/verification works.
>
> **Agent instruction — build verify:**
> ```bash
> xcodebuild -scheme <SCHEME> -destination 'platform=iOS Simulator,name=iPhone 16' build
> ```
>
> **Agent instruction — failcheck:**
> If the Auth0 CLI automation fails after 3 attempts, fall back to manual setup. Ask the user for their Auth0 Domain and Client ID, then write `Auth0.plist` directly.

## Detailed Documentation

| Document | Contents |
|----------|----------|
| [references/setup.md](references/setup.md) | Auth0 configuration, SPM/CocoaPods installation, Auth0.plist setup, callback URLs, associated domains |
| [references/integration.md](references/integration.md) | TokenProvider implementation, MyAccountAuthMethodsView usage, MFA methods (TOTP, push, SMS, email, recovery, passkeys), programmatic init, navigation patterns |
| [references/api.md](references/api.md) | Full API reference, configuration options, supported MFA methods, claims reference, testing checklist |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Creating a "Single Page Application" in Auth0 Dashboard | Create a **Native** application — this is a native iOS SDK |
| Missing My Account APIs | Enable My Account APIs on your Auth0 tenant (early access feature) — the SDK will not work without this |
| Not implementing `TokenProvider` | You must provide a custom `TokenProvider` implementation that handles credential fetching and storage |
| Embedding `MyAccountAuthMethodsView` without `NavigationStack` | The view requires a `NavigationStack` ancestor — either wrap it or use `.embeddedInNavigationStack()` |
| Using `http://localhost` callback URLs | Native apps use `https://{domain}/ios/{bundleId}/callback` and `{bundleId}://{domain}/ios/{bundleId}/callback` |
| Forgetting to call `Auth0UniversalComponentsSDKInitializer.initialize()` | Must be called in your App's `init()` before any component is rendered |
| Not setting up associated domains | Universal Login for step-up auth requires associated domains configured in your Xcode project and Auth0 Dashboard |
| Using wrong audience for My Account APIs | The audience must be `https://{domain}/api/v2/` for My Account API access |

## Related Skills

- [auth0-swift](/auth0-swift) — Base Auth0 Swift SDK for login/logout, credential management, biometrics
- [auth0-android](/auth0-android) — Native Android authentication
- [auth0-react-native](/auth0-react-native) — React Native cross-platform authentication

## Quick Reference

### Core Components

| Component / API | Purpose |
|----------------|---------|
| `Auth0UniversalComponentsSDKInitializer.initialize(tokenProvider:)` | Initialize SDK with Auth0.plist config |
| `Auth0UniversalComponentsSDKInitializer.initialize(domain:clientId:audience:tokenProvider:)` | Initialize SDK programmatically |
| `MyAccountAuthMethodsView()` | Main MFA management view — shows enrolled authenticators, enroll new, remove existing |
| `.embeddedInNavigationStack()` | Modifier to wrap view in its own NavigationStack |
| `TokenProvider` protocol | Protocol for credential fetching, storing, and API credential management |

### Supported MFA Methods

| Method | Minimum OS |
|--------|-----------|
| TOTP (authenticator app + QR code) | iOS 16.0+ |
| Push notifications | iOS 16.0+ |
| SMS one-time code | iOS 16.0+ |
| Email one-time code | iOS 16.0+ |
| Recovery codes | iOS 16.0+ |
| Passkeys (FIDO2/WebAuthn) | iOS 16.6+ / macOS 13.5+ / visionOS 1.0+ |

### TokenProvider Protocol

```swift
protocol TokenProvider {
    func fetchCredentials() async throws -> Credentials
    func storeCredentials(credentials: Credentials)
    func store(apiCredentials: APICredentials, for audience: String)
    func fetchAPICredentials(audience: String, scope: String) async throws -> APICredentials
}
```

## URL Scheme Registration

For Universal Login step-up authentication, register the URL scheme in your Xcode project:

### Info.plist URL Scheme

Add to your app's `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
        </array>
        <key>CFBundleURLName</key>
        <string>auth0</string>
    </dict>
</array>
```

### Associated Domains

In your Xcode project's Signing & Capabilities, add Associated Domains:

```text
webcredentials:your-tenant.auth0.com
```

This enables Universal Login to redirect back to your app after step-up authentication for MFA verification.

### Callback URL Format

| Platform | Callback URL |
|----------|-------------|
| iOS | `https://{domain}/ios/{bundleId}/callback` and `{bundleId}://{domain}/ios/{bundleId}/callback` |
| macOS | `https://{domain}/macos/{bundleId}/callback` and `{bundleId}://{domain}/macos/{bundleId}/callback` |

## Platform Support Notes

### iOS

- Minimum iOS 16.0 for core MFA methods
- iOS 16.6+ required for passkey (FIDO2/WebAuthn) support
- Test on physical device for push notifications and biometric passkeys

### macOS

- Minimum macOS 14.0
- macOS 13.5+ for passkey support
- Associated domains configuration required for Universal Login

### visionOS

- Minimum visionOS 1.0
- Full passkey support from visionOS 1.0

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Build fails on `import Auth0UniversalComponents` | SPM dependency not resolved | File > Packages > Resolve Package Versions, then clean build |
| "My Account APIs not enabled" | Tenant feature not activated | Auth0 Dashboard > Settings > Advanced > Enable My Account APIs |
| MFA view shows empty list | No MFA methods enrolled | Enroll at least one method; verify TokenProvider returns valid credentials |
| Universal Login doesn't redirect back | Missing associated domains | Add `webcredentials:{domain}` in Signing & Capabilities |
| Passkey enrollment fails | iOS version < 16.6 | Update to iOS 16.6+ or macOS 13.5+ |
| TokenProvider throws "no credentials" | User not authenticated | Complete login via Auth0.swift before showing MFA management |
| Auth0.plist not found at runtime | Not added to target | Check Build Phases > Copy Bundle Resources includes Auth0.plist |

## References

- [Auth0 UI Components iOS — GitHub](https://github.com/auth0/ui-components-ios)
- [Auth0 Swift SDK — GitHub](https://github.com/auth0/Auth0.swift)
- [Auth0 iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [Auth0 My Account APIs](https://auth0.com/docs/api/my-account)
- [Auth0 MFA Documentation](https://auth0.com/docs/secure/multi-factor-authentication)
