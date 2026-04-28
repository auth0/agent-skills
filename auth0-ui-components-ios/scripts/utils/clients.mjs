import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

export function checkNativeClientChanges(domain, swiftConfig) {
  const { bundleId } = swiftConfig
  const callbackUrl = `${bundleId}://${domain}/ios/${bundleId}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Native Client",
    name: `${bundleId}-ios`,
    callbackUrl,
  })
}

export async function applyNativeClientChanges(changePlan) {
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
