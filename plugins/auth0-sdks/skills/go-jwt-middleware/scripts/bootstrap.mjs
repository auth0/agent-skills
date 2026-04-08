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
  console.log("\n  Auth0 Go API Bootstrap\n")

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
  const api = await applyApiChanges(plan.api)

  await writeEnvFile(
    { AUTH0_DOMAIN: domain, AUTH0_AUDIENCE: api.identifier },
    path.join(projectPath, ".env")
  )

  // Summary
  console.log("\n  Auth0 Go API Setup Complete\n")
  console.log(`  Domain:        ${domain}`)
  console.log(`  Audience:      ${api.identifier}`)
  console.log("")
}

main().catch((e) => {
  console.error(`\n  Bootstrap failed: ${e.message}\n`)
  process.exit(1)
})
