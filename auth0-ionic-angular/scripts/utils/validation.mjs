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

export function validateIonicAngularProject(projectPath) {
  const spinner = ora("Validating Ionic Angular project").start()

  const pkgPath = path.join(projectPath, "package.json")
  if (!fs.existsSync(pkgPath)) {
    spinner.fail(`No package.json found in ${projectPath}`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (!deps["@angular/core"]) {
    spinner.fail("Not an Angular project — @angular/core not found in dependencies")
    process.exit(1)
  }

  if (!deps["@ionic/angular"] && !deps["@ionic/angular-toolkit"]) {
    spinner.fail("Not an Ionic Angular project — @ionic/angular not found in dependencies")
    process.exit(1)
  }

  if (!deps["@capacitor/core"]) {
    spinner.fail("Capacitor not configured — @capacitor/core not found. Run: npm install @capacitor/core @capacitor/cli")
    process.exit(1)
  }

  // Read capacitor.config.ts or capacitor.config.json for appId
  let appId = null
  const capConfigTs = path.join(projectPath, "capacitor.config.ts")
  const capConfigJson = path.join(projectPath, "capacitor.config.json")

  if (fs.existsSync(capConfigTs)) {
    const content = fs.readFileSync(capConfigTs, "utf-8")
    const match = content.match(/appId:\s*['"]([^'"]+)['"]/)
    if (match) appId = match[1]
  } else if (fs.existsSync(capConfigJson)) {
    const config = JSON.parse(fs.readFileSync(capConfigJson, "utf-8"))
    appId = config.appId
  }

  if (!appId) {
    spinner.fail("Could not determine appId from capacitor.config.ts or capacitor.config.json")
    process.exit(1)
  }

  spinner.succeed(`Ionic Angular project: ${pkg.name} (appId: ${appId})`)
  return { packageName: pkg.name, appId }
}
