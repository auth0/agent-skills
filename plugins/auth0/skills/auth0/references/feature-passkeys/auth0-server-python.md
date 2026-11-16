# auth0-server-python — Passkeys

**Minimum version:** `1.0.0b13` (passkey signup/signin + MFA; DPoP-bound passkeys also landed here).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-server-python` is **low-level**: the server issues the challenge and runs the token exchange; the WebAuthn ceremony runs on the client and the credential is posted back. Methods and fields are `snake_case`.

## Signup / Login

```python
import os
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import PasskeyUserProfile, PasskeyAuthResponse

# Read config from the environment (.env) — never hard-code the domain/secret.
server_client = ServerClient(
    domain=os.environ["AUTH0_DOMAIN"],            # custom domain, not *.auth0.com
    client_id=os.environ["AUTH0_CLIENT_ID"],
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],  # see "client auth" below
    secret=os.environ["AUTH0_SESSION_SECRET"],
    # state_store / transaction_store as configured
)

# Signup challenge → PasskeySignupChallengeResponse
#   .auth_session: str, .authn_params_public_key: PasskeyPublicKeyOptions
signup_challenge = await server_client.passkey_signup_challenge(
    user_profile=PasskeyUserProfile(email="user@example.com", name="Jane Doe"),
    # optional: connection, organization, user_metadata, store_options
)

# Login challenge → PasskeyLoginChallengeResponse (same fields)
login_challenge = await server_client.passkey_login_challenge(
    # optional: connection, organization, store_options
)

# --- client runs the WebAuthn ceremony with authn_params_public_key (see "Browser ceremony" below) ---

# Token exchange → PasskeyLoginResult
result = await server_client.signin_with_passkey(
    auth_session=login_challenge.auth_session,
    authn_response=PasskeyAuthResponse(  # the WebAuthn credential from the client
        id="...", raw_id="...", type="public-key", response={...},
    ),
    # optional: store_options, connection, organization, scope, audience, dpop_key
)
# signin_with_passkey() persists the session into the state store. state_data is
# that session — it holds the raw tokens, so never log it or return it in a response.
# Close the loop: read the identity from result (don't discard it).
user = result.state_data["user"]      # OIDC claims: user["sub"], user["email"], ...
# Later requests: re-read via the SDK, never decode a token by hand.
#   user = await server_client.get_user(store_options={"request": request, "response": response})
```

- `passkey_signup_challenge(user_profile=..., ...)` → `PasskeySignupChallengeResponse`.
- `passkey_login_challenge(...)` → `PasskeyLoginChallengeResponse`.
- `signin_with_passkey(auth_session, authn_response, ...)` → `PasskeyLoginResult`.

All three are `async` — `await` them. The credential is passed as `authn_response=PasskeyAuthResponse(...)`; there is **no** separate `credential` param.

## Browser ceremony (required — the server SDK does not run it)

`auth0-server-python` only issues the challenge and runs the token exchange, so a
working web app **must** also ship client-side JS for the WebAuthn ceremony
(`navigator.credentials.create()` / `.get()`) — a server-only solution never
closes the loop. base64url-decode `authn_params_public_key.challenge` and
`.user.id` before the ceremony and re-encode the credential's binary fields before
POSTing them back into `PasskeyAuthResponse` (signup returns `attestationObject`;
login returns `authenticatorData` + `signature` + `userHandle`).

## Session / state store (the usual failure point)

`signin_with_passkey()` persists the session **through the configured `state_store`**
(line 22). If that store is broken, the whole passkey flow silently fails even
though every challenge/exchange call is correct — this is the single most common
way these integrations break. Do **not** hand-roll a store with your own crypto:

- **Prefer the SDK's built-in store.** For a web app a stateless cookie-backed
  store constructed with your `AUTH0_SESSION_SECRET` is enough — the SDK owns the
  secret-based encryption. Do not reimplement it.
- **If you must subclass**, extend `StateStore` (an `AbstractDataStore[dict[str, Any]]`)
  and implement its documented `async` `get` / `set` / `delete`. Two things to get right:
  - `get(...)` returns a **plain `dict`** (or `None`) — that is the store's type
    parameter (`AbstractDataStore[dict[str, Any]]`). The SDK reads it with dict
    access (`get_user()` does `state_data.get("user")`, `get_access_token()` reads
    `state_data["token_sets"]`) and `.dict()`-normalizes a Pydantic value first, so
    returning a dict is correct and does **not** raise. (`PasskeyLoginResult.state_data`
    is likewise a dict — see Data classes.)
  - **Reuse the base crypto — don't reinvent it.** `AbstractDataStore` already
    provides `self.encrypt` / `self.decrypt`, keyed off the `secret` you pass the
    constructor. Call `super().__init__({"secret": <AUTH0_SESSION_SECRET>})` — the
    `__init__(self, options)` dict *is* the documented contract — and let the base own
    encryption instead of hand-rolling your own.

## Data classes (from `auth0_server_python.auth_types`)

- `PasskeyUserProfile` — the signup identity; all optional: `email`, `name`, `username`, `phone_number`, `given_name`, `family_name`, `nickname`, `picture`.
- `PasskeyAuthResponse` — the WebAuthn credential posted back: `id: str`, `raw_id: str` (alias `rawId`), `type: str`, `response: dict[str, str]`, optional `authenticator_attachment`, `client_extension_results`.
- `PasskeyLoginResult` — single field `state_data: dict[str, Any]`; this is the SDK-persisted session, so it carries the raw access / ID / refresh tokens alongside the user claims (`result.state_data["user"]`). Treat it as server-only: read claims from it, but never return it in a response body or write it to logs.

## Client authentication

A **confidential client is not strictly required** — the passkey token exchange allows public clients, and the SDK only authenticates when a `client_secret` is configured. The real constraint: the passkey challenge endpoints accept a **client secret only, not a client assertion** — a client configured with Private Key JWT only (`client_assertion_signing_key`) cannot use passkey flows. Also enable the passkey grant `urn:okta:params:oauth:grant-type:webauthn` on the app.

## Error handling

The three methods raise `PasskeyError` (a subclass of `Auth0Error`); its code comes from `PasskeyErrorCode` (`passkey_challenge_error`, `passkey_token_error`, `invalid_response`). `signin_with_passkey()` can also raise `MfaRequiredError` (from `auth0_server_python.error`) before a session is created — continue with the MFA flow (see the hub, then `feature-mfa`).

## SDK-specific gotchas

- Carry the challenge's `auth_session` through to `signin_with_passkey`.
- `authn_params_public_key` is a Pydantic model (`PasskeyPublicKeyOptions`) whose WebAuthn fields carry camelCase aliases (`rpId`, `pubKeyCredParams`, `authenticatorSelection`, `userVerification`). When you serialise it to JSON for the browser, dump it with `by_alias=True` (`authn_params_public_key.model_dump(mode="json", by_alias=True)`); a plain `model_dump()` emits snake_case keys that `navigator.credentials.create()`/`.get()` silently ignores, so the ceremony fails. Otherwise pass the values through unchanged.
- For DPoP-bound tokens pass `dpop_key` (an EC P-256 JWK) to `signin_with_passkey`.
- The `domain` must be the verified custom domain.
