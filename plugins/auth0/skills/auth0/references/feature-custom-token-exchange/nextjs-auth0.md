# @auth0/nextjs-auth0 — Custom Token Exchange

**Minimum version:** 4.14.0 (`Auth0Client#customTokenExchange`; v4 Auth0Client API).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. This is a
**server-only** method: it runs in a Route Handler / Server Action, does **not** modify the session,
and does **not** cache the tokens. Options are **camelCase**. Imports are split — the option/response
**types** come from `@auth0/nextjs-auth0/types`; the **error class** from `@auth0/nextjs-auth0/server`.

## Exchange in a Route Handler

```ts
import { NextRequest, NextResponse } from 'next/server';
import type { CustomTokenExchangeOptions } from '@auth0/nextjs-auth0/types';
import { auth0 } from '@/lib/auth0'; // your Auth0Client from @auth0/nextjs-auth0/server

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CustomTokenExchangeOptions>;
  if (!body.subjectToken || !body.subjectTokenType) {
    return NextResponse.json({ code: 'invalid_request' }, { status: 400 });
  }

  const result = await auth0.customTokenExchange({
    subjectToken: body.subjectToken,
    subjectTokenType: body.subjectTokenType, // non-reserved URI, 8–100 chars
    audience: body.audience,
    scope: body.scope,
  });

  // Use result.accessToken in a server-side call here; do not return it to the browser.
  return NextResponse.json({ ok: true });
}
```

`CustomTokenExchangeOptions` (camelCase): `subjectToken`, `subjectTokenType` (required); `audience`,
`scope`, `organization`, `additionalParameters`.
`CustomTokenExchangeResponse`: `accessToken`, `tokenType`, `expiresIn`, `idToken?`, `refreshToken?`,
`scope?`, `act?`.

## Error handling

```ts
import { CustomTokenExchangeError } from '@auth0/nextjs-auth0/server';

try {
  const result = await auth0.customTokenExchange({ subjectToken, subjectTokenType });
} catch (err) {
  if (err instanceof CustomTokenExchangeError) {
    // err.code: MISSING_SUBJECT_TOKEN | INVALID_SUBJECT_TOKEN_TYPE | EXCHANGE_FAILED
  }
}
```

## Security

Keep the exchange on the server. **Do not** return the `subjectToken` or the issued tokens to the
browser — not as props from a Server Component to a Client Component, not in the JSON response to
the caller. The client secret and tokens stay server-side; read `AUTH0_*` from the environment,
never from source literals. Never hand-build the `/oauth/token` POST.

The method is server-only and does not mutate the session; do not expect `getSession()` to reflect
the exchanged tokens. These names, imports, and options are accurate for nextjs-auth0 4.14.0+; do
not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/nextjs-auth0/blob/1795509dd1bb0fca07fc6774dfeb8d4f1b3e098d/examples/with-cte/app/api/cte/route.ts
