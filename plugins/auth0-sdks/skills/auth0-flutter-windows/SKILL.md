---
name: auth0-flutter-windows
description: Use when adding Auth0 login and logout to Flutter Windows Desktop applications - integrates auth0_flutter SDK (v2.1.0-beta.1+) for native Flutter Windows apps using PKCE with custom URL scheme callbacks. Triggers on Flutter projects requiring Auth0 authentication on Windows Desktop.
---

# Auth0 Flutter Windows Desktop

Adds Auth0 Universal Login to a **Flutter Windows Desktop** application using the `auth0_flutter` SDK. The Windows plugin implements PKCE authorization code flow: opens the system browser for login, delivers the OAuth callback via a custom URL scheme (Windows protocol handler) registered in the Windows Registry, and polls the `PLUGIN_STARTUP_URL` environment variable for the authorization code.

> **Beta:** Windows Desktop support was added in `auth0_flutter` v2.1.0-beta.1. The API surface may change before GA release.

## Get Current SDK Version

```bash
gh api repos/auth0/auth0-flutter/releases/latest --jq '.tag_name'
```

## Prerequisites

| Requirement | Minimum Version | Notes |
|------------|-----------------|-------|
| Flutter SDK | 3.24.0+ | |
| Dart SDK | 3.5.0+ | |
| auth0_flutter | 2.1.0-beta.1 | Windows Desktop beta |
| Visual Studio | 2019+ | C++ build tools + CMake component required |
| CMake | 3.14+ | Included with Visual Studio |
| vcpkg | Latest | Manages native C++ dependencies (cpprestsdk, OpenSSL, Boost) |
| Node.js | 20+ | Required for Auth0 setup automation scripts |
| Windows | 10+ | Desktop build target |

## When NOT to Use

| Scenario | Use Instead |
|----------|-------------|
| Flutter Android / iOS / macOS | `auth0-flutter` (standard mobile skill) |
| Flutter Web | `auth0-flutter-web` |
| React Native Windows | `auth0-react-native` |
| .NET MAUI Windows | `auth0-maui` |
| .NET WinForms / WPF | `auth0-aspnetcore-authentication` |
| Backend API (JWT validation only) | `auth0-aspnetcore-api` |

## Quick Start Workflow

> **Agent instructions:** Follow these steps in order. If Auth0 credentials (domain + client ID) are already provided in the user's prompt, use them directly — skip to step 4 (write config). If a build fails 5+ times on the same error, use `AskUserQuestion` to determine the root cause before retrying. After integration, run `flutter build windows` to verify the build succeeds.
>
> **UI reuse:** Before adding login/logout buttons, check if the codebase already has existing login/logout handlers or an auth state widget. Reuse them rather than creating new ones — search for `windowsWebAuthentication`, `auth0`, or `Auth0` in the `lib/` directory first.

### Step 1 — Verify Flutter Windows project structure

```bash
# Verify pubspec.yaml and windows/ runner exist
ls pubspec.yaml windows/runner/main.cpp windows/CMakeLists.txt
```

If `windows/` is missing, run `flutter create --platforms=windows .` to add Windows support.

### Step 2 — Install the SDK

```bash
flutter pub add auth0_flutter
```

This pins `auth0_flutter: ^2.1.0-beta.1` in `pubspec.yaml`. Confirm with `flutter pub get`.

### Step 3 — Configure Auth0

If credentials are already provided, write `lib/auth0_config.dart` directly (step 4) and proceed.

Otherwise, run the bootstrap script for automatic setup (requires Auth0 CLI + Node.js 20+):

```bash
cd scripts && npm install && node bootstrap.mjs <path-to-flutter-project>
```

Or configure manually — see [references/setup.md](references/setup.md).

### Step 4 — Write auth0_config.dart

Create `lib/auth0_config.dart` with your credentials:

```dart
// lib/auth0_config.dart
const String auth0Domain = 'YOUR_AUTH0_DOMAIN';
const String auth0ClientId = 'YOUR_CLIENT_ID';
const String auth0CustomScheme = 'myapp'; // your custom URL scheme
```

### Step 5 — Configure vcpkg (native dependencies)

The Windows plugin requires C++ libraries managed by vcpkg. Install vcpkg and set the environment variable:

```powershell
git clone https://github.com/microsoft/vcpkg.git C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat
setx VCPKG_ROOT "C:\vcpkg"
```

Then add the vcpkg toolchain to `windows/CMakeLists.txt` **before** the first `project()` call:

```cmake
# windows/CMakeLists.txt — add BEFORE project()
# Replace C:/vcpkg with your actual vcpkg installation path.
# Read VCPKG_ROOT from environment if set, otherwise use a hardcoded fallback.
set(CMAKE_TOOLCHAIN_FILE "C:/vcpkg/scripts/buildsystems/vcpkg.cmake"
    CACHE STRING "Vcpkg toolchain file")
```

Or use the environment-variable form (set VCPKG_ROOT system env var first):

```text
# CMake ENV lookup form (environment variable VCPKG_ROOT must be set):
# if(DEFINED ENV{vcpkg_root} ...) — use lowercase in scripts to avoid confusion
# See references/setup.md for the full conditional snippet.
```

> **Warning:** If `CMAKE_TOOLCHAIN_FILE` appears after `project()`, CMake will have already configured the compiler and vcpkg packages will not be found, causing `Could not find a package configuration file provided by "cpprestsdk"`.

### Step 6 — Register the Windows protocol handler

Register a custom URL scheme in the Windows Registry so the OS routes OAuth callbacks to your app. Create `register_scheme.reg` and double-click to import:

```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\myapp]
@="URL:myapp Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\myapp\shell]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open\command]
@="\"C:\\Path\\To\\Build\\your_app.exe\" \"%1\""
```

Replace `myapp` with your scheme and the path with your Flutter Windows build output (e.g. `build\windows\x64\runner\Release\your_app.exe`).

### Step 7 — Update windows/runner/main.cpp (required)

Your `windows/runner/main.cpp` must handle:
1. **Single-instance mutex** — forwards URI to the already-running instance instead of launching a new one
2. **Named pipe server** — receives the forwarded URI and writes it to `PLUGIN_STARTUP_URL`
3. **Startup URI capture** — writes `argv[1]` to `PLUGIN_STARTUP_URL` on first launch

Copy the reference implementation from the example runner and update `kCallbackPrefix` to your scheme:

```cpp
// Near the top of main.cpp — update to match your scheme
const wchar_t* kCallbackPrefix = L"myapp://callback";
```

See the "Update main.cpp" section in [references/setup.md](references/setup.md) for the complete integration guide.

### Step 8 — Add Auth0 to your app

```dart
import 'package:auth0_flutter/auth0_flutter.dart';
import 'auth0_config.dart';

final auth0 = Auth0(auth0Domain, auth0ClientId);

// Login
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: '$auth0CustomScheme://callback',
);
// credentials.accessToken, credentials.user

// Logout
await auth0.windowsWebAuthentication().logout(
  appCustomURL: '$auth0CustomScheme://callback',
);
```

> **Important:** Credentials are **not** automatically stored on Windows. Store the returned `Credentials` object yourself (e.g., using `shared_preferences` or secure storage).

### Step 9 — Build and verify

```bash
flutter build windows
```

Verify the build succeeds. If you see CMake errors about `cpprestsdk`, check that:
- `VCPKG_ROOT` is set and terminal was restarted after `setx`
- `CMAKE_TOOLCHAIN_FILE` is before `project()` in `windows/CMakeLists.txt`

## Detailed Documentation

- [Setup Guide](references/setup.md) — Auth0 dashboard config, vcpkg setup, CMakeLists.txt, main.cpp integration, protocol handler registration
- [Integration Guide](references/integration.md) — Login/logout patterns, organizations, custom parameters, error handling, credentials storage
- [API Reference](references/api.md) — WindowsWebAuthentication API, Credentials type, error types, callback URL configuration

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `main.cpp` not updated with pipe server | Login times out → `USER_CANCELLED` | Copy [example main.cpp](https://github.com/auth0/auth0-flutter/blob/beta-release/v2.1.0/auth0_flutter/example/windows/runner/main.cpp) and update `kCallbackPrefix` |
| Protocol handler not registered | Browser opens, callback never arrives | Import `.reg` file or use programmatic registration at first launch |
| `CMAKE_TOOLCHAIN_FILE` after `project()` | `Could not find cpprestsdk` CMake error | Move vcpkg toolchain block to **before** `project()` |
| `VCPKG_ROOT` not set | vcpkg toolchain not found, silent build failure | Run `setx VCPKG_ROOT "C:\vcpkg"` and open a new terminal |
| Using `webAuthentication()` instead of `windowsWebAuthentication()` | Wrong flow, callback URL mismatch | Use `auth0.windowsWebAuthentication()` on Windows Desktop |
| `appCustomURL` not passed | Dart compile error (required named parameter) | Always pass `appCustomURL: 'myapp://callback'` |
| Callback/logout URLs missing from Auth0 Dashboard | `Callback URL mismatch` error | Add `myapp://callback` to **Allowed Callback URLs** and **Allowed Logout URLs** |
| Multiple instances launching | Second Flutter window opens on callback | Ensure single-instance mutex is in `wWinMain` before Flutter bootstrap |
| Credentials not persisted | User logged out on app restart | Manually store the `Credentials` object (no CredentialsManager on Windows) |
| Auth0 application type wrong | Token validation issues | Set to **Native** in Auth0 Dashboard (not SPA or Regular Web) |

## Related Skills

- **auth0-flutter** — Standard Flutter mobile (Android/iOS/macOS) integration
- **auth0-flutter-web** — Flutter Web (SPA) integration
- **auth0-swift** — iOS-native Swift authentication
- **auth0-android** — Android-native Kotlin authentication
- **auth0-maui** — .NET MAUI Windows authentication

## Quick Reference

| API | Description |
|-----|-------------|
| `auth0.windowsWebAuthentication()` | Returns `WindowsWebAuthentication` instance |
| `.login(appCustomURL: 'myapp://callback')` | Start PKCE login, open browser |
| `.logout(appCustomURL: 'myapp://callback')` | Clear Auth0 session in browser |
| `.login(appCustomURL: ..., redirectUrl: 'https://...')` | Use intermediary HTTPS server for cleaner browser UX |
| `.logout(appCustomURL: ..., returnTo: 'https://...')` | Use intermediary HTTPS server for logout |
| `.login(audience: 'https://api.example.com')` | Request access token for an API |
| `.login(scopes: {'openid', 'profile', 'email', 'offline_access'})` | Custom scopes |
| `.login(organizationId: 'org_...')` | Log into a specific organization |
| `.login(authTimeout: Duration(minutes: 5))` | Override 3-minute default timeout |
| `credentials.accessToken` | OAuth 2.0 access token |
| `credentials.idToken` | OIDC ID token (JWT) |
| `credentials.refreshToken` | Refresh token (if `offline_access` scope) |
| `credentials.user` | `UserProfile` with user claims |
| `credentials.expiresAt` | Token expiry as `DateTime` |
| `WebAuthenticationException` | Thrown on auth errors |

### Default scopes

`openid`, `profile`, `email`, `offline_access`

### Callback URL format

Windows Desktop uses a **custom URL scheme** (protocol handler), not the HTTPS Universal Links used by iOS/Android:

| Platform | Callback URL format | Example |
|----------|--------------------|---------|
| Windows (this skill) | `{scheme}://callback` | `myapp://callback` |
| iOS | `https://{domain}/ios/{bundleId}/callback` | `https://tenant.auth0.com/ios/com.example.app/callback` |
| Android | `https://{domain}/android/{packageName}/callback` | `https://tenant.auth0.com/android/com.example.app/callback` |

The Windows scheme must be unique to your app. Register it in:
- Windows Registry (protocol handler)
- Auth0 Dashboard → Allowed Callback URLs / Allowed Logout URLs

### Testing on a physical Windows machine

> **Note:** Unlike iOS/Android, there is no simulator limitation for Windows Desktop. Test on any physical Windows 10/11 machine with a browser installed. The OAuth flow opens the system default browser (Edge, Chrome, Firefox, etc.). Verify on a physical device that the protocol handler correctly activates the running app instance when the browser navigates to `myapp://callback`.

## References

- [auth0_flutter on pub.dev](https://pub.dev/packages/auth0_flutter)
- [GitHub: auth0/auth0-flutter (beta branch)](https://github.com/auth0/auth0-flutter/tree/beta-release/v2.1.0)
- [EXAMPLES.md — Windows section](https://github.com/auth0/auth0-flutter/blob/beta-release/v2.1.0/auth0_flutter/EXAMPLES.md#-windows-web-authentication)
- [Example runner main.cpp](https://github.com/auth0/auth0-flutter/blob/beta-release/v2.1.0/auth0_flutter/example/windows/runner/main.cpp)
- [Auth0 Dashboard](https://manage.auth0.com/)
- [Auth0 Flutter Quickstart (Native)](https://auth0.com/docs/quickstart/native/flutter/interactive)
- [vcpkg Documentation](https://vcpkg.io/en/getting-started)
- [Flutter Windows Desktop](https://docs.flutter.dev/platform-integration/windows/building)
