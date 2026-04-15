# API Reference — Auth0 Flutter Windows Desktop

Complete reference for the `auth0_flutter` Windows Desktop API.

---

## Auth0 Class

### Constructor

```dart
Auth0(String domain, String clientId, {
  LocalAuthentication? localAuthentication,       // Not used on Windows
  CredentialsManager? credentialsManager,         // Not used on Windows
  CredentialsManagerConfiguration? credentialsManagerConfiguration, // Not used on Windows
  bool useDPoP = false,                           // Not supported on Windows
})
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | `String` | Auth0 tenant domain (e.g. `your-tenant.auth0.com`) — no `https://` prefix |
| `clientId` | `String` | Auth0 application Client ID |

### windowsWebAuthentication()

Returns a `WindowsWebAuthentication` instance.

```dart
WindowsWebAuthentication windowsWebAuthentication()
```

> Use this method on Windows Desktop. Do **not** use `webAuthentication()` on Windows — that method is for Android/iOS/macOS.

---

## WindowsWebAuthentication Class

### login()

Redirects the user to the Auth0 Universal Login page and returns credentials on success.

```dart
Future<Credentials> login({
  required String appCustomURL,
  String? audience,
  Set<String> scopes = const {'openid', 'profile', 'email', 'offline_access'},
  String? redirectUrl,
  String? organizationId,
  String? invitationUrl,
  Map<String, String> parameters = const {},
  IdTokenValidationConfig idTokenValidationConfig = const IdTokenValidationConfig(),
  Duration authTimeout = const Duration(minutes: 3),
})
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `appCustomURL` | `String` | **Yes** | — | Custom scheme URL the app listens on (e.g. `myapp://callback`). Used as `redirect_uri` when `redirectUrl` is not specified. Must be registered in the Windows Registry as a protocol handler. |
| `audience` | `String?` | No | `null` | API identifier for requesting an access token scoped to a specific resource server |
| `scopes` | `Set<String>` | No | `{'openid', 'profile', 'email', 'offline_access'}` | OAuth scopes. `openid` is always included regardless of this value. |
| `redirectUrl` | `String?` | No | `null` | When using an intermediary HTTPS server: the URL Auth0 redirects to. The server then redirects to `appCustomURL`. Must be in Auth0 Dashboard Allowed Callback URLs. |
| `organizationId` | `String?` | No | `null` | Organization ID for multi-tenant login (e.g. `org_abc123`) |
| `invitationUrl` | `String?` | No | `null` | Organization invitation URL |
| `parameters` | `Map<String, String>` | No | `{}` | Arbitrary parameters passed to Auth0 Rules/Actions (e.g. `{'screen_hint': 'signup'}`) |
| `idTokenValidationConfig` | `IdTokenValidationConfig` | No | default | ID token validation options — see below |
| `authTimeout` | `Duration` | No | `Duration(minutes: 3)` | Maximum time to wait for the OAuth callback before returning `USER_CANCELLED` |

**Throws:** `WebAuthenticationException`

### logout()

Redirects the user to the Auth0 logout endpoint to clear the session cookie.

```dart
Future<void> logout({
  required String appCustomURL,
  String? returnTo,
  bool federated = false,
})
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `appCustomURL` | `String` | **Yes** | — | Custom scheme URL the app listens on. Used as `returnTo` when `returnTo` is not specified. Must be registered in Auth0 Dashboard Allowed Logout URLs. |
| `returnTo` | `String?` | No | `null` | When using an intermediary HTTPS server: the URL Auth0 redirects to after logout. The server then redirects to `appCustomURL`. |
| `federated` | `bool` | No | `false` | When `true`, also logs out from the identity provider (e.g. Google) |

**Throws:** `WebAuthenticationException`

---

## IdTokenValidationConfig

Configures how the OIDC ID token is validated after login.

```dart
const IdTokenValidationConfig({
  int leeway = 60,       // Clock skew tolerance in seconds
  int? maxAge,           // Maximum age of ID token in seconds
  String? nonce,         // Custom nonce (auto-generated if omitted)
})
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `leeway` | `int` | `60` | Seconds of clock skew to allow when validating `iat`, `exp`, `nbf` |
| `maxAge` | `int?` | `null` | Maximum seconds since authentication. Validated via `auth_time` claim. |
| `nonce` | `String?` | auto | Custom nonce. Auto-generated if omitted. Only needed for advanced flows. |

---

## Credentials

Returned by `login()`. Contains the authenticated user's tokens and profile.

```dart
class Credentials {
  final String accessToken;       // OAuth 2.0 access token
  final String? idToken;          // OIDC ID token (JWT)
  final String? refreshToken;     // Refresh token (if offline_access scope was requested)
  final String tokenType;         // Always "Bearer"
  final DateTime expiresAt;       // Access token expiry
  final Set<String> scopes;       // Granted OAuth scopes
  final UserProfile user;         // User profile decoded from ID token
}
```

---

## UserProfile

Decoded from the ID token claims at login time.

```dart
class UserProfile {
  final String sub;               // Auth0 user ID (always present)
  final String? name;             // Full name
  final String? givenName;        // First name
  final String? familyName;       // Last name
  final String? middleName;       // Middle name
  final String? nickname;         // Nickname
  final String? preferredUsername; // Preferred username
  final String? picture;          // Profile picture URL
  final String? website;          // Website URL
  final String? email;            // Email address
  final bool? emailVerified;      // Whether email is verified
  final String? gender;           // Gender
  final String? birthdate;        // Birthdate (YYYY-MM-DD)
  final String? zoneinfo;         // Timezone (e.g. "America/New_York")
  final String? locale;           // Locale (e.g. "en-US")
  final String? phoneNumber;      // Phone number
  final bool? phoneNumberVerified; // Whether phone is verified
  final DateTime? updatedAt;      // Profile last updated
  final Map<String, dynamic> customClaims; // Any extra claims from Actions/Rules
}
```

---

## WebAuthenticationException

Thrown by `login()` and `logout()` on authentication errors.

```dart
class WebAuthenticationException implements Exception {
  final String code;      // OAuth error code or SDK error code
  final String message;   // Human-readable description
}
```

### Error codes

| Code | Description | Common cause |
|------|-------------|--------------|
| `USER_CANCELLED` | User closed browser or timeout reached | Browser dismissed, 3-minute timeout exceeded, or `main.cpp` not updated |
| `access_denied` | User denied authorization | User clicked "Cancel" on consent screen |
| `invalid_request` | Malformed authorization request | Bad scope, audience, or redirect_uri |
| `callback_url_mismatch` | Redirect URI not in Allowed Callback URLs | Missing URL in Auth0 Dashboard |
| `too_many_requests` | Rate limit exceeded | Too many login attempts |

---

## Platform Configuration

### Auth0 Dashboard settings

| Setting | Value | Notes |
|---------|-------|-------|
| Application Type | **Native** | Required — not SPA or Regular Web |
| Allowed Callback URLs | `myapp://callback` | Must match `appCustomURL` (or `redirectUrl` if using HTTPS intermediary) |
| Allowed Logout URLs | `myapp://callback` | Must match `appCustomURL` (or `returnTo` if using HTTPS intermediary) |
| JWT Signature Algorithm | RS256 | Default — do not change |
| OIDC Conformant | Enabled | Default — do not change |
| Client Secret | Not used | Native apps use PKCE, no secret needed |

### Fixed callback URI

The Windows plugin defaults to `auth0flutter://callback` as the custom scheme if the developer uses the exact scheme `auth0flutter`. However, you choose your own scheme via `appCustomURL`. Common choices:

- `myapp://callback` — Simple custom scheme
- `com.example.myapp://callback` — Reverse-domain format
- `auth0flutter://callback` — Matches the plugin default prefix guard

All of these must be registered in:
1. Windows Registry (protocol handler)
2. Auth0 Dashboard Allowed Callback / Logout URLs

---

## Environment Variable

The Windows plugin uses `PLUGIN_STARTUP_URL` to pass the OAuth callback URL from the runner to the plugin:

| Variable | Set by | Read by | Value |
|----------|--------|---------|-------|
| `PLUGIN_STARTUP_URL` | `windows/runner/main.cpp` | `auth0_flutter` Windows plugin (C++) | The full callback URL (e.g. `myapp://callback?code=abc&state=xyz`) |

The plugin polls this variable during `login()` until the callback arrives or the timeout is reached.

---

## vcpkg Dependencies

The Windows plugin requires these native libraries (fetched automatically via `vcpkg.json`):

| Library | Version | Purpose |
|---------|---------|---------|
| `cpprestsdk` | Latest | HTTP client and async task management (`pplx::task`) |
| `openssl` | Latest | TLS + RS256 JWT signature validation |
| `boost-system` | Latest | Boost.System error codes (cpprestsdk dependency) |
| `boost-date-time` | Latest | Date/time parsing for token expiry |
| `boost-regex` | Latest | Regex support (cpprestsdk dependency) |

---

## Security Notes

- PKCE (`S256` code challenge method) is used automatically — no additional configuration required
- The named pipe server (in `main.cpp`) restricts access to the current user's SID via a DACL
- Only URLs beginning with `kCallbackPrefix` are accepted from the pipe and written to `PLUGIN_STARTUP_URL`
- No `ClientSecret` is used or stored (Native app type)
- Tokens are never written to disk by the plugin — credential storage is the developer's responsibility

---

## Testing Checklist

- [ ] `flutter build windows` completes without errors
- [ ] Protocol handler registered: opening `myapp://callback` from browser activates the app
- [ ] Login flow: browser opens Auth0 Universal Login page
- [ ] Successful login returns `Credentials` with non-empty `accessToken`
- [ ] `credentials.user` contains expected profile fields
- [ ] Login timeout: closing the browser window returns `WebAuthenticationException(code: 'USER_CANCELLED')`
- [ ] Logout flow: browser opens Auth0 logout page, session cookie cleared
- [ ] Multiple login/logout cycles work without errors
- [ ] Second app instance (from protocol callback) forwards URI to first instance and exits
- [ ] Credentials stored and retrieved correctly across app restarts
