
# Auth0 Vue.js Integration

Add authentication to Vue.js 3 single-page applications using @auth0/auth0-vue.

## Critical rules

- Before running any setup step that writes to `.env`, you MUST ask the user for explicit confirmation and wait for their answer.
- Never read the contents of `.env`; if you must, ask the user for explicit permission first.

## Prerequisites

- Vue 3+ application (Vite or Vue CLI)
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Server-side rendered Vue apps** - See [Auth0 Nuxt.js guide](https://auth0.com/docs/quickstart/webapp/nuxt) for SSR patterns
- **Vue 2 applications** - This SDK requires Vue 3+, use legacy @auth0/auth0-spa-js wrapper
- **Embedded login** - This SDK uses Auth0 Universal Login (redirect-based)
- **Backend API authentication** - Use express-openid-connect or JWT validation instead

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-vue
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

**For manual setup:**

Create `.env` file:

```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

### 3. Configure Auth0 Plugin

Update `src/main.ts`:

```typescript
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  })
);

app.mount('#app');
```

### 4. Add Authentication UI

Create a login component:

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>

    <div v-else-if="isAuthenticated">
      <img :src="user?.picture" :alt="user?.name" />
      <span>Welcome, {{ user?.name }}</span>
      <button @click="logout({ logoutParams: { returnTo: window.location.origin }})">
        Logout
      </button>
    </div>

    <button v-else @click="loginWithRedirect()">
      Login
    </button>
  </div>
</template>
```

### 5. Test Authentication

Start your dev server and test the login flow:

```bash
npm run dev
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add redirect URI in Auth0 Dashboard | Add your application URL (e.g., `http://localhost:3000`, `https://app.example.com`) to Allowed Callback URLs in Auth0 Dashboard |
| Using wrong env var prefix | Vite requires `VITE_` prefix, Vue CLI uses `VUE_APP_` |
| Not handling loading state | Always check `isLoading` before rendering auth-dependent UI |
| Storing tokens in localStorage | Never manually store tokens - SDK handles secure storage automatically |
| Missing createAuth0 plugin registration | Must call `app.use(createAuth0({...}))` before mounting app |
| Accessing auth before plugin loads | Wrap auth-dependent code in `v-if="!isLoading"` |

## Related Capabilities

- Initial Auth0 setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrating from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Core Composables:**
- `useAuth0()` - Main authentication composable
- `isAuthenticated` - Reactive check if user is logged in
- `user` - Reactive user profile information
- `loginWithRedirect()` - Initiate login
- `logout()` - Log out user
- `getAccessTokenSilently()` - Get access token for API calls

**DPoP composables** (require `useDpop: true` in `createAuth0` config):
- `createFetcher(config)` — returns a DPoP-aware `fetch`-compatible function
- `generateDpopProof(params)` — manually generate a DPoP proof JWT
- `getDpopNonce(id?)` / `setDpopNonce(nonce, id?)` — read/store the server DPoP nonce
For full DPoP setup, ask for DPoP token binding (feature:dpop).

**Common Use Cases:**
- Login/Logout buttons → See Step 4 above
- Protected routes with navigation guards → see the Protected Routes section below
- API calls with tokens → see the Calling APIs section below
- Error handling → see the Error Handling section below

## References

- [Auth0 Vue SDK Documentation](https://auth0.com/docs/libraries/auth0-vue)
- [Auth0 Vue Quickstart](https://auth0.com/docs/quickstart/spa/vuejs)
- [SDK GitHub Repository](https://github.com/auth0/auth0-vue)

---

## Common Patterns

### Protected Route (Vue Router)

**Install Vue Router:**
```bash
npm install vue-router
```

**Configure router (`src/router/index.ts`):**
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { createAuthGuard } from '@auth0/auth0-vue';
import Home from '../views/Home.vue';
import Profile from '../views/Profile.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home
    },
    {
      path: '/profile',
      name: 'Profile',
      component: Profile,
      beforeEnter: createAuthGuard()  // Protect this route
    }
  ]
});

export default router;
```

**Alternative: Use the exported `authGuard` directly:**
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@auth0/auth0-vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/profile',
      component: () => import('../views/Profile.vue'),
      beforeEnter: authGuard  // Use the pre-configured guard
    }
  ]
});
```

---

### Get User Profile

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { user, isAuthenticated } = useAuth0();
</script>

<template>
  <div v-if="isAuthenticated">
    <h1>Profile</h1>
    <img :src="user?.picture" :alt="user?.name" />
    <p>Name: {{ user?.name }}</p>
    <p>Email: {{ user?.email }}</p>
    <p>User ID: {{ user?.sub }}</p>
  </div>
  <div v-else>
    <p>Please log in to view your profile</p>
  </div>
</template>
```

---

### Call Protected API

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

const { getAccessTokenSilently } = useAuth0();
const data = ref(null);
const error = ref(null);

const callApi = async () => {
  try {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://your-api-identifier',
      }
    });

    const response = await fetch('https://api.example.com/data', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    data.value = await response.json();
  } catch (err) {
    error.value = err.message;
  }
};
</script>

<template>
  <div>
    <button @click="callApi">Call API</button>
    <div v-if="error">Error: {{ error }}</div>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

**Note:** If calling APIs, add `audience` to your plugin configuration:

```typescript
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: 'https://your-api-identifier'  // Add this
    }
  })
);
```

---

### Handle Loading and Error States

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { isLoading, error, isAuthenticated, user } = useAuth0();
</script>

<template>
  <div v-if="isLoading">
    Loading authentication...
  </div>

  <div v-else-if="error">
    Authentication error: {{ error.message }}
  </div>

  <div v-else>
    <div v-if="isAuthenticated">
      <h1>Welcome back, {{ user?.name }}!</h1>
      <!-- Authenticated content -->
    </div>
    <div v-else>
      <h1>Please log in</h1>
      <button @click="loginWithRedirect()">Login</button>
    </div>
  </div>
</template>
```

---

### Composition API with Reactive State

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

const auth0 = useAuth0();

const userName = computed(() => auth0.user.value?.name || 'Guest');
const isLoggedIn = computed(() => auth0.isAuthenticated.value);
</script>

<template>
  <div>
    <p>{{ userName }}</p>
    <p v-if="isLoggedIn">You are logged in</p>
  </div>
</template>
```

---

## Configuration Options

### Complete Plugin Configuration

```typescript
app.use(
  createAuth0({
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: 'https://your-api-identifier',  // For API calls
      scope: 'openid profile email',  // Default scopes
    },
    cacheLocation: 'localstorage',  // or 'memory' for stricter security
    useRefreshTokens: true,  // Enable refresh tokens
  })
);
```

---

## Testing

1. Start your dev server: `npm run dev`
2. Click "Login" button
3. Complete Auth0 Universal Login
4. Verify redirect back to your app with user authenticated
5. Navigate to protected routes
6. Click "Logout" and verify user is logged out

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state" error | Clear browser storage. Ensure `redirect_uri` matches configured callback URL in Auth0 |
| User stuck on loading | Check Auth0 application has correct callback URLs configured |
| API calls fail with 401 | Ensure `audience` is configured in plugin and matches your API identifier |
| Logout doesn't work | Include `returnTo` URL in logout options and configure in Auth0 "Allowed Logout URLs" |
| Router guard loops | Ensure auth guard checks `isLoading` before redirecting |

---

## Security Considerations

- **Never expose client secret** - Vue is client-side, use only public client credentials
- **Use PKCE** - Enabled by default with @auth0/auth0-vue
- **Validate tokens on backend** - Never trust client-side token validation
- **Use HTTPS in production** - Auth0 requires HTTPS for production redirect URLs
- **Implement proper CORS** - Configure allowed origins in Auth0 application settings

---

## Related Capabilities

- Initial Auth0 account setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrating from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- B2B multi-tenancy support → ask for Organizations (feature:organizations)
- Passkey authentication → ask for MFA/passkeys (feature:mfa)

---

## References

- [Auth0 Vue SDK Documentation](https://auth0.com/docs/libraries/auth0-vue)
- [Auth0 Vue SDK GitHub](https://github.com/auth0/auth0-vue)
- [Auth0 Vue Quickstart](https://auth0.com/docs/quickstart/spa/vuejs)
- [Vue Router Documentation](https://router.vuejs.org/)

---

# Auth0 Vue Integration Patterns

Practical implementation patterns and examples for common use cases.

---

## Protected Routes

### Navigation Guard

Create a navigation guard to protect routes:

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { createAuthGuard } from '@auth0/auth0-vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/Home.vue')
    },
    {
      path: '/profile',
      component: () => import('../views/Profile.vue'),
      beforeEnter: createAuthGuard(app)
    }
  ]
});

export default router;
```

### Alternative: Component-Level Guard

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { watchEffect } from 'vue';
import { useRouter } from 'vue-router';

const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
const router = useRouter();

watchEffect(() => {
  if (!isLoading.value && !isAuthenticated.value) {
    loginWithRedirect();
  }
});
</script>

<template>
  <div v-if="isAuthenticated">
    <!-- Protected content -->
  </div>
</template>
```

---

## User Profile

### Display User Information

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { user, isAuthenticated } = useAuth0();
</script>

<template>
  <div v-if="isAuthenticated">
    <img :src="user?.picture" :alt="user?.name" />
    <h2>{{ user?.name }}</h2>
    <p>{{ user?.email }}</p>
    <pre>{{ JSON.stringify(user, null, 2) }}</pre>
  </div>
</template>
```

---

## Calling APIs

### API Call with Access Token

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

const { getAccessTokenSilently } = useAuth0();
const data = ref(null);
const error = ref(null);
const loading = ref(false);

const callApi = async () => {
  loading.value = true;
  error.value = null;

  try {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://your-api-identifier'
      }
    });

    const response = await fetch('https://api.example.com/data', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    data.value = await response.json();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <button @click="callApi" :disabled="loading">
      {{ loading ? 'Loading...' : 'Call API' }}
    </button>
    <div v-if="error" class="error">{{ error }}</div>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

### Configure Plugin for API Calls

When calling APIs, add `audience` to your plugin configuration:

```typescript
// src/main.ts
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: 'https://your-api-identifier' // Add this
    }
  })
);
```

---

## Error Handling

### Handle Loading and Error States

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';

const { isLoading, error, isAuthenticated, user } = useAuth0();
</script>

<template>
  <div v-if="isLoading">Loading authentication...</div>

  <div v-else-if="error">
    <h2>Authentication Error</h2>
    <p>{{ error.message }}</p>
  </div>

  <div v-else-if="isAuthenticated">
    <h1>Welcome back, {{ user?.name }}!</h1>
    <!-- Authenticated app content -->
  </div>

  <div v-else>
    <h1>Please log in</h1>
    <LoginButton />
  </div>
</template>
```

---

## Composable Patterns

### Custom Auth Composable

Create a custom composable for common auth operations:

```typescript
// src/composables/useAuthHelper.ts
import { computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

export function useAuthHelper() {
  const {
    isAuthenticated,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently
  } = useAuth0();

  const userName = computed(() => user.value?.name || 'Guest');
  const userEmail = computed(() => user.value?.email || '');

  const login = () => {
    loginWithRedirect();
  };

  const logoutUser = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const callProtectedApi = async (url: string) => {
    const token = await getAccessTokenSilently();
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
  };

  return {
    isAuthenticated,
    userName,
    userEmail,
    login,
    logoutUser,
    callProtectedApi
  };
}
```

**Usage:**
```vue
<script setup lang="ts">
import { useAuthHelper } from '@/composables/useAuthHelper';

const { isAuthenticated, userName, login, logoutUser } = useAuthHelper();
</script>

<template>
  <div>
    <span v-if="isAuthenticated">Welcome, {{ userName }}</span>
    <button v-if="isAuthenticated" @click="logoutUser">Logout</button>
    <button v-else @click="login">Login</button>
  </div>
</template>
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state" error | Clear browser storage and try again. Ensure `redirect_uri` matches configured callback URL |
| User stuck on loading | Check Auth0 application settings have correct callback URLs configured |
| API calls fail with 401 | Ensure `audience` is configured in plugin and matches your API identifier |
| Logout doesn't work | Include `returnTo` URL in logout options and configure in Auth0 "Allowed Logout URLs" |
| CORS errors | Add your application URL to "Allowed Web Origins" in Auth0 application settings |
| Composables not reactive | Ensure you're accessing `.value` on refs returned from `useAuth0()` |

---

## Security Considerations

### Client-Side Security

- **Never expose client secret** - Vue runs client-side, use only public client credentials
- **Use PKCE** - Enabled by default with @auth0/auth0-vue
- **Validate tokens on backend** - Never trust client-side token validation
- **Use HTTPS in production** - Auth0 requires HTTPS for production redirect URLs
- **Implement proper CORS** - Configure allowed origins in Auth0 application settings

### Token Storage

The SDK stores tokens in memory by default (cleared on page refresh). To persist sessions:

```typescript
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    cacheLocation: 'localstorage', // or 'memory' for stricter security
    useRefreshTokens: true
  })
);
```

---

## Advanced Patterns

### Custom Login with Options

```typescript
import { useAuth0 } from '@auth0/auth0-vue';

const { loginWithRedirect } = useAuth0();

// Login with specific connection
await loginWithRedirect({
  authorizationParams: {
    connection: 'google-oauth2'
  }
});

// Login with signup screen
await loginWithRedirect({
  authorizationParams: {
    screen_hint: 'signup'
  }
});
```

### Handle Redirect Callback

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useRouter } from 'vue-router';

const { handleRedirectCallback } = useAuth0();
const router = useRouter();

onMounted(async () => {
  if (window.location.search.includes('code=')) {
    await handleRedirectCallback();
    router.push('/');
  }
});
</script>
```

---

## Testing

### Manual Testing Checklist

1. **Login Flow**
   - Start dev server: `npm run dev`
   - Click "Login" button
   - Complete Auth0 Universal Login
   - Verify redirect back to app with user authenticated

2. **Logout Flow**
   - Click "Logout" button
   - Verify user is logged out
   - Verify redirect to correct page

3. **Protected Routes**
   - Navigate to protected route while logged out
   - Verify redirect to Auth0 login
   - After login, verify redirect back to protected route

4. **API Calls**
   - Call protected API endpoint
   - Verify access token is included
   - Verify API responds correctly

---

---

# Auth0 Vue Setup Guide

Complete setup instructions with automated scripts and manual configuration options.

---

## Quick Setup (Automated)

**Never read the contents of `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.

**Before running any part of this setup that writes to `.env`, you must ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing .env and confirm with user

Before writing to `.env`, check whether the file already exists:

```bash
test -f .env && echo "EXISTS" || echo "NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env` does **not** exist, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (domain and client ID). Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

- If `.env` **already exists**, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

**Do not proceed with writing to `.env` unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

#### Bash Script (macOS/Linux)

Run this script to automatically set up everything:

```bash
#!/bin/bash

# Detect OS and install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  echo "Installing Auth0 CLI..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Download and review the install script before executing
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "⚠️  Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Check if logged in to Auth0
if ! auth0 tenants list &> /dev/null; then
  echo "======================================"
  echo "Auth0 Login Required"
  echo "======================================"
  read -p "Do you have an Auth0 account? (y/n): " HAS_ACCOUNT

  if [[ "$HAS_ACCOUNT" != "y" ]]; then
    echo "Let's create your free Auth0 account!"
    echo "1. Visit: https://auth0.com/signup"
    echo "2. Sign up with your email or GitHub"
    echo "3. Choose a tenant domain"
    read -p "Press Enter when you've created your account..."
  fi

  auth0 login
fi

# List apps and prompt for selection
echo "Your Auth0 applications:"
auth0 apps list

read -p "Enter your Auth0 app ID (or press Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  echo "Creating new Auth0 SPA application..."
  APP_NAME="${PWD##*/}-vue-app"
  APP_ID=$(auth0 apps create \
    --name "$APP_NAME" \
    --type spa \
    --auth-method None \
    --callbacks "http://localhost:5173,http://localhost:3000" \
    --logout-urls "http://localhost:5173,http://localhost:3000" \
    --origins "http://localhost:5173,http://localhost:3000" \
    --web-origins "http://localhost:5173,http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
  echo "Created app with ID: $APP_ID"
fi

# Get app details and create .env file
echo "Fetching Auth0 credentials..."
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)

# Append Auth0 credentials to .env
cat >> .env << EOF
VITE_AUTH0_DOMAIN=$AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
EOF

echo "✅ Auth0 configuration complete!"
echo "Appended to .env:"
echo "  VITE_AUTH0_DOMAIN=$AUTH0_DOMAIN"
echo "  VITE_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID"
```

#### PowerShell Script (Windows)

```powershell
# Install Auth0 CLI if not present
if (!(Get-Command auth0 -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Auth0 CLI..."
  scoop install auth0
}

# Check if logged in
try {
  auth0 tenants list | Out-Null
} catch {
  Write-Host "======================================"
  Write-Host "Auth0 Login Required"
  Write-Host "======================================"

  $hasAccount = Read-Host "Do you have an Auth0 account? (y/n)"

  if ($hasAccount -ne "y") {
    Write-Host "Let's create your free Auth0 account!"
    Write-Host "1. Visit: https://auth0.com/signup"
    Write-Host "2. Sign up with your email or GitHub"
    Read-Host "Press Enter when you've created your account"
  }

  auth0 login
}

# List and select app
Write-Host "Your Auth0 applications:"
auth0 apps list

$appId = Read-Host "Enter your Auth0 app ID (or press Enter to create new)"

if ([string]::IsNullOrEmpty($appId)) {
  $appName = Split-Path -Leaf (Get-Location)
  Write-Host "Creating new Auth0 SPA application..."
  $appJson = auth0 apps create --name "$appName-vue-app" --type spa `
    --auth-method None `
    --callbacks "http://localhost:5173,http://localhost:3000" `
    --logout-urls "http://localhost:5173,http://localhost:3000" `
    --origins "http://localhost:5173,http://localhost:3000" `
    --web-origins "http://localhost:5173,http://localhost:3000" `
    --metadata "created_by=agent_skills" --json

  $appId = ($appJson | ConvertFrom-Json).client_id
  Write-Host "Created app with ID: $appId"
}

# Get credentials and create .env
Write-Host "Fetching Auth0 credentials..."
$appDetails = auth0 apps show $appId --json | ConvertFrom-Json

@"
VITE_AUTH0_DOMAIN=$($appDetails.domain)
VITE_AUTH0_CLIENT_ID=$($appDetails.client_id)
"@ | Out-File -FilePath .env -Encoding UTF8 -Append

Write-Host "✅ Auth0 configuration complete!"
Write-Host "Appended to .env:"
Write-Host "  VITE_AUTH0_DOMAIN=$($appDetails.domain)"
Write-Host "  VITE_AUTH0_CLIENT_ID=$($appDetails.client_id)"
```

---

## Manual Setup

### Step 1: Install SDK

```bash
npm install @auth0/auth0-vue
```

### Step 2: Install Auth0 CLI

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux (review script before executing):**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
# Review the script before running: cat /tmp/auth0-install.sh
sh /tmp/auth0-install.sh
rm /tmp/auth0-install.sh
```

**Windows:**
```powershell
scoop install auth0
```

### Step 3: Get Credentials

```bash
# Login to Auth0
auth0 login

# List your apps
auth0 apps list

# Get app details
auth0 apps show <app-id>
```

### Step 4: Create .env File

```bash
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-client-id>
```

---

## Creating Auth0 Application via Dashboard

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Single Page Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Origins (CORS)**: `http://localhost:5173, http://localhost:3000`
6. Copy your **Domain** and **Client ID**
7. Create `.env` file as shown above

---

## Troubleshooting

### Environment Variables Not Loading

**Issue**: Variables not available in app

**Solution:**
- Ensure variables start with `VITE_` prefix
- Restart dev server after creating `.env`
- Check file is named exactly `.env` (not `.env.local`)
- Vite only loads variables at build time, not runtime

### Auth0 CLI Issues

**Browser doesn't open:**
```bash
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
auth0 login --force
```

### CORS Errors

**Issue**: CORS errors when logging in

**Solution:**
- Add your app URL to "Allowed Web Origins" in Auth0 Dashboard
- Ensure callback URLs include protocol (`http://` or `https://`)
- For local dev, use `http://localhost:5173` (Vite default)

---

## Next Steps

After setup is complete:
1. Return to the main skill guide for integration steps
