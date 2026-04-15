/**
 * Auth0 Native application creation for Flutter Windows Desktop.
 *
 * Creates a Native app with the correct callback/logout URLs for the
 * custom URL scheme flow used on Windows Desktop.
 */

import { execa } from "execa"
import ora from "ora"

const callbackUrl = "myapp://callback"
const logoutUrl = "myapp://callback"

/**
 * Create or reuse an Auth0 Native application.
 *
 * @param {{ action: 'create' | 'reuse', name?: string, clientId?: string }} plan
 * @returns {Promise<{ client_id: string, name: string }>}
 */
export async function applyNativeClientChanges(plan) {
  if (plan.action === "reuse") {
    const spinner = ora(`Reusing existing app: ${plan.name}`).start()
    spinner.succeed(`Using existing Native app: ${plan.name} (${plan.clientId})`)
    return { client_id: plan.clientId, name: plan.name }
  }

  const spinner = ora(`Creating Auth0 Native app: ${plan.name}`).start()
  try {
    const { stdout } = await execa("auth0", [
      "apps",
      "create",
      "--name", plan.name,
      "--type", "native",
      "--auth-method", "none",
      "--callbacks", callbackUrl,
      "--logout-urls", logoutUrl,
      "--json",
      "--no-input",
    ])

    const app = JSON.parse(stdout)
    spinner.succeed(`Created Native app: ${app.name} (${app.client_id})`)
    console.log(`  Callback URL: ${callbackUrl}`)
    console.log(`  Logout URL:   ${logoutUrl}`)
    console.log(`  Note: Update these URLs in Auth0 Dashboard once you choose your custom scheme.\n`)
    return app
  } catch (e) {
    spinner.fail("Failed to create Auth0 Native app")
    console.error(`  ${e.message}\n`)
    process.exit(1)
  }
}
