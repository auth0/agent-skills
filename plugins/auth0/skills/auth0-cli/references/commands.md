# Auth0 CLI — Command Reference

Full reference for the `auth0` CLI. For the latest docs, see: https://auth0.github.io/auth0-cli/

## Global Options

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--debug` | | Enable debug mode |
| `--no-color` | | Disable colors |
| `--no-input` | | Disable interactivity (required for non-interactive/agent use) |
| `--tenant <string>` | | Specific tenant to use |
| `--json` | | Output in JSON format (available on most commands) |
| `--json-compact` | | Output in compact JSON format |
| `--csv` | | Output in CSV format (available on list commands) |

---

## Authentication

### auth0 login

Authenticate the CLI. **Human-in-the-loop — requires browser interaction.**

```
auth0 login [flags]
```

| Flag | Description |
| ---- | ----------- |
| `--domain <string>` | Tenant domain (for client credentials auth) |
| `--client-id <string>` | Client ID (for client credentials auth) |
| `--client-secret <string>` | Client secret (for client credentials auth) |
| `--client-assertion-private-key <string>` | Private key file path or content (for Private key JWT auth) |
| `--client-assertion-signing-alg <string>` | Signing algorithm: RS256, RS384, PS256 |
| `--scopes <strings>` | Additional scopes for device code flow |

Examples:
```bash
auth0 login
auth0 login --domain <tenant-domain> --client-id <client-id> --client-secret <client-secret>
auth0 login --scopes "read:client_grants,create:client_grants"
```

### auth0 logout

Log out of a tenant session. **Human-in-the-loop.**

```
auth0 logout [flags]
```

---

## Tenants

### auth0 tenants list

```
auth0 tenants list --json
```

### auth0 tenants use

```
auth0 tenants use <tenant-name>
```

### auth0 tenants open

Open the tenant's management dashboard in a browser.

```
auth0 tenants open
```

---

## Tenant Settings

### auth0 tenant-settings show

```
auth0 tenant-settings show --json
```

### auth0 tenant-settings update set

```
auth0 tenant-settings update set <key> <value>
```

### auth0 tenant-settings update unset

```
auth0 tenant-settings update unset <key>
```

---

## Applications

### auth0 apps list

```
auth0 apps list [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--number <int>` | `-n` | Number of apps to retrieve (1-1000, default 100) |
| `--reveal-secrets` | `-r` | Show client_secret and signing_keys |
| `--json` | | JSON output |
| `--csv` | | CSV output |

### auth0 apps create

```
auth0 apps create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | Application name |
| `--type <string>` | `-t` | Type: native, spa, regular, m2m, resource_server |
| `--description <string>` | `-d` | Description (max 140 chars) |
| `--callbacks <strings>` | `-c` | Callback URLs (comma-separated) |
| `--logout-urls <strings>` | `-l` | Logout redirect URLs |
| `--origins <strings>` | `-o` | Allowed origins (CORS) |
| `--web-origins <strings>` | `-w` | Web origins for cross-origin auth |
| `--grants <strings>` | `-g` | Grant types |
| `--auth-method <string>` | `-a` | Token endpoint auth: None, Post, Basic |
| `--metadata <key=value>` | | App metadata (repeatable) |
| `--reveal-secrets` | `-r` | Show secrets in output |
| `--resource-server-identifier <string>` | | API identifier (only for resource_server type) |
| `--refresh-token <string>` | `-z` | Refresh token config (JSON) |
| `--json` | | JSON output |

Examples:
```bash
auth0 apps create --name myapp --type regular --no-input --json
auth0 apps create -n "My SPA" -t spa -c "https://localhost:3000/callback" --json
```

### auth0 apps show

```
auth0 apps show <app-id> [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--reveal-secrets` | `-r` | Show secrets |
| `--json` | | JSON output |

### auth0 apps update

```
auth0 apps update <app-id> [flags]
```

Same flags as `apps create` (except `--type` and `--resource-server-identifier` cannot be changed).

### auth0 apps delete

```
auth0 apps delete <app-id> [flags]
```

### auth0 apps use

Set a default application for the CLI.

```
auth0 apps use <app-id>
```

### auth0 apps open

Open application settings page in browser.

```
auth0 apps open <app-id>
```

### auth0 apps session-transfer show

```
auth0 apps session-transfer show <app-id> --json
```

### auth0 apps session-transfer update

```
auth0 apps session-transfer update <app-id> [flags]
```

---

## APIs (Resource Servers)

### auth0 apis list

```
auth0 apis list [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--number <int>` | `-n` | Number to retrieve (1-1000, default 100) |
| `--json` | | JSON output |
| `--csv` | | CSV output |

### auth0 apis create

```
auth0 apis create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | API name |
| `--identifier <string>` | `-i` | API identifier (cannot change after creation) |
| `--scopes <strings>` | `-s` | Comma-separated scopes |
| `--token-lifetime <int>` | `-l` | Token lifetime in seconds (default 86400) |
| `--offline-access` | `-o` | Allow refresh tokens |
| `--signing-alg <string>` | | HS256 or RS256 (default RS256) |
| `--subject-type-authorization <string>` | | Access policies JSON |
| `--json` | | JSON output |

Examples:
```bash
auth0 apis create --name "My API" --identifier "https://api.example.com" --no-input --json
auth0 apis create -n "My API" -i "https://api.example.com" -s "read:data,write:data" --json
```

### auth0 apis show

```
auth0 apis show <api-id> --json
```

### auth0 apis update

```
auth0 apis update <api-id> [flags]
```

### auth0 apis delete

```
auth0 apis delete <api-id>
```

### auth0 apis scopes list

```
auth0 apis scopes list <api-id> --json
```

---

## Users

### auth0 users search

```
auth0 users search [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--query <string>` | `-q` | Lucene query syntax search |
| `--sort <string>` | `-s` | Sort field (e.g. "created_at:1" for ascending) |
| `--number <int>` | `-n` | Number to retrieve (1-1000, default 100) |
| `--json` | | JSON output |
| `--csv` | | CSV output |

Examples:
```bash
auth0 users search --query 'email:"user@example.com"' --json
auth0 users search -q 'name:"Bob"' -s "name:1" -n 200 --json
```

### auth0 users search-by-email

```
auth0 users search-by-email [flags]
```

### auth0 users create

```
auth0 users create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | User's full name |
| `--email <string>` | `-e` | User's email |
| `--connection-name <string>` | `-c` | Database connection name |
| `--username <string>` | `-u` | Username (if connection requires it) |
| `--password <string>` | `-p` | Initial password (mandatory for non-SMS connections) |
| `--phone-number <string>` | `-m` | User's phone number |
| `--json` | | JSON output |

Examples:
```bash
auth0 users create --name "John Doe" --email john@example.com --connection-name "Username-Password-Authentication" --no-input --json
```

### auth0 users show

```
auth0 users show <user-id> --json
```

### auth0 users update

```
auth0 users update <user-id> [flags]
```

### auth0 users delete

```
auth0 users delete <user-id>
```

### auth0 users import

```
auth0 users import [flags]
```

### auth0 users roles assign

```
auth0 users roles assign <user-id> [flags]
```

### auth0 users roles show

```
auth0 users roles show <user-id> --json
```

### auth0 users roles remove

```
auth0 users roles remove <user-id> [flags]
```

### auth0 users blocks list

```
auth0 users blocks list <user-id> --json
```

### auth0 users blocks unblock

```
auth0 users blocks unblock <user-id>
```

### auth0 users open

```
auth0 users open <user-id>
```

---

## Actions

### auth0 actions list

```
auth0 actions list [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--trigger <string>` | `-t` | Filter by trigger |
| `--json` | | JSON output |

### auth0 actions create

```
auth0 actions create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | Action name |
| `--trigger <string>` | `-t` | Trigger (e.g. post-login) |
| `--code <string>` | `-c` | Code content |
| `--runtime <string>` | `-r` | Runtime: node22 (recommended), node18, node16, node12 |
| `--dependency <key=value>` | `-d` | npm dependency (repeatable) |
| `--secret <key=value>` | `-s` | Secret (repeatable) |
| `--json` | | JSON output |

Examples:
```bash
auth0 actions create --name myaction --trigger post-login --code "$(cat action.js)" --runtime node22 --no-input --json
```

### auth0 actions show

```
auth0 actions show <action-id> --json
```

### auth0 actions update

```
auth0 actions update <action-id> [flags]
```

### auth0 actions delete

```
auth0 actions delete <action-id>
```

### auth0 actions deploy

```
auth0 actions deploy <action-id>
```

### auth0 actions diff

```
auth0 actions diff <action-id>
```

---

## Organizations

### auth0 orgs list

```
auth0 orgs list [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--number <int>` | `-n` | Number to retrieve (default 100) |
| `--json` | | JSON output |

### auth0 orgs create

```
auth0 orgs create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | Organization name |
| `--display <string>` | `-d` | Display name |
| `--logo <string>` | `-l` | Logo URL |
| `--accent <string>` | `-a` | Accent color |
| `--background <string>` | `-b` | Background color |
| `--metadata <key=value>` | `-m` | Metadata (repeatable, max 10) |
| `--json` | | JSON output |

### auth0 orgs show

```
auth0 orgs show <org-id> --json
```

### auth0 orgs update

```
auth0 orgs update <org-id> [flags]
```

### auth0 orgs delete

```
auth0 orgs delete <org-id>
```

### auth0 orgs members list

```
auth0 orgs members list <org-id> --json
```

### auth0 orgs roles list

```
auth0 orgs roles list <org-id> --json
```

### auth0 orgs invitations list

```
auth0 orgs invitations list <org-id> --json
```

### auth0 orgs invitations create

```
auth0 orgs invitations create <org-id> [flags]
```

---

## Roles

### auth0 roles list

```
auth0 roles list --json
```

### auth0 roles create

```
auth0 roles create [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--name <string>` | `-n` | Role name |
| `--description <string>` | `-d` | Role description |
| `--json` | | JSON output |

### auth0 roles show

```
auth0 roles show <role-id> --json
```

### auth0 roles update

```
auth0 roles update <role-id> [flags]
```

### auth0 roles delete

```
auth0 roles delete <role-id>
```

### auth0 roles permissions list

```
auth0 roles permissions list <role-id> --json
```

### auth0 roles permissions add

```
auth0 roles permissions add <role-id> [flags]
```

### auth0 roles permissions remove

```
auth0 roles permissions remove <role-id> [flags]
```

---

## Logs

### auth0 logs list

```
auth0 logs list [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--filter <string>` | `-f` | Lucene query filter |
| `--number <int>` | `-n` | Number of entries (1-1000, default 100) |
| `--json` | | JSON output |
| `--csv` | | CSV output |

Examples:
```bash
auth0 logs list --filter "client_id:<client-id>" --json
auth0 logs list --filter "type:f" --json  # Failed logins
auth0 logs list --filter "user_id:<user-id>" -n 50 --json
```

### auth0 logs tail

```
auth0 logs tail [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--filter <string>` | `-f` | Lucene query filter |
| `--number <int>` | `-n` | Number of entries (1-1000, default 100) |

### auth0 logs streams

Manage log streaming to external services.

Subcommands: `list`, `show`, `delete`, `create <type>`, `update <type>`

Stream types: `datadog`, `eventbridge`, `eventgrid`, `http`, `splunk`, `sumo`

---

## Protection

### auth0 protection bot-detection show/update

```
auth0 protection bot-detection show --json
auth0 protection bot-detection update [flags]
```

### auth0 protection breached-password-detection show/update

```
auth0 protection breached-password-detection show --json
auth0 protection breached-password-detection update [flags]
```

### auth0 protection brute-force-protection show/update

```
auth0 protection brute-force-protection show --json
auth0 protection brute-force-protection update [flags]
```

### auth0 protection suspicious-ip-throttling show/update

```
auth0 protection suspicious-ip-throttling show --json
auth0 protection suspicious-ip-throttling update [flags]
```

### auth0 protection suspicious-ip-throttling ips check/unblock

```
auth0 protection suspicious-ip-throttling ips check <ip>
auth0 protection suspicious-ip-throttling ips unblock <ip>
```

---

## Domains

### auth0 domains list

```
auth0 domains list --json
```

### auth0 domains create

```
auth0 domains create [flags]
```

### auth0 domains show

```
auth0 domains show <domain-id> --json
```

### auth0 domains update

```
auth0 domains update <domain-id> [flags]
```

### auth0 domains delete

```
auth0 domains delete <domain-id>
```

### auth0 domains verify

```
auth0 domains verify <domain-id>
```

---

## Email

### auth0 email provider show/create/update/delete

```
auth0 email provider show --json
auth0 email provider create [flags]
auth0 email provider update [flags]
auth0 email provider delete
```

### auth0 email templates show/update

```
auth0 email templates show <template> --json
auth0 email templates update <template> [flags]
```

---

## Rules (Legacy)

### auth0 rules list

```
auth0 rules list --json
```

### auth0 rules create

```
auth0 rules create [flags]
```

### auth0 rules show/update/delete/enable/disable

```
auth0 rules show <rule-id> --json
auth0 rules update <rule-id> [flags]
auth0 rules delete <rule-id>
auth0 rules enable <rule-id>
auth0 rules disable <rule-id>
```

---

## Universal Login

### auth0 universal-login show

```
auth0 universal-login show --json
```

### auth0 universal-login update

```
auth0 universal-login update [flags]
```

### auth0 universal-login customize

```
auth0 universal-login customize
```

### auth0 universal-login switch

Switch Universal Login provider.

```
auth0 universal-login switch
```

### auth0 universal-login templates show/update

```
auth0 universal-login templates show --json
auth0 universal-login templates update [flags]
```

### auth0 universal-login prompts show/update

```
auth0 universal-login prompts show <prompt> --json
auth0 universal-login prompts update <prompt> [flags]
```

---

## Testing

### auth0 test login

Test the Universal Login flow. **Opens a browser.**

```
auth0 test login [flags]
```

### auth0 test token

Get a token for testing.

```
auth0 test token [flags]
```

---

## API (Raw Management API Requests)

```
auth0 api <method> <url-path> [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--data <string>` | `-d` | JSON payload (can also pipe via stdin) |
| `--query <key=value>` | `-q` | Query params (repeatable) |
| `--force` | | Skip delete confirmation |

Examples:
```bash
auth0 api get "tenants/settings"
auth0 api get "clients" -q "page=0" -q "per_page=10"
auth0 api post "clients" --data '{"name":"My App","app_type":"regular_web"}'
auth0 api delete "clients/<client-id>" --force
auth0 api "stats/daily" -q "from=20240101" -q "to=20240131"
cat data.json | auth0 api post clients
```

---

## Terraform

### auth0 terraform generate

Generate Terraform configuration for your Auth0 tenant. **(Experimental)**

```
auth0 terraform generate [flags]
```

| Flag | Short | Description |
| ---- | ----- | ----------- |
| `--output-dir <string>` | `-o` | Output directory (default "./") |
| `--resources <strings>` | `-r` | Resource types to generate (default: all) |
| `--tf-version <string>` | `-v` | Terraform version (default "1.5.0") |
| `--force` | | Skip confirmation |

Examples:
```bash
auth0 terraform generate -o ./terraform
auth0 terraform generate -o ./terraform -r auth0_client,auth0_action
```

---

## Event Streams

### auth0 event-streams list/show/create/update/delete

```
auth0 event-streams list --json
auth0 event-streams show <id> --json
auth0 event-streams create [flags]
auth0 event-streams update <id> [flags]
auth0 event-streams delete <id>
```

### auth0 event-streams stats/deliveries/redeliver/trigger

```
auth0 event-streams stats <id> --json
auth0 event-streams deliveries list <id> --json
auth0 event-streams deliveries show <stream-id> <delivery-id> --json
auth0 event-streams redeliver <stream-id> <delivery-id>
auth0 event-streams redeliver-many <stream-id> [flags]
auth0 event-streams trigger <id>
```

---

## Token Exchange

### auth0 token-exchange list/show/create/update/delete

```
auth0 token-exchange list --json
auth0 token-exchange show <id> --json
auth0 token-exchange create [flags]
auth0 token-exchange update <id> [flags]
auth0 token-exchange delete <id>
```

---

## Network ACL

### auth0 network-acl list/show/create/update/delete

```
auth0 network-acl list --json
auth0 network-acl show <id> --json
auth0 network-acl create [flags]
auth0 network-acl update <id> [flags]
auth0 network-acl delete <id>
```

---

## Phone

### auth0 phone provider list/show/create/update/delete

```
auth0 phone provider list --json
auth0 phone provider show <id> --json
auth0 phone provider create [flags]
auth0 phone provider update <id> [flags]
auth0 phone provider delete <id>
```

---

## ACUL (Advanced Customization Universal Login)

### auth0 acul init

Initialize ACUL project.

```
auth0 acul init [flags]
```

### auth0 acul dev

Start ACUL dev server.

```
auth0 acul dev [flags]
```

### auth0 acul screen add

```
auth0 acul screen add [flags]
```

### auth0 acul config list/get/set/generate/docs

```
auth0 acul config list
auth0 acul config get <key>
auth0 acul config set <key> <value>
auth0 acul config generate
auth0 acul config docs
```

---

## Quickstarts

### auth0 quickstarts list/download/setup

```
auth0 quickstarts list --json
auth0 quickstarts download [flags]
auth0 quickstarts setup [flags]
```

---

## Completion

```
auth0 completion bash
auth0 completion zsh
auth0 completion fish
auth0 completion powershell
```

---

For full details on every command, flag, and example, see the [Auth0 CLI documentation](https://auth0.github.io/auth0-cli/).
