import { $ } from "execa"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

// ---------------------------------------------------------------------------
// Shared preflight — identical for all SDK types
// ---------------------------------------------------------------------------

export function checkNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number)
  if (major < 20) {
    console.error(`Node.js 20 or later is required (current: ${process.version})`)
    process.exit(1)
  }
}

export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    const versionArgs = ["--version", "--no-input"]
    const { stdout } = await $({ timeout: 10000 })`auth0 ${versionArgs}`
    spinner.succeed(`Auth0 CLI found: ${stdout.trim()}`)
  } catch {
    spinner.fail("Auth0 CLI is not installed")
    console.error(
      "\nInstall it:\n" +
      "  macOS:  brew install auth0/auth0-cli/auth0\n" +
      "  Linux:  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh\n" +
      "  More:   https://github.com/auth0/auth0-cli\n"
    )
    process.exit(1)
  }
}

export async function getActiveTenant() {
  const spinner = ora("Detecting active tenant").start()
  try {
    const tenantsArgs = ["tenants", "list", "--csv", "--no-input"]
    const { stdout } = await $({ timeout: 10000 })`auth0 ${tenantsArgs}`

    const activeLine = stdout
      .split("\n")
      .slice(1)
      .find((line) => line.includes("\u2192"))

    const domain = activeLine?.split(",")[1]?.trim()
    if (!domain) {
      spinner.fail("No active tenant. Run `auth0 login` then re-run this script.")
      process.exit(1)
    }

    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch {
    spinner.fail("Not logged in. Run `auth0 login` then re-run this script.")
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Swift / iOS / macOS project validator
// ---------------------------------------------------------------------------

export function validateSwiftProject(projectPath) {
  const spinner = ora("Validating Swift project").start()

  const entries = fs.readdirSync(projectPath)
  const xcodeproj = entries.find((e) => e.endsWith(".xcodeproj"))
  const xcworkspace = entries.find((e) => e.endsWith(".xcworkspace"))

  if (!xcodeproj && !xcworkspace) {
    spinner.fail(`No .xcodeproj or .xcworkspace found in ${projectPath}`)
    console.error("\n  Ensure you're pointing to the directory containing your Xcode project.\n")
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
        // Skip variables, test targets, and invalid values
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
    console.error(
      "\n  Parsed: " + (xcodeproj ? xcodeproj + "/project.pbxproj" : "no .xcodeproj found") +
      "\n  Please provide your Bundle Identifier manually.\n"
    )
    process.exit(1)
  }

  // Extract Team ID (DEVELOPMENT_TEAM) — may be absent if project is not yet signed
  const teamIdMatch = content.match(/DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]{10})\s*;/)
  const teamId = teamIdMatch?.[1] || null

  const appName = xcodeproj.replace(".xcodeproj", "")
  const xcodeprojPath = path.join(projectPath, xcodeproj)
  const auth0PlistPath = path.join(projectPath, "Auth0.plist")
  const entitlementsPath = path.join(projectPath, `${appName}.entitlements`)

  spinner.succeed(`Swift project: ${bundleId} (${xcodeproj || xcworkspace})`)
  return { bundleId, teamId, appName, xcodeprojPath, auth0PlistPath, entitlementsPath }
}
