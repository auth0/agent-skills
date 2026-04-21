import fs from "node:fs"
import ora from "ora"

/**
 * Write or merge the Associated Domains entitlements file.
 *
 * - If the file does not exist: creates it with applinks + webcredentials entries.
 * - If the file exists but lacks the entries: merges them into the existing content.
 * - If the file already contains both entries: no-op.
 */
export function writeEntitlementsFile(entitlementsPath, domain) {
  const applinksEntry = `<string>applinks:${domain}</string>`
  const webcredEntry = `<string>webcredentials:${domain}</string>`
  const spinner = ora(`Writing entitlements: ${entitlementsPath.split("/").pop()}`).start()

  try {
    if (!fs.existsSync(entitlementsPath)) {
      fs.writeFileSync(entitlementsPath, buildEntitlementsContent(domain), "utf-8")
      spinner.succeed(`Created entitlements file with Associated Domains`)
      return
    }

    let content = fs.readFileSync(entitlementsPath, "utf-8")

    if (content.includes(applinksEntry) && content.includes(webcredEntry)) {
      spinner.succeed(`Entitlements already contain Associated Domains entries`)
      return
    }

    if (content.includes("com.apple.developer.associated-domains")) {
      // Key exists — append missing entries into its array
      const arrayPattern = /(com\.apple\.developer\.associated-domains<\/key>\s*<array>)([\s\S]*?)(<\/array>)/
      content = content.replace(arrayPattern, (_, open, body, close) => {
        if (!body.includes(`applinks:${domain}`)) body += `\n        ${applinksEntry}`
        if (!body.includes(`webcredentials:${domain}`)) body += `\n        ${webcredEntry}`
        return `${open}${body}${close}`
      })
    } else {
      // No associated-domains key — add it before </dict>
      const newSection =
        `    <key>com.apple.developer.associated-domains</key>\n` +
        `    <array>\n` +
        `        ${applinksEntry}\n` +
        `        ${webcredEntry}\n` +
        `    </array>\n`
      content = content.replace("</dict>", `${newSection}</dict>`)
    }

    fs.writeFileSync(entitlementsPath, content, "utf-8")
    spinner.succeed(`Updated entitlements with Associated Domains`)
  } catch (e) {
    spinner.fail("Failed to write entitlements file")
    throw e
  }
}

function buildEntitlementsContent(domain) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<plist version="1.0">\n` +
    `<dict>\n` +
    `    <key>com.apple.developer.associated-domains</key>\n` +
    `    <array>\n` +
    `        <string>applinks:${domain}</string>\n` +
    `        <string>webcredentials:${domain}</string>\n` +
    `    </array>\n` +
    `</dict>\n` +
    `</plist>\n`
  )
}
