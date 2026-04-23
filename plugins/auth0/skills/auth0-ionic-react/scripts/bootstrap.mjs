#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateIonicReactProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeEnvFile } from "./utils/env-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Ionic React (Capacitor) Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateIonicReactProject(projectPath)

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

  // Write environment config (optional .env for development convenience)
  const envPath = path.join(projectPath, ".env")
  const envPrefix = config.usesVite ? "VITE_" : "REACT_APP_"
  await writeEnvFile(
    {
      [`${envPrefix}AUTH0_DOMAIN`]: domain,
      [`${envPrefix}AUTH0_CLIENT_ID`]: client.client_id,
      [`${envPrefix}AUTH0_CALLBACK_URI`]: `${config.packageId}://${domain}/capacitor/${config.packageId}/callback`,
    },
    envPath
  )

  // Summary
  const callbackUrl = `${config.packageId}://${domain}/capacitor/${config.packageId}/callback`
  console.log("\n  Auth0 Ionic React (Capacitor) Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Client ID:     ${client.client_id}`)
  console.log(`  Package ID:    ${config.packageId}`)
  console.log(`  Callback URL:  ${callbackUrl}`)
  console.log("")
  console.log("  Remaining steps:")
  console.log("  1. Configure Auth0Provider in your app's entry point (src/main.tsx or src/index.tsx)")
  console.log("  2. Add deep link callback handler using @capacitor/app")
  console.log("  3. Run: ionic build && npx cap sync")
  console.log("  4. Test on device via Xcode or Android Studio")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
