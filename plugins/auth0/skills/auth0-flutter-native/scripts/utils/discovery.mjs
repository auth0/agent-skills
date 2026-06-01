import { $ } from "execa"
import ora from "ora"

/**
 * Discover existing Auth0 connections for the active tenant.
 */
export async function discoverExistingConnections() {
  const spinner = ora("Discovering existing connections").start()

  try {
    const args = ["api", "get", "connections", "--no-input"]
    const { stdout } = await $({ timeout: 30000 })`auth0 ${args}`
    const connections = stdout ? JSON.parse(stdout) : []
    spinner.succeed(`Found ${connections.length} existing connection(s)`)
    return connections
  } catch (e) {
    spinner.warn("Could not discover connections — will create new ones")
    return []
  }
}

/**
 * Build the platform-specific callback/logout URLs for a Native app.
 */
export function buildCallbackUrls(domain, config) {
  const urls = []
  if (config.hasAndroid && config.packageName) {
    urls.push(`https://${domain}/android/${config.packageName}/callback`)
  }
  if (config.hasIos && config.bundleId) {
    urls.push(`https://${domain}/ios/${config.bundleId}/callback`)
  }
  return urls
}

/**
 * Build a change plan based on discovered state and project config.
 */
export function buildChangePlan(connections, domain, config) {
  const callbackUrls = buildCallbackUrls(domain, config)

  return {
    client: {
      action: "create",
      name: config.appName || "Flutter Mobile App",
      callbacks: callbackUrls,
      logoutUrls: callbackUrls,
    },
    connection: null, // Determined after client creation
    domain,
    config,
  }
}

/**
 * Display the change plan to the user.
 */
export function displayChangePlan(plan) {
  console.log("")
  console.log("  Planned changes:")
  console.log("")
  console.log(`  [CREATE] Native Application: "${plan.client.name}"`)
  console.log(`           Callback URLs:  ${plan.client.callbacks.join(", ") || "(none — package/bundle id not detected)"}`)
  console.log(`           Logout URLs:    ${plan.client.logoutUrls.join(", ") || "(none)"}`)
  console.log(`  [SETUP]  Database connection: Username-Password-Authentication`)
  if (plan.config.hasAndroid && plan.config.gradlePath) {
    console.log(`  [WRITE]  manifestPlaceholders → android/app/build.gradle`)
  }
  console.log("")
}
