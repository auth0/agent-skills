/**
 * Validation utilities for Auth0 Flutter Windows Desktop bootstrap.
 *
 * Provides pre-flight checks and Flutter project detection.
 */

import fs from "fs"
import path from "path"
import { execa } from "execa"
import ora from "ora"

/**
 * Verify Node.js version is 20 or higher.
 */
export function checkNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number)
  if (major < 20) {
    console.error(`\n  Node.js 20+ is required. Current version: ${process.versions.node}\n`)
    process.exit(1)
  }
}

/**
 * Verify Auth0 CLI is installed and accessible.
 */
export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    await execa("auth0", ["--version", "--no-input"])
    spinner.succeed("Auth0 CLI found")
  } catch {
    spinner.fail("Auth0 CLI not found")
    console.error("\n  Install Auth0 CLI: https://github.com/auth0/auth0-cli\n")
    process.exit(1)
  }
}

/**
 * Detect the active Auth0 tenant domain.
 * @returns {Promise<string>} Tenant domain (e.g. 'your-tenant.auth0.com')
 */
export async function getActiveTenant() {
  const spinner = ora("Detecting active Auth0 tenant").start()
  try {
    const { stdout } = await execa("auth0", ["tenants", "list", "--csv", "--no-input"])
    const lines = stdout.trim().split("\n").filter(Boolean)
    if (lines.length === 0) {
      spinner.fail("No active Auth0 tenant. Run: auth0 login")
      process.exit(1)
    }
    // CSV format: domain,name,active
    const active = lines.find((l) => l.endsWith(",true"))
    const domain = active ? active.split(",")[0] : lines[0].split(",")[0]
    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch (e) {
    spinner.fail("Could not detect Auth0 tenant")
    console.error("  Run: auth0 login\n")
    process.exit(1)
  }
}

/**
 * Validate that the target directory is a Flutter project.
 * Detects pubspec.yaml and extracts the package name.
 *
 * @param {string} projectPath - Absolute path to the Flutter project
 * @returns {{ packageName: string }} Detected project metadata
 */
export function validateFlutterProject(projectPath) {
  const spinner = ora("Validating Flutter project").start()

  const pubspecPath = path.join(projectPath, "pubspec.yaml")
  if (!fs.existsSync(pubspecPath)) {
    spinner.fail(`No pubspec.yaml found in ${projectPath}`)
    console.error("\n  Provide the path to a Flutter project root.\n")
    process.exit(1)
  }

  const content = fs.readFileSync(pubspecPath, "utf-8")
  const nameMatch = content.match(/^name:\s*(.+)$/m)
  if (!nameMatch) {
    spinner.fail("Could not find package name in pubspec.yaml")
    process.exit(1)
  }
  const packageName = nameMatch[1].trim()

  // Verify Windows support exists
  const windowsRunnerPath = path.join(projectPath, "windows", "runner", "main.cpp")
  if (!fs.existsSync(windowsRunnerPath)) {
    spinner.warn(`Windows runner not found at ${windowsRunnerPath}`)
    console.log("  Run: flutter create --platforms=windows . to add Windows support\n")
  }

  spinner.succeed(`Flutter project: ${packageName}`)
  return { packageName }
}
