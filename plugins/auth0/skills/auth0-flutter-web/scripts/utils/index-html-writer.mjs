import fs from "node:fs"
import ora from "ora"

const AUTH0_SPA_JS_SCRIPT = '<script src="https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js" defer></script>'

/**
 * Add Auth0 SPA JS script tag to web/index.html if not already present.
 */
export function writeIndexHtmlScript(indexHtmlPath) {
  const spinner = ora("Adding Auth0 SPA JS to web/index.html").start()

  if (!fs.existsSync(indexHtmlPath)) {
    spinner.fail(`web/index.html not found at: ${indexHtmlPath}`)
    console.error("\n  Run 'flutter create . --platforms=web' to add web support.\n")
    process.exit(1)
  }

  let content = fs.readFileSync(indexHtmlPath, "utf-8")

  if (content.includes("auth0-spa-js")) {
    spinner.succeed("Auth0 SPA JS already present in web/index.html")
    return
  }

  // Insert before </head>
  const headCloseIndex = content.indexOf("</head>")
  if (headCloseIndex === -1) {
    spinner.fail("Could not find </head> tag in web/index.html")
    process.exit(1)
  }

  const indent = "  "
  content =
    content.slice(0, headCloseIndex) +
    `${indent}${AUTH0_SPA_JS_SCRIPT}\n` +
    content.slice(headCloseIndex)

  fs.writeFileSync(indexHtmlPath, content, "utf-8")
  spinner.succeed("Added Auth0 SPA JS script to web/index.html")
}
