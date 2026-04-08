import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

export function checkRegularClientChanges(domain, webConfig) {
  const { framework, port } = webConfig
  const callbackUrl = `http://localhost:${port}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Regular Web Client",
    name: `${framework}-web`,
    callbackUrl,
  })
}

export async function applyRegularClientChanges(changePlan) {
  const spinner = ora(`Creating Regular Web Client: ${changePlan.name}`).start()
  try {
    const createArgs = [
      "apps", "create",
      "--name", changePlan.name,
      "--type", "regular",
      "--callbacks", changePlan.callbackUrl,
      "--logout-urls", changePlan.callbackUrl,
      "--json",
      "--no-input",
    ]
    const { stdout } = await $({ timeout: 30000 })`auth0 ${createArgs}`
    const client = JSON.parse(stdout)
    spinner.succeed(`Created Regular Web Client: ${changePlan.name} (${client.client_id})`)
    return client
  } catch (e) {
    spinner.fail("Failed to create Regular Web Client")
    throw e
  }
}
