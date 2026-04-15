/**
 * Change plan display utilities.
 * Shared helper for presenting planned Auth0 configuration changes to the user.
 */

/**
 * Display a formatted change plan summary.
 * Called by bootstrap.mjs before confirming with the user.
 *
 * @param {object} plan - The change plan object
 */
export function displayChangePlan(plan) {
  console.log("\n  Planned Changes:\n")

  if (plan.client) {
    if (plan.client.action === "create") {
      console.log(`  [CREATE] Native Application: "${plan.client.name}"`)
      console.log(`           Callback URL: myapp://callback`)
      console.log(`           Logout URL:   myapp://callback`)
    } else if (plan.client.action === "reuse") {
      console.log(`  [REUSE]  Native Application: "${plan.client.name}" (${plan.client.clientId})`)
    }
  }

  if (plan.connection) {
    if (plan.connection.action === "create") {
      console.log(`  [CREATE] Database Connection: "${plan.connection.name}"`)
    } else if (plan.connection.action === "link") {
      console.log(`  [LINK]   Database Connection: "${plan.connection.name}"`)
    } else if (plan.connection.action === "none") {
      console.log(`  [OK]     Database Connection: "${plan.connection.name}" (already linked)`)
    }
  }

  console.log(`  [WRITE]  lib/auth0_config.dart`)
  console.log("")
}
