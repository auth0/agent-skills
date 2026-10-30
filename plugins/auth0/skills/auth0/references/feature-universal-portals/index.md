# Auth0 Universal Portals

Hosted, self-service portals that replace an app-owned "My Account" or "My Organization" UI. The **consumer** template covers profile, passkeys, and MFA. The **business** template covers organization details and domains. A portal can mix components from both.

> **Developer Preview.** Works only in tenants where Auth0 has enabled it. If the feature is not enabled, direct the developer to Auth0 Support.

A portal is backed by a Regular Web Application, the **portal application**. Its server keeps tokens and sets session cookies. Do not add an SDK to render portal components, do not build a browser-side token exchange, and do not expose the portal application's client secret. Concepts: https://auth0.com/docs/customize/portals/architecture

## Choose the workflow

| Goal | Use |
|---|---|
| Create a portal from a template | `auth0-beta universal-portals setup` |
| Check or repair an existing portal | `auth0-beta universal-portals audit` |
| Script reads, updates, or deletion | Management API `portals` endpoints, preferably through `auth0 api` |
| Terraform | Use it for the surrounding application and APIs only. Do not invent an `auth0_portal` resource |

## Before any write

Confirm with the developer: tenant domain, template (or a mix), portal name and kebab-case slug, and for the business template the test user and organization. A `form_id` is never a label: create the Forms resource first and use its ID. `setup` has no rollback, and anything created before a failure stays in the tenant.

## Create with the CLI

```bash
AUTH0_AGENT_MODE=1 auth0-beta universal-portals setup --no-input --json \
  --template consumer --name "Acme Account" --slug acme-account
# business: --template business --user jane@acme.com [--organization ORG_ID_OR_NAME]
```

- Always pass `--json`. Without it an agent sees only the exit code. `--no-input` requires `--template` and `--name`; the business template also requires `--user`.
- Rerunning resumes a failed run: `setup` creates or reuses resources by name and slug.
- Open `portal.url` with a test user. For business, `organization.hasRole: false` means the user lacks My Organization permissions; report it.

| `error` | Action |
|---|---|
| `missing_scopes` | Run the `auth0 login --scopes ...` command in `fixes`, then rerun |
| `feature_not_enabled` | Direct the developer to Auth0 Support |
| `business_access` | The user is missing, ambiguous, or not in the organization, or the organization has no enabled connection. Follow `fixes` or pass `--organization` |
| `slug_race`, `setup_failed` | Something this run did not create holds the name or slug. Pick another |

If the CLI rejects `--template` or has no `audit` command, it predates this tool. Create the portal application by hand from https://auth0.com/docs/customize/portals/configure-portal-application and follow the rules agents get wrong:

- No Client Credentials grant and no Management API scopes. Refresh tokens are non-rotating (3600 s idle, 86400 s maximum).
- Allowed Logout URLs starts with the developer's own application URL. Users land on the first entry.
- Each API needs both a client grant (`subject_type: user`) and a refresh token policy, for the same audience and scopes. Grant only the scopes of the components the portal uses.
- Callback and portal URLs use `YOUR_DOMAIN`, the custom domain when the tenant has one. API audiences (`https://CANONICAL_DOMAIN/me/` and `/my-org/`) always use the tenant's Auth0 domain.

## Audit

Dry run first: `AUTH0_AGENT_MODE=1 auth0-beta universal-portals audit PORTAL_ID --json` (business: add `--organization ORG_ID` to also check that organization's connections). The command exits `1` when any error exists.

`--fix` repairs errors only, and may create a missing portal application or delete Management API grants from it. Show the developer the dry-run findings, get approval, then run `audit PORTAL_ID --fix --json`. Run the dry run again afterward: the final output lists what remains, not what changed, and one repair can expose another.

Warnings are never auto-fixed. These need manual action: a sidebar link to a missing page, an empty page, a form missing from the tenant, custom code without a ready custom domain, no connection enabled on the portal application, an organization without a shared connection, and session transfer not enabled.

## Write the portal API payload

Pages go under `pages.standard`. Sidebar links use the `:v2` types, with `page_slug` (internal) or `href` (external). Set `pages.default`, or the root URL shows "Page not found". Neither is checked on write, so read the portal back and check every `page_slug` and `default` against a page slug. Payload example, component types, and limits: https://auth0.com/docs/customize/portals/customize-portals and https://auth0.com/docs/customize/portals/portal-components

- Create with `client.token_endpoint_auth_method: "client_secret_post"`, the only supported method. Keep real secrets out of source, frontend variables, and chat.
- A key outside the schema returns `400 invalid_body`. A duplicate slug returns `409 portal_conflict`: list portals and choose another slug. Do not delete a portal to reuse its slug. The list returns at most 50 portals with no pagination, so it can miss an existing slug.
- PATCH: omit a field to keep it; send `null` to remove `navigation`, `pages`, or `custom_code` (not `slug`, `name`, or `client`); send complete replacements, because nested values are replaced, not merged. A taken new slug returns `409`. Read before and after.
- Delete returns `204` even for an ID that does not exist. Name the ID and slug, get confirmation, delete, then list to confirm.

## Open the portal

`https://YOUR_DOMAIN/portals/SLUG`. Use a custom domain from the start: custom code requires one, and passkeys enrolled on the Auth0 domain must be enrolled again after a switch. Add `?organization=ORG_ID` for any portal that manages an organization (always for business) and for consumer portals when users belong to several. Entry points, session transfer, and layout parameters: https://auth0.com/docs/customize/portals/access-portals

## Validate

1. `auth0 api get portals/PORTAL_ID`. Done when the name, slug, `pages.default`, every sidebar `page_slug`, and every component type match the request.
2. Publish dashboard changes first: Preview opens only the last published version. Then open the portal URL in a private session with a test user. Done when sign-in completes and a Universal Component renders.
3. Test each included capability (form submission, passkeys, MFA, organization editing or domains) and confirm logout lands on the first Allowed Logout URL.
4. When `audit` is available, run it. Done when it reports no errors.

## Troubleshooting

Check tenant logs first. Full list: https://auth0.com/docs/customize/portals/troubleshoot-portals

| Symptom | Action |
|---|---|
| `403 Forbidden` from the portal API | Pre-authorize the `*:portals` Management API scopes (`create`, `read`, `update`, `delete`) on the administration application, a machine-to-machine app separate from the portal application. Check that the CLI session or client credentials use it |
| "We couldn't load this information" | A client grant or refresh token policy is missing for that API or its scopes. Add both |
| Components fail intermittently | Refresh token rotation is on. Turn it off |
| Form saves but the user is not updated | The Flow has no Forms vault connection, or its machine-to-machine application lacks `update:users` and `update:users_app_metadata` |
