<!--
  Locked markdown report template for the plan-aware health check (feature-healthcheck reference).
  Phase 5 (report generation) substitutes every placeholder token with the same data feeding report-template.html.
  Two sections: Part A Security & Config Hygiene (universal) + Part B Capability Fit (tier-aware).
  Omit any conditional block the data does not support. No placeholder token may survive to output.
-->

# Auth0 Tenant Health Check — {{customer_name}}

{{prepared_by_line}}  <!-- the "Prepared by <org>" line if reviewer_org is non-empty; else omit this line -->

**{{plan_tag}}** · {{customer_name}} · {{tenant_domain}} · {{review_date_long}}

|  |  |
|---|---|
| **Security & Config Hygiene** | **{{hygiene_score}}** — {{hygiene_band}} (confidence {{hygiene_confidence}}) |
| **Capability Fit** | **{{fit_score}}** — {{fit_band}} (confidence {{fit_confidence}}) |

| Field | Value |
|---|---|
| Prepared by | {{reviewer_name}} |
| Date of Review | {{review_date_long}} |
| Customer Account | {{customer_name}} ({{tenant_domain}}) |
| Current Auth0 Plan | {{current_plan}} |
| Use Case Diagnosis | {{business_model}} — {{product_summary_short}} |

---

## Part A — Security & Config Hygiene

*Applies on every plan, Free → Enterprise. Score: {{hygiene_score}} — {{hygiene_band}}.*
<!-- If no CheckMate scan: replace score with "Not scored — run a CheckMate audit for a security score" and keep the disclaimer in the confidence_note. -->

### Account Health

| Metric | Status |
|---|---|
| Applications Registered | {{apps_count}} |
| Login Activity | {{login_activity}} |
| Security Findings | {{findings_critical_count}} Critical · {{findings_warning_count}} Warning · {{findings_info_count}} Info · {{findings_passing_count}} Passing |

{{gaps_markdown}}  <!-- per supported gap: a bold gap name, an em-dash, then a one-line body (each names a real product/app/segment) -->

### Configuration Posture at a Glance

| Severity | Count | Key Examples |
|---|---|---|
| Critical | {{findings_critical_count}} | {{findings_critical_examples}} |
| Warning | {{findings_warning_count}} | {{findings_warning_examples}} |
| Info | {{findings_info_count}} | {{findings_info_examples}} |
| Passing | {{findings_passing_count}} | {{findings_passing_examples}} |

### Immediate Actions — Available Today on {{current_plan}}

{{immediate_actions_markdown}}  <!-- numbered list; each names affected apps/connections explicitly -->

---

## Part B — Capability Fit

*For your use case ({{detected_use_case}}) on {{current_plan}}. Score: {{fit_score}} — {{fit_band}}.*

### Feature-Gap Matrix

| Feature | Status | Plan Home | Why it matters |
|---|---|---|---|
{{gap_matrix_rows}}  <!-- per feature: a table row of feature name, ✅/❌/⚠️ status, Plan Home (Available now / Unlocks on a plan / Enterprise-only), and a personalized "why it matters" -->

### Strategic Opportunities

| Feature Area | The Challenge | The Solution | Strategic Impact |
|---|---|---|---|
{{opportunities_rows}}  <!-- every Challenge cell names a specific product/segment from enrichment; omit a row that can't be made specific -->

### Plan Guidance

<!-- Render exactly ONE variant in place of the plan_guidance_block placeholder below:

  SELF-SERVICE: a bold "Recommended Plan: <plan> — <exact cost>" line (append the A4AA add-on
  suffix only when gated), a personalized rationale paragraph, then an "After Upgrading" list.

  ENTERPRISE (no price): a bold "Enterprise — contact sales" line, the enterprise rationale plus
  a "Triggered by: <triggers>" note, the Talk-to-Sales brief, and the contact link
  https://auth0.com/contact-us (plus the custom AE link if one is set).

  ALREADY-ENTERPRISE (optimize; no upsell): a bold "You're on Enterprise — optimize what you
  already own" line, then the optimization actions list.
-->
{{plan_guidance_block}}

### Key Documentation

{{docs_markdown}}  <!-- 2-column list of doc links matched to the opportunities above -->

---

*{{confidence_note}}*
*Confidential · Auth0 tenant health check for {{customer_name}} · {{review_month_year}}*
