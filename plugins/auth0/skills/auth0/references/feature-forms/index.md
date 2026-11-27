# Auth0 Forms

Auth0 Forms are custom screens that collect or show information during a login or password reset, such as extra profile fields, consent, or a one-time code. A form never runs on its own. It has three companions:

- **Flow** - server-side steps (update a user, send an email, verify an address) that a form runs between screens.
- **Vault connection** - stored credentials that some Flow actions use. Not Token Vault, which stores a signed-in user's third-party tokens (use the `feature:token-vault` intent for that).
- **Action** - the Auth0 Action that shows the form with `api.prompt.render`. A deployed, bound Action is what makes a form appear.

**Rules.** Create in dependency order: vault connection, then flow, then form, then Action. Use IDs returned by the API and never invent one. Confirm the tenant before any write. Forms, flows, vault connections and Actions have no rollback, so name each resource you create and delete only those. A custom screen built in your own code is Advanced Customization for Universal Login (`feature:acul`), not Forms.

## Choose the workflow

| Goal | Use |
|---|---|
| Design a form visually | Dashboard → **Forms** editor |
| Script forms | `auth0 forms list\|show\|create\|update\|delete` (CLI 1.35.0 or newer) |
| Script flows and vault connections | `auth0 flows ...` and `auth0 flows vault connections ...` (CLI 1.34.0 or newer) |
| The CLI is older or lacks a command | `auth0 api <method> forms`, `flows`, or `flows/vault/connections` |
| Terraform | Support for these resources is Unknown. Do not invent an `auth0_form` or `auth0_flow` resource. Use the CLI or the Management API |

Run `auth0 --version` first. On an older CLI, upgrade it or use `auth0 api`. The Auth0 MCP server can also manage forms.

## Entities, IDs, and scopes

Grant only the scopes the task needs, for example `auth0 login --scopes "read:forms,create:forms,read:flows,create:flows"`.

| Entity | ID prefix | Scopes | Read |
|---|---|---|---|
| Form | `ap_` | `read:forms` `create:forms` `update:forms` `delete:forms` | `references/feature-forms/forms.md` |
| Flow | `af_` | `read:flows` `create:flows` `update:flows` `delete:flows` | `references/feature-forms/flows.md` |
| Vault connection | `ac_` | `read:flows_vault_connections` `create:flows_vault_connections` `update:flows_vault_connections` `delete:flows_vault_connections` | `references/feature-forms/flows.md` |
| Flow execution | `afe_` | `read:flows_executions` `delete:flows_executions` | `references/feature-forms/flows.md` |
| Action that renders a form | UUID | `read:actions` `create:actions` `update:actions` | `references/feature-forms/actions-render.md` |

Load the file for the task before writing a payload. Each file links the API reference page to fetch for field-level detail.

## Before any write

Confirm with the developer: the tenant domain, the trigger that shows the form (`post-login` or `password-reset-post-challenge`), and the names to create. List existing forms, flows and vault connections first and reuse a match instead of creating a duplicate.

Delete in the reverse order: Action binding, form, flow, vault connection. The API rejects deleting a flow that a form still uses.

## Validate

1. `GET` each created entity (`auth0 forms show`, `auth0 flows show`, `auth0 flows vault connections show`). Done when each returns 200 with the ID you saved.
2. For a flow with branches, run the form once and read the execution with `hydrate=debug` (see the flows file). Done when every variable you branch on has a value in the trace.
3. Log in through the bound trigger with a test user. Done when the form appears, a submission completes the login, and the data you expected is saved on the user.

## Troubleshooting

| Symptom | Action |
|---|---|
| `403` insufficient scope | Add the missing scope from the table above to `auth0 login --scopes` or to the application |
| `404 Flow not found` creating a form | A FLOW node has a `flow_id` that does not exist. Create the flow first and use its returned `af_` ID |
| `400 Some components share the same id` | Make every component `id` unique across the whole form, not just its step |
| `409` deleting a flow | A form still uses it. Delete or edit the form first |
| Form saves but the user is not updated | The flow's `UPDATE_USER` action uses a vault connection that is not ready, or its Auth0 application lacks `update:users` and `update:users_app_metadata` |
| Form never appears at login | The Action is not deployed, or it is not bound to the trigger |
| Login fails after the form is submitted | The Action has no resume handler (`onContinuePostLogin` or `onContinuePostChallenge`). Export it even when it is empty |
| `auth0 api delete` waits forever | It is asking for confirmation. Add `--force` only after the developer confirms the target |
| Branch never matches, or a variable is empty | You referenced the wrong output path. Read the execution trace (flows file) |

## Sources

Run `auth0 docs search "forms"` for the latest Auth0 docs on this topic.

- https://auth0.com/docs/customize/forms
- https://auth0.com/docs/customize/forms/render
- https://auth0.com/docs/customize/forms/flows
- https://auth0.com/docs/api/management/v2/forms/get-forms
- https://auth0.com/docs/api/management/v2/flows/get-flows
- https://auth0.com/docs/api/management/v2/flows/get-flows-vault-connections
- https://auth0.github.io/auth0-cli/auth0_forms.html
