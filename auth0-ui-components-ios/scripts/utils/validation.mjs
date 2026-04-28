import fs from "node:fs"
import path from "node:path"
import { $ } from "execa"
import ora from "ora"

export function checkNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number)
  if (major < 20) {
    console.error(`\n  Node.js 20+ required (found ${process.versions.node})\n`)
    process.exit(1)
  }
}

export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    await $({ timeout: 10000 })`auth0 --version --no-input`
    spinner.succeed("Auth0 CLI is installed")
  } catch {
    spinner.fail("Auth0 CLI not found")
    console.error("\n  Install: brew install auth0/auth0-cli/auth0")
    console.error("  Then:    auth0 login\n")
    process.exit(1)
  }
}

export async function getActiveTenant() {
  const spinner = ora("Detecting active tenant").start()
  try {
    const { stdout } = await $({ timeout: 10000 })`auth0 tenants list --csv --no-input`
    const lines = stdout.trim().split("\n").filter((l) => l.trim())
    if (lines.length < 2) {
      spinner.fail("No active tenant found")
      console.error("\n  Run: auth0 login\n")
      process.exit(1)
    }
    const domain = lines[1].trim().split(",")[0].trim()
    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch {
    spinner.fail("Failed to detect tenant")
    console.error("\n  Run: auth0 login\n")
    process.exit(1)
  }
}

export function validateSwiftProject(projectPath) {
  const spinner = ora("Validating Swift project").start()

  const entries = fs.readdirSync(projectPath)
  const xcodeproj = entries.find((e) => e.endsWith(".xcodeproj"))
  const xcworkspace = entries.find((e) => e.endsWith(".xcworkspace"))

  if (!xcodeproj && !xcworkspace) {
    spinner.fail(`No .xcodeproj or .xcworkspace found in ${projectPath}`)
    process.exit(1)
  }

  let bundleId = null

  if (xcodeproj) {
    const pbxprojPath = path.join(projectPath, xcodeproj, "project.pbxproj")
    if (fs.existsSync(pbxprojPath)) {
      const content = fs.readFileSync(pbxprojPath, "utf-8")
      const regex = /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g
      let match
      while ((match = regex.exec(content)) !== null) {
        const value = match[1].trim().replace(/"/g, "")
        if (value.includes("$(") || value.includes("Tests") || value === "NO") {
          continue
        }
        bundleId = value
        break
      }
    }
  }

  if (!bundleId) {
    spinner.fail("Could not detect Bundle Identifier from Xcode project")
    console.error("\n  Parsed: " + (xcodeproj ? xcodeproj + "/project.pbxproj" : "no .xcodeproj found"))
    console.error("  Please provide your Bundle Identifier manually.\n")
    process.exit(1)
  }

  const auth0PlistPath = path.join(projectPath, "Auth0.plist")
  spinner.succeed(`Swift project: ${bundleId} (${xcodeproj || xcworkspace})`)
  return { bundleId, auth0PlistPath }
}
