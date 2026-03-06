# Auth0 React Native Setup Guide

---

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 Native Application automatically
4. Extract credentials from the CLI output
5. Configure iOS and Android with the credentials

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Step 1: Install Auth0 CLI

Check if Auth0 CLI is installed, install if needed:

```bash
command -v auth0 &> /dev/null && echo "AUTH0_CLI_INSTALLED" || echo "AUTH0_CLI_NOT_FOUND"
```

**If not installed, run the appropriate command for the user's OS:**

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
```

---

## Step 2: Ensure user is logged in to Auth0

Check login status:

```bash
auth0 tenants list 2>&1
```

**If the command fails or shows an error**, the user needs to log in:

```bash
auth0 login
```

Tell the user: "A browser window will open. Please log in to your Auth0 account (or create one at https://auth0.com/signup if needed)."

**Wait for user to complete login, then verify:**

```bash
auth0 tenants list
```

---

## Step 3: Get App Bundle Identifier

Before creating the Auth0 app, determine the bundle identifier:

**For Expo projects**, check `app.json`:
```bash
grep -o '"bundleIdentifier"[[:space:]]*:[[:space:]]*"[^"]*"' app.json 2>/dev/null || echo "NOT_FOUND"
grep -o '"package"[[:space:]]*:[[:space:]]*"[^"]*"' app.json 2>/dev/null || echo "NOT_FOUND"
```

**For React Native CLI projects**, check iOS and Android configs:
```bash
# iOS bundle ID
grep -o 'PRODUCT_BUNDLE_IDENTIFIER = [^;]*' ios/*.xcodeproj/project.pbxproj 2>/dev/null | head -1 || echo "NOT_FOUND"
# Android package
grep -o 'applicationId "[^"]*"' android/app/build.gradle 2>/dev/null || echo "NOT_FOUND"
```

If not found, ask the user for their bundle identifier (e.g., `com.mycompany.myapp`).

---

## Step 4: Create Auth0 Application

**Get the Auth0 domain first:**
```bash
auth0 tenants list --json | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4
```

**Create a new Native Application - replace `{BUNDLE_ID}` with actual bundle ID and `{DOMAIN}` with Auth0 domain:**

```bash
auth0 apps create \
  --name "$(basename "$PWD")-mobile" \
  --type native \
  --callbacks "{BUNDLE_ID}.auth0://{DOMAIN}/ios/{BUNDLE_ID}/callback,{BUNDLE_ID}.auth0://{DOMAIN}/android/{BUNDLE_ID}/callback" \
  --logout-urls "{BUNDLE_ID}.auth0://{DOMAIN}/ios/{BUNDLE_ID}/callback,{BUNDLE_ID}.auth0://{DOMAIN}/android/{BUNDLE_ID}/callback" \
  --metadata "created_by=agent_skills" \
  --json
```

**This outputs JSON. Extract these values from the response:**
- `client_id` - This is your Auth0 Client ID
- `domain` - This is your Auth0 Domain

---

## Step 5: Install SDK

**For Expo:**
```bash
npx expo install react-native-auth0
```

**For React Native CLI:**
```bash
npm install react-native-auth0
cd ios && pod install && cd ..
```

---

## Step 6: Configure iOS

Update `ios/{YourApp}/Info.plist` - add inside the `<dict>` tag:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>None</string>
    <key>CFBundleURLName</key>
    <string>auth0</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>$(PRODUCT_BUNDLE_IDENTIFIER).auth0</string>
    </array>
  </dict>
</array>
```

---

## Step 7: Configure Android

Update `android/app/src/main/AndroidManifest.xml` - add inside `<application>`:

```xml
<activity android:name="com.auth0.android.provider.RedirectActivity" android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:host="<domain-from-step-4>"
      android:pathPrefix="/android/${applicationId}/callback"
      android:scheme="${applicationId}.auth0" />
  </intent-filter>
</activity>
```

**Replace `<domain-from-step-4>` with the actual Auth0 domain.**

---

## Step 8: Configure Expo (if applicable)

Update `app.json`:

```json
{
  "expo": {
    "scheme": "<bundle-id>.auth0",
    "ios": {
      "bundleIdentifier": "<bundle-id>"
    },
    "android": {
      "package": "<bundle-id>"
    }
  }
}
```

---

## Verification

After setup, confirm to the user:
- Auth0 Native application created successfully
- SDK installed
- iOS Info.plist configured
- Android AndroidManifest.xml configured
- Expo app.json configured (if applicable)

Tell them to rebuild the app:
- **Expo:** `npx expo prebuild` then `npx expo run:ios` or `npx expo run:android`
- **React Native CLI:** `npx react-native run-ios` or `npx react-native run-android`

---

## Troubleshooting

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Login Issues

**Browser doesn't open:**
```bash
auth0 login --no-browser
```

### Common Errors

**Callback not working:**
- Verify scheme matches bundle ID/package name
- Check Auth0 allowed callbacks include your scheme

**Build errors on iOS:**
```bash
cd ios && pod install && cd ..
# Clean build in Xcode: Product → Clean Build Folder
```

**Android redirect issues:**
- Ensure RedirectActivity is exported
- Check scheme matches package name

---

## Fallback: Manual Dashboard Setup

**Only use this if the CLI approach fails completely after troubleshooting.**

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Native**
5. Configure callback URLs with your app scheme:
   - `{bundle-id}.auth0://{domain}/ios/{bundle-id}/callback`
   - `{bundle-id}.auth0://{domain}/android/{bundle-id}/callback`
6. Copy **Domain** and **Client ID** for use in your app

---

## Next Steps

- [Patterns Guide](patterns.md) - Implementation patterns
- [API Reference](api.md) - Complete SDK API
- [Main Skill](../SKILL.md) - Quick start workflow
