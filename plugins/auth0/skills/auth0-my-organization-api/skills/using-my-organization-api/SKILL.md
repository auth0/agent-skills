---
name: using-my-organization-api
description: Build or extend portals that let B2B customers manage their own organization settings using Auth0’s My Organization API. Use when a user wants to let customers manage their own SSO, branding, or org settings — including any scenario where responsibility for configuration is delegated from the product owner to the customer: self-service admin portals, customer-managed SSO setup, letting customers configure their own identity providers, giving customers control over their organization without direct Auth0 access, or building a white-label admin experience. Also use when starting a delegated admin implementation from scratch, adding My Organization API to an existing delegated admin setup, or integrating pre-built UI components. Covers Auth0 config, SaaStart quickstart path, API-only integration, UI component integration, and backend validation.
license: Proprietary
metadata:
  author: Auth0 Delegated Administration Team <authn-b2b-delegated-admin@okta.com>
---

# Using My Organization API

> **Agent instructions — read before responding:**
> - **Never ask if the user has an Auth0 account or tenant.** Always detect it. Check env files, the Auth0 CLI, the CLI config, and — as a final fallback — call the Auth0 MCP tool `mcp__auth0_mcp__auth0_get_tenant_name()` to retrieve the tenant domain directly. Only ask the user if all of these return nothing.
> - Only ask about organization selection when multiple organizations exist in the tenant.
> - **Assume React and Next.js unless the user specifies otherwise.** My Organization API and its tooling are optimized for this stack. Do not ask about framework unless the user has indicated they are not using Next.js.
> - **Prefer Auth0 CLI and Auth0 developer tooling over manual steps wherever possible.** Use `auth0` CLI commands, the scripts in `<skill-path>/scripts/`, Auth0 SDKs (`@auth0/nextjs-auth0`, `@auth0/myorganization-js`, `@auth0/universal-components-react`), and the Auth0 Dashboard before reaching for general-purpose tools or writing custom implementations.
> - **Be prescriptive. Do not reinvent auth flows, login pages, dashboard layouts, or session handling.** Follow the path defined in "Choose Your Path" exactly. Use SaaStart patterns as the reference for all auth and session setup. Do not invent custom implementations of things SaaStart or the Universal Components docs already define.
> - **Determine the path from the decision tree in "Choose Your Path" — do not ask the user to choose.** Detect the project state and follow the tree. Only ask if the project state is genuinely ambiguous after detection.
> - **Empty codebase with no specified stack:** scaffold Next.js, bootstrap with SaaStart, and use Universal Components. Inform the user of the choice, do not ask.
> - **NEVER create a database.** Do not introduce Prisma, Supabase, MongoDB, SQLite, PostgreSQL, or any other database or ORM at any point in this implementation. **Auth0 is the source of organizations and users.** Organizations exist in Auth0. Users exist in Auth0. All org and user data must be read directly from Auth0 — via the My Organization API, Management API, or session. There is no need to store, sync, or mirror this data in a database. Creating a database to store users or organizations is incorrect and must not be done unless the user explicitly and specifically asks for it.
> - **Do not ask the user what features or capabilities they want in the dashboard.** The features are determined by what My Organization API supports — they are not configurable. Proceed directly to implementation. My Organization API supports: SSO provider setup, organization settings, and branding. If the user asks about anything else (billing, subscriptions, app settings, user profiles, usage logs, member management, etc.), explain that it is not yet supported by My Organization API and they will need to use the Management API directly with organization-awareness built in (scoping all calls to the user's `org_id`).
> - **Before starting the dev server, always run the pre-flight checks in "Configure Application URLs" and fix any issues found automatically** — do not wait for the user to encounter errors. Check and fix: callback/logout/web origin URLs on the Auth0 application, required env vars in `.env.local`, and org membership for the test user. If anything is missing, fix it silently and confirm what was done.
> - **Try local before suggesting deployment.** Always attempt `npm run build` and `npm run dev` locally first. Do not suggest Vercel or any other deployment platform as a resolution path — deployment is out of scope for this skill and cannot be validated from within the agent environment.
> - **When referencing SaaStart or any README, cite specific sections by name** (e.g. "Step Five: Run the sample application") rather than giving generic "check the README" advice.
> - **If `EAGAIN: resource temporarily unavailable` appears**, explain that this is an OS-level file descriptor limit, not a code bug, and that it cannot be resolved from within the agent environment. Instruct the user to retry the command in their terminal outside the agent.

**Delegated admin** lets your B2B customers manage their own organization—SSO providers, branding, and settings—without you doing it for them or giving them access to Auth0 directly. My Organization API is the Auth0 feature that makes this possible.

## What You’ll Build

An organization-scoped admin dashboard enabling:
- 🔐 Customer-controlled SSO provider setup
- 📋 Role-based access control (RBAC)
- 🎨 Organization branding and display settings

**Estimated implementation time:** 2–3 hours
**Difficulty:** Intermediate (requires Auth0, Next.js, backend API knowledge)
**Best for:** Anyone building or extending a delegated admin portal — from first-time implementers learning the API to teams adding My Organization API or UI components to an existing setup

## When to Use This Skill

Use this skill if you are:

- **New to Auth0 or My Organization API** — you want to understand what delegated admin is and how My Organization API enables it
- **Starting from scratch** — you're building a new delegated admin portal and want the fastest path using the SaaStart reference app
- **Existing delegated admin setup, adding the API** — you already have delegated administration and want to integrate My Organization API calls directly into your app
- **Existing delegated admin setup, adding UI components** — you already have delegated administration and want to drop in pre-built UI components from `@auth0/universal-components-react`

## When NOT to Use This Skill

❌ Tenant-level org lifecycle (creating/deleting organizations) — use the Management API directly
❌ Non-Next.js implementations without adaptation — code examples are Next.js-specific
❌ General Auth0 Organizations setup (use **auth0-organizations** skill instead)
❌ User self-service account management (use **My Account API** skill instead)

---

## What is My Organization API?

My Organization API is a **user-scoped** API — org admins call it directly from the browser using an organization-scoped access token, without proxying through your backend.

| | My Organization API |
|---|---|
| **Called from** | Browser (client-side) |
| **Token type** | User access token (org-scoped) |
| **Audience** | `https://YOUR_DOMAIN/my-org/` |
| **Used for** | SSO setup, org settings |

This is why the audience URL (`/my-org/`) matters and why scopes are granted to the logged-in user rather than a backend service account.

Once you understand the concept, use the **Choose Your Path** table below to determine the right implementation approach based on what you detect about the user's setup — do not ask the user which path to take.

---

## Choose Your Path

Detect the project state and follow this decision tree. Do not ask the user to choose a path.

```
Does an existing codebase exist?
│
├── NO → Use SaaStart (Step 2 → SaaStart)
│         Clone, bootstrap, and run. Do not build from scratch.
│
└── YES → Does the app already have UI for the delegated admin use case
          (e.g. SSO provider management, org settings)?
          │
          ├── YES → Port existing Management API calls to My Org API
          │         (Step 2 → Porting to My Org API)
          │         Do not rebuild the UI. Just swap the API calls.
          │
          └── NO → Add UI using Universal Components
                    (Step 2 → UI Components)
                    Install missing dependencies (Shadcn, Tailwind) if needed —
                    do NOT skip to custom UI because a dependency is missing.
                    Only fall back to custom UI if the framework is non-React.
```

**What you need ready (all paths):**
- Auth0 tenant with Organizations enabled
- Node.js v20+ and npm installed
- Auth0 CLI: `npm i -g auth0`

---

## Step 1: Enable My Organization API

> **Always detect before asking.** Run the steps below before prompting the user about their setup. Only ask when detection is genuinely ambiguous (e.g. multiple organizations exist).

### Detect Existing Configuration

Run `detect-stack.mjs` to read the project's framework, package manager, Tailwind setup, existing Auth0 config, and key file paths in one pass. Use its output throughout all subsequent steps — do not grep env files or inspect package.json manually.

```bash
node <skill-path>/scripts/detect-stack.mjs <project-root>
```

Key fields to extract from the output:
- `data.auth0.domain` — use as the tenant domain if set; otherwise fall back to CLI
- `data.auth0.clientId` — use if set
- `data.framework` — `nextjs` or `react-spa`
- `data.tailwind.major` / `data.cssPath` — needed for theme extraction and verify-setup
- `data.mainCssFile` — path to the main CSS file (needed for extract-theme.mjs)
- `data.packageManager` / `data.installCmd` — use for all install commands

If `data.auth0.domain` is not set, check the Auth0 CLI:
```bash
auth0 tenants list        # use the active tenant
cat ~/.config/auth0/config.json 2>/dev/null | grep '"default_tenant"'
```

If the CLI config also returns nothing, call the Auth0 MCP tool before asking the user:
```
mcp__auth0_mcp__auth0_get_tenant_name()
```
This tool is always available in the environment and returns the tenant domain directly. Use its output as the domain for all subsequent steps.

Only ask the user for their Auth0 domain if all four sources return nothing.

### Validate Auth0 CLI Session

First, confirm the Auth0 CLI is available in the shell — the validation script uses Node.js `execFileSync` which does not inherit the full shell PATH, so check reachability in bash first:

```bash
which auth0 || command -v auth0
```

If not found, install it:
```bash
# macOS
brew install auth0

# Other platforms: https://github.com/auth0/auth0-cli#installation
```

Once confirmed available, run the validation script with the full shell PATH forwarded so Node.js can find the `auth0` binary:

```bash
PATH="$PATH" node <skill-path>/scripts/validate-auth0.mjs --domain <tenant-domain>
```

If the script returns an error, follow the `fallback_instructions` in the output to re-authenticate, then re-run before continuing.

### Identify Organization

Once the tenant is known, check which organizations exist:

```bash
auth0 api get /api/v2/organizations
```

- **No organizations returned:** Proceed without asking — the user will create one as part of the implementation.
- **One organization returned:** Use it automatically. Do not prompt the user.
- **Multiple organizations returned:** List their names and ask the user: _"Which organization should this delegated admin portal be for?"_ then use the selected org's ID throughout.

### Identify Application

Determine which Auth0 application to configure:

- **SaaStart path:** Use the application created by the bootstrap script — do not prompt the user.
- **Existing setup (not SaaStart):** List existing apps and ask the user which one to update:
  ```bash
  auth0 apps list
  ```
  Ask: _"Which application should the delegated admin portal use?"_
- **No existing app and not using SaaStart:** Default the application name to `Delegated Admin Dashboard`.

### Prerequisites
- Auth0 tenant with Organizations enabled
- Application configured for organization-scoped access
- Management API access for backend operations
- Node.js v20+ and npm installed

### Bootstrap Auth0 Tenant

> **SaaStart note:** The SaaStart repo has its own bootstrap — skip this step and run `npm run auth0:bootstrap YOUR_DOMAIN` from the SaaStart repo instead.

For all other paths (API-only, UI Components), run `bootstrap.mjs` to idempotently configure all required Auth0 resources: My Organization API resource server, application client, callback/logout/web origin URLs, client grants, database connection, admin role, and demo organization.

```bash
PATH="$PATH" node <skill-path>/scripts/bootstrap.mjs \
  --domain <tenant-domain> \
  --features myorg \
  --framework nextjs \
  --app-name "<app-name>" \
  --port 3000
```

The script outputs a JSON object with `data.env_vars` — write every key/value pair into `.env.local`:

```bash
# Example: write env vars from bootstrap output to .env.local
# (Parse the JSON output and append each key=value line)
```

The script is **idempotent** — safe to re-run if it fails partway through. If it exits with `status: "partial"`, check `error.fallback_instructions` and re-run after resolving.

### Verify Setup

Before starting the dev server, check that the installed Next.js version satisfies the peer dependency range declared by `@auth0/nextjs-auth0`:

```bash
node -e "
const auth0Pkg = require('./node_modules/@auth0/nextjs-auth0/package.json');
const nextPkg = require('./node_modules/next/package.json');
const peer = auth0Pkg.peerDependencies?.next || 'not declared';
console.log('Next.js installed:', nextPkg.version);
console.log('Peer dep range:', peer);
"
```

If the installed Next.js version is outside the declared peer range, downgrade Next.js to the latest compatible version or pin it in `package.json`. Mismatched versions cause `workUnitAsyncStorage` invariant errors at runtime.

Then run `verify-setup.mjs` to confirm everything is wired up correctly before starting the dev server:

```bash
PATH="$PATH" node <skill-path>/scripts/verify-setup.mjs \
  --project-root <project-root> \
  --framework <framework> \
  --css-path <cssPath>
```

For any check that returns `pass: false`, apply the fix in its `fix` field automatically — do not ask the user. Re-run until all checks pass.

### Client Application Configuration
Configure your application to access the My Organization API. The example below uses the Auth0 SPA JS / browser SDK (`@auth0/auth0-spa-js`) — see Step 2 for the Next.js server-side equivalent:

```javascript
// Browser SDK (@auth0/auth0-spa-js)
const auth0 = new Auth0Client({
  domain: 'YOUR_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  authorizationParams: {
    audience: 'https://YOUR_DOMAIN/my-org/',
    scope: 'openid profile email read:my_org:details update:my_org:identity_providers'
  }
})
```

### Required Scopes
```
read:my_org:details           - Read organization profile
update:my_org:details         - Update organization settings
create:my_org:identity_providers - Configure SSO providers
read:my_org:identity_providers   - View SSO configuration
update:my_org:identity_providers - Modify SSO settings
delete:my_org:identity_providers - Remove SSO providers
```

---

## Step 2: Implement Admin Dashboard

### SaaS Developer Workflow

Use the [SaaStart reference application](https://github.com/auth0-ui-components/saas-starter-uicomponents) as your foundation — it's a complete working implementation you can bootstrap in minutes:

> ⚠️ **The bootstrap script will create roles, organizations, and custom Actions on the tenant.** Make sure you're comfortable with these resources being added before running it.

```bash
# Clone the reference application
git clone https://github.com/auth0-ui-components/saas-starter-uicomponents.git
cd saas-starter-uicomponents

# Install dependencies
npm install

# Configure environment
cp .env.local.user.example .env.local.user
```

Edit `.env.local.user` with the following required values:
```
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
SESSION_ENCRYPTION_SECRET=<run: openssl rand -hex 32>
CUSTOM_CLAIMS_NAMESPACE=https://example.com
```

```bash
# Authenticate with Auth0 CLI (required for bootstrap)
auth0 login --domain YOUR_TENANT_DOMAIN

# Bootstrap Auth0 tenant (creates all necessary resources including
# admin/member roles, organizations, and custom actions)
npm run auth0:bootstrap YOUR_TENANT_DOMAIN

# Start development server
npm run dev
```

**First run:** Visit `http://localhost:3000`, create an account with an organization name, and you'll land in the delegated admin dashboard.

**What SaaStart already includes:** The reference app ships with the Auth0Client configuration, middleware, and permission validation patterns from Steps 2 and 3 already implemented. After bootstrapping, review these patterns to understand how the app works and customize them for your needs — you don't need to implement them from scratch.

### Porting Existing Management API Calls to My Org API

Use this path when an existing app already has UI for a delegated admin use case (e.g. SSO provider management) and you need to move those API calls from the Management API to My Org API. **Do not rebuild the UI** — only change the API layer.

#### Step 1: Add the My Organization SDK

```bash
npm install @auth0/myorganization-js
```

Update `lib/auth0.ts` to request the My Org API audience and scopes. SaaStart users: this file is named `lib/app-client.ts` and exports `appClient` — update in place:

```typescript
// lib/auth0.ts (or lib/app-client.ts in SaaStart)
const MY_ORG_SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'read:my_org:details', 'update:my_org:details',
  'create:my_org:identity_providers', 'read:my_org:identity_providers',
  'update:my_org:identity_providers', 'delete:my_org:identity_providers'
]

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  authorizationParameters: {
    audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
    scope: MY_ORG_SCOPES.join(' ')
  }
})
```

Initialize the My Org client with the **token supplier pattern**:

```typescript
// lib/my-org-client.ts
import { MyOrganizationClient } from '@auth0/myorganization-js'
import { auth0 } from '@/lib/auth0'

export const myOrgClient = new MyOrganizationClient({
  domain: process.env.AUTH0_DOMAIN!,
  token: async ({ scope }) => {
    const { token } = await auth0.getAccessToken({ scopes: [scope] })
    return token
  }
})
```

#### Step 2: Replace Management API calls with My Org API calls

The typical use case is SSO provider management. Replace calls like this:

```typescript
// Before: Management API (requires M2M token, backend-only)
await managementClient.connections.get({ id: connectionId })
await managementClient.connections.create({ ... })

// After: My Org API (uses user's org-scoped token)
import { myOrgClient } from '@/lib/my-org-client'
import { MyOrganizationError } from '@auth0/myorganization-js'

try {
  const providers = await myOrgClient.identityProviders.getAll()
  // or: await myOrgClient.identityProviders.create({ ... })
} catch (err) {
  if (err instanceof MyOrganizationError) {
    console.error(err.statusCode, err.message)
  }
}
```

See the **[myorganization-js SDK reference](https://github.com/auth0/myorganization-js)** for the full list of available methods.

#### Member Management
> **Not yet supported by My Organization API.** This feature is planned for a future release. The pattern below uses the Management API in the interim.

```typescript
// app/dashboard/organization/members/actions.ts
export const createInvitation = withServerActionAuth(
  async function createInvitation(formData: FormData, session: SessionData) {
    const email = formData.get('email')
    const role = formData.get('role') as Role

    await managementClient.organizations.createInvitation({
      id: session.user.org_id!
    }, {
      invitee: { email },
      inviter: { name: session.user.name! },
      client_id: process.env.AUTH0_CLIENT_ID,
      roles: role === 'admin' ? [process.env.AUTH0_ADMIN_ROLE_ID!] : []
    })

    revalidatePath('/dashboard/organization/members')
  },
  { role: 'admin' }
)
```

### UI Components

Use this path when an existing app does **not** yet have UI for a delegated admin use case. Add it using `@auth0/universal-components-react` — do not build custom forms from scratch. Follow the [Universal Components docs](https://auth0.com/docs/get-started/universal-components/universal-components-overview) exactly.

> **Only fall back to custom UI if the framework is non-React.** Missing dependencies (Shadcn, Tailwind, react-hook-form) are not a reason to skip Universal Components — install them first. Do not interpret a missing dependency as framework incompatibility.

**Before installing Universal Components, check and install all required dependencies:**

```bash
# 1. Check detect-stack output for shadcn.installed and tailwind.installed
# If shadcn.installed: false — install and configure Shadcn UI first:
npx shadcn@latest init

# If tailwind.installed: false — install Tailwind CSS:
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Do not proceed to Universal Components until `shadcn.installed: true` and `tailwind.installed: true`.

`@auth0/universal-components-react` provides pre-built React components for SSO provider setup, organization details editing, and more.

**Install dependencies:**
```bash
npm install @auth0/universal-components-react react-hook-form
```

Also required: **Shadcn UI** and **Tailwind CSS v3** — see the [Universal Components docs](https://auth0.com/docs/get-started/universal-components/universal-components-overview) for setup.

**Extract theme overrides from the project's existing CSS:**

Use `extract-theme.mjs` to generate a complete Auth0 component theme override block from the project's CSS variables. Use `data.mainCssFile` and `data.cssPath` from the `detect-stack.mjs` output:

```bash
node <skill-path>/scripts/extract-theme.mjs \
  --css-file <project-root>/<mainCssFile> \
  --css-path <cssPath>
```

From the output:
- Apply `data.generatedOverrideBlock` verbatim to the project's main CSS file (`:root` block)
- Pass `data.themeSettingsVariables` as the `themeSettings` prop on `Auth0ComponentProvider`

**Available components:**
- `OrganizationDetailsEdit` — view and edit organization settings and branding (recommended starting point)
- `SsoProviderCreate` / `SsoProviderList` — configure OIDC/SAML identity providers

**Set up `Auth0ComponentProvider`:**

All components require `Auth0ComponentProvider` as a wrapper — it handles token acquisition, caching, and i18n. For Next.js, use proxy mode:

```tsx
// app/layout.tsx (or a dedicated providers component)
import { Auth0ComponentProvider } from '@auth0/universal-components-react/rwa'
import '@auth0/universal-components-react/styles'

export default function RootLayout({ children }) {
  return (
    <Auth0ComponentProvider
      mode="proxy"
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN}
      proxyConfig={{ baseUrl: '/api/auth' }}
      interactiveErrorHandler="popup"
    >
      {children}
    </Auth0ComponentProvider>
  )
}
```

**Use a component:**
```tsx
// app/dashboard/organization/details/page.tsx
import { OrganizationDetailsEdit } from '@auth0/universal-components-react/rwa'

export const dynamic = 'force-dynamic'

export default function OrganizationDetailsPage() {
  return <OrganizationDetailsEdit />
}
```

```tsx
// app/dashboard/organization/sso/create/page.tsx
import { SsoProviderCreate } from '@auth0/universal-components-react/rwa'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SsoProviderCreatePage() {
  const router = useRouter()
  return (
    <SsoProviderCreate
      createAction={{ onAfter: () => router.push('/dashboard/organization/sso') }}
      backButton={{ onClick: () => router.back() }}
    />
  )
}
```

See the **[Universal Components docs](https://auth0.com/docs/get-started/universal-components/universal-components-overview)** for the full component catalogue and styling options.

#### Security Policies
> **Not yet supported by My Organization API.** This feature is planned for a future release. The pattern below uses the Management API in the interim.

```typescript
// app/dashboard/organization/security-policies/actions.ts
export const updateMfaPolicy = withServerActionAuth(
  async function updateMfaPolicy(formData: FormData, session: SessionData) {
    const enforce = !!formData.get('enforce')
    const providers = ['otp', 'webauthn-roaming'].filter(p => formData.get(p))

    await managementClient.organizations.update({
      id: session.user.org_id!
    }, {
      metadata: {
        mfaPolicy: JSON.stringify({
          enforce,
          providers,
          skipForDomains: []
        })
      }
    })

    revalidatePath('/dashboard/organization/security-policies')
  },
  { role: 'admin' }
)
```

---

## Step 3: Backend Validation

> **Add `export const dynamic = 'force-dynamic'` to every auth-gated server component page or layout that calls `auth0.getSession()` or any async Auth0 API.** This prevents the `workUnitAsyncStorage` invariant error on Next.js 15.5.x and is a safe default for all protected pages.

### Organization Context Middleware
```typescript
// middleware.ts
import { auth0 } from '@/lib/auth0'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default async function middleware(req: NextRequest) {
  const authRes = await auth0.middleware(req)
  const session = await auth0.getSession()
  const orgId = session?.user.org_id

  if (!orgId) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  return authRes
}
```

### Permission Validation
```typescript
// lib/with-server-action-auth.ts
export function withServerActionAuth<T extends any[], U extends any>(
  serverActionWithSession: (...args: [...T, session: SessionData]) => U,
  options: { role?: Role }
) {
  return async function (...args: T) {
    const session = await auth0.getSession()

    if (options.role && getRole(session.user) !== options.role) {
      throw new Error(`Admin access required`)
    }

    return serverActionWithSession(...args, session)
  }
}
```

---

## Additional Resources

- **[SaaStart Reference App](https://github.com/auth0-ui-components/saas-starter-uicomponents)** - Complete implementation example
- **[myorganization-js SDK](https://github.com/auth0/myorganization-js)** - Official JavaScript SDK for My Organization API
- **[My Organization API Docs](https://auth0.com/docs/manage-users/my-organization-api)** - Official documentation
- **[Organizations Overview](https://auth0.com/docs/manage-users/organizations)** - Core concepts
- **[Universal Components](https://github.com/auth0/auth0-ui-components)** - Pre-built React components for delegated admin (org settings, SSO setup, and more)

## Common Mistakes & Fixes

Every mistake here has been reported by developers implementing My Organization API. Use this diagnostic guide to unblock yourself:

**1. Access Denied errors with correct scopes**
- **Cause:** Token audience is wrong (using `https://domain/` instead of `https://domain/my-org/`)
- **Fix:**
  1. Check your Next.js auth client configuration
  2. Set `authorizationParameters.audience` to exactly `https://YOUR_DOMAIN/my-org/`
  3. Redeploy and request a new token
- **Verify:** Decode your access token at [jwt.io](https://jwt.io) and check that `.aud` claim contains `https://YOUR_DOMAIN/my-org/` ✓

**2. SaaStart bootstrap fails with 401**
- **Cause:** Auth0 CLI not authenticated or user lacks admin permissions
- **Fix:**
  1. Run `auth0 login --domain YOUR_DOMAIN`
  2. Select your org tenant at the prompt
  3. Wait for browser confirmation
- **Verify:** Run `auth0 tenants list` and see your tenant listed ✓

**3. Scope errors in token request ("Invalid scope")**
- **Cause:** Requesting scopes that don't exist or aren't enabled on the My Organization API
- **Fix:**
  1. Go to Auth0 Dashboard > Applications > APIs
  2. Click **My Organization API**
  3. Go to **Scopes** tab and verify these scopes exist:
     ```
     read:my_org:details
     update:my_org:details
     read:my_org:identity_providers
     create:my_org:identity_providers
     update:my_org:identity_providers
     delete:my_org:identity_providers
     ```
  4. Update your auth client config to only request available scopes
- **Verify:** Token request succeeds and you get a valid access token ✓

**4. CORS failures from browser**
- **Cause:** Browser is blocking My Organization API requests
- **Fix:**
  1. No configuration needed—My Organization API has CORS enabled by default
  2. Check your browser DevTools > Network tab for the actual error
  3. Verify your Auth0 domain matches your app's configuration
- **Verify:** API request succeeds with 200 status in DevTools Network tab ✓

**5. Role-based access control not enforced**
- **Cause:** Dashboard shows all buttons but backend doesn't validate permissions
- **Fix:**
  1. Implement `withServerActionAuth` wrapper on all protected actions
  2. Always validate `session.user.org_id` and role server-side
  3. Never trust client-side role checks
- **Verify:** Try accessing as non-admin user—you should get "Admin access required" error ✓

**6. API/Management API confusion**
- **Cause:** Using wrong API for the wrong operation
- **Fix:**
  - **Use My Organization API** (`https://your-domain/my-org/`) for: SSO setup, org settings
  - **Use Management API** for: Tenant-level operations outside the scope of this skill
  - In Next.js: Management API uses `managementClient.organizations.*`; My Organization API calls come directly from client
- **Verify:** Check which API each endpoint uses by reading the [api.md](references/api.md) reference ✓

**7. Mixing My Account API and My Organization API**
- **Cause:** Building both org self-service (delegated admin) and user self-service (profile/password)
- **Fix:**
  - Use **My Organization API** for delegated admin (admin-level operations)
  - Use **My Account API** for user profile/password/settings (user-level operations)
  - They have different audiences and scopes
- **Verify:** My Organization API page shows team/org settings; My Account API shows individual user settings ✓

**8. Forgetting offline_access scope**
- **Cause:** Admin sessions expire mid-workflow with 401 errors
- **Fix:**
  1. Add `offline_access` to your My Organization API scopes
  2. Ensure refresh tokens are stored in Next.js session
- **Result:** Users can stay logged in for long admin tasks without interruption ✓

**9. "Callback URL mismatch" or "callback URL not set" at login**
- **Cause:** The Auth0 application doesn't have the app's callback URL in its Allowed Callback URLs list
- **Fix:**
  1. Go to Auth0 Dashboard > Applications > Applications > your app > Settings
  2. Add to **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
  3. Add to **Allowed Logout URLs**: `http://localhost:3000`
  4. Add to **Allowed Web Origins**: `http://localhost:3000`
  5. Save and retry login
  Or via CLI: `auth0 api patch "v2/clients/YOUR_CLIENT_ID" --data '{"callbacks":["http://localhost:3000/api/auth/callback"],"allowed_logout_urls":["http://localhost:3000"],"web_origins":["http://localhost:3000"]}'`
- **Verify:** Login completes and redirects back to `http://localhost:3000/dashboard` ✓

**10. "Invalid state" error after login redirect**
- **Cause:** `AUTH0_SECRET` is missing, empty, or too short — this causes the session state cookie to be invalid or unreadable
- **Fix:**
  1. Generate a secret: `openssl rand -hex 32`
  2. Add to your `.env.local`: `AUTH0_SECRET=<generated value>`
  3. Also ensure `AUTH0_BASE_URL=http://localhost:3000` is set and matches your running app URL
  4. Restart the dev server
- **Verify:** Login flow completes without errors; check that `AUTH0_SECRET` is at least 32 characters ✓

**11. "Not authorized" after login**
- **Cause:** The logged-in user is not a member of the organization, or the organization's connection is not enabled for this application
- **Fix:**
  1. In Auth0 Dashboard > Organizations > your org > Members, confirm the user is listed
  2. In Auth0 Dashboard > Organizations > your org > Connections, confirm your database connection is enabled
  3. In Auth0 Dashboard > Applications > your app > Organizations, confirm the org is associated with the app
  4. If testing with a new account, create the account first, then add it as an org member with the admin role
- **Verify:** User can log in and `session.user.org_id` is populated ✓

**12. "The client was not found" error**
- **Cause:** `AUTH0_CLIENT_ID` in `.env.local` doesn't match any application on the tenant — usually because the bootstrap created the client but the env vars weren't written, or the wrong tenant domain is being used
- **Fix:**
  1. Run `auth0 apps list` and find the app created during bootstrap
  2. Copy its `client_id` value
  3. Update `AUTH0_CLIENT_ID` (and `AUTH0_CLIENT_SECRET`) in `.env.local` to match
  4. Confirm `AUTH0_DOMAIN` matches the tenant the app was created on
  5. Restart the dev server
- **Verify:** Run `node <skill-path>/scripts/verify-setup.mjs --project-root . --framework nextjs` and confirm `env_vars_present` passes ✓

**14. `workUnitAsyncStorage` invariant error on Next.js 15.5.x**
- **Cause:** Next.js 15.5.x changed how async context is propagated in server components. Calling `auth0.getSession()` or other async Auth0 APIs from a server component page without opting out of static rendering triggers the invariant error.
- **Fix:**
  1. Add `export const dynamic = 'force-dynamic'` to every auth-gated server component page or layout that calls async Auth0 APIs
  2. If the error persists, check that the installed Next.js version is within the peer dep range of `@auth0/nextjs-auth0`: `cat node_modules/@auth0/nextjs-auth0/package.json | grep -A3 peerDependencies`
  3. If Next.js is too new, pin it: `npm install next@<compatible-version>`
- **Verify:** Pages load without the invariant error in the console ✓

**13. Dev server crashes on startup with TCP/socket errors**
- **Cause:** A bad Auth0 configuration (missing or mismatched env vars) causes the Next.js server to throw during module initialization, which crashes the process before it can bind to the port
- **Fix:**
  1. Check `.env.local` for missing `AUTH0_SECRET`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, or `AUTH0_DOMAIN`
  2. Re-run `node <skill-path>/scripts/verify-setup.mjs --project-root . --framework nextjs` and apply all fixes
  3. Restart the dev server only after all checks pass
- **Verify:** `npm run dev` starts without errors and binds to `http://localhost:3000` ✓

## After Your Implementation

Once your admin dashboard is live:

1. **Test with a real org admin account** — Walk through SSO setup and org configuration end-to-end
2. **Monitor token refresh** — Ensure offline sessions don't drop mid-workflow
3. **Plan for scale** — If you have >100 organizations, optimize caching of organization metadata
4. **Security audit** — Run through the backend validation checklist with your security team

## Related Skills

- **auth0-organizations** — General Auth0 Organizations setup and lifecycle management
- **My Account API** — User self-service account management (profile, password, MFA)
- **auth0-sso-configuration** — SSO provider setup (if you need deeper guidance)
- **auth0-mfa** — Multi-factor authentication policies and enforcement
- **auth0-roles-permissions** — Role-based access control (RBAC) implementation

## Quick Reference

### Scopes Needed
```
openid profile email offline_access
read:my_org:details
update:my_org:details
read:my_org:identity_providers
create:my_org:identity_providers
update:my_org:identity_providers
delete:my_org:identity_providers
```

### Audience Required
```
https://YOUR_AUTH0_DOMAIN/my-org/
```

### Key Environment Variables
```
AUTH0_DOMAIN=your-domain.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_ADMIN_ROLE_ID=role_xxxxx
```

## Documentation

For step-by-step help with:
- **Code examples by SDK** → see [examples.md](references/examples.md)
- **Backend validation patterns** → see [backend.md](references/backend.md)
- **Advanced topics** (Actions, webhooks) → see [advanced.md](references/advanced.md)
- **API endpoints & CLI commands** → see [api.md](references/api.md)