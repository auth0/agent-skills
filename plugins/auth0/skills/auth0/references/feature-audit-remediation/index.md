# Auth0 tenant audit — remediation reference

This reference covers how to apply approved fixes from an Auth0 tenant configuration audit: the command-shape mapping, the per-item guided flow, the express-mode batch flow, and the commands that are never run without explicit user confirmation. It assumes an audit report already exists (with "Immediate Actions" and "After Upgrading" lists) and the user has chosen a remediation mode — Express or Guided — for applying fixes via the Auth0 CLI.

Fixes are applied as two ordered loops: **Loop A — Immediate Actions** (fixes available on the tenant's current plan) and **Loop B — After Upgrading** (fixes gated behind a plan upgrade). Loop A runs first; after it completes, ask whether the customer has upgraded before starting Loop B.

## Command-shape mapping

For each item, build the command. **Use a first-class subcommand when one exists; fall back to `auth0 api <method>` with an explicit JSON payload when there isn't.** Run `auth0 <cmd> --help` first if uncertain about flag names.

| Category | First-class command (if available) | Fallback `auth0 api` path |
|---|---|---|
| Tenant settings | `auth0 tenant-settings update set` / `unset` (flags only) | `PATCH tenants/settings` |
| Brute-force protection | `auth0 protection brute-force-protection update` | `PATCH attack-protection/brute-force-protection` |
| Breached password detection | `auth0 protection breached-password-detection update` | `PATCH attack-protection/breached-password-detection` |
| Suspicious IP throttling | `auth0 protection suspicious-ip-throttling update` | `PATCH attack-protection/suspicious-ip-throttling` |
| Branding (universal login, colors, logo) | `auth0 universal-login update` (alias `auth0 ul update`) | `PATCH branding` |
| Custom domains | `auth0 domains create` / `update <id>` | `POST custom-domains` / `PATCH custom-domains/<domain-id>` |
| Connections (DB, social, enterprise) | (none) | `PATCH connections/<connection-id>` (full options blob) |
| APIs / resource servers | `auth0 apis update <id>` | `PATCH resource-servers/<api-id>` |
| Apps / clients (callbacks, origins, grant types, refresh tokens) | `auth0 apps update <id>` | `PATCH clients/<app-id>` |
| Roles | `auth0 roles update <id>` | `PATCH roles/<role-id>` |
| Actions | `auth0 actions create/update <id>/deploy <id>` | `POST actions/actions` / `PATCH actions/actions/<action-id>` / `POST actions/actions/<action-id>/deploy` |
| Log streams | `auth0 logs streams create <provider>` / `update <provider> <id>` (provider is required: `eventbridge`, `eventgrid`, `http`, `datadog`, `splunk`, or `sumo`) | `POST log-streams` / `PATCH log-streams/<log-stream-id>` |
| Email provider/templates | `auth0 email provider update` / `auth0 email templates update` | `PATCH emails/provider` / `PATCH email-templates/<template-name>` |
| MFA factor toggles | (none) | `PUT guardian/factors/<factor>` |
| MFA policies | (none) | `PUT guardian/policies` |
| Prompts customization | `auth0 universal-login prompts update <prompt>` (alias `auth0 ul prompts update`) | `PUT prompts/<prompt>/custom-text/<lang>` |
| Network ACLs | `auth0 network-acl create` / `update <id>` | `POST network-acls` / `PATCH network-acls/<network-acl-id>` |
| Auth0 Organizations | `auth0 orgs create` / `update <id>` | `POST organizations` / `PATCH organizations/<org-id>` |

The fallback column lists paths relative to the API root, as `auth0 api` expects.
Pick the method from the table's path column: `patch` for most resources, `put` for MFA
factor toggles, MFA policies, and Prompts customization, and `post` when creating a
resource. `patch` is not universal. Note that `auth0 api` defaults to `GET` without
`--data` and `POST` with `--data`, so always state the method explicitly.

## Fix dependencies / prerequisites

Some fixes only work once a prerequisite is in place — applying them out of order fails or, worse, silently half-applies. Before running an item, detect whether its prerequisite is met; if not, order the prerequisite first (or, when it's outside this run's scope, queue the item and tell the user what to do first). Never apply a fix whose prerequisite isn't met.

| Fix | Prerequisite that must come first |
|---|---|
| Email MFA factor / branded email templates | A configured email provider (SMTP or a supported provider) — without it, email delivery fails |
| Enforcing an MFA policy | At least one MFA factor enabled **and** able to deliver (SMS provider configured / email domain verified / WebAuthn available) — enforcing before a factor can deliver locks users out |
| Custom domain (verify/activate) | The CNAME/TXT DNS record created at the DNS provider — verification fails until DNS propagates |
| Enterprise connection SSO | The connection created and enabled on the target app(s) before it can be used for login |

When a prerequisite depends on something the user must do outside the CLI (e.g. adding a DNS record), surface it explicitly and queue the dependent fix rather than attempting it.

## Per-item flow (Guided mode)

For each item, when in **Guided** mode:
1. **Build the CLI command(s).** Multiple commands are fine — e.g. updating callbacks + origins + grant types on an app may need 1-3 calls.
2. **Show the diff.** Print the current value (fetch with `auth0 api get ...`) and the proposed change side-by-side. Never show only the proposed payload.
3. **Print the exact command(s)** about to run, including JSON payloads.
4. **Ask via `AskUserQuestion`**: Implement now / Queue / Skip. Only proceed on Implement now.
5. **Execute via Bash**, capture stdout/stderr.
6. **Verify** by re-fetching the same resource and confirming the field changed. Never claim success on exit code alone.
7. If a command fails, **don't retry destructively** — surface the error and ask the user how to proceed.

## Batch flow (Express mode, Immediate Actions only)

For Loop A in **Express** mode:
1. **Build all CLI commands up front** for every Immediate Action.
2. **Render one consolidated preview** to chat — a numbered list, each entry showing: action title · target app/resource · the exact command(s) it'll run. Mark anything mutating connections, deleting data, or rotating secrets as `[risky]` and exclude from the batch (handle individually after).
3. **Ask via `AskUserQuestion`** with three options:
   - **Apply all** — execute every non-risky item in order, one progress line per item (`✓ #1 callbacks updated`, `⚠ #3 failed: ...`).
   - **Select a subset** — fall back to the per-item Guided flow above for the user to pick.
   - **Skip remediation** — write all items to `state/queue.json` with `status: "skipped"`, exit remediation.
4. After Apply all, re-fetch each touched resource to verify (same as the Guided flow's verify step). Surface failures inline; don't abort the batch on a single error.
5. Any `[risky]` items pulled out of the batch get the Guided per-item flow afterwards.

For Loop B (After Upgrading) in **Express** mode: still use the Guided per-item flow. Plan-gated changes are higher-stakes and individually consequential — never batch.

### Loop A — Immediate Actions

Iterate the "Immediate Actions — Available Today (Free)" items from the audit report.

- **Express** → use the batch flow above.
- **Guided** → use the per-item flow above.

### Plan upgrade gate

After Loop A, ask via `AskUserQuestion`:
> "Has `<Customer>` upgraded to `<recommended_plan>`?"

Options:
- **Yes — proceed** → Loop B
- **Not yet — queue for after upgrade** → write all After Upgrading items to `state/queue.json` with `status: "pending_upgrade"`, print the upgrade link `https://manage.auth0.com/dashboard/<region>/<tenant>/billing`, end
- **Skip remaining** → write items with `status: "skipped"` (with optional rationale), end

**When the recommended plan is "Enterprise — contact sales," don't ask this question** — there is no self-service upgrade to confirm. Write the plan-gated items with `status: "pending_enterprise"`, point the user at Auth0 sales instead of the billing link, and end. On a later run, treat `pending_enterprise` exactly like `pending_upgrade`: re-check whether the plan now covers each item, run the ones it does through Loop B, and leave the rest queued. Never present a `pending_enterprise` item as something the user can unlock themselves.

### Loop B — After Upgrading

Always uses the Guided per-item flow regardless of mode (plan-gated changes are too consequential to batch). If any command fails with a plan-feature error, surface it and ask whether to queue.

## Never-without-confirmation list (applies to all modes)

Even in Express mode, these commands are blocked unless the user explicitly types the action verbatim:
- `auth0 logout`
- `auth0 tenants delete`
- `auth0 apps delete` (any app, especially the CheckMate app)
- `auth0 api delete "connections/<id>"` (no first-class delete command exists for connections)
- `auth0 api delete <anything>`

## Closing the run

After Loop B (or gate exit) completes:
- Update state: `last_run_at`, append applied + queued + skipped findings to `state/history.jsonl`
- Print: tenant, report path, applied count, queued count, skipped count
- If anything was applied, suggest re-running the audit to confirm the fixes show clean
