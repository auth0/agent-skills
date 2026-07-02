# Unified Auth0 Skill — Architecture & Framework Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge latest `main`, fold the `auth0-dpop` and `acul-screen-generator` skills into the single `auth0` router skill, make framework detection work before an Auth0 SDK is installed, and ship a CI reachability check plus architecture/contributor docs.

**Architecture:** One `auth0` skill whose `SKILL.md` is a deterministic router (intent → framework → tooling → load 2–3 reference files) over a flat pool of `references/{feature,framework,tooling,pattern}-*.md`. Framework detection becomes a three-tier cascade: Auth0-SDK signals (unchanged) → non-Auth0 workspace signals (inline table) → prompt keywords, with intent-first disambiguation for web-vs-API variants. A Python CI check enforces that every reference file is routable and that no reference links another reference.

**Tech Stack:** Markdown skills (Agent Skills spec), Bash + Python validation scripts, `uvx skillsaw` in CI (GitHub Actions).

## Global Constraints

- `license` must be `Apache-2.0` in every `SKILL.md`.
- `metadata.author` must be `Name <email>` format (`Auth0 <support@auth0.com>`).
- Full `metadata.openclaw` block (`emoji`, `homepage`) required in `SKILL.md`.
- `description` field ≤ 1024 characters (spec hard limit; `validate-skill.sh` enforces).
- `SKILL.md` ≤ 600 lines (`validate-skill.sh` enforces).
- Only `SKILL.md` may live in a skill root; other content in `references/` (kebab-case `.md`), `scripts/`, `assets/`, `tests/`.
- **No reference file may link to another reference file** (Claude Code linking rule; new checker enforces).
- After the fold-ins there must be exactly **one** skill directory: `plugins/auth0/skills/auth0/`.
- `uvx skillsaw --strict` and `scripts/validate-skill.sh` and the new reachability check must all pass before merge.
- Tier-1 (Auth0-SDK-present) detection behavior stays byte-for-byte unchanged.

---

## Task 1: Merge `main` into the branch

**Files:**
- Modify (resolve): `plugins/auth0/README.md`
- Delete (resolve modify/delete): `plugins/auth0/skills/auth0-vue/SKILL.md`, `plugins/auth0/skills/auth0-vue/references/integration.md`
- Adds from main (staged): `plugins/auth0/skills/auth0-dpop/**`, updates to `plugins/auth0/skills/acul-screen-generator/SKILL.md`

**Interfaces:**
- Produces: a merged working tree where `auth0-dpop/` exists as a standalone skill (folded in Task 2), `acul-screen-generator/` carries main's build-validation update (folded in Task 3), and the two `auth0-vue/*` files are deleted (their DPoP cross-refs are ported to `framework-vue.md` in Task 2).

- [ ] **Step 1: Confirm clean tree and start the merge**

```bash
git status --short   # expect only ?? PR-137-feedback.md
git merge --no-ff origin/main
```
Expected: conflicts in `plugins/auth0/README.md` (content) and modify/delete on the two `auth0-vue` files.

- [ ] **Step 2: Resolve the `auth0-vue` modify/delete conflicts by deleting**

The branch consolidated `auth0-vue` into `references/framework-vue.md`; main only added DPoP cross-reference text. Keep the deletion; the DPoP content is ported in Task 2.

```bash
git rm plugins/auth0/skills/auth0-vue/SKILL.md plugins/auth0/skills/auth0-vue/references/integration.md
```
Expected: both paths staged for deletion; the `auth0-vue/` directory is gone.

- [ ] **Step 3: Resolve the README conflict**

Open `plugins/auth0/README.md`. The Skills table must list exactly two rows for now — `auth0` and `acul-screen-generator` (and NOT `auth0-dpop`, since it is folded in Task 2, not shipped standalone). Remove any conflict markers and any `auth0-dpop` row main tried to add. Keep the branch's `auth0` row.

```bash
git diff plugins/auth0/README.md   # verify no <<<<<<< / ======= / >>>>>>> remain
```
Expected: no conflict markers; two skill rows.

- [ ] **Step 4: Verify the merge staged main's new content**

```bash
ls plugins/auth0/skills/auth0-dpop/references/   # examples.md integration.md
git show :plugins/auth0/skills/acul-screen-generator/SKILL.md | grep -c "build" # main's build-validation phase present
```
Expected: dpop reference files exist; acul SKILL.md contains the build-validation content.

- [ ] **Step 5: Commit the merge**

```bash
git commit --no-edit
git status --short   # expect only ?? PR-137-feedback.md
```
Expected: merge commit created; `auth0-vue/` absent; `auth0-dpop/` and updated `acul-screen-generator/` present.

---

## Task 2: Fold `auth0-dpop` into the one skill (routed like MFA)

**Files:**
- Create: `plugins/auth0/skills/auth0/references/feature-dpop.md`
- Modify: `plugins/auth0/skills/auth0/SKILL.md` (add `feature:dpop` intent row + Step-4 load block)
- Modify: `plugins/auth0/skills/auth0/references/framework-vue.md` (port DPoP-composables mention)
- Modify: `plugins/auth0/skills/auth0/scripts/validate-skill.sh` (add `dpop` to expected features)
- Delete: `plugins/auth0/skills/auth0-dpop/` (entire directory)

**Interfaces:**
- Consumes: merged tree from Task 1.
- Produces: `feature:dpop` intent routable to `references/feature-dpop.md`; standalone `auth0-dpop` skill gone.

- [ ] **Step 1: Create `feature-dpop.md` from the standalone material**

Concatenate the *content* of the three standalone files into one flat reference, removing all reference→reference links (Global Constraint) and the standalone frontmatter. Order: the `auth0-dpop/SKILL.md` body (drop its YAML frontmatter and the `## Related Skills` / `## Additional Resources` link sections), then the "Framework Examples" body from `auth0-dpop/references/examples.md`, then the "Integration Guide" body from `auth0-dpop/references/integration.md`.

```bash
# Inspect sources before writing
sed -n '1,200p' plugins/auth0/skills/auth0-dpop/SKILL.md
sed -n '1,403p' plugins/auth0/skills/auth0-dpop/references/examples.md
cat plugins/auth0/skills/auth0-dpop/references/integration.md
```
Write `plugins/auth0/skills/auth0/references/feature-dpop.md` with a single H1 `# Auth0 DPoP (Device-Bound Tokens)`, an Overview section, the per-framework examples (Vue, React, Angular, spa-js), and the error-handling/integration section. Replace the `[Framework Examples](references/examples.md)` and `[Integration Guide](references/integration.md)` link stubs with the inlined content itself — no links to other files.

- [ ] **Step 2: Add the `feature:dpop` intent row to Step 1 of the router**

In `plugins/auth0/skills/auth0/SKILL.md`, under `## Step 1: Detect intent`, add a row after the `feature:branding` row:

```markdown
| DPoP, sender-constrained tokens, "bind tokens to the client", prevent token theft/replay | **feature:dpop** |
```

- [ ] **Step 3: Add the `feature:dpop` load block to Step 4**

In `## Step 4: Load reference files`, after the `feature:branding` block, add:

````markdown
### feature:dpop
```
Read: references/feature-dpop.md
Read: references/tooling-{tooling}.md
If a SPA framework is detected (vue/react/angular/spa-js): Read references/framework-{framework}.md
DPoP is SPA-only (no SSR: Next.js/Nuxt) — feature-dpop.md states the exclusion.
```
````

- [ ] **Step 4: Port the Vue DPoP-composables mention into `framework-vue.md`**

Main added a DPoP-composables note to the (now-deleted) `auth0-vue` docs. Add an equivalent note to `references/framework-vue.md` in its SDK-composables section, WITHOUT linking to another reference file (describe inline; may mention "the feature:dpop intent"):

```markdown
**DPoP composables** (require `useDpop: true` in `createAuth0` config):
- `createFetcher(config)` — returns a DPoP-aware `fetch`-compatible function
- `generateDpopProof(params)` — manually generate a DPoP proof JWT
- `getDpopNonce(id?)` / `setDpopNonce(nonce, id?)` — read/store the server DPoP nonce
For full DPoP setup, ask for DPoP token binding (feature:dpop).
```

- [ ] **Step 5: Delete the standalone skill**

```bash
git rm -r plugins/auth0/skills/auth0-dpop
```
Expected: directory removed.

- [ ] **Step 6: Add `dpop` to the validator's expected features**

In `plugins/auth0/skills/auth0/scripts/validate-skill.sh`, change the `EXPECTED_FEATURES` line to include `dpop`:

```bash
EXPECTED_FEATURES="mfa branding custom-domains migration acul dpop"
```

- [ ] **Step 7: Run the validator**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
```
Expected: ends with `PASS`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth0): fold auth0-dpop into unified skill as feature:dpop"
```

---

## Task 3: Fold `acul-screen-generator` into the one skill (B1)

**Files:**
- Modify: `plugins/auth0/skills/auth0/references/feature-acul.md` (reconcile richer standalone material in)
- Create (move): `plugins/auth0/skills/auth0/assets/acul/**` (from `acul-screen-generator/assets/**`)
- Modify: `plugins/auth0/skills/auth0/SKILL.md` (point `feature:acul` load block at any moved assets)
- Modify: `plugins/auth0/README.md` (remove the `acul-screen-generator` row)
- Delete: `plugins/auth0/skills/acul-screen-generator/` (entire directory)

**Interfaces:**
- Consumes: merged tree; `feature-acul.md` (existing 1608-line file).
- Produces: single skill directory `plugins/auth0/skills/auth0/`; ACUL content single-sourced in `feature-acul.md` + `assets/acul/`.

- [ ] **Step 1: Inventory both sides before merging content**

```bash
wc -l plugins/auth0/skills/auth0/references/feature-acul.md
wc -l plugins/auth0/skills/acul-screen-generator/references/*.md plugins/auth0/skills/acul-screen-generator/SKILL.md
```
Read `feature-acul.md` and each standalone reference (`screen-catalog.md`, `theming-patterns.md`, `acul-react-sdk.md`, `acul-js-sdk.md`, `cli-commands.md`, `social-providers.md`) plus the standalone `SKILL.md` (including main's build-validation phase from Task 1).

- [ ] **Step 2: Reconcile section-by-section into `feature-acul.md`**

For each topic (screen catalog, theming, React SDK, JS SDK, CLI commands, social providers, project setup, build validation), compare the standalone content against what `feature-acul.md` already has. Where the standalone version is richer or has content the feature file lacks, merge it in under a clearly-titled section. Do NOT add cross-file links (flatten any `[...](other.md)` from the standalone docs into inline prose or into the same file). Keep one H1. Preserve main's post-generation build-validation phase as its own section.

Verify nothing is dropped:
```bash
# Spot-check that key standalone headings now appear in feature-acul.md
for h in "Screen Catalog" "Theming" "React SDK" "JS SDK" "CLI" "Social" "build"; do
  echo "== $h =="; grep -i "$h" plugins/auth0/skills/auth0/references/feature-acul.md | head -2
done
```
Expected: each topic represented.

- [ ] **Step 3: Move the ACUL assets into the unified skill**

```bash
mkdir -p plugins/auth0/skills/auth0/assets/acul
git mv plugins/auth0/skills/acul-screen-generator/assets/js-templates plugins/auth0/skills/auth0/assets/acul/js-templates
git mv plugins/auth0/skills/acul-screen-generator/assets/react-templates plugins/auth0/skills/auth0/assets/acul/react-templates
git mv plugins/auth0/skills/acul-screen-generator/assets/theme-templates plugins/auth0/skills/auth0/assets/acul/theme-templates
```
Expected: templates now under `plugins/auth0/skills/auth0/assets/acul/`.

- [ ] **Step 4: Reference the moved assets from `feature-acul.md`**

In the relevant `feature-acul.md` sections, update any template paths to `assets/acul/...` (relative to the skill root). Assets referenced from a reference file by path is allowed (they are not `.md` reference files, so the no-reference-link rule does not apply). Verify no path still points at the deleted skill:

```bash
grep -rn "acul-screen-generator" plugins/auth0/skills/auth0/ || echo "no stale paths"
```
Expected: `no stale paths`.

- [ ] **Step 5: Delete the standalone skill and its README row**

```bash
git rm -r plugins/auth0/skills/acul-screen-generator
```
Then edit `plugins/auth0/README.md`: remove the `acul-screen-generator` table row so only the `auth0` row remains. Also update the `auth0` row's description if it should now explicitly claim ACUL screen generation (it already lists "ACUL").

```bash
ls plugins/auth0/skills/   # expect only: auth0
git grep -n "acul-screen-generator" -- plugins/auth0/README.md || echo "readme clean"
```
Expected: one skill dir; README clean.

- [ ] **Step 6: Validate structure**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: `validate-skill.sh` prints `PASS`; skillsaw reports no errors (single skill, README documents it, kebab-case, structure valid).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth0): fold acul-screen-generator into unified skill (one skill)"
```

---

## Task 4: Add the router reachability check (B3) — as a failing test first

**Files:**
- Create: `scripts/check-router-reachability.py`
- Create: `scripts/test_check_router_reachability.py`

**Interfaces:**
- Produces: `check_router()` returning `(unreachable_files: list[str], bad_links: list[tuple[str,str]])` and a `main()` that exits non-zero when either list is non-empty. Consumed by Task 5 (CI wiring) and run against the real skill in Task 6.

- [ ] **Step 1: Write the failing test with fixtures**

Create `scripts/test_check_router_reachability.py`. It builds a tiny temp skill tree and asserts the two invariants. Use only stdlib (`pathlib`, `tempfile`, `unittest`).

```python
import tempfile, unittest
from pathlib import Path
from check_router_reachability import check_router

def _make_skill(root: Path, skill_md: str, refs: dict[str, str]) -> Path:
    skill = root / "plugins/auth0/skills/auth0"
    (skill / "references").mkdir(parents=True)
    (skill / "SKILL.md").write_text(skill_md)
    for name, body in refs.items():
        (skill / "references" / name).write_text(body)
    return skill

class ReachabilityTest(unittest.TestCase):
    def test_orphan_file_is_unreachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md": "ok", "framework-php-api.md": "orphan"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn("framework-php-api.md", unreachable)
            self.assertEqual(bad_links, [])

    def test_template_expansion_reaches_files(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-{framework}.md\n"
                "<!-- frameworks: react php-api -->\n",
                {"framework-react.md": "ok", "framework-php-api.md": "ok"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertEqual(unreachable, [])

    def test_reference_linking_another_reference_is_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = _make_skill(
                root,
                "Read: references/framework-react.md\n",
                {"framework-react.md": "see [x](feature-mfa.md)", "feature-mfa.md": "ok"},
            )
            unreachable, bad_links = check_router(skill)
            self.assertIn(("framework-react.md", "feature-mfa.md"), bad_links)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd scripts && python -m pytest test_check_router_reachability.py -v; cd ..
```
Expected: FAIL with `ModuleNotFoundError: No module named 'check_router_reachability'`.

- [ ] **Step 3: Implement the checker**

Create `scripts/check-router-reachability.py`. Because the module is imported as `check_router_reachability` in the test, also expose it under that name — create the file as `scripts/check_router_reachability.py` (underscore) and make `scripts/check-router-reachability.py` a thin CLI shim, OR name the implementation with an underscore and invoke it directly. Use the underscore filename `scripts/check_router_reachability.py` as the importable module and CLI entry (simplest):

```python
#!/usr/bin/env python3
"""Assert every references/*.md is routable from SKILL.md and no reference links another reference."""
import re, sys
from pathlib import Path

# Enumerated router value sets. Keep in sync with SKILL.md Step 2/3 tables.
FRAMEWORKS = [
    "react", "nextjs", "vue", "angular", "spa-js", "nuxt", "express",
    "express-jwt", "fastify", "fastify-api", "flask", "fastapi-api",
    "java-mvc", "springboot-api", "aspnetcore-auth", "aspnetcore-api",
    "maui", "net-android", "net-ios", "winforms", "wpf", "php", "php-api",
    "laravel", "laravel-api", "go", "swift", "android", "flutter-native",
    "flutter-web", "react-native", "expo", "ionic-angular", "ionic-react",
    "ionic-vue",
]
TOOLINGS = ["cli", "mcp", "terraform"]

READ_RE = re.compile(r"references/([a-z0-9-]+(?:\{[a-z]+\})?\.md|[a-z0-9-]+\.md)")
LINK_RE = re.compile(r"\]\(([a-z0-9-]+\.md)(?:#[^)]*)?\)")


def _expand(token: str) -> list[str]:
    if "{framework}" in token:
        return [token.replace("{framework}", f) for f in FRAMEWORKS]
    if "{tooling}" in token:
        return [token.replace("{tooling}", t) for t in TOOLINGS]
    return [token]


def check_router(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    refs_dir = skill_dir / "references"

    routed: set[str] = set()
    for m in READ_RE.finditer(skill_md):
        for name in _expand(m.group(1)):
            routed.add(name)

    present = {p.name for p in refs_dir.glob("*.md")}
    unreachable = sorted(present - routed)

    bad_links: list[tuple[str, str]] = []
    for ref in sorted(present):
        for lm in LINK_RE.finditer((refs_dir / ref).read_text()):
            target = lm.group(1)
            if target in present:
                bad_links.append((ref, target))

    return unreachable, bad_links


def main() -> int:
    skill_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "plugins/auth0/skills/auth0"
    )
    unreachable, bad_links = check_router(skill_dir)
    ok = True
    if unreachable:
        ok = False
        print("UNREACHABLE reference files (not routed from SKILL.md):")
        for f in unreachable:
            print(f"  - references/{f}")
    if bad_links:
        ok = False
        print("REFERENCE→REFERENCE links (forbidden):")
        for src, tgt in bad_links:
            print(f"  - {src} -> {tgt}")
    if ok:
        print("PASS: all references routable; no reference→reference links")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

Update the test import to `from check_router_reachability import check_router` (matches the underscore filename). Remove the hyphenated-filename plan note — there is only `scripts/check_router_reachability.py`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd scripts && python -m pytest test_check_router_reachability.py -v; cd ..
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/check_router_reachability.py scripts/test_check_router_reachability.py
git commit -m "test(ci): add router reachability + no-reference-link checker"
```

---

## Task 5: Wire the reachability check into CI and the local validator

**Files:**
- Modify: `.github/workflows/skillsaw.yml` (add a step running the checker + its unit test)
- Modify: `plugins/auth0/skills/auth0/scripts/validate-skill.sh` (call the checker at the end)

**Interfaces:**
- Consumes: `scripts/check_router_reachability.py` from Task 4.
- Produces: CI fails when a reference is orphaned or a reference links another reference.

- [ ] **Step 1: Add a CI step to `skillsaw.yml`**

After the "Run skillsaw in strict mode" job's steps (as a new step in the same `lint` job, before "Upload linter output"), add:

```yaml
    - name: Router reachability check
      run: |
        python -m pytest scripts/test_check_router_reachability.py -q
        python scripts/check_router_reachability.py plugins/auth0/skills/auth0
```

- [ ] **Step 2: Call the checker from `validate-skill.sh`**

In `plugins/auth0/skills/auth0/scripts/validate-skill.sh`, immediately before the final `echo "PASS"`, add:

```bash
# Router reachability + no reference→reference links
REACH="$REPO_ROOT/scripts/check_router_reachability.py"
if [ -f "$REACH" ]; then
  echo "Running router reachability check..."
  python3 "$REACH" "$REPO_ROOT/plugins/auth0/skills/auth0" || {
    echo "FAIL: router reachability check failed"; exit 1;
  }
fi
```

- [ ] **Step 3: Run the local validator (expect it to FAIL on the php-api orphan)**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
```
Expected: FAIL — `framework-php-api.md` reported UNREACHABLE (this is B2, fixed in Task 6). This proves the check works. If any *other* file is unreachable, note it for Task 6.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/skillsaw.yml plugins/auth0/skills/auth0/scripts/validate-skill.sh
git commit -m "ci(auth0): run router reachability check in CI and local validator"
```

---

## Task 6: Rewrite router Step 2 as a three-tier cascade + fix variant reachability (B2)

**Files:**
- Modify: `plugins/auth0/skills/auth0/SKILL.md` (Step 2 restructure; add prompt-keyword table; php-api + variant disambiguation)

**Interfaces:**
- Consumes: reachability checker from Tasks 4–5 (must pass after this task).
- Produces: `SKILL.md` that routes to every `framework-*.md` including `framework-php-api.md`; framework detection works with no Auth0 SDK present.

- [ ] **Step 1: Replace Step 2 with the three-tier cascade**

In `plugins/auth0/skills/auth0/SKILL.md`, replace the `## Step 2: Detect framework` section. Keep the existing Auth0-SDK tables verbatim as **Tier 1** (byte-for-byte — Global Constraint). Add a preamble and Tiers 2–3:

````markdown
## Step 2: Detect framework

Work top-down. **Stop at the first tier that yields a framework.**

### Tier 1 — Auth0 SDK already installed (strongest signal)

Read the project files. **Stop at the first match.** *(existing tables unchanged below)*

<!-- EXISTING TIER-1 TABLES STAY EXACTLY AS THEY ARE -->

### Tier 2 — Framework from non-Auth0 workspace dependencies

If no Auth0 SDK matched, detect the framework from ordinary (non-Auth0)
dependencies. **Stop at the first match.** For frameworks with a web-vs-API
split, the base framework is chosen here; the variant is resolved in
"Variant disambiguation" below.

| Signal | Base framework |
|---|---|
| `next` in `package.json` | `nextjs` |
| `nuxt` in `package.json` | `nuxt` |
| `@angular/core` in `package.json` | `angular` |
| `vue` in `package.json` (no `nuxt`) | `vue` |
| `@ionic/*` + `@angular/core` | `ionic-angular` |
| `@ionic/*` + `react` | `ionic-react` |
| `@ionic/*` + `vue` | `ionic-vue` |
| `expo` in `package.json` | `expo` |
| `react-native` (no `expo`) | `react-native` |
| `react` (no meta-framework above) | `react` (SPA) — see note |
| `express` in `package.json` | `express` (variant below) |
| `fastify` in `package.json` | `fastify` (variant below) |
| `flask` in `requirements.txt`/`pyproject.toml` | `flask` |
| `fastapi` in `requirements.txt`/`pyproject.toml` | `fastapi-api` |
| `spring-boot` in `pom.xml`/`build.gradle` | `springboot-api` |
| `laravel/framework` in `composer.json` | `laravel` (variant below) |
| `composer.json` present (no Laravel) | `php` (variant below) |
| `go.mod` present + HTTP server/router | `go` |
| `Package.swift` or `.xcodeproj` | `swift` |
| `pubspec.yaml` (Flutter, web disabled) | `flutter-native` |
| `pubspec.yaml` (Flutter, web enabled) | `flutter-web` |
| `*.csproj` referencing MAUI | `maui` |
| `*.csproj` (WinForms) | `winforms` |
| `*.csproj` (WPF) | `wpf` |
| `*.csproj` ASP.NET (web app) | `aspnetcore-auth` (variant below) |

> **`react` note:** a plain React project maps to `react` for an SPA using the
> React SDK, or `spa-js` if the app is framework-agnostic vanilla JS. If unclear,
> ask before loading.

### Tier 3 — Framework from the prompt

If no workspace signal matched, read the developer's request for a framework or
language name and map it here. **Stop at the first match.**

| Developer mentions... | Framework |
|---|---|
| Next.js / `next` | `nextjs` |
| Nuxt | `nuxt` |
| Angular (not Ionic) | `angular` |
| Vue (not Nuxt/Ionic) | `vue` |
| React SPA (not Next.js) | `react` |
| vanilla JS / plain JS / no framework SPA | `spa-js` |
| Express (web app / server-rendered) | `express` |
| Express API / protect API routes | `express-jwt` |
| Fastify (web) / Fastify API | `fastify` / `fastify-api` |
| Flask | `flask` |
| FastAPI | `fastapi-api` |
| Spring Boot | `springboot-api` |
| Java MVC / servlet | `java-mvc` |
| ASP.NET Core web app / API | `aspnetcore-auth` / `aspnetcore-api` |
| MAUI / WinForms / WPF | `maui` / `winforms` / `wpf` |
| PHP web app / PHP API | `php` / `php-api` |
| Laravel web app / Laravel API | `laravel` / `laravel-api` |
| Go / Golang API | `go` |
| Swift / iOS | `swift` |
| Android / Kotlin | `android` |
| Flutter (native / web) | `flutter-native` / `flutter-web` |
| React Native / Expo | `react-native` / `expo` |
| Ionic (Angular/React/Vue) | `ionic-angular` / `ionic-react` / `ionic-vue` |

### Variant disambiguation (web app vs API)

Some frameworks have separate web-app and API references. When Tier 1 did not
pin the variant, choose **intent-first**:

| Base | Web-app variant | API variant | Choose API when… |
|---|---|---|---|
| express | `express` | `express-jwt` | protecting API routes / validating JWTs, no server-rendered UI |
| fastify | `fastify` | `fastify-api` | resource server / JWT validation only |
| php | `php` | `php-api` | building/protecting a PHP API, no web UI |
| laravel | `laravel` | `laravel-api` | API-only (token guard), no Blade UI |
| aspnetcore | `aspnetcore-auth` | `aspnetcore-api` | Web API / JWT bearer, no cookie login UI |

If intent is still ambiguous (both a UI and protected endpoints, or unclear),
**state what you detected and ask the developer** web app vs API before loading.

### If nothing matched

Ask the developer what framework/language they are using. Do not guess.

### Conflicts

If Tier 2 (workspace) and Tier 3 (prompt) disagree materially (e.g. the prompt
says "Next.js" but `package.json` has no `next`), **state the conflict and ask**
rather than silently picking. Workspace signals outrank the prompt when both are
present and consistent.
````

- [ ] **Step 2: Add a machine-readable framework list comment for the checker**

At the end of Step 2 (or near the `FRAMEWORKS` needs), the checker enumerates frameworks from its own constant, so no marker is strictly required. Verify the checker's `FRAMEWORKS` list matches every `framework-*.md` present:

```bash
ls plugins/auth0/skills/auth0/references/framework-*.md | sed 's#.*/framework-##;s#\.md##' | sort > /tmp/have.txt
(cd scripts && python3 -c "from check_router_reachability import FRAMEWORKS; print(chr(10).join(sorted(FRAMEWORKS)))") > /tmp/known.txt
comm -23 /tmp/have.txt /tmp/known.txt   # any output = files missing from the checker's FRAMEWORKS list
```
Ensure every file stem is in `FRAMEWORKS`. If any file (e.g. `flutter-native`, `flutter-web`, `maui`, `net-android`, `net-ios`, `winforms`, `wpf`) is missing from the list, add it to `scripts/check_router_reachability.py` `FRAMEWORKS` and commit that fix here.

- [ ] **Step 3: Confirm `php-api` (and every variant) is now routed**

Step 4's `integrate` block reads `references/framework-{framework}.md`; with `php-api` now a valid framework value the template expansion covers it. Run the checker:

```bash
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
```
Expected: `PASS: all references routable; no reference→reference links`.

- [ ] **Step 4: Run the full local validation**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: `validate-skill.sh` → `PASS`; skillsaw → no errors. Confirm `SKILL.md` is still ≤ 600 lines:
```bash
wc -l plugins/auth0/skills/auth0/SKILL.md
```
Expected: ≤ 600. If over, tighten Tier-3 wording (it is the most compressible).

- [ ] **Step 5: Commit**

```bash
git add plugins/auth0/skills/auth0/SKILL.md scripts/check_router_reachability.py
git commit -m "feat(auth0): detect framework without SDK via workspace+prompt cascade; fix php-api reachability (B2)"
```

---

## Task 7: Architecture doc + contributor guide

**Files:**
- Create: `docs/architecture.md`
- Modify: `CONTRIBUTING.md` (add "Adding a capability to the unified skill" section)

**Interfaces:**
- Consumes: the final router structure from Task 6.
- Produces: developer-facing docs; `docs/architecture.md` links to `CONTRIBUTING.md` (single-sourced).

- [ ] **Step 1: Write `docs/architecture.md`**

Create `docs/architecture.md` covering: (a) **why unified** — one always-on `description` instead of ~45 competing ones, a deterministic file-based router (not LLM-driven), zero reference→reference links (Claude Code loads one hop only); (b) **the structure** — one `auth0` skill, flat `references/` pool with the four prefixes and what each means; (c) **the routing flow** — intent → framework (three-tier cascade: SDK → workspace → prompt, intent-first variant disambiguation) → tooling → load 2–3 files; (d) **the reachability invariant** and how CI enforces it. End with: "To add or extend a capability, see [CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-capability-to-the-unified-skill)." Do not restate the contribution steps here.

```markdown
# Architecture: the unified `auth0` skill

## Why one skill
- A skill's `description` is always in the agent's context. ~45 skills meant ~45
  competing descriptions and ambiguous activation. One skill = one description.
- Routing is **file-based and deterministic**: the router reads `package.json`,
  `composer.json`, `go.mod`, `*.csproj`, `pubspec.yaml`, etc. — code-driven, not
  a model guess.
- **No reference file links another reference file.** Claude Code loads the
  router, then the files it names — one hop. Links between references are not
  guaranteed to be followed, so all detection logic lives in `SKILL.md`.

## Structure
`plugins/auth0/skills/auth0/`
- `SKILL.md` — the router (intent → framework → tooling → load).
- `references/feature-*.md` — a capability spanning frameworks (mfa,
  organizations, custom-domains, acul, branding, migration, dpop).
- `references/framework-*.md` — one SDK/framework integration.
- `references/tooling-*.md` — cli / mcp / terraform.
- `references/pattern-*.md` — cross-cutting guidance (security, token-handling,
  multi-tenant, rate-limiting, common-errors).
- `assets/` — templates (e.g. ACUL screen templates).
- `scripts/validate-skill.sh` — local structure + routing gate.

## Routing flow
1. **Intent** — what the developer wants (integrate, feature:*, guidance, debug,
   migrate).
2. **Framework — three-tier cascade** (first tier that yields a framework wins):
   Tier 1 installed Auth0 SDK → Tier 2 non-Auth0 workspace deps → Tier 3 prompt
   keywords. Web-vs-API variants resolve intent-first, then ask.
3. **Tooling** — terraform / mcp / cli (project context).
4. **Load** 2–3 reference files and follow them.

## Reachability invariant (CI-enforced)
`scripts/check_router_reachability.py` asserts every `references/*.md` is
routable from `SKILL.md` (via template expansion over the known framework and
tooling value sets) and that no reference links another reference. This runs in
the `skillsaw` GitHub Actions workflow and inside `validate-skill.sh`.

To add or extend a capability, see
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-capability-to-the-unified-skill).
```

- [ ] **Step 2: Add the contributor section to `CONTRIBUTING.md`**

Append a new section. It must tell a contributor exactly which prefix to pick, that they must add both a router row AND make the file routable, and to add detection in all three tiers for a new framework:

```markdown
## Adding a Capability to the Unified Skill

All Auth0 guidance ships in the single `auth0` skill
(`plugins/auth0/skills/auth0/`). See [docs/architecture.md](./docs/architecture.md)
for why. To add or change coverage:

### Pick the right reference prefix
- `feature-<name>.md` — a capability spanning frameworks (e.g. mfa, dpop).
- `framework-<name>.md` — a single SDK/framework integration.
- `tooling-<name>.md` — a provisioning tool (cli, mcp, terraform).
- `pattern-<name>.md` — cross-cutting guidance.

### Make it routable (required — CI enforces this)
Every file in `references/` MUST be reachable from `SKILL.md`, and no reference
file may link to another reference file.

- **New feature:** add an intent row in Step 1 and a load block in Step 4 of
  `SKILL.md`.
- **New framework:** add detection in **all three tiers** of Step 2 — Tier 1
  (Auth0 SDK package), Tier 2 (non-Auth0 workspace dependency), Tier 3 (prompt
  keyword) — and, if it has a web-vs-API split, a row in "Variant
  disambiguation." Add the framework value to the `FRAMEWORKS` list in
  `scripts/check_router_reachability.py`.

### Validate
```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```
```

- [ ] **Step 3: Verify the doc cross-links resolve and validation still passes**

```bash
test -f docs/architecture.md && echo "arch doc present"
grep -n "adding-a-capability-to-the-unified-skill" docs/architecture.md
uvx skillsaw --strict
```
Expected: doc present; anchor link matches the CONTRIBUTING heading slug; skillsaw clean.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md CONTRIBUTING.md
git commit -m "docs: add unified-skill architecture doc + contributor guide"
```

---

## Task 8: Final full-repo verification

**Files:** none (verification only).

**Interfaces:** Consumes the whole branch.

- [ ] **Step 1: Run every gate**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python -m pytest scripts/test_check_router_reachability.py -q
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```
Expected: `PASS`; tests pass; `PASS: all references routable...`; skillsaw no errors.

- [ ] **Step 2: Confirm the end state invariants**

```bash
ls plugins/auth0/skills/                                  # expect only: auth0
git grep -n "auth0-dpop\|acul-screen-generator" -- plugins/auth0/README.md || echo "readme clean"
grep -rn "]\((feature\|framework\|tooling\|pattern)-[a-z-]*\.md" plugins/auth0/skills/auth0/references/ || echo "no reference->reference links"
wc -l plugins/auth0/skills/auth0/SKILL.md                 # <= 600
```
Expected: one skill dir; README clean; no reference→reference links; SKILL.md ≤ 600 lines.

- [ ] **Step 3: Review the full diff against main**

```bash
git diff --stat origin/main...HEAD | tail -30
```
Expected: two skill directories deleted (`auth0-dpop`, `acul-screen-generator`), `feature-dpop.md` added, `feature-acul.md` grown, `SKILL.md` Step 2 rewritten, checker + docs added.

---

## Self-Review notes (author)

- **Spec coverage:** merge (T1) ✓; dpop fold-in routed like MFA (T2) ✓; ACUL fold-in B1 (T3) ✓; framework cascade SDK→workspace→prompt (T6) ✓; variant disambiguation + php-api B2 (T6) ✓; reachability check B3 (T4–T5) ✓; docs in `docs/` + contributor guide (T7) ✓.
- **Ordering rationale:** the checker (T4/T5) lands *before* the router rewrite (T6) so B2's fix is demonstrated by the check going red→green (T5 Step 3 → T6 Step 3).
- **SKILL.md ≤ 600 lines** is the main risk from the Step-2 expansion; T6 Step 4 guards it.
- **Checker filename:** implementation and import name are both `scripts/check_router_reachability.py` (underscore) — no hyphen variant.
