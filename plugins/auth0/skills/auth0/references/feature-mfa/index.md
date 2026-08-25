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

### The mechanic (language-neutral)

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
   | Session-managing SDK (web app holds the tokens for you) | Read the `amr` claim (it contains `mfa`, plus the factor's own value if a specific factor is required) off the SDK's own session / current-user accessor - the object it returns, or the result of completing the login - because the SDK already validated that token, so its claims are trustworthy as-is. The accessor name is SDK-specific; see the loaded `framework-*` reference. | Re-decode or re-verify the token by hand |
   | Resource API (receives a raw bearer token) | Enforce the high-value **scope** (e.g. `transfer:funds`) on the access token in your *existing* JWT/scope-check middleware - see "Related capabilities". Access tokens carry **no `amr`** by default; only check `amr` here if the tenant adds it and this API validates it as a custom claim. Not MFA-specific SDK surface. | Check `amr` on an access token that has none (rejecting valid stepped-up callers); hand-roll token decoding; add MFA-specific SDK surface |
   | Frontend | Treat the `amr` check as UX, not security | Rely on it to enforce anything |

3. **Enforce server-side.** A frontend check is UX, not security. Any endpoint guarding a
   sensitive action must independently confirm MFA using the row above that matches its
   audience - a web/session backend on `amr`, a resource API on the required scope - and
   reject when that signal is absent.

4. **Adaptive / conditional MFA** is enforced in a post-login Action that calls
   `api.multifactor.enable(...)`, which is a full alternative enforcement path to the
   Guardian policy, not merely a layer on top of it. See "Tenant configuration".

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
| `mfa_required` | The session has not completed MFA | Re-authenticate interactively with the step-up parameters |
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

### Management API surface (enrollment)

For a custom enrollment experience, use the Management API (endpoints, not examples):

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
