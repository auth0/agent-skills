# Auth0 Universal Portals

Auth0 Universal Portals provides hosted, self-service portals instead of an application-owned “My Account” or “My Organization” UI. A **consumer portal** lets end users manage their profile, passkeys, and MFA. A **business portal** lets organization administrators manage organization details and domains. One **combined portal** can do both.

> **Developer Preview.** Universal Portals works in tenants where Auth0 has enabled it. If the feature is not enabled for the tenant, direct the developer to Auth0 Support.

A portal is backed by a Regular Web Application, the **portal application**. The portal server uses that application's credentials for SSO, keeps tokens server-side, and sets browser session cookies. It requests section-specific access tokens and refreshes them through a multi-resource refresh token. Do not build a browser-side token exchange or expose the portal application's client secret.

Universal Portals is a hosted surface, not an SDK integration, unlike Universal Components, which you embed and wire up with SDKs. Do not add a React, Next.js, or mobile SDK to render portal components. An application may link users to the hosted portal, but the portal's pages and navigation are configured in Auth0.

## Choose the right workflow

| Developer goal | Use |
|---|---|
| Create a consumer or business portal with its APIs, application, grants, and forms in one step | `auth0-beta universal-portals setup` |
| Check or repair the configuration of an existing portal | `auth0-beta universal-portals audit` |
| Configure a portal visually | Dashboard → **Portals** → **Create Portal**, which creates the application, grants, and a default template from a name and slug |
| Script portal creation, reads, updates, or deletion | Management API `portals` endpoints, preferably through `auth0 api` |
| Build tenant configuration as Terraform | Use Terraform for the surrounding application and APIs, then use the Management API for the portal. Do not invent an `auth0_portal` resource. |

## Gather the minimum design input

Collect these before any command that writes to the tenant:

1. **Tenant** - the tenant domain, which you name back to the developer. A `feature_not_enabled` error means Universal Portals is not enabled for it.
2. **Portal type** - consumer, business, or both.
3. **Portal name and unique slug** - a kebab-case slug such as `my-account`.
4. **Business portals** - the test user (email or user ID) and the organization the user belongs to.
5. **Custom domain** - the portal URL uses the tenant's custom domain when one is ready, and custom code needs one.
6. **Forms** - the IDs of existing Auth0 Forms, if the portal needs form components. A `form_id` is not a label and cannot be fabricated; create the Forms resource first and insert its ID.

Run no write command until the developer has confirmed the tenant, type, name, slug, and (for business) user and organization. `setup` has no rollback.

## Create a portal with the CLI

Run `setup` with `--json` and `AUTH0_AGENT_MODE=1`. Without `--json` an agent sees only the exit code.

```bash
auth0-beta login

# consumer portal
AUTH0_AGENT_MODE=1 auth0-beta universal-portals setup --no-input --json \
  --template consumer --name "Acme Account" --slug acme-account

# business portal; add --organization ORG_ID_OR_NAME when the user belongs to several
AUTH0_AGENT_MODE=1 auth0-beta universal-portals setup --no-input --json \
  --template business --name "Acme Admin" --slug acme-admin --user jane@acme.com
```

`--no-input` requires `--template` and `--name`, and a business portal also requires `--user`. The alias `auth0-beta up` works for `universal-portals`. If the stable `auth0` CLI shadows the beta, alias `auth0-beta` to the beta binary. If the CLI rejects `--template` or has no `audit` command, it predates this tool; use the Portal application settings and Portal API operations below.

`setup` creates, or reuses by name and slug, so rerunning it resumes a failed run:

- the My Account API, and the My Organization API for business;
- the portal application, named `NAME (Universal Portals)`, with the settings in Portal application settings and client grants for those APIs;
- one shared forms-vault machine-to-machine application and its vault connection, plus three forms (profile, communication preferences, privacy);
- the portal, from the template: Profile, Security, and Legal & privacy pages for consumer; Organization, Domains, Security, and Preferences pages for business.

The result goes to stdout as JSON: `portal` (`id`, `slug`, `url`, `status`), `application`, `vault`, `forms`, `resources`, and `organization` for business, each with a `status` of `created`, `reused`, or `updated`. The client secret is never printed. Open `portal.url` with a test user. For a business portal, `organization.hasRole: false` means the user lacks the My Organization permissions, so the organization components will not work for that user; report this.

Errors go to stderr as JSON with an `error` code and, where possible, `fixes`:

| `error` | Meaning and next action |
|---|---|
| `usage` | A flag is missing or invalid; correct the command |
| `missing_scopes` | The CLI login lacks scopes; run the `auth0 login --scopes ...` command from `fixes`, then rerun |
| `feature_not_enabled` | Universal Portals is not enabled for the tenant; direct the developer to Auth0 Support |
| `business_access` | The user is missing, ambiguous, not in the organization, or the organization has no enabled connection; follow `fixes` or pass `--organization` |
| `slug_race` or `setup_failed` | The slug or application name is taken by something this run did not create; choose another name and slug |

Anything created before a failure stays in the tenant.

## Audit a portal

Audit reads the portal, its application, grants, forms, and connections, and reports findings. Run it without `--fix` first:

```bash
AUTH0_AGENT_MODE=1 auth0-beta universal-portals audit PORTAL_ID --json
# business: add --organization ORG_ID to also check that organization's connections
```

Each finding has an `id`, `severity` (`error` or `warning`), `message`, and often a `remedy`. The command exits `1` when any error exists (with `--strict`, also for warnings). Audit also repairs portals that were created earlier with a different setup, such as a portal application that still has the Client Credentials grant or a Management API grant.

`--fix` repairs errors only, and repairs may create a missing portal application or delete Management API grants from it. Show the developer the dry-run findings, get approval, then run:

```bash
AUTH0_AGENT_MODE=1 auth0-beta universal-portals audit PORTAL_ID --fix --json
```

Run audit once more afterwards: the final JSON lists what remains but not what was fixed, and one repair can expose new findings. These findings need manual action: a sidebar link to a missing page, an empty page, a form missing from the tenant, custom code without a ready custom domain, no connection enabled on the portal application, an organization without a shared connection, and session transfer not enabled. Warnings are never auto-fixed.

## Portal application settings

When setup is not used, create one Regular Web Application for each portal and apply these settings before creating the portal. They match what `setup` configures.

| Setting | Value |
|---|---|
| Allowed Callback URLs | `https://YOUR_AUTH0_DOMAIN/portals/auth/callback` (use the custom domain when the tenant has one) |
| Allowed Logout URLs | The URL of the developer's own application, where users land after logging out. Auth0 redirects to the first entry |
| Grant types | Authorization Code, Refresh Token, and MFA |
| Trust token endpoint IP header | On |
| Refresh tokens | Non-rotating, 3600 s idle lifetime, 86400 s maximum lifetime, matching the portal session |
| Organizations | Type of Users `Both` (`organization_usage: allow`), Login Flow `No Prompt` |
| Connections | At least one enabled; users cannot sign in without one |

Keep the application at these settings: leave DPoP, refresh token rotation, the Client Credentials grant, and Management API grants off, give each portal its own application, and keep the idle lifetime at 3600 s or more. Forms that update users call the Management API through a separate machine-to-machine application.

Each API the portal calls needs two things for the same audience and scopes: a client grant (`subject_type: user`) and a refresh token policy. If either is missing, components fail with API errors. Grant only the scopes of the components the portal uses:

| Component | API and audience | Scopes |
|---|---|---|
| `my_account:mfa_management` | My Account, `https://YOUR_AUTH0_DOMAIN/me/` | `read:me:factors`, `read:me:authentication_methods`, `create:me:authentication_methods`, `delete:me:authentication_methods` |
| `my_account:passkey_management` | My Account | `read:me:authentication_methods`, `create:me:authentication_methods`, `delete:me:authentication_methods` |
| `my_organization:details_edit` | My Organization, `https://YOUR_AUTH0_DOMAIN/my-org/` | `read:my_org:details`, `update:my_org:details`, `read:my_org:configuration` |
| `my_organization:domain_table` | My Organization | `read:my_org:domains`, `create:my_org:domains`, `update:my_org:domains`, `delete:my_org:domains`, `read:my_org:identity_providers`, `create:my_org:identity_providers_domains`, `delete:my_org:identity_providers_domains` |

To open the portal from a native application, also add `"session_transfer": { "allowed_authentication_methods": ["query"], "enforce_device_binding": "ip" }` to the application.

Create the application with `auth0 api post clients --data '<payload>'`. This body is for a consumer portal; add the My Organization policy for a business portal:

```json
{
  "name": "My Account (Universal Portals)",
  "app_type": "regular_web",
  "oidc_conformant": true,
  "callbacks": ["https://YOUR_AUTH0_DOMAIN/portals/auth/callback"],
  "allowed_logout_urls": ["https://app.example.com"],
  "grant_types": [
    "authorization_code",
    "refresh_token",
    "http://auth0.com/oauth/grant-type/mfa-oob",
    "http://auth0.com/oauth/grant-type/mfa-otp",
    "http://auth0.com/oauth/grant-type/mfa-recovery-code"
  ],
  "token_endpoint_auth_method": "client_secret_post",
  "is_token_endpoint_ip_header_trusted": true,
  "organization_usage": "allow",
  "refresh_token": {
    "rotation_type": "non-rotating",
    "expiration_type": "expiring",
    "token_lifetime": 86400,
    "idle_token_lifetime": 3600,
    "policies": [
      {
        "audience": "https://YOUR_AUTH0_DOMAIN/me/",
        "scope": [
          "read:me:factors",
          "read:me:authentication_methods",
          "create:me:authentication_methods",
          "delete:me:authentication_methods"
        ]
      }
    ]
  }
}
```

Then create the matching client grant for each audience with `auth0 api post client-grants`, using the new client ID, the audience, `"subject_type": "user"`, and the same scopes.

### Administration scopes

For API-driven portal administration, pre-authorize these Management API scopes on the application that will administer portals:

| Scope | Allows |
|---|---|
| `create:portals` | Create a portal |
| `read:portals` | List and read portals |
| `update:portals` | Update a portal |
| `delete:portals` | Delete a portal |

The administration application is a separate machine-to-machine application, not the portal application. With `client_credentials`, these scopes are granted in **Application → API Access → Auth0 Management API**. They are not requested in the token request. A `403` generally means that the administration application lacks a required pre-authorized scope or the feature is not enabled for the tenant.

## Portal API operations

The portal endpoints are part of Management API v2. Prefer `auth0 api` when it is available because it uses the active Auth0 CLI session; use a direct Management API request in CI or another non-interactive context.

| Operation | Command | Success |
|---|---|---|
| Create | `auth0 api post portals --data '<payload>'` | 201 |
| List | `auth0 api get portals` | 200 |
| Read | `auth0 api get portals/{id}` | 200 |
| Update | `auth0 api patch portals/{id} --data '<payload>'` | 200 |
| Delete | `auth0 api delete portals/{id}` | 204 |

The list endpoint returns `{ "portals": [...] }` with at most 50 `PortalSummary` objects sorted by name and no pagination: `id`, `name`, `slug`, `created_at`, and `updated_at`. Create, read, and update return a full Portal object containing those fields plus `client`, and `navigation`, `pages`, and `custom_code` when set. The client secret is write-only and is never returned. Writes are rate limited; wait for `Retry-After` on a `429`.

### Create a minimal portal

Use `client_secret_post` exactly as shown. The portal API currently supports no other token endpoint authentication method.

```bash
auth0 api post portals --data '{
  "slug": "my-account",
  "name": "My Account",
  "client": {
    "token_endpoint_auth_method": "client_secret_post",
    "client_id": "YOUR_REGULAR_WEB_APP_CLIENT_ID",
    "client_secret": "YOUR_REGULAR_WEB_APP_CLIENT_SECRET"
  }
}'
```

Keep real secrets in the user's secret manager or environment. Do not place a client secret in a source-controlled JSON example, a frontend variable, or chat output.

A create request requires `slug`, `name`, and `client`:

| Field | Constraints |
|---|---|
| `slug` | Unique within the tenant; matches `^[a-z][a-z0-9-]{0,99}$` (starts with a letter, lowercase letters, digits, and hyphens, up to 100 characters) |
| `name` | 1–150 characters |
| `client.token_endpoint_auth_method` | Literal `client_secret_post` |
| `client.client_id` | Regular Web App client ID (5–64 characters) |
| `client.client_secret` | 1–256 characters; write-only |
| `navigation` | Optional sidebar definition |
| `pages` | Optional page definition; a portal with no pages is valid |
| `custom_code.head` | Optional HTML for the page `<head>` (1–10000 characters). Injected only when the portal is served from a custom domain |

A request with a key outside this table is rejected with `400 invalid_body`. A duplicate slug returns `409 Conflict` with error code `portal_conflict`. Read the portal list, choose a different slug, or update the existing portal after confirming it is the intended resource; do not delete an existing portal merely to reuse its slug.

### Read, patch, and delete safely

Read the portal before a change and re-read it after the change:

```bash
auth0 api get portals/PORTAL_ID

auth0 api patch portals/PORTAL_ID --data '{
  "name": "Customer Account"
}'

auth0 api get portals/PORTAL_ID
```

PATCH has true patch semantics:

- omit `navigation`, `pages`, or `custom_code` to leave that field unchanged;
- send `null` for `navigation`, `pages`, or `custom_code` to remove the entire field (`slug`, `name`, and `client` cannot be `null`);
- send a complete replacement value when changing navigation, pages, or custom code, because nested values are replaced, not merged; and
- expect `409 Conflict` when a new `slug` is already taken.

Deletion is destructive. First list or read the portal, name the target ID and slug to the developer, obtain confirmation, then call delete. Expect HTTP 204 with no response body, including for an ID that does not exist, so read the portal list afterwards to confirm the portal is gone.

## Compose navigation and pages

A portal may have a sidebar and a set of pages:

```json
{
  "navigation": {
    "sidebar": {
      "components": []
    }
  },
  "pages": {
    "default": "profile",
    "standard": []
  }
}
```

Set `pages.default` to the slug of a page in `pages.standard`. Without it, the portal root URL shows "Page not found". Neither the default page nor sidebar targets are checked when you write the portal, so read the portal back and confirm every `page_slug` and `default` matches a page slug.

### Sidebar components

| Type | Required config | Optional config |
|---|---|---|
| `sidebar:component:auth0:internal_link:v2` | `label` (1–50), `page_slug` (1–50) | `icon` (1–50) |
| `sidebar:component:auth0:external_link:v2` | `label` (1–50), `href` (URL, 1–200) | `icon` (1–50) |

Icons are Lucide icon names in kebab-case, such as `user`, `shield`, `file-text`, `building-2`, and `lock-keyhole`. Keep page slugs to 50 characters or fewer so the sidebar can link to them.

### Page components

Each page has `title` (1–150 characters), a `slug` (same pattern as the portal slug), and optional `components`.

| Type | Required config | Optional config |
|---|---|---|
| `page:component:auth0:form` | `form_id` (1–50), `completion_message` (1–200) | — |
| `page:component:auth0:typography:heading` | `title` (1–50) | `description` (1–200; basic HTML: links, bold, italic, underline) |
| `page:component:auth0:typography:rich_text` | `content` (1–10000 HTML) | — |
| `page:component:auth0:media:image` | `src` (URL, 1–500) | `position` (`left`, `center`, or `right`), `height` (1–500) |
| `page:component:auth0:structure:section` | `variant` (`card` or `none`), `children` (0–20) | `title` (1–50), `description` (1–200) |
| `page:component:auth0:structure:separator` | — | `variant` (`dashed`, `none`, or `solid`; default `solid`), `text` (1–50; ignored when `variant` is `none`) |
| `page:component:auth0:my_account:passkey_management` | — | — |
| `page:component:auth0:my_account:mfa_management` | — | — |
| `page:component:auth0:my_organization:details_edit` | — | — |
| `page:component:auth0:my_organization:domain_table` | — | — |

A section's `children` can contain any page component except another section. Do not nest sections. A component without config takes no `config` key, or an empty one. Rich text supports headings, bold, italics, underline, links, alignment, and lists; use `<em>` for italic placeholder text.

### Starter consumer portal payload

This creates Profile and Security pages using a pre-existing Form. Replace the placeholder values only through a secure input path.

```json
{
  "slug": "my-account",
  "name": "My Account",
  "client": {
    "token_endpoint_auth_method": "client_secret_post",
    "client_id": "YOUR_REGULAR_WEB_APP_CLIENT_ID",
    "client_secret": "YOUR_REGULAR_WEB_APP_CLIENT_SECRET"
  },
  "navigation": {
    "sidebar": {
      "components": [
        {
          "type": "sidebar:component:auth0:internal_link:v2",
          "config": { "label": "Profile", "page_slug": "profile", "icon": "user" }
        },
        {
          "type": "sidebar:component:auth0:internal_link:v2",
          "config": { "label": "Security", "page_slug": "security", "icon": "shield" }
        }
      ]
    }
  },
  "pages": {
    "default": "profile",
    "standard": [
      {
        "title": "Profile",
        "slug": "profile",
        "components": [
          {
            "type": "page:component:auth0:structure:section",
            "config": {
              "title": "Personal information",
              "description": "Update the information you use across our services.",
              "variant": "card",
              "children": [
                {
                  "type": "page:component:auth0:form",
                  "config": {
                    "form_id": "YOUR_PERSONAL_INFO_FORM_ID",
                    "completion_message": "Your personal information has been updated."
                  }
                }
              ]
            }
          }
        ]
      },
      {
        "title": "Security",
        "slug": "security",
        "components": [
          {
            "type": "page:component:auth0:structure:section",
            "config": {
              "title": "Passkeys",
              "description": "Manage passwordless sign-in methods for this account.",
              "variant": "card",
              "children": [
                { "type": "page:component:auth0:my_account:passkey_management" }
              ]
            }
          },
          {
            "type": "page:component:auth0:structure:section",
            "config": {
              "title": "Multi-factor authentication",
              "description": "Manage the additional verification methods for this account.",
              "variant": "card",
              "children": [
                { "type": "page:component:auth0:my_account:mfa_management" }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

### Starter business portal payload

A business portal manages one organization's details and domains. It needs the My Organization API access described in the portal application settings.

```json
{
  "slug": "my-organization",
  "name": "My Organization",
  "client": {
    "token_endpoint_auth_method": "client_secret_post",
    "client_id": "YOUR_REGULAR_WEB_APP_CLIENT_ID",
    "client_secret": "YOUR_REGULAR_WEB_APP_CLIENT_SECRET"
  },
  "navigation": {
    "sidebar": {
      "components": [
        {
          "type": "sidebar:component:auth0:internal_link:v2",
          "config": { "label": "Organization", "page_slug": "organization", "icon": "building-2" }
        },
        {
          "type": "sidebar:component:auth0:internal_link:v2",
          "config": { "label": "Domains", "page_slug": "domains", "icon": "globe" }
        }
      ]
    }
  },
  "pages": {
    "default": "organization",
    "standard": [
      {
        "title": "Organization",
        "slug": "organization",
        "components": [
          {
            "type": "page:component:auth0:structure:section",
            "config": {
              "title": "Organization details",
              "variant": "card",
              "children": [
                { "type": "page:component:auth0:my_organization:details_edit" }
              ]
            }
          }
        ]
      },
      {
        "title": "Domains",
        "slug": "domains",
        "components": [
          {
            "type": "page:component:auth0:structure:section",
            "config": {
              "title": "Verified domains",
              "variant": "card",
              "children": [
                { "type": "page:component:auth0:my_organization:domain_table" }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

Combine both payloads in one portal when the same people need personal and organization settings.

## Validate the portal

1. Read the portal through `auth0 api get portals/PORTAL_ID` and check the stored name, slug, sidebar targets, default page, and component types.
2. Open the portal URL in a private browser session with a test user.
3. Test each included capability: form submission, passkey management, MFA management, and organization editing or domain viewing as applicable.
4. Confirm logout returns to the configured logout URL and that the callback completes.
5. In the Dashboard, use Preview before Publish when working through the visual editor.

## Troubleshooting

| Symptom | Cause and next action |
|---|---|
| Feature or endpoint is unavailable | Confirm a non-production tenant and Universal Portals enablement. Request beta access through Auth0 Support. |
| `403 Forbidden` from portal API | Pre-authorize the required `*:portals` scope on the administration application. Check that the active CLI session or client credentials use that application. |
| `409 Conflict` on create | The slug already exists in this tenant. List portals, then choose another slug or intentionally patch the existing portal. |
| Portal cannot finish login or logout | Verify the portal application's callback and logout URLs, grant types, API access, and multi-resource refresh token configuration. |
| Form fails to render | Verify that `form_id` refers to an existing Auth0 Forms resource and that the portal application can use the required API access. |
| Passkey, MFA, or organization component fails | Confirm its underlying Auth0 capability and the matching My Account or My Organization scopes. Do not replace the managed component with a browser-side implementation. |
| Secret disappears after reading a portal | Expected behavior: `client_secret` is write-only. Keep the source secret in an approved secret store and supply it only when creating or changing the portal client. |

## Sources

Run `auth0 docs search "universal portals"` for the latest Auth0 docs on this topic.

- https://auth0.com/docs/customize/portals/overview
- https://auth0.com/docs/customize/portals/quickstart
- https://auth0.com/docs/api/management/v2
- https://auth0.github.io/auth0-cli/auth0_api.html
- https://lucide.dev/icons/
