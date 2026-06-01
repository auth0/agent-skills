import { $ } from "execa"
import ora from "ora"

/**
 * Create a Native application in Auth0.
 */
export async function applyNativeClientChanges(clientPlan) {
  const spinner = ora("Creating Native application").start()

  try {
    const createArgs = [
      "apps", "create",
      "--name", clientPlan.name,
      "--type", "native",
      "--callbacks", clientPlan.callbacks.join(","),
      "--logout-urls", clientPlan.logoutUrls.join(","),
      "--no-input",
      "--json",
    ]

    const { stdout } = await $({ timeout: 30000 })`auth0 ${createArgs}`
    const client = JSON.parse(stdout)

    spinner.succeed(`Created Native app: ${client.name} (${client.client_id})`)
    return client
  } catch (e) {
    spinner.fail(`Failed to create application: ${e.message}`)
    throw e
  }
}
