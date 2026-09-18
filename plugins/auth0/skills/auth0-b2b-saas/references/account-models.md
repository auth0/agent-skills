# B2B SaaS Account Models: Market Patterns & Auth0 Architecture Choices

This guide compares how leading SaaS companies (Vercel, GitHub, Linear, Slack, Notion, Stripe, Figma, Railway) structure user and team accounts, then maps those patterns to Auth0 Organizations, connections, and role models.

**Goal**: Help you decide which account shape best fits your B2B app — and understand how Auth0 primitives enforce that shape.

---

## The Account-Model Landscape

### Cross-Org Member (single identity, many orgs)

**Companies**: Vercel, GitHub, Linear, Figma, Railway

One user identity (email) belongs to many organizations (teams/workspaces). The user switches context via a UI selector.

```
User alice@example.com
├── Org: Acme Inc (admin)
├── Org: Beta SaaS (member)
└── Org: Open Source Project (viewer)
```

**Auth0 equivalent**:
- One Auth0 user per person (`user_id` from the email connection)
- Multiple organizations, each with the user assigned a role
- `org_id` in the access token determines which org the request acts on
- Context switch: user logs in, then selects org from a dropdown, or lands on a default org

**When to use**: Team/workspace-based collaboration, role-bearing memberships, org-scoped permissions.

---

### Isolated Workspace (Communication Platforms)

**Companies**: Slack, Notion (per-workspace subscription model)

The workspace is the primary billing and isolation boundary. Users are workspace-scoped members, and a user in one workspace has no automatic access to another (they're separate subscriptions).

```
alice@example.com in Workspace "Acme Slack"
bob@example.com in Workspace "Acme Slack" (different org, doesn't see bob elsewhere)
bob@example.com also in Workspace "Side Project Slack" (separate subscription, separate context)
```

**Auth0 equivalent**:
- One Auth0 user, but `org_id` scopes access tightly
- No "cross-org visibility" — each org is a separate billing/data silo
- Optional: per-workspace custom domains or subdomains to reinforce isolation

**When to use**: When each organization is truly isolated (no shared resources, no cross-org queries). Communication/collaboration tools often fit this.

---

### Company Tenant (self-serve org + team upsell — B2B default)

**Companies**: Vercel, GitHub (free tier), Linear (free tier)

Users start with a personal workspace/account (free, single user). Upgrading to a paid tier enables team creation and invitations. Personal workspace billing is separate from team billing.

```
alice@example.com
├── Personal workspace "alice's projects" (free, default)
└── [After upgrade]
    └── Org: "Acme Corp" (Pro team, per-seat billing)
```

**Auth0 equivalent**:
- One user in a special "personal" org (or with `org_id: null` for app-default space)
- Personal org has no members (only the user)
- Team creation during onboarding creates a separate org with the user as admin
- Roles differ: personal space has minimal roles; teams have admin/member/viewer hierarchy
- Token includes `org_id` pointing to personal org (or omits it for "no org" logins)

**When to use**: Freemium SaaS, where you want a per-user free tier and per-seat paid teams. Also matches the Auth0 B2B SaaS starter's onboarding pattern.

---

### Project Platform (Multi-tenant Supply Chain)

**Companies**: Stripe (Connect), Vercel (projects under a team), Atlassian (sites/products), Shopify (stores)

Users create apps, projects, stores, or integrations; each has its own namespace and team. A user can be an owner/admin of multiple and a member of others.

```
alice@example.com
├── App "Acme Dashboard" (owner)
│   └── Members: alice, bob
├── App "Analytics Service" (owner)
└── App "Client Portal" (member, invited by bob)
```

**Auth0 equivalent**:
- One Auth0 user
- Each app/project maps to an org with role-bearing membership
- Token carries `org_id` pointing to the active app context
- App admin can configure SSO, roles, permissions per app

**When to use**: When your users are developers/builders shipping multiple services/apps. Close to **Cross-Org Member**, but with a "create an app" onboarding step rather than "create a team."

---

## Account Models: Detailed Comparison

### Sign-Up & Onboarding Flow

| Model | Signup Path | First Org | Membership | Default Role |
|-------|------|----------|-----------|---|
| **GitHub** | Email → password → personal account auto-created | Personal (free) | Invite to Org | member in org |
| **Vercel** | Email → Hobby workspace auto-created | Hobby (free) | Invite or admin creates | member |
| **Linear** | Email → workspace auto-created | Free workspace (2 projects) | Invite or JIT | member |
| **Slack** | Email → create workspace OR join via invite | Workspace | Invite + email domain matching | user |
| **Notion** | Email → workspace auto-created | Free workspace | Invite only | editor |
| **Figma** | Email → drafts (personal) | Personal drafts | Invite to team | member |
| **Railway** | Email → personal project | Personal project | Invite to team | developer |
| **Stripe** | Email → account; can create/join multiple | Account | Invite team members | member |

**Pattern**: Almost all auto-create a personal/default space on signup; paid/enterprise features unlock teams and invitations.

**Auth0 mapping**: 
- Shared database connection for signup (no org context)
- Post-email-verification: Management API creates a personal org OR logs user in with `org_id: null` (app default)
- Team creation happens after signup (explicit flow or post-login)

---

### Team Context Switching

| Company | Mechanism | Billing | Cross-Org Queries |
|---------|-----------|---------|-------------------|
| **GitHub** | Org/team dropdown in top nav | Per-org settings | Limited (collaborator roles only) |
| **Vercel** | Team selector in header | Multiple teams under 1 org + invoice roll-up | No (per-team isolation) |
| **Linear** | Workspace switcher (sidebar/URL) | Per-workspace (separate subscription per workspace) | No (teams within workspace only) |
| **Slack** | Workspace switcher (sidebar icon) | Per-workspace (separate subscriptions) | None (strict isolation) |
| **Figma** | Team selector + Org selector (dual hierarchy) | Per-team seats under org | Yes (org-level admin can query) |
| **Notion** | Workspace selector | Per-workspace | No |
| **Railway** | Team selector | Per-team | Limited (only shared projects) |
| **Stripe** | Account switcher (top-left) | Per-account | No (per-account isolation) |

**Key insight**: Context switching is always explicit (dropdown/selector); no ambient context from URL alone (that's a security risk—see "CRITICAL security default" in [SKILL.md](../SKILL.md)).

**Auth0 mapping**:
- Store `org_id` in session/localStorage
- Emit UI selector to switch orgs
- Re-authenticate with new `org_id` or use Management API to fetch orgs and switch client-side
- Always validate the selected `org_id` against the token on the server

---

### Enterprise SSO & Premium Gating

> Exact tier names, prices, and SSO availability change frequently — **verify against each
> vendor's current pricing page before quoting specifics.** (GitHub, for example, moved SAML SSO
> from Enterprise-only to Pro/Team in 2024.) What's durable is the *shape*, captured below.

| Company | SSO gated to a top commercial tier | Self-serve vs sales-led |
|---------|------------------------------------|-------------------------|
| **Vercel** | Yes (Enterprise) | Sales-led |
| **GitHub** | Yes (org/Enterprise plans) | Self-serve config, top tier |
| **Linear** | Yes (Business/Enterprise) | Mostly self-serve |
| **Slack** | Yes (Enterprise Grid) | Sales-led |
| **Figma** | Yes (Organization/Enterprise) | Sales-led |
| **Notion** | Yes (Enterprise) | Sales-led |

**Pattern**: SSO is **never** in free/starter — always reserved for the top commercial tier, and
usually sales-led. This is the upsell lever, not a default. Auth0's Self-Service Enterprise
Configuration lets you make it self-serve when you want to (see
[Architecture Patterns](architecture.md#option-b-recommended-auth0-self-service-enterprise-configuration--hosted-sso-setup)).

**Auth0 mapping**:
- Mark per-org enterprise SSO availability in your app's pricing/feature gating logic
- Create per-org OIDC/SAMLP connections in Auth0 only for Enterprise customers
- Use `assign_membership_on_login: true` to auto-add SSO users to the org (JIT)
- Optional: store `sso_enabled` flag in org metadata to gate the "Connect SSO" UI

**Security note**: Verify DNS domain ownership before enabling `domain_aliases` (Home Realm Discovery), per [Architecture Patterns](architecture.md#verify-domain-ownership-before-home-realm-discovery).

---

### Role Models & Hierarchy

| Company | Role Levels | Org Admin | Member | Viewer | Custom Roles |
|---------|-------------|----------|--------|--------|---|
| **GitHub** | Owner / Admin / Member / Outside Collaborator | ✓ | ✓ | ✓ | Limited |
| **Vercel** | Owner / Admin / Developer / Viewer | ✓ | ✓ | ✓ | Limited |
| **Linear** | Admin / Member / Guest | ✓ | ✓ | ✓ | ✓ |
| **Slack** | Owner / Admin / Member / Guest | ✓ | ✓ | — | ✓ |
| **Figma** | Owner / Admin / Editor / Viewer | ✓ | ✓ | ✓ | Limited |
| **Notion** | Owner / Editor / Commenter / Viewer | ✓ | ✓ | ✓ | Limited |
| **Railway** | Owner / Admin / Developer | ✓ | ✓ | — | Limited |
| **Stripe** | Admin / Developer / Analyst / Support | ✓ | ✓ | ✓ | ✓ |

**Most common**: 2-3 core roles (Owner, Admin, Member) + a lower-cost Viewer role for read-only access.

**Auth0 mapping**:
- Create roles with `managementClient.roles.create(...)`; assign org-scoped roles at join time
  with `managementClient.organizations.addMemberRoles({ id, user_id }, { roles })`
- Assignment happens at org-join time (via invitation, JIT default-role Action, or Management API)
- Emit roles in the access token via post-login Action (custom claim)
- For fine-grained permissions, attach Auth0 API permissions to each role

---

### Billing Model

> Prices omitted intentionally — they go stale. What matters for your auth model is the *billing
> unit* (what you count), which maps directly to Auth0 org membership.

| Company | Billing unit | Scope |
|---------|-------------|-------|
| **Vercel** | Per-seat (differentiated: developer vs viewer) | Per team |
| **GitHub** | Per-user | Per org |
| **Linear** | Per-user | Per workspace (separate subscription each) |
| **Slack** | Per-user | Per workspace (separate subscription each) |
| **Figma** | Per-seat (differentiated seat types) | Org-level |
| **Notion** | Per-member | Per workspace |
| **Railway** | Metered compute + per team member | Per team |

**Key**: Per-user/seat is most common for B2B; the billing unit is almost always **org
membership**. Usage-based (e.g. Railway) suits infrastructure products.

**Auth0 mapping**:
- Use org membership as the source of truth for per-seat billing
- Count billable users with `managementClient.organizations.getMembers({ id })`
- For usage-based: track logins/API calls per org in your application logs

---

## Architecture Decisions: Which Pattern for Your App?

### Decision Tree

**Q1: Is each user isolated, or do they collaborate?**
- **Isolated** (e.g., SaaS for freelancers, small business accounting) → **Company Tenant** with light collaboration
- **Collaborative** (e.g., team project management, design, docs) → **Cross-Org Member** or **Isolated Workspace**

**Q2: Do you want a free personal tier?**
- **Yes** (freemium) → **Company Tenant**: personal/free space + team creation (paid)
- **No** (B2B only) → **Company Tenant**: all users in organizations; team/role gating at signup

**Q3: How much are orgs/teams independent?**
- **Very** (separate billing, zero cross-org queries) → **Isolated Workspace** or a tight **Company Tenant**
- **Somewhat** (shared integrations, org admin can query all teams) → **Cross-Org Member** with org hierarchy (e.g., Vercel's Orgs group Teams)

**Q4: Are your users developers/builders creating multiple apps?**
- **Yes** → **Project Platform** — like **Cross-Org Member**, but with "create app" as the core workflow
- **No** → **Company Tenant** or **Cross-Org Member**

---

## Mapping Patterns to Auth0 Primitives

### Cross-Org Member (single identity, many orgs)

```
Auth0 setup:
├─ One Auth0 user (from email connection)
├─ Multiple orgs, each with user assigned a role
├─ org_id in access token = active org for this request
├─ Roles are org-scoped (e.g., admin in org A, member in org B)
└─ Token includes: org_id, org_name (if enabled), roles (custom claim)
```

**Provisioning** (Management API client — `managementClient.organizations.*`):
```ts
const { data: org } = await managementClient.organizations.create({
  name: "acme",
  display_name: "Acme Inc",
  enabled_connections: [{ connection_id: process.env.DEFAULT_CONNECTION_ID }],
});
await managementClient.organizations.addMembers({ id: org.id }, { members: [userId] });
await managementClient.organizations.addMemberRoles(
  { id: org.id, user_id: userId },
  { roles: [process.env.AUTH0_ADMIN_ROLE_ID] }
);
```

**Login**:
```
GET /authorize?organization=<org-id>&...
```

**App enforcement** (see [Integration & Enforcement](integration.md)):
```ts
const orgId = token.org_id;  // read from validated token only
const userRole = token['https://app.com/roles'][0];  // org-scoped role
// authorize: confirm user_role grants permission *within orgId*
```

---

### Company Tenant

```
Auth0 setup:
├─ One Auth0 user (from email connection)
├─ One "personal" org (or special `org_id: null` handling)
├─ Zero or more "team" orgs (created by user or admin)
├─ Personal org has only the user; teams have members + roles
└─ Token includes: org_id (personal or team), personal_org_id (optional, for context)
```

**Provisioning & onboarding** (Management API client — the user is created by the signup
connection; the app creates orgs via `managementClient.organizations.*`):
```ts
// On signup, after email verification — create the user's personal org:
const { data: personalOrg } = await managementClient.organizations.create({
  name: `${slugify(user.email)}-personal`,
  display_name: `${user.name}'s Personal`,
  enabled_connections: [{ connection_id: process.env.DEFAULT_CONNECTION_ID }],
});
await managementClient.organizations.addMembers(
  { id: personalOrg.id },
  { members: [user.sub] }
);

// User is now in their personal org. Later, if they create a team:
const { data: teamOrg } = await managementClient.organizations.create({
  name: teamSlug,
  display_name: teamName,
  enabled_connections: [{ connection_id: process.env.DEFAULT_CONNECTION_ID }],
});
await managementClient.organizations.addMembers(
  { id: teamOrg.id },
  { members: [user.sub] }
);
await managementClient.organizations.addMemberRoles(
  { id: teamOrg.id, user_id: user.sub },
  { roles: [process.env.AUTH0_ADMIN_ROLE_ID] }   // team creator becomes admin
);
```

**Login**:
```
GET /authorize?organization=<personal-or-team-org>&...
```

**App enforcement**:
```ts
const orgId = token.org_id;  // which org (personal or team)?
if (token.personal_org_id === orgId) {
  // Personal workspace — owner can do anything
} else {
  // Team workspace — check token roles and permissions
}
```

---

### Isolated Workspace

```
Auth0 setup:
├─ One Auth0 user per person
├─ Each workspace is an org with strict isolation
├─ No cross-workspace visibility (each is a separate subscription)
├─ Roles are workspace-scoped
└─ Token includes: org_id (workspace), roles
```

This is similar to **Cross-Org Member**, but with stronger enforcement on the app side: no queries that span orgs, no shared resources.

---

### Project Platform

```
Auth0 setup:
├─ One Auth0 user (developer/builder)
├─ Multiple "app" or "project" orgs, each with team members
├─ User can be owner of some, member of others
├─ Token includes: org_id (active app/project), roles
└─ App features (roles, connections, permissions) per org
```

Same as **Cross-Org Member**, but the UX emphasizes "create app" rather than "invite team."

---

## Security Checklist for Your Account Model

Before shipping:

- [ ] **Token-based org scoping**: All data queries scope to `token.org_id`, never `request.body.org_id`
- [ ] **Role assignment at membership**: When a user joins an org (invitation, JIT, or manually), they're assigned a role
- [ ] **Domain verification for SSO**: If enabling `domain_aliases` for Home Realm Discovery, verify DNS TXT ownership first
- [ ] **No global role checks**: Roles are org-scoped; never ask "is the user an admin?" without asking "admin of which org?"
- [ ] **Invitation link integrity**: Invitations include `organization` and `invitation` params; don't trust user input to override org context
- [ ] **Post-login Actions bound in order**: Deploy Default Role, Token Shaping, Security Policies in that sequence
- [ ] **Custom claims namespaced**: Roles/permissions use `https://yourdomain/roles`, not `roles`
- [ ] **Two-client architecture**: One for login (Dashboard + `organization_usage: require`), one for Management API (machine credentials)

---

## References

**Market research sources** (fetched June 2026):
- Vercel: https://vercel.com/pricing, https://vercel.com/docs/organizations
- GitHub: https://github.com/pricing, https://docs.github.com/en/organizations
- Linear: https://linear.app/pricing, https://linear.app/docs
- Slack: https://slack.com/pricing
- Notion: https://www.notion.com/pricing, https://www.notion.so/help
- Stripe: https://stripe.com/en-gb/connect, https://docs.stripe.com
- Figma: https://www.figma.com/pricing, https://help.figma.com/hc/en-us/articles/360039956634-Teams-in-Figma
- Railway: https://railway.com/pricing
- Stripe: https://stripe.com/pricing, https://docs.stripe.com/get-started/account/teams

**Auth0 docs**:
- [Organizations](https://auth0.com/docs/manage-users/organizations)
- [Login flows for Organizations](https://auth0.com/docs/manage-users/organizations/login-flows-for-organizations)
- [B2B SaaS architecture](https://auth0.com/docs/get-started/architecture-scenarios/business-to-business)
- [auth0-b2b-saas-starter](https://github.com/auth0-developer-hub/auth0-b2b-saas-starter)
