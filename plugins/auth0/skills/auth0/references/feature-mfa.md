
# Auth0 MFA Guide

Add Multi-Factor Authentication to protect user accounts and require additional verification for sensitive operations.


## Overview

### What is MFA?

Multi-Factor Authentication (MFA) requires users to provide two or more verification factors to access their accounts. Auth0 supports multiple MFA factors and enables step-up authentication for sensitive operations.

### When to Use This Skill

- Adding MFA to protect user accounts
- Requiring additional verification for sensitive actions (payments, settings changes)
- Implementing adaptive/risk-based authentication
- Meeting compliance requirements (PCI-DSS, SOC2, HIPAA)

### MFA Factors Supported

| Factor | Type | Description |
|--------|------|-------------|
| TOTP | Something you have | Time-based one-time passwords (Google Authenticator, Authy) |
| SMS | Something you have | One-time codes via text message |
| Email | Something you have | One-time codes via email |
| Push | Something you have | Push notifications via Auth0 Guardian app |
| WebAuthn | Something you have/are | Security keys, biometrics, passkeys |
| Voice | Something you have | One-time codes via phone call |
| Recovery Code | Backup | One-time use recovery codes |

### Key Concepts

| Concept | Description |
|---------|-------------|
| `acr_values` | Request MFA during authentication |
| `amr` claim | Authentication Methods Reference - indicates how user authenticated |
| Step-up auth | Require MFA for specific actions after initial login |
| Adaptive MFA | Conditionally require MFA based on risk signals |


## Step 1: Enable MFA in Tenant

### Via Auth0 Dashboard

1. Go to **Security → Multi-factor Auth**
2. Enable desired factors (TOTP, SMS, etc.)
3. Configure **Policies**:
   - **Always** - Require MFA for all logins
   - **Adaptive** - Risk-based MFA
   - **Never** - Disable MFA (use step-up instead)

### Via Auth0 CLI

```bash
# View current MFA configuration
auth0 api get "guardian/factors"

# Enable TOTP (One-time Password)
auth0 api put "guardian/factors/otp" --data '{"enabled": true}'

# Enable SMS
auth0 api put "guardian/factors/sms" --data '{"enabled": true}'

# Enable Push notifications
auth0 api put "guardian/factors/push-notification" --data '{"enabled": true}'

# Enable WebAuthn (Roaming - Security Keys)
auth0 api put "guardian/factors/webauthn-roaming" --data '{"enabled": true}'

# Enable WebAuthn (Platform - Biometrics)
auth0 api put "guardian/factors/webauthn-platform" --data '{"enabled": true}'

# Enable Email
auth0 api put "guardian/factors/email" --data '{"enabled": true}'
```

### Configure MFA Policy

```bash
# Set MFA policy: "all-applications" or "confidence-score"
auth0 api patch "guardian/policies" --data '["all-applications"]'
```

### Same configuration in Terraform

The CLI commands above are one way to enable factors and set the policy. If the
project is infrastructure-as-code, the loaded tooling reference gives the
equivalent:
- CLI: `auth0 api put guardian/factors/...` + `auth0 api patch guardian/policies`
- Terraform: `auth0_guardian` resource (`policy` + per-factor blocks)
- MCP: not available — the Auth0 MCP server exposes no Guardian/MFA tool; use the CLI or Terraform.


## Step 2: Implement Step-Up Authentication

Step-up auth requires MFA for sensitive operations without requiring it for every login.

### The `acr_values` Parameter

Request MFA by including `acr_values` in your authorization request:

```
acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor
```

### Implementation Pattern

The general pattern for all frameworks:

1. Check if user has already completed MFA (inspect `amr` claim)
2. If not, request MFA via `acr_values` parameter
3. Proceed with sensitive action once MFA is verified

**For complete framework-specific examples, see the sections below:**
- React (basic and custom hook)
- Next.js (App Router)
- Vue.js
- Angular


## Additional Resources

This skill is split into multiple files for better organization:

### Step-Up Examples
Complete code examples for all frameworks:
- React (basic and custom hook patterns)
- Next.js (App Router with API routes)
- Vue.js (composition API)
- Angular (services and components)

### Backend Validation
Learn how to validate MFA status on your backend:
- Node.js / Express JWT validation
- Python / Flask validation
- Middleware examples

### Advanced Topics
Advanced MFA implementation patterns:
- Adaptive MFA with Auth0 Actions
- Conditional MFA based on risk signals
- MFA Enrollment API

### Reference Guide
Common patterns and troubleshooting:
- Remember MFA for 30 days
- MFA for high-value transactions
- MFA status display
- Error handling
- AMR claim values
- Testing strategies
- Security considerations


## Related Capabilities

- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Passkeys / WebAuthn — ask for MFA (feature:mfa)
- Auth0 Actions — custom login-flow logic for adaptive/conditional authentication


## References

- [Auth0 MFA Documentation](https://auth0.com/docs/secure/multi-factor-authentication)
- [Step-Up Authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication)
- [MFA API](https://auth0.com/docs/secure/multi-factor-authentication/manage-mfa-auth0-apis)
- [acr_values Parameter](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/add-login-auth-code-flow#request-parameters)

---

## Common Patterns

### Pattern 1: Remember MFA for 30 Days

```typescript
// React: Check MFA age before requiring
const requireMFAIfStale = async (maxAgeSeconds = 30 * 24 * 60 * 60) => {
  const claims = await getIdTokenClaims();
  const authTime = claims?.auth_time;

  if (!authTime) return requireMFA();

  const authAge = Math.floor(Date.now() / 1000) - authTime;

  if (authAge > maxAgeSeconds) {
    return requireMFA({ maxAge: 0 });
  }

  return hasMFA();
};
```

### Pattern 2: MFA Challenge for High-Value Transactions

```typescript
// Frontend
const transferFunds = async (amount: number) => {
  // Require MFA for transfers over $1000
  if (amount > 1000) {
    const verified = await requireMFA();
    if (!verified) return;
  }

  await api.post('/transfer', { amount });
};

// Backend middleware
const requireMFAForHighValue = (threshold: number) => {
  return (req, res, next) => {
    const amount = req.body?.amount || 0;

    if (amount > threshold) {
      const amr = req.auth?.amr || [];
      if (!amr.includes('mfa')) {
        return res.status(403).json({
          error: 'MFA required for high-value transactions',
          code: 'mfa_required',
        });
      }
    }

    next();
  };
};

app.post('/transfer', validateJwt, requireMFAForHighValue(1000), handleTransfer);
```

### Pattern 3: MFA Status Display

```typescript
// React component showing MFA status
function MFAStatus() {
  const { getIdTokenClaims } = useAuth0();
  const [mfaStatus, setMfaStatus] = useState<string[]>([]);

  useEffect(() => {
    getIdTokenClaims().then(claims => {
      setMfaStatus(claims?.amr || []);
    });
  }, []);

  const getMFALabel = (method: string) => {
    const labels: Record<string, string> = {
      'mfa': 'Multi-Factor Auth',
      'otp': 'Authenticator App',
      'sms': 'SMS Code',
      'email': 'Email Code',
      'pwd': 'Password',
      'hwk': 'Security Key',
    };
    return labels[method] || method;
  };

  return (
    <div>
      <h3>Authentication Methods Used:</h3>
      <ul>
        {mfaStatus.map(method => (
          <li key={method}>{getMFALabel(method)}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `mfa_required` | User hasn't completed MFA | Redirect with `acr_values` parameter |
| `mfa_registration_required` | User has no MFA enrolled | Direct to enrollment or enable self-enrollment |
| `mfa_invalid_code` | Wrong OTP code entered | Prompt user to retry |
| `too_many_attempts` | Too many failed MFA attempts | Wait or contact support |
| `unsupported_challenge_type` | MFA factor not enabled | Enable the factor in dashboard |

---

## AMR Claim Values

The `amr` (Authentication Methods Reference) claim indicates how the user authenticated:

| Value | Meaning |
|-------|---------|
| `pwd` | Password authentication |
| `mfa` | Multi-factor authentication completed |
| `otp` | One-time password (TOTP) |
| `sms` | SMS verification |
| `email` | Email verification |
| `hwk` | Hardware key (WebAuthn) |
| `swk` | Software key |
| `pop` | Proof of possession |
| `fed` | Federated authentication (social/enterprise) |

---

## Testing

### Verify MFA is Working

1. **Enable MFA** in Auth0 Dashboard
2. **Login** and complete MFA enrollment
3. **Check ID token** for `amr` claim containing `mfa`
4. **Test step-up** by calling endpoint requiring MFA
5. **Verify backend** rejects requests without MFA

### Test Commands

```bash
# Check if MFA is enabled
auth0 api get "guardian/factors"

# List user's enrollments
auth0 api get "users/USER_ID/authenticators"

# Check MFA policy
auth0 api get "guardian/policies"
```

---

## Security Considerations

- **Always validate MFA on the backend** - Never trust frontend-only checks
- **Use `max_age=0`** for sensitive operations to force fresh authentication
- **Prefer TOTP/WebAuthn** over SMS (SIM swapping risk)
- **Enable recovery codes** so users don't get locked out
- **Log MFA events** for security auditing
- **Consider adaptive MFA** to balance security and UX

---

## Related Capabilities

- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Passkeys / WebAuthn — ask for MFA (feature:mfa)
- Auth0 Actions — custom login-flow logic for adaptive/conditional authentication

---

## References

- [Auth0 MFA Documentation](https://auth0.com/docs/secure/multi-factor-authentication)
- [Step-Up Authentication](https://auth0.com/docs/secure/multi-factor-authentication/step-up-authentication)
- [MFA API](https://auth0.com/docs/secure/multi-factor-authentication/manage-mfa-auth0-apis)
- [acr_values Parameter](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow/add-login-auth-code-flow#request-parameters)

---

## Step 3: Validate MFA on Backend

Always validate MFA status on the backend for sensitive operations.

### Node.js / Express

```typescript
import { expressjwt, GetVerificationKey } from 'express-jwt';
import { expressJwtSecret } from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

// Extend Request type
interface AuthRequest extends Request {
  auth?: {
    sub: string;
    amr?: string[];
    acr?: string;
    [key: string]: any;
  };
}

// JWT validation middleware
const validateJwt = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

// MFA requirement middleware
const requireMFA = (req: AuthRequest, res: Response, next: NextFunction) => {
  const amr = req.auth?.amr || [];

  if (!amr.includes('mfa')) {
    return res.status(403).json({
      error: 'MFA required',
      code: 'mfa_required',
      message: 'This action requires multi-factor authentication',
    });
  }

  next();
};

// Usage
app.post('/api/transfer', validateJwt, requireMFA, (req, res) => {
  // User has completed MFA
  res.json({ success: true });
});

// Optional: Check specific MFA methods
const requireTOTP = (req: AuthRequest, res: Response, next: NextFunction) => {
  const amr = req.auth?.amr || [];

  // Check for OTP-based MFA (TOTP)
  if (!amr.includes('otp') && !amr.includes('mfa')) {
    return res.status(403).json({
      error: 'TOTP required',
      code: 'totp_required',
    });
  }

  next();
};
```

### Python (Flask)

```python
from functools import wraps
from flask import request, jsonify, g
import jwt
from jwt import PyJWKClient

AUTH0_DOMAIN = os.environ.get('AUTH0_DOMAIN')
AUTH0_AUDIENCE = os.environ.get('AUTH0_AUDIENCE')

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401

        token = auth_header.split(' ')[1]

        try:
            jwks_url = f'https://{AUTH0_DOMAIN}/.well-known/jwks.json'
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=AUTH0_AUDIENCE,
                issuer=f'https://{AUTH0_DOMAIN}/'
            )
            g.user = payload
        except jwt.exceptions.PyJWTError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401

        return f(*args, **kwargs)
    return decorated

def require_mfa(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        amr = g.user.get('amr', [])

        if 'mfa' not in amr:
            return jsonify({
                'error': 'MFA required',
                'code': 'mfa_required',
                'message': 'This action requires multi-factor authentication'
            }), 403

        return f(*args, **kwargs)
    return decorated

# Usage
@app.route('/api/transfer', methods=['POST'])
@require_auth
@require_mfa
def transfer():
    # User has completed MFA
    return jsonify({'success': True})
```

---

---

## Step 4: Adaptive MFA with Actions

Use Auth0 Actions to require MFA based on conditions.

### Create Action: Conditional MFA

```javascript
// Action: Require MFA for Sensitive Operations
// Trigger: Login / Post Login

exports.onExecutePostLogin = async (event, api) => {
  // Always require MFA for admins
  const roles = event.authorization?.roles || [];
  if (roles.includes('admin')) {
    if (event.authentication?.methods?.find(m => m.name === 'mfa')) {
      return; // MFA already completed
    }
    api.multifactor.enable('any', { allowRememberBrowser: false });
    return;
  }

  // Require MFA for new devices
  const isNewDevice = !event.authentication?.methods?.find(
    m => m.name === 'pwd' && m.timestamp
  );

  if (isNewDevice) {
    api.multifactor.enable('any', { allowRememberBrowser: true });
    return;
  }

  // Require MFA for suspicious locations
  const riskAssessment = event.request?.geoip;
  const userCountry = event.user?.user_metadata?.country;

  if (riskAssessment?.countryCode !== userCountry) {
    api.multifactor.enable('any', { allowRememberBrowser: false });
    return;
  }
};
```

### Create Action: MFA Based on Requested Scopes

```javascript
// Action: MFA for Sensitive Scopes
// Trigger: Login / Post Login

exports.onExecutePostLogin = async (event, api) => {
  const requestedScopes = event.request?.query?.scope?.split(' ') || [];
  const sensitiveScopes = ['transfer:funds', 'admin:write', 'delete:users'];

  const requiresMFA = requestedScopes.some(scope =>
    sensitiveScopes.includes(scope)
  );

  if (requiresMFA) {
    const hasMFA = event.authentication?.methods?.find(m => m.name === 'mfa');
    if (!hasMFA) {
      api.multifactor.enable('any');
    }
  }
};
```

### Deploy Action via CLI

```bash
# Create the action
auth0 actions create \
  --name "Conditional MFA" \
  --trigger post-login \
  --code "$(cat conditional-mfa.js)"

# Deploy the action
auth0 actions deploy ACTION_ID

# Attach to login flow
auth0 api patch "actions/triggers/post-login/bindings" --data '{
  "bindings": [{"ref": {"type": "action_id", "value": "ACTION_ID"}}]
}'
```

---

## Step 5: MFA Enrollment API

For custom enrollment experiences, use the MFA API.

### List User's MFA Enrollments

```bash
# Get user's enrolled authenticators
curl -X GET "https://YOUR_DOMAIN/api/v2/users/USER_ID/authenticators" \
  -H "Authorization: Bearer MGMT_TOKEN"
```

### Delete an Enrollment

```bash
# Remove an authenticator
curl -X DELETE "https://YOUR_DOMAIN/api/v2/users/USER_ID/authenticators/AUTHENTICATOR_ID" \
  -H "Authorization: Bearer MGMT_TOKEN"
```

### Trigger Enrollment Email

```bash
# Send enrollment email to user
curl -X POST "https://YOUR_DOMAIN/api/v2/guardian/enrollments/ticket" \
  -H "Authorization: Bearer MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID",
    "send_mail": true
  }'
```

---

---

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

## Next.js (App Router)

### API Route

```typescript
// app/api/sensitive/route.ts
// v4 removed withApiAuthRequired — guard the route by reading the session directly.
import { auth0 } from '@/lib/auth0';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if MFA was completed
  const amr = session.user?.amr || [];

  if (!amr.includes('mfa')) {
    return NextResponse.json(
      { error: 'MFA required', code: 'mfa_required' },
      { status: 403 }
    );
  }

  // Proceed with sensitive operation
  return NextResponse.json({ success: true });
}
```

### Client Component

```typescript
// app/transfer/page.tsx
'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';

export default function TransferPage() {
  const { user } = useUser();
  const router = useRouter();

  const handleTransfer = async () => {
    const response = await fetch('/api/sensitive', { method: 'POST' });

    if (response.status === 403) {
      const { code } = await response.json();
      if (code === 'mfa_required') {
        // Redirect to login with MFA required (v4 mounts auth routes at /auth/*, not /api/auth/*)
        router.push('/auth/login?acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor');
        return;
      }
    }

    // Success
  };

  return <button onClick={handleTransfer}>Transfer Funds</button>;
}
```

---

## Vue.js

`idTokenClaims` is a reactive ref from `useAuth0()` — read it as `idTokenClaims.value?.amr`, not via `getIdTokenClaims()`.

```typescript
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { ref } from 'vue';

const { getAccessTokenSilently, idTokenClaims, loginWithRedirect } = useAuth0();
const isVerifying = ref(false);

const hasMFA = (): boolean => {
  const amr = idTokenClaims.value?.amr || [];
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
