Run a security audit against the configured Auth0 tenant. Produces Markdown receipts and structured JSON findings.

**Usage:**
```
/auth0-audit [--tool actions|tokens|passkeys|all] [--tenant DOMAIN] [--cache]
```

**Arguments:**
- `--tool`: Which audit to run. Default: `all`
- `--tenant`: Override the `AUTH0_DOMAIN` env var for this run
- `--cache`: Use `scripts/demo-cache.json` instead of live API calls (offline demo mode)

## Step 0 — Verify MCP connection

Before doing anything else, attempt a lightweight MCP call (e.g. `auth0_list_applications` with `per_page=1`) to confirm the auth0-mcp-server is reachable.

- If the call **succeeds**: proceed to Step 1.
- If the call **fails** with an MCP connection error or authentication error: stop immediately and tell the user:

  > The auth0-mcp-server is not connected or not authenticated.
  > Please run the following command in your terminal, then re-run `/auth0-audit`:
  >
  > ```
  > npx @auth0/auth0-mcp-server init
  > ```

Do not proceed to any audit steps until the MCP connection is confirmed.

## Step 1 — Parse arguments

Extract `--tool`, `--tenant`, `--cache` from the `/auth0-audit` invocation args.
Default `--tool` to `all` if not specified.
If `--tenant` is provided, set `AUTH0_DOMAIN` to that value for this run.

## Step 2 — Run selected tools

Run tools in order: `actions` → `tokens` → `passkeys` (skip any not selected).

---

## Tool: ActionsWhisperer (`--tool actions`)

**Purpose:** Analyze all Auth0 Actions for security risks.

**Steps:**

1. Use MCP tool `auth0_list_actions` to get all actions. If `--cache` is set, read from `scripts/demo-cache.json` key `actions_list` instead.

2. For each action returned, use MCP tool `auth0_get_action` with the action's `id` to fetch its full details including `code`, `secrets` (names only), and `dependencies`.

3. For each action, analyze the code using the **ActionsWhisperer Analysis Prompt** below.

4. Collect all findings into an array. Then run:
   ```bash
   node tools/render-findings.js actions '<JSON_ARRAY>'
   ```
   where `<JSON_ARRAY>` is the JSON-stringified array of per-action findings objects.

5. Print the console summary line.

**ActionsWhisperer Analysis Prompt** (apply this to each action's code):

```
You are a CIAM security analyst reviewing Auth0 Actions code. Analyze the following Auth0 Action and return ONLY a valid JSON object matching the schema below. Do not include markdown, explanation, or any text outside the JSON.

Action context:
- Name: {action_name}
- Trigger: {trigger_type}  (e.g. post-login, credentials-exchange, pre-user-registration, post-user-registration)
- Named secrets available (values not accessible via API): {secret_names}
- NPM dependencies declared: {dependencies}

Code:
{code}

Identify and flag the following risk patterns:

(a) EXTERNAL_HTTP_CALL — any fetch(), axios(), http.request(), or XMLHttpRequest to a non-hardcoded URL or to any URL not in the declared allowlist. If the URL is a string literal, include it. If it uses a variable or env secret, note it.

(b) PII_METADATA_WRITE — any call to api.user.setUserMetadata() or api.idTokenClaims.setCustomClaim() where the value comes from event.request.* (ip, userAgent, geoip, hostname, query, body) — this persists request-context data as PII in the user record.

(c) HARDCODED_SECRET — any string literal matching patterns for API keys, tokens, or passwords:
  - Length 20–80 characters with high entropy (mixed alphanumeric + special chars)
  - Matches patterns like: /[A-Za-z0-9_\-]{32,}/ in a string assignment to a variable named *key*, *token*, *secret*, *password*, *apikey*, *api_key*
  - Do NOT flag named secret references like event.secrets.MY_SECRET — those are safe

(d) EXTERNAL_CLAIM_INJECTION — any call to api.accessToken.setCustomClaim() or api.idTokenClaims.setCustomClaim() where the value originates from an external HTTP response, event.request.*, or event.authorization.* — this could inject attacker-controlled values into tokens

(e) ACCESS_DENY_CONDITION — any call to api.access.deny() — document the condition, but do not automatically flag as risky; rate this "low" unless the condition itself looks exploitable

(f) UNALLOWLISTED_SERVICE — any call to an external service (HTTP or SDK) that is not in the declared allowlist (assume the declared allowlist is empty unless the action's code or comments explicitly define one)

IMPORTANT: event.secrets.ANYTHING is safe — do not flag secret references. Only flag hardcoded literal values.
IMPORTANT: Do not echo any email addresses, user IDs, or PII you find in code comments.

Return this JSON schema (no other text):
{
  "action_id": "<id>",
  "action_name": "<name>",
  "trigger": "<trigger_type>",
  "risk_level": "critical|high|medium|low|none",
  "findings": [
    {
      "pattern": "EXTERNAL_HTTP_CALL|PII_METADATA_WRITE|HARDCODED_SECRET|EXTERNAL_CLAIM_INJECTION|ACCESS_DENY_CONDITION|UNALLOWLISTED_SERVICE",
      "location": "<function name or line description>",
      "description": "<what was found, no PII>",
      "remediation": "<specific fix recommendation>"
    }
  ],
  "plain_english_summary": "<2-3 sentence plain English description of what this Action does and its risk profile>"
}

Risk level rules:
- critical: HARDCODED_SECRET found
- high: PII_METADATA_WRITE or EXTERNAL_CLAIM_INJECTION with externally sourced values
- medium: EXTERNAL_HTTP_CALL or UNALLOWLISTED_SERVICE
- low: ACCESS_DENY_CONDITION or minor issues
- none: no findings
```

**Output files written by** `node tools/render-findings.js actions`:
- `actions-audit.md` — full receipts grouped by trigger type
- `actions-findings.json` — structured findings array

**Console summary format:**
```
Analyzed N actions. Found X critical, Y high, Z medium findings.
Top risk: [action_name] ([trigger]) — [one-line description of worst finding].
```

---

## Tool: TokenGraveyard (`--tool tokens`)

**Purpose:** Identify dormant and overprivileged M2M (non_interactive) applications and provide approval-gated remediation.

**Steps:**

1. Use MCP tool `auth0_list_applications` with filter `app_type=non_interactive` (or equivalent parameter). If `--cache`, read from `scripts/demo-cache.json` key `m2m_apps`.

2. Run the TokenGraveyard analysis script to compute last-used dates and blast-radius scores:
   ```bash
   node tools/token-graveyard.js
   ```
   This script queries Auth0 logs directly for each app's last `sce` event, computes scores, writes `tokens-audit.md` and `tokens-findings.json`, and prints a ranked remediation list to stdout.

3. Show the ranked remediation list to the user. For each app in the **"Revoke now"** tier, ask:
   ```
   Revoke client grant for "[app_name]" (client_id: [id])? [y/N]
   ```
   Wait for explicit `y` before proceeding. `N` or any other input skips that app.

4. For each approved revocation, use MCP tool `auth0_delete_client_grant` with the grant ID.

5. After all approvals processed, run:
   ```bash
   node tools/render-findings.js tokens-receipt '<RECEIPTS_JSON>'
   ```
   to write `tokens-remediation-receipt.md`.

**Blast-radius scoring** (implemented in `tools/token-graveyard.js`):
- `update:users`, `delete:users` → 4 pts each
- `create:clients`, `update:clients`, `delete:clients` → 5 pts each
- `read:user_idp_tokens` → 3 pts
- `update:tenant_settings` → 5 pts
- `read:users` → 1 pt
- All other Management API scopes → 1 pt
- Non-Management-API scopes → 0.5 pts

**Tier assignments:**
- **Revoke now:** never used OR (last used >90 days AND blast radius > 5)
- **Rotate within 7 days:** last used 60–90 days OR blast radius > 8
- **Scope-narrow within 30 days:** scope overprivilege relative to app name/purpose
- **Monitor:** last used <30 days, normal blast radius

**Console summary format:**
```
Found N M2M applications. X never used, Y dormant >60 days, Z with high blast radius (score >8).
Recommended: revoke X, rotate Y, scope-narrow Z.
```

---

## Tool: PasskeysReadiness (`--tool passkeys`)

**Purpose:** Assess whether the tenant meets all 4 prerequisites for enabling Passkeys (WebAuthn).

**Steps:**

1. Run the PasskeysReadiness script:
   ```bash
   node tools/passkeys-readiness.js
   ```
   If `--cache`, pass `--cache` flag: `node tools/passkeys-readiness.js --cache`

2. The script writes `passkeys-readiness.md` and prints the console summary.

3. Read `passkeys-readiness.md` and present its contents to the user.

**Console summary format:**
```
Passkeys readiness: N/4 prerequisites met. [not_ready|partially_ready|ready].
Primary blocker: [blocking issue in one sentence, or "None — tenant is ready for Passkeys"].
```

---

## Orchestration (`--tool all`)

Run all three tools in sequence: ActionsWhisperer → TokenGraveyard → PasskeysReadiness.

After all tools complete, write `auth0-audit-summary.md`:

```markdown
# Auth0 Security Audit Summary
Generated: [ISO timestamp]
Tenant: [AUTH0_DOMAIN]

## Actions (ActionsWhisperer)
[Total actions analyzed, finding counts by severity, top risk]

## M2M Tokens (TokenGraveyard)
[Total apps, dormancy breakdown, revocations executed]

## Passkeys Readiness
[Score N/4, status, primary blocker]
```

Print a 5-line console summary on completion.
