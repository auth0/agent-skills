
# Auth0 Express Integration

Add authentication to Express.js web applications using express-openid-connect.

## Prerequisites

- Express.js application
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Mobile applications** - Use the Auth0 integration workflow for React Native/Expo
- **Stateless APIs** - Use JWT validation middleware instead of session-based auth
- **Microservices** - Use JWT validation for service-to-service auth

## Quick Start Workflow

### 1. Install SDK

```bash
npm install express-openid-connect dotenv
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

**For manual setup:**

Create `.env`:

```bash
SECRET=<openssl-rand-hex-32>
BASE_URL=http://localhost:3000
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
ISSUER_BASE_URL=https://your-tenant.auth0.com
```

Generate secret: `openssl rand -hex 32`

### 3. Configure Auth Middleware

Update your Express app (`app.js` or `index.js`):

```javascript
require('dotenv').config();
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');

const app = express();

// Configure Auth0 middleware
app.use(auth({
  authRequired: false,  // Don't require auth for all routes
  auth0Logout: true,    // Enable logout endpoint
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET
}));

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

This automatically creates:
- `/login` - Login endpoint
- `/logout` - Logout endpoint
- `/callback` - OAuth callback

### 4. Add Routes

```javascript
// Public route
app.get('/', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

// Protected route
app.get('/profile', requiresAuth(), (req, res) => {
  res.send(`
    <h1>Profile</h1>
    <p>Name: ${req.oidc.user.name}</p>
    <p>Email: ${req.oidc.user.email}</p>
    <pre>${JSON.stringify(req.oidc.user, null, 2)}</pre>
    <a href="/logout">Logout</a>
  `);
});

// Login/logout links
app.get('/', (req, res) => {
  res.send(`
    ${req.oidc.isAuthenticated() ? `
      <p>Welcome, ${req.oidc.user.name}!</p>
      <a href="/profile">Profile</a>
      <a href="/logout">Logout</a>
    ` : `
      <a href="/login">Login</a>
    `}
  `);
});
```

### 5. Test Authentication

Start your server:

```bash
node app.js
```

Visit `http://localhost:3000` and test the login flow.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add callback URL in Auth0 Dashboard | Add `/callback` path to Allowed Callback URLs (e.g., `http://localhost:3000/callback`) |
| Missing or weak SECRET | Generate secure secret with `openssl rand -hex 32` and store in .env as `SECRET` |
| Setting authRequired: true globally | Set to false and use `requiresAuth()` middleware on specific routes |
| App created as SPA type in Auth0 | Must be Regular Web Application type for server-side auth |
| Session secret exposed in code | Always use environment variables, never hardcode secrets |
| Wrong baseURL for production | Update BASE_URL to match your production domain |
| Not handling logout returnTo | Add your domain to Allowed Logout URLs in Auth0 Dashboard |

## Related Skills

- Auth0 setup — set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrate from another auth provider → migration (migrate)
- Multi-factor authentication → MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)
- B2B multi-tenancy → Organizations (feature:organizations)

## Quick Reference

**Middleware Options:**
- `authRequired` - Require auth for all routes (default: false)
- `auth0Logout` - Enable /logout endpoint (default: false)
- `secret` - Session secret (required)
- `baseURL` - Application URL (required)
- `clientID` - Auth0 client ID (required)
- `issuerBaseURL` - Auth0 tenant URL (required)

**Request Properties:**
- `req.oidc.isAuthenticated()` - Check if user is logged in
- `req.oidc.user` - User profile object
- `req.oidc.accessToken` - Access token for API calls
- `req.oidc.idToken` - ID token
- `req.oidc.refreshToken` - Refresh token

**Common Use Cases:**
- Protected routes → Use `requiresAuth()` middleware (see Step 4)
- Check auth status → `req.oidc.isAuthenticated()`
- Get user info → `req.oidc.user`
- Call APIs → see the Calling APIs section below

## References

- [Express OpenID Connect Documentation](https://auth0.com/docs/libraries/express-openid-connect)
- [Auth0 Express Quickstart](https://auth0.com/docs/quickstart/webapp/express)
- [SDK GitHub Repository](https://github.com/auth0/express-openid-connect)
- [Express.js Documentation](https://expressjs.com/)

---

## Common Patterns

### Template Rendering with EJS

**Install EJS:**
```bash
npm install ejs
```

**Configure:**
```javascript
app.set('view engine', 'ejs');
```

**Create `views/index.ejs`:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Auth0 App</title>
</head>
<body>
  <% if (isAuthenticated) { %>
    <h1>Welcome, <%= user.name %>!</h1>
    <img src="<%= user.picture %>" alt="<%= user.name %>" />
    <p><%= user.email %></p>
    <a href="/logout">Logout</a>
  <% } else { %>
    <h1>Please log in</h1>
    <a href="/login">Login</a>
  <% } %>
</body>
</html>
```

**Update route:**
```javascript
app.get('/', (req, res) => {
  res.render('index', {
    isAuthenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user
  });
});
```

---

### Custom Login with Return URL

```javascript
app.get('/dashboard', requiresAuth(), (req, res) => {
  res.render('dashboard', { user: req.oidc.user });
});

// Login redirects to dashboard after authentication
app.get('/login-to-dashboard', (req, res) => {
  res.oidc.login({
    returnTo: '/dashboard'
  });
});
```

---

### Access User Information

```javascript
app.get('/user-info', requiresAuth(), (req, res) => {
  // User profile
  const user = req.oidc.user;

  // Check if authenticated
  const isAuth = req.oidc.isAuthenticated();

  // ID token
  const idToken = req.oidc.idToken;

  // ID token claims
  const idTokenClaims = req.oidc.idTokenClaims;

  res.json({
    user,
    isAuthenticated: isAuth,
    idToken: idToken
  });
});
```

---

### Call External APIs

```javascript
app.get('/call-api', requiresAuth(), async (req, res) => {
  try {
    // Extract the token string from the access token object
    const { access_token } = req.oidc.accessToken;

    const response = await fetch('https://api.example.com/data', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Note:** To call APIs, add `authorizationParams` to middleware config:

```javascript
app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET,
  authorizationParams: {
    response_type: 'code',
    audience: 'https://your-api-identifier',  // Add this
    scope: 'openid profile email'
  }
}));
```

---

### Custom Logout Redirect

```javascript
app.get('/custom-logout', (req, res) => {
  res.oidc.logout({
    returnTo: 'https://app.example.com/goodbye'
  });
});
```

---

### Conditional Authentication

```javascript
// Protect specific routes
app.get('/admin', requiresAuth(), (req, res) => {
  // Only authenticated users can access
  res.render('admin', { user: req.oidc.user });
});

// Optional authentication (check manually)
app.get('/home', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.render('home-auth', { user: req.oidc.user });
  } else {
    res.render('home-public');
  }
});
```

---

## Configuration Options

### Complete Middleware Configuration

```javascript
app.use(auth({
  authRequired: false,          // Don't require auth globally
  auth0Logout: true,            // Enable logout route
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  clientSecret: process.env.CLIENT_SECRET,

  // Authorization parameters
  authorizationParams: {
    response_type: 'code',
    audience: 'https://your-api-identifier',
    scope: 'openid profile email'
  },

  // Custom routes
  routes: {
    login: '/auth/login',       // Default: /login
    logout: '/auth/logout',     // Default: /logout
    callback: '/auth/callback', // Default: /callback
    postLogoutRedirect: '/'     // Where to go after logout
  },

  // Session configuration
  session: {
    rolling: true,              // Extend session on activity
    rollingDuration: 86400,     // 24 hours in seconds
    absoluteDuration: 604800    // 7 days in seconds
  }
}));
```

---

## Testing

1. Start your server: `node app.js` or `npm start`
2. Visit `http://localhost:3000`
3. Click "Login" - redirects to Auth0
4. Complete authentication
5. Verify redirect back with session established
6. Visit `/profile` to see protected route
7. Click "Logout" and verify session cleared

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Missing required parameter: state" | Ensure `SECRET` is set and at least 32 characters |
| Session not persisting | Check cookies are enabled and `BASE_URL` is correct |
| Infinite redirect loop | Check `authRequired: false` for middleware config |
| Callback URL mismatch | Verify `BASE_URL/callback` is in Auth0 allowed callback URLs |
| "Invalid redirect URI" | Ensure callback URL in Auth0 matches `BASE_URL` exactly |

---

## Advanced Configuration Options

### attemptSilentLogin

Automatically attempt silent login on the first unauthenticated request. Useful for checking if user is already logged in at their IDP without showing login prompt.

```javascript
app.use(auth({
  authRequired: false,
  attemptSilentLogin: true  // Try silent auth first (default: false)
}));
```

### errorOnRequiredAuth

Return 401 error instead of redirecting to login for protected routes. Useful for API endpoints that should return status codes instead of HTML redirects.

```javascript
app.use(auth({
  errorOnRequiredAuth: true  // Return 401 instead of redirecting (default: false)
}));
```

### idpLogout

Log the user out from Auth0 (federated logout) when they log out of your application, not just the application session.

```javascript
app.use(auth({
  idpLogout: true  // Also logout from Auth0 (default: false)
}));
```

### afterCallback

Execute custom logic after authentication callback, such as fetching additional user data or modifying the session.

```javascript
app.use(auth({
  afterCallback: async (req, res, session, state) => {
    // Fetch additional user profile data
    const userProfile = await fetchUserProfile(session.user.sub);

    // Add to session
    return {
      ...session,
      userProfile  // Access via req.oidc.userProfile
    };
  }
}));
```

### getLoginState

Customize the state parameter passed during login to preserve custom application state through the authentication flow.

```javascript
app.use(auth({
  getLoginState(req, options) {
    return {
      returnTo: options.returnTo || req.originalUrl,
      customData: 'custom-value'  // Your custom state
    };
  }
}));
```

---

## Security Considerations

- **Keep secrets secure** - Never commit `.env` to version control
- **Use HTTPS in production** - Auth0 requires secure callback URLs
- **Rotate secrets regularly** - Update `SECRET` periodically
- **Validate on server** - Authentication is server-side, tokens are secure
- **Configure session properly** - Set appropriate session durations
- **Use helmet** - Add security headers with `npm install helmet`

```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

# Auth0 Express Integration Patterns

Server-side authentication patterns for Express.js.

---

## Protected Routes

### Single Route

```javascript
const { requiresAuth } = require('express-openid-connect');

app.get('/admin', requiresAuth(), (req, res) => {
  res.send(`Admin: ${req.oidc.user.name}`);
});
```

### Multiple Routes

```javascript
// Protect all /admin routes
app.use('/admin', requiresAuth());

app.get('/admin/dashboard', (req, res) => {
  res.send('Dashboard');
});

app.get('/admin/settings', (req, res) => {
  res.send('Settings');
});
```

### Require Auth Globally

```javascript
app.use(auth({
  authRequired: true  // All routes require authentication
}));

// Make specific routes public
app.get('/public', (req, res) => {
  res.send('Public page');
});
```

---

## Calling APIs

### Get Access Token

```javascript
app.get('/api-call', requiresAuth(), async (req, res) => {
  const { access_token } = req.oidc.accessToken;

  const response = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  const data = await response.json();
  res.json(data);
});
```

Configure audience in middleware:

```javascript
app.use(auth({
  authorizationParams: {
    audience: 'https://your-api-identifier'
  },
  // ... other config
}));
```

---

## Custom Login/Logout

### Custom Login Handler

```javascript
app.get('/custom-login', (req, res) => {
  res.oidc.login({
    returnTo: '/dashboard',
    authorizationParams: {
      connection: 'google-oauth2'
    }
  });
});
```

### Custom Logout Handler

```javascript
app.get('/custom-logout', (req, res) => {
  res.oidc.logout({
    returnTo: '/goodbye'
  });
});
```

---

## Silent Authentication

### Automatic Silent Login

Check if user is already authenticated at their IDP without forcing a login prompt.

```javascript
const { auth, attemptSilentLogin } = require('express-openid-connect');

app.use(auth({
  authRequired: false
}));

// Try silent authentication on first visit
app.use(attemptSilentLogin());

// Your routes
app.get('/', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.send(`Welcome back, ${req.oidc.user.name}!`);
  } else {
    res.send('Not logged in <a href="/login">Login</a>');
  }
});
```

**How it works:**
- On the user's first visit, redirects to Auth0 with `prompt=none`
- If user has active IDP session, they're silently logged in
- If not, they see your page as anonymous
- Uses a cookie to prevent repeated silent login attempts

**Use cases:**
- Show login/logout button based on IDP session status
- Pre-authenticate users who have existing IDP sessions
- Provide seamless experience for returning users

---

## Session Management

### Access User Info

```javascript
app.get('/user', requiresAuth(), (req, res) => {
  res.json({
    isAuthenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user,
    idToken: req.oidc.idToken,
    accessToken: req.oidc.accessToken
  });
});
```

### Refresh Tokens

```javascript
app.use(auth({
  authorizationParams: {
    scope: 'openid profile email offline_access'
  }
}));

// Access refresh token
app.get('/refresh', requiresAuth(), (req, res) => {
  const refreshToken = req.oidc.refreshToken;
  // Use refresh token
});
```

---

## Error Handling

```javascript
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('Unauthorized');
  } else {
    next(err);
  }
});
```

---

# Auth0 Express Setup Guide

Setup instructions for Express.js applications.

---

## Quick Setup (Automated)

Below automates the setup, except for the CLIENT_SECRET. Inform the user that they have to fill in the value for the CLIENT_SECRET themselves.

**Never read the contents of `.env.local` or `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.

**Before running any part of this setup that writes to an env file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing env files and confirm with user

Before writing credentials, check which env files exist:

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env.local` exists, ask:
  - Question: "A `.env.local` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env.local" / "No, I'll update it manually"

- If `.env.local` does **not** exist but `.env` exists, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

- If neither exists, ask:
  - Question: "This setup will create a `.env.local` file containing Auth0 credentials (CLIENT_ID, ISSUER_BASE_URL, SECRET) and a placeholder for CLIENT_SECRET. Do you want to proceed?"
  - Options: "Yes, create .env.local" / "No, I'll configure it manually"

**Do not proceed with writing to any env file unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  else
    # Download and review the install script before executing
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "⚠️  Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-express" --type regular \
    --callbacks "http://localhost:3000/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
SECRET=$(openssl rand -hex 32)

# Determine target env file
if [ -f .env.local ]; then
  TARGET_FILE=".env.local"
elif [ -f .env ]; then
  TARGET_FILE=".env"
else
  TARGET_FILE=".env.local"
fi

# Append Auth0 credentials
cat >> "$TARGET_FILE" << ENVEOF
SECRET=$SECRET
BASE_URL=http://localhost:3000
CLIENT_ID=$CLIENT_ID
CLIENT_SECRET='YOUR_CLIENT_SECRET'
ISSUER_BASE_URL=https://$DOMAIN
ENVEOF

echo "✅ Auth0 credentials written to $TARGET_FILE"
```

After the script runs, remind the user to:
1. Open the env file that was written and replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0.
2. Ensure the env file is listed in `.gitignore` to avoid accidentally committing secrets.

---

## Manual Setup

### Install Packages

```bash
npm install express-openid-connect dotenv
```

### Create .env

```bash
SECRET=<openssl-rand-hex-32>
BASE_URL=http://localhost:3000
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
ISSUER_BASE_URL=https://your-tenant.auth0.com
```

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Create Regular Web Application, copy credentials

---

## Troubleshooting

**"Invalid state" error:** Regenerate `SECRET`

**Client secret required:** Express uses Regular Web Application type

**Callback URL mismatch:** Add `/callback` to Allowed Callback URLs

---
