import ora from "ora"

import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

const DB_CONNECTION = "Username-Password-Authentication"

export function checkDatabaseConnectionChanges(existingConnections, clientId) {
  const existing = existingConnections.find((c) => c.name === DB_CONNECTION)

  if (!existing) {
    return createChangeItem(ChangeAction.CREATE, {
      resource: "Database Connection",
      name: DB_CONNECTION,
      enabledClients: [clientId],
    })
  }

  const enabledClients = existing.enabled_clients || []
  if (!enabledClients.includes(clientId)) {
    return createChangeItem(ChangeAction.UPDATE, {
      resource: "Database Connection",
      name: DB_CONNECTION,
      existing,
      summary: "Enable client on connection",
    })
  }

  return createChangeItem(ChangeAction.SKIP, {
    resource: "Database Connection",
    name: DB_CONNECTION,
    existing,
  })
}

export async function applyDatabaseConnectionChanges(changePlan, clientId) {
  if (changePlan.action === ChangeAction.SKIP) {
    const spinner = ora("Database Connection is up to date: " + changePlan.name).start()
    spinner.succeed()
    return changePlan.existing
  }

  if (changePlan.action === ChangeAction.CREATE) {
    const spinner = ora("Creating Database Connection: " + DB_CONNECTION).start()
    try {
      const connectionData = {
        strategy: "auth0",
        name: DB_CONNECTION,
        enabled_clients: [clientId],
      }
      const connection = await auth0ApiCall("post", "connections", connectionData)
      spinner.succeed("Created Database Connection: " + DB_CONNECTION)
      return connection
    } catch (e) {
      spinner.fail("Failed to create Database Connection")
      throw e
    }
  }

  if (changePlan.action === ChangeAction.UPDATE) {
    const spinner = ora("Updating Database Connection: " + DB_CONNECTION).start()
    try {
      const existing = changePlan.existing
      const updatedClients = [...(existing.enabled_clients || []), clientId]
      await auth0ApiCall("patch", "connections/" + existing.id, {
        enabled_clients: updatedClients,
      })
      spinner.succeed("Updated " + DB_CONNECTION + ": enabled client " + clientId)
      return { ...existing, enabled_clients: updatedClients }
    } catch (e) {
      spinner.fail("Failed to update Database Connection")
      throw e
    }
  }

  throw new Error("Unknown change action: " + changePlan.action)
}
