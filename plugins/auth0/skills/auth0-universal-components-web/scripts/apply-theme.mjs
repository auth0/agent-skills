#!/usr/bin/env node
/**
 * apply-theme.mjs — One-shot theme integration for Auth0 Universal Components.
 *
 * Calls extract-theme.mjs internally, then applies its output to the project:
 *   1. Inserts/replaces the managed Auth0 override block in the main CSS file
 *      (between /* @auth0-universal-components:start * / and /* :end * / markers).
 *   2. For Tailwind v4 (cssPath=tailwind): ensures
 *      `@import "@auth0/universal-components-core/styles/globals.css"` is present,
 *      and that an `@theme inline` block maps `--color-*` to the bare variables
 *      (only inserts missing keys; never clobbers existing mappings).
 *   3. Patches `<Auth0ComponentProvider>` so `themeSettings.variables` carries the
 *      generated radius (`common`) and color (`light`/`dark`) values. Replaces an
 *      empty placeholder safely; emits `needs-manual-merge` if the file already
 *      has user-defined variable overrides we shouldn't clobber.
 *
 * Usage:
 *   node apply-theme.mjs \
 *     --project-root <path> \
 *     --css-file <relative-path> \
 *     --provider-file <relative-path> \
 *     --css-path tailwind|scoped \
 *     --framework nextjs|react-spa
 *
 * Output: structured JSON describing what was changed and any manual steps left.
 * Zero external dependencies.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- args + io ----------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    projectRoot: process.cwd(),
    cssFile: null,
    providerFile: null,
    cssPath: "tailwind",
    framework: "react-spa",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-root" && args[i + 1]) opts.projectRoot = resolve(args[++i]);
    else if (args[i] === "--css-file" && args[i + 1]) opts.cssFile = args[++i];
    else if (args[i] === "--provider-file" && args[i + 1]) opts.providerFile = args[++i];
    else if (args[i] === "--css-path" && args[i + 1]) opts.cssPath = args[++i];
    else if (args[i] === "--framework" && args[i + 1]) opts.framework = args[++i];
  }
  return opts;
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "error" ? 1 : 0);
}

function readFile(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function writeFile(path, content) {
  writeFileSync(path, content, "utf-8");
}

// ---------- balanced-brace scanner ----------
// We scan JS/JSX expressions by hand because pulling in a parser would defeat
// the "zero external deps" rule. Strings, template literals, and escapes are
// handled so braces inside string values don't throw the depth count off.

function findMatchingClose(text, openIdx, openChar = "{", closeChar = "}") {
  let depth = 0;
  let inString = null;
  let escape = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (inString) {
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Find the `>` that ends a JSX opening tag, ignoring `>` chars buried inside
// prop expressions (`prop={a>b}`) or strings (`title=">"`).
function findOpeningTagEnd(text, tagStartIdx) {
  let i = tagStartIdx;
  let depthBrace = 0;
  let depthParen = 0;
  let inString = null;
  let escape = false;
  while (i < text.length) {
    const c = text[i];
    if (escape) { escape = false; i++; continue; }
    if (c === "\\") { escape = true; i++; continue; }
    if (inString) {
      if (c === inString) inString = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { inString = c; i++; continue; }
    if (c === "{") { depthBrace++; i++; continue; }
    if (c === "}") { depthBrace--; i++; continue; }
    if (c === "(") { depthParen++; i++; continue; }
    if (c === ")") { depthParen--; i++; continue; }
    if (c === ">" && depthBrace === 0 && depthParen === 0) return i;
    i++;
  }
  return -1;
}

// ---------- JS object literal serialization ----------
// We emit a JSX-friendly object literal (quoted CSS-var keys, no trailing
// commas after the closing brace).

function serializeJs(obj, indent) {
  if (obj === null || typeof obj !== "object") {
    if (typeof obj === "string") return `'${obj.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((v) => serializeJs(v, indent + "  ")).join(", ")}]`;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const lines = ["{"];
  for (const k of keys) {
    const keyStr = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : `'${k}'`;
    lines.push(`${indent}  ${keyStr}: ${serializeJs(obj[k], indent + "  ")},`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

// ---------- extract-theme runner ----------

function runExtractTheme(cssFileAbs, cssPath) {
  const stdout = execFileSync(
    "node",
    [join(__dirname, "extract-theme.mjs"), "--css-file", cssFileAbs, "--css-path", cssPath],
    { encoding: "utf-8" },
  );
  const parsed = JSON.parse(stdout);
  if (parsed.status !== "success") {
    throw new Error(`extract-theme failed: ${parsed.error?.message || "unknown"}`);
  }
  return parsed.data;
}

// ---------- CSS patching ----------
//
// Three things to keep in sync inside the CSS file:
//   - The managed Auth0 block (between :start and :end markers).
//   - For Tailwind v4: an `@import` of universal-components-core/styles/globals.css.
//   - For Tailwind v4: a `@theme inline` block mapping `--color-*` to bare vars
//     so Tailwind utility classes resolve to the same colors the components use.

const REQUIRED_TAILWIND_THEME_MAPPINGS = [
  ["--color-background", "--background"],
  ["--color-foreground", "--foreground"],
  ["--color-primary", "--primary"],
  ["--color-primary-foreground", "--primary-foreground"],
  ["--color-card", "--card"],
  ["--color-card-foreground", "--card-foreground"],
  ["--color-accent", "--accent"],
  ["--color-accent-foreground", "--accent-foreground"],
  ["--color-muted", "--muted"],
  ["--color-muted-foreground", "--muted-foreground"],
  ["--color-border", "--border"],
  ["--color-ring", "--ring"],
];

const REQUIRED_TAILWIND_IMPORTS = [
  '@import "tailwindcss";',
  '@import "@auth0/universal-components-react/tailwind";',
  '@import "@auth0/universal-components-core/styles/globals.css";',
];

const START_MARKER_RE = /\/\*\s*@auth0-universal-components:start[^*]*\*\//;
const END_MARKER_RE = /\/\*\s*@auth0-universal-components:end[^*]*\*\//;
// Legacy header from earlier iterations of this skill (no end marker).
const LEGACY_START_RE = /\/\*\s*Auth0 Universal Components[^*]*\*\//;

// Locate the existing managed block (or its legacy ancestor) so we can replace
// it in place. Returns null when no managed block exists yet.
function findManagedBlock(css) {
  const startMatch = css.match(START_MARKER_RE);
  if (startMatch) {
    const start = startMatch.index;
    const after = css.slice(start);
    const endMatch = after.match(END_MARKER_RE);
    if (endMatch) {
      return { start, end: start + endMatch.index + endMatch[0].length, format: "managed" };
    }
    // Has start marker but no end — fall through to bound by trailing :root/.dark
  }

  // Legacy block: anchor on the old comment, then consume the immediately
  // following :root and (optional) .dark blocks by brace-balancing.
  const legacy = css.match(LEGACY_START_RE);
  if (!legacy) return null;
  const start = legacy.index;
  let i = start + legacy[0].length;
  while (i < css.length && /\s/.test(css[i])) i++;
  if (!css.slice(i).startsWith(":root")) return null;
  const openRoot = css.indexOf("{", i);
  if (openRoot === -1) return null;
  const closeRoot = findMatchingClose(css, openRoot);
  if (closeRoot === -1) return null;
  let blockEnd = closeRoot + 1;
  let j = blockEnd;
  while (j < css.length && /\s/.test(css[j])) j++;
  if (css.slice(j).startsWith(".dark")) {
    const openDark = css.indexOf("{", j);
    if (openDark !== -1) {
      const closeDark = findMatchingClose(css, openDark);
      if (closeDark !== -1) blockEnd = closeDark + 1;
    }
  }
  return { start, end: blockEnd, format: "legacy" };
}

// Walks the CSS file and returns the byte position right after the last
// top-of-line `@import ... ;` statement. Returns 0 when no imports exist.
//
// We do this by hand instead of with a regex because a global regex like
// /(^|\n)\s*@import[^;]+;\s*/g consumes the trailing newline, which then
// breaks the next iteration's `(^|\n)` lookbehind — the second @import on the
// next line ends up unmatched and we silently lose track of where the import
// region ends. That bug surfaced as imports getting interleaved with the
// managed Auth0 block.
function findLastImportEndPosition(css) {
  let lastEnd = 0;
  let i = 0;
  while (i < css.length) {
    const idx = css.indexOf("@import", i);
    if (idx === -1) break;
    const lineStart = css.lastIndexOf("\n", idx) + 1;
    const prefix = css.slice(lineStart, idx);
    if (!/^\s*$/.test(prefix)) { i = idx + 1; continue; }
    const semi = css.indexOf(";", idx);
    if (semi === -1) break;
    lastEnd = semi + 1;
    i = semi + 1;
  }
  return lastEnd;
}

// Where the managed Auth0 block ought to sit when it doesn't exist yet:
// after `@theme inline` if present, otherwise after the last `@import`,
// otherwise at the top of the file. Keeping ordering predictable matters
// because a `:root` further down the file would otherwise win the cascade
// over our managed values.
function findInsertionAnchor(css) {
  const themeMatch = css.match(/@theme\s+inline\s*\{/);
  if (themeMatch) {
    const open = themeMatch.index + themeMatch[0].length - 1;
    const close = findMatchingClose(css, open);
    if (close !== -1) return close + 1;
  }
  return findLastImportEndPosition(css);
}

function applyManagedBlock(css, blockText) {
  const existing = findManagedBlock(css);
  if (existing) {
    return {
      content: css.slice(0, existing.start) + blockText + css.slice(existing.end),
      action: existing.format === "legacy" ? "replaced-legacy" : "replaced",
    };
  }
  const anchor = findInsertionAnchor(css);
  if (anchor > 0) {
    const before = css.slice(0, anchor);
    const after = css.slice(anchor);
    const sep = before.endsWith("\n") ? "" : "\n";
    const trail = after.startsWith("\n") ? "" : "\n";
    return { content: `${before}${sep}\n${blockText}${trail}${after}`, action: "inserted-after-imports" };
  }
  return { content: `${blockText}\n\n${css}`, action: "inserted-at-top" };
}

function ensureTailwindImports(css) {
  let updated = css;
  const inserted = [];
  for (const importLine of REQUIRED_TAILWIND_IMPORTS) {
    const pkg = importLine.match(/"([^"]+)"/)[1];
    const re = new RegExp(`@import\\s+['"\`]${pkg.replace(/[.*+?^${}()|[\\\]]/g, "\\$&")}['"\`]`);
    if (re.test(updated)) continue;
    const lastEnd = findLastImportEndPosition(updated);
    if (lastEnd > 0) {
      const before = updated.slice(0, lastEnd);
      const after = updated.slice(lastEnd);
      const sep = before.endsWith("\n") ? "" : "\n";
      const trail = after.startsWith("\n") ? "" : "\n";
      updated = `${before}${sep}${importLine}${trail}${after}`;
    } else {
      updated = importLine + "\n" + updated;
    }
    inserted.push(pkg);
  }
  return { content: updated, inserted };
}

// `@theme inline` is what makes the `--color-*` Tailwind utility names see the
// project's bare variables. Without these mappings, a project's --primary
// won't reach the Tailwind classes used inside Auth0 components.
function ensureThemeInline(css) {
  const themeRe = /@theme\s+inline\s*\{/;
  const themeMatch = css.match(themeRe);
  if (themeMatch) {
    const openIdx = themeMatch.index + themeMatch[0].length - 1;
    const closeIdx = findMatchingClose(css, openIdx);
    if (closeIdx === -1) return { content: css, action: "exists", missing: [] };
    const inner = css.slice(openIdx + 1, closeIdx);
    const missing = REQUIRED_TAILWIND_THEME_MAPPINGS.filter(([k]) => !inner.includes(k));
    if (missing.length === 0) return { content: css, action: "exists", missing: [] };
    const lines = missing.map(([k, v]) => `  ${k}: var(${v});`).join("\n");
    const indented = inner.endsWith("\n") ? inner : inner + "\n";
    const newInner = indented + lines + "\n";
    return {
      content: css.slice(0, openIdx + 1) + newInner + css.slice(closeIdx),
      action: "appended-missing-keys",
      missing: missing.map(([k]) => k),
    };
  }
  // No `@theme inline` block. Insert one right after the last @import so it
  // sits between the import region and any :root blocks (managed or original).
  const block = ["@theme inline {"];
  for (const [k, v] of REQUIRED_TAILWIND_THEME_MAPPINGS) block.push(`  ${k}: var(${v});`);
  block.push("}");
  const insertText = block.join("\n");
  const lastImportEnd = findLastImportEndPosition(css);
  if (lastImportEnd > 0) {
    const before = css.slice(0, lastImportEnd);
    const after = css.slice(lastImportEnd);
    const sep = before.endsWith("\n") ? "" : "\n";
    const trail = after.startsWith("\n") ? "" : "\n";
    return {
      content: `${before}${sep}\n${insertText}${trail}${after}`,
      action: "inserted-after-imports",
      missing: REQUIRED_TAILWIND_THEME_MAPPINGS.map(([k]) => k),
    };
  }
  return {
    content: insertText + "\n\n" + css,
    action: "prepended",
    missing: REQUIRED_TAILWIND_THEME_MAPPINGS.map(([k]) => k),
  };
}

// ---------- Provider patching ----------
//
// Goal: ensure the Auth0ComponentProvider element receives a
//   themeSettings={{ ..., variables: { common: {...}, light: {...}, dark?: {...} } }}
// configuration that includes the radius+color values from extract-theme.
//
// We avoid a real JSX parser. Instead we (1) locate the opening tag span, (2)
// look for `themeSettings={` inside it, (3) look for `variables:` inside that,
// and patch the smallest possible region. If `variables` already has user
// content, we step back and emit needs-manual-merge so we don't clobber it.

// We tag the variables object with this comment when we write it, so a second
// apply-theme run can recognize "the agent's previous output" and replace it
// safely. Without this, repeated runs would always fall through to
// needs-manual-merge once any '--key' was written.
const MANAGED_VARIABLES_MARKER = "@auth0-universal-components:managed";
const MANAGED_VARIABLES_COMMENT = `/* ${MANAGED_VARIABLES_MARKER} — re-run apply-theme.mjs to refresh; remove this comment if you start customizing by hand */`;

function variablesObjIsManagedOrEmpty(content) {
  if (content.includes(MANAGED_VARIABLES_MARKER)) return true;
  // "Empty" = whitespace + comments + structural braces + the bare key
  // `common: {}` placeholder. Anything else (a `'--foo'` key for instance)
  // means the user has put real overrides in.
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return !/['"`]--/.test(stripped);
}

// Inject the managed-marker comment as the first thing inside the variables
// object literal, indented to match the surrounding object body.
function withManagedMarker(serialized, indent) {
  return serialized.replace(/^\{\n/, `{\n${indent}  ${MANAGED_VARIABLES_COMMENT}\n`);
}

// Returns the indentation (run of leading whitespace) of the line containing
// the byte at `abs`. Used so each insertion lines up with surrounding code.
function getLineIndent(content, abs) {
  let i = abs;
  while (i > 0 && content[i - 1] !== "\n") i--;
  let indent = "";
  while (i < abs && (content[i] === " " || content[i] === "\t")) {
    indent += content[i];
    i++;
  }
  return indent;
}

function patchProvider(content, themeSettingsVariables, framework) {
  const tagStart = content.indexOf("<Auth0ComponentProvider");
  if (tagStart === -1) {
    return { content, action: "not-found", details: "<Auth0ComponentProvider> not found in file" };
  }
  const tagEndGt = findOpeningTagEnd(content, tagStart);
  if (tagEndGt === -1) {
    return { content, action: "error", details: "Could not find end of <Auth0ComponentProvider> opening tag" };
  }
  const tagSpan = content.slice(tagStart, tagEndGt + 1);

  const tsMatch = /themeSettings\s*=\s*\{/g.exec(tagSpan);

  // Case A: no themeSettings prop at all. Splice one in just after the last
  // non-whitespace character before the closing `>`. The original whitespace
  // (newline + indent + `>`) is preserved so the closing tag stays aligned.
  if (!tsMatch) {
    const propIndent = getLineIndent(content, tagStart) + "  ";
    let insertAt = tagEndGt;
    if (content[insertAt - 1] === "/") insertAt--;
    while (insertAt > tagStart && /\s/.test(content[insertAt - 1])) insertAt--;
    const variablesText = withManagedMarker(serializeJs(themeSettingsVariables, propIndent + "  "), propIndent + "  ");
    const block =
      `\n${propIndent}themeSettings={{` +
      `\n${propIndent}  theme: 'default',` +
      `\n${propIndent}  mode: isDarkMode ? 'dark' : 'light',` +
      `\n${propIndent}  variables: ${variablesText},` +
      `\n${propIndent}}}`;
    return {
      content: content.slice(0, insertAt) + block + content.slice(insertAt),
      action: "inserted-themeSettings",
      details: "Inserted full themeSettings prop. If your app doesn't already define `isDarkMode`, replace it with `'light'` or your theme hook.",
    };
  }

  const tsBraceOpen = tagStart + tsMatch.index + tsMatch[0].length - 1;
  const tsBraceClose = findMatchingClose(content, tsBraceOpen);
  if (tsBraceClose === -1) {
    return { content, action: "error", details: "Could not find closing `}` of themeSettings expression" };
  }
  const tsExpression = content.slice(tsBraceOpen + 1, tsBraceClose);
  const varMatchRel = /(^|[\s,{])variables\s*:\s*\{/.exec(tsExpression);

  // Case B: themeSettings exists but has no `variables` key. We want to splice
  // a new key into the themeSettings *object literal*, not the outer JSX
  // expression brace. So we descend one level: skip whitespace after the JSX
  // `{`, and if the next non-space char is another `{`, that's the literal we
  // need to operate on. (Anything else — say `themeSettings={someVar}` — we
  // can't safely patch and we hand it off as a manual merge.)
  if (!varMatchRel) {
    let inner = tsBraceOpen + 1;
    while (inner < tsBraceClose && /\s/.test(content[inner])) inner++;
    if (content[inner] !== "{") {
      return {
        content,
        action: "needs-manual-merge",
        details: "themeSettings is not an inline object literal (can't auto-add `variables`). Add the proposed object yourself.",
        proposed: themeSettingsVariables,
      };
    }
    const objOpen = inner;
    const objClose = findMatchingClose(content, objOpen);
    if (objClose === -1) {
      return { content, action: "error", details: "Could not find closing `}` of themeSettings object literal" };
    }
    const innerIndent = getLineIndent(content, objOpen) + "  ";
    let j = objClose - 1;
    while (j > objOpen && /\s/.test(content[j])) j--;
    const needsComma = content[j] !== "," && content[j] !== "{";
    const variablesText = withManagedMarker(serializeJs(themeSettingsVariables, innerIndent), innerIndent);
    const insertion = `${needsComma ? "," : ""}\n${innerIndent}variables: ${variablesText},`;
    return {
      content: content.slice(0, j + 1) + insertion + content.slice(j + 1),
      action: "inserted-variables",
      details: "Added `variables` key to existing themeSettings object literal.",
    };
  }

  // Case C: a `variables` key already exists. Resolve absolute positions of
  // both the keyword and the inner braces so we can either replace the whole
  // key cleanly (when the existing value is just a placeholder) or bow out
  // and ask the agent to merge by hand.
  const variablesKeywordRelStart = tsExpression.indexOf("variables", varMatchRel.index);
  const varKeyAbsStart = tsBraceOpen + 1 + variablesKeywordRelStart;
  const variablesBraceOpen = tsBraceOpen + 1 + varMatchRel.index + varMatchRel[0].length - 1;
  const variablesBraceClose = findMatchingClose(content, variablesBraceOpen);
  if (variablesBraceClose === -1) {
    return { content, action: "error", details: "Could not find closing `}` of variables object" };
  }

  const existingVars = content.slice(variablesBraceOpen + 1, variablesBraceClose);
  if (!variablesObjIsManagedOrEmpty(existingVars)) {
    return {
      content,
      action: "needs-manual-merge",
      details: "Existing `themeSettings.variables` already contains user overrides. Merge the proposed object manually so we don't clobber your customizations.",
      proposed: themeSettingsVariables,
    };
  }

  // Replace from the start of the `variables` keyword through the matching
  // closing brace. We do NOT touch the trailing comma (or its absence) — that
  // way the surrounding object structure stays intact.
  const lineIndent = getLineIndent(content, varKeyAbsStart);
  const replacement = `variables: ${withManagedMarker(serializeJs(themeSettingsVariables, lineIndent), lineIndent)}`;
  return {
    content: content.slice(0, varKeyAbsStart) + replacement + content.slice(variablesBraceClose + 1),
    action: "replaced-variables",
    details: "Replaced empty `variables` placeholder with extracted theme values.",
  };
}

// ---------- main ----------

const opts = parseArgs();

if (!opts.cssFile) {
  output({ status: "error", error: { message: "--css-file is required", code: "MISSING_CSS_FILE" } });
}

// If the agent didn't pass --provider-file, scan the usual locations for the
// file containing <Auth0ComponentProvider>. Mirrors the verify-setup logic so
// the two scripts agree on which file to look at.
const PROVIDER_CANDIDATES_NEXTJS = [
  "src/providers/client-provider.tsx", "src/providers/client-provider.jsx",
  "src/app/providers.tsx", "src/app/providers.jsx",
  "src/providers.tsx", "src/providers.jsx",
  "src/components/providers.tsx",
  "src/lib/auth0-provider.tsx",
  "src/app/layout.tsx", "src/app/layout.jsx", "app/layout.tsx", "app/layout.jsx",
];
const PROVIDER_CANDIDATES_SPA = [
  "src/App.tsx", "src/App.jsx", "src/App.js",
  "src/main.tsx", "src/main.jsx", "src/main.js",
  "src/providers.tsx", "src/providers.jsx", "src/providers/index.tsx",
  "src/components/providers.tsx",
];

if (!opts.providerFile) {
  const candidates = opts.framework === "nextjs" ? PROVIDER_CANDIDATES_NEXTJS : PROVIDER_CANDIDATES_SPA;
  for (const c of candidates) {
    const abs = resolve(opts.projectRoot, c);
    if (existsSync(abs)) {
      const text = readFile(abs);
      if (text && text.includes("Auth0ComponentProvider")) { opts.providerFile = c; break; }
    }
  }
  if (!opts.providerFile) {
    output({
      status: "error",
      error: {
        message: "Could not auto-detect a file containing <Auth0ComponentProvider>. Pass --provider-file explicitly.",
        code: "PROVIDER_FILE_NOT_FOUND",
        fallback_instructions: "Find the file where you wrap children with <Auth0ComponentProvider> and pass it as --provider-file <relative-path>.",
      },
    });
  }
}

const cssFileAbs = resolve(opts.projectRoot, opts.cssFile);
const providerFileAbs = resolve(opts.projectRoot, opts.providerFile);

if (!existsSync(cssFileAbs)) {
  output({ status: "error", error: { message: `CSS file not found: ${cssFileAbs}`, code: "CSS_FILE_NOT_FOUND" } });
}
if (!existsSync(providerFileAbs)) {
  output({ status: "error", error: { message: `Provider file not found: ${providerFileAbs}`, code: "PROVIDER_FILE_NOT_FOUND" } });
}

let theme;
try {
  theme = runExtractTheme(cssFileAbs, opts.cssPath);
} catch (e) {
  output({
    status: "error",
    error: {
      message: e.message,
      code: "EXTRACT_THEME_FAILED",
      fallback_instructions: "Run extract-theme.mjs directly and inspect its error output.",
    },
  });
}

// ----- CSS work -----
//
// Order matters: we run imports → @theme inline → managed block. Each step
// uses the file's current state (and shared anchor logic) to find a sane
// insertion point. Doing the managed block last lets it land directly under
// the @theme inline block when one was just added.

let css = readFile(cssFileAbs);
const cssActions = {};

if (opts.cssPath === "tailwind") {
  const importsResult = ensureTailwindImports(css);
  css = importsResult.content;
  cssActions.tailwindImports = importsResult.inserted.length > 0
    ? { action: "inserted", inserted: importsResult.inserted }
    : { action: "exists", inserted: [] };

  const themeInlineResult = ensureThemeInline(css);
  css = themeInlineResult.content;
  cssActions.tailwindThemeMapping = {
    action: themeInlineResult.action,
    addedKeys: themeInlineResult.missing,
  };
} else {
  cssActions.tailwindImports = { action: "n/a" };
  cssActions.tailwindThemeMapping = { action: "n/a" };
}

const blockResult = applyManagedBlock(css, theme.generatedOverrideBlock);
css = blockResult.content;
cssActions.auth0Block = { action: blockResult.action, details: `Managed block ${blockResult.action} in ${opts.cssFile}` };

writeFile(cssFileAbs, css);

// ----- Provider work -----

const providerOriginal = readFile(providerFileAbs);
const providerResult = patchProvider(providerOriginal, theme.themeSettingsVariables, opts.framework);
const manualSteps = [];

if (providerResult.action === "needs-manual-merge") {
  manualSteps.push(
    `Open ${opts.providerFile} and merge the following object into themeSettings.variables (overlay common/light/dark keys, do not drop your existing overrides):\n${serializeJs(providerResult.proposed, "")}`,
  );
} else if (providerResult.action === "not-found") {
  manualSteps.push(
    `<Auth0ComponentProvider> was not found in ${opts.providerFile}. Make sure Step 5 (framework setup) created the provider, then re-run this script — or pass the correct --provider-file path.`,
  );
} else if (providerResult.action === "error") {
  manualSteps.push(
    `Could not auto-patch ${opts.providerFile}: ${providerResult.details}. Set themeSettings.variables manually using:\n${serializeJs(theme.themeSettingsVariables, "")}`,
  );
} else {
  writeFile(providerFileAbs, providerResult.content);
}

// ----- Output -----

const overallStatus = manualSteps.length > 0 ? "partial" : "success";

output({
  status: overallStatus,
  data: {
    css: {
      file: opts.cssFile,
      ...cssActions,
    },
    provider: {
      file: opts.providerFile,
      themeSettings: { action: providerResult.action, details: providerResult.details },
    },
    appliedColors: theme.colors,
    appliedRadii: theme.radii,
    darkMode: theme.darkMode,
    themeSettingsVariables: theme.themeSettingsVariables,
    manualSteps,
    nextStep: "Run `node <skill-path>/scripts/verify-setup.mjs --only theme --project-root <root> --framework <fw> --css-path <css>` to confirm everything applied.",
  },
});
