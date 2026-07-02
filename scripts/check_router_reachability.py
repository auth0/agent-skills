#!/usr/bin/env python3
"""Assert every references/*.md is routable from SKILL.md and no reference file
links to ANY .md file (neither an existing reference nor a dead/nonexistent one).
Claude Code follows only one hop from the router, so all intra-references .md
links are defects — including stale links left by earlier consolidation."""
import re, sys
from pathlib import Path

# A routable framework/target slug is a backticked token in a table's VALUE
# position — i.e. followed by a `|` (next cell / row end) or `/` (slash-list
# like `php` / `php-api`). The lookahead deliberately EXCLUDES left-column
# dependency names (e.g. `authlib`, `python-jose`, `express-openid-connect`),
# which are followed by prose/other backticks, not `|`/`/`. This keeps the
# router the single source of truth without a hardcoded mirror list AND without
# admitting phantom dependency slugs that could mask a future orphan.
SLUG_RE = re.compile(r"`([a-z0-9][a-z0-9-]*)`(?=\s*[|/])")
READ_RE = re.compile(r"references/([a-z0-9-]+(?:\{[a-z]+\})?\.md)")
BACKTICK_MD_RE = re.compile(r"`([a-z0-9-]+\.md)`")
# A markdown link whose target is a .md file — ANY path form (bare `x.md`,
# `./references/x.md`, `../SKILL.md`), with an optional #anchor. External URLs
# (http/https) are excluded so real doc links are not flagged; non-.md targets
# (asset templates like `x.tsx`) never match. This catches every intra-skill
# .md link, which the one-hop rule forbids in a reference file.
LINK_RE = re.compile(r"\]\((?!https?://)([^)]*\.md)(?:#[^)]*)?\)")


def _router_slugs(skill_md: str) -> set:
    """The routable value-slug universe: backticked tokens in table value
    positions (followed by `|` or `/`). Derived from the router itself — no
    hardcoded list — and scoped to value columns so left-column dependency
    names are not mistaken for routable framework slugs."""
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
