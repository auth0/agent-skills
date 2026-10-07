# @auth0/nextjs-auth0 — Enterprise Connect

**Minimum version:** `4.30.0`; prefer 4.31.1+, which fixes stale transaction
cookies in `startEnterpriseLogin`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. App Router shown; on the Pages
Router use the client helper below.

## Enable relay mode and own the session in `onCallback`

`enterpriseConnect: true` stops the SDK writing its session cookie and makes session methods
(`getSession`, `getAccessToken`) throw `EnterpriseConnectError` (code
`enterprise_connect_not_supported`). `onCallback` is therefore the only place to create the app
session, and it **must return a `NextResponse`**. Edit the project's **existing** `new Auth0Client(...)`
(`lib/auth0.ts`, or `src/lib/auth0.ts` in a `src/` layout) in place - do not create a second
client or a second file:

```typescript
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.AUTH0_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export const auth0 = new Auth0Client({
  enterpriseConnect: true,
  authorizationParameters: { scope: 'openid profile email' }, // no offline_access, no static organization
  async onCallback(error, ctx, session) {
    if (error) throw error;
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login?error=no-session', process.env.APP_BASE_URL));
    }
    const user = session.user;
    const appSession = { sub: user.sub, email: user.email, orgId: user['org_id'] as string };
    const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');

    const res = NextResponse.redirect(new URL(ctx.returnTo ?? '/dashboard', process.env.APP_BASE_URL));
    res.cookies.set('app_session', `${body}.${sig}`, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    });
    return res;
  },
});

export async function getAppSession() {
  const raw = (await cookies()).get('app_session')?.value;
  const [body, sig] = raw?.split('.') ?? [];
  if (!body || !sig) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await key(), Buffer.from(sig, 'base64url'), enc.encode(body));
    return valid ? JSON.parse(Buffer.from(body, 'base64url').toString()) : null;
  } catch {
    return null;
  }
}
```

Keep the project's existing `middleware.ts` / `proxy.ts` (at the root, or under `src/`) calling
`auth0.middleware(request)` - do not add or rename one; it serves `/auth/login`, `/auth/callback`,
`/auth/logout`.

## Discover and start login (server)

`auth0.startEnterpriseLogin({ email, returnTo })` returns a redirect `NextResponse` when the
domain is federated, or `null`. Call it from a **Route Handler** (not a server action) so the
transaction cookie reaches the browser, and re-emit the redirect as 303. `app/api/login/route.ts` (under `src/` if the project uses it):

```typescript
import { auth0 } from '@/lib/auth0';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const email = String((await req.formData()).get('email') ?? '');
  const res = await auth0.startEnterpriseLogin({ email, returnTo: '/dashboard' });
  if (res) {
    const location = res.headers.get('location');
    if (!location) return res;
    const redirect = NextResponse.redirect(location, 303); // 307 -> 303: force GET
    for (const cookie of res.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return NextResponse.redirect(new URL('/login?mode=password', req.url), 303); // not federated
}
```

The login page is a plain `<form method="POST" action="/api/login">` with an `email` input.

## Discover and start login (client component)

The client helper returns `true` once it has started the redirect, `false` when the domain is not
federated. It calls the SDK-mounted routes, so no Route Handler is needed:

```tsx
'use client';
import { startEnterpriseLogin } from '@auth0/nextjs-auth0';

async function onSubmit(email: string) {
  const redirected = await startEnterpriseLogin({ email, returnTo: '/dashboard' });
  if (!redirected) await yourExistingLogin(email);
}
```

## Protect pages

```tsx
const session = await getAppSession(); // NOT auth0.getSession() - it throws in this mode
if (!session) redirect('/login');
```

## Federated logout

Clear the app cookie and hand off to the SDK logout route with `federated=true` and an absolute
`returnTo` that is in Allowed Logout URLs. `app/api/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const returnTo = new URL('/login', process.env.APP_BASE_URL).toString();
  const res = NextResponse.redirect(new URL(
    `/auth/logout?federated=true&returnTo=${encodeURIComponent(returnTo)}`, process.env.APP_BASE_URL));
  res.cookies.set('app_session', '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0,
  });
  return res;
}
```

## Security

`AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` are the B2B Integration's, read from `.env.local` with
`AUTH0_DOMAIN`, `AUTH0_SECRET`, `APP_BASE_URL`. Keep only identity claims in the app cookie, never
the Auth0 tokens. Maintained example:
https://raw.githubusercontent.com/auth0/nextjs-auth0/main/EXAMPLES.md#enterprise-connect-b2b-integration

All calls above are accurate for `@auth0/nextjs-auth0` 4.30.0+ — do not read the SDK source to
re-verify them.
