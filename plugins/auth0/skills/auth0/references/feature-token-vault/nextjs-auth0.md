# @auth0/nextjs-auth0 — Token Vault

**Minimum version:** 4.4.0 for `getAccessTokenForConnection`; `subject_token_type` option **4.10.0**;
Connected Accounts (`enableConnectAccountEndpoint`, `/auth/connect`, `connectAccount`) **4.11.0**;
`scopes` on connect **4.13.0**; `getConnectedAccounts` / `disconnectAccount` **4.28.0**.

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. Everything here is **server-only**, on the
`Auth0Client` from `@auth0/nextjs-auth0/server`. Options are **snake_case** (`login_hint`,
`subject_token_type`). Errors import from `@auth0/nextjs-auth0/errors`.

The session must hold a refresh token: keep `offline_access` in the login scope (it is in the SDK's
default scope — don't drop it if you override `authorizationParameters.scope`). It is required even
when you pick the access-token subject type.

## 1. Let the user connect the account

```ts
// lib/auth0.ts
import { NextResponse } from 'next/server';
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  enableConnectAccountEndpoint: true, // mounts GET /auth/connect (off by default)
  async onCallback(err, ctx, session) {
    // Handle failures first — a failed login or connect must not redirect as if it succeeded.
    if (err) return new NextResponse(err.message, { status: 500 });
    const appBaseUrl = ctx.appBaseUrl ?? process.env.APP_BASE_URL;
    // ctx.connectedAccount is set when this callback finished a connect flow
    return NextResponse.redirect(new URL(ctx.returnTo ?? '/', appBaseUrl));
  },
});
```

Then link the user to `/auth/connect?connection=google-oauth2&returnTo=/settings` (add repeated
`scopes=` query params for provider scopes). The SDK middleware (`middleware.ts`, or `proxy.ts` on
Next 16) must be mounted. To start the flow from code instead, return `auth0.connectAccount(...)`
from a Route Handler:

```ts
// app/connect/google/route.ts
import { auth0 } from '@/lib/auth0';

export async function GET() {
  return auth0.connectAccount({
    connection: 'google-oauth2',
    scopes: ['openid', 'profile', 'https://www.googleapis.com/auth/calendar.readonly'],
    returnTo: '/settings',
  });
}
```

`ConnectAccountOptions`: `connection` (required), `scopes`, `authorizationParams` (put `login_hint`
here), `returnTo`. List and remove with `auth0.getConnectedAccounts()` and
`auth0.disconnectAccount({ connection })` (disconnects **every** account on that connection).

## 2. Get the provider token

```ts
// app/api/calendar/route.ts
import { NextResponse } from 'next/server';
import { AccessTokenForConnectionError } from '@auth0/nextjs-auth0/errors';
import { auth0 } from '@/lib/auth0';

export async function GET() {
  try {
    const { token } = await auth0.getAccessTokenForConnection({ connection: 'google-oauth2' });
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await res.json());
  } catch (err) {
    if (err instanceof AccessTokenForConnectionError) {
      // missing_session / missing_refresh_token → log in again (keep offline_access)
      // failed_to_exchange_refresh_token → account missing or disconnected → send to /auth/connect
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    throw err;
  }
}
```

The return value is an **object** `{ token, expiresAt, scope? }`, not a string. The SDK caches it in
the session per `connection` + `login_hint`. Pages Router / middleware: pass `(options, req, res)`.

## Security and placement

Call these from **Route Handlers, Server Actions, or middleware** — never pass the token to a Client
Component. In a Server Component `getAccessTokenForConnection` works but cannot persist the cached
token (RSCs can't set cookies). **Never call `connectAccount`, `getConnectedAccounts`, or
`disconnectAccount` from a Server Component** — they may rotate the session's refresh token, the
cookie write is dropped, and the user is logged out on the next refresh.

Catch `AccessTokenForConnectionError` (some upstream docs say `AccessTokenError`; the method throws
`AccessTokenForConnectionError`). Connect-flow errors are `ConnectAccountError` / `MyAccountApiError`.
These names, imports, and options are accurate for nextjs-auth0 4.28.0+; do not grep
`node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/nextjs-auth0/blob/76e7368549573b90ed25f4138270e75be1653c7f/EXAMPLES.md#L4149-L4376
