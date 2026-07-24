# Auth0 Java MVC Common Integration

Add Auth0 authentication to Java Servlet web applications using `com.auth0:mvc-auth-commons`. Provides `AuthenticationController` for building authorize URLs and handling callbacks, with session-based authentication and support for Organizations and Multiple Custom Domains.

> **Prerequisites & setup:** the version-fetch instruction, prerequisites,
> when-NOT-to-use notes, and quick start all live in this group's hub index
> (already read on the way here) — that gets a basic integration working
> without a second read. This file holds setup variants (automatic vs. manual
> application creation, secret management, project structure) and deeper
> integration patterns (logout, Organizations, MCD, custom scopes, filters,
> claims, error handling) — see the Setup and Integration Patterns sections
> below. The full API/configuration reference and testing checklist live in
> this group's api-reference leaf.

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

---

## Setup

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

## Integration Patterns

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
