# Auth0 Java MVC Common — reference hub

Add Auth0 authentication to Java Servlet web applications using `com.auth0:mvc-auth-commons`. Provides `AuthenticationController` for building authorize URLs and handling callbacks, with session-based authentication and support for Organizations and Multiple Custom Domains.

<!-- Shared prerequisites: version-fetch instruction, prerequisites, and
     when-NOT-to-use. Read this first (hop 1), then follow the dispatch table
     below to the one leaf for your intent. (Carved from the original
     framework-java-mvc.md.) -->

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

---

## Quick start

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

**If the user chose Automated**, follow the Auth0 CLI setup steps in this group's integration guide (Setup → Option A: Automatic Setup section). The automated path writes configuration for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the manual setup steps in this group's integration guide (Setup → Option B: Manual Setup section). Then continue with Step 3.

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

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-java-mvc/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For setup variants (automatic vs. manual, secret management, project structure) and advanced framework patterns (logout, Organizations, MCD, custom scopes, filters, claims, error handling): `Read: references/framework-java-mvc/integrate.md`
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-java-mvc/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration): start with `Read: references/framework-java-mvc/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
