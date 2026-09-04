
# Auth0 Server Python SDK (`auth0-server-python`)

The framework-agnostic core SDK for adding OpenID Connect authentication to any
Python **server-side** application. It drives the Authorization Code flow (with
PKCE), token storage and refresh, sessions, logout, MFA, passkeys, account
linking, connected accounts, and RFC 8693 token exchange - independent of Flask,
FastAPI, Django, or any web framework.

This reference documents the SDK's **public API surface** (the `ServerClient`
class and its option/return types) so it can be loaded alongside a feature
reference for the exact method, signature, and options a task needs. For a
turnkey Flask integration (with ready-made session stores), load
`framework-flask/index.md` instead - it wraps this same SDK.

## When to use this reference

- Integrating `auth0-server-python` into a web framework that has **no dedicated
  reference** (FastAPI web app with login/logout UI, Django, Sanic, Starlette,
  Quart, aiohttp, or a custom async server).
- Looking up an exact `ServerClient` method signature, option type, or return
  shape referenced from a feature guide (MFA, Organizations, passkeys, token
  exchange, connected accounts).
- Implementing a **custom state/transaction store** (Redis, database, cookie).

## When NOT to use it

| Instead of this SDK | Use | Why |
|---|---|---|
| Flask web app with login/logout | `framework-flask/index.md` | Ships concrete Flask session stores. |
| Protecting a FastAPI API (validating incoming JWT Bearer tokens) | `framework-fastapi-api/index.md` (`auth0-fastapi-api`) | That is a resource server. This SDK **acquires** tokens and manages sessions; it does not validate them on an API. |
| Single Page App / mobile | The relevant client-side framework reference (React, Vue, Angular, Swift, Android, ...) | Different auth model. |

## Install

```bash
pip install auth0-server-python
```

The SDK is fully **async** - every I/O method is a coroutine and must be
`await`ed. In frameworks that support async request handlers this is native; in
sync frameworks (e.g. Flask without the `[async]` extra) you must enable async
support or bridge with `asyncio.run(...)`.

---

## Core model: the two stores

`ServerClient` never touches your framework's request/response directly. It reads
and writes all persistent data through two pluggable stores you provide:

| Store | Holds | Lifetime |
|-------|-------|----------|
| **transaction_store** | Short-lived per-login data: PKCE `code_verifier`, `state`, `nonce`, `redirect_uri`, `app_state`. Written by `start_interactive_login`, read/cleared by `complete_interactive_login`. | One login round-trip |
| **state_store** | The authenticated session: `UserClaims`, ID token, refresh token, and `TokenSet`s. | The user's session |

Both extend `AbstractDataStore` and inherit `encrypt()`/`decrypt()` helpers that
JWE-encrypt data with the `secret` you pass. **If you do not pass stores, the SDK
falls back to in-memory stores** (`MemoryTransactionStore` /
`MemoryStateStore`) - fine for a single-process demo, but data is lost on restart
and not shared across workers. Production apps supply real stores (cookie, Redis,
database).

### Store interface

```python
from typing import Any, Optional
from auth0_server_python.store import StateStore, TransactionStore
from auth0_server_python.auth_types import StateData, TransactionData

class MyStateStore(StateStore):
    def __init__(self, secret: str):
        super().__init__({"secret": secret})   # enables self.encrypt / self.decrypt

    async def set(self, identifier: str, state, remove_if_expires: bool = False,
                  options: Optional[dict[str, Any]] = None) -> None:
        data = state.dict() if hasattr(state, "dict") else state
        # persist self.encrypt(identifier, data) under `identifier`, using `options`
        ...

    async def get(self, identifier: str,
                  options: Optional[dict[str, Any]] = None):
        raw = ...  # load the encrypted blob you stored, or return None
        if raw is None:
            return None
        decrypted = self.decrypt(identifier, raw)
        # The SDK expects a StateData instance, not a bare dict
        return StateData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier: str,
                     options: Optional[dict[str, Any]] = None) -> None:
        ...

    async def delete_by_logout_token(self, claims: dict[str, Any],
                                     options: Optional[dict[str, Any]] = None) -> None:
        # Backchannel logout: find & delete sessions matching claims["sub"]/["sid"].
        # No-op is acceptable for stateless cookie stores (nothing to query).
        ...
```

`TransactionStore` has the same `set`/`get`/`delete` contract (return
`TransactionData` from `get`) but **no** `delete_by_logout_token`.

### `store_options` - how per-request context reaches the store

Many `ServerClient` methods accept a `store_options` dict as their **last**
argument. The SDK passes it straight through to your store's `set`/`get`/`delete`
methods. Use it to hand the current request/response to a store that reads or
writes cookies:

```python
store_options = {"request": request, "response": response}
await auth0.complete_interactive_login(str(request.url), store_options=store_options)
user = await auth0.get_user(store_options=store_options)
```

If your store uses a globally-available session (e.g. Flask's context-local
`session`), it does not need anything from `store_options` and you can omit it.

---

## Constructing the client

Create **one** `ServerClient` and reuse it. Never hardcode credentials.

```python
import os
from auth0_server_python.auth_server.server_client import ServerClient

auth0 = ServerClient(
    domain=os.environ["AUTH0_DOMAIN"],            # "tenant.us.auth0.com" (no https://)
    client_id=os.environ["AUTH0_CLIENT_ID"],
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],
    secret=os.environ["AUTH0_SECRET"],            # encryption key: openssl rand -hex 64
    redirect_uri=os.environ["AUTH0_REDIRECT_URI"],# "https://app.example.com/callback"
    state_store=MyStateStore(secret=os.environ["AUTH0_SECRET"]),
    transaction_store=MyTransactionStore(secret=os.environ["AUTH0_SECRET"]),
    authorization_params={"scope": "openid profile email"},
)
```

### Constructor parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domain` | Yes | Tenant domain **or** a `Callable[[DomainResolverContext], str]` for multi-custom-domain (MCD) mode. No `https://`. |
| `client_id` | Yes | Application Client ID. |
| `client_secret` | One of these two | Client secret for `client_secret_post` auth. |
| `client_assertion_signing_key` | One of these two | PKCS8 PEM private key for **private_key_jwt** auth (more secure). Pairs with `client_assertion_signing_alg` (default `RS256`). |
| `secret` | Yes | Encryption secret for JWE-protecting stored data. Generate with `openssl rand -hex 64`. |
| `redirect_uri` | Recommended | Default callback URL. May also be set inside `authorization_params`. |
| `state_store` | Recommended | Session persistence. Defaults to in-memory if omitted. |
| `transaction_store` | Recommended | Login-transaction persistence. Defaults to in-memory if omitted. |
| `authorization_params` | Recommended | Default OAuth params: `scope`, `audience`, `connection`, ... Merged into every authorize request. |
| `state_identifier` | No | Key used for the session record (default `_a0_session`). |
| `transaction_identifier` | No | Key used for the transaction record (default `_a0_tx`). |
| `pushed_authorization_requests` | No | `True` to use Pushed Authorization Requests (PAR). |
| `organization` | No | Default org ID (`org_...`) or name applied to all logins. Per-login options override it. |
| `mfa_token_ttl` | No | Seconds an encrypted MFA token stays valid (default 300). |

To call an API you must set `audience` (and add `offline_access` to `scope` to
receive a refresh token):

```python
authorization_params={
    "scope": "openid profile email offline_access",
    "audience": "https://api.example.com",
}
```

---

## The core login flow

Three endpoints implement browser login. Wire each to a route in your framework.

### `start_interactive_login`

```python
async def start_interactive_login(
    self,
    options: Optional[StartInteractiveLoginOptions] = None,
    store_options: dict = None,
) -> str
```

Builds the Authorization Code + PKCE request, persists the transaction, and
returns the **Universal Login URL as a string**. You must redirect to it.

```python
url = await auth0.start_interactive_login()
return redirect(url)   # framework-specific redirect
```

With per-login options (connection, signup hint, organization, invitation,
extra params, or `app_state` to round-trip through the flow):

```python
from auth0_server_python.auth_types import StartInteractiveLoginOptions

url = await auth0.start_interactive_login(
    options=StartInteractiveLoginOptions(
        authorization_params={"connection": "google-oauth2", "screen_hint": "signup"},
        app_state={"return_to": "/dashboard"},
    ),
)
```

### `complete_interactive_login`

```python
async def complete_interactive_login(
    self,
    url: str,
    store_options: dict = None,
) -> dict[str, Any]
```

Call from your callback route with the **full callback URL** (including the
`?code=...&state=...` query string). It validates `state` (CSRF), exchanges the
code for tokens, and writes the session to the state store. Returns a dict that
includes `state_data` and any `app_state` you passed in. **Raises** on state
mismatch, missing params, or token-exchange failure - always wrap it.

```python
try:
    result = await auth0.complete_interactive_login(str(request.url))
    # result.get("app_state") -> {"return_to": "/dashboard"}
    return redirect("/")
except Exception as e:
    return f"Authentication error: {e}", 400
```

---

## Reading the session

### `get_user`

```python
async def get_user(self, store_options=None) -> Optional[dict[str, Any]]
```

Returns the user profile dict from the session, or `None` if unauthenticated.
This is your route-protection primitive:

```python
user = await auth0.get_user()
if user is None:
    return redirect("/login")
# user["sub"], user["name"], user["email"], user["picture"], user["email_verified"]
```

### `get_session`

```python
async def get_session(self, store_options=None) -> Optional[dict[str, Any]]
```

Returns the full session (`user`, `id_token`, `refresh_token`, `token_sets`,
`connection_token_sets`), or `None`. Use when you need more than the profile.

### `get_access_token`

```python
async def get_access_token(
    self,
    store_options=None,
    audience: Optional[str] = None,
    scope: Optional[str] = None,
) -> str
```

Returns a valid access token for calling your API, **transparently refreshing**
it via the refresh token when expired. Requires an `audience` (set on the client
or passed here) and, for silent refresh, `offline_access` in scope. **Raises**
`AccessTokenError` (e.g. code `session_expired`) when no valid token can be
produced.

```python
token = await auth0.get_access_token()
async with httpx.AsyncClient() as client:
    resp = await client.get(
        "https://api.example.com/data",
        headers={"Authorization": f"Bearer {token}"},
    )
```

### `logout`

```python
async def logout(
    self,
    options: Optional[LogoutOptions] = None,
    store_options=None,
) -> str
```

Clears the session from the state store and returns the Auth0 `/v2/logout` URL.
Redirect to it. Pass `LogoutOptions(return_to=...)` for the post-logout URL
(which must be in the app's Allowed Logout URLs). Note `options` is the **first**
positional argument - pass store context by keyword (`store_options=...`).

```python
from auth0_server_python.auth_types import LogoutOptions

url = await auth0.logout(options=LogoutOptions(return_to="https://app.example.com"))
return redirect(url)
```

### `handle_backchannel_logout`

```python
async def handle_backchannel_logout(self, logout_token: str, store_options=None)
```

Validates an OIDC back-channel `logout_token` sent by Auth0 and invokes your
state store's `delete_by_logout_token(claims, ...)` to revoke matching sessions.
Wire it to a POST endpoint (e.g. `/backchannel-logout`) that reads the
`logout_token` form field. Only effective with a **server-side** state store that
can query by `sub`/`sid`; a stateless cookie store has nothing to delete.

---

## Calling third-party / connection APIs (Token Vault)

### `get_access_token_for_connection`

```python
async def get_access_token_for_connection(
    self,
    options: dict[str, Any],   # {"connection": "google-oauth2", "login_hint": "..."}
    store_options=None,
) -> str
```

Returns an access token **for an upstream IdP connection** (e.g. Google, GitHub)
via Token Vault, so your server can call that provider's API on the user's
behalf. Requires the connection to be configured for Token Vault in Auth0.

---

## Advanced flows (referenced from feature guides)

These are the SDK's specialized public methods. Load the matching feature
reference for the end-to-end workflow; the signatures below are the SDK contract.

### RFC 8693 custom token exchange

```python
from auth0_server_python.auth_types import (
    CustomTokenExchangeOptions, LoginWithCustomTokenExchangeOptions,
)

# Exchange an external token for Auth0 tokens (no session)
resp = await auth0.custom_token_exchange(
    CustomTokenExchangeOptions(
        subject_token="external-token",
        subject_token_type="urn:acme:legacy-token",   # your registered type
        audience="https://api.example.com",           # optional
        scope="read:data write:data",                 # optional
    )
)
# resp.access_token / resp.expires_in are now available - use the token to call
# your API. Never log or print access tokens.

# Exchange AND establish a user session in one call
result = await auth0.login_with_custom_token_exchange(
    LoginWithCustomTokenExchangeOptions(
        subject_token="external-token",
        subject_token_type="urn:acme:legacy-token",
        audience="https://api.example.com",
    ),
    store_options={"request": request, "response": response},
)
user = result.state_data.user   # state_data is a StateData model - attribute access
```

Signatures:

```python
async def custom_token_exchange(self, options: CustomTokenExchangeOptions,
                                store_options=None) -> TokenExchangeResponse
async def login_with_custom_token_exchange(self, options: LoginWithCustomTokenExchangeOptions,
                                           store_options=None) -> LoginWithCustomTokenExchangeResult
```

### Other SDK flows

Every method below takes a trailing `store_options=None`; `start_*` methods
return a redirect URL (`str`) you complete in a return route with the callback
URL, mirroring the interactive-login pattern.

| Flow | Methods (async unless noted) | Returns / notes |
|---|---|---|
| Account linking | `start_link_user(options)` · `complete_link_user(url)` · `start_unlink_user(options)` · `complete_unlink_user(url)` | `start_*` -> redirect URL. |
| Connected accounts (My Account API) | `start_connect_account(options: ConnectAccountOptions)` · `complete_connect_account(...)` · `list_connected_accounts()` · `delete_connected_account(...)` · `list_connected_account_connections(...)` | `start_*` -> `str`; others -> `CompleteConnectAccountResponse` / `ListConnectedAccountsResponse` / `None` / `ListConnectedAccountConnectionsResponse`. |
| CIBA (client-initiated backchannel auth) | `login_backchannel(options: dict) -> dict` | Approves login out-of-band (e.g. push to a phone), no browser redirect. |
| Session transfer (web-to-native handoff) | `request_session_transfer_token() -> SessionTransferTokenResult` · `build_session_transfer_redirect(...) -> str` **(sync)** | Hands a web session to a native app. |
| Passkeys | `passkey_signup_challenge(...)` · `passkey_login_challenge(...)` · `signin_with_passkey(...)` | -> `PasskeySignupChallengeResponse` / `PasskeyLoginChallengeResponse` / `PasskeyLoginResult`. |

### Multi-factor authentication (`auth0.mfa`)

MFA is exposed as an `MfaClient` on the `auth0.mfa` property. It is driven by an
**`mfa_token`**, which the SDK hands you when a login or token request needs a
second factor: any call (e.g. `get_access_token`, `complete_interactive_login`,
`login_with_custom_token_exchange`) that hits an `mfa_required` response raises
`MfaRequiredError`. Catch it, read `err.mfa_token`, and pass that token into the
`auth0.mfa` methods. The token is encrypted; the SDK decrypts it internally on
each call, so pass it through unchanged.

```python
from auth0_server_python.error import MfaRequiredError

try:
    token = await auth0.get_access_token(audience="https://api.example.com")
except MfaRequiredError as err:
    mfa_token = err.mfa_token          # opaque, encrypted; feed into auth0.mfa.*
    # err.mfa_requirements describes which factors satisfy the challenge
    ...  # run the enroll/challenge/verify flow below
```

Every `MfaClient` method takes an `options` **dict** whose keys are listed below,
plus the same optional `store_options` passthrough as the rest of the SDK. All
are async except `decrypt_mfa_token`.

| Method | Returns | Purpose |
|---|---|---|
| `list_authenticators(options)` | `list[AuthenticatorResponse]` | List enrolled factors. |
| `enroll_authenticator(options)` | `EnrollmentResponse` | Register a new factor. |
| `challenge_authenticator(options)` | `ChallengeResponse` | Send/prepare a challenge. |
| `verify(options, dpop_key=None)` | `MfaVerifyResponse` | Complete the challenge, get tokens. |
| `decrypt_mfa_token(encrypted_token)` **(sync)** | `MfaTokenContext` | Inspect the token. |

The typical flow is list -> enroll (if none) -> challenge -> verify:

```python
# 1. What's enrolled? each -> AuthenticatorResponse: id, authenticator_type,
#    active, name, oob_channel, type, phone_number, created_at, last_auth
authenticators = await auth0.mfa.list_authenticators({"mfa_token": mfa_token})

# 2. Enroll if needed. factor_type: "otp" | "sms" | "voice" | "email" | "auth0"
#    (Guardian push). Add "phone_number" for sms/voice, "email" for email.
enroll = await auth0.mfa.enroll_authenticator({"mfa_token": mfa_token, "factor_type": "otp"})
# otp -> OtpEnrollmentResponse: secret, barcode_uri (render as a QR code),
#        recovery_codes, id
# oob -> OobEnrollmentResponse: oob_channel, oob_code, binding_method,
#        recovery_codes, id

# 3. Challenge. For OOB factors this delivers the code/push; for otp it prepares it.
challenge = await auth0.mfa.challenge_authenticator({
    "mfa_token": mfa_token, "factor_type": "sms",
    "authenticator_id": authenticators[0].id,   # optional, targets one enrolled factor
})
# -> ChallengeResponse: challenge_type, oob_code, binding_method, expires_in

# 4. Verify with EXACTLY ONE credential: "otp", or "oob_code" + "binding_code",
#    or "recovery_code". persist=True (needs "audience") stores the token set as
#    a session.
result = await auth0.mfa.verify({
    "mfa_token": mfa_token,
    "otp": "123456",
    "persist": True,
    "audience": "https://api.example.com",  # required when persist=True
    "scope": "openid profile email",        # optional
})
# -> MfaVerifyResponse: access_token, token_type, expires_in, id_token,
#    refresh_token, scope, audience, recovery_code
# Recovery fallback: auth0.mfa.verify({"mfa_token": mfa_token, "recovery_code": "ABCD-1234"})
```

`decrypt_mfa_token` returns `MfaTokenContext(mfa_token, audience, scope,
mfa_requirements, created_at)`; raises `MfaTokenExpiredError` past `mfa_token_ttl`
(default 300s) or `MfaTokenInvalidError` if tampered. You rarely call it directly
- the client methods decrypt internally.

**MFA errors** (from `auth0_server_python.error`): `MfaRequiredError` (the
trigger, subclass of `AccessTokenError`), `MfaEnrollmentError`,
`MfaChallengeError`, `MfaVerifyError`, `MfaListAuthenticatorsError` (all subclass
`MfaApiError`), and `MfaTokenExpiredError` / `MfaTokenInvalidError`.

For enabling MFA policies on the tenant (which factors are required, when to
prompt), load `feature-mfa/index.md`; the SDK-side surface is fully above.

### Passwordless (`auth0.passwordless`)

Exposed as a `PasswordlessClient` for email/SMS one-time-code and magic-link
login. Use `StartPasswordlessEmailOptions` / `StartPasswordlessSmsOptions` to
start and `VerifyPasswordlessOtpOptions` to verify, following the same
options-dict + `store_options` pattern as `auth0.mfa`.

---

## Option and return types (`auth0_server_python.auth_types`)

### Input options

```python
class StartInteractiveLoginOptions(BaseModel):
    pushed_authorization_requests: Optional[bool] = False
    app_state: Optional[Any] = None                # round-tripped to complete_interactive_login
    authorization_params: Optional[dict[str, Any]] = None
    organization: Optional[str] = None             # overrides client-level organization
    invitation: Optional[str] = None               # Organizations invitation token

class LogoutOptions(BaseModel):
    return_to: Optional[str] = None                # post-logout redirect (must be allow-listed)

class CustomTokenExchangeOptions(BaseModel):       # login_with_* has the same fields
    subject_token: str
    subject_token_type: str
    audience: Optional[str] = None
    scope: Optional[str] = None
    actor_token: Optional[str] = None
    actor_token_type: Optional[str] = None         # required if actor_token is set
    organization: Optional[str] = None
    authorization_params: Optional[dict[str, Any]] = None
```

### Session / return types

```python
class UserClaims(BaseModel):        # extra claims allowed (Config.extra = "allow")
    sub: str
    name / nickname / given_name / family_name / picture / email: Optional[str]
    email_verified: Optional[bool]
    org_id / org_name: Optional[str]
    session_expiry: Optional[int]

class TokenSet(BaseModel):
    audience: str
    access_token: str
    scope: Optional[str]
    expires_at: int

class SessionData(BaseModel):
    user: Optional[UserClaims]
    id_token: Optional[str]
    refresh_token: Optional[str]
    token_sets: list[TokenSet]
    connection_token_sets: list[ConnectionTokenSet]

class StateData(SessionData):       # what your StateStore persists / returns
    internal: InternalStateData     # SDK-managed (sid, timestamps)

class TransactionData(BaseModel):   # what your TransactionStore persists / returns
    code_verifier / state / nonce / redirect_uri: Optional[...]
    audience / organization: Optional[str]
    app_state: Optional[Any]
```

Your store's `get` must return a `StateData` / `TransactionData` instance (not a
plain dict) - construct it with `StateData(**decrypted)` after decrypting.

---

## Errors (`auth0_server_python.error`)

All inherit `Auth0Error`. Catch the base to handle any SDK failure; catch a
subclass for specific handling.

| Error | When |
|-------|------|
| `AccessTokenError` | `get_access_token` cannot produce a token (e.g. code `session_expired`). |
| `MfaRequiredError` | A second factor is required (code `mfa_required`). Subclass of `AccessTokenError`; carries `.mfa_token` and `.mfa_requirements` for the `auth0.mfa` flow. |
| `MissingTransactionError` | Callback arrived with no matching stored transaction (expired, cookie lost, or replay). |
| `MissingRequiredArgumentError` | A required constructor/method argument is absent (e.g. `secret`). |
| `ConfigurationError` | Invalid config (missing/invalid `domain`, bad `mfa_token_ttl`). |
| `ApiError` / `MyAccountApiError` | Auth0 endpoint returned an error (carries `error`, `error_description`). |
| `BackchannelLogoutError` | Invalid/failed back-channel `logout_token`. |
| `DomainResolverError` | MCD `domain` callable raised or returned nothing. |

```python
from auth0_server_python.error import AccessTokenError, MissingTransactionError

try:
    token = await auth0.get_access_token()
except AccessTokenError as e:
    return redirect("/login")   # session expired, re-authenticate
```

---

## Integrating with any framework (generic recipe)

1. **Implement the two stores** for your framework's session mechanism (cookie,
   Redis, DB). Return `StateData` / `TransactionData` from `get`.
2. **Construct one `ServerClient`** at startup with those stores and your
   credentials from environment variables.
3. **Add four async routes** and pass `store_options={"request": ..., "response":
   ...}` when your stores need request context:
   - `GET /login` -> redirect to `await start_interactive_login()`
   - `GET /callback` -> `await complete_interactive_login(str(full_url))`, then redirect
   - `GET /profile` (or any protected route) -> gate on `await get_user()`
   - `GET /logout` -> redirect to `await logout(...)`
4. **Configure the Auth0 Application** (Regular Web App): add the callback URL to
   Allowed Callback URLs and the post-logout URL to Allowed Logout URLs. Use the
   Auth0 CLI or MCP - load the tooling reference for exact commands.

FastAPI example (login + callback):

```python
from fastapi import FastAPI, Request
from starlette.responses import RedirectResponse

app = FastAPI()

@app.get("/login")
async def login():
    return RedirectResponse(await auth0.start_interactive_login())

@app.get("/callback")
async def callback(request: Request):
    await auth0.complete_interactive_login(str(request.url))
    return RedirectResponse("/")

@app.get("/profile")
async def profile():
    user = await auth0.get_user()
    if user is None:
        return RedirectResponse("/login")
    return user
```

For a complete, copy-paste Flask app with working cookie and Redis session
stores, load `framework-flask/index.md`.

---

## Advanced configuration

### Private Key JWT (no client secret)

```python
# Load the PEM from a path given by an env var (keep the key file out of the
# repo - add *.pem to .gitignore); or pass the key contents directly via
# os.environ["AUTH0_CLIENT_ASSERTION_KEY"].
with open(os.environ["AUTH0_CLIENT_ASSERTION_KEY_PATH"]) as f:
    private_key = f.read()

auth0 = ServerClient(
    domain=os.environ["AUTH0_DOMAIN"],
    client_id=os.environ["AUTH0_CLIENT_ID"],
    client_assertion_signing_key=private_key,      # instead of client_secret
    client_assertion_signing_alg="RS256",          # default
    secret=os.environ["AUTH0_SECRET"],
    authorization_params={"redirect_uri": os.environ["AUTH0_REDIRECT_URI"]},
)
```

### Organizations

Set a default org on the client (`organization="org_abc123"`) or per-login via
`StartInteractiveLoginOptions(organization=..., invitation=...)`. The logged-in
user's `org_id` / `org_name` appear on `UserClaims`. Load
`feature-organizations/index.md` for the full B2B workflow.

### Pushed Authorization Requests (PAR)

Pass `pushed_authorization_requests=True` to the constructor (or per login in
`StartInteractiveLoginOptions`) to send auth params over the back channel.

### Multiple Custom Domains (MCD)

Pass a callable as `domain` to resolve the tenant per request:

```python
from auth0_server_python.auth_types import DomainResolverContext

async def resolve_domain(ctx: DomainResolverContext) -> str:
    host = (ctx.request_headers or {}).get("host", "").split(":")[0]
    return DOMAIN_MAP.get(host, "default.auth0.com")

auth0 = ServerClient(domain=resolve_domain, client_id=..., client_secret=..., secret=...)
```

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Calling a method without `await` | Every I/O method is async - `await` it or you get a coroutine object. |
| Returning `start_interactive_login()` / `logout()` directly | They return **URL strings** - wrap in your framework's redirect. |
| Passing options positionally to `logout()` | First positional arg is `LogoutOptions`; pass store context as `store_options=...`. |
| `get` returning a dict from a custom store | Return `StateData(**data)` / `TransactionData(**data)`, not a raw dict. |
| Omitting stores in production | In-memory defaults lose data on restart and aren't shared across workers - supply real stores. |
| `get_access_token` fails with no token | Set `audience` and add `offline_access` to `scope` so a refresh token is issued. |
| Not wrapping `complete_interactive_login` | It raises on CSRF/expiry/exchange failure - always try/except. |
| Passing `domain` with `https://` | Use the bare host, e.g. `tenant.us.auth0.com`. |
| Reusing this SDK to validate API JWTs | Wrong tool - use `auth0-fastapi-api` (resource server) for that. |
| Expecting back-channel logout with a cookie store | `delete_by_logout_token` has nothing to query - use a server-side store. |

---

## References

- [auth0-server-python on PyPI](https://pypi.org/project/auth0-server-python/)
- [auth0-server-python on GitHub](https://github.com/auth0/auth0-server-python)
- [SDK examples (InteractiveLogin, CustomTokenExchange, Passkeys, ConfigureStore, ...)](https://github.com/auth0/auth0-server-python/tree/main/examples)
