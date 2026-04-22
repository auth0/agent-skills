import { $ } from "execa"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ora from "ora"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RUBY_SCRIPT = path.join(__dirname, "xcode-modify.rb")

/**
 * Ensure the xcodeproj Ruby gem is available, installing it if needed.
 * Returns true if the gem is usable, false otherwise.
 */
async function ensureXcodeprojGem() {
  try {
    await $`ruby -e "require 'xcodeproj'"`
    return true
  } catch {
    const installSpinner = ora("Installing xcodeproj gem").start()
    try {
      await $({ timeout: 120000 })`gem install xcodeproj --quiet`
      installSpinner.succeed("xcodeproj gem installed")
      return true
    } catch (e) {
      installSpinner.fail(`Could not install xcodeproj gem: ${e.message}`)
      return false
    }
  }
}

/**
 * Configure the Xcode project:
 *  - Adds Auth0.plist to the main app target's Resources build phase.
 *  - Sets CODE_SIGN_ENTITLEMENTS on all target build configurations.
 *
 * Falls back to a warning if the xcodeproj gem cannot be loaded.
 */
export async function configureXcodeProject(xcodeprojPath, plistAbsPath, entitlementsRelPath) {
  const spinner = ora("Configuring Xcode project").start()

  const gemAvailable = await ensureXcodeprojGem()
  if (!gemAvailable) {
    spinner.warn(
      "xcodeproj gem unavailable — add Auth0.plist to the target and set " +
      "CODE_SIGN_ENTITLEMENTS manually in Xcode"
    )
    return false
  }

  try {
    const { stdout, stderr } = await $({
      timeout: 60000,
    })`ruby ${RUBY_SCRIPT} ${xcodeprojPath} ${plistAbsPath} ${entitlementsRelPath}`

    if (stderr) process.stderr.write(stderr)

    if (stdout.includes("done")) {
      spinner.succeed("Xcode project configured (Auth0.plist in target, CODE_SIGN_ENTITLEMENTS set)")
      return true
    }

    spinner.warn(`Xcode project configuration incomplete — check output:\n${stdout}`)
    return false
  } catch (e) {
    spinner.fail(`Xcode project configuration failed: ${e.message}`)
    // Non-fatal: user can finish manually
    return false
  }
}
