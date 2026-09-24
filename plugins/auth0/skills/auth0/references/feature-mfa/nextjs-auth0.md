# @auth0/nextjs-auth0 — MFA (v4)

The Next.js-specific MFA guide now ships **inside** the SDK package, pinned to the installed
version. This file bootstraps it: make sure the SDK is new enough, then read the guide from
`node_modules`. The shared mechanic, tenant config, and `amr`/error tables stay in the
shared MFA reference (`references/feature-mfa/index.md`).

## Bootstrap

1. `@auth0/nextjs-auth0` should already be installed (MFA is added to an existing app). If
   it isn't, run the `integrate` intent first.
2. Read and follow `node_modules/@auth0/nextjs-auth0/skills/nextjs-auth0/mfa/SKILL.md`. It
   is the source of truth and carries the exact method names for the installed version.
3. If that path does **not** exist, the installed version predates bundled skills (and may
   predate MFA support — base MFA needs **≥4.15.0**, popup step-up **≥4.19**). Upgrade:
   `npm install @auth0/nextjs-auth0@latest`, then re-check the path.
4. If it still isn't there (upgrade blocked, offline), use the Fallback below.

## Fallback

Only if the in-package skill above is unavailable. Condensed; the in-package skill is more
complete and version-accurate.

MFA methods: `auth0.mfa.*` (server, `.../server`) and the `mfa` named export (client,
`.../client`). Errors from `.../errors`. Configure `mfaTokenTtl` (or `AUTH0_MFA_TOKEN_TTL`).

- **NEVER put `mfa_token` in a URL/query string** — httpOnly cookie bound to session `sub`,
  or the popup flow (token stays in the server session).
- **`getAccessToken` defaults to `refresh: false`** — pass `refresh: true` to force the
  exchange so the post-login Action can throw `MfaRequiredError`.

Flows:
- **Redirect step-up:** persist `amr` via a `beforeSessionSaved` hook, gate on
  `session.user.amr?.includes("mfa")`, redirect to `/auth/login?acr_values=<PAPE MFA URI>&max_age=0&returnTo=…`
  or via `auth0.startInteractiveLogin(...)`. v4 has no `handleLogin` export.
- **Server-side on `mfa_required`:** catch `MfaRequiredError`, stash `error.mfa_token` in an
  httpOnly cookie bound to `sub`, redirect to your MFA page, verify, then delete the cookie.
- **Management API** (`{ mfaToken }`): `getAuthenticators`, `enroll` (otp → `barcodeUri`/`secret`;
  oob + `oobChannels`), `challenge` (oob only), `verify` (`otp` | `oobCode`+`bindingCode` | `recoveryCode`).
- **Reactive popup** (client, ≥4.19): `mfa.challengeWithPopup({ audience })` — call from a
  direct click handler (fresh user gesture), never an async `catch`, or `PopupBlockedError`.

Tenant: set MFA policy **Adaptive/Never**, never **Always** (it blocks background
`refresh_token` exchanges); enforce conditionally in a post-login Action.

Errors: `MfaRequiredError`, `MfaTokenNotFoundError`, `MfaTokenExpiredError`,
`MfaTokenInvalidError`, `MfaGetAuthenticatorsError`, `MfaEnrollmentError`,
`MfaChallengeError`, `MfaVerifyError`.
