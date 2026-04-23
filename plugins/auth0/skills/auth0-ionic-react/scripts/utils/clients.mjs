import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

export function checkNativeClientChanges(domain, config) {
  const { packageId } = config
  const callbackUrl = `${packageId}://${domain}/capacitor/${packageId}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Native Client",
    name: `${packageId}-ionic-react`,
    callbackUrl,
    origins: "capacitor://localhost, http://localhost",
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
      "--origins", changePlan.origins,
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
