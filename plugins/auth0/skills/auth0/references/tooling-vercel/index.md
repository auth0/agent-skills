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

Confirm the Vercel team, project, environments, application name, and optional
environment-variable prefix. If the developer wants an existing Auth0 tenant,
stop this workflow and use the normal tenant/application configuration path.

## Prerequisites

- A Vercel account and active Vercel project.
- A Next.js application using the current `@auth0/nextjs-auth0` SDK.
- Permission to install integrations for the intended Vercel team and create
  the connected Auth0 account.
- Iframe embedding enabled after installation, so Universal Login or Classic
  Login can load in the iframe required by Vercel.

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

The Vercel CLI can start the same provisioning flow from the project directory:

```bash
vc i auth0
```

Do not treat `vc i auth0` as read-only. It provisions a resource, so run it
only after the developer confirms the target team and project.

## Use the generated configuration safely

The integration preloads Auth0 credentials in the Vercel project. Its
quickstart exposes values such as `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
`AUTH0_DOMAIN`, and `AUTH0_SECRET`; retrieve them through Vercel rather than
copying secrets from a dashboard or committing a `.env.local` file.

```bash
# Link the local checkout to the intended Vercel project, then pull local-only values.
vercel link
vercel env pull .env.local
```

Verify `.env.local` is ignored by Git. The current Next.js SDK also needs
`APP_BASE_URL`; set it to the canonical production URL if it is not populated
by the integration. Do not derive it from an untrusted request header.

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
4. Enable iframe embedding in the Auth0 tenant after installation. If login
   fails in Vercel's embedded experience, check this setting before changing
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
