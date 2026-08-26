#!/usr/bin/env bash
# verify-migration.sh — flag leftover node-auth0 residue after a migration pass.
#
# Usage:  bash verify-migration.sh <path-to-src>
#
# Exits non-zero if any high-signal residue is found, so it can gate CI. It does NOT run the
# project's own type-checker or tests — run `tsc --noEmit`, the linter, and the test suite
# separately after this passes.
#
# Checks:
#   1. Residual AuthenticationClient / UserInfoClient usage (should be gone from migrated files).
#   2. Residual node-auth0 auth sub-client calls (.oauth./.passwordless./.backchannel./.tokenExchange.).
#   3. `.data.` access on what looks like a token/grant result (return-shape residue).
#   4. `expires_in` arithmetic (the relative→absolute expiry hazard).
#   5. `AuthApiError` catches and `'mfa_required'` string checks (error-model residue).
#
# ManagementClient is intentionally NOT flagged — it stays on the 'auth0' package.

set -uo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT" ]; then
  echo "error: '$ROOT' is not a directory" >&2
  echo "usage: bash verify-migration.sh <path-to-src>" >&2
  exit 2
fi

FILE_GLOBS=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cts' --include='*.mts')
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.git --exclude-dir=coverage)

FAILED=0

# check <label> <regex> <hint>
check() {
  local label="$1" regex="$2" hint="$3"
  local hits
  hits="$(grep -rEn "${FILE_GLOBS[@]}" "${EXCLUDES[@]}" "$regex" "$ROOT" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    printf '\n[FAIL] %s\n' "$label"
    printf '       %s\n' "$hint"
    printf '%s\n' "$hits" | sed 's/^/       /'
    FAILED=1
  else
    printf '[ ok ] %s\n' "$label"
  fi
}

echo "verify-migration — residue check"
echo "root: $ROOT"
echo

check "No residual AuthenticationClient" \
  "new[[:space:]]+AuthenticationClient" \
  "Replace with AuthClient (@auth0/auth0-auth-js) or ServerClient (@auth0/auth0-server-js)."

check "No residual UserInfoClient" \
  "UserInfoClient" \
  "Use TokenResponse.claims, serverClient.getUser(), or a direct /userinfo fetch."

check "No residual node-auth0 auth sub-client calls" \
  "\.oauth\.(authorizationCodeGrant|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)|\.passwordless\.(sendSMS|loginWithEmail|loginWithSMS)|\.backchannel\.(authorize|backchannelGrant)|\.tokenExchange\.exchangeToken" \
  "Map each call via references/api-mapping.md."

check "No '.data.' access on token/grant results" \
  "\.(data)\.(access_token|refresh_token|id_token|expires_in|token_type)" \
  "New SDKs return the domain object directly; read tokens.accessToken, not resp.data.access_token."

check "No relative expires_in arithmetic" \
  "Date\.now\(\)[[:space:]]*\+[^;]*expires_in|expires_in[[:space:]]*\*[[:space:]]*1000" \
  "expiresAt is an ABSOLUTE Unix timestamp (seconds). Do not add Date.now(). See breaking-changes.md#3."

check "No AuthApiError catches" \
  "AuthApiError" \
  "Use the typed per-operation error (e.g. TokenByRefreshTokenError) and check e.cause.error."

check "No 'mfa_required' string checks" \
  "['\"]mfa_required['\"]" \
  "Use isMfaRequiredError(e) from @auth0/auth0-auth-js instead of string matching."

echo
if [ "$FAILED" -ne 0 ]; then
  echo "RESULT: residue found — resolve the [FAIL] items above, then re-run."
  echo "After this passes, run the project's own: tsc --noEmit, lint, and tests."
  exit 1
fi
echo "RESULT: no residue detected. Now run the project's own tsc --noEmit, lint, and tests."
