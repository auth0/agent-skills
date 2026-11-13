# Personal Agent Protocol (PAP / Poppy)

Lets a user's personal AI agent discover an app, call its APIs, and act on the
user's account after the user consents. The app is the protocol's **Company**;
the agent is an external OAuth client. Poppy is the protocol's new name.
Specification: https://personalagentprotocol.org/docs/1.0/spec (draft).

This reference covers the app side. Keep ordinary human login on the app's
existing Auth0 SDK. For SDK method names, config shapes and code, read the
installed Poppy-enabled SDK's own guide (see "Where the details live"); they
change faster than this file.

## Beta limits (check before promising anything)

- **Tenant enablement.** Poppy is a beta on an approved tenant (US-5 first).
  Confirm enablement before configuring account sign-in or browser joining; a
  rejected field means the tenant lacks the feature, not that the call is wrong.
- **Unreleased tooling.** The Poppy SDK builds and the `auth0 poppy` CLI commands
  may not be published yet. Confirm the installed package exports and run
  `auth0 poppy --help` before using either. Do not invent package versions, SDK
  methods, CLI commands or flags.
- **Versions differ.** The SDKs serve protocol 0.3 (camelCase config); the CLI
  writes 0.4 (snake_case `poppy.json`). Neither targets the 1.0 draft yet. Convert
  at the boundary. Changing a version string does not upgrade a verifier.
- **Out of scope for the beta:** device or mediated sign-in, Conversations,
  payment and push extensions, agent self-registration, partial consent
  (consent is all or nothing). MCP support is unconfirmed; advertise an MCP
  interface only after verifying it. DPoP is not required; keep an existing
  DPoP policy.

## Choose the channels

An app exposes either or both, independently:

- **API:** agents call the app's OpenAPI over HTTPS. Signed-out (guest) calls need
  only the `Poppy-Session` header; account calls also need an OAuth access token.
- **Browser join:** the agent's headless browser joins the customer's session
  through Auth0's hosted page and the app's `initiate_login_uri`.

Advertise only what the app implements.

## Workflow

1. **Plan the tenant change, then ask.** Run `auth0 poppy setup --company-domain
   <host> --api <audience> --app "<name>" --dry-run`. Show the plan and apply it
   only after the developer agrees; some settings affect every app in the tenant
   (issuer in authorization responses, the resource parameter profile, the Company
   domain). Without the command, make the same settings through the Management
   API from the docs. Do not change an unrelated default audience to make setup pass.
2. **Register the agents the app allows.** A beta app accepts only registered
   agents. Use `auth0 agents register <agent CIMD URL>` when the installed CLI
   has it. Otherwise: `POST /api/v2/clients/cimd/register` with only
   `external_client_id`, then `POST /api/v2/agents` with the returned `client_id`,
   then `POST /api/v2/client-grants` with `subject_type: "user"` and an explicit
   scope list (omitting `subject_type` defaults to `client`). Keep the external
   CIMD URL, the internal Auth0 client ID and the agent principal ID distinct.
   Registration and a grant do not sign a customer in or replace their consent.
3. **Publish discovery.** Serve `/.well-known/poppy.json` and
   `/.well-known/oauth-protected-resource` publicly on the Company origin: GET and
   HEAD, no auth, no redirects, no cookies. Derive both from one config source so
   issuer, origin, audience and scopes cannot drift. Keep the issuer exactly as
   published, including its trailing slash.
4. **Wire the app with the installed SDK.** API: verify each request with the
   SDK's Poppy verifier, set its public origin to the API's real https origin and
   back it with a shared session store. Browser: use the web SDK's Poppy option so
   it serves discovery and accepts the hand-off. Read the SDK guide for the calls.
5. **Verify** (below). Never report success from a mock that returns "signed in".

## Rules that fail silently when missed

- **A Session is not an account.** A valid `Poppy-Session` proves which agent and
  pseudonymous user are calling, nothing more. Its `sub`, session ID and agent ID
  are not Auth0 account subjects; never look up or change account data from them.
  Take account identity only from a validated access token for the right audience.
- **Bind the token to the Session.** The token's client must match the Session's
  agent, and the Session's token hash must match the token. Reject mismatches even
  when each signature is valid. Without an SDK, verify the `poppy_dlg` delegation
  against the agent's metadata and JWKS, then the Session JWT with its delegated
  key; decoding is not verification.
- **Guests need no access token.** Key guest state (a cart, say) by the SDK's
  verified opaque key, not a bare session ID. A route that is publicly discoverable
  still requires a verified Session unless it is plain public.
- **Anonymous tokens are not accounts.** A guest cart with an anonymous token needs
  the web app's anonymous sessions on, the API's anonymous-user policy set to
  `require_client_grant`, and a client grant for anonymous users. Such a token can
  carry claims and scopes; require a signed-in state and a user `sub` before any
  account change.
- **Enforce scopes on the server.** Return 401 with a sign-in challenge when an
  account is needed, 403 when a granted scope is missing. A website access token's
  scopes do not prove what the customer approved for an agent; do not authorize
  agent actions from them.
- **Use the public https origin.** The Session signs the request URL. Behind a
  proxy, tunnel or gateway, configure the fixed public origin and original path;
  never infer them from forwarded headers. Agents refuse non-https hosts, so local
  work needs a tunnel with a reserved hostname, and `localhost` certificates do
  not make an app reachable. A mismatch shows up as `invalid_session`.
- **Browser join mutates nothing on GET.** The join issues a short-lived one-use code
  and a browser-bound cookie; the agent authorizes it; the browser's POST consumes
  it. Tokens never pass through the browser. Use separate cookies and stores for
  agent and human sessions. A signed-in join needs the `poppy:browser-sign-in`
  scope; a narrow API scope must not silently become full website access. A
  signed-in join clears earlier human-login credentials so they cannot restore
  access after the agent signs out; a guest join keeps ordinary login.
- **MFA and Actions.** Complete MFA and consent at the customer's original sign-in;
  the later hand-off must not prompt. In post-login Actions, key the exemption on
  `event.session.actor`, the exact web app ID and an allowlist of registered
  agents. `event.agent` alone is not enough, and the allowlist never comes from
  hand-off query parameters. Test an ordinary human login after the change.
- **Ending access is several operations.** Session end, browser logout, grant
  removal and refresh-token revocation are separate. Deleting an agent principal
  does not remove its CIMD client, grants or refresh tokens, and an issued JWT stays
  valid until it expires. For immediate denial, mark the session ended in the
  store (keep the record; deleting it lets the key restart) and check it on every
  request.
- **Never print secrets.** Client secrets, Management API tokens and signing keys
  stay in environment variables.

## Verify

1. `curl -i` both discovery documents: 200, JSON, no `Set-Cookie`. The issuer's
   `/.well-known/oauth-authorization-server` must list the Company origin in
   `protected_resources`. If it is `null`, real agents refuse the app at discovery.
2. Run `auth0 poppy doctor <host>` when the installed CLI has it.
3. Call the app as a guest (Session only) and as a signed-in agent; expect 200,
   then 401 on an account route without a token, and 403 for a missing scope.
4. Use the Poppy Playground's Protocol Debugger (https://poppyplayground.dev) for a
   real agent walk-through of discovery, the Session header, sign-in and browser
   join. It needs no LLM.
5. Confirm ordinary human login still works.

Only a registered agent on an enabled tenant can finish the browser hand-off, so
say so when it was not tested.

## Where the details live

Until each SDK ships its own Poppy guide, the open implementation PRs are the
reference for method names and config:

- Next.js: https://github.com/auth0/nextjs-auth0/pull/2939
- API (`@auth0/auth0-api-js`): https://github.com/auth0/auth0-auth-js/pull/342
- Server.js and Express: https://github.com/auth0/auth0-auth-js/pull/343
- CLI: https://github.com/auth0/auth0-cli/pull/1755 (`poppy setup`, `config`)
