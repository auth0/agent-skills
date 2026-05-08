#!/usr/bin/env bash
# Regression harness for the auth0-custom-domains skill.
#
# Runs each regression prompt through `claude -p --plugin-dir <auth0 plugin>`
# in a fresh session, captures the response to tests/logs/<slug>.log, and
# prints a summary you can eyeball.
#
# The --plugin-dir flag is required: without it, claude -p sub-sessions do
# NOT load plugin skills unless the plugin is installed from a marketplace.
# With it, auto-discovery surfaces every skill in the directory (including
# sibling skills) so routing signals are real, not hallucinated from
# Claude's general Auth0 knowledge.
#
# This is a routing test, not an end-to-end test. Prompts typically stop at
# the skill's pre-flight tenant confirmation step because no tenant is wired
# in; what we're checking is that Claude picks the right capability and
# starts down its flow. For true E2E, run the prompts interactively against
# a real tenant and real DNS zone (see README.md in this directory).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/tests/logs"
mkdir -p "$LOG_DIR"

# Load the auth0 plugin from the local repo for the duration of each claude -p call.
# Without this, claude -p sub-sessions do not see plugin skills unless the plugin is
# installed in the user's marketplace. Auto-discovery surfaces every skill in the
# directory, so this enables the sibling skills (auth0-branding, auth0-cli, ...) too.
PLUGIN_DIR="$(cd "$ROOT/../.." && pwd)"

# Name => expected capability marker (case-insensitive regex matched against the full response).
# Markers target skill-specific jargon (flow keywords, API fields, flag names) rather than
# capability titles, because Claude tends to describe what it will do rather than echo
# the capability label verbatim. Update these when SKILL.md terminology changes.
declare -a PROMPTS=(
  "cap5-health|Check the health of my Auth0 custom domains.|custom domain health|tenants/settings|dns.*tls|default custom domain|which tenant.*check|active tenant"
  "cap1-setup-cloudflare|Set up login.acme-corp.io as a custom domain on my Auth0 tenant. My DNS is at Cloudflare.|cloudflare mcp|proxied.*false|relying_party_identifier|custom_client_ip_header"
  "cap2-troubleshoot|My custom domain login.acme.com has been stuck in pending_verification for over an hour.|diagnostic ladder|cname flattening|verification\\.methods|pending_verification|cdn.*proxy|propagation"
  "cap3-manage-multi|I have three custom domains on this tenant. Make login-eu.example.com the default, and set the relying party identifier on login.example.com to example.com.|relying_party_identifier|default_custom_domain_id|active tenant.*before.*patch|confirm.*tenant.*patch"
  "cap3-metadata|Tag login.example.com with region=us-east and brand=acme so Actions can read it.|domain_metadata|get.*merge.*patch|event\\.custom_domain"
  "cap4-remove-route53|Remove login-legacy.example.com from my Auth0 tenant. DNS is at Route 53.|route 53|change-resource-record-sets|default_custom_domain_id|irreversible|before deleting|safety info"
  "cap4-remove-default-ask|Remove login-legacy.example.com from my Auth0 tenant.|skip.*scan|quick scan.*deep scan|(three|3) options|before deleting|scan tier|before i scan|where.*referenced"
  "cap4-remove-skip|Remove login-legacy.example.com from my Auth0 tenant. I've already audited the tenant myself; skip the scan and proceed to delete.|already audited|skip.*scan|without.*scan|irreversible|safety flags|default custom domain|explicit.*yes|full impact|destructive delete|before deleting"
  "cap4-remove-quick|Remove login-legacy.example.com from my Auth0 tenant. Run a quick scan first to find any references, then proceed.|email-templates|emails/provider|email provider.*template|quick scan|clients.*tenant.*email|external.*check yourself|not reachable|grep.*login"
  "cap4-remove-deep|Remove login-legacy.example.com from my Auth0 tenant. Run a deep scan across everything reachable via the API, then proceed.|actions/actions|log-streams|connections|resource-servers|deep scan|external.*check yourself|not reachable"
  "ambiguous|Something's wrong with my Auth0 custom domain, can you look at it?|health|verification\\.methods|dig.*cname|check domain health|read-only.*start"
  "err-free-tier-403|I tried to create a custom domain on my Free-tier Auth0 tenant and got a 403 error. What do I do?|credit card|billing|tenant settings.*billing|card is not charged|not.*plan upgrade|does not.*upgrade"
  "err-type-patch|I want to switch my custom domain login.acme-corp.io from Auth0-managed to self-managed certs. How do I PATCH it?|fixed at create|rejected.*patch|not patchable|delete.*recreate|downtime"
  "err-self-managed-free|Create login.acme-corp.io with self-managed certs on my Free tenant.|enterprise|credit card|billing|self_managed_certs.*enterprise|two blockers|both.*requirements"
  "err-domain-taken|I tried to create login.acme-corp.io as a custom domain but got a 409 conflict error. The domain must be used somewhere else.|already.*tenant|list existing|remove from.*other tenant|different domain|409"
)

pass=0
fail=0
declare -a failures=()

printf '%-30s %-10s %s\n' "PROMPT" "RESULT" "LOG"
printf '%s\n' "------------------------------ ---------- ----------------------------------------"

for entry in "${PROMPTS[@]}"; do
  IFS='|' read -r slug prompt marker <<< "$entry"
  log="$LOG_DIR/$slug.log"

  # Run in non-interactive mode, fresh session, no streaming.
  claude -p --plugin-dir "$PLUGIN_DIR" "$prompt" > "$log" 2>&1 || true

  if grep -qiE "$marker" "$log"; then
    printf '%-30s %-10s %s\n' "$slug" "PASS" "$log"
    pass=$((pass + 1))
  else
    printf '%-30s %-10s %s\n' "$slug" "REVIEW" "$log"
    failures+=("$slug (expected: $marker)")
    fail=$((fail + 1))
  fi
done

echo
echo "Summary: $pass passed, $fail need review."
if [ $fail -gt 0 ]; then
  echo
  echo "Needs review:"
  for f in "${failures[@]}"; do
    echo "  - $f"
  done
  echo
  echo "Open the logs above; a REVIEW doesn't always mean the skill misrouted."
  echo "Claude may have chosen different phrasing. Read the log to decide."
fi
