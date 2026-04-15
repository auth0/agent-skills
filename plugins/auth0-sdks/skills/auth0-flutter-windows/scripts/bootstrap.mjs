#!/usr/bin/env node
/**
 * Bootstrap script for Auth0 Flutter Windows Desktop integration.
 *
 * Orchestrates Auth0 Native application creation and config file generation
 * for a Flutter Windows project.
 *
 * Usage: node bootstrap.mjs <path-to-flutter-project>
 */

import path from "path"
import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateFlutterProject,
} from "./utils/validation.mjs"
import {
  discoverExistingApps,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeDartConfig } from "./utils/dart-config-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Flutter Windows Desktop Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate Flutter project
  const config = validateFlutterProject(projectPath)

  // Discover existing Native apps + database connections
  const apps = await discoverExistingApps()
  const plan = buildChangePlan(apps, domain, config)
  displayChangePlan(plan)

  // Confirm with user
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n  Aborted by user.\n")
    process.exit(0)
  }

  // Execute: create Native app
  console.log("")
  const client = await applyNativeClientChanges(plan.client)

  // Set up database connection
  plan.connection = checkDatabaseConnectionChanges(apps.connections || [], client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  // Write lib/auth0_config.dart
  await writeDartConfig({
    projectPath,
    domain,
    clientId: client.client_id,
  })

  // Summary
  console.log("\n  Auth0 Flutter Windows Desktop Setup Complete\n")
  console.log(`  Domain:         ${domain}`)
  console.log(`  Client ID:      ${client.client_id}`)
  console.log(`  Config written: lib/auth0_config.dart`)
  console.log("")
  console.log("  Next steps:")
  console.log("  1. Install vcpkg: https://vcpkg.io/en/getting-started")
  console.log("  2. Add CMAKE_TOOLCHAIN_FILE to windows/CMakeLists.txt (before project())")
  console.log("  3. Register your custom URL scheme (see references/setup.md#5-register-the-windows-protocol-handler)")
  console.log("  4. Update windows/runner/main.cpp (see references/setup.md#update-maincpp)")
  console.log("  5. Run: flutter build windows")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
