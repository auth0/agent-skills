# Locked report skeleton (Auth0 Platform Development Review)

This is the structural contract the audit workflow reference (Phase 5, report generation) follows for the markdown brief. The HTML/PDF render uses the parallel template at [report-template.html](report-template.html) — same data, same sections, different presentation. Replace every placeholder token with values from the CheckMate report, the lightweight company context (Phase 3), and tenant facts. Visual design models the "Auth0 Platform Development Review" reference layout (orange brand accent, severity-coded chips, four-section structure).

Source-of-truth reminders (see the audit workflow reference, Phase 5) — placeholder → source:
- tenant_domain → `state/setup.json.tenant_domain` (from `auth0 tenants list --json`); never from the company context
- customer_name, product_*, business_model, ai_use_case, integrations_* → the company context (Phase 3; sanitized — no fit scores, no firmographics)
- recommended_plan, a4aa_yes_no → DERIVED in Phase 4 from the use case + the findings + the co-loaded pricing reference (never a company score)
- reviewer_name, reviewer_org → `state/operator.json.reviewer_name` / `.reviewer_org`
- plan_tag, tier → `auth0 api get tenants/settings` (fallback "Free Plan")
- apps_count, apps_* → `auth0 apps list --json`
- login_activity → derived from `auth0 logs list --number 50`
- custom_domains_present, log_streams_present, mfa_configured, etc. → tenant facts from Phase 4.4
- findings_*_count, findings_*_examples → the CheckMate report (a flat array of finding objects), grouped by severity

---

# Auth0 Platform Development Review

{{prepared_by_line}}  <!-- the "Prepared by <org>" line if reviewer_org is non-empty; OMIT this line entirely otherwise -->

> **{{plan_tag}}** · {{customer_name}} · {{tenant_domain}} · {{review_date_long}}

| | |
|---|---|
| **Prepared by** | {{reviewer_name}} |
| **Date of Review** | {{review_date_long}} |
| **Customer Account** | {{customer_name}} ({{tenant_domain}}) |
| **Current Auth0 Tier** | {{tier}} |
| **Use Case Diagnosis** | {{business_model}} — {{product_summary_short}} |
| **Recommended Plan** | {{recommended_plan}} · Auth for AI Agents: {{a4aa_yes_no}} |

---

## 1. ACCOUNT HEALTH

| METRIC | STATUS |
|---|---|
| **Applications Registered** | {{apps_count}} |
| **Login Activity** | {{login_activity}} |
| **Security Findings** | **{{findings_high_count}} High** &nbsp;&nbsp; **{{findings_moderate_count}} Moderate** &nbsp;&nbsp; **{{findings_low_count}} Low / Info** &nbsp;&nbsp; **{{findings_passing_count}} Passing** |

> **The Branding Gap**
> Authentication is served from the default Auth0 domain (`{{tenant_domain}}`). {{customer_user_type_short}} accessing {{product_1}} and {{product_2}} are redirected off-brand during login — undermining trust at a critical moment in the user journey.
>
> *(Include only if `custom_domains` is empty.)*

> **The Security Gap**
> No MFA is configured on any application. For {{customer_user_type_short}} handling {{data_sensitivity_descriptor}}, this is a material risk and a common enterprise procurement blocker.
>
> *(Include only if MFA is disabled per tenant facts.)*

> **The Production Readiness Gap**
> Development URLs (`{{dev_url_example}}`) remain active in production configurations across callbacks, web origins, and logout URLs for {{app_with_dev_urls}}.
>
> *(Include only if CheckMate flagged dev URLs / implicit grant types — name offending app from `apps_list`.)*

> **The Compliance Gap** *(optional — include when log streams empty AND regulated industry / EU tenant)*
> No log streaming is configured. {{customer_name}} operates in {{regulated_context}} and requires {{compliance_framework}} audit trails — currently limited to Auth0's default retention window.

> **The Observability Gap** *(generic version when Compliance Gap doesn't apply)*
> No log streaming is configured. Without it, diagnosing auth issues or security incidents is limited to Auth0's default retention window.

---

## 2. EXECUTIVE SUMMARY

{{customer_name}} has built a structured Auth0 environment supporting {{products_inline_list}} — with {{apps_count}} registered applications and {{login_activity_descriptor}} login activity.

The current challenge is graduating from a working setup to a **production-grade, enterprise-ready** authentication platform. A CheckMate security audit surfaced **{{findings_high_count}} High** and **{{findings_moderate_count}} Moderate** configuration gaps across security, branding, and observability. The core architecture is solid — these gaps are directly addressable with the right plan.

### Configuration Posture at a Glance

| SEVERITY | COUNT | KEY EXAMPLES |
|---|---|---|
| **High** | {{findings_high_count}} | {{findings_high_examples}} |
| **Moderate** | {{findings_moderate_count}} | {{findings_moderate_examples}} |
| **Low / Info** | {{findings_low_count}} | {{findings_low_examples}} |
| **Passing** | {{findings_passing_count}} of {{findings_total_count}} | {{findings_passing_examples}} |

Examples are dot-separated finding titles (top 3-5 per row), e.g. "No custom domain · Localhost URLs in production · Implicit grant types on 4 apps".

---

## 3. STRATEGIC OPPORTUNITIES & ACTION PLAN

| FEATURE AREA | THE ENTERPRISE CHALLENGE | THE SOLUTION | STRATEGIC IMPACT |
|---|---|---|---|
| **Brand Trust & UX** | Enterprise clients authenticate through `{{tenant_domain}}` — a generic Auth0 domain — breaking the {{customer_name}} brand at login and invitation acceptance. | **Custom Domains** | Keep enterprise users entirely within your brand. Critical for sales credibility and user trust. |
| **Per-Organization Management** | {{product_1}} and {{product_2}} serve distinct enterprise accounts with no way to isolate branding, members, or access per customer on the current plan. | **Auth0 Organizations** | Onboard enterprise clients cleanly with per-org branding, member management, and connection settings — scales with your go-to-market. |
| **Enterprise SSO** | {{customer_name}}'s enterprise clients — {{customer_user_segments}} — already have corporate identity providers (Azure AD, Okta, Google Workspace). Currently they must create separate credentials to access {{product_suite_short}}, adding friction that blocks enterprise procurement. | **Enterprise Connections (SAML / OIDC)** | Let enterprise clients log in with their existing corporate credentials. Removes a common procurement blocker and eliminates the need for a separate set of credentials for your platform. |
| **Account Security** | No MFA is configured on any application. Enterprise procurement increasingly requires it as a baseline, especially for platforms handling {{data_sensitivity_descriptor}}. | **MFA (WebAuthn / Authenticator App)** | Reduces account takeover risk significantly. Addresses common enterprise procurement requirements{{gdpr_clause}}. |
| **Observability** | No log streaming is configured. Without it, diagnosing auth issues or security incidents is limited to Auth0's default retention window. | **Log Streaming** | Enables SIEM integration, enterprise audit trails, and the observability required for compliance and incident response. |
| **AI Agent Security** *(only if `ai_use_case` ∈ AI-Native/AI-Differentiated)* | {{ai_product_1}} and {{ai_product_2}} use AI to interact with third-party {{integration_domain}} services. Managing OAuth tokens for these integrations manually creates security risk and developer overhead. | **Token Vault (A4AA)** | Securely store and rotate OAuth tokens for AI agent integrations — no re-authentication required, no secrets in code. |
| **Human-in-the-Loop AI** *(only if autonomous-action workflows in enrichment)* | High-stakes {{ai_action_domain}} actions ({{ai_action_example_1}}, {{ai_action_example_2}}) may require explicit user approval before an AI agent executes them. | **CIBA (A4AA)** | Enable async human approval for sensitive AI-driven actions from any device, without disrupting the user experience. |

Include only the rows whose triggers are met. Rewrite the cell text to reference the actual customer's products / segments / data — never leave generic placeholders in the rendered output.

---

## 4. RECOMMENDED ROADMAP & NEXT STEPS

### Recommended Plan: **{{recommended_plan}}**{{a4aa_addon_suffix}}

{{plan_recommendation_paragraph}}

> Example: "**B2B Essentials** unlocks Custom Domains, Organizations, Enterprise Connections, and enhanced MFA — the four highest-impact changes for {{customer_name}}'s enterprise go-to-market.
>
> **A4AA Add-on** directly addresses the identity challenges in AI-assisted {{ai_workflow_descriptor}} workflows via Token Vault and CIBA."

### Immediate Actions — Available Today (Free)

> Numbered list of CheckMate findings actionable on the **current** plan. Triage rule: if the fix can be applied with the current tier's feature set per the feature→plan matrix in the co-loaded pricing reference (source of truth — read it, don't guess), it goes here. Each item must name the affected app/connection. These items feed the remediation reference's Loop A.

1. {{immediate_action_1}}
2. {{immediate_action_2}}
3. {{immediate_action_3}}
<!-- continue numbering for each remaining action -->

> Illustrative shape (dummy data — replace every name with the actual tenant's apps):
> 1. Remove `http://localhost:3000` from web origins, callbacks, and logout URLs in `Customer Portal Web`
> 2. Disable the implicit grant type on `Default App, Admin Console Web, Customer Portal Web, Mobile App` — migrate to Authorization Code + PKCE
> 3. Enable rotating refresh tokens on `Default App, Admin Console Web`
> 4. Configure a Custom Domain — included free (1, credit-card verification required); keeps logins on-brand without an upgrade

### After Upgrading

> Numbered list of fixes requiring the recommended plan. Each item describes the outcome, not the dashboard click path. These items feed the remediation reference's Loop B (gated on user confirming the upgrade).

1. {{after_upgrade_action_1}}
2. {{after_upgrade_action_2}}
<!-- continue numbering for each remaining action -->

> Example items from the reference sample (Custom Domains is NOT here — it's free; see Immediate Actions):
> 1. Set up Auth0 Organizations + Enterprise Connections (SAML / OIDC) for your first enterprise clients (Essentials)
> 2. Enable WebAuthn or Authenticator App MFA across enterprise user flows (Essentials — Pro MFA Factors)
> 3. Configure an email provider and branded email templates (Essentials — Email Workflow)
> 4. Stream logs to your observability platform (Essentials — 1 log stream)
> 5. Switch Breached Password Detection to blocking + Enhanced Password Protection (Professional)
> 6. Implement Token Vault / CIBA for AI agent OAuth token management (A4AA add-on)

### Key Documentation

| | |
|---|---|
| [B2B Best Practices](https://auth0.com/docs/manage-users/organizations) | [Auth0 Organizations](https://auth0.com/docs/manage-users/organizations) |
| [Custom Domains](https://auth0.com/docs/customize/custom-domains) | [Enterprise Connections](https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers) |
| [Configure WebAuthn as MFA](https://auth0.com/docs/secure/multi-factor-authentication/multi-factor-authentication-factors/webauthn) | [Log Streaming](https://auth0.com/docs/customize/log-streams) |
| [Token Vault (A4AA)](https://auth0.com/ai/docs/get-tokens-for-tools) | [CIBA (A4AA)](https://auth0.com/ai/docs/asynchronous-authorization) |
| [Authorization Code + PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce) | |

> Include only the rows whose corresponding Section 3 row is included.

---

*Confidential · Auth0 tenant configuration review for {{customer_name}} · {{review_month_year}}*
