# Auth0 Pricing

Prices **and** the feature→plan matrix live on one page. Fetch it once at the
start and take every figure and plan mapping from that single response.

## Read the docs (required)

- `https://auth0.com/pricing.md` — B2C and B2B base-price tables (monthly and
  yearly), every add-on table (Auth for AI Agents, M2M tokens, Enterprise SSO
  connections, Enterprise MFA), MAU tiers, and the **Feature Comparison**
  section (B2C and B2B: Authentication, AI, Branding, Extensibility, Security &
  Compliance, User Management, Platform). That Feature Comparison is the
  source of truth for which plan unlocks a feature.

If the page can't be fetched: give plan names without figures, never a price
from memory, and label any feature→plan mapping `plan unverified (pricing page
unreachable)` instead of guessing.

## Quoting procedure

1. **Fetch `https://auth0.com/pricing.md`** before quoting any figure.
2. **Determine use case:** B2C (consumer-facing) or B2B (business-facing). The
   Free plan is identical for both: up to 25,000 MAUs, no credit card.
3. **Identify the MAU tier** that meets or exceeds expected monthly active
   users. Between tiers, use the next tier up.
4. **Select the minimum plan** (Free, Essentials, Professional, Enterprise) by
   matching required features against the page's Feature Comparison for that
   use case.
5. **Look up the base price** in the page's B2C or B2B table.
6. **Add add-ons** the customer needs, each price from the page.
7. **Total** = base price + sum of applicable add-ons. Yearly billing = 11× the
   monthly price.
8. **"Contact us"** → direct the customer to Auth0 sales for a custom quote.
   **"Not available"** → that plan/add-on doesn't exist at their tier: don't
   recommend or total it; move up a plan or send them to sales.

## Rules

- **Never quote or estimate an Enterprise price.** Enterprise is sold through
  Auth0 sales.
- Custom domains require credit-card verification even where the plan includes
  them.
- Use plan and feature names exactly as the page spells them.
