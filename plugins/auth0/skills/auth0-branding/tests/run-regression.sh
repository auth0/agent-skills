#!/usr/bin/env bash
# Regression harness for the auth0-branding skill.
#
# Runs each regression prompt through `claude -p` in a fresh session, captures
# the response to tests/logs/<slug>.log, and prints a summary you can eyeball.
#
# This is a routing test, not an end-to-end test. The prompts will usually
# stop at the first real-action step because no live credentials / tenants
# are wired in; what we're checking is that Claude picks the right capability
# and walks the correct flow. For true E2E, run the prompts interactively
# against a real tenant (see README.md in this directory).

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/tests/logs"
mkdir -p "$LOG_DIR"

# Load the parent plugin (auth0) so the skill is auto-discovered in each
# fresh `claude -p` session. Without this, `claude -p` inherits whatever
# plugins the user has enabled globally, which may not include `auth0`.
PLUGIN_DIR="$(cd "$ROOT/../.." && pwd)"

# slug|prompt|marker
# Marker is a case-insensitive extended regex matched against the full response.
# Markers target skill-specific jargon (API paths, field names, flow keywords) rather than
# capability titles, because Claude tends to describe what it will do rather than echo
# the capability label verbatim. Update these when SKILL.md terminology changes.
declare -a PROMPTS=(
  "cap1-brand-url|Brand my Auth0 tenant to match ferrari.com.|brandfetch|colors\\.primary|widget\\.logo_url|branding/themes|primary color|logo.*font|tenants list|active tenant"
  "cap1-inline-values|Here are my brand values: primary #0051BA, logo https://acme.example/logo.svg, font Inter. Apply them to my Auth0 tenant.|branding/themes|inter|google fonts|PATCH /branding|colors\\.primary|logo_url"
  "cap2-button-color|Change the primary button color on my Auth0 login page to #FF5733.|colors\\.primary_button|primary button|button fill|button label|wcag|contrast|tenants list"
  "cap2-ambiguous|Make the Auth0 login button color green.|which part|label text|fill.*background|background.*fill|could mean|can mean|disambiguat|fill \\(|button fill|primary button"
  "cap3-voice|Rewrite the Auth0 Universal Login copy to sound like mailchimp.com; casual and direct.|custom[- ]text|enabled_locales|placeholder|list them|detect|multi-select|categories|voice profile|mailchimp"
  "cap4-rollback|Reset my Auth0 theme and clear the custom text on the login and signup prompts.|delete:branding|DELETE.*themes|backup|tenants list|active tenant|before.*any writes|reset"
  "cap5-diagnose|I applied an Auth0 theme but my login page still looks like the old defaults. What's wrong?|universal_login_experience|guardian_mfa_page|change_password|classic|flags\\.universal_login|check my setup"
  "cap2-template|I want to upload a custom Auth0 Universal Login page template (HTML/Liquid) to my tenant. What are the requirements and how does the skill validate the template before writing it?|auth0:head|auth0:widget|templates/universal-login|custom domain|liquid"
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
  # --plugin-dir enables the parent plugin so the skill auto-loads.
  # --add-dir grants read access to the skill's references/ directory
  # (the CWD is tests/, so references/ lives one level up).
  # Prompt goes via stdin because --add-dir and --plugin-dir are variadic
  # and would otherwise consume the trailing positional prompt.
  printf '%s' "$prompt" | claude -p --plugin-dir "$PLUGIN_DIR" --add-dir "$ROOT" > "$log" 2>&1 || true

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
