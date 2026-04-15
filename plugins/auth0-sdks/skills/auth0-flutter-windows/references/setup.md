# Setup Guide — Auth0 Flutter Windows Desktop

Step-by-step setup for adding Auth0 authentication to a Flutter Windows Desktop application.

---

## 1. Auth0 Configuration

### Automatic Setup (Bootstrap Script)

> **Skip this section** if Auth0 credentials (domain + client ID) are already provided. Write `lib/auth0_config.dart` directly and proceed to section 2.

The bootstrap script handles all Auth0 configuration automatically. It requires the Auth0 CLI and Node.js 20+.

**Pre-flight checks:**

```bash
# Verify Node.js 20+
node --version

# Verify Auth0 CLI
auth0 --version --no-input

# Verify active tenant
auth0 tenants list --csv --no-input
```

**Run the bootstrap:**

```bash
cd scripts && npm install && node bootstrap.mjs <path-to-flutter-project>
```

The script will:
1. Validate the Flutter project (detects `pubspec.yaml` and package name)
2. Discover existing Auth0 Native apps
3. Show a change plan (create new app or reuse existing)
4. Create the Auth0 Native application with `myapp://callback` as callback/logout URL
5. Set up a database connection
6. Write credentials to `lib/auth0_config.dart`

### Manual Setup

If you prefer to configure manually:

1. Go to [Auth0 Dashboard](https://manage.auth0.com/) → Applications → Create Application
2. Choose **Native** as the application type
3. Note your **Domain** and **Client ID**
4. Under **Application URIs**, set both **Allowed Callback URLs** and **Allowed Logout URLs** to:
   ```text
   myapp://callback
   ```
   Replace `myapp` with your chosen URL scheme. The scheme must be unique to your app.
5. Click **Save Changes**

Write credentials to `lib/auth0_config.dart`:

```dart
// lib/auth0_config.dart
const String auth0Domain = 'YOUR_TENANT.auth0.com';
const String auth0ClientId = 'YOUR_CLIENT_ID';
const String auth0CustomScheme = 'myapp';
```

> **Secret Management:** Flutter Windows Desktop uses the **Native** app type. Native apps do not use a `ClientSecret` — no secrets need to be stored. The `lib/auth0_config.dart` file only contains the domain and client ID, which are not sensitive values. It is safe to commit this file.

---

## 2. Install the SDK

```bash
flutter pub add auth0_flutter
```

This adds to `pubspec.yaml`:

```yaml
dependencies:
  auth0_flutter: ^2.1.0-beta.1
```

Run `flutter pub get` if not automatically triggered.

---

## 3. Install vcpkg and Native Dependencies

The `auth0_flutter` Windows plugin depends on native C++ libraries managed by [vcpkg](https://vcpkg.io/). These are declared in the plugin's `vcpkg.json` manifest and are fetched automatically at build time — no manual `vcpkg install` is needed.

**Install vcpkg:**

```powershell
# Clone vcpkg (if not already installed)
git clone https://github.com/microsoft/vcpkg.git C:\vcpkg
cd C:\vcpkg
.\bootstrap-vcpkg.bat

# Persist the VCPKG_ROOT environment variable
setx VCPKG_ROOT "C:\vcpkg"
```

After running `setx`, **close and reopen your terminal** for the variable to take effect.

**Verify vcpkg is found:**

```powershell
echo $env:VCPKG_ROOT
# Should print: C:\vcpkg
```

The plugin's `vcpkg.json` will automatically pull these packages at build time:
- `cpprestsdk` — HTTP client and async task library
- `openssl` — TLS + JWT signature validation
- `boost-system`, `boost-date-time`, `boost-regex` — Boost components

---

## 4. Configure windows/CMakeLists.txt

Your Flutter app's `windows/CMakeLists.txt` must set the vcpkg toolchain **before** the first `project()` call so that the plugin's C++ dependencies can be resolved.

Open `windows/CMakeLists.txt` and add the following block **before** the `project()` line:

```cmake
# windows/CMakeLists.txt

cmake_minimum_required(VERSION 3.14)

# --- Add this block BEFORE project() ---
# Set CMAKE_TOOLCHAIN_FILE to vcpkg's toolchain file.
# Replace C:/vcpkg with your actual vcpkg installation path.
# The VCPKG_ROOT system environment variable is used if set.
set(CMAKE_TOOLCHAIN_FILE "C:/vcpkg/scripts/buildsystems/vcpkg.cmake"
    CACHE STRING "Vcpkg toolchain file")
# --- End of block ---

project(your_app LANGUAGES CXX)

# ... rest of your CMakeLists.txt
```

> **Tip:** If `VCPKG_ROOT` is set as a system environment variable, you can use the CMake `$ENV{vcpkg_root}` syntax in a conditional — but the hardcoded path above is the simplest and most reliable approach during development.

> **Critical:** The `CMAKE_TOOLCHAIN_FILE` line **must** appear before `project()`. If it appears after, CMake will have already configured the compiler and vcpkg packages will not be found.

**Build error if missing:**

```text
CMake Error at ...: Could not find a package configuration file provided by "cpprestsdk"
```

---

## Update main.cpp {#update-maincpp}

Your app's `windows/runner/main.cpp` requires specific integration for the Auth0 callback flow. This is the most critical setup step — **login will always time out without it**.

The Windows OAuth callback flow works as follows:
1. The plugin opens the system browser with the Auth0 authorization URL
2. After authentication, Auth0 redirects to `myapp://callback?code=...&state=...`
3. Windows launches (or activates) your app with the URL as `argv[1]`
4. Your `main.cpp` captures `argv[1]` and writes it to `PLUGIN_STARTUP_URL`
5. The plugin polls `PLUGIN_STARTUP_URL`, finds the callback URL, and completes the flow

**Required components in main.cpp:**

1. **Single-instance mutex** — prevents a second app instance from launching when the OS activates the protocol handler; instead, the URI is forwarded to the already-running instance
2. **Named pipe server** — the running instance listens on `\\.\pipe\auth0flutter_pipe` for URIs forwarded by the second launch
3. **Startup URI capture** — on first launch, `argv[1]` is written to `PLUGIN_STARTUP_URL` before Flutter starts
4. **Security** — the named pipe uses a DACL restricting access to the current user's SID; only URIs beginning with `kCallbackPrefix` are accepted

**Copy the reference implementation:**

```text
auth0_flutter/example/windows/runner/main.cpp
```

[View on GitHub](https://github.com/auth0/auth0-flutter/blob/beta-release/v2.1.0/auth0_flutter/example/windows/runner/main.cpp)

**Update the callback prefix constant to match your scheme:**

```cpp
// Near the top of main.cpp
const wchar_t* kCallbackPrefix = L"myapp://callback";
```

The example runner also requires `plugin_startup_url_lock.h` which is included in the plugin. The include path assumes the following structure:

```cpp
#include "../../../auth0_flutter/windows/plugin_startup_url_lock.h"
```

Adjust the relative path if your project structure differs.

---

## 5. Register the Windows Protocol Handler

For Windows to route OAuth callback URLs (e.g. `myapp://callback`) to your app, the scheme must be registered as a protocol handler in the Windows Registry.

### Option A — Manual registration (development)

Create a `register_scheme.reg` file:

```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\myapp]
@="URL:myapp Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\myapp\shell]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open]

[HKEY_CURRENT_USER\Software\Classes\myapp\shell\open\command]
@="\"C:\\path\\to\\your_app.exe\" \"%1\""
```

Replace:
- `myapp` with your chosen scheme (e.g. `com.example.myapp`)
- The `@=` path with the absolute path to your debug build (e.g. `build\windows\x64\runner\Debug\your_app.exe`)

Double-click the `.reg` file to import it into the registry.

> Update the path when switching between Debug/Release or when the build location changes.

### Option B — Programmatic registration (installer / first run)

For production apps or when using an installer (MSIX, Inno Setup, WiX), register the protocol handler programmatically.

**MSIX packaging** (declare in `Package.appxmanifest`):

```xml
<Extensions>
  <uap:Extension Category="windows.protocol">
    <uap:Protocol Name="myapp">
      <uap:DisplayName>My App Callback</uap:DisplayName>
    </uap:Protocol>
  </uap:Extension>
</Extensions>
```

**First-run self-registration** (add to `wWinMain` in `main.cpp`):

```cpp
void RegisterProtocolHandler(const std::wstring& schemeName, const std::wstring& exePath) {
    HKEY hKey;
    std::wstring keyPath = L"Software\\Classes\\" + schemeName;

    RegCreateKeyExW(HKEY_CURRENT_USER, keyPath.c_str(), 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    std::wstring desc = L"URL:" + schemeName + L" Protocol";
    RegSetValueExW(hKey, NULL, 0, REG_SZ,
                   (const BYTE*)desc.c_str(), (DWORD)((desc.size() + 1) * sizeof(wchar_t)));
    RegSetValueExW(hKey, L"URL Protocol", 0, REG_SZ, (const BYTE*)L"", sizeof(wchar_t));
    RegCloseKey(hKey);

    std::wstring cmdKeyPath = keyPath + L"\\shell\\open\\command";
    RegCreateKeyExW(HKEY_CURRENT_USER, cmdKeyPath.c_str(), 0, NULL, 0, KEY_WRITE, NULL, &hKey, NULL);
    std::wstring cmd = L"\"" + exePath + L"\" \"%1\"";
    RegSetValueExW(hKey, NULL, 0, REG_SZ,
                   (const BYTE*)cmd.c_str(), (DWORD)((cmd.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(hKey);
}
```

Call this once at first launch before `StartPipeServer()`.

---

## 6. Build and Verify

```bash
flutter build windows
```

A successful build confirms that:
- vcpkg is properly configured
- Native C++ dependencies were fetched and linked
- The plugin compiled correctly

**Check the build output for the plugin binary:**

```text
build\windows\x64\runner\Debug\auth0_flutter_plugin.dll
```

If the build succeeds, test authentication. If login times out with `USER_CANCELLED`, verify the protocol handler registration and `main.cpp` integration.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Could not find cpprestsdk` | vcpkg toolchain not set or `CMAKE_TOOLCHAIN_FILE` after `project()` | Move vcpkg block before `project()` and verify `VCPKG_ROOT` |
| `vcpkg.cmake not found` | `VCPKG_ROOT` not set | Run `setx VCPKG_ROOT "C:\vcpkg"` and restart terminal |
| Login always times out | `main.cpp` not updated | Copy reference `main.cpp` and set `kCallbackPrefix` |
| Browser opens but app not activated | Protocol handler not registered | Import `.reg` file or use MSIX manifest declaration |
| Second app window opens on callback | Single-instance mutex missing | Add mutex check before Flutter bootstrap in `wWinMain` |
| `Callback URL mismatch` | URL not in Auth0 Dashboard | Add scheme (e.g. `myapp://callback`) to Allowed Callback URLs |
