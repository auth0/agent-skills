# @auth0/auth0-express — Enterprise Connect

**Minimum version:** `1.0.0-beta.3` (informational - any `1.0.0-beta.3`+ pre-release or the
`1.0.0` stable has it; do not upgrade a pinned beta). Enterprise Connect is **not** in
`express-openid-connect`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference.

## Enable relay mode with `onCallback`

With `enterpriseConnect: true` the SDK writes no Auth0 session, and every `req.auth0.client`
method except `startInteractiveLogin`, `startEnterpriseLogin`, `completeInteractiveLogin`,
`logout`, `customTokenExchange`, and `handleBackchannelLogout` throws
`EnterpriseConnectNotSupportedError` (code `enterprise_connect_not_supported`) - notably
`getSession`, `getUser`, `getAccessToken`. `domain` must be a static string. `createAuth0` has no
scope option and never requests `offline_access`. `onCallback` is **required** (config throws
`InvalidConfigurationError` without it): the mounted `/auth/callback` calls it after the code
exchange with `{ idTokenClaims, user, appState }`, and it must write the app session and **end the
response** - otherwise the SDK answers 500 `callback_not_resolved`.

Mount one `createAuth0(...)` with the B2B Integration's credentials, `enterpriseConnect: true`, and
`onCallback` (if the app already mounts one, add the options to that call and drop `audience`). Do
not mount a second instance - `req.auth0` is shared, so the last-mounted one wins for every route.
Mount it before every route or middleware that uses `req.auth0` or `req.cookies`: it runs
`cookie-parser` itself, so an existing `app.use(cookieParser())` can stay but is not required for
code mounted after it. Load the env the way the app already does (`import 'dotenv/config'`,
`node --env-file=.env`):

```typescript
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createAuth0, startEnterpriseLogin } from '@auth0/auth0-express';

export const app = express();
app.use(express.urlencoded({ extended: false }));

const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.APP_SESSION_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const SESSION_MS = 8 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' } as const;

app.use(
  createAuth0({
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    appBaseUrl: process.env.APP_BASE_URL!,
    sessionSecret: process.env.AUTH0_SESSION_SECRET!, // encrypts the login-transaction cookie only
    enterpriseConnect: true,
    async onCallback(req, res, { user, appState }) {
      if (!user) return res.redirect('/login?error=no-session');
      const appSession = {
        sub: user.sub, email: user.email, name: user.name, orgId: user.org_id ?? '',
        exp: Date.now() + SESSION_MS,
      };
      const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
      const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');
      res.cookie('app_session', `${body}.${sig}`, { ...cookieOptions, maxAge: SESSION_MS });
      res.redirect((appState as { returnTo?: string } | undefined)?.returnTo ?? '/dashboard');
    },
  })
);
```

Sign the app cookie with a secret separate from `sessionSecret` (reuse the app's existing session
secret if it has one).

## Discover and start login

`startEnterpriseLogin(req, res, { email, returnTo })` runs domain discovery; when federated it
redirects to Auth0 with `login_hint` and resolves `true`, otherwise it does nothing and resolves
`false` (also for a malformed email). `returnTo` is saved as `appState.returnTo` unsanitized - pass
a fixed same-origin path, never a request parameter. Errors propagate, so catch them:

```typescript
app.post('/login', async (req, res, next) => {
  try {
    const redirected = await startEnterpriseLogin(req, res, {
      email: String(req.body.email ?? '').trim(),
      returnTo: '/dashboard',
    });
    if (!redirected) {
      // Domain is not federated, handle with your own login -
      // replace '/login?mode=password' with your existing login route
      res.redirect('/login?mode=password');
    }
  } catch (err) {
    next(err);
  }
});
```

## Protect routes

`requiresAuth()` calls `getUser()` and fails in this mode. Replace any existing guard that calls
`req.auth0.client.getSession()` / `getUser()` with your own middleware that reads the signed
cookie, verifies it, and redirects to `/login` when it is missing, invalid, or expired:

```typescript
async function requireAppSession(req: Request, res: Response, next: NextFunction) {
  const [body, sig] = (req.cookies?.['app_session'] as string | undefined)?.split('.') ?? [];
  try {
    if (body && sig && await crypto.subtle.verify('HMAC', await key(), Buffer.from(sig, 'base64url'), enc.encode(body))) {
      const session = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (session.exp > Date.now()) {
        res.locals.user = session;
        return next();
      }
    }
  } catch { /* malformed cookie */ }
  res.redirect('/login');
}
```

A pre-existing route that needs an Auth0 access token (`getAccessToken()`) cannot work in relay
mode (identity-only); guard it with `requireAppSession` instead of calling the SDK.

## Federated logout

The mounted `/auth/logout` is forced federated in this mode, but it cannot clear the app cookie and
its `returnTo` is always the base URL. Do not re-register your own handler on `/auth/logout` (it
collides with the mounted route). To clear the app cookie and return to a registered Allowed Logout
URL, add a separate route and point every sign-out link at it. `client.logout`
defaults `federated` to `true` in this mode (`false` logs a warning and leaves the enterprise IdP
session active); pass it explicitly:

```typescript
app.get('/logout', async (req, res, next) => {
  try {
    res.clearCookie('app_session', cookieOptions);
    const logoutUrl = await req.auth0.client.logout({
      // placeholder: the app's sign-in route, registered as an Allowed Logout URL
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
