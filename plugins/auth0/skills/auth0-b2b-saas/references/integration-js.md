# Integration & Enforcement

How to wire org-aware login into the app and — most importantly — enforce tenant isolation from
the token on the backend. Defer SDK install/config detail to the framework skill
(`auth0-nextjs`, `auth0-react`, `express-oauth2-jwt-bearer`); this file covers only the B2B
additions: passing `organization`/`invitation` on login, and `org_id`-scoped enforcement.

## The enforcement contract (read this first)

On every protected request the backend MUST:

1. **Validate** the access token (signature, `iss`, `aud`, `exp`) — standard JWT validation.
2. **Read `org_id`** from the validated token. This is the active tenant.
3. **Scope all data access** to that `org_id` (tenant filter on every query).
4. **Check authorization relative to `org_id`** — roles/permissions in the token were issued for
   the org the user logged into; treat them as valid only for that org.

Never read the tenant from the URL, a path segment, a body field, or a client header. Those are
attacker-controlled. The token's `org_id` is the only trustworthy tenant statement.

---

## Login: passing `organization` and `invitation`

### Next.js (`@auth0/nextjs-auth0` v4)

The login route forwards `organization` and `invitation` query params to `/authorize`:

```ts
// app/login/route.ts  (or middleware that builds the authorize URL)
import { auth0 } from "@/lib/auth0";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organization = url.searchParams.get("organization") ?? undefined;
  const invitation = url.searchParams.get("invitation") ?? undefined;
  return auth0.startInteractiveLogin({
    authorizationParameters: { organization, invitation },
  });
}
```

### React SPA (`@auth0/auth0-react`)

```tsx
const { loginWithRedirect } = useAuth0();

// org-aware login (e.g. org chosen from a subdomain or a picker)
loginWithRedirect({ authorizationParams: { organization: "org_abc123" } });

// invitation acceptance — read both params off the email link landing URL
const params = new URLSearchParams(window.location.search);
loginWithRedirect({
  authorizationParams: {
    organization: params.get("organization")!,
    invitation: params.get("invitation")!,
  },
});
```

### Express (`express-openid-connect`)

```js
app.get("/login", (req, res) =>
  res.oidc.login({
    authorizationParams: {
      organization: req.query.organization,
      invitation: req.query.invitation,
    },
  })
);
```

---

## Enforcement: `org_id`-scoped middleware

### Express API (`express-oauth2-jwt-bearer`)

```js
import { auth, claimCheck, requiredScopes } from "express-oauth2-jwt-bearer";
const NS = "https://acme.com";

// 1. Validate the JWT (signature, issuer, audience)
const checkJwt = auth({
  audience: "https://api.acme.com",
  issuerBaseURL: "https://acme.us.auth0.com/",
});

// 2. Require an org-bound token and pin the request to that org
const requireOrg = claimCheck((payload) => typeof payload.org_id === "string");

function tenantScope(req, _res, next) {
  req.orgId = req.auth.payload.org_id;          // the ONLY source of tenant identity
  req.roles = req.auth.payload[`${NS}/roles`] ?? [];
  next();
}

// 3. Scope every query to req.orgId; check permissions relative to the org
app.get("/api/members",
  checkJwt, requireOrg, tenantScope, requiredScopes("read:members"),
  async (req, res) => {
    const members = await db.members.findMany({ where: { orgId: req.orgId } }); // tenant filter
    res.json(members);
  }
);
```

### Next.js route handler

```ts
import { auth0 } from "@/lib/auth0";
const NS = "https://acme.com";

export async function GET() {
  const session = await auth0.getSession();
  const token = await auth0.getAccessToken();
  const claims = decodeJwt(token.token);        // any JWT decoder
  const orgId = claims.org_id as string | undefined;
  if (!orgId) return new Response("Org context required", { status: 403 });

  const roles = (claims[`${NS}/roles`] as string[]) ?? [];
  if (!roles.includes("org-admin")) return new Response("Forbidden", { status: 403 });

  const data = await db.billing.find({ orgId });  // scoped to token org_id
  return Response.json(data);
}
```

## Why `org_id`, not the user's membership list

A user can belong to many orgs. The Management API can list *all* their memberships, but that is
not the active tenant — the active tenant is whichever org they authenticated into, which Auth0
records as `org_id` in the issued token. Authorizing against the membership list instead of the
token's `org_id` re-introduces the cross-tenant access bug this whole setup exists to prevent.
