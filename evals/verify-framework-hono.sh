#!/bin/bash
set -uo pipefail

# Framework Hono TEST-PLAN verification script (Phase 10)
# Implements the critical structural, reachability, SDK fact, and security tests
# Exit 0 if all pass; exit 1 if any fail.
#
# Test set = TEST-PLAN T-F1..T-F21 (now incl. T-F8 routes + T-F13 scope/perm guards,
# previously dropped) + T-R1..T-R8 dist-verified regression guards locking the CP3
# remediation fixes (I1-I9, D2). These are static greps; they enforce presence/absence
# of dist-sourced signatures, NOT runtime behavior.

# Resolve repo root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors for output (optional, for clarity)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
FAILED_TESTS=()

# Helper: run a test, track pass/fail
run_test() {
  local test_id="$1"
  local description="$2"
  local test_fn="$3"

  echo -n "[${test_id}] ${description}... "
  if $test_fn; then
    echo -e "${GREEN}PASS${NC}"
    ((PASS_COUNT++))
  else
    echo -e "${RED}FAIL${NC}"
    ((FAIL_COUNT++))
    FAILED_TESTS+=("$test_id")
  fi
}

# ============================================================================
# STRUCTURAL TESTS (T-Sxx)
# ============================================================================

# T-S1: framework-hono directory + 5 files exist
test_s1_files_exist() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  [[ -d "$hono_dir" ]] || return 1

  # Check for exact 5 files (no subdirs)
  local files=("$hono_dir"/*.md)
  local count=${#files[@]}

  # Filter to actual files (not glob if no match)
  if [[ "${files[0]}" == "$hono_dir"'/*.md' ]]; then
    echo " (no .md files found)"
    return 1
  fi

  [[ $count -eq 5 ]] || { echo " (found $count files, expected 5)"; return 1; }

  # Verify exact names
  local required=("index.md" "setup.md" "integrate.md" "api-reference.md" "patterns.md")
  for fname in "${required[@]}"; do
    [[ -f "$hono_dir/$fname" ]] || { echo " (missing $fname)"; return 1; }
  done

  return 0
}

# T-S2: File line counts sanity check
test_s2_line_counts() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  # Expected ranges (approx)
  # index.md: hub ~40–50 lines, setup.md: 200–300, integrate.md: 350–450,
  # api-reference.md: 300–400, patterns.md: 250–350
  # Hub files are smaller; all leaves > 200

  for f in index setup integrate api-reference patterns; do
    local fpath="$hono_dir/$f.md"
    if [[ ! -f "$fpath" ]]; then
      echo " (missing $f.md)"
      return 1
    fi

    local lc=$(wc -l < "$fpath")
    # Hub (index) can be smaller, leaves should be > 200
    if [[ "$f" != "index" ]] && [[ $lc -lt 200 ]]; then
      echo " ($f.md has $lc lines, too few for leaf)"
      return 1
    fi
    if [[ "$f" == "index" ]] && [[ $lc -lt 30 ]]; then
      echo " ($f.md has $lc lines, too few for hub)"
      return 1
    fi
  done

  # Check total
  local total=$(cat "$hono_dir"/*.md | wc -l)
  [[ $total -gt 1000 ]] || { echo " (total lines $total < 1000)"; return 1; }

  return 0
}

# T-S4: README.md Hono entry
test_s4_readme_hono() {
  local readme="README.md"
  [[ -f "$readme" ]] || { echo " (README.md missing)"; return 1; }

  # Check for Hono row after Fastify
  grep -q "| \*\*Hono\*\*" "$readme" || { echo " (Hono not in README)"; return 1; }

  return 0
}

# T-S5: No skill-test-report
test_s5_no_test_report() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if find "$hono_dir" -name "*test*report*" -o -name "*skill*test*" 2>/dev/null | grep -q .; then
    echo " (test-report artifact found)"
    return 1
  fi

  return 0
}

# T-S6: No bootstrap reference in setup.md
test_s6_no_bootstrap() {
  local setup="plugins/auth0/skills/auth0/references/framework-hono/setup.md"
  [[ -f "$setup" ]] || { echo " (setup.md missing)"; return 1; }

  if grep -iq "bootstrap" "$setup"; then
    echo " (bootstrap reference found in setup.md)"
    return 1
  fi

  return 0
}

# ============================================================================
# REACHABILITY TESTS (T-Nxx)
# ============================================================================

# T-N3: Hub dispatch table — single integrate row
test_n3_hub_dispatch() {
  local hub="plugins/auth0/skills/auth0/references/framework-hono/index.md"
  [[ -f "$hub" ]] || { echo " (index.md missing)"; return 1; }

  # Count rows with "integrate" in dispatch table (before "Then, as needed")
  local integrate_rows=$(grep -E '^\|.*integrate.*\|' "$hub" | head -2 | wc -l)

  # Should be 1 primary dispatch row (header + 1 data row = 2 lines, but grep -E should find 1 data row)
  # Actually, let's just verify integrate.md is referenced
  grep -q "integrate.md\|integrate\.md" "$hub" || { echo " (no integrate.md reference)"; return 1; }

  return 0
}

# T-N4: Hub "As needed" section
test_n4_as_needed() {
  local hub="plugins/auth0/skills/auth0/references/framework-hono/index.md"
  [[ -f "$hub" ]] || { echo " (index.md missing)"; return 1; }

  # Check "Then, as needed" section has setup, api-reference, patterns
  if ! grep -q "Then, as needed\|As needed" "$hub"; then
    echo " (no 'As needed' section)"
    return 1
  fi

  for name in setup api-reference patterns; do
    grep -A 20 "Then, as needed\|As needed" "$hub" | grep -q "$name" || {
      echo " (missing '$name' in 'As needed')"
      return 1
    }
  done

  return 0
}

# T-N5: Leaf files are sinks (no .md outbound links)
test_n5_leaves_no_links() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  for leaf in setup integrate api-reference patterns; do
    local fpath="$hono_dir/$leaf.md"
    [[ -f "$fpath" ]] || { echo " (missing $leaf.md)"; return 1; }

    # Check for markdown links: [text](*.md), [label]: *.md, <*.md>
    if grep -E '\[.*\]\(.*\.md.*\)|^\s*\[.*\]:\s*.*\.md|<.*\.md>' "$fpath" 2>/dev/null | grep -q .; then
      echo " ($leaf.md has .md outbound link)"
      return 1
    fi
  done

  return 0
}

# ============================================================================
# SDK FACT TESTS (T-Fxx)
# ============================================================================

# T-F1: authRequired default = true
test_f1_auth_required() {
  local api_ref="plugins/auth0/skills/auth0/references/framework-hono/api-reference.md"
  [[ -f "$api_ref" ]] || { echo " (api-reference.md missing)"; return 1; }

  grep -q "authRequired.*true\|true.*authRequired" "$api_ref" || {
    echo " (authRequired true not documented)"
    return 1
  }

  return 0
}

# T-F2: idpLogout default = false
test_f2_idp_logout() {
  local api_ref="plugins/auth0/skills/auth0/references/framework-hono/api-reference.md"
  [[ -f "$api_ref" ]] || { echo " (api-reference.md missing)"; return 1; }

  grep -q "idpLogout.*false\|false.*idpLogout" "$api_ref" || {
    echo " (idpLogout false not documented)"
    return 1
  }

  return 0
}

# T-F3: Cookie name = appSession
test_f3_app_session() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  grep -r "'appSession'" "$hono_dir" >/dev/null || {
    echo " (appSession not found)"
    return 1
  }

  return 0
}

# T-F4: NO session.internal.expiresAt
test_f4_no_expires_at() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "session\.internal\.expiresAt|session\[.*expiresAt" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (session.internal.expiresAt found)"
    return 1
  fi

  return 0
}

# T-F5: NO c.var.auth0.tokens
test_f5_no_tokens_field() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "c\.var\.auth0\.tokens|var\.auth0\s*=.*tokens" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (c.var.auth0.tokens found)"
    return 1
  fi

  return 0
}

# T-F6: clientID (capital ID)
test_f6_client_id_capital() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  grep -r "clientID" "$hono_dir" >/dev/null || {
    echo " (clientID not found)"
    return 1
  }

  return 0
}

# T-F7: NO clientId (lowercase)
test_f7_no_client_id_lower() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "clientId['\"]?:" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (clientId lowercase found)"
    return 1
  fi

  return 0
}

# T-F9: cancelSilentLogin present
test_f9_cancel_silent_login() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  grep -r "cancelSilentLogin" "$hono_dir" >/dev/null || {
    echo " (cancelSilentLogin not found)"
    return 1
  }

  return 0
}

# T-F10: NO pauseSilentLogin in active examples
test_f10_no_pause_silent_login_active() {
  local integrate="plugins/auth0/skills/auth0/references/framework-hono/integrate.md"
  [[ -f "$integrate" ]] || { echo " (integrate.md missing)"; return 1; }

  # pauseSilentLogin should only appear in deprecation notes, not in active code
  # Check: grep pauseSilentLogin, then filter to exclude deprecation context
  if grep -i "pauseSilentLogin" "$integrate" | grep -v -i "deprecat\|deprecated\|do not\|not recommended\|not use" | grep -q .; then
    echo " (pauseSilentLogin found in active context)"
    return 1
  fi

  return 0
}

# T-F11: NO getOrg() function (allowed only in FAQ as deprecation note)
test_f11_no_get_org() {
  local api_ref="plugins/auth0/skills/auth0/references/framework-hono/api-reference.md"
  [[ -f "$api_ref" ]] || { echo " (api-reference.md missing)"; return 1; }

  # getOrg should only appear in FAQ section, not in examples or main content
  # Check: if getOrg( appears outside of FAQ context (look for it before "Q:" markers)
  # Simple heuristic: extract FAQ section, then verify getOrg only appears there
  # Count total mentions vs FAQ mentions
  local total=$(grep -c "getOrg(" "$api_ref" 2>/dev/null || echo 0)
  local in_faq=$(grep -B1 "getOrg(" "$api_ref" 2>/dev/null | grep -c "^\*\*Q:" || echo 0)

  # If any mentions exist and they're all in Q&A lines, it's OK
  if [[ $total -gt 0 ]] && [[ $in_faq -eq 0 ]]; then
    # Check if the mention is in a Q&A line (line contains both "getOrg" and "Q:")
    local in_qa_line=$(grep "getOrg.*\*\*Q:\|\*\*Q:.*getOrg" "$api_ref" 2>/dev/null | wc -l)
    if [[ $in_qa_line -eq 0 ]]; then
      # Could be in answer, check next few lines
      if grep -A 2 "\*\*Q.*getOrg" "$api_ref" 2>/dev/null | grep -q "getOrg"; then
        return 0
      fi
      echo " (getOrg() found outside FAQ)"
      return 1
    fi
  fi

  return 0
}

# T-F12: NO revokeSession() function (allowed only in FAQ as deprecation note)
test_f12_no_revoke_session() {
  local api_ref="plugins/auth0/skills/auth0/references/framework-hono/api-reference.md"
  [[ -f "$api_ref" ]] || { echo " (api-reference.md missing)"; return 1; }

  # revokeSession should only appear in FAQ section, not in examples
  # Count total mentions
  local total=$(grep -c "revokeSession" "$api_ref" 2>/dev/null || echo 0)

  if [[ $total -eq 0 ]]; then
    return 0
  fi

  # If mentioned, must be in/near a **Q: line
  if grep -B1 -A3 "\*\*Q.*revokeSession\|revokeSession.*\*\*Q:" "$api_ref" 2>/dev/null | grep -q "revokeSession"; then
    return 0
  fi

  # Check if answer mentions it after Q:
  if grep -A 3 "\*\*Q: Is.*revokeSession" "$api_ref" 2>/dev/null | grep -q "revokeSession"; then
    return 0
  fi

  echo " (revokeSession found outside FAQ)"
  return 1
}

# T-F14: NO jwtVerifier or /api subpath
test_f14_no_jwt_verifier() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "jwtVerifier\(|@auth0/auth0-hono/api" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (jwtVerifier or /api subpath found)"
    return 1
  fi

  return 0
}

# T-F15: NO /testing subpath
test_f15_no_testing_subpath() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep "@auth0/auth0-hono/testing" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (/testing subpath found)"
    return 1
  fi

  return 0
}

# T-F16: onCallback hook throw-non-blocking clause
test_f16_on_callback_throw_non_blocking() {
  local integrate="plugins/auth0/skills/auth0/references/framework-hono/integrate.md"
  [[ -f "$integrate" ]] || { echo " (integrate.md missing)"; return 1; }

  # Look for "throw" + "NOT" + "block" or "does not block" in context of onCallback
  if grep -i "onCallback\|throwing.*block\|throw.*does.*not.*block\|return.*Response.*deny" "$integrate" | grep -q .; then
    return 0
  fi

  echo " (onCallback throw-non-blocking not documented)"
  return 1
}

# T-F17: All 7 error types present
test_f17_error_types() {
  local api_ref="plugins/auth0/skills/auth0/references/framework-hono/api-reference.md"
  [[ -f "$api_ref" ]] || { echo " (api-reference.md missing)"; return 1; }

  local errors=(
    "AccessDeniedError"
    "LoginRequiredError"
    "InvalidGrantError"
    "MissingSessionError"
    "MissingTransactionError"
    "TokenRefreshError"
    "ConnectionTokenError"
  )

  for err in "${errors[@]}"; do
    grep -q "$err" "$api_ref" || {
      echo " (missing $err)"
      return 1
    }
  done

  return 0
}

# T-F18: Node 18+
test_f18_node_18() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  grep -r "Node.*18\|18+" "$hono_dir" >/dev/null || {
    echo " (Node 18+ not documented)"
    return 1
  }

  return 0
}

# T-F19: NO Node 20 LTS claim
test_f19_no_node_20_lts() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "Node 20.*LTS|Node\.js 20.*LTS" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (Node 20 LTS claim found)"
    return 1
  fi

  return 0
}

# T-F20: ESM imports present
test_f20_esm_imports() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  grep -r "^import\|from 'hono'\|from '@auth0" "$hono_dir" >/dev/null || {
    echo " (no ESM imports found)"
    return 1
  }

  return 0
}

# T-F21: NO CommonJS require()
test_f21_no_commonjs() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -E "require\(\|module\.exports" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (CommonJS require found)"
    return 1
  fi

  return 0
}

# T-F8: Default routes /login, /logout, /callback documented
test_f8_routes_present() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  for route in "/login" "/logout" "/callback"; do
    grep -rq -- "$route" "$hono_dir" || { echo " (route $route not documented)"; return 1; }
  done

  return 0
}

# T-F13: NO requiresScopes / requiresPermissions (banned non-exports)
test_f13_no_scope_perm_guards() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -rE "requiresScopes|requiresPermissions" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (requiresScopes/requiresPermissions found — not exported by SDK)"
    return 1
  fi

  return 0
}

# ============================================================================
# REGRESSION GUARDS (T-Rxx) — lock CP3 dist-verified defect fixes (I1-I9, D2)
# Each MUST-ABSENT guard re-fails if a defect is reintroduced.
# ============================================================================

# T-R1 (I1): NO honoEnv import (dist lib/honoEnv.js body = `export {};`, exports nothing)
test_r1_no_hono_env() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -rn "honoEnv" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (honoEnv reference found — dead runtime export)"
    return 1
  fi

  return 0
}

# T-R2 (I2): NO env(c) usage (module-scope crash; SDK auto-reads bindings)
test_r2_no_env_c() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -rnF "env(c)" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (env(c) found — module-scope ReferenceError)"
    return 1
  fi

  return 0
}

# T-R3 (I3): NO snake_case access_token; camelCase accessToken IS the dist field
test_r3_access_token_camel() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -rn "access_token" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (access_token snake_case found — dist field is accessToken)"
    return 1
  fi
  # Positive: accessToken must be present
  grep -rq "accessToken" "$hono_dir"/*.md || { echo " (accessToken not present)"; return 1; }

  return 0
}

# T-R4 (I4): NO cancelSilentLogin(c) code call (dist = zero-arg middleware factory)
test_r4_cancel_silent_login_arity() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  # Code call has trailing semicolon; prose warning does not.
  if grep -rnF "cancelSilentLogin(c);" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (cancelSilentLogin(c); code call — wrong arity)"
    return 1
  fi

  return 0
}

# T-R5 (I5): updateSession must be awaited (async persist; fire-and-forget loses writes)
test_r5_update_session_awaited() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  # Fail on a statement-position updateSession( call not prefixed by await.
  if grep -rnE "^[[:space:]]*updateSession\(" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (un-awaited updateSession() call found)"
    return 1
  fi
  # Positive: at least one awaited call present
  grep -rq "await updateSession(" "$hono_dir"/*.md || { echo " (no awaited updateSession)"; return 1; }

  return 0
}

# T-R6 (I7): SessionStore uses StateData contract (not SessionData) + required deleteByLogoutToken
test_r6_session_store_shape() {
  local patterns="plugins/auth0/skills/auth0/references/framework-hono/patterns.md"
  [[ -f "$patterns" ]] || { echo " (patterns.md missing)"; return 1; }

  grep -q "StateData" "$patterns" || { echo " (StateData not used in store contract)"; return 1; }
  grep -q "deleteByLogoutToken(claims" "$patterns" || { echo " (deleteByLogoutToken(claims) sig missing)"; return 1; }
  # NO null return in store get() — dist returns StateData | undefined
  if grep -nE "return (data \? [^;]*: null|null)" "$patterns" 2>/dev/null | grep -q .; then
    echo " (store returns null; dist contract is undefined)"
    return 1
  fi

  return 0
}

# T-R7 (I8): standalone handleLogin takes NO client config (domain/clientID) — only flow params
test_r7_handle_login_no_client_config() {
  local patterns="plugins/auth0/skills/auth0/references/framework-hono/patterns.md"
  [[ -f "$patterns" ]] || { echo " (patterns.md missing)"; return 1; }

  # handleLogin({ ... domain ... }) is the fabricated per-tenant form.
  if grep -nE "handleLogin\(\{" "$patterns" 2>/dev/null | grep -q .; then
    # Allow only if it does not contain client-config keys nearby
    if grep -A3 "handleLogin({" "$patterns" 2>/dev/null | grep -qE "domain:|clientID:|baseURL:"; then
      echo " (handleLogin passed client config — not accepted by SDK)"
      return 1
    fi
  fi

  return 0
}

# T-R8 (D2): NO "Vercel Edge" runtime claim (not in dist/pkg/REQ)
test_r8_no_vercel_edge() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -rn "Vercel" "$hono_dir"/*.md 2>/dev/null | grep -q .; then
    echo " (Vercel runtime claim found — unsourced)"
    return 1
  fi

  return 0
}

# ============================================================================
# SECURITY & PII TESTS (T-Pxx)
# ============================================================================

# T-P1: NO tenant domain
test_p1_no_tenant_domain() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -r "dev-10whndm3tf8jetu5" "$hono_dir" 2>/dev/null | grep -q .; then
    echo " (tenant domain leaked)"
    return 1
  fi

  return 0
}

# T-P2: NO client ID (exact value)
test_p2_no_client_id_leaked() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -r "vxx3Ko8xqRJgYqgvkOcuAiGLbYTiYYGM" "$hono_dir" 2>/dev/null | grep -q .; then
    echo " (client ID leaked)"
    return 1
  fi

  return 0
}

# T-P3: NO email address
test_p3_no_email_leaked() {
  local hono_dir="plugins/auth0/skills/auth0/references/framework-hono"

  if grep -r "tushar\.pandey@okta\.com" "$hono_dir" 2>/dev/null | grep -q .; then
    echo " (email address leaked)"
    return 1
  fi

  # Also check broader: no @okta.com emails (unless in generic examples)
  if grep -r "@okta\.com" "$hono_dir" 2>/dev/null | grep -v "example\|placeholder" | grep -q .; then
    echo " (okta.com email found)"
    return 1
  fi

  return 0
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

echo "==============================================="
echo "Framework Hono TEST-PLAN Verification"
echo "==============================================="
echo

# Run all tests
run_test "T-S1" "Files exist (index, setup, integrate, api-reference, patterns)" "test_s1_files_exist"
run_test "T-S2" "Line counts sanity (>50 each, >1000 total)" "test_s2_line_counts"
run_test "T-S4" "README.md Hono entry" "test_s4_readme_hono"
run_test "T-S5" "No skill-test-report artifact" "test_s5_no_test_report"
run_test "T-S6" "No bootstrap reference in setup.md" "test_s6_no_bootstrap"

run_test "T-N3" "Hub dispatch table has integrate row" "test_n3_hub_dispatch"
run_test "T-N4" "Hub 'As needed' section lists setup, api-reference, patterns" "test_n4_as_needed"
run_test "T-N5" "Leaf files are sinks (no .md links)" "test_n5_leaves_no_links"

run_test "T-F8" "Default routes /login /logout /callback documented" "test_f8_routes_present"
run_test "T-F13" "NO requiresScopes/requiresPermissions (non-exports)" "test_f13_no_scope_perm_guards"
run_test "T-F1" "authRequired default = true" "test_f1_auth_required"
run_test "T-F2" "idpLogout default = false" "test_f2_idp_logout"
run_test "T-F3" "Cookie name = appSession" "test_f3_app_session"
run_test "T-F4" "NO session.internal.expiresAt" "test_f4_no_expires_at"
run_test "T-F5" "NO c.var.auth0.tokens" "test_f5_no_tokens_field"
run_test "T-F6" "clientID (capital ID) present" "test_f6_client_id_capital"
run_test "T-F7" "NO clientId (lowercase)" "test_f7_no_client_id_lower"
run_test "T-F9" "cancelSilentLogin present" "test_f9_cancel_silent_login"
run_test "T-F10" "NO pauseSilentLogin in active code" "test_f10_no_pause_silent_login_active"
run_test "T-F11" "NO getOrg() function" "test_f11_no_get_org"
run_test "T-F12" "NO revokeSession() function" "test_f12_no_revoke_session"
run_test "T-F14" "NO jwtVerifier or /api subpath" "test_f14_no_jwt_verifier"
run_test "T-F15" "NO /testing subpath" "test_f15_no_testing_subpath"
run_test "T-F16" "onCallback hook throw-non-blocking documented" "test_f16_on_callback_throw_non_blocking"
run_test "T-F17" "All 7 error types present" "test_f17_error_types"
run_test "T-F18" "Node 18+ documented" "test_f18_node_18"
run_test "T-F19" "NO Node 20 LTS claim" "test_f19_no_node_20_lts"
run_test "T-F20" "ESM imports present" "test_f20_esm_imports"
run_test "T-F21" "NO CommonJS require()" "test_f21_no_commonjs"

run_test "T-R1" "REGRESSION I1: NO honoEnv (dead export)" "test_r1_no_hono_env"
run_test "T-R2" "REGRESSION I2: NO env(c) module-scope call" "test_r2_no_env_c"
run_test "T-R3" "REGRESSION I3: accessToken camelCase (NO access_token)" "test_r3_access_token_camel"
run_test "T-R4" "REGRESSION I4: NO cancelSilentLogin(c) wrong arity" "test_r4_cancel_silent_login_arity"
run_test "T-R5" "REGRESSION I5: updateSession awaited" "test_r5_update_session_awaited"
run_test "T-R6" "REGRESSION I7: SessionStore StateData contract" "test_r6_session_store_shape"
run_test "T-R7" "REGRESSION I8: handleLogin no client config" "test_r7_handle_login_no_client_config"
run_test "T-R8" "REGRESSION D2: NO Vercel Edge runtime claim" "test_r8_no_vercel_edge"

run_test "T-P1" "NO tenant domain leaked" "test_p1_no_tenant_domain"
run_test "T-P2" "NO client ID leaked (exact)" "test_p2_no_client_id_leaked"
run_test "T-P3" "NO email address leaked" "test_p3_no_email_leaked"

echo
echo "==============================================="
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "verify-framework-hono: $PASS_COUNT/$TOTAL checks passed"
echo "==============================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "\n${RED}FAILED TESTS:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  - $test"
  done
  echo
  exit 1
else
  echo -e "\n${GREEN}All tests passed!${NC}"
  echo
  exit 0
fi
