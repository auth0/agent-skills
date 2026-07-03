#!/usr/bin/env python3
"""Enforce the router's one-hop invariants for the consolidated skill:

  1. every references/*.md is routable from SKILL.md (no orphans);
  2. no route in SKILL.md points at a reference file that doesn't exist
     (broken route — the failure `present - routed` can't see);
  3. no reference file takes a second hop to another reference — neither via
     a .md link (any markdown/HTML form) NOR via the router's non-link dispatch
     forms (a `references/x.md` prose/backtick path, a backticked bare `x.md`,
     or a `Read: references/x.md` verb). Claude Code follows only one hop from
     the router, so all of these are defects — including stale links left by
     earlier consolidation."""
import re, sys
from pathlib import Path

# A routable framework/target slug is a backticked token that appears in a
# markdown table's VALUE column — i.e. any data cell EXCEPT the first (the
# detection / left column). `_router_slugs` parses SKILL.md row by row, drops
# the first data cell, and harvests backticked tokens from the remaining cells,
# so left-column dependency names (`express-oauth2-jwt-bearer`,
# `auth0-java-mvc-common`, `spring-security-oauth2-resource-server`, `next`,
# `authlib`, …) are structurally excluded whether they are a lone backticked
# token, prose-suffixed, or in a slash-list. Slash-lists in a value cell
# (`php` / `php-api`) still yield every slug. This keeps the router the single
# source of truth without a hardcoded mirror list AND without admitting phantom
# dependency slugs that could mask a future orphan.
SLUG_RE = re.compile(r"`([a-z0-9][a-z0-9-]*)`")
# A markdown table row: optional leading whitespace, then a `|` cell delimiter.
TABLE_ROW_RE = re.compile(r"^\s*\|")
READ_RE = re.compile(r"references/([a-z0-9-]+(?:\{[a-z]+\})?\.md)")
BACKTICK_MD_RE = re.compile(r"`([a-z0-9-]+\.md)`")
# Markdown links whose target is a .md file — ANY path form (bare `x.md`,
# `./references/x.md`, `../SKILL.md`), with an optional #anchor. External URLs
# (http/https) are excluded so real doc links are not flagged; non-.md targets
# (asset templates like `x.tsx`) never match. Together these catch every
# intra-skill .md link form the one-hop rule forbids in a reference file:
#   - inline:            [text](target.md)  /  [text](target.md "title")  /  [text](<target.md>)
#   - reference-style:   [label]: target.md
#   - autolink:          <target.md>
LINK_RES = [
    # Inline: allow an optional <>, a trailing ?query or /, an optional #anchor,
    # and an optional title. The `[?/#]` segment catches `x.md?v=2` and `x.md/`,
    # which otherwise slipped past the closing `)`.
    re.compile(r"\]\(\s*<?(?!https?://)([^)\s<>#?]*\.md)(?:[?/#][^)\s]*)?(?:\s+[^)]*)?>?\s*\)"),
    # Reference-style link definition at the start of a line.
    re.compile(r"^\s*\[[^\]]+\]:\s*<?(?!https?://)([^\s>#?]*\.md)", re.M),
    # Autolink (optionally with a trailing ?query / #anchor before `>`).
    re.compile(r"<(?!https?://)([^>\s#?]*\.md)(?:[?#][^>\s]*)?>"),
    # HTML anchor: <a href="x.md"> / <a href='./x.md#a'>. The autolink pattern
    # cannot match this (the space after `<a` stops it), so an HTML .md link
    # would otherwise bypass the one-hop check entirely.
    re.compile(r"""<a\s[^>]*?href\s*=\s*["']?(?!https?://)([^"'>\s#?]*\.md)""", re.I),
]
# Second-hop dispatch forms the one-hop rule ALSO forbids but that are not
# markdown/HTML links: naming another reference file in prose, in backticks, or
# via the router's own `Read:` verb. The router `SKILL.md` is the ONLY place
# reference files may be listed; a reference body that names `feature-mfa.md`,
# `` `feature-mfa.md` ``, or `Read: references/feature-mfa.md` invites the agent
# to take a second hop, which is exactly the stale-link class the module claims
# to catch. These are matched in reference bodies only, never in SKILL.md.
SIDEWAYS_RES = [
    re.compile(r"references/([a-z0-9-]+\.md)"),          # prose/backtick path
    re.compile(r"`([a-z0-9-]+\.md)`"),                   # backticked bare filename
    re.compile(r"(?im)^\s*Read:\s*(?:references/)?([a-z0-9-]+\.md)"),  # dispatch verb
]


def _variant_base_slugs(skill_md: str) -> set:
    """Slugs the router marks as an abstract variant base — a value cell whose
    text carries the `(variant below)` annotation (e.g. `aspnetcore`). These
    never resolve to their own `framework-<slug>.md`; they always split into a
    web-app/API variant in the disambiguation table, so they must NOT be
    flagged as broken routes. Derived from the router's own annotation, not a
    hardcoded exception list."""
    bases: set = set()
    for line in skill_md.splitlines():
        if not TABLE_ROW_RE.match(line):
            continue
        cells = line.strip().strip("|").split("|")
        for cell in cells[1:]:
            if "variant below" in cell.lower():
                bases.update(SLUG_RE.findall(cell))
    return bases


def _router_slugs(skill_md: str) -> set:
    """The routable value-slug universe: backticked tokens found in the VALUE
    columns of the router's markdown tables. For each table row we drop the
    first data cell (the detection / left column) and harvest backticked tokens
    from the remaining cells, so left-column dependency names are never mistaken
    for routable framework slugs — regardless of whether they are a lone
    backticked token, prose-suffixed, or part of a slash-list. Derived from the
    router itself, with no hardcoded mirror list."""
    slugs: set = set()
    for line in skill_md.splitlines():
        if not TABLE_ROW_RE.match(line):
            continue
        # Strip the outer table pipes, split into data cells, then drop the
        # first (detection/left) cell so only value columns are considered.
        cells = line.strip().strip("|").split("|")
        for cell in cells[1:]:
            slugs.update(SLUG_RE.findall(cell))
    return slugs


def _expand(token: str, universes: dict) -> list:
    # Replace a {placeholder} with each slug from the universe for THAT
    # placeholder name. Using one flat slug set for every placeholder let
    # framework slugs expand onto `tooling-{tooling}.md`, so an orphaned
    # `tooling-<frameworkslug>.md` was falsely "reachable"; keying by
    # placeholder name closes that hole.
    ph = re.search(r"\{([a-z]+)\}", token)
    if not ph:
        return [token]
    slugs = universes.get(ph.group(1), set())
    return [token.replace(ph.group(0), s) for s in slugs]


FENCE_RE = re.compile(r"^\s*```", re.M)


def _strip_fences(text: str) -> str:
    """Blank out fenced ``` code blocks so a reference showing an illustrative
    `Read: references/x.md` inside a fence isn't misread as a real second hop.
    Markdown-link forms (LINK_RES) are intentionally left un-stripped — the
    one-hop rule forbids an actual link even in an example — but the prose /
    backtick / Read-verb forms are only defects when they're live instructions."""
    out, in_fence = [], False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            out.append("")
            continue
        out.append("" if in_fence else line)
    return "\n".join(out)


def check_router(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    refs_dir = skill_dir / "references"

    slugs = _router_slugs(skill_md)
    backticked_md = set(BACKTICK_MD_RE.findall(skill_md))
    # Placeholder-keyed slug universes. `{framework}` expands over value-column
    # slugs; `{tooling}` expands ONLY over the tooling slugs the router actually
    # names as `tooling-<slug>.md` (Step 3), so a framework slug can never
    # manufacture a phantom `tooling-<framework>.md` route.
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

    present = {p.name for p in refs_dir.glob("*.md")}
    unreachable = sorted(present - routed)

    # Broken routes: the router names a reference file that does not exist.
    # `present - routed` (unreachable) can't see this; only `routed - present`
    # can. Restrict to real reference filenames (an unexpanded `{placeholder}`
    # template survives expansion only when its universe is empty, which is
    # itself a router bug worth surfacing, but a literal `{` is not a file).
    # Exempt abstract variant bases (`framework-aspnetcore.md`) the router marks
    # `(variant below)` — they intentionally have no file, resolving to a
    # web-app/API variant instead.
    variant_bases = _variant_base_slugs(skill_md)
    exempt = {f"framework-{b}.md" for b in variant_bases}
    broken_routes = sorted(
        r for r in routed - present
        if "{" not in r and "}" not in r and r not in exempt
    )

    bad_links = []
    for ref in sorted(present):
        text = (refs_dir / ref).read_text()
        seen = set()
        for link_re in LINK_RES:
            for lm in link_re.finditer(text):
                target = lm.group(1)
                if (lm.start(), target) not in seen:
                    seen.add((lm.start(), target))
                    bad_links.append((ref, target))
        # Non-link second-hop forms (prose/backtick path, backticked filename,
        # `Read:` verb) — checked outside fenced code so illustrative examples
        # don't trip the guard.
        prose = _strip_fences(text)
        for sideways_re in SIDEWAYS_RES:
            for sm in sideways_re.finditer(prose):
                target = sm.group(1)
                if (sm.start(), target) not in seen:
                    seen.add((sm.start(), target))
                    bad_links.append((ref, target))

    return unreachable, bad_links, broken_routes


def main() -> int:
    skill_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "plugins/auth0/skills/auth0"
    )
    unreachable, bad_links, broken_routes = check_router(skill_dir)
    ok = True
    if unreachable:
        ok = False
        print("UNREACHABLE reference files (not routed from SKILL.md):")
        for f in unreachable:
            print(f"  - references/{f}")
    if broken_routes:
        ok = False
        print("BROKEN routes (SKILL.md routes to a reference file that does not exist):")
        for f in broken_routes:
            print(f"  - references/{f}")
    if bad_links:
        ok = False
        print("INTRA-REFERENCES .md LINKS (forbidden — existing or dead target):")
        for src, tgt in bad_links:
            print(f"  - {src} -> {tgt}")
    if ok:
        print(
            "PASS: all references routable; no broken routes; "
            "no second-hop references"
        )
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
