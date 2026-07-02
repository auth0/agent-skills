#!/usr/bin/env python3
"""Assert every references/*.md is routable from SKILL.md and no reference file
links to ANY .md file (neither an existing reference nor a dead/nonexistent one).
Claude Code follows only one hop from the router, so all intra-references .md
links are defects — including stale links left by earlier consolidation."""
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
# A bare .md link target: only [a-z0-9-] then .md, so "https://…/x.md" (has "/")
# and asset paths like "../assets/…/x.tsx" (not .md) do NOT match — only
# intra-references links such as "](setup.md)" or "](react-api.md)".
LINK_RE = re.compile(r"\]\(([a-z0-9-]+\.md)(?:#[^)]*)?\)")


def _expand(token: str) -> list:
    if "{framework}" in token:
        return [token.replace("{framework}", f) for f in FRAMEWORKS]
    if "{tooling}" in token:
        return [token.replace("{tooling}", t) for t in TOOLINGS]
    return [token]


def check_router(skill_dir: Path):
    skill_md = (skill_dir / "SKILL.md").read_text()
    refs_dir = skill_dir / "references"

    routed = set()
    for m in READ_RE.finditer(skill_md):
        for name in _expand(m.group(1)):
            routed.add(name)

    present = {p.name for p in refs_dir.glob("*.md")}
    unreachable = sorted(present - routed)

    bad_links = []
    for ref in sorted(present):
        for lm in LINK_RE.finditer((refs_dir / ref).read_text()):
            # Flag EVERY intra-references .md link — existing target or dead.
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
