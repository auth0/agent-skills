# Setup Guide — Auth0 Threat Simulator

## Preparing for End-to-End Threat Simulation

### What This Skill Tests

Unlike a standalone security scanner, this skill tests the **interaction surface** between your application code and Auth0:

```
┌─────────────────────┐         ┌──────────────────────┐
│   Application       │         │   Auth0 Tenant       │
│                     │         │                      │
│ • SDK configuration │◄───────►│ • App type           │
│ • Token storage     │         │ • Callback URLs      │
│ • Env vars/secrets  │         │ • Grant types        │
│ • Middleware/routes │         │ • Token settings     │
│ • Logout handling   │         │ • Attack protection  │
│ • Audience config   │         │ • Session lifetime   │
└─────────────────────┘         └──────────────────────┘
         │                               │
         └───────── Attack Surface ──────┘
```

A secure tenant with a misconfigured SDK is still vulnerable. A well-configured SDK with a permissive tenant is still vulnerable. Both sides must be validated together.

### Prerequisites Checklist

- [ ] Auth0 CLI installed and authenticated to the correct tenant
- [ ] Application codebase accessible (local checkout)
- [ ] SDK already integrated (this validates, it doesn't set up)
- [ ] Client ID known (from app's env vars or config)
- [ ] Authorization to test the tenant (your own tenant or written permission)

### Auth0 CLI Setup

```bash
# Install Auth0 CLI
brew install auth0/auth0-cli/auth0

# Authenticate
auth0 login

# Verify correct tenant
auth0 tenants list

# Test access
auth0 apps list --json | jq '.[0].name'
```

### Required CLI Permissions

The threat simulator needs read access to:

| Resource | Why |
|----------|-----|
| Applications | Check app type, callbacks, grant types, token settings |
| APIs | Check audience, token lifetimes, signing algorithms |
| Connections | Check password policies |
| Attack Protection | Check brute-force, breached passwords, IP throttling |
| Tenant Settings | Check session lifetimes |
| Actions/Rules | Check for security-relevant pipeline logic |

### Scoping by SDK Type

Different integrations have different attack surfaces. The simulator automatically adjusts based on the detected SDK:

| If you integrated... | Primary attack surface |
|---------------------|----------------------|
| Next.js (`nextjs-auth0`) | Server-side secret management, middleware config, callback alignment |
| React SPA (`@auth0/auth0-react`) | Client-side token storage, no secrets, PKCE, web origins |
| Android (`com.auth0.android:auth0`) | Custom scheme hijacking, credential storage, native callbacks |
| iOS (`Auth0.swift`) | URL scheme registration, biometric bypass, credential manager |
| Express (`express-openid-connect`) | Secret strength, session config, CSRF protection |
| React Native (`react-native-auth0`) | Deep link interception, secure storage, native callbacks |

### Environment Considerations

**Development tenant:**
- Localhost callbacks are expected — simulator won't flag these
- Relaxed session lifetimes are acceptable
- Focus is on SDK configuration correctness

**Staging/Production tenant:**
- Localhost callbacks are flagged as HIGH severity
- Attack protection must be enabled
- Full security baseline applies

> **Agent instruction:** Always ask or detect whether this is a development or production tenant. Adjust severity ratings accordingly. A missing attack protection setting on a dev tenant is WARN; on production it's HIGH.

### Running the Simulation

The simulation is non-destructive — it only reads configuration from both the app and tenant. It does NOT:
- Attempt actual logins or authentication
- Modify any settings
- Trigger rate limiting or account lockouts
- Send traffic to Auth0 endpoints (beyond CLI read calls)

The output is a report identifying what an attacker COULD exploit given the current configuration.
