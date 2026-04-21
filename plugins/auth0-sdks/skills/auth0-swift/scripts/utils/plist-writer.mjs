import fs from "node:fs"
import ora from "ora"

/**
 * Write Auth0.plist with ClientId and Domain.
 * Overwrites the file if it already exists.
 */
export async function writeAuth0Plist(domain, clientId, auth0PlistPath) {
  const spinner = ora("Writing Auth0.plist").start()

  try {
    const plist =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0">\n' +
      '<dict>\n' +
      '    <key>ClientId</key>\n' +
      `    <string>${clientId}</string>\n` +
      '    <key>Domain</key>\n' +
      `    <string>${domain}</string>\n` +
      '</dict>\n' +
      '</plist>\n'

    fs.writeFileSync(auth0PlistPath, plist, "utf-8")
    spinner.succeed(`Wrote ${auth0PlistPath}`)
  } catch (e) {
    spinner.fail("Failed to write Auth0.plist")
    throw e
  }
}
