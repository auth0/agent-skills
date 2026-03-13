# Auth0 CLI Advanced Features

Deep-dive into advanced CLI capabilities, complex configurations, and troubleshooting.

---

## Table of Contents

- [Terraform Code Generation](#terraform-code-generation)
- [Attack Protection](#attack-protection)
- [Custom Domains](#custom-domains)
- [Email & Phone Configuration](#email--phone-configuration)
- [Event Streams](#event-streams)
- [Token Exchange](#token-exchange)
- [Tenant Settings](#tenant-settings)
- [Network ACL](#network-acl)
- [Quickstarts](#quickstarts)
- [Direct API Access](#direct-api-access)
- [Troubleshooting](#troubleshooting)

---

## Terraform Code Generation

Generate Terraform configuration files from your existing Auth0 tenant. This is an experimental feature.

```bash
auth0 terraform generate [flags]
```

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--output-dir` | `-o` | string | `./` | Output directory for generated files |
| `--resources` | `-r` | strings | all | Specific resource types to generate |
| `--tf-version` | `-v` | string | `1.5.0` | Target Terraform version |
| `--force` | | bool | false | Skip confirmation prompt |

### Examples

```bash
# Generate all resources to a directory
auth0 terraform generate -o ./terraform/auth0

# Generate only specific resources
auth0 terraform generate -o ./terraform -r auth0_client,auth0_connection

# Generate with specific Terraform version
auth0 terraform generate -o ./terraform -v 1.8.0 --force
```

### Supported Resources

`auth0_action`, `auth0_attack_protection`, `auth0_branding`, `auth0_branding_theme`, `auth0_phone_provider`, `auth0_client`, `auth0_client_grant`, `auth0_connection`, `auth0_custom_domain`, `auth0_flow`, `auth0_flow_vault_connection`, `auth0_form`, `auth0_email_provider`, `auth0_email_template`, `auth0_guardian`, `auth0_log_stream`, `auth0_network_acl`, `auth0_organization`, `auth0_pages`, `auth0_prompt`, `auth0_prompt_custom_text`, `auth0_prompt_screen_renderer`, `auth0_resource_server`, `auth0_role`, `auth0_self_service_profile`, `auth0_tenant`, `auth0_trigger_actions`, `auth0_user_attribute_profile`, `auth0_prompt_screen_partial`

### Typical Workflow

1. Generate Terraform files from your existing tenant
2. Review and adjust the generated `.tf` files
3. Run `terraform init` and `terraform plan` to verify
4. Use `terraform apply` to manage resources as Infrastructure-as-Code

---

## Attack Protection

Configure security features to protect against common attack patterns.

### Bot Detection

```bash
# Show current bot detection settings
auth0 protection bot-detection show

# Enable/update bot detection
auth0 protection bot-detection update
```

### Breached Password Detection

```bash
# Show current settings
auth0 protection breached-password-detection show

# Update settings
auth0 protection breached-password-detection update
```

### Brute-Force Protection

```bash
# Show current settings
auth0 protection brute-force-protection show

# Update settings
auth0 protection brute-force-protection update
```

### Suspicious IP Throttling

```bash
# Show current settings
auth0 protection suspicious-ip-throttling show

# Update settings
auth0 protection suspicious-ip-throttling update

# Check if an IP is blocked
auth0 protection suspicious-ip-throttling ips check <ip-address>

# Unblock an IP
auth0 protection suspicious-ip-throttling ips unblock <ip-address>
```

---

## Custom Domains

Configure custom domains for your Auth0 tenant.

```bash
# Create a custom domain
auth0 domains create --domain "auth.myapp.com"

# List custom domains
auth0 domains list

# Show domain details
auth0 domains show <domain-id>

# Verify domain (after configuring DNS)
auth0 domains verify <domain-id>

# Update domain
auth0 domains update <domain-id>

# Delete domain
auth0 domains delete <domain-id>
```

### Setup Process

1. Create the custom domain in Auth0
2. Configure the CNAME record in your DNS provider pointing to the Auth0 domain
3. Verify the domain with `auth0 domains verify`
4. Update your application configuration to use the custom domain

---

## Email & Phone Configuration

### Email Provider

Configure a custom email provider (SendGrid, AWS SES, Mandrill, etc.) instead of the default Auth0 email service.

```bash
# Show current email provider
auth0 email provider show

# Create/configure email provider
auth0 email provider create

# Update email provider
auth0 email provider update

# Delete email provider (reverts to Auth0 default)
auth0 email provider delete
```

### Email Templates

Customize email content for verification, password reset, and other flows.

```bash
# Show a template
auth0 email templates show

# Update a template
auth0 email templates update
```

### Phone Provider

Configure SMS/phone providers for MFA and passwordless authentication.

```bash
# List phone providers
auth0 phone provider list

# Show provider details
auth0 phone provider show <provider-id>

# Create phone provider
auth0 phone provider create

# Update phone provider
auth0 phone provider update <provider-id>

# Delete phone provider
auth0 phone provider delete <provider-id>
```

---

## Event Streams

Manage event delivery for real-time integrations beyond log streaming.

```bash
# Create an event stream
auth0 event-streams create

# List event streams
auth0 event-streams list

# Show event stream details
auth0 event-streams show <stream-id>

# Update event stream
auth0 event-streams update <stream-id>

# Delete event stream
auth0 event-streams delete <stream-id>

# View delivery statistics
auth0 event-streams stats <stream-id>

# Trigger a test event
auth0 event-streams trigger <stream-id>
```

### Delivery Management

```bash
# List deliveries for a stream
auth0 event-streams deliveries list <stream-id>

# Show delivery details
auth0 event-streams deliveries show <stream-id> <delivery-id>

# Redeliver a failed event
auth0 event-streams redeliver <stream-id> <delivery-id>

# Redeliver multiple failed events
auth0 event-streams redeliver-many <stream-id>
```

---

## Token Exchange

Manage token exchange profiles (RFC 8693).

```bash
# Create token exchange profile
auth0 token-exchange create

# List token exchange profiles
auth0 token-exchange list

# Show profile details
auth0 token-exchange show <profile-id>

# Update profile
auth0 token-exchange update <profile-id>

# Delete profile
auth0 token-exchange delete <profile-id>
```

---

## Tenant Settings

Manage global tenant-level configuration.

```bash
# Show current tenant settings
auth0 tenant-settings show

# Update tenant settings
auth0 tenant-settings update set <key> <value>

# Remove a tenant setting
auth0 tenant-settings update unset <key>
```

---

## Network ACL

Manage IP-based access restrictions for your tenant.

```bash
# List network ACLs
auth0 network-acl list

# Show ACL details
auth0 network-acl show <acl-id>

# Create network ACL
auth0 network-acl create

# Update network ACL
auth0 network-acl update <acl-id>

# Delete network ACL
auth0 network-acl delete <acl-id>
```

---

## Quickstarts

Download and set up Auth0 quickstart projects.

```bash
# List available quickstart frameworks
auth0 quickstarts list

# Download a quickstart
auth0 quickstarts download

# Set up a quickstart project
auth0 quickstarts setup
```

---

## Direct API Access

Make direct calls to the Auth0 Management API for operations not covered by dedicated commands.

```bash
# GET request
auth0 api get "connections"

# POST request
auth0 api post "connections" --data '{"name":"my-connection","strategy":"auth0"}'

# PATCH request
auth0 api patch "connections/<connection-id>" --data '{"enabled_clients":["<client-id>"]}'

# DELETE request
auth0 api delete "connections/<connection-id>"
```

This is useful for accessing API endpoints that don't have dedicated CLI commands.

---

## Troubleshooting

### Authentication Failures

| Problem | Solution |
|---------|----------|
| `auth0 login` hangs | Open the URL shown in terminal manually; check firewall/proxy settings |
| "Unauthorized" after login | Token may have expired; re-run `auth0 login` |
| Client credentials rejected | Verify `--client-id` and `--client-secret` are correct; check the M2M app has the right API grants |
| "Permission denied" on commands | Your authenticated account may lack Management API scopes; use an admin account |

### Command Errors

| Problem | Solution |
|---------|----------|
| `command not found: auth0` | CLI not installed or not in PATH; reinstall or add to PATH |
| `--flag not recognized` | CLI version may be outdated; update with `brew upgrade auth0` or reinstall |
| Command hangs in script | Add `--no-input` flag to prevent interactive prompts |
| JSON parse error in input | Ensure proper JSON escaping in shell; use `"$(cat file.json)"` for complex input |

### API Rate Limits

If you hit rate limits during bulk operations:

```bash
# Add delays between operations
for user_id in $(auth0 users search --query "email:*@old-domain.com" --json | jq -r '.[].user_id'); do
  auth0 users update "$user_id" --json '{"app_metadata":{"migrated":true}}'
  sleep 1  # Rate limit buffer
done
```

### Shell Completion

Set up tab completion for faster CLI usage:

```bash
# Bash - add to ~/.bashrc
eval "$(auth0 completion bash)"

# Zsh - add to ~/.zshrc
eval "$(auth0 completion zsh)"
```

### Version and Debug Info

```bash
# Check CLI version
auth0 --version

# Run any command with debug output
auth0 apps list --debug

# Report issues
# https://github.com/auth0/auth0-cli/issues
```
