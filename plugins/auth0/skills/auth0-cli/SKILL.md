---
name: auth0-cli
description: Use when managing Auth0 resources from the command line - covers installation, authentication, and managing tenants, applications, APIs, users, roles, organizations, actions, logs, domains, email, and more via the auth0 CLI tool. Use this skill whenever the user wants to create, list, update, or delete Auth0 resources, automate Auth0 operations, debug authentication issues with logs, generate Terraform configs, or script Auth0 workflows in CI/CD pipelines.
---

# Auth0 CLI

Manage your Auth0 tenant resources from the command line.

---

## Overview

The Auth0 CLI (`auth0`) lets you create and manage applications, APIs, users, roles, organizations, actions, and other Auth0 resources directly from your terminal. It supports both interactive use for local development and non-interactive mode for CI/CD automation.

---

## Prerequisites

### Installation

**macOS/Linux (Homebrew):**
```bash
brew install auth0/auth0-cli/auth0
```

**macOS/Linux (curl):**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
```

**Windows (Scoop):**
```bash
scoop install auth0
```

**Windows (Chocolatey):**
```bash
choco install auth0-cli
```

**Verify installation:**
```bash
auth0 --version
```

---

## Authentication

Two authentication methods are available. Choose based on your environment:

| Method | Best For | Command |
|--------|----------|---------|
| **Device Authorization** | Local development, interactive use | `auth0 login` |
| **Client Credentials** | CI/CD, servers, non-interactive | `auth0 login --client-id <id> --client-secret <secret> --domain <tenant>.auth0.com` |

Device authorization opens your browser to complete login. Client credentials use a Machine-to-Machine application's credentials and require no browser.

```bash
# Interactive login (opens browser)
auth0 login

# Verify you're authenticated
auth0 tenants list

# Switch tenant
auth0 tenants use <tenant-name>
```

---

## Complementary Skills

This skill handles Auth0 resource management via CLI (creating apps, configuring URLs, managing users, etc.). Use it alongside these skills for a complete workflow:

- **`auth0-quickstart`** - Detects your framework and guides initial setup. Uses CLI commands to create and configure the Auth0 app.
- **`auth0-react`**, **`auth0-nextjs`**, **`auth0-express`**, etc. - SDK code integration. Pair with CLI commands to create and configure the Auth0 app your code connects to.
- **`auth0-migration`** - Bulk user migration from other auth providers
- **`auth0-mfa`** - Multi-Factor Authentication implementation in your application code

---

## Core Command Categories

| Category | Commands | Use Case | Reference |
|----------|----------|----------|-----------|
| **Tenants** | `login`, `logout`, `tenants list/use` | Authentication, switching tenants | [commands.md#authentication--tenants](references/commands.md#authentication--tenants) |
| **Applications** | `apps create/list/show/update/delete` | App registration and configuration | [commands.md#applications](references/commands.md#applications) |
| **APIs** | `apis create/list/show/update/delete` | Resource server management | [commands.md#apis](references/commands.md#apis) |
| **Users** | `users create/search/show/update/delete/import` | User account management | [commands.md#users](references/commands.md#users) |
| **Roles** | `roles create/list/show/update, permissions` | RBAC setup | [commands.md#roles--permissions](references/commands.md#roles--permissions) |
| **Organizations** | `orgs create/list/show, members, invitations` | Multi-tenant B2B management | [commands.md#organizations](references/commands.md#organizations) |
| **Actions** | `actions create/deploy/list/show/diff` | Custom authentication flows | [commands.md#actions](references/commands.md#actions) |
| **Logs** | `logs list/tail`, `logs streams` | Monitoring, debugging, audit | [commands.md#logs--monitoring](references/commands.md#logs--monitoring) |
| **Universal Login** | `universal-login show/update, prompts, templates` | Branding customization | [commands.md#universal-login](references/commands.md#universal-login) |
| **Testing** | `test login/token` | Validate auth flows | [commands.md#testing--debugging](references/commands.md#testing--debugging) |

For the complete command reference with all flags and examples, see [commands.md](references/commands.md).

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using device flow in CI/CD | Use client credentials: `auth0 login --client-id <id> --client-secret <secret> --domain <domain>` |
| Confusing App ID vs Client ID | Use `auth0 apps list --json` to see both; `client_id` is what SDKs need |
| Forgetting callback URLs on app create | Always pass `--callbacks` with your app's redirect URI |
| Secrets visible in debug output | Avoid `--debug` in production scripts; use `--no-color` for clean log output |
| Command hangs waiting for input | Add `--no-input` for non-interactive/scripted usage |
| Wrong application type | SPAs need `--type spa`, server apps need `--type regular`, mobile needs `--type native` |
| Stale tenant context | Run `auth0 tenants list` and `auth0 tenants use <tenant>` to verify/switch |

---

## Security Considerations

- Use **device authorization** for local development, **client credentials** for CI/CD
- Store client credentials in environment variables or secret managers, never in code
- Use `--reveal-secrets` only when you need to retrieve credentials — output contains sensitive data
- Add `--no-input` to scripts to prevent interactive prompts from blocking pipelines
- Avoid `--debug` in production as it can expose tokens and secrets in logs
- When creating apps, set `--metadata "created_by=agent_skills"` for tracking

---

## Reference Documentation

### Complete Command Reference
All commands organized by category with flags and examples:
[commands.md](references/commands.md)

### Common Workflows
Step-by-step recipes for real-world scenarios:
[workflows.md](references/workflows.md)
- Set up a new application for development
- Debug authentication failures with log tailing
- Manage users in bulk (import, roles, blocks)
- Deploy Auth0 Actions to production
- Set up log streaming (Datadog, Splunk, etc.)
- CI/CD automation patterns

### Advanced Features
Deep-dive into complex features and troubleshooting:
[advanced.md](references/advanced.md)
- Terraform code generation
- Attack protection configuration
- Custom domains, email, and phone providers
- Event streams and token exchange
- Troubleshooting common errors

---

## References

- [Auth0 CLI Documentation](https://auth0.github.io/auth0-cli/)
- [Auth0 CLI GitHub](https://github.com/auth0/auth0-cli)
- [Auth0 Management API](https://auth0.com/docs/api/management/v2)
- [Auth0 Documentation](https://auth0.com/docs)
