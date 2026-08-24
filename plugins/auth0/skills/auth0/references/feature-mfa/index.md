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

**Done only when BOTH are true:**

1. The tenant/login flow challenges the user (Guardian policy or Action) - see "Tenant configuration".
2. The app verifies `amr` contains `mfa` AND re-checks it server-side on the protected action.

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
   end at the same place: an ID/access token whose `amr` reflects that MFA occurred.

2. **Verify completion.** After the flow, confirm the `amr` (Authentication Methods
   Reference) claim contains `mfa` (and, if a specific factor is required, the factor's
   `amr` value). This is the only trustworthy signal that MFA happened. Read `amr`
   according to the context you are in - and **never re-decode or re-verify the token by
   hand** (`jwt.decode`, `PyJWKClient`, `id_token.split`, manual JWKS lookups): it
   duplicates validation the SDK already did and reliably ships *weaker* than the SDK -
   hand-rolled decodes routinely disable `exp`/`iss`/audience checks to "make it work".

   | Your context | How to read / enforce `amr` | Never |
   |---|---|---|
   | Session-managing SDK (web app holds the tokens for you) | Read the claim off the SDK's own session / current-user accessor - the object it returns, or the result of completing the login - because the SDK already validated that token, so its claims are trustworthy as-is. The accessor name is SDK-specific; see the loaded `framework-*` reference. | Re-decode or re-verify the token by hand |
   | Resource API (receives a raw bearer token) | Ordinary claim check layered on the framework's *existing* JWT-validation middleware - see "Related capabilities". Not MFA-specific SDK surface. | Hand-roll token decoding, or add MFA-specific SDK surface |
   | Frontend | Treat the `amr` check as UX, not security | Rely on it to enforce anything |

3. **Enforce server-side.** A frontend `amr` check is UX, not security. Any endpoint
   guarding a sensitive action must independently confirm `mfa` is in `amr` and reject
   when it is absent, using the row above that matches your context.

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
| `amr` | Claim listing the methods used; contains `mfa` when MFA completed |
| `acr` | Claim echoing the satisfied authentication context |
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
| `mfa_registration_required` | No factor enrolled | Send the user through enrollment (self-service or enrollment ticket) |
| `mfa_invalid_code` | Wrong OTP entered | Prompt to retry |
| `too_many_attempts` | Repeated failures | Back off; the account may be temporarily blocked |
| `unsupported_challenge_type` | Requested factor is not enabled on the tenant | Enable the factor (see "Tenant configuration") |

### Examples

Per-SDK link table to each SDK's maintained, versioned example. This reference states
the mechanic; the linked file is the source of truth for idiomatic usage. Rows exist
only for SDKs whose example source was verified to cover step-up/MFA.

| SDK | Example |
|---|---|
| `@auth0/auth0-react` | [Step-Up Authentication](https://github.com/auth0/auth0-react/blob/main/EXAMPLES.md#step-up-authentication) |
| `@auth0/auth0-vue` | [Step-Up Authentication](https://github.com/auth0/auth0-vue/blob/main/EXAMPLES.md#step-up-authentication) |
| `@auth0/auth0-angular` | [Step-Up Authentication](https://github.com/auth0/auth0-angular/blob/main/EXAMPLES.md#step-up-authentication) |
| `@auth0/auth0-spa-js` | [Step-Up Authentication](https://github.com/auth0/auth0-spa-js/blob/main/EXAMPLES.md#step-up-authentication) |
| `@auth0/nextjs-auth0` | [Multi-Factor Authentication (MFA)](https://github.com/auth0/nextjs-auth0/blob/main/EXAMPLES.md#multi-factor-authentication-mfa) |

Backend `amr` enforcement has no MFA-specific example in the Auth0 API SDKs today
(they ship generic claim-check middleware); apply their standard claim-check to the
`amr` claim per "Related capabilities".

## Tenant configuration

MFA is not enforced until a factor is enabled **and** a policy requires it. Enabling a
factor without a policy never prompts anyone; setting a policy before any factor is
enabled leaves users unable to complete MFA. Enable the factor first. This ordering is
the mechanic, not an example - the minimal CLI anchor:

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
| List a user's enrolled authenticators | `GET users/{id}/authenticators` |
| Delete an enrollment | `DELETE users/{id}/authenticators/{authenticator_id}` |
| Send an enrollment ticket | `POST guardian/enrollments/ticket` |

## Common mistakes

| Mistake | Why it breaks | Correct approach |
|---|---|---|
| Setting a Guardian policy before enabling any factor | Users are required to do MFA but have no factor to complete it with | Enable the factor first, then set the policy |
| Treating an enabled factor as enforcement | A factor with no policy never challenges anyone | Enforce with a policy or a post-login Action |
| Reading `guardian/policies` as `[]` and assuming MFA is on | `[]` means available but not required | Confirm a non-empty policy (or an Action that enables MFA) |
| Trusting a frontend `amr` check | The client can be bypassed entirely | Validate `amr` server-side on every protected API call |
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
- **Server-side `amr` enforcement** - the API `framework-*` references (JWT validation)
  own the claim-check middleware; apply it to the `amr` claim.
- **First login** - if the app has no login yet, add it with the `framework-*` reference
  before layering MFA.
