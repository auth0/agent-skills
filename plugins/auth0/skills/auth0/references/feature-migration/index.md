
# Auth0 Migration Guide

Migrate users and authentication flows from existing auth providers to Auth0.


## Overview

### When to Use This Skill

- Migrating from another auth provider to Auth0
- Bulk importing existing users
- Gradually transitioning active user bases
- Updating JWT validation in APIs

## When NOT to Use

- **Starting fresh with Auth0** - For new projects without existing users, set up Auth0 first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- **Already using Auth0** - This is for migrating TO Auth0, not between Auth0 tenants
- **Only adding MFA or features** - Use feature-specific skills if just adding capabilities

### Migration Approaches

- **Bulk Migration:** One-time user import (recommended for small/inactive bases)
- **Gradual Migration:** Lazy migration over time (recommended for large active bases)
- **Hybrid:** Import inactive users, lazy-migrate active users


## Step 0: Detect Existing Auth Provider

**Check if the project already has authentication:**

Search for common auth-related patterns in the codebase:

| Pattern | Indicates |
|---------|-----------|
| `signInWithEmailAndPassword`, `onAuthStateChanged` | Firebase Auth |
| `useUser`, `useSession`, `isSignedIn` | Existing auth hooks |
| `passport.authenticate`, `LocalStrategy` | Passport.js |
| `authorize`, `getAccessToken`, `oauth` | OAuth/OIDC |
| `JWT`, `jwt.verify`, `jsonwebtoken` | Token-based auth |
| `/api/auth/`, `/login`, `/callback` | Auth routes |

**If existing auth detected, ask:**

> I detected existing authentication in your project. Are you:
> 1. **Migrating to Auth0** (replace existing auth)
> 2. **Adding Auth0 alongside** (keep both temporarily)
> 3. **Starting fresh** (remove old auth, new Auth0 setup)


## Migration Workflow

### Step 1: Export Existing Users

Export users from your current provider. See the User Import section below for detailed instructions:
- Exporting from Firebase
- Exporting from AWS Cognito
- Exporting from Supabase
- Exporting from Custom Database

**Required data per user:**
- Email address
- Email verified status
- Password hash (if available)
- User metadata/profile data
- Creation timestamp


### Step 2: Import Users to Auth0

Import users via Dashboard, CLI, or Management API.

**Quick start:**
```bash
# Via Auth0 CLI
auth0 api post "jobs/users-imports" \
  --data "connection_id=con_ABC123" \
  --data "users=@users.json"
```

**For detailed instructions, see the sections below:**
- User JSON Format
- Password Hash Algorithms
- Import Methods
- Monitoring Import Progress
- Common Import Errors


### Step 3: Migrate Application Code

Update your application code to use Auth0 SDKs.

**See the Code Migration Patterns section below for detailed before/after examples:**

**Frontend:**
- React Migration
- Next.js Migration
- Vue.js Migration
- Angular Migration
- React Native Migration

**Backend:**
- Express.js Migration
- API JWT Validation

**Provider-Specific:**
- Firebase to Auth0
- Supabase to Auth0
- Clerk to Auth0

**After migrating code, follow the Auth0 integration workflow for your framework** (React, Next.js, Vue.js, Angular, Express.js, or React Native/Expo).


### Step 4: Update API JWT Validation

If your API validates JWTs, update to validate Auth0 tokens.

**Key differences:**
- **Algorithm:** HS256 (symmetric) → RS256 (asymmetric)
- **Issuer:** Custom → `https://YOUR_TENANT.auth0.com/`
- **JWKS URL:** `https://YOUR_TENANT.auth0.com/.well-known/jwks.json`

**See the Backend API JWT Validation section below for:**
- Node.js / Express implementation
- Python / Flask implementation
- Key differences and migration checklist


## Gradual Migration Strategy

For production applications with active users, use a phased approach:

### Phase 1: Parallel Auth

Support both Auth0 and legacy provider simultaneously:

```typescript
// Support both providers during migration
const getUser = async () => {
  // Try Auth0 first
  const auth0User = await getAuth0User();
  if (auth0User) return auth0User;

  // Fall back to legacy provider
  return await getLegacyUser();
};
```

### Phase 2: New Users on Auth0

- All new signups go to Auth0
- Existing users continue on legacy provider
- Migrate users on next login (lazy migration)

### Phase 3: Forced Migration

- Prompt remaining users to "update account"
- Send password reset emails via Auth0
- Set deadline for legacy system shutdown

### Phase 4: Cleanup

- Remove legacy auth code
- Archive user export for compliance
- Update documentation


## Common Migration Issues

| Issue | Solution |
|-------|----------|
| Password hashes incompatible | Use Auth0 custom DB connection with lazy migration |
| Social logins don't link | Configure same social connection, users auto-link by email |
| Custom claims missing | Add claims via Auth0 Actions |
| Token format different | Update API to validate RS256 JWTs with Auth0 issuer |
| Session persistence | Auth0 uses rotating refresh tokens; update token storage |
| Users must re-login | Expected for redirect-based auth; communicate to users |


## Reference Documentation

### User Import
Complete guide to exporting and importing users:
- Exporting from Common Providers
- User JSON Format
- Password Hash Algorithms
- Import Methods
- Monitoring & Troubleshooting

### Code Migration
Before/after examples for all major frameworks:
- React Patterns
- Next.js Patterns
- Express Patterns
- Vue.js Patterns
- Angular Patterns
- React Native Patterns
- API JWT Validation


All of this lives in the one `auth0` skill — just describe what you need (e.g. "add MFA", "protect my API").


## References

- [Auth0 User Migration Documentation](https://auth0.com/docs/manage-users/user-migration)
- [Bulk User Import](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports)
- [Password Hash Algorithms](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports#password-hashing-algorithms)
- [Management API - User Import](https://auth0.com/docs/api/management/v2/jobs/post-users-imports)

---

# Code Migration Patterns

Before/after code examples for migrating from common auth providers to Auth0 across different frameworks.

---

## React Migration

### Email/Password Authentication

**Before (typical pattern):**
```typescript
// Old provider pattern
await signIn(email, password);
await signOut();
const user = getCurrentUser();
```

**After (Auth0):**
```typescript
import { useAuth0 } from '@auth0/auth0-react';

const { loginWithRedirect, logout, user, isAuthenticated } = useAuth0();

// Login triggers redirect to Auth0 Universal Login
loginWithRedirect();

// Logout with redirect
logout({ logoutParams: { returnTo: window.location.origin } });

// User available when authenticated
if (isAuthenticated) {
  console.log(user.email);
}
```

---

### Auth State Listener

**Before (typical pattern):**
```typescript
// Old provider pattern
onAuthStateChange((user) => {
  if (user) { /* authenticated */ }
  else { /* not authenticated */ }
});
```

**After (Auth0):**
```typescript
import { useAuth0 } from '@auth0/auth0-react';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) return <Loading />;

  return isAuthenticated ? (
    <AuthenticatedApp user={user} />
  ) : (
    <LoginPage />
  );
}
```

---

### Protected Routes

**Before (typical pattern):**
```typescript
// Old provider pattern
function ProtectedRoute({ children }) {
  const user = useCurrentUser();
  return user ? children : <Redirect to="/login" />;
}
```

**After (Auth0):**
```typescript
import { useAuth0 } from '@auth0/auth0-react';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) return <Loading />;

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return children;
}
```

---

### API Token Retrieval

**Before (typical pattern):**
```typescript
// Old provider pattern
const token = await user.getIdToken();
fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
```

**After (Auth0):**
```typescript
import { useAuth0 } from '@auth0/auth0-react';

function ApiComponent() {
  const { getAccessTokenSilently } = useAuth0();

  const callApi = async () => {
    const token = await getAccessTokenSilently();
    const response = await fetch('/api/data', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  };
}
```

---

## Next.js Migration

### Middleware Protection

**Before (typical pattern):**
```typescript
// Old provider middleware pattern
export function middleware(request) {
  const session = getSession(request);
  if (!session) return redirect('/login');
}
```

**After (Auth0):**
```typescript
// middleware.ts
import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';

export default withMiddlewareAuthRequired();

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*']
};
```

---

### Server Components (App Router)

**Before (typical pattern):**
```typescript
// Old provider pattern
async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return <div>Welcome {session.user.name}</div>;
}
```

**After (Auth0):**
```typescript
import { getSession } from '@auth0/nextjs-auth0';

async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/api/auth/login');

  return <div>Welcome {session.user.name}</div>;
}
```

---

### API Routes

**Before (typical pattern):**
```typescript
// Old provider pattern
export async function GET(request) {
  const session = await getSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  return Response.json({ data: 'protected' });
}
```

**After (Auth0):**
```typescript
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';

export const GET = withApiAuthRequired(async function handler(req) {
  const session = await getSession();
  return Response.json({ data: 'protected' });
});
```

---

## Express.js Migration

### Server-Side Session Auth

**Before (typical pattern):**
```typescript
// Old provider pattern with manual session
app.post('/login', async (req, res) => {
  const user = await validateCredentials(req.body);
  req.session.user = user;
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  // ...
});
```

**After (Auth0):**
```typescript
const { auth, requiresAuth } = require('express-openid-connect');

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL
}));

// Auth0 handles /login, /logout, /callback automatically
app.get('/dashboard', requiresAuth(), (req, res) => {
  // req.oidc.user contains the authenticated user
  res.render('dashboard', { user: req.oidc.user });
});
```

---

### Express API Route Protection

**Before (typical pattern):**
```typescript
// Old provider pattern
app.get('/api/data', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await verifyToken(token);

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  res.json({ data: 'protected' });
});
```

**After (Auth0):**
```typescript
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL
});

app.get('/api/data', checkJwt, (req, res) => {
  // req.auth contains verified token claims
  res.json({ data: 'protected' });
});
```

---

## Vue.js Migration

### Authentication

**Before (typical pattern):**
```vue
<script setup>
import { onMounted, ref } from 'vue';

const user = ref(null);

onMounted(async () => {
  user.value = await getCurrentUser();
});

const login = async () => {
  await signIn();
};

const logout = async () => {
  await signOut();
};
</script>
```

**After (Auth0):**
```vue
<script setup>
import { useAuth0 } from '@auth0/auth0-vue';

const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isAuthenticated">
    <p>Welcome {{ user.name }}</p>
    <button @click="logout({ logoutParams: { returnTo: window.location.origin }})">
      Logout
    </button>
  </div>
  <button v-else @click="loginWithRedirect()">Login</button>
</template>
```

---

### Vue Router Guards

**Before (typical pattern):**
```typescript
// Old provider pattern
router.beforeEach(async (to, from, next) => {
  const user = await getCurrentUser();

  if (to.meta.requiresAuth && !user) {
    next('/login');
  } else {
    next();
  }
});
```

**After (Auth0):**
```typescript
import { createAuthGuard } from '@auth0/auth0-vue';

router.beforeEach(createAuthGuard((to) => {
  if (to.meta.requiresAuth) {
    return true; // Requires authentication
  }
  return false; // Public route
}));
```

---

## Angular Migration

### Authentication Service

**Before (typical pattern):**
```typescript
// Old provider pattern
@Injectable({ providedIn: 'root' })
export class AuthService {
  async login() {
    return await signIn();
  }

  async logout() {
    return await signOut();
  }

  getCurrentUser() {
    return this.currentUser$;
  }
}
```

**After (Auth0):**
```typescript
import { AuthService } from '@auth0/auth0-angular';
import { inject } from '@angular/core';

@Component({
  selector: 'app-auth',
  template: `
    <div *ngIf="auth.isAuthenticated$ | async; else loggedOut">
      <p>Welcome {{ (auth.user$ | async)?.name }}</p>
      <button (click)="logout()">Logout</button>
    </div>
    <ng-template #loggedOut>
      <button (click)="login()">Login</button>
    </ng-template>
  `
})
export class AuthComponent {
  auth = inject(AuthService);

  login() {
    this.auth.loginWithRedirect();
  }

  logout() {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
```

---

### Route Guards

**Before (typical pattern):**
```typescript
// Old provider pattern
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    const user = this.authService.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }
}
```

**After (Auth0):**
```typescript
import { inject } from '@angular/core';
import { AuthGuard } from '@auth0/auth0-angular';

const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  }
];
```

---

### HTTP Interceptor

**Before (typical pattern):**
```typescript
// Old provider pattern
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    const token = this.authService.getToken();

    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    return next.handle(req);
  }
}
```

**After (Auth0):**
```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authHttpInterceptorFn])
    )
  ]
};
```

---

## React Native Migration

### Authentication

**Before (typical pattern):**
```typescript
// Old provider pattern
const [user, setUser] = useState(null);

const login = async () => {
  const result = await signIn();
  setUser(result.user);
};

const logout = async () => {
  await signOut();
  setUser(null);
};
```

**After (Auth0):**
```typescript
import Auth0 from 'react-native-auth0';

const auth0 = new Auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID
});

const [user, setUser] = useState(null);

const login = async () => {
  try {
    const credentials = await auth0.webAuth.authorize({
      scope: 'openid profile email'
    });
    setUser(credentials.idTokenPayload);
  } catch (error) {
    console.error('Login error:', error);
  }
};

const logout = async () => {
  try {
    await auth0.webAuth.clearSession();
    setUser(null);
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## Backend API JWT Validation

### Node.js / Express

**Before (typical pattern):**
```typescript
// Old provider pattern
import jwt from 'jsonwebtoken';

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256']
  });
};

app.get('/api/protected', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = verifyToken(token);
  res.json({ data: 'protected' });
});
```

**After (Auth0):**
```typescript
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const client = new JwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

async function validateToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  const key = await client.getSigningKey(decoded.header.kid);

  return jwt.verify(token, key.getPublicKey(), {
    algorithms: ['RS256'],
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`
  });
}

app.get('/api/protected', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = await validateToken(token);
  res.json({ data: 'protected' });
});
```

**Key Differences:**
- **Algorithm:** HS256 (symmetric) → RS256 (asymmetric)
- **Secret:** Shared secret → Public key from JWKS endpoint
- **Issuer:** Custom → Auth0 tenant URL
- **Audience:** Optional → Required for API validation

---

### Python / Flask

**Before (typical pattern):**
```python
# Old provider pattern
import jwt

def verify_token(token):
    return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])

@app.route('/api/protected')
def protected():
    token = request.headers.get('Authorization').split(' ')[1]
    user = verify_token(token)
    return {'data': 'protected'}
```

**After (Auth0):**
```python
from jose import jwt
import requests

def get_jwks():
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    return requests.get(jwks_url).json()

def verify_token(token):
    jwks = get_jwks()
    unverified_header = jwt.get_unverified_header(token)

    # Find the key
    rsa_key = {}
    for key in jwks['keys']:
        if key['kid'] == unverified_header['kid']:
            rsa_key = {
                'kty': key['kty'],
                'kid': key['kid'],
                'use': key['use'],
                'n': key['n'],
                'e': key['e']
            }

    return jwt.decode(
        token,
        rsa_key,
        algorithms=['RS256'],
        audience=AUTH0_AUDIENCE,
        issuer=f"https://{AUTH0_DOMAIN}/"
    )

@app.route('/api/protected')
def protected():
    token = request.headers.get('Authorization').split(' ')[1]
    user = verify_token(token)
    return {'data': 'protected'}
```

---

## Provider-Specific Patterns

### Firebase to Auth0

**Common Firebase patterns:**
```typescript
// Firebase
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const user = userCredential.user;
```

**Auth0 equivalent:**
```typescript
// Auth0 - uses redirect flow, not direct credentials
import { useAuth0 } from '@auth0/auth0-react';

const { loginWithRedirect } = useAuth0();
await loginWithRedirect();
```

**Note:** Auth0 uses Universal Login (redirect), not direct email/password submission for better security.

---

### Supabase to Auth0

**Common Supabase patterns:**
```typescript
// Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
```

**Auth0 equivalent:**
```typescript
// Auth0
import { useAuth0 } from '@auth0/auth0-react';

const { loginWithRedirect } = useAuth0();
await loginWithRedirect();
```

---

### Clerk to Auth0

**Common Clerk patterns:**
```typescript
// Clerk
import { useUser, useSignIn } from '@clerk/nextjs';

const { isSignedIn, user } = useUser();
const { signIn } = useSignIn();
```

**Auth0 equivalent:**
```typescript
// Auth0
import { useUser } from '@auth0/nextjs-auth0/client';

const { user, error, isLoading } = useUser();
const login = () => window.location.href = '/api/auth/login';
```

---

## References

- [Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 Next.js SDK](https://auth0.com/docs/libraries/nextjs)
- [Auth0 Vue SDK](https://auth0.com/docs/libraries/auth0-vue)
- [Auth0 Angular SDK](https://auth0.com/docs/libraries/auth0-angular)
- [Auth0 React Native SDK](https://auth0.com/docs/libraries/react-native-auth0)
- [Express OpenID Connect](https://auth0.com/docs/libraries/express-openid-connect)

---

# User Export and Import Guide

Detailed guide for exporting users from existing auth providers and importing them to Auth0.

---

## Exporting Users from Common Providers

**Caution:** These export files contain password hashes and PII. Never commit them (add to `.gitignore`), keep them out of shared/CI logs, and delete them once the import succeeds.

### Firebase

**Via Firebase Console:**
1. Go to Authentication → Users
2. Click "..." menu → Export users
3. Downloads JSON file

**Via Firebase CLI:**
```bash
firebase auth:export users.json --format=JSON
```

**Firebase user format:**
```json
{
  "users": [
    {
      "localId": "user123",
      "email": "user@example.com",
      "emailVerified": true,
      "passwordHash": "base64-encoded-hash",
      "salt": "base64-encoded-salt",
      "createdAt": "1234567890000"
    }
  ]
}
```

---

### AWS Cognito

**Via AWS CLI:**
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_ABC123 \
  --output json > users.json
```

**Via Node.js Script:**
```javascript
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

async function exportUsers() {
  let users = [];
  let paginationToken;

  do {
    const response = await cognito.listUsers({
      UserPoolId: 'us-east-1_ABC123',
      PaginationToken: paginationToken
    }).promise();

    users = users.concat(response.Users);
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}
```

---

### Supabase

**Via Supabase SQL:**
```sql
-- Connect to Supabase database
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL as email_verified,
  encrypted_password,
  created_at,
  raw_user_meta_data
FROM auth.users;
```

**Export to JSON:**
```bash
psql $DATABASE_URL -c "COPY (SELECT row_to_json(t) FROM (
  SELECT id, email, encrypted_password, created_at
  FROM auth.users
) t) TO STDOUT" > users.json
```

---

### Custom Database

**Example SQL query:**
```sql
SELECT
  id,
  email,
  email_verified,
  password_hash,
  created_at,
  last_login,
  metadata
FROM users
WHERE active = true;
```

**Export script (Node.js):**
```javascript
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function exportUsers() {
  const result = await pool.query(`
    SELECT
      id,
      email,
      email_verified,
      password_hash,
      created_at
    FROM users
  `);

  return result.rows.map(row => ({
    email: row.email,
    email_verified: row.email_verified,
    user_id: row.id,
    created_at: row.created_at.toISOString()
  }));
}
```

---

## Required User Data

### Minimum Required Fields

| Field | Required | Description |
|-------|----------|-------------|
| `email` | ✅ Yes | User's email address |
| `email_verified` | ✅ Yes | Whether email is verified (true/false) |
| `user_id` | No | Original user ID (preserved for reference) |
| `password` | No* | Only if using password hash |
| `custom_password_hash` | No* | Password hash with algorithm |

*Either `password` (plain text, not recommended) or `custom_password_hash` required for password-based users.

### Optional Fields

| Field | Description |
|-------|-------------|
| `given_name` | First name |
| `family_name` | Last name |
| `name` | Full name |
| `nickname` | Display name |
| `picture` | Profile picture URL |
| `created_at` | Account creation timestamp |
| `user_metadata` | Custom user data (editable by user) |
| `app_metadata` | Custom app data (not editable by user) |

---

## Auth0 User Import Format

### JSON Structure

```json
[
  {
    "email": "user@example.com",
    "email_verified": true,
    "user_id": "original-id-from-old-system",
    "custom_password_hash": {
      "algorithm": "bcrypt",
      "hash": "$2a$10$abcdefghijklmnopqrstuv"
    },
    "given_name": "John",
    "family_name": "Doe",
    "name": "John Doe",
    "nickname": "johnd",
    "picture": "https://example.com/avatar.jpg",
    "user_metadata": {
      "hobby": "reading",
      "plan": "premium",
      "migrated_from": "firebase"
    },
    "app_metadata": {
      "roles": ["admin"],
      "permissions": ["read:users", "write:posts"]
    }
  }
]
```

---

## Password Hash Algorithms

### Supported Algorithms

Auth0 supports these password hashing algorithms:

| Algorithm | Common Usage | Example |
|-----------|--------------|---------|
| `bcrypt` | Node.js, Ruby, PHP, Python | `$2a$10$...` |
| `argon2` | Modern apps, security-focused | `$argon2id$v=19$m=65536...` |
| `pbkdf2` | Python, Java | Requires iterations, key length |
| `sha256` | Legacy systems | Not recommended (weak) |
| `sha512` | Legacy systems | Not recommended (weak) |
| `md5` | Very old systems | Not recommended (very weak) |

### bcrypt Format

```json
{
  "custom_password_hash": {
    "algorithm": "bcrypt",
    "hash": "$2a$10$abcdefghijklmnopqrstuv"
  }
}
```

**The hash includes:**
- `$2a$` - bcrypt identifier
- `10` - cost factor
- Rest - salt + hash

---

### argon2 Format

```json
{
  "custom_password_hash": {
    "algorithm": "argon2",
    "hash": {
      "encoded": "$argon2id$v=19$m=65536,t=3,p=4$salt$hash"
    }
  }
}
```

---

### PBKDF2 Format

```json
{
  "custom_password_hash": {
    "algorithm": "pbkdf2",
    "hash": {
      "value": "base64-encoded-hash",
      "encoding": "base64",
      "key_length": 32,
      "iterations": 10000,
      "digest": "sha256"
    }
  }
}
```

---

### SHA-256/SHA-512 Format

```json
{
  "custom_password_hash": {
    "algorithm": "sha256",
    "hash": {
      "value": "hex-encoded-hash",
      "encoding": "hex"
    }
  }
}
```

**Note:** Add salt if your system used salted hashes:
```json
{
  "custom_password_hash": {
    "algorithm": "sha256",
    "hash": {
      "value": "hex-encoded-hash",
      "encoding": "hex"
    },
    "salt": {
      "value": "hex-encoded-salt",
      "encoding": "hex",
      "position": "prefix"
    }
  }
}
```

---

## Importing to Auth0

### Method 1: Auth0 Dashboard

**Steps:**
1. Go to Auth0 Dashboard
2. Navigate to **Authentication → Database → [Your Connection]**
3. Click **Users** tab
4. Click **Import Users** button
5. Upload your JSON file
6. Review and confirm

**Limitations:**
- File size: Max 500KB per upload
- Users per file: Recommended max 10,000

---

### Method 2: Auth0 CLI

**Prerequisites:**
```bash
# Install Auth0 CLI
brew install auth0/auth0-cli/auth0

# Login
auth0 login
```

**Import users:**
```bash
# Get connection ID
auth0 connections list

# Import users
auth0 api post "jobs/users-imports" \
  --data "connection_id=con_ABC123" \
  --data "users=@users.json"
```

**Check import status:**
```bash
auth0 api get "jobs/{job-id}"
```

---

### Method 3: Management API

**Using curl:**
```bash
curl -X POST "https://YOUR_DOMAIN.auth0.com/api/v2/jobs/users-imports" \
  -H "Authorization: Bearer YOUR_MGMT_API_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "users=@users.json" \
  -F "connection_id=con_ABC123" \
  -F "upsert=false" \
  -F "send_completion_email=true"
```

**Using Node.js:**
```javascript
const { ManagementClient } = require('auth0');
const fs = require('fs');

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET
});

async function importUsers() {
  const users = fs.readFileSync('users.json');

  const job = await management.importUsers({
    connection_id: 'con_ABC123',
    users: users,
    upsert: false,
    send_completion_email: true
  });

  console.log(`Import job created: ${job.id}`);
  return job;
}
```

---

## Import Options

### upsert

- `true`: Update existing users, create new ones
- `false` (default): Only create new users, skip existing

**When to use:**
- `upsert=true`: Re-running imports with updated data
- `upsert=false`: Initial migration, avoid accidental overwrites

---

### send_completion_email

- `true`: Email you when import completes
- `false`: No email notification

**Useful for:** Large imports that take time

---

### external_id

Add to track which users were imported:

```json
{
  "email": "user@example.com",
  "external_id": "firebase:user123"
}
```

---

## Monitoring Import Progress

### Check Job Status

```bash
# Via CLI
auth0 api get "jobs/{job-id}"

# Via Management API
curl "https://YOUR_DOMAIN.auth0.com/api/v2/jobs/{job-id}" \
  -H "Authorization: Bearer YOUR_MGMT_API_TOKEN"
```

**Response:**
```json
{
  "id": "job_abc123",
  "type": "users_import",
  "status": "processing",
  "created_at": "2025-01-20T10:00:00.000Z",
  "connection_id": "con_ABC123",
  "summary": {
    "total": 1000,
    "inserted": 950,
    "updated": 0,
    "failed": 50
  }
}
```

**Status values:**
- `pending`: Job queued
- `processing`: Import in progress
- `completed`: Import finished successfully
- `failed`: Import failed

---

### Download Error Report

If import has failures:

```bash
# Get errors file URL
auth0 api get "jobs/{job-id}/errors"

# Download errors
curl "https://YOUR_DOMAIN.auth0.com/api/v2/jobs/{job-id}/errors" \
  -H "Authorization: Bearer YOUR_MGMT_API_TOKEN" \
  -o import-errors.json
```

**Error format:**
```json
[
  {
    "user": {
      "email": "invalid@example"
    },
    "errors": [
      {
        "code": "INVALID_EMAIL",
        "message": "Email format is invalid"
      }
    ]
  }
]
```

---

## Common Import Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_EMAIL` | Email format invalid | Validate and fix email format |
| `DUPLICATE_USER` | User already exists | Use `upsert=true` or skip |
| `INVALID_PASSWORD_HASH` | Hash format incorrect | Check algorithm and format |
| `MISSING_REQUIRED_FIELD` | Required field missing | Add email and email_verified |
| `CONNECTION_NOT_FOUND` | Invalid connection ID | Verify connection ID |
| `FILE_TOO_LARGE` | File exceeds limit | Split into smaller files |
| `INVALID_JSON` | JSON syntax error | Validate JSON format |

---

## Best Practices

### Prepare Your Data

1. **Validate emails:** Remove invalid/duplicate emails
2. **Verify JSON:** Use JSON validator before upload
3. **Test with small batch:** Import 10-100 users first
4. **Backup original data:** Keep copy of export

### Split Large Imports

```bash
# Split into 5000-user chunks
split -l 5000 users.json users-chunk-

# Import each chunk
for file in users-chunk-*; do
  auth0 api post "jobs/users-imports" \
    --data "connection_id=con_ABC123" \
    --data "users=@$file"
done
```

### Add Migration Metadata

Track migration for each user:

```json
{
  "email": "user@example.com",
  "user_metadata": {
    "migrated": true,
    "migrated_at": "2025-01-20T10:00:00.000Z",
    "migrated_from": "firebase",
    "original_id": "firebase-user-123"
  }
}
```

---

## Post-Import Verification

### Check User Count

```bash
# Get total users in Auth0
auth0 users list --number 1

# Or via API
curl "https://YOUR_DOMAIN.auth0.com/api/v2/users?per_page=1" \
  -H "Authorization: Bearer YOUR_MGMT_API_TOKEN" \
  | jq '.total'
```

### Test Login

```bash
# Test user can login
auth0 test login --client-id YOUR_CLIENT_ID
```

### Verify Password Hashes Work

Pick random users and attempt login to verify password hashes imported correctly.

---

## References

- [Auth0 Bulk User Import](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports)
- [Password Hash Algorithms](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports#password-hashing-algorithms)
- [Management API - User Import Job](https://auth0.com/docs/api/management/v2/jobs/post-users-imports)
- [User Import Best Practices](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports#best-practices)
