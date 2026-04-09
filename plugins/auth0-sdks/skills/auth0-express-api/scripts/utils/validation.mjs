import fs from "node:fs"
import path from "node:path"
import ora from "ora"
import { $ } from "execa"

export function checkNodeVersion() {
  const major = parseInt(process.versions.node.split(".")[0], 10)
  if (major < 20) {
    console.error(`\n  Node.js 20+ required (found ${process.versions.node})\n`)
    process.exit(1)
  }
}

export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    await $({ timeout: 10000 })`auth0 --version`
    spinner.succeed("Auth0 CLI installed")
  } catch {
    spinner.fail("Auth0 CLI not found")
    console.error("\n  Install: https://github.com/auth0/auth0-cli#installation\n")
    process.exit(1)
  }
}

export async function getActiveTenant() {
  const spinner = ora("Getting active tenant").start()
  try {
    const { stdout } = await $({ timeout: 15000 })`auth0 tenants list --csv --no-input`
    const lines = stdout.trim().split("\n").filter((l) => l.trim())
    if (lines.length < 2) {
      spinner.fail("No active tenant found")
      console.error("\n  Run: auth0 login\n")
      process.exit(1)
    }
    // CSV: first line is header, second line is active tenant
    const domain = lines[1].trim().split(",")[0].trim()
    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch {
    spinner.fail("Failed to get active tenant")
    console.error("\n  Run: auth0 login\n")
    process.exit(1)
  }
}

export function validateApiProject(projectPath) {
  const spinner = ora("Validating API project").start()

  const detectors = [
    { file: "package.json", framework: "node", port: 3000 },
  ]

  let framework = null
  let port = 3000

  for (const d of detectors) {
    if (fs.existsSync(path.join(projectPath, d.file))) {
      framework = d.framework
      port = d.port
      break
    }
  }

  if (!framework) {
    spinner.fail(`Could not detect Node.js project in ${projectPath}`)
    process.exit(1)
  }

  // Check for Express dependency
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, "package.json"), "utf-8"))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (!deps.express) {
      spinner.warn("Express not found in package.json dependencies")
    }
  } catch {
    // Continue even if package.json parsing fails
  }

  spinner.succeed(`Node.js Express project (port ${port})`)
  return { framework, port }
}
