# Auth0 Vercel native integration

Use this reference when the developer wants to install or manage Auth0 through
the Vercel Marketplace, connect an Auth0 integration to a Vercel project, or
sync Auth0 configuration into a Vercel-hosted Next.js application.

The native integration provisions a **new Auth0 tenant environment and
application** for the Vercel project, then preloads the Auth0 configuration in
Vercel. It does not connect an existing Auth0 account. For an existing tenant,
use the standard Auth0 application setup instead of installing this integration.

## Confirm before provisioning

Before installing, state what will happen and get confirmation:

- A new Auth0 account/tenant environment and application will be created.
- The integration will connect to the selected Vercel project and environments.
- Auth0 credentials will be populated in Vercel environment variables. Do not
  print, commit, or copy their values into source control.
- Removing the integration removes the connected Auth0 account and downgrades
  the installation to Vercel's Free plan.
- An installation plan is selected during setup. Paid plans are billed through
  Vercel via the integration's Settings page; state the selected plan and its
  billing impact.

Confirm the Vercel team, project, environments, application name, selected
installation plan, and optional environment-variable prefix. If the developer
wants an existing Auth0 tenant, stop this workflow and use the normal
tenant/application configuration path.

## Prerequisites

- A Vercel account and active Vercel project.
- A Next.js application using the current `@auth0/nextjs-auth0` SDK.
- Permission to install integrations for the intended Vercel team and create
  the connected Auth0 account.
- Iframe embedding enabled after installation, so Universal Login or Classic
  Login can load in the iframe required by Vercel. This relaxes the default
  framing protection for Universal Login, so enable it only for this
  integration and confirm the developer accepts the tradeoff.

The router co-loads the Next.js reference for the SDK implementation. Do not
replace its Auth0 routes, middleware/proxy, session handling, or environment
variable conventions with a marketplace-specific variant.

## Install the native integration

### Vercel Marketplace

1. In Vercel, open **Integrations** → **Browse Marketplace** and find
   **Auth0** under Native Integrations.
2. Select **Install**, choose the installation plan, and continue.
3. Name the Auth0 application and create it. Vercel creates the dedicated
   Auth0 tenant environment and application; wait for completion.
4. Select **Connect Project**, choose the Vercel project and target
   environments, enter a variable prefix only if the project requires one, and
   connect.
5. Open the integration's **Getting Started** page and follow its generated
   quickstart.

The Vercel CLI can start the same provisioning flow from the project directory.
Pass `--no-env-pull` so the CLI does not run `vercel env pull` automatically
after provisioning — pulling secrets is a separate, deliberate step below, run
only after confirming `.env.local` is ignored:

```bash
vc i auth0 --no-env-pull
```

Do not treat `vc i auth0` as read-only. It provisions a resource, so run it
only after the developer confirms the target team and project.

## Use the generated configuration safely

The integration preloads Auth0 credentials in the Vercel project. Its
quickstart exposes values such as `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
`AUTH0_DOMAIN`, and `AUTH0_SECRET`; retrieve them through Vercel rather than
copying secrets from a dashboard or committing a `.env.local` file.

If you set a variable prefix when connecting the project, Vercel names the
managed values `[prefix]_AUTH0_DOMAIN`, `[prefix]_AUTH0_CLIENT_ID`, and so on,
but the `@auth0/nextjs-auth0` SDK only reads the unprefixed default names.
Prefer connecting with no prefix. If a prefix is required, map the prefixed
values back to the standard names in your app before constructing `Auth0Client`
(or pass them explicitly to the constructor).

First confirm `.env.local` is both untracked and git-ignored so the pull cannot
write real client secrets into a tracked file. Stop if either check fails. Then
link the checkout and pull the values:

```bash
# BEFORE pulling any secrets: fail if .env.local is tracked or not ignored.
if git ls-files --error-unmatch -- .env.local >/dev/null 2>&1 \
   || ! git check-ignore --no-index --quiet -- .env.local; then
  echo ".env.local must be untracked and git-ignored before pulling secrets"
  exit 1
fi

# Link the local checkout to the intended Vercel project, then pull local-only values.
vercel link
# The native integration stores credentials in Production; pull that environment
# explicitly (env pull defaults to Development, which has no credentials).
vercel env pull .env.local --environment=production
```

For local development the current Next.js SDK also needs `APP_BASE_URL`; set it
to your local URL (e.g. `http://localhost:3000`) in `.env.local`, and keep the
canonical production URL configured for the deployed environment. The SDK can
infer `APP_BASE_URL` from the request on Vercel previews, but do not derive it
from an untrusted request header in code.

The native-integration quickstart only configures Auth0 environment variables
for the Production environment. Do not assume Preview or Development deployments
have the credentials; inspect the Vercel project settings and deliberately add
or scope variables before testing those environments.

## Deploy and verify

1. Follow the co-loaded Next.js reference to install `@auth0/nextjs-auth0`,
   configure `Auth0Client`, add the proxy/middleware, and add login/logout UI.
2. Verify the generated Auth0 application has the production callback and
   logout URLs. The integration populates localhost and callback URLs initially;
   update the application settings when the canonical domain or callback path
   changes.
3. Deploy to the selected Vercel Production environment and complete login,
   callback, session, protected-route, and logout checks on the deployed URL.
4. If login fails in Vercel's embedded experience, enable iframe embedding in
   the Auth0 tenant — but first restrict the allowed iframe origins to the
   intended Vercel URLs, then enable the setting. Check this before changing
   callback URLs or SDK code.

## Manage the integration

Use the Vercel project **Integrations** tab → **Auth0** → **Manage** to rotate
secrets, edit localhost/callback parameters, set allowed environments, change
the installation plan, or remove the integration. Use the Auth0 Dashboard for
application settings such as Universal Login customization.

Before rotating secrets or changing callback URLs, identify every deployment
that consumes the affected variables and plan a redeploy. After rotation,
confirm the new variables are present in the intended Vercel environment and
that login works before removing the old secret from dependent systems.

## Troubleshoot

| Symptom | Check | Resolution |
|---|---|---|
| Marketplace flow creates a different tenant than expected | Native-integration behavior | Expected: it creates a dedicated new Auth0 tenant environment. Use standard Auth0 setup for an existing tenant. |
| Local app has missing Auth0 variables | Vercel project link and environment selection | Run `vercel link` for the intended project, then `vercel env pull .env.local`; keep the file out of Git. |
| Production works but Preview fails | Variable scope | Add or scope the required variables deliberately; the generated quickstart configures Auth0 variables only for Production. |
| Callback mismatch after deploy | Canonical URL and Auth0 application URLs | Set `APP_BASE_URL` to the canonical URL and update the allowed callback/logout URLs to match the SDK's configured routes exactly. |
| Login does not render in Vercel's embedded experience | Iframe embedding | Enable iframe embedding in the Auth0 tenant, then retry before changing application code. |
| Integration removal has unexpected account impact | Removal warning | Stop and confirm the removal: deleting the integration removes the connected Auth0 account and downgrades the Vercel installation. |

## Auth0 in the v0 preview

The v0 preview runs your app inside a cross-site iframe on an HTTPS origin that
is neither localhost nor a `VERCEL_URL`. Three common auth failures all trace
back to that fact. Keep these in mind and the flow works the first time.

### 1. Redirect goes to localhost ("localhost refused to connect")

The SDK builds its login/callback redirect from a base-URL setting that
defaults to `localhost`. In the preview, `VERCEL_URL` and
`VERCEL_PROJECT_PRODUCTION_URL` are unset, so anything relying on them falls
back to localhost. Resolve the app's base URL from the runtime origin and
include the v0 preview origin (`V0_RUNTIME_URL`) in the fallback chain, ahead of
the localhost default. Verify by inspecting the actual `redirect_uri` on the
login redirect, not just that the page compiles.

### 2. State cookie dropped ("The state parameter is invalid")

The SDK stores a short-lived transaction/state cookie during the redirect and
reads it back on the callback. Default `SameSite=Lax` cookies are not sent on
the cross-site callback inside the iframe, so validation fails. When served over
HTTPS (preview and production), set the transaction and session cookies to
`SameSite=None; Secure`. Keep plain `localhost` HTTP on the safe defaults, since
`Secure` cookies can't be set over HTTP.

### 3. Login page won't frame ("This content is blocked")

Hosted login pages may send frame-busting headers when iframe embedding is not
enabled. For supported generative UI integrations, configure Auth0's iframe
embedding setting and Allowed iframe URLs; otherwise open authentication in a
top-level context. Enabling iframe embedding relaxes clickjacking protection.
Make the login (and logout) navigation break out of the iframe: detect when
running framed and open the auth route in a new top-level tab; otherwise
navigate normally. After login completes in the top-level context, the framed
preview needs a refresh to pick up the new session cookie.

### Configuration lives outside the code

Callback/logout URLs, tenant selection, and env var scoping are set in the Auth0
and Vercel dashboards, not in the app. The Vercel Auth0 integration auto-syncs
real Vercel deployment domains and owns the `AUTH0_*` env vars, so hand-edited
values can be overwritten — don't assume env vars alone prove which tenant an
environment uses; confirm from the dashboard.

Non-Vercel origins are never auto-synced, so walk the user through registering
them by hand. The one that gets the preview working is the app's **stable v0
preview URL** (`V0_RUNTIME_URL` e.g. `https://<project>.v0.build`) — it stays constant across
rebuilds, so registering it once is what makes login succeed in the preview.
(Per-deployment Vercel URLs change every build and aren't worth registering by
hand.) Also register `localhost` for local dev. The app can't do this itself —
give explicit steps:

1. In the Auth0 dashboard, pick the tenant the app's env vars point at
   (top-left tenant switcher — there may be separate Development/Staging/
   Production tenants).
2. Go to **Applications → Applications** and open the app's client (the
   integration names it "Created By Vercel"; match it by Client ID if unsure).
3. On the **Settings** tab, add to the comma-separated lists (use the stable
   v0 preview origin):
   - **Allowed Callback URLs**: the full callback path, e.g.
     `https://<project>.v0.build/auth/callback` (add `http://localhost:3000/auth/callback`
     too for local dev).
   - **Allowed Logout URLs**: the origin the user returns to, e.g.
     `https://<project>.v0.build`.
4. **Save Changes** at the bottom. Give the exact origin — Auth0 matches these
   URLs exactly, so a missing entry is what causes callback/logout rejections.
