# API Reference & Testing

Complete API reference for react-native-auth0 in Expo applications.

---

## Auth0Provider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `domain` | `string` | Yes | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `clientId` | `string` | Yes | Auth0 application Client ID |
| `headers` | `Record<string, string>` | No | Custom headers included in all API requests |
| `localAuthenticationOptions` | `LocalAuthenticationOptions` | No | Biometric authentication config |
| `maxRetries` | `number` | No | Credential renewal retry count (iOS only, default: 0) |
| `useDPoP` | `boolean` | No | Enable DPoP token binding (default: true in v5.x) |
| `useMrrt` | `boolean` | No | Enable Multi-Resource Refresh Tokens (web only) |

---

## useAuth0() Hook

Returns authentication state and methods:

| Property | Type | Description |
|----------|------|-------------|
| `user` | `Auth0User \| null` | Authenticated user profile |
| `isLoading` | `boolean` | `true` until auth state is determined |
| `error` | `Error \| null` | Authentication error, if any |
| `authorize` | `(options?, authOptions?) => Promise<Credentials>` | Initiate login |
| `clearSession` | `(options?) => Promise<void>` | Logout and clear session |
| `getCredentials` | `(scope?, minTtl?, parameters?, forceRefresh?) => Promise<Credentials>` | Get stored tokens |
| `hasValidCredentials` | `(minTtl?) => Promise<boolean>` | Check for valid stored credentials |
| `getDPoPHeaders` | `(options) => Promise<Record<string, string>>` | Generate DPoP proof headers |
| `getApiCredentials` | `(audience, scope?) => Promise<ApiCredentials>` | Get tokens for specific API (MRRT) |
| `clearApiCredentials` | `(audience, scope?) => Promise<void>` | Clear cached API tokens |
| `getSSOCredentials` | `() => Promise<SSOCredentials>` | Get session transfer token |
| `customTokenExchange` | `(options) => Promise<Credentials>` | Exchange external token for Auth0 tokens |

---

## authorize() Options

### First argument (AuthorizeOptions):

| Option | Type | Description |
|--------|------|-------------|
| `scope` | `string` | OAuth scopes (default: `openid profile email`) |
| `audience` | `string` | API identifier for access token audience |
| `connection` | `string` | Force specific identity provider |
| `organization` | `string` | Organization ID for B2B login |
| `invitationUrl` | `string` | Organization invitation URL |
| `prompt` | `string` | `login` (force re-auth), `consent`, `none` |
| `screen_hint` | `string` | `signup` to show signup page |
| `max_age` | `number` | Max auth age in seconds before re-auth |
| `additionalParameters` | `Record<string, string>` | Additional query parameters |

### Second argument (WebAuthOptions):

| Option | Type | Description |
|--------|------|-------------|
| `customScheme` | `string` | **Required for Expo** — matches `app.json` plugin `customScheme` |
| `ephemeralSession` | `boolean` | Skip SSO consent dialog (iOS only) |
| `safariViewControllerPresentationStyle` | `number` | iOS Safari presentation style |
| `leeway` | `number` | Clock skew tolerance in seconds for ID token validation |

---

## clearSession() Options

| Option | Type | Description |
|--------|------|-------------|
| `customScheme` | `string` | **Required for Expo** — must match authorize's customScheme |
| `federated` | `boolean` | Also log out from identity provider |

---

## Credentials Object

Returned by `authorize()` and `getCredentials()`:

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | Access token for API calls |
| `idToken` | `string` | ID token (JWT) with user claims |
| `refreshToken` | `string \| undefined` | Refresh token (requires `offline_access` scope) |
| `tokenType` | `string` | `DPoP` or `Bearer` |
| `expiresAt` | `number` | Token expiration timestamp |
| `scope` | `string` | Granted scopes |

---

## Auth0User Object

Available via `useAuth0().user`:

| Field | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Auth0 user ID (e.g., `auth0\|123`) |
| `name` | `string` | Full name |
| `email` | `string` | Email address |
| `email_verified` | `boolean` | Whether email is verified |
| `picture` | `string` | Profile picture URL |
| `nickname` | `string` | Nickname |
| `given_name` | `string` | First name |
| `family_name` | `string` | Last name |
| `updated_at` | `string` | Last profile update |

---

## Auth0 Class (Non-Hook API)

For use outside React components or with class components:

```tsx
import Auth0 from 'react-native-auth0';

const auth0 = new Auth0({
  domain: 'YOUR_AUTH0_DOMAIN',
  clientId: 'YOUR_AUTH0_CLIENT_ID',
});

// Login
const credentials = await auth0.webAuth.authorize(
  { scope: 'openid profile email' },
  { customScheme: 'yourappscheme' }
);

// Logout
await auth0.webAuth.clearSession({}, { customScheme: 'yourappscheme' });

// Check credentials
const hasValid = await auth0.credentialsManager.hasValidCredentials();

// Get credentials (auto-refreshes if expired)
const creds = await auth0.credentialsManager.getCredentials();

// User info
const userInfo = await auth0.auth.userInfo({ token: creds.accessToken });
```

---

## LocalAuthenticationOptions

| Property | Type | Platform | Description |
|----------|------|----------|-------------|
| `title` | `string` | Both | Authentication prompt title |
| `subtitle` | `string` | Android | Prompt subtitle |
| `description` | `string` | Android | Prompt description |
| `cancelTitle` | `string` | Both | Cancel button title |
| `evaluationPolicy` | `LocalAuthenticationStrategy` | iOS | `deviceOwnerWithBiometrics` (default) or `deviceOwner` |
| `fallbackTitle` | `string` | iOS | Fallback button title |
| `authenticationLevel` | `LocalAuthenticationLevel` | Android | `strong` (default) or `weak` |
| `deviceCredentialFallback` | `boolean` | Android | Allow PIN/pattern fallback (default: false) |
| `biometricPolicy` | `BiometricPolicy` | Both | `default`, `always`, `session`, or `appLifecycle` |
| `biometricTimeout` | `number` | Both | Session timeout in seconds (for `session`/`appLifecycle`) |

---

## Testing Checklist

### iOS Testing

1. Run: `npx expo run:ios`
2. Tap "Login" — Safari/ASWebAuthenticationSession opens Auth0 Universal Login
3. Complete authentication
4. App receives callback via custom scheme and shows user profile
5. Tap "Logout" — session cleared, login screen shows
6. Force-close and reopen app — check `getCredentials()` restores session

### Android Testing

1. Run: `npx expo run:android`
2. Tap "Login" — Chrome Custom Tabs opens Auth0 Universal Login
3. Complete authentication
4. App receives callback via intent filter and shows user profile
5. Tap "Logout" — session cleared
6. Check deep link handling: `adb shell am start -a android.intent.action.VIEW -d "yourappscheme://YOUR_DOMAIN/android/yourappscheme/callback"`

### Token Refresh Testing

1. Login with `offline_access` scope
2. Wait for access token expiration (or mock short TTL)
3. Call `getCredentials()` — should silently refresh
4. Verify new access token is returned

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "a0.session.user_cancelled" | User closed the browser — handle gracefully, not as error |
| "a0.browser_not_available" | No browser app installed — show instructions to user |
| "PKCE not allowed" | Set application type to **Native** in Auth0 Dashboard |
| "Invalid state" | Clear app data and retry. Check callback URLs match exactly |
| Login works but logout doesn't redirect | Ensure logout URLs are configured in Auth0 Dashboard |
| Token refresh fails silently | Include `offline_access` in scope during initial login |
| iOS SSO alert appears every login | Use `ephemeralSession: true` to skip, or accept SSO behavior |

---

## Security Considerations

- **PKCE** — Enabled by default. Never disable for mobile apps.
- **Secure storage** — Credentials stored in Keychain (iOS) and encrypted SharedPreferences (Android) automatically.
- **No client secret** — Native apps are public clients. Never include `clientSecret` in mobile code.
- **HTTPS callbacks** — Use App Links / Universal Links in production instead of custom schemes.
- **Token validation** — Validate tokens on your backend, not in client code.
- **DPoP** — Enabled by default in v5.x for proof-of-possession tokens. Use `getDPoPHeaders()` for API calls.
- **Refresh tokens** — Request `offline_access` scope and handle `RENEW_FAILED` errors by re-authenticating.

---

## References

- [Auth0 Expo Quickstart](https://auth0.com/docs/quickstart/native/react-native-expo/interactive)
- [SDK API Documentation](https://auth0.github.io/react-native-auth0/)
- [SDK GitHub Repository](https://github.com/auth0/react-native-auth0)
- [Expo Sample App](https://github.com/auth0-samples/auth0-react-native-sample/tree/master/00-Login-Expo)
