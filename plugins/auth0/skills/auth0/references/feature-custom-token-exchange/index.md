# Auth0 Custom Token Exchange (CTE)

Use Custom Token Exchange (RFC 8693) when an application must exchange an
existing external token for Auth0 access, ID, and refresh tokens: for example,
a legacy-identity migration, an external identity-provider integration, or a
request for a different API audience. CTE is Early Access and is available on
B2B Professional and Enterprise plans.

## Start with the security boundary

CTE makes Auth0 issue tokens for the user represented by the supplied
`subject_token`. That makes validation of the external token the security
boundary:

- Verify its signature, issuer, audience, expiry, and any application-specific
  claims before mapping it to a user. Decoding a JWT is not validation.
- Reject an invalid token with `api.access.rejectInvalidSubjectToken()` in the
  CTE Action. This records the attempt for Suspicious IP Throttling.
- Set exactly one user in the Action with either
  `api.authentication.setUserById()` or
  `api.authentication.setUserByConnection()` only after validation succeeds.
- Treat the incoming token and the returned Auth0 tokens as credentials: do
  not log them, return them to an untrusted caller, or persist them in browser
  storage.

CTE requires a first-party, OIDC-conformant application. The target API must
allow skipping user consent because this is a non-interactive flow.

## Configure the tenant and application

### 1. Enable CTE on the application

Confirm that the application is first-party and OIDC-conformant, then enable
its `custom_authentication` profile type. Retrieve the active tenant and the
application ID before making the change.

```bash
auth0 api PATCH /api/v2/clients/<client-id> \
  --data '{
    "token_exchange": {
      "allow_any_profile_of_type": ["custom_authentication"]
    }
  }'
```

Enable the connection that the CTE Action will use for the application. A
custom database connection with import mode enabled supports
`setUserById()` but not `setUserByConnection()`.

### 2. Create and deploy a CTE Action

Create an Action with the **Custom Token Exchange** trigger. Its workflow is:

1. Read `event.transaction.subject_token`.
2. Verify the token against the external issuer's keys and required claims.
3. Apply authorization policy for this exchange.
4. Call `api.authentication.setUserById(auth0UserId)` for an existing Auth0
   user, or `api.authentication.setUserByConnection(...)` when the validated
   external identity should resolve or create a connection user.
5. On an invalid token, call
   `api.access.rejectInvalidSubjectToken("Invalid subject token")`; for an
   authorization failure after successful validation, call
   `api.access.deny(code, reason)`.
6. Deploy the Action and record its Action ID.

Do not use an Action that merely decodes an unverified JWT or trusts a user ID
provided by the client. That lets an attacker exchange a forged token for a
real user's Auth0 tokens.

### 3. Create a profile

A profile maps one `subject_token_type` to the deployed Action. The same string
must be sent by the application for `subjectTokenType`.

```bash
auth0 api POST /api/v2/token-exchange-profiles \
  --data '{
    "name": "legacy-migration",
    "subject_token_type": "urn:acme:legacy-token",
    "action_id": "<deployed-action-id>",
    "type": "custom_authentication"
  }'
```

Use a unique URI for `subject_token_type`. It must be 10–100 characters and
begin with `urn:`, `https://`, or `http://`. Do not use reserved Auth0, Okta,
or IETF namespaces (`urn:auth0:`, `urn:okta:`, `urn:ietf:`, or their Auth0 and
Okta HTTP(S) forms).

## Exchange a token in Next.js

`@auth0/nextjs-auth0` v4 provides `auth0.customTokenExchange()`. Invoke it in
a Route Handler, Server Action, or other server-only code. A route that accepts
a token from a browser must authenticate and authorize its caller before
exchanging it; do not make it a public token-conversion endpoint.

```ts
// app/api/exchange-token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json(
      { code: "unauthenticated", message: "Sign in before requesting an exchange." },
      { status: 401 }
    );
  }

  const body = await request.json() as {
    subjectToken?: string;
    subjectTokenType?: string;
  };
  if (!body.subjectToken || !body.subjectTokenType) {
    return NextResponse.json(
      { code: "invalid_request", message: "subjectToken and subjectTokenType are required." },
      { status: 400 }
    );
  }

  try {
    const result = await auth0.customTokenExchange({
      subjectToken: body.subjectToken,
      subjectTokenType: body.subjectTokenType,
      audience: "https://api.example.com",
      scope: "read:data"
    });

    return NextResponse.json({ accessToken: result.accessToken });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "exchange_failed";

    return NextResponse.json({ code, message: "Token exchange failed." }, { status: 400 });
  }
}
```

The SDK validates a missing subject token and malformed `subjectTokenType`
before it sends the request. It throws `CustomTokenExchangeError` with codes
including `missing_subject_token`, `invalid_subject_token_type`, and
`exchange_failed`. Keep error details server-side; return a stable,
non-sensitive error to the caller.

The exchange does not create an Auth0 browser session. Use the returned tokens
for the requested API; do not assume `auth0.getSession()` changes after the
exchange.

## Troubleshoot

| Symptom | Check | Resolution |
|---|---|---|
| `exchange_failed` | Profile lookup | Confirm the client enables `custom_authentication` and the code's `subjectTokenType` exactly equals the profile's `subject_token_type`. |
| `exchange_failed` after profile lookup | Action execution | Confirm the Action is deployed, validates the token, and calls exactly one user-setting method on successful validation. Inspect `fecte` tenant logs. |
| `invalid_subject_token_type` | Type URI | Use a 10–100 character URI and avoid reserved IETF, Auth0, and Okta namespaces. |
| `429 too_many_attempts` | Suspicious IP Throttling | Treat it as an attack-protection response; do not retry in a tight loop. Review the `pre-custom-token-exchange` throttle settings. |
| No usable token after a successful call | API request | Supply the target API identifier as `audience` and request only scopes that API grants. |
| No authenticated browser session | Expected CTE behavior | CTE returns tokens; perform a normal login flow when the application also needs a browser session. |

Successful CTE transactions generate `secte` tenant logs; failed transactions
generate `fecte` logs. Never include subject or Auth0 token values in log
queries, application logs, or support tickets.
