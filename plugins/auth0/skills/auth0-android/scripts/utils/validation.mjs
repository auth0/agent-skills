import { $ } from "execa"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"

export function checkNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number)
  if (major < 20) {
    console.error(`❌ Node.js 20 or later is required (current: ${process.version})`)
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

export function validateAndroidProject(projectPath) {
  const spinner = ora("Validating Android project").start()

  // Find build.gradle or build.gradle.kts
  const gradleFile = ["build.gradle", "build.gradle.kts"]
    .map((f) => path.join(projectPath, "app", f))
    .find((f) => fs.existsSync(f))

  if (!gradleFile) {
    spinner.fail(`No app/build.gradle or app/build.gradle.kts found in ${projectPath}`)
    process.exit(1)
  }

  // Extract applicationId
  const gradleContent = fs.readFileSync(gradleFile, "utf-8")
  const match = gradleContent.match(/applicationId\s*=?\s*["']([^"']+)["']/)
  if (!match) {
    spinner.fail("Could not find applicationId in " + gradleFile)
    process.exit(1)
  }
  const packageName = match[1]

  // Find strings.xml
  const stringsXmlPath = path.join(projectPath, "app", "src", "main", "res", "values", "strings.xml")
  if (!fs.existsSync(stringsXmlPath)) {
    // Create the directory and a minimal strings.xml
    const dir = path.dirname(stringsXmlPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      stringsXmlPath,
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">My App</string>\n</resources>\n'
    )
  }

  spinner.succeed(`Android project: ${packageName} (${path.relative(process.cwd(), gradleFile)})`)

  return { packageName, stringsXmlPath, gradleFile }
}
