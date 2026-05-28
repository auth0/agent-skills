import { $ } from "execa"
import ora from "ora"

/**
 * Check if a database connection needs to be created or updated.
 */
export function checkDatabaseConnectionChanges(connections, clientId) {
  const dbConnection = connections.find(
    (c) => c.name === "Username-Password-Authentication" && c.strategy === "auth0"
  )

  if (!dbConnection) {
    return { action: "create", clientId }
  }

  const alreadyEnabled = dbConnection.enabled_clients?.includes(clientId)
  if (alreadyEnabled) {
    return { action: "none", connectionId: dbConnection.id }
  }

  return {
    action: "enable",
    connectionId: dbConnection.id,
    clientId,
    existingClients: dbConnection.enabled_clients || [],
  }
}

/**
 * Apply database connection changes (create or enable for client).
 */
export async function applyDatabaseConnectionChanges(plan, clientId) {
  if (plan.action === "none") return

  const spinner = ora("Configuring database connection").start()

  try {
    if (plan.action === "create") {
      const createArgs = [
        "api", "post", "connections",
        "--data", JSON.stringify({
          name: "Username-Password-Authentication",
          strategy: "auth0",
          enabled_clients: [clientId],
        }),
        "--no-input",
      ]
      await $({ timeout: 30000 })`auth0 ${createArgs}`
      spinner.succeed("Created database connection: Username-Password-Authentication")
    } else if (plan.action === "enable") {
      const updatedClients = [...plan.existingClients, clientId]
      const updateArgs = [
        "api", "patch", `connections/${plan.connectionId}`,
        "--data", JSON.stringify({ enabled_clients: updatedClients }),
        "--no-input",
      ]
      await $({ timeout: 30000 })`auth0 ${updateArgs}`
      spinner.succeed("Enabled database connection for new application")
    }
  } catch (e) {
    spinner.fail(`Database connection setup failed: ${e.message}`)
    throw e
  }
}
