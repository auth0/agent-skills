# Auth0 passkeys

Sign a user in, or sign a new user up, with a passkey — a WebAuthn/FIDO2 platform credential (Face ID / Touch ID, fingerprint, device screen-lock, or a security key) used as the *primary*, passwordless factor. For MFA (a passkey or biometric as a *second* factor after a password) use `feature-mfa`; for a hosted portal where a signed-in user *manages* their passkeys use `feature-universal-portals`. Adding the app's first login at all is a `framework-*` concern — this reference assumes you are wiring the passkey ceremony, not the base SDK.

## When to use / when NOT to use

**Use when** the app must:

- Let an existing user sign in with a passkey instead of a password (passwordless login).
- Let a new user sign up and register their first passkey in one flow.
- Drive the WebAuthn ceremony from app code (SPA, server, or native) rather than delegating it to Universal Login.

**Do NOT use this reference when:**

- Passkeys are being added as a *second factor* on top of a password login — that is `feature-mfa` (the token grant differs; MFA uses the `mfa_token` flow, passkeys use the WebAuthn grant).
- A signed-in user needs a self-service screen to add/rename/remove passkeys — that is the My Account surface behind `feature-universal-portals`, not the sign-in/sign-up ceremony here.
- The app redirects to Universal Login and lets the hosted page handle passkeys — no SDK passkey API is involved; this is ordinary redirect login (`framework-*`).
- The app has no login at all yet — add it with the `framework-*` reference first.

## Concepts

- **Passkey** — a WebAuthn/FIDO2 credential bound to the platform authenticator and to the relying-party origin (your domain). Never a shared secret; the private key never leaves the device.
- **Relying Party (RP) ID** — the *domain string* (no scheme, no port) the credential is scoped to. The browser origin must be HTTPS and its effective domain must equal the RP ID or be a subdomain of it. Auth0 derives the RP ID from your **custom domain**; the credential will not work on the default `*.auth0.com` domain.
- **Attestation vs assertion** — sign-up produces an *attestation* (a new credential); sign-in produces an *assertion* (a proof from an existing credential). The same token-exchange call handles both; only the credential fields differ.
- **Auth session** — a short-lived (~5 min) opaque token that ties a challenge to its later token exchange. A Tier-1 secret: never log or persist it.

## SDK integration

Every SDK implements the same **three-beat ceremony**, differing only in who drives the authenticator:

1. **Challenge** — ask Auth0 for a challenge (sign-up: register challenge; sign-in: login challenge). It returns an `auth_session` plus the WebAuthn public-key options.
2. **Authenticator** — hand those options to the platform authenticator, which prompts the user (biometric / screen-lock / security key) and produces a credential. On the web this is `navigator.credentials.create` (sign-up) / `.get` (sign-in); on iOS it is `ASAuthorizationController`; on Android it is the AndroidX `CredentialManager`.
3. **Token exchange** — send the serialized credential plus the `auth_session` back to Auth0's token endpoint under the WebAuthn grant. Auth0 returns tokens (and server SDKs persist the session).

**Pick one shape** based on the SDK layer:

- **Browser one-call** (`@auth0/auth0-spa-js`, `@auth0/auth0-react`, `@auth0/nextjs-auth0` client) — a single awaited sign-up / sign-in method runs all three beats internally: it fetches the challenge, decodes the base64url fields, calls `navigator.credentials.*`, serializes the credential, and exchanges it. The app calls one method and handles errors. This is the default for a browser app.
- **Step-by-step / server-driven** (`@auth0/nextjs-auth0` server actions, `@auth0/auth0-auth-js`, `@auth0/auth0-server-js`, `auth0-server-python`) — the SDK does beats 1 and 3; **the browser** does beat 2 and serializes the credential. The challenge call returns `{auth_session, publicKey}`; the browser runs `navigator.credentials.*`, serializes to base64url; the token-exchange call takes `{auth_session, credential}`. Server SDKs also persist the session.
- **Native** (`Auth0.swift`, `Auth0.Android`) — the SDK does beats 1 and 3; the OS authenticator (Apple `ASAuthorization*` / AndroidX `CredentialManager`) does beat 2. Store the returned credentials via `CredentialsManager` / `SecureCredentialsManager`.

Before writing code, read the detected SDK's example (see "Example code snippets") — the method names, option structs, and the exact serialization helper are SDK-specific and live there, not in this reference.

### Feature-level symbols

Protocol-level names that are identical across every SDK — what a grader would assert and what the app must get right regardless of language:

| Symbol | Meaning |
|---|---|
| `urn:okta:params:oauth:grant-type:webauthn` | The `grant_type` the token exchange runs under. The SDK sends it; never hand-build this request. |
| `auth_session` (a.k.a. `authSession`) | Short-lived (~5 min) token from the challenge, replayed on the token exchange. Tier-1 secret. |
| `publicKey` / `authn_params_public_key` | The WebAuthn `PublicKeyCredentialCreationOptions` (sign-up) or `RequestOptions` (sign-in) returned in the challenge. Binary fields are base64url and MUST be decoded to `ArrayBuffer` before `navigator.credentials.*`. |
| `navigator.credentials.create` / `.get` | Browser authenticator call — `create` for sign-up (attestation), `get` for sign-in (assertion). |
| `mfa_required` | Surfaced (not swallowed) on the token exchange when the tenant also requires MFA; detect it and chain into the MFA flow. No session is persisted until MFA completes. |
| `openid` scope | Required — the exchange must return an `id_token`; some SDKs reject a missing one. |

SDK-specific symbols — the challenge/exchange method names, the option structs, each SDK's `serializeCredential` equivalent, the refresh-token requirement — are **not** listed here; get them from the SDK's own example (see "Example code snippets").

### Example code snippets

**Before writing passkey code:** find the row matching the detected SDK and read the named section from its URL (a large `EXAMPLES.md` — read from that heading down to the next `## `; with `WebFetch` ask for just that section verbatim). No matching row (an SDK not listed below), or the fetch fails? Fall back to the language-neutral three-beat mechanic above. Never substitute a web search for "how to do passkeys".

| SDK / package | Raw example file (markdown) | Find section |
|---|---|---|
| `@auth0/auth0-spa-js` | https://raw.githubusercontent.com/auth0/auth0-spa-js/main/examples/passkeys.md | whole file |
| `@auth0/auth0-react` | https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md | `## Passkeys` |
| `@auth0/nextjs-auth0` | https://raw.githubusercontent.com/auth0/nextjs-auth0/main/EXAMPLES.md | `## Passkey Authentication` |
| `auth0-server-python` | https://raw.githubusercontent.com/auth0/auth0-server-python/main/examples/Passkeys.md | whole file |
| `@auth0/auth0-auth-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-auth-js/examples/passkeys.md | whole file |
| `@auth0/auth0-server-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/EXAMPLES.md | `## Login and Signup using Passkeys` |
| `Auth0.swift` (sign-in) | https://raw.githubusercontent.com/auth0/Auth0.swift/master/examples/authentication-api/login-passkey.md | whole file |
| `Auth0.swift` (sign-up) | https://raw.githubusercontent.com/auth0/Auth0.swift/master/examples/authentication-api/signup-passkey.md | whole file |
| `Auth0.Android` | https://raw.githubusercontent.com/auth0/Auth0.Android/main/examples/passkeys.md | whole file |

Redirect-only and resource-server SDKs — `express-openid-connect`, `express-oauth2-jwt-bearer`, `@auth0/auth0-api-js` — expose **no** passkey API. `express-openid-connect` redirects to Universal Login, which handles passkeys itself; the other two operate only after tokens are issued. There is nothing to call in these SDKs.

## Tenant configuration

Passkey sign-in/sign-up needs these before any SDK call will succeed:

- **A custom domain** — it serves as the WebAuthn RP ID. The default `*.auth0.com` domain does not work with passkeys.
- **The WebAuthn grant type** (`urn:okta:params:oauth:grant-type:webauthn`) enabled on the Auth0 application.
- **The passkey authentication method** enabled on the database connection.
- **Web:** the app origin listed under the application's Allowed Web Origins.
- **iOS:** an Associated Domains capability (`webcredentials:<domain>`) and the app signed with the Team ID configured in the Auth0 app's iOS settings.
- **Android:** Digital Asset Links (`/.well-known/assetlinks.json`) published so the OS trusts the relying party.

The exact CLI/Terraform commands for the custom domain, the application grant type, and the connection's authentication methods are owned by the loaded `tooling-*` reference (DEFER ACROSS). The Auth0 MCP server exposes no passkey-configuration tool, so this is CLI or Terraform only.

## Common mistakes

| Mistake | Why it breaks | Correct approach |
|---|---|---|
| Using the default `*.auth0.com` domain | WebAuthn binds the credential to the RP origin; the default domain is not a valid RP for passkeys | Configure and use a custom domain before wiring passkeys |
| Browser SPA without refresh tokens (`useRefreshTokens`) | Passkey login sets no Auth0 session cookie, so silent renewal fails with `login_required` — or silently returns tokens for a *different* user if a stale redirect session cookie exists | Enable refresh tokens + Refresh Token Rotation on `@auth0/auth0-spa-js` / `@auth0/auth0-react` |
| Passing the base64url `publicKey` fields to `navigator.credentials.*` without decoding | WebAuthn requires `ArrayBuffer`; raw strings throw or silently fail | Decode challenge/id fields to `ArrayBuffer` first (the one-call SDK methods do this for you) |
| Form-encoding the token exchange | The WebAuthn grant embeds a nested credential object that can't be URL-encoded → 400 | Let the SDK send it as JSON; never hand-build the `/oauth/token` request |
| Re-implementing the credential serialization inline | Duplicates SDK-owned base64url logic and drifts | Import the SDK's serialize helper (e.g. `serializeCredential`) instead of copying it |
| Sending `private_key_jwt` / mTLS to the register or challenge endpoints | Those endpoints accept `client_secret` (`client_secret_post`) only; other creds are treated as a public client and rejected | Use the client secret for register/challenge; the token exchange supports all client-auth methods |
| Logging or persisting the `auth_session` | It is a short-lived Tier-1 secret; leaking it undermines the ceremony | Keep it in memory only; re-request the challenge if it expires |
| Swallowing `mfa_required` on the exchange | The login silently stalls or the app treats an incomplete auth as done | Detect it and chain into the MFA flow; persist no session until MFA finishes |
| Android: not chaining `.validateClaims()` on sign-in | Skips ID-token validation (issuer/audience/nonce/expiry); the SDK only warns | Chain `.validateClaims()` before starting the sign-in request |
| Android: `PasskeyAuthProvider` / `PasskeyProvider` / `PasskeyManager` | Deprecated (v3) / removed (v4) | Use `AuthenticationAPIClient`'s passkey methods with AndroidX `CredentialManager` directly |
| Hand-building the credential or hardcoding/reusing `rpId` or the challenge | The credential must come from the platform authenticator; the challenge and `rpId` come from the SDK's challenge object | Always drive beat 2 through `navigator.credentials.*` / `ASAuthorization` / `CredentialManager` |

## Related capabilities

- **Base login** — the SDK's setup, token storage, and route protection live in that SDK's `framework-*` reference; passkey sign-in replaces the password step but relies on the same session/token handling.
- **MFA** — a passkey as a *second* factor (after a password) is `feature-mfa`, which uses the `mfa_token` grant, not the WebAuthn grant.
- **Self-service passkey management** — adding/removing a signed-in user's passkeys is a My Account surface behind `feature-universal-portals` (and the My Account API), out of scope here.
- **Tenant setup** — `tooling-cli` and `tooling-terraform` own the custom domain, application grant type, and connection authentication-method configuration.
- **DPoP** — where supported (`auth0-server-python`, `@auth0/nextjs-auth0`, `@auth0/auth0-auth-js`/`auth0-server-js`), the passkey token exchange can be sender-constrained; see `feature-dpop`.

## References
[Passwordless authentication with passkeys](https://auth0.com/docs/authenticate/database-connections/passkeys)
[WebAuthn](https://auth0.com/docs/secure/multi-factor-authentication/fido-authentication-with-webauthn)
