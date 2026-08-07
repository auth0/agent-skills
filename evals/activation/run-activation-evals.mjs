#!/usr/bin/env node
//
// Skill-ACTIVATION eval runner for the unified `auth0` skill.
//
// WHAT THIS MEASURES, AND WHY IT EXISTS
// -------------------------------------
// The SKILL.md `description` frontmatter is the ONLY signal an agent uses to
// decide whether to load this skill. Neither existing eval layer touches it:
//   • scripts/check_routing_evals.py  parses the SKILL.md BODY (Step 4 table)
//   • evals/behavioral/               grades code AFTER the skill is loaded
// So a description edit could tank discoverability with every other check green.
// This layer closes that hole by comparing two description variants over one
// fixed matrix of prompts (cases.json).
//
// TWO STAGES
// ----------
// Stage A (default) — CLASSIFIER. Renders a realistic skill menu (auth0 + real
//   distractor skills, name+description only, as skills appear in a system
//   prompt), then the user's request, and asks which skills would be invoked.
//   Cheap, and isolates the description as the only changing variable.
//   The menu is essential: asking "would you invoke auth0?" in isolation primes
//   YES and makes negative cases meaningless.
//
// Stage B (--real) — GROUND TRUTH. Builds two temp copies of plugins/auth0 that
//   differ ONLY in the description line, runs the prompt under --plugin-dir with
//   --output-format stream-json, and detects a real Skill(auth0) invocation in
//   the event stream. Slow (a full agent run per case per variant), so it runs
//   only on cases tagged spot_check plus anything Stage A flags.
//
// Non-determinism is handled by --trials (default 3) + majority vote; cases whose
// trials disagree are reported UNSTABLE rather than silently rounded.
//
// Usage:
//   node run-activation-evals.mjs                      # stage A, git:HEAD vs working tree
//   node run-activation-evals.mjs --dry-run            # validate cases + variants, no model calls
//   node run-activation-evals.mjs --trials 5
//   node run-activation-evals.mjs --only kw-passkeys,neg-cors-headers
//   node run-activation-evals.mjs --real               # stage B on spot_check + flagged cases
//   node run-activation-evals.mjs --real --only fw-flutter
//   node run-activation-evals.mjs --baseline git:main --candidate path/to/SKILL.md
//   node run-activation-evals.mjs --model <id>
//
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { $ } from "execa"

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url))
// evals/activation -> evals -> repo root
const REPO_ROOT = path.resolve(EVAL_DIR, "..", "..")
const PLUGIN_DIR = path.join(REPO_ROOT, "plugins", "auth0")
const SKILL_MD = path.join(PLUGIN_DIR, "skills", "auth0", "SKILL.md")
const SKILL_MD_REL = "plugins/auth0/skills/auth0/SKILL.md"

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d = null) => {
  const i = argv.indexOf(n)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d
}

const TRIALS = parseInt(opt("--trials", "3"), 10)
if (!Number.isInteger(TRIALS) || TRIALS < 1) {
  console.error(`  --trials must be an integer >= 1 (got "${opt("--trials", "3")}").`)
  process.exit(1)
}
const MODEL = opt("--model")
const ONLY = opt("--only")
const BASELINE = opt("--baseline", "git:HEAD")
const CANDIDATE = opt("--candidate", SKILL_MD)
const REAL = flag("--real")
const DRY = flag("--dry-run")

// ---------------------------------------------------------------------------
// Description extraction
// ---------------------------------------------------------------------------
// Pull the `description:` value out of a SKILL.md. Supports a plain one-line
// scalar and YAML block scalars (`>`/`|`), because a future edit may well
// reformat it as a folded block. Deliberately hand-rolled: this repo's eval
// harnesses have no YAML dependency and we only need one field.
function extractDescription(skillMdText, sourceLabel) {
  const fmMatch = skillMdText.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) throw new Error(`No YAML frontmatter found in ${sourceLabel}`)
  const lines = fmMatch[1].split("\n")
  const i = lines.findIndex((l) => /^description:/.test(l))
  if (i === -1) throw new Error(`No description: field in ${sourceLabel}`)

  const first = lines[i].replace(/^description:\s*/, "")
  if (first === ">" || first === "|" || first === ">-" || first === "|-") {
    const out = []
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\S/.test(lines[j])) break // dedented => next key
      out.push(lines[j].trim())
    }
    return out.join(" ").trim()
  }
  return first.trim().replace(/^["']|["']$/g, "")
}

async function resolveVariant(ref) {
  if (ref.startsWith("git:")) {
    const gitRef = ref.slice(4)
    const { stdout } = await $({ cwd: REPO_ROOT })`git show ${`${gitRef}:${SKILL_MD_REL}`}`
    return { label: ref, description: extractDescription(stdout, ref) }
  }
  const abs = path.isAbsolute(ref) ? ref : path.join(REPO_ROOT, ref)
  const label = ref === SKILL_MD ? "working-tree" : ref
  return { label, description: extractDescription(fs.readFileSync(abs, "utf-8"), label) }
}

// ---------------------------------------------------------------------------
// Stage A — classifier
// ---------------------------------------------------------------------------
// Real distractor skills, so "is auth0 the relevant one?" is a genuine choice.
// Several are auth-ADJACENT on purpose (k8s, api-hardening) — they give a
// correct home to the near-miss negatives, which is what makes those cases
// discriminating instead of just unanswerable.
const DISTRACTORS = [
  { name: "dataviz", description: "Use when creating any chart, graph, plot, dashboard, or data visualization in any output medium." },
  { name: "stripe-billing", description: "Use when adding or changing payments, subscriptions, invoices, checkout, or billing plans in an app." },
  { name: "testing", description: "Use when writing, fixing, or improving unit, integration, or end-to-end tests for existing code." },
  { name: "postgres-performance", description: "Use when a database query or migration is slow, or when designing indexes and schema for scale." },
  { name: "kubernetes-ops", description: "Use when deploying to, configuring, or debugging a Kubernetes cluster — manifests, service accounts, cluster RBAC, ingress, and CI deploy pipelines." },
  { name: "api-hardening", description: "Use when adding rate limiting, CORS headers, input validation, request size limits, or other HTTP-level protections to a web service." },
  { name: "aws-infra", description: "Use when provisioning or maintaining AWS infrastructure — IAM policies and access keys, S3, Lambda, VPC, and Terraform." },
]

function classifierPrompt(auth0Description, userPrompt) {
  const menu = [...DISTRACTORS, { name: "auth0", description: auth0Description }]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n")

  return `You are a coding agent. These skills are available; you see only each skill's name and description:

${menu}

A user sends this request:

"${userPrompt}"

Which of the available skills, if any, would you invoke to handle this request? Judge only from the descriptions above. Multiple skills may be relevant; list every one that is. If none are relevant, answer NONE.

Reply with a single final line, exactly:
ANSWER: <comma-separated skill names, or NONE>`
}

async function classifyOnce(description, userPrompt) {
  const args = ["-p", classifierPrompt(description, userPrompt), "--no-session-persistence", "--allowedTools", ""]
  if (MODEL) args.push("--model", MODEL)
  const { stdout } = await $({ timeout: 180000, reject: false })`claude ${args}`
  // Parse the LAST ANSWER: line — a model that reasons first still gets read right.
  const matches = [...stdout.matchAll(/^\s*ANSWER:\s*(.+)$/gim)]
  if (!matches.length) return { ok: false, activated: null, raw: stdout.slice(-300) }
  const answer = matches[matches.length - 1][1].trim()
  const names = answer.split(",").map((s) => s.trim().toLowerCase().replace(/[`*."']/g, ""))
  return { ok: true, activated: names.includes("auth0"), answer }
}

async function classifyWithTrials(description, userPrompt) {
  const votes = []
  for (let t = 0; t < TRIALS; t++) {
    let r = await classifyOnce(description, userPrompt)
    if (!r.ok) r = await classifyOnce(description, userPrompt) // one retry on unparseable
    votes.push(r.ok ? r.activated : null)
  }
  const yes = votes.filter((v) => v === true).length
  const no = votes.filter((v) => v === false).length
  const err = votes.filter((v) => v === null).length
  if (yes + no === 0) return { verdict: null, votes, unstable: false, errored: true }
  return { verdict: yes > no, votes, unstable: yes > 0 && no > 0, errored: err > 0 }
}

// ---------------------------------------------------------------------------
// Stage B — real activation via --plugin-dir
// ---------------------------------------------------------------------------
// Copy the real plugin and rewrite ONLY the description line, so the agent's
// actual skill-discovery path is exercised against each variant.
function buildPluginCopy(description, tag) {
  const dest = path.join(os.tmpdir(), `auth0-activation-${tag}-${process.pid}`)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(PLUGIN_DIR, dest, { recursive: true })

  const target = path.join(dest, "skills", "auth0", "SKILL.md")
  const text = fs.readFileSync(target, "utf-8")
  const fm = text.match(/^---\n([\s\S]*?)\n---/)
  const body = text.slice(fm[0].length)
  const lines = fm[1].split("\n")
  const i = lines.findIndex((l) => /^description:/.test(l))
  // Drop any continuation lines of a block scalar before substituting.
  let end = i + 1
  if (/^description:\s*[>|]/.test(lines[i])) {
    while (end < lines.length && !/^\S/.test(lines[end])) end++
  }
  const rebuilt = [...lines.slice(0, i), `description: ${description}`, ...lines.slice(end)]
  fs.writeFileSync(target, `---\n${rebuilt.join("\n")}\n---${body}`)
  return dest
}

// Detect a genuine skill invocation in the stream-json event log. Matching the
// Skill tool's own input is what makes this ground truth rather than a guess at
// prose ("I'll use the auth0 skill") — we look for the tool call itself.
function detectSkillUse(streamJsonl) {
  for (const line of streamJsonl.split("\n")) {
    if (!line.trim().startsWith("{")) continue
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    const content = ev?.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block?.type !== "tool_use") continue
      const name = String(block.name || "")
      if (!/^(Skill|mcp__.*skill.*)$/i.test(name)) continue
      const inp = JSON.stringify(block.input || {}).toLowerCase()
      if (inp.includes("auth0")) return true
    }
  }
  return false
}

async function realActivationOnce(pluginDir, userPrompt) {
  // A scratch cwd so the agent can't be swayed by this repo's own files, and
  // read-only tools only — we want the activation decision, not the work.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "auth0-activation-ws-"))
  const args = [
    "-p", userPrompt,
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--output-format", "stream-json",
    "--verbose",
    "--allowedTools", "Read,Glob,Grep,Skill",
    "--plugin-dir", pluginDir,
  ]
  if (MODEL) args.push("--model", MODEL)
  try {
    const { stdout } = await $({ cwd, timeout: 600000, reject: false })`claude ${args}`
    return detectSkillUse(stdout)
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true })
  }
}

// Same majority-vote + instability semantics as classifyWithTrials, so a Stage B
// REGRESSED/IMPROVED verdict isn't decided by one nondeterministic agent run.
async function realActivationWithTrials(pluginDir, userPrompt) {
  const votes = []
  for (let t = 0; t < TRIALS; t++) {
    votes.push(await realActivationOnce(pluginDir, userPrompt))
  }
  const yes = votes.filter((v) => v === true).length
  const no = votes.filter((v) => v === false).length
  return { verdict: yes > no, votes, unstable: yes > 0 && no > 0 }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function scoreboard(cases, results, key) {
  const pos = cases.filter((c) => c.should_activate)
  const neg = cases.filter((c) => !c.should_activate)
  const got = (c) => results.get(c.id)?.[key]?.verdict
  const recall = pos.filter((c) => got(c) === true).length
  const fp = neg.filter((c) => got(c) === true).length
  return {
    recall, posTotal: pos.length,
    falsePos: fp, negTotal: neg.length,
    correct: cases.filter((c) => got(c) === c.should_activate).length,
    total: cases.length,
  }
}

function pct(n, d) { return d === 0 ? "n/a" : `${((n / d) * 100).toFixed(0)}%` }

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, "cases.json"), "utf-8"))
  let cases = raw.cases
  if (ONLY) {
    const want = new Set(ONLY.split(",").map((s) => s.trim()))
    cases = cases.filter((c) => want.has(c.id))
    if (!cases.length) { console.error(`No cases matched --only ${ONLY}`); process.exit(1) }
  }

  const [base, cand] = await Promise.all([resolveVariant(BASELINE), resolveVariant(CANDIDATE)])

  console.log("\n  Auth0 skill-ACTIVATION evals")
  console.log(`  baseline  : ${base.label}  (${base.description.length} chars)`)
  console.log(`  candidate : ${cand.label}  (${cand.description.length} chars)`)
  console.log(`  cases     : ${cases.length}  (${cases.filter((c) => c.should_activate).length} positive, ${cases.filter((c) => !c.should_activate).length} negative)`)
  console.log(`  stage     : ${REAL ? "B (real --plugin-dir activation)" : "A (classifier)"}   trials: ${TRIALS}`)

  if (base.description === cand.description) {
    console.log("\n  NOTE: baseline and candidate descriptions are IDENTICAL — this run measures only harness noise.")
  }

  if (DRY) {
    const ids = new Set()
    let bad = 0
    for (const c of cases) {
      const problems = []
      if (!c.id) problems.push("missing id")
      if (ids.has(c.id)) problems.push("duplicate id")
      ids.add(c.id)
      if (typeof c.prompt !== "string" || !c.prompt.trim()) problems.push("missing prompt")
      if (typeof c.should_activate !== "boolean") problems.push("should_activate must be boolean")
      if (!c.why) problems.push("missing why (ground-truth justification)")
      if (problems.length) { console.log(`  BAD  ${c.id}: ${problems.join(", ")}`); bad++ }
    }
    console.log(`\n  ${cases.length - bad} cases valid, ${bad} problems.`)
    console.log("  Both description variants resolved OK.")
    process.exit(bad ? 1 : 0)
  }

  try { await $({ timeout: 15000 })`claude --version` } catch {
    console.error("  claude CLI not found."); process.exit(1)
  }

  const results = new Map()

  if (!REAL) {
    console.log(`\n  Running ${cases.length} cases x 2 variants x ${TRIALS} trials...\n`)
    for (const c of cases) {
      const [b, n] = await Promise.all([
        classifyWithTrials(base.description, c.prompt),
        classifyWithTrials(cand.description, c.prompt),
      ])
      results.set(c.id, { base: b, cand: n })
      const mark = (r) => (r.verdict === null ? "ERR " : r.verdict ? "FIRE" : "skip") + (r.unstable ? "?" : " ")
      const bOk = b.verdict === c.should_activate
      const nOk = n.verdict === c.should_activate
      let tag = "  "
      if (bOk && !nOk) tag = "REGRESSED"
      else if (!bOk && nOk) tag = "IMPROVED"
      console.log(`  ${c.should_activate ? "+" : "-"} ${c.id.padEnd(26)} old=${mark(b)} new=${mark(n)}  ${tag}`)
    }
  } else {
    const spot = cases.filter((c) => c.spot_check || ONLY)
    console.log(`\n  Stage B: ${spot.length} spot-check cases x 2 variants (real agent runs)...\n`)
    const baseDir = buildPluginCopy(base.description, "baseline")
    const candDir = buildPluginCopy(cand.description, "candidate")
    try {
      for (const c of spot) {
        const b = await realActivationWithTrials(baseDir, c.prompt)
        const n = await realActivationWithTrials(candDir, c.prompt)
        results.set(c.id, { base: b, cand: n })
        const mark = (r) => (r.verdict ? "FIRE" : "skip") + (r.unstable ? "?" : " ")
        const bOk = b.verdict === c.should_activate
        const nOk = n.verdict === c.should_activate
        let tag = "  "
        if (bOk && !nOk) tag = "REGRESSED"
        else if (!bOk && nOk) tag = "IMPROVED"
        console.log(`  ${c.should_activate ? "+" : "-"} ${c.id.padEnd(26)} old=${mark(b)} new=${mark(n)}  ${tag}`)
      }
      cases = spot
    } finally {
      fs.rmSync(baseDir, { recursive: true, force: true })
      fs.rmSync(candDir, { recursive: true, force: true })
    }
  }

  const b = scoreboard(cases, results, "base")
  const n = scoreboard(cases, results, "cand")
  console.log(`\n${"=".repeat(72)}\n  SUMMARY\n`)
  console.log(`                        baseline        candidate`)
  console.log(`  recall (positives)    ${String(b.recall + "/" + b.posTotal).padEnd(16)}${n.recall}/${n.posTotal}`)
  console.log(`  false positives       ${String(b.falsePos + "/" + b.negTotal).padEnd(16)}${n.falsePos}/${n.negTotal}`)
  console.log(`  overall correct       ${String(pct(b.correct, b.total)).padEnd(16)}${pct(n.correct, n.total)}`)

  const regressed = cases.filter((c) => results.get(c.id)?.base?.verdict === c.should_activate && results.get(c.id)?.cand?.verdict !== c.should_activate)
  const improved = cases.filter((c) => results.get(c.id)?.base?.verdict !== c.should_activate && results.get(c.id)?.cand?.verdict === c.should_activate)
  const unstable = cases.filter((c) => results.get(c.id)?.base?.unstable || results.get(c.id)?.cand?.unstable)
  const errored = cases.filter((c) => results.get(c.id)?.base?.errored || results.get(c.id)?.cand?.errored)

  if (regressed.length) {
    console.log(`\n  REGRESSED (${regressed.length}) — candidate got these wrong, baseline got them right:`)
    for (const c of regressed) console.log(`    ${c.id}: "${c.prompt.slice(0, 70)}${c.prompt.length > 70 ? "..." : ""}"`)
  } else {
    console.log(`\n  REGRESSED: none.`)
  }
  if (improved.length) {
    console.log(`\n  IMPROVED (${improved.length}) — candidate got these right, baseline got them wrong:`)
    for (const c of improved) console.log(`    ${c.id}: "${c.prompt.slice(0, 70)}${c.prompt.length > 70 ? "..." : ""}"`)
  }
  if (unstable.length) console.log(`\n  UNSTABLE (trials disagreed, treat with care): ${unstable.map((c) => c.id).join(", ")}`)
  if (errored.length) console.log(`\n  ERRORED (unparseable replies): ${errored.map((c) => c.id).join(", ")}`)
  if (!REAL) console.log(`\n  Re-run flagged cases against the real activation path:\n    node run-activation-evals.mjs --real --only ${[...new Set([...regressed, ...unstable].map((c) => c.id))].join(",") || "<ids>"}`)

  // Exit non-zero only on a genuine regression, so this can gate a description change.
  process.exit(regressed.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
