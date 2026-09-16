# @auth0/nextjs-auth0 — MFA (v4)

**Minimum version:** 4.15.0 for base MFA + the MFA management APIs; reactive popup step-up (`mfa.challengeWithPopup`) landed later (verify — 4.19+; the changelog names it `stepUpWithPopup`, the guide `challengeWithPopup`, so confirm the method name against the installed version).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`.

Singleton client (`lib/auth0.ts`):

```ts
import { Auth0Client } from "@auth0/nextjs-auth0/server";
export const auth0 = new Auth0Client({ mfaTokenTtl: 300 }); // seconds; matches Auth0's mfa_token expiry. Or AUTH0_MFA_TOKEN_TTL env var.
```

MFA methods are on `auth0.mfa` (server, `@auth0/nextjs-auth0/server`) and the `mfa` named export (client, `@auth0/nextjs-auth0/client`). Errors import from `@auth0/nextjs-auth0/errors`.

## Flow 1 — server-side step-up (Route Handler / Server Action)

Force a refresh so the post-login Action runs and can throw `MfaRequiredError`:

```ts
const { token } = await auth0.getAccessToken({ audience: "https://my-api", refresh: true }); // refresh required; default returns cached token
```

Pass `mfa_token` to the MFA page via an **httpOnly cookie**, never the URL:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MfaRequiredError } from "@auth0/nextjs-auth0/server";

} catch (error) {
  if (error instanceof MfaRequiredError) {
    const session = await auth0.getSession();
    (await cookies()).set("mfa_token",
      JSON.stringify({ sub: session?.user.sub, token: error.mfa_token }),
      { httpOnly: true, secure: true, sameSite: "lax", maxAge: 300 });
    redirect("/mfa");
  }
  throw error;
}
```

On `/mfa`, read the cookie back, re-check `sub === session.user.sub`, drive `auth0.mfa.*`, then `cookies().delete("mfa_token")` after a successful verify.

## Flow 2 — MFA management API (`auth0.mfa.*`)

All take `{ mfaToken }`:

- `getAuthenticators({ mfaToken })`
- `enroll({ mfaToken, authenticatorTypes, oobChannels?, phoneNumber?, email? })` — OTP: `["otp"]`; SMS/email/push: `["oob"]` + channel.
- `challenge({ mfaToken, challengeType, authenticatorId })` — OOB only; returns `oobCode` + `bindingMethod`.
- `verify({ mfaToken, otp })` / `({ mfaToken, oobCode, bindingCode })` / `({ mfaToken, recoveryCode })`.

Callable from a Server Component/Action (`auth0.mfa.verify`) or a client component (`import { mfa } from "@auth0/nextjs-auth0/client"`).

## Flow 3 — reactive popup step-up (client components)

`mfa.challengeWithPopup()` calls `window.open()`, so it **must run from a direct user-gesture handler** (a button `onClick`), never from an async `catch`:

```tsx
"use client";
import { getAccessToken, mfa } from "@auth0/nextjs-auth0/client";
import { MfaRequiredError } from "@auth0/nextjs-auth0/errors";

async function handleStepUp() {
  const { token } = await mfa.challengeWithPopup({ audience: "https://api.example.com" });
  await callApi(token);
}
```

Options: `audience` (required), `scope`, `acr_values` (defaults to the PAPE MFA URI), `timeout` (ms, default 60000), `popupWidth`/`popupHeight`. Popup errors: `PopupBlockedError`, `PopupCancelledError`, `PopupTimeoutError`, `PopupInProgressError`, `ExecutionContextError` (called server-side). If a CSP blocks inline scripts, set `cspNonce` on `Auth0Client` or the popup completes but `postMessage` never returns (`PopupTimeoutError`).

## Reading `amr`

v4 persists only a default claim subset. To enforce a specific factor server-side, copy `amr` into the session with a `beforeSessionSaved` hook (`session.user.amr`) — see the `amr` opt-in note in `index.md`.

## Server error classes

`MfaRequiredError`, `MfaTokenNotFoundError`, `MfaTokenExpiredError`, `MfaTokenInvalidError`, `MfaGetAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` (from `@auth0/nextjs-auth0/errors`).

Source: https://github.com/auth0/nextjs-auth0/blob/main/guides/mfa.md
