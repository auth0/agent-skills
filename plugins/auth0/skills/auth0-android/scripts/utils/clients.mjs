import { $ } from "execa"
import ora from "ora"

import { auth0ApiCall } from "./auth0-api.mjs"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

export const DEFAULT_SCHEME = "demo"

export function checkNativeClientChanges(domain, androidConfig) {
  const { packageName } = androidConfig
  const callbackUrl = `${DEFAULT_SCHEME}://${domain}/android/${packageName}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Native Client",
    name: `${packageName}-android`,
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
