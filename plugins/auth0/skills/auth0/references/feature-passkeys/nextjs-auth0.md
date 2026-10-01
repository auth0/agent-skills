# @auth0/nextjs-auth0 — Passkeys

**Minimum version:** `4.22.0` (passkey signup/login + My Account enrollment).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

This SDK gives you two ways to build passkeys:

- **Server methods** (`auth0.passkey.*`) — you own the route handlers / server actions and drive the ceremony yourself, keeping the token exchange and client secret server-side. Use this when you build a custom signup / sign-in / account-settings UI, or when the task asks you to own the flow. See "Server — build the ceremony yourself" below.
- **Client one-call wrappers** (`passkey.signup()` / `passkey.login()` from `@auth0/nextjs-auth0/client`) — a shortcut over the SDK's built-in route handlers (`auth0.middleware()` mounts `/auth/passkey/register`, `/challenge`, `/get-token`, `/enrollment-challenge`, `/enrollment-verify`) that runs the whole flow in one call. Convenient, but gives you no control over the individual steps.

## Client — signup / login (high-level, one call)

Shortcut only — if you need to own the routes or control the individual steps, use "Server — build the ceremony yourself" below instead. The client helper runs the whole flow (challenge → WebAuthn ceremony → get-token → session) in one call and returns `Promise<void>`:

```tsx
"use client";
import { passkey } from "@auth0/nextjs-auth0/client";

// Signup: at least one identifier; profile fields depend on the connection's Attributes config
await passkey.signup({ email: "user@example.com", name: "Jane Doe" });

// Login
await passkey.login();
```

`PasskeyRegisterOptions` accepts `email`, `username`, `phoneNumber`, `name`, `givenName`, `familyName`, `nickname`, `picture`, `userMetadata`, `connection`, `organization`. The client module also exports `serializeCredential`.

## Client — enrollment (add a passkey to an authenticated account)

Requires an access token with `create:me:authentication_methods` and an MRRT policy for the `https://{yourDomain}/me/` audience (the SDK auto-exchanges the session refresh token via MRRT). See the hub's Enrollment section.

```tsx
"use client";
import { passkey } from "@auth0/nextjs-auth0/client";

const challenge = await passkey.enrollmentChallenge(/* { connection?, userIdentityId? } */);
// runs the WebAuthn registration ceremony
const method = await passkey.enrollmentVerify(/* { authenticationMethodId, authSession, authResponse } */);
// method: PasskeyEnrollmentVerifyResponse — the registered auth method (id, type: "passkey", ...)
```

- `passkey.signup(options?)` / `passkey.login(options?)` → `Promise<void>`.
- `passkey.enrollmentChallenge(options?)` → `PasskeyEnrollmentChallengeResponse` (`{ authenticationMethodId, authSession, authnParamsPublicKey }`).
- `passkey.enrollmentVerify(options)` → `PasskeyEnrollmentVerifyResponse`.

## Server — build the ceremony yourself (`auth0.passkey.*`)

You own the route handlers / server actions; only the WebAuthn call runs in the browser. Every `auth0.passkey.*` call is server-side, so the client secret and token exchange never reach the browser. Each flow is the same shape: **server challenge → browser WebAuthn → serialize → server exchange.**

### Signup

```ts
// server (route handler / server action)
import { auth0 } from "@/lib/auth0";
const { authSession, authnParamsPublicKey } = await auth0.passkey.register({ email, name }); // PasskeyRegisterResponse
// send authSession + authnParamsPublicKey to the browser
```

```tsx
"use client";
import { serializeCredential } from "@auth0/nextjs-auth0/client";
// authnParamsPublicKey is JSON with base64url binary fields — decode them to ArrayBuffers first
const publicKey = { ...authnParamsPublicKey, challenge: b64urlToBuf(authnParamsPublicKey.challenge),
  user: { ...authnParamsPublicKey.user, id: b64urlToBuf(authnParamsPublicKey.user.id) },
  excludeCredentials: authnParamsPublicKey.excludeCredentials?.map(c => ({ ...c, id: b64urlToBuf(c.id) })) };
const credential = await navigator.credentials.create({ publicKey });
const authResponse = serializeCredential(credential as PublicKeyCredential); // POST { authSession, authResponse } back
```

```ts
// server: establish the session
await auth0.passkey.getToken({ authSession, authResponse }); // → Promise<void>
```

### Sign-in

Same shape with `auth0.passkey.challenge()` (→ `{ authSession, authnParamsPublicKey }`), `navigator.credentials.get({ publicKey })` (decode `challenge` and each `allowCredentials[].id`), then `auth0.passkey.getToken({ authSession, authResponse })`.

### Enrollment (signed-in user — adds a passkey to the current account, not a new signup)

```ts
const { authenticationMethodId, authSession, authnParamsPublicKey } = await auth0.passkey.enrollmentChallenge(); // PasskeyEnrollmentChallengeResponse
// browser: decode + navigator.credentials.create + serializeCredential → authResponse, POST back
await auth0.passkey.enrollmentVerify({ authenticationMethodId, authSession, authResponse }); // PasskeyEnrollmentVerifyResponse
```

### Notes

- `getToken(options)` → `Promise<void>`; the credential field is **`authResponse`** (a serialized `PasskeyAuthResponse`), not `credential`.
- **Only `serializeCredential` is exported for the browser step.** The SDK does not export a decoder for `authnParamsPublicKey`, so decode its base64url binary fields (`challenge`, `user.id`, `excludeCredentials[].id` / `allowCredentials[].id`) to `ArrayBuffer`s yourself with a tiny base64url→buffer helper. Do **not** pull in `@simplewebauthn` — it double-encodes and breaks the exchange.
- **Pages Router / Middleware overloads:** `register(req, options?)`, `challenge(req, options?)`, `enrollmentChallenge(req, options?)`, `enrollmentVerify(req, options)` take `req: NextRequest`; only `getToken(req, res, options)` needs both `NextRequest` and `NextResponse` (wrong arity throws a `TypeError`).

## SDK-specific gotchas

- The application must be a **confidential client** — the server token exchange authenticates with the client secret.
- **Production requires a Custom Domain** (it becomes the passkey `rpId`); for local dev the `rpId` is just `localhost`, which works without a custom domain.
- The client wrappers (`@auth0/nextjs-auth0/client`) do the whole flow — do not also call the server `register`/`challenge` from a client component; those are server-only.
- `getToken()` can throw `mfa_required` (rethrown by the client verify path) — continue with the MFA flow (see the hub, then `feature-mfa`).
- Enrollment requires the MRRT policy; without it the My Account access token cannot be minted.
