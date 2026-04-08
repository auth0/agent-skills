import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import ora from "ora"

export function checkNodeVersion() {
  const version = process.versions.node
  const major = parseInt(version.split(".")[0], 10)
  if (major < 20) {
    console.error(`\n  Node.js 20+ required (found ${version})\n`)
    process.exit(1)
  }
}

export async function checkAuth0CLI() {
  const spinner = ora("Checking Auth0 CLI").start()
  try {
    execSync("auth0 --version --no-input", { stdio: "pipe" })
    spinner.succeed("Auth0 CLI installed")
  } catch {
    spinner.fail("Auth0 CLI not found")
    console.error("\n  Install: https://auth0.com/docs/get-started/auth0-overview/set-up-apis#install-the-auth0-cli\n")
    process.exit(1)
  }
}

export async function getActiveTenant() {
  const spinner = ora("Detecting active tenant").start()
  try {
    const output = execSync("auth0 tenants list --csv --no-input", {
      stdio: "pipe",
      encoding: "utf-8",
    })
    const lines = output.trim().split("\n").filter(Boolean)
    if (lines.length < 2) {
      spinner.fail("No active tenant found")
      console.error("\n  Run: auth0 login\n")
      process.exit(1)
    }
    const domain = lines[1].trim().split(",")[0].replace(/"/g, "")
    spinner.succeed(`Active tenant: ${domain}`)
    return domain
  } catch {
    spinner.fail("Failed to detect tenant")
    console.error("\n  Run: auth0 login\n")
    process.exit(1)
  }
}

export function validateWebProject(projectPath) {
  const spinner = ora("Validating web project").start()

  const detectors = [
    { file: "*.csproj", framework: "dotnet", port: 5000 },
    { file: "composer.json", framework: "laravel", port: 8000 },
    { file: "Gemfile", framework: "rails", port: 3000 },
    { file: "go.mod", framework: "go", port: 3000 },
    { file: "requirements.txt", framework: "python", port: 5000 },
    { file: "pyproject.toml", framework: "python", port: 5000 },
    { file: "package.json", framework: "node", port: 3000 },
  ]

  let framework = null
  let port = 5000
  for (const d of detectors) {
    const pattern = d.file.includes("*")
      ? fs.readdirSync(projectPath).some((f) => f.endsWith(d.file.replace("*", "")))
      : fs.existsSync(path.join(projectPath, d.file))
    if (pattern) {
      framework = d.framework
      port = d.port
      break
    }
  }

  if (!framework) {
    spinner.fail(`Could not detect web framework in ${projectPath}`)
    process.exit(1)
  }

  spinner.succeed(`Web project: ${framework} (port ${port})`)
  return { framework, port }
}
