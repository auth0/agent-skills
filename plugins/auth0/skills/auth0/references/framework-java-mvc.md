
# Auth0 Java MVC Common Integration

Add Auth0 authentication to Java Servlet web applications using `com.auth0:mvc-auth-commons`. Provides `AuthenticationController` for building authorize URLs and handling callbacks, with session-based authentication and support for Organizations and Multiple Custom Domains.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/auth0-java-mvc-common/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. If the API call fails, use `1.12.0`.

## Prerequisites

- Java 8+ (Java 17+ recommended)
- Servlet container (Tomcat, Jetty, etc.) with javax.servlet 3+
- Maven 3.6+ or Gradle 7+
- Auth0 Regular Web Application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

| Use Case | Recommended Skill |
|----------|-------------------|
| Spring Boot web applications with auto-configuration | Use Spring Boot + Okta starter for auto-configured Spring Boot login |
| Spring Boot REST APIs (stateless JWT) | Use the Auth0 integration workflow for Spring Boot REST APIs (JWT Bearer token validation) |
| Single Page Applications | Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth |
| Mobile applications | Use the Auth0 integration workflow for Android or Swift for native mobile |
| Machine-to-machine API calls | Use Auth0 Management API SDK for server-to-server |

## Quick Start Workflow

> **Agent instruction:** Do not write or echo credential values (domain, client ID, client secret) yourself. If the user's prompt already provides Auth0 credentials, skip the credential questions and instruct the user to populate their `.env` file — provide the variable names and file path but use placeholders (`<YOUR_DOMAIN>`, `<YOUR_CLIENT_ID>`, `<YOUR_CLIENT_SECRET>`), never actual values. Never repeat credentials back in responses.

> **Secret handling rules:**
> - Never retrieve or parse `client_secret` from Auth0 CLI output.
> - Never write actual credential values into any file using the Write or Edit tool — always use placeholders and instruct the user to substitute their real values.
> - Do NOT read `.env` files (to avoid exposing existing secrets in context).
> - Always ensure `.env` is in `.gitignore` — add the entry automatically if missing.

### 1. Install SDK

**Gradle (build.gradle):**

```groovy
implementation 'com.auth0:mvc-auth-commons:1.12.0'
```

**Maven (pom.xml):**

```xml
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>mvc-auth-commons</artifactId>
    <version>1.12.0</version>
</dependency>
```

### 2. Create Auth0 Application

You need a **Regular Web Application** (not SPA or Native) in Auth0.

> **STOP — ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 application?
> > 1. **Automated** — I'll run Auth0 CLI commands that create the application and write the values to your config automatically.
> > 2. **Manual** — You create the application yourself in the Auth0 Dashboard (or via `auth0 apps create`) and provide me the Domain, Client ID, and Client Secret.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Setup Guide section below for the complete Auth0 CLI steps. The automated path writes configuration for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the Setup Guide section below (Manual Setup section). Then continue with Step 3.

Quick reference for manual application creation:

```bash
# Using Auth0 CLI
auth0 apps create \
  --name "My Java Web App" \
  --type regular \
  --callbacks http://localhost:3000/callback \
  --logout-urls http://localhost:3000
```

Or create manually in Auth0 Dashboard → Applications → Applications → Create Application → Regular Web Applications

### 3. Configure Credentials

Store credentials as environment variables (never hardcode in source):

```bash
export AUTH0_DOMAIN="your-tenant.auth0.com"
export AUTH0_CLIENT_ID="your-client-id"
export AUTH0_CLIENT_SECRET="<YOUR_CLIENT_SECRET>"
```

Or use a `.env` file (add to `.gitignore`):

```properties
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
```

> **Agent instruction:** Never write actual credential values to files. Instead, instruct the user to create or update `.env` with their credentials. Provide the template with placeholders only. Always add `.env` to `.gitignore` if not already present. Warn the user: _"Check your `.env` for duplicate Auth0 entries if you've configured it previously."_
>
> Java does not auto-load `.env` files. `System.getenv()` only reads OS-level environment variables. If you generate a `.env` file, you must also either: (1) add [dotenv-java](https://github.com/cdimascio/dotenv-java) as a dependency and use `Dotenv.load().get("AUTH0_DOMAIN")` instead of `System.getenv()`, or (2) instruct the user to run `source .env` before starting the server. Do not generate code that uses both a `.env` file and `System.getenv()` without a loading mechanism — the values will be `null`.

**Important:** Domain must NOT include `https://`. The library constructs the issuer URL automatically.

### 4. Initialize AuthenticationController

Create a singleton `AuthenticationController` instance:

```java
import com.auth0.AuthenticationController;
import com.auth0.jwk.JwkProviderBuilder;
import com.auth0.jwk.JwkProvider;

public class Auth0Config {

    private static final AuthenticationController controller = createController();

    private static AuthenticationController createController() {
        String domain = System.getenv("AUTH0_DOMAIN");
        String clientId = System.getenv("AUTH0_CLIENT_ID");
        String clientSecret = System.getenv("AUTH0_CLIENT_SECRET");

        JwkProvider jwkProvider = new JwkProviderBuilder(domain).build();

        return AuthenticationController.newBuilder(domain, clientId, clientSecret)
            .withJwkProvider(jwkProvider)
            .build();
    }

    public static AuthenticationController getAuthController() {
        return controller;
    }
}
```

### 5. Create Login Servlet

```java
import com.auth0.AuthenticationController;
import com.auth0.AuthorizeUrl;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet(urlPatterns = {"/login"})
public class LoginServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        AuthenticationController controller = Auth0Config.getAuthController();

        // Build callback URL — omit port for standard ports (80/443) to avoid
        // mismatch with the URL registered in Auth0 Dashboard, especially behind proxies.
        String scheme = request.getScheme();
        int port = request.getServerPort();
        String redirectUrl = scheme + "://" + request.getServerName()
            + ((port == 80 || port == 443) ? "" : ":" + port) + "/callback";

        AuthorizeUrl authorizeUrl = controller.buildAuthorizeUrl(request, response, redirectUrl)
            .withScope("openid profile email");

        response.sendRedirect(authorizeUrl.build());
    }
}
```

### 6. Create Callback Servlet

```java
import com.auth0.AuthenticationController;
import com.auth0.IdentityVerificationException;
import com.auth0.Tokens;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet(urlPatterns = {"/callback"})
public class CallbackServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        AuthenticationController controller = Auth0Config.getAuthController();

        try {
            Tokens tokens = controller.handle(request, response);

            request.getSession().setAttribute("accessToken", tokens.getAccessToken());
            request.getSession().setAttribute("idToken", tokens.getIdToken());

            response.sendRedirect("/dashboard");
        } catch (IdentityVerificationException e) {
            response.sendRedirect("/login?error=" + e.getCode());
        }
    }
}
```

### 7. Protect Routes with Authentication Middleware (Servlet Filter)

```java
import javax.servlet.*;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;

@WebFilter(urlPatterns = {"/dashboard/*", "/api/private/*"})
public class AuthenticationFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        HttpSession session = request.getSession(false);

        if (session == null || session.getAttribute("idToken") == null) {
            response.sendRedirect("/login");
            return;
        }

        chain.doFilter(req, res);
    }

    @Override
    public void init(FilterConfig filterConfig) {}

    @Override
    public void destroy() {}
}
```

### 8. Test Application

> **Agent instruction:** After writing all code, verify the build succeeds:
> ```bash
> ./gradlew build
> ```
> or `mvn package`. If build fails, diagnose and fix. After 5-6 failed attempts, use `AskUserQuestion` to get help.

1. Start the application and navigate to `http://localhost:3000/login`
2. You should be redirected to the Auth0 Universal Login page
3. After login, the callback servlet handles the response and redirects to `/dashboard`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Domain includes `https://` | Use `your-tenant.auth0.com` format only — no scheme prefix |
| Client secret hardcoded in source | Use environment variables or `.env` file, add to `.gitignore` |
| Created SPA or Native app instead of Regular Web | Must create **Regular Web Application** in Auth0 Dashboard |
| Callback URL mismatch | Callback URL in code must exactly match what's registered in Auth0 Dashboard |
| Missing `openid` scope | Always include `openid` in the scope — required for ID token |
| Not handling `IdentityVerificationException` | Always catch this in the callback handler to show login errors |
| Using `response_type=token` | Regular web apps must use `code` flow (the default) — never implicit |
| Session not invalidated on logout | Call `request.getSession().invalidate()` before redirecting to Auth0 logout |

## Scope and Audience Configuration

See the Integration Patterns sections below for requesting custom scopes, audience for API access tokens, and Organizations support.

## Multiple Custom Domains (MCD)

Built-in support for routing users to the correct Auth0 domain via `DomainResolver`. See the Multiple Custom Domains (MCD) section below for configuration.

## Related Skills

- Basic Auth0 setup and account creation → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Spring Boot REST APIs with JWT Bearer token validation → the Auth0 integration workflow for Spring Boot APIs

## Quick Reference

**Core Classes:**
- `AuthenticationController` — Main entry point, builds authorize URLs and handles callbacks
- `AuthenticationController.Builder` — Configures the controller via `newBuilder(domain, clientId, clientSecret)`
- `AuthorizeUrl` — Fluent builder for `/authorize` URL parameters
- `Tokens` — Access token, ID token, refresh token from callback
- `IdentityVerificationException` — Authentication error with error code
- `DomainResolver` — Interface for Multiple Custom Domain support

**Builder Methods (`AuthorizeUrl`):**
- `.withScope("openid profile email")` — Set requested scopes
- `.withAudience("https://my-api")` — Request API access token
- `.withOrganization("org_xxx")` — Lock to specific Organization
- `.withInvitation("invite_xxx")` — Accept Organization invitation
- `.withConnection("google-oauth2")` — Skip to specific connection
- `.withParameter("key", "value")` — Add custom authorize parameter

**Token Access (`Tokens`):**
- `tokens.getAccessToken()` — Access token string
- `tokens.getIdToken()` — ID token (JWT) string
- `tokens.getRefreshToken()` — Refresh token (if `offline_access` scope requested)
- `tokens.getExpiresIn()` — Token expiration in seconds
- `tokens.getType()` — Token type (usually "Bearer")
- `tokens.getDomain()` — Auth0 domain that issued the tokens
- `tokens.getIssuer()` — Token issuer URL

## References

- [Auth0 Java Web App Quickstart](https://auth0.com/docs/quickstart/webapp/java)
- [SDK GitHub Repository](https://github.com/auth0/auth0-java-mvc-common)
- [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login)
- [Authorization Code Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow)
- [Auth0 Organizations](https://auth0.com/docs/manage-users/organizations)

---

# Auth0 Java MVC Common API Reference

Complete API reference for `com.auth0:mvc-auth-commons`.

---

## AuthenticationController

Main entry point for Auth0 authentication in Java Servlet applications.

### Builder

```java
AuthenticationController.newBuilder(String domain, String clientId, String clientSecret)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | `String` | Yes | Auth0 tenant domain (no `https://` prefix) |
| `clientId` | `String` | Yes | Application Client ID |
| `clientSecret` | `String` | Yes | Application Client Secret |

**Builder with DomainResolver (MCD):**

```java
AuthenticationController.newBuilder(DomainResolver resolver, String clientId, String clientSecret)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resolver` | `DomainResolver` | Yes | Resolves domain per request for Multiple Custom Domains |
| `clientId` | `String` | Yes | Application Client ID |
| `clientSecret` | `String` | Yes | Application Client Secret |

### Builder Configuration Methods

| Method | Description |
|--------|-------------|
| `.withResponseType("code")` | Set OAuth response_type (default: `code`) |
| `.withJwkProvider(JwkProvider)` | Custom JWK provider for token verification |
| `.withClockSkew(int)` | Clock skew tolerance in seconds for token validation (default: 60) |
| `.withHttpOptions(HttpOptions)` | HTTP proxy/timeout configuration |
| `.withCookiePath(String)` | Cookie path attribute |
| `.withAuthenticationMaxAge(Integer)` | Validates `auth_time` claim in the ID token |
| `.withLegacySameSiteCookie(boolean)` | Controls SameSite=None fallback cookie (default: `true`) |
| `.withOrganization(String)` | Sends `organization` to `/authorize` **and** validates `org_id`/`org_name` claim in the returned ID token via `IdTokenVerifier`. If the value starts with `org_`, validates `org_id`; otherwise validates `org_name` (case-insensitive). Throws `TokenValidationException` on mismatch. |
| `.withInvitation(String)` | Sends `invitation` parameter to `/authorize` (no callback validation) |
| `.build()` | Build the `AuthenticationController` instance |

> **Note:** `Builder.withOrganization()` does two things: it passes the `organization` parameter to `/authorize` (via `AuthorizeUrl`) **and** validates the org claim in the returned token. `AuthorizeUrl.withOrganization()` only sends the parameter to `/authorize` without any token validation. When using `Builder.withOrganization()`, you do not need to also call `AuthorizeUrl.withOrganization()` — the Builder handles both automatically.

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `buildAuthorizeUrl(request, response, redirectUrl)` | `AuthorizeUrl` | Build `/authorize` URL with CSRF state |
| `handle(request, response)` | `Tokens` | Exchange authorization code for tokens |
| `buildAuthorizeUrl(request, redirectUrl)` | `AuthorizeUrl` | **Deprecated** — use the 3-argument version with response |
| `handle(request)` | `Tokens` | **Deprecated** — use the 2-argument version with response |

---

## AuthorizeUrl

Fluent builder for constructing the Auth0 `/authorize` redirect URL.

### Methods

| Method | Parameter | Description |
|--------|-----------|-------------|
| `.withScope(String)` | `"openid profile email"` | Space-separated scopes to request |
| `.withAudience(String)` | `"https://my-api"` | API audience for access token |
| `.withOrganization(String)` | `"org_xxx"` | Lock login to specific Organization |
| `.withInvitation(String)` | `"invite_xxx"` | Accept Organization invitation |
| `.withConnection(String)` | `"google-oauth2"` | Skip to specific identity provider |
| `.withParameter(String, String)` | key, value | Add any custom `/authorize` parameter. **Throws `IllegalArgumentException` for `state`, `nonce`, `response_type`, `redirect_uri` — use dedicated methods instead.** |
| `.withNonce(String)` | nonce value | Set a custom nonce for ID token validation |
| `.withSecureCookie(boolean)` | `true`/`false` | Set the Secure flag on state/nonce cookies |
| `.withState(String)` | state value | Custom state parameter (overrides CSRF state) |
| `.build()` | — | Returns the complete authorize URL string |

**Example:**

```java
String authorizeUrl = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email")
    .withAudience("https://my-api.example.com")
    .withOrganization("org_abc123")
    .build();
```

---

## Tokens

Holds the tokens returned after a successful authentication.

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getAccessToken()` | `String` | OAuth2 access token |
| `getIdToken()` | `String` | OpenID Connect ID token (JWT) |
| `getRefreshToken()` | `String` | Refresh token (requires `offline_access` scope) |
| `getType()` | `String` | Token type (usually "Bearer") |
| `getExpiresIn()` | `Long` | Token lifetime in seconds |
| `getDomain()` | `String` | Auth0 domain that issued the tokens |
| `getIssuer()` | `String` | Token issuer URL |

---

## DomainResolver

Interface for Multiple Custom Domains (MCD) support.

```java
public interface DomainResolver {
    String resolve(HttpServletRequest request);
}
```

### Implementation Example

```java
public class SubdomainDomainResolver implements DomainResolver {
    @Override
    public String resolve(HttpServletRequest request) {
        String host = request.getServerName();
        if (host.startsWith("eu.")) {
            return "my-tenant-eu.auth0.com";
        }
        return "my-tenant.auth0.com";
    }
}
```

---

## IdentityVerificationException

Thrown when authentication fails during callback handling.

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCode()` | `String` | Error code identifier |
| `getMessage()` | `String` | Human-readable error message |
| `isAPIError()` | `boolean` | Whether the error came from the Auth0 API |
| `isJWTError()` | `boolean` | Whether the error is a JWT validation failure |

### Error Codes

| Code | Description |
|------|-------------|
| `a0.api_error` | Auth0 API returned an error |
| `a0.missing_jwt_public_key_error` | Could not retrieve JWKS public key |
| `a0.invalid_jwt_error` | JWT validation failed (bad signature, expired, wrong audience) |

---

## InvalidRequestException

Extends `IdentityVerificationException`. Thrown when the callback request itself is invalid (e.g., state mismatch, missing tokens).

### Error Codes

| Code | Description |
|------|-------------|
| `a0.invalid_state` | State parameter mismatch between login and callback |
| `a0.missing_id_token` | No ID token returned |
| `a0.missing_access_token` | No access token returned |

Since `InvalidRequestException` extends `IdentityVerificationException`, it is caught by the same `catch` block. Use `getCode()` to distinguish specific error conditions.

---

## Environment Variable Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `AUTH0_CLIENT_ID` | Yes | Application Client ID from Auth0 Dashboard |
| `AUTH0_CLIENT_SECRET` | Yes | Application Client Secret from Auth0 Dashboard |

### Reading Environment Variables

```java
String domain = System.getenv("AUTH0_DOMAIN");
String clientId = System.getenv("AUTH0_CLIENT_ID");
String clientSecret = System.getenv("AUTH0_CLIENT_SECRET");
```

Or via servlet context parameters in `web.xml`:

```xml
<context-param>
    <param-name>auth0.domain</param-name>
    <param-value>${AUTH0_DOMAIN}</param-value>
</context-param>
<context-param>
    <param-name>auth0.clientId</param-name>
    <param-value>${AUTH0_CLIENT_ID}</param-value>
</context-param>
<context-param>
    <param-name>auth0.clientSecret</param-name>
    <param-value>${AUTH0_CLIENT_SECRET}</param-value>
</context-param>
```

---

## Standard OIDC Claims (from ID Token)

| Claim | Description |
|-------|-------------|
| `sub` | User ID (subject) |
| `name` | Full name |
| `email` | Email address |
| `email_verified` | Whether email is verified |
| `picture` | Profile picture URL |
| `nickname` | User nickname |
| `updated_at` | Last profile update timestamp |

Custom claims added via Auth0 Actions use namespaced keys, e.g., `https://example.com/roles`.

---

## Testing Checklist

- [ ] Login redirects to Auth0 Universal Login page
- [ ] Callback servlet exchanges code for tokens successfully
- [ ] Session stores tokens after successful login
- [ ] Protected routes redirect to `/login` when no session exists
- [ ] Protected routes allow access when session has valid tokens
- [ ] Logout invalidates session and redirects to Auth0 logout endpoint
- [ ] Error handling catches `IdentityVerificationException` on callback
- [ ] Environment variables are used (no hardcoded credentials)
- [ ] Callback URL in code matches Auth0 Dashboard configuration
- [ ] `openid` scope is always included in authorize request

### Test with curl

```bash
# Start the application
./gradlew appRun  # or mvn jetty:run

# Open login in browser (redirects to Auth0)
open http://localhost:3000/login

# After login, check session cookie is set
curl -v http://localhost:3000/dashboard --cookie "JSESSIONID=your-session-id"
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `a0.invalid_jwt_error` on callback | Clock skew between server and Auth0 | Use `.withClockSkew(300)` on builder |
| `a0.missing_jwt_public_key_error` | Cannot reach Auth0 JWKS endpoint | Check network/firewall, verify domain |
| Redirect loop on callback | Callback URL not registered in Auth0 | Add exact callback URL to Allowed Callback URLs |
| `state` parameter mismatch | Session lost between login and callback | Ensure same session across redirect (check cookie settings) |
| No refresh token returned | Missing `offline_access` scope | Add `offline_access` to `.withScope()` |

---

## Security Considerations

- **Never hardcode credentials** — Always use environment variables or secret management
- **Always include `openid` scope** — Required for ID token and user identification
- **Use HTTPS in production** — Auth0 requires HTTPS for callback URLs in production
- **Validate state parameter** — The library handles CSRF via state automatically; do not disable
- **Invalidate session on logout** — Always call `session.invalidate()` before Auth0 logout redirect
- **Rotate client secret** — If secret is compromised, rotate in Auth0 Dashboard immediately
- **Store tokens server-side only** — Never expose tokens to the browser via cookies or HTML

---

## References

- [Auth0 Java Web App Quickstart](https://auth0.com/docs/quickstart/webapp/java)
- [SDK GitHub Repository](https://github.com/auth0/auth0-java-mvc-common)
- [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login)
- [Authorization Code Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow)

---

# Auth0 Java MVC Common Integration Patterns

Advanced integration patterns for Java Servlet applications using `com.auth0:mvc-auth-commons`.

---

## Login and Callback Flow

### Basic Login

```java
@WebServlet(urlPatterns = {"/login"})
public class LoginServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        AuthenticationController controller = Auth0Config.getAuthController();

        String scheme = request.getScheme();
        int port = request.getServerPort();
        String redirectUrl = scheme + "://" + request.getServerName()
            + ((port == 80 || port == 443) ? "" : ":" + port) + "/callback";

        String authorizeUrl = controller.buildAuthorizeUrl(request, response, redirectUrl)
            .withScope("openid profile email")
            .build();

        response.sendRedirect(authorizeUrl);
    }
}
```

### Callback Handler

```java
@WebServlet(urlPatterns = {"/callback"})
public class CallbackServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        AuthenticationController controller = Auth0Config.getAuthController();

        try {
            Tokens tokens = controller.handle(request, response);

            // Store tokens in session
            request.getSession().setAttribute("accessToken", tokens.getAccessToken());
            request.getSession().setAttribute("idToken", tokens.getIdToken());

            // Redirect to original requested page or dashboard
            String returnTo = (String) request.getSession().getAttribute("returnTo");
            response.sendRedirect(returnTo != null ? returnTo : "/dashboard");

        } catch (IdentityVerificationException e) {
            response.sendRedirect("/login?error=" + e.getCode());
        }
    }
}
```

---

## Logout

### Complete Logout (Session + Auth0)

```java
@WebServlet(urlPatterns = {"/logout"})
public class LogoutServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // Invalidate local session
        if (request.getSession(false) != null) {
            request.getSession().invalidate();
        }

        // Redirect to Auth0 logout endpoint
        String domain = System.getenv("AUTH0_DOMAIN");
        String clientId = System.getenv("AUTH0_CLIENT_ID");
        String scheme = request.getScheme();
        int port = request.getServerPort();
        String returnTo = scheme + "://" + request.getServerName()
            + ((port == 80 || port == 443) ? "" : ":" + port);

        String logoutUrl = String.format(
            "https://%s/v2/logout?client_id=%s&returnTo=%s",
            domain, clientId, java.net.URLEncoder.encode(returnTo, "UTF-8")
        );

        response.sendRedirect(logoutUrl);
    }
}
```

**Important:** Always invalidate the local session AND redirect to Auth0 `/v2/logout` to clear the Auth0 session.

---

## Requesting API Access Tokens

To call external APIs with an access token, include the `audience` parameter:

```java
String authorizeUrl = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email read:messages")
    .withAudience("https://my-api.example.com")
    .build();
```

The returned access token will be scoped to the specified audience:

```java
Tokens tokens = controller.handle(request, response);
String apiToken = tokens.getAccessToken();  // Use this to call your API
```

---

## Organizations Support

### Lock Login to Specific Organization

```java
String authorizeUrl = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email")
    .withOrganization("org_abc123")
    .build();
```

### Accept Organization Invitation

```java
// Extract from invitation URL query parameters
String organization = request.getParameter("organization");
String invitation = request.getParameter("invitation");

AuthorizeUrl url = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email")
    .withOrganization(organization)
    .withInvitation(invitation);

response.sendRedirect(url.build());
```

### Organization Claim in Token

After login with an organization, the ID token contains an `org_id` claim:

```java
Tokens tokens = controller.handle(request, response);
// Decode the ID token to access org_id claim
// The library validates that org_id matches if withOrganization() was used
```

---

## Multiple Custom Domains (MCD)

Use `DomainResolver` to route users to different Auth0 domains based on the request:

### Implement DomainResolver

```java
import com.auth0.DomainResolver;
import javax.servlet.http.HttpServletRequest;

public class SubdomainDomainResolver implements DomainResolver {

    @Override
    public String resolve(HttpServletRequest request) {
        String host = request.getServerName();

        if (host.startsWith("eu.")) {
            return "my-tenant-eu.custom-domain.com";
        } else if (host.startsWith("au.")) {
            return "my-tenant-au.custom-domain.com";
        }

        return System.getenv("AUTH0_DOMAIN");
    }
}
```

> **Security warning:** When resolving domains from the request, always validate against a trusted allowlist of known domains. Never use the raw request `Host` header as a domain value — an attacker could manipulate it. For single-tenant deployments, return a hardcoded domain. If behind a reverse proxy, ensure `X-Forwarded-Host` is set by a trusted proxy only.

### Configure with DomainResolver

```java
DomainResolver resolver = new SubdomainDomainResolver();
AuthenticationController controller = AuthenticationController
    .newBuilder(resolver, clientId, clientSecret)
    .build();
```

The `DomainResolver` is called on each request, so each user can be directed to the correct Auth0 custom domain.

---

## Custom Scopes and Parameters

### Request Additional Scopes

```java
AuthorizeUrl url = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email offline_access read:messages write:messages");
```

Common scopes:

| Scope | Description |
|-------|-------------|
| `openid` | Required — enables OpenID Connect |
| `profile` | User's name, nickname, picture |
| `email` | User's email and verification status |
| `offline_access` | Request a refresh token |
| Custom scopes | API-specific scopes (e.g., `read:messages`) |

### Skip to Specific Connection

```java
// Go directly to Google login (skip Universal Login selection)
AuthorizeUrl url = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email")
    .withConnection("google-oauth2");
```

### Custom Parameters

```java
AuthorizeUrl url = controller.buildAuthorizeUrl(request, response, redirectUrl)
    .withScope("openid profile email")
    .withParameter("screen_hint", "signup")     // Show signup instead of login
    .withParameter("login_hint", "user@example.com")  // Pre-fill email
    .withParameter("ui_locales", "fr");                // French UI
```

---

## Clock Skew Configuration

If your server clock drifts from Auth0 servers, token validation may fail with `a0.invalid_jwt_error`:

```java
AuthenticationController controller = AuthenticationController
    .newBuilder(domain, clientId, clientSecret)
    .withClockSkew(300)  // Allow 5 minutes of clock skew
    .build();
```

---

## Protected Routes with Authentication Filter

### Basic Authentication Filter

```java
@WebFilter(urlPatterns = {"/dashboard/*", "/api/private/*"})
public class AuthenticationFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        HttpSession session = request.getSession(false);

        if (session == null || session.getAttribute("idToken") == null) {
            // Store requested URL for redirect after login
            request.getSession(true).setAttribute("returnTo", request.getRequestURI());
            response.sendRedirect("/login");
            return;
        }

        chain.doFilter(req, res);
    }

    @Override
    public void init(FilterConfig filterConfig) {}

    @Override
    public void destroy() {}
}
```

---

## Accessing User Claims

### Decode ID Token Claims

The ID token is a JWT. Decode it to access user claims:

```java
import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;

@WebServlet(urlPatterns = {"/dashboard"})
public class DashboardServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String idToken = (String) request.getSession().getAttribute("idToken");
        DecodedJWT jwt = JWT.decode(idToken);

        String userId = jwt.getSubject();
        String email = jwt.getClaim("email").asString();
        String name = jwt.getClaim("name").asString();
        String picture = jwt.getClaim("picture").asString();

        // Render dashboard with user info
        request.setAttribute("userId", userId);
        request.setAttribute("email", email);
        request.setAttribute("name", name);
        request.setAttribute("picture", picture);
        request.getRequestDispatcher("/WEB-INF/dashboard.jsp").forward(request, response);
    }
}
```

**Note:** Decoding with `JWT.decode()` does not verify the signature — the library already verified it during `controller.handle()`.

---

## Error Handling

### IdentityVerificationException

```java
try {
    Tokens tokens = controller.handle(request, response);
    // Success — store tokens
} catch (IdentityVerificationException e) {
    String errorCode = e.getCode();

    switch (errorCode) {
        case "a0.api_error":
            // Auth0 API error — check tenant config
            break;
        case "a0.missing_jwt_public_key_error":
            // Cannot reach JWKS — check network
            break;
        case "a0.invalid_jwt_error":
            // JWT validation failed — check clock skew
            break;
        case "a0.invalid_state":
            // State mismatch between login and callback — session may have been lost
            break;
        case "a0.missing_id_token":
            // No ID token returned — check scopes include "openid"
            break;
        case "a0.missing_access_token":
            // No access token returned
            break;
        default:
            // Other error
            break;
    }

    request.setAttribute("error", e.getMessage());
    request.getRequestDispatcher("/WEB-INF/error.jsp").forward(request, response);
}
```

### User-Denied Consent

If a user denies consent on the Auth0 login page, the callback receives `error=access_denied`. The library wraps this in `IdentityVerificationException`.

---

## HTTP Logging (Debugging)

### SDK Built-in Logging

The simplest way to enable debug logging:

```java
AuthenticationController controller = AuthenticationController
    .newBuilder(domain, clientId, clientSecret)
    .build();

controller.setLoggingEnabled(true);
```

### SLF4J / Logback

For more granular control, add SLF4J + Logback and configure in `logback.xml`:

```xml
<logger name="com.auth0" level="DEBUG" />
```

---

## Servlet API Compatibility

The SDK currently supports `javax.servlet` only. The code and README use `javax.servlet` imports:

```java
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
```

If your project uses `jakarta.servlet` (Jakarta EE 9+), this SDK is not compatible. Check for a Jakarta-specific version or consider an alternative like the Spring Boot Okta starter which supports Jakarta.

---

## Security Considerations

- **CSRF protection** — The library automatically generates and validates `state` parameter
- **Session fixation** — Regenerate session ID after login: `request.changeSessionId()`
- **Token storage** — Store tokens in server-side session only, never in cookies or HTML
- **HTTPS** — Use HTTPS in production; Auth0 requires it for callback URLs
- **Client secret** — Never expose in client-side code or commit to source control
- **Session timeout** — Configure session timeout in `web.xml`:

```xml
<session-config>
    <session-timeout>30</session-timeout> <!-- minutes -->
</session-config>
```

---

---

# Auth0 Java MVC Common Setup Guide

Setup and configuration guide for Auth0 Java Servlet authentication using `com.auth0:mvc-auth-commons`.

---

## Auth0 Configuration

> **Agent instruction:** Do not write or echo credential values yourself. If the user's prompt already provides Auth0 credentials (domain, client ID, client secret), skip the credential questions and instruct the user to populate their `.env` file — provide variable names and placeholders (`<YOUR_DOMAIN>`, `<YOUR_CLIENT_ID>`, `<YOUR_CLIENT_SECRET>`), never actual values.
>
> **Secret handling:** Never retrieve or parse `client_secret` from Auth0 CLI output. Never write actual credential values into any file — always use placeholders. Do NOT read `.env` files. Always add `.env` to `.gitignore` if not already present. Warn the user to check for duplicates if they may have already configured credentials.

### Option A: Automatic Setup (Auth0 CLI)

> **Agent instruction:** Use Auth0 CLI to handle Auth0 configuration automatically:
> 1. **Pre-flight checks:**
>    - Verify Auth0 CLI is installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Create the application using Auth0 CLI:**
>    ```bash
>    auth0 apps create --name "My Java Web App" --type regular --callbacks http://localhost:3000/callback --logout-urls http://localhost:3000 --json --no-input
>    ```
>    From the JSON output, note the `domain` and `client_id`. Instruct the user to add these values (along with `client_secret`) to their `.env` file themselves.
>    Do NOT extract or write any credential values from the CLI output.

### Option B: Manual Setup

> **Agent instruction:** If the user chose manual setup, use `AskUserQuestion` to collect:
> 1. Auth0 Domain
> 2. Client ID
> 3. Client Secret
>
> Then instruct the user to add these values to their `.env` file. Do not write credential values yourself — provide the template with placeholders only.

#### 1. Create Auth0 Application

```bash
# Using Auth0 CLI
auth0 apps create \
  --name "My Java Web App" \
  --type regular \
  --callbacks http://localhost:3000/callback \
  --logout-urls http://localhost:3000 \
  --json
```

Or manually in Auth0 Dashboard:
1. Go to Applications → Applications → Create Application
2. Select **Regular Web Applications**
3. Note the **Domain**, **Client ID**, and **Client Secret**
4. Under Settings → Application URIs:
   - Allowed Callback URLs: `http://localhost:3000/callback`
   - Allowed Logout URLs: `http://localhost:3000`

#### 2. Set Up Database Connection

```bash
# List existing connections
auth0 connections list --json

# Enable your app on the default database connection
# (done automatically if using Option A: Automatic Setup)
```

#### 3. Write Environment Configuration

Create a `.env` file in your project root (add to `.gitignore`):

```properties
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
```

> **Agent instruction:** Never write actual credential values to files. Instruct the user to populate `.env` with their credentials. If `.env` already exists, remind the user to append (not overwrite). Always add `.env` to `.gitignore` automatically.

> **Agent instruction:** Java does not auto-load `.env` files. If you generate a `.env` file, also add [dotenv-java](https://github.com/cdimascio/dotenv-java) and use `Dotenv.load().get("AUTH0_DOMAIN")`, or instruct the user to run `source .env` before starting the server.

---

## Secret Management

### Development

Use a `.env` file in the project root:

```properties
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
```

> **Agent instruction:** Never write actual credential values to files. Instruct the user to populate `.env` with their own values. Never retrieve secrets from CLI output. Always ensure `.env` is in `.gitignore`.

**Important:** Add `.env` to `.gitignore` to prevent committing secrets:

```bash
echo ".env" >> .gitignore
```

Load environment variables in your application. For servlet containers:

**Option 1: System environment variables**

Set on the system or in the container startup script:

```bash
export AUTH0_DOMAIN="your-tenant.auth0.com"
export AUTH0_CLIENT_ID="your-client-id"
export AUTH0_CLIENT_SECRET="<YOUR_CLIENT_SECRET>"
```

**Option 2: Servlet context parameters (web.xml)**

```xml
<context-param>
    <param-name>auth0.domain</param-name>
    <param-value>${AUTH0_DOMAIN}</param-value>
</context-param>
```

Read in code:

```java
String domain = getServletContext().getInitParameter("auth0.domain");
```

### Production

Use your deployment platform's secret management:

| Platform | Method |
|----------|--------|
| Docker | `docker run -e AUTH0_DOMAIN=... -e AUTH0_CLIENT_ID=...` |
| Kubernetes | Secrets mounted as env vars |
| AWS | Parameter Store or Secrets Manager |
| Heroku | `heroku config:set AUTH0_DOMAIN=...` |
| Tomcat | Set in `setenv.sh` or JNDI context |

**Never commit secrets to source control.**

---

## Dependency Installation

### Gradle (build.gradle)

```groovy
dependencies {
    implementation 'com.auth0:mvc-auth-commons:1.12.0'
}
```

### Maven (pom.xml)

```xml
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>mvc-auth-commons</artifactId>
    <version>1.12.0</version>
</dependency>
```

### Verify Installation

```bash
# Gradle
./gradlew dependencies | grep mvc-auth-commons

# Maven
mvn dependency:tree | grep mvc-auth-commons
```

---

## Project Structure

Typical Java Servlet project with Auth0:

```text
src/main/java/
├── com/example/
│   ├── Auth0Config.java          # AuthenticationController singleton
│   ├── LoginServlet.java         # /login endpoint
│   ├── CallbackServlet.java      # /callback endpoint
│   ├── LogoutServlet.java        # /logout endpoint
│   ├── AuthenticationFilter.java # Protect routes
│   └── DashboardServlet.java     # Protected page
src/main/webapp/
├── WEB-INF/
│   └── web.xml                   # Servlet configuration
.env                              # Auth0 credentials (gitignored)
```

---

## Callback URL Configuration

The callback URL must match **exactly** between your code and Auth0 Dashboard.

| Environment | Callback URL |
|-------------|-------------|
| Development | `http://localhost:3000/callback` |
| Production | `https://yourdomain.com/callback` |

**Build callback URL dynamically in the Login servlet:**

```java
String scheme = request.getScheme();
int port = request.getServerPort();
String redirectUrl = scheme + "://" + request.getServerName()
    + ((port == 80 || port == 443) ? "" : ":" + port) + "/callback";
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `ClassNotFoundException: com.auth0.AuthenticationController` | Dependency not in classpath | Verify Maven/Gradle dependency and rebuild |
| Auth0 returns "Callback URL mismatch" | URL in code ≠ Dashboard | Copy exact URL from code to Allowed Callback URLs |
| `IdentityVerificationException: a0.invalid_jwt_error` | Clock skew | Add `.withClockSkew(300)` to builder |
| Login redirects but callback fails silently | Missing session cookie across redirects | Check cookie SameSite settings and domain |
| `NullPointerException` reading env vars | Environment variables not set | Verify `.env` is loaded or vars are exported |

---
