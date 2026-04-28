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
  console.log("\n  Auth0 UI Components iOS Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateSwiftProject(projectPath)

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

  await writeAuth0Plist(domain, client.client_id, config.auth0PlistPath)

  // Summary
  console.log("\n  Auth0 UI Components iOS Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Client ID:     ${client.client_id}`)
  console.log(`  Bundle ID:     ${config.bundleId}`)
  console.log(`  Auth0.plist:   ${config.auth0PlistPath}`)
  console.log(`  Callback URL:  ${config.bundleId}://${domain}/ios/${config.bundleId}/callback`)
  console.log("")
  console.log("  Next steps:")
  console.log("  1. Enable My Account APIs on your Auth0 tenant (Settings > Advanced)")
  console.log("  2. Add Associated Domains capability in Xcode: webcredentials:" + domain)
  console.log("  3. Implement TokenProvider and initialize Auth0UniversalComponentsSDKInitializer")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
