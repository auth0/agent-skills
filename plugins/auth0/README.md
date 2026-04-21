# auth0

Essential Auth0 skills for setting up authentication, migrating from other providers, and implementing Multi-Factor Authentication (MFA).

## Installation

**Via Claude Code:**

First, add the Auth0 marketplace if you haven't already:

```bash
/plugin marketplace add auth0/agent-skills
```

Then install the plugin:

```bash
/plugin install auth0@auth0-agent-skills
```

**Via Skills CLI:**

```bash
npx skills add auth0/agent-skills/plugins/auth0
```

## Skills

| Skill | Description | Documentation |
|-------|-------------|---------------|
| [auth0-quickstart](skills/auth0-quickstart) | Detects the project's framework and guides through a complete Auth0 integration from scratch. Handles tenant and application setup, environment variable configuration, and routes to the correct SDK skill. | [SKILL.md](skills/auth0-quickstart/SKILL.md) |
| [auth0-migration](skills/auth0-migration) | Guides migration of existing authentication to Auth0 from other providers (Firebase, Cognito, Supabase, Clerk, custom). Covers user import strategies, JWT validation updates, and gradual migration patterns. | [SKILL.md](skills/auth0-migration/SKILL.md) |
| [auth0-mfa](skills/auth0-mfa) | Implements Multi-Factor Authentication. Covers factor setup (TOTP, SMS, email, push, WebAuthn, voice), step-up authentication for sensitive operations, and adaptive MFA policies. | [SKILL.md](skills/auth0-mfa/SKILL.md) |
| [auth0-cli](skills/auth0-cli) | Reference for Auth0 CLI commands — manage applications, APIs, users, roles, organizations, actions, logs, custom domains, Universal Login, Terraform export, and raw Management API access from the terminal. | [SKILL.md](skills/auth0-cli/SKILL.md) |
