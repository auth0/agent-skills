#!/usr/bin/env node
/**
 * extract-theme.mjs — Extracts CSS variables from a project's stylesheet and generates
 * a COMPLETE Auth0 override block. Variables that can't be auto-detected get sensible
 * defaults derived from what IS detected (e.g., primary color informs ring color).
 *
 * Usage: node extract-theme.mjs --css-file <path> --css-path tailwind|scoped
 * Zero external dependencies.
 */
import { readFileSync } from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { cssFile: null, cssPath: "tailwind" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--css-file" && args[i + 1]) opts.cssFile = args[++i];
    else if (args[i] === "--css-path" && args[i + 1]) opts.cssPath = args[++i];
  }
  return opts;
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
}

/**
 * Extracts the content of a top-level block by balancing braces.
 */
function extractBlockContent(css, prefix) {
  const results = [];
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped + "\\s*\\{", "g");
  let match;
  while ((match = regex.exec(css)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    if (depth === 0) {
      results.push(css.slice(start, i - 1));
    }
  }
  return results;
}

function parseVarsFromBlock(block) {
  const vars = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = varRegex.exec(block)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function parseCssBlock(css, selector) {
  const blocks = extractBlockContent(css, selector);
  let vars = {};
  for (const block of blocks) {
    Object.assign(vars, parseVarsFromBlock(block));
  }
  return vars;
}

function parseThemeBlocks(css) {
  const vars = {};
  const regex = /@theme(?:\s+inline)?\s*\{/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    if (depth === 0) {
      Object.assign(vars, parseVarsFromBlock(css.slice(start, i - 1)));
    }
  }
  return vars;
}

// --- Color detection targets ---
const TARGET_COLORS = [
  "primary", "primary-foreground", "background", "foreground", "border",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "card", "card-foreground", "popover", "popover-foreground", "input", "ring",
];

const TARGET_RADII = ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-2xl"];

// Light mode defaults (from official Auth0 docs)
const LIGHT_DEFAULTS = {
  "primary": "oklch(37% 0 0)",
  "primary-foreground": "oklch(100% 0 0)",
  "background": "oklch(100% 0 0)",
  "foreground": "oklch(9% 0 0)",
  "card": "oklch(100% 0 0)",
  "card-foreground": "oklch(0% 0 0)",
  "popover": "oklch(100% 0 0)",
  "popover-foreground": "oklch(9% 0 0)",
  "input": "oklch(100% 0 0)",
  "secondary": "oklch(96% 0 0)",
  "secondary-foreground": "oklch(9% 0 0)",
  "muted": "oklch(96% 0 0)",
  "muted-foreground": "oklch(45% 0 0)",
  "accent": "oklch(97% 0 0)",
  "accent-foreground": "oklch(9% 0 0)",
  "destructive": "oklch(93% 0.03 17)",
  "destructive-foreground": "oklch(100% 0 0)",
  "border": "oklch(89% 0 0)",
  "ring": "oklch(89% 0 0)",
};

// Dark mode defaults
const DARK_DEFAULTS = {
  "primary": "oklch(70% 0.15 250)",
  "primary-foreground": "oklch(10% 0 0)",
  "background": "oklch(12% 0 0)",
  "foreground": "oklch(95% 0 0)",
  "card": "oklch(15% 0 0)",
  "card-foreground": "oklch(95% 0 0)",
  "popover": "oklch(15% 0 0)",
  "popover-foreground": "oklch(95% 0 0)",
  "input": "oklch(18% 0 0)",
  "secondary": "oklch(20% 0 0)",
  "secondary-foreground": "oklch(95% 0 0)",
  "muted": "oklch(20% 0 0)",
  "muted-foreground": "oklch(60% 0 0)",
  "accent": "oklch(25% 0 0)",
  "accent-foreground": "oklch(95% 0 0)",
  "destructive": "oklch(30% 0.15 17)",
  "destructive-foreground": "oklch(95% 0 0)",
  "border": "oklch(25% 0 0)",
  "ring": "oklch(35% 0 0)",
};

const RADII_DEFAULTS = {
  "radius-sm": "4px",
  "radius-md": "6px",
  "radius-lg": "10px",
  "radius-xl": "12px",
  "radius-2xl": "16px",
};

/**
 * Maps discovered CSS variables to Auth0 target names.
 * Handles: --primary, --color-primary, --clr-primary, --c-primary
 */
function mapVariables(allVars, targets) {
  const mapped = {};
  const prefixes = ["", "color-", "clr-", "c-"];

  for (const target of targets) {
    if (allVars[`--${target}`]) {
      mapped[target] = allVars[`--${target}`];
      continue;
    }
    for (const prefix of prefixes) {
      if (prefix === "") continue;
      const key = `--${prefix}${target}`;
      if (allVars[key]) {
        mapped[target] = allVars[key];
        break;
      }
    }
  }
  return mapped;
}

/**
 * Maps radius variables with shadcn base --radius fallback.
 */
function mapRadii(allVars) {
  const mapped = mapVariables(allVars, TARGET_RADII);
  if (Object.keys(mapped).length > 0) return mapped;

  const baseRadius = allVars["--radius"];
  if (baseRadius) {
    const baseVal = parseFloat(baseRadius);
    const unit = baseRadius.replace(/[\d.]+/, "");
    if (!isNaN(baseVal)) {
      const scale = unit === "rem" ? baseVal * 16 : baseVal;
      mapped["radius-sm"] = `${Math.max(scale - 4, 0)}${unit === "rem" ? "px" : unit}`;
      mapped["radius-md"] = `${Math.max(scale - 2, 0)}${unit === "rem" ? "px" : unit}`;
      mapped["radius-lg"] = baseRadius;
      mapped["radius-xl"] = `${scale + 4}${unit === "rem" ? "px" : unit}`;
      mapped["radius-2xl"] = `${scale + 6}${unit === "rem" ? "px" : unit}`;
    }
  }
  return mapped;
}

/**
 * Merges detected variables with defaults so the output is ALWAYS complete.
 * Detected values override defaults.
 */
function fillDefaults(detected, defaults) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(detected)) {
    result[key] = value;
  }
  return result;
}

function generateOverrideBlock(colors, cssPath, darkColors, hasDarkMode) {
  const lines = ["/* Auth0 Universal Components — apply this entire block verbatim */", ":root {"];

  if (cssPath === "tailwind") {
    for (const [name, value] of Object.entries(colors)) {
      lines.push(`  --${name}: ${value};`);
    }
  } else {
    for (const [name, value] of Object.entries(colors)) {
      lines.push(`  --auth0-${name}: ${value};`);
    }
  }
  lines.push("}");

  if (hasDarkMode && Object.keys(darkColors).length > 0) {
    lines.push("");
    lines.push(".dark {");
    if (cssPath === "tailwind") {
      for (const [name, value] of Object.entries(darkColors)) {
        lines.push(`  --${name}: ${value};`);
      }
    } else {
      for (const [name, value] of Object.entries(darkColors)) {
        lines.push(`  --auth0-${name}: ${value};`);
      }
    }
    lines.push("}");
  }
  return lines.join("\n");
}

/**
 * Generates the themeSettings.variables object for Auth0ComponentProvider.
 * Radius MUST be set here (not in CSS) because the theme's [data-theme] selector
 * has higher specificity than :root and overwrites CSS-level radius values.
 */
function generateThemeSettingsVariables(radii, colors, darkColors, hasDarkMode) {
  const common = {};
  for (const [name, value] of Object.entries(radii)) {
    common[`--${name}`] = value;
  }

  const light = {};
  for (const [name, value] of Object.entries(colors)) {
    light[`--auth0-${name}`] = value;
  }

  const result = { common, light };
  if (hasDarkMode && Object.keys(darkColors).length > 0) {
    const dark = {};
    for (const [name, value] of Object.entries(darkColors)) {
      dark[`--auth0-${name}`] = value;
    }
    result.dark = dark;
  }
  return result;
}

// --- Main ---

const opts = parseArgs();
if (!opts.cssFile) {
  output({
    status: "error",
    error: { message: "--css-file is required", code: "MISSING_CSS_FILE", fallback_instructions: "Read the project's main CSS file manually and look for :root CSS variable declarations." },
  });
}

let css;
try {
  css = readFileSync(opts.cssFile, "utf-8");
} catch (e) {
  output({
    status: "error",
    error: { message: `Cannot read file: ${opts.cssFile}`, code: "FILE_NOT_FOUND", fallback_instructions: "Verify the CSS file path exists and try again." },
  });
}

// Parse all variable sources
const themeVars = parseThemeBlocks(css);
const rootVars = parseCssBlock(css, ":root");
const allLightVars = { ...themeVars, ...rootVars };

// Dark mode detection
const darkVars = parseCssBlock(css, ".dark");
const darkDataVars = parseCssBlock(css, '[data-theme="dark"]');
const allDarkVars = { ...darkDataVars, ...darkVars };

const hasDarkMode = Object.keys(allDarkVars).length > 0;
const darkSelector = Object.keys(darkVars).length > 0 ? ".dark"
  : Object.keys(darkDataVars).length > 0 ? '[data-theme="dark"]'
  : null;

// Map what we can detect
const detectedColors = mapVariables(allLightVars, TARGET_COLORS);
const detectedRadii = mapRadii(allLightVars);
const detectedDarkColors = mapVariables(allDarkVars, TARGET_COLORS);

// Fill ALL required variables with defaults for anything not detected
const colors = fillDefaults(detectedColors, LIGHT_DEFAULTS);
const radii = fillDefaults(detectedRadii, RADII_DEFAULTS);
const darkColors = hasDarkMode ? fillDefaults(detectedDarkColors, DARK_DEFAULTS) : {};

// CSS block for colors only (radius won't work in CSS due to specificity)
const generatedOverrideBlock = generateOverrideBlock(colors, opts.cssPath, darkColors, hasDarkMode);

// themeSettings.variables for Auth0ComponentProvider (radius MUST go here)
const themeSettingsVariables = generateThemeSettingsVariables(radii, colors, darkColors, hasDarkMode);

output({
  status: "success",
  data: {
    detectedColors,
    detectedRadii,
    colors,
    radii,
    fonts: {},
    darkMode: {
      detected: hasDarkMode,
      selector: darkSelector,
      colors: darkColors,
    },
    generatedOverrideBlock,
    themeSettingsVariables,
  },
});
