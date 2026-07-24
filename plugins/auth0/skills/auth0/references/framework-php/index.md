# Auth0 PHP Web App — reference hub

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

## Quick start

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

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-php/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For tenant setup variants (automated CLI provisioning, manual setup), and advanced framework patterns (protected routes, calling external APIs, session management, organizations, error handling, Slim): `Read: references/framework-php/integrate.md`
- Full API / configuration lookup (SdkConfiguration, Auth0 class methods, credentials, session storage, exceptions): `Read: references/framework-php/api-reference.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-php/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
