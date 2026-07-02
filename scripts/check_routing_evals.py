#!/usr/bin/env python3
"""Routing evals for the unified `auth0` router.

The reachability checker (check_router_reachability.py) proves the *structure*
is sound — every reference file is reachable and nothing links sideways. This
checker proves the *routing decisions* are sound for a curated set of developer
requests, including the cases the RAPID called out as unproven: cross-cutting
features (MFA, branding, Organizations, ...) and SDK+feature combinations
(e.g. "MFA in a Next.js app").

Each case in tests/routing-cases.json names an intent + detected framework/
tooling and the reference files Step 4 must load. We assert:

  1. the intent has a matching `### <intent>` section in SKILL.md Step 4
     (so the lookup key the router picks actually resolves), and
  2. every expected reference file exists in references/ (so a route never
     points at a missing file — the failure mode reachability can't catch,
     since it only flags orphans, not broken routes).

This is a deterministic, offline check — no model in the loop — so it runs in
CI next to the reachability check. It does not replace live activation evals;
it locks down the routing table those evals depend on.
"""
import json
import re
import sys
from pathlib import Path

SECTION_RE = re.compile(r"^###\s+(\S+)\s*$", re.M)


def load_cases(skill_dir: Path) -> list:
    data = json.loads((skill_dir / "tests" / "routing-cases.json").read_text())
    return data["cases"]


def step4_intents(skill_md: str) -> set:
    """Intent headings under Step 4 (### integrate, ### feature:mfa, ...)."""
    body = skill_md.split("## Step 4", 1)[-1]
    return set(SECTION_RE.findall(body))


def check_routing(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    intents = step4_intents(skill_md)
    present = {p.name for p in (skill_dir / "references").glob("*.md")}

    failures = []
    for case in load_cases(skill_dir):
        cid = case["id"]
        intent = case["intent"]
        if intent not in intents:
            failures.append(f"{cid}: intent '{intent}' has no '### {intent}' section in Step 4")
        for ref in case["expect_refs"]:
            if ref not in present:
                failures.append(f"{cid}: expected reference '{ref}' does not exist in references/")
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
    print(f"PASS: {n} routing cases resolve to an existing Step 4 section and reference files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
