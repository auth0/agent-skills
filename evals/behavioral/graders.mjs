// Shared grader engine for the consolidated Auth0 behavioral evals.
//
// Consolidated from the per-skill run-evals.mjs harnesses that used to live
// under each individual skill's tests/ folder. Those 5 runners were
// near-identical copies; this is the single de-duplicated home for the grading
// logic. Case files under cases/ supply the graders; the runner (run-evals.mjs)
// drives the agent and calls runGraders() here.
//
// Two grading behaviors were changed on purpose during consolidation (i.e. this
// is NOT byte-for-byte identical to the old graders — re-validate any case that
// leaned on the old behavior):
//   • Lockfiles are no longer graded. `.lock` was dropped from SOURCE_EXTENSIONS
//     and a LOCKFILES set / isLockfile() now excludes generated lock/manifest
//     files, so a substring in a pinned transitive dependency can't
//     false-positive a not_contains* grader (see the LOCKFILES note below).
//   • A new `not_matches` grader type was added (negative regex) for cases where
//     a bare substring would false-positive (see gradeNotMatches).
//
// Grader types (from the original graders.json schema):
//   contains / contains_any        — substring present (case-insensitive)
//   not_contains / not_contains_any — substring absent (hallucination guard)
//   matches                         — regex present in any source file
//   file_contains                   — value present in a glob-matched file
//   all                             — composite; all sub-graders must pass
//   judge                           — LLM YES/NO verdict via `claude -p`
import fs from "node:fs"
import path from "node:path"
import { $ } from "execa"

const SOURCE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
  ".swift", ".kt", ".java", ".cs", ".go", ".py", ".rb", ".php", ".dart",
  ".vue", ".svelte", ".astro",
  ".gradle", ".kts",
  ".xml", ".plist", ".json", ".env", ".yaml", ".yml", ".toml", ".properties",
  ".html", ".css", ".scss",
  ".csproj", ".sln",
  ".pbxproj", ".resolved", ".podspec",
])

// Generated lock/manifest files. They pin the full transitive dependency graph,
// so a substring like "express-jwt" appears in them as part of an unrelated
// package name — which makes not_contains* graders false-positive even when the
// hand-written source is correct. Grade against authored source, not lockfiles.
// (Removed ".lock" from SOURCE_EXTENSIONS above for the same reason.)
const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",
  "Podfile.lock", "Package.resolved", "Gemfile.lock", "composer.lock",
  "poetry.lock", "pubspec.lock", "Cargo.lock", "gradle.lockfile",
])

function isLockfile(name) {
  return LOCKFILES.has(name) || name.endsWith(".lock")
}

// `.env`, `.env.local`, `.env.production`, … are dotfiles: path.extname(".env")
// is "" and path.extname(".env.local") is ".local", so they never match
// SOURCE_EXTENSIONS. Match them by name so secret-related not_contains graders
// (e.g. client_secret) actually see the file secrets land in.
function isSourceFile(name) {
  if (isLockfile(name)) return false
  if (name === ".env" || name.startsWith(".env.")) return true
  return SOURCE_EXTENSIONS.has(path.extname(name))
}

function collectSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "build", "dist", ".gradle"].includes(entry.name)) continue
      collectSourceFiles(full, files)
    } else if (isSourceFile(entry.name)) {
      files.push(full)
    }
  }
  return files
}

export function readAllSources(dir) {
  const files = collectSourceFiles(dir)
  const contents = []
  for (const f of files) {
    try {
      contents.push({ path: f, content: fs.readFileSync(f, "utf-8") })
    } catch {
      // skip unreadable files
    }
  }
  return contents
}

function gradeFileContains(grader, workspaceDir) {
  const pattern = grader.file_pattern
  const matchingFiles = []

  function walkAndMatch(dir, globPattern) {
    const filename = globPattern.replace(/^\*\*\//, "")
    const isGlob = /[*{]/.test(filename)

    function matchesPattern(name) {
      if (!isGlob) return name === filename
      // Translate a filename glob to a regex, supporting `*` (any run of
      // non-separator chars) and `{a,b,c}` brace alternation. Everything else
      // is escaped literally. Done in one pass so `*` and `,` inside braces are
      // not clobbered by a blanket escape (the bug this replaces escaped `{}`,`,`
      // and `*`, so brace-globs like `*.{tsx,ts}` never matched anything).
      let re = ""
      for (let i = 0; i < filename.length; i++) {
        const ch = filename[i]
        if (ch === "*") {
          re += "[^/]*"
        } else if (ch === "{") {
          const end = filename.indexOf("}", i)
          if (end === -1) { re += "\\{"; continue }
          const alts = filename.slice(i + 1, end).split(",")
          re += "(?:" + alts.map((a) =>
            a.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")
          ).join("|") + ")"
          i = end
        } else {
          re += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        }
      }
      return new RegExp("^" + re + "$").test(name)
    }

    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "build", "dist", ".gradle"].includes(entry.name)) continue
        walkAndMatch(full, globPattern)
      } else if (matchesPattern(entry.name)) {
        try {
          matchingFiles.push({ path: full, content: fs.readFileSync(full, "utf-8") })
        } catch { /* skip unreadable */ }
      }
    }
  }

  walkAndMatch(workspaceDir, pattern)

  if (matchingFiles.length === 0) {
    return { pass: false, detail: `No files matching "${pattern}" found in workspace` }
  }
  for (const f of matchingFiles) {
    if (f.content.includes(grader.value)) {
      return { pass: true, detail: `Found "${grader.value}" in ${path.relative(workspaceDir, f.path)}` }
    }
  }
  const fileNames = matchingFiles.map((f) => path.relative(workspaceDir, f.path)).join(", ")
  return { pass: false, detail: `"${grader.value}" not found in matching files: ${fileNames}` }
}

function gradeContains(grader, sources) {
  for (const src of sources) {
    if (src.content.toLowerCase().includes(grader.value.toLowerCase())) {
      return { pass: true, detail: `Found "${grader.value}" in ${path.basename(src.path)}` }
    }
  }
  return { pass: false, detail: `"${grader.value}" not found in any source file` }
}

function gradeContainsAny(grader, sources) {
  const allContent = sources.map((s) => s.content.toLowerCase()).join("\n")
  for (const value of grader.values) {
    if (allContent.includes(value.toLowerCase())) {
      return { pass: true, detail: `Found "${value}" in workspace` }
    }
  }
  return { pass: false, detail: `None of [${grader.values.join(", ")}] found in any source file` }
}

function gradeNotContains(grader, sources) {
  for (const src of sources) {
    if (src.content.toLowerCase().includes(grader.value.toLowerCase())) {
      return { pass: false, detail: `Found "${grader.value}" in ${path.basename(src.path)} (should not be present)` }
    }
  }
  return { pass: true, detail: `"${grader.value}" correctly absent` }
}

function gradeNotContainsAny(grader, sources) {
  for (const src of sources) {
    const lower = src.content.toLowerCase()
    for (const value of grader.values) {
      if (lower.includes(value.toLowerCase())) {
        return { pass: false, detail: `Found "${value}" in ${path.basename(src.path)} (should not be present)` }
      }
    }
  }
  return { pass: true, detail: `None of [${grader.values.join(", ")}] found (correct)` }
}

function gradeMatches(grader, sources) {
  let regex
  try {
    regex = new RegExp(grader.pattern)
  } catch {
    return { pass: false, detail: `Invalid regex pattern: ${grader.pattern}` }
  }
  for (const src of sources) {
    if (regex.test(src.content)) {
      return { pass: true, detail: `Pattern matched in ${path.basename(src.path)}` }
    }
  }
  return { pass: false, detail: `Pattern /${grader.pattern}/ not matched in any source file` }
}

// Negative regex: pass only if the pattern matches NO source file. Use this
// instead of not_contains when a bare substring would false-positive — e.g.
// "express-jwt" is a substring of both the correct package
// "express-oauth2-jwt-bearer" (via lockfiles) and natural project names like
// "express-jwt-api", so a regex like `express-jwt['"]` (dep key / import only)
// is required to test "the deprecated express-jwt package is absent".
function gradeNotMatches(grader, sources) {
  let regex
  try {
    regex = new RegExp(grader.pattern)
  } catch {
    return { pass: false, detail: `Invalid regex pattern: ${grader.pattern}` }
  }
  for (const src of sources) {
    if (regex.test(src.content)) {
      return { pass: false, detail: `Pattern /${grader.pattern}/ matched in ${path.basename(src.path)} (should be absent)` }
    }
  }
  return { pass: true, detail: `Pattern /${grader.pattern}/ correctly absent` }
}

function gradeSync(grader, sources, workspaceDir) {
  switch (grader.type) {
    case "contains": return gradeContains(grader, sources)
    case "contains_any": return gradeContainsAny(grader, sources)
    case "file_contains": return gradeFileContains(grader, workspaceDir)
    case "not_contains": return gradeNotContains(grader, sources)
    case "not_contains_any": return gradeNotContainsAny(grader, sources)
    case "matches": return gradeMatches(grader, sources)
    case "not_matches": return gradeNotMatches(grader, sources)
    default: return { pass: false, detail: `Unsupported sub-grader type: ${grader.type}` }
  }
}

function gradeAll(grader, sources, workspaceDir) {
  for (const sub of grader.graders) {
    const result = gradeSync(sub, sources, workspaceDir)
    if (!result.pass) {
      return { pass: false, detail: `Sub-grader failed: ${sub.description || sub.type} — ${result.detail}` }
    }
  }
  return { pass: true, detail: `All ${grader.graders.length} sub-graders passed` }
}

async function gradeJudge(grader, sources, workspaceDir, model) {
  const fileSummary = sources
    .slice(0, 20)
    .map((s) => `--- ${path.relative(workspaceDir, s.path)} ---\n${s.content.slice(0, 3000)}`)
    .join("\n\n")

  let questionBlock = grader.question
  if (grader.examples) questionBlock += `\n\n## Examples\n${grader.examples}`

  const judgePrompt = `You are evaluating code quality. Review the following source files and answer this question:

${questionBlock}

Think briefly if you need to, then end your response with a final line in exactly this form:
VERDICT: YES
or
VERDICT: NO

${fileSummary}`

  const judgeArgs = ["-p", judgePrompt, "--permission-mode", "dontAsk", "--no-session-persistence"]
  if (model) judgeArgs.push("--model", model)

  try {
    const { stdout } = await $({ timeout: 60000 })`claude ${judgeArgs}`
    const pass = parseVerdict(stdout)
    return { pass, detail: stdout.trim().slice(-300) }
  } catch (e) {
    return { pass: false, detail: `Judge failed: ${e.message}` }
  }
}

// Extract the judge's verdict. Prefer an explicit `VERDICT: YES/NO` tag (scanned
// from the end, since the model may reason first); fall back to the first line
// for older-style replies. A model that reasons-then-concludes ("...wait, let me
// check... PASS") would be misread if we only looked at line 1.
function parseVerdict(stdout) {
  const text = stdout.trim()
  const tags = [...text.matchAll(/VERDICT:\s*(YES|NO)/gi)]
  if (tags.length) return tags[tags.length - 1][1].toUpperCase() === "YES"
  return text.split("\n")[0].trim().toUpperCase().startsWith("YES")
}

// Run every grader against the workspace. `model` (optional) is forwarded to
// judge graders as the --model flag for `claude -p`.
export async function runGraders(graders, workspaceDir, model = null) {
  const sources = readAllSources(workspaceDir)
  const results = []

  for (const grader of graders) {
    let result
    switch (grader.type) {
      case "contains": result = gradeContains(grader, sources); break
      case "contains_any": result = gradeContainsAny(grader, sources); break
      case "file_contains": result = gradeFileContains(grader, workspaceDir); break
      case "not_contains": result = gradeNotContains(grader, sources); break
      case "not_contains_any": result = gradeNotContainsAny(grader, sources); break
      case "matches": result = gradeMatches(grader, sources); break
      case "not_matches": result = gradeNotMatches(grader, sources); break
      case "all": result = gradeAll(grader, sources, workspaceDir); break
      case "judge": result = await gradeJudge(grader, sources, workspaceDir, model); break
      default: result = { pass: false, detail: `Unknown grader type: ${grader.type}` }
    }
    results.push({ type: grader.type, description: grader.description, ...result })
  }

  // Empty-workspace guard: not_contains graders trivially pass when the agent
  // wrote no code (nothing bad can be present in nothing). Demote them to FAIL
  // unless at least one positive grader passed. Preserved from the original.
  const positiveTypes = new Set(["contains", "contains_any", "file_contains", "matches"])
  const negativeTypes = new Set(["not_contains", "not_contains_any", "not_matches"])
  const anyPositivePassed = results.some((r) => positiveTypes.has(r.type) && r.pass)
  if (!anyPositivePassed) {
    for (const r of results) {
      if (negativeTypes.has(r.type) && r.pass) {
        r.pass = false
        r.detail = `Invalidated: no positive graders passed (agent likely wrote no integration code). Original: ${r.detail}`
      }
    }
  }

  return results
}
