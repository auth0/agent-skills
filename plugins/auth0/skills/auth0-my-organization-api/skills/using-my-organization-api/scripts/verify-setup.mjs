#!/usr/bin/env node
/**
 * verify-setup.mjs — Post-setup validation for Auth0 Universal Components integration.
 * Usage: node verify-setup.mjs --project-root <path> --framework nextjs|react-spa --css-path tailwind|scoped
 * Zero external dependencies.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { projectRoot: process.cwd(), framework: "react-spa", cssPath: "tailwind" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-root" && args[i + 1]) opts.projectRoot = resolve(args[++i]);
    else if (args[i] === "--framework" && args[i + 1]) opts.framework = args[++i];
    else if (args[i] === "--css-path" && args[i + 1]) opts.cssPath = args[++i];
  }
  return opts;
}

function readFile(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function fileExists(path) { return existsSync(path); }

function findFile(root, candidates) {
  for (const f of candidates) {
    if (fileExists(join(root, f))) return f;
  }
  return null;
}

function checkEnvVars(root, framework) {
  const envPath = findFile(root, [".env.local", ".env"]);
  if (!envPath) return { name: "env_vars_present", pass: false, details: "No .env.local or .env file found", fix: "Create .env.local with AUTH0_DOMAIN, AUTH0_CLIENT_ID, and other required vars" };
  const content = readFile(join(root, envPath));
  const required = framework === "nextjs"
    ? ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"]
    : ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID"];
  // Also check VITE_ prefixed vars for react-spa
  const missing = required.filter((v) => {
    if (content.includes(v + "=")) return false;
    if (framework === "react-spa" && content.includes("VITE_" + v.replace("AUTH0_", "AUTH0_") + "=")) return false;
    if (framework === "react-spa" && content.includes(`VITE_${v}=`)) return false;
    return true;
  });
  if (missing.length > 0) return { name: "env_vars_present", pass: false, details: `Missing env vars: ${missing.join(", ")}`, fix: `Add ${missing.join(", ")} to ${envPath}` };
  return { name: "env_vars_present", pass: true, details: `All required env vars found in ${envPath}` };
}

function checkPackagesInstalled(root) {
  const pkgPath = join(root, "node_modules", "@auth0", "universal-components-react", "package.json");
  if (fileExists(pkgPath)) return { name: "packages_installed", pass: true, details: "@auth0/universal-components-react found in node_modules" };
  // Check if it's in package.json at least
  const pkg = readFile(join(root, "package.json"));
  if (pkg && pkg.includes("@auth0/universal-components-react")) {
    return { name: "packages_installed", pass: false, details: "Package is in package.json but not in node_modules", fix: "Run your package manager's install command" };
  }
  return { name: "packages_installed", pass: false, details: "@auth0/universal-components-react not found", fix: "Install with: npm install @auth0/universal-components-react" };
}

function checkCssImport(root, cssPath) {
  const importStr = cssPath === "tailwind"
    ? "@auth0/universal-components-react/tailwind"
    : "@auth0/universal-components-react/styles";

  // Check CSS files for @import
  const cssFile = findFile(root, [
    "src/app/globals.css", "src/globals.css", "src/index.css", "src/styles.css",
    "src/app.css", "app/globals.css", "styles/globals.css",
  ]);
  if (cssFile) {
    const content = readFile(join(root, cssFile));
    if (content && (content.includes(importStr) || content.includes("@auth0/universal-components-react/"))) {
      return { name: "css_import_exists", pass: true, details: `Found Auth0 stylesheet import in ${cssFile}` };
    }
  }

  // Check JS/TS entry files for import statement (e.g., import "@auth0/.../styles")
  const jsFiles = ["src/main.tsx", "src/main.jsx", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.js", "src/App.tsx", "src/App.jsx"];
  for (const f of jsFiles) {
    const content = readFile(join(root, f));
    if (content && (content.includes(importStr) || content.includes("@auth0/universal-components-react/"))) {
      return { name: "css_import_exists", pass: true, details: `Found Auth0 stylesheet import in ${f}` };
    }
  }

  const location = cssFile || "your main CSS or entry file";
  return { name: "css_import_exists", pass: false, details: `No Auth0 stylesheet import found`, fix: `Add \`import "${importStr}";\` to your entry file, or \`@import "${importStr}";\` to ${location}` };
}

function checkProviderHierarchy(root, framework) {
  // Scan all likely files where providers could be placed
  const candidates = framework === "nextjs"
    ? ["src/app/layout.tsx", "src/app/layout.jsx", "app/layout.tsx", "app/layout.jsx",
       "src/app/providers.tsx", "src/app/providers.jsx", "src/providers.tsx", "src/providers.jsx",
       "src/components/providers.tsx", "src/lib/auth0-provider.tsx"]
    : ["src/main.tsx", "src/main.jsx", "src/main.js", "src/App.tsx", "src/App.jsx", "src/App.js",
       "src/providers.tsx", "src/providers.jsx", "src/providers/index.tsx",
       "src/components/providers.tsx", "src/lib/auth0-provider.tsx"];

  let hasAuth0Provider = false;
  let hasComponentProvider = false;
  let filesChecked = 0;

  for (const f of candidates) {
    const content = readFile(join(root, f));
    if (!content) continue;
    filesChecked++;
    if (content.includes("Auth0Provider") || content.includes("auth0Provider")) hasAuth0Provider = true;
    if (content.includes("Auth0ComponentProvider")) hasComponentProvider = true;
  }

  if (filesChecked === 0) return { name: "provider_hierarchy", pass: false, details: "No entry/layout files found", fix: "Create the entry file with Auth0Provider and Auth0ComponentProvider" };
  if (hasAuth0Provider && hasComponentProvider) return { name: "provider_hierarchy", pass: true, details: "Auth0Provider and Auth0ComponentProvider found" };
  if (hasAuth0Provider && !hasComponentProvider) return { name: "provider_hierarchy", pass: false, details: "Auth0Provider found but Auth0ComponentProvider is missing", fix: "Wrap your components with Auth0ComponentProvider inside Auth0Provider" };
  return { name: "provider_hierarchy", pass: false, details: "Auth0Provider not found in entry files", fix: "Add Auth0Provider wrapping Auth0ComponentProvider in your app entry" };
}

function checkMiddleware(root, framework) {
  if (framework !== "nextjs") return null;
  const mw = findFile(root, ["src/middleware.ts", "src/middleware.js", "middleware.ts", "middleware.js"]);
  if (!mw) return { name: "middleware_exists", pass: false, details: "No middleware file found", fix: "Create src/middleware.ts with Auth0 middleware configuration" };
  const content = readFile(join(root, mw));
  if (content && (content.includes("auth0") || content.includes("Auth0"))) {
    return { name: "middleware_exists", pass: true, details: `${mw} exists with auth0 middleware` };
  }
  return { name: "middleware_exists", pass: false, details: `${mw} exists but doesn't reference Auth0`, fix: "Add Auth0 middleware to your middleware.ts" };
}

function checkThemeVariables(root) {
  const cssFile = findFile(root, [
    "src/app/globals.css", "src/globals.css", "src/index.css", "src/styles.css",
    "src/app.css", "app/globals.css", "styles/globals.css",
  ]);
  if (!cssFile) return { name: "theme_variables_set", pass: false, details: "No CSS file to check for theme variables", fix: "Add --primary override to your main CSS file's :root block" };
  const content = readFile(join(root, cssFile));
  if (content && (content.includes("--primary") || content.includes("--auth0-primary"))) {
    return { name: "theme_variables_set", pass: true, details: "Primary color override found in CSS" };
  }
  return { name: "theme_variables_set", pass: false, details: "No --primary override found in CSS. Components will use Auth0 defaults.", fix: "Add `--primary: <your-brand-color>;` to :root in your main CSS file" };
}

// --- Main ---

const opts = parseArgs();
const checks = [];

checks.push(checkEnvVars(opts.projectRoot, opts.framework));
checks.push(checkPackagesInstalled(opts.projectRoot));
checks.push(checkCssImport(opts.projectRoot, opts.cssPath));
checks.push(checkProviderHierarchy(opts.projectRoot, opts.framework));
const mwCheck = checkMiddleware(opts.projectRoot, opts.framework);
if (mwCheck) checks.push(mwCheck);
checks.push(checkThemeVariables(opts.projectRoot));

const allPassed = checks.every((c) => c.pass);
const passCount = checks.filter((c) => c.pass).length;

const result = {
  status: "success",
  data: {
    checks,
    all_passed: allPassed,
    summary: `${passCount}/${checks.length} checks passed.${allPassed ? "" : " See 'fix' field for failures."}`,
  },
};

console.log(JSON.stringify(result, null, 2));
process.exit(0);
