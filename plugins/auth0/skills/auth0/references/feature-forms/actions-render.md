# Auth0 Forms - render a form from an Action

A form appears when a deployed Action, bound to a trigger, calls `api.prompt.render` with the form's ID. Two triggers support it: `post-login` (after the user authenticates) and `password-reset-post-challenge` (after a password reset challenge). Docs: https://auth0.com/docs/customize/forms/render. Do not use `pre-user-registration` for this: the render docs do not list it as supported.

## The Action code

```js
exports.onExecutePostLogin = async (event, api) => {
  if (event.client.client_id !== 'YOUR_TEST_CLIENT_ID') return;   // limit who sees it while testing
  api.prompt.render('FORM_ID', {
    fields: { first_name: event.user.given_name },   // client-side values, max 24 KB
    vars: { external_user_id: event.user.user_id },  // server-side only, masked
  });
};

exports.onContinuePostLogin = async (event, api) => {
  api.user.setUserMetadata('company_name', event.prompt.fields.company_name);
};
```

| Trigger | Render handler | Resume handler |
|---|---|---|
| `post-login` | `onExecutePostLogin` | `onContinuePostLogin` |
| `password-reset-post-challenge` | `onExecutePostChallenge` | `onContinuePostChallenge` |

The post-challenge handler names come from the Actions editor template for that trigger. The public docs do not list them, so confirm them in the editor before you rely on them. `api.prompt.render(formId, { fields, vars })` has the same signature on both triggers, and `event.user` carries the user's email and phone number.

**Always export the resume handler, even when it does nothing** (`exports.onContinuePostLogin = async () => {};`). An Action that renders a form without one makes the pipeline fail when the user comes back from the form. This rule is not in the public docs.

After the user submits, the resume handler reads `event.prompt.id`, `event.prompt.fields` (every field and hidden field) and `event.prompt.vars`.

Limits: one form per Action, and an Action cannot both redirect and render, so use two Actions for that. Put nothing sensitive in `fields`, because the browser receives it. A key in `fields` fills a value only when a component or hidden field with that `id` exists in the form.

## Create, deploy, and bind

Creating an Action does not run it. Do all three steps, in order:

```bash
# 1. create (list triggers and versions first: auth0 api get actions/triggers)
auth0 api post actions/actions --data '{
  "name": "render-company-form",
  "supported_triggers": [{ "id": "post-login", "version": "v3" }],
  "runtime": "node22",
  "code": "<the Action code as one JSON string>"
}'

# 2. deploy (a build status of "built" means it compiled)
auth0 api post actions/actions/ACTION_ID/deploy

# 3. bind to the trigger
auth0 api get actions/triggers/post-login/bindings
auth0 api patch actions/triggers/post-login/bindings --data '{
  "bindings": [ /* the existing bindings, then yours */
    { "ref": { "type": "action_id", "value": "ACTION_ID" }, "display_name": "Render company form" }
  ]
}'
```

Binding changes every login on the tenant, so confirm the tenant and the test application with the developer first. Treat the PATCH as setting the whole list: read the current bindings, keep them, and add yours. The order of the list is the execution order. A list that leaves out an existing Action unbinds it. Binding needs `update:actions`. Docs: https://auth0.com/docs/api/management/v2/actions/patch-bindings.

Use the trigger version that `auth0 api get actions/triggers` reports as `CURRENT` (`post-login` `v3` and `password-reset-post-challenge` `v1` were current when this was written).

To undo, patch the bindings without your Action, then delete the Action. The dashboard path is **Actions → Library → Build Custom**, then **Actions → Triggers**.

## Sources

- https://auth0.com/docs/customize/forms/render
- https://auth0.com/docs/customize/actions/write-your-first-action
- https://auth0.com/docs/actions/reference/post-login/post-login-api-object
- https://auth0.com/docs/actions/reference/password-reset-post-challenge/password-reset-post-challenge-api-object
- https://auth0.com/docs/api/management/v2/actions/patch-bindings
