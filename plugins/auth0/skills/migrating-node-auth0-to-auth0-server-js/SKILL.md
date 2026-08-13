---
name: migrating-node-auth0-to-auth0-server-js
description: Migrate Auth0 authentication code off the node-auth0 SDK (the `auth0` package, `AuthenticationClient`) to `@auth0/auth0-auth-js` (stateless token grants) or `@auth0/auth0-server-js` (server-managed sessions). Use when porting `AuthenticationClient` usage — `.oauth`, `.database`, `.passwordless`, `.backchannel`, `.tokenExchange`, `UserInfoClient` — off node-auth0 v5, when replacing the `auth0` package's Authentication API in a Node.js backend, or when planning a node-auth0 auth deprecation. Rewrites only the authentication layer, not the surrounding application.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
---

# Migrating from node-auth0 to auth0-auth-js / auth0-server-js

This skill guides a **surgical rewrite of the authentication layer only**. You replace the
node-auth0 `AuthenticationClient` (and `UserInfoClient`) call sites with the modern SDK
equivalents. You do **not** rewrite the surrounding application — routes, controllers,
business logic, data access, and framework wiring stay as they are. The goal is to touch
the smallest possible surface: the files that import and call node-auth0's Authentication API.

## Scope

**In scope:** any code that imports from the `auth0` package and uses:

- `AuthenticationClient` and its sub-clients: `.oauth`, `.database`, `.passwordless`, `.backchannel`, `.tokenExchange`
- `UserInfoClient`
- The auth error types (`AuthApiError`) and token-validation types (`IDTokenValidateOptions`, `IdTokenValidatorError`)

**Out of scope (do not touch):** the `ManagementClient` (Management API v2 — it is **not**
being migrated and stays on the `auth0` package), application routes, view/controller logic,
database code, and any non-auth use of the `auth0` package.

> If a file uses `ManagementClient`, leave that code alone. Only rewrite the
> `AuthenticationClient` / `UserInfoClient` parts. It is normal and correct for a file to keep
> importing `auth0` for management while importing `@auth0/auth0-auth-js` for authentication.

## Which target SDK?

node-auth0's `AuthenticationClient` is **stateless**: every method is one HTTP call that returns
a response object. It does not manage sessions, cookies, or state. Two migration targets exist,
and the right one depends on what the customer's code does around those calls.

| If the customer's code… | Migrate to | Why |
|---|---|---|
| Only performs token grants / DB signup / passwordless / userinfo and manages its own session (or is an M2M / service-to-service backend) | **`@auth0/auth0-auth-js`** | Direct, near 1:1 replacement for `AuthenticationClient`. Same stateless model. |
| Wants the SDK to own the login redirect flow, session storage, cookies, token refresh, and logout (a server-rendered web app) | **`@auth0/auth0-server-js`** | Adds a session layer node-auth0 never had. This is a **rewrite of the session handling**, not a method-for-method port. |

**Default recommendation:** start with **`@auth0/auth0-auth-js`** for a faithful parity
migration. Recommend **`@auth0/auth0-server-js`** only when the customer currently hand-rolls
session/cookie/refresh logic around node-auth0 and would benefit from the SDK owning it.

Read [references/routing-and-config.md](references/routing-and-config.md) for the full decision
procedure and the constructor/option mapping for both targets.

## Workflow

Follow these steps in order. Load the referenced file at the step that needs it — do not read
all references up front.

### 0. Pre-flight safety

Before touching any code, verify the environment is safe for an in-place rewrite:

1. **Require clean working tree:** The migration rewrites source files in place. Uncommitted changes could be lost. Check the repository state:
   
   ```bash
   git status --porcelain
   ```
   
   If the output is empty, proceed. If not, **refuse to proceed** unless the user explicitly overrides with confirmation that they understand the risk.

2. **Create a backup branch:** Before any rewrite, capture the current state:
   
   ```bash
   git checkout -b pre-migration-backup-$(date +%Y%m%d-%H%M%S)
   git checkout -  # return to the working branch
   ```
   
   Confirm the backup branch was created and inform the user of its name.

3. **Verify SDK versions:** Check that the target SDKs are installed and meet the minimum version requirements:
   
   - `@auth0/auth0-auth-js` >= v1.12.0
   - `@auth0/auth0-server-js` >= v1.10.0
   
   If per-request options (`signal`, `headers`, per-call `customFetch` in `RequestOptions`) are required, note that these features are **unreleased** as of auth-js v1.12.0 (added by PR #230, pending merge and release). If the customer needs these features, gate the migration until the release lands or provide instructions for installing from a pre-release branch.

4. **Verify source SDK:** Confirm that node-auth0 v5 is present in the project's dependencies and is the source SDK being migrated.

### 1. Discover every call site

Run the discovery script against the customer's source root:

```bash
bash scripts/scan-usage.sh <path-to-src>
```

It inventories every `AuthenticationClient` / `UserInfoClient` import and every sub-client call
(`.oauth.*`, `.database.*`, `.passwordless.*`, `.backchannel.*`, `.tokenExchange.*`,
`.getUserInfo`), and separately flags `ManagementClient` usage so you know what **not** to touch.

Use the output to decide scope and to route (auth-js vs server-js) per the table above.

### 2. Install the target SDK and update the constructor

Add the target package, then rewrite the client construction. The constructor options mostly
carry over with camelCase names; a few are renamed or dropped.

→ [references/routing-and-config.md](references/routing-and-config.md) — constructor/option mapping.

### 3. Rewrite each call site using the method mapping

Go sub-client by sub-client. For every node-auth0 method, apply the mapped replacement.

→ [references/api-mapping.md](references/api-mapping.md) — the complete method-by-method mapping
with before/after code for `.oauth`, `.database`, `.passwordless`, `.backchannel`,
`.tokenExchange`, and `UserInfoClient`.

### 4. Apply the three structural changes at every call site

Regardless of which method you touch, three cross-cutting changes apply. These are the source
of nearly all migration bugs — apply them deliberately, not mechanically:

1. **Return shape** — node-auth0 wraps results in `JSONApiResponse<T>` (`.data`, `.status`,
   `.headers`). The new SDKs return the domain object directly. Read `resp.data.X` becomes `resp.X`.
2. **Casing** — node-auth0 uses the snake_case wire shape (`client_id`, `access_token`,
   `expires_in`). The new SDKs use camelCase (`clientId`, `accessToken`, `expiresAt`).
3. **Token expiry** — node-auth0's `expires_in` is a **relative** lifetime in seconds. The new
   SDKs' `expiresAt` is an **absolute** Unix timestamp in seconds. Any arithmetic like
   `Date.now()/1000 + expires_in` must be rewritten, or you introduce a silent expiry bug.

Plus the **error model** change: node-auth0 throws `AuthApiError`; the new SDKs throw typed
per-operation errors (`TokenByCodeError`, etc.) with a structured `.cause`. MFA is detected with
the `isMfaRequiredError()` guard instead of string-matching `error === 'mfa_required'`.

→ [references/breaking-changes.md](references/breaking-changes.md) — verbose treatment of all
four changes with before/after examples, gotchas, and the exact field-by-field field maps.

### 5. (Session apps only) Wire the session layer

If routing to `@auth0/auth0-server-js`, replace the customer's hand-rolled session/cookie/refresh
handling with the ServerClient flow (`startInteractiveLogin` → `completeInteractiveLogin` →
`getUser` / `getAccessToken` → `logout`) and a state/transaction store.

→ [references/server-js-sessions.md](references/server-js-sessions.md) — the session model,
store setup, and the redirect-flow rewrite.

### 6. Build-until-green verification loop

The migration is not complete until all verification steps pass. Run the following in sequence,
and repeat the entire loop if **any** step fails:

1. **Run the verification script** to detect residue patterns (unmigrated imports, `.data.` references, relative `expires_in` arithmetic):
   
   ```bash
   bash scripts/verify-migration.sh <path-to-src>
   ```

2. **Type-check the project** to catch structural mismatches and type errors:
   
   ```bash
   tsc --noEmit
   ```

3. **Run the project's test suite** to confirm behavior is preserved:
   
   ```bash
   npm test  # or the project's test command
   ```

4. **Run the linter** if the project has one configured.

If any step fails, fix the reported issues and start the loop again from step 1. **Do not declare
the migration complete until the loop converges** — all four steps pass in a single iteration.

If the target repository has a skill that composes verification-before-completion checks, invoke
that skill here to ensure consistency with the repo's own quality gates.

## Reference index

- [references/routing-and-config.md](references/routing-and-config.md) — target-SDK decision + constructor/option mapping
- [references/api-mapping.md](references/api-mapping.md) — full method-by-method mapping, all sub-clients
- [references/breaking-changes.md](references/breaking-changes.md) — return shape, casing, `expiresAt`, error model
- [references/server-js-sessions.md](references/server-js-sessions.md) — session layer for web apps

## SDK versions this skill targets

- **Source:** `auth0` (node-auth0) v5.x — `AuthenticationClient`, `UserInfoClient`
- **Target:** `@auth0/auth0-auth-js` >= v1.12.0 (token layer), `@auth0/auth0-server-js` >= v1.10.0 (session layer)

**Important:** Per-request `RequestOptions` (`signal`, `headers`, per-call `customFetch`) are
**unreleased** as of `@auth0/auth0-auth-js` v1.12.0. These features were added by PR #230 and are
pending merge and release. If the migration requires these options, you must either wait for the
release or install from a pre-release branch.
