#!/usr/bin/env node
/**
 * detect-stack.mjs — Detects project stack and outputs structured JSON.
 * Usage: node detect-stack.mjs [project-root]
 * Zero external dependencies.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.argv[2] || process.cwd());

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function fileExists(path) { return existsSync(path); }

function readFile(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function detectPackageManager() {
  if (fileExists(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(join(projectRoot, "bun.lockb")) || fileExists(join(projectRoot, "bun.lock"))) return "bun";
  if (fileExists(join(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

function detectFramework(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return "nextjs";
  return "react-spa";
}

function detectBuildTool(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.vite) return "vite";
  if (deps["react-scripts"]) return "cra";
  return "unknown";
}

function detectTailwind(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const tw = deps.tailwindcss;
  if (!tw) return { installed: false, version: null, major: null };
  const match = tw.match(/(\d+)/);
  const major = match ? parseInt(match[1], 10) : null;
  return { installed: true, version: tw.replace(/^[\^~]/, ""), major };
}

function detectCssPath(tailwind) {
  if (!tailwind.installed) return "scoped";
  return tailwind.major >= 4 ? "tailwind" : "scoped";
}

function detectTypescript() {
  return fileExists(join(projectRoot, "tsconfig.json"));
}

function detectShadcn() {
  const configPath = join(projectRoot, "components.json");
  const config = readJson(configPath);
  if (!config) return { installed: false, aliasPath: null };
  const aliasPath = config.aliases?.components || "@/components";
  return { installed: true, aliasPath };
}

function detectAuth0(pkg, envFile, framework) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  let sdkInstalled = null;
  if (deps["@auth0/nextjs-auth0"]) sdkInstalled = "@auth0/nextjs-auth0";
  else if (deps["@auth0/auth0-react"]) sdkInstalled = "@auth0/auth0-react";
  const universalComponentsInstalled = !!deps["@auth0/universal-components-react"];

  // Parse env file for existing tenant configuration
  const config = { domain: null, clientId: null, clientSecret: null };
  if (envFile) {
    const content = readFile(join(projectRoot, envFile));
    if (content) {
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eqIdx = trimmed.indexOf("=");
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!val || val.startsWith("<") || val.startsWith("your-") || val === "placeholder" || val === "xxx" || val === "changeme") continue;

        if (key === "AUTH0_DOMAIN" || key === "NEXT_PUBLIC_AUTH0_DOMAIN" || key === "VITE_AUTH0_DOMAIN") {
          config.domain = val;
        } else if (key === "AUTH0_CLIENT_ID" || key === "NEXT_PUBLIC_AUTH0_CLIENT_ID" || key === "VITE_AUTH0_CLIENT_ID") {
          config.clientId = val;
        } else if (key === "AUTH0_CLIENT_SECRET") {
          config.clientSecret = val;
        }
      }
    }
  }

  const configured = !!(config.domain && config.clientId);
  return { sdkInstalled, universalComponentsInstalled, configured, ...config };
}

function findFile(candidates) {
  for (const f of candidates) {
    if (fileExists(join(projectRoot, f))) return f;
  }
  return null;
}

function detectEntryFile(framework) {
  if (framework === "nextjs") {
    return findFile(["src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.js", "app/layout.tsx", "app/layout.jsx", "app/layout.js"]);
  }
  return findFile(["src/main.tsx", "src/main.jsx", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.js"]);
}

function detectMainCssFile() {
  return findFile([
    "src/app/globals.css", "src/globals.css", "src/index.css", "src/styles.css",
    "src/app.css", "app/globals.css", "styles/globals.css",
  ]);
}

function detectMiddleware() {
  return findFile(["src/middleware.ts", "src/middleware.js", "middleware.ts", "middleware.js"]);
}

function detectEnvFile(framework) {
  if (framework === "nextjs") return findFile([".env.local", ".env"]);
  return findFile([".env.local", ".env"]);
}

function detectExistingProviders(entryFile) {
  if (!entryFile) return [];
  const content = readFile(join(projectRoot, entryFile));
  if (!content) return [];
  const providers = [];
  if (content.includes("Auth0Provider")) providers.push("Auth0Provider");
  if (content.includes("Auth0ComponentProvider")) providers.push("Auth0ComponentProvider");
  if (content.includes("ThemeProvider")) providers.push("ThemeProvider");
  if (content.includes("SessionProvider")) providers.push("SessionProvider");
  return providers;
}

// --- Main ---

const pkg = readJson(join(projectRoot, "package.json"));
if (!pkg) {
  console.log(JSON.stringify({
    status: "error",
    error: { message: "No package.json found", code: "NO_PACKAGE_JSON", fallback_instructions: "Ensure you are running this script from a project root that contains a package.json file." },
  }));
  process.exit(1);
}

const framework = detectFramework(pkg);
const buildTool = detectBuildTool(pkg);
const tailwind = detectTailwind(pkg);
const cssPath = detectCssPath(tailwind);
const packageManager = detectPackageManager();
const typescript = detectTypescript();
const shadcn = detectShadcn();
const entryFile = detectEntryFile(framework);
const mainCssFile = detectMainCssFile();
const middlewareFile = framework === "nextjs" ? detectMiddleware() : null;
const envFile = detectEnvFile(framework);
const auth0 = detectAuth0(pkg, envFile, framework);
const existingProviders = detectExistingProviders(entryFile);

const installCmd = packageManager === "pnpm" ? "pnpm add" : packageManager === "bun" ? "bun add" : packageManager === "yarn" ? "yarn add" : "npm install";

console.log(JSON.stringify({
  status: "success",
  data: {
    framework,
    buildTool,
    tailwind,
    cssPath,
    packageManager,
    typescript,
    shadcn,
    auth0,
    installCmd,
    entryFile,
    mainCssFile,
    middlewareFile,
    envFile,
    existingProviders,
  },
}, null, 2));
