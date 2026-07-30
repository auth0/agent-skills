# Auth0 tenant audit (CheckMate) — full workflow

Use this reference when the user wants to run an Auth0 tenant configuration / security audit and produce a tenant configuration report (Auth0 Platform Development Review format — markdown + styled PDF) tailored to their product context, or wants to apply the audit's recommendations. It bootstraps the Auth0 CLI and a dedicated audit M2M application if needed, gathers lightweight public company context so findings read in the customer's own terms, and implements approved fixes via the Auth0 CLI with per-command confirmation.

You produce a personalized tenant audit as a **markdown brief plus styled PDF**, walk the user through the recommendations as two ordered loops (free-now vs after-upgrading), and apply approved fixes via the Auth0 CLI with per-command confirmation.

The audit is run with CheckMate (`@auth0/auth0-checkmate`), a Node CLI that calls the Auth0 Management API and emits a JSON (and optionally PDF) report. The Auth0 CLI (`auth0`) is what you use both to bootstrap CheckMate's M2M app and to apply the recommendations.

For the feature→plan matrix (Free/Essentials/Professional/Enterprise, B2C + B2B) that is the source of truth for triaging findings into Immediate vs After-Upgrading, use the co-loaded pricing reference. For the step-by-step remediation flows (command-shape mapping, guided/batch flows, the never-without-confirmation list), use the co-loaded remediation reference — it is what the two apply loops (Phase 6) hand off to. The markdown report skeleton this audit's brief MUST follow lives at `assets/audit/report-template.md`; the matching HTML skeleton (CSS-styled, used to render the PDF) lives at `assets/audit/report-template.html`. The PDF is rendered from the HTML by the script at the skill's `scripts/render_pdf.sh` (invoke it as `${CLAUDE_SKILL_DIR}/scripts/render_pdf.sh`). Company context is gathered inline in Phase 3 — no external skill required. Tenant-configuration CLI usage beyond what's inlined below (full command reference, flags, output formatting) is covered by the tooling reference loaded alongside this one.

## Chat output rules (terse mode)

This workflow runs many phases. Keep chat tight to make the run feel fast:
- **One status line per phase max** — e.g. `Phase 1 ✓ CLI ready · tenant: acme.us.auth0.com`. No paragraph narration of what you're about to do.
- Use `✓` for success, `⚠` for warnings (will fix automatically), `✗` for errors that need user input.
- Show full detail only when (a) something fails, (b) the user must answer a question, or (c) Phase 5 chat summary at end.
- Don't restate what's in the report files — point to the file path and stop.
- Final-run summary may be 3-5 lines (top findings, applied count, queued count, file paths).

## Tool-aware execution (agent portability)

This workflow targets Claude Code first but works on any agent that can run shell commands and read files. It references several tools by their Claude Code names; map each to your agent's equivalent:

| Reference in this workflow | Claude Code | Other agents (Codex, Cursor, Aider, Continue, Cline, etc.) |
|---|---|---|
| `AskUserQuestion` (mode selector, per-finding triage, confirmations) | Native multi-choice button UI | Ask the user as plain text with explicit options — e.g. "Reply: `express` / `guided` / `audit`" or "Apply this fix? `y`es / `q`ueue / `s`kip". Same content, plain prompt. |
| `TodoWrite` (progress tracking) | Native todo list tool | Use your agent's progress mechanism, or skip — progress tracking is optional. |
| `${CLAUDE_SKILL_DIR}` env var (path to skill folder) | Auto-set by Claude Code | Substitute the absolute path to wherever the customer extracted the skill. |

State files for this workflow live at `~/.auth0-checkmate/state/` regardless of agent (vendor-neutral).

## Phase 0 — Pre-flight + mode

State cache lives at `~/.auth0-checkmate/state/setup.json` (create dir on first write):
```json
{
  "schema_version": 1,
  "tenant_domain": "tenant.region.auth0.com",
  "checkmate_client_id": "...",
  "company_domain": "example.com",
  "mode": "guided",
  "last_run_at": "2026-06-01T12:34:56Z"
}
```
`mode` is `"express"`, `"guided"`, or `"audit"` (set in Phase 0.3, gates Phases 6-7).
**Treat the state file as a cache, not source of truth.** Re-validate each field (Phase 1.1, Phase 2.1) before trusting it. Secrets (the M2M client_secret) live in `~/.auth0-checkmate.env` (mode 600) — never write secrets to the state file.

### 0.1 Pre-flight diagnostic (silent → one-line status table)

Run all checks **without prompting**, then render a single compact status block. Keep it under 8 lines.

Checks to run in parallel (no chat output during checks):
| Check | Command | Result |
|---|---|---|
| CLI installed | `auth0 --version` | version or missing |
| Tenant session | `auth0 tenants list --json` | first tenant or none |
| CheckMate app | `auth0 apps list --json \| jq '.[]\|select(.name\|test("CheckMate";"i"))'` | client_id or none |
| M2M scopes | `auth0 api get client-grants?client_id=<id>` | scope count or none |
| CheckMate npm | `command -v a0checkmate` | path or missing |
| Node version | `node -v` | version or missing |
| Reviewer | read `state/operator.json` | name or missing |
| Company domain | read `state/setup.json.company_domain` | domain or missing |
| Enrichment cache | newest `state/enrichment_*.json` | age or missing |

Render to chat:
```
auth0-checkmate pre-flight:
  ✓ Auth0 CLI v1.8.2
  ✓ Logged in to acme.us.auth0.com
  ✓ CheckMate M2M app present (cm_xxxxxx · 26/26 scopes)
  ⚠ a0checkmate npm package not installed (will install)
  ⚠ Company domain not cached (will ask)
  → Estimated setup: ~30s
```

Use `✓` (ready), `⚠` (will fix automatically), `✗` (blocking — needs user input). If any `✗`, surface the action needed and pause for input.

### 0.2 Capture missing inputs

If reviewer or company domain is missing, ask in **one** combined `AskUserQuestion` (don't split into separate prompts). Save reviewer to `state/operator.json` (`reviewer_name`, optional `reviewer_org` for the report subtitle), company domain to `state/setup.json.company_domain`.

Skip this step entirely when both are cached.

### 0.3 Mode selector

Single `AskUserQuestion`:

> **How do you want to handle the recommendations?**
> - **Express** — produce the report, then apply Immediate Actions in one batch confirmation; per-command confirm only for After-Upgrading items. Fastest.
> - **Guided** — produce the report, then walk through each recommendation with per-command confirmation. Safest. (default)
> - **Audit only** — produce the report and stop. No fixes applied.

Save the chosen mode to `state/setup.json.mode`. The choice gates Phases 6 + 7 below.

## Phase 1 — Auth0 CLI bootstrap

### 1.1 Verify
```bash
auth0 --version              # CLI installed?
auth0 tenants list --json    # session active? returns tenants array
```

If `--version` fails, install per platform:
- macOS — `brew tap auth0/auth0-cli && brew install auth0`
- Linux / macOS (curl) — download the binary with `curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b .` (it lands in `./auth0`; move it onto `$PATH` with `sudo mv ./auth0 /usr/local/bin` if you want to run it from any directory)
- Windows — `scoop bucket add auth0 https://github.com/auth0/scoop-auth0-cli.git && scoop install auth0`, or via PowerShell: fetch the latest release tag from the GitHub releases API, download `auth0-cli_<version>_Windows_x86_64.zip`, expand it, and add it to `$PATH`
- Any platform with Go ≥ 1.21 — `go install github.com/auth0/auth0-cli/cmd/auth0@latest` (ensure `$GOPATH/bin` is on `$PATH`)
- Manual — download the release archive for your OS/architecture from the auth0-cli GitHub releases page and extract it; make sure `PATH` and `HOME` include the extraction folder

Autocompletion instructions for supported shells are available by running `auth0 completion -h`.

If `tenants list` returns empty / 401, authenticate. There are two ways:
- **As a user** (recommended for personal/interactive machines) — device authorization flow, run `auth0 login`. **Cannot** be used for private cloud tenants.
- **As a machine** (recommended for servers, CI, or private cloud tenants) — client credentials flow:
  ```bash
  auth0 login --domain <domain> --client-id <client-id> --client-secret <client-secret>
  # or, with a private key instead of a secret:
  auth0 login --domain <domain> --client-id <client-id> --client-assertion-private-key <path-to-private-key> --client-assertion-signing-alg <signing-algorithm>
  ```

**Critical:** the session must carry `create:client_grants` and `read:client_grants` so Phase 2's grant call doesn't 403:

```bash
auth0 login --scopes "create:client_grants,read:client_grants"
```

For non-interactive shells (CI, agent without TTY), or private cloud tenants, use the client-credentials login above. Detect TTY before invoking the device flow:
```bash
[ -t 0 ] && auth0 login --scopes "create:client_grants,read:client_grants" || echo "Non-interactive: use client-credentials login"
```

When an access token expires, the CLI prompts to confirm the default tenant (`Continue login with default tenant 'your-tenant.auth0.com'? [y/N]`) or lets you pick a different one — select `y` to proceed with the default, `N` to choose another. Note that CLI usage consumes Management API rate limits according to the subscription plan.

### 1.2 Pin tenant
Save the tenant domain returned by `auth0 tenants list --json` (`.[0].domain` if only one, otherwise ask the user to pick) into `state/setup.json.tenant_domain`. **Don't parse region from the domain suffix** — use the value the CLI returns. Custom domains (private cloud) are valid here.

**This pinned `tenant_domain` is the canonical Auth0-hosted URL.** Every report reference to the tenant URL — header right rail, "authentication is served from `<tenant_domain>`" narrative, CLI commands — reads from `state/setup.json.tenant_domain`. Never derive it from the company context, never parse it from the company domain. The company context provides company-level fields (name, products, business model, integrations) — never the tenant URL.

## Phase 2 — Dedicated CheckMate M2M app

### 2.1 Detect existing
```bash
auth0 apps list --json | jq -r '.[] | select(.name|test("CheckMate";"i")) | {client_id, name}'
```

If a match exists, fetch its current client grant for the Management API audience and **diff scopes** against the required list (Phase 2.3). Missing scopes → `PATCH` the existing grant; **never delete + recreate** (rotates secret silently).

### 2.2 Create if missing
```bash
auth0 apps create --name "Auth0 CheckMate" --type m2m \
  --description "CheckMate tenant audit (managed by this workflow)" \
  --json
```

The JSON response carries `client_id` and `client_secret`. **Never echo the secret outside the user's chat or write it to disk** other than `~/.auth0-checkmate.env` (Phase 2.4).

> Free-plan tenants are limited to 1 free M2M app for the Management API. If create fails with a quota error, list existing M2M apps with Management API grants and ask the user which to reuse.

### 2.3 Authorize Management API scopes (26 read scopes)

```
read:tenant_settings read:custom_domains read:prompts read:clients
read:connections read:connections_options read:resource_servers
read:client_grants read:roles read:branding read:email_provider
read:email_templates read:phone_providers read:phone_templates
read:shields read:attack_protection read:self_service_profiles
read:guardian_factors read:mfa_policies read:actions read:log_streams
read:logs read:network_acls read:event_streams read:hooks read:rules
```

Grant via the Management API (the CLI `auth0 api` is a raw wrapper):
```bash
auth0 api post "client-grants" --data '{
  "client_id":"<id>",
  "audience":"https://<tenant_domain>/api/v2/",
  "scope":["read:tenant_settings","read:custom_domains","read:prompts","read:clients","read:connections","read:connections_options","read:resource_servers","read:client_grants","read:roles","read:branding","read:email_provider","read:email_templates","read:phone_providers","read:phone_templates","read:shields","read:attack_protection","read:self_service_profiles","read:guardian_factors","read:mfa_policies","read:actions","read:log_streams","read:logs","read:network_acls","read:event_streams","read:hooks","read:rules"]
}'
```

Some tenants reject `read:hooks` / `read:rules` (deprecated). On 400, retry without those two and proceed.

If the grant call returns 403, the login session is missing `create:client_grants` — go back to Phase 1.1 and re-login with that scope.

### 2.4 Persist creds to a portable env file

Write a dedicated env file at `~/.auth0-checkmate.env` and lock its permissions. This works the same way on macOS, Linux, WSL, and Git Bash — no shell-rc surgery required. Fish users: see the Portability section below.

```bash
ENV_FILE="$HOME/.auth0-checkmate.env"
cat > "$ENV_FILE" <<'EOF'
# Auth0 CheckMate credentials — managed by this workflow.
# Treat as secret. Restrict permissions and exclude from dotfile repos / backups.
export AUTH0CHECKMATE_DOMAIN="<tenant_domain>"
export AUTH0CHECKMATE_CLIENT_ID="<client_id>"
export AUTH0CHECKMATE_CLIENT_SECRET="<client_secret>"
EOF
chmod 600 "$ENV_FILE"
```

**Replace `<tenant_domain>`, `<client_id>`, and `<client_secret>` with the values from Phase 2 before writing this file.** The heredoc is single-quoted to prevent shell expansion — substitute inline, e.g. `sed -i "s/<tenant_domain>/$DOMAIN/" ~/.auth0-checkmate.env`, or open the file in an editor. The workflow reloads this file in Phase 4 via `source`. The user does NOT need to add anything to their shell rc — but they can, for convenience: `echo 'source ~/.auth0-checkmate.env' >> ~/.zshrc` (or `~/.bashrc`).

Save `client_id` (NOT the secret) to the state file.

### About the CheckMate CLI itself

CheckMate for Auth0 (`@auth0/auth0-checkmate`) is a command-line utility that performs configuration checks on your Auth0 tenant, validating key settings and generating a detailed audit report. It requires Node.js v20.18.3 or higher and a valid Auth0 tenant.

It makes use of the Auth0 Management API, which consumes the tenant's rate limits — use it thoughtfully to avoid throttling. Its usage is visible in the tenant's log events in several ways: the `User-Agent` HTTP header (`${packageName}/${packageVersion}`, e.g. `@auth0/auth0-checkmate/1.4.0`, unless the client modifies it), the `client_name` and `scopes` assigned when configuring initial access, and `seccft` events (successful exchange of an access token for a client-credentials grant) in Auth0 logs.

Install it globally with `npm install -g @auth0/auth0-checkmate`, then run it with `a0checkmate` and follow the interactive prompts. Update with `npm update -g @auth0/auth0-checkmate`. Alternatively, run from source: clone `auth0/auth0-checkmate`, `cd` into it, `npm install`, then `npm start`.

The dedicated M2M application this phase creates authorizes calls to the Management API and needs exactly the 26 read scopes listed in 2.3 — no more. CheckMate also accepts these environment variables for a CI-friendly, non-interactive configuration (used directly in Phase 4.2):
```text
AUTH0CHECKMATE_DISABLE_PDF_REPORTING=true|false
AUTH0CHECKMATE_DOMAIN=your_domain
AUTH0CHECKMATE_CLIENT_ID=your_client_id
AUTH0CHECKMATE_CLIENT_SECRET=your_client_secret
AUTH0CHECKMATE_FILE_PATH="./reports"
AUTH0CHECKMATE_SHOW_VALIDATORS=false
```

## Phase 3 — Company context (lightweight, parallel)

Kick this off **before** running CheckMate — it's network-bound and independent. The goal is narrow: make the audit *relevant to the customer's product* — what they build, who logs in, and what they integrate with — so each finding reads in their own terms. This is **not** a sales-qualification step: do **not** produce fit scores, a "plan fit" verdict, or firmographics (funding, valuation, investors, headcount). The plan suggestion in Phase 5 is derived from the customer's use case + this tenant's actual findings + the pricing reference — never from a company fit score.

Given the company domain, gather public context with whatever web fetch / search tools the agent has. Treat live data as the primary source of truth; use training knowledge only to supplement.

**Pages to read (best-effort, cap ~3000 chars each):** `/` (value prop, products, target market), `/about` (what they do), `/login` `/signin` (auth surfaces + current-provider signals), `/pricing` (B2B vs B2C, tiers), `/security` `/trust` (posture, compliance), `/docs` `/developers` (auth standards, API patterns), `/integrations` `/partners` (third-party APIs — relevant to Token Vault / A4AA), `/careers` (auth tech named in job posts).

**Current auth-provider detection (optional, best-effort):** scan the homepage + login-page HTML and job posts. A login redirect to a provider domain is the strongest signal. Patterns: Auth0 (`.auth0.com`, `auth0-spa-js`), Clerk (`clerk.com`, `@clerk/`, `pk_live_`), WorkOS (`workos.com`, `authkit`), AWS Cognito (`cognito-idp`, `amazoncognito.com`), Firebase Auth (`firebaseapp.com`, `identitytoolkit.googleapis.com`), Okta / Keycloak / FusionAuth / Frontegg / Supabase (provider domain or SDK name). Record provider + confidence (high = redirect match, medium = single SDK signal, low = inference) + the exact evidence.

**Classify (best-effort; use `null` when unsure — never invent):**
- `company_name`, `product_summary` — name the product(s) and what they do, who the end users are.
- `business_model` — B2C / B2B / B2B SaaS / Marketplace / Platform / Fintech / Other.
- `ai_use_case` — AI-Native / AI-Differentiated / AI-Enhanced / None / Unknown, with a one-line description.
- `login_portal_assessment` — the distinct login surfaces and who uses each (consumers / business customers / developers / partners / internal staff).
- `user_types`, `auth_standards_detected` (OIDC / OAuth2 / SAML / JWT / WebAuthn), `notable_auth_features` (MFA, SSO, passwordless, social, magic links, API keys, bot protection).
- `integrations` — third-party APIs the product or its agents touch (Gmail, Slack, Salesforce, Stripe, GitHub, Jira, HubSpot, …). Used **only** to judge whether Token Vault / CIBA recommendations are relevant.

Save the resulting JSON to `~/.auth0-checkmate/state/enrichment_<domain>_<timestamp>.json` (`company_context_*.json` is also fine).

If context gathering fails (no internet, web tool errors), **don't block** — continue with CheckMate. The Phase 5 report degrades gracefully: findings stay accurate, they just won't be framed in product-specific language.

## Phase 4 — Run CheckMate + gather tenant facts

### 4.1 Prereqs
- Node ≥ 20.18.3 (`node -v`). CheckMate ships Puppeteer which downloads Chromium (~150 MB) on install — flag this to the user before installing.
- Install if missing: `npm install -g @auth0/auth0-checkmate`

### 4.2 Run with env-var config

Use an absolute report path (relative paths resolve to cwd which may be wrong) and disable PDF generation — the JSON is what Phase 5 consumes, and skipping PDF avoids the Chromium dependency:

```bash
REPORT_DIR="$HOME/Documents/auth0_checkmate_reports"
mkdir -p "$REPORT_DIR"
source ~/.auth0-checkmate.env 2>/dev/null  # ensure env vars are available
AUTH0CHECKMATE_DOMAIN="$AUTH0CHECKMATE_DOMAIN" \
AUTH0CHECKMATE_CLIENT_ID="$AUTH0CHECKMATE_CLIENT_ID" \
AUTH0CHECKMATE_CLIENT_SECRET="$AUTH0CHECKMATE_CLIENT_SECRET" \
AUTH0CHECKMATE_FILE_PATH="$REPORT_DIR" \
AUTH0CHECKMATE_DISABLE_PDF_REPORTING=true \
AUTH0CHECKMATE_SHOW_VALIDATORS=false \
a0checkmate
```

### 4.3 Locate output
CheckMate writes `<tenant>_<locale>_<YYYYMMDD_HHMMSS>_report.json` (and a `.pdf` unless disabled) into `FILE_PATH`. Pick the newest:
```bash
ls -t "$REPORT_DIR"/*_report.json | head -1
```

The JSON's main array lives at `data.report.summary[]` with fields like `severity` (info/warning/critical), `title`, `severity_message`, `detailsLength`, plus per-finding details. Confirm the exact shape before parsing — versions may evolve.

### 4.4 Gather extra tenant facts (for the report template)

The Phase 5 report needs more than CheckMate alone provides. Run these in parallel and capture each output:

```bash
auth0 apps list --json                   # apps_list — count + names for Section 1, 3, 4
auth0 logs list --number 50 --json       # logs_sample — to flag "Active" login activity
auth0 api get tenants/settings           # tenant_settings — for "Current Auth0 Tier" detection (look for plan/subscription hints; fallback "Free Plan"). Map detected features against the pricing reference to infer the tier when no explicit plan field is present.
auth0 api get custom-domains             # custom_domains — empty array → triggers "Branding Gap"
auth0 api get connections                # connections — for enterprise-connection check
auth0 api get log-streams                # log_streams — empty array → triggers "Observability Gap"
auth0 api get attack-protection/breached-password-detection  # for "Account Security" section
```

These outputs feed directly into the Phase 5 fusion.

## Phase 5 — Produce the personalized report (markdown + PDF)

Read all inputs:
- CheckMate JSON (`*_report.json`) — severities, finding titles, details
- Enrichment JSON (`state/enrichment_<domain>_<ts>.json`, may be missing if Phase 3 failed)
- Tenant facts from Phase 4.4
- `state/operator.json` — reviewer name
- `state/setup.json.tenant_domain` — canonical tenant URL

**Produce three files** following the locked report skeleton:
1. A **markdown brief** following the markdown report template in `assets/audit/`
2. A **styled HTML brief** following `assets/audit/report-template.html` — same data, render-ready
3. A **PDF** rendered from the HTML by `${CLAUDE_SKILL_DIR}/scripts/render_pdf.sh`

Key rules below.

### Source-of-truth rule
Every `<tenant_domain>` reference (header right rail, "authentication is served from..." narrative, CLI commands) reads from `state/setup.json.tenant_domain`. Never from the company context. The company context provides company-level fields (name, products, business model, integrations).

### Header
- Title: **Auth0 Platform Development Review**
- Subtitle: `Prepared by <reviewer_org>` — **omit the line entirely if `reviewer_org` is blank** (most self-audit cases)
- Right rail: `<plan_tag>` · `<Customer Name>` · `<tenant_domain>` · `<Month DD, YYYY>`
- Metadata table:
  - **Prepared by:** `state/operator.json.reviewer_name`
  - **Date of Review:** today
  - **Customer Account:** `<Customer Name> (<tenant_domain>)`
  - **Current Auth0 Tier:** plan from `tenant_settings`, fallback "Free Plan"
  - **Use Case Diagnosis:** `<business_model> — <product_summary_short>` from the company context
  - **Recommended Plan:** `<recommended_plan>` — the plan that fits the customer's use case and unlocks this tenant's *After Upgrading* findings (derived from the use case + findings + the pricing reference; plan name only, no price) ` · Auth for AI Agents: <Yes|No>` (Yes only when Phase 3 found concrete agent / third-party integrations Token Vault or CIBA would serve). Example: `B2B Essentials · Auth for AI Agents: Yes`

### Section 1 — Account Health
- Metrics table:
  - Applications Registered: count from `apps_list`
  - Login Activity: "Active (detected on canonical domain)" / "Inactive" — derived from `logs_sample`
  - Security Findings: `<N> High`, `<N> Moderate`, `<N> Low / Info`, `<N> Passing` from CheckMate severity breakdown
- 2-4 personalized **Gap callouts** — bold name + 1-2 sentence narrative naming customer products / portals / users from enrichment. Standard candidates (include only when CheckMate evidence + enrichment context support it):
  - **The Branding Gap** — empty `custom_domains` → name canonical `tenant_domain`, name 2-3 affected products
  - **The Security Gap** — no MFA configured → reference customer's user types / data sensitivity
  - **The Production Readiness Gap** — dev URLs in prod, implicit grant types → name offending apps from `apps_list`
  - **The Compliance Gap** — empty `log_streams` + regulated industry / EU tenant
  - **The Observability Gap** — empty `log_streams` (generic version)

### Section 2 — Executive Summary
- Opening paragraph: name customer products from enrichment, apps count from `apps_list`, "graduating from working setup to production-grade enterprise-ready" framing, then state CheckMate finding counts (`<N> High` and `<N> Moderate`).
- **Configuration Posture at a Glance** table: Severity / Count / Key Examples (top 3-5 finding titles per row, dot-separated).

### Section 3 — Strategic Opportunities & Action Plan
Four-column table: **Feature Area · The Enterprise Challenge · The Solution · Strategic Impact**. Standard rows when applicable:

- **Brand Trust & UX → Custom Domains** (no `custom_domains`)
- **Per-Organization Management → Auth0 Organizations** (B2B + multi-customer apps)
- **Enterprise SSO → Enterprise Connections (SAML / OIDC)** (B2B + no enterprise connections)
- **Account Security → MFA (WebAuthn / Authenticator App)** (no MFA)
- **Observability → Log Streaming** (no `log_streams`)
- **AI Agent Security → Token Vault (A4AA)** (`ai_use_case` ∈ AI-Native/AI-Differentiated + integrations)
- **Human-in-the-Loop AI → CIBA (A4AA)** (autonomous-action workflows in enrichment)

Every row weaves enrichment data — name products, customer types, business model, integrations, region.

### Section 4 — Recommended Roadmap & Next Steps
- **Recommended Plan banner:** `<recommended_plan>` — the plan that fits the customer's use case and unlocks the *After Upgrading* fixes (from the use case + the triage table + the pricing reference). Append " + Auth for AI Agents (A4AA)" only when Phase 3 found concrete agent / third-party integrations Token Vault or CIBA would serve. **Never quote or estimate an Enterprise price;** if Enterprise-only findings exist, note they require Auth0 sales.
- 1-paragraph rationale tying plan to enrichment (name customer products, business model)
- **Immediate Actions — Available Today (Free):** numbered list of CheckMate findings actionable on the **current** plan. Name affected apps/connections explicitly. Feeds the remediation reference's Loop A.
- **After Upgrading:** numbered list of fixes requiring the recommended plan. Feeds the remediation reference's Loop B.
- **Key Documentation:** 2-column grid of doc links matched to Section 3 rows.
- Footer: `Confidential · Auth0 tenant configuration review for <Customer Name> · <Month YYYY>`

### Triage rule (Immediate vs After Upgrading)

**The source of truth for which plan a feature requires is the co-loaded pricing reference** — the full Auth0 feature→plan matrix (B2C + B2B). Read it before triaging; do NOT guess from feature names or memory. A finding goes into **Immediate Actions** only if its fix is achievable on the tenant's **current** plan (detected in Phase 4.4, fallback Free). Everything else goes into **After Upgrading**, labeled with the minimum plan that unlocks it.

Common misconception to avoid: **Custom Domains is NOT an upgrade feature** — the Free plan includes 1 custom domain (credit-card verification required). Never place it under "After Upgrading."

Quick reference for the findings CheckMate emits (verify against the pricing reference — it wins on any conflict):

| CheckMate finding | Minimum plan | Loop |
|---|---|---|
| Application Grant Types (remove `implicit`, Auth Code + PKCE) | **Free** (app config) | Immediate |
| Cross Origin Authentication (disable) | **Free** | Immediate |
| Refresh Tokens (enable rotating) | **Free** | Immediate |
| PKCE Enforcement / Token Sender-Constraining | **Free** | Immediate |
| Databases – Password Complexity / Email Attribute Verification | **Free** (connection config) | Immediate |
| Brute Force Protection / Suspicious IP Throttling | **Free** (all plans) | Immediate |
| Session Management / Tenant Login URI / Allowed Logout URLs | **Free** (tenant settings) | Immediate |
| Management API Access Control (M2M scopes) | **Free** | Immediate |
| **Custom Domains** | **Free** (1, CC verification) | **Immediate** |
| Email Providers / Email Templates (Email Workflow) | **Essentials** | After Upgrading |
| Log Streams | **Essentials** (1 stream) | After Upgrading |
| MFA factors / Multifactor Policy / MFA for Password Reset† | **Essentials** (Pro MFA Factors) | After Upgrading |
| Breached Password Detection (blocking) / Enhanced Password Protection | **Professional** | After Upgrading |
| Security Center | **Professional** (B2C) | After Upgrading |
| Tenant Access Control List (ACL) | **Enterprise** (add-on) | After Upgrading |
| OIDC Back-Channel Logout | **Enterprise** | After Upgrading |
| Private Key JWT / JAR / PAR | **Enterprise** | After Upgrading |
| CIBA (A4AA) | Essentials + **A4AA add-on** | After Upgrading |
| Token Vault (A4AA) | Free gets 2; more via **A4AA add-on** | After Upgrading (scale) |

† The Password Reset *Action* itself deploys on Free (5 Actions included), but it can only **challenge** MFA once MFA factors are enabled, which requires Essentials+. Treat the end-to-end "MFA on password reset" outcome as Essentials.

Enterprise-only findings (Tenant ACL, Back-Channel Logout, Private Key JWT) are out of self-service scope — list them under After Upgrading but note they require an Enterprise plan / Auth0 sales, not a self-service upgrade.

### Fusion checklist (verify before saving — every item is mandatory)

The point of this workflow is to fuse enrichment intelligence into the audit so the customer sees **why each recommendation matters for their specific business**, not generic best-practice. Before saving the files, walk this checklist. If any item fails, regenerate that section.

1. **Header metadata** uses the customer's actual `company_name`, `business_model`, `product_summary_short`, and the derived `<recommended_plan>` — no template placeholders.
2. **Section 1 metrics** show real `apps_count` from `auth0 apps list`, real CheckMate severity counts, real login activity derived from `auth0 logs list`.
3. **Section 1 Gap callouts** each name at least one specific product, app, or user segment from enrichment / `apps_list`. If a callout reads generically ("enterprise clients...", "the affected apps..."), rewrite it with concrete names or omit it.
4. **Section 2 opening paragraph** lists the customer's products by name (e.g. "Customer Portal, Admin Console, Mobile App") — never "the customer's apps".
5. **Section 3 — every row's `Enterprise Challenge` cell** references concrete enrichment data: product names, business model, user types, integrations, region, AI workflows, or industry. **If you cannot fill any cell with company-specific content, OMIT the row entirely.** A generic row is worse than no row.
6. **Section 4 plan rationale** names the customer's products and ties them to the recommended plan's specific features.
7. **Section 4 action lists** name affected apps/connections explicitly (e.g. "Disable implicit grant on `Default App, Admin Console Web`" — never "Disable implicit grant on the affected apps").
8. **No `{{placeholder}}` strings** remain in either rendered file.

Final lint:
```bash
grep -nE '\{\{|enterprise clients[^A-Za-z]|the customer[^A-Za-z]|the affected apps' "$MD_PATH" "$HTML_PATH"
```
Output must be empty. If non-empty, rewrite the flagged passages with company-specific content.

### Output paths
Write all three to `~/Documents/`, with the same timestamped basename:
```
auth0_checkmate_<sanitized_tenant>_<YYYYMMDD_HHMMSS>.md
auth0_checkmate_<sanitized_tenant>_<YYYYMMDD_HHMMSS>.html
auth0_checkmate_<sanitized_tenant>_<YYYYMMDD_HHMMSS>.pdf
```
(Date-time, not just date — same-day re-runs must not collide. Sanitize `tenant_domain` by replacing `.` with `_`.)

### Render the PDF
```bash
"${CLAUDE_SKILL_DIR}/scripts/render_pdf.sh" "$HTML_PATH" "$PDF_PATH"
# ${CLAUDE_SKILL_DIR} is the absolute path to this skill folder (auto-set by Claude Code).
# Other agents: substitute the absolute path to wherever this skill folder was extracted.
```

If the script exits non-zero, surface the renderer's error message — the markdown and HTML are already saved, so the user has fallback artifacts. Common cause: no Chrome / Chromium / Edge / Brave / Arc app installed and no `wkhtmltopdf` / `weasyprint`. The script's stderr message tells the user how to fix.

### Chat summary
Render a short chat summary: top 3-5 findings by severity, each with a one-line personalized "why this matters for `<Company>`" framed in the customer's product/business terms. End with the three file paths.

## Phase 6 — Walk the user through the report

Branch on `state/setup.json.mode` (set in Phase 0.3):

- **Audit only** → render the chat summary, print the three file paths (md / html / pdf), END the run. Do NOT proceed to remediation.
- **Express** or **Guided** → render the chat summary, print file paths, then continue to remediation using the co-loaded remediation reference. The report's "Immediate Actions" and "After Upgrading" lists are the canonical work queues.

Remediation itself — the command-shape mapping, the per-item guided flow, the express-mode batch flow, the plan-upgrade gate, and the never-without-confirmation list — is covered in full by the remediation reference loaded alongside this one; every applied fix still requires per-command confirmation, every change is verified by re-fetching the resource, and a failed command is never retried destructively.

## State files

Located under `~/.auth0-checkmate/state/` (created lazily):

| File | Purpose |
|---|---|
| `setup.json` | cache: tenant_domain, checkmate_client_id, company_domain, last_run_at — secrets excluded |
| `operator.json` | reviewer name + optional org/role for the report header |
| `enrichment_<domain>_<ts>.json` | one per enrichment run |
| `queue.json` | queued / skipped / pending_upgrade items across runs |
| `history.jsonl` | append-only log of applied/queued/skipped findings per run |

## Pitfalls to remember

- `read:hooks` / `read:rules` are deprecated; some tenants 400 on grant. Retry without them.
- Free-plan tenants: 1 M2M app quota for Management API. Reuse if name match.
- `AUTH0CHECKMATE_FILE_PATH` is relative-to-cwd by default — always pass an absolute path.
- Tenant region: trust `auth0 tenants list --json`, don't parse the domain.
- State file is a cache — re-validate each field every run; never act on it without verification.
- `~/.auth0-checkmate.env` is not auto-sourced. The workflow does it in Phase 4; outside the workflow, the user has to either `source` it manually each session or chain it into their shell rc.

## Portability notes (cross-OS / cross-shell)

This workflow is designed to work for any Auth0 customer, not just the author's machine.

**Operating systems**
- macOS, Linux, and Windows-WSL are first-class. Native Windows (PowerShell / cmd) is not supported by this workflow's bash steps; users on native Windows should run inside WSL or Git Bash.
- `~/Documents` exists by default on macOS and Windows; on Linux it depends on user setup. If `~/Documents` doesn't exist, fall back to `~/auth0-checkmate-reports` (create it on first write).

**Shells**
- `~/.auth0-checkmate.env` uses POSIX `export` syntax — works for bash, zsh, dash, ksh, and Git Bash.
- Fish shell users: the env file syntax differs (`set -gx` instead of `export`). The workflow writes the POSIX form by default; a fish-specific file at `~/.config/fish/conf.d/auth0-checkmate.fish` can be added by the user. Phase 4's `source ~/.auth0-checkmate.env` won't work in fish — pass env vars inline instead.

**PDF renderer**
- `scripts/render_pdf.sh` searches Chrome / Chromium / Edge / Brave / Arc on macOS, Linux, and WSL paths automatically. Falls back to `wkhtmltopdf` and then `weasyprint` if no browser is found.
- If none are available, the markdown and HTML files still get written — the PDF step is skipped with a clear error message telling the user how to install one renderer. The workflow should NOT fail the whole run on PDF render failure.

**Auth0 CLI install**
- See Phase 1.1 for per-platform install commands. The CLI itself is a single Go binary, so any OS with Go ≥ 1.21 can use `go install` as the universal fallback.

**Self-audit vs CS-audit modes**
- `reviewer_org` blank → the report subtitle is omitted (clean self-audit look).
- `reviewer_org` populated → the report subtitle reads "Prepared by `<reviewer_org>`" (CS / consulting / partner mode).
- Either way, the report content is identical — the only difference is the header subtitle.
- Enrichment provides company-level fields only — never the tenant URL. Tenant URL always comes from `state/setup.json.tenant_domain`.
