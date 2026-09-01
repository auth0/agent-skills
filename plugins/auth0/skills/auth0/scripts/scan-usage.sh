#!/usr/bin/env bash
# scan-usage.sh — discover every node-auth0 Authentication API call site in a codebase.
#
# Usage:  bash scan-usage.sh <path-to-src>
#
# Produces an inventory of what must be migrated (AuthenticationClient / UserInfoClient and each
# sub-client call), plus a separate list of ManagementClient usage that must be LEFT ALONE.
# Read-only: greps and counts, changes nothing.

set -euo pipefail

ROOT="${1:-.}"

if [ ! -d "$ROOT" ]; then
  echo "error: '$ROOT' is not a directory" >&2
  echo "usage: bash scan-usage.sh <path-to-src>" >&2
  exit 2
fi

# Only look at JS/TS sources; skip dependencies and build output.
FILE_GLOBS=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.cts' --include='*.mts')
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=.git --exclude-dir=coverage)

# grep helper: recursive, line-numbered, extended regex. Never fail the script on "no matches".
scan() { grep -rEn "${FILE_GLOBS[@]}" "${EXCLUDES[@]}" "$1" "$ROOT" 2>/dev/null || true; }
count() { scan "$1" | wc -l | tr -d ' '; }

section() { printf '\n=== %s ===\n' "$1"; }

echo "node-auth0 → auth0-auth-js / auth0-server-js — usage scan"
echo "root: $ROOT"

section "Imports from the 'auth0' package"
scan "from ['\"]auth0['\"]|require\(['\"]auth0['\"]\)"

section "AuthenticationClient construction (MIGRATE)"
scan "new[[:space:]]+AuthenticationClient"

section "UserInfoClient construction (MIGRATE → claims / getUser / direct fetch)"
scan "new[[:space:]]+UserInfoClient|\.getUserInfo\("

section "oauth.* calls (MIGRATE → AuthClient methods)"
scan "\.oauth\.(authorizationCodeGrant|authorizationCodeGrantWithPKCE|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)"

section "database.* calls (MIGRATE → authClient.database.*)"
scan "\.database\.(signUp|changePassword)"

section "passwordless.* calls (MIGRATE → authClient.passwordless.* + grant methods)"
scan "\.passwordless\.(sendEmail|sendSMS|loginWithEmail|loginWithSMS)"

section "backchannel.* calls (MIGRATE → CIBA methods)"
scan "\.backchannel\.(authorize|backchannelGrant)"

section "tokenExchange.* calls (MIGRATE → exchangeToken)"
scan "\.tokenExchange\.exchangeToken"

section "AuthApiError / id-token validation types (MIGRATE → typed errors / claims)"
scan "AuthApiError|IDTokenValidateOptions|IdTokenValidatorError"

section "High-risk residue: expires_in arithmetic (INSPECT — expiresAt is absolute)"
scan "expires_in"

section "ManagementClient usage (DO NOT MIGRATE — stays on 'auth0')"
scan "new[[:space:]]+ManagementClient|ManagementClient"

section "Summary counts"
printf '%-45s %s\n' "AuthenticationClient constructions:" "$(count 'new[[:space:]]+AuthenticationClient')"
printf '%-45s %s\n' "UserInfoClient / getUserInfo:"       "$(count 'new[[:space:]]+UserInfoClient|\.getUserInfo\(')"
printf '%-45s %s\n' "oauth.* calls:"                      "$(count '\.oauth\.(authorizationCodeGrant|authorizationCodeGrantWithPKCE|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)')"
printf '%-45s %s\n' "database.* calls:"                   "$(count '\.database\.(signUp|changePassword)')"
printf '%-45s %s\n' "passwordless.* calls:"               "$(count '\.passwordless\.(sendEmail|sendSMS|loginWithEmail|loginWithSMS)')"
printf '%-45s %s\n' "backchannel.* calls:"                "$(count '\.backchannel\.(authorize|backchannelGrant)')"
printf '%-45s %s\n' "tokenExchange.* calls:"              "$(count '\.tokenExchange\.exchangeToken')"
printf '%-45s %s\n' "expires_in occurrences (inspect):"   "$(count 'expires_in')"
printf '%-45s %s\n' "ManagementClient refs (leave alone):" "$(count 'ManagementClient')"

echo
echo "Next: use references/feature-migrate-node-auth0/routing.md to choose the target SDK, then"
echo "references/feature-migrate-node-auth0/api-mapping.md to rewrite each call site above."
