# Setup Guide — Auth0 Swift

## Auth0 Configuration

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt.
> - **If credentials are provided:** Write `Auth0.plist` directly with those values and proceed to "Post-Setup Steps". Skip the options below.
> - **If credentials are NOT provided:** Ask via `AskUserQuestion` whether to use automatic setup (bootstrap script) or manual setup.

### Option A: Automatic Setup (Bootstrap Script)

**Prerequisites:**
```bash
# Verify Node.js 20+
node --version

# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Log in to Auth0
auth0 login
```

**Run the bootstrap script:**
```bash
cd scripts && npm install && node bootstrap.mjs /path/to/your/xcode/project
```

The script will:
1. Detect your bundle identifier from `project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`)
2. Create a **Native** application in Auth0 Dashboard
3. Register both `https://` and `{bundle}://` callback + logout URLs
4. Set up a database connection (Username-Password-Authentication)
5. Write `Auth0.plist` to your project directory

### Option B: Manual Setup

Ask the user for:
1. **Auth0 Domain** — from Auth0 Dashboard → Applications → your app → Settings tab
2. **Auth0 Client ID** — same location

Create `Auth0.plist` in your Xcode project directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ClientId</key>
    <string>YOUR_AUTH0_CLIENT_ID</string>
    <key>Domain</key>
    <string>YOUR_AUTH0_DOMAIN</string>
</dict>
</plist>
```

Add the file to your Xcode project:
1. Right-click on the project in Navigator → **Add Files to "YourProject"**
2. Select `Auth0.plist`
3. Ensure your app target is checked in the "Add to targets" list

**Auth0 Dashboard settings** (Applications → your app → Settings):

| Setting | Value |
|---------|-------|
| **Application Type** | Native |
| **Token Endpoint Auth Method** | None |
| **Allowed Callback URLs** | `https://YOUR_DOMAIN/ios/YOUR_BUNDLE_ID/callback, YOUR_BUNDLE_ID://YOUR_DOMAIN/ios/YOUR_BUNDLE_ID/callback` |
| **Allowed Logout URLs** | Same as callback URLs |
| **Allowed Web Origins** | Not required for native apps |

---

## Post-Setup Steps

### Register URL Scheme (Required for Custom Scheme Callbacks)

In Xcode, select your app target → **Info** tab → expand **URL Types** → click **+**:
- **Identifier**: `auth0`
- **URL Schemes**: `$(PRODUCT_BUNDLE_IDENTIFIER)`

This allows the Auth0 browser to redirect back to your app using the `{bundle}://` scheme.

### Verify Auth0.plist Target Membership

In Xcode Project Navigator:
1. Click `Auth0.plist`
2. Open File Inspector (right panel, first tab)
3. Under **Target Membership**, ensure your app target checkbox is checked

### macOS Additional Steps

For macOS targets, also:
1. Select your app target → **Signing & Capabilities** tab
2. Click **+ Capability** → add **Outgoing Connections (Client)**
3. Register macOS callback URLs in Auth0 Dashboard:
   ```text
   https://YOUR_DOMAIN/macos/YOUR_BUNDLE_ID/callback,
   YOUR_BUNDLE_ID://YOUR_DOMAIN/macos/YOUR_BUNDLE_ID/callback
   ```

---

## SDK Installation

### Swift Package Manager (Recommended)

1. In Xcode: **File → Add Package Dependencies**
2. Enter package URL: `https://github.com/auth0/Auth0.swift`
3. Select **Up to Next Major Version** starting from `2.18.0`
4. Click **Add Package**
5. In the package product list, ensure **Auth0** is added to your app target

### CocoaPods

```ruby
# Podfile
target 'YourApp' do
  use_frameworks!
  pod 'Auth0', '~> 2.18'
end
```

```bash
pod install
# IMPORTANT: Always open .xcworkspace after pod install
open YourApp.xcworkspace
```

### Carthage

```text
# Cartfile
github "auth0/Auth0.swift" ~> 2.18
```

```bash
# Build frameworks
carthage update --use-xcframeworks --platform iOS

# Then in Xcode: Target → General → "Frameworks, Libraries, and Embedded Content"
# Drag in Carthage/Build/iOS/Auth0.xcframework
```

---

## Secret Management

Auth0.swift **does not use a client secret**. Native apps use PKCE (Proof Key for Code Exchange), which is secure without a secret.

- `ClientId` and `Domain` in `Auth0.plist` are **not secrets** — they are safe to commit to source control
- Access tokens and refresh tokens are stored in the iOS/macOS **Keychain** by `CredentialsManager` — never in `UserDefaults` or plain files
- No environment variables or `.env` files are needed for the Auth0 configuration

---

## Verification

After completing setup, verify:

```bash
# 1. Build the project
xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16"

# 2. Verify Auth0.plist is bundled (should print your domain)
# Run app in Simulator and check Xcode console for Auth0 initialization
```

- [ ] `Auth0.plist` is in the project and in the app target
- [ ] URL scheme `$(PRODUCT_BUNDLE_IDENTIFIER)` is registered in Info tab
- [ ] Callback URLs are saved in Auth0 Dashboard
- [ ] App builds without errors
- [ ] `import Auth0` resolves without errors in Swift files
