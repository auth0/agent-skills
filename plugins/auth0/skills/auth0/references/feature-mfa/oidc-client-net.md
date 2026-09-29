# Auth0.OidcClient (.NET native/desktop) — MFA (client-initiated step-up)

**Minimum version:** `Auth0.OidcClient.WPF` 4.4.0 (the `Auth0.OidcClient.*` family — WPF/WinForms/Android/iOS).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is a **native client**: it drives step-up through Universal Login by passing `acr_values` on the login request, then verifies the result from the returned token.

There is no MFA-specific method — do **not** invent `LoginWithMfaAsync` / `RequestMfaAsync` or an `Auth0.OidcClient.Mfa` package. Step-up is requested through the extra authorization parameters passed to `LoginAsync`. Do not drop down to the raw `IdentityModel.OidcClient`, and do not use the ASP.NET web-app SDK `Auth0.AspNetCore.Authentication` — this is a desktop app.

Extra authorization parameters are passed as an **anonymous object** to `LoginAsync` (the same shape the scaffold already uses for `audience`). To force step-up, add `acr_values` (the PAPE multi-factor policy) and `max_age = "0"` for a fresh challenge, then read the `acr`/`amr` claim off `LoginResult.User` (a `ClaimsPrincipal`) and only transfer when MFA is confirmed:

```csharp
private const string MfaAcr = "http://schemas.openid.net/pape/policies/2007/06/multi-factor";

private async void TransferButton_Click(object sender, RoutedEventArgs e)
{
    // Force MFA step-up right before the transfer.
    var result = await _auth0Client.LoginAsync(new
    {
        audience = _audience,
        acr_values = MfaAcr,
        max_age = "0",
    });

    if (result.IsError)
    {
        StatusText.Text = $"Step-up failed: {result.Error}";
        return;
    }

    // Confirm MFA actually happened before moving funds. A missing/insufficient
    // claim is a failure — do not transfer.
    var amr = result.User.FindAll("amr").Select(c => c.Value);
    var acr = result.User.FindFirst("acr")?.Value;
    if (!amr.Contains("mfa") && acr != MfaAcr)
    {
        StatusText.Text = "MFA was not completed — transfer cancelled.";
        return;
    }

    // ... perform the transfer ...
}
```

Leave the ordinary **Login** button as a plain `LoginAsync(new { audience = _audience })` — apply the step-up parameters and the `acr`/`amr` check **only** on the Transfer action. `acr_values` is a field of the extra-parameters object, not a named/positional argument on `LoginAsync`; don't hand-build an `/authorize` URL. Read `Domain`, `ClientId`, and `Audience` from the `Auth0` section of `appsettings.json`, never hardcoded in source.
