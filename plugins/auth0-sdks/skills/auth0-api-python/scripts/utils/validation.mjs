import fs from "node:fs"
import path from "node:path"
import { $ } from "execa"
import ora from "ora"

/**
 * Verify Node.js version is 20+
 */
export function checkNodeVersion() {
  const version = parseInt(process.version.slice(1).split(".")[0], 10)
  if (version < 20) {
    console.error(`\n  Error: Node.js 20+ required (found ${process.version})\n`)
    process.exit(1)
  }
}

/**
 * Verify Auth0 CLI is installed and accessible
 */
export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    await $`auth0 --version --no-input`
    spinner.succeed("Auth0 CLI is installed")
  } catch {
    spinner.fail("Auth0 CLI not found")
    console.error("\n  Install with: brew install auth0  (or: npm install -g @auth0/auth0-cli)")
    console.error("  Then log in: auth0 login\n")
    process.exit(1)
  }
}

/**
 * Get the active Auth0 tenant domain from the CLI
 * @returns {Promise<string>} tenant domain
 */
export async function getActiveTenant() {
  const spinner = ora("Detecting active Auth0 tenant").start()
  try {
    const { stdout } = await $`auth0 tenants list --csv --no-input`
    const lines = stdout.trim().split("\n").filter(Boolean)
    // CSV format: domain,name,active — find active tenant
    const activeLine = lines.find((l) => l.endsWith(",true")) || lines[0]
    if (!activeLine) {
      spinner.fail("No Auth0 tenant found")
      console.error("\n  Log in first: auth0 login\n")
      process.exit(1)
    }
    const domain = activeLine.split(",")[0].trim()
    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch (e) {
    spinner.fail("Failed to detect tenant")
    console.error("\n  Ensure you are logged in: auth0 login\n")
    process.exit(1)
  }
}

/**
 * Validate Python API project structure
 * Detects requirements.txt, pyproject.toml, or manage.py
 * @param {string} projectPath
 * @returns {{ framework: string }}
 */
export function validateApiProject(projectPath) {
  const spinner = ora("Validating Python API project").start()

  const detectors = [
    { file: "requirements.txt", framework: "python" },
    { file: "pyproject.toml", framework: "python" },
    { file: "manage.py", framework: "django" },
    { file: "setup.py", framework: "python" },
    { file: "setup.cfg", framework: "python" },
  ]

  let framework = null
  for (const d of detectors) {
    if (fs.existsSync(path.join(projectPath, d.file))) {
      framework = d.framework
      break
    }
  }

  if (!framework) {
    spinner.fail(`Could not detect Python project in ${projectPath}`)
    console.error("\n  Expected one of: requirements.txt, pyproject.toml, manage.py\n")
    process.exit(1)
  }

  spinner.succeed(`Python API project detected (${framework})`)
  return { framework }
}
