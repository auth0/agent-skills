import { auth0ApiCall, auth0Exec } from "./auth0-api.mjs";

const CLI_TIMEOUT = 30000;

export function discoverExistingResources(domain) {
  const resources = {
    clients: [],
    roles: [],
    connections: [],
    resourceServers: [],
    clientGrants: [],
    connectionProfiles: [],
    userAttributeProfiles: [],
    orgs: [],
  };

  const errors = [];

  // Clients
  const clients = auth0Exec(["apps", "list", "--json", "--no-input"], { timeout: CLI_TIMEOUT });
  if (clients.ok && clients.stdout) {
    try { resources.clients = JSON.parse(clients.stdout); } catch { errors.push("clients: parse error"); }
  } else {
    errors.push(`clients: ${clients.stderr || "empty response"}`);
  }

  // Roles
  const roles = auth0Exec(["roles", "list", "--json", "--no-input"], { timeout: CLI_TIMEOUT });
  if (roles.ok && roles.stdout) {
    try { resources.roles = JSON.parse(roles.stdout); } catch { errors.push("roles: parse error"); }
  } else {
    errors.push(`roles: ${roles.stderr || "empty response"}`);
  }

  // Connections
  const conns = auth0ApiCall("get", "connections");
  if (conns.ok) {
    resources.connections = Array.isArray(conns.data) ? conns.data : [];
  } else {
    errors.push(`connections: ${conns.error}`);
  }

  // Resource servers
  const apis = auth0Exec(["apis", "list", "--json", "--no-input"], { timeout: CLI_TIMEOUT });
  if (apis.ok && apis.stdout) {
    try { resources.resourceServers = JSON.parse(apis.stdout); } catch { errors.push("apis: parse error"); }
  } else {
    errors.push(`apis: ${apis.stderr || "empty response"}`);
  }

  // Client grants
  const grants = auth0ApiCall("get", "client-grants");
  if (grants.ok) {
    resources.clientGrants = Array.isArray(grants.data) ? grants.data : [];
  } else {
    errors.push(`client-grants: ${grants.error}`);
  }

  // Connection profiles
  const profiles = auth0ApiCall("get", "connection-profiles");
  if (profiles.ok && profiles.data) {
    resources.connectionProfiles = profiles.data.connection_profiles || [];
  }

  // User attribute profiles
  const uap = auth0ApiCall("get", "user-attribute-profiles");
  if (uap.ok && uap.data) {
    resources.userAttributeProfiles = uap.data.user_attribute_profiles || [];
  }

  // Organizations
  const orgs = auth0Exec(["orgs", "list", "--json", "--no-input"], { timeout: CLI_TIMEOUT });
  if (orgs.ok && orgs.stdout) {
    try { resources.orgs = JSON.parse(orgs.stdout); } catch { errors.push("orgs: parse error"); }
  }

  return { resources, errors };
}
