# auth0-oidc-client-net - Organizations

**Minimum version:** Organizations support was added in `Auth0.OidcClient.Core` 3.2.0, and org login
has worked through `LoginAsync` extra-parameters ever since (MAUI package floor 1.0.0+). 4.x is the
current major line and is recommended; pick the package for your platform and use its latest release:

| Package | Platform |
|---|---|
| `Auth0.OidcClient.Core` | shared core (referenced by all below) |
| `Auth0.OidcClient.WPF` | WPF desktop |
| `Auth0.OidcClient.WinForms` | Windows Forms desktop |
| `Auth0.OidcClient.UWP` | Universal Windows Platform |
| `Auth0.OidcClient.MAUI` | .NET MAUI (cross-platform) |
| `Auth0.OidcClient.AndroidX` | Android (.NET 6+; use this, not `.Android`) |
| `Auth0.OidcClient.iOS` | iOS / Mac Catalyst |

`Auth0.OidcClient.Android` is deprecated (pinned to Google support libraries, cannot run on .NET 6+) - use `Auth0.OidcClient.AndroidX`.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading guidance,
tenant config, and common mistakes live in the shared Organizations reference. **All platform
packages share the same `Auth0Client` / `LoginAsync` interface** - the calls below are identical on
WPF, WinForms, UWP, MAUI, AndroidX, and iOS; only the client construction and redirect wiring
differ per platform (that lives in the base framework reference). This is a public native client -
org login goes through `LoginAsync`.

## Org-scoped login

Pass `organization` on the **anonymous extra-parameters object** to `LoginAsync` - lowercase key,
not a property on `Auth0ClientOptions`:

```csharp
var loginResult = await client.LoginAsync(new { organization = "org_barkbook_acme" });
```

## Accepting an invitation

The invite link carries `invitation` + `organization`. Pass **both** on the same object - the
`invitation` is the ticket id, not a URL:

```csharp
var loginResult = await client.LoginAsync(new
{
    organization = "org_barkbook_acme",
    invitation   = "inv_abc123",
});
```

Forward the invite's own `organization`; do not substitute your configured default org. The SDK
validates the returned ID token's `org_id`/`org_name` and throws `IdTokenValidationException` on a
mismatch.

## Reading the organization back

`org_id` is a claim on the login result's principal. Read it with the **string** claim type - the
`Auth0ClaimNames` class is internal to the SDK, so do not depend on it:

```csharp
var orgId = loginResult.User.FindFirst("org_id")?.Value;
```

## Security

Public native client: **no `client_secret`**. Do not hand-decode the ID token with
`JwtSecurityTokenHandler` to read `org_id` - the claim is already on `loginResult.User`.

The calls above are accurate for Auth0.OidcClient.Core 4.x (and the platform packages listed) - do
not read the SDK source or `.d.ts`/decompiled assemblies to re-verify them.

For a worked example, see the SDK's own docs: https://raw.githubusercontent.com/auth0/auth0-oidc-client-net/master/docs-source/documentation/getting-started/authentication.md#organizations
