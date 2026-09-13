#!/usr/bin/env node
/**
 * validate-auth0.mjs — Pre-flight check for Auth0 CLI session.
 * Usage: node validate-auth0.mjs --domain <tenant-domain>
 * Zero external dependencies.
 */
import { getCliVersion, isSessionValid, getActiveTenant } from "./utils/auth0-api.mjs";

const BOOTSTRAP_SCOPES = [
  "read:connection_profiles", "create:connection_profiles", "update:connection_profiles",
  "read:user_attribute_profiles", "create:user_attribute_profiles", "update:user_attribute_profiles",
  "read:client_grants", "create:client_grants", "update:client_grants", "delete:client_grants",
  "read:connections", "create:connections", "update:connections",
  "create:organization_connections", "create:organization_members", "create:organization_member_roles",
  "read:clients", "create:clients", "update:clients", "read:client_keys",
  "read:roles", "create:roles", "update:roles",
  "read:resource_servers", "create:resource_servers", "update:resource_servers",
  "update:tenant_settings",
];

function parseArgs() {
  const args = process.argv.slice(2);
  let domain = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--domain" && args[i + 1]) domain = args[i + 1];
  }
  return { domain };
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
}

const { domain } = parseArgs();

if (!domain) {
  output({
    status: "error",
    data: { cli_installed: null, session_valid: null },
    error: {
      code: "MISSING_DOMAIN",
      message: "The --domain argument is required",
      fallback_instructions: "Re-run with: node validate-auth0.mjs --domain <your-tenant>.us.auth0.com",
    },
  });
}

// Step 1: Check CLI installed
const cliVersion = getCliVersion();
if (!cliVersion) {
  output({
    status: "error",
    data: { cli_installed: false, session_valid: false },
    error: {
      code: "CLI_NOT_INSTALLED",
      message: "Auth0 CLI is not installed or not in PATH",
      fallback_instructions: "Ask the user to install the Auth0 CLI: https://github.com/auth0/auth0-cli#installation. Then re-run this script.",
    },
  });
}

// Step 2: Check session valid
const sessionValid = isSessionValid();
if (!sessionValid) {
  const scopesArg = BOOTSTRAP_SCOPES.join(",");
  output({
    status: "error",
    data: { cli_installed: true, cli_version: cliVersion, session_valid: false },
    error: {
      code: "SESSION_EXPIRED",
      message: "Auth0 CLI session is expired or invalid",
      fallback_instructions: `Run: auth0 login --domain ${domain} --scopes ${scopesArg}\nThis opens a browser for the user to authenticate. Wait for completion (up to 120s). Tell the user to complete the login in their browser.`,
    },
  });
}

// Step 3: Check active tenant matches
const tenantResult = getActiveTenant();
if (!tenantResult.ok) {
  output({
    status: "error",
    data: { cli_installed: true, cli_version: cliVersion, session_valid: true },
    error: {
      code: "TENANT_CHECK_FAILED",
      message: tenantResult.timedOut ? "Tenant check timed out" : tenantResult.error,
      fallback_instructions: "The Auth0 CLI may be unresponsive. Ask the user to run: auth0 tenants list",
    },
  });
}

const tenantMatch = tenantResult.domain === domain;
if (!tenantMatch) {
  const available = tenantResult.allTenants.includes(domain);
  output({
    status: "error",
    data: {
      cli_installed: true,
      cli_version: cliVersion,
      session_valid: true,
      active_tenant: tenantResult.domain,
      tenant_match: false,
      requested_tenant: domain,
      tenant_available: available,
    },
    error: {
      code: "TENANT_MISMATCH",
      message: `Active tenant is "${tenantResult.domain}" but "${domain}" was requested`,
      fallback_instructions: available
        ? `Run: auth0 tenants use ${domain}`
        : `Run: auth0 login --domain ${domain} --scopes ${BOOTSTRAP_SCOPES.join(",")}\nThis opens a browser for the user to authenticate. Wait for completion (up to 120s). Tell the user to complete the login in their browser.`,
    },
  });
}

output({
  status: "success",
  data: {
    cli_installed: true,
    cli_version: cliVersion,
    session_valid: true,
    active_tenant: tenantResult.domain,
    tenant_match: true,
  },
});
