# Auth0 Angular Setup Guide

---

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 SPA application automatically
4. Extract credentials from the CLI output
5. Update `environment.ts` with the credentials

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Step 1: Install Auth0 CLI

Check if Auth0 CLI is installed, install if needed:

```bash
command -v auth0 &> /dev/null && echo "AUTH0_CLI_INSTALLED" || echo "AUTH0_CLI_NOT_FOUND"
```

**If not installed, run the appropriate command for the user's OS:**

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
```

**Windows (PowerShell):**
```powershell
scoop install auth0
```

---

## Step 2: Ensure user is logged in to Auth0

Check login status:

```bash
auth0 tenants list 2>&1
```

**If the command fails or shows an error**, the user needs to log in:

```bash
auth0 login
```

Tell the user: "A browser window will open. Please log in to your Auth0 account (or create one at https://auth0.com/signup if needed)."

**Wait for user to complete login, then verify:**

```bash
auth0 tenants list
```

---

## Step 3: Create Auth0 Application

**Create a new SPA application - run this single command:**

```bash
auth0 apps create \
  --name "$(basename "$PWD")-angular-app" \
  --type spa \
  --callbacks "http://localhost:4200" \
  --logout-urls "http://localhost:4200" \
  --origins "http://localhost:4200" \
  --web-origins "http://localhost:4200" \
  --metadata "created_by=agent_skills" \
  --json
```

**This outputs JSON. Extract these values from the response:**
- `client_id` - This is your Auth0 Client ID
- `domain` - This is your Auth0 Domain (in the format `xxx.auth0.com` or `xxx.us.auth0.com`)

**Example output parsing:**
```bash
# The command above outputs JSON like:
# {"client_id":"abc123","domain":"dev-example.us.auth0.com",...}
# Extract client_id and domain from this output
```

---

## Step 4: Update environment.ts

Angular uses TypeScript environment files instead of `.env`. Update `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  auth0: {
    domain: '<domain-from-step-3>',
    clientId: '<client_id-from-step-3>',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
```

**Replace `<domain-from-step-3>` and `<client_id-from-step-3>` with actual values from the JSON output.**

For production, also update `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  auth0: {
    domain: '<domain-from-step-3>',
    clientId: '<client_id-from-step-3>',
    authorizationParams: {
      redirect_uri: 'https://your-production-domain.com'
    }
  }
};
```

---

## Step 5: Install SDK

```bash
npm install @auth0/auth0-angular
```

---

## Verification

After setup, confirm to the user:
- Auth0 application created successfully
- Credentials updated in `environment.ts`
- SDK installed

Tell them to rebuild the app to load the new configuration.

---

## Troubleshooting

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Windows - Scoop not found:**
```powershell
iwr -useb get.scoop.sh | iex
```

### Login Issues

**Browser doesn't open:**
```bash
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
auth0 login --force
```

### Common Errors

**Module not found errors:** Ensure @auth0/auth0-angular is in package.json, run `npm install`

**CORS errors:** Add `http://localhost:4200` to "Allowed Web Origins" via CLI:

```bash
auth0 apps update <app-id> --web-origins "http://localhost:4200"
```

**Environment variables not working:** Angular uses environment files, not `.env`. Rebuild app after changes.

---

## Fallback: Manual Dashboard Setup

**Only use this if the CLI approach fails completely after troubleshooting.**

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Single Page Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:4200`
   - **Allowed Logout URLs**: `http://localhost:4200`
   - **Allowed Web Origins**: `http://localhost:4200`
6. Copy **Domain** and **Client ID** to `environment.ts`

---

## Next Steps

- [Integration Guide](integration.md) - Implementation patterns
- [API Reference](api.md) - Complete SDK documentation
- [Main Skill](../SKILL.md) - Quick start guide
