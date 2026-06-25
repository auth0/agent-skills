#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/references"

merge_feature() {
  local name="$1"; shift
  local out="$SRC/feature-$name.md"
  > "$out"
  for f in "$@"; do
    [ -f "$SRC/$f" ] && cat "$SRC/$f" >> "$out" && printf "\n---\n\n" >> "$out"
  done
  echo "  feature-$name.md ($(wc -l < "$out") lines)"
}

merge_feature mfa \
  mfa-quickstart.md mfa-api.md mfa-backend.md mfa-advanced.md mfa-examples.md

merge_feature branding \
  branding-quickstart.md branding-api.md branding-advanced.md branding-screens.md branding-examples.md \
  branding-capability-brand.md branding-capability-check.md branding-capability-manual.md \
  branding-capability-rollback.md branding-capability-voice.md

merge_feature custom-domains \
  custom-domains-quickstart.md custom-domains-api.md custom-domains-advanced.md \
  custom-domains-examples.md custom-domains-providers.md \
  custom-domains-providers-cloudflare.md custom-domains-providers-route53.md \
  custom-domains-providers-azure-dns.md custom-domains-providers-manual.md \
  custom-domains-capability-setup.md custom-domains-capability-manage.md \
  custom-domains-capability-health.md custom-domains-capability-troubleshoot.md \
  custom-domains-capability-remove.md

merge_feature migration \
  migration-quickstart.md migration-code-patterns.md migration-user-import.md

merge_feature acul \
  acul-quickstart.md acul-acul-react-sdk.md acul-acul-js-sdk.md \
  acul-cli-commands.md acul-screen-catalog.md acul-social-providers.md acul-theming-patterns.md

echo "Feature refs written: $(ls "$SRC"/feature-*.md | wc -l)"
