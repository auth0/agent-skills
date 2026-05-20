#!/usr/bin/env node
/**
 * verify-setup.mjs — Post-setup validation for Auth0 Universal Components.
 *
 * Runs a battery of checks covering env vars, package installation, CSS
 * imports, provider hierarchy, middleware (Next.js), and theme integration.
 * Use --only theme during Step 6 for fast feedback while iterating on styles.
 *
 * Usage:
 *   node verify-setup.mjs --project-root <path> --framework nextjs|react-spa --css-path tailwind|scoped [--only theme|all]
 *
 * Each failed check returns a `fix` string describing the manual remediation,
 * and (where relevant) a `command` string pointing at a script that would
 * resolve it. Exit code is 0 even on failure — the agent inspects the JSON.
 *
 * Zero external dependencies.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    projectRoot: process.cwd(),
    framework: "react-spa",
    cssPath: "tailwind",
    only: "all",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-root" && args[i + 1]) opts.projectRoot = resolve(args[++i]);
    else if (args[i] === "--framework" && args[i + 1]) opts.framework = args[++i];
    else if (args[i] === "--css-path" && args[i + 1]) opts.cssPath = args[++i];
    else if (args[i] === "--only" && args[i + 1]) opts.only = args[++i];
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

const CSS_CANDIDATES = [
  "src/app/globals.css", "src/globals.css", "src/index.css", "src/styles.css",
  "src/app.css", "app/globals.css", "styles/globals.css",
];

const ENTRY_CANDIDATES_NEXTJS = [
  "src/app/layout.tsx", "src/app/layout.jsx", "app/layout.tsx", "app/layout.jsx",
  "src/app/providers.tsx", "src/app/providers.jsx",
  "src/providers.tsx", "src/providers.jsx",
  "src/components/providers.tsx",
  "src/lib/auth0-provider.tsx",
  "src/providers/client-provider.tsx", "src/providers/client-provider.jsx",
];

const ENTRY_CANDIDATES_SPA = [
  "src/main.tsx", "src/main.jsx", "src/main.js",
  "src/App.tsx", "src/App.jsx", "src/App.js",
  "src/providers.tsx", "src/providers.jsx", "src/providers/index.tsx",
  "src/components/providers.tsx",
];

const JS_ENTRY_CANDIDATES = [
  "src/main.tsx", "src/main.jsx", "src/main.js",
  "src/index.tsx", "src/index.jsx", "src/index.js",
  "src/App.tsx", "src/App.jsx",
];

// Locate the file that actually contains <Auth0ComponentProvider>. The agent
// usually doesn't need to know which file this is — we detect it.
function findProviderFile(root, framework) {
  const candidates = framework === "nextjs" ? ENTRY_CANDIDATES_NEXTJS : ENTRY_CANDIDATES_SPA;
  for (const f of candidates) {
    const content = readFile(join(root, f));
    if (content && content.includes("Auth0ComponentProvider")) return { path: f, content };
  }
  return { path: null, content: null };
}

// ---------- core checks (run regardless of --only) ----------

function checkEnvVars(root, framework) {
  const envPath = findFile(root, [".env.local", ".env"]);
  if (!envPath) return { name: "env_vars_present", pass: false, details: "No .env.local or .env file found", fix: "Create .env.local with AUTH0_DOMAIN, AUTH0_CLIENT_ID, and other required vars" };
  const content = readFile(join(root, envPath));
  const required = framework === "nextjs"
    ? ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"]
    : ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID"];
  const missing = required.filter((v) => {
    if (content.includes(v + "=")) return false;
    if (framework === "react-spa" && content.includes(`VITE_${v}=`)) return false;
    return true;
  });
  if (missing.length > 0) return { name: "env_vars_present", pass: false, details: `Missing env vars: ${missing.join(", ")}`, fix: `Add ${missing.join(", ")} to ${envPath}` };
  return { name: "env_vars_present", pass: true, details: `All required env vars found in ${envPath}` };
}

function checkPackagesInstalled(root) {
  const pkgPath = join(root, "node_modules", "@auth0", "universal-components-react", "package.json");
  if (fileExists(pkgPath)) return { name: "packages_installed", pass: true, details: "@auth0/universal-components-react found in node_modules" };
  const pkg = readFile(join(root, "package.json"));
  if (pkg && pkg.includes("@auth0/universal-components-react")) {
    return { name: "packages_installed", pass: false, details: "Package is in package.json but not in node_modules", fix: "Run your package manager's install command" };
  }
  return { name: "packages_installed", pass: false, details: "@auth0/universal-components-react not found", fix: "Install with: pnpm add @auth0/universal-components-react" };
}

function checkCssImport(root, cssPath) {
  const importStr = cssPath === "tailwind"
    ? "@auth0/universal-components-react/tailwind"
    : "@auth0/universal-components-react/styles";

  const cssFile = findFile(root, CSS_CANDIDATES);
  if (cssFile) {
    const content = readFile(join(root, cssFile));
    if (content && (content.includes(importStr) || content.includes("@auth0/universal-components-react/"))) {
      return { name: "css_import_exists", pass: true, details: `Found Auth0 stylesheet import in ${cssFile}` };
    }
  }

  for (const f of JS_ENTRY_CANDIDATES) {
    const content = readFile(join(root, f));
    if (content && (content.includes(importStr) || content.includes("@auth0/universal-components-react/"))) {
      return { name: "css_import_exists", pass: true, details: `Found Auth0 stylesheet import in ${f}` };
    }
  }

  const location = cssFile || "your main CSS or entry file";
  return {
    name: "css_import_exists",
    pass: false,
    details: `No Auth0 stylesheet import found`,
    fix: `Add \`import "${importStr}";\` to your entry file, or \`@import "${importStr}";\` to ${location}`,
  };
}

function checkProviderHierarchy(root, framework) {
  const candidates = framework === "nextjs" ? ENTRY_CANDIDATES_NEXTJS : ENTRY_CANDIDATES_SPA;
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
  if (content && (content.includes("auth0.middleware") || content.includes("auth0Middleware") || /auth0[\s\S]*middleware/i.test(content))) {
    return { name: "middleware_exists", pass: true, details: `${mw} exists with auth0 middleware` };
  }
  return { name: "middleware_exists", pass: false, details: `${mw} exists but doesn't reference Auth0 middleware`, fix: "Add Auth0 middleware (auth0.middleware(request)) to your middleware.ts" };
}

// ---------- theme checks ----------

const SCOPED_REQUIRED_VARS = [
  "--auth0-background",
  "--auth0-foreground",
  "--auth0-card",
  "--auth0-primary",
  "--auth0-border",
];

const TAILWIND_REQUIRED_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--primary",
  "--border",
];

const TAILWIND_REQUIRED_THEME_MAPPINGS = [
  "--color-background",
  "--color-foreground",
  "--color-primary",
  "--color-border",
];

function applyThemeCommand(framework, cssPath) {
  return `node <skill-path>/scripts/apply-theme.mjs --project-root . --css-file <main-css-file> --provider-file <provider-file> --css-path ${cssPath} --framework ${framework}`;
}

// Detects whether the CSS file contains a *complete* Auth0 override block.
// Just spotting `--primary` would be a false positive for shadcn projects.
function checkThemeCompleteSet(root, cssPath, framework) {
  const cssFile = findFile(root, CSS_CANDIDATES);
  if (!cssFile) {
    return {
      name: "theme_complete_set",
      pass: false,
      details: "No main CSS file detected",
      fix: "Create a main CSS file (src/index.css or similar) and run apply-theme.mjs",
      command: applyThemeCommand(framework, cssPath),
    };
  }
  const content = readFile(join(root, cssFile));
  const required = cssPath === "tailwind" ? TAILWIND_REQUIRED_VARS : SCOPED_REQUIRED_VARS;
  const missing = required.filter((v) => !content.includes(v + ":"));
  if (missing.length > 0) {
    return {
      name: "theme_complete_set",
      pass: false,
      details: `${cssFile} is missing required theme variables: ${missing.join(", ")}. Components will fall back to internal defaults (often dark) for any unset color.`,
      fix: `Run apply-theme.mjs to insert the full Auth0 override block, or add the missing variables to :root manually.`,
      command: applyThemeCommand(framework, cssPath),
    };
  }
  // Bonus: detect whether the managed block markers are present (gives the
  // agent confidence the block was generated, not hand-crafted with gaps).
  const hasManagedMarkers = /@auth0-universal-components:start/.test(content) && /@auth0-universal-components:end/.test(content);
  return {
    name: "theme_complete_set",
    pass: true,
    details: hasManagedMarkers
      ? `Managed Auth0 override block present in ${cssFile} with all required variables`
      : `All required theme variables present in ${cssFile} (no managed markers — block was applied manually)`,
  };
}

// Radius is the canary for "did the agent set themeSettings.variables" — CSS
// :root radius is silently overwritten by the [data-theme='default'] selector,
// so radius MUST live on the provider element. Color overrides via CSS still
// work, but if radius is missing from the provider, the styling is broken.
function checkThemeRadiusInProvider(root, framework, cssPath) {
  const provider = findProviderFile(root, framework);
  if (!provider.path) {
    return {
      name: "theme_radius_in_provider",
      pass: false,
      details: "Could not find the file containing <Auth0ComponentProvider>",
      fix: "Make sure Step 5 (framework setup) created the provider before running theme integration.",
      command: applyThemeCommand(framework, cssPath),
    };
  }
  const content = provider.content;
  // Look for `themeSettings={` first.
  if (!/themeSettings\s*=\s*\{/.test(content)) {
    return {
      name: "theme_radius_in_provider",
      pass: false,
      details: `${provider.path} has <Auth0ComponentProvider> but no themeSettings prop. Border radius and color overrides won't apply.`,
      fix: "Run apply-theme.mjs — it inserts the themeSettings prop with the extracted theme values.",
      command: applyThemeCommand(framework, cssPath),
    };
  }
  // Then `variables:` and at least one `--radius-` key.
  if (!/variables\s*:\s*\{/.test(content)) {
    return {
      name: "theme_radius_in_provider",
      pass: false,
      details: `themeSettings is set in ${provider.path} but no variables key was found. Radius overrides require themeSettings.variables.common.`,
      fix: "Run apply-theme.mjs to add the variables key with radius values.",
      command: applyThemeCommand(framework, cssPath),
    };
  }
  if (!/['"`]--radius-/.test(content)) {
    return {
      name: "theme_radius_in_provider",
      pass: false,
      details: `themeSettings.variables exists in ${provider.path} but no --radius-* keys are present. Radius values cannot be set via :root CSS — they must live on the provider.`,
      fix: "Run apply-theme.mjs (it places radius keys under variables.common).",
      command: applyThemeCommand(framework, cssPath),
    };
  }
  return {
    name: "theme_radius_in_provider",
    pass: true,
    details: `themeSettings.variables with --radius-* keys found in ${provider.path}`,
  };
}

function checkTailwindGlobalsImport(root) {
  const cssFile = findFile(root, CSS_CANDIDATES);
  if (!cssFile) return null;
  const content = readFile(join(root, cssFile));
  if (/@import\s+['"`]@auth0\/universal-components-core\/styles\/globals\.css['"`]/.test(content)) {
    return { name: "tailwind_globals_import", pass: true, details: `globals.css import found in ${cssFile}` };
  }
  return {
    name: "tailwind_globals_import",
    pass: false,
    details: `${cssFile} is missing \`@import "@auth0/universal-components-core/styles/globals.css"\`. Without it, Auth0's internal --color-* tokens won't resolve to your --background/--foreground/etc.`,
    fix: "Add the import after the other @import lines, or run apply-theme.mjs to insert it automatically.",
    command: applyThemeCommand("react-spa", "tailwind"),
  };
}

function checkTailwindThemeMapping(root) {
  const cssFile = findFile(root, CSS_CANDIDATES);
  if (!cssFile) return null;
  const content = readFile(join(root, cssFile));
  const themeMatch = content.match(/@theme\s+inline\s*\{([\s\S]*?)\}/);
  if (!themeMatch) {
    return {
      name: "tailwind_theme_mapping",
      pass: false,
      details: `${cssFile} has no \`@theme inline\` block. Tailwind utility classes (text-foreground, bg-card, etc.) won't see your bare CSS variables.`,
      fix: "Run apply-theme.mjs to insert the @theme inline block with --color-* mappings.",
      command: applyThemeCommand("react-spa", "tailwind"),
    };
  }
  const inner = themeMatch[1];
  const missing = TAILWIND_REQUIRED_THEME_MAPPINGS.filter((k) => !inner.includes(k));
  if (missing.length > 0) {
    return {
      name: "tailwind_theme_mapping",
      pass: false,
      details: `@theme inline block is missing required mappings: ${missing.join(", ")}.`,
      fix: "Run apply-theme.mjs — it adds missing keys without disturbing existing ones.",
      command: applyThemeCommand("react-spa", "tailwind"),
    };
  }
  return { name: "tailwind_theme_mapping", pass: true, details: "@theme inline block has all required --color-* mappings" };
}

// ---------- main ----------

const opts = parseArgs();
const checks = [];
const isThemeOnly = opts.only === "theme";

if (!isThemeOnly) {
  checks.push(checkEnvVars(opts.projectRoot, opts.framework));
  checks.push(checkPackagesInstalled(opts.projectRoot));
  checks.push(checkCssImport(opts.projectRoot, opts.cssPath));
  checks.push(checkProviderHierarchy(opts.projectRoot, opts.framework));
  const mw = checkMiddleware(opts.projectRoot, opts.framework);
  if (mw) checks.push(mw);
}

// Theme checks always run.
checks.push(checkThemeCompleteSet(opts.projectRoot, opts.cssPath, opts.framework));
checks.push(checkThemeRadiusInProvider(opts.projectRoot, opts.framework, opts.cssPath));
if (opts.cssPath === "tailwind") {
  const t1 = checkTailwindGlobalsImport(opts.projectRoot);
  if (t1) checks.push(t1);
  const t2 = checkTailwindThemeMapping(opts.projectRoot);
  if (t2) checks.push(t2);
}

const passCount = checks.filter((c) => c.pass).length;
const allPassed = passCount === checks.length;

const result = {
  status: "success",
  data: {
    mode: opts.only,
    checks,
    all_passed: allPassed,
    summary: `${passCount}/${checks.length} checks passed.${allPassed ? "" : " See `fix` and `command` fields on failing checks."}`,
  },
};
console.log(JSON.stringify(result, null, 2));
process.exit(0);
