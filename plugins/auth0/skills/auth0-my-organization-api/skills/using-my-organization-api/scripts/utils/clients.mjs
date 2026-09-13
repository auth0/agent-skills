import { auth0ApiCall, auth0Exec } from "./auth0-api.mjs";
import { MYORG_API_SCOPES } from "./resources.mjs";

const APP_BASE_URL = "http://localhost";

function getClientName(framework) {
  return framework === "nextjs"
    ? "Universal Components Demo (Next.js)"
    : "Universal Components Demo (React SPA)";
}

function getAppType(framework) {
  return framework === "nextjs" ? "regular_web" : "spa";
}

export function ensureClient(clients, domain, framework, port, connectionProfileId, userAttributeProfileId, features, myAccountApiScopes) {
  const clientName = getClientName(framework);
  const existing = clients.find((c) => c.name === clientName);
  const baseUrl = `${APP_BASE_URL}:${port}`;
  const appType = getAppType(framework);
  const callbackUrl = framework === "nextjs" ? `${baseUrl}/auth/callback` : baseUrl;
  const tokenEndpointAuth = framework === "nextjs" ? "client_secret_post" : "none";

  const refreshTokenPolicies = [];
  if (features.enableMyOrg) {
    refreshTokenPolicies.push({ audience: `https://${domain}/my-org/`, scope: MYORG_API_SCOPES });
  }
  if (features.enableMyAccount && myAccountApiScopes.length > 0) {
    refreshTokenPolicies.push({ audience: `https://${domain}/me/`, scope: myAccountApiScopes });
  }

  if (!existing) {
    const clientData = {
      name: clientName,
      description: "Client for Auth0 Universal Components integration.",
      callbacks: [callbackUrl],
      allowed_logout_urls: [baseUrl],
      web_origins: appType === "spa" ? [baseUrl] : [],
      app_type: appType,
      oidc_conformant: true,
      is_first_party: true,
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: tokenEndpointAuth,
      jwt_configuration: { alg: "RS256", lifetime_in_seconds: 36000, secret_encoded: false },
      refresh_token: {
        expiration_type: "expiring",
        rotation_type: "rotating",
        token_lifetime: 31557600,
        idle_token_lifetime: 2592000,
        leeway: 0,
        infinite_token_lifetime: false,
        infinite_idle_token_lifetime: false,
        policies: refreshTokenPolicies,
      },
    };

    if (features.enableMyOrg) {
      clientData.organization_require_behavior = "post_login_prompt";
      clientData.organization_usage = "require";
      clientData.my_organization_configuration = {
        connection_profile_id: connectionProfileId,
        user_attribute_profile_id: userAttributeProfileId,
        connection_deletion_behavior: "allow_if_empty",
        allowed_strategies: ["pingfederate", "adfs", "waad", "google-apps", "okta", "oidc", "samlp"],
      };
    }

    const result = auth0ApiCall("post", "clients", clientData);
    if (!result.ok) return { action: "error", error: result.error };

    // The CLI may return the created client or empty response
    const clientId = result.data?.client_id;
    if (!clientId) {
      // CLI returned success but no data — check if client was actually created
      const listResult = auth0ApiCall("get", `clients?fields=client_id,name,client_secret&include_fields=true`);
      if (listResult.ok && Array.isArray(listResult.data)) {
        const created = listResult.data.find((c) => c.name === clientName);
        if (created) return { action: "created", data: created };
      }
      return { action: "error", error: "Client creation failed silently. This usually means the tenant has reached its application limit. Delete unused applications in Auth0 Dashboard > Applications, then re-run." };
    }

    // Fetch full client to get client_secret
    const full = auth0ApiCall("get", `clients/${clientId}`);
    return { action: "created", data: full.ok ? full.data : result.data };
  }

  // Check if updates are needed
  const full = auth0ApiCall("get", `clients/${existing.client_id}`);
  const client = full.ok ? full.data : existing;

  const updates = {};
  let needsUpdate = false;

  if (!client.callbacks?.includes(callbackUrl)) {
    updates.callbacks = [...(client.callbacks || []), callbackUrl];
    needsUpdate = true;
  }
  if (!client.allowed_logout_urls?.includes(baseUrl)) {
    updates.allowed_logout_urls = [...(client.allowed_logout_urls || []), baseUrl];
    needsUpdate = true;
  }
  if (appType === "spa" && !client.allowed_web_origins?.includes(baseUrl)) {
    updates.web_origins = [...(client.allowed_web_origins || []), baseUrl];
    needsUpdate = true;
  }
  if (client.app_type !== appType) {
    updates.app_type = appType;
    updates.token_endpoint_auth_method = tokenEndpointAuth;
    needsUpdate = true;
  }
  if (features.enableMyOrg) {
    if (client.organization_usage !== "require" || client.organization_require_behavior !== "post_login_prompt") {
      updates.organization_require_behavior = "post_login_prompt";
      updates.organization_usage = "require";
      needsUpdate = true;
    }
    if (!client.my_organization_configuration ||
        client.my_organization_configuration.connection_profile_id !== connectionProfileId ||
        client.my_organization_configuration.user_attribute_profile_id !== userAttributeProfileId) {
      updates.my_organization_configuration = {
        connection_profile_id: connectionProfileId,
        user_attribute_profile_id: userAttributeProfileId,
        connection_deletion_behavior: "allow_if_empty",
        allowed_strategies: ["pingfederate", "adfs", "waad", "google-apps", "okta", "oidc", "samlp"],
      };
      needsUpdate = true;
    }
  }

  // Check refresh token policies
  const existingPolicies = client.refresh_token?.policies || [];
  for (const desired of refreshTokenPolicies) {
    const hasPolicy = existingPolicies.some(
      (p) => p.audience === desired.audience && JSON.stringify(p.scope?.slice().sort()) === JSON.stringify(desired.scope.slice().sort())
    );
    if (!hasPolicy) {
      const filtered = existingPolicies.filter((p) => p.audience !== desired.audience);
      updates.refresh_token = { ...(client.refresh_token || {}), rotation_type: "rotating", policies: [...filtered, ...refreshTokenPolicies] };
      needsUpdate = true;
      break;
    }
  }

  if (!needsUpdate) return { action: "skip", data: client };

  const patchResult = auth0ApiCall("patch", `clients/${client.client_id}`, updates);
  if (!patchResult.ok) return { action: "error", error: patchResult.error };
  const updated = auth0ApiCall("get", `clients/${client.client_id}`);
  return { action: "updated", data: updated.ok ? updated.data : client };
}

// --- Client Grant operations ---

export function ensureClientGrant(clientId, audience, scopes, clientGrants) {
  const existing = clientGrants.find((g) => g.client_id === clientId && g.audience === audience);
  if (!existing) {
    const result = auth0ApiCall("post", "client-grants", {
      client_id: clientId,
      audience,
      scope: scopes,
      subject_type: "user",
    });
    return result.ok ? { action: "created", data: result.data } : { action: "error", error: result.error };
  }
  const existingScopes = existing.scope || [];
  const missing = scopes.filter((s) => !existingScopes.includes(s));
  if (missing.length === 0) return { action: "skip", data: existing };
  const result = auth0ApiCall("patch", `client-grants/${existing.id}`, {
    scope: [...existingScopes, ...missing],
  });
  return result.ok ? { action: "updated", data: result.data || existing } : { action: "error", error: result.error };
}
