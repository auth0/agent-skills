# Auth0 Enterprise Connect

Let a B2B SaaS app use Auth0 as a **pure SSO relay**: a user types their work email, Auth0 runs Home Realm Discovery (HRD) on the email domain, federates to that customer's enterprise identity provider (SAML/OIDC), and returns an ID token. Auth0 holds **no session** and issues **no refresh token** in this mode, so the application owns its session end to end. For separate per-company users, roles, and membership (without necessarily federating to a customer IdP), use the `feature-organizations` reference instead; the two often ship together but solve different problems.

## When to use / when NOT to use

**Use when** the app must:

- Sign a user in through their employer's existing IdP, chosen by the user's email domain (Okta, Entra ID, Google Workspace, any SAML/OIDC enterprise connection).
- Act as a relay only: read identity from the returned token and establish the app's own session, with no Auth0 session cookie and no refresh token.

**Do NOT use this reference when:**

- The need is per-organization users, members, roles, and invitations (B2B SaaS tenancy) rather than federating to the customer's own IdP. That is `feature-organizations`. Enterprise Connect resolves the organization from the email domain and stamps `org_id` into the token, but it is about the *federation handoff*, not org/role management.
- The customer's own authorization server federates directly to Auth0 (the other B2B Connect patterns). Those need no SDK change; this reference is only the **app-embedded** pattern.
- The task is only tenant provisioning with no application behavior. Defer to the loaded `tooling-*` reference.

## Concepts

The protocol theory is owned by [the Auth0 B2B Connect - Enterprise docs](https://auth0.com/docs/get-started/b2b-connect-enterprise) (DEFER OUT). The working vocabulary:

- **Relay mode** - Auth0 brokers the federation and returns a token but keeps no session of its own. The app is the session owner.
- **Home Realm Discovery (HRD)** - resolving which enterprise connection (and organization) a user belongs to from their email domain, passed as `login_hint`.
- **Federated domain** - an email domain that an enterprise connection claims via `domain_aliases`. The SDK's domain-discovery helper answers "is this domain federated?" by calling the tenant's WebFinger endpoint.
- **Identity-only** - the flow yields an ID token (and a short-lived access token) and no refresh token. Durable API access is the app's responsibility, not Auth0's.

## SDK integration

Enterprise Connect needs two independent things in place: the **tenant** (connections, organizations, discovery; see "Tenant configuration") and the **application** flow below.

### The mechanic - one flow, two SDK shapes

The relay flow is the same everywhere:

1. **Enable relay mode** on the client with the Enterprise Connect option. Request scope `openid profile email` only, no `offline_access`, no `useRefreshTokens`, and no static `organization`.
2. **Collect the email** on a login form.
3. **Discover + redirect** to the enterprise IdP, keyed on the email domain. If the domain is not federated, fall back to the app's normal login.
4. **Handle the callback**: read the identity claims the SDK returns and establish the **app's own** session. Validate `org_id` from the ID token against the app's expected-organization record. Discard Auth0's access token.
5. **Logout federated** so the enterprise IdP session ends too, not just the local one.

What differs is only step 3 and step 4's entry points, and that split is the one thing this feature turns on:

- **Server / RWA family** (`@auth0/auth0-server-js`, `@auth0/nextjs-auth0`, `auth0-server-python`, `@auth0/auth0-express`) exposes a single `startEnterpriseLogin` call that folds domain discovery and the `/authorize` redirect together, returning a redirect (or a null/false when the domain is not federated). These SDKs **block session-dependent methods** in relay mode (reading the session, getting an access token) by throwing an `enterprise_connect_not_supported` error, and they write no Auth0 session cookie: the app establishes its own session from the callback (a callback hook in next.js/express, or the `completeInteractiveLogin` result in server-js/python).
- **SPA family** (`@auth0/auth0-spa-js`, `@auth0/auth0-react`, `@auth0/auth0-angular`, `@auth0/auth0-vue`) has **no `startEnterpriseLogin`**. The caller assembles the flow: call the domain-discovery helper, then the ordinary redirect-login passing the email as `login_hint`. Here the Enterprise Connect option is **warn-only** (it logs a console warning on bad config but does not throw), and there is no Auth0 session to suppress because tokens are in-memory.

> The Confluence "SDK API Design" page shows `startEnterpriseLogin` on the SPA SDKs too. That is wrong against the shipped code - the SPA SDKs do not export it. Follow the per-SDK example links below and the symbol table, not the design page.

### Feature-level symbols

Wire-protocol and config names a grader asserts and the app must get right, identical across SDKs:

| Symbol | Meaning |
|---|---|
| `login_hint` | The user's email, sent on the authorize request so HRD can route by domain |
| `org_id` | The resolved organization, stamped into the ID token; validate it after the callback (a missing `org_id` means "not org-scoped", not an automatic reject) |
| `openid profile email` | The only scopes to request; **no `offline_access`** |
| `federated: true` | Logout option that ends the enterprise IdP session (SAML SLO), not just the app's |
| `/.well-known/webfinger` | The tenant discovery endpoint the domain helper wraps; a routing hint only (fails closed to `false`), never a security control |
| `enterprise_connect_not_supported` | The error the server SDKs throw when a session-dependent method is called in relay mode |

### Per-SDK entry points

The call surface splits by family. Match the exact spelling to the SDK's own example (linked below); the raw-HTTP row is the language-neutral floor.

| SDK | Relay-mode option | Discover + start login | Establish app session on callback | Federated logout |
|---|---|---|---|---|
| `@auth0/auth0-server-js` | `enterpriseConnect` | `startEnterpriseLogin({ email, returnTo })` → `URL \| null` | `completeInteractiveLogin` → read `result.user` | `logout({ federated: true })` |
| `@auth0/nextjs-auth0` | `enterpriseConnect` | `startEnterpriseLogin` (server → `NextResponse`, or client → `boolean`) | `onCallback` hook returns a `NextResponse` | `/auth/logout?federated=true&returnTo=<absolute>` |
| `auth0-server-python` | `enterprise_connect` | `start_enterprise_login(StartEnterpriseLoginOptions(email=…))` → URL or `None` | `complete_interactive_login` → read `result["user"]` | `LogoutOptions(federated=True)` |
| `@auth0/auth0-express` | `enterpriseConnect` (requires `onCallback`) | `startEnterpriseLogin(req, res, options)` → `boolean` | `onCallback` hook ends the response | mounted `/auth/logout` (auto-federated) |
| `@auth0/auth0-spa-js` | `enterpriseConnect` (warn-only) | `isFederatedDomain(...)` then `loginWithRedirect({ authorizationParams: { login_hint } })` | SDK token cache (in-memory) | `logout({ logoutParams: { federated: true } })` |
| `@auth0/auth0-react` | `enterpriseConnect` (warn-only) | `useEnterpriseConnect()` → `isFederatedDomain(emailDomain)` then `loginWithSSO(email)` | SDK token cache (in-memory) | `logout({ logoutParams: { federated: true } })` |
| `@auth0/auth0-angular` | `enterpriseConnect` (warn-only) | `isFederatedDomain(...)` then `AuthService.loginWithRedirect({ authorizationParams: { login_hint } })` | SDK token cache (in-memory) | `AuthService.logout({ logoutParams: { federated: true } })` |
| `@auth0/auth0-vue` | `enterpriseConnect` (warn-only) | `isFederatedDomain(...)` then `useAuth0().loginWithRedirect({ authorizationParams: { login_hint } })` | SDK token cache (in-memory) | `useAuth0().logout({ logoutParams: { federated: true } })` |
| raw HTTP floor | n/a | `GET /.well-known/webfinger?resource=...` then `GET /authorize?login_hint=<email>&...` | app exchanges `code` at `POST /oauth/token`, reads ID-token claims | `GET /v2/logout?federated&returnTo=<absolute>` |

`auth0-react`'s `useEnterpriseConnect().loginWithSSO(email)` is the one piece of per-SDK sugar: it wraps `loginWithRedirect` with the email as `login_hint`, and its `isFederatedDomain` reads the tenant domain from provider config so the caller passes only the email domain. These SDK-specific names belong in `framework-react`; they are listed here only to complete the family story.

### Examples (DEFER OUT - link, do not inline)

Each row points at that SDK's own maintained Enterprise Connect example. Implement from the linked file; this reference states the mechanic, it does not restate the usage.

| SDK | Example source |
|---|---|
| `@auth0/auth0-server-js` | [`packages/auth0-server-js/EXAMPLES.md`](https://github.com/auth0/auth0-auth-js/blob/main/packages/auth0-server-js/EXAMPLES.md) · runnable [`examples/example-express-enterprise-connect`](https://github.com/auth0/auth0-auth-js/tree/main/examples/example-express-enterprise-connect) |
| `@auth0/nextjs-auth0` | [`examples/with-enterprise-connect`](https://github.com/auth0/nextjs-auth0/tree/main/examples/with-enterprise-connect) |
| `auth0-server-python` | [`examples/EnterpriseConnect.md`](https://github.com/auth0/auth0-server-python/blob/main/examples/EnterpriseConnect.md) |
| `@auth0/auth0-express` | [`packages/auth0-express/EXAMPLES.md`](https://github.com/auth0/auth0-express/blob/main/packages/auth0-express/EXAMPLES.md) |
| `@auth0/auth0-spa-js` | [`examples/enterprise-connect.md`](https://github.com/auth0/auth0-spa-js/blob/main/examples/enterprise-connect.md) |
| `@auth0/auth0-react` | [`EXAMPLES.md` → Enterprise Connect](https://github.com/auth0/auth0-react/blob/main/EXAMPLES.md#enterprise-connect) |
| `@auth0/auth0-angular` | [`EXAMPLES.md` → Enterprise Connect](https://github.com/auth0/auth0-angular/blob/main/EXAMPLES.md#enterprise-connect) |
| `@auth0/auth0-vue` | [`EXAMPLES.md` → Enterprise Connect](https://github.com/auth0/auth0-vue/blob/main/EXAMPLES.md#enterprise-connect) |

## Tenant configuration

Enterprise Connect is **Early Access** and needs tenant setup before any flow works. The commands (CLI / Terraform / Management API) are owned by the loaded `tooling-*` reference (DEFER ACROSS); what must be true is feature-level:

- A **B2B Integration** application (`b2b_integration` client type) created with `organization_usage: "require"`. The regular app's credentials are not used for the relay.
- One or more **enterprise connections** (SAML/OIDC) whose `domain_aliases` list the customer email domains, and **organizations** with discovery domains, so HRD resolves both connection and organization from the `login_hint`.
- **WebFinger / local resource discovery** enabled on the tenant (`flags.local_resource_discovery`). While off, `/.well-known/webfinger` returns `403` and the domain helper always answers `false`.
- The logout `returnTo` registered in the client's **Allowed Logout URLs** (absolute URL).
- For the SPA SDKs, the app origin added to **Allowed Web Origins** (browser PKCE / silent flows).

## Common mistakes

| Mistake | Why it breaks | Correct approach |
|---|---|---|
| Expecting `startEnterpriseLogin` on a SPA SDK (spa-js/react/angular/vue) | It does not exist there; the design doc is wrong | Use the domain helper + `loginWithRedirect` with `login_hint` (react: `useEnterpriseConnect().loginWithSSO`) |
| Omitting `federated: true` on logout | The enterprise IdP session stays alive; the next login silently reuses the previous user (no SAML SLO) | Set `federated: true` on **every** logout path, including an org-mismatch rejection logout |
| Requesting `offline_access` / enabling `useRefreshTokens` | Enterprise Connect issues no refresh token; the scope is stripped and warned | Request `openid profile email` only; let the app mint its own API tokens |
| Setting a static `organization` in auth params | Routes every customer to the same org; HRD must resolve it from the email domain | Pass no `organization`; read the resolved `org_id` from the ID token |
| Calling blocked session methods in relay mode (server SDKs) | Throws `enterprise_connect_not_supported` | Read claims from the callback result and own the session; do not call `getSession`/`getAccessToken`/`getUser` |
| Returning `void` from the callback hook (next.js/express) | No Auth0 session is written in relay mode, so the hook is the only session path | Return a `NextResponse` (next.js) or end the response (express); otherwise the request fails |
| Treating the domain helper as a security control | It fails closed to `false` on any error and is only a routing hint | Validate `org_id` after the callback and re-validate on every API request |
| Persisting Auth0's access token for later API calls | It is short-lived with no refresh path; Enterprise Connect is identity-only | Discard it; issue the app's own session/API tokens from the ID-token claims |
| Hand-rolling `/.well-known/webfinger` or `/authorize` | The SDK owns discovery and the redirect | Use the SDK's domain helper and login entry point |

## Related capabilities

- `feature-organizations` - per-company users, roles, and membership. Frequently paired with Enterprise Connect but a distinct concern; load it when the request is about org/role management rather than the IdP handoff.
- `framework-{framework}` - the detected SDK's base integration and idioms (session handling, route protection). The router co-loads it; apply this feature's neutral mechanic through that file's conventions.
- `pattern-multi-tenant` - B2B SaaS tenancy architecture; reach for it alongside `feature-organizations` on multi-tenant design questions.
- `tooling-{tooling}` - the CLI / Terraform / MCP commands for the tenant setup above.

## References

Run `auth0 docs search "enterprise connect"` for the latest Auth0 docs on this topic.

[B2B Connect - Enterprise](https://auth0.com/docs/get-started/b2b-connect-enterprise)
