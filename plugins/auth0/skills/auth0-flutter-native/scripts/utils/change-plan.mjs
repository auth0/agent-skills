/**
 * Builds and formats a change plan for display before execution.
 */
export function formatChangePlan(plan) {
  const lines = []
  lines.push("  Changes to apply:")
  lines.push("")

  if (plan.client.action === "create") {
    lines.push(`  [CREATE] Native Application: "${plan.client.name}"`)
    lines.push(`           Callback URLs: ${plan.client.callbacks.join(", ")}`)
    lines.push(`           Logout URLs:   ${plan.client.logoutUrls.join(", ")}`)
  }

  if (plan.connection?.action) {
    lines.push(`  [${plan.connection.action.toUpperCase()}] Database connection: Username-Password-Authentication`)
  }

  lines.push("")
  return lines.join("\n")
}
