# Auth0 Custom Domains — reference hub

Drive Auth0 custom-domain work end-to-end: Auth0 Management API, DNS provider, verification polling, and the configuration that stitches everything together. Detects the user's DNS provider (Cloudflare, Route 53, Azure DNS, or other) and automates record creation when the provider supports it.

<!-- Single-intent FEATURE group carved from the original feature-custom-domains.md.
     The guide leaf is the entry point for every custom-domain task: it holds the
     overview, interaction style, error-code triage (CHECK THIS FIRST), key
     concepts, prerequisites, common mistakes, the DNS Provider Playbook, and all
     five capability flows (Set up, Troubleshoot, Manage, Remove, Health check).
     The other leaves are on-demand lookups. Read the guide first (hop 1), then
     the leaf your task needs. -->

## Overview

This skill is **capability-based**, not step-based. It groups the work a user might want to do into five distinct capabilities (setup, troubleshoot, manage, remove, health check), each with its own flow in a dedicated reference file. The main SKILL.md acts as a lobby: it holds the capabilities table, key concepts, prerequisites, and common mistakes that apply across all flows. When a user invokes the skill, pick the matching capability from the table, load its reference file, and follow that flow.

The capability design matches how users actually come to Auth0 custom domain work: "set one up," "mine is broken," "change something," "remove one," or "is my setup still working?" Each intent maps to a distinct flow with its own safety checks and hand-offs.

## Interaction style

Ask questions as plain conversational text. Never use structured UI widgets (e.g., AskUserQuestion) — instead, ask as plain conversational text — except for a single yes/no confirmation immediately before a destructive or irreversible action (create, PATCH, delete). For everything else:

- **Capability routing**: present a numbered list and wait for the user to reply
- **Input gathering**: ask one focused question at a time; wait for a response before asking the next
- **Free-form values** (hostnames, domain names, etc.): just ask directly — don't wrap them in a widget that forces a click before typing

Example of the right pattern for capability routing:

```text
What do you want to do?

1. Set up a custom domain
2. Troubleshoot verification
3. Manage an existing domain
4. Remove a domain
5. Check domain health (read-only, safe starting point)
```

Example of the right pattern for a single input:

```text
What's the hostname you want to set up? (e.g., login.example.com)
```

## Error-code triage — CHECK THIS FIRST

If the user's message is primarily about an HTTP error code from the Management API (e.g., "I got a 403", "why is this returning 409?", a pasted error body, a log entry with a status code), **answer from this table first.** Do not default to general Auth0 knowledge — it leads to wrong advice on the Free-tier 403 case in particular. Only after the error-code answer, offer to route into the matching capability if the user wants to continue (e.g., "want me to walk through Set up with that fix in place?").

| Status and context | Correct diagnosis and fix |
|---|---|
| **403** on `POST /custom-domains` (Free tier) | **Not a plan-tier problem.** Custom domains are available on **all plans including Free** (confirmed in Auth0 docs: *"To set up a free custom domain, Auth0 tenants must have a valid credit card on file for verification purposes and fraud prevention. The credit card will not be charged."*). Fix at **Dashboard → Tenant Settings → Billing** by adding a card. **Do NOT suggest a plan upgrade.** |
| **403** on `POST /custom-domains` with `type: self_managed_certs` | This *is* a plan issue. Self-managed certs are Enterprise-only. Either downgrade to `type: auth0_managed_certs` (works on all plans) or upgrade to Enterprise. |
| **409** on `POST /custom-domains` | Domain already exists on this tenant or another. Run `auth0 domains list` to check; if on another tenant the user owns, delete it there first. Do not retry a fresh create. |
| **400** on `PATCH /custom-domains/{id}` with `type` in body | `type` is fixed at create time and rejected by PATCH. Route to delete (capability 4) + recreate (capability 1). Warn about auth downtime during the cutover. |
| **400** with `operation_not_supported` on `relying_party_identifier` | Feature-flag gate on the tenant. Retry without `relying_party_identifier` and ask Auth0 support to enable the flag. |
| **404** on any custom-domain endpoint | Wrong `custom_domain_id`, or wrong tenant. Verify with `auth0 tenants list` + `auth0 domains list`. |
| **429** | Rate limited. Back off; the skill's verify-poll backoff pattern (5s, 10s, 20s, 30s, 60s) avoids this. |

Full error-code reference with all cases and resolutions: see the API Reference in this group's api-reference leaf (Error Codes).

## Capabilities

When this skill is invoked and the user is NOT asking about an error code, ask the user which capability they want using a plain numbered list (see Interaction style above). Route to **Check domain health** first when the user reports a problem without a specific known cause, or when they're unsure which capability they need; it's the safe, read-only starter that will point them to the right follow-up.

| # | Capability | What it does |
|---|---|---|
| 1 | **Set up a custom domain** | End-to-end: create the domain in Auth0, detect the DNS provider, write the CNAME record (automated on Cloudflare / Route 53 / Azure; guided on other providers), verify ownership, and report what to update in the user's apps. Handles first-time setup and adding to MCD. (flow in this group's guide leaf) |
| 2 | **Troubleshoot verification** | Domain stuck in `pending_verification` or verification failing. Diagnostic ladder: compare DNS to expected, check for proxies / CNAME flattening / conflicting records / propagation / private-zone issues, then retry. (flow in this group's guide leaf) |
| 3 | **Manage existing domains** | Surgical edits on already-configured domains: set or change the default (for MCD), update TLS policy, configure the custom client IP header, set the relying party identifier for passkeys, manage per-domain metadata (up to 10 key-value pairs readable from Actions), list domains and show status. Intent-driven. Certificate type is fixed at create time; PATCH rejects `type` changes. (flow in this group's guide leaf) |
| 4 | **Remove a custom domain** | Delete a domain safely: warn if it's the default, surface dependent applications, delete in Auth0, clean up the CNAME in DNS. (flow in this group's guide leaf) |
| 5 | **Check domain health** | Read-only: list all custom domains, check DNS records match expected values, surface default-domain config, flag anything needing attention. Safe starter capability. (flow in this group's guide leaf) |

Pick a capability, then follow the flow in its reference file. The **Prerequisites** and **Key Concepts** sections below apply across all capabilities.

## Key Concepts

| Concept | Description |
|---|---|
| CNAME Record | DNS record pointing your custom domain to Auth0's edge (e.g., `{tenant}.edge.tenants.auth0.com`). Must stay in DNS permanently for certificate renewal |
| Auth0-Managed Certificate | Auth0 provisions and auto-renews TLS certs every ~3 months. Default and recommended. Type is fixed at create time and cannot be changed via PATCH |
| Self-Managed Certificate | TLS terminates at a reverse proxy (Cloudflare, CloudFront, Azure Front Door, or GCP LB). Enterprise only; verification uses TXT instead of CNAME. Type is fixed at create time and cannot be changed via PATCH; to change, delete and recreate the domain |
| NS Detection | Looking up the root domain's nameservers to identify the DNS provider and route to the correct automation tier |
| Multiple Custom Domains (MCD) | Enterprise feature; up to 20 domains per tenant for multi-brand or multi-region |
| Default Custom Domain | When MCD is configured, the domain used when a Management API call doesn't send the `auth0-custom-domain` header |
| Relying Party Identifier (RPID) | Per-domain `relying_party_identifier` that decouples the custom domain hostname from the passkey `rpId`. Set at create or via PATCH. Lets you serve auth at `login.example.com` while passkeys bind to `example.com` for cross-surface reuse |
| TLS Policy | `tls_policy` on the domain controls minimum TLS version / cipher posture for Auth0-managed certs. Default `recommended`. Set at create or via PATCH |
| Custom Client IP Header | `custom_client_ip_header` tells Auth0 which request header carries the real client IP when traffic passes through a reverse proxy. Valid values: `true-client-ip`, `cf-connecting-ip`, `x-forwarded-for`, `x-azure-clientip`. Set at create or via PATCH |
| Domain Metadata | Up to 10 custom key-value pairs attached to a custom domain (keys and values ≤ 255 chars). Read from Actions via `event.custom_domain.domain_metadata` for per-domain logic (region, brand, env tagging) |

Full schema and token / `iss` behavior live in this group's guide leaf (Advanced section).

## Prerequisites

These apply to any capability that writes to the tenant. **Check domain health** is read-only and can be run first to verify these.

### Auth0 Management API access

All capabilities use the Management API. Either:
- The Auth0 CLI (`auth0 ...`) authenticated to the target tenant (`auth0 tenants use <name>`), or
- A Machine-to-Machine application with the scopes in this group's api-reference leaf.

**Check the active tenant immediately before the first Auth0 CLI command in a capability, not at skill invocation.** Do not check the tenant before the user has chosen a capability. If a capability uses only non-CLI tools (e.g., DNS lookups, Cloudflare MCP, direct Management API calls via curl), skip the tenant check entirely.

When the chosen capability does use the Auth0 CLI, run this before the first CLI command:

```bash
auth0 tenants list
```

Look for the row marked as active (or check the `active` field in the JSON output). Show the active tenant to the user and ask them to confirm it is the intended target. If it's wrong, stop and have the user run:

```bash
auth0 tenants use <tenant-name>
```

Then re-confirm before proceeding. For mutating calls (create, PATCH, delete), require explicit confirmation. For read-only CLI flows, surfacing the tenant name (and naming it in the output report) is enough — still never assume the active tenant is correct based on conversational context alone.

### DNS provider access (for Set up, Troubleshoot, and Remove)

**Set up a custom domain** writes a CNAME. **Remove a custom domain** deletes one. **Troubleshoot verification** may suggest a fix that requires a DNS edit. What the skill needs depends on the provider tier:

- **Tier 1 Cloudflare**: Cloudflare MCP connected. If not, skill prompts the user to run `claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp` and authorize in the browser.
- **Tier 2 AWS Route 53**: AWS credentials configured (env vars, shared config, or SSO session). Verified with `aws sts get-caller-identity`.
- **Tier 3 Azure DNS**: Azure CLI signed in. Verified with `az account show`.
- **Tier 4 other**: no programmatic access; user manually adds the record in their provider's dashboard.

**Plan requirements for automation**: None of the three automated tiers require a paid plan on the DNS provider side. Cloudflare DNS record CRUD via the MCP works on the Free plan (Free zones created after Sept 2024 cap at 200 DNS records per zone; Auth0's CNAME counts as one). Route 53 is pay-per-use (~$0.50/hosted zone/month + query costs, not in AWS free tier). Azure DNS is subscription-based with no tier gating; the signed-in identity needs the DNS Zone Contributor role. Full detail per tier in the DNS Provider Playbook in this group's guide leaf.

### Credit card on file (Free-tier tenants)

Custom domains are available on **all plan tiers including Free**. Free tenants need a credit card on file for identity verification (card is not charged). Without one, `POST /custom-domains` returns 403. Fix at **Dashboard → Tenant Settings → Billing** (or the Teams section for Teams-managed tenants).

Surface this as the likely cause on any 403 rather than suggesting a plan upgrade.

## Common Mistakes

Quick index; each entry references the canonical treatment in this group's guide leaf or api-reference leaf, as noted.

| Mistake | See |
|---|---|
| Assuming a 403 on create means plan upgrade | This group's api-reference leaf: Error Codes |
| Removing the CNAME after verification (breaks cert renewal) | Check Domain Health flow in this group's guide leaf: interpreting results |
| Using a subdomain with passkeys without setting `relying_party_identifier` | Manage Existing Domains flow in this group's guide leaf: Set the relying party identifier |
| Trying to change certificate type via PATCH | Manage Existing Domains flow in this group's guide leaf: scope note |
| Enabling DNS proxy on the CNAME (Cloudflare orange cloud) | Troubleshoot flow in this group's guide leaf: proxy check |
| Enabling CNAME flattening on the zone | Troubleshoot flow in this group's guide leaf: flattening check |
| Deleting and recreating to "unstick" verification | Troubleshoot flow in this group's guide leaf: what not to do |
| Not updating SDK `domain` / `issuerBaseURL` after verification | Set Up flow in this group's guide leaf: report next steps |
| Calling Management API via tenant domain under MCD | Advanced section in this group's guide leaf: the auth0-custom-domain header |

## Choose your task

You arrived here for the custom-domains intent. The orientation above (overview,
interaction style, error-code triage, capabilities, key concepts, prerequisites,
common mistakes) is everything you need for most tasks. For the capability flows
themselves, plus advanced depth and the DNS provider playbook, go to the guide:

| Intent | Read |
|---|---|
| feature:custom-domains | `Read: references/feature-custom-domains/guide.md` |

**Then, as needed for your task:**
- API / endpoint / object-property lookup (Management API endpoints, CLI commands, PATCH/POST bodies, status lifecycle, error codes, scopes), plus Management API cURL examples and CI/CD automation scripts (Examples section): `Read: references/feature-custom-domains/api-reference.md`
- Advanced topics (Multiple Custom Domains, default domain + `auth0-custom-domain` header, self-managed certs, token `iss` behavior, verification troubleshooting depth) live in the guide's Advanced section: `Read: references/feature-custom-domains/guide.md`

Read only the leaf (or leaves) your task needs — not all of them.
