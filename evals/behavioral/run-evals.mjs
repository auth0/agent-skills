#!/usr/bin/env node
//
// Consolidated behavioral eval runner for the single `auth0` skill.
//
// Replaces the ~5 near-identical per-skill run-evals.mjs harnesses that used to
// live under each individual skill's tests/ folder. There is now ONE skill (a
// router), so there is ONE runner and one case file per framework/feature under
// cases/. Grading logic lives in the shared ./graders.mjs.
//
// What it measures, per case: run the case prompt through `claude -p` twice —
//   • with_skill    — the auth0 plugin is loaded (--plugin-dir), so the ROUTER
//                     activates, detects the framework, and pulls the matching
//                     reference files. This exercises the real routing path,
//                     not a hand-injected SKILL.md.
//   • without_skill — same tools, plugin NOT loaded (baseline agent knowledge).
// Then grade both workspaces with the case's graders and report the delta. A
// skill that helps should score materially higher with_skill than without.
//
// This needs a live `claude` CLI and (for cases that write tenant config) real
// Auth0 credentials in the prompt — so it is a MANUALLY-RUN suite, not CI. The
// offline routing check (scripts/check_routing_evals.py) is the CI-friendly
// layer; this is the behavioral layer.
//
// Usage:
//   node run-evals.mjs                 # run every case with graders
//   node run-evals.mjs flask express-jwt   # run only named case slugs
//   node run-evals.mjs --list          # list available cases and exit
//   node run-evals.mjs --dry-run       # validate case files + graders, no agent
//   node run-evals.mjs --model <id>    # pin a model for agent + judge
//   node run-evals.mjs --skill-only    # skip the without-skill comparison
//
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { $ } from "execa"
import { runGraders } from "./graders.mjs"

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url))
const CASES_DIR = path.join(EVAL_DIR, "cases")
// evals/behavioral -> evals -> repo root; the skill lives at plugins/auth0/skills/auth0
const REPO_ROOT = path.resolve(EVAL_DIR, "..", "..")
const PLUGIN_DIR = path.join(REPO_ROOT, "plugins", "auth0")
const SKILL_DIR = path.join(PLUGIN_DIR, "skills", "auth0")

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const modelIdx = argv.indexOf("--model")
const MODEL = modelIdx !== -1 ? argv[modelIdx + 1] : null
const slugArgs = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--model")

function loadCases() {
  return fs.readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(CASES_DIR, f), "utf-8")
      try {
        return { file: f, ...JSON.parse(raw) }
      } catch (e) {
        throw new Error(`Invalid JSON in cases/${f}: ${e.message}`)
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

// Run the agent in a workspace. When `withSkill`, load the auth0 plugin so the
// router is discoverable; the agent decides whether to activate it (that IS the
// thing under test). Without it, the agent has tools but no Auth0 skill.
async function runAgent(taskPrompt, workspaceDir, withSkill) {
  const args = [
    "-p", taskPrompt,
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch",
  ]
  if (withSkill) {
    args.push("--plugin-dir", PLUGIN_DIR)
    args.push("--add-dir", SKILL_DIR) // let it read references/
  }
  if (MODEL) args.push("--model", MODEL)

  const start = Date.now()
  const { stdout } = await $({ cwd: workspaceDir, timeout: 600000, reject: false })`claude ${args}`
  return { stdout, durationMs: Date.now() - start }
}

// Some routing tiers key on project files. If a case names a scaffold map
// { "package.json": "...", ... }, write it into both workspaces so Tier 1/2
// framework detection has something to read. Prompt-only cases rely on Tier 3.
function scaffold(caseObj, dir) {
  if (!caseObj.scaffold) return
  for (const [rel, content] of Object.entries(caseObj.scaffold)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
}

// Per-eval scaffold: a multi-eval case gives each eval its own starter files
// under `eval.scaffold` so the agent has a file on disk to edit in place. Mirror
// of scaffold() above but keyed off the eval object, not the case.
function scaffoldEval(evalObj, dir) {
  if (!evalObj.scaffold) return
  for (const [rel, content] of Object.entries(evalObj.scaffold)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
}

function display(label, results) {
  const passed = results.filter((r) => r.pass).length
  console.log(`\n  ${label}: ${passed}/${results.length} passed (${((passed / results.length) * 100).toFixed(0)}%)`)
  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  [${r.type}] ${r.description}`)
    if (!r.pass) console.log(`        ${r.detail}`)
  }
  return passed
}

// Run one eval (prompt + scaffold + graders) in its own isolated workspace pair.
// Shared by the per-eval branch; returns per-eval pass counts.
async function runEval(slug, evalObj, opts, index = 0) {
  const graders = evalObj.graders
  const prompt = evalObj.prompt
  const label = evalObj.id ?? "eval"

  if (!graders) {
    console.log(`\n  Eval ${label}: no machine graders (expectations-only).`)
    for (const a of evalObj.assertions || evalObj.expectations || []) console.log(`    - ${a}`)
    return { id: label, graded: false }
  }
  if (!prompt) { console.log(`  Eval ${label}: SKIP (no prompt).`); return { id: label, graded: false } }

  const safeLabel = String(label).replace(/[^A-Za-z0-9_-]/g, '_');
  const base = path.join(os.tmpdir(), `auth0-eval-${slug}-${index}-${safeLabel}-${process.pid}`)
  const withDir = path.join(base, "with-skill")
  const withoutDir = path.join(base, "without-skill")
  fs.mkdirSync(withDir, { recursive: true })
  if (!opts.skillOnly) fs.mkdirSync(withoutDir, { recursive: true })
  scaffoldEval(evalObj, withDir)
  if (!opts.skillOnly) scaffoldEval(evalObj, withoutDir)

  console.log(`\n  Eval ${label}: running agent WITH skill (router loaded)...`)
  await runAgent(prompt, withDir, true)
  const withRes = await runGraders(graders, withDir, MODEL)
  const withPass = display(`  ${label} — with skill`, withRes)

  let withoutPass = null
  if (!opts.skillOnly) {
    console.log(`\n  Eval ${label}: running agent WITHOUT skill...`)
    await runAgent(prompt, withoutDir, false)
    const withoutRes = await runGraders(graders, withoutDir, MODEL)
    withoutPass = display(`  ${label} — without skill`, withoutRes)
    const delta = withPass - withoutPass
    console.log(`\n  Eval ${label} delta: ${delta >= 0 ? "+" : ""}${delta} (${withPass} vs ${withoutPass} of ${withRes.length})`)
  }
  return { id: label, graded: true, total: withRes.length, withPass, withoutPass, workspace: base }
}

async function runCase(caseObj, opts) {
  console.log(`\n${"=".repeat(72)}\n  Case: ${caseObj.slug}  (was ${caseObj.origin_skill})`)

  // Shape detection: new per-eval cases carry graders INSIDE each eval and have
  // no top-level graders array. Legacy cases carry a single flat top-level
  // graders array and run only evals[0].prompt. Detect per-eval from ANY eval,
  // not just evals[0], so a case whose first eval lacks graders is not misrouted
  // to the legacy path (which would return graded:false without running).
  const perEval = !caseObj.graders && !!caseObj.evals?.some((e) => Array.isArray(e.graders))

  if (perEval) {
    const evalResults = []
    for (let i = 0; i < caseObj.evals.length; i++) {
      evalResults.push(await runEval(caseObj.slug, caseObj.evals[i], opts, i))
    }
    const graded = evalResults.filter((r) => r.graded)
    if (!graded.length) return { slug: caseObj.slug, graded: false }
    const total = graded.reduce((s, r) => s + r.total, 0)
    const withPass = graded.reduce((s, r) => s + r.withPass, 0)
    const withoutPass = opts.skillOnly ? null : graded.reduce((s, r) => s + (r.withoutPass || 0), 0)
    return { slug: caseObj.slug, graded: true, total, withPass, withoutPass, evalBreakdown: evalResults }
  }

  // Legacy path — single workspace, evals[0].prompt, top-level graders.
  const graders = caseObj.graders
  const prompt = caseObj.evals?.[0]?.prompt

  if (!graders) {
    console.log("  No machine graders (routing-regression / expectations-only case).")
    console.log("  Expectations to verify by reading the transcript:")
    for (const e of caseObj.evals || []) {
      for (const a of e.assertions || e.expectations || []) console.log(`    - ${a}`)
    }
    return { slug: caseObj.slug, graded: false }
  }
  if (!prompt) { console.log("  SKIP: no prompt in case."); return { slug: caseObj.slug, graded: false } }

  const base = path.join(os.tmpdir(), `auth0-eval-${caseObj.slug}-${process.pid}`)
  const withDir = path.join(base, "with-skill")
  const withoutDir = path.join(base, "without-skill")
  fs.mkdirSync(withDir, { recursive: true })
  if (!opts.skillOnly) fs.mkdirSync(withoutDir, { recursive: true })
  scaffold(caseObj, withDir)
  if (!opts.skillOnly) scaffold(caseObj, withoutDir)

  console.log("  Running agent WITH skill (router loaded)...")
  await runAgent(prompt, withDir, true)
  const withRes = await runGraders(graders, withDir, MODEL)
  const withPass = display("With skill", withRes)

  let withoutPass = null
  if (!opts.skillOnly) {
    console.log("\n  Running agent WITHOUT skill...")
    await runAgent(prompt, withoutDir, false)
    const withoutRes = await runGraders(graders, withoutDir, MODEL)
    withoutPass = display("Without skill", withoutRes)
    const delta = withPass - withoutPass
    console.log(`\n  Delta (skill value): ${delta >= 0 ? "+" : ""}${delta} graders (${withPass} vs ${withoutPass} of ${withRes.length})`)
  }
  return { slug: caseObj.slug, graded: true, total: withRes.length, withPass, withoutPass, workspace: base }
}

async function main() {
  console.log("\n  Auth0 consolidated behavioral eval runner\n")
  let cases = loadCases()
  if (slugArgs.length) cases = cases.filter((c) => slugArgs.includes(c.slug))

  if (flag("--list")) {
    console.log("  Available cases:")
    for (const c of loadCases()) {
      const perEval = !c.graders && !!c.evals?.[0]?.graders
      const n = perEval ? c.evals.reduce((s, e) => s + (e.graders?.length || 0), 0) : (c.graders?.length || 0)
      console.log(`    ${c.slug.padEnd(20)} ${n ? `${n} graders` : "expectations-only"}  (was ${c.origin_skill})`)
    }
    return
  }

  if (flag("--dry-run")) {
    let ok = 0, bad = 0
    for (const c of cases) {
      if (!c.evals?.length) { console.log(`  BAD  ${c.slug}: no evals`); bad++; continue }
      const perEval = !c.graders && !!c.evals[0]?.graders
      const allGraders = perEval
        ? c.evals.flatMap((e) => e.graders || [])
        : (c.graders || [])
      for (const g of allGraders) {
        if (g.type === "matches" || g.type === "not_matches") {
          try { new RegExp(g.pattern) } catch { console.log(`  BAD  ${c.slug}: invalid regex ${g.pattern}`); bad++ }
        }
      }
      const shape = perEval ? "per-eval" : "legacy"
      const graderDesc = allGraders.length ? `${allGraders.length} graders (${shape})` : "expectations-only"
      console.log(`  OK   ${c.slug}: ${c.evals.length} eval(s), ${graderDesc}`)
      ok++
    }
    console.log(`\n  ${ok} case files valid, ${bad} problems.`)
    process.exit(bad ? 1 : 0)
  }

  try {
    await $({ timeout: 10000 })`claude --version`
  } catch {
    console.error("  claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code")
    process.exit(1)
  }

  const opts = { skillOnly: flag("--skill-only") }
  const summary = []
  for (const c of cases) summary.push(await runCase(c, opts))

  console.log(`\n${"=".repeat(72)}\n  SUMMARY\n`)
  let failed = 0
  for (const s of summary) {
    if (!s.graded) { console.log(`  ${s.slug.padEnd(20)} (manual review — no machine graders)`); continue }
    // A graded case fails if any grader did not pass with the skill loaded.
    const isFail = s.withPass < s.total
    if (isFail) failed++
    const d = s.withoutPass == null ? "" : `  delta ${s.withPass - s.withoutPass >= 0 ? "+" : ""}${s.withPass - s.withoutPass}`
    console.log(`  ${isFail ? "FAIL" : "PASS"}  ${s.slug.padEnd(20)} with-skill ${s.withPass}/${s.total}${d}`)
    // Multi-eval cases: show the per-eval breakdown under the aggregate row.
    if (s.evalBreakdown) {
      for (const e of s.evalBreakdown) {
        if (!e.graded) { console.log(`        ${(e.id + "").padEnd(30)} (manual review)`); continue }
        const ed = e.withoutPass == null ? "" : `  Δ${e.withPass - e.withoutPass >= 0 ? "+" : ""}${e.withPass - e.withoutPass}`
        console.log(`        ${(e.withPass < e.total ? "FAIL" : "PASS")}  ${(e.id + "").padEnd(30)} ${e.withPass}/${e.total}${ed}`)
      }
    }
  }
  const graded = summary.filter((s) => s.graded).length
  console.log(`\n  ${graded - failed}/${graded} graded cases passed, ${failed} failed.`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
