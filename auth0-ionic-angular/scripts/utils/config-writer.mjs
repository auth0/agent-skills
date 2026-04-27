import fs from "node:fs"
import path from "node:path"
import ora from "ora"

export async function writeAuth0Config(projectPath, config) {
  const spinner = ora("Writing Auth0 configuration").start()

  const { domain, clientId, appId } = config

  // Determine if the project uses standalone (app.config.ts) or NgModule (app.module.ts)
  const appConfigPath = path.join(projectPath, "src", "app", "app.config.ts")
  const appModulePath = path.join(projectPath, "src", "app", "app.module.ts")

  const callbackUrl = `${appId}://${domain}/capacitor/${appId}/callback`

  if (fs.existsSync(appConfigPath)) {
    // Standalone Angular — write to environment.ts
    const envDir = path.join(projectPath, "src", "environments")
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }

    const envContent = `export const environment = {
  production: false,
  auth0: {
    domain: '${domain}',
    clientId: '${clientId}',
    callbackUrl: '${callbackUrl}',
    appId: '${appId}',
  },
};
`
    const envPath = path.join(envDir, "environment.ts")
    fs.writeFileSync(envPath, envContent)
    spinner.succeed(`Wrote Auth0 config to ${envPath}`)
  } else if (fs.existsSync(appModulePath)) {
    // NgModule — write to environment.ts
    const envDir = path.join(projectPath, "src", "environments")
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }

    const envContent = `export const environment = {
  production: false,
  auth0: {
    domain: '${domain}',
    clientId: '${clientId}',
    callbackUrl: '${callbackUrl}',
    appId: '${appId}',
  },
};
`
    const envPath = path.join(envDir, "environment.ts")
    fs.writeFileSync(envPath, envContent)
    spinner.succeed(`Wrote Auth0 config to ${envPath}`)
  } else {
    spinner.fail("Could not find app.config.ts or app.module.ts — write config manually")
    process.exit(1)
  }

  return { callbackUrl }
}
