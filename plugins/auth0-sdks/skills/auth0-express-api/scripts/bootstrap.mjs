#!/usr/bin/env node
import path from "node:path"

import {
  checkNodeVersion,
  checkAuth0CLI,
  getActiveTenant,
  validateApiProject,
} from "./utils/validation.mjs"
import {
  discoverExistingApis,
  buildChangePlan,
  displayChangePlan,
} from "./utils/discovery.mjs"
import { applyApiChanges } from "./utils/apis.mjs"
import { writeEnvFile } from "./utils/env-writer.mjs"
import { confirmWithUser } from "./utils/helpers.mjs"

async function main() {
  console.log("\n  Auth0 Express API Bootstrap\n")

  const projectPath = path.resolve(process.argv[2] || process.cwd())

  // Pre-flight
  checkNodeVersion()
  await checkAuth0CLI()
  const domain = await getActiveTenant()

  // Validate project
  const config = validateApiProject(projectPath)

  // Discover + plan
  const apis = await discoverExistingApis()
  const plan = buildChangePlan(apis, domain, config)
  displayChangePlan(plan)

  // Confirm
  const confirmed = await confirmWithUser("Apply these changes?")
  if (!confirmed) {
    console.log("\n  Aborted by user.\n")
    process.exit(0)
  }

  // Execute
  console.log("")
  let audience
  if (plan.api.action === "skip") {
    console.log(`  Skipping API creation: ${plan.api.reason}`)
    audience = plan.api.identifier
  } else {
    const api = await applyApiChanges(plan.api)
    audience = api.identifier
  }

  const envPath = path.join(projectPath, ".env")
  await writeEnvFile(
    {
      AUTH0_DOMAIN: domain,
      AUTH0_AUDIENCE: audience,
      PORT: "3000",
    },
    envPath
  )

  // Summary
  console.log("\n  Auth0 Express API Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Audience:      ${audience}`)
  console.log("")
  console.log("  Next steps:")
  console.log("  1. Install SDK: npm install express-oauth2-jwt-bearer")
  console.log("  2. Add auth middleware to your Express app")
  console.log("  3. Protect your API endpoints")
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
