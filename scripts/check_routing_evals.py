#!/usr/bin/env python3
"""Routing evals for the unified `auth0` router.

The reachability checker (check_router_reachability.py) proves the *structure*
is sound — every reference file is reachable and nothing links sideways. This
checker proves the *routing decisions* are sound for a curated set of developer
requests, including the cases the RAPID called out as unproven: cross-cutting
features (MFA, branding, Organizations, ...) and SDK+feature combinations
(e.g. "MFA in a Next.js app").

Each case in tests/routing-cases.json names an intent + detected framework/
tooling and the reference files Step 4 must load. We assert, per case:

  1. the intent has a matching `### <intent>` section in SKILL.md Step 4
     (so the lookup key the router picks actually resolves),
  2. every expected reference file exists in references/ (so a route never
     points at a missing file — the failure mode reachability can't catch,
     since it only flags orphans, not broken routes), and
  3. `expect_refs` actually matches the route the intent's Step 4 section
     computes for this case's framework/tooling/flags. This is the assertion
     that stops `expect_refs` from being decorative: we parse the section body,
     expand the `{framework}`/`{tooling}` placeholders, model the `If ...`
     conditionals against the case fields, and require that
       - every UNCONDITIONAL reference is present in expect_refs,
       - every reference behind a MODELED conditional whose gate is ON for
         this case is present in expect_refs (so a combo case like "MFA in a
         Next.js app" can't silently omit framework-nextjs.md), and
       - every entry in expect_refs is a reference the section could actually
         route to for this case (unconditional, an enabled conditional, or an
         unmodeled/optional conditional).

This is a deterministic, offline check — no model in the loop — so it runs in
CI next to the reachability check. It does not replace live activation evals;
it locks down the routing table those evals depend on.
"""
import json
import re
import sys
from pathlib import Path

SECTION_RE = re.compile(r"^###\s+(\S+)\s*$", re.M)
# A reference token as it appears in Step 4, e.g. references/framework-{framework}.md
REF_RE = re.compile(r"references/([A-Za-z0-9_{}-]+\.md)")
# Frameworks that count as a SPA for the DPoP "If a SPA framework is detected" gate.
SPA_FRAMEWORKS = {"vue", "react", "angular", "spa-js"}
# A markdown table row: optional leading whitespace, then a `|` cell delimiter.
TABLE_ROW_RE = re.compile(r"^\s*\|")
# The bolded intent token in the Step 1 table's value (Intent) column, e.g.
# **feature:mfa**. Intents are lowercase and may carry a `:` sub-key.
INTENT_TOKEN_RE = re.compile(r"\*\*([a-z][a-z0-9:_-]*)\*\*")


def load_cases(skill_dir: Path) -> list:
    data = json.loads((skill_dir / "tests" / "routing-cases.json").read_text())
    return data["cases"]


def step4_sections(skill_md: str) -> dict:
    """Map each Step 4 intent heading to its section body.

    Returns {intent: body} where body is everything between the `### <intent>`
    heading and the next heading (### or ##).
    """
    body = skill_md.split("## Step 4", 1)[-1]
    # Don't bleed past Step 4 into any later `## ` section.
    body = re.split(r"\n##\s", body, 1)[0]
    parts = SECTION_RE.split(body)
    # parts == [preamble, name1, body1, name2, body2, ...]
    sections = {}
    it = iter(parts[1:])
    for name, section_body in zip(it, it):
        sections[name] = section_body
    return sections


def step4_intents(skill_md: str) -> set:
    """Intent headings under Step 4 (### integrate, ### feature:mfa, ...)."""
    return set(step4_sections(skill_md).keys())


def step1_intents(skill_md: str) -> set:
    """Intent keys declared in the Step 1 "Detect intent" table's value column.

    Step 1 is where the router maps a developer request to an Intent lookup key;
    Step 4 is where that key resolves to reference files. The two lists MUST be
    symmetric — a Step 1 intent with no Step 4 section is a dead route, and a
    Step 4 section no Step 1 row points at is unreachable. We read the bolded
    token from the LAST cell of each Step 1 table row (the Intent column) so a
    bolded phrase in the description column (e.g. **intent-first**) is ignored.
    """
    body = skill_md.split("## Step 1", 1)[-1]
    body = re.split(r"\n##\s", body, 1)[0]
    intents: set = set()
    for line in body.splitlines():
        if not TABLE_ROW_RE.match(line):
            continue
        cells = line.strip().strip("|").split("|")
        if len(cells) < 2:
            continue
        # The Intent value lives in the final column; the earlier column is the
        # plain-language description (which may itself bold an Auth0 term).
        m = INTENT_TOKEN_RE.search(cells[-1])
        if m:
            intents.add(m.group(1))
    return intents


def _expand(token: str, case: dict):
    """Expand {framework}/{tooling} placeholders. None if a needed field is null."""
    if "{framework}" in token:
        framework = case.get("framework")
        if framework is None:
            return None
        token = token.replace("{framework}", framework)
    if "{tooling}" in token:
        tooling = case.get("tooling")
        if tooling is None:
            return None
        token = token.replace("{tooling}", tooling)
    return token


def _conditional_enabled(line_low: str, case: dict):
    """Whether an `If ...` line's references route for this case.

    Returns True (enabled), False (disabled), or None (unmodeled -> optional:
    allowed but not required, so the check doesn't over-constrain).
    """
    if "framework detected" in line_low:
        return case.get("framework") is not None
    if "spa framework is detected" in line_low:
        return case.get("framework") in SPA_FRAMEWORKS
    if "multi-tenant" in line_low:
        return bool(case.get("multi_tenant"))
    if "token handling" in line_low:
        return bool(case.get("token_handling"))
    return None  # unmodeled conditional -> optional


def compute_route(section_body: str, case: dict):
    """Return (required, allowed) reference-file sets for a case.

    - required: unconditional references that MUST appear in expect_refs.
    - allowed: every reference expect_refs is permitted to name — the
      unconditional set plus enabled conditionals plus optional (unmodeled)
      conditionals.
    """
    required = set()
    allowed = set()
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
            if not is_conditional:
                required.add(fname)
                allowed.add(fname)
            elif enabled is True:
                # Modeled conditional whose gate is ON for this case: the route
                # WILL load it, so expect_refs must name it (required). This is
                # the combo path (e.g. "MFA in a Next.js app" -> framework-nextjs)
                # that would otherwise be silently under-specifiable.
                required.add(fname)
                allowed.add(fname)
            elif enabled is None:
                # Unmodeled conditional: we can't decide the gate, so it's
                # optional — allowed but not required (don't over-constrain).
                allowed.add(fname)
            # enabled is False: not allowed, not required
    return required, allowed


def check_intent_symmetry(skill_md: str) -> list:
    """Every Step 1 intent has a Step 4 section and vice versa.

    Catches the failure mode that neither reachability nor the per-case route
    check can see: an intent the router can PICK in Step 1 but that has no Step 4
    section to resolve it (dead route), or a Step 4 section no Step 1 row can
    ever select (unreachable section, e.g. left behind after a rename).
    """
    s1 = step1_intents(skill_md)
    s4 = step4_intents(skill_md)
    failures = []
    for intent in sorted(s1 - s4):
        failures.append(
            f"intent '{intent}' is selectable in Step 1 but has no "
            f"'### {intent}' section in Step 4 (dead route)"
        )
    for intent in sorted(s4 - s1):
        failures.append(
            f"Step 4 has a '### {intent}' section but no Step 1 table row "
            f"routes to it (unreachable section)"
        )
    return failures


def check_case_coverage(skill_md: str, cases: list) -> list:
    """Every Step 4 section is exercised by at least one routing case.

    Without this, a section can silently go untested (as `upgrade-sdk` and
    `tooling` did): the per-case route check only validates intents that HAPPEN
    to appear in routing-cases.json, so a new intent ships with zero coverage
    and CI stays green.
    """
    covered = {c["intent"] for c in cases}
    failures = []
    for intent in sorted(step4_intents(skill_md) - covered):
        failures.append(
            f"Step 4 section '### {intent}' has no routing case in "
            f"routing-cases.json (add one so the route is exercised)"
        )
    return failures


def check_case_routes(skill_dir: Path) -> list:
    """Per-case route assertions: each case's intent resolves to a Step 4
    section, every expected reference exists, and expect_refs matches the route
    the section computes for the case. This is the assertion layer the
    symmetry/coverage checks sit on top of; kept separate so it can be tested in
    isolation of a full Step 1 table."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    sections = step4_sections(skill_md)
    present = {p.name for p in (skill_dir / "references").glob("*.md")}
    cases = load_cases(skill_dir)

    failures = []
    for case in cases:
        cid = case["id"]
        intent = case["intent"]
        expect_refs = case["expect_refs"]

        # (a) the intent resolves to a Step 4 section.
        if intent not in sections:
            failures.append(
                f"{cid}: intent '{intent}' has no '### {intent}' section in Step 4"
            )
            # No section body to route against; still check file existence.
            for ref in expect_refs:
                if ref not in present:
                    failures.append(
                        f"{cid}: expected reference '{ref}' does not exist in references/"
                    )
            continue

        # (b) every expected reference file exists on disk.
        for ref in expect_refs:
            if ref not in present:
                failures.append(
                    f"{cid}: expected reference '{ref}' does not exist in references/"
                )

        # (c) expect_refs matches the route the section computes for this case.
        required, allowed = compute_route(sections[intent], case)
        expect_set = set(expect_refs)
        for ref in sorted(required - expect_set):
            failures.append(
                f"{cid}: missing mandatory ref '{ref}' — intent '{intent}' "
                f"routes to it for this case (unconditional read or an enabled "
                f"conditional) but it is absent from expect_refs"
            )
        for ref in sorted(expect_set - allowed):
            failures.append(
                f"{cid}: expected ref '{ref}' is not routed by intent '{intent}' "
                f"for framework={case.get('framework')!r} tooling={case.get('tooling')!r} "
                f"(not an unconditional read and no enabled conditional loads it)"
            )
    return failures


def check_routing(skill_dir: Path) -> list:
    """Full routing check: Step 1<->Step 4 symmetry, per-section case coverage,
    and the per-case route assertions. This is what CI runs."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    cases = load_cases(skill_dir)
    failures = []
    failures.extend(check_intent_symmetry(skill_md))
    failures.extend(check_case_coverage(skill_md, cases))
    failures.extend(check_case_routes(skill_dir))
    return failures


def main() -> int:
    skill_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "plugins/auth0/skills/auth0"
    )
    failures = check_routing(skill_dir)
    if failures:
        print("ROUTING EVAL FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    n = len(load_cases(skill_dir))
    print(
        f"PASS: {n} routing cases resolve to an existing Step 4 section, "
        f"reference files exist, and expect_refs matches the computed route"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
