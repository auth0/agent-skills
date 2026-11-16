# Auth0 Forms - flows, vault connections, and executions

A flow is an ordered list of actions that a form runs between screens (a FLOW node), after submit (`ending.after_submit`) or before the first screen. Fetch the API reference before writing a payload: https://auth0.com/docs/api/management/v2/flows/post-flows. Each action's `params` are documented per integration under https://auth0.com/docs/customize/forms/flows. Do not guess `params`.

## Create a flow

```bash
auth0 flows create --actions-template                       # prints the expected file shape
auth0 flows create --name "My flow" --actions-file flow.json
```

`flow.json` must be an object with an `actions` array, `{"actions": [ ... ]}`. A bare array fails with `cannot unmarshal array into Go value`. Without the CLI: `auth0 api post flows --data @body.json` with `name` and `actions`.

Each action has `id` (your name for it), `type` (the integration, such as `AUTH0`, `EMAIL`, `OTP`, `FLOW`), `action`, `params`, and optional `allow_failure` and `mask_output`. Later actions and the form read an action's output as `{{actions.ID.field}}`.

## Which actions need a vault connection

| Action | Connection |
|---|---|
| `AUTH0` `CREATE_USER`, `GET_USER`, `UPDATE_USER`, `SEND_REQUEST` | Required: an Auth0 vault connection (`app_id` `AUTH0`) backed by a machine-to-machine application |
| `AUTH0` `SEND_EMAIL`, `SEND_SMS` | None. They use the tenant's email or phone provider, so enable that provider first |
| Third-party integrations such as `SENDGRID`, `TWILIO`, `SLACK` | Required: a vault connection for that app |
| `OTP`, `FLOW`, `JSON`, `EMAIL` (`VERIFY_EMAIL`) | None |

Do not create a SendGrid or Twilio connection for a task that `AUTH0` `SEND_EMAIL` or `SEND_SMS` covers. `SEND_EMAIL` returns `{"success": true}` when the email is queued, not when it is delivered.

The machine-to-machine application behind an `AUTH0` connection needs `update:users` and `update:users_app_metadata` for `UPDATE_USER`. Without them the form saves and the user is not updated. For the other `AUTH0` actions, read the scopes on https://auth0.com/docs/customize/forms/flows/integrations/auth0.

## Update a user with one patch

`UPDATE_USER` is a PATCH: it changes only the properties you send. Do not add a `BOOLEAN_CONDITION` per field to decide what to save. Send one `UPDATE_USER` that lists every field and falls back to the stored value with the nullish operator `??` (documented at https://auth0.com/docs/customize/forms/variables):

```json
{ "id": "save_profile", "alias": "Save profile answers", "type": "AUTH0", "action": "UPDATE_USER",
  "params": { "connection_id": "VAULT_CONNECTION_ID", "user_id": "{{context.user.user_id}}",
    "changes": { "user_metadata": {
      "company": "{{fields.company ?? context.user.user_metadata.company}}",
      "job_title": "{{fields.job_title ?? context.user.user_metadata.job_title}}" } } } }
```

Checked on a tenant with a real vault connection:

- Two `UPDATE_USER` actions that each send one `user_metadata` property merge: both properties end up stored. The single patch above is shorter, not more correct.
- A field the user was not asked falls back to the stored value, so the stored value is kept.
- A value that resolves to nothing is sent as `null`, and `null` deletes that property from the user. Never send an expression with no fallback, for example `{{fields.company}}` for a question that was skipped. The `??` fallback to `context.user` protects you only while the stored value is in `context.user`.
- A blank answer (`""`) is not nullish, so it overwrites the stored value. Mark every field the form asks as `required`, and skip the question when the value is already stored.

Check the `UPDATE_USER` input in the execution trace to see the exact body that was sent.

## Vault connections

```bash
auth0 flows vault connections create --app-id AUTH0 --setup-template   # prints the setup shape
auth0 flows vault connections create --name "My connection" --app-id AUTH0 --setup-file setup.json
```

Without the CLI: `auth0 api post flows/vault/connections --data '{"name":"...","app_id":"AUTH0","setup":{...}}'`. Reference: https://auth0.com/docs/api/management/v2/flows/get-flows-vault-connections.

- A connection created without `setup` is saved with `ready: false`. Flows that use it cannot call the service until you add `setup` with an update.
- `app_id` cannot change after creation. A PATCH that includes it returns `400 Additional properties not allowed: app_id`. Create a new connection instead.
- `setup` holds secrets (client secrets, API keys). Read them from the environment or ask the developer. Do not print them, log them, or write them into a file in the repo, and do not pass them as literals in a shell command that is saved to history.

## Executions

```bash
auth0 flows executions list FLOW_ID
auth0 api get "flows/FLOW_ID/executions/EXECUTION_ID" --query hydrate=debug
```

`auth0 flows executions show` has no `hydrate` option, so use `auth0 api` for the debug trace. `debug.tracing[]` lists each action's `input` and `output`, and `debug.scope.vars` lists the stored variables. A failed `VERIFY_EMAIL` check does not stop the flow: the execution finishes `COMPLETED` with `valid` false in the trace.

Always read the trace before you reference an output in a condition. Output shapes differ by action: `VERIFY_EMAIL` nests its result under `body`, while `MAP_VALUE` returns `result` at the top level.

### Example: a different message per failure cause

The public docs show the `EMAIL` `VERIFY_EMAIL` output as `valid` and `cause`. On a tenant it is nested under `body`:

- `{{actions.ID.body.valid}}` is `true` or `false`, and `{{actions.ID.body.domain}}` is the domain.
- `{{actions.ID.body.cause}}` is one of `MISSING_MX_RECORD`, `EMAIL_ALIAS`, `FREE_EMAIL`, `DISPOSABLE_EMAIL`, `BLOCKLISTED`, `NOT_ALLOWED`. The cause is the first rule the email fails. `EMAIL_ALIAS` is missing from the docs, and a passing check has no `cause` key.
- `{{actions.ID.valid}}` and `{{actions.ID.cause}}` did not resolve.

Map the cause to a message with one `FLOW` `MAP_VALUE` action (called Input value mapping in the docs) and show it with one `ERROR_MESSAGE`. Do not write one `BOOLEAN_CONDITION` per cause: nested conditions are hard to read and to extend. Write the condition so the true branch is the success path (`valid` equals `true`), put the success steps in `then` and the error in `else`. `ERROR_MESSAGE` ends the flow. Give an action an `alias` (up to 100 characters) when its type does not say what it does here, such as `Is valid email?` or `Map error codes`.

```json
{ "id": "verify_email", "type": "EMAIL", "action": "VERIFY_EMAIL",
  "params": { "email": "{{fields.email}}",
    "rules": { "require_mx_record": true, "block_disposable_emails": true, "block_free_emails": false, "block_aliases": false } } },
{ "id": "cause_message", "alias": "Map error codes", "type": "FLOW", "action": "MAP_VALUE",
  "params": { "input": "{{actions.verify_email.body.cause}}",
    "cases": { "MISSING_MX_RECORD": "That email domain cannot receive mail. Check the spelling.",
               "DISPOSABLE_EMAIL": "Disposable email addresses are not accepted. Use your work email." },
    "fallback": "We could not verify that email address." } },
{ "id": "is_valid_email", "alias": "Is valid email?", "type": "FLOW", "action": "BOOLEAN_CONDITION",
  "params": { "if": { "operator": "AND", "operands": [ { "operator": "EQ", "operands": ["{{actions.verify_email.body.valid}}", true] } ] },
    "then": [ { "id": "share_email", "alias": "Share email with the form", "type": "FLOW", "action": "STORE_VARS",
                "params": { "vars": { "work_email": "{{fields.email}}", "email_domain": "{{actions.verify_email.body.domain}}" } } } ],
    "else": [ { "id": "show_error", "alias": "Show error", "type": "FLOW", "action": "ERROR_MESSAGE",
                "params": { "message": "{{actions.cause_message.result}}" } } ] } }
```

## Share values with `STORE_VARS`

`{{actions.ID.field}}` works only inside the flow that ran the action. A later flow, a router, or a form screen cannot read it. To reuse a value there, store it with a `FLOW` `STORE_VARS` action (called Store shared variable in the docs) and read it as `{{vars.NAME}}`:

```json
{ "id": "share_email", "alias": "Share email with the form", "type": "FLOW", "action": "STORE_VARS",
  "params": { "vars": { "work_email": "{{fields.email}}" } } }
```

- Use it to compute a value once and reuse it in later flows of the same form, in router conditions, and in form text and labels such as `We sent a code to {{vars.work_email}}`.
- The action name is `STORE_VARS`, with a `vars` object of key and value pairs. Do not guess another action name.
- Shared variables live for one form journey and are not readable outside it. The browser receives one only if a form component references it, so do not reference a sensitive value in a component. Use the `mask` helper from https://auth0.com/docs/customize/forms/variables to keep a value out of executions.
- After a run, the stored values appear in `debug.scope.vars` of the execution trace. Check them there.

## Update and delete

`auth0 flows update FLOW_ID --actions-file flow.json` replaces the whole actions list (a two-action flow updated with a one-action file has one action), so read the flow first and send the complete list. `auth0 flows update FLOW_ID --name "New name"` without `--actions-file` waits for interactive input and hangs in a script, so pass `--actions-file` too. Delete in this order: forms that use the flow, then the flow, then its vault connections. `auth0 flows delete FLOW_ID` while a form uses it returns `409 You cannot delete a flow associated to a form`. `GET flows/FLOW_ID?hydrate=form_count` shows how many forms use it.

## Sources

- https://auth0.com/docs/customize/forms/flows
- https://auth0.com/docs/customize/forms/flows/integrations/auth0
- https://auth0.com/docs/customize/forms/flows/integrations/data-verification
- https://auth0.com/docs/api/management/v2/flows/get-flows
- https://auth0.github.io/auth0-cli/auth0_flows.html
