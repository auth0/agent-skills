#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root from script location (safe to run from any directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

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

# Router checks
if ! grep -q "Detect intent" "$SKILL_MD"; then
  echo "FAIL: SKILL.md missing 'Detect intent' section"
  exit 1
fi
if ! grep -q "Detect framework" "$SKILL_MD"; then
  echo "FAIL: SKILL.md missing 'Detect framework' section"
  exit 1
fi
if ! grep -q "Detect tooling" "$SKILL_MD"; then
  echo "FAIL: SKILL.md missing 'Detect tooling' section"
  exit 1
fi
if ! grep -q "tooling-terraform" "$SKILL_MD"; then
  echo "FAIL: SKILL.md missing tooling-terraform routing"
  exit 1
fi
if ! grep -q "pattern-common-errors" "$SKILL_MD"; then
  echo "FAIL: SKILL.md missing debug routing"
  exit 1
fi

# Framework file checks. This list is a smoke check only; the authoritative
# "every routed framework has a file and every file is routed" guarantee is
# enforced by scripts/check_router_reachability.py (run below), which derives
# slugs from the router itself. Keep this list in sync when adding frameworks.
EXPECTED_FRAMEWORKS="react nextjs vue angular spa-js nuxt express flask fastify fastify-api java-mvc aspnetcore-auth aspnetcore-api php php-api express-jwt fastapi-api springboot-api go react-native expo ionic-angular ionic-react ionic-vue android swift flutter-native flutter-web laravel laravel-api maui net-android net-ios winforms wpf"
for fw in $EXPECTED_FRAMEWORKS; do
  if [ ! -f "$REFS_DIR/framework-$fw.md" ]; then
    echo "FAIL: missing references/framework-$fw.md"
    exit 1
  fi
done

# Old files must be gone
OLD_PATTERNS=$(ls "$REFS_DIR/react-"*.md "$REFS_DIR/nextjs-"*.md "$REFS_DIR/vue-"*.md 2>/dev/null | wc -l || true)
if [ "$OLD_PATTERNS" -gt 0 ]; then
  echo "FAIL: old framework-type files still exist (found $OLD_PATTERNS)"
  exit 1
fi

# Feature file checks
EXPECTED_FEATURES="mfa branding custom-domains migration acul dpop"
for feat in $EXPECTED_FEATURES; do
  if [ ! -f "$REFS_DIR/feature-$feat.md" ]; then
    echo "FAIL: missing references/feature-$feat.md"
    exit 1
  fi
done
OLD_FEATURE=$(ls "$REFS_DIR/mfa-"*.md "$REFS_DIR/branding-"*.md "$REFS_DIR/acul-"*.md 2>/dev/null | wc -l || true)
if [ "$OLD_FEATURE" -gt 0 ]; then
  echo "FAIL: old feature source files still exist ($OLD_FEATURE files)"
  exit 1
fi

if [ ! -f "$REFS_DIR/feature-organizations.md" ]; then
  echo "FAIL: missing references/feature-organizations.md"
  exit 1
fi
ORG_LINES=$(wc -l < "$REFS_DIR/feature-organizations.md")
if [ "$ORG_LINES" -lt 80 ]; then
  echo "FAIL: feature-organizations.md too short ($ORG_LINES lines, need 80+)"
  exit 1
fi

for t in cli mcp terraform; do
  if [ ! -f "$REFS_DIR/tooling-$t.md" ]; then
    echo "FAIL: missing references/tooling-$t.md"
    exit 1
  fi
done

for p in security token-handling multi-tenant rate-limiting common-errors; do
  if [ ! -f "$REFS_DIR/pattern-$p.md" ]; then
    echo "FAIL: missing references/pattern-$p.md"
    exit 1
  fi
done

# Router reachability + no intra-references .md links
REACH="$REPO_ROOT/scripts/check_router_reachability.py"
if [ -f "$REACH" ]; then
  echo "Running router reachability check..."
  python3 "$REACH" "$REPO_ROOT/plugins/auth0/skills/auth0" || {
    echo "FAIL: router reachability check failed"; exit 1;
  }
fi

# Routing evals — curated requests resolve to a Step 4 section + reference files
EVALS="$REPO_ROOT/scripts/check_routing_evals.py"
if [ -f "$EVALS" ]; then
  echo "Running routing evals check..."
  python3 "$EVALS" "$REPO_ROOT/plugins/auth0/skills/auth0" || {
    echo "FAIL: routing evals check failed"; exit 1;
  }
fi

echo "PASS"
