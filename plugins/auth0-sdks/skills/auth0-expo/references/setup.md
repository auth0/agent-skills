# Auth0 Expo Setup Guide

Detailed setup instructions for Expo mobile applications using react-native-auth0. For the basic install and plugin configuration, see the [Quick Start in SKILL.md](../SKILL.md#quick-start-workflow).

---

## Auth0 Configuration

> **Agent instruction:**
>
> **If the user's prompt already provides Auth0 credentials** (domain and client ID), use them directly — skip to writing the config and proceed with integration.
>
> **If credentials are NOT provided**, use `AskUserQuestion`:
> "How would you like to configure Auth0 for this Expo project?"
> - Option A: "Automatic setup (recommended)" — uses the Auth0 CLI
> - Option B: "Manual setup" — provide Auth0 credentials manually

### Option A: Automatic Setup (Auth0 CLI)

**Pre-flight checks:**
```bash
node --version        # Must be 20+
auth0 --version       # Auth0 CLI installed
auth0 tenants list --csv --no-input  # Active tenant
```

**Create Native Application:**
```bash
auth0 apps create \
  --name "My Expo App" \
  --type native \
  --callbacks "yourappscheme://YOUR_DOMAIN/ios/yourappscheme/callback,yourappscheme://YOUR_DOMAIN/android/yourappscheme/callback" \
  --logout-urls "yourappscheme://YOUR_DOMAIN/ios/yourappscheme/callback,yourappscheme://YOUR_DOMAIN/android/yourappscheme/callback" \
  --metadata "created_by=agent_skills"
```

Copy the `domain` and `client_id` from the output.

### Option B: Manual Setup (Auth0 Dashboard)

1. Go to [Auth0 Dashboard > Applications](https://manage.auth0.com/#/applications)
2. Create a new **Native** application
3. In Settings, set **Allowed Callback URLs** and **Allowed Logout URLs**:
   ```
   yourappscheme://YOUR_DOMAIN/ios/yourappscheme/callback,
   yourappscheme://YOUR_DOMAIN/android/yourappscheme/callback
   ```
4. Copy the **Domain** and **Client ID**

---

## Expo Plugin Configuration

The basic plugin setup is in SKILL.md Step 2. Below are the plugin options and advanced configurations.

### Plugin Options

| Option | Required | Description |
|--------|----------|-------------|
| `domain` | Yes | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `customScheme` | No | Custom URL scheme for callbacks. Must be lowercase, no special characters. If omitted, uses bundle identifier. |

### Using `customScheme: "https"` for App Links

Set `customScheme` to `"https"` to use Android App Links (recommended for production):

```json
["react-native-auth0", { "domain": "YOUR_DOMAIN", "customScheme": "https" }]
```

This automatically adds `android:autoVerify="true"` to the intent-filter. Callback URLs become:

```text
https://YOUR_DOMAIN/ios/{bundleId}/callback
https://YOUR_DOMAIN/android/{package}/callback
```

### Multiple Domains

Pass an array of domain objects to support domain switching:

```json
"plugins": [
  ["react-native-auth0", [
    { "domain": "tenant1.auth0.com", "customScheme": "scheme1" },
    { "domain": "tenant2.auth0.com", "customScheme": "scheme2" }
  ]]
]
```

---

## Post-Setup Steps

After configuring `app.json`, always regenerate native projects:

```bash
npx expo prebuild --clean
```

### Verify Configuration

**iOS:** Check that `ios/{AppName}/Info.plist` contains the URL scheme entry:
```xml
<key>CFBundleURLSchemes</key>
<array>
  <string>myappscheme</string>
</array>
```

**Android:** Check that `android/app/src/main/AndroidManifest.xml` contains the RedirectActivity with the correct scheme and domain.

---

## Environment Variables (Optional)

For keeping credentials out of source control, use environment variables with `app.config.js`:

```js
export default {
  expo: {
    // ...
    plugins: [
      [
        "react-native-auth0",
        {
          domain: process.env.AUTH0_DOMAIN,
          customScheme: "myappscheme"
        }
      ]
    ]
  }
};
```

Create `.env` (add to `.gitignore`):
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
```

> **Note:** Expo does not load `.env` files by default. Use a package like `dotenv` in `app.config.js` or pass values via EAS Build secrets.

---

## Troubleshooting

**App hangs after login redirect:**
- Verify callback URLs are all lowercase and match Auth0 Dashboard exactly
- Ensure `customScheme` matches between `app.json`, `authorize()`, and `clearSession()` calls
- Run `npx expo prebuild --clean` after any config change

**Build fails after install:**
```bash
npx expo prebuild --clean
cd ios && pod install --repo-update && cd ..
```

**Expo Go shows error:**
- This SDK is not compatible with Expo Go — use `npx expo run:ios` or `npx expo run:android`

**Android redirect not working:**
- Check that `android:exported="true"` is set on the RedirectActivity in the generated manifest

---

## EAS Build (Production)

Configure `eas.json`:
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {}
  }
}
```

For production, use HTTPS callback URLs (App Links / Universal Links):
```text
https://YOUR_DOMAIN/ios/{bundleId}/callback
https://YOUR_DOMAIN/android/{package}/callback
```

Build:
```bash
eas build --platform all
```

---

## Next Steps

- [Integration Patterns](integration.md) — Login/logout flows, protected screens, API calls
- [API Reference](api.md) — Complete SDK API and testing
- [Main Skill](../SKILL.md) — Quick start workflow
