import ora from "ora"

import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction } from "./change-plan.mjs"
import { checkNativeClientChanges } from "./clients.mjs"
import { checkDatabaseConnectionChanges } from "./connections.mjs"

export async function discoverExistingConnections() {
  const spinner = ora("Discovering existing connections").start()
  try {
    const connections = (await auth0ApiCall("get", "connections")) || []
    spinner.succeed("Discovered existing connections")
    return connections
  } catch {
    spinner.succeed("No existing connections found")
    return []
  }
}

export function buildChangePlan(connections, domain, androidConfig) {
  const clientPlan = checkNativeClientChanges(domain, androidConfig)
  // Connection check uses placeholder — real client_id assigned after creation
  const connectionPlan = checkDatabaseConnectionChanges(connections, "TO_BE_CREATED")

  return { client: clientPlan, connection: connectionPlan }
}

export function displayChangePlan(plan) {
  console.log("\n📋 Change Plan:\n")

  const items = [
    { name: "Native Client", ...plan.client },
    { name: "Database Connection", ...plan.connection },
  ]

  for (const item of items) {
    const icon =
      item.action === ChangeAction.CREATE ? "🆕" :
      item.action === ChangeAction.UPDATE ? "🔄" : "✅"
    const label =
      item.action === ChangeAction.CREATE ? "CREATE" :
      item.action === ChangeAction.UPDATE ? "UPDATE" : "SKIP  "

    let detail = ""
    if (item.summary) detail = ` (${item.summary})`
    else if (item.callbackUrl) detail = ` (callback: ${item.callbackUrl})`

    console.log(`  ${icon} [${label}] ${item.name || item.resource}${detail}`)
  }

  console.log("")
}
