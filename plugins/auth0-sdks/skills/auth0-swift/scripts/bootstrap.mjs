#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateSwiftProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeAuth0Plist } from "./utils/plist-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Swift Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate Xcode project and detect bundle identifier
  const config = validateSwiftProject(projectPath)

  // Discover existing connections + build change plan
  const connections = await discoverExistingConnections()
  const plan = buildChangePlan(connections, domain, config)
  displayChangePlan(plan)

  // Confirm with user
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n  Aborted by user.\n")
    process.exit(0)
  }

  // Execute: create Native app, setup connection, write config
  console.log("")
  const client = await applyNativeClientChanges(plan.client)

  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  await writeAuth0Plist(domain, client.client_id, config.auth0PlistPath)

  // Summary
  console.log("\n  Auth0 Swift Setup Complete\n")
  console.log(`  Domain:      ${domain}`)
  console.log(`  Client ID:   ${client.client_id}`)
  console.log(`  Bundle ID:   ${config.bundleId}`)
  console.log(`  Auth0.plist: ${config.auth0PlistPath}`)
  console.log("")
  console.log("  Next steps:")
  console.log("  1. Open your Xcode project and add Auth0.plist to the app target")
  console.log("     (Right-click → Add Files → check your app target)")
  console.log("  2. Register URL scheme in Xcode: target → Info tab → URL Types")
  console.log("     Identifier: auth0   |   URL Schemes: $(PRODUCT_BUNDLE_IDENTIFIER)")
  console.log("  3. Verify callback URLs in Auth0 Dashboard match your bundle ID:")
  console.log(`     https://${domain}/ios/${config.bundleId}/callback`)
  console.log(`     ${config.bundleId}://${domain}/ios/${config.bundleId}/callback`)
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
