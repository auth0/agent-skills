# Universal Portals: manual setup (fallback)

Use this only when the Auth0 CLI cannot run `universal-portals setup --template` or `audit`. Delete this file once the CLI ships both (auth0/auth0-cli#1738 to #1740). The authoritative settings are on https://auth0.com/docs/customize/portals/configure-portal-application

## Domains

`YOUR_DOMAIN` is the tenant's custom domain when it has one, or the Auth0 domain (`*.auth0.com`) otherwise. Use it in callback URLs and portal URLs. `YOUR_CANONICAL_DOMAIN` is always the tenant's Auth0 domain. Use it in every API audience, including the client grant and the refresh token policy, as `setup` creates them. Without a custom domain both are the same value.

## Portal application settings

Create one Regular Web Application per portal. A portal must not share its application with another portal.

| Setting | Value |
|---|---|
| Allowed Callback URLs | `https://YOUR_DOMAIN/portals/auth/callback` |
| Allowed Logout URLs | Your application's URL. Auth0 redirects to the first entry, so put it first |
| Grant types | Authorization Code, Refresh Token, and MFA (the three `mfa-*` grant types in the body below) |
| Token endpoint authentication | `client_secret_post`. The portal API supports no other method |
| Trust token endpoint IP header | On |
| Refresh token rotation | Off (non-rotating) |
| Refresh token lifetimes | Idle 3600 s, maximum 86400 s. These match the portal session: 1 hour of inactivity and 1 day in total |
| Organizations | Type of users Both (`organization_usage: allow`), Login flow No Prompt |
| Connections | At least one enabled. Users cannot sign in without one |

Keep these off or unset: DPoP, refresh token rotation, the Client Credentials grant, and any Management API grant. A form that updates users calls the Management API through a separate machine-to-machine application, not this one. Keep the idle lifetime at 3600 s or more.

## Grants per API

Each API the portal calls needs both of the following for the same audience and scopes:

- a client grant with `"subject_type": "user"`, created with `auth0 api post client-grants`;
- a refresh token policy in the application's `refresh_token.policies`.

If either is missing, components fail with API errors. Grant only the scopes of the components the portal uses.

| Component | Audience | Scopes |
|---|---|---|
| `my_account:mfa_management` | `https://YOUR_CANONICAL_DOMAIN/me/` | `read:me:factors`, `read:me:authentication_methods`, `create:me:authentication_methods`, `delete:me:authentication_methods` |
| `my_account:passkey_management` | `https://YOUR_CANONICAL_DOMAIN/me/` | `read:me:authentication_methods`, `create:me:authentication_methods`, `delete:me:authentication_methods` |
| `my_organization:details_edit` | `https://YOUR_CANONICAL_DOMAIN/my-org/` | `read:my_org:details`, `update:my_org:details`, `read:my_org:configuration` |
| `my_organization:domain_table` | `https://YOUR_CANONICAL_DOMAIN/my-org/` | `read:my_org:domains`, `create:my_org:domains`, `update:my_org:domains`, `delete:my_org:domains`, `read:my_org:identity_providers`, `create:my_org:identity_providers_domains`, `delete:my_org:identity_providers_domains` |

Client grant body, one per audience (replace the client ID and scopes):

```json
{
  "client_id": "NEW_CLIENT_ID",
  "audience": "https://YOUR_CANONICAL_DOMAIN/me/",
  "subject_type": "user",
  "scope": ["read:me:factors", "read:me:authentication_methods", "create:me:authentication_methods", "delete:me:authentication_methods"]
}
```

## Native applications

To open the portal from a native application, add this setting to the portal application so it accepts session transfer tokens in the URL:

```json
{
  "session_transfer": {
    "allowed_authentication_methods": ["query"],
    "enforce_device_binding": "ip"
  }
}
```

## Create the application (consumer)

Create the application with `auth0 api post clients --data '<payload>'`. Replace the callback and logout placeholders. Keep the client secret in a secret manager, not in source, frontend variables, or chat.

```json
{
  "name": "My Account (Universal Portals)",
  "app_type": "regular_web",
  "oidc_conformant": true,
  "callbacks": ["https://YOUR_DOMAIN/portals/auth/callback"],
  "allowed_logout_urls": ["https://app.example.com"],
  "grant_types": [
    "authorization_code",
    "refresh_token",
    "http://auth0.com/oauth/grant-type/mfa-oob",
    "http://auth0.com/oauth/grant-type/mfa-otp",
    "http://auth0.com/oauth/grant-type/mfa-recovery-code"
  ],
  "token_endpoint_auth_method": "client_secret_post",
  "is_token_endpoint_ip_header_trusted": true,
  "organization_usage": "allow",
  "refresh_token": {
    "rotation_type": "non-rotating",
    "expiration_type": "expiring",
    "token_lifetime": 86400,
    "idle_token_lifetime": 3600,
    "policies": [
      {
        "audience": "https://YOUR_CANONICAL_DOMAIN/me/",
        "scope": [
          "read:me:factors",
          "read:me:authentication_methods",
          "create:me:authentication_methods",
          "delete:me:authentication_methods"
        ]
      }
    ]
  }
}
```

For the business template, add a second `refresh_token.policies` entry for `https://YOUR_CANONICAL_DOMAIN/my-org/` with the My Organization scopes from the table above, and keep the My Account entry: the Security and Preferences pages use My Account. Then create a matching client grant for each audience, as described in the grants section.

Once the application exists, create the portal with the `portals` payload in the index. The client secret is write-only and is never returned by the API.
