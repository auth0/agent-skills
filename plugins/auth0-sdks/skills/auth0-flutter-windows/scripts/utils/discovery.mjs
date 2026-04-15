/**
 * Discovers existing Auth0 Native applications and database connections.
 */

import { execa } from "execa"
import ora from "ora"

/**
 * Fetch existing Auth0 Native applications.
 *
 * @returns {Promise<{ apps: Array, connections: Array }>}
 */
export async function discoverExistingApps() {
  const spinner = ora("Discovering existing Auth0 apps").start()

  let apps = []
  let connections = []

  try {
    const { stdout: appsOut } = await execa("auth0", [
      "api", "get", "clients",
      "--no-input",
    ])
    const allApps = JSON.parse(appsOut)
    apps = (allApps.clients || allApps || []).filter((a) => a.app_type === "native")
    spinner.succeed(`Found ${apps.length} existing Native app(s)`)
  } catch (e) {
    spinner.warn(`Could not list apps: ${e.message}`)
  }

  try {
    const { stdout: connOut } = await execa("auth0", [
      "api", "get", "connections",
      "--no-input",
    ])
    connections = JSON.parse(connOut) || []
    connections = connections.filter((c) => c.strategy === "auth0")
  } catch {
    // Connections are optional — continue without them
  }

  return { apps, connections }
}

/**
 * Build a change plan based on discovered apps.
 *
 * @param {{ apps: Array, connections: Array }} discovered
 * @param {string} domain - Active tenant domain
 * @param {{ packageName: string }} projectConfig - Detected Flutter project config
 * @returns {{ client: object, connection: object }}
 */
export function buildChangePlan(discovered, domain, projectConfig) {
  const appName = `${projectConfig.packageName} (Flutter Windows)`
  const existingApp = discovered.apps?.find((a) => a.name === appName)

  const client = existingApp
    ? { action: "reuse", name: existingApp.name, clientId: existingApp.client_id }
    : { action: "create", name: appName }

  return { client, connection: null }
}

/**
 * Display the planned changes to the user.
 *
 * @param {{ client: object, connection: object }} plan
 */
export function displayChangePlan(plan) {
  console.log("\n  Planned Changes:\n")
  if (plan.client.action === "create") {
    console.log(`  [CREATE] Native Application: "${plan.client.name}"`)
    console.log(`           Callback URL: myapp://callback`)
    console.log(`           Logout URL:   myapp://callback`)
  } else {
    console.log(`  [REUSE]  Native Application: "${plan.client.name}" (${plan.client.clientId})`)
  }
  console.log(`  [WRITE]  lib/auth0_config.dart`)
  console.log("")
}
