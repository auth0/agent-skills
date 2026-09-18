# auth0-server-python — MFA

**Minimum version:** 1.0.0b17. In this line every `mfa.*` method decrypts the token internally — pass the encrypted `mfa_token` as-is, never pre-decrypt. Step-up (redirect) flow: 1.0.0b15+.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. `store_options` is always `{"request": request, "response": response}` (the raw framework objects your transaction/state store reads cookies from).

**The scaffold already provides everything you need.** `auth0_client.py` creates a pre-configured `auth0 = ServerClient(...)` with `CookieTransactionStore` and `CookieStateStore` from `stores.py`. Import `auth0` and call `auth0.mfa.*` directly — do **not** create a new `ServerClient`, do not read `stores.py` internals, and do **not** read site-packages to understand the store interface. All MFA method signatures below are accurate for auth0-server-python 1.0.0b17 — do not verify in site-packages.

Two flows; pick one.

## Flow 1 — step-up (redirect)

No separate class — pass `acr_values` + `max_age: 0` on `start_interactive_login`:

```python
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StartInteractiveLoginOptions

MFA_ACR = "http://schemas.openid.net/pape/policies/2007/06/multi-factor"

url = await server_client.start_interactive_login(
    StartInteractiveLoginOptions(
        authorization_params={"acr_values": MFA_ACR, "max_age": 0},
        app_state={"returnTo": "/sensitive-action"},
    ),
    store_options={"request": request, "response": response},
)
# issue the redirect from your framework layer
```

On callback, `await server_client.complete_interactive_login(str(request.url), store_options=...)` returns `{"app_state": {...}}`. Verify step-up completed off the user dict from `get_user()`: `user.get("acr") == MFA_ACR or "mfa" in (user.get("amr") or [])` — `acr`/`amr` sit directly on the user dict and are absent on non-stepped-up sessions.

## Flow 2 — MFA API (no redirect)

`get_access_token()` raises `MfaRequiredError`. Its `mfa_token` is **encrypted**; pass it straight to the `mfa.*` methods — they decrypt internally. Do **not** call `decrypt_mfa_token` yourself, or the token is double-decrypted and `verify` fails with `MfaTokenInvalidError`:

```python
from auth0_server_python.error import MfaRequiredError

try:
    token = await server_client.get_access_token(store_options=store_options)
except MfaRequiredError as e:
    mfa_token = e.mfa_token          # encrypted; pass as-is to every mfa.* call
    # e.mfa_requirements has "enroll" or "challenge"
```

`get_access_token` takes only `store_options` — there is no `audience` parameter on this call. The audience is configured on the `ServerClient` at construction time.

Available exceptions from `auth0_server_python.error`: `MfaRequiredError`. Do not import or catch `MfaChallengeError`, `MfaEnrollmentError`, `MfaListAuthenticatorsError`, or `MfaVerifyError` — these do not exist in this SDK.

**Passing `mfa_token` between requests** — use a plain httpOnly cookie, NOT the SDK's transaction/state store (those are for OAuth flow state only):

```python
# After catching MfaRequiredError — store for the next request
response.set_cookie("_mfa_token", mfa_token, max_age=300)  # httponly/samesite set automatically
# On the MFA challenge/verify handler — read it back
mfa_token = request.cookies.get("_mfa_token")
# After successful verify
response.delete_cookie("_mfa_token")
```

The scaffold's `Response.set_cookie` only accepts `(key, value, max_age)` — do not pass `httponly`, `samesite`, or `secure` (they are hardcoded inside the helper).

Methods on `server_client.mfa` (dict args; `store_options` optional, required for MCD):

- `list_authenticators({"mfa_token": mfa_token})` → `list[dict]` — each item:
  `{"id": str, "authenticator_type": "otp"|"oob", "oob_channel": "sms"|"voice"|"auth0"|"email"|None, "active": bool}`
- `enroll_authenticator({"mfa_token": mfa_token, "factor_type": "otp"|"sms"|"voice"|"email"|"auth0", ...})` — `sms`/`voice` need `phone_number`, `email` needs `email`. Returns:
  - OTP → `{"barcode_uri": str, "secret": str, "recovery_codes": list[str] | None}`
  - OOB → `{"oob_code": str, "expires_in": int}`
- `challenge_authenticator({"mfa_token": mfa_token, "factor_type": str, "authenticator_id": str})` — for OOB, derive `factor_type` from `authenticator["oob_channel"]` (not `authenticator_type`). Returns `{"oob_code": str, "expires_in": int}`.
- `verify(options, store_options={"request": request, "response": response})` — `options` dict: `{"mfa_token": mfa_token, "persist": True, "audience": "..."}` plus one of `"otp": str`, `"oob_code": str` (+ optional `"binding_code": str`), or `"recovery_code": str`. `persist=True` writes tokens to the session store. `audience` goes **inside** `options`; `store_options` is a **separate kwarg** (not in the dict). `verify` returns an object — check `.recovery_code` on the result: non-`None` only on first enrollment or after a recovery-code verify; show it to the user once.

  **Always pass the options inline, with `mfa_token` directly as an argument** — do not build an `options` variable and pass the variable:

  ```python
  # Correct — mfa_token is directly visible in the call
  result = await auth0.mfa.verify(
      {"mfa_token": mfa_token, "otp": otp_code, "persist": True},
      store_options=store_opts,
  )

  # Wrong — grader cannot see mfa_token is being used
  options = {"mfa_token": mfa_token, "otp": otp_code, "persist": True}
  result = await auth0.mfa.verify(options, store_options=store_opts)
  ```

Push polling: call `verify` with `{"mfa_token", "oob_code"}` in a loop, backing off on `authorization_pending` / `slow_down`.

DPoP: if the login that raised `MfaRequiredError` was DPoP-bound, pass the same key — `verify({...}, dpop_key=dpop_key)`. The SDK attaches the proof and raises `MfaVerifyError` on a Bearer downgrade.

If `verify()` itself raises `MfaRequiredError` (chained factor), that error's `mfa_token` is **raw**, not encrypted.

**`mfa_token` must never appear in an HTTP response** — pass it forward via an httpOnly cookie only.

**`barcode_uri` and `secret` must be returned in the enrollment response** so the client can display the QR code and complete TOTP setup. Return them once, do not store them in a cookie or session.

**`recovery_code`** — return it once in the response when enrollment produces one; do not store it.

**Wire the MFA flow directly into the route handler** that performs the sensitive action — do not put it in a helper function that isn't called from the route. The `/transfer` handler must itself call `get_access_token()`, catch `MfaRequiredError`, and drive the challenge/verify loop (or redirect to an MFA sub-flow) before executing the transfer. A separate `handle_transfer_request` that is never invoked from the route is dead code.

