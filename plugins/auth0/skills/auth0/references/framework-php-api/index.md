
# Auth0 PHP API Integration

Protect PHP API endpoints with JWT access token validation using `auth0/auth0-php` in API mode (`STRATEGY_API`).

## Critical rules

- TOKEN ISOLATION: the agent must NEVER directly see, display, echo, log, or store access token values. Do not run `auth0 test token` on its own, and do not ask the user to paste a token into the conversation.
- When testing protected endpoints, ALWAYS chain token acquisition and the `curl` call in a single `&&` command that captures the token into a shell variable and uses it immediately.
- A Client ID is REQUIRED for the M2M token flow — if M2M setup was not completed, ask the user first.
- ALWAYS read `domain` and `audience` from environment variables; never embed credentials in source.

## Prerequisites

- PHP 8.2+ with extensions: `mbstring`, `openssl`, `json`
- Composer installed
- Auth0 API resource configured (not an Application - must be an API)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **PHP web applications with login/logout flows** - use the Auth0 PHP web app integration workflow for session-based authentication
- **Laravel applications** - Use `auth0/laravel-auth0` which has built-in API guard support
- **Symfony applications** - Use `auth0/symfony` with its security bundle
- **Single Page Applications** - use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Issuing tokens** - This skill is for *validating* access tokens, not issuing them

## Quick Start Workflow

### 1. Install SDK

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7 "symfony/cache:^7.0"
```

- `auth0/auth0-php` - The Auth0 SDK (v8.x)
- `vlucas/phpdotenv` - Load `.env` files into `$_ENV`
- `guzzlehttp/guzzle` + `guzzlehttp/psr7` - PSR-18 HTTP client required by the SDK
- `symfony/cache` - PSR-6 cache for JWKS key caching (recommended for production)

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0.

> **STOP - ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 API resource?
> > 1. **Automated** - I'll run Auth0 CLI scripts that create the resource and write the exact values to your `.env` automatically.
> > 2. **Manual** - You create the API yourself in the Auth0 Dashboard (or via `auth0 apis create`) and provide me the Domain and Audience.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Setup Guide section below for complete CLI scripts. The automated path writes `.env` for you - skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the Setup Guide section below (Manual Setup) for full instructions. Then continue with Step 3 below.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My PHP API" \
  --identifier https://my-api.example.com \
  --json
```

Or create manually in Auth0 Dashboard -> Applications -> APIs

### 3. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_AUDIENCE` is the API identifier you set when creating the API resource in Auth0.

### 4. Initialize Auth0 in API Mode

Create `auth0.php` to initialize the SDK:

```php
<?php

require 'vendor/autoload.php';

use Auth0\SDK\Auth0;
use Auth0\SDK\Configuration\SdkConfiguration;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    clientId: null,
    audience: [$_ENV['AUTH0_AUDIENCE']],
    tokenAlgorithm: 'RS256',
    tokenCache: new FilesystemAdapter('auth0_jwks', 600, __DIR__ . '/var/cache'),
    tokenCacheTtl: 600,
);

$auth0 = new Auth0($configuration);
```

Key differences from web app mode:
- `STRATEGY_API` - stateless, no sessions or cookies
- `clientId` is not required for RS256 validation (only needed for HS256)
- `audience` accepts an array of allowed audience strings
- `tokenCache` is a PSR-6 `CacheItemPoolInterface` for JWKS caching

### 5. Create Middleware Function

Since the SDK does not include a built-in middleware, create a reusable guard function. Create `middleware.php`:

```php
<?php

use Auth0\SDK\Auth0;
use Auth0\SDK\Token;
use Auth0\SDK\Exception\InvalidTokenException;

function requireAuth(Auth0 $auth0, ?array $requiredScopes = null): array
{
    $token = $auth0->getBearerToken(
        server: ['HTTP_AUTHORIZATION']
    );

    if ($token === null) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'unauthorized', 'message' => 'Missing or invalid Bearer token']);
        exit;
    }

    $claims = $token->toArray();

    if ($requiredScopes !== null) {
        $grantedScopes = isset($claims['scope']) ? explode(' ', $claims['scope']) : [];
        $missingScopes = array_diff($requiredScopes, $grantedScopes);

        if (!empty($missingScopes)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'insufficient_scope', 'message' => 'Token lacks required scopes']);
            exit;
        }
    }

    return $claims;
}
```

`getBearerToken()` searches for a Bearer token at the locations you specify, verifies the signature against the JWKS endpoint, and validates claims (issuer, audience, expiration). The `server` parameter is an array of `$_SERVER` key names to check (e.g., `['HTTP_AUTHORIZATION']`) - not `$_SERVER` itself. Returns a `TokenInterface` on success or `null` if no valid token is found (does not throw).

### 6. Create API Routes

Create `index.php` as a front controller:

```php
<?php

require 'auth0.php';
require 'middleware.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

header('Content-Type: application/json');

switch ($path) {
    case '/api/public':
        echo json_encode(['message' => 'Public endpoint - no authentication required']);
        break;

    case '/api/private':
        $claims = requireAuth($auth0);
        echo json_encode(['message' => 'Private endpoint', 'sub' => $claims['sub']]);
        break;

    case '/api/private-scoped':
        $claims = requireAuth($auth0, ['read:messages']);
        echo json_encode(['messages' => [], 'sub' => $claims['sub']]);
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        break;
}
```

### 7. Access Token Claims

The decoded JWT claims are returned as an associative array:

```php
$claims = requireAuth($auth0);

$userId = $claims['sub'];       // user/client ID
$scopes = $claims['scope'];     // space-separated granted scopes
$issuer = $claims['iss'];       // issuer (your Auth0 domain URL)
$audience = $claims['aud'];     // audience (string or array)
$expiration = $claims['exp'];   // expiration timestamp
```

You can also use the `Token` object's typed accessor methods:

```php
$token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);
if ($token !== null) {
    $subject = $token->getSubject();     // returns ?string
    $issuer = $token->getIssuer();       // returns ?string
    $audience = $token->getAudience();   // returns ?array
    $expiration = $token->getExpiration(); // returns ?int
}
```

### 8. Add CORS Headers

When your API receives requests from a browser-based SPA, add CORS headers. Create `cors.php`:

```php
<?php

function handleCors(array $allowedOrigins): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Max-Age: 86400');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
```

Then add these lines at the top of `index.php`, before the existing `require 'auth0.php'` line:

```php
require 'cors.php';
handleCors(['https://spa.example.com']);
```

The updated `index.php` head should be:

```php
<?php

require 'cors.php';
handleCors(['https://spa.example.com']);

require 'auth0.php';
require 'middleware.php';

// ... rest of index.php
```

CORS must be handled before auth so that preflight `OPTIONS` requests short-circuit without triggering token validation.

### 9. Test the API

> **Agent instruction:** Start the PHP built-in server and verify the basic endpoints work without credentials:
> ```bash
> php -S localhost:8000 index.php &
> sleep 1
> curl -s http://localhost:8000/api/public
> curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/private
> ```
> - `/api/public` should return `{"message":"Public endpoint - no authentication required"}`
> - `/api/private` should return HTTP 401
>
> If both pass, the middleware is working. Kill the background server when done:
> ```bash
> kill %1 2>/dev/null
> ```
>
> **Failcheck:** If the server fails to start or `/api/public` errors, check for PHP syntax issues or missing `.env`. After 5-6 failed iterations, use `AskUserQuestion` to ask the user for more details about their environment.

> **Agent instruction: STOP - ask after basic tests pass.**
>
> Once public/401 tests pass, ask the user:
>
> > "Your API is set up and the middleware is working (public returns 200, private returns 401 without a token). Would you like me to help you set up testing with a real access token?
> > 1. **Yes** - I'll help you configure an M2M application to get test tokens.
> > 2. **No** - I'm done for now.
> >
> > Which do you prefer?"
>
> Do NOT proceed with M2M/token setup unless the user says yes. If they say no, summarize what was done and stop.

> **Agent instruction (M2M app setup - only if user wants testing):**
>
> If the user chose to set up testing, ask:
>
> > "To test your protected endpoints, you need a Machine-to-Machine (M2M) application authorized to request tokens for this API.
> > 1. **Create new** - I'll create a new M2M application and authorize it for this API.
> > 2. **Use existing** - You already have an M2M application. Provide the Client ID and I'll authorize it for this API.
> >
> > Which do you prefer? (1 = Create new / 2 = Use existing)"
>
> Do NOT proceed until the user answers. Do NOT silently pick an existing application from the tenant.
>
> **If the user chose "Create new":**
> ```bash
> auth0 apps create \
>   --name "${PWD##*/} (Test App)" \
>   --type m2m \
>   --no-input --json
> ```
> Parse the JSON with `jq` to extract `client_id`. Do NOT use `--reveal-secrets` - never expose client secrets in agent context. Instead, use only the `client_id`; the client-credentials/client-grant flow below does not require the secret in agent context.
> Then create a client grant:
> ```bash
> auth0 api post "client-grants" --data '{
>   "client_id": "<CLIENT_ID>",
>   "audience": "<API_IDENTIFIER>",
>   "scope": ["<SCOPES>"]
> }'
> ```
>
> **If the user chose "Use existing":**
> Ask for the Client ID. Then create a client grant to authorize it for this API:
> ```bash
> auth0 api post "client-grants" --data '{
>   "client_id": "<USER_PROVIDED_CLIENT_ID>",
>   "audience": "<API_IDENTIFIER>",
>   "scope": ["<SCOPES>"]
> }'
> ```
> If the grant already exists (409 conflict), that's fine - the app is already authorized.

> **Agent instruction (token isolation — critical):**
>
> The agent must never directly see or display access token values. Token security rules:
> - Do NOT run `auth0 test token` on its own - it outputs the token to stdout
> - Do NOT ask the user to paste their token into the conversation
> - Do NOT echo, print, or log the token value
> - Do NOT store the token in a file
>
> **Secure testing approach (single-command chain):**
>
> If the user explicitly asks to test the protected endpoints, use a single-command chain that captures the token into a shell variable and immediately uses it:
>
> ```bash
> php -S localhost:8000 index.php &
> sleep 1
> TEST_TOKEN=$(auth0 test token <M2M_CLIENT_ID> --audience <AUDIENCE> --scopes <SCOPE1,SCOPE2> 2>/dev/null | grep -o 'ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*') && \
> [ -n "$TEST_TOKEN" ] && echo "Token acquired (${#TEST_TOKEN} chars)" && \
> echo "=== GET /api/private ===" && \
> curl -s http://localhost:8000/api/private -H "Authorization: Bearer $TEST_TOKEN" && \
> echo "" && echo "=== GET /api/private-scoped ===" && \
> curl -s http://localhost:8000/api/private-scoped -H "Authorization: Bearer $TEST_TOKEN"
> kill %1 2>/dev/null
> ```
>
> **Rules:**
> 1. ONLY use when the user explicitly asks to test
> 2. Always chain token acquisition + curl in a SINGLE `&&` command
> 3. Do not add `echo $TEST_TOKEN` or any command that would print the raw token value
> 4. If the token acquisition fails (empty variable), report that the M2M app may not be authorized
> 5. **Client ID is required** - if M2M setup was not completed, ask the user first
>
> **If the user does NOT ask to test**, just provide the commands for them to run manually:
> ```
> auth0 test token <CLIENT_ID> --audience <AUDIENCE> --scopes <SCOPE1,SCOPE2>
> curl http://localhost:8000/api/private -H "Authorization: Bearer <PASTE_TOKEN_HERE>"
> ```

Start the server:

```bash
php -S localhost:8000 index.php
```

Test public endpoint (no token needed):

```bash
curl http://localhost:8000/api/public
```

Test protected endpoint without token (should return 401):

```bash
curl http://localhost:8000/api/private
```

Test protected endpoint with token:

```bash
curl http://localhost:8000/api/private \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Test scoped endpoint:

```bash
curl http://localhost:8000/api/private-scoped \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Get a test token via Auth0 Dashboard -> APIs -> Test tab, or via the M2M flow described above.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding `domain` or `audience` in source | Always read from environment variables - never embed credentials in code |
| Using `STRATEGY_REGULAR` for an API | API mode must use `SdkConfiguration::STRATEGY_API` - it disables sessions and cookies |
| Installing without a PSR-18 HTTP client | Must have `guzzlehttp/guzzle` or another PSR-18 client or the SDK cannot fetch JWKS |
| Not caching JWKS keys | Without a PSR-6 cache, the SDK fetches JWKS on every request - always configure `tokenCache` |
| Passing `audience` as a string | `audience` must be an array: `['https://my-api.example.com']` not `'https://my-api.example.com'` |
| Passing `domain` as full URL with `https://` | `domain` should be the bare domain, e.g. `my-tenant.us.auth0.com`, not `https://my-tenant.us.auth0.com` |
| Using `decode()` without specifying token type | Always pass `tokenType: Token::TYPE_ACCESS_TOKEN` when manually calling `decode()` |
| Echoing exception messages to users | Use `error_log()` for the real error and return a generic JSON error message |
| Using an ID token instead of an access token | Must use the **access token** for API auth - ID tokens are for the client app |
| Created an Application instead of an API in Auth0 | Must create an **API** resource (Applications -> APIs) - an Application doesn't issue access tokens with the right audience |
| Setting `clientId` and expecting RS256 to need it | For RS256, `clientId` is optional - the SDK validates against the JWKS endpoint |
| Using `clientSecret` for RS256 validation | `clientSecret` is only needed for HS256 - RS256 uses the public key from JWKS |
| Passing `$_SERVER` directly to `getBearerToken()` | The `server` param takes an array of key names to look up, e.g. `['HTTP_AUTHORIZATION']` - not `$_SERVER` itself |

## Key SDK Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `getBearerToken` | `?TokenInterface` | Searches specified `$_SERVER` keys for a Bearer token, verifies signature, validates claims. Returns `null` if no token found or validation fails (does not throw). |
| `decode` | `TokenInterface` | Manually decodes and validates a JWT string |
| `configuration` | `SdkConfiguration` | Access the SDK configuration instance |
| `Token::toArray` | `array` | Returns all token claims as an associative array |
| `Token::getSubject` | `?string` | Returns the `sub` claim (user/client ID) |
| `Token::getIssuer` | `?string` | Returns the `iss` claim |
| `Token::getAudience` | `?array` | Returns the `aud` claim |
| `Token::getExpiration` | `?int` | Returns the `exp` claim (Unix timestamp) |

## Related Skills

- PHP web apps with login/logout using session-based auth → ask for the Auth0 PHP web app integration workflow
- Basic Auth0 setup and framework detection → set up Auth0 with the CLI (`auth0 login`, then `auth0 apps create`)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)
- Add Multi-Factor Authentication → ask for MFA (feature:mfa)

## Quick Reference

**SdkConfiguration for APIs:**
```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,       // required - stateless mode
    domain: $_ENV['AUTH0_DOMAIN'],                   // required
    audience: [$_ENV['AUTH0_AUDIENCE']],             // required - array of identifiers
    tokenAlgorithm: 'RS256',                        // default
    tokenCache: $psrCacheAdapter,                    // recommended for production
    tokenCacheTtl: 600,                             // JWKS cache TTL in seconds
);
```

**Token validation:**
```php
$token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);  // returns ?TokenInterface
$claims = $token->toArray();                         // all claims as array
$userId = $token->getSubject();                      // sub claim
```

**Manual decode:**
```php
use Auth0\SDK\Token;

$token = $auth0->decode(
    $jwtString,
    tokenType: Token::TYPE_ACCESS_TOKEN,
);
```

**Environment variables:**
- `AUTH0_DOMAIN` - your Auth0 tenant domain (e.g. `tenant.us.auth0.com`)
- `AUTH0_AUDIENCE` - your API identifier (e.g. `https://api.example.com`)

**Common Use Cases:**
- Protect routes -> `requireAuth($auth0)` (see Step 5)
- Scope enforcement -> `requireAuth($auth0, ['read:messages'])` (see Step 5)
- CORS setup -> see the CORS Configuration section below
- Multi-audience validation -> see the Multi-Audience Validation section below
- Advanced configuration -> see the API Reference section below

## References

- [auth0/auth0-php on Packagist](https://packagist.org/packages/auth0/auth0-php)
- [auth0/auth0-PHP on GitHub](https://github.com/auth0/auth0-PHP)
- [Auth0 PHP API Quickstart](https://auth0.com/docs/quickstart/backend/php)
- [PHP Documentation](https://www.php.net/)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)

---

# Auth0 PHP API - API Reference

Complete reference for `auth0/auth0-php` in API mode (`STRATEGY_API`).

---

## SdkConfiguration

Configuration class for the Auth0 SDK.

```php
use Auth0\SDK\Configuration\SdkConfiguration;
```

### Constructor (API Mode)

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: 'your-tenant.us.auth0.com',
    clientId: null,
    clientSecret: null,
    audience: ['https://my-api.example.com'],
    organization: null,
    tokenAlgorithm: 'RS256',
    tokenJwksUri: null,
    tokenLeeway: 60,
    tokenCache: null,
    tokenCacheTtl: 60,
);
```

### Strategy Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `SdkConfiguration::STRATEGY_API` | `'api'` | Stateless JWT validation (no sessions) |
| `SdkConfiguration::STRATEGY_REGULAR` | `'webapp'` | Session-based web app auth |
| `SdkConfiguration::STRATEGY_MANAGEMENT_API` | `'management'` | Management API client |
| `SdkConfiguration::STRATEGY_NONE` | `'none'` | Manual configuration |

### Constructor Parameters (API Mode)

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `strategy` | `string` | `'webapp'` | Yes | Must be `SdkConfiguration::STRATEGY_API` for stateless mode |
| `domain` | `?string` | `null` | Yes | Auth0 tenant domain (e.g., `my-tenant.us.auth0.com`). No `https://` prefix. |
| `clientId` | `?string` | `null` | No* | Application Client ID. Required for HS256; optional for RS256. |
| `clientSecret` | `?string` | `null` | No* | Client Secret. Required for HS256 signature verification. |
| `audience` | `?array` | `null` | Yes | Array of allowed API identifiers. Token `aud` must intersect. |
| `organization` | `?array` | `null` | No | Array of allowed organization IDs/names for `org_id`/`org_name` validation. |
| `tokenAlgorithm` | `string` | `'RS256'` | No | Signing algorithm: `'RS256'` (asymmetric) or `'HS256'` (symmetric). |
| `tokenJwksUri` | `?string` | `null` | No | JWKS endpoint URI. Auto-set to `https://{domain}/.well-known/jwks.json` if null. |
| `tokenLeeway` | `int` | `60` | No | Clock skew tolerance in seconds for time-based claim validation (`exp`, `iat`, `auth_time`). |
| `tokenCache` | `?CacheItemPoolInterface` | `null` | No | PSR-6 cache adapter for JWKS keys. Strongly recommended for production. |
| `tokenCacheTtl` | `int` | `60` | No | JWKS cache TTL in seconds. |

### Getter Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getAudience()` | `?array` | Configured audience values |
| `getClientId()` | `?string` | Client ID |
| `getClientSecret()` | `?string` | Client Secret |
| `getDomain()` | `?string` | Raw domain string |
| `formatDomain()` | `string` | Domain with `https://` prefix and trailing slash |
| `getTokenAlgorithm()` | `string` | `'RS256'` or `'HS256'` |
| `getTokenJwksUri()` | `?string` | JWKS endpoint URI |
| `getTokenLeeway()` | `int` | Clock skew tolerance |
| `getTokenCache()` | `?CacheItemPoolInterface` | PSR-6 cache instance |
| `getTokenCacheTtl()` | `int` | Cache TTL in seconds |

---

## Auth0

Main SDK class for token operations.

```php
use Auth0\SDK\Auth0;
```

### Constructor

```php
$auth0 = new Auth0($configuration); // accepts SdkConfiguration or array
```

When passing an array, it is forwarded to the `SdkConfiguration` constructor:

```php
$auth0 = new Auth0([
    'strategy' => SdkConfiguration::STRATEGY_API,
    'domain' => $_ENV['AUTH0_DOMAIN'],
    'audience' => [$_ENV['AUTH0_AUDIENCE']],
    'tokenCache' => $cache,
]);
```

### getBearerToken

Extracts, verifies, and validates a Bearer token from the request.

```php
$token = $auth0->getBearerToken(
    ?array $get = null,
    ?array $post = null,
    ?array $server = null,
    ?array $haystack = null,
    ?array $needles = null,
); // returns ?TokenInterface
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `$get` | `?array` | `null` | Array of `$_GET` key names to check for a token (e.g., `['access_token']`) |
| `$post` | `?array` | `null` | Array of `$_POST` key names to check for a token (e.g., `['access_token']`) |
| `$server` | `?array` | `null` | Array of `$_SERVER` key names to check for a Bearer token (e.g., `['HTTP_AUTHORIZATION']`). **Not** `$_SERVER` itself. |
| `$haystack` | `?array` | `null` | Custom array to search for the token |
| `$needles` | `?array` | `null` | Custom keys to search within haystack |

**Important:** The `$server`, `$get`, and `$post` parameters are arrays of KEY NAMES to look up in the respective superglobals, not the superglobals themselves. Pass `['HTTP_AUTHORIZATION']` not `$_SERVER`.

**Token extraction priority:**
1. `Authorization: Bearer <token>` header (from `$_SERVER['HTTP_AUTHORIZATION']` when `server: ['HTTP_AUTHORIZATION']`)
2. Token value from `$_GET` keys listed in `$get`
3. Token value from `$_POST` keys listed in `$post`
4. Custom `$haystack` keys

**Returns:** `TokenInterface` on success (signature verified, claims validated), `null` on failure.

**Typical usage:**
```php
$token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);
```

### decode

Manually decodes, verifies, and validates a JWT string.

```php
$token = $auth0->decode(
    string $token,
    ?array $tokenAudience = null,
    ?array $tokenOrganization = null,
    ?string $tokenNonce = null,
    ?int $tokenMaxAge = null,
    ?int $tokenLeeway = null,
    ?int $tokenNow = null,
    ?int $tokenType = null,
); // returns TokenInterface
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `$token` | `string` | - | Raw JWT string |
| `$tokenAudience` | `?array` | `null` | Override audience validation (uses config if null) |
| `$tokenOrganization` | `?array` | `null` | Override organization validation |
| `$tokenNonce` | `?string` | `null` | Expected nonce (for ID tokens) |
| `$tokenMaxAge` | `?int` | `null` | Maximum `auth_time` age in seconds |
| `$tokenLeeway` | `?int` | `null` | Override leeway (uses config if null) |
| `$tokenNow` | `?int` | `null` | Override current time for testing |
| `$tokenType` | `?int` | `null` | Token type constant (see Token class) |

**Throws:** `InvalidTokenException` on validation failure.

**Typical usage for APIs:**
```php
use Auth0\SDK\Token;

$token = $auth0->decode($jwtString, tokenType: Token::TYPE_ACCESS_TOKEN);
```

### configuration

Returns the SDK configuration instance.

```php
$config = $auth0->configuration(); // returns SdkConfiguration
```

---

## Token (TokenInterface)

Represents a validated JWT token with typed claim accessors.

```php
use Auth0\SDK\Token;
```

### Type Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `Token::TYPE_ID_TOKEN` | `1` | ID token (contains `nonce`) |
| `Token::TYPE_ACCESS_TOKEN` | `2` | Access token (for API authorization) |
| `Token::TYPE_LOGOUT_TOKEN` | `3` | Back-channel logout token |

### Algorithm Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `Token::ALGO_RS256` | `'RS256'` | RSA-SHA256 (asymmetric, recommended) |
| `Token::ALGO_RS384` | `'RS384'` | RSA-SHA384 |
| `Token::ALGO_RS512` | `'RS512'` | RSA-SHA512 |
| `Token::ALGO_HS256` | `'HS256'` | HMAC-SHA256 (symmetric) |
| `Token::ALGO_HS384` | `'HS384'` | HMAC-SHA384 |
| `Token::ALGO_HS512` | `'HS512'` | HMAC-SHA512 |

### Claim Accessor Methods

| Method | Returns | Claim | Description |
|--------|---------|-------|-------------|
| `getSubject()` | `?string` | `sub` | User or client identifier |
| `getIssuer()` | `?string` | `iss` | Token issuer (Auth0 domain URL) |
| `getAudience()` | `?array` | `aud` | Intended audience(s) |
| `getExpiration()` | `?int` | `exp` | Expiration Unix timestamp |
| `getIssued()` | `?int` | `iat` | Issued-at Unix timestamp |
| `getAuthTime()` | `?int` | `auth_time` | Authentication time |
| `getNonce()` | `?string` | `nonce` | Token nonce (ID tokens) |
| `getOrganization()` | `?string` | `org_id` | Organization identifier |
| `getOrganizationId()` | `?string` | `org_id` | Organization ID |
| `getOrganizationName()` | `?string` | `org_name` | Organization name |
| `getAuthorizedParty()` | `?string` | `azp` | Authorized party |
| `getIdentifier()` | `?string` | `sid` | Session identifier |

### Data Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `toArray()` | `array` | All claims as associative array |
| `toJson()` | `string` | Claims as JSON string |
| `verify()` | `self` | Verify token signature (chainable) |
| `validate()` | `self` | Validate token claims (chainable) |

---

## InvalidTokenException

Thrown when token verification or validation fails.

```php
use Auth0\SDK\Exception\InvalidTokenException;
```

### Common Exception Scenarios

| Method | Message Pattern | Cause |
|--------|----------------|-------|
| `missingAudienceClaim()` | "aud claim missing" | Token has no `aud` claim |
| `mismatchedAudClaim()` | "aud mismatch" | Token `aud` doesn't match configured audience |
| `missingIssClaim()` | "iss claim missing" | Token has no `iss` claim |
| `mismatchedIssClaim()` | "iss mismatch" | Token `iss` doesn't match expected issuer |
| `missingExpClaim()` | "exp claim missing" | Token has no `exp` claim |
| `mismatchedExpClaim()` | "token expired" | Token `exp` is in the past (accounting for leeway) |
| `badSignature()` | "signature invalid" | JWT signature doesn't match |
| `missingKidHeader()` | "kid header missing" | RS256 token missing `kid` header for JWKS lookup |
| `requiresClientSecret()` | "client secret required" | HS256 validation attempted without `clientSecret` |
| `unsupportedSigningAlgorithm()` | "unsupported algorithm" | Token uses an algorithm not in supported list |

### Usage

```php
use Auth0\SDK\Exception\InvalidTokenException;

try {
    $token = $auth0->decode($jwt, tokenType: Token::TYPE_ACCESS_TOKEN);
} catch (InvalidTokenException $e) {
    error_log('Token validation failed: ' . $e->getMessage());
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'invalid_token', 'message' => 'Token validation failed']);
    exit;
}
```

---

## Token Verification Flow

When `getBearerToken()` or `decode()` is called, the SDK performs:

1. **Parse** - Splits JWT into header, payload, signature; base64-decodes each
2. **Verify** (signature) - For RS256: fetches public key from JWKS by `kid` header, verifies RSA signature. For HS256: verifies HMAC using `clientSecret`.
3. **Validate** (claims) - Checks `iss` matches `https://{domain}/`, `aud` intersects configured audience, `exp` is in the future (with leeway)

### JWKS Caching Behavior

- Cache key: Derived from the JWKS URI (`https://{domain}/.well-known/jwks.json`)
- On cache miss: HTTP GET to the JWKS endpoint
- On cache hit: Uses cached keyset directly
- Cache TTL: Controlled by `tokenCacheTtl` (default 60 seconds)
- Keys are stored as the full JWKS response (all keys)
- If the expected `kid` is not in the cached response, the cache is invalidated and JWKS is re-fetched

---

## Full Initialization Example

```php
<?php

require 'vendor/autoload.php';

use Auth0\SDK\Auth0;
use Auth0\SDK\Configuration\SdkConfiguration;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$cache = new FilesystemAdapter('auth0_jwks', 600, __DIR__ . '/var/cache');

$auth0 = new Auth0(new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    audience: [$_ENV['AUTH0_AUDIENCE']],
    tokenAlgorithm: 'RS256',
    tokenCache: $cache,
    tokenCacheTtl: 600,
    tokenLeeway: 60,
));

// Validate Bearer token
$token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);

if ($token === null) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$claims = $token->toArray();
$userId = $token->getSubject();
```

---

## References

- [auth0/auth0-PHP on GitHub](https://github.com/auth0/auth0-PHP)

---

# Auth0 PHP API Integration Patterns

Advanced integration patterns for PHP API applications using `auth0/auth0-php` in API mode.

---

## Scope-Based Authorization

### Define Permissions in Auth0

1. Go to Auth0 Dashboard -> Applications -> APIs
2. Select your API
3. Click the **Permissions** tab
4. Add permissions matching the scopes you want to enforce (e.g., `read:messages`, `write:messages`)

### Enforce Scopes in Middleware

```php
function requireAuth(Auth0 $auth0, ?array $requiredScopes = null): array
{
    $token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);

    if ($token === null) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'unauthorized', 'message' => 'Missing or invalid Bearer token']);
        exit;
    }

    $claims = $token->toArray();

    if ($requiredScopes !== null) {
        $grantedScopes = isset($claims['scope']) ? explode(' ', $claims['scope']) : [];
        $missingScopes = array_diff($requiredScopes, $grantedScopes);

        if (!empty($missingScopes)) {
            http_response_code(403);
            header('Content-Type: application/json');
            header('WWW-Authenticate: Bearer error="insufficient_scope"');
            echo json_encode(['error' => 'insufficient_scope', 'message' => 'Token lacks required scopes']);
            exit;
        }
    }

    return $claims;
}
```

### Route Examples

```php
// Requires read:messages scope
case '/api/messages':
    $claims = requireAuth($auth0, ['read:messages']);
    echo json_encode(['messages' => fetchMessages($claims['sub'])]);
    break;

// Requires both read:data and write:data (AND logic)
case '/api/data':
    if ($method === 'POST') {
        $claims = requireAuth($auth0, ['read:data', 'write:data']);
        echo json_encode(['created' => true]);
    }
    break;
```

### Request Tokens with Scopes

Clients must request tokens that include the required scopes:

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

---

## Permission-Based RBAC

Auth0 can embed RBAC permissions directly in the access token (instead of scopes). Enable this in Auth0 Dashboard -> APIs -> Settings -> "Add Permissions in the Access Token".

```php
function requirePermission(Auth0 $auth0, array $requiredPermissions): array
{
    $token = $auth0->getBearerToken(server: ['HTTP_AUTHORIZATION']);

    if ($token === null) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'unauthorized', 'message' => 'Missing or invalid Bearer token']);
        exit;
    }

    $claims = $token->toArray();
    $grantedPermissions = $claims['permissions'] ?? [];
    $missingPermissions = array_diff($requiredPermissions, $grantedPermissions);

    if (!empty($missingPermissions)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'insufficient_permissions', 'message' => 'Missing required permissions']);
        exit;
    }

    return $claims;
}
```

---

## Multi-Audience Validation

If your token may target multiple APIs, configure multiple audiences:

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    audience: [
        $_ENV['AUTH0_AUDIENCE'],
        'https://secondary-api.example.com',
    ],
    tokenCache: new FilesystemAdapter('auth0_jwks', 600, __DIR__ . '/var/cache'),
);
```

The SDK validates that the token's `aud` claim intersects with at least one of the configured audiences (ANY match succeeds).

---

## CORS Configuration

When your API receives requests from a browser-based SPA, CORS headers are required.

### Basic CORS Handler

```php
function handleCors(array $allowedOrigins): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Max-Age: 86400');
        header('Vary: Origin');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
```

Call before any other logic in `index.php`:

```php
require 'cors.php';
handleCors(['https://your-spa.example.com', 'http://localhost:3000']);

require 'auth0.php';
require 'middleware.php';
// ... routes
```

### Production CORS

- Never use `*` for `Access-Control-Allow-Origin` with credentialed requests
- Always validate the `Origin` header against an allowlist
- Include `Vary: Origin` to prevent cache poisoning

---

## Error Handling

### Structured Error Responses

```php
function apiError(int $status, string $error, string $message): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode(['error' => $error, 'message' => $message]);
    exit;
}
```

### Handling Token Validation Errors

`getBearerToken()` returns `null` when validation fails. For more granular error handling, use `decode()` directly:

```php
use Auth0\SDK\Token;
use Auth0\SDK\Exception\InvalidTokenException;

$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!str_starts_with($authHeader, 'Bearer ')) {
    apiError(401, 'unauthorized', 'Missing Bearer token');
}

$jwt = substr($authHeader, 7);

try {
    $token = $auth0->decode(
        $jwt,
        tokenType: Token::TYPE_ACCESS_TOKEN,
    );
    $claims = $token->toArray();
} catch (InvalidTokenException $e) {
    error_log('Token validation failed: ' . $e->getMessage());
    apiError(401, 'invalid_token', 'Token validation failed');
}
```

### Common Error Codes

| Status | Error Code | Cause |
|--------|------------|-------|
| 401 | `unauthorized` | Missing or malformed Authorization header |
| 401 | `invalid_token` | Expired token, invalid signature, wrong issuer/audience |
| 403 | `insufficient_scope` | Valid token but missing required scopes |
| 403 | `insufficient_permissions` | Valid token but missing required RBAC permissions |

---

## PSR-6 Cache Setup

### Filesystem Cache (Development)

```php
use Symfony\Component\Cache\Adapter\FilesystemAdapter;

$cache = new FilesystemAdapter(
    'auth0_jwks',       // namespace
    600,                // default TTL in seconds
    __DIR__ . '/var/cache'  // cache directory
);
```

### APCu Cache (Production - Single Server)

```php
use Symfony\Component\Cache\Adapter\ApcuAdapter;

$cache = new ApcuAdapter('auth0_jwks', 600);
```

Requires the `apcu` PHP extension.

### Redis Cache (Production - Multi-Server)

```php
use Symfony\Component\Cache\Adapter\RedisAdapter;

$redis = RedisAdapter::createConnection('redis://localhost:6379');
$cache = new RedisAdapter($redis, 'auth0_jwks', 600);
```

### Memcached

```php
use Symfony\Component\Cache\Adapter\MemcachedAdapter;

$memcached = MemcachedAdapter::createConnection('memcached://localhost:11211');
$cache = new MemcachedAdapter($memcached, 'auth0_jwks', 600);
```

### Using the Cache

Pass any PSR-6 `CacheItemPoolInterface` to `SdkConfiguration`:

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    audience: [$_ENV['AUTH0_AUDIENCE']],
    tokenCache: $cache,
    tokenCacheTtl: 600,
);
```

---

## Custom Claims

Access custom claims added via Auth0 Actions:

```php
$claims = requireAuth($auth0);

// Namespaced custom claims (recommended)
$role = $claims['https://example.com/role'] ?? null;
$orgId = $claims['https://example.com/org_id'] ?? null;

// RBAC permissions (if enabled on the API)
$permissions = $claims['permissions'] ?? [];
```

Auth0 Actions add custom claims using namespaced keys to avoid collisions with registered JWT claims.

---

## Organization Validation

For multi-tenant applications using Auth0 Organizations:

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    audience: [$_ENV['AUTH0_AUDIENCE']],
    organization: ['org_abc123', 'org_def456'],
    tokenCache: new FilesystemAdapter('auth0_jwks', 600, __DIR__ . '/var/cache'),
);
```

The SDK validates the `org_id` or `org_name` claim in the token against the configured allowlist.

---

## HS256 Configuration

If your API uses HS256 (symmetric signing) instead of RS256:

```php
$configuration = new SdkConfiguration(
    strategy: SdkConfiguration::STRATEGY_API,
    domain: $_ENV['AUTH0_DOMAIN'],
    clientId: $_ENV['AUTH0_CLIENT_ID'],
    clientSecret: $_ENV['AUTH0_CLIENT_SECRET'],
    audience: [$_ENV['AUTH0_AUDIENCE']],
    tokenAlgorithm: 'HS256',
);
```

HS256 uses the client secret as the signing key. No JWKS fetching or caching is needed. However, RS256 is recommended for APIs as it doesn't require sharing secrets.

---

## Testing

### Unit Tests with PHPUnit

```php
use PHPUnit\Framework\TestCase;

class ApiTest extends TestCase
{
    public function testPublicEndpoint(): void
    {
        $response = $this->request('GET', '/api/public');
        $this->assertEquals(200, $response['status']);
    }

    public function testProtectedEndpointWithoutToken(): void
    {
        $response = $this->request('GET', '/api/private');
        $this->assertEquals(401, $response['status']);
    }

    private function request(string $method, string $path, ?string $token = null): array
    {
        // Use PHP's built-in test server or a test framework
        $ch = curl_init("http://localhost:8000$path");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        if ($token !== null) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $token"]);
        }
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => json_decode($body, true)];
    }
}
```

### Integration Testing with Real Tokens

```bash
# Get a test token via Auth0 CLI
TOKEN=$(auth0 test token --audience https://my-api.example.com --no-input 2>/dev/null)

# Test protected endpoint
curl -s http://localhost:8000/api/private \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Security Considerations

- **Never hardcode Domain or Audience** - Always use environment variables or configuration files
- **Always cache JWKS keys** - Without caching, every request fetches from Auth0's JWKS endpoint
- **Use HTTPS in production** - Bearer tokens are sent in headers and must be encrypted in transit
- **Use minimal scopes** - Only request and enforce scopes your API actually needs
- **Validate access tokens, not ID tokens** - ID tokens are for the client app, access tokens are for API authorization
- **Never echo exception details** - Use `error_log()` and return generic error messages
- **Set short token expiration** - Configure access token lifetime in Auth0 Dashboard -> APIs -> Settings

---

---

# Auth0 PHP API Setup Guide

Setup instructions for PHP API applications using `auth0/auth0-php` in API mode.

---

## Quick Setup (Automated)

Below automates the setup using the Auth0 CLI.

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
  - Question: "This setup will create a `.env` file containing Auth0 credentials (AUTH0_DOMAIN, AUTH0_AUDIENCE). Do you want to proceed?"
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

# Create API resource
API_JSON=$(auth0 apis create \
  --name "${PWD##*/}-api" \
  --identifier "https://${PWD##*/}.example.com" \
  --json)

AUDIENCE=$(printf '%s' "$API_JSON" | jq -r '.identifier')
if [ -z "$AUDIENCE" ] || [ "$AUDIENCE" = "null" ]; then
  echo "Failed to resolve API identifier from CLI output" >&2
  exit 1
fi

# Get domain
DOMAIN=$(auth0 tenants list --json | jq -r '.[0].name')
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "null" ]; then
  echo "Failed to resolve Auth0 tenant domain" >&2
  exit 1
fi

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

# Auth0 API Configuration
AUTH0_DOMAIN=$DOMAIN
AUTH0_AUDIENCE=$AUDIENCE
ENVEOF

echo "Auth0 API credentials written to $TARGET_FILE"
```

---

## Manual Setup

### Install Packages

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7 "symfony/cache:^7.0"
```

**Package breakdown:**
- `auth0/auth0-php` - The Auth0 SDK (v8.x)
- `vlucas/phpdotenv` - Load `.env` files
- `guzzlehttp/guzzle` - PSR-18 HTTP client (required by the SDK for JWKS fetching)
- `guzzlehttp/psr7` - PSR-7 HTTP messages (required by the SDK)
- `symfony/cache` - PSR-6 cache adapter for JWKS key caching

### Create Auth0 API Resource

1. Go to Auth0 Dashboard -> Applications -> APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-api.example.com`)
4. Note the Identifier - this is your `Audience`

### Create .env

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain format is `your-tenant.us.auth0.com` - do NOT include `https://`.

### Get Auth0 Configuration

- **Domain:** Auth0 Dashboard -> Settings -> Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

### Using Environment Variables in Production

For production/containers, export environment variables directly:

```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_AUDIENCE=https://my-api.example.com
```

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard -> Applications -> APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI

```bash
# Get access token for testing
auth0 test token \
  --audience https://my-api.example.com
```

### Via curl (Client Credentials Flow)

First, you need a Machine-to-Machine application authorized for your API:

1. Go to Auth0 Dashboard -> Applications -> APIs -> Your API -> Machine to Machine Applications
2. Authorize an existing M2M app or create a new one
3. Note the Client ID and Client Secret

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

### Request Tokens with Specific Scopes

First, define permissions on your API resource (Dashboard -> APIs -> Permissions tab), then:

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

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

**401 Unauthorized - "invalid_token":** Verify that `AUTH0_AUDIENCE` in `.env` exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized - "invalid_issuer":** Ensure `AUTH0_DOMAIN` does not include `https://` - use `your-tenant.us.auth0.com` format only.

**"No PSR-18 HTTP Client found":** Install `guzzlehttp/guzzle` or another PSR-18 compatible client.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

**JWKS fetch fails:** Check that your server can make outbound HTTPS requests to `https://{domain}/.well-known/jwks.json`.

**"audience is required":** Ensure `audience` is passed as a non-empty array in `SdkConfiguration`.

---
