import { $ } from "execa"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

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

export function validateIonicReactProject(projectPath) {
  const spinner = ora("Validating Ionic React + Capacitor project").start()

  const pkgPath = path.join(projectPath, "package.json")
  if (!fs.existsSync(pkgPath)) {
    spinner.fail(`No package.json found in ${projectPath}`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))

  // Check for @capacitor/core
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (!deps["@capacitor/core"]) {
    spinner.fail("Not a Capacitor project (missing @capacitor/core dependency)")
    process.exit(1)
  }

  // Check for React
  if (!deps["react"]) {
    spinner.fail("Not a React project (missing react dependency)")
    process.exit(1)
  }

  // Detect package ID from capacitor.config.ts or capacitor.config.json
  let packageId = null
  let usesVite = !!deps["vite"] || !!deps["@vitejs/plugin-react"]

  const capConfigTs = path.join(projectPath, "capacitor.config.ts")
  const capConfigJson = path.join(projectPath, "capacitor.config.json")

  if (fs.existsSync(capConfigTs)) {
    const content = fs.readFileSync(capConfigTs, "utf-8")
    const match = content.match(/appId:\s*['"]([^'"]+)['"]/)
    if (match) {
      packageId = match[1]
    }
  } else if (fs.existsSync(capConfigJson)) {
    const content = JSON.parse(fs.readFileSync(capConfigJson, "utf-8"))
    packageId = content.appId
  }

  if (!packageId) {
    spinner.fail("Could not detect appId from capacitor.config.ts or capacitor.config.json")
    console.error("\n  Ensure your Capacitor config has an appId field (e.g., 'com.example.myapp').\n")
    process.exit(1)
  }

  // Check for Ionic
  const isIonic = !!deps["@ionic/react"]
  if (!isIonic) {
    spinner.warn(`No @ionic/react found — proceeding as Capacitor React project: ${packageId}`)
  } else {
    spinner.succeed(`Ionic React + Capacitor project: ${packageId}`)
  }

  return { packageId, usesVite }
}
