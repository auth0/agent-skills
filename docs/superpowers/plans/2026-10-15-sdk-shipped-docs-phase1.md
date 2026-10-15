# SDK-Shipped Docs — Phase 1 (this repo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land everything the thin-reference model needs inside this repo — the SDK docs contract, the rewritten sourcing discipline, a docs-link checker, a transcript grader — and slim the first feature exemplars.

**Architecture:** No change to the router, `references/` layout, or reachability rules. Docs define the new reference shapes and the contract SDK teams implement; two small tools (Python link checker, JS transcript grader) support the per-reference gate; two feature references are slimmed as worked examples.

**Tech Stack:** Markdown, Python 3 + unittest/pytest (`scripts/`), Node ESM + `node:test` (`evals/behavioral/`), `claude` CLI stream-json.

**Spec:** `docs/superpowers/specs/2026-10-15-sdk-shipped-docs-design.md`

## Global Constraints

- Router (`plugins/auth0/skills/auth0/SKILL.md`), reference file paths, and `evals/routing-cases.json` are **not** changed.
- No `SKILL.md` frontmatter / `description` edits (activation evals unaffected).
- No automation that generates references from SDK docs.
- SDK docs convention: `docs/` directory at the SDK repo root, entry point `docs/README.md`; never `skills/SKILL.md`.
- Discovery order in references: local installed package `docs/` → `raw.githubusercontent.com/auth0/<repo>/v<installed-version>/docs/...` → `https://auth0.com/docs/<page>.md`.
- auth0.com pages are fetched as their `.md` variant; `https://auth0.com/docs/llms.txt` is the discovery index.
- Extract before offload: an agent-only rule is copied into kept text before its block is deleted.
- Every task ends green on: `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0`, `python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0`, `uvx skillsaw --strict` (if the `uvx` shim fails in a sandbox, run skillsaw from a `/tmp` venv: `python3 -m venv /tmp/sk && /tmp/sk/bin/pip install skillsaw && /tmp/sk/bin/skillsaw --strict`).
- Commits end with `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Findings that refine the spec (applied in Task 6)

- `feature-audit-remediation` (113 lines) is entirely DECISION + WIRING (command mapping, guided/batch flows, never-without-confirmation list); nothing on auth0.com/docs serves it. It already conforms — **no slim**.
- `feature-audit-pricing`: `https://auth0.com/pricing.md` (200, `text/markdown`) carries the same "Feature Comparison" B2C/B2B sections and headings as the local matrix. The local matrix is a duplicate → offload, keep the quoting procedure.
- `feature-universal-portals`: the portals docs `.md` pages (`customize/portals/overview.md`, `quickstart.md`) do **not** contain the payload component types, callback URL, or scope table → those stay; only the Sources list becomes a mandatory read block.
- `evals/behavioral/cases/{audit,healthcheck}.json` have `"graders": null` and there is no case for universal-portals, so the "with-skill score ≥ pre-slim" gate cannot run for these exemplars. Their gate is the static checks + the extract-before-offload checklist in each task.
- `author-auth0-skill` is not tracked on `main` or this branch (only in an untracked worktree) → out of scope for this plan.

## File map

| File | Action | Responsibility |
|---|---|---|
| `docs/sdk-docs-contract.md` | Create | Contract SDK teams implement + rollout table |
| `docs/architecture.md` | Modify (§ Sourcing discipline, lines 64–end) | New reference shapes and disposition rules |
| `CONTRIBUTING.md` | Modify (after "Adding a reference") | Short "Reference shape" pointer to architecture.md |
| `AGENTS.md` | Modify (Key top-level docs list) | Link the contract |
| `scripts/check_docs_links.py` | Create | Verify auth0.com `.md`/`.txt` fetch targets in references |
| `scripts/test_check_docs_links.py` | Create | Unit tests (injected fetcher, no network) |
| `evals/behavioral/graders.mjs` | Modify | `parseToolUses()` + `transcript_matches` grader; `runGraders` takes tool uses |
| `evals/behavioral/graders.test.mjs` | Create | `node:test` tests for the above |
| `evals/behavioral/run-evals.mjs` | Modify | stream-json capture, pass tool uses to graders, save transcript |
| `evals/behavioral/package.json` | Modify | `"test"` script |
| `evals/behavioral/README.md` | Modify | Document `transcript_matches` |
| `plugins/auth0/skills/auth0/references/feature-audit-pricing/index.md` | Rewrite | Quoting procedure only; matrix + prices from pricing.md |
| `plugins/auth0/skills/auth0/references/feature-audit/index.md` | Modify (lines 9, 361) | Point matrix source at fetched page |
| `plugins/auth0/skills/auth0/references/feature-healthcheck/index.md` | Modify (lines 9, 11, 270) | Same |
| `plugins/auth0/skills/auth0/references/feature-universal-portals/index.md` | Modify | Mandatory "Read the docs" block replaces Sources |
| `docs/superpowers/specs/2026-10-15-sdk-shipped-docs-design.md` | Modify (§3 Order) | Record exemplar findings |

---

### Task 1: SDK docs contract + rewritten sourcing discipline

**Files:**
- Create: `docs/sdk-docs-contract.md`
- Modify: `docs/architecture.md` (replace from `## Sourcing discipline (what stays inline vs. delegates)` through the line before `To add or extend a capability, see`)
- Modify: `CONTRIBUTING.md` (insert before `### Validate`)
- Modify: `AGENTS.md` (Key top-level docs list, after the `docs/architecture.md` bullet)

**Interfaces:**
- Produces: anchor `docs/architecture.md#sourcing-discipline-what-the-skill-owns`, the two template tables, and the canonical **Read block** text that Tasks 4–5 and all later slims copy verbatim.

- [ ] **Step 1: Create `docs/sdk-docs-contract.md`**

```markdown
# SDK docs contract

Auth0 SDKs ship their own task-level docs so that **any** developer or coding
agent — with or without the `auth0` skill — can integrate correctly from what is
installed. The skill's framework references then stay thin and point here
instead of duplicating SDK content. Design: see
[`docs/architecture.md`](./architecture.md#sourcing-discipline-what-the-skill-owns).

## What an SDK ships

- **Location:** a `docs/` directory at the SDK repo root, containing Markdown.
- **Published:** included in the release artifact wherever the format allows it
  (npm `files`, composer archive, gem, wheel/sdist, …). Where the artifact can't
  carry Markdown (Android AAR, Swift SPM, NuGet), presence in the repo at the
  release tag is enough — agents fall back to GitHub at that tag.
- **Entry point:** `docs/README.md` — a table of contents, one line per file,
  saying what each file answers. Agents read it first, then only the files they
  need.
- **Versioning:** the `docs/` at a tag describes that tag. Never document
  unreleased behaviour on a release tag.

## Expected topics

| Topic | Must cover |
|---|---|
| Getting started | Install, configuration, env var names, minimal login + logout |
| Protecting routes / screens | The supported mechanisms for this platform |
| Calling APIs | Getting access tokens, audience/scopes, refresh |
| Error handling | Error types/codes, their causes, how to catch them |
| Migration | Only when a previous major version exists |
| Feature guides | Optional: MFA, organizations, passkeys, DPoP, … |

## Style

- Written for people and agents alike; no harness-specific frontmatter.
- Copy-pasteable code with explicit import paths.
- An **anti-patterns** list per guide (what not to do, and why).

## How agents find it

1. Local installed package: `node_modules/<pkg>/docs/`, `vendor/<pkg>/docs/`, …
2. Otherwise: `https://raw.githubusercontent.com/auth0/<repo>/v<installed-version>/docs/README.md`
3. Auth0 concepts: `https://auth0.com/docs/<page>.md`

## Rollout

A framework reference in this repo is slimmed only once its SDK's row is
`shipped`. Until then the reference stays as is.

| SDK package | Repo | Status | First version shipping `docs/` |
|---|---|---|---|
| `@auth0/nextjs-auth0` | auth0/nextjs-auth0 | not started (4.32.0 ships `skills/` + `guides/`, not `docs/`) | — |
| `@auth0/auth0-react` | auth0/auth0-react | not started (2.28.2 ships `README.md` only) | — |
| `@auth0/auth0-spa-js` | auth0/auth0-spa-js | not started (2.28.4 ships `README.md` only) | — |
```

- [ ] **Step 2: Add one rollout row per remaining `framework-*` reference**

List the install lines to find each SDK package:

```bash
grep -h -m1 -E '^(npm|yarn|pnpm) (install|add)|composer require|pip install|go get|dotnet add package|implementation .com\.auth0|pod .Auth0|flutter pub add' plugins/auth0/skills/auth0/references/framework-*/index.md | sort -u
```

For each package not already in the table, add a row with status `not started`. Fill the Repo column only from the package's registry metadata (`npm view <pkg> repository.url`, PyPI/Packagist/pkg.go.dev page); if it can't be confirmed, write `unverified`.

- [ ] **Step 3: Replace the Sourcing discipline section in `docs/architecture.md`**

Replace everything from the line `## Sourcing discipline (what stays inline vs. delegates)` up to (not including) `To add or extend a capability, see` with:

````markdown
## Sourcing discipline (what the skill owns)

**The skill owns only what no single SDK or docs page can; everything else is a
pointer the agent must fetch.** SDK usage lives in each SDK's shipped `docs/`
(see [`sdk-docs-contract.md`](./sdk-docs-contract.md)); Auth0 concepts and
product procedures live on auth0.com/docs, which serves every page as Markdown
when `.md` is appended (index: `https://auth0.com/docs/llms.txt`).

### Framework reference (`framework-*/index.md`, ~60–100 lines)

Applies once the SDK's row in the contract's rollout table is `shipped`.

| Block | Contents |
|---|---|
| Use / don't use | One-line purpose; "when NOT to use → route elsewhere" |
| Install | Package-manager command |
| Tenant setup | Auth0 CLI app creation, callback/logout URLs, env var names |
| **Read the SDK docs** | The Read block below — a mandatory step |
| Agent-only rules | ≤ ~10 Common Mistakes / decisions the SDK docs don't cover |

### Feature reference (`feature-*/index.md`)

| Block | Contents |
|---|---|
| Use / don't use | Same as framework |
| **Read the docs** | The specific `https://auth0.com/docs/<page>.md` pages — a mandatory step |
| WIRING the docs lack | Agent step-blocks, exact Management API / CLI sequences, request bodies, gotchas |
| DECISION | Triage tables, capability/plan gating, diagnostic ladders |

### The Read block

Framework references use this text, filling `<pkg>`, `<repo>`, `<page>`:

```
## Read the SDK docs (required before writing code)

1. If installed, read `node_modules/<pkg>/docs/README.md` (or the package's
   `docs/` wherever the ecosystem installs it), then the files it lists for
   this task.
2. Otherwise fetch
   `https://raw.githubusercontent.com/auth0/<repo>/v<installed-version>/docs/README.md`
   — use the installed version, or the latest release for a new install.
3. For Auth0 concepts, fetch `https://auth0.com/docs/<page>.md`.

Prefer what these say over anything remembered. If none can be read, say so
and continue with the steps below.
```

Feature references use a `## Read the docs (required)` block listing their
`https://auth0.com/docs/<page>.md` URLs with one line each on what to take from
the page.

### Rules

- **Extract before offload.** A block being removed sometimes carries an
  agent-only rule that exists nowhere else. Copy it into the kept text first.
- **Fetches are steps, not links.** Phrase them "Read X before …", never
  "See also".
- **Greenfield:** install first, then read the local `docs/`.
- **Verify every URL** with `python3 scripts/check_docs_links.py
  plugins/auth0/skills/auth0` before merging a slimmed reference.
- **Gate:** a slimmed reference's behavioral eval (if it has graders) must score
  ≥ its pre-slim with-skill score.

`feature-audit-pricing/` (offload to a fetched page) and
`feature-universal-portals/` (feature WIRING the docs lack stays inline) are the
worked examples.

````

- [ ] **Step 4: Add the CONTRIBUTING pointer**

Insert immediately before the line `### Validate` in `CONTRIBUTING.md`:

```markdown
### Reference shape
Before writing or keeping content in a reference, apply the [sourcing
discipline](./docs/architecture.md#sourcing-discipline-what-the-skill-owns):
the skill keeps install, tenant setup, agent step-blocks, and decision tables;
SDK usage comes from the SDK's shipped `docs/` ([contract](./docs/sdk-docs-contract.md))
and concepts from `https://auth0.com/docs/<page>.md`.

```

- [ ] **Step 5: Link the contract from `AGENTS.md`**

After the `docs/architecture.md` bullet in "Key top-level docs", add:

```markdown
- [`docs/sdk-docs-contract.md`](./docs/sdk-docs-contract.md) — the `docs/`
  directory Auth0 SDKs ship, and which references are slimmed against it.
```

- [ ] **Step 6: Verify**

```bash
grep -n 'sourcing-discipline-what-the-skill-owns' CONTRIBUTING.md docs/sdk-docs-contract.md
grep -c 'Inline, always\|verified against' docs/architecture.md
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

Expected: two anchor hits; `0` from the retired-rule grep; all checks pass.

- [ ] **Step 7: Commit**

```bash
git add docs/sdk-docs-contract.md docs/architecture.md CONTRIBUTING.md AGENTS.md
git commit -m "docs: add SDK docs contract and rewrite sourcing discipline

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Docs-link checker

**Files:**
- Create: `scripts/check_docs_links.py`
- Test: `scripts/test_check_docs_links.py`

**Interfaces:**
- Produces: `extract_urls(text: str) -> list[str]`, `check_urls(urls: list[str], fetch) -> list[tuple[str, str]]` (failures as `(url, reason)`), where `fetch(url) -> tuple[int, str]` returns `(status, content_type)`; CLI `python3 scripts/check_docs_links.py <skill_dir>` exits 1 on any failure. Not wired into CI (spec: manual/scheduled).

- [ ] **Step 1: Write the failing tests**

`scripts/test_check_docs_links.py`:

```python
import tempfile, unittest
from pathlib import Path
from check_docs_links import extract_urls, check_urls, collect_urls


class ExtractUrls(unittest.TestCase):
    def test_finds_md_and_txt_fetch_targets(self):
        text = (
            "Fetch `https://auth0.com/docs/customize/portals/overview.md` and\n"
            "(https://auth0.com/pricing.md), index https://auth0.com/docs/llms.txt.\n"
        )
        self.assertEqual(
            extract_urls(text),
            [
                "https://auth0.com/docs/customize/portals/overview.md",
                "https://auth0.com/pricing.md",
                "https://auth0.com/docs/llms.txt",
            ],
        )

    def test_ignores_html_pages_and_other_hosts(self):
        text = "https://auth0.com/docs/quickstart/webapp/nextjs https://example.com/a.md"
        self.assertEqual(extract_urls(text), [])

    def test_dedupes_preserving_order(self):
        u = "https://auth0.com/pricing.md"
        self.assertEqual(extract_urls(f"{u} {u}"), [u])


class CheckUrls(unittest.TestCase):
    def test_ok_markdown_passes(self):
        fetch = lambda url: (200, "text/markdown; charset=utf-8")
        self.assertEqual(check_urls(["https://auth0.com/pricing.md"], fetch), [])

    def test_plain_text_passes_for_llms_txt(self):
        fetch = lambda url: (200, "text/plain; charset=utf-8")
        self.assertEqual(check_urls(["https://auth0.com/docs/llms.txt"], fetch), [])

    def test_404_fails(self):
        fetch = lambda url: (404, "text/html")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/gone.md"], fetch),
            [("https://auth0.com/docs/gone.md", "HTTP 404")],
        )

    def test_html_served_for_md_fails(self):
        fetch = lambda url: (200, "text/html; charset=utf-8")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/x.md"], fetch),
            [("https://auth0.com/docs/x.md", "content-type text/html; charset=utf-8")],
        )

    def test_fetch_exception_fails(self):
        def fetch(url):
            raise OSError("timeout")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/x.md"], fetch),
            [("https://auth0.com/docs/x.md", "error: timeout")],
        )


class CollectUrls(unittest.TestCase):
    def test_walks_references_recursively(self):
        with tempfile.TemporaryDirectory() as d:
            ref = Path(d) / "references" / "feature-x"
            ref.mkdir(parents=True)
            (ref / "index.md").write_text("read https://auth0.com/docs/a.md\n")
            (Path(d) / "SKILL.md").write_text("https://auth0.com/docs/b.md\n")
            self.assertEqual(
                collect_urls(Path(d)),
                {"https://auth0.com/docs/a.md": ["references/feature-x/index.md"],
                 "https://auth0.com/docs/b.md": ["SKILL.md"]},
            )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts && uv run --with pytest python -m pytest test_check_docs_links.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'check_docs_links'`

- [ ] **Step 3: Implement `scripts/check_docs_links.py`**

```python
#!/usr/bin/env python3
"""Verify the auth0.com Markdown fetch targets the skill tells agents to read.

References point agents at `https://auth0.com/...(.md|.txt)` pages as mandatory
read steps (docs/architecture.md, "Sourcing discipline"). The reachability check
only covers intra-skill links, so a moved docs page would fail silently at agent
runtime. Run this manually or on a schedule — it needs network:

    python3 scripts/check_docs_links.py plugins/auth0/skills/auth0
"""
import re, sys, urllib.request
from pathlib import Path

URL_RE = re.compile(r"https://auth0\.com/[^\s)>\]`\"']+?\.(?:md|txt)\b")
OK_TYPES = ("text/markdown", "text/plain")


def extract_urls(text):
    seen = []
    for url in URL_RE.findall(text):
        if url not in seen:
            seen.append(url)
    return seen


def collect_urls(skill_dir):
    found = {}
    for path in sorted(Path(skill_dir).rglob("*.md")):
        rel = path.relative_to(skill_dir).as_posix()
        for url in extract_urls(path.read_text(encoding="utf-8")):
            found.setdefault(url, []).append(rel)
    return found


def check_urls(urls, fetch):
    failures = []
    for url in urls:
        try:
            status, ctype = fetch(url)
        except Exception as e:  # network errors are reported, not raised
            failures.append((url, f"error: {e}"))
            continue
        if status != 200:
            failures.append((url, f"HTTP {status}"))
        elif not ctype.startswith(OK_TYPES):
            failures.append((url, f"content-type {ctype}"))
    return failures


def http_fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "auth0-agent-skills-linkcheck"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", "")


def main(argv):
    if len(argv) != 2:
        print(f"usage: {argv[0]} <skill_dir>", file=sys.stderr)
        return 2
    found = collect_urls(Path(argv[1]))
    failures = check_urls(list(found), http_fetch)
    for url, reason in failures:
        print(f"FAIL {url} ({reason}) — in {', '.join(found[url])}")
    print(f"{len(found) - len(failures)}/{len(found)} auth0.com fetch targets OK")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts && uv run --with pytest python -m pytest test_check_docs_links.py -q`
Expected: `9 passed`

- [ ] **Step 5: Run against the real skill**

Run: `python3 scripts/check_docs_links.py plugins/auth0/skills/auth0`
Expected: summary line `N/N auth0.com fetch targets OK`. If any `FAIL` lines appear, they are pre-existing broken targets: list them in the commit body; do not fix them in this task.

- [ ] **Step 6: Commit**

```bash
git add scripts/check_docs_links.py scripts/test_check_docs_links.py
git commit -m "feat(scripts): add auth0.com docs fetch-target link checker

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `transcript_matches` grader + stream-json capture

**Files:**
- Modify: `evals/behavioral/graders.mjs` (add after `gradeNotMatches`, ~line 230; extend `runGraders` at line 300)
- Modify: `evals/behavioral/run-evals.mjs` (`runAgent` ~line 69; `runCase` ~lines 133–141)
- Modify: `evals/behavioral/package.json`, `evals/behavioral/README.md`
- Test: `evals/behavioral/graders.test.mjs`

**Interfaces:**
- Produces: `export function parseToolUses(streamJson: string): Array<{name: string, input: object}>`; grader JSON `{ "type": "transcript_matches", "pattern": "<regex>", "description": "..." }` — passes iff the regex matches `` `${name} ${JSON.stringify(input)}` `` for any tool use; `runGraders(graders, workspaceDir, model = null, toolUses = [])`.
- Consumes: `claude -p … --output-format stream-json --verbose` emits one JSON object per line; tool calls are `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"…"}}]}}` (verified locally 2026-10-15; stream-json in `-p` mode errors without `--verbose`).

- [ ] **Step 1: Write the failing tests**

`evals/behavioral/graders.test.mjs`:

```js
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseToolUses, runGraders } from "./graders.mjs"

const line = (o) => JSON.stringify(o)
const STREAM = [
  line({ type: "system", subtype: "init" }),
  line({ type: "assistant", message: { content: [
    { type: "text", text: "Reading docs" },
    { type: "tool_use", name: "Read", input: { file_path: "/w/node_modules/@auth0/nextjs-auth0/docs/README.md" } },
  ] } }),
  "not json — ignored",
  line({ type: "assistant", message: { content: [
    { type: "tool_use", name: "WebFetch", input: { url: "https://auth0.com/docs/quickstart/webapp/nextjs.md" } },
  ] } }),
  line({ type: "result", result: "done" }),
].join("\n")

test("parseToolUses extracts tool_use blocks in order and skips junk lines", () => {
  assert.deepEqual(parseToolUses(STREAM), [
    { name: "Read", input: { file_path: "/w/node_modules/@auth0/nextjs-auth0/docs/README.md" } },
    { name: "WebFetch", input: { url: "https://auth0.com/docs/quickstart/webapp/nextjs.md" } },
  ])
})

test("parseToolUses returns [] for empty output", () => {
  assert.deepEqual(parseToolUses(""), [])
})

const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "grader-test-"))

test("transcript_matches passes when a tool use matches", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "nextjs-auth0/docs/|auth0\\.com/docs/.+\\.md", description: "read SDK docs" }],
    emptyDir(), null, parseToolUses(STREAM))
  assert.equal(r.pass, true)
  assert.match(r.detail, /Read/)
})

test("transcript_matches fails when no tool use matches", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "auth0-react/docs/", description: "read SDK docs" }],
    emptyDir(), null, parseToolUses(STREAM))
  assert.equal(r.pass, false)
  assert.match(r.detail, /2 tool uses/)
})

test("transcript_matches reports an invalid regex", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "(", description: "bad" }], emptyDir(), null, [])
  assert.equal(r.pass, false)
  assert.match(r.detail, /Invalid regex/)
})
```

- [ ] **Step 2: Add the test script and run tests to verify they fail**

In `evals/behavioral/package.json` `"scripts"`, add `"test": "node --test graders.test.mjs",`.

Run: `cd evals/behavioral && npm test`
Expected: FAIL — `SyntaxError: The requested module './graders.mjs' does not provide an export named 'parseToolUses'`

- [ ] **Step 3: Implement in `graders.mjs`**

Add to the header comment's grader list (after the `judge` line):

```js
//   transcript_matches              — regex matched against the agent's tool calls
```

Add after `gradeNotMatches`:

```js
// Parse `claude -p --output-format stream-json --verbose` output into the
// ordered list of tool calls. Non-JSON lines are skipped (stderr noise).
export function parseToolUses(streamJson) {
  const uses = []
  for (const raw of streamJson.split("\n")) {
    let event
    try { event = JSON.parse(raw) } catch { continue }
    if (event?.type !== "assistant") continue
    for (const block of event.message?.content || []) {
      if (block.type === "tool_use") uses.push({ name: block.name, input: block.input })
    }
  }
  return uses
}

// Did the agent actually read the docs it was told to? Matches the pattern
// against `<ToolName> <input JSON>` for each call, so one regex covers a local
// Read of node_modules/<pkg>/docs/ and a WebFetch of an auth0.com .md page.
function gradeTranscriptMatches(grader, toolUses) {
  let regex
  try {
    regex = new RegExp(grader.pattern)
  } catch {
    return { pass: false, detail: `Invalid regex pattern: ${grader.pattern}` }
  }
  for (const use of toolUses) {
    const flat = `${use.name} ${JSON.stringify(use.input)}`
    if (regex.test(flat)) return { pass: true, detail: `Matched: ${flat.slice(0, 200)}` }
  }
  return { pass: false, detail: `Pattern /${grader.pattern}/ matched none of ${toolUses.length} tool uses` }
}
```

Change `runGraders` signature and switch:

```js
// Run every grader against the workspace. `model` (optional) is forwarded to
// judge graders as the --model flag for `claude -p`. `toolUses` (from
// parseToolUses) feeds transcript_matches graders.
export async function runGraders(graders, workspaceDir, model = null, toolUses = []) {
```

and add inside the `switch`, before `default:`:

```js
      case "transcript_matches": result = gradeTranscriptMatches(grader, toolUses); break
```

(`transcript_matches` is deliberately in neither `positiveTypes` nor `negativeTypes`: it says nothing about workspace contents, so the empty-workspace guard ignores it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd evals/behavioral && npm test`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Capture stream-json in `run-evals.mjs`**

Change the import line:

```js
import { runGraders, parseToolUses } from "./graders.mjs"
```

In `runAgent`, add to `args` after `"--no-session-persistence",`:

```js
    "--output-format", "stream-json", "--verbose", // tool calls, for transcript_matches
```

and replace its last two lines with:

```js
  const { stdout } = await $({ cwd: workspaceDir, timeout: 600000, reject: false })`claude ${args}`
  // Keep the raw transcript next to (not inside) the graded workspace.
  fs.writeFileSync(`${workspaceDir}.transcript.jsonl`, stdout)
  return { stdout, toolUses: parseToolUses(stdout), durationMs: Date.now() - start }
```

In `runCase`, replace

```js
  await runAgent(prompt, withDir, true)
  const withRes = await runGraders(graders, withDir, MODEL)
```

with

```js
  const withRun = await runAgent(prompt, withDir, true)
  const withRes = await runGraders(graders, withDir, MODEL, withRun.toolUses)
```

and

```js
    await runAgent(prompt, withoutDir, false)
    const withoutRes = await runGraders(graders, withoutDir, MODEL)
```

with

```js
    const withoutRun = await runAgent(prompt, withoutDir, false)
    const withoutRes = await runGraders(graders, withoutDir, MODEL, withoutRun.toolUses)
```

- [ ] **Step 6: Document the grader in `evals/behavioral/README.md`**

In the section that lists grader types (search the README for `not_matches`), add the bullet below; if the README has no such list, add it under a new `### Grader types` heading after the case-file schema example:

```markdown
- `transcript_matches` — `pattern` (regex) is tested against each tool call the
  agent made, flattened as `<ToolName> <input JSON>`. Use it to assert the agent
  read the SDK's shipped `docs/` or fetched an auth0.com `.md` page, e.g.
  `"pattern": "nextjs-auth0/(v[^/]+/)?docs/|auth0\\.com/docs/.+\\.md"`. Raw
  transcripts are saved as `<workspace>.transcript.jsonl`.
```

- [ ] **Step 7: Smoke-test the runner offline**

Run: `cd evals/behavioral && node run-evals.mjs --dry-run && npm test`
Expected: dry-run validates all cases without error; tests pass.

- [ ] **Step 8: Commit**

```bash
git add evals/behavioral/graders.mjs evals/behavioral/graders.test.mjs evals/behavioral/run-evals.mjs evals/behavioral/package.json evals/behavioral/README.md
git commit -m "feat(evals): add transcript_matches grader and stream-json capture

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Slim `feature-audit-pricing` (offload exemplar)

**Files:**
- Rewrite: `plugins/auth0/skills/auth0/references/feature-audit-pricing/index.md`
- Modify: `plugins/auth0/skills/auth0/references/feature-audit/index.md:9`, `:361`
- Modify: `plugins/auth0/skills/auth0/references/feature-healthcheck/index.md:9`, `:11`, `:270`

**Interfaces:**
- Consumes: Read-block convention from Task 1; `scripts/check_docs_links.py` from Task 2.
- Produces: the phrase "Feature Comparison section of the fetched pricing page" that audit/healthcheck now cite as the matrix source.

- [ ] **Step 1: Extract-before-offload checklist**

Confirm each agent-only rule from the current file survives in the rewrite below (tick each):
- fetch `pricing.md` before quoting any figure; no figure from memory
- B2C vs B2B; MAU tier = next tier up when between tiers
- minimum plan from the feature comparison; base + add-ons = total
- "Contact us" → sales; "Not available" → don't recommend/total, move up or sales
- never quote or estimate an Enterprise price
- yearly = 11× monthly; custom domains need credit-card verification; Free = 25,000 MAUs, no card (Notes)

Also confirm pricing.md still has the matrix: `curl -sSL https://auth0.com/pricing.md | grep -n '^### B2[BC] Feature Comparison'` → two lines. If not, stop: the offload premise no longer holds.

- [ ] **Step 2: Replace the file with**

```markdown
# Auth0 Pricing

Prices **and** the feature→plan matrix live on one page. Fetch it once at the
start and take every figure and plan mapping from that single response.

## Read the docs (required)

- `https://auth0.com/pricing.md` — B2C and B2B base-price tables (monthly and
  yearly), every add-on table (Auth for AI Agents, M2M tokens, Enterprise SSO
  connections, Enterprise MFA), MAU tiers, and the **Feature Comparison**
  section (B2C and B2B: Authentication, AI, Branding, Extensibility, Security &
  Compliance, User Management, Platform). That Feature Comparison is the
  source of truth for which plan unlocks a feature.

If the page can't be fetched: give plan names without figures, never a price
from memory, and label any feature→plan mapping `plan unverified (pricing page
unreachable)` instead of guessing.

## Quoting procedure

1. **Fetch `https://auth0.com/pricing.md`** before quoting any figure.
2. **Determine use case:** B2C (consumer-facing) or B2B (business-facing). The
   Free plan is identical for both: up to 25,000 MAUs, no credit card.
3. **Identify the MAU tier** that meets or exceeds expected monthly active
   users. Between tiers, use the next tier up.
4. **Select the minimum plan** (Free, Essentials, Professional, Enterprise) by
   matching required features against the page's Feature Comparison for that
   use case.
5. **Look up the base price** in the page's B2C or B2B table.
6. **Add add-ons** the customer needs, each price from the page.
7. **Total** = base price + sum of applicable add-ons. Yearly billing = 11× the
   monthly price.
8. **"Contact us"** → direct the customer to Auth0 sales for a custom quote.
   **"Not available"** → that plan/add-on doesn't exist at their tier: don't
   recommend or total it; move up a plan or send them to sales.

## Rules

- **Never quote or estimate an Enterprise price.** Enterprise is sold through
  Auth0 sales.
- Custom domains require credit-card verification even where the plan includes
  them.
- Use plan and feature names exactly as the page spells them.
```

- [ ] **Step 3: Repoint `feature-audit/index.md`**

Line 9 — replace the sentence

`For the feature→plan matrix (Free/Essentials/Professional/Enterprise, B2C + B2B) that is the source of truth for triaging findings into Immediate vs After-Upgrading, use the co-loaded pricing reference.`

with

`For the feature→plan matrix (Free/Essentials/Professional/Enterprise, B2C + B2B) that is the source of truth for triaging findings into Immediate vs After-Upgrading, use the Feature Comparison section of the fetched pricing page, as the co-loaded pricing reference instructs.`

Line 361 — replace

`**The source of truth for which plan a feature requires is the co-loaded pricing reference** — the full Auth0 feature→plan matrix (B2C + B2B). Read it before triaging;`

with

`**The source of truth for which plan a feature requires is the Feature Comparison section of \`https://auth0.com/pricing.md\`** (B2C + B2B), fetched per the co-loaded pricing reference. Read it before triaging;`

- [ ] **Step 4: Repoint `feature-healthcheck/index.md`**

Line 9 — replace

`use the co-loaded pricing reference — **never hardcode any of it, and never let anything below contradict it.** Prices are not in that reference: fetch them from \`https://auth0.com/pricing.md\` as it instructs.`

with

`use the Feature Comparison section of \`https://auth0.com/pricing.md\`, fetched per the co-loaded pricing reference — **never hardcode any of it, and never let anything below contradict it.** Prices come from the same fetched page.`

Line 11 — replace `feature availability, MAU limits, and the feature→plan matrix come from the co-loaded pricing reference;` with `feature availability, MAU limits, and the feature→plan matrix come from the fetched pricing page's Feature Comparison (per the co-loaded pricing reference);`

Line 270 — replace `read the co-loaded pricing reference directly rather than relying on the summary above;` with `read the Feature Comparison section of the fetched pricing page rather than relying on the summary above;`

Leave other "pricing reference" mentions as they are — the pricing reference now routes them to the page.

- [ ] **Step 5: Verify**

```bash
wc -l plugins/auth0/skills/auth0/references/feature-audit-pricing/index.md   # expect < 70
grep -n 'feature→plan matrix below is local\|read it from here' plugins/auth0/skills/auth0/references/feature-*/index.md   # expect none
python3 scripts/check_docs_links.py plugins/auth0/skills/auth0
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

Expected: all pass; `https://auth0.com/pricing.md` reported OK.

- [ ] **Step 6: Commit**

```bash
git add plugins/auth0/skills/auth0/references/feature-audit-pricing/index.md plugins/auth0/skills/auth0/references/feature-audit/index.md plugins/auth0/skills/auth0/references/feature-healthcheck/index.md
git commit -m "refactor(skill): offload pricing feature matrix to auth0.com/pricing.md

The local B2C/B2B feature comparison duplicated the Feature Comparison
section of https://auth0.com/pricing.md. Keep the quoting procedure and
agent-only rules; audit and healthcheck now cite the fetched page.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Trim `feature-universal-portals` (feature-WIRING exemplar)

**Files:**
- Modify: `plugins/auth0/skills/auth0/references/feature-universal-portals/index.md` (insert after the beta-note paragraph ending line 7; delete `## Sources` section, lines 296–302)

**Interfaces:**
- Consumes: feature Read-block convention from Task 1.

- [ ] **Step 1: Confirm the docs still lack the wiring kept inline**

```bash
curl -sSL https://auth0.com/docs/customize/portals/quickstart.md https://auth0.com/docs/customize/portals/overview.md | grep -c 'page:component:auth0\|portals/auth/callback\|create:portals'
```

Expected: `0` — payload component types, callback URL, and scope table exist only in the reference, so they stay. If non-zero, note which block is now duplicated and trim it to a one-line pointer in this task.

- [ ] **Step 2: Insert the Read block**

Insert after the paragraph that starts `A portal is backed by a Regular Web Application.` (before `## Choose the right workflow`):

```markdown
## Read the docs (required)

- `https://auth0.com/docs/customize/portals/overview.md` — what portals are and
  which components exist; read before proposing a design.
- `https://auth0.com/docs/customize/portals/quickstart.md` — what
  `auth0-beta universal-portals setup` provisions; read before running it.

The payload shapes, callback/logout URLs, and scopes below are not on those
pages — use them as written here.
```

- [ ] **Step 3: Delete the Sources section**

Delete from `## Sources` to end of file (the overview/quickstart URLs moved to the Read block; Management API, CLI, and Lucide links are already cited at their point of use — verify with `grep -n 'auth0_api\|lucide' plugins/auth0/skills/auth0/references/feature-universal-portals/index.md`; if a link has no remaining mention, add it inline where that tool is first used).

- [ ] **Step 4: Verify**

```bash
python3 scripts/check_docs_links.py plugins/auth0/skills/auth0
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

Expected: all pass; both portals `.md` URLs reported OK.

- [ ] **Step 5: Commit**

```bash
git add plugins/auth0/skills/auth0/references/feature-universal-portals/index.md
git commit -m "refactor(skill): make universal-portals docs a required read step

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Record findings in the spec + final gate

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-sdk-shipped-docs-design.md` (§3 Order, item 2)

- [ ] **Step 1: Update rollout item 2 in the spec**

In item 2 ("Feature references"), the exemplar parenthetical is wrapped across two lines. Replace the parenthetical (from `(` before `universal-portals` through the `)` after `audit-pricing`) with:

```
(`audit-pricing` — offload; `universal-portals` — feature WIRING
   stays; `audit-remediation` reviewed and already conforms, no change)
```

and append under "Per-reference merge gate":

```markdown
- References without a graded behavioral case (`audit`, `healthcheck`,
  `universal-portals` today) are gated on the static checks plus an explicit
  extract-before-offload checklist in the PR.
```

- [ ] **Step 2: Full gate**

```bash
cd scripts && uv run --with pytest python -m pytest -q && cd ..
cd evals/behavioral && npm test && node run-evals.mjs --dry-run && cd ../..
python3 scripts/check_docs_links.py plugins/auth0/skills/auth0
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```

Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-15-sdk-shipped-docs-design.md
git commit -m "docs: record phase-1 exemplar findings in sdk-shipped-docs spec

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Next plans (not in this plan)

1. Remaining feature slims (`branding`, `mfa`, `organizations`, `dpop`, then `custom-domains`, `acul`, `migration`) — one plan, one task per reference, each using Task 4/5 as the template.
2. Next.js pilot — PR to `auth0/nextjs-auth0` adding `docs/` (from its `skills/` + `guides/`) to `files`; after release, slim `framework-nextjs` and add a `transcript_matches` grader to a nextjs behavioral case.
