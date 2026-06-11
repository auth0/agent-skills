# MFA Step-Up (reactive)

`@auth0/nextjs-auth0` v4 implements MFA step-up **reactively**. There is no proactive
"request step-up" call and no server-side `amr`/`acr` claim inspection (that is the React SPA
pattern — do not use it here).

## Flow

1. A server route/action calls `auth0.getAccessToken({ audience, refresh: true })` for the
   protected audience.
2. An Auth0 post-login **Action** enforces MFA for that audience, so the token request returns
   `mfa_required`. The SDK throws `MfaRequiredError` (from `@auth0/nextjs-auth0/server`).
3. The server surfaces it to the client, e.g. `return NextResponse.json(error.toJSON(), { status: 403 })`.
4. The client calls `mfa.challengeWithPopup({ audience })` (from `@auth0/nextjs-auth0/client`)
   to complete MFA in a popup. The SDK caches the stepped-up token in the **server session**.
5. The client retries the server action; `getAccessToken` now succeeds server-side and the
   action proceeds. The access token never reaches the browser.

## Server route

```ts
import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { MfaRequiredError } from '@auth0/nextjs-auth0/server';

export async function POST() {
  try {
    const { token } = await auth0.getAccessToken({ audience: 'https://api.example.com', refresh: true });
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

## Client component

```tsx
'use client';
import { mfa } from '@auth0/nextjs-auth0/client';

export function TransferButton() {
  async function transfer() {
    let res = await fetch('/api/transfer', { method: 'POST' });
    if (res.status === 403 && (await res.clone().json()).error === 'mfa_required') {
      await mfa.challengeWithPopup({ audience: 'https://api.example.com' });
      res = await fetch('/api/transfer', { method: 'POST' });
    }
    return res.json();
  }
  return <button onClick={transfer}>Transfer funds</button>;
}
```

## Common mistake — do not hand-roll the popup

Do **not** open the popup yourself with `window.open('/auth/login?acr_values=…')` plus a
`postMessage` / `window.closed` listener. That is the proactive Universal-Login redirect
pattern in a popup window — it bypasses the SDK's session token caching and the postMessage
handshake that `mfa.challengeWithPopup()` manages for you, and it leaves you re-implementing
timeout, popup-blocked, and cancellation handling by hand.

`acr_values` should **not** appear in your application code at all — `mfa.challengeWithPopup()`
supplies the multi-factor policy by default. If you find yourself writing `acr_values` or
building a URL to `/auth/login`, you are on the wrong path: call `mfa.challengeWithPopup({ audience })`
instead and let the SDK do the rest.

## Tenant requirement

Enforce MFA on the protected audience via a post-login Action; otherwise `getAccessToken`
succeeds and step-up never triggers. Set the tenant MFA policy to Adaptive or Never. The default
`acr_values` (`http://schemas.openid.net/pape/policies/2007/06/multi-factor`) is supplied by
`challengeWithPopup()` — do not hardcode it.

See also the `auth0-mfa` skill for cross-framework MFA concepts.
