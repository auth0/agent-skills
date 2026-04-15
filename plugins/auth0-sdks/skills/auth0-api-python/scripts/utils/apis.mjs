import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"

/**
 * Build change plan for Auth0 API resource server creation
 * @param {string} domain - Auth0 tenant domain
 * @param {{ framework: string }} apiConfig
 * @returns {object} change item
 */
export function checkApiChanges(domain, apiConfig) {
  const { framework } = apiConfig
  const identifier = `https://api.example.com`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "API",
    name: `${framework}-python-api`,
    identifier,
  })
}

/**
 * Apply API change — create Auth0 API (resource server)
 * @param {object} changePlan
 * @returns {Promise<object>} created API object
 */
export async function applyApiChanges(changePlan) {
  const spinner = ora(`Creating API: ${changePlan.name}`).start()
  try {
    const createArgs = [
      "apis",
      "create",
      "--name",
      changePlan.name,
      "--identifier",
      changePlan.identifier,
      "--json",
      "--no-input",
    ]
    const { stdout } = await $({ timeout: 30000 })`auth0 ${createArgs}`
    const api = JSON.parse(stdout)
    spinner.succeed(`Created API: ${changePlan.name} (${api.identifier})`)
    return api
  } catch (e) {
    spinner.fail("Failed to create API")
    throw e
  }
}
