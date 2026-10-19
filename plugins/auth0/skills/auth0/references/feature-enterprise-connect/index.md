# Auth0 Enterprise Connect

Let a B2B app use Auth0 as a **stateless SSO relay**: the user types a work email, Auth0 runs Home Realm Discovery (HRD) on its domain, federates to that customer's enterprise IdP (SAML/OIDC), and hands back identity claims. Auth0 keeps **no session** and issues **no refresh token** in this mode - the application owns its session end to end. Enterprise Connect is an **Early Access** feature. This reference covers only the **app-embedded** pattern (the app embeds an Auth0 SDK); per-company users, roles, and invitations are `feature-organizations`.

---

## When to use Enterprise Connect

Use Enterprise Connect when the app must:

- Sign a user in through their employer's IdP (Okta, Entra ID, Google Workspace, PingFederate, any SAML/OIDC enterprise connection), chosen from the domain of the email they type.
- Act as a relay only: read identity from the login result and create the **app's own** session, with no Auth0 session cookie and no refresh token.
- Keep an existing login (password, social) for every domain that is not federated, and send only federated domains to Auth0.

Do NOT use Enterprise Connect when the need is per-organization membership, roles, or invitations with Auth0 as the session owner - that is `feature-organizations` (Enterprise Connect resolves an organization and stamps `org_id`, but it is the federation handoff, not org management). Do not use it either when the customer's own authorization server federates to Auth0 (the Custom / Third-party Authorization Server integration types): those need no SDK change in the app. A tenant-only provisioning task with no app code defers to the loaded `tooling-*` reference.

---

## Concepts

The product and protocol theory is owned by [B2B Connect - Enterprise](https://auth0.com/docs/get-started/b2b-connect-enterprise) (DEFER OUT). Working vocabulary:

| Concept | Description |
|---|---|
| **Relay (stateless) mode** | Auth0 brokers the SSO round trip and returns claims but writes no session of its own. The app is the session authority. |
| **B2B Integration (Application type)** | The Auth0 application created by the B2B Connect wizard for the app-embedded pattern. The app uses **its** Client ID (and secret, for server SDKs) - not a regular SPA or web app client. |
| **Domain discovery** | Asking the tenant's WebFinger endpoint whether an email domain is managed by Auth0. A routing hint only: the SDK helper never throws and returns `false` on any failure (flag off = 403, unmanaged domain = 404, 429, network error). It caches results briefly (about 60 s for `true`, 15 s for a 404), so a newly onboarded domain can take up to ~15 s to appear. |
| **Home Realm Discovery (HRD)** | Auth0 resolving the organization and enterprise connection from the email sent as `login_hint`. The app keeps no domain-to-org or domain-to-connection map. |
| **Identity-only** | The flow yields ID-token claims (and a short-lived access token) but no refresh token. Durable API access is the app's job. |

---

## SDK Integration

Two things must be in place: the **tenant** (see Tenant Configuration) and the **application** flow below. The flow is the same in every SDK:

1. **Enable relay mode** with the SDK's Enterprise Connect option on the client/provider. Request scope `openid profile email` only - no `offline_access`, no refresh tokens, and **no static `organization`**.
2. **Collect the work email** in a login form.
3. **Discover, then redirect.** Check whether the email domain is federated; if it is, redirect to Auth0 with the email as `login_hint`. If it is not, fall back to the app's **existing** login exactly as before (its own password, magic-link, or social login). Every `/login`, `/login?mode=password` and `/dashboard` in the per-SDK snippets (fallback, error redirects, guards, post-login targets, logout `returnTo`) is a placeholder: use the app's real routes; never redirect to, or create, a route the app does not have.
4. **Handle the callback.** Server SDKs: read the claims from the callback result and write the **app's own** signed session cookie - Auth0 writes nothing. Keep only identity claims; never persist the Auth0 access token (Enterprise Connect issues no refresh token, so it cannot be renewed - the user logs in again when it expires). Give the app session its own expiry. SPA SDKs: the SDK completes the exchange and holds tokens in memory; read `org_id` from the ID-token claims. That in-memory state **is** the enterprise session: never copy it into `localStorage` / `sessionStorage`, and never full-page navigate after the callback (`location.assign` / `replace` / `href`, a plain link) - it clears the session. Render in place or use the app's client-side router.
5. **Log out federated** (`federated: true`) on every logout path so the enterprise IdP session ends too, not just the app's.

Optionally validate `org_id` against the organizations the app serves after login. A mismatch is handled with a **federated** logout as well.

### Two SDK families

| | Server / regular web app SDKs | SPA SDKs |
|---|---|---|
| SDKs | `@auth0/auth0-server-js`, `@auth0/nextjs-auth0`, `@auth0/auth0-express`, `auth0-server-python` | `@auth0/auth0-spa-js`, `@auth0/auth0-react`, `@auth0/auth0-angular`, `@auth0/auth0-vue` |
| Discover + redirect | One `startEnterpriseLogin` / `start_enterprise_login` call does both; it signals "not federated" with `null` / `None` / `false` | **No `startEnterpriseLogin`.** Call the domain helper `isFederatedDomain`, then the ordinary redirect login with `login_hint` (react: `useEnterpriseConnect().loginWithSSO(email)`) |
| Session | SDK writes no Auth0 session; every method outside the login/callback/logout entry points is blocked (`getSession`, `getUser`, `getAccessToken`, `requiresAuth()`): they throw `enterprise_connect_not_supported` (nextjs-auth0: the returned promise rejects with `EnterpriseConnectError`). The app creates its own session in the callback | Tokens stay in the SDK's in-memory cache; `useRefreshTokens` / `offline_access` must stay off |
| Callback | `completeInteractiveLogin` / `complete_interactive_login` result, or an `onCallback` hook (nextjs-auth0, auth0-express) that must produce the response | SDK handles `code`/`state` on load (`handleRedirectCallback` in plain spa-js) |

### Feature-level symbols

Wire-protocol and behavior names, identical across SDKs:

| Symbol | Meaning |
|---|---|
| `login_hint` | The user's email on the authorize request; Auth0 runs HRD from it |
| `org_id` | The resolved organization, a claim on the ID token. Read it from the login result; optionally check it against the orgs the app serves |
| `openid profile email` | The only scopes to request - **no `offline_access`** |
| `federated: true` | Logout option that also ends the enterprise IdP session (SAML SLO). Server JS SDKs and the mounted `/auth/logout` default to it in relay mode; **SPA SDKs and auth0-server-python do not** (Python `LogoutOptions.federated` defaults to `False`), so pass it explicitly there. Pass it everywhere anyway |
| `/.well-known/webfinger` | The tenant discovery endpoint the SDK domain helper wraps. Never call it by hand |
| `enterprise_connect_not_supported` | The error code server SDKs raise when a session-dependent method is called in relay mode |

### Per-SDK reference

Get the exact calls from the per-SDK file below - **`Read:` the file for the detected SDK**. Each carries that SDK's Enterprise Connect option, discovery + login call, callback/session shape, and federated logout. Implement directly from it: do NOT fetch from GitHub, grep `node_modules`/`.d.ts`/site-packages, or web-search to re-verify a signature. No matching row? The feature is not available in that SDK - do not hand-roll WebFinger or `/authorize` to imitate it.

| SDK | Min version | Read this file |
|---|---|---|
| `@auth0/auth0-server-js` | 1.14.0 | `Read: references/feature-enterprise-connect/auth0-server-js.md` |
| `@auth0/nextjs-auth0` | 4.30.0 (4.31.1+ recommended) | `Read: references/feature-enterprise-connect/nextjs-auth0.md` |
| `@auth0/auth0-express` | 1.0.0 (beta since 1.0.0-beta.3) | `Read: references/feature-enterprise-connect/auth0-express.md` |
| `auth0-server-python` | 1.0.0b17 | `Read: references/feature-enterprise-connect/auth0-server-python.md` |
| `@auth0/auth0-spa-js` | 2.26.0 | `Read: references/feature-enterprise-connect/auth0-spa-js.md` |
| `@auth0/auth0-react` | 2.26.0 | `Read: references/feature-enterprise-connect/auth0-react.md` |
| `@auth0/auth0-angular` | 2.12.0 | `Read: references/feature-enterprise-connect/auth0-angular.md` |
| `@auth0/auth0-vue` | 2.10.0 | `Read: references/feature-enterprise-connect/auth0-vue.md` |

**Min version is informational.** It is the release the feature landed in; a `^`/`>=` range in `package.json` / `requirements.txt` resolves to a current release, so do not read `node_modules` or lockfiles to confirm it and do not bump or reinstall the SDK. Upgrade only if a call from the per-SDK file fails to compile because the symbol is missing.

#### Scope - do this, then stop

The deliverable is the **application code**, written from the per-SDK file. Write it early; do not spend the task investigating:

- Trust the per-SDK file's names - they are the shipped API. Inspect the installed package only if a specific line you wrote fails to compile, and then only that line.
- Don't add session or JWT libraries. The app session is signed with the platform's built-in HMAC (`crypto.subtle` / Python `hmac`); no `jose`, `iron-session`, or `itsdangerous`. Install only the SDK plus what its per-SDK file uses, and reuse the env loading the app already has.
- Don't stop to ask about tenant setup (see Tenant Configuration) - write the code against the credentials already in the environment.
- You're done when the app code is in place (and, for a JS/TS app, the build passes if quick).

#### Adding Enterprise Connect to an existing app

The target is an app with its **own** login and session (and no OIDC/SAML-capable auth server of its own). Enterprise Connect is added next to that login, not in place of it:

1. **Prerequisite: the B2B Integration exists.** It is created in the Dashboard (see Tenant Configuration) and is the app's Enterprise Connect client. Configure the SDK with **its** Client ID (and secret, for server SDKs) from the environment - not a regular SPA or web app client's.
2. **Add one Auth0 client in relay mode** with those credentials, as in the per-SDK file. Pass the option in the constructor/provider call; never set it afterwards (`auth0.enterprise_connect = True`) - relay-mode restrictions are applied by the constructor, so a later assignment has no effect. Never mount or construct a second Auth0 client for the same flow (auth0-express: `req.auth0` is shared and the last instance wins).
3. **Put discovery in front of the existing login.** The email form calls `startEnterpriseLogin` (server SDKs) or `isFederatedDomain` + the redirect login (SPA SDKs); a non-federated email continues to the app's existing login unchanged.
4. **Let the app's existing route guards accept enterprise users.**
   - Server SDKs: create the app's own session in the callback, in the form the app already uses for its existing login (or the signed `app_session` cookie from the per-SDK file). Do not guard routes with the SDK's session methods - they throw in relay mode.
   - SPA SDKs: make each existing guard or protected view accept the app's existing session **or** an SDK-authenticated user (`isAuthenticated`, or the wrapper's equivalent). Never mint a server session from claims the browser posts - they are unverified and forgeable.
5. **Make logout federated** for enterprise sessions, returning to a registered Allowed Logout URL. Keep the SDK's mounted routes (e.g. `/auth/logout`) rather than re-registering handlers on the same path.

If the app already constructs an Auth0 client, add the Enterprise Connect option to **that** call and point it at the B2B Integration's credentials; drop what relay mode does not use (`offline_access`, `useRefreshTokens`, `audience`, a static `organization`, and for server-js / python the `stateStore` / `state_store`), keeping the transaction store.

**Wire the change into the project's existing files.** Edit the app's real login, callback, logout, and config files in place; do not scaffold `README`, `SETUP`, or summary documents. Keep secrets in the environment, never in source.

---

## Tenant Configuration (via chosen tooling)

Enterprise Connect is **Early Access**. The B2B Integration itself is created in the Auth0 Dashboard (**B2B Connect** > Create B2B Connect Integration > type **Application**); there is no dedicated `auth0` CLI verb or MCP tool for it. Do not substitute a regular app from `auth0 apps create`. This is provisioning, separate from the app code: **do not block the code change on it** - implement against the client credentials already in the app's environment, and in your final message note that they must belong to the B2B Integration (created in the Dashboard if it does not exist yet).

What must be true before the flow works:

| Setting | Where | Why |
|---|---|---|
| Allowed Callback URLs | B2B Integration client | The SDK's `redirect_uri` (server: `<base>/auth/callback`; SPA: the app origin) |
| Allowed Logout URLs | B2B Integration client | Absolute `returnTo` of the federated logout; without it Auth0 shows an error page after logout |
| Allowed Web Origins | B2B Integration client (SPA SDKs only) | Browser PKCE / silent flows |
| Local Resource Discovery | Tenant flag `flags.local_resource_discovery` | While off, WebFinger answers nothing and the domain helper always returns `false` |
| Organization with a verified domain + enabled enterprise connection, granted access to the B2B Integration | Each customer organization | HRD resolves org and connection from `login_hint`. Per-Application Access must currently be disabled on the org for WebFinger discovery |
| Identifier First | Tenant (only if an org has more than one connection) | Lets Auth0 pick the connection without prompting |

The client URLs have a CLI verb; the discovery flag has none, so use the Management API through `auth0 api`:

```bash
auth0 apps update <b2b-integration-client-id> \
  --callbacks "http://localhost:3000/auth/callback" \
  --logout-urls "http://localhost:3000/login"
  # SPA SDKs: callbacks = the app origin, and add --web-origins "<app origin>"

# No dedicated auth0 CLI verb for Local Resource Discovery - use the Management API.
auth0 api patch "tenants/settings" --data '{"flags":{"local_resource_discovery":true}}'
```

Organizations, domains, and connections are owned by `feature-organizations` and the loaded `tooling-*` reference (DEFER ACROSS); onboarding customer IdPs through Self-Service Enterprise Configuration is a Dashboard flow.

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Calling `startEnterpriseLogin` in a SPA SDK (spa-js, react, angular, vue) | It does not exist there. Call `isFederatedDomain`, then `loginWithRedirect({ authorizationParams: { login_hint: email } })`; react uses `useEnterpriseConnect().loginWithSSO(email)` |
| Calling `isFederatedDomain` as a method on the client / `AuthService` | It is a standalone export of the SDK package (react: returned by `useEnterpriseConnect()`) |
| Passing a request parameter as `returnTo` to a server SDK's `startEnterpriseLogin` | It is forwarded as `appState.returnTo` without sanitizing (the mounted `/auth/login` does sanitize). Pass a fixed same-origin path |
| Hand-rolling `/.well-known/webfinger` or `/authorize` | The SDK's domain helper and login entry point own discovery and the redirect |
| Requesting `offline_access` or enabling `useRefreshTokens` | Enterprise Connect issues no refresh token. Request `openid profile email` only |
| Passing `connection` (alone or with a static `organization`) to the enterprise login | HRD picks both from `login_hint`; `connection` without `organization` can be rejected by the organization prompt. Pass them only to deliberately bypass HRD, backed by your own per-domain lookup |
| Setting a static `organization` in the login params | HRD resolves the org from `login_hint`; a pinned org routes every customer to one org. Read `org_id` from the result instead |
| Calling an SPA SDK's `logout` without `federated: true`, or with `openUrl: false` | `openUrl: false` only clears the in-memory cache and never reaches the IdP. Always pass `logoutParams: { federated: true, returnTo }` |
| Omitting `federated: true` on a logout path, including an org-mismatch rejection | The IdP session survives and the next login silently reuses the previous enterprise user. Pass it on every logout |
| Redirecting a non-federated email to a route the app does not have (e.g. an invented `/login/password`), or leaving the `/login?mode=password` placeholder when the app's login lives elsewhere | Fall back to the app's real existing login route |
| Treating the domain helper as an access check | It fails closed to `false` and is only a router. Trust identity from the callback; validate `org_id` there |
| Reading the user with `getSession` / `getUser` / `getAccessToken` / `get_session` in a server SDK | They throw (nextjs-auth0: reject) with `enterprise_connect_not_supported` in relay mode. Read the callback result and keep your own session |
| Guarding routes with `requiresAuth()` (auth0-express) | It calls `getUser()`, which throws. Guard with the app's own session middleware |
| Returning nothing from `onCallback` (nextjs-auth0, auth0-express), or throwing from it on error | No Auth0 session exists, so the hook must set the app cookie and return a `NextResponse` / end the Express response - on the error path too (redirect to a fixed login URL); a thrown error becomes a 500 |
| Persisting the Auth0 access or ID token for later API calls | Keep only identity claims (`sub`, `email`, `name`, `org_id`) in the app session and issue the app's own credentials |
| Writing the app session as an unsigned cookie | Sign it (HMAC with a secret from the environment) and verify the signature on every read; `httpOnly`, `sameSite: lax`, `secure` in production |
| Hand-decoding the ID token (`jwt.decode`, splitting the JWT) | The SDK returns validated claims from the callback; use them |
| Mixing SDKs: `@auth0/auth0-spa-js` inside a react/angular/vue app or a server app, `@auth0/auth0-react` in a plain-JS SPA, `@auth0/nextjs-auth0` in a browser SPA | Use the one SDK for the app's framework; each wrapper re-exports what it needs |
| Using `express-openid-connect` for Enterprise Connect | The feature exists only in `@auth0/auth0-express` |
| Using a regular SPA or web app client's credentials | Use the Client ID (and secret) of the B2B Integration |
| Hardcoding the client or session secret, even as a fallback (`process.env.X ?? '<value>'`, `os.environ.get("X", "<value>")`) | Read it from the environment, no literal fallback - even when `.env` cannot be written (copy `.env.example` instead) |
| Setting the flag after construction (e.g. `auth0.enterprise_connect = True` in Python) | Relay-mode restrictions are applied in the constructor, so a later assignment has no effect. Add the option to the existing constructor call |
| Mounting a second `createAuth0(...)` / constructing a second client for the enterprise flow | Two clients split login and callback state (auth0-express: `req.auth0` is shared and the last instance wins). Use one relay-mode client with the B2B Integration's credentials |
| Re-registering a handler on the SDK-mounted `/auth/logout` (auth0-express) | It collides with the mounted route, which is already federated in this mode. Add a separate `/logout` route |
| Reading the auth0-server-python callback user by attribute (`result["user"].sub`) | `complete_interactive_login` returns plain dicts. Use `user["sub"]` / `user.get("org_id")` |
| Using `window` inside a Vue template expression (`@click="logout({ ... window.location.origin ... })"`) | Templates cannot reach `window`; it throws at runtime. Call `logout` from a `<script setup>` function |
| Driving nextjs-auth0's `startEnterpriseLogin` from a server action | Use a Route Handler so the transaction cookie reaches the browser, and re-emit its redirect as 303 |

---

## Related capabilities

- `feature-organizations` - organizations, verified domains, members, and roles. The organization that HRD resolves is configured there; load it for org management rather than the IdP handoff.
- `framework-{framework}` - the detected SDK's base integration and idioms; the router co-loads it. Apply this feature's flow through that file's conventions.
- `pattern-multi-tenant` - B2B SaaS tenancy architecture questions.
- `tooling-{tooling}` - the CLI / Management API commands for the tenant setup above.

## References

Run `auth0 docs search "B2B Connect Enterprise"` for the latest Auth0 docs on this topic.

[B2B Connect - Enterprise](https://auth0.com/docs/get-started/b2b-connect-enterprise)
