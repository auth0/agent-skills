# Advanced Organization Capabilities

Beyond the core flow (provision → login → membership → RBAC → enforce), Auth0 Organizations expose
several advanced capabilities that real B2B SaaS apps reach for. Each is optional; pull them in as
the product needs them. All org operations use the Management API client
(`managementClient.organizations.*`) or the `auth0` CLI.

> Several of these (M2M for Organizations, some SCIM/self-service features) require a **B2B
> Professional / Enterprise** plan. Check current plan availability before relying on them.

---

## Self-service enterprise SSO (hosted setup)

Let a customer's admin connect their own IdP without you building the config UI or touching your
tenant. Auth0's **Self-Service Enterprise Configuration** provides a hosted assistant; on completion
it creates the Enterprise connection and enables it on the org. This is the recommended path for
customer-configured SSO.

Full walkthrough (self-service profile + SSO access ticket, with `managementClient.selfServiceProfiles.*`)
is in [Architecture Patterns → Option B](architecture.md#option-b-recommended-auth0-self-service-enterprise-configuration--hosted-sso-setup).
Quick shape:

```ts
// 1. Create a profile once (which IdP strategies + attributes the assistant offers)
const { data: profile } = await managementClient.selfServiceProfiles.create({ /* … */ });
// 2. Per customer, mint a short-lived ticket bound to their org, hand them the URL
const { data: ticket } = await managementClient.selfServiceProfiles.createSsoTicket(
  { id: profile.id },
  { enabled_organizations: [{ organization_id: orgId, assign_membership_on_login: true }],
    domain_aliases_config: { domain_verification: "required" } }
);
```

---

## M2M (Client Credentials) access scoped per organization

When a customer's **backend/service** calls your API on its own behalf (no user), use the Client
Credentials flow — but **scope it to an organization** so a machine token can only touch one
customer's data. Same `org_id` enforcement rule as user tokens applies.

Two pieces:

1. **Application's org behavior** — on the M2M application's client grant for your API, set
   `organization_usage`:
   - `deny` (default) — app must not use orgs
   - `allow` — app may pass an org
   - `require` — app must pass an org

   And `allow_any_organization`:
   - `false` (default) — app can only access orgs it's been **explicitly** associated with
   - `true` — app can access **any** org without association. **Trusted internal apps only** — this
     is the dangerous knob; never enable it for partner/customer apps.

2. **Associate the grant with each org** the app may access:

```bash
# Associate an application's client grant with an organization
auth0 api post "organizations/<org-id>/client-grants" \
  --data '{"grant_id":"<client-grant-id>"}'

# Revoke that association
auth0 api delete "organizations/<org-id>/client-grants/<grant-id>"
```

Then the machine requests an org-scoped token by passing `organization` to the token endpoint:

```bash
curl -X POST "https://<tenant>/oauth/token" \
  -d grant_type=client_credentials \
  -d client_id=<m2m-client-id> -d client_secret=<secret> \
  -d audience="https://api.acme.com" \
  -d organization="<org-id>"
# → access token carries org_id; your API enforces it exactly like a user token
```

**Token shaping differs from user login.** The **post-login** Action (the skill's Step 4) does
**not** run for client-credentials. To add custom claims to M2M org tokens, use a
**credentials-exchange** trigger Action instead. RBAC roles are a user concept; for machine tokens
authorize on **scopes/permissions** from the client grant.

### Multi-org M2M: prefer one API (audience) per org

If a single client legitimately needs M2M access to **several** orgs, Auth0 recommends a
**separate API (audience) per organization** rather than one shared API. Then `organization` /
`audience` are first-class enforced parameters, client grants restrict cleanly per org, and refresh
tokens bind to the right audience. A shared API forces a more fragile custom mechanism to decide
which org a machine token is for.

---

## SCIM directory sync (automatic provisioning/deprovisioning)

Enterprise customers expect users created/disabled in their IdP (Okta, Entra) to sync to your app
automatically. SCIM provisioning attaches to an enterprise connection and can be set up as part of
the self-service flow (`provisioning_config.scopes` on the SSO ticket — `get:users`, `post:users`,
`put:users`, `delete:users`, group scopes). Use SCIM instead of (or alongside) JIT when the customer
wants central deprovisioning, not just auto-join on first login.

---

## Per-organization branding

Each org can carry its own login-page branding so a customer sees their logo/colors on Universal
Login. Set at create time or via update:

```bash
auth0 orgs create --name "customer-a" --display "Customer A" \
  --logo "https://customer-a.com/logo.png" --accent "#FF6600" --background "#FFFFFF" --json
```

Branding is keyed off the `organization` parameter at login — another reason to resolve the org
*before* redirecting to `/authorize` (subdomain → org id).

---

## Organization metadata (feature/plan gating, app state)

`organization.metadata` holds up to 25 string key/value pairs — handy for app-level state that
should travel with the tenant rather than living only in your DB:

- **Plan/feature gating**: `metadata.plan = "free" | "pro" | "enterprise"`, then gate "Connect SSO"
  or seat limits in your app and in Actions.
- **Domain-verification token** (the reference app stores the DNS-TXT challenge here).
- Read it in a post-login Action via `event.organization.metadata` to shape tokens or enforce policy.

```ts
await managementClient.organizations.update({ id: orgId }, { metadata: { plan: "enterprise" } });
```

Keep secrets out of metadata — it's not encrypted and can surface in Actions/logs.

---

## Per-organization token quota (abuse protection)

Organizations support a `token_quota` for client-credentials issuance (per-hour / per-day caps,
enforced or notify-only). Use it to cap a single customer's machine-token volume so one org can't
exhaust tenant-wide limits. Configure on the organization object via the Management API.

---

## Observability & sync (log streams, event streams)

Log streams and event streams are **tenant-wide**, not org-scoped — they're generic Auth0
capabilities rather than B2B primitives. Two angles are genuinely useful for a multi-tenant app:

- **Per-customer audit** — tenant logs carry org context: the `seccft` (client-credentials) log
  includes `organization_id` / `organization_name`, and login/token events occur in org context.
  Point a **log stream** (Datadog, Splunk, EventBridge, HTTP, …) at your SIEM and you can attribute
  activity — including machine-token usage — per customer.
- **Sync membership → billing/CRM** — **event streams** emit real-time events (`user.created`,
  `user.updated`, `user.deleted`) you can fan out to a billing service or CRM to keep per-seat
  billing and customer records in step with org membership changes.

```bash
# Example: stream new-user events to an Action for downstream processing
auth0 event-streams create --name billing-sync --type action \
  --subscriptions "user.created,user.updated,user.deleted" \
  --configuration '{"action_id":"<action-id>"}'
```

This is intentionally a pointer, not a full guide — for stream types, sinks, filters, and PII
handling, see the `auth0-cli` skill and the Auth0 log-streams / events docs.

## When to reach for each

| Need | Capability |
|------|-----------|
| Customer configures their own SSO, no UI work for you | Self-service enterprise SSO (hosted) |
| Customer's backend calls your API per-tenant | M2M scoped per org + `credentials-exchange` Action |
| Central user provisioning/deprovisioning from the customer's IdP | SCIM directory sync |
| Customer sees their brand on the login page | Per-org branding |
| Gate features/seats by plan; carry tenant state | Org metadata |
| Cap a noisy customer's machine-token volume | Per-org token quota |
| Audit activity per customer; sync membership to billing/CRM | Log streams / event streams |

## References

- [M2M access for Organizations](https://auth0.com/docs/manage-users/organizations/organizations-for-m2m-applications)
- [Self-Service Enterprise Configuration](https://auth0.com/docs/authenticate/enterprise-connections/self-service-enterprise-configuration)
- [Client grant attributes](https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants)
- [B2B authorization (token strategies)](https://auth0.com/docs/get-started/architecture-scenarios/business-to-business/authorization)
- [Using tokens with Organizations](https://auth0.com/docs/manage-users/organizations/using-tokens)
- [Customize email templates](https://auth0.com/docs/customize/email/email-templates/customize-email-templates)
- [Log streams](https://auth0.com/docs/customize/log-streams) · [Event streams](https://auth0.com/docs/customize/events)
