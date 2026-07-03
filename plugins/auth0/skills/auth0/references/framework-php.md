
# Auth0 PHP Web App Integration

Add login, logout, and user profile to a PHP web application using `auth0/auth0-php`.

## Prerequisites

- PHP 8.2+ with extensions: `mbstring`, `openssl`, `json`
- Composer installed
- Auth0 Regular Web Application configured (not an API - must be an Application)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **PHP APIs with JWT Bearer validation** - Use the Auth0 PHP API integration workflow for stateless API token validation
- **Laravel applications** - Use a dedicated Laravel integration with `auth0/laravel-auth0`
- **Symfony applications** - Use a dedicated Symfony integration with `auth0/symfony`
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Node.js web apps** - Use the Auth0 integration workflow for Express or Fastify for session-based auth

## Quick Start Workflow

### 1. Install SDK

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7
```

- `auth0/auth0-php` - The Auth0 SDK
- `vlucas/phpdotenv` - Load `.env` files into `$_ENV`
- `guzzlehttp/guzzle` + `guzzlehttp/psr7` - PSR-18 HTTP client required by the SDK

### 2. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_COOKIE_SECRET=your_generated_secret
AUTH0_REDIRECT_URI=http://localhost:3000/callback
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` come from your Auth0 Application settings. `AUTH0_COOKIE_SECRET` is used for encrypting session cookies - generate with `openssl rand -hex 32`.

### 3. Configure Auth0 Dashboard

In your Auth0 Application settings:
- **Application Type**: Regular Web Application
- **Allowed Callback URLs**: `http://localhost:3000/callback`
- **Allowed Logout URLs**: `http://localhost:3000`

### 4. Create Auth Configuration

Create `auth0.php` to initialize the SDK:

```php
<?php

require 'vendor/autoload.php';

use Auth0\SDK\Auth0;
use Auth0\SDK\Configuration\SdkConfiguration;

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_REGULAR,
    domain: $_ENV['AUTH0_DOMAIN'],
    clientId: $_ENV['AUTH0_CLIENT_ID'],
    clientSecret: $_ENV['AUTH0_CLIENT_SECRET'],
    cookieSecret: $_ENV['AUTH0_COOKIE_SECRET'],
    redirectUri: $_ENV['AUTH0_REDIRECT_URI'],
    scope: ['openid', 'profile', 'email'],
);

$auth0 = new Auth0($configuration);
```

Create one `Auth0` instance and reuse it. Never hardcode credentials - always use environment variables.

**How this works:** The SDK encrypts session data (tokens, user profile) using AES-256-GCM with a key derived from `cookieSecret` via HKDF-SHA256. Session data is stored in an encrypted cookie by default - no server-side database required.

### 5. Create Index Page (Router)

Create `index.php` as a simple front controller. Create the `routes/` directory first:

```php
<?php

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/style.css') {
    header('Content-Type: text/css');
    readfile(__DIR__ . '/style.css');
    exit;
}

require 'auth0.php';

switch ($path) {
    case '/':
        require 'routes/home.php';
        break;
    case '/login':
        require 'routes/login.php';
        break;
    case '/callback':
        require 'routes/callback.php';
        break;
    case '/profile':
        require 'routes/profile.php';
        break;
    case '/logout':
        require 'routes/logout.php';
        break;
    default:
        http_response_code(404);
        echo 'Not found';
        break;
}
```

The static file handler for `/style.css` is placed before `require 'auth0.php'` so stylesheets load without initializing the SDK.

### 6. Add Stylesheet

Create `style.css`:

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa;
    color: #1a1a2e;
    line-height: 1.6;
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
}

.card {
    background: #fff;
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid #e8ecf0;
}

.card.center {
    text-align: center;
    padding: 60px 28px;
}

h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 4px;
}

h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 16px;
    color: #444;
}

.subtitle {
    color: #666;
    font-size: 0.95rem;
}

.card.center .subtitle {
    margin: 12px 0 28px;
}

.user-header {
    display: flex;
    align-items: center;
    gap: 16px;
}

.avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
}

.avatar-lg {
    width: 72px;
    height: 72px;
}

.nav-links {
    margin-top: 20px;
    display: flex;
    gap: 12px;
}

.top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.btn {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.15s ease;
}

.btn-primary {
    background: #635bff;
    color: #fff;
}

.btn-primary:hover {
    background: #4b44d4;
}

.btn-secondary {
    background: #f0f0f5;
    color: #444;
}

.btn-secondary:hover {
    background: #e4e4ec;
}

.btn-back {
    background: none;
    color: #635bff;
    padding: 10px 0;
}

.btn-back:hover {
    color: #4b44d4;
}

.info-table {
    width: 100%;
    border-collapse: collapse;
}

.info-table tr {
    border-bottom: 1px solid #f0f0f5;
}

.info-table tr:last-child {
    border-bottom: none;
}

.info-table td {
    padding: 10px 0;
    vertical-align: top;
}

.info-table .label {
    font-weight: 500;
    color: #666;
    width: 160px;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

.info-table .value {
    color: #1a1a2e;
    word-break: break-all;
}

.token-box {
    background: #f8f9fb;
    border: 1px solid #e8ecf0;
    border-radius: 8px;
    padding: 14px;
    font-size: 0.8rem;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    word-break: break-all;
    white-space: pre-wrap;
    max-height: 120px;
    overflow-y: auto;
    margin-bottom: 16px;
}
```

### 7. Add Home Route

Create `routes/home.php`:

```php
<?php

$credentials = $auth0->getCredentials();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auth0 PHP App</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <?php if ($credentials): ?>
            <div class="card">
                <div class="user-header">
                    <img src="<?= htmlspecialchars($credentials->user['picture'] ?? '') ?>" alt="avatar" class="avatar" />
                    <div>
                        <h1>Hello, <?= htmlspecialchars($credentials->user['name'] ?? 'User') ?>!</h1>
                        <p class="subtitle"><?= htmlspecialchars($credentials->user['email'] ?? '') ?></p>
                    </div>
                </div>
                <nav class="nav-links">
                    <a href="/profile" class="btn btn-primary">View Profile & Tokens</a>
                    <a href="/logout" class="btn btn-secondary">Logout</a>
                </nav>
            </div>
        <?php else: ?>
            <div class="card center">
                <h1>Auth0 PHP Web App</h1>
                <p class="subtitle">Session-based authentication with Auth0 SDK</p>
                <a href="/login" class="btn btn-primary">Login</a>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
```

### 8. Add Login Route

Create `routes/login.php`:

```php
<?php

header('Location: ' . $auth0->login());
exit;
```

`login()` returns a URL string pointing to Auth0's Universal Login page. You must redirect the user to it.

### 9. Add Callback Route

Create `routes/callback.php`:

```php
<?php

if (null !== $auth0->getExchangeParameters()) {
    try {
        $auth0->exchange();
        header('Location: /');
        exit;
    } catch (\Exception $e) {
        error_log('Auth0 callback error: ' . $e->getMessage());
        http_response_code(400);
        echo "Authentication failed. Please try again.";
        exit;
    }
}

header('Location: /');
exit;
```

`getExchangeParameters()` checks if the callback contains authorization code parameters. `exchange()` exchanges the code for tokens and establishes the session. Always wrap in try/catch since the token exchange can fail (e.g. expired code, CSRF mismatch).

### 10. Add Profile Route (Protected)

Create `routes/profile.php`:

```php
<?php

$credentials = $auth0->getCredentials();

if (null === $credentials) {
    header('Location: /login');
    exit;
}

$user = $credentials->user;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile - Auth0 PHP App</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="container">
        <nav class="top-nav">
            <a href="/" class="btn btn-back">&larr; Back to Home</a>
            <a href="/logout" class="btn btn-secondary">Logout</a>
        </nav>

        <div class="card">
            <div class="user-header">
                <img src="<?= htmlspecialchars($user['picture'] ?? '') ?>" alt="avatar" class="avatar avatar-lg" />
                <div>
                    <h1><?= htmlspecialchars($user['name'] ?? 'User') ?></h1>
                    <p class="subtitle"><?= htmlspecialchars($user['email'] ?? '') ?></p>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>User Profile Claims</h2>
            <table class="info-table">
                <?php foreach ($user as $key => $value): ?>
                <tr>
                    <td class="label"><?= htmlspecialchars($key) ?></td>
                    <td class="value"><?= htmlspecialchars(is_array($value) ? json_encode($value) : (string)$value) ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>

        <div class="card">
            <h2>ID Token</h2>
            <pre class="token-box"><?= htmlspecialchars($credentials->idToken ?? 'N/A') ?></pre>
        </div>

        <div class="card">
            <h2>Access Token</h2>
            <pre class="token-box"><?= htmlspecialchars($credentials->accessToken ?? 'N/A') ?></pre>
            <table class="info-table">
                <tr>
                    <td class="label">Expires</td>
                    <td class="value"><?= $credentials->accessTokenExpiration ? date('Y-m-d H:i:s', $credentials->accessTokenExpiration) . ' (' . ($credentials->accessTokenExpired ? 'EXPIRED' : 'valid') . ')' : 'N/A' ?></td>
                </tr>
                <tr>
                    <td class="label">Scopes</td>
                    <td class="value"><?= htmlspecialchars(implode(', ', $credentials->accessTokenScope ?? [])) ?></td>
                </tr>
            </table>
        </div>

        <?php if ($credentials->refreshToken): ?>
        <div class="card">
            <h2>Refresh Token</h2>
            <pre class="token-box"><?= htmlspecialchars($credentials->refreshToken) ?></pre>
        </div>
        <?php endif; ?>
    </div>
</body>
</html>
```

`getCredentials()` returns the user's session data, or `null` if not logged in. The profile page displays all user claims and tokens for verification during development.

### 11. Add Logout Route

Create `routes/logout.php`:

```php
<?php

header('Location: ' . $auth0->logout(returnUri: 'http://localhost:3000'));
exit;
```

`logout()` returns the Auth0 logout URL. Redirect the user to it. The `returnUri` is where Auth0 sends the user after logout - it must be listed in Allowed Logout URLs. In production, replace with your actual domain.

### 12. Test the App

```bash
php -S localhost:3000 index.php
```

Visit `http://localhost:3000/login` to start the login flow.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding `domain`, `clientId`, or `clientSecret` in source | Always read from environment variables - never embed credentials in code |
| Using an old `auth0-PHP` version < 8.0 | Require PHP 8.2+ and v8.x of the SDK; older versions have different APIs |
| Installing without a PSR-18 HTTP client | Must have a PSR-18 client (e.g. `guzzlehttp/guzzle`) or the SDK cannot make HTTP requests |
| Using `STRATEGY_API` for a web app | Web apps must use `SdkConfiguration::STRATEGY_REGULAR` for session-based auth |
| Passing `domain` as full URL with `https://` | `domain` should be the bare domain, e.g. `my-tenant.us.auth0.com`, not `https://my-tenant.us.auth0.com` |
| Forgetting `cookieSecret` | Required for session encryption - without it, the SDK throws a ConfigurationException |
| Not checking `getExchangeParameters()` before `exchange()` | Calling `exchange()` without parameters causes errors; always check first |
| Not handling errors in callback | `exchange()` can fail - always wrap in try/catch |
| Created app as SPA type in Auth0 | Must be Regular Web Application type for server-side auth |
| Not configuring callback URL in Auth0 Dashboard | Must add `http://localhost:3000/callback` to Allowed Callback URLs |
| Using `$_SESSION` directly | The SDK manages its own encrypted cookie session - do not use `$_SESSION` unless you configure a custom `SessionStore` |
| Deploying without `cookieSecure: true` | Must set to `true` in production - cookies are sent over HTTP otherwise |
| Calling `login()` or `logout()` without redirecting | Both return URL strings, not responses - must use `header('Location: ...')` |
| "Network error resulted in unfulfilled request" on callback | Usually means `AUTH0_CLIENT_SECRET` is wrong, not an actual network issue - verify your credentials in `.env` |

## Key SDK Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `login` | `$auth0->login(?string $redirectUrl, ?array $params): string` | Returns authorization URL string - redirect user to it |
| `exchange` | `$auth0->exchange(?string $redirectUri, ?string $code, ?string $state): bool` | Exchanges authorization code for tokens, establishes session |
| `getCredentials` | `$auth0->getCredentials(): ?object` | Returns current session credentials or `null` |
| `getExchangeParameters` | `$auth0->getExchangeParameters(): ?object` | Checks if callback contains exchange parameters |
| `logout` | `$auth0->logout(?string $returnUri, ?array $params): string` | Returns Auth0 logout URL string |
| `renew` | `$auth0->renew(?array $params): self` | Refreshes expired access token (requires `offline_access` scope) |
| `clear` | `$auth0->clear(bool $transient = true): self` | Clears local session without Auth0 logout |

## Credentials Object

After successful authentication, `getCredentials()` returns an object with:

```php
$credentials = $auth0->getCredentials();

$credentials->user;                    // array - user profile claims
$credentials->idToken;                 // string - raw ID token
$credentials->accessToken;             // string - access token
$credentials->refreshToken;            // string|null - refresh token (requires offline_access)
$credentials->accessTokenExpiration;   // int - expiration timestamp
$credentials->accessTokenExpired;      // bool - whether token is expired
$credentials->accessTokenScope;        // array - granted scopes
```

**User profile claims** (`$credentials->user`):
- `sub` - unique user identifier
- `name`, `nickname`, `picture`
- `email`, `email_verified`
- `given_name`, `family_name`
- `updated_at`, `locale`

## Related Capabilities

- Protecting PHP APIs with JWT Bearer token validation → ask for the Auth0 PHP API integration workflow
- Auth0 setup and framework detection → set up Auth0 with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)
- Multi-factor authentication → ask for MFA (feature:mfa)

## Quick Reference

**SdkConfiguration for web apps:**
```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_REGULAR,        // required
    domain: $_ENV['AUTH0_DOMAIN'],                        // required
    clientId: $_ENV['AUTH0_CLIENT_ID'],                   // required
    clientSecret: $_ENV['AUTH0_CLIENT_SECRET'],           // required
    cookieSecret: $_ENV['AUTH0_COOKIE_SECRET'],           // required
    redirectUri: $_ENV['AUTH0_REDIRECT_URI'],             // required
    scope: ['openid', 'profile', 'email'],               // recommended
);
```

**Route protection pattern:**
```php
$credentials = $auth0->getCredentials();
if (null === $credentials) {
    header('Location: /login');
    exit;
}
```

**Environment variables:**
- `AUTH0_DOMAIN` - your Auth0 tenant domain (e.g. `tenant.us.auth0.com`)
- `AUTH0_CLIENT_ID` - your Application's client ID
- `AUTH0_CLIENT_SECRET` - your Application's client secret
- `AUTH0_COOKIE_SECRET` - encryption secret key (generate: `openssl rand -hex 32`)
- `AUTH0_REDIRECT_URI` - callback URL (e.g. `http://localhost:3000/callback`)

## References

- [auth0/auth0-php on Packagist](https://packagist.org/packages/auth0/auth0-php)
- [auth0/auth0-PHP on GitHub](https://github.com/auth0/auth0-PHP)
- [Auth0 PHP Web App Quickstart](https://auth0.com/docs/quickstart/webapp/php)
- [PHP Documentation](https://www.php.net/)

---

# Auth0 PHP API Reference

Complete API reference for the `auth0/auth0-php` SDK in web application (stateful) mode.

---

## SdkConfiguration

### Constructor Parameters

```php
use Auth0\SDK\Configuration\SdkConfiguration;

$configuration = new SdkConfiguration(
    // Strategy
    strategy: SdkConfiguration::STRATEGY_REGULAR,  // 'webapp' - required for web apps

    // Required
    domain: 'tenant.us.auth0.com',
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    cookieSecret: 'generated_32_byte_hex',
    redirectUri: 'http://localhost:3000/callback',

    // Scopes
    scope: ['openid', 'profile', 'email'],

    // Cookie settings
    cookieExpires: 0,            // 0 = session cookie; seconds for persistent
    cookieSecure: false,         // true in production (requires HTTPS)
    cookieSameSite: 'lax',       // 'lax', 'strict', or 'none'
    cookieDomain: null,          // auto-detected; set for cross-subdomain
    cookiePath: '/',             // cookie path scope

    // Session storage
    sessionStorage: null,        // null = CookieStore (default)
    transientStorage: null,      // null = CookieStore (default)
    sessionStorageId: 'auth0_session',  // namespace prefix

    // Token settings
    tokenAlgorithm: 'RS256',     // 'RS256' (recommended) or 'HS256'
    tokenMaxAge: null,           // max age in seconds
    tokenLeeway: 60,             // clock skew tolerance in seconds
    tokenCache: null,            // PSR-6 CacheItemPoolInterface

    // Persistence
    persistUser: true,
    persistIdToken: true,
    persistAccessToken: true,
    persistRefreshToken: true,

    // OIDC
    usePkce: true,               // PKCE enabled by default
    responseMode: 'query',       // 'query' or 'form_post'
    responseType: 'code',        // authorization code flow

    // Optional
    audience: [],                // API identifiers
    organization: [],            // organization IDs or names
    queryUserInfo: false,        // query /userinfo endpoint
);
```

### Strategy Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `STRATEGY_REGULAR` | `'webapp'` | Stateful web app with sessions |
| `STRATEGY_API` | `'api'` | Stateless API token validation |
| `STRATEGY_MANAGEMENT_API` | `'management'` | Management API client |
| `STRATEGY_NONE` | `'none'` | No default behavior |

---

## Auth0 Class

### Constructor

```php
use Auth0\SDK\Auth0;

$auth0 = new Auth0($configuration);
```

### Authentication Methods

#### login()

Initiates the login flow. Returns the authorization URL to redirect the user to.

```php
$url = $auth0->login(
    ?string $redirectUrl = null,  // override redirectUri for this request
    ?array $params = null         // additional authorization parameters
); // returns string
```

**Parameters for `$params`:**
- `prompt` - `'login'`, `'none'`, `'consent'`, `'select_account'`
- `screen_hint` - `'signup'` to show registration form
- `connection` - force a specific connection (e.g. `'google-oauth2'`)
- `organization` - organization ID for B2B
- `invitation` - invitation ticket for org invites
- `login_hint` - pre-fill email on login form
- `max_age` - max authentication age in seconds

**Example:**
```php
header('Location: ' . $auth0->login(params: ['prompt' => 'login']));
exit;
```

#### signup()

Shortcut for login with `screen_hint=signup`:

```php
$url = $auth0->signup(
    ?string $redirectUrl = null,
    ?array $params = null
); // returns string
```

#### exchange()

Completes the authentication flow by exchanging the authorization code for tokens.

```php
$success = $auth0->exchange(
    ?string $redirectUri = null,  // override redirectUri
    ?string $code = null,         // authorization code (auto-detected from $_GET)
    ?string $state = null         // state parameter (auto-detected from $_GET)
); // returns bool
```

**Returns:** `true` on success.

**Throws:**
- `StateException` - invalid state, missing code, PKCE error
- `NetworkException` - cannot reach Auth0

#### getExchangeParameters()

Checks whether the current request contains authorization code parameters (code + state).

```php
$params = $auth0->getExchangeParameters();
```

**Returns:** Object with `code` and `state` properties, or `null` if not a callback request.

#### logout()

Clears the local session and returns the Auth0 logout URL.

```php
$url = $auth0->logout(
    ?string $returnUri = null,  // where Auth0 redirects after logout
    ?array $params = null       // additional parameters
); // returns string
```

**Example:**
```php
header('Location: ' . $auth0->logout(returnUri: 'http://localhost:3000'));
exit;
```

#### clear()

Clears the local session without redirecting to Auth0 (no federated logout).

```php
$auth0->clear(bool $transient = true); // returns self
```

#### renew()

Refreshes the access token using the stored refresh token. Requires `offline_access` scope.

```php
$auth0->renew(?array $params = null); // returns self
```

**Throws:** Exception if no refresh token is available or refresh fails.

---

### Session Methods

#### getCredentials()

Returns the current session data, or `null` if not authenticated.

```php
$credentials = $auth0->getCredentials();
```

**Returns object with:**

| Property | Type | Description |
|----------|------|-------------|
| `user` | `array` | User profile claims from ID token |
| `idToken` | `string` | Raw ID token JWT |
| `accessToken` | `string` | Access token |
| `refreshToken` | `string\|null` | Refresh token (if `offline_access` scope) |
| `accessTokenExpiration` | `int` | Unix timestamp when access token expires |
| `accessTokenExpired` | `bool` | Whether the access token has expired |
| `accessTokenScope` | `array` | Array of granted scope strings |

#### isAuthenticated()

Convenience check for whether a session exists.

```php
$isAuth = $auth0->isAuthenticated(); // returns bool
```

#### getUser()

Returns user profile array or null.

```php
$user = $auth0->getUser();
```

#### getAccessToken()

Returns access token string or null.

```php
$token = $auth0->getAccessToken();
```

#### getIdToken()

Returns ID token string or null.

```php
$token = $auth0->getIdToken();
```

#### getRefreshToken()

Returns refresh token string or null.

```php
$token = $auth0->getRefreshToken();
```

---

## User Profile Claims

Standard OpenID Connect claims available in `$credentials->user`:

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Unique user identifier (e.g. `auth0\|abc123`) |
| `name` | string | Full name |
| `nickname` | string | Casual name |
| `picture` | string | Profile picture URL |
| `email` | string | Email address |
| `email_verified` | bool | Whether email is verified |
| `given_name` | string | First name |
| `family_name` | string | Last name |
| `locale` | string | User locale |
| `updated_at` | string | Last profile update (ISO 8601) |
| `org_id` | string | Organization ID (if using organizations) |

---

## Session Storage

### CookieStore (Default)

Stores encrypted session data in HTTP cookies. No server-side state.

- **Encryption:** AES-256-GCM
- **Key derivation:** HKDF-SHA256 from `cookieSecret`
- **Max size:** ~4KB (browser cookie limit)
- **Tradeoff:** Stateless but limited by cookie size

### SessionStore

Uses PHP's native `$_SESSION` for server-side storage.

```php
use Auth0\SDK\Store\SessionStore;

$configuration = new SdkConfiguration(
    // ... required params
    sessionStorage: new SessionStore(),
    transientStorage: new SessionStore(),
);
```

**Requirements:**
- `session_start()` must be called before Auth0 initialization
- Shared session backend (Redis, Memcache) for load-balanced environments

### Custom Store

Implement `Auth0\SDK\Contract\StoreInterface`:

```php
use Auth0\SDK\Contract\StoreInterface;

class RedisStore implements StoreInterface
{
    public function set(string $key, mixed $value): void { /* ... */ }
    public function get(string $key, mixed $default = null): mixed { /* ... */ }
    public function delete(string $key): void { /* ... */ }
    public function purge(): void { /* ... */ }
    public function defer(int $seconds): void { /* ... */ }
}
```

---

## Exception Types

| Exception | When Thrown |
|-----------|------------|
| `Auth0\SDK\Exception\ConfigurationException` | Missing required configuration parameters |
| `Auth0\SDK\Exception\StateException` | Invalid state, missing code, PKCE errors during exchange |
| `Auth0\SDK\Exception\NetworkException` | HTTP request to Auth0 failed |
| `Auth0\SDK\Exception\InvalidTokenException` | Token signature or claims validation failed |
| `Auth0\SDK\Exception\ArgumentException` | Invalid arguments passed to methods |

---

## PSR Compatibility

The SDK uses PSR auto-discovery (`psr-discovery/all`):

| PSR | Purpose | Common Implementation |
|-----|---------|----------------------|
| PSR-18 | HTTP Client | `guzzlehttp/guzzle` |
| PSR-17 | HTTP Factories | `guzzlehttp/psr7` |
| PSR-7 | HTTP Messages | `guzzlehttp/psr7` |
| PSR-6 | Caching (optional) | `symfony/cache` |
| PSR-14 | Events (optional) | `symfony/event-dispatcher` |

---

## Token Validation

The SDK validates tokens automatically during `exchange()`. Claims checked:

- `iss` (issuer) - must match `https://{domain}/`
- `aud` (audience) - must match `clientId` (or configured audience)
- `exp` (expiration) - must not be expired (with `tokenLeeway`)
- `iat` (issued at) - must be reasonable
- `nonce` - must match stored nonce (CSRF protection)
- Signature - verified against JWKS endpoint (`https://{domain}/.well-known/jwks.json`)

JWKS keys are cached using PSR-6 if a `tokenCache` is provided.

---

---

# Auth0 PHP Integration Patterns

Server-side authentication patterns for PHP web applications.

---

## Protected Routes

### Single Route Protection

```php
<?php
require 'auth0.php';

$credentials = $auth0->getCredentials();
if (null === $credentials) {
    header('Location: /login');
    exit;
}

// User is authenticated - proceed with route logic
$user = $credentials->user;
echo "Welcome, " . htmlspecialchars($user['name']);
```

### Reusable Auth Guard

Create a helper function for route protection:

```php
<?php
// helpers.php

function requireAuth(Auth0\SDK\Auth0 $auth0): object
{
    $credentials = $auth0->getCredentials();
    if (null === $credentials) {
        header('Location: /login');
        exit;
    }
    return $credentials;
}
```

Use it in any route:

```php
<?php
require 'auth0.php';
require 'helpers.php';

$credentials = requireAuth($auth0);
$user = $credentials->user;
```

### Optional Authentication

Check auth status without requiring it:

```php
<?php
require 'auth0.php';

$credentials = $auth0->getCredentials();

if ($credentials) {
    echo "Hello, " . htmlspecialchars($credentials->user['name']) . "! ";
    echo "<a href='/logout'>Logout</a>";
} else {
    echo "Welcome, guest! <a href='/login'>Login</a>";
}
```

---

## Calling External APIs

### Get Access Token for API Calls

Configure an audience to receive an access token for your API:

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_REGULAR,
    domain: $_ENV['AUTH0_DOMAIN'],
    clientId: $_ENV['AUTH0_CLIENT_ID'],
    clientSecret: $_ENV['AUTH0_CLIENT_SECRET'],
    cookieSecret: $_ENV['AUTH0_COOKIE_SECRET'],
    redirectUri: $_ENV['AUTH0_REDIRECT_URI'],
    audience: [$_ENV['AUTH0_AUDIENCE']],
    scope: ['openid', 'profile', 'email', 'read:data'],
);
```

Then use the access token:

```php
<?php
$credentials = $auth0->getCredentials();
if (null === $credentials) {
    header('Location: /login');
    exit;
}

$accessToken = $credentials->accessToken;

$ch = curl_init('https://your-api.example.com/data');
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
$data = json_decode($response, true);
curl_close($ch);
```

### Token Refresh

If the access token is expired, refresh it (requires `offline_access` scope):

```php
$configuration = new SdkConfiguration(
    // ... other config
    scope: ['openid', 'profile', 'email', 'offline_access'],
);

// Later, when making API calls:
$credentials = $auth0->getCredentials();

if (null === $credentials) {
    header('Location: /login');
    exit;
}

if ($credentials->accessTokenExpired) {
    try {
        $auth0->renew();
        $credentials = $auth0->getCredentials();
    } catch (\Exception $e) {
        // Refresh token expired or revoked - re-authenticate
        header('Location: /login');
        exit;
    }
}

$accessToken = $credentials->accessToken;
```

---

## Session Management

### Session Lifecycle

The SDK manages sessions automatically using encrypted cookies:

1. **Login** - Creates encrypted session cookie after `exchange()`
2. **Requests** - `getCredentials()` decrypts and returns session data
3. **Refresh** - `renew()` refreshes tokens without re-authentication
4. **Logout** - `logout()` clears session and redirects to Auth0

### Clear Local Session

Clear the local session without redirecting to Auth0 logout:

```php
$auth0->clear();
header('Location: /');
exit;
```

### Cookie Configuration for Production

```php
$configuration = new SdkConfiguration(
    // ... required params
    cookieSecure: true,        // HTTPS only (required for production)
    cookieSameSite: 'lax',     // Prevent CSRF (default)
    cookieDomain: '.myapp.com', // Share across subdomains
    cookieExpires: 86400,      // 24 hours (0 = session cookie)
    cookiePath: '/',           // Available on all paths
);
```

### Server-Side Sessions (Alternative)

For high-traffic apps or when cookie size is a concern, use PHP's native sessions:

```php
use Auth0\SDK\Store\SessionStore;

$configuration = new SdkConfiguration(
    // ... required params
    sessionStorage: new SessionStore(),
    transientStorage: new SessionStore(),
);
```

**Note:** When using `SessionStore`, you must call `session_start()` before creating the `Auth0` instance. For load-balanced environments, configure a shared session backend (Redis, Memcached).

---

## Custom Login Parameters

### Force Login Prompt

```php
header('Location: ' . $auth0->login(params: ['prompt' => 'login']));
exit;
```

### Signup Instead of Login

```php
header('Location: ' . $auth0->login(params: ['screen_hint' => 'signup']));
exit;
```

### Specify Connection

```php
header('Location: ' . $auth0->login(params: ['connection' => 'google-oauth2']));
exit;
```

### Custom Return URL

```php
header('Location: ' . $auth0->login(redirectUrl: 'http://localhost:3000/dashboard'));
exit;
```

---

## Organization Support

For B2B multi-tenant applications:

```php
$configuration = new SdkConfiguration(
    // ... required params
    organization: ['org_abc123'],
);

// Or prompt for organization at login:
header('Location: ' . $auth0->login(params: ['organization' => 'org_abc123']));
exit;
```

After login, check the organization claim:

```php
$credentials = $auth0->getCredentials();
$orgId = $credentials->user['org_id'] ?? null;
```

---

## Error Handling

### Callback Errors

```php
<?php
// routes/callback.php

if (null !== $auth0->getExchangeParameters()) {
    try {
        $auth0->exchange();
        header('Location: /');
        exit;
    } catch (\Auth0\SDK\Exception\StateException $e) {
        // Invalid state, PKCE error, or expired authorization code
        http_response_code(400);
        echo "Login failed: invalid state. Please try again.";
        echo " <a href='/login'>Retry Login</a>";
        exit;
    } catch (\Auth0\SDK\Exception\NetworkException $e) {
        // Network error calling Auth0
        http_response_code(502);
        echo "Unable to reach authentication server. Please try again.";
        exit;
    } catch (\Exception $e) {
        error_log('Auth0 callback error: ' . $e->getMessage());
        http_response_code(400);
        echo "Authentication failed. Please try again.";
        exit;
    }
}
```

### Token Expiration

```php
$credentials = $auth0->getCredentials();
if ($credentials && $credentials->accessTokenExpired) {
    try {
        $auth0->renew();
    } catch (\Exception $e) {
        $auth0->clear();
        header('Location: /login');
        exit;
    }
}
```

---

## Using with PHP Frameworks (Non-Laravel/Symfony)

### Slim Framework

```php
<?php
use Slim\Factory\AppFactory;

require 'vendor/autoload.php';
require 'auth0.php';

$app = AppFactory::create();

$app->get('/', function ($request, $response) use ($auth0) {
    $credentials = $auth0->getCredentials();
    $body = $credentials
        ? "Hello, " . htmlspecialchars($credentials->user['name'])
        : "<a href='/login'>Login</a>";
    $response->getBody()->write($body);
    return $response;
});

$app->get('/login', function ($request, $response) use ($auth0) {
    return $response->withHeader('Location', $auth0->login())->withStatus(302);
});

$app->get('/callback', function ($request, $response) use ($auth0) {
    if (null !== $auth0->getExchangeParameters()) {
        $auth0->exchange();
    }
    return $response->withHeader('Location', '/')->withStatus(302);
});

$app->get('/logout', function ($request, $response) use ($auth0) {
    return $response->withHeader('Location', $auth0->logout(returnUri: 'http://localhost:3000'))->withStatus(302);
});

$app->run();
```

---

## Security Considerations

- **Keep secrets secure** - Never commit `.env` to version control
- **Use HTTPS in production** - Set `cookieSecure: true`
- **Rotate cookie secret** - Update `AUTH0_COOKIE_SECRET` periodically
- **PKCE is enabled by default** - Do not disable it
- **Validate on server** - Authentication is server-side, tokens are encrypted in cookies
- **Set appropriate cookie expiration** - Use `cookieExpires` for session timeout
- **Always use `htmlspecialchars()`** when outputting user data to prevent XSS

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "No PSR-18 client discovered" | Install `guzzlehttp/guzzle` |
| "Invalid state" on callback | Regenerate `AUTH0_COOKIE_SECRET`; ensure cookies are not blocked |
| Session not persisting across requests | Check that `cookieDomain` and `cookiePath` are correct |
| "Configuration error: cookieSecret required" | Ensure `.env` is loaded before `SdkConfiguration` is created |
| Cookie too large | Switch to `SessionStore` for server-side sessions |
| Token expired errors | Add `offline_access` scope and call `renew()` |

---

---

# Auth0 PHP Setup Guide

Setup instructions for PHP web applications.

---

## Quick Setup (Automated)

Below automates the setup, except for the CLIENT_SECRET. Inform the user that they have to fill in the value for the CLIENT_SECRET themselves.

**Never read the contents of `.env.local` or `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so - do not proceed until the user confirms.

**Before running any part of this setup that writes to an env file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing env files and confirm with user

Before writing credentials, check which env files exist:

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

Then determine the target file using this precedence: `.env.local` (if present), otherwise `.env`. Ask the user for explicit confirmation before proceeding - do not continue until the user confirms:

- If the target file (`.env.local` or `.env`) exists, ask:
  - Question: "A `<target file>` already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing `<target file>`" / "No, I'll update it manually"

- If neither file exists, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_COOKIE_SECRET, AUTH0_REDIRECT_URI) and a placeholder for AUTH0_CLIENT_SECRET. Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

**Do not proceed with writing to any env file unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  else
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Verify jq is available (used to parse JSON from Auth0 CLI)
if ! command -v jq &> /dev/null; then
  echo "jq is required but not installed. Install it: https://jqlang.github.io/jq/download/" >&2
  exit 1
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-php" --type regular \
    --callbacks "http://localhost:3000/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | jq -r '.client_id')
fi

# Get credentials
APP_JSON=$(auth0 apps show "$APP_ID" --json)
DOMAIN=$(printf '%s' "$APP_JSON" | jq -r '.domain')
CLIENT_ID=$(printf '%s' "$APP_JSON" | jq -r '.client_id')
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ] || [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ]; then
  echo "Failed to resolve Auth0 app credentials from CLI output" >&2
  exit 1
fi
COOKIE_SECRET=$(openssl rand -hex 32)

# Determine target env file
if [ -f .env.local ]; then
  TARGET_FILE=".env.local"
elif [ -f .env ]; then
  TARGET_FILE=".env"
else
  TARGET_FILE=".env"
fi

# Append Auth0 credentials
cat >> "$TARGET_FILE" << ENVEOF

# Auth0 Configuration
AUTH0_DOMAIN=$DOMAIN
AUTH0_CLIENT_ID=$CLIENT_ID
AUTH0_CLIENT_SECRET='YOUR_CLIENT_SECRET'
AUTH0_COOKIE_SECRET=$COOKIE_SECRET
AUTH0_REDIRECT_URI=http://localhost:3000/callback
ENVEOF

echo "Auth0 credentials written to $TARGET_FILE"
```

After the script runs, remind the user to:
1. Open the env file that was written and replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0.
2. Ensure the env file is listed in `.gitignore` to avoid accidentally committing secrets.

---

## Manual Setup

### Install Packages

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7
```

**Package breakdown:**
- `auth0/auth0-php` - The Auth0 SDK
- `vlucas/phpdotenv` - Load `.env` files
- `guzzlehttp/guzzle` - PSR-18 HTTP client (required by the SDK)
- `guzzlehttp/psr7` - PSR-7 HTTP messages (required by the SDK)

### Create .env

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_COOKIE_SECRET=<openssl-rand-hex-32>
AUTH0_REDIRECT_URI=http://localhost:3000/callback
```

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Applications > Your App > Settings, copy Domain, Client ID, Client Secret

---

## PHP Version Requirements

- PHP 8.2 or higher
- Required extensions: `mbstring`, `openssl`, `json`
- Verify with: `php -v && php -m | grep -E "mbstring|openssl|json"`

---

## PSR Dependencies

The SDK uses PSR auto-discovery (`psr-discovery/all`) to find compatible HTTP implementations. If you install `guzzlehttp/guzzle`, it satisfies all PSR requirements automatically.

If you prefer a different HTTP client:
- **Symfony HTTP Client**: `composer require symfony/http-client nyholm/psr7`
- **PHP-HTTP Curl**: `composer require php-http/curl-client nyholm/psr7`

---

## Troubleshooting

**"No PSR-18 HTTP Client found":** Install `guzzlehttp/guzzle` or another PSR-18 compatible client.

**"Invalid state" error:** Regenerate `AUTH0_COOKIE_SECRET` with `openssl rand -hex 32`

**"Client secret required":** Ensure you created a Regular Web Application (not SPA) in Auth0.

**Callback URL mismatch:** Add `http://localhost:3000/callback` to Allowed Callback URLs in Auth0 Dashboard.

**Cookie not persisting:** Ensure `cookieSecure` is `false` for local development (HTTP). Set to `true` only in production with HTTPS.

---
