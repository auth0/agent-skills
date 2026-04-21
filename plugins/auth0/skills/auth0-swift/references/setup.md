# Setup Guide — Auth0 Swift

## Auth0 Configuration

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt.
> - **If credentials are provided:** Write `Auth0.plist` directly with those values and proceed to "Post-Setup Steps".
> - **If no credentials are provided:** Run the bootstrap script below. Do NOT offer manual setup or ask the user to create an application in Auth0 Dashboard themselves — always use the CLI.

### Bootstrap Script

> **Agent instruction:** Run these checks before the script. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> 1. **Check Node.js**: `node --version`. If missing or below 20, install it: `brew install node`.
> 2. **Check Auth0 CLI**: `command -v auth0`. If missing, install it: `brew install auth0/auth0-cli/auth0`.
> 3. **Check Auth0 login**: `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for confirmation, then re-run the check. Retry up to 3 times before treating as a persistent failure.
> 4. **Confirm active tenant**: Parse the `→` line from the CSV output. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>`, then re-run step 3.
>
> Once confirmed, run:
> ```bash
> cd <path-to-skill>/auth0-swift/scripts
> npm install
> node bootstrap.mjs <path-to-xcode-project>
> ```
>
> If the script fails due to session expiry, ask the user to run `auth0 login` again, then re-run. Retry up to 3 times.
> Only if the script keeps failing after retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID, then write `Auth0.plist` with those values.

The script will:
1. Detect your bundle identifier from `project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`)
2. Create a **Native** application in Auth0 Dashboard
3. Register both `https://` and `{bundle}://` callback + logout URLs
4. Set up a database connection (Username-Password-Authentication)
5. Write `Auth0.plist` to your project directory

### Writing Auth0.plist (credentials already known)

Use this only when credentials are explicitly provided by the user or obtained after bootstrap script failure.

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

Add the file to the Xcode project:
1. Right-click on the project in Navigator → **Add Files to "YourProject"**
2. Select `Auth0.plist`
3. Ensure your app target is checked in the "Add to targets" list

---

## Post-Setup Steps

### Register URL Scheme (Required for Custom Scheme Callbacks)

In Xcode, select your app target → **Info** tab → expand **URL Types** → click **+**:
- **Identifier**: `auth0`
- **URL Schemes**: `$(PRODUCT_BUNDLE_IDENTIFIER)`

This allows the Auth0 browser to redirect back to your app using the `{bundle}://` scheme.

### Associated Domains Setup (HTTPS Universal Links)

> **Agent instruction:** Only follow this section if the user chose HTTPS Universal Links as their callback scheme. If they chose a custom scheme (`{bundle}://`), skip this section entirely.
>
> **Prerequisites:** Before configuring Xcode, Auth0 must be told your Apple Team ID and Bundle ID so it can host the `apple-app-site-association` file. Without this, Universal Links will not work even if the entitlements are correct.

#### Step 1 — Configure Device Settings in Auth0 Dashboard

> **Agent instruction:**
> 1. In Auth0 Dashboard → **Applications** → your app → **Settings**, scroll to the bottom and click **Show Advanced Settings**
> 2. Select the **Device Settings** tab
> 3. Enter the **Apple Team ID** — found at [developer.apple.com/account](https://developer.apple.com/account) under Membership Details
> 4. Enter the **App Bundle Identifier** (e.g. `com.example.myapp`)
> 5. Click **Save Changes**
>
> Auth0 will now automatically host the Apple App Site Association file at:
> `https://YOUR_AUTH0_DOMAIN/.well-known/apple-app-site-association`
>
> Verify it lists your app by opening that URL — the response should contain `applinks` with your `appID` in the format `TEAMID.com.example.myapp`.
>
> Reference: [Enable Universal Links Support in Apple Xcode](https://auth0.com/docs/get-started/applications/enable-universal-links-support-in-apple-xcode)

#### Step 2 — Add Associated Domains Entitlement in Xcode

> **Agent instruction:**
> 1. Find the app's `.entitlements` file (commonly `<AppName>.entitlements`). Search for `*.entitlements` in the project directory.
> 2. If the file exists, add `com.apple.developer.associated-domains` to it. If it does not exist, create it at the project root alongside the `.xcodeproj`.
> 3. Add both entries using the actual Auth0 domain:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:YOUR_AUTH0_DOMAIN</string>
    <string>webcredentials:YOUR_AUTH0_DOMAIN</string>
</array>
```

> - `applinks:` — routes the Universal Link callback back to your app after login
> - `webcredentials:` — enables Password AutoFill and credential handoff with Auth0
>
> 4. If `com.apple.developer.associated-domains` already exists in the file, append the two `<string>` entries to the existing array rather than replacing it.
> 5. If the file was newly created, check that `CODE_SIGN_ENTITLEMENTS` in the target's build settings points to it. If not, inform the user to set it in Xcode under target → Build Settings → Code Signing Entitlements.
> 6. Ensure `.useHTTPS()` is called on the `webAuth()` builder:
>    ```swift
>    Auth0.webAuth().useHTTPS()
>    ```

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

> **Agent instruction:** Before proceeding, check the project directory for signs of an existing package manager:
> - `Podfile` present → use **CocoaPods**
> - `Cartfile` present → use **Carthage**
> - `Package.swift` present → use **Swift Package Manager**
>
> If none are found, ask the user via `AskUserQuestion`: _"Which dependency manager does your project use — Swift Package Manager, CocoaPods, or Carthage?"_ Then follow only the matching section below.

### Swift Package Manager (Recommended)

#### Package.swift project

Run in the project root:

```bash
swift package add-dependency https://github.com/auth0/Auth0.swift --from 2.18.0
```

Then add `"Auth0"` to the target's `dependencies` array in `Package.swift`:

```swift
.target(
    name: "YourTarget",
    dependencies: ["Auth0"]
)
```

#### Xcode project (`.xcodeproj`, no `Package.swift`)

The `swift package add-dependency` command does not apply to Xcode projects. Add the package via the Xcode GUI:

1. **File → Add Package Dependencies**
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
