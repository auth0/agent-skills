# Auth0 Flutter Windows Desktop Integration

`auth0_flutter` is the official Auth0 SDK for Flutter applications. **Windows
desktop** support reached General Availability in SDK v2.1.0. It uses a
different API surface than mobile/web: `windowsWebAuthentication()` instead
of `webAuthentication()`, a custom URL scheme registered as a Windows
protocol handler instead of Info.plist/AndroidManifest registration, a native
C++ runner integration to receive the callback, and **no built-in credential
storage** — the app must persist the returned `Credentials` itself.

> **Agent instruction:** Before providing SDK setup instructions, fetch the
> latest published version from pub.dev:
>
> ```bash
> curl -s https://pub.dev/api/packages/auth0_flutter | python3 -c "import sys,json;print(json.load(sys.stdin)['latest']['version'])"
> ```
>
> This returns a bare semver (e.g. `2.2.0`) — no `v` prefix or GitHub tag
> formatting. Use that exact value as `<VERSION>` in the Step 1 dependency
> line below instead of any hardcoded version. Windows support requires
> v2.1.0 or later; if the fetched version is older, use `2.1.0` and flag it
> to the user.

## When NOT to Use

- **Flutter mobile (iOS/Android)**: use the Auth0 integration workflow for Flutter native — mobile uses `webAuthentication()` and the built-in `CredentialsManager`, neither of which apply here
- **Flutter web**: use the Auth0 integration workflow for Flutter web — browser platform, different API (`Auth0Web`)
- **Flutter macOS**: macOS goes through the same mobile-style `webAuthentication()` flow documented in the Flutter native reference, not the Windows-specific API in this file
- **Flutter Linux**: `auth0_flutter` has no official Linux support (only an unofficial third-party plugin exists) — flag this to the user rather than guessing at an implementation
- **.NET MAUI, WinForms, or WPF desktop apps**: those use the `Auth0.OidcClient.*` NuGet packages, a completely different SDK family — use the Auth0 integration workflow for MAUI/WinForms/WPF
- **Native iOS (Swift, no Flutter)** or **native Android (Kotlin/Java, no Flutter)**: use the Auth0 Swift or Android integration

## Prerequisites

| Flutter | Windows | Native tooling |
|---|---|---|
| SDK 3.24.0+ | Windows 10+ | C++17, Visual Studio 2022 |
| Dart 3.5.0+ | | [vcpkg](https://vcpkg.io/) (for native dependencies) |

- Auth0 account — [Sign up free](https://auth0.com/signup)
- Auth0 CLI — [install instructions](https://github.com/auth0/auth0-cli) (used to create and configure the Auth0 application)

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. If you encounter an error at any step, attempt to fix it up to 5 times before calling `AskUserQuestion` to ask the user for guidance. Always search existing code first — if there are existing login/logout handlers, hook into them rather than creating new ones.

### Step 1 — Install SDK

> **Agent instruction:** Check the project directory for `pubspec.yaml` and a `windows/` platform directory. If neither is present, this is not a Flutter Windows project — ask the user.

```bash
flutter pub add auth0_flutter:^<VERSION>
```

Replace `<VERSION>` with the pub.dev version fetched above (e.g.
`auth0_flutter:^2.2.0`).

### Step 2 — Choose a callback pattern and configure Auth0

Windows has no OS-level equivalent of an iOS Universal Link or Android App
Link — the app registers a **custom URL scheme** (e.g. `myapp://callback`)
as a Windows protocol handler, and Auth0 redirects to it after login. There
are two supported patterns:

- **Option A — Direct custom-scheme redirect (recommended for most apps).**
  Register the custom scheme directly as the callback/logout URL. Simpler,
  but the browser may leave a blank tab open after redirecting (a browser
  behavior, not an error).
- **Option B — Intermediary HTTPS server.** Register an HTTPS URL you
  control as the callback/logout URL; that server 302s onward to the custom
  scheme, letting it show a "Returning you to the app…" page and close
  cleanly. Requires you to run and validate a small server endpoint.

> **Agent instruction:**
> - **If Auth0 credentials (domain AND client ID) are already in the user's prompt:** use those values directly.
> - **If no credentials are provided:** ask the user whether to create the Auth0 application automatically (Auth0 CLI) or manually (Dashboard), and which callback pattern (A or B) they want. Default to Option A unless the user specifically wants to avoid a lingering browser tab.
> - Choose a scheme name unique to the app (e.g. `myapp`, `com.company.myapp`) and use it consistently across the Auth0 Dashboard, the Windows Registry, and the Dart `appCustomURL` value.

Create a **Native** application, then register the callback and logout URLs:

```bash
# Option A — direct custom scheme
auth0 apps update CLIENT_ID \
  --callbacks "myapp://callback" \
  --logout-urls "myapp://callback" \
  --no-input

# Option B — intermediary HTTPS server
auth0 apps update CLIENT_ID \
  --callbacks "https://your-app.example.com/callback" \
  --logout-urls "https://your-app.example.com/logout" \
  --no-input
```

### Step 3 — Install native dependencies via vcpkg

The Windows plugin is implemented in native C++ and depends on `cpp-httplib`,
`nlohmann-json`, and `openssl`, managed via vcpkg. The plugin's own
`vcpkg.json` manifest lives inside the plugin package, not the app's
`windows/` root, so vcpkg's manifest mode won't auto-install these — install
them explicitly into the vcpkg instance:

```powershell
git clone https://github.com/microsoft/vcpkg
.\vcpkg\bootstrap-vcpkg.bat
$env:VCPKG_ROOT = "$PWD\vcpkg"
```

```powershell
.\vcpkg\vcpkg.exe install --recurse "cpp-httplib[core,openssl]:x64-windows" nlohmann-json:x64-windows openssl:x64-windows
```

### Step 4 — Configure `windows/CMakeLists.txt`

The app's top-level `windows/CMakeLists.txt` must enable vcpkg toolchain
integration so the plugin's native dependencies resolve. Add this **before**
the first `project()` call:

```cmake
# windows/CMakeLists.txt

cmake_minimum_required(VERSION 3.14)

# --- vcpkg integration (required for auth0_flutter) ---
if(DEFINED ENV{VCPKG_ROOT} AND EXISTS "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake")
    set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
        CACHE STRING "Vcpkg toolchain file")
endif()

project(your_app LANGUAGES CXX)

# ... rest of your CMakeLists.txt ...
```

> **Agent instruction:** the `CMAKE_TOOLCHAIN_FILE` assignment must come before `project()`. If it's added after, CMake will already have configured the compiler and the build fails with errors like `Could not find a package configuration file provided by "httplib"`. Insert it into the existing file rather than overwriting other content.

### Step 5 — Register the custom URL scheme

Windows routes `myapp://callback` back to the app via a Registry protocol
handler entry. Pick the registration method based on where the app is in its
lifecycle:

**Development — manual `.reg` file:**

```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\myapp]
@="URL:myapp Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\myapp\shell]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open\command]
@="\"C:\\Path\\To\\Your\\App\\your_app.exe\" \"%1\""
```

Replace `myapp` with the chosen scheme and the path with the built
executable (e.g. `build\windows\x64\runner\Debug\your_app.exe` during
development, the installed path in production).

**Production — installer or first-run registration:** if the app ships via
MSIX, declare the protocol in `Package.appxmanifest`:

```xml
<Extensions>
  <uap:Extension Category="windows.protocol">
    <uap:Protocol Name="myapp">
      <uap:DisplayName>My App Callback</uap:DisplayName>
    </uap:Protocol>
  </uap:Extension>
</Extensions>
```

For other installers (Inno Setup, WiX) or a first-run self-registration
approach, write the same Registry keys shown above from the installer script
or from `main.cpp` on first launch.

### Step 6 — Update the Windows runner (`windows/runner/main.cpp`)

The plugin does not automatically receive OS protocol-scheme activations —
the app's runner must capture the callback URI and hand it to the plugin via
the `PLUGIN_STARTUP_URL` environment variable. Without this, `login()` always
times out with `USER_CANCELLED` because the callback never reaches the
waiting plugin.

> **Agent instruction:** this involves security-sensitive Win32 code (a
> named pipe with a restricted DACL, single-instance mutex handling, prefix
> validation of the forwarded URI). Do not hand-write this logic from
> memory — fetch the canonical reference implementation and adapt only the
> callback-prefix constant to the chosen scheme:
>
> ```bash
> curl -sL https://raw.githubusercontent.com/auth0/auth0-flutter/main/auth0_flutter/example/windows/runner/main.cpp
> ```
>
> The three required pieces, copied from that file into the app's
> `wWinMain`:
> 1. **Single-instance mutex** — a second launch triggered by the OS
>    protocol handler forwards its URI to the already-running instance
>    instead of opening a new window.
> 2. **Named-pipe server** (`\\.\pipe\<scheme>_auth0_pipe`) — the running
>    instance listens for the forwarded URI, validates it starts with the
>    app's callback prefix (e.g. `myapp://callback`), and writes it to
>    `PLUGIN_STARTUP_URL`. The pipe's security descriptor must restrict
>    access to the current user only — do not use a `NULL` security
>    descriptor, which would let any process on the machine inject an
>    arbitrary startup URL.
> 3. **Startup URI capture** — on first launch, `argv[1]` (the
>    protocol-scheme URI, if present) is written to `PLUGIN_STARTUP_URL`
>    before Flutter starts, after the same prefix check.
>
> The example file's mutex and pipe names are fixed strings shared by every
> app that copies them unmodified — two different Auth0-Flutter-Windows apps
> installed on the same machine would collide on the same mutex/pipe, and one
> app's callback could be forwarded into the other's window. Rename both to
> include the app's own custom scheme, e.g. `Local\<scheme>_auth0_singleton`
> for the mutex and `\\.\pipe\<scheme>_auth0_pipe` for the pipe, and update
> `kCallbackPrefix` to match the chosen scheme (e.g. `L"myapp://callback"`).

### Step 7 — Implement Authentication

> **Agent instruction:** search the project for the main app entry point (`lib/main.dart`). Create an `AuthService` class that stores `Credentials` manually — there is no `CredentialsManager` on Windows, so the app owns persistence via secure storage (e.g. `flutter_secure_storage`), since the credentials can include a refresh token.

```bash
flutter pub add flutter_secure_storage
```

```dart
// lib/auth_service.dart
import 'dart:convert';
import 'package:auth0_flutter/auth0_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  late final Auth0 _auth0;
  Credentials? _credentials;
  final String _appCustomURL;
  final String? _redirectUrl;
  final String? _returnTo;
  static const _storage = FlutterSecureStorage();
  static const _credentialsKey = 'auth0_credentials';

  AuthService({
    required String domain,
    required String clientId,
    required String appCustomURL,
    String? redirectUrl,
    String? returnTo,
  })  : _appCustomURL = appCustomURL,
        _redirectUrl = redirectUrl,
        _returnTo = returnTo {
    if ((redirectUrl == null) != (returnTo == null)) {
      throw ArgumentError(
        'Set both redirectUrl and returnTo when using the intermediary HTTPS callback.',
      );
    }
    _auth0 = Auth0(domain, clientId);
  }

  bool get isAuthenticated => _credentials != null;
  UserProfile? get user => _credentials?.user;

  /// Restore credentials saved from a previous session, if still valid.
  /// There's no refresh-token renewal here — an expired or unreadable
  /// record is dropped, leaving the user to log in again.
  Future<void> restoreSession() async {
    final stored = await _storage.read(key: _credentialsKey);
    if (stored == null) return;
    try {
      final credentials = Credentials.fromMap(jsonDecode(stored));
      if (credentials.expiresAt.isAfter(DateTime.now())) {
        _credentials = credentials;
      } else {
        await _storage.delete(key: _credentialsKey);
      }
    } catch (_) {
      // Malformed or outdated schema from a previous app version.
      await _storage.delete(key: _credentialsKey);
    }
  }

  /// Launch Web Auth via the system browser and persist the result.
  /// No credentials are stored automatically on Windows.
  Future<void> login() async {
    final webAuth = _auth0.windowsWebAuthentication();
    if (_redirectUrl == null) {
      _credentials = await webAuth.login(
        appCustomURL: _appCustomURL,
        scopes: {'openid', 'profile', 'email', 'offline_access'},
      );
    } else {
      _credentials = await webAuth.login(
        appCustomURL: _appCustomURL,
        redirectUrl: _redirectUrl!,
        scopes: {'openid', 'profile', 'email', 'offline_access'},
      );
    }
    await _storage.write(
      key: _credentialsKey,
      value: jsonEncode(_credentials!.toMap()),
    );
  }

  /// Clear the browser session and drop persisted + in-memory credentials.
  /// Local state is cleared even if the remote logout call fails, so the
  /// app never gets stuck showing an authenticated screen with a stale
  /// persisted record; the error is rethrown for the caller to surface.
  Future<void> logout() async {
    try {
      final webAuth = _auth0.windowsWebAuthentication();
      if (_returnTo == null) {
        await webAuth.logout(appCustomURL: _appCustomURL);
      } else {
        await webAuth.logout(
          appCustomURL: _appCustomURL,
          returnTo: _returnTo!,
        );
      }
    } finally {
      _credentials = null;
      await _storage.delete(key: _credentialsKey);
    }
  }
}
```

> **Note:** `login()` requests the `offline_access` scope, so the persisted
> `Credentials` can contain a refresh token — store it with
> `flutter_secure_storage` (DPAPI-backed on Windows), never with
> `shared_preferences`, which is plaintext on disk.

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:auth0_flutter/auth0_flutter.dart'; // for WebAuthenticationException
import 'auth_service.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _authService = AuthService(
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    appCustomURL: 'com.example.app://callback',
    // For Option B, also set:
    // redirectUrl: 'https://your-app.example.com/callback',
    // returnTo: 'https://your-app.example.com/logout',
  );
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    _authService.restoreSession().then((_) {
      setState(() => _restoring = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: _restoring
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _authService.isAuthenticated
              ? HomeScreen(authService: _authService, onChanged: _refresh)
              : LoginScreen(authService: _authService, onChanged: _refresh),
    );
  }

  void _refresh() => setState(() {});
}

class LoginScreen extends StatelessWidget {
  final AuthService authService;
  final VoidCallback onChanged;
  const LoginScreen({super.key, required this.authService, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ElevatedButton(
          onPressed: () async {
            final messenger = ScaffoldMessenger.of(context);
            try {
              await authService.login();
              onChanged();
            } on WebAuthenticationException catch (e) {
              messenger.showSnackBar(
                SnackBar(content: Text('Login failed: ${e.message}')),
              );
            }
          },
          child: const Text('Log In'),
        ),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  final AuthService authService;
  final VoidCallback onChanged;
  const HomeScreen({super.key, required this.authService, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final user = authService.user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              try {
                await authService.logout();
              } on WebAuthenticationException catch (e) {
                messenger.showSnackBar(
                  SnackBar(content: Text('Logout error: ${e.message}')),
                );
              } finally {
                // Local credentials are always cleared by logout(), so
                // refresh to LoginScreen even if the remote call failed.
                onChanged();
              }
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Center(child: Text('Welcome, ${user?.name ?? 'User'}!')),
    );
  }
}
```

### Step 8 — Verify Build

```bash
flutter build windows --debug
flutter run -d windows
```

If the build fails, review error messages and fix up to 5 times before
asking the user. Common failures at this step are usually a missing vcpkg
toolchain line (Step 4) or missing vcpkg packages (Step 3).

## Callback URL Configuration

| Pattern | `appCustomURL` | `redirectUrl` (login) / `returnTo` (logout) | Allowed Callback/Logout URL registered in Dashboard |
|---|---|---|---|
| Option A — direct | required, e.g. `myapp://callback` | omit | `myapp://callback` |
| Option B — intermediary server | required | required, e.g. `https://your-app.example.com/callback` | the HTTPS URL |

`appCustomURL` is always required — it's the scheme the app listens on and,
in Option A, doubles as the `redirect_uri`/`returnTo` value automatically.

Minimal intermediary-server implementation (Node.js/Express) for Option B —
validate `state` against the value stored when the auth request was initiated
before forwarding, since this endpoint is an open-redirect target otherwise:

```javascript
app.get('/callback', (req, res) => {
  const { code, state, error, error_description } = req.query;
  const expectedState = pendingStates.get(state); // stored when the login request started
  if (!state || !expectedState) {
    return res.status(400).send('Invalid or missing state');
  }
  pendingStates.delete(state);
  if (error) {
    res.redirect(`myapp://callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description)}`);
  } else {
    res.redirect(`myapp://callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  }
});
```

## Security Considerations

- Custom URL schemes are vulnerable to app-impersonation: another app could
  register the same scheme on the same device. PKCE is enabled automatically
  by the SDK and is the primary mitigation — no extra configuration needed.
- In Option B, validate `state` on the intermediary server before
  redirecting onward; the SDK also validates `state` client-side as part of
  PKCE, but server-side validation is defense-in-depth against open-redirect
  abuse of that endpoint.
- The named pipe used for single-instance URI forwarding (Step 6) must
  restrict its DACL to the current user — an unrestricted pipe lets any
  local process inject an arbitrary startup URL.

## Done When

- [ ] `auth0_flutter` added to `pubspec.yaml` (version pinned, Windows GA v2.1.0+)
- [ ] vcpkg installed with `cpp-httplib`, `nlohmann-json`, `openssl` for `x64-windows`
- [ ] `windows/CMakeLists.txt` sets `CMAKE_TOOLCHAIN_FILE` before `project()`
- [ ] Custom URL scheme registered in the Windows Registry (or installer/MSIX manifest)
- [ ] `windows/runner/main.cpp` updated with the mutex + named-pipe + startup-URI logic, adapted from the SDK's example runner
- [ ] Callback/logout URLs registered in the Auth0 Dashboard matching the chosen pattern (A or B)
- [ ] `AuthService` calls `windowsWebAuthentication().login()` / `.logout()` with `appCustomURL`
- [ ] Returned `Credentials` are persisted manually (no `CredentialsManager` on Windows)
- [ ] `flutter build windows` succeeds
- [ ] Login → redirect → callback → app foregrounded → credentials received tested end-to-end

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `login()` always times out with `USER_CANCELLED` | The runner isn't forwarding the callback URI — verify `windows/runner/main.cpp` has the mutex/pipe/`PLUGIN_STARTUP_URL` integration from Step 6 |
| Build fails with `Could not find a package configuration file provided by "httplib"` | `CMAKE_TOOLCHAIN_FILE` was set after `project()` in `windows/CMakeLists.txt`, or vcpkg packages weren't installed — redo Steps 3–4 |
| Assuming `credentialsManager` exists on Windows | It doesn't — Windows has no `CredentialsManager`; store and restore `Credentials` manually |
| Using `webAuthentication()` instead of `windowsWebAuthentication()` | Windows requires the Windows-specific API, which also requires `appCustomURL` |
| Scheme registered in the Registry doesn't match `appCustomURL` in Dart, or the Dashboard callback URL | All three (Registry scheme, `appCustomURL`, Dashboard Allowed Callback/Logout URLs) must use the exact same scheme string |
| Using Option B without validating `state` server-side | The intermediary endpoint becomes an open redirect — validate `state` before forwarding to the custom scheme |
| Hand-writing the pipe/mutex C++ logic instead of copying the example | The DACL and prefix-validation details are security-sensitive; adapt the SDK's example runner rather than reimplementing from memory |

## Related capabilities

- Same SDK on iOS/Android — ask for the Auth0 Flutter native integration
- Same SDK on the web platform — ask for the Auth0 Flutter web integration
- .NET desktop apps (not Flutter) — ask for the Auth0 WPF, WinForms, or MAUI integration
- Initial Auth0 setup and account creation — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## Quick Reference

| API | Purpose |
|-----|---------|
| `Auth0(domain, clientId)` | Create the SDK client |
| `auth0.windowsWebAuthentication().login(appCustomURL: ..., redirectUrl: ...)` | Launch Universal Login in the system browser (Windows) |
| `auth0.windowsWebAuthentication().logout(appCustomURL: ..., returnTo: ...)` | Clear the browser session (Windows) |
| `PLUGIN_STARTUP_URL` | Environment variable the runner uses to hand the callback URI to the plugin |

## References

- [auth0_flutter on pub.dev](https://pub.dev/packages/auth0_flutter)
- [auth0_flutter GitHub](https://github.com/auth0/auth0-flutter)
- [Example Windows runner (main.cpp)](https://github.com/auth0/auth0-flutter/blob/main/auth0_flutter/example/windows/runner/main.cpp)
- [Flutter Windows Quickstart](https://auth0.com/docs/quickstart/native/flutter-windows)
- [Auth0 Dashboard](https://manage.auth0.com)
