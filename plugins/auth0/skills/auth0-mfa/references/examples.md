# MFA Step-Up Authentication Examples

Framework-specific code examples for implementing step-up authentication.

---

## React

### Basic Example

```typescript
import { useAuth0 } from '@auth0/auth0-react';

function SensitiveAction() {
  const { getAccessTokenSilently, getIdTokenClaims } = useAuth0();

  const requireMFA = async () => {
    // Check if user already completed MFA
    const claims = await getIdTokenClaims();
    const amr = claims?.amr || [];

    if (!amr.includes('mfa')) {
      // Request MFA via step-up authentication
      await getAccessTokenSilently({
        authorizationParams: {
          acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
          max_age: 0, // Force re-authentication
        },
      });
    }

    // User has completed MFA, proceed with sensitive action
    return performSensitiveAction();
  };

  return (
    <button onClick={requireMFA}>
      Transfer Funds (Requires MFA)
    </button>
  );
}
```

### Custom Hook

```typescript
import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useState } from 'react';

interface StepUpOptions {
  maxAge?: number;
}

export function useStepUpAuth() {
  const { getAccessTokenSilently, getIdTokenClaims, loginWithRedirect } = useAuth0();
  const [isVerifying, setIsVerifying] = useState(false);

  const hasMFA = useCallback(async (): Promise<boolean> => {
    const claims = await getIdTokenClaims();
    const amr = claims?.amr || [];
    return amr.includes('mfa');
  }, [getIdTokenClaims]);

  const requireMFA = useCallback(async (options: StepUpOptions = {}) => {
    setIsVerifying(true);
    try {
      const mfaCompleted = await hasMFA();

      if (!mfaCompleted) {
        // Try silent step-up first
        try {
          await getAccessTokenSilently({
            authorizationParams: {
              acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
              max_age: options.maxAge ?? 0,
            },
            cacheMode: 'off',
          });
        } catch {
          // Silent failed, redirect to MFA
          await loginWithRedirect({
            authorizationParams: {
              acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
              max_age: options.maxAge ?? 0,
            },
          });
          return false;
        }
      }

      return true;
    } finally {
      setIsVerifying(false);
    }
  }, [getAccessTokenSilently, loginWithRedirect, hasMFA]);

  return { requireMFA, hasMFA, isVerifying };
}

// Usage
function TransferFunds() {
  const { requireMFA, isVerifying } = useStepUpAuth();

  const handleTransfer = async () => {
    const verified = await requireMFA();
    if (verified) {
      // Proceed with transfer
    }
  };

  return (
    <button onClick={handleTransfer} disabled={isVerifying}>
      {isVerifying ? 'Verifying...' : 'Transfer Funds'}
    </button>
  );
}
```

---

### Next.js (App Router) — reactive step-up

The `@auth0/nextjs-auth0` v4 SDK does MFA step-up **reactively**, not proactively. You do not
pass `acr_values` or inspect the `amr` claim. Instead, MFA is enforced by an Auth0 post-login
**Action** on the protected audience; when you request an access token for that audience the SDK
throws `MfaRequiredError`, which you resolve with a popup. The access token stays on the server.

**1. Server route — request the token, surface `MfaRequiredError`:**

```ts
// app/api/transfer/route.ts
import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { MfaRequiredError } from '@auth0/nextjs-auth0/server';

export async function POST() {
  try {
    const { token } = await auth0.getAccessToken({
      audience: 'https://api.example.com',
      refresh: true,
    });

    // Use the token server-side to authorize the transfer. It never leaves the server.
    await fetch('https://api.example.com/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MfaRequiredError) {
      return NextResponse.json(error.toJSON(), { status: 403 });
    }
    throw error;
  }
}
```

**2. Client component — resolve MFA with a popup, then retry:**

```tsx
'use client';

import { mfa } from '@auth0/nextjs-auth0/client';

export function TransferButton() {
  async function transfer() {
    let res = await fetch('/api/transfer', { method: 'POST' });

    if (res.status === 403 && (await res.clone().json()).error === 'mfa_required') {
      // Complete MFA in a popup (no full-page redirect). The stepped-up token is
      // cached in the server session by the SDK.
      await mfa.challengeWithPopup({ audience: 'https://api.example.com' });
      // Retry — the server now gets a token that satisfies MFA.
      res = await fetch('/api/transfer', { method: 'POST' });
    }

    return res.json();
  }

  return <button onClick={transfer}>Transfer funds</button>;
}
```

**3. Tenant: enforce MFA on the protected audience via a post-login Action** (otherwise
`getAccessToken` just succeeds and step-up never triggers). Set the tenant MFA policy to
Adaptive or Never, and challenge MFA in the Action only when the protected audience is requested.

> The default `acr_values` (`http://schemas.openid.net/pape/policies/2007/06/multi-factor`) is
> supplied by `challengeWithPopup()` — you do not hardcode it.

**Common mistake:** Do not hand-roll the popup with `window.open('/auth/login?acr_values=…')`
and a `postMessage` listener. That bypasses the SDK's token caching and re-implements what
`mfa.challengeWithPopup()` already handles. `acr_values` should not appear in your app code at
all — the SDK supplies the multi-factor policy by default.

---

## Vue.js

```typescript
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { ref } from 'vue';

const { getAccessTokenSilently, getIdTokenClaims, loginWithRedirect } = useAuth0();
const isVerifying = ref(false);

const hasMFA = async (): Promise<boolean> => {
  const claims = await getIdTokenClaims();
  const amr = claims?.amr || [];
  return amr.includes('mfa');
};

const requireMFA = async () => {
  isVerifying.value = true;
  try {
    if (!(await hasMFA())) {
      try {
        await getAccessTokenSilently({
          authorizationParams: {
            acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
            max_age: 0,
          },
        });
      } catch {
        await loginWithRedirect({
          authorizationParams: {
            acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
          },
        });
        return false;
      }
    }
    return true;
  } finally {
    isVerifying.value = false;
  }
};

const handleSensitiveAction = async () => {
  if (await requireMFA()) {
    // Proceed with sensitive action
    console.log('MFA verified, proceeding...');
  }
};
</script>

<template>
  <button @click="handleSensitiveAction" :disabled="isVerifying">
    {{ isVerifying ? 'Verifying...' : 'Transfer Funds' }}
  </button>
</template>
```

---

## Angular

```typescript
import { Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-sensitive-action',
  template: `
    <button (click)="handleSensitiveAction()" [disabled]="isVerifying">
      {{ isVerifying ? 'Verifying...' : 'Transfer Funds' }}
    </button>
  `
})
export class SensitiveActionComponent {
  private auth = inject(AuthService);
  isVerifying = false;

  private async hasMFA(): Promise<boolean> {
    const claims = await firstValueFrom(this.auth.idTokenClaims$);
    const amr = (claims as any)?.amr || [];
    return amr.includes('mfa');
  }

  async handleSensitiveAction() {
    this.isVerifying = true;
    try {
      if (!(await this.hasMFA())) {
        // Request MFA
        this.auth.loginWithRedirect({
          authorizationParams: {
            acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
            max_age: 0,
          },
        });
        return;
      }

      // MFA verified, proceed
      console.log('MFA verified, proceeding...');
    } finally {
      this.isVerifying = false;
    }
  }
}
```
