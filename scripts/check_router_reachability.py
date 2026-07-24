#!/usr/bin/env python3
"""Enforce the router's uniform-folder invariants for the consolidated skill.

Every reference is a DIRECTORY `<name>/` containing `index.md`. There are no
flat `references/*.md` files — a stray one is a failure. The router always
routes to a reference by NAME via `Read: references/<name>/index.md`; there is
no flat-vs-group branch, so the resolved path is deterministic. A directory is
either an index-only group (`index.md` is the whole reference, no leaves) or a
leaf group (`index.md` is a hub: shared prerequisites + an intent->leaf dispatch
table, plus document-section leaves). This module asserts:

  1. `references/` contains only directories (any flat *.md is STRAY);
  2. every group is routable from SKILL.md and every leaf is reachable from its
     hub's dispatch (no orphans);
  3. no route (from SKILL.md or a hub) points at a missing file (broken route);
  4. the ONLY second hop allowed is a hub `index.md` dispatching to leaves in
     its OWN directory. A leaf or an index-only hub takes NO second hop — via a
     .md link (any form) NOR a prose/backtick path NOR a `Read:` verb. Two-level
     `<group>/<leaf>.md` targets are caught by SIDEWAYS_TWO_LEVEL_RE."""
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
# Router route to a reference. New uniform form: references/<name>/index.md
# (name may carry a {placeholder}). The captured group is the reference NAME
# (no extension), which is a directory under references/.
READ_INDEX_RE = re.compile(r"references/([a-z0-9-]+(?:\{[a-z]+\})?)/index\.md")
# Backticked reference targets in tables, e.g. Step 3's tooling table:
# `tooling-cli/index.md` (uniform form) or legacy bare `tooling-cli.md`.
# Both name a reference by its GROUP name — check_router normalizes both to
# NAME (stripping `/index.md` or `.md`) so either spelling routes the group.
BACKTICK_INDEX_RE = re.compile(r"`([a-z0-9-]+)/index\.md`")
BACKTICK_MD_RE = re.compile(r"`([a-z0-9-]+)\.md`")
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
# Two-level (group) sideways form: `references/<group>/<leaf>.md`, e.g. a hub
# dispatching (or a leaf back-linking) to `framework-swift/integrate.md`. The
# SIDEWAYS_RES character classes above deliberately exclude `/`, so none of
# them can ever capture a two-level path; this dedicated pattern is the only
# thing that sees a group-shaped target at all — whether it's the hub's own
# (allowed) leaf or another group's (forbidden) leaf/index is decided by the
# caller's `allowed_targets` set, not by this regex.
SIDEWAYS_TWO_LEVEL_RE = re.compile(r"references/([a-z0-9-]+/[a-z0-9-]+\.md)")


def _disambiguation_variant_slugs(skill_md: str) -> set:
    """Backticked slugs in the value columns of the "Variant disambiguation"
    table — the concrete web-app / API variants each base splits into
    (`express`, `express-jwt`, `aspnetcore-auth`, `aspnetcore-api`, …). This is
    the router's own statement of which slugs are real route targets, so it lets
    us tell a base that DOES resolve to its own file (its web-app variant slug
    equals the base, e.g. `express` → `framework-express.md`) from one that does
    NOT (`aspnetcore` → `aspnetcore-auth`/`aspnetcore-api`, no bare file)."""
    slugs: set = set()
    in_table = False
    for line in skill_md.splitlines():
        low = line.lower()
        if "choose api when" in low:   # the disambiguation table's header row
            in_table = True
            continue
        if in_table:
            if not TABLE_ROW_RE.match(line):
                break                  # table ended
            if set(line.strip()) <= set("|-: "):
                continue               # header/body separator row
            cells = line.strip().strip("|").split("|")
            # Drop the first cell (the bare "Base" name); harvest backticked
            # variant slugs from the remaining value columns.
            for cell in cells[1:]:
                slugs.update(SLUG_RE.findall(cell))
    return slugs


def _variant_base_slugs(skill_md: str) -> set:
    """Slugs the router marks as an abstract variant base — a value cell whose
    text carries the `(variant below)` annotation (e.g. `aspnetcore`) — that
    truly resolve to NO `framework-<slug>/` reference. A base is only such an
    abstract stand-in when it does NOT itself appear as a concrete variant slug
    in the disambiguation table: `aspnetcore` splits into `aspnetcore-auth`/`-api`
    (so `framework-aspnetcore/` never exists and must be exempt), whereas
    `express`/`fastify`/`php`/`laravel` ARE their own web-app variant slug and
    DO ship `framework-<base>/` — those must stay in broken-route scope so a
    later delete/rename of the real reference is caught. Derived from the router's
    own tables, not a hardcoded exception list, and not from file presence
    (which would circularly re-exempt a file the moment it goes missing)."""
    annotated: set = set()
    for line in skill_md.splitlines():
        if not TABLE_ROW_RE.match(line):
            continue
        cells = line.strip().strip("|").split("|")
        for cell in cells[1:]:
            if "variant below" in cell.lower():
                annotated.update(SLUG_RE.findall(cell))
    concrete_variants = _disambiguation_variant_slugs(skill_md)
    return {b for b in annotated if b not in concrete_variants}


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


def check_router(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    refs_dir = skill_dir / "references"

    slugs = _router_slugs(skill_md)
    # Backticked reference targets in tables (Step 3's tooling table): the
    # uniform `` `tooling-cli/index.md` `` form and the legacy bare
    # `` `tooling-cli.md` `` form. Both name a reference by its GROUP name;
    # normalize both to NAME so either spelling routes the group. Exclude the
    # bare word "index" — the router's own prose note ("Reference layout")
    # says `` `index.md` `` on its own, with no group prefix; every real
    # reference slug is namespaced (framework-/feature-/tooling-/pattern-), so
    # a bare "index" match is always this prose, never a route.
    backticked_names = set(BACKTICK_INDEX_RE.findall(skill_md))
    backticked_names |= set(BACKTICK_MD_RE.findall(skill_md))
    backticked_names.discard("index")
    tooling_slugs = {
        n[len("tooling-"):]
        for n in backticked_names
        if n.startswith("tooling-")
    }
    universes = {"framework": slugs, "tooling": tooling_slugs}

    routed = set()
    for m in READ_INDEX_RE.finditer(skill_md):          # references/<name>/index.md
        for name in _expand(m.group(1), universes):
            routed.add(name)                            # NAME, not filename
    # Backticked table targets (either spelling) name a reference by its GROUP
    # name directly — no expansion needed.
    routed |= backticked_names

    flat_files, groups = _discover(refs_dir)
    group_names = set(groups)

    # Uniform model: every reference is a directory. A routed NAME is satisfied
    # only by a group directory of that name.
    def _satisfied(name):
        return name in group_names

    variant_bases = _variant_base_slugs(skill_md)
    exempt = {f"framework-{b}" for b in variant_bases}

    # STRAY flat files: the uniform model forbids any flat reference file.
    stray = sorted(f"STRAY:{f}" for f in flat_files)

    broken_routes = sorted(
        f"{r}/index.md" for r in routed
        if "{" not in r and "}" not in r and r not in exempt and not _satisfied(r)
    )
    unreachable = list(stray)

    # Two-level checks for each group.
    for gname, info in groups.items():
        idx_path = f"{gname}/index.md"
        if gname not in routed:
            unreachable.append(idx_path)                # group never routed
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
        for tm in SIDEWAYS_TWO_LEVEL_RE.finditer(prose):
            target = tm.group(1)
            if (tm.start(), target) not in seen:
                seen.add((tm.start(), target))
                if target not in allowed_targets:
                    bad_links.append((rel_name, target))

    for ref in sorted(flat_files):
        _scan(ref, (refs_dir / ref).read_text(), allowed_targets=set())
    for gname, info in groups.items():
        if info["has_index"]:
            # A hub may reference its own leaves via bare `leaf.md` (SIDEWAYS_RES
            # backtick/Read forms) and via the full `references/<group>/leaf.md`
            # path (SIDEWAYS_TWO_LEVEL_RE) — allow both spellings.
            allowed = set(info["leaves"]) | {f"{gname}/{leaf}" for leaf in info["leaves"]}
            _scan(f"{gname}/index.md",
                  (refs_dir / gname / "index.md").read_text(),
                  allowed_targets=allowed)
        for leaf in sorted(info["leaves"]):
            _scan(f"{gname}/{leaf}", (refs_dir / gname / leaf).read_text(),
                  allowed_targets=set())

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
            if f.startswith("STRAY:"):
                print(f"  - STRAY: references/{f[len('STRAY:'):]}")
            else:
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
