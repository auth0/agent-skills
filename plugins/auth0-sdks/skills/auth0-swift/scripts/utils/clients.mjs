import { $ } from "execa"
import ora from "ora"
import { ChangeAction, createChangeItem } from "./change-plan.mjs"
import { auth0ApiCall } from "./auth0-api.mjs"
import { getInputFromUser } from "./helpers.mjs"

/**
 * Build the change plan item for a Native Auth0 application (iOS/macOS).
 * Registers both HTTPS (Universal Links) and custom scheme callback URLs.
 */
export function checkNativeClientChanges(domain, swiftConfig) {
  const { bundleId } = swiftConfig
  const httpsCallback = `https://${domain}/ios/${bundleId}/callback`
  const customCallback = `${bundleId}://${domain}/ios/${bundleId}/callback`

  return createChangeItem(ChangeAction.CREATE, {
    resource: "Native Client",
    name: `${bundleId}-ios`,
    httpsCallback,
    customCallback,
  })
}

/**
 * Create a Native application in Auth0 via the CLI.
 * Registers both HTTPS and custom scheme callback + logout URLs.
 * Returns the created client object (includes client_id).
 */
export async function applyNativeClientChanges(changePlan) {
  if (changePlan.action !== ChangeAction.CREATE) {
    return { client_id: changePlan.clientId }
  }

  const spinner = ora(`Creating Native Client: ${changePlan.name}`).start()
  try {
    const callbacks = `${changePlan.httpsCallback},${changePlan.customCallback}`
    const createArgs = [
      "apps", "create",
      "--name", changePlan.name,
      "--type", "native",
      "--auth-method", "none",
      "--callbacks", callbacks,
      "--logout-urls", callbacks,
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

/**
 * Set iOS Device Settings (Team ID + Bundle ID) on the Auth0 application.
 * Required for Auth0 to host the apple-app-site-association file for Universal Links.
 * If teamId is not available from the project, prompts the user.
 */
export async function applyDeviceSettings(clientId, teamId, bundleId) {
  const resolvedTeamId = teamId || await getInputFromUser(
    "  Apple Team ID not found in project. Enter it (developer.apple.com → Account → Membership, 10 characters):"
  )

  if (!resolvedTeamId) {
    const spinner = ora("Skipping Device Settings").start()
    spinner.warn("No Team ID provided — set it manually in Auth0 Dashboard → App Settings → Advanced → Device Settings")
    return null
  }

  const spinner = ora("Configuring Universal Links device settings").start()
  try {
    await auth0ApiCall("patch", `applications/${clientId}`, {
      mobile: { ios: { team_id: resolvedTeamId, app_bundle_identifier: bundleId } },
    })
    spinner.succeed(`Configured Device Settings: Team ID ${resolvedTeamId}, Bundle ${bundleId}`)
    return resolvedTeamId
  } catch (e) {
    spinner.fail("Failed to configure Device Settings")
    throw e
  }
}
