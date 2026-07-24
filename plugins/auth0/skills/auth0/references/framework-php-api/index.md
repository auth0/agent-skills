# Auth0 PHP API — reference hub

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

## Install SDK

```bash
composer require auth0/auth0-php vlucas/phpdotenv guzzlehttp/guzzle guzzlehttp/psr7 "symfony/cache:^7.0"
```

- `auth0/auth0-php` - The Auth0 SDK (v8.x)
- `vlucas/phpdotenv` - Load `.env` files into `$_ENV`
- `guzzlehttp/guzzle` + `guzzlehttp/psr7` - PSR-18 HTTP client required by the SDK
- `symfony/cache` - PSR-6 cache for JWKS key caching (recommended for production)

## Configure .env

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_AUDIENCE` is the API identifier you set when creating the API resource in Auth0.

---

## Quick start

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

**If the user chose Automated**, follow the Quick Setup (Automated) instructions in this group's integration guide for complete CLI scripts. The automated path writes `.env` for you - skip Step 3 and proceed directly to Step 4.

**If the user chose Manual**, follow the Manual Setup instructions in this group's integration guide for full instructions. Then continue with Step 3.

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
> Parse the JSON with `jq` to extract `client_id`. Do NOT use `--reveal-secrets` - never expose client secrets in agent context. Instead, use only the `client_id`; the client-credentials/client-grant flow shown next does not require the secret in agent context.
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

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-php-api/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For setup variants (automated vs. manual tenant/API/M2M provisioning, test tokens), and advanced patterns (scopes, RBAC, multi-audience, CORS, caching, custom claims, Organizations, HS256, testing): `Read: references/framework-php-api/integrate.md`
- Full API / configuration lookup (SdkConfiguration, Auth0 class, Token accessors, exceptions, verification flow): `Read: references/framework-php-api/api-reference.md`
- Any other task (guidance, debugging, scope enforcement): start with `Read: references/framework-php-api/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
