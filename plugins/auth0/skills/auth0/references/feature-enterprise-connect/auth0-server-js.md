# @auth0/auth0-server-js — Enterprise Connect

**Minimum version:** `1.14.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. Shown here in an Express app;
the same `ServerClient` calls apply to any Node server.

## Enable relay mode

`enterpriseConnect: true` makes the client write no Auth0 session. Every `ServerClient` method
except `startInteractiveLogin`, `startEnterpriseLogin`, `completeInteractiveLogin`, `logout`,
`customTokenExchange`, and `handleBackchannelLogout` throws `EnterpriseConnectNotSupportedError`
(code `enterprise_connect_not_supported`) - notably `getSession`, `getUser`, `getAccessToken`.
`domain` must be a static string (a resolver function throws `InvalidConfigurationError`).
Credentials come from the environment. Load the env the way the app already does
(`import 'dotenv/config'`, `node --env-file=.env`).

Construct one `ServerClient` with the B2B Integration's credentials (if the app already has one,
edit that call - do not construct a second client). Add `enterpriseConnect: true`, set scope to
`openid profile email` (drop `offline_access`, which is stripped anyway, and `audience`), and
remove `stateStore` (optional in this mode; the SDK uses a no-op store). Keep the
`transactionStore` and its cookie handler - it is required and holds the login transaction across
the redirect. `cookie-parser` (for `req.cookies`) and `express.urlencoded` (for the login form's
`req.body`) must run before any route that calls the client; keep the app's own if it already mounts
them. If the app has no `CookieHandler<StoreOptions>` yet, add this one:

```typescript
import express from 'express';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ServerClient, CookieTransactionStore } from '@auth0/auth0-server-js';
import type { CookieHandler, CookieSerializeOptions } from '@auth0/auth0-server-js';

const app = express();
app.use(express.urlencoded({ extended: false })); // form login posts req.body.email
app.use(cookieParser());                          // the cookie handler reads req.cookies

interface StoreOptions { request: Request; response: Response }

class ExpressCookieHandler implements CookieHandler<StoreOptions> {
  setCookie(name: string, value: string, options?: CookieSerializeOptions, so?: StoreOptions) {
    // SDK maxAge is seconds; Express expects milliseconds
    so!.response.cookie(name, value, { ...options, maxAge: options?.maxAge != null ? options.maxAge * 1000 : undefined });
  }
  getCookie(name: string, so?: StoreOptions) { return so!.request.cookies?.[name] as string | undefined; }
  getCookies(so?: StoreOptions) { return (so!.request.cookies ?? {}) as Record<string, string>; }
  deleteCookie(name: string, so?: StoreOptions, options?: CookieSerializeOptions) {
    so!.response.clearCookie(name, options);
  }
}

const auth0 = new ServerClient<StoreOptions>({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  enterpriseConnect: true,
  authorizationParams: {
    redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
    scope: 'openid profile email', // no static organization either
  },
  transactionStore: new CookieTransactionStore(
    { secret: process.env.AUTH0_SESSION_SECRET! },
    new ExpressCookieHandler()
  ),
});
```

## Discover and start login

`startEnterpriseLogin({ email, returnTo }, storeOptions)` runs domain discovery and returns the
authorize `URL` (with `login_hint`) when the domain is federated, or `null` when it is not or the
email is malformed. `returnTo` is saved as `appState.returnTo` unsanitized - pass a fixed
same-origin path, never a request parameter:

```typescript
app.post('/login', async (req, res, next) => {
  try {
    const authUrl = await auth0.startEnterpriseLogin(
      { email: String(req.body.email ?? '').trim(), returnTo: '/dashboard' },
      { request: req, response: res }
    );
    if (authUrl) return res.redirect(authUrl.href);
    // Domain is not federated, handle with your own login -
    // replace '/login?mode=password' with your existing login route
    res.redirect('/login?mode=password');
  } catch (err) {
    next(err);
  }
});
```

To check a domain without starting login (e.g. to render UI), use the standalone export
`isFederatedDomain(process.env.AUTH0_DOMAIN!, emailDomain)` → `Promise<boolean>` (never throws;
returns `false` on lookup failure).

## Callback: create the app's own session

`completeInteractiveLogin` exchanges the code and returns `{ user, idTokenClaims, appState }`; it
writes nothing to a state store. Keep only identity claims and sign the cookie with a secret
separate from the transaction store's (reuse the app's existing session secret if it has one):

```typescript
const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.APP_SESSION_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const SESSION_MS = 8 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' } as const;

app.get('/auth/callback', async (req, res, next) => {
  try {
    // appState is `unknown` unless typed here; without the type argument `result.appState?.returnTo` fails tsc.
    const result = await auth0.completeInteractiveLogin<{ returnTo?: string }>(
      new URL(req.url, process.env.APP_BASE_URL),
      { request: req, response: res }
    );
    const user = result.user;
    if (!user) return res.redirect('/login?error=no-session');

    const appSession = {
      sub: user.sub, email: user.email, name: user.name, orgId: user.org_id ?? '',
      exp: Date.now() + SESSION_MS,
    };
    const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');
    res.cookie('app_session', `${body}.${sig}`, { ...cookieOptions, maxAge: SESSION_MS });
    res.redirect(result.appState?.returnTo ?? '/');
  } catch (err) {
    next(err);
  }
});
```

## Protect routes

Read **your** cookie and verify it before trusting it; redirect to `/login` when absent, invalid,
or expired. Never call `auth0.getSession()` or `auth0.getUser()` - they throw in this mode:

```typescript
import type { NextFunction } from 'express';

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

## Federated logout

Clear the app cookie on every logout path, then redirect through Auth0 logout. `logout` defaults
`federated` to `true` in this mode (`false` logs a warning and leaves the enterprise IdP session
active); pass it explicitly. `returnTo` must be in Allowed Logout URLs:

```typescript
app.get('/auth/logout', async (req, res, next) => {
  try {
    res.clearCookie('app_session', cookieOptions);
    const logoutUrl = await auth0.logout(
      { returnTo: `${process.env.APP_BASE_URL}/login`, federated: true },
      { request: req, response: res }
    );
    res.redirect(logoutUrl.href);
  } catch (err) {
    next(err);
  }
});
```

## Security

Confidential client: the secret and session secret come from the environment. Do not store the
Auth0 access or ID token in the app session. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-server-js` 1.14.0+ — do not read the SDK source
to re-verify them.
