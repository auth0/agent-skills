# Auth0 UI Components iOS — Integration

## SDK Initialization

### Using Auth0.plist (Recommended)

Initialize the SDK in your app's entry point with a `TokenProvider`:

```swift
import SwiftUI
import Auth0UniversalComponents

@main
struct MyApp: App {
    init() {
        Auth0UniversalComponentsSDKInitializer.initialize(tokenProvider: YourTokenProvider())
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
        }
    }
}
```

### Programmatic Initialization

If you prefer not to use `Auth0.plist`, initialize with explicit parameters:

```swift
import SwiftUI
import Auth0UniversalComponents

@main
struct MyApp: App {
    init() {
        Auth0UniversalComponentsSDKInitializer.initialize(
            session: .shared,
            bundle: .main,
            domain: "your-tenant.auth0.com",
            clientId: "YOUR_CLIENT_ID",
            audience: "https://your-tenant.auth0.com/api/v2/",
            tokenProvider: YourTokenProvider()
        )
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
        }
    }
}
```

## TokenProvider Implementation

You must implement the `TokenProvider` protocol to supply credentials to the SDK. This bridges your app's authentication state with the MFA components.

```swift
import Auth0
import Auth0UniversalComponents

struct YourTokenProvider: TokenProvider {
    private let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

    func fetchCredentials() async throws -> Credentials {
        return try await credentialsManager.credentials()
    }

    func storeCredentials(credentials: Credentials) {
        _ = credentialsManager.store(credentials: credentials)
    }

    func store(apiCredentials: APICredentials, for audience: String) {
        // Store API-specific credentials (e.g., in memory or Keychain)
        // This is called when the SDK obtains tokens for the My Account API
    }

    func fetchAPICredentials(audience: String, scope: String) async throws -> APICredentials {
        // Fetch API credentials for the specified audience
        // Typically involves getting an access token with the required audience/scope
        let credentials = try await credentialsManager.credentials(
            withScope: scope,
            minTTL: 60
        )
        return APICredentials(accessToken: credentials.accessToken)
    }
}
```

## MyAccountAuthMethodsView

The primary UI component. Displays enrolled authenticators and allows users to enroll new MFA methods or remove existing ones.

### Basic Usage

```swift
import SwiftUI
import Auth0UniversalComponents

struct SettingsView: View {
    var body: some View {
        NavigationView {
            List {
                NavigationLink(destination: MyAccountAuthMethodsView()) {
                    Label("Authentication Methods", systemImage: "lock.shield")
                }
            }
            .navigationTitle("Account Settings")
        }
    }
}
```

### With Navigation Router

For apps using a custom navigation router:

```swift
import SwiftUI
import Auth0UniversalComponents

@main
struct MyApp: App {
    @StateObject private var router = Router<AppRoute>()

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $router.path) {
                MyRootView()
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .authMethods:
                            MyAccountAuthMethodsView()
                                .embeddedInNavigationStack()
                        }
                    }
            }
            .environment(\.hostNavigationPath, $router.path)
            .environmentObject(router)
        }
    }
}
```

### Embedded in NavigationStack

If the view is not already inside a `NavigationStack`, use the modifier:

```swift
MyAccountAuthMethodsView()
    .embeddedInNavigationStack()
```

## Supported MFA Methods

### TOTP (Time-Based One-Time Password)

Users can enroll via QR code scanning with an authenticator app (e.g., Google Authenticator, Authy). The component handles:
- QR code generation and display
- Manual secret key entry fallback
- Verification code input

### Push Notifications

Users enroll a device for push-based authentication. When a login challenge occurs, they approve via push notification.

### SMS One-Time Code

Users enroll a phone number and receive SMS verification codes during authentication challenges.

### Email One-Time Code

Users enroll an email address and receive email verification codes during authentication challenges.

### Recovery Codes

Backup codes generated during MFA enrollment. The component handles:
- Displaying recovery codes for the user to save
- Regenerating codes when needed

### Passkeys (FIDO2/WebAuthn)

Available on iOS 16.6+, macOS 13.5+, visionOS 1.0+. Users can register and authenticate with platform authenticators (Face ID, Touch ID) or security keys.

## Universal Login for Step-Up Authentication

The SDK uses Auth0 Universal Login for step-up authentication flows when MFA verification is required. This requires:

1. **Associated domains** configured in Xcode (see [setup.md](setup.md))
2. **Callback URLs** registered in Auth0 Dashboard
3. **Universal Login** enabled on the Auth0 tenant

## Error Handling

```swift
import Auth0UniversalComponents

// The SDK surfaces errors through SwiftUI's standard error handling patterns.
// TokenProvider methods should throw appropriate Auth0 errors:

struct YourTokenProvider: TokenProvider {
    func fetchCredentials() async throws -> Credentials {
        do {
            return try await credentialsManager.credentials()
        } catch {
            // Handle credential expiry, missing refresh token, etc.
            // You may want to redirect the user to login
            throw error
        }
    }

    func fetchAPICredentials(audience: String, scope: String) async throws -> APICredentials {
        do {
            let credentials = try await credentialsManager.credentials(
                withScope: scope,
                minTTL: 60
            )
            return APICredentials(accessToken: credentials.accessToken)
        } catch CredentialsManagerError.noCredentials {
            // No stored credentials — user needs to log in
            throw error
        } catch CredentialsManagerError.failedRefresh {
            // Refresh token expired — user needs to re-authenticate
            throw error
        } catch {
            throw error
        }
    }
}
```

## Testing

- **Simulator**: MFA enrollment and management works on the iOS Simulator for most methods. Passkeys require iOS 16.6+ simulator.
- **Physical device**: Recommended for testing push notifications and passkeys with biometric authentication.
- **My Account APIs**: Ensure the APIs are enabled on your Auth0 tenant before testing.
- **Test accounts**: Create test users in your Auth0 Dashboard to verify MFA enrollment flows.
