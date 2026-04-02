---
name: auth0-cli
description: >
  Manage Auth0 tenants, applications, APIs, users, actions, organizations, roles,
  rules, logs, domains, email, protection settings, and universal login from the
  command line. Use when the user wants to create, list, show, update, or delete
  Auth0 resources, test login flows, tail tenant logs, generate Terraform configs,
  make raw Management API calls, or manage attack protection settings.
  Wraps the auth0 CLI.
compatibility: Requires auth0 CLI installed (macOS/Linux: brew tap auth0/auth0-cli && brew install auth0, Windows: scoop bucket add auth0 https://github.com/auth0/scoop-auth0-cli.git && scoop install auth0)
license: MIT
allowed-tools: Bash(auth0 *)
metadata:
  author: auth0
  version: '0.1'
  openclaw:
    emoji: "\U0001F512"
    requires:
      bins:
        - auth0
    os:
      - darwin
      - linux
      - win32
    install:
      - id: brew
        kind: brew
        tap: 'auth0/auth0-cli'
        package: 'auth0'
        bins: [auth0]
        label: 'Install auth0 (Homebrew)'
      - id: scoop
        kind: scoop
        bucket: 'https://github.com/auth0/scoop-auth0-cli.git'
        bucket_name: 'auth0'
        package: 'auth0'
        bins: [auth0]
        label: 'Install auth0 (Scoop)'
---

# Auth0 CLI

Use the `auth0` command-line tool to build, manage, and test your Auth0
integrations from the command line.

## Current status

- Auth status: !`auth0 tenants list --json 2>/dev/null || echo '{"error":"auth0 CLI not configured or not logged in"}'`

## First-time setup

If `auth0 tenants list --json` returns an error, guide the user through setup:

1. **Log in to Auth0** (requires human interaction — opens browser):

   ```bash
   auth0 login
   ```

   There are two authentication methods:
   - **As a user** (recommended for interactive use) — uses device authorization flow
   - **As a machine** (for CI/non-interactive) — uses client credentials flow:
     ```bash
     auth0 login --domain <domain> --client-id <client-id> --client-secret <client-secret>
     ```

   All login steps require human interaction. Do not attempt to run them autonomously.

## When to use this skill

- The user wants to create, list, show, update, or delete Auth0 applications
- The user wants to manage APIs (resource servers) and their scopes
- The user wants to manage users (create, search, update, delete, assign roles, unblock)
- The user wants to create, deploy, or manage Auth0 Actions
- The user wants to manage organizations, their members, roles, and invitations
- The user wants to manage roles and their permissions
- The user wants to manage rules (legacy)
- The user wants to view or tail tenant logs
- The user wants to configure log streaming (Datadog, Splunk, EventBridge, etc.)
- The user wants to manage custom domains
- The user wants to configure email providers or templates
- The user wants to manage attack protection settings (bot detection, brute force, suspicious IP)
- The user wants to test login flows or get tokens
- The user wants to generate Terraform configuration for an Auth0 tenant
- The user wants to make raw authenticated requests to the Auth0 Management API
- The user wants to manage the Universal Login experience
- The user wants to manage event streams
- The user wants to manage tenant settings or network ACL
- The user wants to manage phone providers
- The user wants to manage token exchange profiles

## Key patterns

### Always use --json mode

All commands should use `--json` for structured output:

```bash
auth0 <resource> <operation> --json
```

Some commands also support `--json-compact` for compact JSON output.

### Use --no-input for non-interactive operations

Always pass `--no-input` when running commands that might prompt for input, to prevent the agent from hanging:

```bash
auth0 <resource> <operation> --no-input --json
```

### Global flags

| Flag | Description |
| ---- | ----------- |
| `--debug` | Enable debug mode |
| `--no-color` | Disable colors |
| `--no-input` | Disable interactivity |
| `--tenant <string>` | Specific tenant to use |
| `--json` | Output in JSON format |
| `--json-compact` | Output in compact JSON format |

### Human-in-the-loop commands

The following commands require human interaction (browser-based OAuth). Do not run these autonomously — instruct the user to run them:

- `auth0 login` — authenticate to a tenant
- `auth0 logout` — log out of a tenant session

### Destructive operations

When deleting resources, always confirm with the user before running:

```bash
auth0 <resource> delete <id> --no-input --json
```

## Available commands

### Authentication & tenant management

- `auth0 login` — authenticate the CLI (human-in-the-loop)
- `auth0 logout` — log out of a tenant session
- `auth0 tenants list` — list configured tenants
- `auth0 tenants use <tenant>` — switch active tenant
- `auth0 tenant-settings show` — show tenant settings
- `auth0 tenant-settings update` — update tenant settings

### Applications

- `auth0 apps list` — list applications
- `auth0 apps create` — create a new application
- `auth0 apps show <id>` — show an application
- `auth0 apps update <id>` — update an application
- `auth0 apps delete <id>` — delete an application
- `auth0 apps open <id>` — open settings page in browser
- `auth0 apps use <id>` — set default application
- `auth0 apps session-transfer` — manage session transfer settings

### APIs (Resource Servers)

- `auth0 apis list` — list APIs
- `auth0 apis create` — create a new API
- `auth0 apis show <id>` — show an API
- `auth0 apis update <id>` — update an API
- `auth0 apis delete <id>` — delete an API
- `auth0 apis scopes list <id>` — list API scopes

### Users

- `auth0 users search` — search for users
- `auth0 users search-by-email` — search users by email
- `auth0 users create` — create a new user
- `auth0 users show <id>` — show a user
- `auth0 users update <id>` — update a user
- `auth0 users delete <id>` — delete a user
- `auth0 users roles` — manage user roles
- `auth0 users blocks` — manage brute-force protection blocks
- `auth0 users import` — import users from schema
- `auth0 users open <id>` — open user settings page

### Actions

- `auth0 actions list` — list actions
- `auth0 actions create` — create a new action
- `auth0 actions show <id>` — show an action
- `auth0 actions update <id>` — update an action
- `auth0 actions delete <id>` — delete an action
- `auth0 actions deploy <id>` — deploy an action
- `auth0 actions diff` — show diff between two action versions
- `auth0 actions open <id>` — open settings page

### Organizations

- `auth0 orgs list` — list organizations
- `auth0 orgs create` — create an organization
- `auth0 orgs show <id>` — show an organization
- `auth0 orgs update <id>` — update an organization
- `auth0 orgs delete <id>` — delete an organization
- `auth0 orgs members` — manage organization members
- `auth0 orgs roles` — manage organization roles
- `auth0 orgs invitations` — manage organization invitations

### Roles

- `auth0 roles list` — list roles
- `auth0 roles create` — create a role
- `auth0 roles show <id>` — show a role
- `auth0 roles update <id>` — update a role
- `auth0 roles delete <id>` — delete a role
- `auth0 roles permissions` — manage role permissions

### Logs

- `auth0 logs list` — show tenant logs
- `auth0 logs tail` — tail tenant logs in real-time
- `auth0 logs streams` — manage log streams (Datadog, EventBridge, EventGrid, HTTP, Splunk, Sumo)

### Protection

- `auth0 protection bot-detection` — manage bot detection settings
- `auth0 protection breached-password-detection` — manage breached password detection
- `auth0 protection brute-force-protection` — manage brute-force protection
- `auth0 protection suspicious-ip-throttling` — manage suspicious IP throttling

### Domains

- `auth0 domains list` — list custom domains
- `auth0 domains create` — create a custom domain
- `auth0 domains show <id>` — show a custom domain
- `auth0 domains update <id>` — update a custom domain
- `auth0 domains delete <id>` — delete a custom domain
- `auth0 domains verify <id>` — verify a custom domain

### Email

- `auth0 email provider` — manage email provider settings
- `auth0 email templates` — manage email templates

### Rules (Legacy)

- `auth0 rules list` — list rules
- `auth0 rules create` — create a rule
- `auth0 rules show <id>` — show a rule
- `auth0 rules update <id>` — update a rule
- `auth0 rules delete <id>` — delete a rule
- `auth0 rules enable <id>` — enable a rule
- `auth0 rules disable <id>` — disable a rule

### Universal Login

- `auth0 universal-login show` — show Universal Login settings
- `auth0 universal-login update` — update Universal Login settings
- `auth0 universal-login customize` — customize Universal Login
- `auth0 universal-login switch` — switch UL provider
- `auth0 universal-login templates` — manage UL templates
- `auth0 universal-login prompts` — manage UL prompts

### Testing

- `auth0 test login` — test the Universal Login flow
- `auth0 test token` — get a token for testing

### API (Raw requests)

- `auth0 api <method> <url>` — make authenticated Management API requests
- `auth0 api get <url>` — GET request
- `auth0 api post <url> --data <json>` — POST request
- `auth0 api patch <url> --data <json>` — PATCH request
- `auth0 api delete <url>` — DELETE request

### Terraform

- `auth0 terraform generate` — generate Terraform configuration for your tenant

### Event Streams

- `auth0 event-streams list` — list event streams
- `auth0 event-streams create` — create an event stream
- `auth0 event-streams show <id>` — show an event stream
- `auth0 event-streams update <id>` — update an event stream
- `auth0 event-streams delete <id>` — delete an event stream

### Other

- `auth0 quickstarts` — download quickstart samples
- `auth0 phone` — manage phone providers
- `auth0 network-acl` — manage network ACL settings
- `auth0 token-exchange` — manage token exchange profiles
- `auth0 completion` — setup shell autocompletion
- `auth0 acul` — Advanced Customization for Universal Login

See [references/commands.md](references/commands.md) for full command reference with flags and examples.
