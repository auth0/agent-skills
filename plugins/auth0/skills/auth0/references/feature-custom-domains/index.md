# Auth0 Custom Domains — reference hub

Drive Auth0 custom-domain work end-to-end: Auth0 Management API, DNS provider, verification polling, and the configuration that stitches everything together. Detects the user's DNS provider (Cloudflare, Route 53, Azure DNS, or other) and automates record creation when the provider supports it.

<!-- Single-intent FEATURE group carved from the original feature-custom-domains.md.
     The guide leaf is the entry point for every custom-domain task: it holds the
     overview, interaction style, error-code triage (CHECK THIS FIRST), key
     concepts, prerequisites, common mistakes, the DNS Provider Playbook, and all
     five capability flows (Set up, Troubleshoot, Manage, Remove, Health check).
     The other leaves are on-demand lookups. Read the guide first (hop 1), then
     the leaf your task needs. -->

## Choose your task

You arrived here for the custom-domains intent. Start with the guide, which holds
the overview, error-code triage, capabilities, prerequisites, and the DNS provider
+ capability flows:

| Intent | Read |
|---|---|
| feature:custom-domains | `Read: references/feature-custom-domains/guide.md` |

**Then, as needed for your task:**
- API / endpoint / object-property lookup (Management API endpoints, CLI commands, PATCH/POST bodies, status lifecycle, error codes, scopes): `Read: references/feature-custom-domains/api-reference.md`
- Advanced topics (Multiple Custom Domains, default domain + `auth0-custom-domain` header, self-managed certs, token `iss` behavior, verification troubleshooting depth): `Read: references/feature-custom-domains/advanced.md`
- Management API cURL examples and CI/CD automation scripts: `Read: references/feature-custom-domains/examples.md`

Read only the leaf (or leaves) your task needs — not all of them.
