import ora from "ora"
import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction } from "./change-plan.mjs"
import { checkNativeClientChanges } from "./clients.mjs"
import { checkDatabaseConnectionChanges } from "./connections.mjs"

/**
 * Fetch existing connections from the Auth0 tenant.
 */
export async function discoverExistingConnections() {
  const spinner = ora("Discovering existing connections").start()
  try {
    const connections = (await auth0ApiCall("get", "connections")) || []
    spinner.succeed("Discovered existing connections")
    return connections
  } catch (e) {
    const msg = e.message || String(e)
    if (msg.includes("404") || msg.includes("Not Found")) {
      spinner.succeed("No existing connections found")
      return []
    }
    spinner.fail("Failed to discover connections")
    throw e
  }
}

/**
 * Build a change plan for a Swift (iOS/macOS) project.
 * Creates plan items for: Native Client + Database Connection.
 */
export function buildChangePlan(connections, domain, platformConfig) {
  const clientPlan = checkNativeClientChanges(domain, platformConfig)
  // Connection will be linked after client is created; use placeholder for now
  const connectionPlan = checkDatabaseConnectionChanges(connections, "TO_BE_CREATED")
  return { client: clientPlan, connection: connectionPlan }
}

/**
 * Print the change plan to the console for user review.
 */
export function displayChangePlan(plan) {
  console.log("\n  Change Plan:\n")

  const items = [
    { name: "Native Client", ...plan.client },
    { name: "Database Connection", ...plan.connection },
  ]

  for (const item of items) {
    const icon =
      item.action === ChangeAction.CREATE ? "+" :
      item.action === ChangeAction.UPDATE ? "~" : "="
    const label =
      item.action === ChangeAction.CREATE ? "CREATE" :
      item.action === ChangeAction.UPDATE ? "UPDATE" : "SKIP  "

    let detail = ""
    if (item.summary) detail = ` (${item.summary})`
    else if (item.httpsCallback) detail = ` (callbacks: ${item.httpsCallback}, ${item.customCallback})`
    else if (item.callbackUrl) detail = ` (callback: ${item.callbackUrl})`

    console.log(`  ${icon} [${label}] ${item.name || item.resource}${detail}`)
  }

  console.log("")
}
