#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateFlutterNativeProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeManifestPlaceholders } from "./utils/gradle-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Flutter Native (iOS/Android) Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate Flutter native project
  const config = validateFlutterNativeProject(projectPath)

  // Discover existing connections + build change plan
  const connections = await discoverExistingConnections()
  const plan = buildChangePlan(connections, domain, config)
  displayChangePlan(plan)

  if (plan.client.callbacks.length === 0) {
    console.error(
      "\n  Could not determine any callback URLs — Android applicationId and iOS bundle id were not detected.\n" +
      "  Set the Android applicationId in android/app/build.gradle (and/or open ios/Runner.xcworkspace) and re-run.\n"
    )
    process.exit(1)
  }

  // Confirm with user
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n  Aborted by user.\n")
    process.exit(0)
  }

  console.log("")

  // 1. Create Native app (registers Android + iOS callback / logout URLs)
  const client = await applyNativeClientChanges(plan.client)

  // 2. Set up database connection
  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  // 3. Write manifestPlaceholders into android/app/build.gradle
  if (config.hasAndroid && config.gradlePath) {
    writeManifestPlaceholders(config.gradlePath, domain, "https")
  }

  // Summary
  console.log("\n  Auth0 Flutter Native Setup Complete\n")
  console.log(`  Domain:      ${domain}`)
  console.log(`  Client ID:   ${client.client_id}`)
  if (config.packageName) console.log(`  Android pkg: ${config.packageName}`)
  if (config.bundleId) console.log(`  iOS bundle:  ${config.bundleId}`)
  console.log("")
  console.log("  Add this to your Dart code:")
  console.log("")
  console.log(`    final auth0 = Auth0('${domain}', '${client.client_id}');`)
  console.log("")
  console.log("  iOS: add the Associated Domains capability in Xcode:")
  console.log(`    webcredentials:${domain}`)
  console.log("")
  console.log("  Run your app:")
  console.log("")
  console.log("    flutter run")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
