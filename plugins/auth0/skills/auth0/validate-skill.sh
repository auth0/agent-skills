#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root from script location (safe to run from any directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

SKILL_MD="$REPO_ROOT/plugins/auth0/skills/auth0/SKILL.md"
REFS_DIR="$REPO_ROOT/plugins/auth0/skills/auth0/references"

# Sanity check
if [ ! -f "$SKILL_MD" ]; then
  echo "ERROR: SKILL.md not found at $SKILL_MD — is this the right repo?"
  exit 1
fi

# Extract description line
DESC=$(grep "^description:" "$SKILL_MD" | sed 's/^description: //')
DESC_LEN=${#DESC}

echo "Description length: $DESC_LEN chars (limit: 1024)"
echo "SKILL.md line count: $(wc -l < "$SKILL_MD")"

if [ "$DESC_LEN" -gt 1024 ]; then
  echo "FAIL: description exceeds 1024 chars"
  exit 1
fi

if [ "$(wc -l < "$SKILL_MD")" -gt 600 ]; then
  echo "FAIL: SKILL.md exceeds 600 lines"
  exit 1
fi

TOTAL=$(ls "$REFS_DIR"/*.md 2>/dev/null | wc -l)
echo "Reference files: $TOTAL"

echo "PASS"
