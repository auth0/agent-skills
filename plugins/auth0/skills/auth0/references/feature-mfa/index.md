# Auth0 MFA

Require a second authentication factor - during login, or step-up before a sensitive action - and enforce it where it cannot be bypassed: on the tenant and on your API. For adding a first login to an app, use the `framework-*` reference instead; MFA layers on top of an existing login.

## When to use / when NOT to use

**Use when** the app must:

- Require a second factor for all logins (baseline enforcement).
- Step up to MFA before a specific sensitive action (payment, settings change, admin operation) without forcing it on every login.
- Require MFA conditionally based on risk, role, client, or requested scopes (adaptive MFA).
- Meet a compliance obligation that mandates multi-factor (PCI-DSS, SOC 2, HIPAA).

**Do NOT use this reference when:**

- The task is adding the initial login/logout to an app - that is the `framework-*` reference. MFA presupposes a working login.
- The request is passkeys/WebAuthn as the *primary* passwordless factor rather than a second factor - the mechanic overlaps but the framing differs; still route here for the enrollment surface, but treat passwordless login as a login concern.
- The task is only tenant provisioning with no application behavior - defer to `tooling-*`.

## Concepts

- **Factor** - a verification method (TOTP/OTP, SMS, email, push, WebAuthn, voice, recovery code).
- **Step-up authentication** - requiring MFA for a specific action after an initial login that did not use MFA.
- **Adaptive MFA** - requiring MFA conditionally from risk or context signals rather than always.

## SDK integration

MFA must be enforced in two independent places; getting either wrong ships a bypass:

1. **Tenant / login flow** - the tenant decides MFA is required (Guardian policy or Action). This is what actually challenges the user. See "Tenant configuration".
2. **Application** - the app triggers the step-up and *verifies* the result. Triggering alone enforces nothing; verification closes the bypass.

**Pick one mechanic:**

- App redirects to Universal Login (regular web app or SPA) -> **browser step-up** below.
- App collects credentials itself (a direct-grant or passwordless backend, e.g. `@auth0/auth0-auth-js` / `@auth0/auth0-server-js`) -> **API-driven MFA** below; skip the browser-step-up section.

Before writing code, read the detected SDK's example (see "Example code snippets").

### The mechanic: browser step-up

Recipe (do in order):

1. **Trigger.** Send the authorization request with the PAPE multi-factor `acr_values` and
   `max_age=0` (forces a fresh challenge so a live session cannot satisfy it silently).
   Every SDK wraps this one shape:

   ```
   GET /authorize?...&acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor&max_age=0
   ```

2. **Verify** completion with the signal that matches your audience (table below).
3. **Enforce** that same signal server-side on every protected endpoint, rejecting when it
   is absent. A frontend check is UX, never security.
4. **Conditional MFA:** require it from a post-login Action calling `api.multifactor.enable(...)`.

| Your context | Verify with |
|---|---|
| Session-managing SDK (web app) | The `amr` claim (contains `mfa` when MFA completed) off the SDK's own session / current-user accessor - already validated, so trust it as-is. Accessor name is SDK-specific -> see the SDK's own example ("Example code snippets" below). |
| Resource API (raw bearer token) | The high-value **scope** (e.g. `transfer:funds`) on the access token, via your *existing* JWT/scope-check middleware - see "Related capabilities". |
| Frontend | Nothing - treat any `amr` check as UX, never enforcement. |

Notes: a silent token request may instead surface an `mfa_required` error - handle it by
re-authenticating interactively. Never re-decode or re-verify the token by hand (see
"Common mistakes"). Some session SDKs persist only a default subset of ID-token claims, so
`amr` can be missing from the accessor until you opt it in (see "Common mistakes"). `amr` is not a reliable contract for *which* factor ran; to enforce a
**specific** factor, have the post-login Action read `event.authentication.methods[].type`
into a custom claim. Action-defined MFA overrides the Guardian policy (it refines, not
replaces) and differs from **Adaptive MFA** (the Guardian `confidence-score` policy, owned
by `tooling-*`); if the `all-applications` policy is set, an Action can only add conditions,
not relax it.

### The mechanic: API-driven MFA (no-redirect flows)

The app collects credentials, so no browser runs the challenge: sign-in returns an
`mfa_required` error carrying an `mfa_token`. Each step is a method on the SDK's own MFA
client - get exact names from the SDK's own example ("Example code snippets" below); never hand-roll the token grant
or the MFA API URLs.

Recipe (do in order):

1. **Read the token.** Catch `mfa_required`; read `mfa_token` off it.
2. **Branch on enrollment.**
   - *No factor yet* -> associate (enroll). OTP returns a `barcode_uri` to render as a QR
     code; out-of-band (SMS/voice/email/push) returns an `oob_code` you confirm by
     submitting it directly to the token endpoint (MFA OOB grant, plus a `binding_code`
     when the channel requires one) - a just-associated authenticator needs no separate
     `/mfa/challenge`. Recovery codes are returned only on first enrollment.
   - *Already enrolled* -> challenge the existing authenticator so the user is prompted for
     its code.

   (An explicit enrolled/not-enrolled check or branching on the error's requirements are both fine.)
3. **Verify to finish.** Always carries the `mfa_token`: submit an OTP code as `otp`; for an
   already-enrolled out-of-band factor, `/mfa/challenge` first for a fresh `oob_code`, then
   submit it (plus a `binding_code` when needed); submit a recovery code as `recovery_code`
   (its own recovery-code grant, not treated as an OTP). Success returns tokens like an
   ordinary sign-in.
4. **Self-service management.** List and remove factors through the MFA client, not the
   Management API. List and challenge use the `mfa_token`; **removal needs a post-MFA access
   token** (`https://{yourDomain}/mfa/` audience + `remove:authenticators` scope) - the
   `mfa_token` alone does not authorize the `DELETE`. See "MFA API surface".

### Feature-level symbols

Protocol-level names that are identical across every SDK - what a grader would assert
and what the app must get right:

| Symbol | Meaning |
|---|---|
| `acr_values` | Authorization-request parameter used to request MFA |
| `http://schemas.openid.net/pape/policies/2007/06/multi-factor` | The PAPE value that requests multi-factor |
| `max_age=0` | Forces fresh authentication so a live session cannot satisfy the step-up silently |
| `amr` | ID-token claim listing the methods used; contains `mfa` when MFA completed. Not present on access tokens by default |
| `acr` | Claim echoing the satisfied authentication context |
| high-value scope | An API scope (e.g. `transfer:funds`) whose request an Action gates behind MFA; its presence on the access token is the API-side proof of step-up |
| `api.multifactor.enable(...)` | Post-login Action call that requires MFA for the current login |

SDK-specific symbols (an SDK's own method or option name - e.g. the silent-token call,
the `mfa_required`/`MfaRequiredError` handling, the interactive re-auth option, refresh-token
requirements) are **not** listed here; get them from the SDK's own example (see "Example code snippets").

### `amr` claim values

The `amr` array reports how the user authenticated (protocol-level; KEEP INLINE):

| Value | Meaning |
|---|---|
| `pwd` | Password |
| `mfa` | Multi-factor authentication completed |
| `otp` | One-time password (TOTP authenticator app) |
| `sms` | SMS code |
| `email` | Email code |
| `hwk` | Hardware key (WebAuthn security key) |
| `swk` | Software key |
| `pop` | Proof of possession |
| `fed` | Federated (social / enterprise) |

### Error responses

Returned by the token/authorization endpoints during an MFA flow (KEEP INLINE):

| Error | Cause | Handling |
|---|---|---|
| `mfa_required` | MFA has not been completed | Browser flow: re-authenticate interactively with the step-up parameters. No-redirect flow: read the `mfa_token` off the error and drive the MFA API (enroll/challenge/verify) |
| `association_required` | The user has no authenticator enrolled | Send the user through enrollment (self-service or enrollment ticket), then challenge |
| `unsupported_challenge_type` | The app supports none of the challenge types the user is enrolled with, or the user is not enrolled | Align the app's supported challenge types with the user's enrolled authenticators (or enroll the user) - do NOT change tenant config first |
| `mfa_invalid_code` | Wrong OTP entered | Prompt to retry |
| `too_many_attempts` | Repeated failures | Back off; the account may be temporarily blocked |

### Example code snippets

**Before writing MFA code:** find the row below matching the detected SDK **and** the flow
being implemented — for SDKs with both an `(MFA)` and a `(step-up)` row, default to `(step-up)` unless the user explicitly requests the MFA API flow.
Read ONLY the named section from its URL (from that heading down to the next `## `) - these
are large multi-topic files, so with `WebFetch` ask it to return just that section verbatim.
No matching row (a backend SDK not listed below), or the fetch fails? Fall back to the
language-neutral mechanic above. Never substitute a web search for "how to do MFA".

| SDK | Raw example file (markdown) | Find section |
|---|---|---|
| `@auth0/auth0-react` (MFA) | https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md | `## Multi-Factor Authentication (MFA)` |
| `@auth0/auth0-react` (step-up) | https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-vue` (MFA) | https://raw.githubusercontent.com/auth0/auth0-vue/main/EXAMPLES.md | `## Multi-Factor Authentication (MFA)` |
| `@auth0/auth0-vue` (step-up) | https://raw.githubusercontent.com/auth0/auth0-vue/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-angular` (MFA) | https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md | `## Multi-Factor Authentication (MFA)` |
| `@auth0/auth0-angular` (step-up) | https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-spa-js` (step-up) | https://raw.githubusercontent.com/auth0/auth0-spa-js/main/examples/step-up-authentication.md | whole file |
| `@auth0/nextjs-auth0` | https://raw.githubusercontent.com/auth0/nextjs-auth0/main/guides/mfa.md | whole file |
| `@auth0/auth0-auth-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-auth-js/examples/mfa.md | whole file |
| `@auth0/auth0-server-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/MFA.md | whole file |
| `Auth0.swift` (iOS/macOS) | https://raw.githubusercontent.com/auth0/Auth0.swift/master/examples/mfa-api.md | whole file |
| `Auth0.Android` | https://raw.githubusercontent.com/auth0/Auth0.Android/main/examples/authentication-api/mfa-flexible-factors.md | whole file |
| `auth0-server-python` (MFA flow) | https://raw.githubusercontent.com/auth0/auth0-server-python/main/examples/MFA.md | whole file |
| `auth0-server-python` (step-up) | https://raw.githubusercontent.com/auth0/auth0-server-python/main/examples/StepUpAuthentication.md | whole file |

## Tenant configuration

A factor must be enabled before anything can challenge with it; enabling a factor alone
never prompts anyone until an enforcement path requires it, and setting enforcement
before any factor is enabled leaves users unable to complete MFA. So enable the factor
first, then choose an enforcement path - the two are independent:

- **Tenant-wide (Guardian policy)** - set `guardian/policies` to `["all-applications"]` to
  require MFA for *every* application on every login. This is the only path the ordering
  rule above is about, and the CLI anchor below shows it.
- **Conditional (post-login Action)** - enable the factor and configure an Action that
  calls `api.multifactor.enable(...)`; do **not** set the `all-applications` policy, or MFA
  becomes mandatory for every application instead of the conditions the Action defines.

The CLI anchor for the tenant-wide path (enable factor, then require the policy):

```bash
# 1. Enable a factor (otp shown; others: sms, email, push-notification,
#    webauthn-roaming, webauthn-platform)
auth0 api put "guardian/factors/otp" --data '{"enabled": true}'

# 2. Require MFA tenant-wide. PUT replaces the whole policy list with a bare array;
#    the wrong verb answers with a 404 that reads like a path/permissions problem.
#    An empty array means "available but NOT required".
auth0 api put "guardian/policies" --data '["all-applications"]'
```

The full factor set, the `confidence-score` (adaptive) policy, the Terraform
`auth0_guardian` resource, and MCP coverage are owned by the loaded `tooling-*`
reference (DEFER ACROSS): the Auth0 MCP server exposes no Guardian/MFA tool, so
tenant MFA config is CLI or Terraform only.

### MFA API surface (in-flow self-service)

The mechanic above wraps these MFA API endpoints - the language-neutral floor that every
SDK wraps; do not call them by hand. None need a Management API admin scope, but they do
not all take the same credential: enrolling, challenging, and listing run on the
`mfa_token` from the `mfa_required` error, while removing an authenticator requires a
post-MFA access token with the `https://{yourDomain}/mfa/` audience and the
`remove:authenticators` scope:

| Operation | Endpoint | Authorized by |
|---|---|---|
| Enroll (associate) a new authenticator | `POST /mfa/associate` | `mfa_token` when the user has no active factor yet; otherwise an `enroll`-scoped access token for the `https://{yourDomain}/mfa/` audience |
| List the user's enrolled authenticators | `GET /mfa/authenticators` | `mfa_token` |
| Challenge an enrolled authenticator | `POST /mfa/challenge` | `mfa_token` |
| Remove an enrolled authenticator | `DELETE /mfa/authenticators/{id}` | post-MFA access token, `remove:authenticators` scope, mfa audience |
| Complete sign-in with the verified factor | `POST /oauth/token` (MFA grant) | `mfa_token` |

### Management API surface (admin / out-of-band enrollment)

Only for acting on a user *by id* with a Management API token (an admin dashboard or a
provisioning back-end) - **not** for a user managing their own factors in the flow above,
which uses the `mfa_token` and the MFA API surface instead:

| Operation | Endpoint |
|---|---|
| List a user's authentication methods | `GET users/{id}/authentication-methods` |
| Delete one authentication method | `DELETE users/{id}/authentication-methods/{authentication_method_id}` |
| Send an enrollment ticket | `POST guardian/enrollments/ticket` |

## Common mistakes

| Mistake | Why it breaks | Correct approach |
|---|---|---|
| Setting a Guardian policy before enabling any factor | Users are required to do MFA but have no factor to complete it with | Enable the factor first, then set the policy |
| Treating an enabled factor as enforcement | A factor with no policy never challenges anyone | Enforce with a policy or a post-login Action |
| Reading `guardian/policies` as `[]` and assuming MFA is on | `[]` means available but not required | Confirm a non-empty policy (or an Action that enables MFA) |
| Trusting a frontend MFA check | The client can be bypassed entirely | Enforce server-side: `amr` on a web/session backend, the high-value scope on a resource API |
| Checking `amr` on a resource API's access token | Access tokens carry no `amr` by default, so valid stepped-up callers are rejected | Gate the API on the high-value scope; add `amr` as a custom claim only if this API also validates it |
| Hand-decoding the token to read `amr` (`jwt.decode`, `PyJWKClient`, `id_token.split`, manual JWKS) | Reinvents validation the SDK already performed, and usually disables `exp`/`iss`/audience checks in the process | Read `amr` from the SDK's session/current-user accessor; its claims are already verified |
| Assuming the session accessor always carries `amr` | Some SDKs persist only a default claim subset, so `amr` is silently absent and the check never passes | Opt the claim in: `@auth0/nextjs-auth0` v4 needs a `beforeSessionSaved` hook to copy `amr` into the session (`session.user.amr`); `express-openid-connect` keeps the full claims on `req.oidc.idTokenClaims`, not the filtered `req.oidc.user` |
| Omitting `max_age=0` on step-up | A still-valid session satisfies the request with no fresh challenge | Send `max_age=0` (or the SDK's fresh-auth option) for step-up |
| Ignoring `mfa_required` from a silent token call | The step-up silently fails and the action proceeds unverified | Catch it and re-authenticate interactively |
| Preferring SMS by default | SMS is vulnerable to SIM-swap | Prefer TOTP or WebAuthn; treat SMS as a fallback |
| No recovery codes enabled | Users get locked out when they lose a device | Enable recovery codes during enrollment |
| Wrong HTTP verb on `guardian/policies` | Returns a misleading 404 | Use `PUT` with a bare JSON array |
| Using the Management API to list or remove a user's own factors during the sign-in flow | Forces the app to hold Management API admin scopes and ignores the `mfa_token` the flow already issued | List and challenge through the SDK's MFA client on the `mfa_token`; remove with a post-MFA `remove:authenticators` access token (mfa audience); reserve the Management API for admin / out-of-band |
| Assuming an already-enrolled factor needs no challenge and jumping straight to verify | Diverges from the SDK's documented enrolled-factor flow and breaks for out-of-band factors (SMS/push), whose challenge is what delivers the code | Challenge the enrolled authenticator, then verify |

## Related capabilities

- **Tenant setup and Actions** - `tooling-cli` and `tooling-terraform` own Guardian
  factor/policy configuration and Action deployment (`auth0 actions ...`).
- **SDK-side step-up trigger** - the SDK's own step-up call, its `mfa_required` handling,
  and any refresh-token requirement live in that SDK's own example (see "Example code
  snippets"), not in a `framework-*` reference.
- **Server-side MFA enforcement** - the API `framework-*` references (JWT validation) own
  the scope/claim-check middleware; on a resource API gate the sensitive endpoint on the
  high-value scope (access tokens carry no `amr` by default), and on a web/session backend
  check the `amr` claim.
- **First login** - if the app has no login yet, add it with the `framework-*` reference
  before layering MFA.

## References
[Auth0 MFA docs](https://auth0.com/docs/secure/multi-factor-authentication)
[Step-Up Authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication).