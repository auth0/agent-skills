# Auth0 UI Components iOS — Setup

## Auth0 Configuration

> **Agent instruction — credential check:**
> If the user's prompt already provides Auth0 credentials (domain, client ID), use them directly — skip the bootstrap script and do NOT call `AskUserQuestion` to re-confirm. Write the `Auth0.plist` file and proceed with integration.

> **Agent instruction — setup choice:**
> If credentials are NOT in the prompt, ask the user:
> "Would you like to set up Auth0 automatically (requires Auth0 CLI) or manually (you'll provide credentials)?"

### Option A: Automatic Setup (Bootstrap Script)

The bootstrap script handles all Auth0 configuration automatically:

1. Pre-flight checks: Verify Node.js 20+, Auth0 CLI installed, active tenant
2. Run bootstrap:
   ```bash
   cd scripts && npm install && node bootstrap.mjs <project-path>
   ```
3. The script handles: project validation, app creation, database connection setup, Auth0.plist writing, and prints a summary

### Option B: Manual Setup

> **Agent instruction — manual setup:**
> Ask the user for their Auth0 Domain and Client ID via `AskUserQuestion`.

1. Ask the user for:
   - **Auth0 Domain** (e.g., `your-tenant.auth0.com`)
   - **Client ID** (from a Native application in the Auth0 Dashboard)

2. Create `Auth0.plist` in the project root (add to Xcode target):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Domain</key>
    <string>YOUR_AUTH0_DOMAIN</string>
    <key>ClientId</key>
    <string>YOUR_AUTH0_CLIENT_ID</string>
</dict>
</plist>
```

For My Account API access, also include the Audience:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Domain</key>
    <string>YOUR_AUTH0_DOMAIN</string>
    <key>ClientId</key>
    <string>YOUR_AUTH0_CLIENT_ID</string>
    <key>Audience</key>
    <string>https://YOUR_AUTH0_DOMAIN/api/v2/</string>
</dict>
</plist>
```

### Post-Setup Steps

1. **Enable My Account APIs** on your Auth0 tenant (Settings > Advanced > My Account APIs). This is currently an early access feature.
2. **Configure callback URLs** in the Auth0 Dashboard under your application settings:
   - Allowed Callback URLs: `https://{domain}/ios/{bundleId}/callback, {bundleId}://{domain}/ios/{bundleId}/callback`
   - Allowed Logout URLs: `https://{domain}/ios/{bundleId}/callback, {bundleId}://{domain}/ios/{bundleId}/callback`
3. **Set up Associated Domains** in Xcode:
   - Go to your target's Signing & Capabilities
   - Add Associated Domains capability
   - Add `webcredentials:{domain}` (e.g., `webcredentials:your-tenant.auth0.com`)
4. **Verify `Auth0.plist`** is added to the app target membership in Xcode

For **macOS**, replace `/ios/` with `/macos/` in the callback and logout URLs.

## Installation

### Swift Package Manager (Recommended)

In Xcode:
1. Go to File > Add Package Dependencies
2. Enter: `https://github.com/auth0/ui-components-ios.git`
3. Set version rule: Up to Next Major from `1.0.0`
4. Add `Auth0UniversalComponents` to your target

Or add to `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/auth0/ui-components-ios.git", from: "1.0.0")
]
```

And add the target dependency:

```swift
.target(
    name: "YourApp",
    dependencies: [
        .product(name: "Auth0UniversalComponents", package: "ui-components-ios")
    ]
)
```

### CocoaPods

Add to your `Podfile`:

```ruby
pod 'Auth0UniversalComponents'
```

Then run:

```bash
pod install
```

Open the `.xcworkspace` file (not `.xcodeproj`) after installing.

### Carthage

Add to your `Cartfile`:

```text
github "auth0/ui-components-ios"
```

Then run:

```bash
carthage update --use-xcframeworks
```

## Secret Management

This is a **native mobile SDK** — no client secrets are needed. The SDK uses:
- Public JWKS validation for token verification
- Auth0.plist stores only Domain and Client ID (non-sensitive)
- Credentials are stored securely in the iOS Keychain via the Auth0 Swift SDK

**Never include a Client Secret in a native mobile application.**

## Verification

After setup, verify the configuration:

1. Build the project: `Cmd+B` in Xcode
2. Ensure `import Auth0UniversalComponents` compiles without errors
3. Verify `Auth0.plist` is included in the app bundle (check Build Phases > Copy Bundle Resources)
4. Run on simulator or device to confirm SDK initialization succeeds
