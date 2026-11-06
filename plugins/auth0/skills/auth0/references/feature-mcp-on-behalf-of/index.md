# Auth0 MCP On-Behalf-Of (OBO) Token Exchange

Let an MCP tool call a downstream API as the signed-in user, using a narrower token that Auth0 issues for that API.

---

## Overview

### What is the OBO exchange?

The On-Behalf-Of (OBO) exchange trades the caller's incoming token for a narrower token scoped to a specific downstream API, so a tool can call that API as the user without ever forwarding the user's original token. It uses RFC 8693. Auth0 decides which downstream audiences a given client may exchange for, so the SDK needs the OBO client's `client_id` and `client_secret`, and the audience a tool asks for must be one Auth0 is configured to issue tokens for.

### Requirements

- An Auth0 tenant and the Auth0 CLI, used for every command on this page
- An API in Auth0 for the MCP server itself, and one API per downstream service
- `client_id` and `client_secret` of the OBO client passed to the SDK

---

## SDK Integration

Get the exact calls from the per-SDK reference. **`Read:` the file for the detected SDK.**

| SDK | What it covers | Read this file |
|---|---|---|
| `auth0-ai-mcp` (Python) | The exchange from a tool, scope handling, org mode | `Read: references/feature-mcp-on-behalf-of/auth0-ai-mcp-python.md` |
| `auth0-ai-fastmcp` (Python) | The exchange from a tool, scope handling, org mode | `Read: references/feature-mcp-on-behalf-of/auth0-ai-fastmcp-python.md` |

---

## Step 1 - Set up the tenant

Log in to the Auth0 CLI with extra scopes first. A plain `auth0 login` cannot run every command below.

```bash
auth0 login --scopes create:client_grants,create:organization_clients
```

If a command still fails with `access token lacks scope: <scope>`, run `auth0 login --scopes <scope>` and try the command again.

Swap in your own ids where the commands say `YOUR_...`.

1. Create the OBO client. Token swapping only works through a Custom API client, which is a client with `app_type` set to `resource_server` and tied to the MCP server's API through `resource_server_identifier`.

   ```bash
   auth0 api post clients --data '{
     "name": "My OBO Client",
     "app_type": "resource_server",
     "resource_server_identifier": "YOUR_MCP_AUDIENCE"
   }'
   ```

   A Regular Web App will not work here. Trying it fails with `This client is not a resource server and cannot exchange access tokens`.

2. Turn on the OBO token exchange profile for that client, using its id from the create output.

   ```bash
   auth0 api patch "clients/YOUR_OBO_CLIENT_ID" \
     --data '{"token_exchange":{"allow_any_profile_of_type":["on_behalf_of_token_exchange"]}}'
   ```

3. Give the OBO client a user-subject client grant to each downstream API, which is why `subject_type` is `user`. Give each service exactly the scopes its tools ask for. This is the grant for one service.

   ```bash
   auth0 api post client-grants --data '{"client_id":"YOUR_OBO_CLIENT_ID","audience":"https://orders.api/","scope":["cancel:orders","read:orders","write:orders"],"subject_type":"user"}'
   ```

   Repeat it for every downstream API with that API's audience and scopes. If these fail with `access token lacks scope: create:client_grants`, log in again with the login scopes shown above and rerun the grants.

4. Let the OBO client get tokens for the downstream APIs without showing the user a consent screen. Run this on each downstream API with its id.

   ```bash
   auth0 api patch "resource-servers/YOUR_ORDERS_API_ID" --data '{"skip_consent_for_verifiable_first_party_clients":true}'
   ```

   Without it the swap fails with `The API must have "Allow Skipping User Consent for Verifiable First-Party Clients" enabled`, which is the Dashboard name for this same setting.

5. Only for org mode, let the OBO client work with organizations.

   ```bash
   auth0 api patch "clients/YOUR_OBO_CLIENT_ID" \
     --data '{"organization_usage":"allow"}'
   ```

   OBO clients do not have this by default. A user's token in org mode carries an `org_id`, so the swap happens inside that organization, and a client without `organization_usage` set to `allow` is refused with a `400` and `parameter organization is not allowed for this client`.

---

## Step 2 - Org mode tenant setup (optional)

The tenant setup gets Auth0 to put the right `org_id` in the token when the user logs in. It is done once per tenant. The OBO client part is item 5 in Step 1. The rest covers the login client, which is the MCP client users log in with, such as Claude Code.

1. Add your test user to the organization.

   ```bash
   auth0 orgs members add YOUR_ORG_ID --user-id YOUR_USER_ID
   ```

2. Make the login client require an organization at login.

   ```bash
   auth0 api patch "clients/YOUR_LOGIN_CLIENT_ID" \
     --data '{"organization_usage":"require","organization_require_behavior":"post_login_prompt"}'
   ```

   With this, Auth0 asks the user to pick the organization after they log in, and the token comes back with `org_id`.

3. Add the login client to the organization.

   ```bash
   auth0 api post "organizations/YOUR_ORG_ID/clients" \
     --data '{"clients":[{"client_id":"YOUR_LOGIN_CLIENT_ID","use_for_member_access":true}]}'
   ```

   The user being a member is not enough on its own, because the client has to be added to the organization as well. Without this step the login fails with `client requires organization membership, but user does not belong to any organization`, even for a real member.

You do not have to pass the organization when swapping tokens. Auth0 copies `org_id` from the user's token into every downstream token on its own.

With `organization_usage` set to `require` on the login client, every token carries `org_id` even when no organization is configured on the server. Set it back to `allow` before running without an organization.

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `This client is not a resource server and cannot exchange access tokens` | The OBO client is a Regular Web App | Create it with `app_type` set to `resource_server` |
| `The API must have "Allow Skipping User Consent for Verifiable First-Party Clients" enabled` | Consent skipping is off on the downstream API | Set `skip_consent_for_verifiable_first_party_clients` to `true` on that API |
| `400` with `parameter organization is not allowed for this client` | The OBO client has no `organization_usage` in org mode | Set `organization_usage` to `allow` on the OBO client |
| `access token lacks scope: create:client_grants` | The CLI login is missing scopes | Run `auth0 login --scopes create:client_grants,create:organization_clients` and rerun |
