# Setup Guide — Auth0 Flutter Web

## Auth0 Configuration

> **IMPORTANT — Credential privacy:** Never echo Auth0 credentials (domain, client ID) in your response text or terminal output. Credentials are passed at compile time via `--dart-define` flags — never hardcode them in source files. When running Auth0 CLI commands that produce output containing these values, redirect output to a file and read it programmatically.
>
> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt.
> - **If credentials are provided:** Use them in `--dart-define` flags when building/running the app and proceed to "Post-Setup Steps".
> - **If no credentials are provided:** Run the bootstrap script below. Do NOT offer manual setup or ask the user to create an application in Auth0 Dashboard themselves — always use the CLI.

### Bootstrap Script

> **Agent instruction:** Run these checks before the script. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> 1. **Check Node.js**: `node --version`. If missing or below 20, install per platform (macOS: `brew install node`, Linux/Windows: see https://nodejs.org).
> 2. **Check Auth0 CLI**: `command -v auth0`. If missing, install per platform (macOS: `brew install auth0/auth0-cli/auth0`, Linux: `curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh`, see https://github.com/auth0/auth0-cli).
> 3. **Check Auth0 login**: `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for confirmation, then re-run the check. Retry up to 3 times before treating as a persistent failure.
> 4. **Confirm active tenant**: Parse the `→` line from the CSV output. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>`, then re-run step 3.
>
> Once confirmed, run:
> ```bash
> cd <path-to-skill>/auth0-flutter-web/scripts
> npm install
> node bootstrap.mjs <path-to-flutter-project>
> ```
>
> If the script fails due to session expiry, ask the user to run `auth0 login` again, then re-run. Retry up to 3 times.
> Only if the script keeps failing after retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID, then pass those values at compile time via `--dart-define` flags (see "Passing Credentials at Compile Time" below) — never write them verbatim into Dart source files.

The script will:
1. Detect your Flutter web project structure (checks for `pubspec.yaml` and `web/` directory)
2. Create a **Single Page Application** in Auth0 Dashboard
3. Register callback URLs, logout URLs, and web origins for `http://localhost:3000`
4. Set up a database connection (Username-Password-Authentication)
5. Output the domain and client ID to use in your Dart code

### Passing Credentials at Compile Time (credentials already known)

Use this only when credentials are explicitly provided by the user or obtained after bootstrap script failure.

Auth0 `domain` and `clientId` are public identifiers (not secrets), but to keep them out of source control and out of agent output, read them from `--dart-define` flags via `const String.fromEnvironment()` rather than hardcoding string literals:

```dart
final auth0 = Auth0Web(
  const String.fromEnvironment('AUTH0_DOMAIN'),
  const String.fromEnvironment('AUTH0_CLIENT_ID'),
);
```

Supply the values at build/run time:

```bash
flutter run -d chrome --web-port 3000 \
  --dart-define=AUTH0_DOMAIN=<domain> \
  --dart-define=AUTH0_CLIENT_ID=<client-id>
```

There is no config file (like `Auth0.plist` for iOS) — the values are injected at compile time and never written verbatim into Dart source files.

---

## Post-Setup Steps

### Add Auth0 SPA JS to web/index.html (Required)

The `auth0_flutter` web platform depends on the Auth0 SPA JS library loaded in the browser. Add this script tag inside the `<head>` of `web/index.html`:

```html
<head>
  <!-- ... existing tags ... -->
  <script src="https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js" defer></script>
</head>
```

> **Agent instruction:**
> 1. Read `web/index.html`
> 2. Check if the Auth0 SPA JS script is already present
> 3. If not, add it inside `<head>` before the closing `</head>` tag
> 4. If `web/index.html` does not exist, check if web platform is enabled:
>    ```bash
>    flutter config --list | grep web
>    ```
>    If web is not enabled or the web directory doesn't exist:
>    ```bash
>    flutter create . --platforms=web
>    ```

### Configure Callback URLs in Auth0 Dashboard

For a Single Page Application, three URL fields must be configured:

| Field | Value | Purpose |
|-------|-------|---------|
| Allowed Callback URLs | `http://localhost:3000` | Where Auth0 redirects after login |
| Allowed Logout URLs | `http://localhost:3000` | Where Auth0 redirects after logout |
| Allowed Web Origins | `http://localhost:3000` | Required for silent token renewal via iframe |

> **Agent instruction:** Register these URLs using the Auth0 CLI:
> ```bash
> auth0 apps update CLIENT_ID \
>   --callbacks "http://localhost:3000" \
>   --logout-urls "http://localhost:3000" \
>   --web-origins "http://localhost:3000" \
>   --no-input
> ```
>
> For production, add production URLs (comma-separated):
> ```bash
> auth0 apps update CLIENT_ID \
>   --callbacks "http://localhost:3000,https://myapp.example.com" \
>   --logout-urls "http://localhost:3000,https://myapp.example.com" \
>   --web-origins "http://localhost:3000,https://myapp.example.com" \
>   --no-input
> ```

### Enable Refresh Token Rotation (Recommended)

To support `offline_access` scope and refresh tokens in SPAs:

> **Agent instruction:** Enable refresh token rotation via Auth0 CLI:
> ```bash
> auth0 api patch applications/CLIENT_ID \
>   --data '{"refresh_token":{"rotation_type":"rotating","expiration_type":"expiring","token_lifetime":2592000,"idle_token_lifetime":1296000}}' \
>   --no-input
> ```

---

## SDK Installation

> **Agent instruction:** Check the project directory for `pubspec.yaml`. If found, add the dependency:
> ```bash
> flutter pub add auth0_flutter
> ```
>
> If `pubspec.yaml` is not found, this is not a Flutter project. Ask the user for the correct project path.

### pubspec.yaml

```yaml
dependencies:
  auth0_flutter: ^2.1.0
```

After adding, run:
```bash
flutter pub get
```

### Verify Web Platform Support

Ensure the project has web platform enabled:

```bash
# Check if web directory exists
ls web/index.html

# If not, add web platform support
flutter create . --platforms=web
```

---

## Secret Management

Auth0 Flutter Web **does not use a client secret**. Single Page Applications use PKCE (Proof Key for Code Exchange) + authorization code flow, which is secure without a secret.

- `domain` and `clientId` passed to `Auth0Web()` are **not secrets** — they are public identifiers safe to commit to source control
- Access tokens and refresh tokens are stored in the **browser's in-memory cache** by the Auth0 SPA JS SDK
- No environment variables or `.env` files are needed for the Auth0 configuration
- **Never** store a client secret in frontend/web code

---

## Running the App

> Credentials are read at compile time via `const String.fromEnvironment(...)`, so the `--dart-define` flags must be present on **every** `flutter run` / `flutter build`. Omitting them makes `Auth0Web` receive empty strings and authentication will fail at runtime.

```bash
# Development (with consistent port for callback URLs)
flutter run -d chrome --web-port 3000 \
  --dart-define=AUTH0_DOMAIN=<domain> \
  --dart-define=AUTH0_CLIENT_ID=<client-id>

# Production build
flutter build web \
  --dart-define=AUTH0_DOMAIN=<domain> \
  --dart-define=AUTH0_CLIENT_ID=<client-id>

# Serve production build locally for testing
cd build/web && python3 -m http.server 3000
```

> **Agent instruction:** Always use `--web-port 3000` during development to match the callback URLs registered in Auth0 Dashboard. If the user prefers a different port, update both the run command and the Auth0 Dashboard URLs. Always include both `--dart-define` flags on every run/build command.

---

## Verification

After completing setup, verify:

```bash
# 1. Build the project
flutter build web \
  --dart-define=AUTH0_DOMAIN=<domain> \
  --dart-define=AUTH0_CLIENT_ID=<client-id>

# 2. Run locally
flutter run -d chrome --web-port 3000 \
  --dart-define=AUTH0_DOMAIN=<domain> \
  --dart-define=AUTH0_CLIENT_ID=<client-id>
```

- [ ] `auth0_flutter` is in `pubspec.yaml` dependencies
- [ ] Auth0 SPA JS script tag is in `web/index.html`
- [ ] `Auth0Web` is instantiated from `String.fromEnvironment` defines
- [ ] Both `--dart-define` flags are passed on every run/build command
- [ ] `onLoad()` is called on app startup
- [ ] Callback URLs are saved in Auth0 Dashboard
- [ ] Allowed Web Origins is configured in Auth0 Dashboard
- [ ] App builds without errors
- [ ] Login redirect works and returns to the app
