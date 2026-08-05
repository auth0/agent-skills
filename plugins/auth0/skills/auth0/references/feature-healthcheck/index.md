# Auth0 tenant health check (all plans) — full workflow

Use this reference when a customer or developer wants a complete, plan-aware health check of their own Auth0 tenant across ALL plans (Free, Essentials, Professional, Enterprise) — security & configuration hygiene PLUS use-case capability/plan fit in one pass. It runs one universal assessment, produces TWO scores (Security & Config Hygiene + Capability Fit), reframes recommendations for the tenant's current plan, recommends a specific self-service plan with cost OR an "Enterprise — contact sales" path with a prefilled sales brief when enterprise-only needs are detected, and can optionally apply approved fixes via the Auth0 CLI with per-command confirmation. It emits an in-chat summary and, on request, a markdown + styled PDF report.

You produce a **plan-agnostic** Auth0 tenant health check for any segment — Free, self-service paid (Essentials / Professional), or Enterprise. It fuses **CheckMate-style security/config hygiene** with **use-case capability fit**, gives **two scores**, makes **tier-adaptive** recommendations, and can **optionally apply approved fixes** via the Auth0 CLI.

This workflow **builds on the co-loaded audit workflow reference** rather than reimplementing it: the audit workflow reference runs the tenant scan + findings **and** gathers the lightweight company/use-case context (its Phase 3) that the Capability Fit track and the use-case-based plan recommendation build on. **Sequencing constraint:** the audit workflow must complete through at least its company-context phase before this reference's use-case classification (Phase 2 below) can begin — Phase 2 depends on the company context that the audit workflow's Phase 3 produces. In practice: when this healthcheck intent is routed, the router loads the audit workflow reference alongside this one — run the audit workflow first for the tenant scan + company context, then come back to this reference for the healthcheck-specific scoring / plan-matching / reporting.

For the feature→plan matrix (Free/Essentials/Professional/Enterprise, B2C + B2B), MAU limits, and feature availability, use the co-loaded pricing reference — **never hardcode any of it, and never let anything below contradict it.** Prices are not in that reference: fetch them from `https://auth0.com/pricing.md` as it instructs. For the step-by-step remediation flows (command-shape mapping, the never-without-confirmation list, fix-dependency ordering) needed by Phase 7's optional gated apply, use the co-loaded remediation reference — only the health-check-specific safety rule that isn't already there is inlined below. The markdown report template lives at `assets/healthcheck/report-template.md`; the matching styled HTML template lives at `assets/healthcheck/report-template.html`. The PDF is rendered from the HTML by the script at the skill's `scripts/render_pdf.sh`, invoked as `${CLAUDE_SKILL_DIR}/scripts/render_pdf.sh`.

**Source-of-truth rules (non-negotiable):** feature availability, MAU limits, and the feature→plan matrix come from the co-loaded pricing reference; **prices come from `https://auth0.com/pricing.md`**, per that reference's quoting procedure — follow it rather than any figure appearing below. `tenant_domain` always comes from the Auth0 CLI, never from the company context. **Never quote or estimate a price for Enterprise.**

**Company context is internal working context, not customer-facing output.** The customer is self-auditing their own tenant, so don't dump raw company research back at them. Surface only: (a) the derived **use-case classification**, (b) the customer's **product names** woven into the findings and recommendation, and (c) the **provenance / confidence note**. Don't echo back firmographics the customer already knows about themselves (company size, funding, and the like) — they add nothing and erode trust. The **use-case-based plan recommendation** (Phase 4) IS the customer's result — show it in full. Exception: the **Talk-to-Sales brief** may include company facts — it is addressed to sales, not shown as the customer's result.

---

## Workflow: Phases 0–7 (0–6 assess + report; 7 is opt-in apply)

### Phase 0 — Gather inputs

State dir: `~/.auth0-checkmate/state/` (shared with the co-loaded audit workflow so the enrichment cache is reused). Files: `operator.json`, `setup.json` (cache; re-validate each run), `enrichment_<domain>_<ts>.json`, `queue.json`, `history.jsonl`.

1. **Reviewer:** read `state/operator.json`. If missing, ask name + optional team/org. Blank org → the report subtitle is omitted (the common self-audit case). An optional `ae_link` may be stored for the Talk-to-Sales block.
2. **Tenant facts + findings (CheckMate-style scan):** if the user already has a CheckMate JSON report, use it; otherwise run the co-loaded audit workflow reference's phases to produce one (it bootstraps the CLI + M2M app and runs the audit; the user only completes the Auth0 device login). Parse findings from the report's **flat array of finding objects** — each has `severity`, `status`, `title`, `severity_message`; `severity` is one of the scanner's 5 values (`Info` | `Low` | `Moderate` | `High` | `GenAI`). Some scanner versions wrap the array as `data.report.summary[]`; accept either (see Phase 3A's normalization step).
3. **Company context (company/use-case):** if provided, use it; otherwise it comes from running the co-loaded audit workflow — its company-context phase gathers lightweight public company context (business model, use case, products, login portals, third-party integrations) from the company domain. If that phase hasn't run, gather the same context inline or ask the user. Record **provenance** (live research vs. training-knowledge fallback) and a **confidence** note.
4. **Normalize the fact set** (from whichever source supplied each): `custom_domains_present`, `log_streams_present`, `mfa_configured`, `organizations_configured`, `enterprise_connections_count`, `applications_count`, `current_plan` (fallback "Free"), `current_mau`, `monthly_growth_rate`, `tenant_domain` (always from the Auth0 CLI), plus the severity buckets from the scan. Record the **source** of each (scan vs. user-supplied) for confidence reporting.
5. **MAU/growth (use every source, in priority order):** (a) **authoritative** — `auth0 api get stats/active-users` for current MAU + `stats/daily` for a real growth trend (needs `read:stats`; add the scope if it 403s); (b) **tenant telemetry / provided data** — any current-MAU or growth figures already supplied or cached; (c) **company context as context only** — growth-stage/scale hints to sanity-check and set growth expectations, but a company's product-user count is NOT its Auth0 tenant MAU, so never substitute it for the actual active-users figure; (d) **ask** the user for current MAU + expected growth (presets; default 15%, labeled) — don't send them to export a CSV; only point to the Support Center Quota/Usage report (online, up to 12 months, no CSV) if they ask where to find it. **Compute actual growth from history when available** rather than assuming. Full mechanics in the MAU forecast section (Phase 4 below).

See **Graceful degradation** at the end for missing scan / missing company context.

### Phase 1 — Auth0 CLI bootstrap (only when self-driving the CLI)

Needed when this workflow drives the CLI directly (gathering extra facts in Phase 0, or applying fixes in Phase 7). Skip if the assessment runs purely off a provided CheckMate-style JSON and the user declines the apply step.

```bash
auth0 --version
auth0 tenants list --json
```

Install if missing — per-platform install commands are covered by the co-loaded audit workflow reference (Phase 1). Run `auth0 login --scopes "create:client_grants,read:client_grants"` if empty/401. Pin `tenant_domain` from `tenants list --json` (don't parse region from the suffix) — this is the only source for `tenant_domain`, never the company context.

### Phase 2 — Classify use case

Run the decision tree below (regulated vertical first → B2B/B2C/Mixed → AI). Output: `detected_use_case`, `verticals[]`, `business_model`, `ai_use_case`, AI integrations. **`ai_use_case` is an enum — one of `AI-Native`, `AI-Differentiated`, `AI-Enhanced`, `AI-Adjacent`, or `none` — carried through end-to-end; never flatten it to a boolean, or the A4AA scoring and the Token-Vault/CIBA gate below silently misfire.**

#### Use-case detection decision tree

**Step 1 — Regulated verticals.** IF `company_description` contains (fintech | banking | payments | healthcare | medical | government | HIPAA | SOC2 | PCI) OR `compliance_vertical` in (fintech, healthcare, education, government, legal) → classify **REGULATED VERTICAL**. Surface: Log Streaming (audit trails), Breached Password Detection, Session Management, MFA enforcement, Custom Domain, Organizations (if B2B), Enterprise Connections (if enterprise customers exist). Additional for fintech: Anomaly Detection, risk-based auth, token rotation policies. Additional for healthcare: HIPAA-eligible log retention, encrypted log storage, audit-trail immutability.

**Step 2 — Business model.** Check MIXED **first** — a company serving both segments satisfies the B2B test too, so without this ordering it would never auto-classify as MIXED (it would fall into B2B, and the final ELSE would only ever catch the *unknown* case).
- IF `business_model == "Mixed"` OR (`customer_segments` contains one of (enterprise, SMB) **AND** contains (consumer)) → **MIXED (B2B + B2C)**. Surface: both feature sets — Organizations (B2B tenants), Social Connections (B2C users), Custom Domain (required for both). Gap severities: Organizations CRITICAL, Social Connections MODERATE, Custom Domain MODERATE.
- ELSE IF `business_model == "B2B"` OR `customer_segments` contains (enterprise, SMB) → **B2B**. Surface: Auth0 Organizations, Enterprise Connections (SAML/OIDC — usually 3–5 included), Custom Domain (REQUIRED), Roles & RBAC, MFA enforcement, Log Streaming, email provider + branded templates. Gap severities: Custom Domain CRITICAL, Organizations CRITICAL, Enterprise Connections HIGH, MFA HIGH, Log Streaming MODERATE.
- ELSE IF `business_model == "B2C"` OR `customer_segments` contains (consumer) → **B2C**. Surface: Social Connections, Custom Domain (brand trust), Email/Password UX, MFA optional, Passwordless (nice-to-have), Bot detection. Gap severities: Social Connections MODERATE, Custom Domain MODERATE, Email/Password UX LOW, MFA LOW.
- ELSE → **UNKNOWN** (no segment signal matched). Ask the user "Is your use case B2B, B2C, or Mixed?"; if unanswered, fall back to B2C Essentials at low confidence per the plan-matching default.

**Step 3 — AI use case.** Read the `ai_use_case` enum from enrichment (`AI-Native` | `AI-Differentiated` | `AI-Enhanced` | `AI-Adjacent` | `none`) — never a flattened boolean, or AI-Enhanced tenants below get mis-routed into the CRITICAL branch.
- IF `ai_use_case IN {"AI-Native", "AI-Differentiated"}` AND `ai_integrations.length > 0` AND `ai_integrations` contain (Gmail, Slack, Salesforce, GitHub, Stripe, HubSpot, Jira, etc.) → **AI-NATIVE / AI-DIFFERENTIATED**. Surface: Token Vault (securely store/refresh OAuth tokens for agent integrations — list the specific APIs), CIBA (async approval for high-stakes actions — critical if `autonomous_actions` contains sending emails, updating records, publishing, financial transactions), M2M Authentication (agent-to-API flows), Custom Claims (agent context in tokens). Gap severities: Token Vault CRITICAL, CIBA HIGH (if autonomous actions detected), M2M Auth MODERATE, Custom Claims LOW.
- ELSE IF `ai_use_case IN {"AI-Native", "AI-Differentiated"}` AND `ai_integrations.length == 0` → **AI-ADJACENT** (LLM integration, no OAuth/external APIs). Surface: M2M Authentication (LLM API calls), Custom Claims. Gap severities: M2M Auth MODERATE; Token Vault / CIBA not relevant.
- ELSE IF `ai_use_case == "AI-Enhanced"` → AI is supplementary, not the product's core or a differentiator. Do **NOT** flag Token Vault / CIBA as CRITICAL. Surface, at most, M2M Authentication (MODERATE) and Custom Claims (LOW) if concrete integrations exist; otherwise treat as non-AI for scoring. A4AA is optional here, never CRITICAL.
- ELSE (`AI-Adjacent` shorthand from enrichment, or `none`) → no AI-specific features surfaced.

**Feature gap severity classification (overall):**
- CRITICAL: Custom Domain (missing = brand credibility killer), Organizations (B2B missing = can't isolate customers), Enterprise Connections (B2B missing = can't SSO with corporate IdPs), Token Vault (AI missing = OAuth token security risk), Log Streaming (regulated missing = compliance failure).
- HIGH: MFA enforcement (enterprises require it in procurement), CIBA (autonomous actions missing = no approval trail), Roles/RBAC (B2B without = no permission granularity).
- MODERATE: Email provider + branding (B2B without = unprofessional), Social Connections (B2C without = lower conversion), M2M Auth (AI without = manual agent orchestration), Anomaly Detection (regulated without = security blind spot).
- LOW: Session Management tweaks, Passwordless (nice-to-have), Bot Detection (unless abuse detected).

**Output shape** for each detected use case:

```json
{
  "detected_use_case": "B2B SaaS + AI Agents",
  "verticals": ["fintech"],
  "business_model": "B2B",
  "ai_use_case": "AI-Native",
  "ai_integrations": ["Salesforce", "Stripe", "Gmail"],
  "required_features": ["Custom Domain", "Organizations", "Enterprise Connections", "MFA enforcement", "Log Streaming", "Token Vault", "CIBA"],
  "configured_features": ["Email/Password auth", "Applications registered"],
  "missing_features": [
    {"feature": "Custom Domain", "severity": "CRITICAL", "reason": "Enterprise customers see generic Auth0 domain at login"},
    {"feature": "Organizations", "severity": "CRITICAL", "reason": "Can't isolate each fintech customer's data + branding"},
    {"feature": "Token Vault", "severity": "CRITICAL", "reason": "AI agents need secure OAuth token storage for Salesforce + Stripe integrations"}
  ],
  "fit_score": 35,
  "fit_level": "Not Ready"
}
```

### Phase 3 — Two-part assessment + TWO scores

One universal assessment, two scored tracks.

**3A — Security & Config Hygiene (universal, plan-independent).** **Normalize the scan first.** The scanner emits a **flat array of finding objects** — each with `severity`, `status`, `title`, `severity_message` (shape confirmed against a live report); some versions wrap it as `data.report.summary[]`. Accept either: if a `data.report.summary[]` wrapper is present, read that array; otherwise treat the top-level array as the finding list. From the normalized findings, bucket by the scanner's real **5-value severity scale** — `Info`, `Low`, `Moderate`, `High`, `GenAI` — count failures per bucket (a finding is failing when its `status` is not passing), then compute the **Hygiene Score**:

```text
weighted_failures = 5·(#GenAI) + 5·(#High) + 2·(#Moderate) + 1·(#Low) + 0.5·(#Info_failing)
weighted_total    = weighted_failures + 1·(#passing)
penalty_ratio     = clamp(weighted_failures / weighted_total, 0, 1)
hygiene_score     = round(100 × (1 − penalty_ratio))
```

- All checks passing → 100.
- **No scan available → DO NOT emit a number.** Show `Hygiene: Not scored — run a CheckMate audit for a security score` and mark low-confidence. Hygiene is a security claim; never fabricate it from self-reported config.
- **Passing-count fallback.** The formula needs `#passing`. If an explicit passing count isn't labeled, derive the denominator only from the **real** number of checks the parser actually returned: `weighted_total = weighted_failures + (total_checks − #failures)`, where `total_checks = len(normalized_findings)` at runtime. **Never estimate `total_checks` from a hardcoded or "documented" figure** (e.g. an assumed ~50-check total) — that drifts as the scanner changes and produces a misleading score. If neither a real failures-with-total nor a passing count can be established from the parsed report, fall back to **"Not scored"** rather than guessing.
- **Bands:** 90–100 Excellent · 75–89 Healthy · 50–74 Needs Attention · 25–49 At Risk · 0–24 Critical.

This is a security claim — **if there was no scan, do NOT emit a number** ("Not scored — run a CheckMate audit"); mark low-confidence. Output feeds Part A + Phase 7 Loop A.

**3B — Capability Fit (tier-aware framing, plan-independent number).** Build the feature-gap matrix: required features for the use case (from the feature-recommendations tables below, including the use-case capability + FOUNDATIONAL items from the production-readiness grounding below so the score stays graduated) vs. configured, marked ✅ / ❌ / ⚠️. (Production-readiness itself = the scan, summarized, Track A. Part B is the use-case *expansion* layer.) Tag each gap's **Plan Home** via the feature-unlock reference below + the co-loaded pricing reference: *Available now on `current_plan`* / *Unlocks on `<plan>`* / *Enterprise-only*. Compute the **Capability Fit Score**:

```text
weight: CRITICAL = 4, HIGH = 3, MODERATE = 2, LOW = 1
required_weight   = Σ weight(required_feature)
configured_weight = Σ weight(✅ configured feature)   ;  ⚠️ partial counts at 0.5 × weight
fit_score         = round(100 × (configured_weight / required_weight))
```

**Key rule — the number is plan-independent; only the framing is tier-aware.** A missing required feature deducts whether it's a free toggle, a paid unlock, or Enterprise-only. The "available now / unlocks on Plan X / Enterprise-only" distinction lives in the gap matrix's **Plan Home** column and the recommendation, NOT in the score. So the same tenant gets the same Fit score on any plan, but a different remediation path. Missing Enterprise-only required features still deduct — that deduction is exactly what surfaces an Enterprise recommendation.

**Bands:** 80–100 Ready · 60–79 Mostly Ready · 40–59 Partially Ready · 0–39 Not Ready.

**Avoid the all-or-nothing zero.** If the required-feature set for a use case is *only* the advanced/enterprise capabilities, a fresh Free tenant scores 0 every time — low signal, and easily misread as "the tenant is broken." Two rules to keep the score graduated and honest:
1. The required set per use case **must include the foundational capabilities** that a working tenant already has — a configured primary connection, session/cookie config, basic branding, a verified email/social login path — each at LOW weight. These are usually ✅, so a functioning-but-unspecialized tenant lands in a meaningful low-but-nonzero range rather than 0.
2. Use **⚠️ partial (0.5×)** generously where a feature is present but not fully configured (e.g. MFA enabled but not enforced; one social connection of several).
3. When Fit is genuinely 0 or near-0, the output MUST frame it as *"not yet set up for `<use_case>` — here's what to configure,"* never as a defect. A low Fit on Free is expected and is the call-to-action, not a failure grade.

**Also compute `a4aa_fit_score`** (0–1) from use-case + integration signals (formula in the data-integrity rules below) — this value is the gate in Phase 4's A4AA add-on recommendation.

Both scores carry a confidence value:
- 0.9–1.0 — all inputs verified (real scan + live enrichment)
- 0.5–0.8 — some inputs inferred or partially supplied
- < 0.5 — mostly user-supplied / training-knowledge fallback → surface prominently; Hygiene is "Not scored" in this case.

Display format: `Hygiene 82/100 — Healthy (confidence 0.9)` · `Capability Fit 55/100 — Partially Ready (confidence 0.7)`.

> Weights (Hygiene 5/5/2/1/0.5 across GenAI/High/Moderate/Low/Info, and Fit 4/3/2/1) are v1 proposals. Sanity-check the bands against 2–3 known tenants and tune before treating the numbers as authoritative.

#### Feature recommendations by use case (feeds 3B's required-feature set)

**B2B SaaS (Enterprise Customers):**

| Feature | Why It Matters | Signal | Action |
|---|---|---|---|
| Custom Domain | Enterprises see your-domain.com/auth instead of company.us.auth0.com — kills credibility | `custom_domains_present == false` | CRITICAL: Configure immediately |
| Organizations | Isolate each customer's data, branding, users, and roles per tenant | `organizations_configured == false` | CRITICAL: Required for multi-tenant |
| Enterprise Connections (SAML/OIDC) | Let customers SSO with their corporate IdP (Azure AD, Okta, etc.) | `enterprise_connections_count == 0` | CRITICAL: Table-stakes for enterprise deals |
| MFA (WebAuthn/Authenticator App) | Enterprises require it in procurement; reduces account takeover risk | `mfa_configured == false` | HIGH: Enable on all apps |
| Roles & RBAC | Manage permissions per role (admin, editor, viewer, etc.) | `roles_configured == false` | HIGH: Required for teams |
| Log Streaming | Stream logs to SIEM for compliance, audit trails, incident response | `log_streams_present == false` | MODERATE: Required for SOC2/ISO27001 |
| Email Provider + Branding | Send branded password reset/invitation emails | `email_provider_configured == false` | MODERATE: Improves UX |
| Session Management | Track, rotate, and revoke sessions; enforce timeout policies | `session_management_configured == false` | LOW: Nice-to-have unless regulated |

**B2C App (Consumer Users):**

| Feature | Why It Matters | Signal | Action |
|---|---|---|---|
| Social Connections | Let users sign up with Google, GitHub, Facebook, LinkedIn | `social_connections_count < 2` | HIGH: Increases signup conversion |
| Custom Domain | Keep users on-brand during login (e.g., auth.myapp.com) | `custom_domains_present == false` | MODERATE: Important for brand trust |
| Email/Password UX | Passwordless (email link, SMS OTP, or WebAuthn) improves experience | `passwordless_configured == false` | MODERATE: Reduces friction |
| MFA Optional | WebAuthn or Authenticator App for security-conscious users | `mfa_configured == false` | LOW: Optional unless handling sensitive data |
| Bot Detection | Prevent automated signup/login attacks | `bot_detection_configured == false` | LOW: Only if abuse detected |
| Brute Force Protection | Limit failed login attempts | `brute_force_protection_enabled == false` | MODERATE: Security baseline |

**AI-Native Platform (Autonomous Agents):**

| Feature | Why It Matters | Signal | Action |
|---|---|---|---|
| Token Vault | Securely store, refresh, and rotate OAuth tokens for agent integrations (Gmail, Slack, Salesforce, etc.) without secrets in code | `token_vault_enabled == false` | CRITICAL: Non-negotiable for OAuth |
| CIBA (Client Initiated Backchannel Auth) | Enable async user approval for high-stakes agent actions (sending emails, financial transactions, modifying data) | `ciba_configured == false` | CRITICAL if autonomous_actions detected |
| M2M Authentication | Agents authenticate to APIs without user context; manage with client credentials | `m2m_apps_count == 0` | HIGH: Required for agent orchestration |
| Custom Claims | Pass agent context, user role, or action type in JWT claims for downstream APIs | `custom_claims_configured == false` | MODERATE: Optimization for agent logic |
| Log Streaming | Audit trail for all agent actions (who approved, what action, when) | `log_streams_present == false` | MODERATE: Compliance + debugging |

**Fintech / Regulated Verticals:**

| Feature | Why It Matters | Signal | Action |
|---|---|---|---|
| Log Streaming | Required for SOX/HIPAA/PCI audit trails; stream to your SIEM | `log_streams_present == false` | CRITICAL: Compliance blocker |
| Custom Domain | Enterprises + regulators expect branded auth endpoints | `custom_domains_present == false` | CRITICAL: Credibility + compliance |
| Breached Password Detection | Automatically detect compromised credentials from data breaches | `breached_password_detection_enabled == false` | HIGH: Security baseline for fintech |
| MFA Enforcement | Required by compliance frameworks; enforce across all user flows | `mfa_configured == false` | CRITICAL: Non-negotiable |
| Anomaly Detection | Flag suspicious login attempts (unusual location, device, time) | `anomaly_detection_enabled == false` | MODERATE: Fraud prevention |
| Session Management | Enforce session timeout, rotation, and revocation policies | `session_policies_configured == false` | MODERATE: Compliance requirement |
| Organizations (if multi-tenant B2B fintech) | Isolate customer data per tenant; required for fintech multi-tenancy | `organizations_configured == false` | HIGH: Regulatory requirement |

**Feature priority matrix (quick reference):**

| Priority | Vertical | Feature |
|---|---|---|
| CRITICAL | All | Custom Domain |
| CRITICAL | B2B | Organizations |
| CRITICAL | B2B | Enterprise Connections |
| CRITICAL | AI | Token Vault |
| CRITICAL | Regulated | Log Streaming |
| CRITICAL | Regulated | MFA enforcement |
| HIGH | B2B | RBAC |
| HIGH | B2B | MFA enforcement |
| HIGH | AI | CIBA |
| HIGH | Regulated | Breached Password Detection |
| MODERATE | B2B | Email provider + branding |
| MODERATE | B2C | Social Connections |
| MODERATE | AI | M2M Authentication |
| MODERATE | Regulated | Anomaly Detection |
| LOW | B2C | Passwordless |
| LOW | All | Session Management tweaks |

#### Production-readiness grounding

**"Production readiness" = a summarized view of the scan report.** The scan's own check set IS the authoritative production-readiness checklist — there is no separate document to source, and no fixed check total to assume (derive `total_checks = len(normalized_findings)` at runtime; the count drifts as the scanner changes). So **Part A (Security & Config Hygiene) is already the production-readiness assessment**: it reads directly from scan findings and presents them as the prioritized, production-readiness summary.

Two jobs this section does:
1. Map what the scan covers, so Part A can render a clean **production-readiness summary** (not invent its own criteria).
2. Supply the **Part B (Capability Fit)** use-case items + **foundational** items that keep the Fit score graduated (per the scoring model above). Part B is the *use-case expansion* layer, distinct from production-readiness.

Each item below has a **Track** (A = production-readiness via the scan · B = use-case capability) and a default **severity** (CRITICAL/HIGH/MODERATE/LOW/FOUNDATIONAL) for Fit weighting.

**Foundational (Track B, FOUNDATIONAL weight)** — most working tenants already have these. Include these in every use case's required set so a functioning Free tenant doesn't score 0 Fit:
- A configured primary connection (Database or primary Social) — login works
- Reasonable session/cookie configuration
- Basic tenant branding (logo/colors) on the login page
- At least one verified login path (email/password or social)

**Production readiness (Track A — the scan report, summarized).** The scan is the source of truth for these; this is a human-readable map of what it validates, so Part A can summarize it:
- Custom domain configured for production (no `*.auth0.com` in prod)
- MFA available **and enforced** appropriately for the audience
- Attack protection on: brute-force, breached-password detection, suspicious-IP throttling
- Grant-type hygiene: no implicit grant / ROPG where avoidable; short token lifetimes
- No dev/test callback URLs or origins on production apps
- Log streaming to a SIEM / monitoring destination
- Branded email provider (no Auth0-default emails in prod)
- Separate dev / staging / prod tenants
- Secrets not exposed client-side; M2M secrets scoped and rotated
- Unused connections disabled; DB connection security reviewed

> If a scan finding isn't represented above, **the scan wins** — this map is descriptive, not authoritative. Keep it in sync with the scan's check set, not the other way around.

**Use-case capability (Track B — feeds the gap matrix):**
- **B2B SaaS:** Organizations CRITICAL · Enterprise Connections / SSO CRITICAL · RBAC HIGH · per-org branding MODERATE
- **B2C:** social connections breadth HIGH · passwordless/passkeys MODERATE · custom domain HIGH · sign-up/login UX MODERATE
- **AI / agents:** Token Vault (when integrations exist) HIGH · CIBA for high-stakes autonomous actions HIGH · M2M auth MODERATE
- **Regulated vertical:** log streaming CRITICAL · breached-password detection HIGH · MFA enforcement CRITICAL · (compliance add-ons like HIPAA/BAA are **Enterprise-only** — route via the Enterprise-need detection below)

#### Feature unlock matrix (feeds the gap matrix's Plan Home column)

> The co-loaded pricing reference is the source of truth for feature availability — nothing below may contradict it.
> **The Free tier already includes: 1 Custom Domain, 5 Organizations, 1 Enterprise Connection, Self-Service SSO, and SCIM.** Do NOT present those as paid "unlocks" — a customer already has them. The sections below list what *additionally* unlocks or increases on each plan.

**Free → B2C Essentials:** unlocks Pro MFA Factors (WebAuthn, Authenticator App), Email Workflow & Branding, Customize Signup & Login, Log Streaming (1 stream), Social Connections (unlimited), 10 Organizations, Email Provider. Custom Domain is already included on Free — not a new unlock. Unchanged: core auth flow, database connections, application registration.

**Free → B2C Professional:** everything from B2C Essentials, plus Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections, M2M Tokens (5,000 included), and Log Streaming increases to 2 streams.

**Free → B2B Essentials:** unlocks Auth0 Organizations (unlimited), Enterprise Connections (SAML/OIDC) — 3 included, Pro MFA Factors, RBAC (Roles & Permissions), Log Streaming (1 stream), Email Workflow & Branding, Email Provider, Per-Organization Branding. Custom Domain already included on Free. Unchanged: core auth flow, database connections, application registration.

**Free → B2B Professional:** everything from B2B Essentials, plus Enterprise Connections increase to 5 included, Enterprise MFA Factors (included, not add-on), Log Streaming increases to 2 streams, Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections, M2M Tokens (5,000 included), M2M Access for Organizations.

**B2C Essentials → B2C Professional:** unlocks Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections, M2M Tokens (5,000 included). Unchanged: Custom Domain, Pro MFA Factors, Email Workflow & Branding, Log Streaming, Social Connections, Organizations.

**B2B Essentials → B2B Professional:** unlocks 5 Enterprise Connections (vs 3), Enterprise MFA Factors (included, not add-on), Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections, M2M Tokens (5,000 included), M2M Access for Organizations. Unchanged: Custom Domain, Organizations (unlimited), Pro MFA Factors, RBAC, Email Workflow & Branding, Log Streaming.

**Any Plan → Enterprise:** unlocks 99.99% SLA, Priority Support, custom rate limits & token adjustments, Continuous Session Protection, Prioritized Security Log Streams, Private Key JWT, OIDC Back-Channel Logout, custom contract terms, compliance add-ons (HIPAA/BAA, Credential Guard, Bot Detection, etc.).

**A4AA (Auth for AI Agents) Add-On** (50% of base price, confirmed against the fetched pricing page): unlocks Token Vault (unlimited — securely store, refresh, and rotate OAuth tokens for third-party API integrations, no secrets in code, automatic refresh without user re-auth), CIBA in all forms (async approval for high-stakes agent actions; Essentials + A4AA = Token Vault + basic M2M access, Professional + A4AA = Token Vault + CIBA + Enhanced M2M access — full CIBA functionality needs Professional base or higher), and an Enhanced M2M Token Pool (higher limits, more concurrent agent operations).

**Feature comparison by impact severity** (status column reflects current plan availability; verify feature availability against the pricing reference, and any figure against the fetched pricing page, before quoting):
- CRITICAL (Enterprise deal blockers): Custom Domain (brand trust; 1 included on Free, included Essentials+), Organizations (multi-tenant isolation; 5 on Free, 10 on B2C Essentials/Professional, unlimited B2B Essentials+), Enterprise Connections SAML/OIDC (corporate SSO; 1 on Free, 3 on B2B Essentials, 5 on B2B Professional — not available below Enterprise on B2C), Log Streaming (compliance/audit; Essentials+), MFA Enforcement (security + procurement; Pro MFA on Essentials, Enterprise MFA included on B2B Professional).
- HIGH (scaling/compliance): RBAC (B2B Essentials+), Enhanced Password Protection (Professional+), Breached Password Detection (Professional+), Token Vault via A4AA (any plan base), CIBA via A4AA (Professional base recommended for full functionality).
- MODERATE (UX/optimization): Custom Database Connections (Professional+), Security Center (Professional+), M2M Tokens 5,000 included (Professional+), Email Provider + Branding (Essentials+), Per-Organization Branding (B2B Essentials+).
- LOW (nice-to-have): Bot Detection (Enterprise add-on), Credential Guard (Enterprise add-on), Adaptive MFA (Enterprise add-on).

For the underlying per-plan feature tables (Branding, Security & Compliance, Organizations & Access Control, M2M & Developer, AI Agent/A4AA), read the co-loaded pricing reference directly rather than relying on the summary above; for exact base + add-on figures, use the fetched pricing page.

#### Data integrity rules

**Input validation.**
- If the scan report is missing or empty: proceed with enrichment data only, status "Security audit data unavailable; proceeding with use-case analysis," and warn the user that security findings won't be included in recommendations.
- If the scan contains zero findings (all passing): classify "Security Posture: Excellent," confidence High, and focus recommendations on use-case fit + feature optimization.
- If `business_model` is null/unknown: ask directly ("Is your use case B2B, B2C, or Mixed?"); fallback to inferring from domain name + company description at confidence 0.3–0.5.
- If `current_mau` is null or 0: ask the user; fallback to 100 as a placeholder estimate with the note "Forecast assumes 100 MAU as baseline. Update with actual data for accuracy."
- If `monthly_growth_rate` is null or 0: ask the user; fallback to 15% (conservative SaaS estimate) with the note "Forecast assumes 15% monthly growth (typical for SaaS). Adjust based on your actual growth."
- If `current_plan` isn't detected from the tenant: ask the user, default to "Free" if unsure. If `current_plan == "Enterprise"`: skip standard plan-recommendation logic and recommend contacting the Auth0 account team for a custom assessment.

**MAU forecast validation.** If `current_mau > 500,000`: warn "Unusually high MAU. Confirm accuracy," proceed but flag for verification. If `monthly_growth_rate > 100%`: warn about hypergrowth and a very short runway, proceed but emphasize urgency. If `monthly_growth_rate < 0%`: status "Declining user base," focus recommendations on use-case fit rather than growth-driven urgency. Verify each calculation (`month_1_mau ≈ current_mau × (1+growth_rate)`, `month_6_mau` should exceed `current_mau` under positive growth, `months_until_limit` a positive integer) — on failure (NaN, negative months) return a null forecast and prompt the user to re-enter MAU + growth rate.

**Plan recommendation validation.**
- `use_case == "Unknown"` → default to "B2C Essentials" (conservative fallback, confidence 0.3).
- `use_case == "B2B"` but Organizations not detected and `business_model` indicates multi-tenant → override to "B2B Essentials" (minimum for B2B; Organizations is a CRITICAL gap).
- AI-Native/AI-Differentiated with `ai_integrations.length > 0` → surface A4AA as CRITICAL (Token Vault is non-negotiable for OAuth integrations, confidence 0.85+).
- `ai_use_case IN {"AI-Native","AI-Differentiated"}` AND autonomous actions detected AND `current_plan` in {Free, Essentials} → recommend Professional, not Essentials (CIBA requires a Professional base) — do not recommend Essentials + A4AA when autonomous actions are detected. Compare plans by explicit tier rank (Free < Essentials < Professional < Enterprise), never by lexical string comparison.
- CRITICAL gap → minimum unlocking plan: Custom Domain → **already on Free** (1 included, credit-card verification required) — an Immediate Action on every plan, never an upgrade, Organizations → B2B Essentials+, Token Vault → A4AA add-on (any base), CIBA → A4AA + Professional base+, Log Streaming → Essentials+. (Enterprise Connection *count* does not gate the tier — B2B Essentials includes 3 and Professional 5, and both add more via the same add-on; a missing Enterprise-Connection *capability* is covered by the Organizations → B2B Essentials+ row.)
- If the current plan already has the required feature: recommend staying, focus on optimization. Otherwise recommend the minimum plan that unlocks it.

**A4AA Fit Score** = sum of: +0.30 if `ai_use_case IN {"AI-Native", "AI-Differentiated"}`; +0.15 if `ai_integrations.length >= 3`; +0.15 if autonomous actions detected (sending emails, charging customers, etc.); +0.10 if an approval workflow (CIBA) is required; +0.05 if custom claims are needed; +0.10 if `m2m_apps_count > 0`. Max ≈ 1.00. Validation: `a4aa_fit_score >= 0.40` → recommend A4AA as CRITICAL; `0.20–0.39` → HIGH priority; `< 0.20` → optional/not recommended. **`ai_use_case` is the enum from Phase 2 (`AI-Native` | `AI-Differentiated` | `AI-Enhanced` | `AI-Adjacent` | `none`), never a boolean — compare against the string set, never `== true`.** The Native/Differentiated split isn't scored as two tiers because no downstream field distinguishes them (the enrichment call decides it subjectively); a flat +0.30 for either is deliberate. If account-enrichment later emits an explicit `ai_is_core_product` field, a two-tier bonus can be reintroduced off that real field.

**Pricing data consistency.** Fetch `https://auth0.com/pricing.md` once, then take every figure from that single response: the B2C base table, the B2B base table, A4AA add-on pricing, M2M token add-on pricing, Enterprise SSO connection add-on pricing, and Enterprise MFA add-on pricing. Do not mix figures across fetches or interpolate between MAU tiers. If the fetch fails, or a tier reads "Contact us": surface "Contact Auth0 sales for custom quote" and never calculate or estimate an unlisted price. Total Monthly Cost = Base Price + sum(add-ons); if an add-on price is null or "Contact us," output "Base Price + [Add-on name] (contact sales)" rather than assuming a number. If A4AA is recommended: Cost = Base Price + (Base Price × 0.50, rounded up) — cross-check against the A4AA table in the fetched page rather than trusting the arithmetic alone. If M2M tokens exceed the included allowance on Professional: read the add-on cost from the fetched M2M table.

**Output validation — the 4-layer structure.** Before generating output, verify all four layers are present:
- **Layer 1 — What I Did:** 1–2 sentence technical summary; references current plan + use case + key findings.
- **Layer 2 — What This Means For Your App:** business-focused, non-technical language; names specific company products (not generic terms); explains business impact; references the MAU forecast if applicable.
- **Layer 3 — Technical Details:** current plan name + MAU limit; MAU forecast (current + growth rate + months until limit); recommended plan name + MAU limit; feature unlocks (5–8, justified); cost context (feature-focused only, no business assumptions).
- **Layer 4 — What's Next:** clear action items or copy-paste prompts; references specific plan features; if Enterprise, the "Contact sales" path; if already on a plan, the upgrade path or confirmation of fit.

Language consistency: use plan names and feature names exactly as they appear in the pricing reference; use the customer's actual product names (never "your app"/"platform" generically); factual language only — no assumptions like "costs about one deal," no unexplained jargon, no off-brand terminology.

**Confidence scoring:** 0.9–1.0 all data available + verified; 0.7–0.9 most data available, minor gaps filled by user input; 0.5–0.7 use case clear but MAU/growth estimated with user fallback; 0.3–0.5 use case inferred, MAU/growth using defaults; 0.0–0.3 minimal data, mostly defaults, high uncertainty. Output as e.g. "Recommendation Confidence: 0.85 (most data available; growth rate user-provided)."

**Error handling.** Missing `current_plan` or `use_case` does **NOT** halt — the per-field defaults above (`current_plan` → "Free"; `use_case` → "B2C Essentials" at confidence 0.3) apply, and the confidence-scoring system + low-confidence output note keep a defaulted recommendation clearly labeled rather than presented as measured. This is deliberate: `current_plan` failing to detect is usually a CLI scope/permission issue, not user error, and the skill already has a "Free" fallback — blocking the whole health check over one unread field throws away a usable partial answer. If enrichment failed (company data unavailable): proceed with a tech-only assessment (plan fit from scan findings alone) and note "Company intelligence unavailable; recommendation based on technical posture alone." If the forecast calculation fails: output a null forecast, explain, and ask the user to re-enter MAU and growth rate. **HALT only at the true floor** — when no default is defined AND no meaningful partial recommendation is possible (e.g. both the scan and enrichment failed and the user hasn't answered the fallback questions) — which the Graceful-degradation "generic guidance" tier already anticipates. With partial data, output a partial recommendation with available layers and flag what's missing.

### Phase 4 — Tier-adaptive recommendation

1. **MAU forecast** vs. the tenant's own track ceiling (mechanics below) + the co-loaded pricing reference. Never hardcode limits.
2. **Enterprise-need detection FIRST** — run the decision logic below. It can short-circuit plan matching.
3. **Plan matching** keyed on current plan (decision tree below):
   - **Self-service (no Enterprise need):** recommend a specific plan + **exact cost** from the fetched pricing page. Suggest the **A4AA add-on only when `a4aa_fit_score ≥ 0.4` AND there are concrete agent integrations** (`ai_integrations.length > 0` / autonomous-action workflows in the company context) — a high fit score alone, with no integrations, is NOT enough. The `a4aa_fit_score` here is this workflow's own metric, computed from use-case + integration signals (data-integrity rules above), not an external score.
   - **Enterprise need = TRUE:** recommend **"Enterprise — contact sales"** with **NO price**, and emit the Talk-to-Sales block (below).
   - **Enterprise need = SOFT:** recommend the best self-service plan + cost, AND add a "you may also qualify for Enterprise" note + offer the Talk-to-Sales block.
   - **Already on Enterprise:** no upsell — optimization / governance / feature-adoption of what they already own.

#### MAU forecast calculator

**Input data:** `current_mau` (number), `monthly_growth_rate` (percentage, e.g. 15 means 15%/month), `current_plan`.

**Plan tier limits** — the co-loaded pricing reference is the source of truth for these; the values below must match it, and are compared against the tenant's own track (B2C vs B2B), never a flat number:
- Free: 25,000 MAU (identical for B2C and B2B)
- B2C Essentials: up to 50,000 MAU · B2C Professional: up to 30,000 MAU (40k+ not available)
- B2B Essentials: up to 20,000 MAU (30k+ = Contact us) · B2B Professional: up to ~20,000 MAU (beyond = Contact us)
- Enterprise: Custom (contact sales)

**Formula:** `MAU_at_month_N = current_mau × (1 + growth_rate) ^ N`, where `growth_rate` is the monthly growth **as a decimal**, derived once from the collected percentage: `growth_rate = monthly_growth_rate / 100` (15 → 0.15). Keep the two units distinct — the decimal is only for this arithmetic; `monthly_growth_rate` stays the percentage that the urgency bands, the `monthly_growth_rate > 20%` plan-matching thresholds, and every human-facing `%/mo` output read. Never feed the percentage into `(1 + growth_rate)`: passing 15 forecasts 16× monthly growth instead of 1.15×.

Example: current MAU 500, monthly growth 15% → Month 1 ≈575, Month 6 ≈1,157, Month 12 ≈2,675, Month 24 ≈14,313, Month 28 ≈25,033 (reaches the Free tier's 25k limit). Result: "At 15% monthly growth from 500 MAU you reach the Free tier's 25,000-MAU limit in ~28 months — MAU urgency is LOW; choose a plan on feature-fit, not capacity." The decision tree compares `current_mau` against `track_ceiling` — the tenant's published per-track MAU limit (from the pricing reference) — never a flat number. "Approaching" means `current_mau ≥ 80% of track_ceiling`.

**Interactive fallback logic.** A forecast needs BOTH a starting point and a growth rate; collect current MAU first.
- Step 1 (current MAU, required first): prefer `auth0 api get stats/active-users`. If unavailable, prompt the user. If they genuinely can't answer, default to 100 MAU and label the forecast an estimate.
- Step 2 (growth rate, only after MAU is known): prompt with presets (5% conservative, 15% typical SaaS, 30% aggressive, 50%+ hypergrowth). If the user skips or says "I don't know," default to 15% with the note "Forecast assumes 15% monthly growth (typical for SaaS). Adjust based on your actual growth."

**Urgency bands:** <3 months CRITICAL (recommend immediate upgrade + this-month action items); 3–6 months HIGH (recommend upgrade planning now + implementation timeline); 6–12 months MODERATE (time to plan; recommend upgrade before approaching the limit); >12 months LOW (ample runway; focus on use-case fit over timing).

**Edge cases:**
- Current MAU already exceeds the plan limit → status "OVERAGES DETECTED," message naming the current MAU vs. plan limit, action: "Contact Auth0 sales immediately to upgrade or clarify billing."
- Current MAU is 0 or unavailable → prompt the user; if left blank, default to 100 with a note that the forecast assumes 100 MAU.
- Growth rate ≤ 0% → status "FLAT OR DECLINING," no MAU-driven upgrade urgency; consider upgrading based on use-case fit (B2B, compliance, AI agents) instead.
- Current plan is Enterprise → status "CUSTOM PLAN," no hard MAU limit, forecast doesn't apply; direct to the Auth0 account team for scaling guidance.

#### Enterprise-need detection

Decides whether to route a tenant to **"Enterprise — contact sales"** instead of a self-service plan. Runs before plan matching and can short-circuit it. There is no explicit "enterprise need" field in enrichment output — it must be synthesized from enrichment fields + the Phase 3B feature-gap matrix + explicit user asks. The authoritative list of Enterprise-only / "Contact us" capabilities comes from the feature-unlock matrix above + the co-loaded pricing reference — keep this section in sync with those, never contradict them.

**Class A — Explicit** (any one → Enterprise, HIGH confidence). If the user explicitly asks for an Enterprise-only feature, OR a REQUIRED/MISSING feature in the Phase 3B gap matrix is Enterprise-only — from the set: HIPAA/BAA, Bot Detection, Credential Guard, Adaptive MFA, FAPI-certified Security Profile, Tenant Access Control Lists (ACLs), Continuous Session Protection, private deployment, custom rate limits, 99.99% SLA, Home Realm Discovery (B2C), or MAU beyond the published self-service ceiling for the tenant's track — THEN `enterprise_need = TRUE`, `trigger = "explicit feature: <name>"`, `confidence = HIGH`. Class A short-circuits immediately — no need to evaluate Class B.

**Class B — Inferred** (synthesis; each matched signal = 1 point):
- S1 industry ∈ regulated {fintech, banking, payments, healthcare, insurance, government} [regulated]
- S2 employee_count_range > 1000 [scale]
- S3 enterprise-scale valuation/revenue (e.g. latest_valuation > $1B) OR is_public == true [scale]
- S4 login_portal_assessment names 4+ distinct enterprise portals / corporate IdPs [SSO surface]
- S5 a4aa_fit_score > 0.6 [advanced AI]
- S6 enterprise_connections needed or in use ≥ 6 (beyond B2B Professional's 5 included) [SSO volume]
- S7 MAU forecast crosses the tenant's track published ceiling within 12 months [capacity]

`points = S1+S2+S3+S4+S5+S6+S7`. `points >= 2` → `enterprise_need = TRUE`, confidence MEDIUM..HIGH (rises with points), trigger = matched signals. `points == 1` → `enterprise_need = SOFT` → recommend the best self-service plan + a "you may also qualify for Enterprise" note + offer the Talk-to-Sales block. `points == 0` AND Class A not hit → `enterprise_need = FALSE` → self-service plan matching.

**Overrides & guardrails:**
- Already on Enterprise → skip detection entirely, go to the optimize/governance branch (no upsell).
- **Never quote or estimate a price** when `enterprise_need = TRUE` — output "Enterprise — contact sales" only.
- Confidence gating: if enrichment came from a training-knowledge fallback, or enrichment `confidence_score < 0.5`, **downgrade an inferred (Class B) Enterprise call from TRUE to SOFT** and say so in the output. Class A (explicit ask / hard feature requirement) is NOT downgraded.
- When `enterprise_need` is TRUE or SOFT, populate the Talk-to-Sales block with the matched triggers as the "why now."

Output object:

```json
{
  "enterprise_need": "TRUE | SOFT | FALSE",
  "confidence": "HIGH | MEDIUM | LOW",
  "class": "A | B | none",
  "triggers": ["regulated industry", "employees > 1000", "explicit feature: HIPAA/BAA"],
  "enterprise_features_needed": ["HIPAA/BAA", "Adaptive MFA"]
}
```

#### Plan matching logic (plan-agnostic)

Maps current plan + use case + gaps → a recommended plan. Runs AFTER the Enterprise-need gate above.

`<track>` below = **B2B** when `business_model == "B2B"`, else **B2C**. Pick the track from the business model, never from the use case: the AI features (Token Vault, CIBA, M2M Authentication) and the compliance features (Log Streaming, Pro MFA) are identical on both tracks, while the B2B track costs roughly 3–4× more at the same MAU tier and has a *lower* published MAU ceiling. Putting a B2C tenant on B2B over-quotes it for capability it already had and shrinks its headroom.

**Current Plan: FREE**
- B2B business model with a critical gap in Organizations / Enterprise Connections → recommend **B2B Essentials** (multi-tenant B2B needs Organizations and Enterprise Connections). Unlocks: Organizations, Enterprise Connections (3 included), Pro MFA, RBAC, Log Streaming. A Custom Domain gap does not motivate this upgrade — fix it on the current plan.
- B2C business model with a critical gap in Social Connections → recommend **B2C Essentials** (consumer apps need social auth and MFA). Unlocks: Pro MFA, Email Provider, Branding, Social Connections (unlimited). A Custom Domain gap does not motivate this upgrade — fix it on the current plan.
- AI use case, `ai_integrations.length > 0`, `a4aa_fit_score ≥ 0.4`, autonomous actions detected → recommend **`<track>` Professional + A4AA add-on** (Token Vault + CIBA require Professional base or higher + A4AA). Unlocks: Token Vault, CIBA, Enhanced MFA — plus M2M Access for Organizations on the B2B track only.
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4`, but autonomous actions NOT detected (read-only/passive agents) → recommend **`<track>` Essentials + A4AA add-on** (Token Vault sufficient for passive AI workflows). Unlocks: Token Vault (basic), M2M Authentication.
- Compliance vertical detected (fintech, healthcare, education, government) → recommend **`<track>` Essentials**. Unlocks: Log Streaming, MFA enforcement, Email Provider, Branding. **None of these are strictly required for a regulated vertical, but the compliance context makes the full security set worth reviewing** against this tenant's actual requirements — including **Breached Password Detection, which is Professional-only on both tracks** (so Essentials can't deliver it). Do not cite BPD as a reason for the Essentials recommendation; recommend `<track>` Professional only if the tenant confirms they need BPD (a real price increase).
- MIXED use case (both B2B and B2C segments) → recommend **B2B Essentials** — the cheapest plan that includes Organizations, which MIXED's own gap matrix marks CRITICAL. Unlocks: Organizations, Enterprise Connections (3 included), Pro MFA, RBAC, Log Streaming, plus Social Connections for the B2C side. Do **not** collapse MIXED into a B2C plan — a B2C plan can't deliver the Organizations the classification requires.
- No clear signals (UNKNOWN) → default to **B2C Essentials** (conservative entry point for production use). Unlocks: Pro MFA, Email Provider, Social Connections.

**Current Plan: B2C ESSENTIALS**
- `fit_score > 80` AND `current_mau < 80% of track_ceiling` AND no critical gaps → **stay** on B2C Essentials ("Well-fitted for current use case"; monitor MAU growth).
- `current_mau ≥ 80% of track_ceiling` OR (`monthly_growth_rate > 20%` AND months-until-limit < 6) → **stay on B2C Essentials for now; surface a SOFT Enterprise path** (Talk-to-Sales) to plan ahead before hitting the ~50k Essentials ceiling. **Do NOT route to B2C Professional for MAU headroom** — its self-service ceiling (~30k) is *lower* than Essentials' (~50k), so a Professional move shrinks capacity rather than adding it. Reuse the existing SOFT Enterprise-need pattern: offer the Talk-to-Sales block, don't hard-route unless the forecast already crosses ~50k within the growth window. Verify both ceilings against the pricing reference before quoting.
- Critical gap in Custom DB Connections / Enhanced Password Protection / 5k+ M2M tokens/month → upgrade to **B2C Professional** (these require Professional). Unlocks: Enhanced Password Protection, Breached Password Detection, Custom Database Connections, Security Center.
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4` → recommend **B2C Essentials + A4AA add-on** (Token Vault sufficient on an Essentials base). Unlocks: Token Vault, M2M token pool. If autonomous actions are detected, upgrade this to **B2C Professional + A4AA** instead (CIBA requires a Professional base). Unlocks: CIBA, Token Vault, Enhanced MFA.

**Current Plan: B2C PROFESSIONAL**
- `fit_score > 90` AND `current_mau < 80% of track_ceiling` → **stay** ("Optimal configuration for use case"; monitor, no upgrade required).
- `current_mau ≥ 80% of track_ceiling` OR (`monthly_growth_rate > 20%` AND months-until-limit < 3) → recommend **contacting Enterprise sales** ("You've outgrown standard plans"; approaching the Professional MAU ceiling per the pricing reference, custom contract needed).
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4` → recommend **B2C Professional + A4AA add-on** (unlock Token Vault unlimited, CIBA all forms, Enhanced M2M token pool).

**Current Plan: B2B ESSENTIALS**
- `fit_score > 80` AND `current_mau < 80% of track_ceiling` AND no critical gaps → **stay** ("Well-fitted for current use case"; monitor MAU growth).
- `current_mau ≥ 80% of track_ceiling` OR (`monthly_growth_rate > 20%` AND months-until-limit < 6) → upgrade to **B2B Professional** (approaching the Essentials ceiling). Unlocks: 5 Enterprise Connections (vs 3), Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections.
- Critical gap in Custom DB Connections / M2M Access for Organizations / 5k+ M2M tokens/month → upgrade to **B2B Professional**. Unlocks: 5 Enterprise Connections (vs 3), M2M Access for Organizations, Enhanced Password Protection, Breached Password Detection, Security Center, Custom Database Connections. (Needing *more* Enterprise Connections alone isn't a Professional trigger — both tiers add connections via the same add-on.)
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4` → recommend **B2B Essentials + A4AA add-on** (Token Vault sufficient on Essentials base). Unlocks: Token Vault, M2M token pool. If autonomous actions are detected, upgrade this to **B2B Professional + A4AA** instead (CIBA requires Professional base). Unlocks: CIBA, Token Vault, Enhanced MFA.

**Current Plan: B2B PROFESSIONAL**
- `fit_score > 90` AND `current_mau < 80% of track_ceiling` → **stay** ("Optimal configuration for use case"; monitor, no upgrade required).
- `current_mau ≥ 80% of track_ceiling` OR (`monthly_growth_rate > 20%` AND months-until-limit < 3) → recommend **contacting Enterprise sales** ("You've outgrown standard plans"; custom contract needed).
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4` → recommend **B2B Professional + A4AA add-on** (unlock Token Vault unlimited, CIBA all forms, Enhanced M2M token pool).

**Current Plan: ENTERPRISE.** **No upsell.** The customer already owns the top tier — recommendations focus on **optimization, governance, and adopting features they already own**: enforce/raise MFA assurance, enable Continuous Session Protection, Adaptive MFA, Bot Detection / Credential Guard (if licensed), tighten Tenant ACLs, route Prioritized Security Log Streams to their SIEM, adopt the FAPI profile where relevant, and govern Organizations/RBAC at scale. Frame each as "you already have this — here's how to get value from it," never as a purchase. Only the A4AA add-on may be *suggested* (a genuine add, not a tier change).
- `fit_score > 90` AND `custom_sla_active` → **stay** ("Optimized for scale and compliance"; continue with the Auth0 support team, no action needed).
- AI use case, integrations present, `a4aa_fit_score ≥ 0.4` → recommend **adding A4AA to the existing Enterprise contract** ("Contact your Auth0 account team to add A4AA to your contract").

**A4AA detection logic (used above):** IF `ai_use_case IN {"AI-Native", "AI-Differentiated"}` AND `ai_integrations.length > 0` AND `ai_integrations` contain (Gmail, Slack, Salesforce, Stripe, HubSpot, GitHub, Jira, etc.) AND `a4aa_fit_score ≥ 0.4` → A4AA is relevant. (An `AI-Enhanced` tenant does not qualify for a CRITICAL A4AA recommendation — AI isn't its differentiator.) Tier requirement: autonomous actions detected (sending emails, charging customers, modifying records, publishing) → requires `<track>` Professional + A4AA (Token Vault, CIBA async approval, Enhanced M2M token pool); read-only/passive agent flows → `<track>` Essentials + A4AA is sufficient (Token Vault basic, M2M token pool). A4AA applies on either track — the AI feature rows are identical for B2C and B2B, so a B2C tenant with agent integrations gets A4AA on its own track rather than being moved to B2B. A4AA pricing: adds 50% to base price, rounded up to the dollar — take the base and the A4AA figure for the customer's plan and MAU tier from the fetched pricing page, never from this example.

Output shape:

```json
{
  "current_plan": "Free",
  "recommended_plan": "B2B Essentials",
  "a4aa_recommended": true,
  "mau_forecast": {"current_mau": 500, "monthly_growth_rate": 0.15, "months_until_free_limit": 28, "forecast_note": "..."},
  "feature_unlocks": [{"feature": "Organizations", "severity": "CRITICAL", "reason": "..."}],
  "a4aa_features": [{"feature": "Token Vault", "reason": "..."}],
  "estimated_cost": "<base>/month B2B Essentials @ 1k MAU + <a4aa>/month A4AA = <total>/month (all three read from the fetched pricing page)"
}
```

#### Talk-to-Sales block

Emitted only when Enterprise-need detection above returns `TRUE` or `SOFT`. Appears in **both** the in-chat summary and the report (Part B enterprise/soft variant). Goal: make the sales reach-out one copy-paste — this workflow already knows everything sales would ask, so it pre-fills the brief. It **cannot** submit a form or create a CRM lead on the user's behalf — it provides a ready-to-send brief + a contact link.

Template:

```text
**Talk to Sales — prefilled brief**

- Company:             {{customer_name}} ({{company_domain}})
- Use case:            {{detected_use_case}} — {{product_summary_short}}
- Current Auth0 plan:  {{current_plan}}
- MAU + growth:        {{current_mau}} MAU, {{monthly_growth_rate}}%/mo ({{mau_forecast_note}})
- Enterprise features needed: {{enterprise_features_list}}
- Top capability gaps: {{top_gaps_list}}
- Why now (triggers):  {{enterprise_triggers_list}}

Contact Auth0 sales: https://auth0.com/contact-us
{{custom_ae_link_slot}}
```

Token sources: `{{customer_name}}`/`{{company_domain}}` from enrichment/Phase 0; `{{detected_use_case}}`/`{{product_summary_short}}` from Phase 2 + enrichment; `{{current_plan}}` from Phase 0 normalized facts; `{{current_mau}}`/`{{monthly_growth_rate}}`/`{{mau_forecast_note}}` from the Phase 4 MAU forecast; `{{enterprise_features_list}}` from the Enterprise-need output's `enterprise_features_needed`; `{{top_gaps_list}}` from the Phase 3B CRITICAL/HIGH gaps; `{{enterprise_triggers_list}}` from the Enterprise-need output's `triggers`; `{{custom_ae_link_slot}}` from `state/operator.json.ae_link` if set — **omit the line entirely if unset**.

Variants: **TRUE** leads with "Auth0 Enterprise is the right fit — here's a brief to start the conversation." No price anywhere. **SOFT** leads with "You may also qualify for Enterprise; here's a brief if you'd like to explore it," shown *in addition* to the recommended self-service plan + cost.

Rules: **never include a price or estimate** for Enterprise. Keep the brief factual and short — it's for a human to send, not marketing copy. If enrichment confidence is low, add: "Some company details are estimated — correct them before sending."

### Phase 5 — Output (chat always; md/PDF on request)

**Always — in-chat layered summary:**
1. **What I checked** — tenant, current plan, data provenance.
2. **Two headline scores** — `Hygiene NN/100 — <band>` and `Capability Fit NN/100 — <band>` (each with confidence). Hygiene shows "Not scored" if there was no scan.
3. **Top 3–5 findings** across both tracks, each with a one-line **"why this matters for `<Company>`"** in the customer's product terms.
4. **Recommendation line** — self-service plan + cost, or "Enterprise — contact sales," or Enterprise optimization. **Render the next step as a clickable markdown link in chat, never a bare URL:** self-service upgrade → `[Upgrade in the Auth0 Dashboard](https://manage.auth0.com/dashboard/<region>/<tenant>/billing)` (build the URL from the pinned tenant; fall back to `[Auth0 Dashboard](https://manage.auth0.com/)` if region/tenant aren't known); Enterprise / sales → `[Contact Auth0 sales](https://auth0.com/contact-us)` (or the custom AE link from `state/operator.json.ae_link` if set). Documentation references should likewise be `[label](url)` links.
5. **Confidence / provenance note.**

**On request ("generate the report" / "PDF"):** produce three files with one timestamped basename in `~/Documents/` (fallback `~/auth0-healthcheck-reports/`):

```text
auth0_healthcheck_<sanitized_tenant>_<YYYYMMDD_HHMMSS>.{md,html,pdf}
```

Markdown per the markdown report template in `assets/healthcheck/`; HTML per `assets/healthcheck/report-template.html`; PDF via:

```bash
${CLAUDE_SKILL_DIR}/scripts/render_pdf.sh "$HTML_PATH" "$PDF_PATH"
# ${CLAUDE_SKILL_DIR} = absolute path to this skill folder (auto-set by Claude Code).
# Other agents: substitute the absolute path to wherever the skill folder was extracted.
```

If the renderer exits non-zero, surface its stderr — the md + html are already saved (don't fail the run).

**Fusion lint before saving (must be empty):**

```bash
grep -nE '\{\{|the customer[^A-Za-z]|enterprise clients[^A-Za-z]|the affected apps' "$MD_PATH" "$HTML_PATH"
```

Every gap/opportunity must name a real product, app, or segment. No `{{placeholder}}` may survive. Prices appear only for self-service recommendations — never for Enterprise.

### Phase 6 — Walk the user through it

Render the chat summary, give the file paths, and offer Phase 7 for the current-plan-achievable items.

### Phase 7 — Optional gated apply (opt-in)

Enter only on explicit opt-in. Use the co-loaded remediation reference for command shapes, fix-dependency ordering, and the never-without-confirmation list. Per item: build → **show diff** (current vs. proposed via `auth0 api get`) → print exact command(s) → `AskUserQuestion` (Implement now / Queue / Skip) → execute → **verify by re-fetch** → never destructive retry.

**MFA-lockout safety rule (health-check-specific — inline here because it's easy to get wrong):** enabling an MFA factor is not the same as enforcing MFA, and you must not enforce until a factor can actually deliver. Before enforcing MFA: verify at least one enabled factor can deliver (SMS provider configured / email domain verified / WebAuthn available). Recommend a phishing-resistant factor (WebAuthn) as the safe default. Keep "enable factor" and "enforce policy" as distinct, clearly-labeled steps — never collapse them into one command. For every other command shape, the fix-dependency ordering, and the full never-without-confirmation list, use the co-loaded remediation reference.

- **Loop A** — "Immediate Actions — Available Today" items.
- **Gate** — ask whether they've upgraded. Not yet → queue `pending_upgrade` + give the clickable billing link `[Upgrade in the Auth0 Dashboard](https://manage.auth0.com/dashboard/<region>/<tenant>/billing)`. **If the recommendation was "Enterprise — contact sales," there is no self-service gate** → surface the Talk-to-Sales block and queue plan-gated items as `pending_enterprise`.
- **Loop B** — "After Upgrading" items (only once upgraded).

Close out: update state, append to `history.jsonl`, print applied/queued/skipped counts, suggest re-running the health check to confirm fixes.

State dir: `~/.auth0-checkmate/state/` (`operator.json`, `setup.json` (cache; secrets excluded), `enrichment_<domain>_<ts>.json`, `queue.json`, `history.jsonl`). Treat `setup.json` as a cache; re-validate each run.

---

## Graceful degradation & confidence

- **No scan run:** offer to run the co-loaded audit workflow; if declined / no Auth0 access, ask the tenant facts in plain language ("Do users log in at your own domain like `login.yourco.com`?", "Is MFA turned on?", "How many enterprise SSO connections?") with an "I don't know" option that defaults to *not configured*; mark **low-confidence**. **Hygiene is NOT scored** in this mode; add to the output: *"Based on user-supplied configuration; this is not a security audit. For scored security findings, run a CheckMate-style audit."*
- **Missing / low-confidence company context:** run a technical-only assessment; ask `business_model` if null; add *"Company context unavailable; recommendation based on technical posture alone."* If the context came from a training-knowledge fallback (low confidence), treat company specifics as approximate, **downgrade an inferred (Class B) Enterprise recommendation to SOFT**, and add *"Company details are drawn from general knowledge and may be out of date; verify specifics before sharing externally."*
- Every score and the recommendation report their own confidence (0–1) and source; the report footer and chat both carry the confidence note.

## Pitfalls to remember

- The co-loaded pricing reference is the only source for MAU limits and feature availability, and the fetched `https://auth0.com/pricing.md` the only source for prices — never hardcode either, never let anything in this reference contradict them.
- `tenant_domain` is always the CLI value, never derived from the company context or the company domain.
- Enabling an MFA factor ≠ enforcing it — verify a factor can deliver before enforcing (see the MFA-lockout safety rule above).
- Never quote or estimate an Enterprise price.
- Don't reinvent the tenant scan — run the co-loaded audit workflow (it also supplies the company context).
