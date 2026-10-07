# Auth0 Custom Token Exchange

Trade an external identity provider's token for Auth0 tokens, with no interactive login. Auth0's implementation of the [RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693) token-exchange grant.

---

## When to use Custom Token Exchange

Use Custom Token Exchange (CTE) when:
- A user (or machine) already holds a token from an external system — a partner IdP, a legacy auth server, an M2M issuer — and you need Auth0 tokens for the same principal without sending them through a redirect login.
- You are bridging a non-OIDC or proprietary token into your Auth0 session or API.

Do NOT reach for CTE when a standard login (Authorization Code, native social, M2M client-credentials) already fits — CTE exists for the case where the subject arrives already authenticated by *something else*. The delegation / `actor_token` (on-behalf-of) half of token exchange is a separate flow and is **not** covered here.

---

## Concepts

| Concept | Description |
|---|---|
| **Subject token** | The external token the caller already holds. Sent as `subject_token`; transport-only, never persisted by the SDK. |
| **Subject token type** | A URI/URN naming the subject token (`subject_token_type`). Must be non-reserved — not `urn:ietf:*`, `urn:auth0:*`, `urn:okta:*`, `*auth0.com`, `*okta.com`. |
| **Token-exchange profile** | A tenant-side record of type `custom_authentication` that maps a `subject_token_type` to an Action. Created with the CLI / Management API. |
| **Custom Token Exchange Action** | The `onExecuteCustomTokenExchange` Action the profile runs — it validates the subject token and resolves/provisions the user via `api.authentication.setUserByConnection`. |
| **Issued token** | What Auth0 returns: standard Auth0 tokens with `issued_token_type: urn:ietf:params:oauth:token-type:access_token`. |

Two SDK surfaces exist and are distinct:
- **Client-side CTE** — a client (SPA, mobile, server web app, M2M) exchanges an external token for *its own* Auth0 tokens. This is every SDK below except `auth0-api-python`.
- **Server-side profile exchange** — a resource server exchanges a caller-supplied `subject_token` via `get_token_by_exchange_profile`. Only `auth0-api-python` exposes this. Its `get_token_on_behalf_of` / OBO method is a different, out-of-scope flow.

---

## SDK Integration

The exchange is protocol-level: the SDK POSTs the RFC 8693 grant
(`grant_type=urn:ietf:params:oauth:grant-type:token-exchange`) to `/oauth/token`, carrying the
`subject_token` and its `subject_token_type`, and returns the typed Auth0 tokens. Only how the SDK
takes the arguments and where it puts the result differs:

- **A session-establishing method** (`loginWithCustomTokenExchange` / `login_with_custom_token_exchange`) writes the SDK's session or credential store, the way a login does.
- **A side-effect-free method** (`customTokenExchange` / `custom_token_exchange` / `get_token_by_exchange_profile`) performs the exchange and hands you the tokens without touching any session — use it when you only need the tokens, not a signed-in state.

Pick the variant by whether you want a session mutated. Get the exact call, the method name, and
the option casing from the per-SDK reference below — **`Read:` the file for the detected SDK**.
Each carries that SDK's own symbols verified against the installed SDK. Min version is the release
the current method landed in — **check the installed version (`package.json`/lockfile,
`Package.swift`, Gradle, `pyproject.toml`) meets it before implementing**, and upgrade if it falls
short. It matters most for the newer server SDKs, where CTE is still a pre-release or recent minor.
No matching row below? CTE has no generic fallback — it is SDK-specific; do not hand-roll the
`/oauth/token` grant.

| SDK | Min version | Read this file |
|---|---|---|
| `@auth0/auth0-spa-js` | 2.14.0 | `Read: references/feature-custom-token-exchange/auth0-spa-js.md` |
| `@auth0/auth0-react` | 2.13.0 | `Read: references/feature-custom-token-exchange/auth0-react.md` |
| `@auth0/nextjs-auth0` | 4.14.0 | `Read: references/feature-custom-token-exchange/nextjs-auth0.md` |
| `@auth0/auth0-auth-js` | 1.2.0 | `Read: references/feature-custom-token-exchange/auth0-auth-js.md` |
| `@auth0/auth0-server-js` | 1.6.0 | `Read: references/feature-custom-token-exchange/auth0-server-js.md` |
| `auth0-server-python` | 1.0.0b8 | `Read: references/feature-custom-token-exchange/auth0-server-python.md` |
| `auth0-api-python` (API / server-side) | 1.0.0b6 | `Read: references/feature-custom-token-exchange/auth0-api-python.md` |
| `Auth0.swift` | 2.14.0 | `Read: references/feature-custom-token-exchange/auth0-swift.md` |
| `Auth0.Android` | 3.3.0 | `Read: references/feature-custom-token-exchange/auth0-android.md` |
| `react-native-auth0` | 5.4.0 | `Read: references/feature-custom-token-exchange/react-native-auth0.md` |

**Wire the change into the project's existing files.** Edit the app's real login/route/service and
config files in place; do not scaffold extra `README`, `SETUP`, `NOTES`, or `*-summary` documents to
"explain" the integration — they are not part of the task and dilute the diff.

---

## Security invariants

These hold across every SDK; the per-SDK leaf repeats the ones specific to its client type.

- **Public clients** (spa-js, react, Auth0.swift, Auth0.Android, react-native-auth0) send `client_id` only — **never** a `client_secret`. A secret in a public client is a leak.
- **Confidential / server flows** (`auth0-api-python`, M2M) authenticate with HTTP Basic client auth; the secret stays server-side and loads from the environment, never a source literal.
- The `subject_token` is **transport-only** — passed in the request body, never logged and never persisted by the SDK or your code.
- Tokens are stored only via the SDK's own secure store (CredentialsManager / Keychain / Keystore / StateStore / session), never ad hoc in `localStorage`, `sessionStorage`, a cookie, or a file.
- Never send a `"Bearer "`-prefixed `subject_token` — it is the raw token, not an HTTP header value.
- In application code, never hand-roll the `/oauth/token` token-exchange POST; it bypasses the SDK's validation, token typing, and session wiring. (The one-off CLI/curl check in Provisioning step 4 is tenant verification, not application code.)

---

## Tenant Configuration (via chosen tooling)

The Auth0 MCP server exposes no token-exchange tool, so use the CLI (full command syntax lives in
your tooling reference). When the task is to configure the tenant itself (not wire an SDK into an
app), the deliverable is the **mutated tenant**: run each `auth0` command as its own step and read
state back after each mutation to confirm it landed. Do not bundle the setup into one `bash
setup.sh`, and do not emit setup scripts or summary files describing commands for a human to run
later — an unrun script leaves the tenant unchanged.

### The Custom Token Exchange Action

The profile runs an `onExecuteCustomTokenExchange` Action that validates the subject token and
resolves (or provisions) the Auth0 user it represents. Minimal shape — read the incoming token from
`event.transaction.subject_token`, reject a bad one, otherwise set the user:

```js
exports.onExecuteCustomTokenExchange = async (event, api) => {
  const subjectToken = event.transaction.subject_token;

  // Validate the subject token however your external issuer requires (signature,
  // issuer, audience, expiry). `isValidSubjectToken` is your own helper — define it.
  if (!(await isValidSubjectToken(subjectToken))) {
    api.access.rejectInvalidSubjectToken('Invalid subject token');
    return;
  }

  // Resolve/provision the user. Positional args: connection name, user profile, behavior.
  api.authentication.setUserByConnection(
    'Username-Password-Authentication',
    {
      user_id: '<stable id derived from the subject token>',
      email: '<email from the subject token>',
      email_verified: false, // set true only from a verified-email claim in the subject token
      name: '<name>',
      nickname: '<nickname>',
    },
    { creationBehavior: 'create_if_not_exists', updateBehavior: 'none' },
  );
};
```

The connection must be enabled for the client. `rejectInvalidSubjectToken(reason)` is how you fail a
bad token — do not throw.

### Provisioning steps

The steps are ordered — each later one needs an id from an earlier one. Run each command on its own
and read the result back; do not bundle them into a `setup.sh`.

```bash
# 1. Enable CTE on the client (the public SPA/native client, or the M2M app that calls /oauth/token)
auth0 apps update <client-id> --allow-any-profile-of-type custom_authentication
auth0 apps show <client-id> --json          # confirm token_exchange.allow_any_profile_of_type

# 2. Create the Action, then DEPLOY it — an undeployed Action never runs
auth0 actions create --trigger custom-token-exchange --name "Custom Token Exchange" --code "$(cat action.js)"
auth0 actions deploy <action-id>             # <action-id> comes from the create output
auth0 actions show <action-id> --json        # confirm "deployed": true

# 3. Create the profile that maps the subject-token type to the Action (after the Action exists)
auth0 token-exchange create --name "<name>" --subject-token-type <non-reserved-uri> --action-id <action-id> --type custom_authentication
auth0 token-exchange show <profile-id> --json

# 4. (Optional) Verify by executing the exchange. This calls the Authentication API's
#    /oauth/token, which `auth0 api` CANNOT reach (it only talks to the Management API),
#    so use a direct HTTP client. Keep the client secret and subject token out of argv and
#    shell history by feeding them through a curl config on stdin, and discard the response
#    body — the HTTP status is all you need to confirm the exchange works.
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://<tenant-domain>/oauth/token" \
  -H "content-type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
  --data-urlencode "subject_token_type=<uri>" \
  --data-urlencode "audience=<api-id>" \
  --config - <<'EOF'
user = "<client-id>:<client-secret>"
data-urlencode = "subject_token=<token>"
EOF
# Public client (no secret): drop the `user` line and instead add
#   data-urlencode = "client_id=<client-id>"
```

The tenant setup (steps 1–3) is the deliverable; step 4 only confirms it works and is not
always runnable in a given environment.

Notes:
- `auth0 apps update` has **no** `--is-first-party` or `--oidc-conformant` flag. Apps created in your
  own tenant are already first-party; if you must set either on an existing client, patch it:
  `auth0 api patch "clients/<id>" --data '{"is_first_party":true,"oidc_conformant":true}'`.
- `--type` only accepts `custom_authentication` (CTE). `on_behalf_of_token_exchange` is a different
  (OBO) profile type and is out of scope here.
- `subject_token_type`: 8–100 chars, a valid URI, no reserved prefix, unique per tenant (409 on duplicate).
- CTE itself needs neither user consent nor Management API access for the exchanging app — the
  exchange is non-interactive (no consent prompt) and hits the Authentication API, not the
  Management API. If a *separate* requirement needs them: "Allow Skip User Consent" is a per-API
  setting on a *custom* API (`auth0 api patch "resource-servers/<custom-api-id>"`) — the Management
  API instead relies on the client's first-party status — and authorizing an M2M app for the
  Management API uses `auth0 api post "client-grants"`.

Verify subcommands and flag names with `auth0 token-exchange --help` and `auth0 actions --help`
rather than inferring them; use `auth0 api` for Management API calls without a dedicated
subcommand. `auth0 api` reaches the Management API only — Authentication API calls like
`/oauth/token` need a direct HTTP client.

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Hand-rolling the `/oauth/token` token-exchange POST | Call the SDK's CTE method — it builds the grant, types the response, and wires the session. Hand-rolling bypasses all three |
| Creating the Action but never deploying it | A newly created Action is a draft; the profile binds it but it won't run until `auth0 actions deploy <action-id>` |
| Using a reserved `subject_token_type` namespace | The type URI must not be `urn:ietf:*`, `urn:auth0:*`, `urn:okta:*`, `*auth0.com`, or `*okta.com`. Reserved types are rejected at profile creation and by some SDKs |
| Prefixing the subject token with `"Bearer "` | Pass the raw token as `subject_token`; the SDK rejects a `"Bearer "` prefix |
| Sending a `client_secret` from a public client | SPA / mobile / native clients send `client_id` only. A secret in a public client is a leak |
| Persisting or logging the subject token or returned tokens by hand | The subject token is transport-only; let the SDK's secure store hold the result |
| Picking the session-mutating method when you only need tokens (or vice versa) | `login*` establishes a session; the plain `customTokenExchange` variant has no side effects. Match the method to whether you want a session |
| Using the deprecated `exchangeToken` (spa-js / react) | Use `loginWithCustomTokenExchange` / `customTokenExchange`; `exchangeToken` is a deprecated alias |
| Passing `connection` to `exchangeToken` (auth0-auth-js) | A `connection` flips that method to a Token Vault exchange, not CTE. Omit it for CTE |
| Using `getTokenForConnection` for CTE (auth0-auth-js) | That is Token Vault, not CTE — a different feature |
| Transposing the Android argument order | `Auth0.Android` is `customTokenExchange(subjectTokenType, subjectToken, ...)` — reversed vs the legacy `loginWithNativeSocialToken(token, tokenType)` |
| auth0-react: calling the spa-js client directly | Call the method off the `useAuth0()` hook so React auth state updates; the direct client bypasses the context dispatch |
| auth0-api-python: using the OBO wrapper for a profile exchange | `get_token_on_behalf_of` hardcodes IETF access-token types; use `get_token_by_exchange_profile` when the caller supplies `subject_token_type` |
| Creating the profile before the Action | The profile's `--action-id` references the Action; create the Action first |

---

## Scope note

This reference covers the **CTE grant** only. The delegation / impersonation half of token exchange
— `actor_token`, `actor_token_type`, `api.authentication.setActor`, the `act` claim, and the
`on_behalf_of_token_exchange` profile type — is a separate flow and is not documented here.
