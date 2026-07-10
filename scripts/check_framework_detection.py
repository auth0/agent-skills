#!/usr/bin/env python3
"""Framework-detection evals for the unified `auth0` router (Step 2).

`check_routing_evals.py` proves Step 4 (the load table) is sound *given* an
already-resolved framework. This checker proves the step BEFORE it: that a set
of project signals walks the Step 2 detection cascade to the RIGHT framework.
That cascade is where the subtle regressions hide — the "stop at first match"
ordering that must check `@capacitor/*` Ionic rows before the plain
`@auth0/auth0-react` row, `@auth0/nextjs-auth0` before `@auth0/auth0-react`,
the expo-vs-react-native split, and the php/php-api variant. Reorder two rows
and the router silently mis-routes; nothing else in CI would catch it.

How it models the cascade — faithfully, from SKILL.md's own tables, no
hardcoded mirror:

  * Tier 1 (Auth0 SDK installed) and Tier 2 (workspace deps) tables are parsed,
    in document order, into an ordered list of rules. Tier 1 outranks Tier 2 by
    appearing first, so a single top-to-bottom "first rule whose signals are all
    satisfied wins" walk reproduces the router's precedence exactly.
  * A rule's left (detection) cell is parsed into AND-clauses split on ` + `.
    Each clause is either an OR-group (`a` or `b` -> satisfied if EITHER present)
    or a single required backticked token. A `(no `x`)` / `no `x`` parenthetical
    becomes a NEGATED token (rule fails if it IS present). Clauses with no
    backticked token (pure prose like "web enabled", "HTTP server/router") carry
    no mechanical signal — the ordering of the rows around them already encodes
    the distinction, so they are dropped from the rule (documented below).
  * After a base framework is found, the "Variant disambiguation" table resolves
    web-app-vs-API bases (`express`->`express`/`express-jwt`, …) using the
    case's `api_intent` flag.

Deliberately OUT of mechanical scope (no silent cap — stated so a green run is
not misread as "everything is covered"):
  * Tier 3 (framework named in the PROSE prompt) — mostly un-backticked names.
  * Prose-only Tier 2 distinctions: `*.csproj` MAUI/WinForms/WPF/ASP.NET flavor,
    Flutter web-vs-native in Tier 2 (Tier 1 has the `flutter.web: false` token,
    so Flutter IS covered there), and "HTTP server/router".
Cases that depend on those are not authored here; a comment in
detection-cases.json records the exclusion.

Each case in tests/detection-cases.json gives `signals` (backticked tokens
present in the project, verbatim), an optional `api_intent`, and the
`expect_framework`. We assert the simulated cascade returns exactly that slug.
Deterministic and offline — runs in CI beside the other router checks.
"""
import json
import re
import sys
from pathlib import Path

TABLE_ROW_RE = re.compile(r"^\s*\|")
# Any backticked token, verbatim (left-column signals may contain `::`, `.`,
# `/`, uppercase, quotes — e.g. `SdkConfiguration::STRATEGY_API`,
# `strategy: 'api'`, `*.csproj`). Matched exactly against a case's signals.
BACKTICK_RE = re.compile(r"`([^`]+)`")
# A routable framework slug in a VALUE column: lowercase, may carry a `-`.
SLUG_RE = re.compile(r"`([a-z0-9][a-z0-9-]*)`")


class Rule:
    """One detection row: ordered AND of clauses -> a framework slug."""

    def __init__(self, and_clauses, negated, framework, raw):
        self.and_clauses = and_clauses  # list[set[str]] — each set is an OR-group
        self.negated = negated          # set[str] — rule fails if any is present
        self.framework = framework
        self.raw = raw

    def matches(self, present: set) -> bool:
        if self.negated & present:
            return False
        # A rule with no mechanical signal at all never matches on its own; the
        # row's position (ordering) is its only contribution, and a bare
        # ordering-only row would match everything, so require >=1 clause.
        if not self.and_clauses:
            return False
        return all(group & present for group in self.and_clauses)


def _parse_left_cell(cell: str):
    """Parse a detection left-cell into (and_clauses, negated_tokens).

    Split on ` + ` into AND-clauses. Within a clause, a standalone "no" opens a
    NEGATION ZONE running to the clause end: every backticked token there is
    negated (rule fails if present), e.g. "(no `AuthorizationGuard`)" or the
    "(no `STRATEGY_API` / … or `strategy: 'webapp'`)" list. No detection row
    places a positive signal AFTER a "no", so treating the tail as negated is
    safe. Backticked tokens BEFORE the "no" are positive: an ` or `-joined
    positive zone becomes an OR-group; otherwise the FIRST positive token is the
    required signal and any later ones are location/explanatory qualifiers
    (e.g. "`vue` in `package.json`" -> require `vue`; the `mvc-auth-commons`
    (`com.auth0:mvc-auth-commons`) gloss -> require `mvc-auth-commons`)."""
    and_clauses = []
    negated = set()
    for clause in cell.split(" + "):
        m = re.search(r"\bno\b", clause.lower())
        if m:
            negated.update(BACKTICK_RE.findall(clause[m.start():]))
            pos_zone = clause[: m.start()]
        else:
            pos_zone = clause
        pos = BACKTICK_RE.findall(pos_zone)
        if not pos:
            continue  # prose-only / pure-negation clause: no positive signal
        if " or " in pos_zone.lower():
            and_clauses.append(set(pos))  # OR-group: any present satisfies it
        else:
            and_clauses.append({pos[0]})   # single required signal
    return and_clauses, negated


def _detection_rules(skill_md: str):
    """Ordered Tier 1 + Tier 2 detection rules, in document order.

    We read every table row between "## Step 2" and the "Variant disambiguation"
    heading whose VALUE column names a lowercase framework slug, skipping header
    and separator rows. Document order == router precedence (Tier 1 first)."""
    body = skill_md.split("## Step 2", 1)[-1]
    body = body.split("### Variant disambiguation", 1)[0]
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
        m = SLUG_RE.search(value)
        if not m:
            continue  # header row ("| Package | Framework |") or prose value
        and_clauses, negated = _parse_left_cell(left)
        rules.append(Rule(and_clauses, negated, m.group(1), left.strip()))
    return rules


def _variant_table(skill_md: str):
    """Map base framework -> (web_variant, api_variant) from the disambiguation
    table (`| express | \\`express\\` | \\`express-jwt\\` | … |`)."""
    body = skill_md.split("### Variant disambiguation", 1)[-1]
    body = re.split(r"\n###?\s", body, 1)[0]
    variants = {}
    in_table = False
    for line in body.splitlines():
        low = line.lower()
        if "choose api when" in low:
            in_table = True
            continue
        if not in_table:
            continue
        if not TABLE_ROW_RE.match(line):
            break
        if set(line.strip()) <= set("|-: "):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3:
            continue
        base = cells[0]
        web = SLUG_RE.findall(cells[1])
        api = SLUG_RE.findall(cells[2])
        if base and web and api:
            variants[base] = (web[0], api[0])
    return variants


def detect(skill_md: str, signals, api_intent=False):
    """Simulate Step 2: return the detected framework slug, or None."""
    present = set(signals)
    rules = _detection_rules(skill_md)
    base = None
    for rule in rules:
        if rule.matches(present):
            base = rule.framework
            break
    if base is None:
        return None
    variants = _variant_table(skill_md)
    if base in variants:
        web, api = variants[base]
        return api if api_intent else web
    return base


def reachable_frameworks(skill_md: str) -> set:
    """Framework slugs the Step 2 cascade can actually emit as a terminal result.

    For each detection rule, synthesize the minimal signal set that satisfies its
    clauses (one representative per OR-group, no negated tokens) and run the FULL
    cascade. The winner is what a real project carrying those signals resolves
    to, which means the set correctly accounts for:
      * shadowing — a rule fully masked by an earlier, less-specific one never
        surfaces, so we don't demand a case for an unreachable row;
      * variant disambiguation — a variant BASE (e.g. `aspnetcore`) is never a
        terminal output; it always resolves through the variant table to
        `aspnetcore-auth`/`-api`, which is what a case can actually pin.
    Rules with no mechanical signal (prose-only rows — Tier 3, `*.csproj` flavor
    splits — deliberately out of scope per the module docstring) can't match, so
    they contribute nothing. The result is exactly the set of outputs a
    detection case is able to assert."""
    outputs = set()
    for rule in _detection_rules(skill_md):
        signals = {sorted(group)[0] for group in rule.and_clauses}
        if not signals:
            continue
        for api_intent in (False, True):
            got = detect(skill_md, signals, api_intent)
            if got:
                outputs.add(got)
    return outputs


def check_framework_coverage(skill_md: str, cases: list) -> list:
    """Every framework the cascade can emit is exercised by >=1 detection case.

    The detection-side analogue of check_routing_evals' check_case_coverage:
    without it a newly added framework row ships with zero detection coverage and
    CI stays green, exactly the gap that left 15 frameworks untested. Scope is
    mechanically-reachable outputs only (see reachable_frameworks) — prose-only
    rows carry no signal, so they are neither reachable nor required, matching
    the exclusions stated in the module docstring."""
    covered = {c["expect_framework"] for c in cases}
    failures = []
    for fw in sorted(reachable_frameworks(skill_md) - covered):
        failures.append(
            f"framework '{fw}' is reachable through the Step 2 cascade but no "
            f"detection case in detection-cases.json exercises it (add one)"
        )
    return failures


def load_cases(skill_dir: Path) -> list:
    data = json.loads((skill_dir / "tests" / "detection-cases.json").read_text())
    return data["cases"]


def check_detection_cases(skill_dir: Path) -> list:
    """Per-case assertions: each case's signals resolve to the expected framework
    through the cascade, and that framework has a reference file to load. This is
    the assertion layer the coverage check sits on top of; kept separate so it can
    be tested with a small hand-authored case list (not the full reachable set)."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    present_files = {p.name for p in (skill_dir / "references").glob("*.md")}
    failures = []
    for case in load_cases(skill_dir):
        cid = case["id"]
        got = detect(skill_md, case["signals"], case.get("api_intent", False))
        want = case["expect_framework"]
        if got != want:
            failures.append(
                f"{cid}: signals={case['signals']} api_intent="
                f"{case.get('api_intent', False)} detected {got!r}, "
                f"expected {want!r}"
            )
            continue
        # The detected framework must have a reference file to load — closes the
        # loop from "detected slug" to "loadable file" for detection cases.
        ref = f"framework-{want}.md"
        if ref not in present_files:
            failures.append(
                f"{cid}: detected framework {want!r} has no references/{ref}"
            )
    return failures


def check_detection(skill_dir: Path) -> list:
    """Full detection check: every reachable framework is exercised by a case
    (coverage), and every case resolves correctly (per-case). This is what CI
    runs."""
    skill_md = (skill_dir / "SKILL.md").read_text()
    cases = load_cases(skill_dir)
    failures = check_framework_coverage(skill_md, cases)
    failures.extend(check_detection_cases(skill_dir))
    return failures


def main() -> int:
    skill_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "plugins/auth0/skills/auth0"
    )
    failures = check_detection(skill_dir)
    if failures:
        print("FRAMEWORK DETECTION FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    n = len(load_cases(skill_dir))
    print(
        f"PASS: {n} detection cases resolve to the expected framework through "
        f"the Step 2 cascade (Tier 1/2 ordering + variant disambiguation)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
