
# Auth0 Custom Domains

Drive Auth0 custom-domain work end-to-end: Auth0 Management API, DNS provider, verification polling, and the configuration that stitches everything together. Detects the user's DNS provider (Cloudflare, Route 53, Azure DNS, or other) and automates record creation when the provider supports it.

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

Full error-code reference with all cases and resolutions: see the API Reference section below (Error Codes).

## Capabilities

When this skill is invoked and the user is NOT asking about an error code, ask the user which capability they want using a plain numbered list (see Interaction style above). Route to **Check domain health** first when the user reports a problem without a specific known cause, or when they're unsure which capability they need; it's the safe, read-only starter that will point them to the right follow-up.

| # | Capability | What it does |
|---|---|---|
| 1 | **Set up a custom domain** | End-to-end: create the domain in Auth0, detect the DNS provider, write the CNAME record (automated on Cloudflare / Route 53 / Azure; guided on other providers), verify ownership, and report what to update in the user's apps. Handles first-time setup and adding to MCD. (guidance inline below) |
| 2 | **Troubleshoot verification** | Domain stuck in `pending_verification` or verification failing. Diagnostic ladder: compare DNS to expected, check for proxies / CNAME flattening / conflicting records / propagation / private-zone issues, then retry. (guidance inline below) |
| 3 | **Manage existing domains** | Surgical edits on already-configured domains: set or change the default (for MCD), update TLS policy, configure the custom client IP header, set the relying party identifier for passkeys, manage per-domain metadata (up to 10 key-value pairs readable from Actions), list domains and show status. Intent-driven. Certificate type is fixed at create time; PATCH rejects `type` changes. (guidance inline below) |
| 4 | **Remove a custom domain** | Delete a domain safely: warn if it's the default, surface dependent applications, delete in Auth0, clean up the CNAME in DNS. (guidance inline below) |
| 5 | **Check domain health** | Read-only: list all custom domains, check DNS records match expected values, surface default-domain config, flag anything needing attention. Safe starter capability. (guidance inline below) |

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

Full schema and token / `iss` behavior live in the Advanced Topics section below.

## Prerequisites

These apply to any capability that writes to the tenant. **Check domain health** is read-only and can be run first to verify these.

### Auth0 Management API access

All capabilities use the Management API. Either:
- The Auth0 CLI (`auth0 ...`) authenticated to the target tenant (`auth0 tenants use <name>`), or
- A Machine-to-Machine application with the scopes in the API Reference section below.

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

**Plan requirements for automation**: None of the three automated tiers require a paid plan on the DNS provider side. Cloudflare DNS record CRUD via the MCP works on the Free plan (Free zones created after Sept 2024 cap at 200 DNS records per zone; Auth0's CNAME counts as one). Route 53 is pay-per-use (~$0.50/hosted zone/month + query costs, not in AWS free tier). Azure DNS is subscription-based with no tier gating; the signed-in identity needs the DNS Zone Contributor role. Full detail per tier in the DNS Provider Playbook section below.

### Credit card on file (Free-tier tenants)

Custom domains are available on **all plan tiers including Free**. Free tenants need a credit card on file for identity verification (card is not charged). Without one, `POST /custom-domains` returns 403. Fix at **Dashboard → Tenant Settings → Billing** (or the Teams section for Teams-managed tenants).

Surface this as the likely cause on any 403 rather than suggesting a plan upgrade.

## Common Mistakes

Quick index; each entry references the canonical treatment in the relevant section below.

| Mistake | See |
|---|---|
| Assuming a 403 on create means plan upgrade | API Reference section: Error Codes |
| Removing the CNAME after verification (breaks cert renewal) | Check Domain Health section: interpreting results |
| Using a subdomain with passkeys without setting `relying_party_identifier` | Manage Existing Domains section: Set the relying party identifier |
| Trying to change certificate type via PATCH | Manage Existing Domains section: scope note |
| Enabling DNS proxy on the CNAME (Cloudflare orange cloud) | Troubleshoot section: proxy check |
| Enabling CNAME flattening on the zone | Troubleshoot section: flattening check |
| Deleting and recreating to "unstick" verification | Troubleshoot section: what not to do |
| Not updating SDK `domain` / `issuerBaseURL` after verification | Set Up section: report next steps |
| Calling Management API via tenant domain under MCD | Advanced Topics section: the auth0-custom-domain header |

## Related capabilities

- Customizing Universal Login appearance → branding (feature:branding); page templates require a verified custom domain
- Organization-specific branding for B2B multi-tenancy → Organizations (feature:organizations)

## References

This file contains all custom domain guidance inline. Sections: Setup · Troubleshoot · Manage · Remove · Health Check · DNS Providers (Cloudflare, Route 53, Azure, Manual) · API Reference · Examples.

## External Docs

- [Custom Domains Overview](https://auth0.com/docs/customize/custom-domains)
- [Auth0-Managed Certificates](https://auth0.com/docs/customize/custom-domains/auth0-managed-certificates)
- [Self-Managed Certificates](https://auth0.com/docs/customize/custom-domains/self-managed-certificates)
- [Multiple Custom Domains](https://auth0.com/docs/customize/custom-domains/multiple-custom-domains)
- [Default Custom Domain](https://auth0.com/docs/customize/custom-domains/multiple-custom-domains/default-domain)
- [Configure Features to Use Custom Domains](https://auth0.com/docs/customize/custom-domains/configure-features-to-use-custom-domains)
- [Troubleshoot Custom Domains](https://auth0.com/docs/troubleshoot/integration-extensibility-issues/troubleshoot-custom-domains)
- [Cloudflare MCP Server](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)

---

# Auth0 Custom Domains: API Reference

## Management API Endpoints

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| POST | `/api/v2/custom-domains` | Create a new custom domain | `create:custom_domains` |
| GET | `/api/v2/custom-domains` | List all custom domains on the tenant | `read:custom_domains` |
| GET | `/api/v2/custom-domains/<domainId>` | Get a single domain's configuration and status | `read:custom_domains` |
| PATCH | `/api/v2/custom-domains/<domainId>` | Update `tls_policy`, `custom_client_ip_header`, `relying_party_identifier`, or `domain_metadata`. `type` is NOT patchable | `update:custom_domains` |
| DELETE | `/api/v2/custom-domains/<domainId>` | Delete a custom domain | `delete:custom_domains` |
| POST | `/api/v2/custom-domains/<domainId>/verify` | Trigger the verification process | `create:custom_domains` |
| GET | `/api/v2/custom-domains/default` | Get the current default custom domain | `read:custom_domains` |
| PATCH | `/api/v2/custom-domains/default` | Set the default custom domain; body: `{"domain": "login.example.com"}` | `update:custom_domains` |

## CLI Commands

```bash
# Create custom domain (interactive)
auth0 domains create

# List all custom domains
auth0 domains list

# Show domain details
auth0 domains show <domainId>

# Verify domain ownership
auth0 domains verify <domainId>

# Update domain configuration
auth0 domains update <domainId>

# Delete a custom domain (use --force to skip the CLI's interactive prompt)
auth0 domains delete <domainId> --force

# Set the default custom domain (no dedicated CLI subcommand; use API passthrough)
auth0 api patch "custom-domains/default" --data '{"domain": "<domain>"}'

# Get the current default
auth0 api get "custom-domains/default"
```

### CLI vs API value conventions

The dedicated `auth0 domains` subcommands and the `auth0 api` passthrough use different value vocabularies for some fields. When translating between them, watch for:

| Concept | Dedicated CLI flag | API body field |
|---|---|---|
| Certificate type (Auth0-managed) | `--type auth0` | `"type": "auth0_managed_certs"` |
| Certificate type (self-managed) | `--type self` | `"type": "self_managed_certs"` |
| Relying party identifier | **not supported on the CLI** (no `--rpid` flag); use API passthrough | `"relying_party_identifier"` |
| Default domain | **not supported on the CLI** (no `default` subcommand); use API passthrough | `PATCH /custom-domains/default` with `{"domain": "..."}` |

## Domain Object Properties

| Property | Type | Description | Writable |
|----------|------|-------------|----------|
| `custom_domain_id` | string | Unique identifier (e.g., `cd_abc123`) | read-only |
| `domain` | string | The custom domain hostname (e.g., `login.example.com`) | create only |
| `type` | string | `auth0_managed_certs` or `self_managed_certs` | **create only; PATCH rejects `type`** |
| `verification_method` | string | `cname` or `txt`; default derives from `type` | create only |
| `tls_policy` | string | TLS posture for Auth0-managed certs. Default `recommended` | create + PATCH |
| `custom_client_ip_header` | string | Header carrying real client IP. One of `true-client-ip`, `cf-connecting-ip`, `x-forwarded-for`, `x-azure-clientip`. `null` to clear | create + PATCH |
| `relying_party_identifier` | string | Per-domain passkey `rpId`. Must be a registrable suffix of `domain`. `null` to clear (defaults to domain hostname) | create + PATCH |
| `domain_metadata` | object | Up to 10 key-value pairs (≤ 255 chars each). To remove a key, PATCH the full merged object without it (GET → merge client-side → PATCH). See Manage Existing Domains section below. | create + PATCH |
| `primary` | boolean | Whether this is the default domain (set via `PATCH /tenants/settings`, not here) | read-only here |
| `status` | string | `disabled`, `pending`, `pending_verification`, `ready` | read-only |
| `verification.methods` | array | DNS records needed to prove ownership | read-only |
| `verification.methods[].name` | string | The record type (`cname` or `txt`) | read-only |
| `verification.methods[].record` | string | The value to write into DNS | read-only |
| `verification.methods[].domain` | string | The name where the record goes | read-only |
| `origin_domain_name` | string | The Auth0 edge hostname (usually the same as the CNAME value) | read-only |

## PATCH body reference

Only these fields are accepted on `PATCH /custom-domains/{id}`. Omit fields you don't want to change.

```json
{
  "tls_policy": "recommended",
  "custom_client_ip_header": "cf-connecting-ip",
  "relying_party_identifier": "example.com",
  "domain_metadata": {
    "region": "us-east",
    "brand": "acme"
  }
}
```

Scalar fields (`tls_policy`, `custom_client_ip_header`, `relying_party_identifier`) can be cleared by PATCHing with `null`. For `domain_metadata`, use the GET → merge client-side → PATCH pattern and submit the full post-merge object (see the Manage Existing Domains section below).

## POST body reference

`POST /custom-domains` accepts `domain` (required), `type`, and optionally the same fields PATCH accepts:

```json
{
  "domain": "login.example.com",
  "type": "auth0_managed_certs",
  "verification_method": "txt",
  "tls_policy": "recommended",
  "custom_client_ip_header": "cf-connecting-ip",
  "relying_party_identifier": "example.com",
  "domain_metadata": {
    "region": "us-east"
  }
}
```

## Status Lifecycle

```text
[create] -> pending_verification -> [verify + DNS propagates] -> ready
                ^                                                   |
                |                                                   |
                +-- [DNS record removed or changed] <---------------+
```

A domain can go from `ready` back to `pending_verification` if the CNAME record is removed or changed in DNS. This breaks certificate renewal over time.

## Error Codes

| HTTP Status | Cause | Resolution |
|-------------|-------|------------|
| 400 | Invalid domain format or unsupported TLD | Verify the domain is a well-formed hostname. Some TLDs are not supported; see docs |
| 400 | PATCH body contains `type` | `type` is not PATCHable. Remove it from the body. To change cert type, delete and recreate |
| 403 | Free-tier tenant without credit card on file. **Custom domains ARE available on Free** — per Auth0 docs: *"To set up a free custom domain, Auth0 tenants must have a valid credit card on file for verification purposes and fraud prevention. The credit card will not be charged."* Do NOT suggest a plan upgrade as the fix | Add card at **Dashboard > Tenant Settings > Billing** (card is not charged). For Teams-managed tenants, the billing UI lives in the Teams section |
| 403 | Self-managed certs requested at create time but tenant lacks Enterprise | Use `auth0_managed_certs` or upgrade |
| 404 | Domain ID not found | Verify with `auth0 domains list` |
| 409 | Domain already configured on this or another tenant | List existing domains. If on another tenant, remove from there first or use a different domain |
| 429 | Rate limited | Back off and retry |

## Configuration Options

### Certificate types

| Value | When to use | Requirements |
|-------|-------------|--------------|
| `auth0_managed_certs` | Default. Auth0 provisions and renews TLS certs | None (all plans) |
| `self_managed_certs` | Terminating TLS at your own reverse proxy | Enterprise plan |

**`type` is fixed at create time.** The API rejects `type` on PATCH. To change between Auth0-managed and self-managed, delete the domain and recreate it with the new `type`. Coordinate the DNS and reverse-proxy cutover to avoid auth downtime.

### TLS policies

Set via the `tls_policy` field at create or PATCH. Default is `recommended`. Auth0-managed cert domains honor this directly. For self-managed cert domains, the TLS policy is enforced at the user's reverse proxy and `tls_policy` has no runtime effect.

### Custom client IP header

Set via `custom_client_ip_header` at create or PATCH when Auth0 sits behind a reverse proxy. Tells Auth0 which header to trust for the real client IP. Valid values:

| Value | Typical proxy |
|-------|---------------|
| `true-client-ip` | Akamai, generic |
| `cf-connecting-ip` | Cloudflare |
| `x-forwarded-for` | Generic load balancers, most proxies |
| `x-azure-clientip` | Azure Front Door |

Set only when a trusted proxy is actually in front of Auth0 and strips external instances of the header. Otherwise clients can spoof the header to bypass rate limiting / anomaly detection.

### Relying party identifier (passkeys)

Set via `relying_party_identifier` at create or PATCH. Default (unset) binds passkeys to the custom domain hostname. Set to a registrable suffix of the domain (e.g., `example.com` for `login.example.com`) to make passkeys usable across surfaces on the same eTLD+1. Changing this invalidates previously registered passkeys for the old RPID.

## Related Endpoints

These endpoints interact with custom domains via the `auth0-custom-domain` header to route notifications through a specific domain (not through the tenant domain):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v2/tickets/password-change` | Password reset ticket (email) |
| `POST /api/v2/tickets/email-verification` | Email verification ticket |
| `POST /api/v2/jobs/verification-email` | Resend verification email |
| `POST /api/v2/users` (with `verify_email: true`) | New user email verification |

When a default domain is set on the tenant, omitting the header uses the default. Without a default, omitting the header uses the tenant domain.

## Management API Token Scopes

For a Machine-to-Machine app to run the full skill flow, grant these scopes on the Management API:

```text
create:custom_domains
read:custom_domains
update:custom_domains
delete:custom_domains
update:tenant_settings  # only needed for setting default in MCD
```

---

# Auth0 Custom Domains: Advanced Topics

Covers Multiple Custom Domains (MCD), default domain selection, the `auth0-custom-domain` header, self-managed certificates, token `iss` behavior, and verification troubleshooting.

## Multiple Custom Domains (MCD)

MCD lets a single Auth0 tenant host multiple custom domains for multi-brand or multi-region deployments. Enterprise customers get up to 20 domains per tenant out of the box; more are available via add-on SKU.

### When to use MCD

- Multi-brand: `login.brand-a.com` and `login.brand-b.com` serve different customer segments
- Multi-region: `login-us.example.com`, `login-eu.example.com` for regional isolation
- Tenant consolidation: previously running multiple tenants per brand, collapsing into one

### Adding additional domains

The skill's primary flow creates one domain. To add another, invoke the skill again with the new domain. Each domain gets its own `custom_domain_id`, its own CNAME verification record, and its own TLS certificate lifecycle.

### Default custom domain

When multiple domains are configured, one is designated the **default**. The default is used when a Management API call that triggers a notification (password reset email, verification email, etc.) is made **without** an `auth0-custom-domain` header.

Set the default. Two endpoints exist; **prefer `PATCH /custom-domains/default`** — it accepts the human-readable domain name and is the endpoint the skill uses in the Manage capability. The `tenants/settings` form is the older path, still supported, and handy when you already have the `custom_domain_id` (e.g., from a list response). Both are idempotent and produce the same result; pick whichever keeps the surrounding code simpler.

```bash
# Preferred: PATCH /custom-domains/default (pass domain name, not ID):
auth0 api patch "custom-domains/default" --data '{"domain": "login.example.com"}'

# Alternative: tenant settings endpoint (pass the custom_domain_id):
auth0 api patch "tenants/settings" --data '{"default_custom_domain_id": "cd_abc123"}'
```

The Auth0 CLI does not have a dedicated `auth0 domains default` subcommand; the API passthrough is the only way.

### The `auth0-custom-domain` header

For any Management API endpoint that triggers user-facing notifications, include the header to route through a specific custom domain:

```bash
curl --request POST \
  --url 'https://your-tenant.auth0.com/api/v2/tickets/password-change' \
  --header 'authorization: Bearer TOKEN' \
  --header 'auth0-custom-domain: login.brand-a.com' \
  --header 'content-type: application/json' \
  --data '{ "email": "user@brand-a.com" }'
```

If the header is omitted and a default domain is set, the default is used. If no default is set and no header is provided, the notification uses the tenant domain (`your-tenant.auth0.com`), which is usually not what you want.

### Migrating from single to MCD

Users with a single custom domain don't need to migrate; the domain continues to work as-is. When adding a second, consider setting an explicit default before adding it so behavior is predictable.

See [Auth0's MCD migration guide](https://auth0.com/docs/customize/custom-domains/multiple-custom-domains/migration-guide) for the full upgrade path.

## Self-Managed Certificates

Auth0-managed certificates are the default and recommended. Self-managed certificates are for enterprise customers who need to terminate TLS at their own reverse proxy.

### When self-managed is needed

- Corporate TLS policy requires specific cipher suites or cert authorities
- mTLS or pinned certificates must be used
- Integration with a specific CDN for performance or compliance

### Supported reverse proxy providers

- Cloudflare
- AWS CloudFront
- Azure CDN (Front Door)
- Google Cloud Platform Load Balancing

### Verification difference

Self-managed domains use **TXT record verification** instead of CNAME. The skill's provider playbook handles CNAME creation; for TXT records, the same tier logic applies, with the record type swapped. The provider-specific instructions in the DNS Provider Playbook section below are identical except for the record type field.

See [Auth0-managed](https://auth0.com/docs/customize/custom-domains/auth0-managed-certificates) and [Self-managed](https://auth0.com/docs/customize/custom-domains/self-managed-certificates) for full configuration.

## Token `iss` Claim Behavior

Auth0 sets the `iss` claim on issued tokens based on the domain the token request came from:

| Request domain | `iss` value |
|----------------|-------------|
| `your-tenant.auth0.com` | `https://your-tenant.auth0.com/` |
| `login.example.com` | `https://login.example.com/` |

### Implications

- If you request a Management API token via the custom domain, you must use the custom domain for subsequent Management API calls. Using `tenant.auth0.com` with a `custom-domain` `iss` token produces `401 invalid issuer`.
- SDK configurations must use one consistent domain. Don't mix `tenant.auth0.com` in one place and `login.example.com` in another.
- JWT validation in backend APIs needs to accept the correct issuer. If you switch SDKs to a custom domain, update backend validators to match.

## Verification Troubleshooting

Custom domain verification can get stuck for several reasons. Work through these in order.

### Check the CNAME with `dig`

```bash
dig +short CNAME login.example.com
```

The output should be the exact value Auth0 returned in `verification.methods[0].record`. If the value differs, the record was added incorrectly. Compare character-by-character, watching for trailing dots, extra whitespace, or typos.

### Check for proxied records (Cloudflare orange cloud)

On Cloudflare, the record must be DNS-only (grey cloud), not proxied (orange cloud). Other proxy providers (AWS CloudFront, Fastly) can cause similar issues when placed in front of the CNAME.

### Check for CNAME flattening

Some DNS providers flatten CNAMEs at the apex or across zones. This rewrites the record Auth0 sees and breaks verification. Disable flattening for this specific record if possible.

### Check for conflicting records

Some providers won't allow a CNAME alongside other record types at the same name (per DNS RFC). If the target name has an A, AAAA, MX, or TXT record, the CNAME may be silently rejected or not propagated.

### Wait for DNS propagation

Fresh records can take 5-60 minutes to propagate across resolvers. If `dig +short @8.8.8.8 CNAME login.example.com` returns the correct value but `dig +short CNAME login.example.com` (using your local resolver) doesn't, propagation is still in progress.

### Last resort: wait 4 hours, then retry

If the record is correct in DNS but Auth0 still reports `pending_verification`:
1. Do not delete and recreate the domain. This can cause a service interruption.
2. Wait at least 4 hours.
3. Retry verification with `auth0 api post "custom-domains/<domainId>/verify"`.

### When to open a support ticket

- The CNAME is correct in DNS from multiple resolvers, not proxied, not flattened, and verification has been failing for 24+ hours
- Multiple create/delete cycles have been performed (this can put the domain in a state only support can resolve)
- The tenant shows a `disabled` status rather than `pending_verification`

## Rate Limits and Quotas

- Custom domain creates/deletes are low-frequency. No published rate limit beyond Management API defaults.
- The verify polling loop uses exponential backoff (5s, 10s, 20s, 30s, 60s...) and will not hit the 50 req/s Management API limit.
- MCD has a base entitlement of 20 domains per tenant on Enterprise. Additional capacity via add-on SKU.

---

# Auth0 Custom Domains: Management API Examples

cURL patterns for the Auth0 API calls the skill makes (create the custom domain, trigger verification, poll status until `ready`), plus end-to-end CI/CD automation that stitches Auth0 together with a DNS provider. DNS-provider-specific calls live in the DNS Provider Playbook section below (Cloudflare, Route 53, Azure DNS, Manual); the router there picks the right provider based on the root domain's NS records.

## cURL

### Create custom domain

```bash
curl --request POST \
  --url 'https://your-tenant.auth0.com/api/v2/custom-domains' \
  --header 'authorization: Bearer YOUR_MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "domain": "login.example.com",
    "type": "auth0_managed_certs"
  }'
```

Response includes `custom_domain_id`, `status` (starts `pending_verification`), and `verification.methods[0].record` (the CNAME value to put in DNS).

### Trigger verification

```bash
curl --request POST \
  --url 'https://your-tenant.auth0.com/api/v2/custom-domains/cd_abc123/verify' \
  --header 'authorization: Bearer YOUR_MGMT_API_TOKEN'
```

### Poll status

```bash
curl --request GET \
  --url 'https://your-tenant.auth0.com/api/v2/custom-domains/cd_abc123' \
  --header 'authorization: Bearer YOUR_MGMT_API_TOKEN'
```

Stop polling when `status` is `ready`. Suggested backoff: 5, 10, 20, 30s, then 60s intervals up to ~10 minutes total.

### Set default domain (MCD only)

```bash
curl --request PATCH \
  --url 'https://your-tenant.auth0.com/api/v2/tenants/settings' \
  --header 'authorization: Bearer YOUR_MGMT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{"default_custom_domain_id": "cd_abc123"}'
```

### Handling 403 on create (credit card required)

On Free-tier tenants without a credit card on file, `POST /custom-domains` returns 403. Inspect the status:

```bash
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --request POST \
  --url "https://${AUTH0_TENANT}/api/v2/custom-domains" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header "content-type: application/json" \
  --data '{"domain": "login.example.com", "type": "auth0_managed_certs"}')

if [ "$HTTP_STATUS" = "403" ]; then
  echo "Custom domains require a credit card on file for identity verification."
  echo "The card is not charged. Add one at Dashboard → Tenant Settings → Billing."
  exit 1
fi
```

Do not suggest a plan upgrade on 403; the fix is adding a card.

## CI/CD automation

End-to-end patterns that stitch Auth0 domain creation, DNS record provisioning, and verification polling. Useful for multi-environment setups and infrastructure-as-code pipelines.

### End-to-end script: Auth0 + Route 53

Creates the custom domain, writes the CNAME to Route 53, polls Route 53 until `INSYNC`, triggers Auth0 verification, and polls Auth0 until `ready`.

```bash
#!/bin/bash
set -euo pipefail

# Required env vars:
#   AUTH0_TENANT (e.g., acme-prod.us.auth0.com)
#   AUTH0_TOKEN (Management API token with create:custom_domains + read:custom_domains)
#   CUSTOM_DOMAIN (e.g., login.example.com)
#   ROUTE53_HOSTED_ZONE_ID (e.g., Z1234567890ABC)

# 1. Create custom domain in Auth0
CREATE_RESPONSE=$(curl -sf --request POST \
  --url "https://${AUTH0_TENANT}/api/v2/custom-domains" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header "content-type: application/json" \
  --data "{
    \"domain\": \"${CUSTOM_DOMAIN}\",
    \"type\": \"auth0_managed_certs\"
  }")

DOMAIN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.custom_domain_id')
CNAME_VALUE=$(echo "$CREATE_RESPONSE" | jq -r '.verification.methods[0].record')

echo "Auth0 custom domain created: ${DOMAIN_ID}"
echo "CNAME ${CUSTOM_DOMAIN} -> ${CNAME_VALUE}"

# 2. Create CNAME in Route 53
CHANGE_RESPONSE=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "${ROUTE53_HOSTED_ZONE_ID}" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"${CUSTOM_DOMAIN}\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"${CNAME_VALUE}\"}]
      }
    }]
  }" --output json)

CHANGE_ID=$(echo "$CHANGE_RESPONSE" | jq -r '.ChangeInfo.Id')
echo "Route 53 change submitted: ${CHANGE_ID}"

# 3. Wait for Route 53 to propagate
while true; do
  STATUS=$(aws route53 get-change --id "${CHANGE_ID}" --output json | jq -r '.ChangeInfo.Status')
  echo "Route 53 change status: ${STATUS}"
  [ "$STATUS" = "INSYNC" ] && break
  sleep 10
done

# 4. Trigger Auth0 verification
curl -sf --request POST \
  --url "https://${AUTH0_TENANT}/api/v2/custom-domains/${DOMAIN_ID}/verify" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" > /dev/null

# 5. Poll Auth0 status with backoff
DELAYS=(5 10 20 30 60 60 60 60 60 60)
for delay in "${DELAYS[@]}"; do
  sleep "$delay"
  STATUS=$(curl -sf --request GET \
    --url "https://${AUTH0_TENANT}/api/v2/custom-domains/${DOMAIN_ID}" \
    --header "authorization: Bearer ${AUTH0_TOKEN}" | jq -r '.status')
  echo "Auth0 domain status: ${STATUS}"
  if [ "$STATUS" = "ready" ]; then
    echo "Custom domain ${CUSTOM_DOMAIN} is ready"
    exit 0
  fi
done

echo "Timed out waiting for custom domain to become ready"
exit 1
```

### Multi-environment pattern

Each environment gets its own custom domain. Script once, parametrize:

```text
environments/
  dev/
    AUTH0_TENANT=acme-dev.us.auth0.com
    CUSTOM_DOMAIN=login-dev.example.com
    ROUTE53_HOSTED_ZONE_ID=Z111
  staging/
    AUTH0_TENANT=acme-staging.us.auth0.com
    CUSTOM_DOMAIN=login-staging.example.com
    ROUTE53_HOSTED_ZONE_ID=Z222
  prod/
    AUTH0_TENANT=acme-prod.us.auth0.com
    CUSTOM_DOMAIN=login.example.com
    ROUTE53_HOSTED_ZONE_ID=Z333
```

Invoke the script once per environment, either sequentially in CI or via a matrix build.

### Idempotency

The script above is idempotent **for Route 53** (`UPSERT` creates or updates). For Auth0, creating a custom domain that already exists returns 409. To make the Auth0 step idempotent:

```bash
# Check if the domain already exists
EXISTING=$(curl -sf --request GET \
  --url "https://${AUTH0_TENANT}/api/v2/custom-domains" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | \
  jq -r ".[] | select(.domain == \"${CUSTOM_DOMAIN}\") | .custom_domain_id")

if [ -n "$EXISTING" ]; then
  DOMAIN_ID="$EXISTING"
  echo "Custom domain already exists: ${DOMAIN_ID}"
  # Fetch CNAME value from existing domain
  CNAME_VALUE=$(curl -sf --request GET \
    --url "https://${AUTH0_TENANT}/api/v2/custom-domains/${DOMAIN_ID}" \
    --header "authorization: Bearer ${AUTH0_TOKEN}" | \
    jq -r '.verification.methods[0].record')
else
  # ... create as above
fi
```

### Certificate renewal monitoring

Auth0-managed certs auto-renew every ~3 months. Renewal requires the CNAME to still be in DNS. For periodic monitoring, alert on:

- The domain's `status` field changing from `ready` to anything else (poll `GET /api/v2/custom-domains/{id}`)
- The CNAME disappearing from DNS (check with `dig +short CNAME {domain}`)

The **Check domain health** capability covers both for a one-off check.

---

# Auth0 Custom Domains: DNS Provider Playbook (Router)

Entry point for writing the Auth0 CNAME verification record into the user's DNS provider. This file is a **router**: detect the provider from the root domain's NS records, then open only the matching tier file. Do not load every tier up-front — each tier file is self-contained.

## Provider Detection

### Lookup command

```bash
dig +short NS example.com
```

### NS pattern to provider mapping

| NS pattern | Provider | Tier | Reference |
|------------|----------|------|-----------|
| `*.ns.cloudflare.com` | Cloudflare | 1: Full automation (Cloudflare MCP) | Cloudflare section below |
| `*.awsdns-*.com`, `*.awsdns-*.net`, `*.awsdns-*.org`, `*.awsdns-*.co.uk` | AWS Route 53 | 2: Assisted (AWS CLI) | Route 53 section below |
| `*.azure-dns.com`, `*.azure-dns.net`, `*.azure-dns.org`, `*.azure-dns.info` | Azure DNS | 3: Assisted (Azure CLI) | Azure DNS section below |
| `ns*.domaincontrol.com` | GoDaddy | 4: Manual | Manual Guided section below |
| `dns*.registrar-servers.com` | Namecheap | 4: Manual | Manual Guided section below |
| `ns*.hover.com` | Hover | 4: Manual | Manual Guided section below |
| `ns*.squarespacedns.com` | Squarespace Domains | 4: Manual | Manual Guided section below |
| `curitiba.ns.porkbun.com`, `fortaleza.ns.porkbun.com`, etc. | Porkbun | 4: Manual | Manual Guided section below |
| `ns*.name.com` | Name.com | 4: Manual | Manual Guided section below |
| `*.gandi.net` | Gandi | 4: Manual | Manual Guided section below |
| `ns*.worldnic.com` | Network Solutions | 4: Manual | Manual Guided section below |
| `ns*.ui-dns.*` | IONOS | 4: Manual | Manual Guided section below |
| `ns*.dreamhost.com` | DreamHost | 4: Manual | Manual Guided section below |
| `ns*.googledomains.com` | Google Domains (legacy, migrated to Squarespace) | 4: Manual | Manual Guided section below |
| Anything else | Unknown | 4: Generic manual | Manual Guided section below |

When the NS pattern is unrecognized, fall back to generic Tier 4 instructions in the Manual Guided section below and surface the NS records to the user so they can identify the provider themselves.

## Tier summary

- **Tier 1 — Cloudflare**: fully automated via the Cloudflare MCP. OAuth, no plan tier required, `proxied: false` is critical. See Cloudflare section below.
- **Tier 2 — Route 53**: AWS CLI if credentials are configured. `UPSERT` for create, exact-match DELETE (Name, Type, TTL, Value). Poll `get-change` until `INSYNC`. See Route 53 section below.
- **Tier 3 — Azure DNS**: Azure CLI if signed in. `az network dns record-set cname set-record`. Propagates in <30s. See Azure DNS section below.
- **Tier 4 — Manual**: copy-pasteable record block plus per-registrar dashboard URLs and UI-label cheat sheet. See Manual Guided section below.

## How to use this router

1. Run `dig +short NS <root-domain>` and match against the table above.
2. Find the matching tier section below (Cloudflare / Route 53 / Azure DNS / Manual Guided). Each section is self-contained — it covers plan requirements, pre-flight, create, (if applicable) delete, error handling, and fallback for that one provider.
3. If the automated tier's pre-flight fails (missing MCP, unconfigured CLI, private zone, etc.), each tier section tells you to drop to the Manual Guided section below with a provider-specific deep-link.

If you are handling the **Remove a custom domain** flow, the delete mechanics for Route 53 (exact-match requirement) live in the Route 53 section below. The other tiers delete via the same commands/UIs they create with; no special rules.

---

# Cloudflare (Tier 1: Full Automation)

Cloudflare publishes an official MCP server at `https://mcp.cloudflare.com/mcp` with OAuth browser auth. The server exposes two tools (`search()` and `execute()`) and runs generated JavaScript against a sandboxed Cloudflare API client.

## Plan requirements

DNS management on Cloudflare is **available on every plan including Free**. The `https://mcp.cloudflare.com/mcp` server wraps the same Cloudflare API and needs no paid Cloudflare plan for DNS CRUD. Cloudflare's GitHub README hedges that "some features may require a paid Workers plan"; that applies to MCP features tied to paid products (Workers deploys, Containers, AI Gateway), not DNS.

Free-plan caveats to surface to the user:
- Zones created after September 2024 cap at **200 DNS records per zone**. Auth0's CNAME counts as one; most hobby zones are nowhere near this.
- Free plan minimum TTL is 60 seconds (30 on Enterprise). `ttl: 1` uses Cloudflare's automatic TTL and works on Free.
- Free plan does not allow API tokens with Client IP Address Filtering. The MCP's OAuth flow avoids this.

## Pre-flight check

Confirm the Cloudflare MCP is connected to the user's Claude Code session. If not:

```text
The Cloudflare MCP server isn't connected. Add it with:

  claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp

Then authorize in the browser when Claude prompts you.
```

## Creating the CNAME record

Because Cloudflare's MCP exposes only `search()` and `execute()`, the skill prompts the LLM to generate a small script rather than calling a named tool. The pattern:

1. `search("dns records")` to locate the endpoint
2. `execute()` to run a script that finds the zone ID then creates the record

Script pattern for `execute()`. **Before passing to `execute()`, substitute the three placeholders with real values**: `ROOT_DOMAIN` (e.g., `example.com`), `CUSTOM_DOMAIN` (e.g., `login.example.com`), and `CNAME_TARGET` (the `verification.methods[0].record` value returned by `POST /custom-domains`, NOT the literal string below).

```javascript
// Find the zone ID for the root domain
const zones = await cf.zones.list({ name: "ROOT_DOMAIN" });
if (zones.result.length === 0) {
  throw new Error("Zone ROOT_DOMAIN not found in this Cloudflare account");
}
const zoneId = zones.result[0].id;

// Check for existing record at the target name
const existing = await cf.dns.records.list({
  zone_id: zoneId,
  name: "CUSTOM_DOMAIN",
  type: "CNAME",
});

// Create the CNAME (or update if one already exists; confirm with user first)
if (existing.result.length === 0) {
  return await cf.dns.records.create({
    zone_id: zoneId,
    type: "CNAME",
    name: "CUSTOM_DOMAIN",
    content: "CNAME_TARGET",  // must match verification.methods[0].record exactly
    proxied: false,  // critical: Auth0 verification fails on proxied records
    ttl: 1,  // 1 = automatic, Cloudflare default
  });
} else {
  // Present the existing value and confirm overwrite before calling update()
}
```

## Key constraints

- `proxied` must be `false`. A proxied (orange-cloud) CNAME breaks Auth0 verification and Auth0-managed certificates.
- Minimum TTL is 60s on standard zones, 30s on Enterprise. `ttl: 1` uses Cloudflare's automatic TTL.
- The authenticated token needs `DNS:Edit` scope on the target zone. OAuth flow grants this by default when the user authorizes.
- API tokens with Client IP Address Filtering are not supported by the MCP.

## Fallback

If the Cloudflare MCP can't be used (auth failure, zone not in account, unexpected error), drop to the Manual Guided section below with Cloudflare dashboard deep-link:
`https://dash.cloudflare.com/?to=/:account/:zone/dns/records` (the user needs to know their account and zone; a simpler fallback is `https://dash.cloudflare.com/` and instruct them to navigate).

---

# AWS Route 53 (Tier 2: Assisted Automation)

Uses the AWS CLI. If the user already has AWS credentials configured (env vars, shared config, or SSO session), this tier handles the CNAME creation automatically. Otherwise it falls back to the Manual Guided section below.

## Plan requirements

Route 53 has **no plan tiers**. It's pay-per-use:
- ~$0.50/hosted zone/month for the first 25 zones (lower per-zone after).
- $0.40 per million queries for the first billion (lower after).
- Route 53 is **not included in the AWS free tier**, even on new accounts.
- Default API rate limit is 5 requests/second per account; the skill's verify-poll backoff stays well under this.

What the calling identity needs:
- `route53:ListHostedZonesByName` (read)
- `route53:ListResourceRecordSets` (read)
- `route53:ChangeResourceRecordSets` (write, for create and delete)
- `route53:GetChange` (read, for INSYNC polling)

The `AmazonRoute53FullAccess` managed policy covers all of these; a least-privilege custom policy scoped to the hosted zone ARN is cleaner for production.

## Pre-flight check

```bash
aws sts get-caller-identity
```

If this returns identity info, proceed. If it errors with credentials/expired token, drop to the Manual Guided section below with a Route 53 console deep-link.

## Find the hosted zone

```bash
aws route53 list-hosted-zones-by-name \
  --dns-name example.com \
  --max-items 1
```

Extract the hosted zone ID (strip the `/hostedzone/` prefix). Watch for private vs public zones; Auth0 needs a public zone. If the result is a private hosted zone, fall back to manual with an explanation.

## Create the CNAME record

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "login.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "tenant.edge.tenants.auth0.com"}]
      }
    }]
  }'
```

`UPSERT` creates the record if it doesn't exist and updates it if it does. Before calling, list existing records at the target name and confirm overwrite with the user if one is present with a different value:

```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --start-record-name login.example.com \
  --start-record-type CNAME \
  --max-items 1
```

## Poll until `INSYNC`

The `change-resource-record-sets` response contains a `ChangeInfo.Id`. Poll it:

```bash
aws route53 get-change --id /change/C1234567890ABC
```

The `Status` field returns `PENDING` then `INSYNC`. Wait for `INSYNC` (usually ~60s) before triggering Auth0 verification.

## Delete the CNAME record (the Remove a custom domain flow)

DELETE on Route 53 is stricter than UPSERT: the submitted record must **exactly match** the live record on `Name`, `Type`, `TTL`, and every `Value` in `ResourceRecords`. A mismatched TTL silently fails with `InvalidChangeBatch: Tried to delete resource record set ... but it was not found`. Always fetch the current record first and copy its exact values into the DELETE batch.

```bash
# 1. Read the current record's exact values
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --start-record-name login.example.com \
  --start-record-type CNAME \
  --max-items 1
```

```bash
# 2. Submit the DELETE with exact-match values (substitute TTL and Value from step 1)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "login.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "tenant.edge.tenants.auth0.com"}]
      }
    }]
  }'
```

Poll `get-change` until `INSYNC` to confirm propagation before reporting success.

## Error handling

- `PriorRequestNotComplete`: another change on the same zone is still propagating. Back off and retry (5s, 10s, 20s).
- `InvalidChangeBatch` on DELETE: the submitted record doesn't exactly match the live record. Re-run the list step above and copy the TTL and Value precisely.
- Rate limit: Route 53 allows 5 req/s per account. With the skill's backoff on verify polling, this is not usually a concern.

## Fallback deep-link

If pre-flight fails:
```text
https://console.aws.amazon.com/route53/v2/hostedzones
```
Instruct the user to click their zone, then "Create record".

---

# Azure DNS (Tier 3: Assisted Automation)

Uses the Azure CLI. If the user is signed in, this tier handles the CNAME creation automatically. Otherwise it falls back to the Manual Guided section below.

## Plan requirements

Azure DNS has **no plan tiers**. Any active Azure subscription (pay-as-you-go, EA, CSP, Visual Studio credit, free trial) can host public DNS zones. Pricing is $0.50/zone/month for the first 25 zones (lower after) plus $0.40 per million queries.

What the signed-in identity needs:
- The **DNS Zone Contributor** role on the resource group containing the zone, or
- The broader **Contributor** / **Owner** role on the resource group or subscription.

The `Reader` role alone is insufficient; record-set writes return 403. Default subscription limit is **250 public DNS zones per subscription**, raisable via support.

## Pre-flight check

```bash
az account show
```

If this returns an active subscription, proceed. Otherwise drop to the Manual Guided section below with the Azure portal deep-link.

## Find the DNS zone

```bash
az network dns zone list \
  --query "[?name=='example.com'].{name:name, rg:resourceGroup}" \
  -o json
```

Extract the resource group. If the zone is in a subscription different from the current default, the user may need to run `az account set --subscription <id>` first.

## Create the CNAME record

Azure CLI's record-set create and set-record are separate commands. Use `set-record` which handles both cases:

```bash
az network dns record-set cname set-record \
  --resource-group my-rg \
  --zone-name example.com \
  --record-set-name login \
  --cname tenant.edge.tenants.auth0.com \
  --ttl 300
```

Notes:
- `--record-set-name` is the relative name (`login`), not the full FQDN.
- Azure DNS CNAME record sets can only contain a single record. If one already exists with a different value, you must delete the existing record-set first (confirm with user):

```bash
az network dns record-set cname delete \
  --resource-group my-rg \
  --zone-name example.com \
  --name login \
  --yes
```

## Propagation

Azure DNS propagates quickly (typically <30s). No polling equivalent to Route 53's `INSYNC` check is needed. Proceed directly to Auth0 verification.

## Fallback deep-link

```text
https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FdnsZones
```
Instruct the user to select their zone, then **+ Record set**.

---

# Manual Guided (Tier 4: Everyone Else)

For all other providers, the skill outputs a copy-pasteable record block and provider-specific instructions.

## Record block to output

Show exactly (substitute the Host and Value with the actual values returned by `POST /api/v2/custom-domains` — the block below uses `login` and `tenant.edge.tenants.auth0.com` only as placeholders):

```text
Record type: CNAME
Host / Name: login              (the subdomain portion only, not the full FQDN)
Value / Points to: tenant.edge.tenants.auth0.com
TTL: 300 (or provider default)
Proxy / Orange cloud: OFF / DNS-only
```

Note the "Host" formatting: most providers expect just the subdomain (`login`), but a few expect the full FQDN (`login.example.com`). Call this out in the per-provider instructions below.

## Per-provider cheat sheet

All providers below use the same record values (type CNAME, host is the subdomain only, value is the Auth0-provided CNAME target). Differences are dashboard URL, label naming, and navigation path.

| Provider | Dashboard URL (substitute the root domain) | UI labels (host, value) | Navigation hint |
|---|---|---|---|
| GoDaddy | `https://dcc.godaddy.com/manage/{domain}/dns` | Name, Value | My Products → DNS → Add New Record |
| Namecheap | `https://ap.www.namecheap.com/domains/domaincontrolpanel/{domain}/advancedns` | Host, Value | Domain List → Manage → Advanced DNS → Add New Record |
| Hover | `https://www.hover.com/control_panel/domain/{domain}/dns` | Hostname, Target Host | Account → domain → DNS → Add a Record |
| Squarespace Domains (was Google Domains) | `https://account.squarespace.com/domains/managed/{domain}/dns/dns-settings` | Host, Data | Domains → domain → DNS → DNS settings → Add record |
| Porkbun | `https://porkbun.com/account/domainsSpeedy` | Host, Answer | Domain Management → DNS Records |
| Name.com | `https://www.name.com/account/domain/details/{domain}#dns` | Host, Answer | My Domains → domain → Manage DNS Records |
| Gandi | `https://admin.gandi.net/domain/{domain}/records` | Name, Hostname | Domain → DNS Records → Add |
| Network Solutions | `https://www.networksolutions.com/my-account/` | Alias, Other Host | Manage → domain → Change Where Domain Points / Advanced DNS |
| IONOS | `https://my.ionos.com/dns` | Host name, Points to | Domains & SSL → domain → DNS |
| DreamHost | `https://panel.dreamhost.com/index.cgi?tree=domain.manage` | Name, Value | Manage Domains → DNS (for the domain) |

Common gotchas across providers:
- Host field is the subdomain only (`login`), never the full FQDN, unless the provider explicitly shows "@" or the full domain as the default.
- Some dashboards default TTL to 1 hour; 300 seconds is fine, longer is fine.
- No provider above requires a proxy toggle, but if one exists (e.g., proxied CDN), it must be off.

### Unknown provider

If NS records don't match any known pattern, output:

```text
Your DNS appears to be hosted at {nameserver domain}. Log in to that provider's
dashboard and look for "DNS", "DNS Records", "Advanced DNS", or "Zone Editor".
Add a new CNAME record with the values above.
```

## After the user confirms

Ask: "Reply 'done' when you've added the record, or 'skip' to give up for now."

On "done", proceed to Auth0 verification in SKILL.md Step 3. On "skip", save the CNAME target value and `custom_domain_id` to the conversation so they can resume later.

If verification fails, first suggest `dig CNAME login.example.com` and compare the result to the expected target.

---

# Set Up a Custom Domain

End-to-end provisioning: create the domain in Auth0, write the CNAME into the user's DNS provider, verify ownership, and report what to update in their apps. Handles both the first custom domain on a tenant and adding another one to a tenant with MCD already enabled.

## Gather inputs

Ask questions one at a time as plain conversational text. Do not present all inputs at once or use structured UI widgets. Sequence:

1. **Domain hostname**: Ask directly — "What hostname do you want to set up? (e.g., `login.example.com`)" — and wait for the reply.

2. **Certificate type**: Default to `auth0_managed_certs` silently. Only ask if the user has given a signal they need self-managed (Enterprise reverse-proxy setup). Mention once that type is fixed at create time.

3. **Passkey / RPID plan**: Skip this question entirely. For subdomains, include `relying_party_identifier` (eTLD+1) speculatively in the create call — it's almost always the right default and there is no probe endpoint to check the feature flag in advance. If the create returns `operation_not_supported`, retry without it and tell the user: "The `relying_party_identifier` feature isn't enabled on this tenant. The domain was created without it. Contact Auth0 support to enable the flag; RPID can be set via PATCH once it's on." For root-domain custom domains, omit `relying_party_identifier` entirely — passkeys bind to the root automatically.

4. **Reverse proxy**: Ask only if there's a signal the tenant is behind a proxy. "Is Auth0 behind a reverse proxy (Cloudflare, CloudFront, Azure Front Door)? If so, I'll set the client IP header so rate limiting sees the real IP." Default to no header.

5. **TLS policy**: Do not ask. Default to `recommended` silently unless the user raises a compliance requirement.

6. **Tenant confirmation**: Run `auth0 tenants list`, show the active tenant, and ask for confirmation before creating. This is the one place a yes/no confirmation is required.

## Create the domain in Auth0

Minimal create (Auth0-managed certs, defaults everywhere):

```bash
auth0 api post "custom-domains" --data '{
  "domain": "login.example.com",
  "type": "auth0_managed_certs"
}'
```

Full-featured create with optional fields (omit any that don't apply):

```bash
auth0 api post "custom-domains" --data '{
  "domain": "login.example.com",
  "type": "auth0_managed_certs",
  "verification_method": "txt",
  "tls_policy": "recommended",
  "custom_client_ip_header": "cf-connecting-ip",
  "relying_party_identifier": "example.com",
  "domain_metadata": {
    "region": "us-east",
    "brand": "acme"
  }
}'
```

Notes on the optional fields:
- `verification_method`: default is derived from `type` (CNAME for Auth0-managed, TXT for self-managed). Only set it if explicitly overriding.
- `tls_policy`: default `recommended`; no reason to set unless compliance requires.
- `custom_client_ip_header`: one of `true-client-ip`, `cf-connecting-ip`, `x-forwarded-for`, `x-azure-clientip`. Match the header the proxy in front of Auth0 emits.
- `relying_party_identifier`: set when the custom domain is a subdomain but passkeys should bind to the parent domain.
- `domain_metadata`: up to 10 key-value pairs (keys and values ≤ 255 chars); surfaces in Actions.

The response contains `custom_domain_id`, `status: "pending_verification"`, and `verification.methods[0].record`: the CNAME value to put in DNS. Save these.

**If the API returns 400 with `operation_not_supported` on `relying_party_identifier`**: the feature flag is not enabled on this tenant. Retry the create without `relying_party_identifier`, then tell the user: "The `relying_party_identifier` feature isn't enabled on this tenant. Domain created without it. Contact Auth0 support to enable the flag; RPID can be set via PATCH once it's on."

**If the API returns 403**: the tenant is a Free tenant without a credit card on file. Direct the user to **Dashboard → Tenant Settings → Billing** (or the Teams section for Teams-managed tenants) to add a card, then retry. The card is not charged. This is the correct diagnosis on Free tier; do not suggest a plan upgrade.

**If the API returns 409**: the domain already exists on this or another tenant. `auth0 api get "custom-domains"` to list existing. If it's already on this tenant and just needs verification, skip to the verify step below with the existing `custom_domain_id`.

See the Examples section below for curl, node-auth0, and auth0-python code patterns.

## Detect the DNS provider and route to a tier

```bash
dig +short NS example.com
```

Match the NS pattern against the table in the DNS Provider Playbook section below to select a tier, then follow the matching provider section:

- **Tier 1 Cloudflare** → Cloudflare section below (full automation via Cloudflare MCP)
- **Tier 2 AWS Route 53** → Route 53 section below (assisted via AWS CLI)
- **Tier 3 Azure DNS** → Azure DNS section below (assisted via Azure CLI)
- **Tier 4 other** → Manual Guided section below (guided manual record entry)

Each sub-file is self-contained (plan requirements, pre-flight, create, error handling, fallback). Don't load every tier — load only the one that matches the detected NS pattern. Return here for the verify step once the record is written.

## Check for an existing record at the target name

Before writing, check what's already there:

```bash
dig +short CNAME login.example.com
```

Three outcomes:
1. **No record**: proceed with the write.
2. **Record matches the expected value**: skip the write, go straight to verify.
3. **Record exists with a different value**: confirm with the user before overwriting. Show both values. On Tier 2 (Route 53) the `UPSERT` action will overwrite silently, so the confirmation has to happen in the skill, not the CLI.

## Write the CNAME record

Execute the tier-specific flow from the sub-file you opened above. For Tiers 2 and 3, wait for the provider to report propagation complete (Route 53: `INSYNC`; Azure: proceed after ~30s) before triggering Auth0 verification. For Tier 4, wait for the user to reply "done."

## Trigger Auth0 verification

```bash
auth0 api post "custom-domains/<domainId>/verify"
```

## Poll until ready

Poll `GET /api/v2/custom-domains/<domainId>` with backoff: 5s, 10s, 20s, 30s, 60s, 60s... up to ~10 minutes total. Stop when `status` becomes `ready`.

If the polling window expires with status still `pending_verification`: route to the **Troubleshoot verification** flow rather than retrying blindly.

## Report next steps

On success, tell the user what they need to update in their applications:

```text
Custom domain login.example.com is verified and ready.

Next steps (outside this skill's scope):
  • SDK config: change the `domain` / `issuerBaseURL` value to login.example.com
    in every application SDK
  • Application callback URLs: update any URLs that reference the old tenant
    domain
  • Passkey rpId: if using passkeys, confirm rpId matches the eTLD+1 of the
    custom domain
  • SAML / WS-Fed metadata URLs: regenerate and redistribute

Full guide: https://auth0.com/docs/customize/custom-domains/configure-features-to-use-custom-domains
```

If the tenant now has multiple custom domains for the first time, mention that they may want to set a default via the Manage existing domains flow.

## MCD: adding a domain to a tenant that already has one

The flow above is identical whether this is the tenant's first custom domain or the Nth. A few things to mention when MCD is in play:

- The new domain gets its own `custom_domain_id`, CNAME verification record, and certificate lifecycle.
- Consider setting a default custom domain after adding the second domain (the Manage existing domains flow). Without a default, notification-triggering Management API calls route through the tenant domain unless the caller sends the `auth0-custom-domain` header. See the Advanced Topics section below.
- MCD is Enterprise-only with a base of 20 domains per tenant. If the user is on a non-Enterprise plan, creating a second domain returns a 403 with a different error than the Free-tier CC case; surface the full error body so the user knows which limit they hit.

## Edge cases to handle during setup

- **Private hosted zone (Route 53)**: if `list-hosted-zones-by-name` returns a private zone, fall back to Tier 4; Auth0 verification needs a public zone.
- **Apex vs subdomain**: the CNAME always goes into the zone of the root domain, at the subdomain name. If the user asked for a custom domain at the apex (e.g., `example.com` itself), DNS doesn't permit a real CNAME at the apex; suggest a subdomain instead or use ALIAS/ANAME records where supported.
- **Shared parent zone with delegation**: if the apex is delegated to a different provider than the subdomain, check the NS records for the subdomain specifically, not just the root.

---

# Manage Existing Domains

Surgical edits on custom domains that already exist: list them, set or change the default, update TLS policy, configure the custom client IP header, set the relying party identifier for passkeys, and manage per-domain metadata. Intent-driven: the user says what they want in natural language and the skill maps it to the right API call.

**Not in scope here: changing certificate type.** The Management API rejects `type` on PATCH. `type` is fixed at create time. If the user wants to switch between `auth0_managed_certs` and `self_managed_certs`, route them to delete (**Remove a custom domain**) and recreate (**Set up a custom domain**). Coordinate the DNS and reverse-proxy cutover to avoid auth downtime.

## Pre-flight: confirm the active tenant

Before any PATCH or tenant-settings write, confirm the active Auth0 CLI tenant matches the one the user intends to modify. The Auth0 CLI is single-tenant; an unnoticed mismatch writes to the wrong tenant.

```bash
auth0 tenants list
```

Surface the active tenant to the user and require explicit confirmation ("the active tenant is `acme-prod`; proceed?"). If it's wrong, stop and have the user run `auth0 tenants use <tenant-name>`, then re-confirm before continuing.

## Load current state

After tenant confirmation, fetch the current custom domain list once. Cache it for the session so disambiguation prompts can show current values.

```bash
auth0 api get "custom-domains"
```

Also fetch tenant settings for the current default:

```bash
auth0 api get "tenants/settings"
```

Look at the `default_custom_domain_id` field.

## Intent mapping

Common user phrasings and what they map to:

| User says | Target |
|---|---|
| "list my custom domains" / "what domains do I have?" | Show the cached list: domain, status, cert type, default flag |
| "make {domain} the default" / "set default to {domain}" | `PATCH /tenants/settings` with `default_custom_domain_id` |
| "which one is the default?" | Read from cached tenant settings |
| "switch {domain} to self-managed" / "switch {domain} back to Auth0-managed" / "change cert type on {domain}" | Not supported via PATCH. Explain that `type` is fixed at create, and route to **Remove a custom domain** + **Set up a custom domain** to do a delete + recreate. Warn about downtime |
| "set the rpId on {domain} to example.com" / "bind passkeys at the root" / "change the passkey rpId" | See **Set the relying party identifier (passkeys)** below |
| "what's the rpId for {domain}?" / "where do passkeys bind for {domain}?" | Read `relying_party_identifier` from cached state; if unset, explain default is the domain hostname |
| "set the TLS policy to recommended" / "change TLS policy on {domain}" | See **Update TLS policy** below |
| "set the client IP header to cf-connecting-ip" / "Auth0 is behind Cloudflare, use the right IP header" | See **Configure the custom client IP header** below |
| "show me the CNAME value for {domain}" | Read `verification.methods[0].record` from cached state |
| "what's the status of {domain}?" | Read `status` from cached state |
| "add metadata to {domain}" / "tag {domain} with {key}={value}" | See **Manage domain metadata** below |
| "what metadata is on {domain}?" / "show metadata for {domain}" | Read `domain_metadata` from cached state |
| "remove the {key} metadata from {domain}" | See **Manage domain metadata** below |

For intents that don't match, ask the user to restate more specifically and list the supported operations.

## What PATCH accepts

The Management API accepts these fields on `PATCH /custom-domains/{id}`:

- `tls_policy`
- `custom_client_ip_header`
- `relying_party_identifier`
- `domain_metadata`

The API **rejects** `type`, `domain`, `verification_method`. To change any of those, delete and recreate.

## Set or change the default

```bash
auth0 api patch "custom-domains/default" --data '{"domain": "login.example.com"}'
```

The Auth0 CLI does not have a dedicated `auth0 domains default` subcommand; use the API passthrough above.

Effects to explain to the user:
- Notification-triggering Management API calls (password reset tickets, verification emails) will route through this domain when no `auth0-custom-domain` header is sent.
- Email template links will use this domain by default.
- Does not affect the `iss` claim on tokens issued for other custom domains on the same tenant; that's still determined per-request.

Before applying, show the diff: `current default: {value or "(none)"}` → `new default: {new value}`.

## Set the relying party identifier (passkeys)

`relying_party_identifier` controls what domain passkeys bind to. Default (when unset) is the custom domain hostname itself. Set it explicitly when the custom domain is a subdomain but you want passkeys usable at the parent domain.

### When users want this

- Custom domain is `login.example.com`, but the app also runs at `www.example.com` and a native iOS app with Associated Domains. Setting `relying_party_identifier: "example.com"` lets a passkey created during login work across all three surfaces.
- A B2B tenant serves multiple subdomains per customer and wants passkeys bound to the shared parent zone.

The RPID must be a registrable suffix of the custom domain (you can't set `google.com` as the RPID of `login.example.com`). WebAuthn / passkey clients enforce this at registration time.

### Execute the PATCH

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "relying_party_identifier": "example.com"
}'
```

Before sending, show the diff: `current rpId: {value or "(default: domain hostname)"}` → `new rpId: {new value}`.

### Consequences to explain

- **Passkeys already registered against the old RPID stop working.** WebAuthn credentials are bound to the RPID at registration and cannot be re-mapped. Users with existing passkeys will need to register new ones on next login. Mention this before executing.
- No DNS changes required. No re-verification needed. The change takes effect on the next authentication.

### Clearing the RPID

To revert to the default (RPID = custom domain hostname), PATCH with `null`:

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "relying_party_identifier": null
}'
```

## Update TLS policy

`tls_policy` governs the TLS posture for Auth0-managed certificate domains. Default and recommended value is `"recommended"`. Only set explicitly when a compliance mandate requires a specific policy.

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "tls_policy": "recommended"
}'
```

No DNS change, no re-verification. Takes effect on the next handshake.

## Configure the custom client IP header

`custom_client_ip_header` tells Auth0 which request header carries the real client IP when traffic reaches Auth0 through a reverse proxy. Without this set, rate limiting and anomaly detection see the proxy's IP, not the end user's.

### Valid values

- `true-client-ip` — generic reverse proxy; Akamai uses this
- `cf-connecting-ip` — Cloudflare
- `x-forwarded-for` — most generic proxies, load balancers
- `x-azure-clientip` — Azure Front Door

Pick the value that matches what the proxy in front of Auth0 emits. Only one value at a time. If unsure, check the proxy's documentation for which header it populates with the original client IP.

### Execute the PATCH

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "custom_client_ip_header": "cf-connecting-ip"
}'
```

To clear, PATCH with `null`:

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "custom_client_ip_header": null
}'
```

No DNS change, no re-verification. Takes effect on the next request.

### Safety note

Only set this when there really is a trusted proxy in front of Auth0. If no proxy is injecting the header, an attacker can spoof the configured header to forge client IPs for rate-limit / anomaly bypass. The correct pattern: the proxy strips any incoming instance of the header from the public internet and re-emits it with the true source IP.

## Manage domain metadata

Each custom domain can carry up to **10 key-value pairs** as `domain_metadata`, with keys and values limited to **255 characters each** (Auth0's standard metadata convention, matching user `app_metadata` / application metadata / session metadata).

### Why users set domain metadata

The primary use case is feeding context to Auth0 Actions. Actions triggers expose `event.custom_domain.domain_metadata` on several flows (post-login, credentials-exchange, send-phone-message, custom email providers). Common patterns:

- Region tagging (`region: us-east`, `region: eu-west`) for routing in Actions
- Brand tagging (`brand: acme`, `brand: widgetco`) for multi-brand MCD tenants
- Environment tagging (`env: prod`, `env: staging`) for per-env behavior
- Partner / customer identifiers for B2B flows

Set the tag once on the domain; every authentication that hits that domain surfaces the tag to Actions without needing an extra lookup.

### Read current metadata

Metadata is returned as `domain_metadata` on the domain object. Load once at the start of the Manage existing domains flow (see top of this file); no extra call needed.

```bash
auth0 api get "custom-domains/<domainId>"
```

### Add or update metadata (canonical pattern: GET → merge → PATCH)

Always read current metadata, merge the user's changes into it locally, and PATCH the full merged object. This is correct under any PATCH semantics (shallow-merge or full-replace) and is the pattern to use every time:

1. GET current `domain_metadata` from the domain object (already cached from the start of this flow).
2. Merge the user's changes into the existing object client-side.
3. PATCH the full merged object.

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "domain_metadata": {
    "region": "us-east",
    "brand": "acme"
  }
}'
```

The body above should contain the full post-merge object, not just the changed keys.

### Remove a key

Omit the key from the merged object and PATCH the full result. Don't rely on `null`-as-delete — submit only the keys that should remain.

```bash
# Current: { "region": "us-east", "brand": "acme" }
# User wants to drop "brand":
auth0 api patch "custom-domains/<domainId>" --data '{
  "domain_metadata": {
    "region": "us-east"
  }
}'
```

To clear all metadata, PATCH with an empty object:

```bash
auth0 api patch "custom-domains/<domainId>" --data '{
  "domain_metadata": {}
}'
```

### Constraints to enforce in the skill

Before any PATCH that writes metadata, check:
- Total keys after the write must be **≤ 10**. If the user tries to add an 11th, refuse and list the current keys so they can choose which to drop.
- Each key must be **≤ 255 characters**.
- Each value must be **≤ 255 characters**.
- Keys cannot contain UTF-8 private-use characters (Auth0 metadata convention).

If any constraint would be violated, block the write and surface the specific violation; don't rely on the API error message.

### Display format

When the user asks to see metadata:

```text
Metadata on login.example.com (2/10 keys used):

  region   us-east
  brand    acme
```

If no metadata is set, say that explicitly rather than showing an empty block.

## List output format

When the user asks "list" or "show my domains":

```text
Custom domains on this tenant (3):

  login.example.com         ready                 Auth0-managed  DEFAULT
  login-eu.example.com      ready                 Auth0-managed
  login-legacy.example.com  pending_verification  Self-managed

  (run the Troubleshoot verification flow to troubleshoot login-legacy.example.com)
```

## Batch multiple changes

If the user requests several changes in one session ("set the rpId on A to example.com, make B the default, add metadata to C"), stage them and apply as a batch. Show the consolidated diff before executing. Per-domain fields (`tls_policy`, `custom_client_ip_header`, `relying_party_identifier`, `domain_metadata`) can all be merged into a single PATCH per domain to avoid multiple round-trips.

For deletes, route to the Remove a custom domain flow rather than handling here. For cert-type changes, the API rejects `type` on PATCH; route to delete + recreate.

## Scope note

Changes made here don't write to DNS. None of the supported PATCH fields (`tls_policy`, `custom_client_ip_header`, `relying_party_identifier`, `domain_metadata`) change the CNAME or TXT verification record, so no re-verification is needed after any operation here.

---

# Check Domain Health

Read-only diagnosis of the tenant's custom domain configuration. No writes. Answers: "is my setup still working?" and "what would block me from doing X?"

This is the safe starter capability. Run it before other capabilities when the user isn't sure what's wrong or just wants a status check.

## Pre-flight: surface the active tenant

Even though this capability is read-only, the data the user sees depends entirely on which tenant the Auth0 CLI is pointed at. Show it explicitly so the report header is unambiguous.

```bash
auth0 tenants list
```

Surface the active tenant to the user and confirm it's the one they want checked. If it's wrong, have them run `auth0 tenants use <tenant-name>`, then proceed. Include the tenant name in the final health report so the output is self-describing.

## Checks (run in parallel)

### 1. List custom domains on the tenant

```bash
auth0 api get "custom-domains"
```

Pull for each: `domain`, `custom_domain_id`, `status`, `type`, `primary`.

### 2. Fetch the tenant default

```bash
auth0 api get "tenants/settings"
```

Read `default_custom_domain_id`. Cross-reference against the domain list from check 1.

### 3. For each domain, compare DNS to expected

For each domain in the list, dig the CNAME and compare to the expected verification record. The expected value is in `verification.methods[0].record` on each domain object.

```bash
dig +short CNAME login.example.com
```

For self-managed domains, the expected record is a TXT, not a CNAME:

```bash
dig +short TXT login.example.com
```

### 4. Check NS resolution from an external resolver

Cross-check the user's local resolver against a public resolver to catch propagation lag:

```bash
dig +short @8.8.8.8 CNAME login.example.com
```

Mismatch between local and external means propagation is in progress; the domain may show `ready` in Auth0 but some clients won't yet see the right record.

### 5. Reachability and TLS certificate probe

`status: ready` in Auth0 confirms Auth0's side is wired up, but it doesn't confirm the domain is reachable from the public internet right now, or that the TLS handshake succeeds. A proxy/CDN misconfiguration, a firewall rule, or an expired cert on a self-managed setup will all pass check 3 and still be broken for end users.

For each `ready` domain, probe HTTPS:

```bash
curl -sS -o /dev/null -w "%{http_code} %{ssl_verify_result}\n" \
  --max-time 10 "https://login.example.com/"
```

Expected: a `200`, `302`, or `404` with `ssl_verify_result: 0`. Any of these confirms TLS handshake succeeded and Auth0 responded. Problem signals:
- **Timeout** or connection refused: a proxy/firewall is blocking, or the DNS points somewhere Auth0 no longer serves.
- **`ssl_verify_result` non-zero, or curl returns SSL error**: cert is expired, mismatched, or self-signed. On Auth0-managed, this usually means renewal has failed — check 6 below.
- **Response from a non-Auth0 origin** (e.g., a WAF block page, a "site not found" page from a CDN): the CNAME is correct but an in-path proxy is intercepting.

Also fetch the cert's expiry so the report can surface upcoming renewals or detect failed renewals:

```bash
echo | openssl s_client -connect login.example.com:443 -servername login.example.com 2>/dev/null \
  | openssl x509 -noout -dates
```

Report `notAfter`. For Auth0-managed certs, normal lifecycle is ~90 days; a `notAfter` within 14 days on a `ready` domain that looks DNS-healthy is normal (renewal is imminent). A `notAfter` in the past or within 48 hours with no sign of a new cert is a renewal failure — flag it.

### 6. Flag silent renewal-breakers on `ready` domains

A domain that's `ready` today can still fail certificate renewal in the next ~3-month cycle if DNS was touched after initial verification. The signals for this are already captured in checks 3 and 5; promote them to a distinct renewal-risk line in the report when present:

- DNS mismatch on a `ready` domain (check 3 ✗): the record was removed or changed post-verification. Renewal will fail at the next cycle.
- Proxied / orange-cloud CNAME on a `ready` domain: the live record looks like a CDN hostname instead of `edge.tenants.auth0.com`. Detect by inspecting the CNAME resolution chain.
- Cert `notAfter` in the past on a `ready` domain (check 5): renewal has already failed.

These cases are not reachable-today failures but they will page someone in a future on-call shift; the health check is the right place to surface them early.

### 7. Credit-card-on-file note (Free tier only)

Do not probe speculatively by attempting a create. If the tenant has zero custom domains and the user is asking whether adding one will work, mention the Free-tier requirement in the output report:

```text
Note: Free-tier tenants need a credit card on file at
Dashboard → Tenant Settings → Billing to create custom domains. The card is
not charged. If custom domain creation returns 403, this is usually the cause.
```

## Output format

Structured checklist with pass/fail/warn per item. Lean on visual contrast (✓, ✗, ⚠) and keep the output scannable:

```text
Tenant: acme-prod

Custom domains (3):

  login.example.com                 ✓ ready
    DNS match                       ✓ CNAME → tenant.edge.tenants.auth0.com
    Reachability (HTTPS)            ✓ 302, TLS valid
    Cert expires                    2026-08-03 (90 days)
    Certificate type                Auth0-managed
    Default for tenant              ✓ YES

  login-eu.example.com              ⚠ ready, but renewal at risk
    DNS match                       ✗ CNAME now points to a Cloudflare proxy
    Reachability (HTTPS)            ✓ 302, TLS valid
    Cert expires                    2026-06-10 (36 days)
    Certificate type                Auth0-managed
    Default for tenant              no
    ⚠ DNS was changed after verification; next renewal will fail

  login-legacy.example.com          ⚠ pending_verification
    DNS match                       ✗ no CNAME found at login-legacy.example.com
    Reachability (HTTPS)            ✗ connection refused
    Certificate type                Self-managed
    Default for tenant              no

Tenant settings:
  Default custom domain             ✓ login.example.com

Summary:
  • 1 of 3 domains fully healthy
  • login-eu.example.com: DNS change will break the next cert renewal → run Troubleshoot verification to restore the record
  • login-legacy.example.com: never finished verifying → run Troubleshoot verification
```

## Interpreting results

- **`ready` + DNS ✓ + reachable ✓ + cert valid**: healthy. Auth0-managed renewal will happen on schedule.
- **`ready` + DNS ✗ (any reason: missing, proxied, flattened)**: reachable today, but Auth0 can't re-validate at the next renewal cycle (~90 days). Flag as renewal-at-risk; route to Troubleshoot verification to restore the record now.
- **`ready` + DNS ✓ + reachable ✗**: Auth0's side is correct but something in-path is blocking (firewall, WAF, proxy misroute). Look at the curl error and the CNAME resolution chain to pinpoint.
- **`ready` + cert `notAfter` in the past**: renewal has already failed. This is an active outage for TLS clients, even if `status` still reads `ready`. Route to Troubleshoot verification; contact support if the record is correct and cert still won't renew.
- **`pending_verification` + DNS ✓**: record is correct but Auth0 hasn't finished verifying, or verification was never triggered. If it's been more than a few minutes, route to Troubleshoot verification.
- **`pending_verification` + DNS ✗**: record is missing. Route to Set up a custom domain (from the "write the record" step) to put it back, then verify.
- **`disabled`**: rare; indicates an internal state mismatch. Usually requires support.

## When to recommend other capabilities

Use the health check output to point the user to the next capability:

- DNS mismatch or verification failure → the Troubleshoot verification flow
- `ready` domain flagged renewal-at-risk (DNS changed post-verification, proxied CNAME, cert nearing/past expiry) → the Troubleshoot verification flow, now rather than later
- Reachability ✗ despite correct DNS → the Troubleshoot verification flow; start from in-path proxies and firewalls
- No default set and multiple domains → the Manage existing domains flow
- Domains in `pending_verification` past normal window → the Troubleshoot verification flow
- User wants to add another domain or clean up an unused one → the Set up a custom domain flow or the Remove a custom domain flow

---

# Troubleshoot Verification

A custom domain that's stuck in `pending_verification`, or verification that keeps failing. Walks a diagnostic ladder; fixes what's fixable; falls back to waiting or opening a support ticket when nothing else works.

## Inputs

- The `custom_domain_id` or the domain name (look up the ID via `auth0 api get "custom-domains"` if only the name is known).
- Confirmation that the user has already gone through the Set up a custom domain flow at some point (if not, route them to the Set up a custom domain flow first).

## Pre-flight: surface the active tenant

Before reading domain state or retrying verification, show the active Auth0 CLI tenant to the user. The CLI is single-tenant, and troubleshooting a domain on the wrong tenant will produce confusing results (404 on the ID, or a different domain's verification state).

```bash
auth0 tenants list
```

Surface the active tenant and ask the user to confirm it is the one hosting the broken domain. If it's wrong, stop and have them run `auth0 tenants use <tenant-name>`, then re-confirm before loading state. This applies even for read-only diagnostic calls — wrong-tenant reads waste time and mislead; the retry-verify call at the end is an actual write that must hit the right tenant.

## Get the current state from Auth0

```bash
auth0 api get "custom-domains/<domainId>"
```

From the response, pull:
- `status` (should say `pending_verification` or `disabled`)
- `verification.methods[0].record` (the expected CNAME value)
- `verification.methods[0].domain` (the name the record should sit at, typically the custom domain itself)
- `type` (Auth0-managed vs self-managed; if self-managed, the verification is TXT not CNAME)

## Diagnostic ladder

Run these checks in order. Stop at the first one that identifies a problem; fix it; retry verification; if still stuck, continue to the next check.

### 1. Compare actual DNS to expected

```bash
dig +short CNAME login.example.com
```

Compare the result to `verification.methods[0].record`. Common mismatches:

- **Typo**: one character off. Fix in the DNS provider and wait for propagation.
- **Trailing dot difference**: `tenant.edge.tenants.auth0.com.` vs `tenant.edge.tenants.auth0.com`. Both are technically valid in DNS but some registrars are picky. Try removing the trailing dot if present.
- **Empty result**: no CNAME exists at the target name. The record was never added or was deleted. Route back to the Set up a custom domain flow from the "write the CNAME" step.
- **Completely different value**: another record exists at that name (maybe pointing to a previous provider or an internal service). Confirm with user before replacing.

### 2. Check for DNS proxy

If the result of `dig` looks like a generic CDN hostname (Cloudflare, Fastly, Akamai) rather than the `edge.tenants.auth0.com` pattern, the record is likely behind a proxy:

- **Cloudflare orange cloud**: In the Cloudflare dashboard, the record must be DNS-only (grey cloud), not proxied (orange). Tell the user to toggle it off. Or, if Cloudflare MCP is connected, update `proxied: false` directly.
- **Other proxies**: Any CDN or reverse proxy layered on the CNAME will break Auth0 verification and certificate renewal. The record needs a direct DNS CNAME pointing at the Auth0 edge hostname.

### 3. Check for CNAME flattening

Some providers (Cloudflare, Gandi LiveDNS, others) optionally flatten CNAMEs at the apex or across records. Flattening rewrites the CNAME to A/AAAA records at resolution time, which breaks what Auth0 sees.

- Ask the user to check their zone settings for any "CNAME flattening" or "CNAME at apex" option.
- This is zone-level, not per-record, so the user has to toggle it at the zone.

### 4. Check for conflicting record types

Per DNS RFC, a CNAME cannot coexist with other record types at the same name. If there's an A, AAAA, MX, or TXT record at the target name, the CNAME may be silently dropped or fail to create:

```bash
dig login.example.com ANY
```

If other records are present, either delete them (if not in use) or pick a different subdomain for the custom domain.

### 5. Check propagation state

Fresh records can take 5-60 minutes to propagate. Cross-check with a non-local resolver:

```bash
dig +short @8.8.8.8 CNAME login.example.com
dig +short @1.1.1.1 CNAME login.example.com
```

If these return the correct value but the user's local resolver doesn't, propagation is still in progress. Wait 15-30 minutes and retry verification.

### 6. Check for private-zone issue (Route 53)

On AWS Route 53, private hosted zones are resolvable only from within a VPC. If the user's root domain is managed in a private hosted zone, Auth0 can't see the record from the public internet:

```bash
aws route53 list-hosted-zones-by-name --dns-name example.com --max-items 5
```

Look for a `PrivateZone: true` entry. If that's the zone the record went into, the fix is to move the record to a public zone or delegate the subdomain to a public zone.

### 7. Retry verification

After applying a fix, trigger verification:

```bash
auth0 api post "custom-domains/<domainId>/verify"
```

Then poll for up to ~5 minutes:

```bash
auth0 api get "custom-domains/<domainId>"
```

## What not to do

- **Do not delete and recreate the domain.** This resets the provisioning state and can cause a service interruption for tokens already issued. If the user mentions they've already done this once or twice, ask them to stop and wait.
- **Do not retry verification in a tight loop.** Auth0 rate-limits verification attempts. The 5-10-20-30-60 second backoff is the right pattern.

## When to open a support ticket

Recommend the user file a support ticket if:
- The CNAME is correct in DNS from multiple external resolvers, not proxied, not flattened, and verification has been failing for 24+ hours
- Multiple create/delete cycles have been performed (the domain may be in a state only support can resolve)
- The domain status is `disabled` rather than `pending_verification` (rare; indicates an internal state mismatch)

For general guidance beyond this ladder, see the Verification Troubleshooting section in Advanced Topics below.

---

# Remove a Custom Domain

Delete a custom domain from Auth0 and clean up the CNAME record in the user's DNS. Destructive; always confirm before executing and warn about dependent systems.

## Inputs

- The domain name or `custom_domain_id` to remove.
- Tenant context.

## Pre-flight: confirm the active tenant

Delete is irreversible. Before anything else, confirm the Auth0 CLI is pointed at the intended tenant.

```bash
auth0 tenants list
```

Show the active tenant to the user and require explicit confirmation ("about to delete from `acme-prod`; confirm?"). If wrong, stop and have the user run `auth0 tenants use <tenant-name>`, then re-confirm. Deleting from the wrong tenant is not recoverable; the domain and its certificate state are gone.

## Safety checks before deleting

Run these in parallel. Report every flag that comes up; let the user confirm with full awareness.

### 1. Is this the default custom domain?

```bash
auth0 api get "tenants/settings"
```

If `default_custom_domain_id` matches the domain being deleted, warn:

```text
login.example.com is the default custom domain for this tenant. Deleting it
means notification-triggering Management API calls will route through
your-tenant.auth0.com until you set a new default via the Manage existing domains flow.
```

The user can proceed anyway, but they should plan to set a new default right after.

### 2. Is this the only custom domain?

```bash
auth0 api get "custom-domains"
```

If the list has only this one domain, warn:

```text
This is the only custom domain on the tenant. After deletion, all traffic will
use your-tenant.auth0.com. Apps and SDKs currently pointing at
login.example.com will start failing with iss claim mismatches.
```

### 3. Are applications or tenant settings referencing this domain?

There is no single Management API call that surfaces "everything that references this domain." What we can scan is partial; what we can't scan has to be hand-checked. Default behavior: **do not scan**. Show the user the full list of places a reference could live, and let them choose.

#### Show the reference-sites list and ask

Output a complete inventory of surfaces the domain could appear on, grouped by whether the scan can reach them. Then ask which scan tier to run.

```text
Before deleting login.example.com, here's where a reference to it could live:

Reachable via Auth0 Management API:
  • Application client configurations (callbacks, logout URLs, web origins, allowed origins, initiate_login_uri, client_metadata)
  • Tenant settings (support_url, default_redirection_uri, change_password.html, guardian_mfa_page.html, error_page.url)
  • Email provider default "from" address
  • Email template "from" and "body" fields (per-template overrides)
  • Actions code
  • Rules code (legacy)
  • Hooks code (legacy)
  • Branding page templates (Liquid)
  • Organizations (branding logo URLs)
  • Connections (options: login URLs, custom scripts, enterprise IdP URLs)
  • Resource server identifiers
  • Log stream webhook URLs
  • Prompt / ACUL custom text

Not reachable by the skill (you'll need to check these yourself):
  • SDK configurations in your applications (domain / issuerBaseURL)
  • JWT validators in backend APIs (iss claim allowlist)
  • SAML SP metadata saved at any service provider that federates here
  • Terraform / IaC / CI-CD config
  • External tools (monitoring, Zapier, Slack bots, scripts)
  • Email DNS records (SPF / DKIM / DMARC) if the from address embeds the custom domain

Three options:
  1. Skip the scan (I've already checked; proceed to confirm)
  2. Quick scan (clients, tenant settings, email provider + templates — ~1-3s on typical tenants, ~5-10s on large enterprise tenants)
  3. Deep scan (everything in the Reachable list above — slower, noisier, more false positives)

Which one?
```

Wait for the user to choose. Default posture: assume option 1 unless the user asks for a scan — it's their audit to run.

#### Option 1: skip

Proceed to **Confirm**.

#### Option 2: quick scan (tier 1)

Fire these in parallel. Stop and report as soon as they all return.

| Call | Field(s) to grep for the custom domain |
|---|---|
| `GET /clients` (paginated, fan out across pages in parallel once page 1 reveals total) | `callbacks`, `allowed_logout_urls`, `web_origins`, `allowed_origins`, `initiate_login_uri`, JSON-stringified `client_metadata` |
| `GET /tenants/settings` | `support_url`, `default_redirection_uri`, `change_password.html`, `guardian_mfa_page.html`, `error_page.url` |
| `GET /emails/provider` | `default_from_address` |
| `GET /email-templates/{name}` × 11 (`verify_email`, `verify_email_by_code`, `reset_email`, `reset_email_by_code`, `welcome_email`, `blocked_account`, `stolen_credentials`, `enrollment_email`, `mfa_oob_code`, `user_invitation`, `async_approval`) | On responses that return 200 AND `enabled: true`: grep `from` and `body`. Drop 404s (never customized) and `enabled: false` (won't send). |

**Parallelism is required.** Sequential, this is 15+ calls and noticeably slow. With parallel fan-out (e.g., `xargs -P`, shell `&` + `wait`, or the agent firing tool calls in one turn) the total is bounded by the slowest single call.

After the scan, report hits with specific locations, then always append the reminder:

```text
Quick scan found {N} references:
  • Client "Web App"                      callbacks[2]
  • Client "Mobile App"                   allowed_logout_urls[0]
  • Email template "reset_email"          from: "no-reply@login.example.com"
  • Tenant setting                        support_url

Note: this was the quick scan. Still unchecked in Auth0:
  Actions, Rules, Hooks, Branding templates, Organizations, Connection options,
  Resource server identifiers, Log stream webhooks, Prompt / ACUL custom text.
Run the deep scan if you want me to check those, or proceed if you've already audited them.

And regardless of scan depth, check these yourself (not reachable via API):
  • SDK configs (domain / issuerBaseURL)
  • Backend JWT validators
  • SAML SP metadata
  • Terraform / IaC / CI-CD
  • Third-party integrations
  • Email DNS (SPF / DKIM / DMARC if from address embeds this domain)
```

#### Option 3: deep scan (tier 2)

Fire everything in the Reachable list above in parallel, in addition to tier 1:

| Call | Field(s) to grep |
|---|---|
| `GET /actions/actions` (paginated) | `code` |
| `GET /rules` (legacy; skip cleanly if empty) | `script` |
| `GET /hooks` (legacy; skip cleanly if empty) | `script` |
| `GET /branding/templates/universal-login` | `template` (Liquid HTML) |
| `GET /organizations` (paginated) + `GET /organizations/{id}/branding` per org | `logo_url`, `colors`, `branding.logo_url` |
| `GET /connections` (paginated) | `options` JSON stringified |
| `GET /resource-servers` (paginated) | `identifier` |
| `GET /log-streams` | sink URLs (`sink.httpEndpoint`, webhook URLs) |
| `GET /prompts/{prompt}/custom-text/{lang}` for configured prompts | body text fields |

Time budget the deep scan to ~30s; if it's still running past that, surface partial results with a note that scanning timed out on {list of pending endpoints}.

Expect false positives — string matches inside unrelated JSON fields (user-chosen connection names, org slugs, etc.). Report the hit with the containing JSON path so the user can judge.

After the deep scan, always append the "not reachable via API" reminder from option 2. The scan is never complete; the user still has to check the external surfaces themselves.

## Confirm

Show the full impact and ask for explicit yes. Include the current CNAME target value (pulled from `verification.methods[0].record`) so the user can confirm they're deleting the right record. Reflect the scan tier they chose in step 3:

```text
Ready to delete login.example.com from tenant acme-prod.

Current record:
  CNAME login.example.com → tenant.edge.tenants.auth0.com

This will:
  • Remove the custom domain from Auth0 (irreversible)
  • Invalidate the Auth0-managed certificate
  • Delete the CNAME from DNS (via Route 53 / Cloudflare / etc.; see below)
  • [if default] unset the tenant's default custom domain

Flags:
  • This is the tenant's default custom domain
  • {one of}
      — No scan was run; you confirmed you've already audited.
      — Quick scan found 3 references: [list]. Deeper surfaces and external
        systems not checked.
      — Deep scan found 5 references: [list]. External systems not checked.

Proceed? [yes / no]
```

If the scan found references, pause here and let the user decide whether to fix them first or accept the breakage. A "yes" after seeing scan hits is explicit acknowledgement; do not nag further.

## Delete in Auth0

```bash
auth0 api delete "custom-domains/<domainId>" --force
```

`--force` is important: without it the CLI prints its own confirmation prompt, which duplicates the skill's confirmation and hangs in non-interactive contexts. The skill has already obtained explicit yes from the user, so pass `--force`.

Note the current CNAME target value before deletion; after deletion, the Management API no longer returns it, so if the user wants to recreate later they'd need the new value from a fresh create.

## Clean up the DNS record

**Always attempt automated cleanup first.** Detect the provider from the root domain's NS records and route by tier, same as the Set up a custom domain flow. The skill should do the cleanup for the user, not ask the user to do it manually, whenever the provider tier supports automation and the required credentials are present.

### Automated path (preferred)

- **Tier 1 Cloudflare (via MCP)**: If the Cloudflare MCP is connected, `search("dns records")` then `execute()` a script that calls `cf.dns.records.delete(record_id)` for the CNAME at the target name. No user action needed. Full mechanics: see Cloudflare section below.
- **Tier 2 Route 53**: If AWS credentials are configured (`aws sts get-caller-identity` succeeds), run `aws route53 change-resource-record-sets` with action `DELETE` (requires the full record set to match). Use `list-resource-record-sets` first to get the exact current value, then poll `get-change` until `INSYNC`. No user action needed. Full mechanics including the exact-match DELETE gotcha: see Route 53 section below.
- **Tier 3 Azure DNS**: If the Azure CLI is signed in (`az account show` succeeds), run `az network dns record-set cname delete --resource-group my-rg --zone-name example.com --name login --yes`. No user action needed. Full mechanics: see Azure DNS section below.

Open only the sub-file matching the detected provider; don't load all three.

### Manual fallback

Drop to manual guidance only when automation isn't possible — Tier 4 providers (GoDaddy, Namecheap, Hover, etc.), or Tiers 1-3 where the required credentials / MCP aren't available and the user can't authorize them right now. In that case, give clear step-by-step directions:

```text
Couldn't remove the DNS CNAME automatically ({reason: no Cloudflare MCP connection /
no AWS credentials / etc.}). Remove it manually:

1. Go to: {dashboard deep-link for the detected provider}
2. Find the CNAME record:
     Name:  login.example.com
     Value: tenant.edge.tenants.auth0.com
3. Delete it.

Reply 'done' when removed so I can confirm the DNS record is gone, or 'skip' if
you want to leave it in place (harmless but clutters your zone).
```

Use the provider cheat-sheet in the Manual Guided section below for the right deep-link and UI labels. On "done", run `dig +short CNAME login.example.com` to verify the record is gone; warn the user if it still resolves (propagation can take a few minutes).

### Why automate by default

The CNAME is now orphaned: it points at an Auth0 edge hostname that no longer serves the user's domain. Leaving it in place is harmless but clutters the zone and can cause confusion later. Auto-cleanup is the right default; manual is an exception path.

## If the user is keeping the domain but switching tenants

Different flow; don't run this capability. They should:
1. Delete from the original tenant (Auth0 won't let the same domain live on two tenants).
2. Leave the DNS record in place.
3. Create the domain on the new tenant (the Set up a custom domain flow). The CNAME target value will change; they'll need to update the existing DNS record rather than add a new one.

## Post-delete reminder

After successful deletion, tell the user:

```text
Deleted login.example.com from Auth0.
DNS CNAME removed via {provider}.

Next steps (outside this skill's scope):
  • Update SDK `domain` / `issuerBaseURL` config back to your-tenant.auth0.com
    in any app that was pointing at login.example.com
  • Update application callback URLs that reference the old custom domain
  • [if was default] set a new default custom domain via the Manage existing domains flow
```
