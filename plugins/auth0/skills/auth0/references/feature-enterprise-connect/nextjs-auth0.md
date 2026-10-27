# @auth0/nextjs-auth0 — Enterprise Connect

**Minimum version:** `4.30.0`; prefer 4.31.1+, which fixes stale transaction
cookies in `startEnterpriseLogin`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. App Router shown; on the Pages
Router use the client helper below.

## Enable relay mode and own the session in `onCallback`

`enterpriseConnect: true` stops the SDK writing its session cookie and blocks every `Auth0Client`
member except `middleware`, `startInteractiveLogin`, `startEnterpriseLogin` and
`customTokenExchange`: `getSession`, `getAccessToken`, `updateSession`, `createFetcher`, etc.
reject with `EnterpriseConnectError` (code `enterprise_connect_not_supported`). `onCallback` is
therefore the only place to create the app session, and it **must return a `NextResponse` on every
path, including errors**; a thrown error becomes a 500. Put the one `Auth0Client` in `lib/auth0.ts`
(`src/lib/auth0.ts` in a `src/` layout); if the project already has one, edit it in place - do not
create a second client or a second file. Credentials are the B2B Integration's:

```typescript
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.APP_SESSION_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const SESSION_MS = 8 * 60 * 60 * 1000;

export const auth0 = new Auth0Client({
  enterpriseConnect: true,
  authorizationParameters: { scope: 'openid profile email' }, // no offline_access, no static organization
  async onCallback(error, ctx, session) {
    if (error || !session?.user) {
      return NextResponse.redirect(new URL('/login?error=sso', process.env.APP_BASE_URL));
    }
    const user = session.user;
    const appSession = {
      sub: user.sub, email: user.email, orgId: user['org_id'] as string, exp: Date.now() + SESSION_MS,
    };
    const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');

    const res = NextResponse.redirect(new URL(ctx.returnTo ?? '/dashboard', process.env.APP_BASE_URL));
    res.cookies.set('app_session', `${body}.${sig}`, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      maxAge: SESSION_MS / 1000, // Next.js maxAge is seconds
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
    if (!valid) return null;
    const session = JSON.parse(Buffer.from(body, 'base64url').toString());
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}
```

`app_session` and `getAppSession` are only for an app with no session layer. If the app has one (e.g.
a `createSession` helper), call it from `onCallback` and add no second cookie or reader.

`auth0.middleware(request)` must run from `proxy.ts` (Next 16, `export async function proxy`) or
`middleware.ts` (Next 15) - check `next` in `package.json` - at the root or under `src/`, matching all paths except static assets; it
serves `/auth/login`, `/auth/callback`, `/auth/logout` and `/auth/federated-domain`. Keep an existing one - do not add a second
or rename it.

## Discover and start login (server)

`auth0.startEnterpriseLogin({ email, returnTo })` returns a redirect `NextResponse` when the
domain is federated, or `null` (also `null` for an email without a domain). It runs Home Realm
Discovery and sets `login_hint` from `email`, so do not pass `connection` or `organization`. Call
it from a **Route Handler** (not a server action) so the `__txn_*` transaction cookie reaches the
browser, and re-emit the 307 redirect as 303 so the browser follows it with GET. `app/api/login/route.ts` (under `src/` if the project uses it):

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
  // Domain is not federated, handle with your own login -
  // replace '/login?mode=password' with your existing login route
  return NextResponse.redirect(new URL('/login?mode=password', req.url), 303);
}
```

The login page is a plain `<form method="POST" action="/api/login">` with an `email` input.

## Discover and start login (client component)

The client helper returns `Promise<boolean>`: `true` once it has navigated to `/auth/login`,
`false` when the domain is not federated. It POSTs to the SDK-mounted `/auth/federated-domain` and
navigates to `/auth/login`, so no Route Handler is needed and it works on the Pages Router:

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

Clear the app cookie and hand off to the SDK logout route with an absolute `returnTo` that is in
Allowed Logout URLs. The route defaults to federated logout in this mode (ending the enterprise IdP
session); `federated=true` is kept explicit, and `federated=false` would leave the IdP session
alive. `app/api/logout/route.ts`:

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
`AUTH0_DOMAIN`, `AUTH0_SECRET` (the SDK's), `APP_SESSION_SECRET` (signs `app_session`; reuse the app's existing session secret if it has one), `APP_BASE_URL`. `session.user` carries every raw ID token claim: keep only the
claims you need in the app cookie, never the Auth0 tokens (the access token cannot be renewed; EC
issues no refresh token). Maintained example:
https://raw.githubusercontent.com/auth0/nextjs-auth0/main/EXAMPLES.md#enterprise-connect-b2b-integration

All calls above are accurate for `@auth0/nextjs-auth0` 4.30.0+ — do not read the SDK source to
re-verify them.
