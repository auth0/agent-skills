import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

/**
 * Build the change plan item for a Native Auth0 application (iOS/macOS).
 * Callback URL uses the bundle ID as the custom URL scheme.
 */
export function checkNativeClientChanges(domain, swiftConfig) {
  const { bundleId } = swiftConfig
  const callbackUrl = `${bundleId}://${domain}/ios/${bundleId}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Native Client",
    name: `${bundleId}-ios`,
    callbackUrl,
  })
}

/**
 * Create a Native application in Auth0 via the CLI.
 * Returns the created client object (includes client_id).
 */
export async function applyNativeClientChanges(changePlan) {
  if (changePlan.action !== ChangeAction.CREATE) {
    return { client_id: changePlan.clientId }
  }

  const spinner = ora(`Creating Native Client: ${changePlan.name}`).start()
  try {
    const createArgs = [
      "apps", "create",
      "--name", changePlan.name,
      "--type", "native",
      "--auth-method", "none",
      "--callbacks", changePlan.callbackUrl,
      "--logout-urls", changePlan.callbackUrl,
      "--json",
      "--no-input",
    ]
    const { stdout } = await $({ timeout: 30000 })`auth0 ${createArgs}`
    const client = JSON.parse(stdout)
    spinner.succeed(`Created Native Client: ${changePlan.name} (${client.client_id})`)
    return client
  } catch (e) {
    spinner.fail("Failed to create Native Client")
    throw e
  }
}
