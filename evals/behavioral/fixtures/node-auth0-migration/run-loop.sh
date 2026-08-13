#!/usr/bin/env bash
# run-loop.sh — build-until-green migration orchestrator for node-auth0 → auth0-auth-js/auth0-server-js
#
# Stages:
#   1. scan-usage.sh     — discover node-auth0 usage (informational)
#   2. AGENT REWRITE     — gated on MIGRATION_AGENT_CMD env var (requires claude CLI + Auth0 creds)
#   3. tsc --noEmit      — type-check must pass
#   4. npm test          — tests must pass
#   5. verify-migration  — residue scan (enforced only if agent step ran)
#
# Loop stages 2-5 up to MAX_ITERS (default 3). Exit 0 if all green, exit 1 if still failing.
#
# Usage:
#   # In container (defaults)
#   bash run-loop.sh
#
#   # Locally against before/ fixture
#   APP_DIR=/Users/tushar.pandey/src/agent-skills/evals/behavioral/fixtures/node-auth0-migration/before \
#   SKILL_SCRIPTS=/Users/tushar.pandey/src/agent-skills/plugins/auth0/skills/migrating-node-auth0-to-auth0-server-js/scripts \
#   bash run-loop.sh
#
#   # With agent rewrite enabled (example)
#   MIGRATION_AGENT_CMD='claude -m opus "migrate this app from node-auth0 to auth0-server-js"' \
#   bash run-loop.sh

set -euo pipefail

# ========== CONFIG ==========

APP_DIR="${1:-${APP_DIR:-/app}}"
SKILL_SCRIPTS="${SKILL_SCRIPTS:-/skill-scripts}"
MAX_ITERS="${MAX_ITERS:-3}"
MIGRATION_AGENT_CMD="${MIGRATION_AGENT_CMD:-}"

# Derived paths
SCAN_SCRIPT="${SKILL_SCRIPTS}/scan-usage.sh"
VERIFY_SCRIPT="${SKILL_SCRIPTS}/verify-migration.sh"

# Track whether agent step ran (determines if we enforce verify-migration.sh)
AGENT_STEP_RAN=false

# ========== HELPERS ==========

banner() {
  printf '\n========================================\n'
  printf '  %s\n' "$1"
  printf '========================================\n\n'
}

stage_banner() {
  printf '\n--- Stage %s: %s ---\n' "$1" "$2"
}

error_banner() {
  printf '\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n'
  printf '  FAILED: %s\n' "$1"
  printf '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n'
}

success_banner() {
  printf '\n========================================\n'
  printf '  SUCCESS: Migration build-until-green complete\n'
  printf '========================================\n'
  printf '  - Type-check: PASS\n'
  printf '  - Tests: PASS\n'
  if [ "$AGENT_STEP_RAN" = true ]; then
    printf '  - Residue scan: PASS\n'
  else
    printf '  - Residue scan: SKIPPED (agent step not run)\n'
  fi
  printf '========================================\n\n'
}

# ========== PREFLIGHT ==========

banner "Migration Run-Loop Preflight"

echo "Configuration:"
echo "  APP_DIR:           $APP_DIR"
echo "  SKILL_SCRIPTS:     $SKILL_SCRIPTS"
echo "  MAX_ITERS:         $MAX_ITERS"
echo "  MIGRATION_AGENT_CMD: ${MIGRATION_AGENT_CMD:-<not set>}"
echo

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: APP_DIR '$APP_DIR' is not a directory" >&2
  exit 2
fi

if [ ! -f "$SCAN_SCRIPT" ]; then
  echo "ERROR: scan-usage.sh not found at '$SCAN_SCRIPT'" >&2
  exit 2
fi

if [ ! -f "$VERIFY_SCRIPT" ]; then
  echo "ERROR: verify-migration.sh not found at '$VERIFY_SCRIPT'" >&2
  exit 2
fi

if [ ! -f "$APP_DIR/package.json" ]; then
  echo "ERROR: package.json not found in APP_DIR '$APP_DIR'" >&2
  exit 2
fi

echo "Preflight checks passed."

# ========== STAGE 1: SCAN (informational) ==========

banner "Stage 1: Usage Scan (Informational)"

if ! bash "$SCAN_SCRIPT" "$APP_DIR"; then
  error_banner "scan-usage.sh failed (exit code $?)"
  exit 1
fi

echo "Usage scan complete."

# ========== ITERATION LOOP ==========

for iter in $(seq 1 "$MAX_ITERS"); do
  banner "Iteration $iter/$MAX_ITERS"

  # ========== STAGE 2: AGENT REWRITE (gated) ==========

  stage_banner 2 "Agent Rewrite"

  if [ -n "$MIGRATION_AGENT_CMD" ]; then
    echo "Running agent rewrite command..."
    echo "  Command: $MIGRATION_AGENT_CMD"
    echo

    # Change to app dir for agent execution (agent may expect to run in the project root)
    pushd "$APP_DIR" > /dev/null

    # Eval the command (allows complex commands with args/pipes)
    if eval "$MIGRATION_AGENT_CMD"; then
      echo
      echo "Agent rewrite step completed successfully."
      AGENT_STEP_RAN=true
    else
      error_banner "Agent rewrite step failed (exit code $?)"
      popd > /dev/null
      exit 1
    fi

    popd > /dev/null
  else
    echo "SKIP: agent rewrite step — set MIGRATION_AGENT_CMD to enable"
    echo "      (requires claude CLI + Auth0 creds)"
    echo
    echo "Without the agent rewrite, the BEFORE fixture will still contain old patterns."
    echo "The verify-migration.sh step will report residue but will NOT fail this run."
  fi

  # ========== STAGE 3: TYPE-CHECK ==========

  stage_banner 3 "Type-Check (tsc --noEmit)"

  pushd "$APP_DIR" > /dev/null
  if npm run build; then
    echo
    echo "Type-check passed."
  else
    error_banner "Type-check failed (iteration $iter/$MAX_ITERS)"
    popd > /dev/null

    # If we're out of iterations, fail
    if [ "$iter" -eq "$MAX_ITERS" ]; then
      echo "Max iterations reached. Exiting with failure."
      exit 1
    fi

    # Otherwise, continue to next iteration
    echo "Continuing to next iteration..."
    popd > /dev/null
    continue
  fi
  popd > /dev/null

  # ========== STAGE 4: TESTS ==========

  stage_banner 4 "Tests (npm test)"

  pushd "$APP_DIR" > /dev/null
  if npm test; then
    echo
    echo "Tests passed."
  else
    error_banner "Tests failed (iteration $iter/$MAX_ITERS)"
    popd > /dev/null

    # If we're out of iterations, fail
    if [ "$iter" -eq "$MAX_ITERS" ]; then
      echo "Max iterations reached. Exiting with failure."
      exit 1
    fi

    # Otherwise, continue to next iteration
    echo "Continuing to next iteration..."
    popd > /dev/null
    continue
  fi
  popd > /dev/null

  # ========== STAGE 5: RESIDUE SCAN ==========

  stage_banner 5 "Residue Scan (verify-migration.sh)"

  # Run the verify script; capture exit code without failing due to set -e
  set +e
  bash "$VERIFY_SCRIPT" "$APP_DIR"
  VERIFY_EXIT=$?
  set -e

  if [ "$VERIFY_EXIT" -eq 0 ]; then
    echo
    echo "Residue scan passed: no residue detected."
  else
    echo
    echo "Residue scan detected old patterns (exit code $VERIFY_EXIT)."

    # If agent step ran, this is a failure; otherwise it's informational
    if [ "$AGENT_STEP_RAN" = true ]; then
      error_banner "Residue scan failed (iteration $iter/$MAX_ITERS)"

      # If we're out of iterations, fail
      if [ "$iter" -eq "$MAX_ITERS" ]; then
        echo "Max iterations reached. Exiting with failure."
        exit 1
      fi

      # Otherwise, continue to next iteration
      echo "Continuing to next iteration..."
      continue
    else
      echo
      echo "NOTE: Residue is expected when agent step is skipped (BEFORE fixture unchanged)."
      echo "      This is informational only and does not fail the run."
    fi
  fi

  # ========== ALL STAGES PASSED ==========

  success_banner
  exit 0

done

# If we exhaust iterations without all stages passing
error_banner "Max iterations ($MAX_ITERS) reached without all stages passing"
exit 1
