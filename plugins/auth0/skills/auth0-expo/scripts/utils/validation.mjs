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

export function checkDevClient(projectPath) {
  const pkgPath = path.join(projectPath, "package.json")
  if (!fs.existsSync(pkgPath)) return false
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  return !!deps["expo-dev-client"]
}

export async function installDevClient(projectPath) {
  const spinner = ora("Installing expo-dev-client").start()
  try {
    const installArgs = ["expo", "install", "expo-dev-client"]
    await $({ cwd: projectPath, timeout: 60000 })`npx ${installArgs}`
    spinner.succeed("Installed expo-dev-client")
  } catch (e) {
    spinner.fail("Failed to install expo-dev-client")
    throw e
  }
}

export function validateExpoProject(projectPath) {
  const spinner = ora("Validating Expo project").start()

  const appJsonPath = path.join(projectPath, "app.json")
  const appConfigJsPath = path.join(projectPath, "app.config.js")
  const appConfigTsPath = path.join(projectPath, "app.config.ts")

  let appJson = null
  let configSource = null

  if (fs.existsSync(appJsonPath)) {
    try {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"))
      configSource = appJsonPath
    } catch {
      spinner.fail("Failed to parse app.json")
      process.exit(1)
    }
  }

  if (!appJson?.expo && !fs.existsSync(appConfigJsPath) && !fs.existsSync(appConfigTsPath)) {
    spinner.fail(`No Expo configuration found in ${projectPath}. Expected app.json with "expo" key, app.config.js, or app.config.ts.`)
    process.exit(1)
  }

  const pkgPath = path.join(projectPath, "package.json")
  if (!fs.existsSync(pkgPath)) {
    spinner.fail(`No package.json found in ${projectPath}`)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (!deps["expo"]) {
    spinner.fail("Not an Expo project (no expo dependency in package.json)")
    process.exit(1)
  }

  const expo = appJson?.expo || {}
  const bundleIdentifier = expo.ios?.bundleIdentifier || null
  const androidPackage = expo.android?.package || null
  const appName = expo.name || expo.slug || pkg.name || "expo-app"

  // Determine custom scheme
  let customScheme = expo.scheme || appName.toLowerCase().replace(/[^a-z0-9]/g, "")

  // Check if react-native-auth0 plugin already exists
  const plugins = expo.plugins || []
  const existingPlugin = plugins.find(
    (p) => (Array.isArray(p) && p[0] === "react-native-auth0") || p === "react-native-auth0"
  )
  if (existingPlugin && Array.isArray(existingPlugin) && existingPlugin[1]?.customScheme) {
    customScheme = existingPlugin[1].customScheme
  }

  spinner.succeed(`Expo project: ${appName} (scheme: ${customScheme})`)
  return {
    appName,
    customScheme,
    bundleIdentifier,
    androidPackage,
    appJsonPath: configSource || appJsonPath,
  }
}
