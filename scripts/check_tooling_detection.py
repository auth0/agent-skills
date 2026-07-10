#!/usr/bin/env python3
"""Tooling-detection evals for the unified `auth0` router (Step 3).

Step 2 resolves the application framework; Step 3 resolves the *tooling* the
work is done through — Terraform, the Auth0 MCP server, or the Auth0 CLI. Like
Step 2 it is a "stop at the first match" cascade over project signals, so row
order matters: the specific Terraform row must be checked before the catch-all
default. This checker proves a set of project signals walks that cascade to the
right `tooling-<x>.md`, so a reorder or a mistyped signal can't silently change
which tooling reference loads.

`check_routing_evals.py` already validates Step 4 *given* a tooling value (it
expands the `{tooling}` placeholder), but it treats tooling as an input it is
handed — nothing there proves the Step 3 table actually derives that value from
project signals. This checker closes that loop.

How it models the cascade — faithfully, from SKILL.md's own Step 3 table, no
hardcoded mirror:

  * The table rows are parsed in document order into an ordered rule list; the
    first rule whose signals are all present wins, reproducing the router's
    precedence.
  * A row's left cell is parsed for backticked signal tokens (`terraform/`,
    `*.tf`). Multiple tokens joined by "or"/"OR" form an OR-group (any present
    satisfies the row); ` + ` would split into AND-clauses (none today, kept for
    parity with the Step 2 grammar).
  * The catch-all row ("Anything else (default)") carries no backticked signal;
    it is recognized as the DEFAULT and matches unconditionally when reached, so
    a project with no Terraform/MCP signal resolves to `tooling-cli.md`.

Deliberately OUT of mechanical scope (no silent cap — stated so a green run is
not misread as "everything is covered"):
  * The MCP row ("Auth0 MCP server active in this agent session") is a session-
    RUNTIME signal, not a file on disk, so it carries no backticked token to
    model — the same reason Step 2's prose rows are excluded. `tooling-mcp.md`
    is therefore not asserted here; a comment in tooling-cases.json records it.

Each case in tests/tooling-cases.json gives `signals` (backticked tokens present
in the project, verbatim) and the `expect_tooling` slug. We assert the simulated
cascade returns exactly that slug. Deterministic and offline — runs in CI beside
the other router checks.
"""
import json
import re
import sys
from pathlib import Path

TABLE_ROW_RE = re.compile(r"^\s*\|")
# Any backticked token, verbatim (e.g. `terraform/`, `*.tf`).
BACKTICK_RE = re.compile(r"`([^`]+)`")
# The tooling slug in a `tooling-<slug>.md` value cell.
TOOLING_RE = re.compile(r"`tooling-([a-z0-9-]+)\.md`")
# A row whose left cell means "match anything not caught above".
DEFAULT_RE = re.compile(r"\b(default|anything else)\b", re.I)


class Rule:
    """One Step 3 row: signals -> a tooling slug. A default rule matches
    unconditionally when the cascade reaches it."""

    def __init__(self, or_groups, tooling, is_default, raw):
        self.or_groups = or_groups      # list[set[str]] — each set is an OR-group
        self.tooling = tooling
        self.is_default = is_default
        self.raw = raw

    def matches(self, present: set) -> bool:
        if self.is_default:
            return True
        if not self.or_groups:
            return False
        return all(group & present for group in self.or_groups)


def _parse_left_cell(cell: str):
    """Parse a Step 3 left cell into a list of OR-groups (AND-joined).

    Split on ` + ` into AND-clauses (parity with Step 2; the current table has
    none). Within a clause, backticked tokens joined by "or"/"OR" are
    alternatives — any present satisfies the clause."""
    or_groups = []
    for clause in cell.split(" + "):
        tokens = BACKTICK_RE.findall(clause)
        if not tokens:
            continue  # prose-only clause: no mechanical signal
        or_groups.append(set(tokens))
    return or_groups


def _tooling_rules(skill_md: str):
    """Ordered Step 3 rules, in document order (== router precedence)."""
    body = skill_md.split("## Step 3", 1)[-1].split("## Step 4", 1)[0]
    rules = []
    for line in body.splitlines():
        if not TABLE_ROW_RE.match(line):
            continue
        if set(line.strip()) <= set("|-: "):
            continue  # separator row
        cells = line.strip().strip("|").split("|")
        if len(cells) < 2:
            continue
        left, value = cells[0], cells[-1]
        m = TOOLING_RE.search(value)
        if not m:
            continue  # header row ("| Project has... | Load |") or prose value
        tooling = m.group(1)
        is_default = bool(DEFAULT_RE.search(left)) and not BACKTICK_RE.search(left)
        rules.append(Rule(_parse_left_cell(left), tooling, is_default, left.strip()))
    return rules


def detect(skill_md: str, signals):
    """Simulate Step 3: return the detected tooling slug, or None."""
    present = set(signals)
    for rule in _tooling_rules(skill_md):
        if rule.matches(present):
            return rule.tooling
    return None


def reachable_toolings(skill_md: str) -> set:
    """Tooling slugs the Step 3 cascade can actually emit.

    For each rule, feed the minimal signals that satisfy it (one representative
    per OR-group) and run the full cascade; the default rule contributes its
    slug via the empty-signal walk. Rules with no mechanical signal (the MCP
    runtime row) can't match and contribute nothing, so the result is exactly
    the set a case can assert — see the module docstring for the MCP exclusion."""
    outputs = set()
    rules = _tooling_rules(skill_md)
    for rule in rules:
        if rule.is_default:
            continue
        signals = {sorted(group)[0] for group in rule.or_groups}
        if not signals:
            continue
        got = detect(skill_md, signals)
        if got:
            outputs.add(got)
    # The default row resolves the no-signal case.
    got = detect(skill_md, [])
    if got:
        outputs.add(got)
    return outputs


def check_tooling_coverage(skill_md: str, cases: list) -> list:
    """Every tooling the cascade can emit is exercised by >=1 case.

    The Step 3 analogue of the Step 2 / Step 4 coverage gates: without it a new
    tooling row ships with zero detection coverage and CI stays green. Scope is
    mechanically-reachable outputs only (see reachable_toolings) — the MCP
    runtime row carries no signal, so it is neither reachable nor required."""
    covered = {c["expect_tooling"] for c in cases}
    failures = []
    for tool in sorted(reachable_toolings(skill_md) - covered):
        failures.append(
            f"tooling '{tool}' is reachable through the Step 3 cascade but no "
            f"case in tooling-cases.json exercises it (add one)"
        )
    return failures


def load_cases(skill_dir: Path) -> list:
    data = json.loads((skill_dir / "tests" / "tooling-cases.json").read_text())
    return data["cases"]


def check_tooling_cases(skill_dir: Path) -> list:
    """Per-case assertions: each case's signals resolve to its expect_tooling
    through the cascade, and that tooling has a reference file to load."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    present_files = {p.name for p in (skill_dir / "references").glob("*.md")}
    failures = []
    for case in load_cases(skill_dir):
        cid = case["id"]
        got = detect(skill_md, case["signals"])
        want = case["expect_tooling"]
        if got != want:
            failures.append(
                f"{cid}: signals={case['signals']} detected {got!r}, "
                f"expected {want!r}"
            )
            continue
        ref = f"tooling-{want}.md"
        if ref not in present_files:
            failures.append(
                f"{cid}: detected tooling {want!r} has no references/{ref}"
            )
    return failures


def check_tooling(skill_dir: Path) -> list:
    """Full tooling check: every reachable tooling is exercised by a case
    (coverage), and every case resolves correctly (per-case). This is what CI
    runs."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    cases = load_cases(skill_dir)
    failures = check_tooling_coverage(skill_md, cases)
    failures.extend(check_tooling_cases(skill_dir))
    return failures


def main() -> int:
    skill_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "plugins/auth0/skills/auth0"
    )
    failures = check_tooling(skill_dir)
    if failures:
        print("TOOLING DETECTION FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    n = len(load_cases(skill_dir))
    print(
        f"PASS: {n} tooling cases resolve to the expected tooling through the "
        f"Step 3 cascade (signal rows + default)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
