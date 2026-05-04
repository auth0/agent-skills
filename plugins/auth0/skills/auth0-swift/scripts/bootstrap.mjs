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
import {
  applyNativeClientChanges,
  applyDeviceSettings,
} from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeAuth0Plist } from "./utils/plist-writer.mjs"
import { writeEntitlementsFile } from "./utils/entitlements.mjs"
import { configureXcodeProject } from "./utils/xcode-project.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Swift Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate Xcode project and detect bundle identifier + team ID
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

  console.log("")

  // 1. Create Native app (registers HTTPS + custom scheme callback URLs)
  const client = await applyNativeClientChanges(plan.client)

  // 2. Set up database connection
  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  // 3. Configure Device Settings so Auth0 hosts apple-app-site-association
  await applyDeviceSettings(client.client_id, config.teamId, config.bundleId)

  // 4. Write Auth0.plist
  await writeAuth0Plist(domain, client.client_id, config.auth0PlistPath)

  // 5. Write / merge entitlements file with Associated Domains entries
  writeEntitlementsFile(config.entitlementsPath, domain)

  // 6. Add Auth0.plist to Xcode target + set CODE_SIGN_ENTITLEMENTS
  const xcodeConfigured = await configureXcodeProject(
    config.xcodeprojPath,
    config.auth0PlistPath,
    path.basename(config.entitlementsPath)
  )

  // Summary
  console.log("\n  Auth0 Swift Setup Complete\n")
  console.log(`  Domain:      ${domain}`)
  console.log(`  Client ID:   ${client.client_id}`)
  console.log(`  Bundle ID:   ${config.bundleId}`)
  console.log(`  Auth0.plist: ${config.auth0PlistPath}`)
  console.log(`  Entitlements: ${config.entitlementsPath}`)
  console.log("")

  const remainingSteps = []

  remainingSteps.push(
    "1. Register URL scheme in Xcode: target → Info tab → URL Types → +\n" +
    "     Identifier: auth0   |   URL Schemes: $(PRODUCT_BUNDLE_IDENTIFIER)"
  )

  if (!config.teamId) {
    remainingSteps.push(
      "2. Apple Team ID was not detected — verify Device Settings in Auth0 Dashboard:\n" +
      "     App Settings → Advanced → Device Settings → Team ID + Bundle ID"
    )
  }

  if (!xcodeConfigured) {
    remainingSteps.push(
      "3. xcodeproj gem unavailable — complete manually in Xcode:\n" +
      `     a. Add Auth0.plist to target: right-click → Add Files → check ${config.appName}\n` +
      `     b. Set CODE_SIGN_ENTITLEMENTS = "${path.basename(config.entitlementsPath)}" in target Build Settings`
    )
  }

  if (remainingSteps.length > 0) {
    console.log("  Remaining manual steps:")
    for (const step of remainingSteps) {
      console.log(`  ${step}`)
    }
    console.log("")
  }
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
