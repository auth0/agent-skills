# Auth0 Custom Domains: DNS Provider Playbook

Per-tier details for writing the Auth0 CNAME verification record into the user's DNS provider. The skill detects the provider from the root domain's NS records and routes to one of four tiers.

## Provider Detection

### Lookup command

```bash
dig +short NS example.com
```

### NS pattern to provider mapping

| NS pattern | Provider | Tier |
|------------|----------|------|
| `*.ns.cloudflare.com` | Cloudflare | 1: Full automation |
| `*.awsdns-*.com`, `*.awsdns-*.net`, `*.awsdns-*.org`, `*.awsdns-*.co.uk` | AWS Route 53 | 2: Assisted |
| `*.azure-dns.com`, `*.azure-dns.net`, `*.azure-dns.org`, `*.azure-dns.info` | Azure DNS | 3: Assisted |
| `ns*.domaincontrol.com` | GoDaddy | 4: Manual |
| `dns*.registrar-servers.com` | Namecheap | 4: Manual |
| `ns*.hover.com` | Hover | 4: Manual |
| `ns*.squarespacedns.com` | Squarespace Domains | 4: Manual |
| `curitiba.ns.porkbun.com`, `fortaleza.ns.porkbun.com`, etc. | Porkbun | 4: Manual |
| `ns*.name.com` | Name.com | 4: Manual |
| `*.gandi.net` | Gandi | 4: Manual |
| `ns*.worldnic.com` | Network Solutions | 4: Manual |
| `ns*.ui-dns.*` | IONOS | 4: Manual |
| `ns*.dreamhost.com` | DreamHost | 4: Manual |
| `ns*.googledomains.com` | Google Domains (legacy, migrated to Squarespace) | 4: Manual |
| Anything else | Unknown | 4: Generic manual |

When the NS pattern is unrecognized, fall back to generic Tier 4 instructions and surface the NS records to the user so they can identify the provider themselves.

---

## Tier 1: Cloudflare (Full Automation)

Cloudflare publishes an official MCP server at `https://mcp.cloudflare.com/mcp` with OAuth browser auth. The server exposes two tools (`search()` and `execute()`) and runs generated JavaScript against a sandboxed Cloudflare API client.

### Plan requirements

DNS management on Cloudflare is **available on every plan including Free**. The `https://mcp.cloudflare.com/mcp` server wraps the same Cloudflare API and needs no paid Cloudflare plan for DNS CRUD. Cloudflare's GitHub README hedges that "some features may require a paid Workers plan"; that applies to MCP features tied to paid products (Workers deploys, Containers, AI Gateway), not DNS.

Free-plan caveats to surface to the user:
- Zones created after September 2024 cap at **200 DNS records per zone**. Auth0's CNAME counts as one; most hobby zones are nowhere near this.
- Free plan minimum TTL is 60 seconds (30 on Enterprise). `ttl: 1` uses Cloudflare's automatic TTL and works on Free.
- Free plan does not allow API tokens with Client IP Address Filtering. The MCP's OAuth flow avoids this.

### Pre-flight check

Confirm the Cloudflare MCP is connected to the user's Claude Code session. If not:

```text
The Cloudflare MCP server isn't connected. Add it with:

  claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp

Then authorize in the browser when Claude prompts you.
```

### Creating the CNAME record

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

### Key constraints

- `proxied` must be `false`. A proxied (orange-cloud) CNAME breaks Auth0 verification and Auth0-managed certificates.
- Minimum TTL is 60s on standard zones, 30s on Enterprise. `ttl: 1` uses Cloudflare's automatic TTL.
- The authenticated token needs `DNS:Edit` scope on the target zone. OAuth flow grants this by default when the user authorizes.
- API tokens with Client IP Address Filtering are not supported by the MCP.

### Fallback

If the Cloudflare MCP can't be used (auth failure, zone not in account, unexpected error), drop to Tier 4 with Cloudflare dashboard deep-link:
`https://dash.cloudflare.com/?to=/:account/:zone/dns/records` (the user needs to know their account and zone; a simpler fallback is `https://dash.cloudflare.com/` and instruct them to navigate).

---

## Tier 2: AWS Route 53 (Assisted Automation)

Uses the AWS CLI. If the user already has AWS credentials configured (env vars, shared config, or SSO session), this tier handles the CNAME creation automatically. Otherwise it falls back to Tier 4.

### Plan requirements

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

### Pre-flight check

```bash
aws sts get-caller-identity
```

If this returns identity info, proceed. If it errors with credentials/expired token, drop to Tier 4 with a Route 53 console deep-link.

### Find the hosted zone

```bash
aws route53 list-hosted-zones-by-name \
  --dns-name example.com \
  --max-items 1
```

Extract the hosted zone ID (strip the `/hostedzone/` prefix). Watch for private vs public zones; Auth0 needs a public zone. If the result is a private hosted zone, fall back to Tier 4 with an explanation.

### Create the CNAME record

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

### Poll until `INSYNC`

The `change-resource-record-sets` response contains a `ChangeInfo.Id`. Poll it:

```bash
aws route53 get-change --id /change/C1234567890ABC
```

The `Status` field returns `PENDING` then `INSYNC`. Wait for `INSYNC` (usually ~60s) before triggering Auth0 verification.

### Delete the CNAME record (the Remove a custom domain flow)

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

### Error handling

- `PriorRequestNotComplete`: another change on the same zone is still propagating. Back off and retry (5s, 10s, 20s).
- `InvalidChangeBatch` on DELETE: the submitted record doesn't exactly match the live record. Re-run step 1 above and copy the TTL and Value precisely.
- Rate limit: Route 53 allows 5 req/s per account. With the skill's backoff on verify polling, this is not usually a concern.

### Fallback deep-link

If pre-flight fails:
```text
https://console.aws.amazon.com/route53/v2/hostedzones
```
Instruct the user to click their zone, then "Create record".

---

## Tier 3: Azure DNS (Assisted Automation)

Uses the Azure CLI. If the user is signed in, this tier handles the CNAME creation automatically.

### Plan requirements

Azure DNS has **no plan tiers**. Any active Azure subscription (pay-as-you-go, EA, CSP, Visual Studio credit, free trial) can host public DNS zones. Pricing is $0.50/zone/month for the first 25 zones (lower after) plus $0.40 per million queries.

What the signed-in identity needs:
- The **DNS Zone Contributor** role on the resource group containing the zone, or
- The broader **Contributor** / **Owner** role on the resource group or subscription.

The `Reader` role alone is insufficient; record-set writes return 403. Default subscription limit is **250 public DNS zones per subscription**, raisable via support.

### Pre-flight check

```bash
az account show
```

If this returns an active subscription, proceed. Otherwise drop to Tier 4 with the Azure portal deep-link.

### Find the DNS zone

```bash
az network dns zone list \
  --query "[?name=='example.com'].{name:name, rg:resourceGroup}" \
  -o json
```

Extract the resource group. If the zone is in a subscription different from the current default, the user may need to run `az account set --subscription <id>` first.

### Create the CNAME record

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

### Propagation

Azure DNS propagates quickly (typically <30s). No polling equivalent to Route 53's `INSYNC` check is needed. Proceed directly to Auth0 verification.

### Fallback deep-link

```
https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.Network%2FdnsZones
```
Instruct the user to select their zone, then **+ Record set**.

---

## Tier 4: Manual Guided (Everyone Else)

For all other providers, the skill outputs a copy-pasteable record block and provider-specific instructions.

### Record block to output

Show exactly:

```
Record type: CNAME
Host / Name: login              (the subdomain portion only, not the full FQDN)
Value / Points to: tenant.edge.tenants.auth0.com
TTL: 300 (or provider default)
Proxy / Orange cloud: OFF / DNS-only
```

Note the "Host" formatting: most providers expect just the subdomain (`login`), but a few expect the full FQDN (`login.example.com`). Call this out in the per-provider instructions below.

### Per-provider cheat sheet

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

#### Unknown provider

If NS records don't match any known pattern, output:

```
Your DNS appears to be hosted at {nameserver domain}. Log in to that provider's
dashboard and look for "DNS", "DNS Records", "Advanced DNS", or "Zone Editor".
Add a new CNAME record with the values above.
```

### After the user confirms

Ask: "Reply 'done' when you've added the record, or 'skip' to give up for now."

On "done", proceed to Auth0 verification in SKILL.md Step 3. On "skip", save the CNAME target value and `custom_domain_id` to the conversation so they can resume later.

If verification fails, first suggest `dig CNAME login.example.com` and compare the result to the expected target.
