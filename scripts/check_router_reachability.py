#!/usr/bin/env python3
"""Assert every references/*.md is routable from SKILL.md and no reference file
links to ANY .md file (neither an existing reference nor a dead/nonexistent one).
Claude Code follows only one hop from the router, so all intra-references .md
links are defects — including stale links left by earlier consolidation."""
import re, sys
from pathlib import Path

# Every bare `slug` token in a router table's value column is a routable
# framework/target slug. The router is the single source of truth — no
# hardcoded mirror list (which could mask an orphaned file, e.g. php-api).
SLUG_RE = re.compile(r"`([a-z0-9][a-z0-9-]*)`")
READ_RE = re.compile(r"references/([a-z0-9-]+(?:\{[a-z]+\})?\.md)")
BACKTICK_MD_RE = re.compile(r"`([a-z0-9-]+\.md)`")
LINK_RE = re.compile(r"\]\(([a-z0-9-]+\.md)(?:#[^)]*)?\)")


def _router_slugs(skill_md: str) -> set:
    """All backticked slugs the router mentions — the routable value universe.
    A superset of framework/tooling slugs; safe because we only intersect it
    with `{...}`-template expansions, and any real reference file must have a
    slug the router actually names to be reachable."""
    return set(SLUG_RE.findall(skill_md))


def _expand(token: str, slugs: set) -> list:
    # Replace any {placeholder} with each known router slug.
    ph = re.search(r"\{([a-z]+)\}", token)
    if not ph:
        return [token]
    return [token.replace(ph.group(0), s) for s in slugs]


def check_router(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    refs_dir = skill_dir / "references"

    slugs = _router_slugs(skill_md)
    routed = set()
    for m in READ_RE.finditer(skill_md):
        for name in _expand(m.group(1), slugs):
            routed.add(name)
    for name in BACKTICK_MD_RE.findall(skill_md):
        routed.add(name)

    present = {p.name for p in refs_dir.glob("*.md")}
    unreachable = sorted(present - routed)

    bad_links = []
    for ref in sorted(present):
        for lm in LINK_RE.finditer((refs_dir / ref).read_text()):
            bad_links.append((ref, lm.group(1)))

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
        print("INTRA-REFERENCES .md LINKS (forbidden — existing or dead target):")
        for src, tgt in bad_links:
            print(f"  - {src} -> {tgt}")
    if ok:
        print("PASS: all references routable; no intra-references .md links")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
