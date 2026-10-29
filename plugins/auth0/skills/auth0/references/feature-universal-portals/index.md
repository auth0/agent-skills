# Auth0 Universal Portals

Auth0 Universal Portals is a hosted identity experience platform. It provides managed consumer and business self-service portals instead of an application-owned “My Account” or “My Organization” UI.

> **Beta — non-production only.** Universal Portals is available only in enabled non-production tenants. Do not configure, test, or suggest it for a production tenant. If the feature is not enabled, direct the developer to Auth0 Support.

A portal is backed by a Regular Web Application. The portal server uses that application's credentials for SSO, keeps tokens server-side, and sets browser session cookies. It requests section-specific access tokens and refreshes them through a multi-resource refresh token. Do not build a browser-side token exchange or expose the portal application's client secret.

## Choose the right workflow

| Developer goal | Use |
|---|---|
| Get a test portal, resource servers, grants, and a Regular Web App quickly | `auth0-beta universal-portals setup` |
| Configure a portal visually | Dashboard → **Portals** → create or open a portal → visual editor |
| Script portal creation, reads, updates, or deletion | Management API `portals` endpoints, preferably through `auth0 api` |
| Build tenant configuration as Terraform | Use Terraform for the surrounding application and APIs, then use the Management API for the portal. Do not invent an `auth0_portal` resource. |

Universal Portals is a hosted surface, not an SDK integration. Do not add a React, Next.js, or mobile SDK to render portal components. An application may link users to the hosted portal, but the portal's pages and navigation are configured in Auth0.

## Gather the minimum design input

Before changing the tenant, establish:

1. **Tenant and rollout boundary** — confirm that it is a non-production tenant with Universal Portals enabled.
2. **Portal name and unique slug** — use a URL-safe kebab-case slug such as `my-account`; the slug is unique within a tenant.
3. **Components** — choose which components to include: Profile/forms, passkeys, and MFA for a consumer self-service experience; organization details and organization domains for a business self-service experience. Confirm which Auth0 Forms IDs already exist before adding form components.
4. **Portal application** — use the Regular Web App created by setup, or identify an existing Regular Web App and obtain its client ID and secret through a secure path.

If the developer asks to create Forms, use the available tenant tooling to create the Forms resource first, then insert the resulting ID in the portal payload. A `form_id` is not a label and cannot be fabricated.

## Fast setup: Auth0 Beta CLI

The setup command provisions the baseline in one step:

```bash
auth0-beta login
auth0-beta universal-portals setup
# alias: auth0-beta up setup
```

It creates:

- My Account API for user account operations;
- My Organization API for organization operations;
- a Regular Web App linked to the portal;
- client grants for My Account, My Organization, and Management API operations; and
- a default portal and its URL.

Open the URL that the command prints and test it with a test user. Treat the generated application credentials as secrets; do not commit them or include them in browser code.

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
