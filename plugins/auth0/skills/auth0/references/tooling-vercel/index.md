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
