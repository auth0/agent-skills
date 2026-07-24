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

## Examples

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
