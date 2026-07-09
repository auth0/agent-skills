# Auth0 DPoP (Device-Bound Tokens)

Bind access tokens to the client's cryptographic key so stolen tokens cannot be replayed.

---

## Overview

### What is DPoP?

DPoP (Demonstrating Proof-of-Possession) is an OAuth 2.0 mechanism defined in
[RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) that cryptographically
binds access tokens to a client-held key pair. Each API request includes a
short-lived signed JWT (the DPoP proof) that proves the sender holds the private
key — a stolen token alone cannot be replayed by an attacker.

### When to Use DPoP

- Protecting high-value API calls against token theft and replay attacks
- Meeting security or compliance requirements that mandate sender-constrained tokens
- Any SPA or Vanilla JS app calling a protected Auth0 API with elevated security needs

### When NOT to Use DPoP

- **SSR / server-side environments** — DPoP relies on a private key held in the browser; it cannot be safely used server-side (Next.js, Nuxt, etc.)
- **APIs that don't support DPoP** — the resource server must be configured to accept DPoP token dialect; Bearer-only APIs will reject DPoP proofs
- **Flows requiring token sharing** — DPoP tokens are bound to a single key pair and cannot be forwarded to or reused by another client

### Requirements

- Auth0 tenant with DPoP-capable authorization server
- API resource server with DPoP token dialect enabled
- A browser SPA using one of: `@auth0/auth0-vue`, `@auth0/auth0-react`,
  `@auth0/auth0-angular`, or `@auth0/auth0-spa-js`
- HTTPS in production (required by Auth0 for DPoP)

### Key Concepts

| Concept | Description |
|---------|-------------|
| DPoP Proof | A short-lived signed JWT attached to each request proving key possession |
| DPoP Nonce | A server-issued value that must be included in the proof to prevent replay |
| `useDpop: true` | SDK option that enables automatic DPoP proof generation |
| `createFetcher()` | SDK helper that returns a `fetch`-compatible function handling proofs automatically |
| `UseDpopNonceError` | Error thrown when the server rotates its nonce mid-flight; retry with the new nonce |

---

## Step 1: Enable DPoP on Your API

### Via Auth0 Dashboard

1. Go to **Applications → APIs**
2. Select the API your SPA calls
3. Under the **Settings** tab, confirm the API identifier matches your `audience`
4. No additional toggle is needed in the dashboard — DPoP is enabled per-request
   by the client when the API resource server is configured to accept DPoP tokens

### Via Auth0 CLI

```bash
# Inspect current resource server settings
auth0 api get "resource-servers" | jq '.[] | select(.identifier == "https://your-api-identifier")'

# Enable DPoP token dialect on the API
auth0 api patch "resource-servers/{API_ID}" \
  --data '{"token_dialect": "access_token_authz"}'
```

> Replace `{API_ID}` with the ID returned from the GET call above.

### Same configuration in Terraform / MCP

Sender-constraining is set on the resource server (via a `proof_of_possession`
setting with `mechanism: "dpop"`) and, for a mandatory client, on the client.
There is no tenant-wide DPoP toggle. The loaded tooling reference has the exact
syntax:
- CLI: `auth0 api patch resource-servers/{API_ID}` with the `proof_of_possession` payload
- Terraform: `auth0_resource_server` `proof_of_possession` block + `auth0_client` `require_proof_of_possession`
- MCP: `auth0_update_resource_server` accepts `proof_of_possession`; the client-side toggle is **not** exposed by MCP — set it via CLI or Terraform.

---

## Step 2: Configure Your Application

### Common pattern across all frameworks

1. Add `useDpop: true` to your Auth0 client/provider configuration alongside your `audience`
2. Use `createFetcher()` instead of attaching tokens manually — the SDK handles
   proof generation, nonce management, and header injection for you
3. Handle `UseDpopNonceError` in cases where the server rotates its nonce

### Environment variables

Ensure your `.env` includes the API audience:

```bash
# Vite
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier
```

---

## Framework Examples

### Vue.js

Uses `@auth0/auth0-vue`.

#### 1. Enable DPoP in plugin config

```typescript
// src/main.ts
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: import.meta.env.VITE_AUTH0_AUDIENCE
    },
    useDpop: true
  })
);

app.mount('#app');
```

#### 2. Make DPoP-protected API calls

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0, UseDpopNonceError } from '@auth0/auth0-vue';

const { createFetcher } = useAuth0();
const data = ref(null);
const error = ref<string | null>(null);

// Create a DPoP-aware fetcher bound to your API base URL
const apiFetch = createFetcher({
  baseUrl: 'https://your-api.example.com'
});

const fetchData = async () => {
  error.value = null;
  try {
    const response = await apiFetch('/data');
    data.value = await response.json();
  } catch (err) {
    if (err instanceof UseDpopNonceError) {
      // Server rotated its nonce — retry once
      const response = await apiFetch('/data');
      data.value = await response.json();
    } else {
      error.value = (err as Error).message;
    }
  }
};
</script>

<template>
  <div>
    <button @click="fetchData">Fetch Data</button>
    <div v-if="error" class="error">{{ error }}</div>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

#### 3. POST / PUT / DELETE requests

```typescript
// Pass standard fetch options as the second argument
const response = await apiFetch('/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'example' })
});
```

#### 4. Multiple APIs with separate fetchers

```typescript
const { createFetcher } = useAuth0();

const ordersApi = createFetcher({ baseUrl: 'https://orders.example.com' });
const inventoryApi = createFetcher({ baseUrl: 'https://inventory.example.com' });
```

#### 5. Manual DPoP management (advanced)

```typescript
import { useAuth0 } from '@auth0/auth0-vue';

const { generateDpopProof, getDpopNonce, setDpopNonce } = useAuth0();

// Generate a proof manually (e.g. for a custom fetch wrapper)
const proof = await generateDpopProof({
  url: 'https://your-api.example.com/data',
  method: 'GET',
  nonce: getDpopNonce()
});

const response = await fetch('https://your-api.example.com/data', {
  headers: {
    Authorization: `DPoP ${accessToken}`,
    DPoP: proof
  }
});

// Store a server-issued nonce for subsequent requests
const newNonce = response.headers.get('DPoP-Nonce');
if (newNonce) setDpopNonce(newNonce);
```

---

### React

Uses `@auth0/auth0-react`.

#### 1. Enable DPoP in provider config

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE
      }}
      useDpop={true}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
```

#### 2. Make DPoP-protected API calls

```tsx
import { useAuth0, UseDpopNonceError } from '@auth0/auth0-react';
import { useState, useMemo } from 'react';

export function DataFetcher() {
  const { createFetcher } = useAuth0();
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  const apiFetch = useMemo(
    () => createFetcher({ baseUrl: 'https://your-api.example.com' }),
    [createFetcher]
  );

  const fetchData = async () => {
    setError(null);
    try {
      const response = await apiFetch('/data');
      setData(await response.json());
    } catch (err) {
      if (err instanceof UseDpopNonceError) {
        // Server rotated its nonce — retry once
        const response = await apiFetch('/data');
        setData(await response.json());
      } else {
        setError((err as Error).message);
      }
    }
  };

  return (
    <div>
      <button onClick={fetchData}>Fetch Data</button>
      {error && <div className="error">{error}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

#### 3. Memoize the fetcher to avoid re-creation

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';

export function useApiClient() {
  const { createFetcher } = useAuth0();

  return useMemo(
    () => createFetcher({ baseUrl: 'https://your-api.example.com' }),
    [createFetcher]
  );
}
```

#### 4. POST / PUT / DELETE requests

```typescript
const response = await apiFetch('/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'example' })
});
```

---

### Angular

Uses `@auth0/auth0-angular`.

#### 1. Enable DPoP in provider config

**Standalone components (Angular 14+):**

```typescript
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience
      },
      useDpop: true
    })
  ]
};
```

**NgModule-based apps:**

```typescript
// src/app/app.module.ts
import { AuthModule } from '@auth0/auth0-angular';

@NgModule({
  imports: [
    AuthModule.forRoot({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience
      },
      useDpop: true
    })
  ]
})
export class AppModule {}
```

#### 2. Make DPoP-protected API calls

```typescript
import { Component, inject, signal } from '@angular/core';
import { AuthService, UseDpopNonceError } from '@auth0/auth0-angular';

@Component({
  selector: 'app-data',
  template: `
    <button (click)="fetchData()">Fetch Data</button>
    <div *ngIf="error()">{{ error() }}</div>
    <pre *ngIf="data()">{{ data() | json }}</pre>
  `
})
export class DataComponent {
  private auth = inject(AuthService);
  data = signal<unknown>(null);
  error = signal<string | null>(null);

  // Created once — reused across all fetchData() calls so nonce state is preserved
  private apiFetch = this.auth.createFetcher({
    baseUrl: 'https://your-api.example.com'
  });

  async fetchData() {
    this.error.set(null);
    try {
      const response = await this.apiFetch('/data');
      this.data.set(await response.json());
    } catch (err) {
      if (err instanceof UseDpopNonceError) {
        // Server rotated its nonce — retry once
        const response = await this.apiFetch('/data');
        this.data.set(await response.json());
      } else {
        this.error.set((err as Error).message);
      }
    }
  }
}
```

#### 3. POST / PUT / DELETE requests

```typescript
// Uses the same class-field fetcher — pass standard fetch options as the second argument
const response = await this.apiFetch('/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'example' })
});
```

---

### auth0-spa-js (Vanilla JS)

Uses `@auth0/auth0-spa-js` directly — suitable for Vanilla JS, Svelte, SolidJS,
or any SPA not using a framework wrapper.

#### 1. Initialize client with DPoP enabled

```typescript
import { createAuth0Client, UseDpopNonceError } from '@auth0/auth0-spa-js';

const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE
  },
  useDpop: true
});

// Handle redirect callback after login
const query = new URLSearchParams(window.location.search);
if ((query.has('code') || query.has('error')) && query.has('state')) {
  await auth0.handleRedirectCallback();
  window.history.replaceState({}, document.title, window.location.pathname);
}
```

#### 2. Make DPoP-protected API calls

```typescript
// Create a DPoP-aware fetcher
const apiFetch = auth0.createFetcher({
  baseUrl: 'https://your-api.example.com'
});

async function fetchData() {
  try {
    const response = await apiFetch('/data');
    return await response.json();
  } catch (err) {
    if (err instanceof UseDpopNonceError) {
      // Server rotated its nonce — retry once
      const response = await apiFetch('/data');
      return await response.json();
    }
    throw err;
  }
}
```

#### 3. POST / PUT / DELETE requests

```typescript
const response = await apiFetch('/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'example' })
});
```

#### 4. Multiple APIs with separate fetchers

```typescript
const ordersApi = auth0.createFetcher({ baseUrl: 'https://orders.example.com' });
const inventoryApi = auth0.createFetcher({ baseUrl: 'https://inventory.example.com' });

const [orders, inventory] = await Promise.all([
  ordersApi('/list').then(r => r.json()),
  inventoryApi('/stock').then(r => r.json())
]);
```

---

## Error Handling

### `UseDpopNonceError`

Servers may rotate their DPoP nonce. When this happens the SDK throws
`UseDpopNonceError`. Retry the request once — the SDK will have updated the
stored nonce automatically:

```typescript
// Import from your framework SDK:
// @auth0/auth0-vue | @auth0/auth0-react | @auth0/auth0-angular | @auth0/auth0-spa-js
import { UseDpopNonceError } from '@auth0/auth0-vue';

try {
  const response = await apiFetch('/data');
  const data = await response.json();
} catch (err) {
  if (err instanceof UseDpopNonceError) {
    // Nonce was stale — retry once; SDK has already stored the new nonce
    const response = await apiFetch('/data');
    const data = await response.json();
  } else {
    throw err;
  }
}
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| API returns `401` with `error: use_dpop_nonce` | Server issued a new nonce | Catch `UseDpopNonceError` and retry |
| API returns `401` with `invalid_dpop_proof` | Clock skew or wrong `htm`/`htu` values | Ensure system clock is accurate; verify `baseUrl` matches API URL exactly |
| Token still issued as Bearer instead of DPoP | `useDpop: true` missing or `audience` not set | Confirm both options are present in client config |
| `createFetcher` is undefined | SDK version too old | Upgrade to `@auth0/auth0-spa-js` ≥ 2.1 (or framework SDK wrapping it) |
