# Auth0 Pricing

`https://auth0.com/pricing.md` holds the up-to-date prices — retrieve it before quoting any
figure. The feature→plan matrix below is local; read it from here.

Auth0 offers flexible authentication and authorization plans for both B2C (consumer-facing) and B2B (business-facing) applications. The Free plan is identical regardless of use case. Paid plans are priced by Monthly Active Users (MAUs) and differ between B2C and B2B.

---

## How to Use This Document

To quote pricing for a customer, follow these steps in order:

1. **Fetch `https://auth0.com/pricing.md` first.** Do this before quoting any figure. It carries
   the B2C and B2B base-price tables (monthly and yearly), every add-on table (Auth for AI
   Agents, M2M tokens, Enterprise SSO connections, Enterprise MFA), and the current MAU tiers.
   If it can't be fetched, give the plan name without a figure — never a price from memory.
2. **Determine use case:** B2C (consumer-facing) or B2B (business-facing).
3. **Identify their MAU tier:** Find the tier that meets or exceeds their expected monthly active users. If usage falls between tiers, use the next tier up.
4. **Select the plan:** Match required features against the Feature Comparison tables below to determine the minimum plan (Free, Essentials, Professional, or Enterprise).
5. **Look up the base price** in the fetched page, using the appropriate B2C or B2B table.
6. **Add any add-ons:** Check whether the customer needs AI Agents, additional M2M tokens, Enterprise SSO connections, or Enterprise MFA, and take each add-on price from the fetched page.
7. **Calculate total cost:** Total = Base Price + sum of all applicable add-on prices.
8. **"Contact us" or "Not available" components:** If any component reads "Contact us", direct the customer to Auth0 sales for a custom quote. If it reads "Not available", that plan or add-on does not exist at their MAU tier — do not recommend it and do not total it; move up a plan or send them to sales.

---

## Key Definitions

- **Monthly Active Users (MAUs):** Any non-internal (non-employee) user that authenticated during a given month for a given tenant.
- **Organizations:** Represent their business customers and partners in Auth0 and manage their membership.
- **Enterprise Connections:** Enterprise IdPs supporting protocols like AD, LDAP, or SAML to authenticate your users.

---

## Plans Overview

Auth0 has four tiers: **Free**, **Essentials**, **Professional**, and **Enterprise**. Free is
identical for B2C and B2B; the paid tiers are priced separately for each. Starting prices, the
MAU tier they apply at, and how Enterprise is sold are in the fetched pricing page — read
Enterprise off that page rather than assuming, and never quote or estimate an Enterprise price
yourself.

---

## Free Plan

**Free** (same for B2C and B2B)

No credit card needed to sign up.

- Up to 25,000 monthly active users
- 1 Custom Domain*
- Secure Agentic AI workflows
- Passwordless Authentication
- Unlimited Social Connections**
- 5 Organizations
- Brand Customization
- Basic Attack Protection
- Community Support
- 1 Enterprise Connection (NEW)
- Self-Service SSO (NEW)
- SCIM (NEW)

---

## B2C Pricing

### Plan Highlights

**Essentials**
- Everything in Free, plus:
- Higher Auth, API limits, and feature limits
- Pro Multi-Factor Authentication
- Role-based Access Control Per Organization
- 10 Organizations (How we model your customers)
- Stream Auth0 Audit Logs to Datadog, Splunk, AWS, Azure, etc.
- Separate Production & Development Environments
- Standard Support
- Add-ons: Enterprise MFA, Enterprise SSO Connections, M2M Tokens

**Professional**
- Everything in Essentials, plus:
- Enhanced Attack Protection
- Use your existing User Database for Logins
- Enterprise Multi-Factor Authentication
- Add-ons: M2M Tokens

**Enterprise — Contact us**
- Everything in Professional, plus:
- Custom User & SSO Tiers
- 99.99% SLA
- Enterprise Rate Limits
- Enterprise Administration & Support
- Add-ons: Advanced Security Features, Private Deployment

*Pricing is available only at the listed MAU tiers. If your usage falls between tiers, you are billed at the next tier up.*

### B2C Prices

Base prices (monthly and yearly) by MAU tier, and every B2C add-on — Auth0 for AI Agents
(adds 50% to base, rounded up to the dollar; unlimited Token Vault, all forms of CIBA) and
M2M tokens — are in the **B2C section of the fetched pricing page**. Read them there; which
plans each add-on is available on is in the B2C Feature Comparison below.

---

## B2B Pricing

### Plan Highlights

**Essentials**
- Everything in Free, plus:
- Unlimited** Organizations
- 3 SSO Enterprise Connections
- Role-based Access Control
- Higher Auth and API limits
- Pro Multi-Factor Authentication
- Stream Auth0 Audit Logs
- Dev & Prod tenant configuration
- Standard Support
- Add-ons: Enterprise MFA, Enterprise SSO Connections, M2M Tokens

**Professional**
- Everything in Essentials, plus:
- Enhanced Attack Protection
- Use your existing User Database for Logins
- Enterprise Multi-Factor Authentication
- Custom Token Exchange
- Security Center
- Additional Enterprise Connections
- Add-ons: Enterprise SSO Connections, M2M Tokens

**Enterprise — Contact us**
- Everything in Professional, plus:
- Custom User & SSO Tiers
- 99.99% SLA
- Enterprise Rate Limits
- Enterprise Administration & Support
- Add-ons: Advanced Security Features, Private Deployment

### B2B Prices

Base prices (monthly and yearly) by MAU tier, and every B2B add-on — Auth0 for AI Agents,
M2M tokens, additional Enterprise SSO connections, and Enterprise MFA — are in the **B2B
section of the fetched pricing page**. Read them there; which plans each add-on is available
on, and how many Enterprise Connections each plan includes, are in the B2B Feature Comparison
below.

---

## Feature Comparison

> ADD-ON = available as paid add-on
> * credit card verification required for custom domains
> ** subject to system limitations
> The Free column is identical for B2C and B2B.

### B2C Feature Comparison

#### Authentication

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| External Active Users | Up to 25,000 | Custom Tiers | Custom Tiers | Custom Tiers |
| Machine-to-Machine Authentication | 1,000 | 1,000 | 5,000 | 5,000 |
| M2M Add-on | No | No | Yes | Yes |
| Passwordless | Included | Included | Included | Included |
| Social Connections | Unlimited** | Unlimited** | Unlimited** | Unlimited** |
| Custom Social Connections | Included | Included | Included | Included |
| Passkeys | Included | Included | Included | Included |
| Auth0 Database Connection | Included | Included | Included | Included |
| Custom Database Connections | Not available | Not available | Included | Included |
| Cross APP SSO | Not available | Not available | Included | Included |
| Enterprise Connections | 1 | Not available | Not available | Custom Tiers |
| Inbound SCIM | Included | Included | Included | Included |
| Okta Connections | Unlimited** | Unlimited** | Unlimited** | Unlimited** |
| Express Configuration | Included | Included | Included | Included |
| Organizations | 5 | 10 | 10 | Custom Tiers |
| Self-Service SSO | Included | Not available | Not available | Select Enterprise Plans |
| M2M Access for Organizations | Not available | Not available | Not available | Select Enterprise Plans |
| Home Realm Discovery | Not available | Not available | Not available | Included |
| Long Lived Sessions | Not available | Not available | Not available | Included |

#### AI

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| CIBA | Not available | ADD-ON | ADD-ON | Included + ADD-ON |
| Token Vault | 2 | 3 + ADD-ON | 3 + ADD-ON | 4 + ADD-ON |

#### Branding

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Configurable Login Experience | Included | Included | Included | Included |
| Accessibility | Included | Included | Included | Included |
| Custom Domains* | 1 | Included | Included | Included |
| Email Workflow | Not available | Included | Included | Included |
| Customize Signup & Login | Not available | Included | Included | Included |

#### Extensibility

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Actions + Forms | 5 | 10 | 15 | 30 + ADD-ON |
| The Actions Library | Included | Included | Included | Included |
| Marketplace | Included | Included | Included | Included |
| Pro Forms | Not available | Not available | Included | Included |

#### Security & Compliance

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Brute Force Protection | Included | Included | Included | Included |
| Suspicious IP Throttling | Included | Included | Included | Included |
| Enhanced Password Protection | Not available | Not available | Included | Included |
| Basic Breached Password Detection | Not available | Not available | Included | Included |
| Credential Guard | Not available | Not available | Not available | ADD-ON |
| Bot Detection | Not available | Not available | Not available | ADD-ON |
| Tenant Access Control List (ACL) | Not available | Not available | Not available | 1 + ADD-ON |
| Integration with Okta Universal Logout | Included | Included | Included | Included |
| Pro MFA Factors | Not available | Included | Included | Included |
| Enterprise MFA Factors | Not available | Included | Included | Included |
| Adaptive MFA | Not available | Not available | Not available | ADD-ON |
| Security Center | Not available | Not available | Included | Included |
| Continuous Session Protection | Not available | Not available | Not available | Included |
| FAPI certified Security Profile | Not available | Not available | Not available | ADD-ON |
| Compliance Certifications | Included | Included | Included | Included |
| HIPAA/BAA | Not available | Not available | Not available | ADD-ON |
| Prioritized Security Log Streams | Not available | Not available | Not available | Included |
| Private Key JWT | Not available | Not available | Not available | Included |
| OIDC Back-Channel Logout | Not available | Not available | Not available | Included |

#### User Management

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| User Import | Included | Included | Included | Included |
| Custom Attributes | Included | Included | Included | Included |
| Role Management | Not available | Included | Included | Included |
| Account Linking | Not available | Included | Included | Included |

#### Platform

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Number of Tenants Included | 1 | 3 | 12 | Unlimited** |
| Number of Admin/Contributors | 3 | Unlimited** | Unlimited** | Unlimited** |
| Admin Access Controls | Admin | Admin and Viewer | Admin, Viewer and Editor | Admin, Viewer and Editor |
| Auth0 Dashboard SSO | Not available | Not available | Not available | Included |
| Log Retention | 1 Day | 5 Days | 10 Days | 30 Days |
| Log Streaming | Not available | 1 Log Stream | 2 Log Streams | 2 Log Streams |
| Private Deployment | Not available | Not available | Not available | ADD-ON |
| SLA | Not available | Not available | Not available | 99.99% |
| Community Support | Included | Included | Included | Included |
| Standard Support | Not available | Included | Included | Included |
| Premier Support | Not available | Not available | Not available | Premier Success Options |

---

### B2B Feature Comparison

#### Authentication

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| External Active Users | Up to 25,000 | Custom Tiers | Custom Tiers | Custom Tiers |
| Machine-to-Machine Authentication | 1,000 | 1,000 | 5,000 | 5,000 |
| M2M Add-on | No | No | Yes | Yes |
| Passwordless | Included | Included | Included | Included |
| Social Connections | Unlimited** | Unlimited** | Unlimited** | Unlimited** |
| Custom Social Connections | Included | Included | Included | Included |
| Passkeys | Included | Included | Included | Included |
| Auth0 Database Connection | Included | Included | Included | Included |
| Custom Database Connections | Not available | Not available | Included | Included |
| Cross APP SSO | Not available | Not available | Included | Included |
| Enterprise Connections | 1 | 3 + ADD-ON | 5 + ADD-ON | Custom Tiers |
| Inbound SCIM | Included | Included | Included | Included |
| Okta Connections | Unlimited** | Unlimited** | Unlimited** | Unlimited** |
| Express Configuration | Included | Included | Included | Included |
| Organizations | 5 | Unlimited** | Unlimited** | Custom Tiers |
| Self-Service SSO | Included | Included | Included | Select Enterprise Plans |
| M2M Access for Organizations | Not available | Not available | Included | Select Enterprise Plans |
| Home Realm Discovery | Not available | Included | Included | Included |
| Long Lived Sessions | Not available | Not available | Not available | Included |

#### AI

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| CIBA | Not available | ADD-ON | ADD-ON | Included + ADD-ON |
| Token Vault | 2 | 3 + ADD-ON | 3 + ADD-ON | 4 + ADD-ON |

#### Branding

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Configurable Login Experience | Included | Included | Included | Included |
| Accessibility | Included | Included | Included | Included |
| Custom Domains* | 1 | Included | Included | Included |
| Email Workflow | Not available | Included | Included | Included |
| Customize Signup & Login | Not available | Included | Included | Included |

#### Extensibility

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Actions + Forms | 5 | 10 | 15 | 30 + ADD-ON |
| The Actions Library | Included | Included | Included | Included |
| Marketplace | Included | Included | Included | Included |
| Pro Forms | Not available | Not available | Included | Included |

#### Security & Compliance

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Brute Force Protection | Included | Included | Included | Included |
| Suspicious IP Throttling | Included | Included | Included | Included |
| Enhanced Password Protection | Not available | Not available | Included | Included |
| Basic Breached Password Detection | Not available | Not available | Included | Included |
| Credential Guard | Not available | Not available | Not available | ADD-ON |
| Bot Detection | Not available | Not available | Not available | ADD-ON |
| Tenant Access Control List (ACL) | Not available | Not available | Not available | 1 + ADD-ON |
| Integration with Okta Universal Logout | Included | Included | Included | Included |
| Pro MFA Factors | Not available | Included | Included | Included |
| Enterprise MFA Factors | Not available | ADD-ON | Included | Included |
| Adaptive MFA | Not available | Not available | Not available | ADD-ON |
| Security Center | Not available | Not available | Not available | Included |
| Continuous Session Protection | Not available | Not available | Not available | Included |
| FAPI certified Security Profile | Not available | Not available | Not available | ADD-ON |
| Compliance Certifications | Included | Included | Included | Included |
| HIPAA/BAA | Not available | Not available | Not available | ADD-ON |
| Prioritized Security Log Streams | Not available | Not available | Not available | Included |
| Private Key JWT | Not available | Not available | Not available | Included |
| OIDC Back-Channel Logout | Not available | Not available | Not available | Included |

#### User Management

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| User Import | Included | Included | Included | Included |
| Custom Attributes | Included | Included | Included | Included |
| Role Management | Not available | Included | Included | Included |
| Account Linking | Not available | Included | Included | Included |

#### Platform

| Feature | Free | Essentials | Professional | Enterprise |
|---|---|---|---|---|
| Number of Tenants Included | 1 | 3 | 12 | Unlimited** |
| Number of Admin/Contributors | 3 | Unlimited** | Unlimited** | Unlimited** |
| Admin Access Controls | Admin | Admin and Viewer | Admin, Viewer and Editor | Admin, Viewer and Editor |
| Auth0 Dashboard SSO | Not available | Not available | Not available | Included |
| Log Retention | 1 Day | 5 Days | 10 Days | 30 Days |
| Log Streaming | Not available | 1 Log Stream | 2 Log Streams | 2 Log Streams |
| Private Deployment | Not available | Not available | Not available | ADD-ON |
| SLA | Not available | Not available | Not available | 99.99% |
| Community Support | Included | Included | Included | Included |
| Standard Support | Not available | Included | Included | Included |
| Premier Support | Not available | Not available | Not available | Premier Success Options |

---

## Notes

- Yearly billing = 11× the monthly price (equivalent to 1 month free)
- * Custom domains require credit card verification
- ** Subject to system limitations
- Enterprise plan pricing is custom; contact Auth0 sales
- The Free plan is identical for B2C and B2B: up to 25,000 MAUs, no credit card required
