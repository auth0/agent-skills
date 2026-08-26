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

The working vocabulary; the theory lives in the Auth0 docs (DEFER OUT):

- **Factor** - a verification method (TOTP/OTP, SMS, email, push, WebAuthn, voice, recovery code).
- **Step-up authentication** - requiring MFA for a specific action after an initial login that did not use MFA.
- **Adaptive MFA** - requiring MFA conditionally from risk or context signals rather than always.

Concept depth, factor trade-offs, and the enrollment UX are owned by
[Auth0 MFA docs](https://auth0.com/docs/secure/multi-factor-authentication) and
[Step-Up Authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication).
Do not restate them here.

## SDK integration

MFA has to be enforced in two independent places, and getting either wrong ships a bypass.

1. The tenant/login flow challenges the user (Guardian policy or Action) - see "Tenant configuration".
2. The app confirms MFA occurred and re-checks it server-side on the protected action, using the signal that matches the audience: a web app reads `amr` from its validated session/ID token; a resource API enforces the high-value **scope** on the access token (access tokens carry no `amr` by default).

Before writing any code, you MUST read the detected SDK's example - see "Example code
snippets" for the URL and how to retrieve it (use any URL-reading tool you have; do not
substitute a topic web search). Do not write MFA code from memory.

The two places, in detail:

1. **Tenant / login flow** - the tenant decides MFA is required (Guardian policy) or an Action requires it conditionally. This is what actually challenges the user. See "Tenant configuration".
2. **Application** - the app *triggers* a step-up and *verifies* the result. Triggering alone never enforces anything; verification is what closes the bypass.

### The mechanic: browser step-up

Do these in order:

1. **Trigger a step-up.** Request MFA at the authorization endpoint with the OIDC PAPE
   multi-factor `acr_values`, and force a fresh authentication with `max_age=0` so a
   still-valid session does not silently satisfy the request without a real challenge:

   ```
   GET /authorize?...&acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor&max_age=0
   ```

   This one HTTP shape is the language-neutral floor; every SDK wraps it. On a silent
   token request, an SDK may instead surface an `mfa_required` error (the SDK-native
   step-up path) that the app handles by re-authenticating interactively. Both routes
   satisfy the challenge, but the resulting signal differs by audience: a web app
   receives an ID token whose `amr` reflects that MFA occurred, while an API-audience
   request receives an access token carrying the high-value scope the challenge gated.

2. **Verify completion.** After the flow, confirm MFA actually happened using the signal
   that matches your audience (see the table below) - and **never re-decode or re-verify
   the token by hand** (`jwt.decode`, `PyJWKClient`, `id_token.split`, manual JWKS
   lookups): it duplicates validation the SDK already did and reliably ships *weaker*
   than the SDK - hand-rolled decodes routinely disable `exp`/`iss`/audience checks to
   "make it work".

   | Your context | How to verify MFA | Never |
   |---|---|---|
   | Session-managing SDK (web app holds the tokens for you) | Read the `amr` claim (Auth0 documents `mfa` in `amr` when MFA completed) off the SDK's own session / current-user accessor - the object it returns, or the result of completing the login - because the SDK already validated that token, so its claims are trustworthy as-is. `amr` is not a reliable contract for *which* factor ran; to enforce a **specific** factor on the backend, have a post-login Action read `event.authentication.methods[].type` and set a custom claim to check, rather than parsing a factor value out of `amr`. The accessor name is SDK-specific; see the loaded `framework-*` reference. | Re-decode or re-verify the token by hand |
   | Resource API (receives a raw bearer token) | Enforce the high-value **scope** (e.g. `transfer:funds`) on the access token in your *existing* JWT/scope-check middleware - see "Related capabilities". Access tokens carry **no `amr`** by default; only check `amr` here if the tenant adds it and this API validates it as a custom claim. Not MFA-specific SDK surface. | Check `amr` on an access token that has none (rejecting valid stepped-up callers); hand-roll token decoding; add MFA-specific SDK surface |
   | Frontend | Treat the `amr` check as UX, not security | Rely on it to enforce anything |

3. **Enforce server-side.** A frontend check is UX, not security. Any endpoint guarding a
   sensitive action must independently confirm MFA using the row above that matches its
   audience - a web/session backend on `amr`, a resource API on the required scope - and
   reject when that signal is absent.

4. **Conditional MFA** is required in a post-login Action that calls
   `api.multifactor.enable(...)`. Action-defined MFA behavior takes precedence over the
   Dashboard/Guardian policy, so it customizes or overrides that policy rather than being
   a separate engine that replaces it. This is distinct from **Adaptive MFA**, which is
   the Guardian `confidence-score` tenant policy (owned by the `tooling-*` reference); an
   Action can refine it. If the tenant-wide `all-applications` policy is set, MFA is
   already mandatory everywhere and an Action can only add conditions on top, not relax
   it. See "Tenant configuration".

### The mechanic: API-driven MFA (no-redirect flows)

When the app collects credentials itself instead of redirecting to Universal Login (a
direct-grant or passwordless back-end), no browser is present to run the challenge, so
the app drives MFA in-band. Sign-in returns an `mfa_required` error carrying an
`mfa_token` that drives enrollment, challenge, and verification below (removing a factor
needs a separate post-MFA access token - see step 4). Each step is a method on the
SDK's own MFA client - read the detected `framework-*` reference's example (see "Example
code snippets") for the exact names, and **never** hand-roll the token grant or the MFA
API URLs.

Do these in order:

1. **Detect and read the token.** Catch the `mfa_required` error and read the
   `mfa_token` off it.
2. **Branch on enrollment.** No factor yet -> associate (enroll) a new authenticator; the
   response is factor-specific: OTP enrollment returns a `barcode_uri` to render as a QR
   code, while out-of-band enrollment (SMS, voice, email, push) returns an `oob_code` to
   carry into the challenge step (push also returns a `barcode_uri`). Recovery codes are
   returned only the first time an authenticator is added. Already enrolled -> challenge
   the existing authenticator so the user is prompted for its code. An explicit
   enrolled/not-enrolled check and branching on the error's requirements are both
   acceptable.
3. **Verify to finish.** Verification is factor-specific and always carries the
   `mfa_token`: submit an OTP authenticator code as `otp`; for an out-of-band factor
   (SMS, voice, email, push) challenge first, then submit the returned `oob_code` (plus a
   `binding_code` when the channel requires one); submit a recovery code as
   `recovery_code` (a distinct factor type via the recovery-code grant, not treated as an
   OTP). Success returns tokens like an ordinary sign-in. Use the detected `framework-*`
   example for the exact method and grant names - do not hand-roll the grants.
4. **Self-service management.** Let a user list the account's authenticators and remove
   one through the same MFA client - not the Management API (see "MFA API surface" vs
   "Management API surface" below). Listing and challenging run on the `mfa_token`, but
   removing an authenticator requires a **post-MFA access token** with the
   `https://{yourDomain}/mfa/` audience and the `remove:authenticators` scope; the
   `mfa_token` alone does not authorize the `DELETE`.

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
requirements) are **not** listed here; they belong in the relevant `framework-*` reference.

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

**STOP - before writing any MFA code, run this procedure in order:**

1. **Find your row.** In the table below, pick the one row whose SDK matches the `framework-*`
   reference detected for this task. It is a lookup, not a judgment call - not the whole table.
2. **No matching row?** (For example a backend SDK such as `auth0-server-python`.) Skip to the
   language-neutral mechanic above. Stop here.
3. **Open that row's URL and read the section named in "Find section"** - it is the source of
   idiomatic usage. The URLs are raw markdown, so any tool that can read a URL works: `WebFetch`,
   `curl`/HTTP from your shell, or your web/docs-fetch tool.
4. **Can't read the URL** (no such tool, or the fetch fails)? Fall back to the language-neutral
   mechanic above. Stop here.
5. **Never** substitute a general web search for "how to do MFA", and **never** write MFA code
   from memory.

**Not done until** you have read the matching row's URL, or confirmed a skip case (step 2 or 4).

| SDK | Raw example file (markdown) | Find section |
|---|---|---|
| `@auth0/auth0-react` | https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-vue` | https://raw.githubusercontent.com/auth0/auth0-vue/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-angular` | https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/auth0-spa-js` | https://raw.githubusercontent.com/auth0/auth0-spa-js/main/EXAMPLES.md | `## Step-Up Authentication` |
| `@auth0/nextjs-auth0` | https://raw.githubusercontent.com/auth0/nextjs-auth0/main/EXAMPLES.md | `## Multi-Factor Authentication (MFA)` |
| `@auth0/auth0-auth-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-auth-js/EXAMPLES.md | `## Using Multi-Factor Authentication (MFA)` |
| `@auth0/auth0-server-js` | https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/MFA.md | whole file |

Enforce the high-value **scope** on the
access token with that standard middleware per "Related capabilities". Access tokens
carry no `amr` by default, so only check `amr` on the backend if this API adds and
validates it as a custom claim.

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
tenant MFA config is CLI or Terraform only. For conditional enforcement, a post-login
Action calling `api.multifactor.enable(...)` is configured via `tooling-cli`
(`auth0 actions ...`).

### MFA API surface (in-flow self-service)

The mechanic above wraps these MFA API endpoints - the language-neutral floor that every
SDK wraps; do not call them by hand. None need a Management API admin scope, but they do
not all take the same credential: enrolling, challenging, and listing run on the
`mfa_token` from the `mfa_required` error, while removing an authenticator requires a
post-MFA access token with the `https://{yourDomain}/mfa/` audience and the
`remove:authenticators` scope:

| Operation | Endpoint | Authorized by |
|---|---|---|
| Enroll (associate) a new authenticator | `POST /mfa/associate` | `mfa_token` when the user has no active factor yet; otherwise an `enroll`-scoped access token |
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
- **SDK-side step-up trigger** - the detected `framework-*` reference owns the SDK's own
  step-up call, its `mfa_required` handling, and any refresh-token requirement.
- **Server-side MFA enforcement** - the API `framework-*` references (JWT validation) own
  the scope/claim-check middleware; on a resource API gate the sensitive endpoint on the
  high-value scope (access tokens carry no `amr` by default), and on a web/session backend
  check the `amr` claim.
- **First login** - if the app has no login yet, add it with the `framework-*` reference
  before layering MFA.
