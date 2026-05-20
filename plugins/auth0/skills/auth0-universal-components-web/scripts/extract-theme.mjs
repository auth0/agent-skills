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
  // Both --auth0-destructive AND --auth0-destructive-foreground are used as
  // TEXT color in different contexts (see styles.css `.text-destructive`
  // line ~1571 and `.text-destructive-foreground` line ~1574). Auth0's own
  // fallbacks are --color-red-3 (light pink) and --color-red-9 (deep red);
  // a near-white default for *-foreground would render as invisible text
  // anywhere `.text-destructive-foreground` is applied. Both need to be a
  // legible red on light/cream backgrounds.
  "destructive": "oklch(57.7% 0.245 27.3)",
  "destructive-foreground": "oklch(55.69% 0.1824 30.14)",
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
  // Both serve as red text colors — keep them in the legible-red family.
  "destructive": "oklch(70.4% 0.191 22.2)",
  "destructive-foreground": "oklch(76.81% 0.1378 30.76)",
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

// Some hosts use semantic synonyms for the canonical token names — `error` /
// `danger` / `status-critical` for destructive, etc. When the canonical name
// isn't found we fall back to these so we extract the host's intent rather
// than dropping to global defaults.
const SEMANTIC_SYNONYMS = {
  "destructive": ["status-critical", "danger", "error"],
  "destructive-foreground": ["status-critical-foreground", "danger-foreground", "error-foreground"],
};

/**
 * Maps discovered CSS variables to Auth0 target names.
 * Tries: --primary, --color-primary, --clr-primary, --c-primary, then
 * semantic synonyms for known targets.
 */
function mapVariables(allVars, targets) {
  const mapped = {};
  const prefixes = ["", "color-", "clr-", "c-"];

  for (const target of targets) {
    if (allVars[`--${target}`]) {
      mapped[target] = allVars[`--${target}`];
      continue;
    }
    let found = false;
    for (const prefix of prefixes) {
      if (prefix === "") continue;
      const key = `--${prefix}${target}`;
      if (allVars[key]) {
        mapped[target] = allVars[key];
        found = true;
        break;
      }
    }
    if (found) continue;
    const synonyms = SEMANTIC_SYNONYMS[target];
    if (synonyms) {
      for (const syn of synonyms) {
        for (const prefix of prefixes) {
          const key = `--${prefix}${syn}`;
          if (allVars[key]) { mapped[target] = allVars[key]; found = true; break; }
        }
        if (found) break;
      }
    }
  }
  return mapped;
}

/**
 * Convert a length value (e.g. "0", "4px", "0.5rem") to numeric pixels for
 * cross-comparing radius values. Returns NaN when the value isn't a length.
 */
function lengthToPx(value) {
  if (value === null || value === undefined) return NaN;
  const trimmed = String(value).trim();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return NaN;
  if (trimmed.endsWith("rem") || trimmed.endsWith("em")) return num * 16;
  return num;
}

/**
 * Fills the radius scale by extrapolating from whatever the host actually
 * defines, instead of jumping to RADII_DEFAULTS for unset slots.
 *
 * The motivating case: a host with `--radius-sm/md/lg: 0` (a deliberately
 * sharp/industrial UI) doesn't define `--radius-xl` / `--radius-2xl`. If we
 * fill those with 12px / 16px from a generic defaults table, components end
 * up rounded against an otherwise flat host — visually broken.
 *
 * Heuristic:
 *   - All detected values <= 2px → host wants sharp UI; missing slots = 0px.
 *   - Otherwise extrapolate using the average step seen between adjacent
 *     detected slots (falling back to 4px when only one is detected).
 */
function extendRadiusScale(detected) {
  const order = ["radius-sm", "radius-md", "radius-lg", "radius-xl", "radius-2xl"];
  const px = {};
  for (const k of order) {
    const v = detected[k];
    if (v !== undefined) {
      const p = lengthToPx(v);
      if (!isNaN(p)) px[k] = p;
    }
  }
  const presentIdx = order.map((k, i) => (px[k] !== undefined ? i : -1)).filter((i) => i >= 0);
  if (presentIdx.length === 0) return detected;

  // Sharp-UI shortcut: when everything detected is essentially 0, extend with 0.
  const maxDetected = Math.max(...presentIdx.map((i) => px[order[i]]));
  if (maxDetected <= 2) {
    const result = { ...detected };
    for (const k of order) if (result[k] === undefined) result[k] = "0px";
    return result;
  }

  // Compute average step between detected adjacent values; default to 4 when
  // we only have a single anchor point.
  let step = 4;
  if (presentIdx.length >= 2) {
    const diffs = [];
    for (let i = 1; i < presentIdx.length; i++) {
      const span = presentIdx[i] - presentIdx[i - 1];
      const delta = px[order[presentIdx[i]]] - px[order[presentIdx[i - 1]]];
      diffs.push(delta / span);
    }
    step = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    if (!isFinite(step) || step < 0) step = 4;
  }

  const anchorIdx = presentIdx[0];
  const anchorPx = px[order[anchorIdx]];
  const result = { ...detected };
  for (let i = 0; i < order.length; i++) {
    if (result[order[i]] !== undefined) continue;
    const value = Math.max(Math.round(anchorPx + (i - anchorIdx) * step), 0);
    result[order[i]] = `${value}px`;
  }
  return result;
}

/**
 * Maps radius variables. Tries the named radius vars first, then derives from
 * a shadcn-style `--radius` base, then extrapolates so the full scale is
 * faithful to whatever the host has chosen.
 */
function mapRadii(allVars) {
  const mapped = mapVariables(allVars, TARGET_RADII);
  if (Object.keys(mapped).length > 0) return extendRadiusScale(mapped);

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

/**
 * Resolves a CSS value, walking through one level of var(--name) indirection
 * via the project's variable map. Falls back to the var()'s default segment
 * (var(--x, fallback)) when the var isn't found, then returns the literal as
 * a last resort. We only follow a few hops because shadcn-style indirection
 * occasionally chains (--background → --color-bg → #fff).
 */
function resolveCssValue(value, allVars, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  const trimmed = String(value).trim();
  const m = trimmed.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\s*\)$/);
  if (!m) return trimmed;
  const next = allVars[m[1]];
  if (next !== undefined) return resolveCssValue(next, allVars, depth + 1);
  if (m[2]) return resolveCssValue(m[2], allVars, depth + 1);
  return trimmed;
}

/**
 * Many design systems don't expose `--background` / `--foreground` at :root —
 * they declare those colors directly on `body { background-color: ...; color:
 * ...; }`. Fish them out so apply-theme doesn't fall through to pure-white /
 * pure-black defaults that look out of place against, say, a cream-paged app.
 */
function detectSemanticColorsFromBody(css, allVars) {
  const result = {};
  const blocks = [
    ...extractBlockContent(css, "body"),
    ...extractBlockContent(css, "html"),
  ];
  for (const block of blocks) {
    if (!result.background) {
      const m = block.match(/(?:^|[\s;])background(?:-color)?\s*:\s*([^;]+);/);
      if (m) {
        const v = resolveCssValue(m[1], allVars);
        // Skip gradients/images/short-hand values that aren't a single color.
        if (v && !/url\(|gradient/i.test(v)) result.background = v;
      }
    }
    if (!result.foreground) {
      const m = block.match(/(?:^|[\s;])color\s*:\s*([^;]+);/);
      if (m) {
        const v = resolveCssValue(m[1], allVars);
        if (v) result.foreground = v;
      }
    }
  }
  return result;
}

/**
 * If the host doesn't define dedicated card/popover/input surfaces, use the
 * page background instead of falling through to pure white. Same idea for the
 * matching foregrounds. Far fewer "white card on cream page" mismatches.
 */
function applySurfaceFallbacks(detected) {
  const out = { ...detected };
  if (out.background) {
    if (!out.card) out.card = out.background;
    if (!out.popover) out.popover = out.background;
    if (!out.input) out.input = out.background;
  }
  if (out.foreground) {
    if (!out["card-foreground"]) out["card-foreground"] = out.foreground;
    if (!out["popover-foreground"]) out["popover-foreground"] = out.foreground;
  }
  return out;
}

function generateOverrideBlock(colors, cssPath, darkColors, hasDarkMode) {
  const lines = [
    "/* @auth0-universal-components:start (managed block — apply-theme.mjs replaces between markers) */",
    ":root {",
  ];

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
  lines.push("/* @auth0-universal-components:end */");
  return lines.join("\n");
}

/**
 * Generates the themeSettings.variables object for Auth0ComponentProvider.
 * Radius MUST be set here (not in CSS) because the theme's [data-theme] selector
 * has higher specificity than :root and overwrites CSS-level radius values.
 */
// Auth0 components consume radius across xs through 9xl. The .rounded-3xl /
// .rounded-4xl classes are how cards and large surfaces get their corners.
// When the host wants a sharp UI we have to override the entire scale —
// otherwise the smaller slots are sharp but cards stay round.
const AUTH0_RADIUS_FULL_SCALE = [
  "radius-xs",
  "radius-sm", "radius-md", "radius-lg", "radius-xl",
  "radius-2xl", "radius-3xl", "radius-4xl", "radius-5xl",
  "radius-6xl", "radius-7xl", "radius-8xl", "radius-9xl",
];

// Auth0's shadow vocabulary mixes two unrelated concerns:
//   - "bevel" shadows: pure decorative elevation (drop shadows on cards/dialogs)
//   - "resting/hover/focus" shadows on inputs, buttons, checkboxes, switches:
//     these are 1px box-shadow outlines that act as the element's BORDER —
//     killing them removes the visual definition and inputs lose all hint of
//     interactivity.
//
// Flat-UI mode neutralizes the bevels entirely (no drop shadows) but rewrites
// the resting/hover/focus shadows as simple 1px outlines that reference the
// project's --auth0-border / --auth0-foreground / --auth0-ring tokens. End
// result: borders match the host palette, no decorative elevation, and the
// element still clearly reads as interactive.
const FLAT_UI_BEVELS = [
  "--shadow-bevel-xs", "--shadow-bevel-sm", "--shadow-bevel-md",
  "--shadow-bevel-lg", "--shadow-bevel-xl", "--shadow-bevel-2xl",
];

const FLAT_UI_OUTLINE_OVERRIDES = {
  "--shadow-input-resting": "0 0 0 1px var(--auth0-border)",
  "--shadow-input-hover": "0 0 0 1px var(--auth0-foreground)",
  "--shadow-input-focus": "0 0 0 2px var(--auth0-ring, var(--auth0-primary))",
  "--shadow-input-destructive-resting": "0 0 0 1px var(--auth0-destructive)",
  "--shadow-input-destructive-hover": "0 0 0 1px var(--auth0-destructive)",
  "--shadow-input-destructive-focus": "0 0 0 2px var(--auth0-destructive)",
  "--shadow-button-resting": "0 0 0 1px var(--auth0-border)",
  "--shadow-button-hover": "0 0 0 1px var(--auth0-foreground)",
  "--shadow-button-outlined-resting": "0 0 0 1px var(--auth0-border)",
  "--shadow-button-outlined-hover": "0 0 0 1px var(--auth0-foreground)",
  "--shadow-button-destructive-resting": "0 0 0 1px var(--auth0-destructive)",
  "--shadow-button-destructive-hover": "0 0 0 1px var(--auth0-destructive)",
  "--shadow-button-destructive-focus": "0 0 0 2px var(--auth0-destructive)",
  "--shadow-checkbox-resting": "0 0 0 1px var(--auth0-border)",
  "--shadow-checkbox-hover": "0 0 0 1px var(--auth0-foreground)",
  "--shadow-switch-resting": "0 0 0 1px var(--auth0-border)",
  "--shadow-switch-hover": "0 0 0 1px var(--auth0-foreground)",
  "--shadow-switch-focus": "0 0 0 2px var(--auth0-ring, var(--auth0-primary))",
};

/**
 * "Sharp UI" = the host explicitly chose flat corners. We detect this when
 * every detected radius value is essentially 0px. In that case we emit the
 * full Auth0 radius scale (xs–9xl) as 0px so cards and dialogs match the rest
 * of the app, not just inputs and small chips.
 */
function isSharpRadiusMode(radii) {
  const values = Object.values(radii)
    .map((v) => lengthToPx(v))
    .filter((v) => !isNaN(v));
  if (values.length === 0) return false;
  return values.every((v) => v <= 2);
}

/**
 * Returns "flat" when the host clearly opted out of shadows — either by
 * declaring at least one --shadow-* var as `none` (a strong signal — most
 * design systems either commit to shadows everywhere or nowhere) or by not
 * declaring any shadow vars at all (no signal, leave Auth0 defaults).
 */
function detectShadowMode(allVars) {
  const shadowKeys = Object.keys(allVars).filter((k) => k.startsWith("--shadow"));
  if (shadowKeys.length === 0) return null;
  const hasExplicitNone = shadowKeys.some((k) => {
    const v = String(allVars[k]).trim().toLowerCase();
    return v === "none" || v === "0" || v === "0px" || v === "";
  });
  return hasExplicitNone ? "flat" : null;
}

function generateThemeSettingsVariables(radii, colors, darkColors, hasDarkMode, shadowMode) {
  const common = {};

  // Always emit the detected sm-2xl values...
  for (const [name, value] of Object.entries(radii)) {
    common[`--${name}`] = value;
  }
  // ...and when the host wants sharp corners, blanket the wider scale
  // (xs and 3xl-9xl) too so larger surfaces don't slip through.
  if (isSharpRadiusMode(radii)) {
    for (const key of AUTH0_RADIUS_FULL_SCALE) {
      const fullKey = `--${key}`;
      if (common[fullKey] === undefined) common[fullKey] = "0px";
    }
  }

  // Flat-UI shadow override: only the decorative bevels become `none`. The
  // 1px outline shadows that act as borders are rewritten to track the host
  // palette so inputs, buttons, etc. still read as interactive.
  if (shadowMode === "flat") {
    for (const key of FLAT_UI_BEVELS) common[key] = "none";
    for (const [key, value] of Object.entries(FLAT_UI_OUTLINE_OVERRIDES)) {
      common[key] = value;
    }
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

// Map what we can detect from named variables.
let detectedColors = mapVariables(allLightVars, TARGET_COLORS);
const detectedRadii = mapRadii(allLightVars);
let detectedDarkColors = mapVariables(allDarkVars, TARGET_COLORS);

// Then top up from body { background, color } when the host doesn't expose
// :root vars for the page surface. We only fill keys that aren't already
// detected — explicit :root declarations always win.
const bodySemantic = detectSemanticColorsFromBody(css, allLightVars);
for (const [k, v] of Object.entries(bodySemantic)) {
  if (!detectedColors[k]) detectedColors[k] = v;
}

// Apply surface-level fallbacks (card/popover/input default to background)
// before the global LIGHT_DEFAULTS layer kicks in, so they inherit the host
// palette rather than landing on pure white.
detectedColors = applySurfaceFallbacks(detectedColors);
if (hasDarkMode) detectedDarkColors = applySurfaceFallbacks(detectedDarkColors);

// Fill any still-missing keys with the global defaults so the override block
// is always complete.
const colors = fillDefaults(detectedColors, LIGHT_DEFAULTS);
const radii = fillDefaults(detectedRadii, RADII_DEFAULTS);
const darkColors = hasDarkMode ? fillDefaults(detectedDarkColors, DARK_DEFAULTS) : {};

// Detect shadow mode (flat vs default) from the host's --shadow-* declarations.
const shadowMode = detectShadowMode(allLightVars);

// CSS block for colors only (radius won't work in CSS due to specificity)
const generatedOverrideBlock = generateOverrideBlock(colors, opts.cssPath, darkColors, hasDarkMode);

// themeSettings.variables for Auth0ComponentProvider (radius + shadow MUST go here)
const themeSettingsVariables = generateThemeSettingsVariables(radii, colors, darkColors, hasDarkMode, shadowMode);

output({
  status: "success",
  data: {
    detectedColors,
    detectedRadii,
    colors,
    radii,
    fonts: {},
    sharpRadius: isSharpRadiusMode(detectedRadii),
    shadowMode: shadowMode || "default",
    darkMode: {
      detected: hasDarkMode,
      selector: darkSelector,
      colors: darkColors,
    },
    generatedOverrideBlock,
    themeSettingsVariables,
  },
});
