# Auth0 Forms - create and edit a form

Fetch the API reference before writing a payload that goes beyond the example below: https://auth0.com/docs/api/management/v2/forms/create-form. Component types, their `config` keys, and limits are listed there and in https://auth0.com/docs/customize/forms/nodes-and-components. The machine-readable spec is https://auth0.com/docs/oas/management/v2/management-api-oas.json. It is large and in beta, so query it with `jq` for the `/forms` paths and never read it whole.

## Create a form

With CLI 1.35.0 or newer, print a starter body, edit it, then create:

```bash
auth0 forms create --example > form.json   # current starter body
auth0 forms create --schema                # accepted payload schema
auth0 forms create --data @form.json       # returns the new ap_ ID
```

Without that CLI, send the same body with `auth0 api post forms --data @form.json`. This body creates a one-step form on a tenant (verified). The `--example` body is a bare skeleton: add the `RICH_TEXT` block and keep the coordinates below.

```json
{
  "name": "Customer Profile Form",
  "languages": { "primary": "en", "default": "en" },
  "start": { "next_node": "step_profile", "coordinates": { "x": 0, "y": 0 } },
  "nodes": [
    {
      "id": "step_profile",
      "type": "STEP",
      "alias": "Collect profile",
      "coordinates": { "x": 500, "y": 0 },
      "config": {
        "components": [
          { "id": "intro", "category": "BLOCK", "type": "RICH_TEXT", "config": { "content": "<h2>Tell us about you</h2><p>We use this to personalize your experience.</p>" } },
          { "id": "full_name", "category": "FIELD", "type": "TEXT", "label": "Full name", "required": true, "config": { "multiline": false } },
          { "id": "continue_button", "category": "BLOCK", "type": "NEXT_BUTTON", "config": { "text": "Continue" } }
        ],
        "next_node": "$ending"
      }
    }
  ],
  "ending": { "resume_flow": true, "coordinates": { "x": 1250, "y": 0 } }
}
```

## How the graph is wired

- `start.next_node` names the first node. Each node's `config.next_node` names the next one. `$ending` finishes the form.
- A **STEP** shows `components`: `FIELD` (input), `BLOCK` (text, image, buttons) or `WIDGET`. Give each STEP a `NEXT_BUTTON` block.
- A **FLOW** node runs a flow (`config.flow_id`, `config.next_node`) between screens. Create the flow first.
- A **ROUTER** node picks the next node from `config.rules` (each has `id`, `alias`, `condition`, `next_node`) and falls back to `config.fallback`. Always set `fallback`, so a journey that matches no rule still has a next node.
- `ending.resume_flow: true` returns the user to the login or reset that rendered the form.

## Personalize every screen

A form is shown to end users, so start each STEP with a `RICH_TEXT` block that has a title and a short description for that screen. `config.content` is HTML, up to 10,000 characters: use `<h2>` for the title and `<p>` for the description, as the Dashboard templates do (`<h3>` also appears), plus `<strong>` and links written as `<a target="_blank" href="...">`. Variables work inside the content, for example `<h2>Welcome back {{fields.username}}!</h2>`. Write the copy for the task, such as "Verify your work email" and one sentence on why you ask. Do not leave a screen as bare fields and a button. Give every field a `label`, and a `hint` where the format is not obvious.

## Lay out the nodes

The editor does not arrange nodes for you. Every node, `start` and `ending` needs integer `coordinates`, and a missing value becomes `(0, 0)`, so nodes stack on top of each other. Components inside a STEP have no coordinates: their order in `components` is their order on screen.

A STEP is about 480 wide, a FLOW about 280, a ROUTER about 225, so the gap between `x` values must be larger than the node's width:

- Go left to right on one row (`y` 0): `start` at `x` 0, the first node at 500, then add 600 after a STEP, 400 after a FLOW and 500 after a ROUTER. Put `ending` 550 after the last node.
- A ROUTER grows with its rules: about 100 px plus 18 px per rule, so allow that height when you stack nodes above or below it. Put its targets in one column, centered on the router's `y` and at least 600 apart in `y` when they are STEPs (about 250 for FLOW nodes). Order the targets top to bottom in rule order, with the fallback last, so the edges do not cross.
- Do not copy the `x` values from `--example`: its STEP at 300 and ending at 600 overlap.

## Variables

Reference data inside labels, defaults, router conditions and flow params with double braces: `{{fields.email}}` (submitted values), `{{vars.x}}` (values the Action or a flow stored), `{{context.user.email}}` (the user being authenticated), `{{actions.ACTION_ID.field}}` (a flow action's output) and `{{t("key")}}` (a custom message). Reference: https://auth0.com/docs/customize/forms/variables.

## Mistakes that fail on a tenant

| Mistake | Result | Fix |
|---|---|---|
| A FLOW node with a `flow_id` that does not exist | `404 Flow not found` | Create the flow first and use the returned `af_` ID |
| Two components with the same `id`, even in different steps | `400 Some components share the same id` | Make every component `id` unique in the form |
| Passing a value in the Action's `fields` for a field the form does not have | The value does not populate | Pass `fields` keys that match a component `id`, or add a hidden field in `start.hidden_fields` |
| Putting a secret or personal data in the Action's `fields` | Exposed to the browser | Use `vars` for server-side values |

## Update and delete

`auth0 forms update FORM_ID --data @form.json` or `auth0 api patch forms/FORM_ID --data @form.json`. Read the form first with `auth0 forms show FORM_ID --json` and re-read it after. Delete only a form you created: `auth0 forms delete FORM_ID`. Deleting is permanent.

## Sources

- https://auth0.com/docs/customize/forms
- https://auth0.com/docs/customize/forms/nodes-and-components
- https://auth0.com/docs/customize/forms/variables
- https://auth0.com/docs/api/management/v2/forms/get-forms
- https://auth0.github.io/auth0-cli/auth0_forms_create.html
