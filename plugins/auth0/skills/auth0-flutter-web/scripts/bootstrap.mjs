#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateFlutterWebProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import {
  applySPAClientChanges,
  enableRefreshTokenRotation,
} from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeIndexHtmlScript } from "./utils/index-html-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Flutter Web Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate Flutter web project
  const config = validateFlutterWebProject(projectPath)

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

  // 1. Create SPA app (registers callback URLs, logout URLs, web origins)
  const client = await applySPAClientChanges(plan.client)

  // 2. Set up database connection
  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  // 3. Enable refresh token rotation for SPA
  await enableRefreshTokenRotation(client.client_id)

  // 4. Add Auth0 SPA JS script to web/index.html
  writeIndexHtmlScript(config.indexHtmlPath)

  // Summary
  console.log("\n  Auth0 Flutter Web Setup Complete\n")
  console.log(`  Domain:      ${domain}`)
  console.log(`  Client ID:   ${client.client_id}`)
  console.log(`  App URL:     http://localhost:${config.port}`)
  console.log("")
  console.log("  Initialize Auth0Web from compile-time defines (do not hardcode these values):")
  console.log("")
  console.log("    final auth0 = Auth0Web(")
  console.log("      const String.fromEnvironment('AUTH0_DOMAIN'),")
  console.log("      const String.fromEnvironment('AUTH0_CLIENT_ID'),")
  console.log("    );")
  console.log("")
  console.log("  Run your app, supplying the values at launch:")
  console.log("")
  console.log(`    flutter run -d chrome --web-port ${config.port} \\`)
  console.log(`      --dart-define=AUTH0_DOMAIN=${domain} \\`)
  console.log(`      --dart-define=AUTH0_CLIENT_ID=${client.client_id}`)
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
