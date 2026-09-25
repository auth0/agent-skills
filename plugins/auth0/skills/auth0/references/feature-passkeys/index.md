# Auth0 Passkeys

Let users sign up and log in with a **passkey** (WebAuthn) instead of a password — the passkey is the *primary* credential, not a second factor. Also covers letting an already-authenticated user **add** a passkey to their account (My Account API). For adding a first password login to an app, use the `framework-*` reference; passkeys layer their own grant on top of an existing connection.

## When to use / when NOT to use

**Use when** the app must:

- Let users **sign up** with a passkey (no password created).
- Let users **log in** with an existing passkey.
- Let a signed-in user **enroll an additional passkey** as a self-service account action.

**Do NOT use this reference when:**

- The request is a passkey/WebAuthn/security key **as a second factor** on top of a password login — that is the `feature-mfa` reference (the `hwk` factor and the MFA API enroll/challenge/verify flow). Passkeys here replace the password; MFA layers on top of it.
- The task is deploying a **hosted self-service portal** for passkey management rather than building the flow in-app — that is `feature-universal-portals` (My Account portal).
- The task is only tenant provisioning with no application behavior — defer to `tooling-*`.

## Concepts

- **Passkey / WebAuthn** — a FIDO2 credential (platform biometric or roaming security key) bound to a relying party. Replaces the password entirely.
- **Relying Party ID (`rpId`)** — the domain the passkey is bound to. This is why a **custom domain is mandatory** (below).
- **Attestation vs assertion** — *signup/registration* produces an attestation (`navigator.credentials.create()`); *login* produces an assertion (`navigator.credentials.get()`).
- **Passkey grant** — the OAuth grant `urn:okta:params:oauth:grant-type:webauthn` the app exchanges a verified credential for tokens on. Must be enabled on the application.

## SDK integration

Passkeys need setup in two independent places:

1. **Tenant / connection** — the passkey authentication method is enabled on the database connection, the passkey grant is enabled on the application, and a **custom domain** is configured. See "Tenant configuration".
2. **Application** — the app runs the passkey flow with its SDK. See "Example code snippets".

### The mechanic — a 3-step flow

Every SDK wraps the same shape:

1. **Challenge** — ask Auth0 for a WebAuthn challenge (signup or login). Returns an `authSession` plus the public-key options the browser/authenticator needs.
2. **Ceremony** — the platform runs WebAuthn: `navigator.credentials.create()` (signup) or `.get()` (login) on web; `ASAuthorizationController` on Apple platforms; `CredentialManager` on Android. This produces a signed credential.
3. **Token exchange** — send the credential + `authSession` back to Auth0 on the passkey grant; on success you get tokens (or an established session).

**Two SDK shapes — pick by what the detected SDK exposes:**

- **High-level** (`auth0-react`, `auth0-vue`, `auth0-angular`, native SDKs) — one `passkey.signup()` / `passkey.login()` (or platform equivalent) runs all three steps for you and returns tokens.
- **Low-level** (`auth0-spa-js`, `auth0-server-js`, `auth0-auth-js`, `auth0-server-python`, `nextjs-auth0`) — you call the challenge method, run the browser ceremony yourself, then call the token-exchange method.

Before writing code, read the detected SDK's file (see "Example code snippets").

### Scope — do this, then stop

The deliverable is the **application code**, written from the detected SDK's leaf file. Write it early; do not spend the task investigating.

- **Trust the per-SDK file's method/option names — they are verified against the installed SDK.** Do NOT grep `node_modules`, read `.d.ts`/`.d.cts`/site-packages/SDK source, run the SDK's test suite, or write throwaway probes to confirm a signature. Write the code; inspect the installed package only if a specific line fails to compile, and then only that line.
- **The minimum version in each SDK file is informational.** The scaffold already pins a compatible release; don't read `package.json`/`node_modules` to confirm it unless a `verify — X+` row tells you to.
- You're done when the app code is in place (and, for a JS/TS app, `npm run build` passes if quick). Stop there.

## Tenant configuration

Passkeys require three things set before any flow works; all three are independent of the app code:

```bash
# 1. A custom domain MUST exist and be verified — passkeys are bound to the rpId
#    (the domain). They will NOT work on the default *.auth0.com domain.
auth0 domains list
# create + verify one if none: see the tooling-* reference for the full flow.

# 2. Enable the passkey authentication method on the database connection
#    (Dashboard: Authentication > Database > {connection} > Authentication Methods > Passkey).
#    The signup identifier (email / username / phone) must match the connection's
#    Attributes configuration.

# 3. Enable the passkey (WebAuthn) grant on the application
auth0 apps update <CLIENT_ID> --grants "authorization_code,refresh_token,urn:okta:params:oauth:grant-type:webauthn"
```

The full connection-attribute config, the passkey policy, and the Terraform/MCP coverage are owned by the loaded `tooling-*` reference (DEFER ACROSS).

## Feature-level symbols

Protocol-level names identical across every SDK — what a grader asserts and what the app must get right:

| Symbol | Meaning |
|---|---|
| `urn:okta:params:oauth:grant-type:webauthn` | The passkey grant the credential is exchanged for tokens on |
| `authSession` | Opaque session string returned by the challenge; passed back to the token exchange |
| `authnParamsPublicKey` / `publicKey` | The WebAuthn public-key options (challenge, rpId, user) the authenticator consumes |
| `clientDataJSON` | Part of the browser credential response (both create and get) |
| `attestationObject` | Registration (signup) credential response field |
| `authenticatorData` + `signature` + `userHandle` | Assertion (login) credential response fields |

The resulting refresh token records the authentication method (AMR). Passkey logins surface WebAuthn AMR values defined by RFC 8176 — `swk` (proof-of-possession of a software-secured key, e.g. a platform passkey), `hwk` (hardware-secured key / security key), `pop` (proof of possession). These come from the IANA AMR registry, not an Auth0-specific list.

SDK-specific symbols (the exact method/option names) are **not** listed here — get them from the SDK's own leaf file.

## Passkey API endpoints

The language-neutral REST floor every SDK wraps (the authoritative reference is the [native passkeys API](https://auth0.com/docs/native-passkeys-api)):

| Operation | Endpoint | Key params | Authorized by |
|---|---|---|---|
| Signup / registration challenge | `POST /passkey/register` | `client_id`, `realm` (optional; connection), `user_profile` `{ email, name? }` | Public client (`client_id`) |
| Login / authentication challenge | `POST /passkey/challenge` | `client_id`, `realm` (optional) | Public client (`client_id`) |
| Token exchange | `POST /oauth/token` | `grant_type=urn:okta:params:oauth:grant-type:webauthn`, `client_id`, `auth_session`, `authn_response`, plus optional `realm`/`scope`/`audience` | Client credentials in the request body |
| Enroll — begin (My Account) | `POST /me/v1/authentication-methods` body `{ "type": "passkey" }` | returns `auth_session` + `authn_params_public_key` | Bearer token, scope `create:me:authentication_methods`, audience `https://{yourDomain}/me/` |
| Enroll — verify (My Account) | `POST /me/v1/authentication-methods/{id}/verify` | `auth_session`, `authn_response` | Same Bearer token |

Both challenge endpoints return `authn_params_public_key` (the WebAuthn `PublicKeyCredential*Options`) plus an `auth_session`. The connection is passed as `realm`, not a separate `connection` field. An `organization` parameter on `/passkey/challenge` is not documented — treat multi-org passkey login as SDK-specific where a leaf exposes it.

## Enrollment (My Account API)

Letting an *already-authenticated* user add a passkey uses the My Account API (the two enroll rows above), not the passkey grant:

- Requires an access token with the `create:me:authentication_methods` scope, minted for the `https://{yourDomain}/me/` audience.
- Requires a **Multi-Resource Refresh Token (MRRT)** policy so the app can obtain that token alongside its API token.
- Two steps: `POST /me/v1/authentication-methods {type:"passkey"}` for the challenge → run the WebAuthn *registration* ceremony → `POST /me/v1/authentication-methods/{id}/verify`.

Only some SDKs expose enrollment directly (`nextjs-auth0`, `react-native-auth0`, `Auth0.swift`); their leaf files document it. For the others, enrollment is a hosted-portal concern — see `feature-universal-portals`.

## MFA interplay and errors

A passkey login can still hit MFA if the tenant/connection requires a second factor. The token exchange surfaces this as an `mfa_required` error (or an `MfaRequiredError` in the SDK) carrying an `mfa_token` — continue with the MFA flow documented in `feature-mfa` (do not re-implement it here).

| Error | Cause | Handling |
|---|---|---|
| `mfa_required` / `MfaRequiredError` | The tenant requires a second factor after the passkey | Continue with the MFA API flow (`feature-mfa`) using the `mfa_token` |
| passkey challenge / registration error | User cancelled, no authenticator, or rpId/domain mismatch | Surface a retry; confirm the custom domain matches the rpId |
| `login_required` on a later silent token call | The passkey flow created no session cookie and refresh tokens were not enabled | Configure `useRefreshTokens` (SPA SDKs) — see the leaf |

## Example code snippets

**Before writing passkey code:** find the detected SDK's row below and **`Read:` the file in its Reference column** (path relative to the skill root). That file has the SDK's exact method/option names, return-type shapes, and the minimum version. It is the trusted source — implement directly from it and do NOT re-verify signatures by grepping `node_modules`, reading `.d.ts`/source, fetching GitHub, or web-searching. No matching row (an SDK not listed)? Passkeys are not supported there via a dedicated SDK API — fall back to hosted Universal Login passkeys.

**Min version** is the earliest release where the passkey API shipped; `verify — X+` marks a version to confirm against the installed package.

| SDK | Min version | Flow(s) | Reference (Read this file) |
|---|---|---|---|
| `@auth0/auth0-react` | 2.18.0 | signup, login | `references/feature-passkeys/auth0-react.md` |
| `@auth0/auth0-vue` | 2.8.0 | signup, login | `references/feature-passkeys/auth0-vue.md` |
| `@auth0/auth0-angular` | 2.10.0 | signup, login | `references/feature-passkeys/auth0-angular.md` |
| `@auth0/auth0-spa-js` | 2.21.0 | signup, login | `references/feature-passkeys/auth0-spa-js.md` |
| `@auth0/nextjs-auth0` | 4.22.0 | signup, login, enrollment | `references/feature-passkeys/nextjs-auth0.md` |
| `@auth0/auth0-server-js` | 1.7.0 | signup, login | `references/feature-passkeys/auth0-server-js.md` |
| `@auth0/auth0-auth-js` | 1.7.0 | signup, login | `references/feature-passkeys/auth0-auth-js.md` |
| `auth0-server-python` | 1.0.0b13 | signup, login | `references/feature-passkeys/auth0-server-python.md` |
| `Auth0.swift` (iOS/macOS/visionOS) | 2.12.0 · 2.13.0 (enrollment) | signup, login, enrollment | `references/feature-passkeys/auth0-swift.md` |
| `Auth0.Android` | 3.2.0 | signup, login | `references/feature-passkeys/auth0-android.md` |
| `react-native-auth0` | 5.7.0 | signup, login, enrollment | `references/feature-passkeys/react-native-auth0.md` |

## Common mistakes

| Mistake | Why it breaks | Correct approach |
|---|---|---|
| No custom domain (using `*.auth0.com`) | Passkeys are bound to the rpId; the default domain cannot be a relying party | Configure and verify a custom domain first |
| Passkey grant not enabled on the app | The token exchange is rejected | Enable `urn:okta:params:oauth:grant-type:webauthn` on the application |
| SPA SDK without `useRefreshTokens` | Passkey flow creates no session cookie, so `getAccessTokenSilently()` later fails `login_required` | Configure `useRefreshTokens: true` (+ Refresh Token Rotation) on SPA SDKs |
| Using a public client for the server token exchange | Server SDK passkey token exchange requires client authentication | Use a confidential client (`clientSecret` / private-key JWT / mTLS) per the leaf |
| Treating a passkey as a second factor | Passkeys here are the primary credential; the MFA reference covers the second-factor case | For step-up, use `feature-mfa`; for passwordless primary login, use this reference |
| Reusing a signup challenge for login (or vice-versa) | Registration and assertion are different ceremonies | Use the signup challenge with `create()` and the login challenge with `get()` |

## References
[Auth0 passkeys documentation](https://auth0.com/docs/authenticate/database-connections/passkeys)
[WebAuthn / passkey grant](https://auth0.com/docs/get-started/applications/passkeys)
