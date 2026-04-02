#!/usr/bin/env node

import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateAndroidProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyNativeClientChanges, DEFAULT_SCHEME } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeStringsFile } from "./utils/strings-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🚀 Auth0 Android Bootstrap\n")

  // 1. Parse args — optional project path (defaults to cwd)
  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // 2. Pre-flight checks
  checkNodeVersion()
  await checkAuth0CLI()

  // 3. Auto-detect tenant
  const domain = await getActiveTenant()

  // 4. Validate Android project
  const androidConfig = validateAndroidProject(projectPath)

  // 5. Discover existing connections
  const connections = await discoverExistingConnections()

  // 6. Build change plan
  const plan = buildChangePlan(connections, domain, androidConfig)

  // 7. Display plan
  displayChangePlan(plan)

  // 8. Confirm with user
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n❌ Aborted by user.\n")
    process.exit(0)
  }

  // 9. Create native app
  console.log("")
  const client = await applyNativeClientChanges(plan.client)

  // 10. Set up database connection with the real client_id
  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  // 11. Write strings.xml
  await writeStringsFile(domain, client.client_id, DEFAULT_SCHEME, androidConfig.stringsXmlPath)

  // 12. Summary
  console.log("\n✅ Auth0 Android Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Client ID:     ${client.client_id}`)
  console.log(`  Package:       ${androidConfig.packageName}`)
  console.log(`  Scheme:        ${DEFAULT_SCHEME}`)
  console.log(`  Callback URL:  ${DEFAULT_SCHEME}://${domain}/android/${androidConfig.packageName}/callback`)
  console.log("")
  console.log("  Remaining manual steps:")
  console.log("  1. Verify manifest placeholders in app/build.gradle:")
  console.log('     manifestPlaceholders = [')
  console.log('         auth0Domain: "@string/com_auth0_domain",')
  console.log('         auth0Scheme: "@string/com_auth0_scheme"')
  console.log("     ]")
  console.log("  2. Ensure INTERNET permission in AndroidManifest.xml:")
  console.log('     <uses-permission android:name="android.permission.INTERNET" />')
  console.log("  3. Build and test: ./gradlew assembleDebug")
  console.log("")
}

main().catch((e) => {
  console.error(`\n❌ Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
