import fs from "node:fs"
import ora from "ora"

export async function writeStringsFile(domain, clientId, scheme, stringsXmlPath) {
  const spinner = ora("Writing strings.xml").start()

  try {
    let content = ""
    if (fs.existsSync(stringsXmlPath)) {
      content = fs.readFileSync(stringsXmlPath, "utf-8")
    }

    // Auth0 values to set/update
    const auth0Entries = {
      com_auth0_client_id: clientId,
      com_auth0_domain: domain,
      com_auth0_scheme: scheme,
    }

    if (content.includes("<resources")) {
      // Update existing file — preserve all non-<string> nodes (string-array, plurals, comments, etc.)
      let updated = content

      for (const [key, value] of Object.entries(auth0Entries)) {
        const existingPattern = new RegExp(`<string\\s+name="${key}"[^>]*>[\\s\\S]*?</string>`)
        if (existingPattern.test(updated)) {
          // Update existing entry (preserve nothing but the name — value gets replaced)
          updated = updated.replace(existingPattern, `<string name="${key}">${value}</string>`)
        } else {
          // Insert new entry before </resources>
          updated = updated.replace("</resources>", `    <string name="${key}">${value}</string>\n</resources>`)
        }
      }

      fs.writeFileSync(stringsXmlPath, updated)
    } else {
      // No existing file or empty — create minimal strings.xml
      const lines = [
        `    <string name="app_name">My App</string>`,
        ...Object.entries(auth0Entries).map(([k, v]) => `    <string name="${k}">${v}</string>`),
      ]
      const xml =
        '<?xml version="1.0" encoding="utf-8"?>\n' +
        "<resources>\n" +
        lines.join("\n") +
        "\n</resources>\n"
      fs.writeFileSync(stringsXmlPath, xml)
    }

    spinner.succeed(`Updated ${stringsXmlPath}`)
  } catch (e) {
    spinner.fail("Failed to write strings.xml")
    throw e
  }
}
