#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateWebProject,
} from "./utils/validation.mjs"
import {
  discoverExistingConnections,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyRegularClientChanges } from "./utils/clients.mjs"
import { applyDatabaseConnectionChanges, checkDatabaseConnectionChanges } from "./utils/connections.mjs"
import { writeEnvFile } from "./utils/env-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Python Flask Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateWebProject(projectPath)

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
  const client = await applyRegularClientChanges(plan.client)

  plan.connection = checkDatabaseConnectionChanges(connections, client.client_id)
  await applyDatabaseConnectionChanges(plan.connection, client.client_id)

  const envPath = path.join(projectPath, ".env")
  await writeEnvFile(
    {
      AUTH0_DOMAIN: domain,
      AUTH0_CLIENT_ID: client.client_id,
      AUTH0_CLIENT_SECRET: client.client_secret,
      AUTH0_SECRET: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
    },
    envPath,
  )

  // Summary
  console.log("\n  Auth0 Python Flask Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Client ID:     ${client.client_id}`)
  console.log(`  Config:        ${envPath}`)
  console.log("")
  console.log("  Next steps:")
  console.log("    1. pip install auth0-python authlib flask python-dotenv requests")
  console.log("    2. Add login/callback/logout routes to your Flask app")
  console.log("    3. Run: flask run (or python app.py)")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
