# Common MCP server errors and fixes

Errors that come from the Auth0 tenant setup, which are the same whichever SDK protects the MCP server.

---

## SDK-specific errors

Errors raised by the SDK itself, such as middleware responses and scope errors, are in the per-SDK reference. **`Read:` the file for the detected SDK.**

| SDK | What it covers | Read this file |
|---|---|---|
| `auth0-ai-mcp` (Python) | Middleware responses, scope checks, exchange and cache errors | `Read: references/pattern-mcp-common-errors/auth0-ai-mcp-python.md` |
| `auth0-ai-fastmcp` (Python) | Middleware and provider responses, scope checks, exchange and cache errors | `Read: references/pattern-mcp-common-errors/auth0-ai-fastmcp-python.md` |

---

## Auth0 CLI command fails with `access token lacks scope`

**Error:** `access token lacks scope: <scope>`, for example `access token lacks scope: create:client_grants`

**Fix:** A plain `auth0 login` cannot run every command in the example. Log in once with the extra scopes before you start.

```bash
auth0 login --scopes create:client_grants,create:organization_clients
```

If a command still fails, run `auth0 login --scopes <scope>` with the scope named in the error and try the command again. If the client grant commands fail with `create:client_grants`, the CLI is missing these login scopes. Log in again with them and rerun the grants.

---

## Token swap fails because the client is not a resource server

**Error:** `This client is not a resource server and cannot exchange access tokens`

**Fix:** Token swapping only works through a Custom API client, which is a client with `app_type` set to `resource_server` and tied to the MCP server's API. A Regular Web App will not work. Create the OBO client like this.

```bash
auth0 api post clients --data '{
  "name": "My OBO Client",
  "app_type": "resource_server",
  "resource_server_identifier": "YOUR_MCP_AUDIENCE"
}'
```

---

## Token swap fails because skipping user consent is not enabled

**Error:** `The API must have "Allow Skipping User Consent for Verifiable First-Party Clients" enabled`

**Fix:** Turn on `skip_consent_for_verifiable_first_party_clients` on each downstream API, including any API you add later. That is the API setting the Dashboard calls "Allow Skipping User Consent for Verifiable First-Party Clients".

```bash
auth0 api patch "resource-servers/YOUR_ORDERS_API_ID" --data '{"skip_consent_for_verifiable_first_party_clients":true}'
```

---

## Login fails with `Unknown client`

**Error:** `invalid_request: Unknown client: https://claude.ai/oauth/claude-code-client-metadata`

**Fix:** Claude Code does not register itself on the fly. It identifies itself with a Client ID Metadata Document (CIMD), which is a public URL it uses as its client id, so that URL has to be registered on your tenant. First turn on Settings > Advanced > `Client ID Metadata Document Registration`, then register the URL. The register call creates the client and returns a client id that starts with `tpc_`.

```bash
auth0 api post "clients/cimd/register" --data '{"external_client_id":"https://claude.ai/oauth/claude-code-client-metadata"}'
```

---

## Every tool call fails because the client is not authorized to access the API

**Error:** `Client ... is not authorized to access resource server YOUR_MCP_AUDIENCE`. The login goes through but every tool call fails.

**Fix:** Give the `tpc_` client a client grant on the MCP API that includes every tool scope. Third-party (`tpc_`) clients never get an API's allow-all access, so they always need their own grant. This grant is easy to forget.

```bash
auth0 api post client-grants --data '{"client_id":"YOUR_TPC_CLIENT_ID","audience":"YOUR_MCP_AUDIENCE","scope":["read:orders","write:orders"],"subject_type":"user"}'
```

---

## A new scope never shows up in the token

**Error:** A scope was added to the MCP API but the token does not carry it. No error is shown.

**Fix:** Adding a scope to the MCP API does not add it to existing grants, and Auth0 silently leaves a scope out of the token when the client's grant does not include it. Update the `tpc_` client's grant with the full list. The new scope list replaces the old one, so send every existing tool scope plus the new one.

```bash
auth0 api patch "client-grants/YOUR_GRANT_ID" \
  --data '{"scope":["existing:scope","new:scope"]}'
# find the grant id: auth0 api get "client-grants?client_id=YOUR_TPC_CLIENT_ID&audience=YOUR_AUDIENCE"
```

---

## Claude Code reports `MCP endpoint not found`

**Error:** `MCP endpoint not found`

**Fix:** The URL given to Claude Code has to end in `/mcp`, because that is where the server listens. Pointing Claude Code at `http://localhost:3002` alone fails.

```bash
claude mcp add --transport http b2b-ecommerce http://localhost:3002/mcp
```

---

## Adding `client_credentials` removes the existing grant types

**Error:** After a PATCH that adds `client_credentials`, the client's other grant types are gone, because a PATCH on `grant_types` replaces the whole list.

**Fix:** The OBO client needs `client_credentials` in its grant types for the machine-to-machine (M2M) tool. The CLI's `apps update` has no option for that, so use the Management API. Look at the current list first.

```bash
auth0 api get "clients/YOUR_OBO_CLIENT_ID?fields=grant_types"
```

Then send back that same list with `client_credentials` added.

```bash
auth0 api patch "clients/YOUR_OBO_CLIENT_ID" \
  --data '{"grant_types":["EXISTING_GRANT_TYPES","client_credentials"]}'
```

---

## A token is turned away in org mode

**Error:** Setting `AUTH0_ORGANIZATION_ID` in `.env` makes the server accept only users from that one organization. A token with no `org_id` claim is turned away, and so is a token whose `org_id` is a different organization.

**Fix:** Set up Auth0 to put the right `org_id` in the token when the user logs in. You only do this once per tenant. Let the OBO client work with organizations, add your test user to the organization, make the login client require an organization at login, and add the login client to the organization. On-Behalf-Of has the commands. See the two entries below for the matching errors. You do not have to pass the organization when swapping tokens, because Auth0 copies `org_id` from the user's token into every downstream token on its own.

---

## Token swap is refused with a `400` in org mode

**Error:** A `400` with `parameter organization is not allowed for this client`

**Fix:** A user's token in org mode carries an `org_id`, so the swap happens inside that organization. A client without `organization_usage` set to `allow` is refused. OBO clients do not have this by default, and it only matters in org mode. Set it on the OBO client.

```bash
auth0 api patch "clients/YOUR_OBO_CLIENT_ID" \
  --data '{"organization_usage":"allow"}'
```

---

## Login fails because the client requires organization membership

**Error:** `client requires organization membership, but user does not belong to any organization`, even for a real member.

**Fix:** The user being a member is not enough on its own, because the login client has to be added to the organization as well.

```bash
auth0 api post "organizations/YOUR_ORG_ID/clients" \
  --data '{"clients":[{"client_id":"YOUR_TPC_CLIENT_ID","use_for_member_access":true}]}'
```

---

## Tokens still carry `org_id` after leaving org mode

**Error:** Every token carries `org_id` even when `AUTH0_ORGANIZATION_ID` is empty.

**Fix:** The org mode setup set the `tpc_` client's `organization_usage` to `require`. Set it back to `allow` before running without an organization.
