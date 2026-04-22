import fs from "node:fs"
import ora from "ora"

export async function writeAppJsonConfig(domain, customScheme, appJsonPath) {
  const spinner = ora("Writing Auth0 config to app.json").start()

  try {
    let appJson = {}
    if (fs.existsSync(appJsonPath)) {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"))
    }

    if (!appJson.expo) {
      appJson.expo = {}
    }

    if (!appJson.expo.plugins) {
      appJson.expo.plugins = []
    }

    const auth0PluginConfig = {
      domain,
      customScheme,
    }

    // Check if react-native-auth0 plugin already exists
    const existingIndex = appJson.expo.plugins.findIndex(
      (p) =>
        (Array.isArray(p) && p[0] === "react-native-auth0") ||
        p === "react-native-auth0"
    )

    if (existingIndex >= 0) {
      // Update existing plugin entry
      appJson.expo.plugins[existingIndex] = [
        "react-native-auth0",
        auth0PluginConfig,
      ]
    } else {
      // Add new plugin entry
      appJson.expo.plugins.push([
        "react-native-auth0",
        auth0PluginConfig,
      ])
    }

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n")
    spinner.succeed(`Updated ${appJsonPath} with Auth0 plugin config`)
  } catch (e) {
    spinner.fail("Failed to write app.json")
    throw e
  }
}
