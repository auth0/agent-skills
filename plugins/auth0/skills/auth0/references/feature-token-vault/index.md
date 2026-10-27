# Auth0 Token Vault

Let your app call a third-party API (Google Calendar, GitHub, Slack, Microsoft Graph, …) on the
user's behalf. Auth0 stores the provider's access and refresh tokens; your backend trades an Auth0
token for a fresh provider access token whenever it needs one.

---

## When to use Token Vault

Use Token Vault when:
- Your app (or an AI agent inside it) must call an external provider's API **as the signed-in user** — read their calendar, open a GitHub issue, post to Slack.
- You want Auth0 to hold and refresh the provider tokens instead of storing them in your own database.

Do NOT reach for Token Vault to trade an external token *for Auth0 tokens* — that is Custom Token
Exchange, a different grant. Token Vault always goes the other way: Auth0 token in, **provider**
token out.

---

## Concepts

| Concept | Description |
|---|---|
| **Connected account** | A provider account the user linked through the My Account API Connected Accounts flow (`/me/v1/connected-accounts/connect` → `/complete`). Its tokens live in Token Vault, separate from the login identities in `identities`. |
| **Connection purpose** | A connection can be used for *Authentication*, *Connected Accounts for Token Vault*, or both. Connected-accounts-only connections do not appear on the login page. |
| **Refresh-token exchange** | A web or server app trades the user's **Auth0 refresh token** (`subject_token_type=urn:ietf:params:oauth:token-type:refresh_token`) for the provider access token. |
| **Access-token exchange** | A backend API trades the **Auth0 access token** it received (`subject_token_type=urn:ietf:params:oauth:token-type:access_token`) for the provider access token. The API authenticates as a **Custom API Client** linked to its API identifier. This is how a SPA's backend gets provider tokens. |
| **Provider token** | What the exchange returns: the external provider's access token. Auth0 refreshes it from the stored provider refresh token when it has expired. |

The exchange is protocol-level — `POST /oauth/token` with
`grant_type=urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token`,
`requested_token_type=http://auth0.com/oauth/token-type/federated-connection-access-token`, the
`subject_token` and its type, the `connection` name, and an optional `login_hint` (only when the user
has more than one account on that connection). **Only confidential clients can make it** — a public
SPA or native app never performs the exchange itself.

---

## SDK Integration

Get the exact calls from the per-SDK reference — **`Read:` the file for the detected SDK**. Each
carries that SDK's own method names, option casing, and errors. Min version is the release the
current API landed in — **check the installed version (`package.json`/lockfile, `pyproject.toml`)
meets it before implementing**, and upgrade if it falls short.

| SDK | What it does | Min version | Read this file |
|---|---|---|---|
| `@auth0/nextjs-auth0` | Refresh-token exchange + Connected Accounts | 4.4.0 (connect: 4.11.0) | `Read: references/feature-token-vault/nextjs-auth0.md` |
| `auth0-server-python` | Refresh-token exchange + Connected Accounts | 1.0.0b1 (connect: 1.0.0b6) | `Read: references/feature-token-vault/auth0-server-python.md` |
| `@auth0/auth0-server-js` | Refresh-token exchange from the session (no Connected Accounts) | 1.0.0 (full signature: 1.13.0) | `Read: references/feature-token-vault/auth0-server-js.md` |
| `@auth0/auth0-auth-js` | Refresh- or access-token exchange (no Connected Accounts) | 1.2.0 | `Read: references/feature-token-vault/auth0-auth-js.md` |
| `@auth0/auth0-api-js` (API) | Access-token exchange | 1.1.0 (DPoP verify: 1.4.0) | `Read: references/feature-token-vault/auth0-api-js.md` |
| `auth0-api-python` (API) | Access-token exchange | 1.0.0b5 | `Read: references/feature-token-vault/auth0-api-python.md` |
| `@auth0/auth0-spa-js` | Connected Accounts linking only — the backend API exchanges | 2.9.0 | `Read: references/feature-token-vault/auth0-spa-js.md` |
| `@auth0/auth0-react` | Connected Accounts linking only — the backend API exchanges | 2.9.0 | `Read: references/feature-token-vault/auth0-react.md` |

**Not supported** — these SDKs have no Token Vault or Connected Accounts API. Do not invent one, and
do not hand-roll the grant inside them:

| SDK | What to do instead |
|---|---|
| `Auth0.Android`, `Auth0.swift`, `react-native-auth0`, `auth0-oidc-client-net` | Public clients. Get an Auth0 access token for your own backend API and call it; the backend performs the access-token exchange with a supported SDK above. |
| `auth0-spring-security-api`, `aspnetcore-api` (`Auth0.AspNetCore.Authentication.Api`), `go-jwt-middleware` | These only validate JWTs. Run the access-token exchange in a backend that uses a supported SDK, or tell the developer this stack has no Auth0 Token Vault SDK support. |

**Wire the change into the project's existing files.** Edit the app's real routes, services, and
config in place; do not scaffold extra `README`, `SETUP`, `NOTES`, or `*-summary` documents.

---

## Security invariants

- **Provider tokens stay on the server.** Never return them to the browser or a mobile app, never put them in props passed to client components, and never log them.
- **Do not persist provider tokens yourself** — no database column, `localStorage`, cookie, or file. Ask Token Vault for a token when you need one.
- **Only confidential clients exchange.** Client credentials load from the environment, never a source literal. SPA and native apps send `client_id` only and never hold a secret.
- **Validate before exchanging.** An API checks the incoming access token's signature, `iss`, `aud` (its own API identifier), `exp`, and scopes with its JWT SDK before using it as a `subject_token`.
- **Request the minimum provider scopes** the feature needs when connecting the account.
- **Never hand-roll the `/oauth/token` exchange in application code** where a supported SDK exists. (The curl check in Provisioning is tenant verification, not application code.)
- Deleting a connected account removes the tokens from Token Vault but does **not** revoke them at the provider.

---

## Tenant Configuration (via chosen tooling)

When the task is to configure the tenant itself, the deliverable is the **mutated tenant**: run each
command as its own step and read state back after each mutation. Do not bundle the setup into one
`setup.sh`, and do not emit setup scripts for a human to run later.

**The CLI's `--grants` flag does not accept the Token Vault grant** — an unrecognized value is
silently written as an empty string. Set `grant_types` through `--data` (raw JSON PATCH) instead,
and because a PATCH **replaces** the whole `grant_types` array, read the current list first and send
the merged list. The Auth0 MCP server can set `grant_types` and `refresh_token.rotation_type`, but it
cannot create a Custom API Client, edit connections, or set refresh-token policies — use the CLI or
Dashboard for those.

### Provisioning steps

```bash
# 1. Application (the confidential web/server app that does the refresh-token exchange).
#    It must be first-party, OIDC-conformant, and NOT a public client.
auth0 apps show <client-id> --json          # note grant_types, refresh_token, token_endpoint_auth_method
auth0 apps update <client-id> --data '{"grant_types":["authorization_code","refresh_token","urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token"]}'
#    ^ merge with the grant types you read above; this list replaces them.

# 2. Turn refresh-token rotation OFF — the refresh-token exchange does not work with rotation.
#    Send back the full refresh_token object you read in step 1 with only rotation_type changed.
auth0 apps update <client-id> --data '{"refresh_token":{ ...current fields..., "rotation_type":"non-rotating"}}'

# 3. Enable the connection for the app the user logs in and connects through (auth0-cli v1.38.0+),
#    then turn on Connected Accounts for Token Vault. <login-app-client-id> is:
#      - nextjs-auth0 / auth0-server-python / auth0-server-js / auth0-auth-js (refresh token): the step-1 web app
#      - auth0-spa-js / auth0-react: the SPA's own (public) client — NOT the step-1 app or the step-4 Custom API Client
auth0 connections enabled-clients update <connection-id> --data '[{"client_id":"<login-app-client-id>","status":true}]'
auth0 connections enabled-clients show <connection-id> --json   # confirm the app is enabled
auth0 connections update <connection-id> --data '{"connected_accounts":{"active":true}}'
auth0 connections show <connection-id> --json                   # confirm connected_accounts.active

# 4. (Access-token exchange only) Create the Custom API Client for your backend API.
#    With --type resource_server and no --grants, the CLI sets the Token Vault grant itself.
#    --resource-server-identifier cannot be changed after creation.
auth0 apps create --name "<api-name> Token Vault Client" --type resource_server \
  --resource-server-identifier "<api-identifier>"
```

For the **Connected Accounts** flow (nextjs-auth0, server-python, spa-js, react) also:
- **Activate the My Account API** (Dashboard → Applications → APIs → *Auth0 My Account API*, audience `https://<tenant-domain>/me/`). On its *Application Access* tab, authorize your app for user access with `create:me:connected_accounts`, `read:me:connected_accounts`, `delete:me:connected_accounts`. There is no verified CLI command for this step — use the Dashboard.
- **Add a Multi-Resource Refresh Token policy** for the My Account API so the SDK can mint a `/me/` token from the user's refresh token: add `{"audience":"https://<tenant-domain>/me/","scope":["create:me:connected_accounts","read:me:connected_accounts","delete:me:connected_accounts"]}` to `refresh_token.policies` (same full-object `--data` PATCH as step 2). If you use MRRT, enable *Allow Skipping User Consent* on the My Account API.
- **Google:** enable *Offline Access* in the connection's permissions so Google issues a refresh token Token Vault can store.

Verify the exchange (optional). `/oauth/token` is the Authentication API, which `auth0 api` cannot
reach, so use a direct HTTP client and keep secrets out of argv:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://<tenant-domain>/oauth/token" \
  --data-urlencode "grant_type=urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token" \
  --data-urlencode "subject_token_type=urn:ietf:params:oauth:token-type:refresh_token" \
  --data-urlencode "requested_token_type=http://auth0.com/oauth/token-type/federated-connection-access-token" \
  --data-urlencode "connection=<connection-name>" \
  --config - <<'EOF'
user = "<client-id>:<client-secret>"
data-urlencode = "subject_token=<auth0-refresh-token>"
EOF
# Access-token exchange: use the Custom API Client's id/secret, an access token whose aud is the API,
# and subject_token_type=urn:ietf:params:oauth:token-type:access_token.
# 200 = works; 401 = no connected account, bad token, or bad credentials; 403 = grant not allowed.
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Passing the Token Vault grant URN to `auth0 apps update --grants` | `--grants` doesn't know it and writes `""`. Use `--data '{"grant_types":[...]}'` with the merged list |
| Overwriting `grant_types` with only the Token Vault grant | PATCH replaces the array — read it first and keep `authorization_code` / `refresh_token` |
| Leaving refresh-token rotation on | The refresh-token exchange fails with rotation; set `rotation_type: non-rotating` |
| Doing the exchange from a SPA or mobile app | Public clients can't. The app calls your backend; the backend exchanges (access-token exchange via a Custom API Client) |
| Logging in without `offline_access` | No Auth0 refresh token, so the refresh-token exchange (and the SDK's My Account token) can't run |
| Forgetting `connected_accounts.active` on the connection, or skipping the Connected Accounts flow | The exchange returns 401 — the user has no connected account for that connection |
| Google connection without Offline Access | Google issues no refresh token, so Token Vault can't refresh the provider token |
| MFA policy set to *Always* | Breaks the exchange. Don't just switch it to *Never* — that drops MFA from logins. Replace it with an Action that **still enforces MFA on every login** and skips it only when `event.transaction.protocol === 'oauth2-token-exchange-federated-connection'` |
| Sending `audience` in the exchange | The provider is chosen by `connection`, not `audience`; SDKs reject or ignore it |
| Returning the provider token to the browser or storing it in your DB | Keep it server-side and request it from Token Vault each time you need it |
| Treating a 401 from the exchange as a server bug | Usually the user hasn't connected (or has disconnected) the account — send them through the connect flow again |
| Confusing Token Vault with Custom Token Exchange | Token Vault returns a **provider** token; Custom Token Exchange returns **Auth0** tokens for an external token |

---

## Scope note

This reference covers the refresh-token and access-token exchanges and the Connected Accounts flow.
The Early Access **Privileged Worker** exchange (signed-JWT subject, `token-vault-access-token`
requested type) and the Early Access `scope` down-scoping parameter are not covered.
