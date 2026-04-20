#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateExpoProject,
  checkDevClient,
  installDevClient,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import {
  applyDatabaseConnectionChanges,
  checkDatabaseConnectionChanges,
} from "./utils/connections.mjs"
import { writeAppJsonConfig } from "./utils/app-json-writer.mjs"
import { confirmWithUser, selectOptionFromList } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Expo Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateExpoProject(projectPath)

  // Check for expo-dev-client
  const hasDevClient = checkDevClient(projectPath)
  if (!hasDevClient) {
    console.log("\n  react-native-auth0 requires a custom dev client (expo-dev-client).")
    console.log("  Expo Go is not supported.\n")

    const choice = await selectOptionFromList(
      "expo-dev-client is not installed. How would you like to proceed?",
      [
        { name: "Install it for me (npx expo install expo-dev-client)", value: "install" },
        { name: "I'll set it up myself — skip and continue", value: "skip" },
      ]
    )

    if (choice === "install") {
      await installDevClient(projectPath)
    } else {
      console.log("\n  Skipping expo-dev-client install. Remember to install it before building.\n")
    }
  }

  // Discover + plan
  const connections = await discoverExistingConnections()
  const plan = buildChangePlan(connections, domain, config)
  displayChangePlan(plan)

  // Confirm
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n  Aborted by user.\n")
    process.exit(0)
  }

  // Execute
  console.log("")
  const client = await applyNativeClientChanges(plan.client)

  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  await writeAppJsonConfig(domain, config.customScheme, config.appJsonPath)

  // Summary
  console.log("\n  Auth0 Expo Setup Complete\n")
  console.log(`  Domain:          ${domain}`)
  console.log(`  Client ID:       ${client.client_id}`)
  console.log(`  Custom Scheme:   ${config.customScheme}`)
  console.log(`  Bundle ID (iOS): ${config.bundleIdentifier || "not set"}`)
  console.log(`  Package (Android): ${config.androidPackage || "not set"}`)
  console.log("")
  console.log("  Remaining steps:")
  console.log(`  1. Add Auth0Provider to your app with domain="${domain}" clientId="${client.client_id}"`)
  console.log(`  2. Add callback URLs to Auth0 Dashboard:`)
  if (config.bundleIdentifier) {
    console.log(`     ${config.customScheme}://${domain}/ios/${config.bundleIdentifier}/callback`)
  }
  if (config.androidPackage) {
    console.log(`     ${config.customScheme}://${domain}/android/${config.androidPackage}/callback`)
  }
  console.log(`  3. Run: npx expo prebuild --clean`)
  console.log(`  4. Run: npx expo run:ios  OR  npx expo run:android`)
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
