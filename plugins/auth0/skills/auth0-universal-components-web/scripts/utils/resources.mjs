import { auth0ApiCall, auth0Exec } from "./auth0-api.mjs";

export const MYORG_API_SCOPES = [
  "read:my_org:details",
  "update:my_org:details",
  "create:my_org:identity_providers",
  "read:my_org:identity_providers",
  "update:my_org:identity_providers",
  "delete:my_org:identity_providers",
  "update:my_org:identity_providers_detach",
  "read:my_org:domains",
  "delete:my_org:domains",
  "create:my_org:domains",
  "update:my_org:domains",
  "create:my_org:identity_providers_domains",
  "delete:my_org:identity_providers_domains",
  "read:my_org:identity_providers_scim_tokens",
  "create:my_org:identity_providers_scim_tokens",
  "delete:my_org:identity_providers_scim_tokens",
  "create:my_org:identity_providers_provisioning",
  "read:my_org:identity_providers_provisioning",
  "delete:my_org:identity_providers_provisioning",
  "read:my_org:configuration",
];

export const MYACCOUNT_API_SCOPES = [
  "create:me:authentication_methods",
  "read:me:authentication_methods",
  "delete:me:authentication_methods",
  "update:me:authentication_methods",
  "read:me:factors",
];

export const CONNECTION_PROFILE_NAME = "Universal-Components-Profile";
export const USER_ATTRIBUTE_PROFILE_NAME = "Universal Components Profile";
export const DEFAULT_CONNECTION_NAME = "Universal-Components-Demo";
export const DEMO_ORG_NAME = "demo-org";

export function getAvailableMyAccountScopes(resourceServers, domain) {
  const api = resourceServers.find((rs) => rs.identifier === `https://${domain}/me/`);
  if (!api || !api.scopes) return [];
  return api.scopes.map((s) => s.value);
}

// --- Resource Server operations ---

export function ensureMyOrgResourceServer(resourceServers, domain) {
  const existing = resourceServers.find((rs) => rs.identifier === `https://${domain}/my-org/`);
  if (existing && existing.skip_consent_for_verifiable_first_party_clients === true) {
    return { action: "skip", data: existing };
  }
  if (existing) {
    const result = auth0ApiCall("patch", `resource-servers/${existing.id}`, {
      skip_consent_for_verifiable_first_party_clients: true,
    });
    return result.ok ? { action: "updated", data: existing } : { action: "error", error: result.error };
  }
  const result = auth0ApiCall("post", "resource-servers", {
    identifier: `https://${domain}/my-org/`,
    name: "Auth0 My Organization API",
    skip_consent_for_verifiable_first_party_clients: true,
    token_dialect: "rfc9068_profile",
  });
  return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
}

export function ensureMyAccountResourceServer(resourceServers, domain) {
  const existing = resourceServers.find((rs) => rs.identifier === `https://${domain}/me/`);
  if (existing && existing.skip_consent_for_verifiable_first_party_clients === true) {
    return { action: "skip", data: existing };
  }
  if (existing) {
    const result = auth0ApiCall("patch", `resource-servers/${existing.id}`, {
      skip_consent_for_verifiable_first_party_clients: true,
    });
    return result.ok ? { action: "updated", data: existing } : { action: "error", error: result.error };
  }
  const result = auth0ApiCall("post", "resource-servers", {
    identifier: `https://${domain}/me/`,
    name: "Auth0 My Account API",
    skip_consent_for_verifiable_first_party_clients: true,
    token_dialect: "rfc9068_profile",
  });
  return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
}

// --- Connection Profile operations ---

export function ensureConnectionProfile(connectionProfiles) {
  const existing = connectionProfiles.find((cp) => cp.name === CONNECTION_PROFILE_NAME);
  const desiredConfig = {
    organization: { show_as_button: "optional", assign_membership_on_login: "optional" },
    connection_name_prefix_template: "con-{org_id}-",
    enabled_features: ["scim", "universal_logout"],
  };

  if (existing) {
    const needsUpdate =
      existing.organization?.show_as_button !== desiredConfig.organization.show_as_button ||
      existing.organization?.assign_membership_on_login !== desiredConfig.organization.assign_membership_on_login ||
      existing.connection_name_prefix_template !== desiredConfig.connection_name_prefix_template;
    if (!needsUpdate) return { action: "skip", data: existing };
    const result = auth0ApiCall("patch", `connection-profiles/${existing.id}`, desiredConfig);
    return result.ok ? { action: "updated", data: result.data || existing } : { action: "error", error: result.error };
  }
  const result = auth0ApiCall("post", "connection-profiles", { name: CONNECTION_PROFILE_NAME, ...desiredConfig });
  return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
}

// --- User Attribute Profile operations ---

export function ensureUserAttributeProfile(userAttributeProfiles) {
  const existing = userAttributeProfiles.find((uap) => uap.name === USER_ATTRIBUTE_PROFILE_NAME);
  if (existing) return { action: "skip", data: existing };

  const templates = auth0ApiCall("get", "user-attribute-profiles/templates");
  if (!templates.ok || !templates.data?.user_attribute_profile_templates?.length) {
    return { action: "error", error: "No user attribute profile templates available" };
  }
  const template = templates.data.user_attribute_profile_templates[0].template;
  template.name = USER_ATTRIBUTE_PROFILE_NAME;
  const result = auth0ApiCall("post", "user-attribute-profiles", template);
  return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
}

// --- Connection operations ---

export function ensureConnection(connections, enabledClientIds) {
  const existing = connections.find((c) => c.name === DEFAULT_CONNECTION_NAME);
  if (!existing) {
    const result = auth0ApiCall("post", "connections", {
      strategy: "auth0",
      name: DEFAULT_CONNECTION_NAME,
      display_name: "Universal-Components",
      enabled_clients: enabledClientIds,
    });
    return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
  }
  const missingClients = enabledClientIds.filter((id) => !(existing.enabled_clients || []).includes(id));
  if (missingClients.length === 0) return { action: "skip", data: existing };
  const result = auth0ApiCall("patch", `connections/${existing.id}`, {
    enabled_clients: [...(existing.enabled_clients || []), ...missingClients],
  });
  return result.ok ? { action: "updated", data: result.data || existing } : { action: "error", error: result.error };
}

// --- Role operations ---

export function ensureAdminRole(roles, domain) {
  const existing = roles.find((r) => r.name === "admin");
  if (!existing) {
    const createResult = auth0Exec(
      ["roles", "create", "--name", "admin", "--description", "Manage the organization's configuration.", "--json", "--no-input"],
      { timeout: 15000 }
    );
    if (!createResult.ok) return { action: "error", error: createResult.stderr };
    const role = JSON.parse(createResult.stdout);
    const permsResult = auth0ApiCall("post", `roles/${role.id}/permissions`, {
      permissions: MYORG_API_SCOPES.map((s) => ({ permission_name: s, resource_server_identifier: `https://${domain}/my-org/` })),
    });
    return permsResult.ok ? { action: "created", data: role } : { action: "error", error: permsResult.error };
  }

  // Check existing permissions
  const permsResult = auth0ApiCall("get", `roles/${existing.id}/permissions`);
  if (!permsResult.ok) return { action: "error", error: permsResult.error };
  const currentPerms = Array.isArray(permsResult.data) ? permsResult.data : permsResult.data?.permissions || [];
  const myOrgPerms = currentPerms.filter((p) => p.resource_server_identifier === `https://${domain}/my-org/`);
  const existingNames = new Set(myOrgPerms.map((p) => p.permission_name));
  const missing = MYORG_API_SCOPES.filter((s) => !existingNames.has(s));
  if (missing.length === 0) return { action: "skip", data: existing };

  const addResult = auth0ApiCall("post", `roles/${existing.id}/permissions`, {
    permissions: missing.map((s) => ({ permission_name: s, resource_server_identifier: `https://${domain}/my-org/` })),
  });
  return addResult.ok ? { action: "updated", data: existing } : { action: "error", error: addResult.error };
}

// --- Organization operations ---

export function ensureOrganization(orgs, connectionId) {
  const existing = orgs.find((o) => o.name === DEMO_ORG_NAME);
  if (!existing) {
    const createResult = auth0Exec(
      ["orgs", "create", "--name", DEMO_ORG_NAME, "--display", "Universal Components Demo Org", "--json", "--no-input"],
      { timeout: 15000 }
    );
    if (!createResult.ok) return { action: "error", error: createResult.stderr };
    const org = JSON.parse(createResult.stdout);
    if (connectionId) {
      auth0ApiCall("post", `organizations/${org.id}/enabled_connections`, {
        connection_id: connectionId,
        assign_membership_on_login: false,
        is_signup_enabled: false,
      });
    }
    return { action: "created", data: org };
  }

  // Check if connection is enabled
  if (connectionId) {
    const connCheck = auth0ApiCall("get", `organizations/${existing.id}/enabled_connections/${connectionId}`);
    if (!connCheck.ok || !connCheck.data?.connection) {
      auth0ApiCall("post", `organizations/${existing.id}/enabled_connections`, {
        connection_id: connectionId,
        assign_membership_on_login: false,
        is_signup_enabled: false,
      });
      return { action: "updated", data: existing };
    }
  }
  return { action: "skip", data: existing };
}

/**
 * Make sure the demo org has at least one member with the admin role so the
 * my-org components have someone they can render for. The function is
 * deliberately conservative:
 *
 *   - If any existing member already holds adminRoleId, we're done. We do
 *     NOT touch anyone's role assignments.
 *   - If no member has admin AND the agent didn't pass --admin-email /
 *     --admin-password, we return action "needs-admin". Bootstrap turns this
 *     into a `partial` JSON response so the agent can prompt the developer
 *     for credentials and re-run.
 *   - If no member has admin AND credentials were passed, we look up (or
 *     create) the user on the demo connection, add them to the org, and
 *     assign the admin role.
 *
 * The "create a fresh demo user" path mirrors the upstream reference script
 * in auth0-ui-components/examples/scripts/utils/members.mjs — the user is a
 * demo resource the skill owns, distinct from the developer's existing
 * tenant users.
 */
export function ensureOrgAdminMember(orgId, connectionName, adminRoleId, adminEmail, adminPassword) {
  if (!adminRoleId) return { action: "skip", reason: "no admin role id provided" };

  // Look for any member that already holds the admin role. We use the
  // members?fields=user_id,roles list endpoint so we can decide without
  // pulling every role for every member individually.
  const membersResult = auth0ApiCall(
    "get",
    `organizations/${orgId}/members?fields=user_id,email,roles&include_fields=true`,
  );
  if (membersResult.ok && Array.isArray(membersResult.data)) {
    const adminMember = membersResult.data.find((m) =>
      Array.isArray(m.roles) && m.roles.some((r) => r.id === adminRoleId),
    );
    if (adminMember) {
      return { action: "exists", data: { email: adminMember.email, user_id: adminMember.user_id } };
    }
  }

  // No admin found. If the agent didn't pass credentials, bail out with a
  // sentinel the bootstrap script can translate to a partial response.
  if (!adminEmail || !adminPassword) {
    return {
      action: "needs-admin",
      reason: "demo-org has no member with the admin role; pass --admin-email and --admin-password to create a dedicated demo admin user, or assign the admin role to an existing org member manually.",
    };
  }

  // Reuse an existing user on the demo connection if there is one; otherwise
  // create a fresh user. We don't reach across connections — a user with the
  // same email on a different connection would still get a new account here,
  // matching upstream behavior.
  let userId = null;
  let userEmail = adminEmail;
  const lookup = auth0Exec(
    ["users", "search-by-email", adminEmail, "--json", "--no-input"],
    { timeout: 15000 },
  );
  if (lookup.ok) {
    try {
      const candidates = JSON.parse(lookup.stdout) || [];
      const onConnection = candidates.find((u) =>
        u.email === adminEmail &&
        Array.isArray(u.identities) &&
        u.identities.some((i) => i.connection === connectionName),
      );
      if (onConnection) userId = onConnection.user_id;
    } catch { /* parsing failure → just fall through to create */ }
  }

  if (!userId) {
    const createArgs = [
      "users", "create",
      "--connection-name", connectionName,
      "--email", adminEmail,
      "--password", adminPassword,
      "--json", "--no-input",
    ];
    const createResult = auth0Exec(createArgs, { timeout: 20000 });
    if (!createResult.ok) {
      return {
        action: "error",
        error: `Failed to create admin user "${adminEmail}" on connection "${connectionName}": ${createResult.stderr || createResult.error || "unknown"}`,
      };
    }
    try {
      const user = JSON.parse(createResult.stdout);
      userId = user.user_id;
    } catch (e) {
      return { action: "error", error: `Could not parse created user response: ${e.message}` };
    }
  }

  if (!userId) return { action: "error", error: "Resolved user has no user_id" };

  // Add user as a member of the org. Idempotent — Auth0 returns 204 if
  // already a member.
  const addMember = auth0ApiCall("post", `organizations/${orgId}/members`, { members: [userId] });
  if (!addMember.ok) {
    // Don't fail outright if the user is already a member; the role
    // assignment below is what we really care about.
    const msg = String(addMember.error || "");
    if (!/already a member|already exists/i.test(msg)) {
      return { action: "error", error: `Failed to add ${userId} to org ${orgId}: ${msg}` };
    }
  }

  const assignRole = auth0ApiCall(
    "post",
    `organizations/${orgId}/members/${encodeURIComponent(userId)}/roles`,
    { roles: [adminRoleId] },
  );
  if (!assignRole.ok) {
    return { action: "error", error: `Failed to assign admin role to ${userId}: ${assignRole.error}` };
  }

  return { action: "created", data: { email: userEmail, user_id: userId } };
}

// --- Tenant config operations ---

export function ensureTenantSettings() {
  const current = auth0ApiCall("get", "tenants/settings");
  if (!current.ok) return { action: "error", error: current.error };

  const desired = {
    customize_mfa_in_postlogin_action: true,
    flags: { enable_client_connections: false },
  };

  const needsUpdate =
    current.data?.customize_mfa_in_postlogin_action !== true ||
    current.data?.flags?.enable_client_connections !== false;

  if (!needsUpdate) return { action: "skip" };
  const result = auth0ApiCall("patch", "tenants/settings", desired);
  return result.ok ? { action: "updated" } : { action: "error", error: result.error };
}

export function ensurePromptSettings() {
  const current = auth0ApiCall("get", "prompts");
  if (!current.ok) return { action: "error", error: current.error };
  if (current.data?.identifier_first === true) return { action: "skip" };
  const result = auth0ApiCall("patch", "prompts", { identifier_first: true });
  return result.ok ? { action: "updated" } : { action: "error", error: result.error };
}
