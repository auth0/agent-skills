import fs from "node:fs"
import path from "node:path"
import ora from "ora"

/**
 * Inject Auth0 manifestPlaceholders (auth0Domain, auth0Scheme) into
 * android/app/build.gradle or build.gradle.kts inside defaultConfig.
 *
 * Idempotent: if auth0Domain is already present, it is left untouched.
 */
export function writeManifestPlaceholders(gradlePath, domain, scheme = "https") {
  const spinner = ora("Adding manifestPlaceholders to android/app/build.gradle").start()

  if (!gradlePath || !fs.existsSync(gradlePath)) {
    spinner.warn("android/app/build.gradle not found — skipping (add manifestPlaceholders manually)")
    return
  }

  let content = fs.readFileSync(gradlePath, "utf-8")

  if (content.includes("auth0Domain")) {
    spinner.succeed("manifestPlaceholders already present in build.gradle")
    return
  }

  const isKts = gradlePath.endsWith(".kts")

  const insertion = isKts
    ? `        manifestPlaceholders["auth0Domain"] = "${domain}"\n` +
      `        manifestPlaceholders["auth0Scheme"] = "${scheme}"\n`
    : `        manifestPlaceholders = [auth0Domain: "${domain}", auth0Scheme: "${scheme}"]\n`

  // Find `defaultConfig {` and insert right after the opening brace line.
  const defaultConfigRegex = /defaultConfig\s*\{/
  const match = content.match(defaultConfigRegex)

  if (!match) {
    spinner.warn("Could not find defaultConfig block — add manifestPlaceholders manually")
    console.error(
      "\n  Add this inside android { defaultConfig { ... } }:\n" +
      (isKts
        ? `    manifestPlaceholders["auth0Domain"] = "${domain}"\n    manifestPlaceholders["auth0Scheme"] = "${scheme}"\n`
        : `    manifestPlaceholders = [auth0Domain: "${domain}", auth0Scheme: "${scheme}"]\n`)
    )
    return
  }

  const insertPos = match.index + match[0].length
  content = content.slice(0, insertPos) + "\n" + insertion + content.slice(insertPos)

  fs.writeFileSync(gradlePath, content, "utf-8")
  spinner.succeed(`Added manifestPlaceholders to ${path.basename(gradlePath)}`)
}
