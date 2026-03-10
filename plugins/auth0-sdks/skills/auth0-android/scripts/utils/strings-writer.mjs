import fs from "node:fs"
import ora from "ora"

export async function writeStringsFile(domain, clientId, scheme, stringsXmlPath) {
  const spinner = ora("Writing strings.xml").start()

  try {
    let content = ""
    if (fs.existsSync(stringsXmlPath)) {
      content = fs.readFileSync(stringsXmlPath, "utf-8")
    }

    // Parse existing string entries into a Map
    const entries = new Map()
    const regex = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g
    let match
    while ((match = regex.exec(content)) !== null) {
      entries.set(match[1], match[2])
    }

    // Set Auth0 values
    entries.set("com_auth0_client_id", clientId)
    entries.set("com_auth0_domain", domain)
    if (!entries.has("com_auth0_scheme")) {
      entries.set("com_auth0_scheme", scheme)
    }

    // Ensure app_name exists
    if (!entries.has("app_name")) {
      entries.set("app_name", "My App")
    }

    // Build ordered output: app_name and Auth0 config first, then the rest
    const priority = ["app_name", "com_auth0_client_id", "com_auth0_domain", "com_auth0_scheme"]
    const orderedKeys = [
      ...priority.filter((k) => entries.has(k)),
      ...[...entries.keys()].filter((k) => !priority.includes(k)),
    ]

    const lines = orderedKeys.map((k) => `    <string name="${k}">${entries.get(k)}</string>`)
    const xml =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      "<resources>\n" +
      lines.join("\n") +
      "\n</resources>\n"

    fs.writeFileSync(stringsXmlPath, xml)
    spinner.succeed(`Updated ${stringsXmlPath}`)
  } catch (e) {
    spinner.fail("Failed to write strings.xml")
    throw e
  }
}
