# @auth0/auth0-server-js — Enterprise Connect

**Minimum version:** `1.14.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. Shown here in an Express app;
the same `ServerClient` calls apply to any Node server.

## Enable relay mode

`enterpriseConnect: true` makes the client write no Auth0 session and throw
`EnterpriseConnectNotSupportedError` (code `enterprise_connect_not_supported`) from
session-dependent methods (`getSession`, `getUser`, `getAccessToken`). `domain` must be a static
string in this mode. Credentials come from the environment.

Edit the app's **existing** `new ServerClient(...)` call in place - do not construct a second
client. Add `enterpriseConnect: true`, set scope to `openid profile email` (drop `offline_access`
and `audience`), and remove `stateStore` (the SDK swaps in a no-op store in this mode, so it is
dead config). Keep the `transactionStore` and its cookie handler:

```typescript
import { ServerClient, CookieTransactionStore } from '@auth0/auth0-server-js';

const auth0 = new ServerClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  enterpriseConnect: true,
  authorizationParams: {
    redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
    scope: 'openid profile email', // no offline_access, no static organization
  },
  transactionStore: new CookieTransactionStore(
    { secret: process.env.AUTH0_SESSION_SECRET! },
    new ExpressCookieHandler() // your CookieHandler for Express req/res
  ),
});
```

## Discover and start login

`startEnterpriseLogin({ email, returnTo }, storeOptions)` runs domain discovery and returns the
authorize `URL` (with `login_hint`) when the domain is federated, or `null` when it is not:

```typescript
app.post('/login', async (req, res, next) => {
  try {
    const authUrl = await auth0.startEnterpriseLogin(
      { email: req.body.email, returnTo: '/dashboard' },
      { request: req, response: res }
    );
    if (authUrl) return res.redirect(authUrl.href);
    res.redirect('/login?mode=password'); // not federated: your existing login
  } catch (err) {
    next(err);
  }
});
```

To check a domain without starting login (e.g. to render UI), use the standalone export
`isFederatedDomain(process.env.AUTH0_DOMAIN!, emailDomain)` → `Promise<boolean>`.

## Callback: create the app's own session

`completeInteractiveLogin` exchanges the code and returns `{ user, idTokenClaims, appState }`; it
writes nothing to a state store. Keep only identity claims and sign the cookie:

```typescript
const enc = new TextEncoder();
const key = () => crypto.subtle.importKey('raw', enc.encode(process.env.AUTH0_SESSION_SECRET!),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

app.get('/auth/callback', async (req, res, next) => {
  try {
    // appState is `unknown` unless typed here; without the type argument `result.appState?.returnTo` fails tsc.
    const result = await auth0.completeInteractiveLogin<{ returnTo?: string }>(
      new URL(req.url, process.env.APP_BASE_URL),
      { request: req, response: res }
    );
    const user = result.user;
    if (!user) return res.redirect('/login?error=no-session');

    const appSession = { sub: user.sub, email: user.email, name: user.name, orgId: user['org_id'] ?? '' };
    const body = Buffer.from(JSON.stringify(appSession)).toString('base64url');
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))).toString('base64url');
    res.cookie('app_session', `${body}.${sig}`, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    });
    res.redirect(result.appState?.returnTo ?? '/');
  } catch (err) {
    next(err);
  }
});
```

## Protect routes

Read **your** cookie and verify its signature (`crypto.subtle.verify('HMAC', ...)`) before
trusting it; redirect to `/login` when absent or invalid. Never call `auth0.getSession()` or
`auth0.getUser()` - they throw in this mode.

## Federated logout

Clear the app cookie, then redirect through Auth0 logout. `logout` defaults `federated` to `true`
in this mode; pass it explicitly. `returnTo` must be in Allowed Logout URLs:

```typescript
app.get('/auth/logout', async (req, res, next) => {
  try {
    res.clearCookie('app_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
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
