# Auth0 PHP Web App Integration

Add login, logout, and user profile to a PHP web application using `auth0/auth0-php`.
> **Prerequisites & setup:** the shared prerequisites, when-NOT-to-use notes,
> and the quick start live in this group's overview (already read on the way
> here). This file holds tenant setup variants (automated CLI provisioning,
> manual setup), and advanced integration patterns (protected routes, calling
> external APIs, session management, organizations, error handling, Slim) —
> see the Setup and Integration Patterns sections below. Full
> API/configuration lookup lives in this group's API reference.

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

---

## Setup

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

## Integration Patterns

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
