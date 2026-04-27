#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateIonicAngularProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeAuth0Config } from "./utils/config-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Ionic Angular Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateIonicAngularProject(projectPath)

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

  const { callbackUrl } = await writeAuth0Config(projectPath, {
    domain,
    clientId: client.client_id,
    appId: config.appId,
  })

  // Summary
  console.log("\n  Auth0 Ionic Angular Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Client ID:     ${client.client_id}`)
  console.log(`  App ID:        ${config.appId}`)
  console.log(`  Callback URL:  ${callbackUrl}`)
  console.log("")
  console.log("  Next steps:")
  console.log("    1. Install SDK: npm install @auth0/auth0-angular @capacitor/browser @capacitor/app")
  console.log("    2. Add Auth0 provider to app.config.ts or AuthModule.forRoot() in app.module.ts")
  console.log("    3. Implement login/logout with Browser.open and appUrlOpen listener")
  console.log("    4. Build and sync: npm run build && npx cap sync")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
