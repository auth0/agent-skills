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

## Manual portal prerequisites

When setup is not used, configure the Regular Web App before creating a portal:

1. In **Applications → Applications**, create a **Regular Web Application**.
2. Set its callback URL to `https://YOUR_AUTH0_DOMAIN/portals/auth/callback`.
3. Set its logout URL to `https://YOUR_AUTH0_DOMAIN/portals/YOUR_PORTAL_SLUG`.
4. In **Advanced Settings → Grant Types**, enable Authorization Code, Refresh Token, Client Credentials, and MFA.
5. In **API Access**, grant the user-delegated My Account and My Organization API scopes needed by the selected components. Enable multi-resource refresh tokens for those same user-delegated API scopes.
6. Grant the client access to the Management API scopes needed by the portal. A basic portal requires `read:branding` and `read:organizations`; add only the scopes required by the selected experience.

For API-driven portal administration, pre-authorize these Management API scopes on the application that will administer portals:

| Scope | Allows |
|---|---|
| `create:portals` | Create a portal |
| `read:portals` | List and read portals |
| `update:portals` | Update a portal |
| `delete:portals` | Delete a portal |

With `client_credentials`, these scopes are granted in **Application → API Access → Auth0 Management API**. They are not requested in the token request. A `403` generally means that the administration application lacks a required pre-authorized scope or the feature is not enabled.

## Portal API operations

The portal endpoints are part of Management API v2. Prefer `auth0 api` when it is available because it uses the active Auth0 CLI session; use a direct Management API request in CI or another non-interactive context.

| Operation | Command | Success |
|---|---|---|
| Create | `auth0 api post portals --data '<payload>'` | 201 |
| List | `auth0 api get portals` | 200 |
| Read | `auth0 api get portals/{id}` | 200 |
| Update | `auth0 api patch portals/{id} --data '<payload>'` | 200 |
| Delete | `auth0 api delete portals/{id}` | 204 |

The list endpoint returns at most 50 `PortalSummary` objects: `id`, `name`, `slug`, `created_at`, and `updated_at`. Create, read, and update return a full Portal object containing those fields plus `client`, `navigation`, and `pages`. The client secret is write-only and is never returned.

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
| `slug` | Unique URL-safe kebab-case portal slug |
| `name` | 1–150 characters |
| `client.token_endpoint_auth_method` | Literal `client_secret_post` |
| `client.client_id` | Regular Web App client ID |
| `client.client_secret` | 1–256 characters; write-only |
| `navigation` | Optional sidebar definition |
| `pages` | Optional page definition; a portal with no pages is valid |

A duplicate slug returns `409 Conflict`. Read the portal list, choose a different slug, or update the existing portal after confirming it is the intended resource; do not delete an existing portal merely to reuse its slug.

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

- omit `navigation` or `pages` to leave that field unchanged;
- send `"navigation": null` or `"pages": null` to remove the entire field; and
- send a complete replacement value when changing navigation or pages.

Deletion is destructive. First list or read the portal, name the target ID and slug to the developer, obtain confirmation, then call delete. Expect HTTP 204 with no response body.

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
    "content": []
  }
}
```

`pages.default` and `pages.content` are individually optional. When a default is specified, make it the slug of a page in `content`.

### Sidebar components

| Type | Required config | Optional config |
|---|---|---|
| `sidebar:component:auth0:internal_link` | `label` (1–50) | `to` (page slug, 1–50), `icon` |
| `sidebar:component:auth0:external_link` | `label` (1–50), `url` (1–200) | `icon` |

Icons are Lucide icon names in kebab-case, such as `user`, `shield`, `file-text`, `building-2`, and `lock-keyhole`.

### Page components

Each page has `title` (1–150 characters), a slug, and optional `components`.

| Type | Required config | Optional config |
|---|---|---|
| `page:component:auth0:form` | `form_id` (1–50), `completion_message` (1–200) | — |
| `page:component:auth0:typography:heading` | `title` (1–50) | `description` (1–200) |
| `page:component:auth0:typography:rich_text` | `content` (1–10000 HTML) | — |
| `page:component:auth0:structure:section` | `variant` (`card` or `none`), `children` (0–20) | `title` (1–50), `description` (1–200) |
| `page:component:auth0:structure:separator` | — | `variant` (`dashed`, `none`, or `solid`), `text` (1–50) |
| `page:component:auth0:my_account:passkey_management` | — | — |
| `page:component:auth0:my_account:mfa_management` | — | — |
| `page:component:auth0:my_organization:details_edit` | — | — |
| `page:component:auth0:my_organization:domain_table` | — | — |

A section's `children` can contain any page component except another section. Do not nest sections. Rich text supports headings, bold, italics, underline, links, alignment, and lists; use `<em>` for italic placeholder text.

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
          "type": "sidebar:component:auth0:internal_link",
          "config": { "label": "Profile", "to": "profile", "icon": "user" }
        },
        {
          "type": "sidebar:component:auth0:internal_link",
          "config": { "label": "Security", "to": "security", "icon": "shield" }
        }
      ]
    }
  },
  "pages": {
    "default": "profile",
    "content": [
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
          },
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

For a business portal, add a page whose section children include `page:component:auth0:my_organization:details_edit` or `page:component:auth0:my_organization:domain_table`. Only include organization controls when the chosen portal experience and application grants support them.

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

- https://auth0.com/docs/customize/portals/overview
- https://auth0.com/docs/customize/portals/quickstart
- https://auth0.com/docs/api/management/v2
- https://auth0.github.io/auth0-cli/auth0_api.html
- https://lucide.dev/icons/
