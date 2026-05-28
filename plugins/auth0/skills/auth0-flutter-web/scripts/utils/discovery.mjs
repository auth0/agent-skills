import { $ } from "execa"
import ora from "ora"

/**
 * Discover existing Auth0 connections for the active tenant.
 */
export async function discoverExistingConnections() {
  const spinner = ora("Discovering existing connections").start()

  try {
    const args = ["api", "get", "connections", "--no-input"]
    const { stdout } = await $({ timeout: 30000 })`auth0 ${args}`
    const connections = stdout ? JSON.parse(stdout) : []
    spinner.succeed(`Found ${connections.length} existing connection(s)`)
    return connections
  } catch (e) {
    spinner.warn("Could not discover connections — will create new ones")
    return []
  }
}

/**
 * Build a change plan based on discovered state and project config.
 */
export function buildChangePlan(connections, domain, config) {
  const appUrl = `http://localhost:${config.port}`

  return {
    client: {
      action: "create",
      name: config.appName || "Flutter Web App",
      callbacks: [appUrl],
      logoutUrls: [appUrl],
      webOrigins: [appUrl],
    },
    connection: null, // Determined after client creation
    domain,
    config,
  }
}

/**
 * Display the change plan to the user.
 */
export function displayChangePlan(plan) {
  console.log("")
  console.log("  Planned changes:")
  console.log("")
  console.log(`  [CREATE] Single Page Application: "${plan.client.name}"`)
  console.log(`           Callback URLs:  ${plan.client.callbacks.join(", ")}`)
  console.log(`           Logout URLs:    ${plan.client.logoutUrls.join(", ")}`)
  console.log(`           Web Origins:    ${plan.client.webOrigins.join(", ")}`)
  console.log(`  [SETUP]  Database connection: Username-Password-Authentication`)
  console.log(`  [ENABLE] Refresh token rotation`)
  console.log(`  [WRITE]  Auth0 SPA JS script → web/index.html`)
  console.log("")
}
