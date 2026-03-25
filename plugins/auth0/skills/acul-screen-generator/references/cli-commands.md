# Auth0 ACUL CLI Commands Reference

Full reference for `auth0 acul` commands. Requires Auth0 CLI installed (`brew install auth0`).

---

## Authentication

```bash
auth0 login                        # authenticate with Auth0 tenant
auth0 login --tenant <tenant>      # authenticate to a specific tenant
```

---

## auth0 acul init

Generates a new ACUL project from a template.

```bash
auth0 acul init <app_name>
auth0 acul init <app_name> -t react -s login,signup
auth0 acul init <app_name> -t react -s login,login-id,login-password,signup,reset-password
```

| Flag | Short | Description |
|------|-------|-------------|
| `--template string` | `-t` | Framework template: `react` or `js` |
| `--screens strings` | `-s` | Comma-separated screen list |
| `--tenant string` | | Target a specific tenant |
| `--no-input` | | Disable interactive prompts |

Creates `acul_config.json` in the project directory — required for all subsequent commands.

---

## auth0 acul screen add

Adds screens to an existing ACUL project. Project must already be initialized.

```bash
auth0 acul screen add <screen-name> -d <project-dir>
auth0 acul screen add login-id login-password -d ./acul_app
auth0 acul screen add mfa-otp-challenge -d ./my-project
```

| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Path to project directory (must contain `acul_config.json`) |
| `--tenant string` | | Target a specific tenant |

**ON ERROR:** Fall back to SDK examples — see `screen-catalog.md` for URLs.

---

## auth0 acul config

### List configurations

```bash
auth0 acul config list
auth0 acul config list --rendering-mode advanced
auth0 acul config list --screen login-id
auth0 acul config list --prompt login --rendering-mode advanced --fields head_tags,context_configuration
```

| Flag | Description |
|------|-------------|
| `--prompt string` | Filter by Universal Login prompt |
| `--rendering-mode string` | Filter by mode: `advanced` or `standard` |
| `--screen string` | Filter by screen name |
| `--fields string` | Comma-separated fields to include |
| `--json` | Output as JSON |
| `--page int` | Page index (starts at 0) |
| `--per-page int` | Results per page (default 50, max 100) |

### Get screen config

```bash
auth0 acul config get <screen-name>
auth0 acul config get login-id -f ./acul_config/login-id.json
auth0 acul config get signup-id --file settings.json
```

| Flag | Short | Description |
|------|-------|-------------|
| `--file string` | `-f` | Save config to file path |

### Set screen config

```bash
auth0 acul config set <screen-name>
auth0 acul config set login-id --file settings.json
```

### Generate config stub

```bash
auth0 acul config generate <screen-name>
auth0 acul config generate login-id --file login-settings.json
```

Generates a stub `.json` config file for a screen. Use after `screen add` or during scratch setup.

---

## auth0 acul dev

Starts development mode with automatic build watching.

```bash
# Local preview (no tenant connection)
auth0 acul dev -p 3000
auth0 acul dev -p 3000 -d ./my-project

# Connected mode — updates rendering settings on tenant (stage/dev only)
auth0 acul dev --connected -s login-id
auth0 acul dev -c -s login-id,signup -d ./my-project
```

| Flag | Short | Description |
|------|-------|-------------|
| `--port string` | `-p` | Local dev server port (required) |
| `--dir string` | `-d` | ACUL project directory path |
| `--connected` | `-c` | Connected mode: syncs to tenant |
| `--screens strings` | `-s` | Specific screens to develop |

⚠️ **Connected mode warning:** only use on stage/dev tenants, never production.

---

## Typical Workflows

### Scratch setup
```bash
auth0 login
auth0 acul init my-app -t react -s login-id,login-password,signup
cd my-app
auth0 acul config generate login-id
auth0 acul dev -p 3000
```

### Add a screen to existing project
```bash
auth0 acul screen add mfa-otp-challenge -d ./my-app
auth0 acul config generate mfa-otp-challenge -f ./my-app/acul_config/mfa-otp-challenge.json
auth0 acul dev -p 3000 -d ./my-app
```

### Inspect current tenant ACUL state
```bash
auth0 acul config list --rendering-mode advanced --json
auth0 acul config get login-id -f login-id-current.json
```
