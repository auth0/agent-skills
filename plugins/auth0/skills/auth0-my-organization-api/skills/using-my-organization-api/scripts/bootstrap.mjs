#!/usr/bin/env node
/**
 * bootstrap.mjs — Idempotent Auth0 tenant configuration for Universal Components.
 * Usage: node bootstrap.mjs --domain <d> --features full|myorg|myaccount --framework nextjs|react-spa [--app-name "App"] [--port 3000]
 * Zero external dependencies. All operations use the auth0 CLI via child_process.
 */
import { randomBytes } from "node:crypto";
import { discoverExistingResources } from "./utils/discovery.mjs";
import {
  MYORG_API_SCOPES,
  MYACCOUNT_API_SCOPES,
  getAvailableMyAccountScopes,
  ensureMyOrgResourceServer,
  ensureMyAccountResourceServer,
  ensureConnectionProfile,
  ensureUserAttributeProfile,
  ensureConnection,
  ensureAdminRole,
  ensureOrganization,
  ensureTenantSettings,
  ensurePromptSettings,
} from "./utils/resources.mjs";
import { ensureClient, ensureClientGrant } from "./utils/clients.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { domain: null, features: "full", framework: "react-spa", appName: "Universal Components Demo", port: "3000" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--domain" && args[i + 1]) opts.domain = args[++i];
    else if (args[i] === "--features" && args[i + 1]) opts.features = args[++i];
    else if (args[i] === "--framework" && args[i + 1]) opts.framework = args[++i];
    else if (args[i] === "--app-name" && args[i + 1]) opts.appName = args[++i];
    else if (args[i] === "--port" && args[i + 1]) opts.port = args[++i];
    else if (args[i] === "--help") {
      console.log("Usage: node bootstrap.mjs --domain <tenant.auth0.com> --features full|myorg|myaccount --framework nextjs|react-spa [--port 3000]");
      process.exit(0);
    }
  }
  return opts;
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
}

function errorAt(step, completedSteps, code, message, fallback) {
  output({
    status: "partial",
    completed_steps: completedSteps,
    error: { code, message, failed_at: step, fallback_instructions: fallback },
  });
}

const opts = parseArgs();
if (!opts.domain) {
  output({
    status: "error",
    completed_steps: [],
    error: { code: "MISSING_DOMAIN", message: "--domain is required", failed_at: "args", fallback_instructions: "Re-run with --domain <your-tenant>.us.auth0.com" },
  });
}

const features = {
  enableMyOrg: opts.features === "full" || opts.features === "myorg",
  enableMyAccount: opts.features === "full" || opts.features === "myaccount",
};

const completedSteps = [];

// Step 1: Discover existing resources
const { resources, errors: discoveryErrors } = discoverExistingResources(opts.domain);
if (discoveryErrors.length > 0 && resources.clients.length === 0) {
  errorAt("discovery", completedSteps, "DISCOVERY_FAILED",
    `Failed to discover tenant resources: ${discoveryErrors.join("; ")}`,
    "Ensure your Auth0 CLI session is valid. Run: auth0 login --domain " + opts.domain
  );
}
completedSteps.push("discovery");

// Step 2: Tenant settings
const tenantResult = ensureTenantSettings();
if (tenantResult.action === "error") {
  errorAt("tenant_settings", completedSteps, "TENANT_SETTINGS_FAILED", tenantResult.error,
    "Manually update tenant settings via Auth0 Dashboard > Settings."
  );
}
completedSteps.push("tenant_settings");

// Step 3: Prompt settings
const promptResult = ensurePromptSettings();
if (promptResult.action === "error") {
  errorAt("prompts", completedSteps, "PROMPT_SETTINGS_FAILED", promptResult.error,
    "Manually enable identifier_first in Auth0 Dashboard > Authentication > Authentication Profile."
  );
}
completedSteps.push("prompts");

// Step 4: Connection profile (needed for client setup)
let connectionProfileId = null;
if (features.enableMyOrg) {
  const cpResult = ensureConnectionProfile(resources.connectionProfiles);
  if (cpResult.action === "error") {
    errorAt("connection_profile", completedSteps, "CONNECTION_PROFILE_FAILED", cpResult.error,
      "Your tenant may not support connection profiles. Re-run the script — it will skip completed steps."
    );
  }
  connectionProfileId = cpResult.data?.id;
  completedSteps.push("connection_profile");
}

// Step 5: User attribute profile
let userAttributeProfileId = null;
if (features.enableMyOrg) {
  const uapResult = ensureUserAttributeProfile(resources.userAttributeProfiles);
  if (uapResult.action === "error") {
    errorAt("user_attribute_profile", completedSteps, "USER_ATTRIBUTE_PROFILE_FAILED", uapResult.error,
      "Your tenant may not support user attribute profiles. Re-run the script — it will skip completed steps."
    );
  }
  userAttributeProfileId = uapResult.data?.id;
  completedSteps.push("user_attribute_profile");
}

// Step 6: Resource servers
if (features.enableMyOrg) {
  const rsResult = ensureMyOrgResourceServer(resources.resourceServers, opts.domain);
  if (rsResult.action === "error") {
    errorAt("resource_servers", completedSteps, "RESOURCE_SERVER_CREATE_FAILED", rsResult.error,
      "The My Organization API could not be created. Verify your tenant has the Organizations feature enabled in Auth0 Dashboard > Settings. Then re-run."
    );
  }
  completedSteps.push("resource_server_myorg");
}

if (features.enableMyAccount) {
  const rsResult = ensureMyAccountResourceServer(resources.resourceServers, opts.domain);
  if (rsResult.action === "error") {
    errorAt("resource_servers", completedSteps, "RESOURCE_SERVER_CREATE_FAILED", rsResult.error,
      "The My Account API could not be created. Verify your tenant has the My Account feature enabled. Then re-run."
    );
  }
  completedSteps.push("resource_server_myaccount");
}

// Step 7: Client
const myAccountApiScopes = features.enableMyAccount
  ? getAvailableMyAccountScopes(resources.resourceServers, opts.domain).length > 0
    ? getAvailableMyAccountScopes(resources.resourceServers, opts.domain)
    : MYACCOUNT_API_SCOPES
  : [];

const clientResult = ensureClient(
  resources.clients, opts.domain, opts.framework, opts.port,
  connectionProfileId, userAttributeProfileId, features, myAccountApiScopes
);
if (clientResult.action === "error") {
  errorAt("client", completedSteps, "CLIENT_CREATE_FAILED", clientResult.error,
    "Failed to create/update the Auth0 client. Check your tenant permissions and re-run."
  );
}
const clientId = clientResult.data?.client_id;
const clientSecret = clientResult.data?.client_secret;
completedSteps.push("client");

// Step 8: Client grants
if (features.enableMyOrg) {
  const grantResult = ensureClientGrant(clientId, `https://${opts.domain}/my-org/`, MYORG_API_SCOPES, resources.clientGrants);
  if (grantResult.action === "error") {
    errorAt("client_grants", completedSteps, "CLIENT_GRANT_FAILED", grantResult.error,
      "Failed to create My Org API client grant. Re-run the script."
    );
  }
  completedSteps.push("client_grant_myorg");
}

if (features.enableMyAccount && myAccountApiScopes.length > 0) {
  const grantResult = ensureClientGrant(clientId, `https://${opts.domain}/me/`, myAccountApiScopes, resources.clientGrants);
  if (grantResult.action === "error") {
    errorAt("client_grants", completedSteps, "CLIENT_GRANT_FAILED", grantResult.error,
      "Failed to create My Account API client grant. Re-run the script."
    );
  }
  completedSteps.push("client_grant_myaccount");
}

// Step 9: Connection
const connectionResult = ensureConnection(resources.connections, [clientId]);
if (connectionResult.action === "error") {
  errorAt("connection", completedSteps, "CONNECTION_FAILED", connectionResult.error,
    "Failed to create/update database connection. Re-run the script."
  );
}
const connectionId = connectionResult.data?.id;
completedSteps.push("connection");

// Step 10: Roles
if (features.enableMyOrg) {
  const roleResult = ensureAdminRole(resources.roles, opts.domain);
  if (roleResult.action === "error") {
    errorAt("roles", completedSteps, "ROLE_FAILED", roleResult.error,
      "Failed to create/update admin role. Re-run the script."
    );
  }
  completedSteps.push("roles");
}

// Step 11: Organization
if (features.enableMyOrg) {
  const orgResult = ensureOrganization(resources.orgs, connectionId);
  if (orgResult.action === "error") {
    errorAt("organization", completedSteps, "ORG_FAILED", orgResult.error,
      "Failed to create demo organization. Re-run the script."
    );
  }
  completedSteps.push("organization");
}

// Build env vars output
const auth0Secret = randomBytes(32).toString("hex");
const scopes = ["openid", "profile", "email"];
if (features.enableMyOrg) scopes.push(...MYORG_API_SCOPES);
if (features.enableMyAccount) scopes.push(...myAccountApiScopes);

const envVars = { AUTH0_DOMAIN: opts.domain, AUTH0_CLIENT_ID: clientId };
if (opts.framework === "nextjs") {
  envVars.AUTH0_CLIENT_SECRET = clientSecret;
  envVars.AUTH0_SECRET = auth0Secret;
  envVars.NEXT_PUBLIC_AUTH0_DOMAIN = opts.domain;
  envVars.NEXT_PUBLIC_AUTH0_CLIENT_ID = clientId;
  envVars.APP_BASE_URL = `http://localhost:${opts.port}`;
  envVars.AUTH0_SCOPE = scopes.join(" ");
  if (features.enableMyOrg) envVars.AUTH0_AUDIENCE = `https://${opts.domain}/my-org/`;
  if (features.enableMyAccount) envVars.AUTH0_MY_ACCOUNT_AUDIENCE = `https://${opts.domain}/me/`;
} else {
  envVars.VITE_AUTH0_DOMAIN = opts.domain;
  envVars.VITE_AUTH0_CLIENT_ID = clientId;
  if (features.enableMyOrg) envVars.VITE_AUTH0_AUDIENCE = `https://${opts.domain}/my-org/`;
  if (features.enableMyAccount) envVars.VITE_AUTH0_MY_ACCOUNT_AUDIENCE = `https://${opts.domain}/me/`;
}

output({
  status: "success",
  completed_steps: completedSteps,
  data: {
    client_id: clientId,
    client_secret: clientSecret || null,
    domain: opts.domain,
    env_vars: envVars,
    scopes: scopes.join(" "),
  },
});
