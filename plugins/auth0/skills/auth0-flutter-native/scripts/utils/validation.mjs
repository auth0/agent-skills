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
// Flutter native (iOS/Android) project validator
// ---------------------------------------------------------------------------

/**
 * Extract the Android applicationId from android/app/build.gradle(.kts).
 */
function detectAndroidPackage(projectPath) {
  for (const file of ["android/app/build.gradle", "android/app/build.gradle.kts"]) {
    const gradlePath = path.join(projectPath, file)
    if (fs.existsSync(gradlePath)) {
      const content = fs.readFileSync(gradlePath, "utf-8")
      // applicationId "com.example.app"  OR  applicationId = "com.example.app"
      const match = content.match(/applicationId\s*=?\s*["']([^"']+)["']/)
      if (match) return { packageName: match[1], gradlePath }
      return { packageName: null, gradlePath }
    }
  }
  return { packageName: null, gradlePath: null }
}

/**
 * Extract the iOS bundle identifier from the Xcode project.
 */
function detectIosBundleId(projectPath) {
  const pbxproj = path.join(projectPath, "ios/Runner.xcodeproj/project.pbxproj")
  if (fs.existsSync(pbxproj)) {
    const content = fs.readFileSync(pbxproj, "utf-8")
    const match = content.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/)
    if (match) {
      const value = match[1].trim().replace(/^["']|["']$/g, "")
      // Skip the RunnerTests target value if it contains ".RunnerTests"
      if (!value.includes("RunnerTests")) return value
    }
  }
  return null
}

export function validateFlutterNativeProject(projectPath) {
  const spinner = ora("Validating Flutter native project").start()

  // Check pubspec.yaml exists
  const pubspecPath = path.join(projectPath, "pubspec.yaml")
  if (!fs.existsSync(pubspecPath)) {
    spinner.fail(`No pubspec.yaml found in ${projectPath}`)
    console.error("\n  Ensure you're pointing to the directory containing your Flutter project.\n")
    process.exit(1)
  }

  const androidDir = path.join(projectPath, "android")
  const iosDir = path.join(projectPath, "ios")
  const hasAndroid = fs.existsSync(androidDir)
  const hasIos = fs.existsSync(iosDir)

  if (!hasAndroid && !hasIos) {
    spinner.fail("No android/ or ios/ directory found — mobile platforms may not be enabled")
    console.error("\n  Run 'flutter create . --platforms=android,ios' to add mobile support.\n")
    process.exit(1)
  }

  // Extract app name from pubspec.yaml
  const pubspecContent = fs.readFileSync(pubspecPath, "utf-8")
  const nameMatch = pubspecContent.match(/^name:\s*(.+)$/m)
  const appName = nameMatch?.[1]?.trim() || "flutter_app"

  const { packageName, gradlePath } = detectAndroidPackage(projectPath)
  const bundleId = detectIosBundleId(projectPath)

  spinner.succeed(`Flutter native project: ${appName} (${projectPath})`)

  if (hasAndroid && !packageName) {
    console.warn("  Warning: could not detect Android applicationId — defaulting may be required.")
  }
  if (hasIos && !bundleId) {
    console.warn("  Warning: could not detect iOS bundle identifier — defaulting may be required.")
  }

  return {
    appName,
    projectPath,
    pubspecPath,
    hasAndroid,
    hasIos,
    packageName,
    bundleId,
    gradlePath,
  }
}
