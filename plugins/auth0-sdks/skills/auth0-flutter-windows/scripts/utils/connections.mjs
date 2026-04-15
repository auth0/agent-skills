/**
 * Database connection management for Auth0 Flutter Windows Desktop.
 *
 * Ensures a Username-Password-Authentication database connection
 * is available and linked to the application.
 */

import { execa } from "execa"
import ora from "ora"
import { auth0ApiGet, auth0ApiPost, auth0ApiPatch } from "./auth0-api.mjs"

const DEFAULT_CONNECTION_NAME = "Username-Password-Authentication"

/**
 * Determine what connection changes are needed.
 *
 * @param {Array} existingConnections - Currently existing connections
 * @param {string} clientId - The Auth0 app client ID to link
 * @returns {{ action: 'create' | 'link' | 'none', connectionId?: string, name: string }}
 */
export function checkDatabaseConnectionChanges(existingConnections, clientId) {
  const existing = existingConnections.find((c) => c.name === DEFAULT_CONNECTION_NAME)

  if (!existing) {
    return { action: "create", name: DEFAULT_CONNECTION_NAME }
  }

  const alreadyLinked = existing.enabled_clients?.includes(clientId)
  if (alreadyLinked) {
    return { action: "none", connectionId: existing.id, name: existing.name }
  }

  return { action: "link", connectionId: existing.id, name: existing.name }
}

/**
 * Apply database connection changes.
 *
 * @param {{ action: string, connectionId?: string, name: string }} plan
 * @param {string} clientId - The Auth0 app client ID
 */
export async function applyDatabaseConnectionChanges(plan, clientId) {
  if (plan.action === "none") {
    const spinner = ora(`Database connection: ${plan.name}`).start()
    spinner.succeed(`Database connection already linked: ${plan.name}`)
    return
  }

  if (plan.action === "create") {
    const spinner = ora(`Creating database connection: ${plan.name}`).start()
    try {
      const { stdout } = await execa("auth0", [
        "api",
        "post",
        "connections",
        "--data",
        JSON.stringify({
          name: plan.name,
          strategy: "auth0",
          enabled_clients: [clientId],
        }),
        "--no-input",
      ])
      spinner.succeed(`Created database connection: ${plan.name}`)
    } catch (e) {
      spinner.fail(`Failed to create connection: ${e.message}`)
    }
    return
  }

  if (plan.action === "link") {
    const spinner = ora(`Linking connection to app`).start()
    try {
      await execa("auth0", [
        "api",
        "patch",
        `connections/${plan.connectionId}`,
        "--data",
        JSON.stringify({ enabled_clients: [clientId] }),
        "--no-input",
      ])
      spinner.succeed(`Linked connection: ${plan.name}`)
    } catch (e) {
      spinner.warn(`Could not link connection: ${e.message}`)
    }
  }
}
