import fs from "node:fs"
import ora from "ora"

/**
 * Write or merge Auth0 config into a .env file.
 * Merges with existing entries — preserves non-Auth0 values.
 *
 * For Python API projects:
 *   AUTH0_DOMAIN   = your-tenant.us.auth0.com
 *   AUTH0_AUDIENCE = https://my-python-api
 *
 * @param {Record<string, string>} config - key/value pairs to write
 * @param {string} envFilePath - absolute path to the .env file
 */
export async function writeEnvFile(config, envFilePath) {
  const spinner = ora(`Writing ${envFilePath}`).start()

  try {
    let content = ""
    if (fs.existsSync(envFilePath)) {
      content = fs.readFileSync(envFilePath, "utf-8")
    }

    for (const [key, value] of Object.entries(config)) {
      const pattern = new RegExp(`^${key}=.*$`, "m")
      if (pattern.test(content)) {
        content = content.replace(pattern, `${key}=${value}`)
      } else {
        content += (content && !content.endsWith("\n") ? "\n" : "") + `${key}=${value}\n`
      }
    }

    fs.writeFileSync(envFilePath, content)
    spinner.succeed(`Updated ${envFilePath}`)
  } catch (e) {
    spinner.fail(`Failed to write ${envFilePath}`)
    throw e
  }
}
