#!/usr/bin/env bash
set -euo pipefail

SNYK_AGENT_SCAN_VERSION="${SNYK_AGENT_SCAN_VERSION:-0.5.1}"

SKILL_DIRS=$(find plugins/*/skills -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort)

if [ -z "$SKILL_DIRS" ]; then
  echo "No skills found"
  exit 0
fi

scan_skill() {
  local skill_file="$1"
  local skill_name="$2"

  uvx "snyk-agent-scan@${SNYK_AGENT_SCAN_VERSION}" "$skill_file" --skills --json 2>/dev/null \
    | tee "snyk-agent-scan-skill-${skill_name}.json" \
    && return 0

  echo "Retrying ${skill_name} in 5s..."
  sleep 5

  uvx "snyk-agent-scan@${SNYK_AGENT_SCAN_VERSION}" "$skill_file" --skills --json 2>/dev/null \
    | tee "snyk-agent-scan-skill-${skill_name}.json"
}

EXIT_CODE=0
while IFS= read -r skill_dir; do
  skill_file="${skill_dir}/SKILL.md"
  if [ -f "$skill_file" ]; then
    skill_name=$(echo "$skill_dir" | tr '/' '-')
    echo "Scanning ${skill_dir}..."
    scan_skill "$skill_file" "$skill_name" || EXIT_CODE=1
  else
    echo "Skipping (no SKILL.md): ${skill_dir}"
  fi
done <<< "$SKILL_DIRS"

exit $EXIT_CODE
