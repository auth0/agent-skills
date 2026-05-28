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
      .find((line) => line.includes("→"))

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
// Flutter Web project validator
// ---------------------------------------------------------------------------

export function validateFlutterWebProject(projectPath) {
  const spinner = ora("Validating Flutter web project").start()

  // Check pubspec.yaml exists
  const pubspecPath = path.join(projectPath, "pubspec.yaml")
  if (!fs.existsSync(pubspecPath)) {
    spinner.fail(`No pubspec.yaml found in ${projectPath}`)
    console.error("\n  Ensure you're pointing to the directory containing your Flutter project.\n")
    process.exit(1)
  }

  // Check web directory exists
  const webDir = path.join(projectPath, "web")
  const indexHtmlPath = path.join(webDir, "index.html")

  if (!fs.existsSync(webDir)) {
    spinner.warn("No web/ directory found — web platform may not be enabled")
    console.error("\n  Run 'flutter create . --platforms=web' to add web support.\n")
    process.exit(1)
  }

  if (!fs.existsSync(indexHtmlPath)) {
    spinner.fail("web/index.html not found")
    console.error("\n  Run 'flutter create . --platforms=web' to recreate web files.\n")
    process.exit(1)
  }

  // Extract app name from pubspec.yaml
  const pubspecContent = fs.readFileSync(pubspecPath, "utf-8")
  const nameMatch = pubspecContent.match(/^name:\s*(.+)$/m)
  const appName = nameMatch?.[1]?.trim() || "flutter_app"

  // Default port
  const port = 3000

  spinner.succeed(`Flutter web project: ${appName} (${projectPath})`)
  return { appName, projectPath, indexHtmlPath, pubspecPath, port }
}
