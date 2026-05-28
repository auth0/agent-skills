import { $ } from "execa"
import ora from "ora"
import { auth0ApiCall } from "./auth0-api.mjs"

/**
 * Create a Single Page Application in Auth0.
 */
export async function applySPAClientChanges(clientPlan) {
  const spinner = ora("Creating Single Page Application").start()

  try {
    const createArgs = [
      "apps", "create",
      "--name", clientPlan.name,
      "--type", "spa",
      "--callbacks", clientPlan.callbacks.join(","),
      "--logout-urls", clientPlan.logoutUrls.join(","),
      "--web-origins", clientPlan.webOrigins.join(","),
      "--no-input",
      "--json",
    ]

    const { stdout } = await $({ timeout: 30000 })`auth0 ${createArgs}`
    const client = JSON.parse(stdout)

    spinner.succeed(`Created SPA: ${client.name} (${client.client_id})`)
    return client
  } catch (e) {
    spinner.fail(`Failed to create application: ${e.message}`)
    throw e
  }
}

/**
 * Enable refresh token rotation for a SPA client.
 */
export async function enableRefreshTokenRotation(clientId) {
  const spinner = ora("Enabling refresh token rotation").start()

  try {
    await auth0ApiCall("patch", `applications/${clientId}`, {
      refresh_token: {
        rotation_type: "rotating",
        expiration_type: "expiring",
        token_lifetime: 2592000,
        idle_token_lifetime: 1296000,
      },
    })

    spinner.succeed("Refresh token rotation enabled")
  } catch (e) {
    spinner.warn(`Could not enable refresh token rotation: ${e.message}`)
  }
}
