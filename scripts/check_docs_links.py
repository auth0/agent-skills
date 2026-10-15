#!/usr/bin/env python3
"""Verify the auth0.com Markdown fetch targets the skill tells agents to read.

References point agents at `https://auth0.com/...(.md|.txt)` pages as mandatory
read steps (docs/architecture.md, "Sourcing discipline"). The reachability check
only covers intra-skill links, so a moved docs page would fail silently at agent
runtime. Run this manually or on a schedule — it needs network:

    python3 scripts/check_docs_links.py plugins/auth0/skills/auth0
"""
import re, sys, urllib.error, urllib.request
from pathlib import Path

URL_RE = re.compile(r"https://auth0\.com/[^\s)>\]`\"']+?\.(?:md|txt)\b")
OK_TYPES = ("text/markdown", "text/plain")


def extract_urls(text):
    seen = []
    for url in URL_RE.findall(text):
        if url not in seen:
            seen.append(url)
    return seen


def collect_urls(skill_dir):
    found = {}
    for path in sorted(Path(skill_dir).rglob("*.md")):
        rel = path.relative_to(skill_dir).as_posix()
        for url in extract_urls(path.read_text(encoding="utf-8")):
            found.setdefault(url, []).append(rel)
    return found


def check_urls(urls, fetch):
    failures = []
    for url in urls:
        try:
            status, ctype = fetch(url)
        except Exception as e:  # network errors are reported, not raised
            failures.append((url, f"error: {e}"))
            continue
        if status != 200:
            failures.append((url, f"HTTP {status}"))
        elif not ctype.startswith(OK_TYPES):
            failures.append((url, f"content-type {ctype}"))
    return failures


def http_fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "auth0-agent-skills-linkcheck"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", "")


def main(argv):
    if len(argv) != 2:
        print(f"usage: {argv[0]} <skill_dir>", file=sys.stderr)
        return 2
    found = collect_urls(Path(argv[1]))
    failures = check_urls(list(found), http_fetch)
    for url, reason in failures:
        print(f"FAIL {url} ({reason}) — in {', '.join(found[url])}")
    print(f"{len(found) - len(failures)}/{len(found)} auth0.com fetch targets OK")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
