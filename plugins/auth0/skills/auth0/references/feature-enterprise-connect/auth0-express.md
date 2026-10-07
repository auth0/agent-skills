# @auth0/auth0-express — Enterprise Connect

**Minimum version:** `1.0.0-beta.3` (informational - any `1.0.0-beta.3`+ pre-release or the
`1.0.0` stable has it; do not upgrade a pinned beta). Enterprise Connect is **not** in
`express-openid-connect`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference.

## Enable relay mode with `onCallback`

With `enterpriseConnect: true` the SDK writes no Auth0 session, and `getSession` / `getUser` /
`getAccessToken` throw `EnterpriseConnectNotSupportedError`. `onCallback` is **required** (config
throws without it): the mounted `/auth/callback` calls it after the code exchange, and it must
write the app session and **end the response** - otherwise the SDK answers 500
`callback_not_resolved`.

Edit the app's **existing** `createAuth0(...)` call: add `enterpriseConnect: true` and `onCallback`,
and drop `audience`. Do not mount a second `createAuth0` instance for the enterprise flow -
`req.auth0` is shared, so the last-mounted instance wins for every route. Use the environment
loading the app already has (e.g. `node --env-file=.env`); no `dotenv` or `cookie-parser` is needed:

```typescript
import express, { Request, Response } from 'express';
import { createAuth0 } from '@auth0/auth0-express';

export const app = express();
app.use(express.urlencoded({ extended: false }));

const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.AUTH0_SESSION_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

app.use(
  createAuth0({
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    appBaseUrl: process.env.APP_BASE_URL!,
    sessionSecret: process.env.AUTH0_SESSION_SECRET!,
    enterpriseConnect: true,
    async onCallback(req: Request, res: Response, { user, appState }) {
      if (!user) return res.redirect('/login?error=no-session');
      const appSession = { sub: user.sub, email: user.email, name: user.name, orgId: (user['org_id'] as string) ?? '' };
      const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
      const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');
      res.cookie('app_session', `${body}.${sig}`, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
      });
      res.redirect((appState as { returnTo?: string } | undefined)?.returnTo ?? '/dashboard');
    },
  })
);
```

Do not request `offline_access`.

## Discover and start login

`startEnterpriseLogin(req, res, { email, returnTo })` runs domain discovery; when federated it
redirects to Auth0 with `login_hint` and resolves `true`, otherwise it does nothing and resolves
`false`:

```typescript
import { startEnterpriseLogin } from '@auth0/auth0-express';

app.post('/login', async (req, res, next) => {
  try {
    const redirected = await startEnterpriseLogin(req, res, {
      email: String(req.body.email ?? ''),
      returnTo: '/dashboard',
    });
    if (!redirected) res.redirect('/login?mode=password'); // not federated: your existing login
  } catch (err) {
    next(err);
  }
});
```

## Protect routes

`requiresAuth()` calls `getUser()` and fails in this mode. Replace any existing guard that calls
`req.auth0.client.getSession()` / `getUser()` with your own middleware that reads the signed
cookie, verifies it, and redirects to `/login` when it is missing or invalid. `req.cookies` is
undefined without `cookie-parser`, so read the raw header:

```typescript
import type { NextFunction } from 'express';

async function getAppSession(req: Request) {
  const raw = req.headers.cookie?.split(';').map((c) => c.trim())
    .find((c) => c.startsWith('app_session='))?.slice('app_session='.length);
  const [body, sig] = raw ? decodeURIComponent(raw).split('.') : [];
  if (!body || !sig) return null;
  const valid = await crypto.subtle.verify('HMAC', await key(), Buffer.from(sig, 'base64url'), enc.encode(body));
  return valid ? JSON.parse(Buffer.from(body, 'base64url').toString()) : null;
}

async function requireAppSession(req: Request, res: Response, next: NextFunction) {
  const session = await getAppSession(req);
  if (!session) return res.redirect('/login');
  res.locals.user = session;
  next();
}
```

A pre-existing route that needs an Auth0 access token (`getAccessToken()`) cannot work in relay
mode (identity-only); guard it with `requireAppSession` instead of calling the SDK.

## Federated logout

The mounted `/auth/logout` is forced federated in this mode, but its `returnTo` defaults to the
base URL. Do not re-register your own handler on `/auth/logout` (it collides with the mounted
route). To return to a registered Allowed Logout URL such as `/login`, add a separate route:

```typescript
app.get('/logout', async (req, res, next) => {
  try {
    res.clearCookie('app_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    const logoutUrl = await req.auth0.client.logout({
      returnTo: `${process.env.APP_BASE_URL}/login`,
      federated: true,
    });
    res.redirect(logoutUrl.href);
  } catch (err) {
    next(err);
  }
});
```

## Security

The B2B Integration's Client ID and secret and the session secret come from the environment,
never source. Keep only identity claims in the app cookie, never the Auth0 tokens. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-express/main/packages/auth0-express/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-express` 1.0.0-beta.3+ — do not read the SDK source to
re-verify them.
