# Integration Guide — Auth0 Flutter Windows Desktop

Common authentication patterns and code examples for the `auth0_flutter` Windows Desktop integration.

---

## Basic Login and Logout

### Simple login (recommended)

The simplest setup: `appCustomURL` is used as both the custom scheme listener and the `redirect_uri` sent to Auth0.

```dart
import 'package:auth0_flutter/auth0_flutter.dart';

final auth0 = Auth0('YOUR_TENANT.auth0.com', 'YOUR_CLIENT_ID');

// Login — opens system browser for Universal Login
try {
  final credentials = await auth0.windowsWebAuthentication().login(
    appCustomURL: 'myapp://callback',
  );

  // Store credentials manually (no auto-storage on Windows)
  final accessToken = credentials.accessToken;
  final user = credentials.user;
  print('Logged in as: ${user.name}');
} on WebAuthenticationException catch (e) {
  print('Login failed: ${e.code} — ${e.message}');
}
```

### Login with intermediary HTTPS server

For a cleaner browser experience (no blank tab after redirect), route the callback through an HTTPS server you control. Auth0 redirects to the HTTPS URL; your server redirects onward to the custom scheme.

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  redirectUrl: 'https://your-app.example.com/callback',
);
```

Register `https://your-app.example.com/callback` (not `myapp://callback`) in Auth0 Dashboard → Allowed Callback URLs.

### Logout

```dart
// Simple logout — appCustomURL used as returnTo
await auth0.windowsWebAuthentication().logout(
  appCustomURL: 'myapp://callback',
);

// With intermediary HTTPS server
await auth0.windowsWebAuthentication().logout(
  appCustomURL: 'myapp://callback',
  returnTo: 'https://your-app.example.com/logout',
);
```

---

## Credential Storage

Windows does not have a `CredentialsManager`. You must store credentials yourself after `login()`.

### Using shared_preferences

```bash
flutter pub add shared_preferences
```

```dart
import 'package:shared_preferences/shared_preferences.dart';

// Store after login
Future<void> storeCredentials(Credentials credentials) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('access_token', credentials.accessToken);
  await prefs.setString('id_token', credentials.idToken ?? '');
  await prefs.setString('expires_at', credentials.expiresAt.toIso8601String());
}

// Retrieve at startup
Future<String?> getStoredAccessToken() async {
  final prefs = await SharedPreferences.getInstance();
  final expiresAtStr = prefs.getString('expires_at');
  if (expiresAtStr == null) return null;

  final expiresAt = DateTime.parse(expiresAtStr);
  if (DateTime.now().isAfter(expiresAt)) {
    // Token expired — need to re-authenticate
    await clearCredentials();
    return null;
  }
  return prefs.getString('access_token');
}

// Clear on logout
Future<void> clearCredentials() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('access_token');
  await prefs.remove('id_token');
  await prefs.remove('expires_at');
}
```

> **Note:** `shared_preferences` stores data in plaintext on Windows. For production apps handling sensitive tokens, consider using `flutter_secure_storage` instead.

---

## Accessing User Information

User profile claims are decoded from the ID token at login time and available in `credentials.user`:

```dart
final user = credentials.user;

print(user.sub);        // Auth0 user ID (always present)
print(user.name);       // Full name
print(user.email);      // Email address
print(user.picture);    // Profile picture URL
print(user.nickname);   // Nickname
print(user.updatedAt);  // Last profile update
```

Standard OIDC claims in `UserProfile`:

| Property | Type | Scope required |
|----------|------|----------------|
| `sub` | `String` | `openid` (always) |
| `name` | `String?` | `profile` |
| `givenName` | `String?` | `profile` |
| `familyName` | `String?` | `profile` |
| `nickname` | `String?` | `profile` |
| `picture` | `String?` | `profile` |
| `email` | `String?` | `email` |
| `emailVerified` | `bool?` | `email` |
| `updatedAt` | `DateTime?` | `profile` |

---

## Requesting an API Access Token

To call a protected backend API, pass your API identifier as `audience`:

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  audience: 'https://api.example.com',
  scopes: {'openid', 'profile', 'email', 'offline_access', 'read:data'},
);

// Use in API calls
final response = await http.get(
  Uri.parse('https://api.example.com/data'),
  headers: {'Authorization': 'Bearer ${credentials.accessToken}'},
);
```

---

## Custom Scopes

Default scopes are `openid`, `profile`, `email`, `offline_access`. `openid` is always added regardless:

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  scopes: {'openid', 'profile', 'email', 'offline_access', 'read:todos'},
);
```

---

## Customizing Authentication Timeout

The default timeout for waiting for the OAuth callback is 3 minutes. Override with `authTimeout`:

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  authTimeout: const Duration(minutes: 5),
);
```

---

## Organizations

### Log in to a specific organization

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  organizationId: 'org_abc123',
);
```

### Accept an organization invitation

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  invitationUrl: 'https://your-tenant.auth0.com/login?invitation=...',
);
```

---

## Custom Parameters

Pass arbitrary parameters to Auth0 Rules or Actions:

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  parameters: {
    'screen_hint': 'signup',  // Show signup page directly
    'ui_locales': 'fr',       // Set UI locale
  },
);
```

---

## ID Token Validation

Customize how the ID token is validated (defaults are adequate for most apps):

```dart
final credentials = await auth0.windowsWebAuthentication().login(
  appCustomURL: 'myapp://callback',
  idTokenValidationConfig: const IdTokenValidationConfig(
    leeway: 60,          // Clock skew tolerance in seconds (default: 60)
    maxAge: 3600,        // Maximum age of ID token in seconds
    nonce: 'custom_nonce', // Custom nonce (auto-generated if omitted)
  ),
);
```

---

## Error Handling

```dart
try {
  final credentials = await auth0.windowsWebAuthentication().login(
    appCustomURL: 'myapp://callback',
  );
  // success
} on WebAuthenticationException catch (e) {
  switch (e.code) {
    case 'USER_CANCELLED':
      // User dismissed the browser or login timed out
      print('Login was cancelled or timed out');
      break;
    case 'invalid_request':
      // Bad OAuth request parameters
      print('Invalid request: ${e.message}');
      break;
    case 'access_denied':
      // User denied access
      print('Access denied: ${e.message}');
      break;
    default:
      print('Authentication error: ${e.code} — ${e.message}');
  }
}
```

### Common error codes

| Code | Cause |
|------|-------|
| `USER_CANCELLED` | Browser closed, login page dismissed, or 3-minute timeout reached |
| `access_denied` | User denied the authorization request |
| `invalid_request` | Malformed authorization request (bad scope, audience, etc.) |
| `callback_url_mismatch` | Callback URL not registered in Auth0 Dashboard |

---

## Complete Flutter Widget Example

```dart
import 'package:flutter/material.dart';
import 'package:auth0_flutter/auth0_flutter.dart';
import 'auth0_config.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _auth0 = Auth0(auth0Domain, auth0ClientId);
  Credentials? _credentials;
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final credentials = await _auth0.windowsWebAuthentication().login(
        appCustomURL: '$auth0CustomScheme://callback',
      );
      setState(() { _credentials = credentials; });
    } on WebAuthenticationException catch (e) {
      setState(() { _error = '${e.code}: ${e.message}'; });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _logout() async {
    setState(() { _loading = true; });
    try {
      await _auth0.windowsWebAuthentication().logout(
        appCustomURL: '$auth0CustomScheme://callback',
      );
      setState(() { _credentials = null; });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Auth0 Flutter Windows')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_credentials != null) ...[
              Text('Logged in as: ${_credentials!.user.name ?? _credentials!.user.email}'),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: _loading ? null : _logout,
                child: const Text('Log out'),
              ),
            ] else ...[
              ElevatedButton(
                onPressed: _loading ? null : _login,
                child: const Text('Log in with Auth0'),
              ),
            ],
            if (_loading) const CircularProgressIndicator(),
            if (_error != null) Text('Error: $_error', style: const TextStyle(color: Colors.red)),
          ],
        ),
      ),
    );
  }
}
```
