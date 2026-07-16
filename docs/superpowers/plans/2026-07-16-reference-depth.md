# Reference Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one level of depth (hub `index.md` + intent-scoped leaves) for large reference files so the router loads only the slice an agent needs.

**Architecture:** A "group" is a subdirectory of `references/` replacing a former single file. It contains a hub `index.md` (intent→leaf dispatch table + shared prerequisites) and one leaf per intent. The router (`SKILL.md`) reads the hub; the hub dispatches to exactly one leaf via an imperative `Read:` instruction. The invariant relaxes from one hop to a **depth-2 tree**: a hub may dispatch only to leaves in its own directory; leaves and flat files remain link sinks. Two deterministic Python checkers enforce this; behavioral evals confirm the agent actually completes both hops.

**Tech Stack:** Python 3 (stdlib `unittest`, `re`, `pathlib`) for checkers; Markdown reference files; bash `validate-skill.sh`; Node `run-evals.mjs` for behavioral evals; `uvx skillsaw --strict` for CI lint.

## Global Constraints

- One-hop rule becomes **two-hop-through-hub**: a hub `index.md` MAY use `Read: references/<own-group>/<leaf>.md` dispatch to leaves **in its own group only**; leaves and flat top-level files link to nothing (sinks); cross-group links forbidden everywhere. Copied verbatim into the checker.
- **Split threshold:** only reference files above ~40K get grouped. Files at or below stay flat single files. The pool is mixed.
- **Leaf axis:** leaves are intent-scoped, keyed by the router's Step 1 intents (`integrate`, `feature:mfa`, `upgrade-sdk`, …). The hub's dispatch table is the single source of truth for intent→leaf.
- Kebab-case naming preserved: the group directory keeps the former file's stem (`framework-swift/`, `feature-branding/`).
- SKILL.md description ≤ 1024 chars; SKILL.md ≤ 600 lines (enforced by `validate-skill.sh`).
- Never hardcode an SDK version in a behavioral grader.
- Run checkers from `scripts/` (they import sibling modules): `cd scripts && python3 -m unittest test_check_router_reachability -v`.
- The whole-repo gate after every structural task: `bash plugins/auth0/skills/auth0/scripts/validate-skill.sh` and `uvx skillsaw --strict` both PASS.

---

### Task 1: Reachability checker — two-level (group) support

Teach `check_router_reachability.py` about groups: recursive discovery, two-level reachability (router→hub, hub→leaf), broken hub-dispatch routes, and the narrowed sideways-link rule. Must stay green on the current all-flat repo (backward compatible).

**Files:**
- Modify: `scripts/check_router_reachability.py`
- Test: `scripts/test_check_router_reachability.py`

**Interfaces:**
- Consumes: existing `_router_slugs`, `_expand`, `SLUG_RE`, `READ_RE`, `BACKTICK_MD_RE`, `LINK_RES`, `SIDEWAYS_RES`, `_strip_fences`, `_variant_base_slugs` in the same module.
- Produces: `check_router(skill_dir: Path) -> (unreachable: list[str], bad_links: list[tuple[str,str]], broken_routes: list[str])` — unchanged 3-tuple signature. `unreachable`/`broken_routes` entries may now be group-relative paths like `framework-swift/mfa.md`. Adds module-level helper `_discover(refs_dir: Path) -> tuple[set[str], dict[str, dict]]` returning `(flat_files, groups)` where `flat_files` is the set of top-level `*.md` names and `groups` maps `group_name -> {"has_index": bool, "leaves": set[str]}` (leaf names are bare, e.g. `mfa.md`). Adds `_hub_dispatch_targets(index_text: str, group: str) -> set[str]` returning the bare leaf names a hub's dispatch table `Read:`-routes within its own group.

- [ ] **Step 1: Write the failing tests**

Append these to `scripts/test_check_router_reachability.py`. They use the existing `_make_skill` helper, extended with a tiny group-builder inline.

```python
    # ---- group (two-level) support -------------------------------------

    def _make_group_skill(self, root, skill_md, flat_refs, groups):
        # groups: {group_name: {"index": str, "leaves": {leaf_name: body}}}
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "SKILL.md").write_text(skill_md)
        for name, body in flat_refs.items():
            (skill / "references" / name).write_text(body)
        for gname, spec in groups.items():
            gdir = skill / "references" / gname
            gdir.mkdir()
            if spec.get("index") is not None:
                (gdir / "index.md").write_text(spec["index"])
            for leaf, body in spec.get("leaves", {}).items():
                (gdir / leaf).write_text(body)
        return skill

    def test_group_valid_dispatch_all_reachable(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": ("# Swift hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"),
                    "leaves": {"integrate.md": "ok", "migration.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(unreachable, [])
            self.assertEqual(bad_links, [])
            self.assertEqual(broken_routes, [])

    def test_group_orphan_leaf_is_unreachable(self):
        # A leaf the hub never dispatches to is an orphan.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok", "mfa.md": "orphan"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/mfa.md", unreachable)

    def test_group_hub_dispatch_to_missing_leaf_is_broken_route(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": ("# hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"),
                    "leaves": {"integrate.md": "ok"}}},  # migration.md absent
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/migration.md", broken_routes)

    def test_group_not_routed_from_skill_is_unreachable(self):
        # SKILL.md never routes to the base slug -> whole group unreachable.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| React | `react` |\n",
                {"framework-react.md": "ok"},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/index.md", unreachable)

    def test_group_missing_index_is_broken_route(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {"index": None, "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn("framework-swift/index.md", broken_routes)

    def test_hub_own_group_dispatch_not_flagged_as_sideways(self):
        # The hub Read:-dispatching to its OWN leaf is the allowed relaxation.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual(bad_links, [])

    def test_hub_cross_group_link_is_flagged(self):
        # A hub linking to ANOTHER group's leaf is forbidden.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n| Android | `android` |\n",
                {},
                {"framework-swift": {
                    "index": ("# hub\n"
                              "| integrate | `Read: references/framework-swift/integrate.md` |\n"
                              "cross: `Read: references/framework-android/integrate.md`\n"),
                    "leaves": {"integrate.md": "ok"}},
                 "framework-android": {
                    "index": "# hub\n| integrate | `Read: references/framework-android/integrate.md` |\n",
                    "leaves": {"integrate.md": "ok"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-swift/index.md", "framework-android/integrate.md"),
                          bad_links)

    def test_leaf_linking_to_its_own_index_is_flagged(self):
        # Leaves are sinks — even a back-link to their own hub is forbidden.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| Swift | `swift` |\n",
                {},
                {"framework-swift": {
                    "index": "# hub\n| integrate | `Read: references/framework-swift/integrate.md` |\n",
                    "leaves": {"integrate.md": "back to `references/framework-swift/index.md`"}}},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertIn(("framework-swift/integrate.md", "framework-swift/index.md"),
                          bad_links)

    def test_flat_files_still_pass_backward_compatible(self):
        # The all-flat shape (no groups) must behave exactly as before.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            skill = self._make_group_skill(
                root,
                "Read: references/framework-{framework}.md\n| React | `react` |\n",
                {"framework-react.md": "ok"},
                {},
            )
            unreachable, bad_links, broken_routes = check_router(skill)
            self.assertEqual((unreachable, bad_links, broken_routes), ([], [], []))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd plugins/auth0/skills/auth0/scripts && python3 -m unittest test_check_router_reachability -v`
Expected: the 9 new `test_group_*` / `test_hub_*` / `test_leaf_*` / `test_flat_files_still_pass*` tests FAIL (groups end up reported unreachable or dispatch links flagged), existing tests still PASS.

- [ ] **Step 3: Add group discovery + hub-dispatch helpers**

Add near the top of `check_router_reachability.py` (after the regex constants, before `check_router`):

```python
# A hub's own-group dispatch: `Read: references/<group>/<leaf>.md`. Only these
# (leaf targets inside the hub's OWN directory) are the allowed second hop.
def _hub_dispatch_targets(index_text: str, group: str) -> set:
    pat = re.compile(
        r"references/" + re.escape(group) + r"/([a-z0-9-]+\.md)"
    )
    return set(pat.findall(index_text))


def _discover(refs_dir):
    """Split references/ into top-level flat files and groups.

    A group is any immediate subdirectory of references/. Its leaves are the
    non-index *.md files inside it. Returns (flat_files, groups) where
    groups maps name -> {"has_index": bool, "leaves": set()}.
    """
    flat_files = {p.name for p in refs_dir.glob("*.md")}
    groups = {}
    for sub in sorted(p for p in refs_dir.iterdir() if p.is_dir()):
        leaves = {p.name for p in sub.glob("*.md") if p.name != "index.md"}
        groups[sub.name] = {
            "has_index": (sub / "index.md").exists(),
            "leaves": leaves,
        }
    return flat_files, groups
```

- [ ] **Step 4: Rewrite `check_router` to enforce the two-level model**

Replace the body of `check_router` (from `slugs = _router_slugs(...)` to the `return`) with:

```python
    slugs = _router_slugs(skill_md)
    backticked_md = set(BACKTICK_MD_RE.findall(skill_md))
    tooling_slugs = {
        n[len("tooling-"):-len(".md")]
        for n in backticked_md
        if n.startswith("tooling-")
    }
    universes = {"framework": slugs, "tooling": tooling_slugs}

    routed = set()
    for m in READ_RE.finditer(skill_md):
        for name in _expand(m.group(1), universes):
            routed.add(name)
    routed |= backticked_md

    flat_files, groups = _discover(refs_dir)
    group_names = set(groups)

    # A routed `framework-<slug>.md` is satisfied by EITHER a flat file of that
    # name OR a group directory `framework-<slug>/` (read via its index.md).
    def _satisfied(routed_name):
        return routed_name in flat_files or routed_name[:-3] in group_names

    variant_bases = _variant_base_slugs(skill_md)
    exempt = {f"framework-{b}.md" for b in variant_bases}

    unreachable = sorted(f for f in flat_files if f not in routed)
    broken_routes = sorted(
        r for r in routed
        if "{" not in r and "}" not in r and r not in exempt and not _satisfied(r)
    )

    # Two-level checks for each group.
    for gname, info in groups.items():
        routed_base = f"{gname}.md"
        idx_path = f"{gname}/index.md"
        if routed_base not in routed:
            # SKILL.md never routes to this group at all.
            unreachable.append(idx_path)
            continue
        if not info["has_index"]:
            broken_routes.append(idx_path)
            dispatched = set()
        else:
            index_text = (refs_dir / gname / "index.md").read_text()
            dispatched = _hub_dispatch_targets(index_text, gname)
        # Leaves the hub never dispatches to -> orphans.
        for leaf in sorted(info["leaves"] - dispatched):
            unreachable.append(f"{gname}/{leaf}")
        # Hub dispatch entries with no matching leaf file -> broken routes.
        for leaf in sorted(dispatched - info["leaves"]):
            broken_routes.append(f"{gname}/{leaf}")
    unreachable = sorted(unreachable)
    broken_routes = sorted(broken_routes)

    # Link checks. Flat files and leaves are strict sinks (any .md ref is a
    # defect). A hub index.md may Read:-dispatch to its OWN leaves only.
    bad_links = []

    def _scan(rel_name, text, allowed_targets):
        seen = set()
        for link_re in LINK_RES:
            for lm in link_re.finditer(text):
                target = lm.group(1)
                if (lm.start(), target) not in seen:
                    seen.add((lm.start(), target))
                    if target not in allowed_targets:
                        bad_links.append((rel_name, target))
        prose = _strip_fences(text)
        for sideways_re in SIDEWAYS_RES:
            for sm in sideways_re.finditer(prose):
                target = sm.group(1)
                if (sm.start(), target) not in seen:
                    seen.add((sm.start(), target))
                    if target not in allowed_targets:
                        bad_links.append((rel_name, target))

    for ref in sorted(flat_files):
        _scan(ref, (refs_dir / ref).read_text(), allowed_targets=set())
    for gname, info in groups.items():
        if info["has_index"]:
            # A hub may reference its own leaves via bare `leaf.md` (SIDEWAYS_RES
            # backtick/Read forms) and via the full `references/<group>/leaf.md`
            # path (LINK_RES / SIDEWAYS path form) — allow both spellings.
            allowed = set(info["leaves"])
            _scan(f"{gname}/index.md",
                  (refs_dir / gname / "index.md").read_text(),
                  allowed_targets=allowed)
        for leaf in sorted(info["leaves"]):
            _scan(f"{gname}/{leaf}", (refs_dir / gname / leaf).read_text(),
                  allowed_targets=set())

    return unreachable, bad_links, broken_routes
```

Note on the `allowed` set: `SIDEWAYS_RES[0]` (`references/(<leaf>.md)`) and `SIDEWAYS_RES[1]` (backticked bare `<leaf>.md`) both yield the bare filename, so `allowed = set(info["leaves"])` (bare names) matches them. The `LINK_RES` inline form captures the path as written; a hub should dispatch with the bare `references/<group>/<leaf>.md` inside backticks (a `Read:` line), which `SIDEWAYS_RES` catches as the bare leaf name and `LINK_RES` (markdown-link only) does not fire on — so the cross-group test's captured target `framework-android/integrate.md` (bare-name mismatch) is correctly flagged while `framework-swift/integrate.md` yields bare `integrate.md` ∈ allowed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd plugins/auth0/skills/auth0/scripts && python3 -m unittest test_check_router_reachability -v`
Expected: ALL tests PASS (new group tests + all pre-existing tests).

- [ ] **Step 6: Verify the checker still passes on the current (all-flat) repo**

Run: `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0`
Expected: `PASS: all references routable; no broken routes; no second-hop references`

- [ ] **Step 7: Commit**

```bash
git add scripts/check_router_reachability.py scripts/test_check_router_reachability.py
git commit -m "feat: two-level (group) support in router reachability checker"
```

---

### Task 2: Routing-eval checker — resolve grouped slugs to hub + leaf

Teach `check_routing_evals.py` that a grouped framework routes to `<group>/index.md` + the intent's leaf (looked up from the hub's dispatch table). Backward compatible for flat slugs.

**Files:**
- Modify: `scripts/check_routing_evals.py`
- Test: `scripts/test_check_routing_evals.py`

**Interfaces:**
- Consumes: existing `step4_sections`, `compute_route`, `REF_RE`, `_expand`, `_conditional_enabled` in the module.
- Produces: `check_routing(skill_dir: Path) -> list[str]` — unchanged signature. `compute_route` gains a `refs_dir` parameter: `compute_route(section_body, case, refs_dir)`. Adds helper `_resolve_group(fname: str, intent: str, refs_dir: Path) -> set[str]`: if `fname` is `framework-<slug>.md`/`feature-<slug>.md` whose flat file is absent but a directory `<stem>/` exists, returns `{f"{stem}/index.md", f"{stem}/<leaf>"}` where `<leaf>` is read from the hub's dispatch table for `intent`; otherwise returns `{fname}`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test_check_routing_evals.py`:

```python
    def _make_group_skill(self, root, skill_md, flat_refs, groups, cases):
        skill = root / "plugins/auth0/skills/auth0"
        (skill / "references").mkdir(parents=True)
        (skill / "tests").mkdir(parents=True)
        (skill / "SKILL.md").write_text(skill_md)
        for name in flat_refs:
            (skill / "references" / name).write_text("ok")
        for gname, spec in groups.items():
            gdir = skill / "references" / gname
            gdir.mkdir()
            (gdir / "index.md").write_text(spec["index"])
            for leaf in spec["leaves"]:
                (gdir / leaf).write_text("ok")
        (skill / "tests" / "routing-cases.json").write_text(json.dumps({"cases": cases}))
        return skill

    GROUP_STEP4 = (
        "## Step 4: Load reference files\n"
        "### integrate\n```\n"
        "Read: references/framework-{framework}.md\n"
        "Read: references/tooling-{tooling}.md\n```\n"
        "### upgrade-sdk\n```\n"
        "Read: references/framework-{framework}.md\n```\n"
        "## Step 5\n"
    )
    GROUP_INDEX = (
        "# Swift hub\n"
        "| integrate | `Read: references/framework-swift/integrate.md` |\n"
        "| upgrade-sdk | `Read: references/framework-swift/migration.md` |\n"
    )

    def test_grouped_integrate_resolves_to_index_and_leaf(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/integrate.md", "tooling-cli.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_upgrade_resolves_to_migration_leaf(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                [{"id": "c1", "intent": "upgrade-sdk", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md"]}],
            )
            self.assertEqual(check_routing(skill), [])

    def test_grouped_wrong_leaf_fails(self):
        with tempfile.TemporaryDirectory() as d:
            skill = self._make_group_skill(
                Path(d), self.GROUP_STEP4, ["tooling-cli.md"],
                {"framework-swift": {"index": self.GROUP_INDEX,
                                     "leaves": ["integrate.md", "migration.md"]}},
                # integrate must resolve to integrate.md, not migration.md
                [{"id": "c1", "intent": "integrate", "framework": "swift",
                  "tooling": "cli",
                  "expect_refs": ["framework-swift/index.md",
                                  "framework-swift/migration.md", "tooling-cli.md"]}],
            )
            failures = check_routing(skill)
            self.assertTrue(any("framework-swift/migration.md" in f for f in failures),
                            f"expected a failure naming the wrong leaf, got: {failures}")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd plugins/auth0/skills/auth0/scripts && python3 -m unittest test_check_routing_evals -v`
Expected: the 3 new `test_grouped_*` tests FAIL; existing tests PASS.

- [ ] **Step 3: Add the group resolver**

Add to `check_routing_evals.py` (after `_expand`):

```python
# Hub dispatch row: `| <intent> | `Read: references/<group>/<leaf>.md` |`
_HUB_ROW_RE = re.compile(
    r"\|\s*([A-Za-z0-9:_-]+)\s*\|\s*`?Read:\s*references/[a-z0-9-]+/([a-z0-9-]+\.md)`?"
)


def _hub_leaf_for_intent(refs_dir, group, intent):
    """Read the group's index.md dispatch table; return the leaf for `intent`."""
    index_path = refs_dir / group / "index.md"
    if not index_path.exists():
        return None
    for row_intent, leaf in _HUB_ROW_RE.findall(index_path.read_text()):
        if row_intent == intent:
            return leaf
    return None


def _resolve_group(fname, intent, refs_dir):
    """Expand a grouped reference into {index.md, intent-leaf}; else {fname}."""
    if not fname.endswith(".md"):
        return {fname}
    stem = fname[:-3]
    if (refs_dir / fname).exists() or not (refs_dir / stem).is_dir():
        return {fname}  # flat file (or not a group) -> unchanged
    resolved = {f"{stem}/index.md"}
    leaf = _hub_leaf_for_intent(refs_dir, stem, intent)
    if leaf is not None:
        resolved.add(f"{stem}/{leaf}")
    return resolved
```

- [ ] **Step 4: Thread `refs_dir` + intent resolution through `compute_route`**

Change the `compute_route` signature and the two `.add(fname)` sites so each resolved reference is expanded through `_resolve_group`. Replace the `compute_route` function with:

```python
def compute_route(section_body, case, refs_dir):
    required = set()
    allowed = set()
    intent = case["intent"]
    for line in section_body.splitlines():
        tokens = REF_RE.findall(line)
        if not tokens:
            continue
        line_low = line.strip().lower()
        is_conditional = line_low.startswith("if ")
        enabled = _conditional_enabled(line_low, case) if is_conditional else True
        for token in tokens:
            fname = _expand(token, case)
            if fname is None:
                continue
            resolved = _resolve_group(fname, intent, refs_dir)
            if not is_conditional:
                required |= resolved
                allowed |= resolved
            elif enabled is True:
                required |= resolved
                allowed |= resolved
            elif enabled is None:
                allowed |= resolved
    return required, allowed
```

Then in `check_routing`, update the call site and the `present` glob:

```python
    present = {p.name for p in (skill_dir / "references").glob("*.md")}
    present |= {
        f"{sub.name}/{p.name}"
        for sub in (skill_dir / "references").iterdir() if sub.is_dir()
        for p in sub.glob("*.md")
    }
```

and:

```python
        required, allowed = compute_route(sections[intent], case,
                                          skill_dir / "references")
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd plugins/auth0/skills/auth0/scripts && python3 -m unittest test_check_routing_evals -v`
Expected: ALL tests PASS.

- [ ] **Step 6: Verify against the current repo**

Run: `python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0`
Expected: `PASS: N routing cases resolve ...` (N unchanged; the all-flat repo still passes).

- [ ] **Step 7: Commit**

```bash
git add scripts/check_routing_evals.py scripts/test_check_routing_evals.py
git commit -m "feat: resolve grouped slugs to hub+leaf in routing-evals checker"
```

---

### Task 3: Split `framework-swift` into a group (proof case)

Convert the 104K `framework-swift.md` into `framework-swift/` with hub + `integrate.md`/`mfa.md`/`migration.md`, add the router's group-aware instruction, update routing cases, and turn both checkers green.

**Files:**
- Create: `plugins/auth0/skills/auth0/references/framework-swift/index.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/integrate.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/mfa.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/migration.md`
- Delete: `plugins/auth0/skills/auth0/references/framework-swift.md`
- Modify: `plugins/auth0/skills/auth0/SKILL.md` (add group-aware read instruction to Step 4)
- Modify: `plugins/auth0/skills/auth0/tests/routing-cases.json` (swift cases → grouped expect_refs)
- Modify: `plugins/auth0/skills/auth0/scripts/validate-skill.sh` (swift checked as a group)

**Interfaces:**
- Consumes: the two checkers from Tasks 1–2.
- Produces: the hub dispatch-table format both checkers parse: rows of `| <intent> | `Read: references/framework-swift/<leaf>.md` |`.

- [ ] **Step 1: Carve the source file into leaves (no content dropped)**

The source `framework-swift.md` is a concatenation of documents separated by H1 (`#`) headings (verified line anchors):
- lines 1–286 `# Auth0 Swift Integration` (quickstart)
- 287–481 `# API Reference & Testing`
- 482–948 `# Integration Patterns` (includes `## MFA` at ~785, `## Organizations`, biometrics, error handling)
- 949–1256 `# Setup Guide` (Auth0 config, SDK install, verification)
- 1257–2536 `# Major Version Migration` (v3 migration workflow)
- 2537–end `## Detailed References` / `## Common Mistakes` / `## References` tail

Assign content:
- **`index.md` (hub, shared prerequisites):** `## Critical rules`, `## When NOT to Use`, `## Prerequisites`, the `## Auth0 Configuration` + `## SDK Installation` + `## Verification` blocks from the Setup Guide, and the `Auth0.plist` config. Plus the dispatch table (Step 3 below). Keep it lean (~target < 15K); shared setup every path needs lives here so the agent gets it on hop 1.
- **`integrate.md`:** `# Auth0 Swift Integration` quickstart, `# API Reference & Testing`, `# Integration Patterns` EXCEPT the `## MFA` subsection, and the tail `## Detailed References`/`## Common Mistakes`/`## References`.
- **`mfa.md`:** the `## MFA (Multi-Factor Authentication)` subsection and any step-up/enrollment content, made self-contained (repeat the one or two lines of context it needs; do NOT link back to the hub).
- **`migration.md`:** the entire `# Major Version Migration` document (v3 workflow).

Rule: every line of the original must land in exactly one destination (hub or a leaf). No leaf links to another leaf or back to the hub. Do the carve with an editor; verify nothing is lost in Step 7.

- [ ] **Step 2: Write the hub `index.md`**

Create `references/framework-swift/index.md`. Start with shared prerequisites (from Step 1), then end with the dispatch table:

```markdown
# Auth0 Swift — reference hub

<!-- Shared prerequisites: critical rules, when-not-to-use, SDK install,
     Auth0.plist config, verification. (Carved from the original file.) -->

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read ONLY the one leaf for your intent:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-swift/integrate.md` |
| feature:mfa | `Read: references/framework-swift/mfa.md` |
| upgrade-sdk | `Read: references/framework-swift/migration.md` |

Do not read the other leaves.
```

- [ ] **Step 3: Add the group-aware read instruction to SKILL.md Step 4**

The per-intent `Read: references/framework-{framework}.md` tokens stay unchanged (the checkers map them to the group). Add ONE global note immediately under the `## Step 4: Load reference files` heading (before `### integrate`), so the agent knows to indirect through the hub:

```markdown
> **Grouped references:** if `references/framework-{framework}/` is a directory
> (not a single `.md` file), read its `index.md` instead, then follow the
> dispatch table there to the one leaf for your intent. Read only that leaf.
```

Verify SKILL.md still ≤ 600 lines after the edit.

- [ ] **Step 4: Delete the old flat file**

```bash
git rm plugins/auth0/skills/auth0/references/framework-swift.md
```

- [ ] **Step 5: Update the swift routing cases**

In `plugins/auth0/skills/auth0/tests/routing-cases.json`, find every case with `"framework": "swift"`. For each, rewrite `expect_refs`: replace `"framework-swift.md"` with the two entries `"framework-swift/index.md"` and the intent's leaf — `integrate` → `framework-swift/integrate.md`, `feature:mfa` → `framework-swift/mfa.md`, `upgrade-sdk` → `framework-swift/migration.md`. Leave `tooling-*.md` entries untouched. Example (integrate case):

```json
{ "id": "integrate-swift", "intent": "integrate", "framework": "swift",
  "tooling": "cli",
  "expect_refs": ["framework-swift/index.md", "framework-swift/integrate.md", "tooling-cli.md"] }
```

If no swift case exists for an intent you created a leaf for, that's fine — leaves are validated by the reachability checker, not by requiring a routing case.

- [ ] **Step 6: Update `validate-skill.sh` for the swift group**

In `scripts/validate-skill.sh`, the `EXPECTED_FRAMEWORKS` loop checks `-f "$REFS_DIR/framework-$fw.md"`. Swift is now a directory. Remove `swift` from the `EXPECTED_FRAMEWORKS` string and add an explicit group check after that loop:

```bash
# Grouped frameworks: directory with an index.md and at least one leaf.
for grp in swift; do
  if [ ! -f "$REFS_DIR/framework-$grp/index.md" ]; then
    echo "FAIL: missing references/framework-$grp/index.md (grouped framework)"
    exit 1
  fi
done
```

- [ ] **Step 7: Verify no content was lost**

```bash
git show HEAD:plugins/auth0/skills/auth0/references/framework-swift.md | wc -c
cat plugins/auth0/skills/auth0/references/framework-swift/*.md | wc -c
```
Expected: the concatenated group total is within a small delta of the original (differences only from the added hub heading/dispatch table and any de-duplicated shared setup). Spot-check that the migration workflow, CredentialsManager, biometrics, and MFA content all survive: `grep -rl "CredentialsManager\|enableBiometrics\|clearSession\|userProfile" plugins/auth0/skills/auth0/references/framework-swift/`.

- [ ] **Step 8: Run both checkers + unit tests + the whole-repo gate**

Run:
```bash
cd plugins/auth0/skills/auth0/scripts && python3 -m unittest test_check_router_reachability test_check_routing_evals -v && cd -
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: unit tests PASS; both checkers print `PASS`; `validate-skill.sh` prints `PASS`; skillsaw reports no errors.

- [ ] **Step 9: Commit**

```bash
git add -A plugins/auth0/skills/auth0
git commit -m "feat(auth0): split framework-swift into hub+leaf group (proof case)"
```

---

### Task 4: Behavioral-eval gate for the Swift split

Confirm empirically that the agent completes both hops (SKILL → hub → correct leaf) and still writes correct Swift code. This is the reliability gate for the two-hop relaxation before rollout.

**Files:**
- Read/run: `plugins/auth0/skills/auth0/tests/behavioral/run-evals.mjs`
- Reference: `plugins/auth0/skills/auth0/tests/behavioral/cases/swift.json`, `cases/swift-migration.json`

**Interfaces:**
- Consumes: the split `framework-swift/` group from Task 3.
- Produces: a PASS/FAIL judgment on whether the hub dispatch is imperative enough.

- [ ] **Step 1: Validate the case files load (no agent)**

```bash
cd plugins/auth0/skills/auth0/tests/behavioral
npm install
node run-evals.mjs --dry-run
```
Expected: case files + grader regexes validate with no errors.

- [ ] **Step 2: Run the Swift behavioral evals with the skill loaded**

```bash
node run-evals.mjs swift swift-migration
```
Expected: both slugs score materially higher **with** the skill than without, and the `swift` graders for `CredentialsManager`, `clearSession`/`logout`, biometrics, and the `swift-migration` graders for the v3 breaking changes PASS. This confirms the agent read the hub and then the correct leaf (`integrate.md` for the first case, `migration.md` for the second).

- [ ] **Step 3: If any grader regresses, fix the HUB, not the leaf**

If scores drop versus the pre-split baseline, the two-hop dispatch failed — the agent didn't follow `index.md` to the right leaf. Make the hub dispatch more imperative (e.g. tighten the "Read ONLY the one leaf for your intent" wording, ensure the dispatch table row is an explicit `Read:` verb). Re-run Step 2. Do not move content back into the hub to mask a dispatch-following failure. Re-run `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0` after any hub edit.

- [ ] **Step 4: Commit any hub-wording fixes**

```bash
git add plugins/auth0/skills/auth0/references/framework-swift/index.md
git commit -m "fix(auth0): make swift hub dispatch imperative enough for two-hop follow"
```

(If Step 2 passed with no changes, skip this commit.)

---

### Task 5: Roll out the group split to the remaining >40K references

Apply the Task 3 pattern to each remaining reference file above the ~40K threshold, one file per commit, each gated by the checkers (and, where a behavioral case exists, its evals).

**Files (each becomes a `<stem>/` group):**
- `feature-custom-domains.md` (104K), `feature-branding.md` (92K), `framework-android.md` (77K), `feature-acul.md` (68K), `framework-go.md` (56K), `framework-php-api.md` (49K), `framework-react.md` (45K), `framework-java-mvc.md` (44K), `framework-ionic-angular.md` (44K), `framework-php.md` (42K), `framework-ionic-vue.md` (42K), `framework-aspnetcore-auth.md` (41K), `framework-expo.md` (41K).
- `framework-nuxt.md` (39K): borderline — split only if it has clean intent seams; otherwise leave flat and note the decision in the commit body.
- Modify (per split): `plugins/auth0/skills/auth0/SKILL.md` only if a new intent leaf needs a Step-4 mention (usually none — the group note from Task 3 covers it); `tests/routing-cases.json`; `scripts/validate-skill.sh` (add the stem to the grouped-frameworks / grouped-features loop).

**Interfaces:**
- Consumes: the Task 3 procedure and the two checkers.
- Produces: the same hub-dispatch format per group.

- [ ] **Step 1: Pick the next file and identify its intent seams**

For the chosen file, list H1/H2 headings: `grep -nE '^#{1,2} ' plugins/auth0/skills/auth0/references/<file>.md`. Map sections to intent leaves. Feature files (`feature-branding`, `feature-custom-domains`, `feature-acul`) are single-intent — split by natural sub-topic instead (e.g. `setup.md`, `theming.md`, `troubleshooting.md`) and key the hub dispatch table by those sub-topics under one intent row, OR keep the intent row pointing at the primary leaf and list secondary leaves as "read next if…" imperative `Read:` lines (still own-group dispatch, still allowed). Keep shared prerequisites in `index.md`.

- [ ] **Step 2: Carve into `<stem>/index.md` + leaves**

Follow Task 3 Steps 1–2: hub gets shared prerequisites + dispatch table; each leaf is self-contained; no leaf links anywhere. `git rm` the old flat file.

- [ ] **Step 3: Update routing cases + validate-skill.sh**

Follow Task 3 Steps 5–6 for this stem: rewrite its `routing-cases.json` `expect_refs` to `<stem>/index.md` + intent leaf; add the stem to the grouped loop in `validate-skill.sh` (remove it from the flat `EXPECTED_FRAMEWORKS`/`EXPECTED_FEATURES` string).

- [ ] **Step 4: Run the gates**

```bash
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: all PASS. If the stem has a behavioral case file under `tests/behavioral/cases/` (e.g. `branding`, `custom-domains`, `android`, `acul`, `react`, `expo`, `ionic-angular`, `ionic-vue`), also run `node run-evals.mjs <slug>` and confirm no regression (Task 4 procedure).

- [ ] **Step 5: Commit this one file's split**

```bash
git add -A plugins/auth0/skills/auth0
git commit -m "feat(auth0): split <stem> into hub+leaf group"
```

- [ ] **Step 6: Repeat Steps 1–5 for each remaining file**

Process the files largest-first. Each is its own commit and its own gate. Stop and reassess if a behavioral eval regresses and a hub-wording fix (Task 4 Step 3) doesn't recover it.

---

### Task 6: Update docs and the architecture memory

Replace every statement of the one-hop rule with the two-hop-through-hub contract, and document how to add a grouped reference.

**Files:**
- Modify: `AGENTS.md`, `CONTRIBUTING.md`, `docs/architecture.md`
- Modify: `plugins/auth0/README.md` (only if it describes the reference-file layout)
- Modify (memory): `/Users/frederik.prijck/.claude/projects/-Users-frederik-prijck-Development-auth0-agent-skills/memory/auth0-unified-skill-architecture.md`

**Interfaces:**
- Consumes: the finished group structure.
- Produces: contributor-facing rules matching the enforced checker behavior.

- [ ] **Step 1: Update AGENTS.md**

In the "Before you change a skill" and layout sections, replace the one-hop wording. The `references/` layout note becomes: a reference is either a flat `framework-<name>.md`/`feature-<name>.md`/… file OR a group directory `<stem>/` containing `index.md` (hub: shared prerequisites + intent→leaf dispatch table) and one leaf per intent. Rule: the hub may `Read:`-dispatch only to leaves in its own directory; leaves and flat files link to nothing; the router reaches a group via its `index.md`. Point at `check_router_reachability.py` as the enforcer.

- [ ] **Step 2: Update CONTRIBUTING.md**

Add an "Adding a grouped reference" subsection: when a reference exceeds ~40K, split it into `<stem>/index.md` + intent leaves; hub carries shared setup + the dispatch table (`| <intent> | `Read: references/<stem>/<leaf>.md` |`); leaves self-contained; update `routing-cases.json` and `validate-skill.sh`. State the depth-2 invariant verbatim from Global Constraints.

- [ ] **Step 3: Update docs/architecture.md**

Replace the one-hop description with the two-hop-through-hub model and the checker's role.

- [ ] **Step 4: Update the architecture memory file**

Rewrite the "One-hop rule (critical)" paragraph in `auth0-unified-skill-architecture.md` to describe the depth-2 tree: router → hub `index.md` → one leaf; a hub dispatches only within its own group; leaves and flat files are sinks; enforced by `check_router_reachability.py` (now group-aware). Keep the `[[agent-skills-local-skillsaw]]` link.

- [ ] **Step 5: Run the whole-repo gate one final time**

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md CONTRIBUTING.md docs/architecture.md plugins/auth0/README.md
git commit -m "docs: document two-hop-through-hub reference grouping"
```

(The memory file lives outside the repo — it is saved via the memory tool, not committed.)

---

## Self-Review

**Spec coverage:**
- Structure & naming (mixed pool, kebab stem dir) → Task 3 Step 1–2, Task 5, Task 6.
- Two-hop load path (router→hub→leaf, imperative Read, shared content in hub) → Task 3 Steps 2–3; hub format used by checkers in Tasks 1–2.
- Depth-2 invariant (hub dispatches own-group only; leaves/flat are sinks) → Task 1 Step 4 (`_scan` allowed-targets), tests in Task 1 Step 1.
- Reachability checker changes (recursive glob, two-level orphan/broken-route, narrowed sideways) → Task 1.
- Routing-eval changes (`compute_route` resolves grouped slug, recursive `present`) → Task 2.
- `validate-skill.sh` changes → Task 3 Step 6, Task 5 Step 3.
- Behavioral evals as empirical gate → Task 4, Task 5 Step 4.
- Docs (AGENTS, CONTRIBUTING, architecture, memory) → Task 6.
- Rollout: Swift first, gated on behavioral evals, then remaining >40K files → Tasks 3→4→5.
- Split threshold (>40K) and the 15-file candidate list → Global Constraints + Task 5 file list.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Content-carve steps give exact section assignments and a lossless-verification step (Task 3 Step 7). Every code step shows complete code.

**Type consistency:** `check_router` keeps its 3-tuple return; `_discover`/`_hub_dispatch_targets` names used consistently across Task 1 steps. `compute_route` gains `refs_dir` param, updated at its one call site (Task 2 Step 4). `_resolve_group`/`_hub_leaf_for_intent`/`_HUB_ROW_RE` defined before use. Hub dispatch-table row format is identical in the checker regexes (`_HUB_ROW_RE`, `_hub_dispatch_targets`), the hub template (Task 3 Step 2), and CONTRIBUTING (Task 6 Step 2).
